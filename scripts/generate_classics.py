#!/usr/bin/env python3
"""
GitHub Hot Daily - 经典项目生成脚本
从历史数据中筛选高热度项目，并补充一批手工精选的经典开源项目
运行方式：python scripts/generate_classics.py
输出：data/classics.json
"""

import os
import json
import time
import re
import ssl
import urllib.request
import urllib.error
import http.client
from datetime import datetime, timezone
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

try:
    import certifi
    _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CONTEXT = ssl._create_unverified_context()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.siliconflow.cn/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "Qwen/Qwen2.5-7B-Instruct")
REQUEST_INTERVAL = float(os.getenv("REQUEST_INTERVAL", "1"))
MAX_RETRY = int(os.getenv("MAX_RETRY", "3"))

DATA_DIR = Path(__file__).parent.parent / "data"
DAILY_DIR = DATA_DIR / "daily"
CLASSICS_FILE = DATA_DIR / "classics.json"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)

# ===== 手工精选的经典开源项目列表 =====
# 这些是各领域最具代表性的开源项目，按分类整理
CURATED_CLASSICS = [
    # ===== AI/ML =====
    {
        "repo_id": "github-pytorch-pytorch",
        "source": "github",
        "full_name": "pytorch/pytorch",
        "owner": "pytorch",
        "name": "pytorch",
        "description": "Tensors and Dynamic neural networks in Python with strong GPU acceleration",
        "language": "Python",
        "category": "ai_ml",
        "stars": 85000,
        "forks": 23000,
        "today_stars": 0,
        "hot_score": 9999,
        "url": "https://github.com/pytorch/pytorch",
        "topics": ["deep-learning", "machine-learning", "neural-network", "python", "gpu"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "PyTorch",
            "chinese_summary": "Facebook 开源的深度学习框架，以动态计算图和 Python 友好著称，是学术研究和工业应用的首选框架之一",
            "use_case": "深度学习模型训练与推理，支持 NLP、CV、强化学习等各类 AI 任务",
            "tech_highlights": ["动态计算图（Eager Mode）", "TorchScript 静态图优化", "分布式训练支持"],
            "target_users": "AI 研究人员、深度学习工程师",
            "why_trending": "AI 浪潮推动深度学习框架需求持续增长，PyTorch 凭借易用性成为学术界标准",
            "getting_started": "pip install torch，参考官方教程从张量操作开始学习",
            "model_used": "manual"
        }
    },
    {
        "repo_id": "github-huggingface-transformers",
        "source": "github",
        "full_name": "huggingface/transformers",
        "owner": "huggingface",
        "name": "transformers",
        "description": "Transformers: State-of-the-art Machine Learning for Pytorch, TensorFlow, and JAX",
        "language": "Python",
        "category": "ai_ml",
        "stars": 135000,
        "forks": 27000,
        "today_stars": 0,
        "hot_score": 9998,
        "url": "https://github.com/huggingface/transformers",
        "topics": ["nlp", "transformers", "bert", "gpt", "machine-learning"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "HuggingFace Transformers",
            "chinese_summary": "最流行的预训练模型库，提供数千个 BERT、GPT、T5 等模型，一行代码即可使用最先进的 NLP 模型",
            "use_case": "文本分类、问答、翻译、摘要生成、代码生成等各类 NLP 任务",
            "tech_highlights": ["统一的 AutoModel API", "支持 PyTorch/TensorFlow/JAX", "Model Hub 模型共享"],
            "target_users": "NLP 工程师、AI 研究人员、应用开发者",
            "why_trending": "大语言模型热潮使 Transformers 库成为 AI 开发的基础设施",
            "getting_started": "pip install transformers，使用 pipeline() 一行代码完成 NLP 任务",
            "model_used": "manual"
        }
    },
    {
        "repo_id": "github-langchain-ai-langchain",
        "source": "github",
        "full_name": "langchain-ai/langchain",
        "owner": "langchain-ai",
        "name": "langchain",
        "description": "Build context-aware reasoning applications",
        "language": "Python",
        "category": "ai_ml",
        "stars": 95000,
        "forks": 15000,
        "today_stars": 0,
        "hot_score": 9997,
        "url": "https://github.com/langchain-ai/langchain",
        "topics": ["llm", "langchain", "openai", "agent", "rag"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "LangChain",
            "chinese_summary": "构建 LLM 应用的框架，提供链式调用、RAG、Agent 等能力，是 LLM 应用开发的事实标准",
            "use_case": "构建 RAG 问答系统、AI Agent、文档分析、对话机器人等 LLM 应用",
            "tech_highlights": ["Chain 链式调用", "RAG 检索增强生成", "Agent 自主决策"],
            "target_users": "LLM 应用开发者、AI 产品工程师",
            "why_trending": "ChatGPT 引爆 LLM 应用开发热潮，LangChain 成为构建 AI 应用的首选框架",
            "getting_started": "pip install langchain，参考官方文档构建第一个 RAG 应用",
            "model_used": "manual"
        }
    },
    # ===== 前端 =====
    {
        "repo_id": "github-facebook-react",
        "source": "github",
        "full_name": "facebook/react",
        "owner": "facebook",
        "name": "react",
        "description": "The library for web and native user interfaces",
        "language": "JavaScript",
        "category": "frontend",
        "stars": 228000,
        "forks": 46000,
        "today_stars": 0,
        "hot_score": 9996,
        "url": "https://github.com/facebook/react",
        "topics": ["javascript", "react", "frontend", "ui", "library"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "React",
            "chinese_summary": "Facebook 开源的 UI 组件库，基于虚拟 DOM 和声明式编程，是全球最流行的前端框架之一",
            "use_case": "构建交互式 Web 应用、单页应用（SPA）、移动端应用（React Native）",
            "tech_highlights": ["虚拟 DOM 高效渲染", "组件化开发", "Hooks 函数式编程"],
            "target_users": "前端开发者、全栈工程师",
            "why_trending": "持续迭代的 React 18/19 带来并发特性，生态系统庞大且活跃",
            "getting_started": "npx create-react-app my-app 快速创建项目",
            "model_used": "manual"
        }
    },
    {
        "repo_id": "github-vuejs-core",
        "source": "github",
        "full_name": "vuejs/core",
        "owner": "vuejs",
        "name": "core",
        "description": "Vue.js is a progressive, incrementally-adoptable JavaScript framework for building UI on the web",
        "language": "TypeScript",
        "category": "frontend",
        "stars": 47000,
        "forks": 8000,
        "today_stars": 0,
        "hot_score": 9995,
        "url": "https://github.com/vuejs/core",
        "topics": ["vue", "javascript", "typescript", "frontend", "framework"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Vue.js",
            "chinese_summary": "渐进式 JavaScript 框架，以简洁的 API 和优秀的文档著称，在国内开发者中极为流行",
            "use_case": "构建中小型 Web 应用、企业管理系统、移动端 H5 页面",
            "tech_highlights": ["Composition API", "响应式系统", "单文件组件（SFC）"],
            "target_users": "前端开发者，尤其是国内开发者",
            "why_trending": "Vue 3 生态成熟，Vite 构建工具加持，开发体验极佳",
            "getting_started": "npm create vue@latest 创建 Vue 3 项目",
            "model_used": "manual"
        }
    },
    {
        "repo_id": "github-vitejs-vite",
        "source": "github",
        "full_name": "vitejs/vite",
        "owner": "vitejs",
        "name": "vite",
        "description": "Next generation frontend tooling. It's fast!",
        "language": "TypeScript",
        "category": "frontend",
        "stars": 68000,
        "forks": 6000,
        "today_stars": 0,
        "hot_score": 9994,
        "url": "https://github.com/vitejs/vite",
        "topics": ["vite", "build-tool", "frontend", "typescript", "esm"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Vite",
            "chinese_summary": "下一代前端构建工具，利用原生 ESM 实现极速冷启动，已成为现代前端项目的标准构建工具",
            "use_case": "前端项目构建、开发服务器、库打包",
            "tech_highlights": ["原生 ESM 按需加载", "Rollup 生产构建", "插件生态丰富"],
            "target_users": "前端开发者",
            "why_trending": "相比 Webpack 启动速度提升 10-100 倍，已成为 Vue/React 项目首选构建工具",
            "getting_started": "npm create vite@latest 快速创建项目",
            "model_used": "manual"
        }
    },
    # ===== 后端 =====
    {
        "repo_id": "github-gin-gonic-gin",
        "source": "github",
        "full_name": "gin-gonic/gin",
        "owner": "gin-gonic",
        "name": "gin",
        "description": "Gin is a HTTP web framework written in Go (Golang)",
        "language": "Go",
        "category": "backend",
        "stars": 78000,
        "forks": 8000,
        "today_stars": 0,
        "hot_score": 9993,
        "url": "https://github.com/gin-gonic/gin",
        "topics": ["go", "golang", "web", "framework", "http"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Gin",
            "chinese_summary": "Go 语言最流行的 Web 框架，性能极高（比 httprouter 快 40 倍），API 简洁优雅",
            "use_case": "构建高性能 RESTful API、微服务、Web 应用",
            "tech_highlights": ["基于 httprouter 的高性能路由", "中间件支持", "JSON 绑定与验证"],
            "target_users": "Go 后端开发者",
            "why_trending": "Go 语言在云原生领域持续增长，Gin 是 Go Web 开发的首选框架",
            "getting_started": "go get github.com/gin-gonic/gin，参考官方示例构建第一个 API",
            "model_used": "manual"
        }
    },
    {
        "repo_id": "github-tiangolo-fastapi",
        "source": "github",
        "full_name": "tiangolo/fastapi",
        "owner": "tiangolo",
        "name": "fastapi",
        "description": "FastAPI framework, high performance, easy to learn, fast to code, ready for production",
        "language": "Python",
        "category": "backend",
        "stars": 78000,
        "forks": 6600,
        "today_stars": 0,
        "hot_score": 9992,
        "url": "https://github.com/tiangolo/fastapi",
        "topics": ["python", "fastapi", "api", "rest", "openapi"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "FastAPI",
            "chinese_summary": "基于 Python 类型提示的现代 Web 框架，自动生成 OpenAPI 文档，性能媲美 Node.js",
            "use_case": "构建 Python RESTful API、AI 模型服务、微服务",
            "tech_highlights": ["基于 Pydantic 的类型验证", "自动 OpenAPI/Swagger 文档", "异步支持"],
            "target_users": "Python 后端开发者、AI 工程师",
            "why_trending": "AI 应用爆发带动 Python API 框架需求，FastAPI 以其简洁和高性能脱颖而出",
            "getting_started": "pip install fastapi uvicorn，5 行代码即可运行第一个 API",
            "model_used": "manual"
        }
    },
    # ===== 系统/底层 =====
    {
        "repo_id": "github-rust-lang-rust",
        "source": "github",
        "full_name": "rust-lang/rust",
        "owner": "rust-lang",
        "name": "rust",
        "description": "Empowering everyone to build reliable and efficient software",
        "language": "Rust",
        "category": "systems",
        "stars": 98000,
        "forks": 12700,
        "today_stars": 0,
        "hot_score": 9991,
        "url": "https://github.com/rust-lang/rust",
        "topics": ["rust", "systems-programming", "memory-safety", "performance"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Rust 编程语言",
            "chinese_summary": "注重内存安全和高性能的系统编程语言，无 GC 的情况下保证内存安全，连续多年被评为最受喜爱的编程语言",
            "use_case": "系统编程、WebAssembly、嵌入式开发、高性能服务",
            "tech_highlights": ["所有权系统保证内存安全", "零成本抽象", "无 GC 的高性能"],
            "target_users": "系统程序员、对性能和安全有高要求的开发者",
            "why_trending": "Linux 内核、Android、Windows 等系统级项目引入 Rust，推动其快速普及",
            "getting_started": "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh 安装 Rust",
            "model_used": "manual"
        }
    },
    # ===== DevOps =====
    {
        "repo_id": "github-kubernetes-kubernetes",
        "source": "github",
        "full_name": "kubernetes/kubernetes",
        "owner": "kubernetes",
        "name": "kubernetes",
        "description": "Production-Grade Container Scheduling and Management",
        "language": "Go",
        "category": "devops",
        "stars": 111000,
        "forks": 39000,
        "today_stars": 0,
        "hot_score": 9990,
        "url": "https://github.com/kubernetes/kubernetes",
        "topics": ["kubernetes", "containers", "docker", "cloud-native", "devops"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Kubernetes",
            "chinese_summary": "Google 开源的容器编排系统，是云原生时代的操作系统，管理大规模容器化应用的事实标准",
            "use_case": "容器化应用部署、自动扩缩容、服务发现、滚动更新",
            "tech_highlights": ["声明式配置", "自动故障恢复", "水平自动扩缩容（HPA）"],
            "target_users": "DevOps 工程师、云原生开发者、SRE",
            "why_trending": "云原生架构成为企业标配，Kubernetes 是云原生基础设施的核心",
            "getting_started": "使用 minikube 在本地搭建 K8s 集群，学习 kubectl 基本命令",
            "model_used": "manual"
        }
    },
    {
        "repo_id": "github-docker-compose",
        "source": "github",
        "full_name": "docker/compose",
        "owner": "docker",
        "name": "compose",
        "description": "Define and run multi-container applications with Docker",
        "language": "Go",
        "category": "devops",
        "stars": 33000,
        "forks": 5100,
        "today_stars": 0,
        "hot_score": 9989,
        "url": "https://github.com/docker/compose",
        "topics": ["docker", "compose", "containers", "devops"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Docker Compose",
            "chinese_summary": "用 YAML 文件定义和运行多容器 Docker 应用，是本地开发和小规模部署的利器",
            "use_case": "本地开发环境搭建、多服务应用编排、CI/CD 流水线",
            "tech_highlights": ["YAML 声明式配置", "一键启动多服务", "网络和卷管理"],
            "target_users": "开发者、DevOps 工程师",
            "why_trending": "容器化开发已成标配，Docker Compose 是最简单的多容器编排工具",
            "getting_started": "编写 docker-compose.yml，执行 docker compose up -d 启动所有服务",
            "model_used": "manual"
        }
    },
    # ===== 移动端 =====
    {
        "repo_id": "github-flutter-flutter",
        "source": "github",
        "full_name": "flutter/flutter",
        "owner": "flutter",
        "name": "flutter",
        "description": "Flutter makes it easy and fast to build beautiful apps for mobile and beyond",
        "language": "Dart",
        "category": "mobile",
        "stars": 166000,
        "forks": 27000,
        "today_stars": 0,
        "hot_score": 9988,
        "url": "https://github.com/flutter/flutter",
        "topics": ["flutter", "dart", "mobile", "cross-platform", "ui"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Flutter",
            "chinese_summary": "Google 开源的跨平台 UI 框架，一套代码运行在 iOS、Android、Web、桌面端，性能接近原生",
            "use_case": "跨平台移动应用开发、桌面应用、Web 应用",
            "tech_highlights": ["Skia/Impeller 自绘引擎", "热重载开发体验", "丰富的 Widget 库"],
            "target_users": "移动端开发者、跨平台应用开发者",
            "why_trending": "跨平台开发需求旺盛，Flutter 凭借优秀的性能和开发体验持续增长",
            "getting_started": "安装 Flutter SDK，运行 flutter create my_app 创建第一个应用",
            "model_used": "manual"
        }
    },
    # ===== 工具 =====
    {
        "repo_id": "github-microsoft-vscode",
        "source": "github",
        "full_name": "microsoft/vscode",
        "owner": "microsoft",
        "name": "vscode",
        "description": "Visual Studio Code",
        "language": "TypeScript",
        "category": "other",
        "stars": 163000,
        "forks": 29000,
        "today_stars": 0,
        "hot_score": 9987,
        "url": "https://github.com/microsoft/vscode",
        "topics": ["vscode", "editor", "typescript", "electron", "ide"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "VS Code",
            "chinese_summary": "微软开源的代码编辑器，凭借丰富的插件生态和优秀的开发体验，成为全球最流行的代码编辑器",
            "use_case": "代码编辑、调试、版本控制、远程开发",
            "tech_highlights": ["Language Server Protocol（LSP）", "丰富的插件市场", "内置 Git 集成"],
            "target_users": "所有开发者",
            "why_trending": "持续迭代的 AI 辅助编程功能（GitHub Copilot）使其保持强劲增长",
            "getting_started": "下载安装 VS Code，安装对应语言插件即可开始使用",
            "model_used": "manual"
        }
    },
    {
        "repo_id": "github-neovim-neovim",
        "source": "github",
        "full_name": "neovim/neovim",
        "owner": "neovim",
        "name": "neovim",
        "description": "Vim-fork focused on extensibility and usability",
        "language": "C",
        "category": "other",
        "stars": 82000,
        "forks": 5600,
        "today_stars": 0,
        "hot_score": 9986,
        "url": "https://github.com/neovim/neovim",
        "topics": ["neovim", "vim", "editor", "lua", "terminal"],
        "is_classic": True,
        "structured_summary": {
            "chinese_name": "Neovim",
            "chinese_summary": "Vim 的现代化分支，内置 LSP 支持和 Lua 配置，是终端党和键盘流开发者的最爱",
            "use_case": "终端代码编辑、服务器远程开发、高效键盘操作",
            "tech_highlights": ["内置 LSP 客户端", "Lua 配置语言", "异步插件架构"],
            "target_users": "Vim 用户、终端开发者、追求极致效率的程序员",
            "why_trending": "Lua 生态成熟，大量高质量插件涌现，吸引大批开发者从 Vim 迁移",
            "getting_started": "安装 Neovim，使用 LazyVim 等发行版快速配置开发环境",
            "model_used": "manual"
        }
    },
]

def http_get(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {})
    req.add_header("User-Agent", "GitHub-Hot-Daily/1.0")
    if GITHUB_TOKEN:
        req.add_header("Authorization", f"token {GITHUB_TOKEN}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CONTEXT) as resp:
        return resp.read().decode("utf-8")

def http_post_json(url, data, headers=None):
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
        req_headers = {"Content-Type": "application/json", "Content-Length": str(len(body))}
        for k, v in (headers or {}).items():
            req_headers[k] = v
        conn.request("POST", path, body=body, headers=req_headers)
        resp = conn.getresponse()
        resp_body = resp.read().decode("utf-8")
        if resp.status >= 400:
            raise urllib.error.HTTPError(url, resp.status, resp.reason, {}, None)
        return json.loads(resp_body)
    finally:
        conn.close()

def call_llm(prompt):
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
                log(f"    ⏳ 限速，等待 {wait}s...")
                time.sleep(wait)
            else:
                break
        except Exception:
            break
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

def generate_summary(repo):
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

def load_history_repos():
    """从历史数据中加载高热度项目"""
    if not DAILY_DIR.exists():
        return []

    all_repos = []
    seen_ids = set()

    for json_file in sorted(DAILY_DIR.glob("*.json"), reverse=True)[:30]:
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            for repo in data.get("repos", []):
                if repo["repo_id"] not in seen_ids:
                    seen_ids.add(repo["repo_id"])
                    all_repos.append(repo)
        except Exception as e:
            log(f"  读取 {json_file} 失败: {e}")

    # 按热度排序，取前 50 个
    all_repos.sort(key=lambda r: r.get("hot_score", 0), reverse=True)
    return all_repos[:50]

def main():
    log("=== 经典项目生成任务开始 ===")

    # 1. 加载手工精选的经典项目
    classics = list(CURATED_CLASSICS)
    log(f"📚 手工精选经典项目: {len(classics)} 个")

    # 2. 从历史数据中补充高热度项目
    history_repos = load_history_repos()
    curated_ids = {r["repo_id"] for r in classics}
    added = 0
    for repo in history_repos:
        if repo["repo_id"] not in curated_ids and repo.get("hot_score", 0) > 100:
            repo["is_classic"] = True
            classics.append(repo)
            curated_ids.add(repo["repo_id"])
            added += 1
    log(f"📈 从历史数据补充: {added} 个高热度项目")

    # 3. 为没有 AI 摘要的项目生成摘要
    if OPENAI_API_KEY:
        pending = [r for r in classics if not r.get("structured_summary")]
        log(f"🤖 生成 AI 摘要: {len(pending)} 个...")
        success = 0
        for i, repo in enumerate(pending):
            try:
                summary = generate_summary(repo)
                if summary and summary.get("chinese_summary"):
                    repo["structured_summary"] = summary
                    success += 1
                    log(f"  [{i+1}/{len(pending)}] ✓ {repo['full_name']}")
                else:
                    log(f"  [{i+1}/{len(pending)}] ✗ {repo['full_name']}")
            except Exception as e:
                log(f"  [{i+1}/{len(pending)}] ✗ 异常: {e}")
            if i < len(pending) - 1:
                time.sleep(REQUEST_INTERVAL)
        log(f"  AI 摘要完成: {success}/{len(pending)} 个")
    else:
        log("⚠️  未配置 OPENAI_API_KEY，跳过 AI 摘要生成")

    # 4. 统计各分类数量
    category_counts = {}
    for r in classics:
        cat = r.get("category", "other")
        category_counts[cat] = category_counts.get(cat, 0) + 1

    # 5. 保存
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(classics),
        "category_counts": category_counts,
        "description": "GitHub 各领域经典开源项目精选，包含手工精选和历史热门项目",
        "repos": classics,
    }

    with open(CLASSICS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    log(f"💾 已保存经典项目: {CLASSICS_FILE} ({len(classics)} 个)")
    log("=== 任务完成 ===")

if __name__ == "__main__":
    main()
