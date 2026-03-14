/**
 * 历史记录页面逻辑 - GitHub Hot Daily
 */

(function () {
  const $ = id => document.getElementById(id);

  // ===== 状态 =====
  let allDates = [];
  let dateDatesSet = new Set();
  let currentDate = null;
  let currentCategory = 'all';
  let currentSort = 'hot_score';
  let allRepos = [];
  let filteredRepos = [];
  let displayCount = 20;
  const PAGE_SIZE = 20;
  let isSearchMode = false;
  let searchKeyword = '';

  // 日历状态
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();

  // ===== 初始化 =====
  async function init() {
    setupEventListeners();
    await loadIndex();

    // 解析 URL 参数
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get('date');
    const qParam = params.get('q');

    if (qParam) {
      searchKeyword = qParam;
      isSearchMode = true;
      $('headerSearch').value = qParam;
      await doSearch(qParam);
    } else if (dateParam) {
      await loadDate(dateParam);
    } else {
      // 默认加载最新日期
      if (allDates.length > 0) {
        await loadDate(allDates[0].date);
      }
    }
  }

  // ===== 加载日期索引 =====
  async function loadIndex() {
    try {
      const index = await API.getDates();
      allDates = index.dates || [];
      dateDatesSet = new Set(allDates.map(d => d.date));
      renderDateList();
      renderCalendar();
      renderTotalStats(allDates);
    } catch (err) {
      console.error('加载日期索引失败:', err);
    }
  }

  // ===== 渲染日期列表 =====
  function renderDateList() {
    const dateList = $('dateList');
    if (!dateList) return;
    if (allDates.length === 0) {
    dateList.innerHTML = '<div class="text-center py-4 text-[#8c959f] text-xs font-mono">暂无历史数据</div>';
      return;
    }
    dateList.innerHTML = '';
    allDates.slice(0, 60).forEach(item => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = `date-nav-item ${item.date === currentDate ? 'active' : ''}`;
      a.dataset.date = item.date;
      a.innerHTML = `<span>${item.date}</span><span class="date-count">${item.total}</span>`;
      a.addEventListener('click', e => {
        e.preventDefault();
        loadDate(item.date);
      });
      dateList.appendChild(a);
    });
  }

  // ===== 渲染日历 =====
  function renderCalendar() {
    const label = $('calMonthLabel');
    if (label) label.textContent = `${calYear}/${String(calMonth + 1).padStart(2, '0')}`;

    const grid = $('calGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const today = new Date();

    // 空白格
    for (let i = 0; i < firstDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day cal-empty';
      grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasData = dateDatesSet.has(dateStr);
      const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;
      const isSelected = dateStr === currentDate;

      const cell = document.createElement('div');
      cell.className = `cal-day ${hasData ? 'cal-has-data' : 'cal-no-data'} ${isToday ? 'cal-today' : ''} ${isSelected ? 'cal-selected' : ''}`;
      cell.textContent = d;
      cell.title = hasData ? `${dateStr} 有数据` : dateStr;

      if (hasData) {
        cell.addEventListener('click', () => loadDate(dateStr));
      }
      grid.appendChild(cell);
    }
  }

  // ===== 渲染全部汇总统计 =====
  function renderTotalStats(dates) {
    const el = $('totalStatsList');
    if (!el) return;
    const total = dates.reduce((s, d) => s + (d.total || 0), 0);
    el.innerHTML = `
      <div class="flex justify-between items-center text-xs px-1 py-0.5">
        <span class="text-[#57606a]">累计天数</span>
        <span class="font-mono font-semibold text-[#24292f]">${dates.length}</span>
      </div>
      <div class="flex justify-between items-center text-xs px-1 py-0.5">
        <span class="text-[#57606a]">累计项目</span>
        <span class="font-mono font-semibold text-[#0969da]">${total}</span>
      </div>
      <div class="flex justify-between items-center text-xs px-1 py-0.5">
        <span class="text-[#57606a]">最早记录</span>
        <span class="font-mono text-[#57606a]">${dates.length > 0 ? dates[dates.length - 1].date : '-'}</span>
      </div>
      <div class="flex justify-between items-center text-xs px-1 py-0.5">
        <span class="text-[#57606a]">最新记录</span>
        <span class="font-mono text-[#57606a]">${dates.length > 0 ? dates[0].date : '-'}</span>
      </div>`;
  }

  // ===== 加载指定日期数据 =====
  async function loadDate(date) {
    isSearchMode = false;
    currentDate = date;
    currentCategory = 'all';
    displayCount = PAGE_SIZE;

    // 更新 URL
    const url = new URL(window.location.href);
    url.searchParams.set('date', date);
    url.searchParams.delete('q');
    window.history.pushState({}, '', url);

    // 更新 UI 状态
    $('searchBanner').classList.add('hidden');
    $('filterBar').classList.remove('hidden');
    $('emptyDateState').classList.add('hidden');
    $('categoryFilter').querySelectorAll('.cat-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.category === 'all');
    });

    // 更新日期列表高亮
    $('dateList').querySelectorAll('.date-nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.date === date);
    });

    // 更新日历
    const parts = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (parts) {
      calYear = parseInt(parts[1]);
      calMonth = parseInt(parts[2]) - 1;
      renderCalendar();
    }

    showLoading(true);
    try {
      const data = await API.getDailyRepos(date);
      allRepos = data.repos || [];

      $('pageTitle').textContent = `${date} 热榜`;
      $('pageSubtitle').textContent = `共 ${data.total} 个项目`;

      // 当日统计
      renderDailyStats(allRepos, date);

      applyFilterAndRender();
    } catch (err) {
      console.error('加载日期数据失败:', err);
      showLoading(false);
      showEmpty(true);
      $('pageSubtitle').textContent = '该日期暂无数据';
    }
  }

  // ===== 渲染当日统计 =====
  function renderDailyStats(repos, date) {
    const card = $('dailyStatsCard');
    const list = $('dailyStatsList');
    const dateLabel = $('dailyStatsDate');
    if (!card || !list) return;

    const counts = { ai_ml: 0, frontend: 0, backend: 0, systems: 0, devops: 0, mobile: 0, other: 0 };
    repos.forEach(r => {
      const cat = normalizeCategory(r.category);
      if (counts[cat] !== undefined) counts[cat]++;
      else counts['other']++;
    });

    if (dateLabel) dateLabel.textContent = date;
    card.classList.remove('hidden');

    const catDefs = [
      { key: 'ai_ml',    label: '🤖 AI/ML',   color: 'text-[#a5d6ff]' },
      { key: 'frontend', label: '🎨 前端',     color: 'text-[#d2a8ff]' },
      { key: 'backend',  label: '⚙️ 后端',     color: 'text-[#7ee787]' },
      { key: 'systems',  label: '🔧 系统',     color: 'text-[#ffa198]' },
      { key: 'devops',   label: '🚀 DevOps',   color: 'text-[#e3b341]' },
      { key: 'mobile',   label: '📱 移动端',   color: 'text-[#76e3ea]' },
      { key: 'other',    label: '📦 其他',     color: 'text-[#57606a]' },
    ];

    list.innerHTML = catDefs.map(c => `
    <div class="flex justify-between items-center text-xs px-1 py-0.5 cursor-pointer hover:bg-[#f3f4f6] rounded -mx-1 transition-colors" data-stat-cat="${c.key}">
    <span class="text-[#57606a]">${c.label}</span>
        <span class="font-mono font-semibold ${c.color}">${counts[c.key]}</span>
      </div>`).join('');

    list.querySelectorAll('[data-stat-cat]').forEach(row => {
      row.addEventListener('click', () => {
        const cat = row.dataset.statCat;
        $('categoryFilter').querySelectorAll('.cat-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.category === cat);
        });
        currentCategory = cat;
        applyFilterAndRender();
      });
    });
  }

  // ===== 搜索 =====
  async function doSearch(q) {
    isSearchMode = true;
    searchKeyword = q;
    currentCategory = 'all';
    displayCount = PAGE_SIZE;

    const url = new URL(window.location.href);
    url.searchParams.set('q', q);
    url.searchParams.delete('date');
    window.history.pushState({}, '', url);

    $('searchBanner').classList.remove('hidden');
    $('searchKeyword').textContent = q;
    $('filterBar').classList.remove('hidden');
    $('emptyDateState').classList.add('hidden');
    $('pageTitle').textContent = '搜索结果';
    $('pageSubtitle').textContent = `关键词：${q}`;

    showLoading(true);
    try {
      const data = await API.searchRepos(q, 60);
      allRepos = data.repos || [];
      $('pageSubtitle').textContent = `找到 ${data.total} 个相关项目`;
      applyFilterAndRender();
    } catch (err) {
      showLoading(false);
      showEmpty(true);
      $('pageSubtitle').textContent = '搜索失败，请重试';
    }
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

  function updateStats() {
    const catLabel = currentCategory === 'all' ? '全部分类' : getCategoryLabel(currentCategory);
    $('statsBar').textContent = `${catLabel} · 共 ${filteredRepos.length} 个项目`;
  }

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

    // 加载更多
    $('btnLoadMore').addEventListener('click', () => {
      displayCount += PAGE_SIZE;
      renderRepos();
    });

    // 日历翻月
    $('calPrevMonth').addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });
    $('calNextMonth').addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });

    // 移动端日期选择
    const mobilePicker = $('mobileDatePicker');
    if (mobilePicker) {
      mobilePicker.addEventListener('change', e => {
        if (e.target.value) loadDate(e.target.value);
      });
    }

    // 清除搜索
    $('clearSearch').addEventListener('click', () => {
      isSearchMode = false;
      searchKeyword = '';
      $('searchBanner').classList.add('hidden');
      $('filterBar').classList.add('hidden');
      $('repoList').innerHTML = '';
      $('emptyDateState').classList.remove('hidden');
      $('pageTitle').textContent = '历史记录';
      $('pageSubtitle').textContent = '请选择日期或搜索关键词';
      const url = new URL(window.location.href);
      url.searchParams.delete('q');
      url.searchParams.delete('date');
      window.history.pushState({}, '', url);
    });

    // Header 搜索
    $('headerSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const q = e.target.value.trim();
        if (q) doSearch(q);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
