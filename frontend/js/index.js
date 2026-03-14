/**
 * 首页逻辑 - GitHub Hot Daily
 */

(function () {
  const $ = id => document.getElementById(id);

  // ===== 状态 =====
  let allRepos = [];
  let filteredRepos = [];
  let displayCount = 20;
  const PAGE_SIZE = 20;

  let currentCategory = 'all';
  let currentSort = 'hot_score';

  // ===== 初始化 =====
  async function init() {
    setupEventListeners();
    await Promise.all([loadTodayRepos(), loadDateNav()]);
  }

  // ===== 加载今日项目 =====
  async function loadTodayRepos() {
    showLoading(true);
    try {
      const data = await API.getTodayRepos();
      allRepos = data.repos || [];

      const dateParts = data.date && data.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const dateStr = dateParts
        ? `${parseInt(dateParts[2])}月${parseInt(dateParts[3])}日`
        : data.date;
      $('pageSubtitle').textContent = `${dateStr} · 共 ${data.total} 个项目`;
      $('updateTime').textContent = `更新于 ${dateStr}`;

      updateSidebarStats(allRepos);
      applyFilterAndRender();
    } catch (err) {
      console.error('加载今日项目失败:', err);
      showLoading(false);
      showEmpty(true);
      $('pageSubtitle').textContent = '暂无数据，请稍后再试';
    }
  }

  // ===== 加载日期导航 =====
  async function loadDateNav() {
    try {
      const index = await API.getDates();
      const dates = index.dates || [];
      const dateNav = $('dateNav');
      if (!dateNav) return;

      if (dates.length === 0) {
        dateNav.innerHTML = '<div class="text-center py-4 text-[#8c959f] text-xs font-mono">暂无历史数据</div>';
        return;
      }

      dateNav.innerHTML = '';
      dates.slice(0, 30).forEach(item => {
        const a = document.createElement('a');
        a.href = `history.html?date=${item.date}`;
        a.className = 'date-nav-item';
        a.innerHTML = `<span>${item.date}</span><span class="date-count">${item.total}</span>`;
        dateNav.appendChild(a);
      });
    } catch (err) {
      const dateNav = $('dateNav');
      if (dateNav) dateNav.innerHTML = '<div class="text-center py-4 text-[#8c959f] text-xs">加载失败</div>';
    }
  }

  // ===== 更新侧边栏统计 =====
  function updateSidebarStats(repos) {
    const counts = { ai_ml: 0, frontend: 0, backend: 0, systems: 0, devops: 0, mobile: 0, other: 0 };
    repos.forEach(r => {
      const cat = normalizeCategory(r.category);
      if (counts[cat] !== undefined) counts[cat]++;
      else counts['other']++;
    });
    if ($('statTotal'))    $('statTotal').textContent    = repos.length;
    if ($('statAiMl'))     $('statAiMl').textContent     = counts.ai_ml;
    if ($('statFrontend')) $('statFrontend').textContent = counts.frontend;
    if ($('statBackend'))  $('statBackend').textContent  = counts.backend;
    if ($('statSystems'))  $('statSystems').textContent  = counts.systems;
    if ($('statDevops'))   $('statDevops').textContent   = counts.devops;
    if ($('statMobile'))   $('statMobile').textContent   = counts.mobile;
    if ($('statOther'))    $('statOther').textContent    = counts.other;
  }

  // ===== 筛选 + 排序 + 渲染 =====
  function applyFilterAndRender() {
    filteredRepos = currentCategory === 'all'
      ? [...allRepos]
      : allRepos.filter(r => normalizeCategory(r.category) === currentCategory);

    const sortFns = {
      hot_score:   (a, b) => (b.hot_score || 0) - (a.hot_score || 0),
      today_stars: (a, b) => (b.today_stars || 0) - (a.today_stars || 0),
      stars:       (a, b) => (b.stars || 0) - (a.stars || 0),
    };
    filteredRepos.sort(sortFns[currentSort] || sortFns.hot_score);

    displayCount = PAGE_SIZE;
    renderRepos();
    updateStats();
  }

  // ===== 渲染项目列表 =====
  function renderRepos() {
    showLoading(false);
    const repoList = $('repoList');
    repoList.innerHTML = '';

    const toShow = filteredRepos.slice(0, displayCount);

    if (toShow.length === 0) {
      showEmpty(true);
      $('loadMoreWrap').classList.add('hidden');
      return;
    }

    showEmpty(false);
    toShow.forEach(repo => renderRepoCard(repo, repoList));

    const hasMore = displayCount < filteredRepos.length;
    $('loadMoreWrap').classList.toggle('hidden', !hasMore);
  }

  // ===== 更新统计信息 =====
  function updateStats() {
    const catLabel = currentCategory === 'all' ? '全部分类' : getCategoryLabel(currentCategory);
    $('statsText').textContent = `${catLabel} · 共 ${filteredRepos.length} 个项目`;
  }

  // ===== 显示/隐藏状态 =====
  function showLoading(show) {
    $('loadingState').classList.toggle('hidden', !show);
  }
  function showEmpty(show) {
    $('emptyState').classList.toggle('hidden', !show);
  }

  // ===== 事件监听 =====
  function setupEventListeners() {
    // 分类筛选
    $('categoryFilter').addEventListener('click', e => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      $('categoryFilter').querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      applyFilterAndRender();
    });

    // 排序
    $('sortSelect').addEventListener('change', e => {
      currentSort = e.target.value;
      applyFilterAndRender();
    });

    // 侧边栏统计点击
    $('sidebarStats').addEventListener('click', e => {
      const row = e.target.closest('[data-stat-cat]');
      if (!row) return;
      const cat = row.dataset.statCat;
      $('categoryFilter').querySelectorAll('.cat-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.category === cat);
      });
      currentCategory = cat;
      applyFilterAndRender();
      $('repoList').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // 刷新
    $('btnRefresh').addEventListener('click', () => {
      const icon = $('refreshIcon');
      icon.classList.add('fa-spin');
      setTimeout(() => icon.classList.remove('fa-spin'), 1000);
      _cache.clear();
      allRepos = [];
      loadTodayRepos();
    });

    // 加载更多
    $('btnLoadMore').addEventListener('click', () => {
      displayCount += PAGE_SIZE;
      renderRepos();
    });

    // Header 搜索框
    $('headerSearch').addEventListener('focus', openSearch);
    $('headerSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (q) window.location.href = `history.html?q=${encodeURIComponent(q)}`;
      }
    });

    // 移动端搜索
    const mobileSearch = $('mobileSearch');
    if (mobileSearch) {
      mobileSearch.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const q = e.target.value.trim();
          if (q) window.location.href = `history.html?q=${encodeURIComponent(q)}`;
        }
      });
    }

    // 搜索浮层
    $('searchClose').addEventListener('click', closeSearch);
    $('searchOverlay').addEventListener('click', e => {
      if (e.target === $('searchOverlay')) closeSearch();
    });
    $('searchInput').addEventListener('input', debounce(handleSearch, 400));
    $('searchInput').addEventListener('keydown', e => {
      if (e.key === 'Escape') closeSearch();
    });
  }

  // ===== 搜索浮层 =====
  function openSearch() {
    $('searchOverlay').classList.remove('hidden');
    $('searchInput').focus();
  }

  function closeSearch() {
    $('searchOverlay').classList.add('hidden');
    $('searchInput').value = '';
    $('searchResults').innerHTML = '<div class="text-center text-[#8c959f] text-sm py-8 font-mono">输入关键词开始搜索</div>';
  }

  async function handleSearch(e) {
    const q = e.target.value.trim();
    const resultsEl = $('searchResults');
    if (q.length < 2) {
      resultsEl.innerHTML = '<div class="text-center text-[#8c959f] text-sm py-8 font-mono">输入关键词开始搜索</div>';
      return;
    }

    resultsEl.innerHTML = '<div class="text-center text-[#8c959f] text-sm py-4"><div class="loading-spinner mx-auto mb-2"></div>搜索中...</div>';

    try {
      const data = await API.searchRepos(q, 30);
      const { todayResults = [], historyResults = [], classicsResults = [] } = data;

      if (data.total === 0) {
        resultsEl.innerHTML = `<div class="text-center text-[#8c959f] text-sm py-8 font-mono">未找到"${q}"相关项目</div>`;
        return;
      }

      resultsEl.innerHTML = '';

      function renderGroup(repos, groupLabel, groupIcon, maxShow) {
        if (repos.length === 0) return;
        const header = document.createElement('div');
        header.className = 'flex items-center gap-1.5 px-1 pt-1 pb-0.5';
        header.innerHTML = `<i class="fa ${groupIcon} text-xs text-[#8c959f]"></i><span class="text-xs font-semibold text-[#57606a] uppercase tracking-wide font-mono">${groupLabel}</span><span class="text-xs text-[#d0d7de] ml-1 font-mono">${repos.length}</span>`;
        resultsEl.appendChild(header);

        repos.slice(0, maxShow).forEach(repo => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          const cat = normalizeCategory(repo.category);
          item.innerHTML = `
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1">
                  <span class="badge cat-badge ${cat}">${getCategoryLabel(cat)}</span>
                  ${repo.language ? `<span class="text-xs text-[#57606a] font-mono">${repo.language}</span>` : ''}
                </div>
                <div class="text-sm font-medium text-[#0969da] font-mono line-clamp-1">${repo.full_name || repo.name}</div>
                ${repo.structured_summary?.chinese_name ? `<div class="text-xs text-[#24292f] mt-0.5">${repo.structured_summary.chinese_name}</div>` : ''}
                ${repo.structured_summary?.chinese_summary || repo.description ? `<div class="text-xs text-[#57606a] mt-1 line-clamp-2">${repo.structured_summary?.chinese_summary || repo.description}</div>` : ''}
              </div>
              <div class="flex items-center gap-1 text-xs text-[#9a6700] font-mono flex-shrink-0">
                <i class="fa fa-star text-xs"></i>${formatNumber(repo.stars || 0)}
              </div>
            </div>`;
          item.addEventListener('click', () => {
            window.location.href = repo.url || '#';
          });
          resultsEl.appendChild(item);
        });
      }

      renderGroup(todayResults,    '今日热榜', 'fa-fire',    5);
      renderGroup(historyResults,  '历史记录', 'fa-history', 5);
      renderGroup(classicsResults, '经典项目', 'fa-star',    5);

      if (data.total > 0) {
        const more = document.createElement('div');
        more.className = 'text-center pt-3 pb-1 border-t border-[#d0d7de] mt-2';
        more.innerHTML = `<a href="history.html?q=${encodeURIComponent(q)}" class="text-sm text-[#0969da] hover:underline font-mono">查看全部 ${data.total} 条结果 →</a>`;
        resultsEl.appendChild(more);
      }
    } catch (err) {
      resultsEl.innerHTML = '<div class="text-center text-red-400 text-sm py-4 font-mono">搜索失败，请重试</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
