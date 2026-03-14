/**
 * 工具函数库 - GitHub Hot Daily
 */

// ===== 日期格式化 =====
function formatDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((todayStart - dStart) / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (d.getFullYear() !== now.getFullYear()) {
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDateFull(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const d = parts ? new Date(+parts[1], +parts[2] - 1, +parts[3]) : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ===== 数字格式化 =====
function formatNumber(n) {
  if (!n && n !== 0) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// ===== 分类映射 =====
const CATEGORY_MAP = {
  ai_ml:    { label: 'AI/ML',   color: 'ai_ml',    icon: '🤖' },
  frontend: { label: '前端',    color: 'frontend',  icon: '🎨' },
  backend:  { label: '后端',    color: 'backend',   icon: '⚙️' },
  systems:  { label: '系统',    color: 'systems',   icon: '🔧' },
  devops:   { label: 'DevOps',  color: 'devops',    icon: '🚀' },
  mobile:   { label: '移动端',  color: 'mobile',    icon: '📱' },
  other:    { label: '其他',    color: 'other',     icon: '📦' },
};

function getCategoryLabel(cat) {
  return CATEGORY_MAP[cat]?.label || cat || '其他';
}

function getCategoryIcon(cat) {
  return CATEGORY_MAP[cat]?.icon || '📦';
}

function normalizeCategory(cat) {
  return CATEGORY_MAP[cat] ? cat : 'other';
}

// ===== 语言颜色 =====
const LANG_COLORS = {
  'Python':      '#3572A5',
  'JavaScript':  '#f1e05a',
  'TypeScript':  '#2b7489',
  'Go':          '#00ADD8',
  'Rust':        '#dea584',
  'Java':        '#b07219',
  'C++':         '#f34b7d',
  'C':           '#555555',
  'Swift':       '#F05138',
  'Kotlin':      '#A97BFF',
  'Dart':        '#00B4AB',
  'Ruby':        '#701516',
  'PHP':         '#4F5D95',
  'Shell':       '#89e051',
  'C#':          '#178600',
  'Scala':       '#c22d40',
  'Haskell':     '#5e5086',
  'Lua':         '#000080',
  'R':           '#198CE7',
  'Elixir':      '#6e4a7e',
  'Zig':         '#ec915c',
  'Vue':         '#41b883',
  'Svelte':      '#ff3e00',
};

function getLangColor(lang) {
  return LANG_COLORS[lang] || '#8b949e';
}

function getLangDotClass(lang) {
  if (!lang) return 'lang-default';
  const key = lang.toLowerCase().replace(/[^a-z]/g, '');
  return `lang-${key}`;
}

// ===== 收藏状态管理 =====
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('ghd_favorites') || '[]');
  } catch { return []; }
}

function isFavorited(repoId) {
  return getFavorites().includes(repoId);
}

function toggleLocalFavorite(repoId) {
  const favs = getFavorites();
  const idx = favs.indexOf(repoId);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push(repoId);
  }
  localStorage.setItem('ghd_favorites', JSON.stringify(favs));
  return idx < 0;
}

// ===== 防抖 =====
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, delay), delay);
  };
}

// ===== 截断文本 =====
function truncate(str, maxLen = 100) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}

// ===== 回到顶部按钮 =====
function initScrollToTop() {
  const btn = document.getElementById('btnTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      btn.classList.remove('hidden');
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
      setTimeout(() => btn.classList.add('hidden'), 300);
    }
  });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ===== 移动端菜单 =====
function initMobileMenu() {
  const btn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });
}

// ===== Toast 提示 =====
function showToast(message, type = 'success', duration = 2500) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast';
  const colors = {
    success: 'bg-green-700',
    error: 'bg-red-700',
    info: 'bg-blue-700',
    warning: 'bg-yellow-700',
  };
  toast.className = `fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-lg text-white text-sm font-medium shadow-lg transition-all border border-green-500/30 ${colors[type] || colors.info}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ===== 复制到剪贴板 =====
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    return true;
  }
}

// ===== 渲染项目卡片（通用） =====
function renderRepoCard(repo, container) {
  const tpl = document.getElementById('repoTpl');
  if (!tpl) return null;

  const card = tpl.content.cloneNode(true);

  // 分类徽章
  const catBadge = card.querySelector('.cat-badge');
  if (catBadge) {
    const cat = normalizeCategory(repo.category);
    catBadge.textContent = getCategoryLabel(cat);
    catBadge.classList.add(cat);
  }

  // 语言颜色点
  const langDot = card.querySelector('.lang-dot');
  const langLabel = card.querySelector('.lang-label');
  if (langDot && repo.language) {
    langDot.style.backgroundColor = getLangColor(repo.language);
  }
  if (langLabel) {
    langLabel.textContent = repo.language || '';
  }

  // Star 数
  const starCount = card.querySelector('.star-count-num');
  if (starCount) {
    starCount.textContent = formatNumber(repo.stars || 0);
  }

  // 今日新增 Star
  const todayStarsEl = card.querySelector('.today-stars-num');
  const todayStarsWrap = card.querySelector('.today-stars-wrap');
  if (todayStarsWrap) {
    if (repo.today_stars > 0) {
      todayStarsWrap.classList.remove('hidden');
      if (todayStarsEl) todayStarsEl.textContent = `+${formatNumber(repo.today_stars)}`;
    } else {
      todayStarsWrap.classList.add('hidden');
    }
  }

  // Fork 数
  const forkCount = card.querySelector('.fork-count-num');
  if (forkCount) {
    forkCount.textContent = formatNumber(repo.forks || 0);
  }

  // 项目名称
  const repoName = card.querySelector('.repo-name');
  if (repoName) {
    repoName.textContent = repo.full_name || repo.name || '';
    repoName.href = repo.url || '#';
  }

  // 中文名称
  const chineseName = card.querySelector('.repo-chinese-name');
  const cnName = repo.structured_summary?.chinese_name;
  if (chineseName && cnName) {
    chineseName.textContent = cnName;
    chineseName.classList.remove('hidden');
  }

  // 描述
  const descEl = card.querySelector('.repo-description');
  const chSummary = repo.structured_summary?.chinese_summary || repo.description;
  if (descEl && chSummary) {
    descEl.textContent = chSummary;
  }

  // 详细分析区
  const analysis = card.querySelector('.repo-analysis');

  // 原始描述
  const origDesc = card.querySelector('.orig-description');
  if (origDesc) {
    origDesc.textContent = repo.description || '暂无描述';
  }

  // 使用场景
  const useCaseBlock = card.querySelector('.use-case-block');
  const useCaseContent = card.querySelector('.use-case-content');
  const useCase = repo.structured_summary?.use_case;
  if (useCaseBlock && useCaseContent && useCase) {
    useCaseContent.textContent = useCase;
    useCaseBlock.classList.remove('hidden');
  }

  // 技术亮点
  const techBlock = card.querySelector('.tech-highlights-block');
  const techList = card.querySelector('.tech-highlights-list');
  const techHighlights = repo.structured_summary?.tech_highlights || [];
  if (techBlock && techList && techHighlights.length > 0) {
    techBlock.classList.remove('hidden');
    techHighlights.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      techList.appendChild(li);
    });
  }

  // 为什么火热
  const whyBlock = card.querySelector('.why-trending-block');
  const whyContent = card.querySelector('.why-trending-content');
  const whyTrending = repo.structured_summary?.why_trending;
  if (whyBlock && whyContent && whyTrending) {
    whyContent.textContent = whyTrending;
    whyBlock.classList.remove('hidden');
  }

  // 快速上手
  const startBlock = card.querySelector('.getting-started-block');
  const startContent = card.querySelector('.getting-started-content');
  const gettingStarted = repo.structured_summary?.getting_started;
  if (startBlock && startContent && gettingStarted) {
    startContent.textContent = gettingStarted;
    startBlock.classList.remove('hidden');
  }

  // 展开/折叠按钮
  const btnExpand = card.querySelector('.btn-expand');
  const expandIcon = card.querySelector('.expand-icon');
  if (btnExpand && analysis) {
    btnExpand.addEventListener('click', () => {
      const isHidden = analysis.classList.contains('hidden');
      analysis.classList.toggle('hidden');
      if (expandIcon) {
        expandIcon.style.transform = isHidden ? 'rotate(180deg)' : '';
      }
      btnExpand.childNodes[0].textContent = isHidden ? '收起详情 ' : '展开详情 ';
    });
  }

  // GitHub 链接
  const repoLink = card.querySelector('.btn-repo-link');
  if (repoLink) {
    repoLink.href = repo.url || '#';
  }

  // Topics 标签
  const tagsEl = card.querySelector('.repo-tags');
  if (tagsEl) {
    const topics = repo.topics || [];
    topics.slice(0, 4).forEach(tag => {
      const span = document.createElement('span');
      span.className = 'repo-tag';
      span.textContent = tag;
      tagsEl.appendChild(span);
    });
  }

  // 收藏按钮
  const favBtn = card.querySelector('.favorite-btn');
  if (favBtn) {
    const repoId = repo.repo_id;
    const updateFavBtn = (favorited) => {
      const icon = favBtn.querySelector('i');
      if (icon) {
        icon.className = favorited ? 'fa fa-star text-sm' : 'fa fa-star-o text-sm';
      }
      favBtn.classList.toggle('text-yellow-400', favorited);
      favBtn.classList.toggle('text-gray-600', !favorited);
    };
    updateFavBtn(isFavorited(repoId));
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const favorited = toggleLocalFavorite(repoId);
      updateFavBtn(favorited);
      showToast(favorited ? '⭐ 已收藏' : '已取消收藏');
    });
  }

  if (container) container.appendChild(card);
  return card.querySelector('article');
}

// ===== 初始化通用功能 =====
document.addEventListener('DOMContentLoaded', () => {
  initScrollToTop();
  initMobileMenu();
});
