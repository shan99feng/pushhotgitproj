/**
 * 经典项目页面逻辑 - GitHub Hot Daily
 */

(function () {
  const $ = id => document.getElementById(id);

  // ===== 状态 =====
  let allRepos = [];
  let filteredRepos = [];
  let displayCount = 20;
  const PAGE_SIZE = 20;
  let currentCategory = 'all';
  let searchQuery = '';

  // ===== 初始化 =====
  async function init() {
    setupEventListeners();
    await loadClassics();
  }

  // ===== 加载经典项目 =====
  async function loadClassics() {
    showLoading(true);
    try {
      const data = await API.getClassicRepos('all');
      allRepos = data.repos || [];

      // 更新描述
      if (data.description && $('classicsDesc')) {
        $('classicsDesc').textContent = data.description;
      }

      // 更新分类计数
      updateCategoryCounts(allRepos, data.category_counts);

      $('pageSubtitle').textContent = `精选 ${allRepos.length} 个最具影响力的开源项目`;

      applyFilterAndRender();
    } catch (err) {
      console.error('加载经典项目失败:', err);
      showLoading(false);
      showEmpty(true);
      $('pageSubtitle').textContent = '加载失败，请刷新重试';
    }
  }

  // ===== 更新分类计数 =====
  function updateCategoryCounts(repos, catCounts) {
    const counts = catCounts || {};
    if (!catCounts) {
      repos.forEach(r => {
        const cat = normalizeCategory(r.category);
        counts[cat] = (counts[cat] || 0) + 1;
      });
    }

    const total = repos.length;
    if ($('countAll'))      $('countAll').textContent      = total;
    if ($('countAiMl'))     $('countAiMl').textContent     = counts.ai_ml    || 0;
    if ($('countFrontend')) $('countFrontend').textContent = counts.frontend  || 0;
    if ($('countBackend'))  $('countBackend').textContent  = counts.backend   || 0;
    if ($('countSystems'))  $('countSystems').textContent  = counts.systems   || 0;
    if ($('countDevops'))   $('countDevops').textContent   = counts.devops    || 0;
    if ($('countMobile'))   $('countMobile').textContent   = counts.mobile    || 0;
    if ($('countOther'))    $('countOther').textContent    = counts.other     || 0;
  }

  // ===== 筛选 + 搜索 + 渲染 =====
  function applyFilterAndRender() {
    let repos = [...allRepos];

    // 分类筛选
    if (currentCategory !== 'all') {
      repos = repos.filter(r => normalizeCategory(r.category) === currentCategory);
    }

    // 关键词搜索
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      repos = repos.filter(r =>
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.structured_summary?.chinese_name || '').includes(searchQuery) ||
        (r.structured_summary?.chinese_summary || '').includes(searchQuery) ||
        (r.language || '').toLowerCase().includes(q) ||
        (r.topics || []).some(t => t.toLowerCase().includes(q))
      );
    }

    // 按热度排序
    repos.sort((a, b) => (b.hot_score || 0) - (a.hot_score || 0));

    filteredRepos = repos;
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
    $('loadMoreWrap').classList.toggle('hidden', displayCount >= filteredRepos.length);
  }

  // ===== 更新统计 =====
  function updateStats() {
    const catLabel = currentCategory === 'all' ? '全部分类' : getCategoryLabel(currentCategory);
    const searchInfo = searchQuery ? ` · 搜索"${searchQuery}"` : '';
    $('statsBar').textContent = `${catLabel}${searchInfo} · 共 ${filteredRepos.length} 个项目`;
  }

  function showLoading(show) {
    $('loadingState').classList.toggle('hidden', !show);
  }
  function showEmpty(show) {
    $('emptyState').classList.toggle('hidden', !show);
  }

  // ===== 事件监听 =====
  function setupEventListeners() {
    // 左侧分类导航
    $('categoryNav').addEventListener('click', e => {
      e.preventDefault();
      const link = e.target.closest('[data-category]');
      if (!link) return;
      $('categoryNav').querySelectorAll('[data-category]').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
      currentCategory = link.dataset.category;

      // 同步移动端分类
      $('mobileCategoryFilter').querySelectorAll('.cat-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.category === currentCategory);
      });

      applyFilterAndRender();
    });

    // 移动端分类
    $('mobileCategoryFilter').addEventListener('click', e => {
      const tab = e.target.closest('.cat-tab');
      if (!tab) return;
      $('mobileCategoryFilter').querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;

      // 同步左侧导航
      $('categoryNav').querySelectorAll('[data-category]').forEach(a => {
        a.classList.toggle('active', a.dataset.category === currentCategory);
      });

      applyFilterAndRender();
    });

    // 搜索框
    $('searchInput').addEventListener('input', debounce(e => {
      searchQuery = e.target.value.trim();
      $('clearSearchBtn').classList.toggle('hidden', !searchQuery);
      applyFilterAndRender();
    }, 300));

    $('clearSearchBtn').addEventListener('click', () => {
      $('searchInput').value = '';
      searchQuery = '';
      $('clearSearchBtn').classList.add('hidden');
      applyFilterAndRender();
    });

    // Header 搜索
    $('headerSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (q) {
          $('searchInput').value = q;
          searchQuery = q;
          $('clearSearchBtn').classList.remove('hidden');
          applyFilterAndRender();
        }
      }
    });

    // 加载更多
    $('btnLoadMore').addEventListener('click', () => {
      displayCount += PAGE_SIZE;
      renderRepos();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
