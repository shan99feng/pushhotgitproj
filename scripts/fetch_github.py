#!/usr/bin/env python3
"""
GitHub Hot Daily - GitHub 热门项目采集脚本
运行方式：python scripts/fetch_github.py [YYYY-MM-DD]
输出：data/daily/YYYY-MM-DD.json 和更新 data/index.json

数据来源：GitHub Trending（通过 GitHub API + 网页解析）
"""

import os
import json
import time
import re
import ssl
import urllib.request
import urllib.parse
import urllib.error
import http.client
from datetime import datetime, timezone, timedelta
from pathlib import Path

# ===== 自动加载 .env 文件 =====
def _load_dotenv():
    script_dir = Path(__file__).parent
    candidates = [script_dir / ".env", script_dir.parent / ".env"]
    for env_file in candidates:
        if env_file.exists():
            with open(env_file, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, val = line.partition("=")
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val
            break

_load_dotenv()

# ===== SSL 修复 =====
try:
    import certifi
    _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CONTEXT = ssl._create_unverified_context()

# ===== 配置 =====
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
DAILY_TARGET = int(os.getenv("DAILY_TARGET", "20"))
LANGUAGES_STR = os.getenv("LANGUAGES", "python,javascript,typescript,go,rust,java,cpp,c")
LANGUAGES = [l.strip() for l in LANGUAGES_STR.split(",") if l.strip()]
SINCE = os.getenv("SINCE", "daily")  # daily / weekly / monthly
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.siliconflow.cn/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "Qwen/Qwen2.5-7B-Instruct")
REQUEST_INTERVAL = float(os.getenv("REQUEST_INTERVAL", "1"))
MAX_RETRY = int(os.getenv("MAX_RETRY", "3"))

DATA_DIR = Path(__file__).parent.parent / "data"
DAILY_DIR = DATA_DIR / "daily"
INDEX_FILE = DATA_DIR / "index.json"

# ===== 语言到分类的映射 =====
LANG_CATEGORY_MAP = {
    # AI/ML
    "python": "ai_ml",
    "jupyter notebook": "ai_ml",
    "r": "ai_ml",
    # 前端
    "javascript": "frontend",
    "typescript": "frontend",
    "html": "frontend",
    "css": "frontend",
    "vue": "frontend",
    "svelte": "frontend",
    # 后端/系统
    "go": "backend",
    "java": "backend",
    "kotlin": "backend",
    "scala": "backend",
    "php": "backend",
    "ruby": "backend",
    "elixir": "backend",
    # 系统/底层
    "rust": "systems",
    "c": "systems",
    "c++": "systems",
    "cpp": "systems",
    "zig": "systems",
    "assembly": "systems",
    # 移动端
    "swift": "mobile",
    "objective-c": "mobile",
    "dart": "mobile",
    # DevOps/工具
    "shell": "devops",
    "dockerfile": "devops",
    "hcl": "devops",
    "makefile": "devops",
    # 其他
    "c#": "other",
    "f#": "other",
    "haskell": "other",
    "lua": "other",
    "perl": "other",
}

def get_category(language):
    """根据编程语言获取分类"""
    if not language:
        return "other"
    return LANG_CATEGORY_MAP.get(language.lower(), "other")

# ===== 工具函数 =====
def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

def http_get(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {})
    req.add_header("User-Agent", "GitHub-Hot-Daily/1.0 (https://github.com/github-hot-daily)")
    if GITHUB_TOKEN:
        req.add_header("Authorization", f"token {GITHUB_TOKEN}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CONTEXT) as resp:
        return resp.read().decode("utf-8")

def http_post_json(url, data, headers=None):
    """发送 JSON POST 请求"""
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc
    path = parsed.path or "/"
    if parsed.query:
        path += "?" + parsed.query
    use_ssl = parsed.scheme == "https"
    conn = http.client.HTTPSConnection(host, context=_SSL_CONTEXT, timeout=60) if use_ssl \
        else http.client.HTTPConnection(host, timeout=60)
    try:
        req_headers = {
            "Content-Type": "application/json",
            "Content-Length": str(len(body)),
        }
        for k, v in (headers or {}).items():
            req_headers[k] = v
        conn.request("POST", path, body=body, headers=req_headers)
        resp = conn.getresponse()
        resp_body = resp.read().decode("utf-8")
        if resp.status == 429:
            raise urllib.error.HTTPError(url, 429, "Too Many Requests", {}, None)
        if resp.status >= 400:
            raise urllib.error.HTTPError(url, resp.status, resp.reason, {}, None)
        return json.loads(resp_body)
    finally:
        conn.close()

# ===== GitHub Trending 采集 =====

def fetch_github_trending(language="", since="daily"):
    """
    通过 GitHub Trending 页面采集热门项目
    language: 编程语言（空字符串表示所有语言）
    since: daily / weekly / monthly
    """
    lang_param = urllib.parse.quote(language) if language else ""
    url = f"https://github.com/trending/{lang_param}?since={since}&spoken_language_code=en"
    log(f"  📡 采集 GitHub Trending: language={language or 'all'}, since={since}")

    try:
        html = http_get(url, timeout=30)
        return parse_trending_html(html, language)
    except Exception as e:
        log(f"  ⚠️  采集失败 ({language or 'all'}): {e}")
        return []

def parse_trending_html(html, language=""):
    """解析 GitHub Trending 页面 HTML，提取项目信息"""
    repos = []

    # 匹配每个仓库块
    # GitHub Trending 页面结构：每个 article.Box-row 包含一个仓库
    repo_blocks = re.findall(
        r'<article class="Box-row">(.*?)</article>',
        html, re.DOTALL
    )

    if not repo_blocks:
        # 尝试新版 GitHub 页面结构
        repo_blocks = re.findall(
            r'<article[^>]*>(.*?)</article>',
            html, re.DOTALL
        )

    for block in repo_blocks:
        try:
            repo = parse_repo_block(block, language)
            if repo:
                repos.append(repo)
        except Exception as e:
            pass

    return repos

def parse_repo_block(block, language=""):
    """解析单个仓库块"""
    # 提取仓库名（owner/name）
    name_match = re.search(
        r'href="/([^/]+/[^/"]+)"[^>]*>\s*<span[^>]*>([^<]+)</span>\s*/\s*<span[^>]*>([^<]+)</span>',
        block
    )
    if not name_match:
        # 备用匹配
        name_match = re.search(r'href="/([a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+)"', block)
        if not name_match:
            return None
        full_name = name_match.group(1).strip()
        owner, _, repo_name = full_name.partition("/")
    else:
        owner = name_match.group(2).strip()
        repo_name = name_match.group(3).strip()
        full_name = f"{owner}/{repo_name}"

    # 提取描述
    desc_match = re.search(r'<p[^>]*class="[^"]*col-9[^"]*"[^>]*>\s*(.*?)\s*</p>', block, re.DOTALL)
    description = ""
    if desc_match:
        description = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip()

    # 提取编程语言
    lang_match = re.search(
        r'<span[^>]*itemprop="programmingLanguage"[^>]*>([^<]+)</span>',
        block
    )
    detected_lang = lang_match.group(1).strip() if lang_match else language

    # 提取 Star 数
    stars_match = re.search(
        r'href="[^"]+/stargazers"[^>]*>\s*<svg[^>]*>.*?</svg>\s*([\d,]+)',
        block, re.DOTALL
    )
    stars = 0
    if stars_match:
        stars = int(stars_match.group(1).replace(",", ""))

    # 提取 Fork 数
    forks_match = re.search(
        r'href="[^"]+/forks"[^>]*>\s*<svg[^>]*>.*?</svg>\s*([\d,]+)',
        block, re.DOTALL
    )
    forks = 0
    if forks_match:
        forks = int(forks_match.group(1).replace(",", ""))

    # 提取今日新增 Star
    today_stars_match = re.search(
        r'([\d,]+)\s+stars?\s+today',
        block, re.IGNORECASE
    )
    today_stars = 0
    if today_stars_match:
        today_stars = int(today_stars_match.group(1).replace(",", ""))

    # 热度分数：今日新增 Star * 10 + 总 Star 数的对数
    import math
    hot_score = today_stars * 10 + (math.log10(max(stars, 1)) * 100)

    return {
        "repo_id": f"github-{full_name.replace('/', '-')}",
        "source": "github",
        "full_name": full_name,
        "owner": owner,
        "name": repo_name,
        "description": description,
        "language": detected_lang,
        "category": get_category(detected_lang),
        "stars": stars,
        "forks": forks,
        "today_stars": today_stars,
        "hot_score": round(hot_score, 1),
        "url": f"https://github.com/{full_name}",
        "topics": [],
        "structured_summary": None,
    }

def fetch_repo_details(full_name):
    """通过 GitHub API 获取仓库详细信息（topics、创建时间等）"""
    url = f"https://api.github.com/repos/{full_name}"
    try:
        text = http_get(url, timeout=15)
        data = json.loads(text)
        return {
            "topics": data.get("topics", []),
            "description": data.get("description", ""),
            "homepage": data.get("homepage", ""),
            "created_at": data.get("created_at", ""),
            "updated_at": data.get("updated_at", ""),
            "open_issues": data.get("open_issues_count", 0),
            "watchers": data.get("watchers_count", 0),
            "license": (data.get("license") or {}).get("spdx_id", ""),
        }
    except Exception as e:
        log(f"    获取仓库详情失败 {full_name}: {e}")
        return {}

def fetch_all_trending(since="daily"):
    """采集所有语言的 GitHub Trending 项目"""
    all_repos = []
    seen_ids = set()

    # 先采集全语言 trending（不限语言）
    log("🔥 采集全语言 GitHub Trending...")
    repos = fetch_github_trending("", since)
    for r in repos:
        if r["repo_id"] not in seen_ids:
            seen_ids.add(r["repo_id"])
            all_repos.append(r)
    log(f"  全语言: {len(repos)} 个项目")
    time.sleep(REQUEST_INTERVAL)

    # 再按语言采集
    for lang in LANGUAGES:
        repos = fetch_github_trending(lang, since)
        added = 0
        for r in repos:
            if r["repo_id"] not in seen_ids:
                seen_ids.add(r["repo_id"])
                all_repos.append(r)
                added += 1
        log(f"  {lang}: {len(repos)} 个项目（新增 {added} 个）")
        time.sleep(REQUEST_INTERVAL)

    log(f"📊 共采集 {len(all_repos)} 个不重复项目")
    return all_repos

# ===== 补充仓库详情 =====

def enrich_repos(repos, max_repos=None):
    """批量补充仓库详情（topics、license 等）"""
    if not GITHUB_TOKEN:
        log("⚠️  未配置 GITHUB_TOKEN，跳过仓库详情补充（API 速率限制较低）")
        return repos

    target = repos[:max_repos] if max_repos else repos
    log(f"🔍 补充仓库详情: {len(target)} 个...")

    for i, repo in enumerate(target):
        details = fetch_repo_details(repo["full_name"])
        if details:
            repo.update({
                "topics": details.get("topics", repo.get("topics", [])),
                "description": details.get("description") or repo.get("description", ""),
                "homepage": details.get("homepage", ""),
                "created_at": details.get("created_at", ""),
                "updated_at": details.get("updated_at", ""),
                "open_issues": details.get("open_issues", 0),
                "license": details.get("license", ""),
            })
        if i < len(target) - 1:
            time.sleep(0.5)  # GitHub API 速率限制

    return repos

# ===== AI 摘要生成 =====

REPO_PROMPT = """你是一位资深开发者，请对以下 GitHub 开源项目进行结构化分析，严格按 JSON 格式输出，不要输出任何其他内容。

项目名称：{name}
项目描述：{description}
编程语言：{language}
主题标签：{topics}

请输出如下 JSON（所有字段均用中文，字符串类型）：
{{
  "chinese_name": "项目中文名称（意译，简洁）",
  "chinese_summary": "一句话核心功能介绍（不超过 60 字）",
  "use_case": "主要使用场景（1-2句）",
  "tech_highlights": ["技术亮点1", "技术亮点2", "技术亮点3"],
  "target_users": "目标用户群体（1句）",
  "why_trending": "为什么最近火热（1-2句，可从技术趋势、社区热度等角度分析）",
  "getting_started": "快速上手建议（1句）"
}}"""

def call_llm(prompt):
    """调用 OpenAI 兼容 API"""
    if not OPENAI_API_KEY:
        return None

    base_url = OPENAI_BASE_URL.rstrip("/")
    url = f"{base_url}/chat/completions"
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}

    payload = {
        "model": OPENAI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 800,
        "temperature": 0.2,
    }

    for attempt in range(MAX_RETRY):
        try:
            resp = http_post_json(url, {**payload, "response_format": {"type": "json_object"}}, headers)
            return resp["choices"][0]["message"]["content"].strip()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = (attempt + 1) * 15
                log(f"    ⏳ 触发限速(429)，等待 {wait}s 后重试...")
                time.sleep(wait)
            else:
                break
        except Exception:
            break

    # 降级：不带 response_format
    try:
        resp = http_post_json(url, payload, headers)
        return resp["choices"][0]["message"]["content"].strip()
    except Exception as e:
        log(f"    LLM 调用失败: {e}")
    return None

def parse_json_safe(text):
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        return json.loads(text)
    except Exception:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return None

def generate_summary(repo):
    """为单个项目生成 AI 摘要"""
    prompt = REPO_PROMPT.format(
        name=repo.get("full_name", ""),
        description=(repo.get("description", "") or "")[:500],
        language=repo.get("language", ""),
        topics=", ".join(repo.get("topics", [])[:10]),
    )
    raw = call_llm(prompt)
    parsed = parse_json_safe(raw)
    if not parsed:
        return None
    return {
        "chinese_name": parsed.get("chinese_name", ""),
        "chinese_summary": parsed.get("chinese_summary", ""),
        "use_case": parsed.get("use_case", ""),
        "tech_highlights": parsed.get("tech_highlights", []),
        "target_users": parsed.get("target_users", ""),
        "why_trending": parsed.get("why_trending", ""),
        "getting_started": parsed.get("getting_started", ""),
        "model_used": OPENAI_MODEL,
    }

def generate_batch_summaries(repos):
    """批量生成 AI 摘要"""
    if not OPENAI_API_KEY:
        log("⚠️  未配置 OPENAI_API_KEY，跳过 AI 摘要生成")
        return repos

    pending = [r for r in repos if not r.get("structured_summary")]
    log(f"🤖 开始生成 AI 分析: {len(pending)} 个（共 {len(repos)} 个）")
    success = 0

    for i, repo in enumerate(pending):
        try:
            summary = generate_summary(repo)
            if summary and summary.get("chinese_summary"):
                repo["structured_summary"] = summary
                success += 1
                log(f"  [{i+1}/{len(pending)}] ✓ {repo['full_name']}")
            else:
                log(f"  [{i+1}/{len(pending)}] ✗ AI 分析为空: {repo['full_name']}")
        except Exception as e:
            log(f"  [{i+1}/{len(pending)}] ✗ 异常: {e}")

        if i < len(pending) - 1:
            time.sleep(REQUEST_INTERVAL)

    log(f"  AI 分析完成: {success}/{len(pending)} 个成功")
    return repos

# ===== 保存数据 =====

def save_daily_data(repos, date_str):
    """保存每日数据"""
    DAILY_DIR.mkdir(parents=True, exist_ok=True)
    output_file = DAILY_DIR / f"{date_str}.json"

    # 按热度排序
    repos.sort(key=lambda r: r.get("hot_score", 0), reverse=True)

    # 统计各分类数量
    category_counts = {}
    for r in repos:
        cat = r.get("category", "other")
        category_counts[cat] = category_counts.get(cat, 0) + 1

    data = {
        "date": date_str,
        "since": SINCE,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(repos),
        "category_counts": category_counts,
        "repos": repos,
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    log(f"💾 已保存: {output_file} ({len(repos)} 个项目)")
    return len(repos)

def update_index(date_str, total):
    """更新 data/index.json"""
    index = {"updated_at": "", "dates": [], "total_repos": 0}
    if INDEX_FILE.exists():
        try:
            with open(INDEX_FILE, "r", encoding="utf-8") as f:
                index = json.load(f)
        except Exception:
            pass

    dates = index.get("dates", [])
    found = False
    for d in dates:
        if d["date"] == date_str:
            d["total"] = total
            found = True
            break
    if not found:
        dates.insert(0, {"date": date_str, "total": total})

    dates.sort(key=lambda d: d["date"], reverse=True)
    dates = dates[:90]

    index["updated_at"] = datetime.now(timezone.utc).isoformat()
    index["dates"] = dates
    index["total_repos"] = sum(d["total"] for d in dates)

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    log(f"📋 已更新索引: {len(dates)} 个日期")

# ===== 主流程 =====

def main():
    import sys
    if len(sys.argv) > 1:
        today = sys.argv[1]
        log(f"=== GitHub Hot Daily 采集任务开始（指定日期：{today}）===")
    else:
        beijing_tz = timezone(timedelta(hours=8))
        today = (datetime.now(beijing_tz) - timedelta(days=1)).strftime("%Y-%m-%d")
        log(f"=== GitHub Hot Daily 采集任务开始（前一天：{today}）===")

    # 1. 采集 GitHub Trending
    repos = fetch_all_trending(SINCE)

    if not repos:
        log("⚠️  未采集到任何项目，退出")
        return

    # 2. 补充仓库详情（如有 Token）
    repos = enrich_repos(repos, max_repos=DAILY_TARGET * 2)

    # 3. 按热度排序，取前 N 个
    repos.sort(key=lambda r: r.get("hot_score", 0), reverse=True)
    repos = repos[:DAILY_TARGET]
    log(f"📊 精选 Top {len(repos)} 个热门项目")

    # 4. 生成 AI 摘要
    repos = generate_batch_summaries(repos)

    # 5. 保存数据
    total = save_daily_data(repos, today)
    update_index(today, total)

    log("=== 任务完成 ===")

if __name__ == "__main__":
    main()
