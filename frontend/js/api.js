/**
 * 数据访问层 - GitHub Hot Daily
 * 纯静态方案：直接读取 data/ 目录下的 JSON 文件
 */

// 数据根路径：自动适配本地开发和 GitHub Pages 部署
const DATA_BASE = (() => {
  const path = window.location.pathname;
  if (path.includes('/frontend/')) return '../data';
  return 'data';
})();

// 简单内存缓存
const _cache = new Map();

async function fetchJSON(url) {
  if (_cache.has(url)) return _cache.get(url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
  const data = await resp.json();
  _cache.set(url, data);
  return data;
}

const API = {
  /**
   * 获取日期索引
   */
  async getDates() {
    return fetchJSON(`${DATA_BASE}/index.json`);
  },

  /**
   * 获取指定日期的项目列表
   * @param {string} date - YYYY-MM-DD
   */
  async getDailyRepos(date) {
    return fetchJSON(`${DATA_BASE}/daily/${date}.json`);
  },

  /**
   * 获取今日项目（自动取最新日期）
   */
  async getTodayRepos() {
    const index = await this.getDates();
    if (!index.dates || index.dates.length === 0) {
      return { date: '', total: 0, repos: [] };
    }
    const latestDate = index.dates[0].date;
    return this.getDailyRepos(latestDate);
  },

  /**
   * 获取单个项目详情
   * @param {string} repoId
   */
  async getRepoById(repoId) {
    // 1. 先从经典项目库查找
    try {
      const classicsData = await fetchJSON(`${DATA_BASE}/classics.json`);
      const repo = (classicsData.repos || []).find(r => r.repo_id === repoId);
      if (repo) return repo;
    } catch (e) {}

    // 2. 再从每日数据查找（最近 30 天）
    const index = await this.getDates();
    for (const { date } of (index.dates || []).slice(0, 30)) {
      try {
        const dayData = await this.getDailyRepos(date);
        const repo = (dayData.repos || []).find(r => r.repo_id === repoId);
        if (repo) return repo;
      } catch (e) {}
    }
    throw new Error('项目不存在');
  },

  /**
   * 搜索项目
   * @param {string} q - 关键词
   * @param {number} maxDays - 最多搜索最近多少天
   */
  async searchRepos(q, maxDays = 30) {
    const keyword = q.toLowerCase();
    const seenIds = new Set();

    function matches(repo) {
      return (
        (repo.full_name || '').toLowerCase().includes(keyword) ||
        (repo.name || '').toLowerCase().includes(keyword) ||
        (repo.description || '').toLowerCase().includes(keyword) ||
        (repo.topics || []).some(t => t.toLowerCase().includes(keyword)) ||
        (repo.structured_summary?.chinese_name || '').includes(q) ||
        (repo.structured_summary?.chinese_summary || '').includes(q) ||
        (repo.language || '').toLowerCase().includes(keyword)
      );
    }

    const todayResults = [];
    const historyResults = [];
    const classicsResults = [];

    // 1. 今日项目
    try {
      const todayData = await this.getTodayRepos();
      const todayDate = todayData.date;
      for (const repo of (todayData.repos || [])) {
        if (matches(repo) && !seenIds.has(repo.repo_id)) {
          seenIds.add(repo.repo_id);
          todayResults.push(repo);
        }
      }

      // 2. 历史项目
      const index = await this.getDates();
      for (const { date } of (index.dates || []).slice(0, maxDays)) {
        if (date === todayDate) continue;
        try {
          const dayData = await this.getDailyRepos(date);
          for (const repo of (dayData.repos || [])) {
            if (matches(repo) && !seenIds.has(repo.repo_id)) {
              seenIds.add(repo.repo_id);
              historyResults.push(repo);
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    // 3. 经典项目
    try {
      const classicsData = await fetchJSON(`${DATA_BASE}/classics.json`);
      for (const repo of (classicsData.repos || [])) {
        if (matches(repo) && !seenIds.has(repo.repo_id)) {
          seenIds.add(repo.repo_id);
          classicsResults.push(repo);
        }
      }
    } catch (e) {}

    const byHot = (a, b) => (b.hot_score || 0) - (a.hot_score || 0);
    todayResults.sort(byHot);
    historyResults.sort(byHot);
    classicsResults.sort(byHot);

    const repos = [...todayResults, ...historyResults, ...classicsResults];
    return { total: repos.length, repos, todayResults, historyResults, classicsResults };
  },

  /**
   * 获取经典项目
   * @param {string} category - 分类筛选
   */
  async getClassicRepos(category = 'all') {
    try {
      const data = await fetchJSON(`${DATA_BASE}/classics.json`);
      let repos = data.repos || [];
      if (category !== 'all') {
        repos = repos.filter(r => normalizeCategory(r.category) === category);
      }
      repos.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
      return {
        total: repos.length,
        repos,
        category_counts: data.category_counts || {},
        description: data.description || '',
      };
    } catch (e) {
      // 降级：从历史数据中聚合
    }

    const index = await this.getDates();
    const results = [];
    const seen = new Set();
    for (const { date } of (index.dates || [])) {
      try {
        const dayData = await this.getDailyRepos(date);
        for (const repo of (dayData.repos || [])) {
          if (!seen.has(repo.repo_id)) {
            seen.add(repo.repo_id);
            if (category === 'all' || normalizeCategory(repo.category) === category) {
              results.push(repo);
            }
          }
        }
      } catch (e) {}
    }
    results.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));
    return { total: results.length, repos: results.slice(0, 100) };
  },
};
