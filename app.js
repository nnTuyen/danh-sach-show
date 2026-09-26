/**
 * DATING SHOW HUB (HẸN HÒ HUB)
 * Complete Modern Application Logic with Real Site Favicons, Mobile Search, Multi-links & Large Textarea Editor
 */

// Application State
const state = {
  shows: [],
  filteredShows: [],
  filters: {
    search: '',
    country: 'all',
    status: 'all',
    platform: 'all',
    tag: 'all',
    year: 'all',
    sort: 'airing-first', // Default sort is airing-first
    onlyFavorites: false
  },
  viewMode: 'grid', // 'grid' | 'list'
  theme: 'dark',
  favorites: [],
  spotlightSlugs: [],
  pushedShowHash: false, // true when THIS visit pushed #show= (safe to history.back on close)
  detailSourceEl: null, // card poster element to morph back into on close
  activeShow: null,
  activeEditorTargetId: null
};

// Original tab title (restored when the detail modal closes)
const ORIGINAL_DOC_TITLE = document.title;

// ============================================================
// UTILITIES & SAFE ESCAPING
// ============================================================

function escapeHtml(str) {
  if (!str) return '';
  return str
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Escape for single-quoted JS strings inside HTML attributes
// (onclick="copyText('...')"). escapeHtml is WRONG here: &#039; would be
// copied literally into the clipboard for names with apostrophes.
function escapeJsSq(str) {
  if (!str) return '';
  return str
    .toString()
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

function removeVietnameseAccents(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function slugify(str) {
  if (!str) return '';
  return removeVietnameseAccents(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Debounce: delay expensive filter+render while user is still typing (200-300ms)
function debounce(func, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// Skeleton placeholders: same footprint as real cards so CLS stays 0
function renderShowsSkeleton(count = 8) {
  const container = document.getElementById('showsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;
  if (emptyState) emptyState.style.display = 'none';
  container.style.display = 'grid';
  container.className = 'shows-grid';
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-poster"></div>
      <div class="skeleton-body">
        <div class="skeleton-line long"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>`).join('');
}

// Requirement 8: Enhanced Country mapping including 'other' and 'malaysia'
const COUNTRY_MAP = {
  china: { name: 'Trung Quốc', flag: '🇨🇳', code: 'cn' },
  korea: { name: 'Hàn Quốc', flag: '🇰🇷', code: 'kr' },
  japan: { name: 'Nhật Bản', flag: '🇯🇵', code: 'jp' },
  thailand: { name: 'Thái Lan', flag: '🇹🇭', code: 'th' },
  hongkong: { name: 'Hồng Kông', flag: '🇭🇰', code: 'hk' },
  taiwan: { name: 'Đài Loan', flag: '🇹🇼', code: 'tw' },
  malaysia: { name: 'Malaysia', flag: '🇲🇾', code: 'my' },
  other: { name: 'Quốc gia khác', flag: '🌏', code: null }
};

function getCountryInfo(code) {
  return COUNTRY_MAP[code] || { name: 'Quốc gia khác', flag: '🌏', code: null };
}

// Windows renders flag emoji as letter codes (CN, KR...), so use real flag images.
// Falls back to emoji for 'other'/unknown (globe renders fine everywhere).
function countryFlagHtml(code) {
  const info = getCountryInfo(code);
  if (!info.code) return info.flag;
  return `<img src="https://flagcdn.com/w40/${info.code}.png" alt="${escapeHtml(info.name)}" class="flag-img" loading="lazy" onerror="this.remove()">`;
}

// Genre icon badge like the old version (single badge, normal shows show nothing)
function showGenreBadge(tags) {
  const list = Array.isArray(tags) ? tags : [];
  if (list.includes('all-female')) {
    return `<span class="badge-genre"><i class="fa-solid fa-venus-double"></i> Les (GL)</span>`;
  }
  if (list.includes('all-male')) {
    return `<span class="badge-genre"><i class="fa-solid fa-mars-double"></i> Gay (BL)</span>`;
  }
  if (list.includes('bisexual')) {
    return `<span class="badge-genre"><i class="fa-solid fa-venus-mars"></i> Song tính</span>`;
  }
  if (list.includes('other')) {
    return `<span class="badge-genre badge-genre-other"><i class="fa-solid fa-ellipsis"></i> Khác</span>`;
  }
  return '';
}

function getStatusBadge(status) {
  switch (status) {
    case 'airing':
      return {
        className: 'airing',
        html: '<span class="stat-pulse-dot"></span> Đang chiếu'
      };
    case 'completed':
      return {
        className: 'completed',
        html: '<i class="fa-solid fa-flag-checkered"></i> Hoàn thành'
      };
    case 'upcoming':
      return {
        className: 'upcoming',
        html: '<i class="fa-regular fa-clock"></i> Sắp chiếu'
      };
    default:
      return {
        className: 'completed',
        html: status || 'Chưa rõ'
      };
  }
}

// Format year string nicely: keep ranges ("2021-2026" -> "2021–2026"),
// reduce full dates ("1-6-2026" -> "2026"), pass through plain years.
function formatYear(yearStr) {
  if (!yearStr) return '';
  const s = yearStr.toString();
  const range = s.match(/\b(20\d\d)\s*[–—-]\s*(20\d\d)\b/);
  if (range) return `${range[1]}–${range[2]}`;
  const match = s.match(/\b(20\d\d)\b/);
  return match ? match[1] : yearStr;
}

// Toast notification
function showToast(message, icon = 'fa-check') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fa-solid ${icon}" style="color: var(--primary-pink);"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// Copy helper
function copyText(text, label = '', e) {
  if (e) e.stopPropagation();
  if (!text) return;

  const doSuccess = () => {
    showToast(label ? `Đã sao chép ${label}: "${text}"` : `Đã sao chép: "${text}"`, 'fa-clipboard-check');
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(doSuccess).catch(() => fallbackCopy(text, doSuccess));
  } else {
    fallbackCopy(text, doSuccess);
  }
}

function fallbackCopy(text, onSuccess) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    if (onSuccess) onSuccess();
  } catch (err) {
    prompt('Sao chép đoạn văn bản dưới đây:', text);
  }
  document.body.removeChild(textArea);
}

// ============================================================
// REQUIREMENT 3: OFFICIAL SITE FAVICONS (High-Resolution Favicon)
// ============================================================
function getDomainFromUrl(url) {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

// Fixed official logos for domains missing from Google's favicon service
// (e.g. bilibili.tv returns a generic globe icon there) - stored locally, no hotlink issues
const FIXED_DOMAIN_LOGOS = {
  'bilibili.tv': './images/logo-bilibili.ico',
  'bili.im': './images/logo-bilibili.ico',
  'rophim1.vip': './images/logo-rophim.ico',
  'mintplay-vn.vercel.app': './images/logo-mintplay.png'
};

function getWebsiteFaviconHtml(url, label) {
  const domain = getDomainFromUrl(url);

  if (!domain) {
    return `
      <div class="site-favicon-img" style="display:flex;align-items:center;justify-content:center;background:#ff2e7e;color:#fff;">
        <i class="fa-solid fa-play" style="font-size:11px;"></i>
      </div>`;
  }

  const fallbackSvg = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='%236366f1'/><path d='M9.5 8L16 12L9.5 16V8Z' fill='%23fff'/></svg>`;

  // Use fixed official logo when available, otherwise Google's favicon service
  const lowerDomain = domain.toLowerCase();
  const overrideKey = Object.keys(FIXED_DOMAIN_LOGOS).find(k => lowerDomain === k || lowerDomain.endsWith('.' + k));
  const faviconUrl = overrideKey
    ? FIXED_DOMAIN_LOGOS[overrideKey]
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

  return `<img src="${faviconUrl}" alt="${escapeHtml(domain)}" class="site-favicon-img" loading="lazy" onerror="this.onerror=null; this.src='${fallbackSvg}';">`;
}

// ============================================================
// IMAGE PROXY: resize + compress posters via wsrv.nl (free)
// WebP q80, edge-cached. Falls back to original URL on error.
// New images in showsData.json just use the original link as before.
// ============================================================
const IMAGE_PROXY_BASE = 'https://wsrv.nl/?';
const IMAGE_PROXY_QUALITY = 80;

function getProxiedImageUrl(url, width) {
  if (!url || !/^https?:\/\//i.test(url)) return url;
  if (/^https?:\/\/wsrv\.nl\//i.test(url)) return url;
  const params = new URLSearchParams({
    url: url,
    w: String(width),
    q: String(IMAGE_PROXY_QUALITY),
    output: 'webp'
  });
  return IMAGE_PROXY_BASE + params.toString();
}

// Poster <img> error handler: retry original once, then fallback image
function handlePosterImgError(img, fallbackUrl) {
  const original = img.getAttribute('data-original-src');
  if (original && !img.dataset.origTried) {
    img.dataset.origTried = '1';
    img.src = original;
    return;
  }
  img.onerror = null;
  if (fallbackUrl) img.src = fallbackUrl;
}

// ============================================================
// THEME MANAGER (dark / light / auto-follow-system)
// ============================================================
function resolveTheme() {
  if (state.theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return state.theme;
}

function initTheme() {
  const savedTheme = localStorage.getItem('datinghub_theme');
  state.theme = (savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'auto')
    ? savedTheme
    : 'auto';
  applyTheme(resolveTheme(), state.theme);

  // Live-follow the OS/browser theme while in Auto mode
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (state.theme === 'auto') applyTheme(resolveTheme(), 'auto');
    });
  } catch (e) { /* older browsers: stays on last applied theme */ }

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : state.theme === 'light' ? 'auto' : 'dark';
      localStorage.setItem('datinghub_theme', state.theme);
      applyTheme(resolveTheme(), state.theme);
      showToast(
        state.theme === 'dark' ? 'Giao diện Tối 🌙' :
        state.theme === 'light' ? 'Giao diện Sáng ☀️' : 'Tự động theo trình duyệt 🔄',
        state.theme === 'auto' ? 'fa-circle-half-stroke' : state.theme === 'dark' ? 'fa-moon' : 'fa-sun'
      );
    });
  }
}

function applyTheme(theme, mode) {
  document.documentElement.setAttribute('data-theme', theme);
  const activeMode = mode || state.theme;
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.className = activeMode === 'auto'
      ? 'fa-solid fa-circle-half-stroke'
      : theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    themeIcon.title = activeMode === 'auto'
      ? 'Đang tự động theo trình duyệt (bấm để chuyển Tối)'
      : theme === 'dark' ? 'Chế độ Tối (bấm để chuyển Sáng)' : 'Chế độ Sáng (bấm để theo trình duyệt)';
  }
}

// ============================================================
// FAVORITES (BOOKMARKS)
// ============================================================
function initFavorites() {
  try {
    const saved = localStorage.getItem('datinghub_favorites');
    state.favorites = saved ? JSON.parse(saved) : [];
  } catch (e) {
    state.favorites = [];
  }
  updateFavoritesBadge();

  const favBtn = document.getElementById('btnOpenFavorites');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      state.filters.onlyFavorites = !state.filters.onlyFavorites;
      favBtn.classList.toggle('active', state.filters.onlyFavorites);
      applyFilters();
      if (state.filters.onlyFavorites) {
        showToast(`Đang hiển thị ${state.favorites.length} show trong danh sách Yêu thích`, 'fa-bookmark');
      }
    });
  }
}

function isFavorited(show) {
  const id = show.vietnamese || show.english || show.chinese;
  return state.favorites.includes(id);
}

function toggleFavorite(show, e) {
  if (e) e.stopPropagation();
  const id = show.vietnamese || show.english || show.chinese;
  const index = state.favorites.indexOf(id);

  if (index > -1) {
    state.favorites.splice(index, 1);
    showToast(`Đã xóa "${show.vietnamese}" khỏi Yêu thích`, 'fa-heart-crack');
  } else {
    state.favorites.push(id);
    showToast(`Đã lưu "${show.vietnamese}" vào Yêu thích! 💕`, 'fa-heart');
  }

  localStorage.setItem('datinghub_favorites', JSON.stringify(state.favorites));
  updateFavoritesBadge();
  renderShows();

  if (state.activeShow === show) {
    updateModalFavoriteButton(show);
  }
}

function updateFavoritesBadge() {
  const badge = document.getElementById('favCountBadge');
  if (!badge) return;
  const count = state.favorites.length;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function updateModalFavoriteButton(show) {
  const favBtn = document.getElementById('btnModalFavorite');
  if (!favBtn) return;
  const fav = isFavorited(show);
  favBtn.innerHTML = fav
    ? '<i class="fa-solid fa-heart" style="color: var(--primary-pink);"></i> Đã yêu thích'
    : '<i class="fa-regular fa-heart"></i> Lưu vào Yêu thích';
}

// Fix titles broken by ASCII-only uppercasing (upper ASCII + lower diacritics,
// e.g. "KHI TìNH YêU" instead of "KHI TÌNH YÊU"). Such titles can linger in
// old localStorage copies ('datinghub_local_shows') and render wrong on cards.
const VI_LOWERCASE_DIACRITICS = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
function fixBrokenTitleCase(text) {
  if (!text || /[a-z]/.test(text) || !/[A-Z]/.test(text)) return text;
  for (const ch of text) {
    if (VI_LOWERCASE_DIACRITICS.includes(ch)) return text.toUpperCase();
  }
  return text;
}

// ============================================================
// DATA LOADING
// ============================================================
async function loadShowsData() {
  try {
    const local = readLocalShows();
    let data = null;

    if (local) {
      // Fresh local edits win over an old file; a newer file
      // (fresh download copied in / redeployed) wins over old local data.
      const fileTime = await getBundledFileTime();
      if (fileTime === null || local.savedAt >= fileTime) {
        data = local.shows;
      }
    }

    if (!data || !Array.isArray(data)) {
      const res = await fetch(`./showsData.json?v=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      data = await res.json();
    }

    // Heal broken-case titles, then persist the fix so old localStorage copies recover
    let healedTitles = 0;
    data.forEach(item => {
      ['vietnamese', 'english'].forEach(key => {
        const fixed = fixBrokenTitleCase(item[key]);
        if (fixed !== item[key]) {
          item[key] = fixed;
          healedTitles++;
        }
      });
    });

    state.shows = data;
    ensureShowIds();
    syncSpotlightSlugsFromData();

    // Preserve original file index for "None / Original sort"
    data.forEach((item, index) => {
      if (item._origIndex === undefined) item._origIndex = index;
    });

    if (healedTitles > 0 && local) saveShowsToLocalStorage();
    state.spotlightSlugs = loadPinnedSpotlightSlugs();

    updateHeroStats();
    populatePlatformDropdown();
    populateYearDropdown();
    setupSpotlightShow();
    populateSettingsSelects();
    applyFilters();
    checkUrlHash();
  } catch (err) {
    console.error('Lỗi khi tải showsData.json:', err);
    showToast('Không tải được dữ liệu show. Vui lòng tải lại trang.', 'fa-triangle-exclamation');
  }
}

function saveShowsToLocalStorage() {
  try {
    localStorage.setItem('datinghub_local_shows', JSON.stringify({
      savedAt: Date.now(),
      shows: state.shows
    }));
  } catch (e) {
    console.warn('LocalStorage limit exceeded');
  }
}

// Read local copy (supports legacy raw-array format from older versions)
function readLocalShows() {
  try {
    const raw = localStorage.getItem('datinghub_local_shows');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { savedAt: 0, shows: parsed };
    if (parsed && Array.isArray(parsed.shows)) return parsed;
    return null;
  } catch (e) {
    return null;
  }
}

// Last-Modified of the bundled file: lets a NEWER copied/redeployed
// showsData.json win over an older local copy (the old code always
// preferred localStorage, so updating the file had no visible effect).
async function getBundledFileTime() {
  try {
    const res = await fetch('./showsData.json', { method: 'HEAD' });
    const t = Date.parse(res.headers.get('Last-Modified') || '');
    return Number.isNaN(t) ? null : t;
  } catch (e) {
    return null;
  }
}

function updateHeroStats() {
  const total = state.shows.length;
  const airing = state.shows.filter(s => s.status === 'airing').length;

  const totalEl = document.getElementById('statTotalShows');
  const airingEl = document.getElementById('statAiringShows');
  if (totalEl) totalEl.textContent = total;
  if (airingEl) airingEl.textContent = airing;
}

// All calendar years a show spans: expands ranges ("2021-2026" -> 2021..2026),
// reduces full dates ("1-6-2026" -> [2026]). Empty year -> [].
function getShowYears(show) {
  if (!show || !show.year) return [];
  const found = show.year.toString().match(/20\d\d/g);
  if (!found) return [];
  const nums = found.map(Number).filter(y => y >= 1990 && y <= 2100);
  if (nums.length === 0) return [];
  const min = Math.min(...nums), max = Math.max(...nums);
  const years = [];
  for (let y = min; y <= max; y++) years.push(y);
  return years;
}

function populatePlatformDropdown() {
  const select = document.getElementById('platformSelect');
  if (!select) return;

  const platforms = new Set();
  state.shows.forEach(s => {
    if (s.platform && s.platform !== 'TBA') platforms.add(s.platform.trim());
  });

  const sortedPlatforms = Array.from(platforms).sort();
  const keepValue = select.value || 'all';
  select.innerHTML = '<option value="all">Mọi nền tảng</option>';
  sortedPlatforms.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
  // Keep the user's current filter if it still exists (rebuild wipes selection)
  select.value = sortedPlatforms.includes(keepValue) ? keepValue : 'all';
  state.filters.platform = select.value;

  // Same list feeds the edit/add combobox: pick a suggestion or type a new one
  const datalist = document.getElementById('platformDatalist');
  if (datalist) {
    datalist.innerHTML = '';
    sortedPlatforms.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      datalist.appendChild(opt);
    });
  }
}

function populateYearDropdown() {
  const select = document.getElementById('yearSelect');
  if (!select) return;

  const years = new Set();
  state.shows.forEach(s => getShowYears(s).forEach(y => years.add(y)));

  const sortedYears = Array.from(years).sort((a, b) => b - a);
  const keepYear = select.value || 'all';
  select.innerHTML = '<option value="all">Mọi năm</option>';
  sortedYears.forEach(y => {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = `Năm ${y}`;
    select.appendChild(opt);
  });
  // Keep the user's current filter if it still exists (rebuild wipes selection)
  select.value = keepYear !== 'all' && sortedYears.includes(Number(keepYear)) ? keepYear : 'all';
  state.filters.year = select.value;
}

// Spotlight feature (Show hot carousel, max 4 pinned shows)
const MAX_PINNED_SHOWS = 4;
let spotlightQueue = [];
let spotlightIndex = 0;
let spotlightTimer = null;

function loadPinnedSpotlightSlugs() {
  const raw = localStorage.getItem('datinghub_spotlight') || '';
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string').slice(0, MAX_PINNED_SHOWS);
  } catch (e) { /* old single-slug format handled below */ }
  return [raw].slice(0, MAX_PINNED_SHOWS);
}

function savePinnedSpotlightSlugs() {
  localStorage.setItem('datinghub_spotlight', JSON.stringify(state.spotlightSlugs));
}

// Every show gets a permanent unique id (stable across adds, renames and
// re-sorts). Pins reference ids, so near-duplicate titles (same slugified
// name) can never collide or pin the wrong show.
function ensureShowIds() {
  const used = new Set();
  state.shows.forEach(s => {
    if (typeof s.id === 'string' && s.id.trim() && !used.has(s.id.trim())) {
      s.id = s.id.trim();
      used.add(s.id);
      return;
    }
    const base = slugify(s.vietnamese) || 'show';
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    s.id = id;
    used.add(id);
  });
}

// Pins used to be slugified names (which collide for near-duplicate titles).
// New pins are permanent ids; old slug pins still resolve best-effort.
function findShowByPin(key) {
  if (!key) return undefined;
  return state.shows.find(s => s.id === key)
    || state.shows.find(s => slugify(s.vietnamese) === key);
}

// If local pin storage is empty but the data file carries shared pins
// (hotOrder), adopt them so the settings pin list always reflects reality.
function syncSpotlightSlugsFromData() {
  if (state.spotlightSlugs.length > 0) return;
  const pinned = state.shows
    .filter(s => {
      const n = Number(s.hotOrder);
      return Number.isInteger(n) && n >= 1 && n <= MAX_PINNED_SHOWS;
    })
    .sort((a, b) => Number(a.hotOrder) - Number(b.hotOrder));
  if (pinned.length > 0) {
    state.spotlightSlugs = pinned.map(s => s.id);
    savePinnedSpotlightSlugs();
  }
}

// Staged pins while the settings modal is open (persisted on Save)
let stagedSpotlightSlugs = null;
function getStagedPins() {
  if (!Array.isArray(stagedSpotlightSlugs)) stagedSpotlightSlugs = [...state.spotlightSlugs];
  return stagedSpotlightSlugs;
}

function renderStagedPins() {
  const box = document.getElementById('pinnedShowsList');
  const addBtn = document.getElementById('btnAddSpotlight');
  if (!box) return;
  const staged = getStagedPins();
  if (addBtn) addBtn.disabled = staged.length >= MAX_PINNED_SHOWS;
  if (staged.length === 0) {
    box.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">Chưa ghim show nào. Chọn show bên trên rồi bấm “Thêm ghim”.</div>`;
    return;
  }
  box.innerHTML = `<div style="font-size: 13px; font-weight: 700; margin-bottom: 2px;">Đã ghim (${staged.length}/${MAX_PINNED_SHOWS}) — show đầu hiển thị trước:</div>` + staged.map((uid, i) => {
    const show = findShowByPin(uid);
    const name = show ? show.vietnamese : uid;
    return `<div class="pinned-show-item">
      <span class="pinned-show-num">${i + 1}</span>
      <span class="pinned-show-name">${escapeHtml(name)}</span>
      <span class="pinned-move-group">
        <button type="button" class="btn-pin-move" data-uid="${escapeHtml(uid)}" data-move="-1" title="Chuyển lên trên"${i === 0 ? ' disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
        <button type="button" class="btn-pin-move" data-uid="${escapeHtml(uid)}" data-move="1" title="Chuyển xuống dưới"${i === staged.length - 1 ? ' disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
      </span>
      <button type="button" class="btn-remove-row btn-unpin" data-uid="${escapeHtml(uid)}" title="Bỏ ghim"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  }).join('');
  box.querySelectorAll('.btn-unpin').forEach(btn => {
    btn.onclick = () => {
      stagedSpotlightSlugs = getStagedPins().filter(s => s !== btn.dataset.uid);
      renderStagedPins();
    };
  });
  box.querySelectorAll('.btn-pin-move').forEach(btn => {
    btn.onclick = () => {
      const staged = getStagedPins();
      const i = staged.indexOf(btn.dataset.uid);
      const j = i + Number(btn.dataset.move);
      if (i < 0 || j < 0 || j >= staged.length) return;
      [staged[i], staged[j]] = [staged[j], staged[i]];
      renderStagedPins();
    };
  });
}

function getDefaultSpotlightCandidates() {
  const fallback = state.shows.find(s => (s.vietnamese || '').toLowerCase().includes('tín hiệu con tim s9'))
    || state.shows.find(s => s.status === 'airing' && s.image)
    || state.shows[0];
  return fallback ? [fallback] : [];
}

function setupSpotlightShow() {
  // Pins shared with EVERY visitor live in the data file (hotOrder 1..4).
  // Personal localStorage pins are only a fallback when the data has none.
  const dataPinned = state.shows
    .filter(s => {
      const n = Number(s.hotOrder);
      return Number.isInteger(n) && n >= 1 && n <= MAX_PINNED_SHOWS;
    })
    .sort((a, b) => Number(a.hotOrder) - Number(b.hotOrder))
    .slice(0, MAX_PINNED_SHOWS);
  let queue = dataPinned;
  if (queue.length === 0) {
    queue = state.spotlightSlugs
      .map(key => findShowByPin(key))
      .filter(Boolean)
      .slice(0, MAX_PINNED_SHOWS);
  }
  spotlightQueue = queue.length > 0 ? queue : getDefaultSpotlightCandidates();
  spotlightIndex = 0;
  if (spotlightQueue.length === 0) return;
  buildSpotlightSlides();
  updateSpotlightPosition(true);
  renderSpotlightDots();
  restartSpotlightTimer();
}

function restartSpotlightTimer() {
  clearInterval(spotlightTimer);
  spotlightTimer = null;
  if (spotlightQueue.length > 1) {
    spotlightTimer = setInterval(() => {
      spotlightIndex = (spotlightIndex + 1) % spotlightQueue.length;
      updateSpotlightPosition();
    }, 6000);
  }
}

function goSpotlight(index) {
  if (spotlightQueue.length === 0) return;
  spotlightIndex = (index + spotlightQueue.length) % spotlightQueue.length;
  updateSpotlightPosition();
  restartSpotlightTimer();
}

// Slide-track carousel: all slides pre-rendered once, moves are a single
// transform on the track (no innerHTML churn, no image pop-in per rotation).
function buildSpotlightSlides() {
  const track = document.getElementById('spotlightTrack');
  const heroEl = document.getElementById('heroSpotlight');
  if (!track) return;
  track.innerHTML = '';
  spotlightQueue.forEach((candidate, i) => {
    track.appendChild(buildSpotlightSlide(candidate, i));
  });
  if (heroEl) heroEl.classList.toggle('has-multiple', spotlightQueue.length > 1);
}

function buildSpotlightSlide(candidate, i) {
  const slide = document.createElement('div');
  slide.className = 'spotlight-slide';
  const cInfo = getCountryInfo(candidate.country);
  const rating = candidate.rating ? Number(candidate.rating).toFixed(1) : '5.0';
  const title = escapeHtml(candidate.vietnamese || candidate.english || '');
  const posterHtml = candidate.image
    ? `<img src="${escapeHtml(getProxiedImageUrl(candidate.image, 360))}" data-original-src="${escapeHtml(candidate.image)}" alt="${title}" class="spotlight-poster" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" onload="this.classList.add('loaded')" onerror="handlePosterImgError(this, 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg')">`
    : `<div class="spotlight-poster" style="display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-heart" style="font-size:28px;color:var(--primary-pink);"></i></div>`;
  slide.innerHTML = `
    ${posterHtml}
    <div class="spotlight-info">
      <span class="spotlight-badge"><i class="fa-solid fa-fire"></i> Show hot</span>
      <h2 class="spotlight-title">${title}</h2>
      <div class="spotlight-subtitles">
        ${candidate.english ? `<span class="name-chip">${escapeHtml(candidate.english)} <button class="btn-copy-name" title="Sao chép tên tiếng Anh" onclick="copyText('${escapeJsSq(candidate.english)}', 'tên tiếng Anh', event)"><i class="fa-regular fa-copy"></i></button></span>` : ''}
      </div>
      <p class="spotlight-desc">${escapeHtml(candidate.description || 'Chương trình truyền hình thực tế hẹn hò đặc sắc.')}</p>
      <div class="spotlight-meta-row">
        <span>${countryFlagHtml(candidate.country)} ${cInfo.name}</span>
        <span><i class="fa-solid fa-star" style="color: #fbbf24;"></i> ${rating}</span>
      </div>
      <div class="spotlight-actions">
        <button class="btn-primary" data-act="watch"><i class="fa-solid fa-play"></i> Xem Vietsub</button>
        <button class="btn-secondary" data-act="detail"><i class="fa-solid fa-circle-info"></i> Chi tiết</button>
      </div>
    </div>`;
  slide.querySelector('[data-act="watch"]').onclick = () => openShowDetailAnimated(candidate, 'tab-watch', slide);
  slide.querySelector('[data-act="detail"]').onclick = () => openShowDetailAnimated(candidate, 'tab-desc', slide);
  return slide;
}

function updateSpotlightPosition(instant = false) {
  const track = document.getElementById('spotlightTrack');
  if (!track) return;
  if (instant) {
    track.style.transition = 'none';
    track.style.transform = `translateX(-${spotlightIndex * 100}%)`;
    void track.offsetWidth;
    track.style.transition = '';
  } else {
    track.style.transform = `translateX(-${spotlightIndex * 100}%)`;
  }
  renderSpotlightDots();
}

function renderSpotlightDots() {
  const heroEl = document.getElementById('heroSpotlight');
  const dotsBox = document.getElementById('spotlightDots');
  const multiple = spotlightQueue.length > 1;
  if (heroEl) heroEl.classList.toggle('has-multiple', multiple);
  if (!dotsBox) return;
  dotsBox.innerHTML = '';
  if (!multiple) {
    dotsBox.style.display = 'none';
    return;
  }
  dotsBox.style.display = 'flex';
  spotlightQueue.forEach((_, i) => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'spotlight-dot' + (i === spotlightIndex ? ' active' : '');
    d.setAttribute('aria-label', 'Show hot ' + (i + 1));
    d.onclick = () => goSpotlight(i);
    dotsBox.appendChild(d);
  });
}

function initSpotlightCarousel() {
  if (initSpotlightCarousel.done) return;
  initSpotlightCarousel.done = true;
  const heroEl = document.getElementById('heroSpotlight');
  const prev = document.getElementById('spotlightPrev');
  const next = document.getElementById('spotlightNext');
  if (prev) prev.onclick = () => goSpotlight(spotlightIndex - 1);
  if (next) next.onclick = () => goSpotlight(spotlightIndex + 1);
  if (heroEl) {
    heroEl.addEventListener('mouseenter', () => clearInterval(spotlightTimer));
    heroEl.addEventListener('mouseleave', restartSpotlightTimer);

    // Touch swipe: horizontal swipe switches show, vertical scroll unaffected
    let spX = 0, spY = 0;
    heroEl.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (!t) return;
      spX = t.clientX;
      spY = t.clientY;
    }, { passive: true });
    heroEl.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - spX;
      const dy = t.clientY - spY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        goSpotlight(spotlightIndex + (dx < 0 ? 1 : -1));
      }
    }, { passive: true });
  }
}


// ============================================================
// FILTERING & SEARCH
// ============================================================
function applyFilters() {
  const { search, country, status, platform, tag, year, sort, onlyFavorites } = state.filters;
  const searchKeyword = removeVietnameseAccents(search);

  const recognizedCountries = ['china', 'korea', 'japan', 'thailand', 'hongkong', 'taiwan', 'malaysia'];

  let result = state.shows.filter(show => {
    if (onlyFavorites && !isFavorited(show)) return false;

    // 'other' country matches any non-standard country (malaysia has its own filter now)
    if (country !== 'all') {
      if (country === 'other') {
        const isStandard = recognizedCountries.includes(show.country);
        if (isStandard) return false;
      } else if (show.country !== country) {
        return false;
      }
    }

    if (status !== 'all' && show.status !== status) return false;
    if (platform !== 'all' && (show.platform || '').trim() !== platform) return false;
    if (tag !== 'all') {
      const showTags = show.tags || [];
      if (!showTags.includes(tag)) return false;
    }
    if (year !== 'all' && !getShowYears(show).includes(Number(year))) return false;

    if (searchKeyword) {
      const vn = removeVietnameseAccents(show.vietnamese);
      const en = removeVietnameseAccents(show.english);
      const zh = removeVietnameseAccents(show.chinese);
      const desc = removeVietnameseAccents(show.description);
      const cast = removeVietnameseAccents(show.detailNotes);
      const plat = removeVietnameseAccents(show.platform);

      const matches =
        vn.includes(searchKeyword) ||
        en.includes(searchKeyword) ||
        zh.includes(searchKeyword) ||
        desc.includes(searchKeyword) ||
        cast.includes(searchKeyword) ||
        plat.includes(searchKeyword);

      if (!matches) return false;
    }

    return true;
  });

  // Sorting: airing -> completed -> upcoming, names A-Z within each group
  if (sort === 'airing-first') {
    const statusRank = { airing: 0, completed: 1, upcoming: 2 };
    result.sort((a, b) => {
      const rankA = statusRank[a.status] !== undefined ? statusRank[a.status] : 3;
      const rankB = statusRank[b.status] !== undefined ? statusRank[b.status] : 3;
      if (rankA !== rankB) return rankA - rankB;
      return (a.vietnamese || '').localeCompare(b.vietnamese || '', 'vi');
    });
  } else if (sort === 'none') {
    result.sort((a, b) => (a._origIndex || 0) - (b._origIndex || 0));
  } else if (sort === 'rating-desc') {
    result.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sort === 'title-asc') {
    result.sort((a, b) => (a.vietnamese || '').localeCompare(b.vietnamese || '', 'vi'));
  }

  state.filteredShows = result;
  renderShows();
  updateResultsCount();
  updateMobileFilterBadge();
}

function updateMobileFilterBadge() {
  const badge = document.getElementById('mobileFilterBadge');
  if (!badge) return;

  const parts = [];
  if (state.filters.status === 'airing') parts.push('Đang chiếu');
  else if (state.filters.status === 'completed') parts.push('Hoàn thành');
  else if (state.filters.status === 'upcoming') parts.push('Sắp chiếu');

  if (state.filters.country !== 'all') {
    const c = getCountryInfo(state.filters.country);
    parts.push(c.name);
  }

  if (state.filters.platform !== 'all') parts.push(state.filters.platform);
  if (state.filters.year !== 'all') parts.push(`Năm ${state.filters.year}`);
  badge.textContent = parts.length > 0 ? `(${parts.join(', ')})` : '';
}

function updateResultsCount() {
  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.textContent = showsRenderedCount < state.filteredShows.length
      ? `${showsRenderedCount}/${state.filteredShows.length}`
      : `${state.filteredShows.length}`;
  }

  const resetBtn = document.getElementById('btnResetFilters');
  const hasActiveFilters =
    state.filters.search !== '' ||
    state.filters.country !== 'all' ||
    state.filters.status !== 'all' ||
    state.filters.platform !== 'all' ||
    state.filters.tag !== 'all' ||
    state.filters.year !== 'all' ||
    state.filters.sort !== 'airing-first' ||
    state.filters.onlyFavorites;

  if (resetBtn) resetBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
}

function resetAllFilters() {
  state.filters = {
    search: '',
    country: 'all',
    status: 'all',
    platform: 'all',
    tag: 'all',
    year: 'all',
    sort: 'airing-first',
    onlyFavorites: false
  };

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  if (mobileSearchInput) mobileSearchInput.value = '';

  document.getElementById('searchClearBtn')?.classList.remove('active');
  document.getElementById('mobileSearchClearBtn')?.classList.remove('active');

  const countrySelectReset = document.getElementById('countrySelect');
  if (countrySelectReset) countrySelectReset.value = 'all';

  const mobileCountrySelect = document.getElementById('mobileCountrySelect');
  if (mobileCountrySelect) mobileCountrySelect.value = 'all';

  document.querySelectorAll('.btn-filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.status === 'all');
  });

  const platformSelect = document.getElementById('platformSelect');
  if (platformSelect) platformSelect.value = 'all';

  const tagSelect = document.getElementById('tagSelect');
  if (tagSelect) tagSelect.value = 'all';

  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) yearSelect.value = 'all';

  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.value = 'airing-first';

  const favBtn = document.getElementById('btnOpenFavorites');
  if (favBtn) favBtn.classList.remove('active');

  applyFilters();
  showToast('Đã khôi phục tất cả bộ lọc', 'fa-rotate-left');
}

// ============================================================
// RENDERING SHOW CARDS (REQUIREMENT 6 & 7)
// ============================================================
// Infinite scroll learned from the old version: render in small chunks so the
// first paint stays light and swiping stays smooth (DOM stays small).
const SHOWS_PER_BATCH = 16;
let showsRenderedCount = 0;
let showsSentinelObserver = null;

function getShowsSentinelObserver() {
  if (!showsSentinelObserver) {
    showsSentinelObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        // Sentinel fully above viewport (e.g. restored scroll): wait for real scroll
        if (entry.boundingClientRect.bottom <= 0) return;
        loadMoreShows();
      });
    }, { rootMargin: '400px' });
  }
  return showsSentinelObserver;
}

function renderShows() {
  const container = document.getElementById('showsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;

  const oldSentinel = container.querySelector('.shows-sentinel');
  if (oldSentinel && showsSentinelObserver) showsSentinelObserver.unobserve(oldSentinel);

  if (state.filteredShows.length === 0) {
    showsRenderedCount = 0;
    container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    updateResultsCount();
    return;
  }

  container.style.display = state.viewMode === 'grid' ? 'grid' : 'flex';
  container.className = state.viewMode === 'grid' ? 'shows-grid' : 'shows-list';
  if (emptyState) emptyState.style.display = 'none';

  showsRenderedCount = 0;
  container.innerHTML = '';
  appendShowsBatch(container);
}

function appendShowsBatch(container) {
  const total = state.filteredShows.length;
  const canObserve = 'IntersectionObserver' in window;
  const start = showsRenderedCount;
  const end = canObserve ? Math.min(start + SHOWS_PER_BATCH, total) : total;
  if (start >= end) {
    updateResultsCount();
    return;
  }

  const fragment = document.createDocumentFragment();
  state.filteredShows.slice(start, end).forEach((show, i) => {
    const el = state.viewMode === 'grid' ? createGridCard(show) : createListItem(show);
    el.classList.add('card-enter');
    el.style.animationDelay = `${Math.min(i, 7) * 35}ms`;
    fragment.appendChild(el);
  });
  // First paint: prioritize above-the-fold images (like onflix preloads its hero)
  if (start === 0) {
    fragment.querySelectorAll('img').forEach((img, i) => {
      if (i < 6) {
        img.loading = 'eager';
        img.fetchPriority = 'high';
      }
    });
  }
  showsRenderedCount = end;

  if (end < total) {
    const sentinel = document.createElement('div');
    sentinel.className = 'shows-sentinel';
    fragment.appendChild(sentinel);
    getShowsSentinelObserver().observe(sentinel);
  }

  container.appendChild(fragment);
  updateResultsCount();
}

function loadMoreShows() {
  const container = document.getElementById('showsGrid');
  if (!container) return;
  const oldSentinel = container.querySelector('.shows-sentinel');
  if (oldSentinel) {
    if (showsSentinelObserver) showsSentinelObserver.unobserve(oldSentinel);
    oldSentinel.remove();
  }
  appendShowsBatch(container);
}

function createGridCard(show) {
  const card = document.createElement('div');
  card.className = 'show-card';
  card.onclick = () => openShowDetailAnimated(show, 'tab-watch', cardPosterEl(card));

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const ratingValue = show.rating ? Number(show.rating).toFixed(1) : '5.0';
  const vnTitleEscaped = escapeHtml(fixBrokenTitleCase(show.vietnamese));
  const enTitleEscaped = escapeHtml(fixBrokenTitleCase(show.english) || '');
  const yearFormatted = formatYear(show.year);

  let posterHtml = '';
  if (show.image) {
    // Responsive proxy width: mobile 2-col cards are only ~160-180px wide,
    // no need to download the 400px desktop variant (~40% bytes saved)
    const posterWidth = window.matchMedia('(max-width: 480px)').matches ? 300 : 400;
    posterHtml = `<img src="${escapeHtml(getProxiedImageUrl(show.image, posterWidth))}" data-original-src="${escapeHtml(show.image)}" alt="${vnTitleEscaped}" class="card-poster-img" width="300" height="400" loading="lazy" decoding="async" onload="this.classList.add('loaded')">`;
  } else {
    posterHtml = `<div class="card-poster-fallback"><i class="fa-solid fa-heart fallback-icon"></i><div class="fallback-title">${vnTitleEscaped}</div></div>`;
  }

  card.innerHTML = `
    <div class="card-poster-wrapper">
      <div class="card-zoom">
        ${posterHtml}
        <div class="card-rating-pill">
          <i class="fa-solid fa-star"></i>
          <span>${ratingValue}</span>
        </div>
      </div>
    </div>

    <div class="card-content">
      <div class="card-meta-row">
        <span class="card-country-badge">${countryFlagHtml(show.country)} ${countryInfo.name}</span>
        ${yearFormatted ? `<span class="card-year-badge"><i class="fa-regular fa-calendar"></i> ${yearFormatted}</span>` : ''}
      </div>
      <div class="card-status-row">
        <span class="badge-status ${statusInfo.className}">${statusInfo.html}</span>
        ${showGenreBadge(show.tags)}
      </div>

      <h3 class="card-title-vn" title="${vnTitleEscaped}">${vnTitleEscaped}</h3>

      <!-- Homepage: Vietnamese + English names only -->
      <div class="card-title-sub-row">
        <div class="card-sub-names" title="${enTitleEscaped}">
          ${enTitleEscaped}
        </div>
      </div>

      ${show.time ? `<div class="card-schedule"><i class="fa-regular fa-clock"></i> <span>${escapeHtml(show.time)}</span></div>` : ''}

      <div class="card-footer">
        <button class="btn-card-watch" data-action="watch">
          <i class="fa-solid fa-play"></i> Xem ngay
        </button>
        <button class="btn-card-detail" data-action="detail" title="Xem chi tiết">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </button>
      </div>
    </div>
  `;

  // Attach safe image onerror fallback via DOM (retry original once, then fallback art)
  const imgEl = card.querySelector('.card-poster-img');
  if (imgEl) {
    imgEl.onerror = () => {
      const original = imgEl.getAttribute('data-original-src');
      if (original && !imgEl.dataset.origTried) {
        imgEl.dataset.origTried = '1';
        imgEl.src = original;
        return;
      }
      const wrapper = imgEl.parentElement;
      if (wrapper) {
        imgEl.remove();
        const fallback = document.createElement('div');
        fallback.className = 'card-poster-fallback';
        fallback.innerHTML = `<i class="fa-solid fa-heart fallback-icon"></i><div class="fallback-title">${vnTitleEscaped}</div>`;
        wrapper.prepend(fallback);
      }
    };
    // Proxy/CDN requests can hang forever (neither load nor error) leaving a
    // permanently invisible card: force the fallback path after 8s of silence.
    setTimeout(() => {
      if (imgEl.isConnected && !imgEl.classList.contains('loaded') && imgEl.naturalWidth === 0) {
        imgEl.onerror();
      }
    }, 8000);
  }

  // Bind Actions
  const watchBtn = card.querySelector('[data-action="watch"]');
  if (watchBtn) watchBtn.onclick = (e) => { e.stopPropagation(); openShowDetailAnimated(show, 'tab-watch', cardPosterEl(card)); };

  const detailBtn = card.querySelector('[data-action="detail"]');
  if (detailBtn) detailBtn.onclick = (e) => { e.stopPropagation(); openShowDetailAnimated(show, 'tab-desc', cardPosterEl(card)); };

  return card;
}

function createListItem(show) {
  const item = document.createElement('div');
  item.className = 'show-list-item';
  item.onclick = () => openShowDetailAnimated(show, 'tab-watch', item.querySelector('.list-item-poster'));

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const vnTitleEscaped = escapeHtml(fixBrokenTitleCase(show.vietnamese));
  const yearFormatted = formatYear(show.year);
  const listPosterOrig = show.image || '';
  const listPosterSrc = listPosterOrig
    ? getProxiedImageUrl(listPosterOrig, 140)
    : 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg';

  item.innerHTML = `
    <img src="${escapeHtml(listPosterSrc)}"${listPosterOrig ? ` data-original-src="${escapeHtml(listPosterOrig)}"` : ''} alt="${vnTitleEscaped}" class="list-item-poster" width="52" height="70" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="handlePosterImgError(this, 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg');">
    <div class="list-item-info">
      <div class="list-item-title">${vnTitleEscaped}</div>
      <div class="list-item-sub">
        <span>${escapeHtml(fixBrokenTitleCase(show.english) || '')}</span>
      </div>
      <div class="list-item-meta">
        <span>${countryFlagHtml(show.country)} ${countryInfo.name}</span>
        ${yearFormatted ? `<span>•</span><span>${yearFormatted}</span>` : ''}
        <span>•</span>
        <span class="badge-status ${statusInfo.className}" style="font-size: 10px; padding: 2px 6px;">${statusInfo.html}</span>
        ${showGenreBadge(show.tags)}
      </div>
    </div>
    <div class="list-item-actions">
      <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" data-action="watch">
        <i class="fa-solid fa-play"></i> Xem
      </button>
    </div>
  `;

  const watchBtn = item.querySelector('[data-action="watch"]');
  if (watchBtn) watchBtn.onclick = (e) => { e.stopPropagation(); openShowDetailAnimated(show, 'tab-watch', item.querySelector('.list-item-poster')); };

  return item;
}

// ============================================================
// SHOW DETAIL MODAL (FAVICONS & COPY BUTTONS IN MODAL)
// ============================================================
// ============================================================
// A11Y: modal focus trap + restore focus on close.
// A single global Tab handler covers every .modal-overlay; open/close
// helpers move focus in and restore it so keyboard users never get
// lost behind the overlay.
// ============================================================
let lastFocusedBeforeModal = null;
let savedPageScrollY = 0;

function focusModalEntry(modal) {
  lastFocusedBeforeModal = document.activeElement;
  savedPageScrollY = window.scrollY;
  const closeBtn = modal.querySelector('.btn-modal-close');
  const first = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  (closeBtn || first || modal).focus?.({ preventScroll: true });
}

function restoreFocusAfterModal() {
  if (document.querySelector('.modal-overlay.active')) return; // another modal still open
  // Only touch scroll/focus when a modal was actually open (lastFocused is
  // set on open). Otherwise Esc on the homepage would yank the page to top.
  if (lastFocusedBeforeModal && document.contains(lastFocusedBeforeModal)) {
    window.scrollTo(0, savedPageScrollY);
    lastFocusedBeforeModal.focus?.({ preventScroll: true });
  }
  lastFocusedBeforeModal = null;
}

function initModalFocusTrap() {
  if (initModalFocusTrap.done) return;
  initModalFocusTrap.done = true;
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const openModals = [...document.querySelectorAll('.modal-overlay.active')];
    if (openModals.length === 0) return;
    const modal = openModals[openModals.length - 1]; // topmost stacked modal
    const items = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.getClientRects().length > 0);
    if (items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}
// Freeze modal height in px at open: mobile dvh changes when the browser
// toolbar shows/hides, and resizing the modal mid-animation flashes its border.
// px value still fits the visible area, just never shifts afterwards.
function freezeModalHeight(modal) {
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  if (content) content.style.maxHeight = Math.round(window.innerHeight * 0.9) + 'px';
}

function unfreezeModalHeight(modal) {
  if (!modal) return;
  const content = modal.querySelector('.modal-content');
  if (content) content.style.maxHeight = '';
}

// Poster element inside a grid card used as shared-element morph source
// (photo, gradient fallback art, or the card itself as last resort).
function cardPosterEl(card) {
  return card.querySelector('.card-poster-img')
    || card.querySelector('.card-poster-fallback')
    || card;
}

// iOS app open/close style: the whole card expands into the modal and shrinks
// back on close (spring easing ~cubic-bezier iOS, corner morph 14px -> modal).
// Finite <0.5s, transform-only. Falls back to plain open when reduced motion
// or when there is no source card (spotlight/random/shared link).
const IOS_SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';
// Open uses a gentle overshoot: the settle masks the heavy final frame
// (full-size modal raster + backdrop at full opacity) that otherwise reads
// as a last-second hitch. Radius keeps the smooth curve (overshoot on
// corners would visibly bulge).
const IOS_SPRING_OPEN = 'cubic-bezier(0.34, 1.3, 0.64, 1)';

function modalContentEl() {
  const modal = document.getElementById('detailModal');
  return modal ? modal.querySelector('.modal-content') : null;
}

function flipCleanup(content, onEnd) {
  content.style.transition = '';
  content.style.transform = '';
  content.style.borderRadius = '';
  content.style.visibility = '';
  if (onEnd) content.removeEventListener('transitionend', onEnd);
}

// Open with shared-element morph from the card poster when possible:
// the poster visually expands into the modal (and shrinks back on close).
// No VT support / reduced motion / no source element -> plain open.
function openShowDetailAnimated(show, defaultTab = 'tab-watch', sourceEl = null) {
  const card = sourceEl && sourceEl.closest
    ? (sourceEl.closest('.show-card, .show-list-item') || sourceEl)
    : null;
  state.detailSourceEl = (card && card.isConnected) ? card : null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const content = modalContentEl();
  if (reduceMotion || !state.detailSourceEl || !content) {
    openShowDetail(show, defaultTab);
    return;
  }

  // 1. Render the modal instantly with its built-in motion suppressed.
  // Keep it invisible while the poster decodes: async waiting would otherwise
  // flash the full modal statically before the morph starts (blink bug).
  content.classList.add('no-anim');
  content.style.visibility = 'hidden';
  openShowDetail(show, defaultTab);

  // 2. Let the modal poster finish decoding first (capped 180ms): morphing
  // while the photo still decodes is the main source of mid-flight stutter.
  const mp = document.getElementById('modalPoster');
  const waitDecode = (mp && !mp.complete && mp.decode)
    ? Promise.race([mp.decode(), new Promise(res => setTimeout(res, 180))]).catch(() => {})
    : Promise.resolve();
  waitDecode.then(() => {
    if (!document.getElementById('detailModal').classList.contains('active')) {
      content.classList.remove('no-anim');
      content.style.visibility = '';
      return;
    }
    startFlipOpen(content);
  });
}

function startFlipOpen(content) {
  // Invert: shrink it onto the card rect (FLIP first frame)
  const s = state.detailSourceEl.getBoundingClientRect();
  const t = content.getBoundingClientRect();
  if (s.width < 4 || s.height < 4 || t.width < 4 || t.height < 4) {
    content.classList.remove('no-anim');
    content.style.visibility = '';
    return;
  }
  const dx = (s.left + s.width / 2) - (t.left + t.width / 2);
  const dy = (s.top + s.height / 2) - (t.top + t.height / 2);
  const targetRadius = getComputedStyle(content).borderRadius || '20px';
  content.style.transform = `translate(${dx}px, ${dy}px) scale(${s.width / t.width}, ${s.height / t.height})`;
  content.style.borderRadius = '14px';
  void content.offsetWidth;

  // 3. Play: reveal and expand to identity on an iOS spring (backdrop fades via overlay)
  content.classList.remove('no-anim');
  content.style.visibility = '';
  content.style.transition = `transform 400ms ${IOS_SPRING_OPEN}, border-radius 400ms ${IOS_SPRING}`;
  content.style.transform = 'none';
  content.style.borderRadius = targetRadius;
  let done = false;
  const onEnd = (e) => { if (e.propertyName === 'transform') { done = true; flipCleanup(content, onEnd); } };
  content.addEventListener('transitionend', onEnd);
  setTimeout(() => { if (!done) { done = true; flipCleanup(content, onEnd); } }, 600);
}

// Lock page scroll WITHOUT breaking position:sticky bars. overflow:hidden
// turns <body> into a scroll container, so sticky header/filter re-anchor
// to the document and slide offscreen the moment a modal opens (measured:
// header rect jumps to -1500). overflow:clip forbids scrolling but never
// creates a scroll container, so sticky keeps sticking to the viewport.
function lockPageScroll() {
  document.body.style.overflow = 'hidden';
  document.body.style.overflow = 'clip';
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'clip';
}
function unlockPageScroll() {
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

function openShowDetail(show, defaultTab = 'tab-watch') {
  state.activeShow = show;
  const modal = document.getElementById('detailModal');
  if (!modal) return;

  // Pause spotlight rotation while a modal owns the screen: a 6s tick firing
  // mid-morph steals the compositor and reads as stutter. Resumed on close.
  clearInterval(spotlightTimer);
  spotlightTimer = null;

  const slug = slugify(show.vietnamese);
  // pushState (not replaceState) so the system Back button / swipe-back gesture
  // returns to the list. Skip when already on this hash (direct-link load).
  if (slug && window.location.hash !== `#show=${slug}`) {
    window.history.pushState({ modalOpen: true }, '', `#show=${slug}`);
    state.pushedShowHash = true;
  }
  document.title = `${show.vietnamese} - Vietsub | Dating show 💕`;

  const poster = document.getElementById('modalPoster');
  if (poster) {
    delete poster.dataset.origTried;
    if (show.image) {
      poster.setAttribute('data-original-src', show.image);
      poster.src = getProxiedImageUrl(show.image, 600);
    } else {
      poster.removeAttribute('data-original-src');
      poster.src = 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg';
    }
    poster.onerror = () => handlePosterImgError(poster, 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg');
  }

  const title = document.getElementById('modalTitle');
  if (title) title.textContent = show.vietnamese;

  // Requirement 6: Copy buttons live neatly inside modal
  const subs = document.getElementById('modalSubtitles');
  if (subs) {
    subs.innerHTML = `
      ${show.chinese ? `<span class="name-chip">${escapeHtml(show.chinese)} <button class="btn-copy-name" title="Sao chép tên tiếng Trung" onclick="copyText('${escapeJsSq(show.chinese)}', 'tên tiếng Trung', event)"><i class="fa-regular fa-copy"></i> Copy</button></span>` : ''}
      ${show.english ? `<span class="name-chip">${escapeHtml(show.english)} <button class="btn-copy-name" title="Sao chép tên tiếng Anh" onclick="copyText('${escapeJsSq(show.english)}', 'tên tiếng Anh', event)"><i class="fa-regular fa-copy"></i> Copy</button></span>` : ''}
    `;
  }

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);

  const statusBadge = document.getElementById('modalStatusBadge');
  if (statusBadge) {
    statusBadge.className = `badge-status ${statusInfo.className}`;
    statusBadge.innerHTML = statusInfo.html;
  }

  const countryBadge = document.getElementById('modalCountryBadge');
  if (countryBadge) countryBadge.innerHTML = `${countryFlagHtml(show.country)} ${countryInfo.name}`;

  const modalBadgesRow = document.querySelector('#detailModal .modal-badges-row');
  if (modalBadgesRow) {
    modalBadgesRow.querySelectorAll('.badge-genre').forEach(el => el.remove());
    const genreBadgeHtml = showGenreBadge(show.tags);
    if (genreBadgeHtml) modalBadgesRow.insertAdjacentHTML('beforeend', genreBadgeHtml);
  }

  const ratingBadge = document.getElementById('modalRatingBadge');
  if (ratingBadge) {
    const val = show.rating ? Number(show.rating).toFixed(1) : '5.0';
    ratingBadge.innerHTML = `<i class="fa-solid fa-star"></i> <span>${val}</span>`;
  }

  const platformEl = document.getElementById('modalPlatform');
  if (platformEl) platformEl.textContent = show.platform || 'Online';

  const scheduleEl = document.getElementById('modalSchedule');
  if (scheduleEl) scheduleEl.textContent = show.time || 'Đang cập nhật';

  const yearEl = document.getElementById('modalYear');
  if (yearEl) yearEl.textContent = show.year || '2024-2026';

  populateWatchLinks(show);
  populateCastMembers(show.detailNotes);

  const descEl = document.getElementById('modalDescription');
  if (descEl) descEl.textContent = show.description || 'Chưa có thông tin giới thiệu cho show này.';

  updateModalFavoriteButton(show);
  switchModalTab(defaultTab);

  freezeModalHeight(modal);
  modal.classList.add('active');
  lockPageScroll();
  focusModalEntry(modal);
}

function closeShowDetail(updateHistory = true) {
  const modal = document.getElementById('detailModal');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const src = state.detailSourceEl;
  const content = modal ? modal.querySelector('.modal-content') : null;
  const flipping = modal && modal.classList.contains('active') && content &&
    !reduceMotion && src && src.isConnected;
  if (!flipping) {
    doCloseShowDetail(updateHistory);
    return;
  }

  const s = src.getBoundingClientRect();
  const t = content.getBoundingClientRect();
  if (s.width < 4 || s.height < 4 || t.width < 4 || t.height < 4) {
    doCloseShowDetail(updateHistory);
    return;
  }
  const dx = (s.left + s.width / 2) - (t.left + t.width / 2);
  const dy = (s.top + s.height / 2) - (t.top + t.height / 2);

  // Backdrop fades via overlay class removal; content morphs back to the card
  modal.classList.remove('active');
  content.style.transition = `transform 380ms ${IOS_SPRING}, border-radius 380ms ${IOS_SPRING}`;
  let done = false;
  const onEnd = (e) => { if (e.propertyName === 'transform') finish(); };
  const finish = () => {
    if (done) return;
    done = true;
    flipCleanup(content, onEnd);
    doCloseShowDetail(updateHistory);
  };
  content.addEventListener('transitionend', onEnd);
  requestAnimationFrame(() => {
    content.style.transform = `translate(${dx}px, ${dy}px) scale(${s.width / t.width}, ${s.height / t.height})`;
    content.style.borderRadius = '14px';
  });
  setTimeout(finish, 520);
}

function doCloseShowDetail(updateHistory = true) {
  const modal = document.getElementById('detailModal');
  state.detailSourceEl = null;
  if (!modal) return;
  unfreezeModalHeight(modal);
  modal.classList.remove('active');
  unlockPageScroll();
  state.activeShow = null;
  restoreFocusAfterModal();
  restartSpotlightTimer();
  document.title = ORIGINAL_DOC_TITLE;

  if (!updateHistory) return;
  if (state.pushedShowHash) {
    // We pushed this entry: go back so Back/Forward stay consistent.
    // The popstate handler below sees an inactive modal and does nothing.
    state.pushedShowHash = false;
    window.history.back();
  } else if (window.location.hash.startsWith('#show=')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

// ============================================================
// POSTER LIGHTBOX: original quality + zoom (wheel / pinch / buttons)
// ============================================================
const lightboxState = { scale: 1, minScale: 1, maxScale: 6, x: 0, y: 0, iw: 0, ih: 0 };

function applyLightboxTransform() {
  const img = document.getElementById('imageLightboxImg');
  if (!img) return;
  img.style.transform = `translate(${lightboxState.x}px, ${lightboxState.y}px) scale(${lightboxState.scale})`;
}

function fitLightboxImage() {
  const img = document.getElementById('imageLightboxImg');
  if (!img || !img.naturalWidth) return;
  lightboxState.iw = img.naturalWidth;
  lightboxState.ih = img.naturalHeight;
  const vw = window.innerWidth, vh = window.innerHeight;
  const s = Math.min(vw / img.naturalWidth, vh / img.naturalHeight);
  lightboxState.minScale = s;
  lightboxState.scale = s;
  lightboxState.x = (vw - img.naturalWidth * s) / 2;
  lightboxState.y = (vh - img.naturalHeight * s) / 2;
  applyLightboxTransform();
}

function clampLightboxPan() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const w = lightboxState.iw * lightboxState.scale;
  const h = lightboxState.ih * lightboxState.scale;
  if (w <= vw) lightboxState.x = (vw - w) / 2;
  else lightboxState.x = Math.min(0, Math.max(vw - w, lightboxState.x));
  if (h <= vh) lightboxState.y = (vh - h) / 2;
  else lightboxState.y = Math.min(0, Math.max(vh - h, lightboxState.y));
}

function zoomLightboxAt(cx, cy, factor) {
  const st = lightboxState;
  const ns = Math.min(st.maxScale, Math.max(st.minScale, st.scale * factor));
  if (ns === st.scale) return;
  const k = ns / st.scale;
  st.x = cx - (cx - st.x) * k;
  st.y = cy - (cy - st.y) * k;
  st.scale = ns;
  clampLightboxPan();
  applyLightboxTransform();
}

function openPosterLightbox(src, alt) {
  const box = document.getElementById('imageLightbox');
  const img = document.getElementById('imageLightboxImg');
  if (!box || !img || !src) return;
  lbPointers.clear();
  img.classList.remove('dragging');
  img.onload = fitLightboxImage;
  const sameSrc = img.getAttribute('src') === src;
  img.src = src;
  if (alt) img.alt = alt;
  if (sameSrc && img.complete && img.naturalWidth) fitLightboxImage();
  box.classList.add('open');
  box.setAttribute('aria-hidden', 'false');
  lockPageScroll();
}

function closePosterLightbox() {
  const box = document.getElementById('imageLightbox');
  if (!box) return;
  lbPointers.clear();
  box.classList.remove('open');
  box.setAttribute('aria-hidden', 'true');
  const detailModal = document.getElementById('detailModal');
  if (!detailModal || !detailModal.classList.contains('active')) {
    unlockPageScroll();
  }
}

const lbPointers = new Map();
let lbPinchDist = 0, lbLastTap = 0, lbDragMoved = false;

function initPosterLightbox() {
  if (initPosterLightbox.done) return;
  initPosterLightbox.done = true;
  const boxEl = document.getElementById('imageLightbox');
  const imgEl = document.getElementById('imageLightboxImg');
  if (!boxEl || !imgEl) return;

  // Open original-quality image from the detail modal poster
  const modalPoster = document.getElementById('modalPoster');
  if (modalPoster) {
    modalPoster.addEventListener('click', () => {
      const orig = modalPoster.getAttribute('data-original-src') || modalPoster.src;
      const titleEl = document.getElementById('modalTitle');
      openPosterLightbox(orig || modalPoster.src, (titleEl && titleEl.textContent) || 'Ảnh chất lượng gốc');
    });
  }

  document.getElementById('imageLightboxClose').addEventListener('click', closePosterLightbox);
  document.getElementById('imageLightboxBackdrop').addEventListener('click', closePosterLightbox);
  document.getElementById('imageLightboxZoomIn').addEventListener('click', () => zoomLightboxAt(window.innerWidth / 2, window.innerHeight / 2, 1.4));
  document.getElementById('imageLightboxZoomOut').addEventListener('click', () => zoomLightboxAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.4));
  document.getElementById('imageLightboxReset').addEventListener('click', fitLightboxImage);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && boxEl.classList.contains('open')) closePosterLightbox();
  });

  // Desktop: wheel zoom at cursor
  imgEl.addEventListener('wheel', e => {
    e.preventDefault();
    zoomLightboxAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  // Unified drag-pan + pinch-zoom via pointer events
  imgEl.addEventListener('pointerdown', e => {
    try { imgEl.setPointerCapture(e.pointerId); } catch (_) {}
    lbPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lbDragMoved = false;
    if (lbPointers.size === 2) {
      const p = [...lbPointers.values()];
      lbPinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }
    imgEl.classList.add('dragging');
  });
  imgEl.addEventListener('pointermove', e => {
    if (!lbPointers.has(e.pointerId)) return;
    const prev = lbPointers.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    lbPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.abs(dx) + Math.abs(dy) > 2) lbDragMoved = true;
    if (lbPointers.size === 2) {
      const p = [...lbPointers.values()];
      const dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (lbPinchDist > 0 && dist > 0) {
        zoomLightboxAt((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2, dist / lbPinchDist);
      }
      lbPinchDist = dist;
    } else if (lbPointers.size === 1 && lightboxState.scale > lightboxState.minScale + 0.001) {
      lightboxState.x += dx;
      lightboxState.y += dy;
      clampLightboxPan();
      applyLightboxTransform();
    }
  });
  const endLbPointer = e => {
    lbPointers.delete(e.pointerId);
    if (lbPointers.size < 2) lbPinchDist = 0;
    if (lbPointers.size === 0) imgEl.classList.remove('dragging');
  };
  imgEl.addEventListener('pointerup', endLbPointer);
  imgEl.addEventListener('pointercancel', endLbPointer);

  // Double-tap / double-click toggles zoom
  imgEl.addEventListener('click', e => {
    const now = Date.now();
    if (now - lbLastTap < 300 && !lbDragMoved) {
      if (lightboxState.scale > lightboxState.minScale + 0.001) fitLightboxImage();
      else zoomLightboxAt(e.clientX, e.clientY, 2.5);
    }
    lbLastTap = now;
    lbDragMoved = false;
  });

  window.addEventListener('resize', () => {
    if (boxEl.classList.contains('open')) fitLightboxImage();
  });
}

function switchModalTab(tabId) {
  document.querySelectorAll('#detailModal .modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('#detailModal .tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

// Requirement 3: Watch Link Buttons with REAL WEBSITE FAVICONS
function populateWatchLinks(show) {
  const vietsubContainer = document.getElementById('modalVietsubLinks');
  const originalContainer = document.getElementById('modalOriginalLinks');
  const chineseGroup = document.getElementById('modalChineseGroup');

  if (vietsubContainer) vietsubContainer.innerHTML = '';
  if (originalContainer) originalContainer.innerHTML = '';

  let vietsubList = [];
  if (Array.isArray(show.vietnameseWatchUrls) && show.vietnameseWatchUrls.length > 0) {
    vietsubList = show.vietnameseWatchUrls;
  } else if (show.vietnameseWatchUrl) {
    vietsubList = [{ url: show.vietnameseWatchUrl, label: 'Nguồn Vietsub chính' }];
  }

  if (vietsubList.length > 0) {
    vietsubList.forEach(item => {
      const btn = createWatchLinkButton(item.url, item.label || 'Xem Vietsub', item.episodes);
      if (vietsubContainer) vietsubContainer.appendChild(btn);
    });
  } else {
    if (vietsubContainer) {
      vietsubContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">Chưa có link Vietsub. Bạn có thể xem bản gốc bên dưới.</div>`;
    }
  }

  let originalList = [];
  if (Array.isArray(show.chineseWatchUrls) && show.chineseWatchUrls.length > 0) {
    originalList = show.chineseWatchUrls;
  } else if (show.chineseWatchUrl) {
    originalList = [{ url: show.chineseWatchUrl, label: 'Nơi chiếu bản gốc' }];
  }

  if (originalList.length > 0) {
    if (chineseGroup) chineseGroup.style.display = 'block';
    originalList.forEach(item => {
      const btn = createWatchLinkButton(item.url, item.label || 'Xem bản gốc', item.episodes);
      if (originalContainer) originalContainer.appendChild(btn);
    });
  } else {
    if (chineseGroup) chineseGroup.style.display = 'none';
  }
}

function createWatchLinkButton(url, label, episodes) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'watch-link-btn';
  a.setAttribute('data-full-label', label || 'Xem Vietsub');

  const faviconHtml = getWebsiteFaviconHtml(url, label);
  const eps = Array.isArray(episodes) ? episodes.filter(e => e && e.url) : [];
  const hasEps = eps.length > 0;
  if (hasEps) a.classList.add('has-episodes');

  a.innerHTML = `
    <span class="watch-link-label">
      ${faviconHtml}
      <span>${escapeHtml(label)}</span>
    </span>
    <span class="watch-link-side">
      ${hasEps ? `<span class="watch-ep-badge">${eps.length} tập</span>` : ''}
      <i class="fa-solid ${hasEps ? 'fa-list-ol' : 'fa-arrow-up-right-from-square'}" style="color: var(--text-muted); font-size: 11px;"></i>
    </span>
  `;

  if (hasEps) {
    a.addEventListener('click', e => {
      e.preventDefault();
      const titleEl = document.getElementById('modalTitle');
      openEpisodePicker(titleEl ? titleEl.textContent : '', label || 'Xem Vietsub', eps);
    });
  }

  return a;
}

// ============================================================
// WATCH-LINK TOOLTIP: full label on desktop hover / mobile long-press
// (only when the label is actually truncated)
// ============================================================
let linkTipEl = null;
let linkTipForBtn = null;
let linkTipHideTimer = null;
const linkTipCanHover = window.matchMedia('(hover: hover)').matches;

function getLinkTipEl() {
  if (!linkTipEl) {
    linkTipEl = document.createElement('div');
    linkTipEl.className = 'link-tip-popup';
    linkTipEl.style.display = 'none';
    document.body.appendChild(linkTipEl);
  }
  return linkTipEl;
}

function showLinkTip(text, x, y, autoHideMs) {
  if (!text) return;
  const el = getLinkTipEl();
  el.textContent = text;
  el.style.display = 'block';
  const pad = 10;
  const r = el.getBoundingClientRect();
  const left = Math.min(Math.max(pad, x - r.width / 2), Math.max(pad, window.innerWidth - r.width - pad));
  let top = y - r.height - 12;
  if (top < pad) top = y + 18;
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  clearTimeout(linkTipHideTimer);
  if (autoHideMs > 0) linkTipHideTimer = setTimeout(hideLinkTip, autoHideMs);
}

function hideLinkTip() {
  clearTimeout(linkTipHideTimer);
  linkTipForBtn = null;
  if (linkTipEl) linkTipEl.style.display = 'none';
}

function isWatchLabelTruncated(btn) {
  const textEl = btn.querySelector('.watch-link-label > span:last-child');
  return !!textEl && textEl.scrollWidth > textEl.clientWidth + 1;
}

function initWatchLinkTips() {
  if (initWatchLinkTips.done) return;
  initWatchLinkTips.done = true;

  // Desktop: hover shows full label
  if (linkTipCanHover) {
    document.addEventListener('mouseover', e => {
      const btn = e.target && e.target.closest ? e.target.closest('.watch-link-btn') : null;
      if (!btn || btn === linkTipForBtn || !isWatchLabelTruncated(btn)) return;
      linkTipForBtn = btn;
      const textEl = btn.querySelector('.watch-link-label > span:last-child');
      const r = btn.getBoundingClientRect();
      showLinkTip(btn.dataset.fullLabel || (textEl ? textEl.textContent : ''), r.left + r.width / 2, r.top, 0);
    });
    document.addEventListener('mouseout', e => {
      const btn = e.target && e.target.closest ? e.target.closest('.watch-link-btn') : null;
      if (btn && btn === linkTipForBtn && !(e.relatedTarget && btn.contains(e.relatedTarget))) {
        hideLinkTip();
      }
    });
  }

  // Mobile: long-press (~550ms without moving) shows popup, tap still opens link
  let lpTimer = null, lpBtn = null, lpX = 0, lpY = 0, suppressClick = false;
  document.addEventListener('touchstart', e => {
    hideLinkTip();
    clearTimeout(lpTimer);
    lpBtn = null;
    const btn = e.target && e.target.closest ? e.target.closest('.watch-link-btn') : null;
    if (!btn || !e.touches[0]) return;
    lpBtn = btn;
    lpX = e.touches[0].clientX;
    lpY = e.touches[0].clientY;
    lpTimer = setTimeout(() => {
      if (!isWatchLabelTruncated(btn)) return;
      const textEl = btn.querySelector('.watch-link-label > span:last-child');
      showLinkTip(btn.dataset.fullLabel || (textEl ? textEl.textContent : ''), lpX, lpY, 5000);
      suppressClick = true;
      if (navigator.vibrate) { try { navigator.vibrate(25); } catch (_) {} }
    }, 550);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!lpBtn || !e.touches[0]) return;
    if (Math.abs(e.touches[0].clientX - lpX) > 10 || Math.abs(e.touches[0].clientY - lpY) > 10) {
      clearTimeout(lpTimer);
      lpBtn = null;
    }
  }, { passive: true });
  const cancelLongPress = () => { clearTimeout(lpTimer); lpBtn = null; };
  document.addEventListener('touchend', cancelLongPress, { passive: true });
  document.addEventListener('touchcancel', cancelLongPress, { passive: true });
  // A long-press must not open the link on finger release
  document.addEventListener('click', e => {
    if (!suppressClick) return;
    suppressClick = false;
    const btn = e.target && e.target.closest ? e.target.closest('.watch-link-btn') : null;
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  // Block native long-press menu on link cards so our popup shows instead
  document.addEventListener('contextmenu', e => {
    const btn = e.target && e.target.closest ? e.target.closest('.watch-link-btn') : null;
    if (btn) e.preventDefault();
  });
  window.addEventListener('scroll', () => {
    if (linkTipEl && linkTipEl.style.display !== 'none') hideLinkTip();
  }, true);
}

function populateCastMembers(detailNotes) {
  const container = document.getElementById('modalCastGrid');
  if (!container) return;
  container.innerHTML = '';

  if (!detailNotes || !detailNotes.trim()) {
    container.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">Chưa có thông tin dàn cast cho chương trình này.</div>`;
    return;
  }

  const lines = detailNotes.split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach(line => {
    const card = document.createElement('div');
    const isFemale = line.toLowerCase().startsWith('nữ');
    const isMale = line.toLowerCase().startsWith('nam');

    card.className = `cast-card ${isFemale ? 'cast-gender-female' : isMale ? 'cast-gender-male' : ''}`;

    const titlePart = line.split('|')[0].trim();
    const infoPart = line.includes('|') ? line.substring(line.indexOf('|') + 1).trim() : '';

    card.innerHTML = `
      <div class="cast-name">${escapeHtml(titlePart)}</div>
      ${infoPart ? `<div class="cast-info">${escapeHtml(infoPart)}</div>` : ''}
    `;

    container.appendChild(card);
  });
}

function copyShareLink(show, e) {
  if (e) e.stopPropagation();
  const slug = slugify(show.vietnamese);
  const shareUrl = `${window.location.origin}${window.location.pathname}#show=${slug}`;
  copyText(shareUrl, 'link chia sẻ show');
}

function checkUrlHash() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#show=')) return;

  const targetSlug = hash.replace('#show=', '').trim();
  const matchedShow = state.shows.find(s => slugify(s.vietnamese) === targetSlug);

  if (matchedShow) {
    setTimeout(() => openShowDetail(matchedShow), 300);
  }
}

function pickRandomShow() {
  if (state.shows.length === 0) return;
  const randomIndex = Math.floor(Math.random() * state.shows.length);
  const show = state.shows[randomIndex];
  showToast(`Khám phá ngẫu nhiên: "${show.vietnamese}" 🎲`, 'fa-dice');
  const btn = document.getElementById('btnRandomShow');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!btn || reduceMotion) {
    openShowDetail(show);
    return;
  }
  // Let the dice tumble first, then reveal the show
  btn.classList.remove('dice-rolling');
  void btn.offsetWidth;
  btn.classList.add('dice-rolling');
  setTimeout(() => {
    btn.classList.remove('dice-rolling');
    openShowDetail(show);
  }, 450);
}

// ============================================================
// SETTINGS: SORTED A-Z, DYNAMIC MULTI-LINKS & EXPAND EDITOR (REQUIREMENTS 4 & 5)
// ============================================================
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  stagedSpotlightSlugs = [...state.spotlightSlugs];
  populateSettingsSelects();
  renderStagedPins();
  freezeModalHeight(modal);
  modal.classList.add('active');
  lockPageScroll();
  focusModalEntry(modal);
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  unfreezeModalHeight(modal);
  modal.classList.remove('active');
  unlockPageScroll();
  restoreFocusAfterModal();
}

function switchSettingsTab(tabId) {
  document.querySelectorAll('#settingsModal .modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.stab === tabId);
  });
  document.querySelectorAll('#settingsModal .tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

// Requirement 4: Populates list sorted alphabetically A-Z by Vietnamese title
// Full display name: Vietnamese • English • Original (used in settings search lists)
function showFullNameLabel(s) {
  return [s.vietnamese, s.english, s.chinese].filter(Boolean).join(' • ');
}

function getAlphabeticalShows(filterKeyword = '') {
  let list = state.shows.map((s, idx) => ({ ...s, _idx: idx }));
  list.sort((a, b) => (a.vietnamese || '').localeCompare(b.vietnamese || '', 'vi'));

  if (filterKeyword) {
    const norm = removeVietnameseAccents(filterKeyword);
    list = list.filter(s =>
      removeVietnameseAccents(s.vietnamese).includes(norm) ||
      removeVietnameseAccents(s.chinese).includes(norm) ||
      removeVietnameseAccents(s.english).includes(norm)
    );
  }
  return list;
}

function populateSettingsSelects() {
  const spotlightSelect = document.getElementById('spotlightSelect');
  const editSelect = document.getElementById('editShowSelect');

  const spotlightKeyword = document.getElementById('spotlightSearchInput')?.value || '';
  const editKeyword = document.getElementById('editSearchInput')?.value || '';

  if (spotlightSelect) {
    spotlightSelect.innerHTML = '';
    const sorted = getAlphabeticalShows(spotlightKeyword);
    sorted.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = showFullNameLabel(s);
      spotlightSelect.appendChild(opt);
    });
  }

  if (editSelect) {
    editSelect.innerHTML = '';
    const sorted = getAlphabeticalShows(editKeyword);
    sorted.forEach((s, i) => {
      const opt = document.createElement('option');
      opt.value = s._idx;
      opt.textContent = showFullNameLabel(s);
      if (i === 0) opt.selected = true;
      editSelect.appendChild(opt);
    });

    if (sorted.length > 0) {
      loadShowToEditForm(sorted[0]._idx);
    }
  }
}

// Requirement 5: Dynamic Link Row Builder for Multiple Watch Links
// Two lines per link: link info (label) + show link (URL), plus per-link episode links
function createDynamicLinkRow(label = '', url = '', episodes = []) {
  const row = document.createElement('div');
  row.className = 'link-editor-row';
  row._episodes = Array.isArray(episodes)
    ? episodes.filter(e => e && e.url).map(e => ({ ep: String(e.ep ?? ''), url: String(e.url) }))
    : [];
  row.innerHTML = `
    <span class="link-editor-caption">Thông tin link</span>
    <div class="link-editor-row-top">
      <input type="text" class="settings-input link-label-input" placeholder="Tên nguồn (VD: Bilibili 720p)" value="${escapeHtml(label)}">
      <button type="button" class="btn-pin-move btn-move-up" title="Chuyển link lên trên"><i class="fa-solid fa-chevron-up"></i></button>
      <button type="button" class="btn-pin-move btn-move-down" title="Chuyển link xuống dưới"><i class="fa-solid fa-chevron-down"></i></button>
      <button type="button" class="btn-remove-row" title="Xóa link này"><i class="fa-solid fa-trash"></i></button>
    </div>
    <span class="link-editor-caption">Link show</span>
    <input type="text" class="settings-input link-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    <button type="button" class="btn-link-episodes" title="Gắn link theo tập cho link này"><i class="fa-solid fa-list-ol"></i> Link theo tập (<span class="ep-count">0</span>)</button>
  `;

  row.querySelector('.btn-remove-row').onclick = () => {
    const list = row.parentElement;
    row.remove();
    if (list) refreshLinkRowMoveButtons(list);
  };
  row.querySelector('.btn-link-episodes').onclick = () => openEpisodeEditor(row);
  row.querySelector('.btn-move-up').onclick = () => moveLinkRow(row, -1);
  row.querySelector('.btn-move-down').onclick = () => moveLinkRow(row, 1);
  updateEpCountBadge(row);
  return row;
}

function updateEpCountBadge(row) {
  const badge = row.querySelector('.ep-count');
  if (badge) badge.textContent = (row._episodes || []).length;
}

// Reorder link rows inside the edit/add forms (save order = display order)
function moveLinkRow(row, dir) {
  if (!row || !row.parentElement) return;
  const sibling = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
  if (sibling && sibling.classList.contains('link-editor-row')) {
    if (dir < 0) sibling.before(row);
    else sibling.after(row);
  }
  refreshLinkRowMoveButtons(row.parentElement);
}

function refreshLinkRowMoveButtons(container) {
  if (!container) return;
  const rows = [...container.querySelectorAll('.link-editor-row')];
  rows.forEach((r, i) => {
    const up = r.querySelector('.btn-move-up');
    const down = r.querySelector('.btn-move-down');
    if (up) up.disabled = i === 0;
    if (down) down.disabled = i === rows.length - 1;
  });
}

// Genre checkboxes helpers (edit/add forms). Defaults to ['normal'] when none checked.
function getCheckedTags(groupId) {
  const checked = [...document.querySelectorAll(`#${groupId} input[type="checkbox"]:checked`)].map(cb => cb.value);
  return checked.length > 0 ? checked : ['normal'];
}

function setCheckedTags(groupId, tags) {
  const list = Array.isArray(tags) && tags.length > 0 ? tags : ['normal'];
  document.querySelectorAll(`#${groupId} input[type="checkbox"]`).forEach(cb => {
    cb.checked = list.includes(cb.value);
  });
}

function loadShowToEditForm(index) {
  const show = state.shows[index];
  if (!show) return;

  document.getElementById('editVn').value = show.vietnamese || '';
  document.getElementById('editZh').value = show.chinese || '';
  document.getElementById('editEn').value = show.english || '';
  document.getElementById('editCountry').value = show.country || 'china';
  document.getElementById('editStatus').value = show.status || 'airing';
  document.getElementById('editPlatform').value = show.platform || '';
  document.getElementById('editTime').value = show.time || '';
  document.getElementById('editRating').value = show.rating || 5;
  document.getElementById('editImage').value = show.image || '';
  document.getElementById('editYear').value = show.year || '';
  setCheckedTags('editTagGroup', show.tags);

  // Multiple Vietsub Links
  const vietsubListEl = document.getElementById('editVietsubLinksList');
  if (vietsubListEl) {
    vietsubListEl.innerHTML = '';
    const links = Array.isArray(show.vietnameseWatchUrls) && show.vietnameseWatchUrls.length > 0
      ? show.vietnameseWatchUrls
      : (show.vietnameseWatchUrl ? [{ label: 'Nguồn Vietsub', url: show.vietnameseWatchUrl }] : []);

    links.forEach(l => vietsubListEl.appendChild(createDynamicLinkRow(l.label, l.url, l.episodes)));
    if (links.length === 0) vietsubListEl.appendChild(createDynamicLinkRow('Nguồn Vietsub', ''));
  }

  // Multiple Original Links
  const originalListEl = document.getElementById('editOriginalLinksList');
  if (originalListEl) {
    originalListEl.innerHTML = '';
    const origLinks = Array.isArray(show.chineseWatchUrls) && show.chineseWatchUrls.length > 0
      ? show.chineseWatchUrls
      : (show.chineseWatchUrl ? [{ label: 'Nơi chiếu bản gốc', url: show.chineseWatchUrl }] : []);

    origLinks.forEach(l => originalListEl.appendChild(createDynamicLinkRow(l.label, l.url, l.episodes)));
  }

  document.getElementById('editCast').value = show.detailNotes || '';
  document.getElementById('editDesc').value = show.description || '';
}

function collectDynamicLinks(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  const rows = container.querySelectorAll('.link-editor-row');
  const result = [];
  rows.forEach(r => {
    const label = r.querySelector('.link-label-input')?.value.trim() || 'Link xem';
    const url = r.querySelector('.link-url-input')?.value.trim() || '';
    if (url) {
      const entry = { label, url };
      const eps = Array.isArray(r._episodes) ? r._episodes.filter(e => e && e.url) : [];
      if (eps.length > 0) entry.episodes = eps;
      result.push(entry);
    }
  });
  return result;
}

// ============================================================
// EPISODE LINKS: per-link episode manager (edit form) + picker (detail)
// ============================================================
let episodeEditingRow = null;
let episodeDraft = [];

function sortEpisodes(list) {
  list.sort((a, b) => {
    const na = parseFloat(a.ep), nb = parseFloat(b.ep);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return String(a.ep).localeCompare(String(b.ep), 'vi');
  });
}

function openEpisodeEditor(row) {
  episodeEditingRow = row;
  episodeDraft = (row._episodes || []).map(e => ({ ep: e.ep, url: e.url }));
  sortEpisodes(episodeDraft);
  const labelInput = row.querySelector('.link-label-input');
  const nameEl = document.getElementById('episodeEditorLinkName');
  if (nameEl) nameEl.textContent = 'Link: ' + ((labelInput && labelInput.value.trim()) || 'Link xem');
  renderEpisodeDraft();
  const modal = document.getElementById('episodeEditorModal');
  if (modal) {
    modal.classList.add('active');
    lockPageScroll();
  }
}

function closeEpisodeEditor(save) {
  if (save && episodeEditingRow) {
    episodeEditingRow._episodes = episodeDraft;
    updateEpCountBadge(episodeEditingRow);
  }
  episodeEditingRow = null;
  episodeDraft = [];
  const modal = document.getElementById('episodeEditorModal');
  if (modal) modal.classList.remove('active');
  const detailModal = document.getElementById('detailModal');
  const settingsModal = document.getElementById('settingsModal');
  if ((!detailModal || !detailModal.classList.contains('active')) &&
      (!settingsModal || !settingsModal.classList.contains('active'))) {
    unlockPageScroll();
  }
}

function renderEpisodeDraft() {
  const box = document.getElementById('episodeEditorList');
  if (!box) return;
  if (episodeDraft.length === 0) {
    box.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">Chưa có tập nào. Thêm tập bên dưới.</div>`;
    return;
  }
  box.innerHTML = '';
  episodeDraft.forEach((e, i) => {
    const div = document.createElement('div');
    div.className = 'episode-editor-item';
    div.innerHTML = `
      <span class="episode-editor-ep">Tập ${escapeHtml(e.ep)}</span>
      <span class="episode-editor-url">${escapeHtml(e.url)}</span>
      <button type="button" class="btn-remove-row btn-ep-del" title="Xóa tập này"><i class="fa-solid fa-xmark"></i></button>
    `;
    div.querySelector('.btn-ep-del').onclick = () => {
      episodeDraft.splice(i, 1);
      renderEpisodeDraft();
    };
    box.appendChild(div);
  });
}

function addEpisodeFromInputs() {
  const epInput = document.getElementById('episodeEpInput');
  const urlInput = document.getElementById('episodeUrlInput');
  if (!epInput || !urlInput) return;
  const ep = (epInput.value || '').trim();
  let url = (urlInput.value || '').trim();
  if (!ep) {
    showToast('Nhập số tập trước.', 'fa-circle-info');
    epInput.focus();
    return;
  }
  if (!url) {
    showToast('Nhập link tập phim.', 'fa-circle-info');
    urlInput.focus();
    return;
  }
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url;
  episodeDraft = episodeDraft.filter(e => e.ep !== ep);
  episodeDraft.push({ ep, url });
  sortEpisodes(episodeDraft);
  epInput.value = '';
  urlInput.value = '';
  epInput.focus();
  renderEpisodeDraft();
}

function openEpisodePicker(showName, label, episodes) {
  const modal = document.getElementById('episodePickerModal');
  if (!modal) return;
  const titleEl = document.getElementById('episodePickerTitle');
  const subEl = document.getElementById('episodePickerSub');
  const grid = document.getElementById('episodePickerGrid');
  if (titleEl) titleEl.textContent = 'Chọn tập phim';
  if (subEl) subEl.textContent = `${showName} — ${label}`;
  if (grid) {
    grid.innerHTML = '';
    const sorted = [...episodes];
    sortEpisodes(sorted);
    sorted.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'episode-pick-btn';
      b.textContent = `Tập ${e.ep}`;
      b.onclick = () => window.open(e.url, '_blank', 'noopener');
      grid.appendChild(b);
    });
  }
  modal.classList.add('active');
}

function closeEpisodePicker() {
  const modal = document.getElementById('episodePickerModal');
  if (modal) modal.classList.remove('active');
}

function saveEditedShow() {
  const editSelect = document.getElementById('editShowSelect');
  const idx = parseInt(editSelect.value, 10);
  if (isNaN(idx) || !state.shows[idx]) return;

  const show = state.shows[idx];
  show.vietnamese = document.getElementById('editVn').value.trim();
  show.chinese = document.getElementById('editZh').value.trim();
  show.english = document.getElementById('editEn').value.trim();
  show.country = document.getElementById('editCountry').value;
  show.status = document.getElementById('editStatus').value;
  show.platform = document.getElementById('editPlatform').value.trim();
  show.time = document.getElementById('editTime').value.trim();
  show.rating = parseFloat(document.getElementById('editRating').value) || 5;
  show.image = document.getElementById('editImage').value.trim();
  show.year = document.getElementById('editYear').value.trim() || show.year;
  show.tags = getCheckedTags('editTagGroup');

  // Save multiple links (Requirement 5)
  const vLinks = collectDynamicLinks('editVietsubLinksList');
  show.vietnameseWatchUrls = vLinks;
  show.vietnameseWatchUrl = vLinks.length > 0 ? vLinks[0].url : '';

  const oLinks = collectDynamicLinks('editOriginalLinksList');
  show.chineseWatchUrls = oLinks;
  show.chineseWatchUrl = oLinks.length > 0 ? oLinks[0].url : '';

  show.detailNotes = document.getElementById('editCast').value;
  show.description = document.getElementById('editDesc').value;

  saveShowsToLocalStorage();
  applyFilters();
  populatePlatformDropdown();
  populateYearDropdown();
  setupSpotlightShow();
  showToast(`Đã lưu thay đổi cho show "${show.vietnamese}"!`, 'fa-floppy-disk');
}

function addNewShow() {
  const vn = document.getElementById('addVn').value.trim();
  if (!vn) {
    alert('Vui lòng nhập Tên tiếng Việt cho show!');
    return;
  }

  const vLinks = collectDynamicLinks('addVietsubLinksList');
  const oLinks = collectDynamicLinks('addOriginalLinksList');

  const newShow = {
    vietnamese: vn,
    chinese: document.getElementById('addZh').value.trim(),
    english: document.getElementById('addEn').value.trim(),
    country: document.getElementById('addCountry').value,
    status: document.getElementById('addStatus').value,
    platform: document.getElementById('addPlatform').value.trim() || 'Online',
    time: document.getElementById('addTime').value.trim(),
    rating: parseFloat(document.getElementById('addRating').value) || 5,
    year: document.getElementById('addYear').value.trim() || new Date().getFullYear().toString(),
    image: document.getElementById('addImage').value.trim(),
    vietnameseWatchUrls: vLinks,
    vietnameseWatchUrl: vLinks.length > 0 ? vLinks[0].url : '',
    chineseWatchUrls: oLinks,
    chineseWatchUrl: oLinks.length > 0 ? oLinks[0].url : '',
    detailNotes: document.getElementById('addCast').value,
    description: document.getElementById('addDesc').value,
    tags: getCheckedTags('addTagGroup'),
    _origIndex: state.shows.length
  };

  state.shows.unshift(newShow);
  ensureShowIds();
  saveShowsToLocalStorage();
  updateHeroStats();
  applyFilters();
  populatePlatformDropdown();
  populateYearDropdown();
  populateSettingsSelects();

  showToast(`Đã thêm show mới: "${newShow.vietnamese}"!`, 'fa-plus');

  // Reset form
  document.getElementById('addVn').value = '';
  document.getElementById('addZh').value = '';
  document.getElementById('addEn').value = '';
  document.getElementById('addImage').value = '';
  document.getElementById('addCast').value = '';
  document.getElementById('addDesc').value = '';
  document.getElementById('addVietsubLinksList').innerHTML = '';
  document.getElementById('addOriginalLinksList').innerHTML = '';
  setCheckedTags('addTagGroup', ['normal']);

  closeSettingsModal();
}

// Requirement 5: Large Text Editor Modal for Details & Cast
function openLargeEditor(targetId, title) {
  state.activeEditorTargetId = targetId;
  const targetEl = document.getElementById(targetId);
  const editorModal = document.getElementById('largeEditorModal');
  const editorTextarea = document.getElementById('largeEditorTextarea');
  const editorTitle = document.getElementById('largeEditorTitle');

  if (!targetEl || !editorModal || !editorTextarea) return;

  editorTitle.textContent = title || 'Chỉnh sửa văn bản chi tiết';
  editorTextarea.value = targetEl.value;

  editorModal.classList.add('active');
  editorTextarea.focus();
}

function applyLargeEditor() {
  if (state.activeEditorTargetId) {
    const targetEl = document.getElementById(state.activeEditorTargetId);
    const editorTextarea = document.getElementById('largeEditorTextarea');
    if (targetEl && editorTextarea) {
      targetEl.value = editorTextarea.value;
    }
  }
  closeLargeEditor();
}

function closeLargeEditor() {
  const editorModal = document.getElementById('largeEditorModal');
  if (editorModal) editorModal.classList.remove('active');
  state.activeEditorTargetId = null;
}

function downloadUpdatedJson() {
  const cleanData = state.shows.map(s => {
    const clone = { ...s };
    delete clone._origIndex;
    delete clone._idx;
    return clone;
  });

  const blob = new Blob([JSON.stringify(cleanData, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'showsData.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã tải xuống file showsData.json mới!', 'fa-download');
}

function resetDataToDefault() {
  if (confirm('Bạn có chắc muốn khôi phục về dữ liệu gốc? Tất cả các show đã sửa/thêm cục bộ sẽ bị đặt lại.')) {
    localStorage.removeItem('datinghub_local_shows');
    localStorage.removeItem('datinghub_spotlight');
    state.spotlightSlugs = [];
    loadShowsData();
    showToast('Đã khôi phục dữ liệu ban đầu', 'fa-rotate-left');
  }
}

// ============================================================
// EVENT LISTENERS INITIALIZATION
// ============================================================
function initEventListeners() {
  const brandLogo = document.getElementById('brandLogo');
  if (brandLogo) {
    brandLogo.addEventListener('click', () => {
      resetAllFilters();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Desktop Search (debounced: avoid re-render on every keystroke)
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const debouncedApplyFilters = debounce(() => applyFilters(), 250);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.trim();
      const mobInput = document.getElementById('mobileSearchInput');
      if (mobInput) mobInput.value = state.filters.search;
      if (searchClearBtn) searchClearBtn.classList.toggle('active', state.filters.search.length > 0);
      debouncedApplyFilters();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      const mobInput = document.getElementById('mobileSearchInput');
      if (mobInput) mobInput.value = '';
      state.filters.search = '';
      searchClearBtn.classList.remove('active');
      applyFilters();
      searchInput.focus();
    });
  }

  // Requirement 1: Mobile Search Bar Input
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchClearBtn = document.getElementById('mobileSearchClearBtn');

  if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.trim();
      if (searchInput) searchInput.value = state.filters.search;
      if (mobileSearchClearBtn) mobileSearchClearBtn.classList.toggle('active', state.filters.search.length > 0);
      debouncedApplyFilters();
    });
  }

  if (mobileSearchClearBtn) {
    mobileSearchClearBtn.addEventListener('click', () => {
      if (mobileSearchInput) mobileSearchInput.value = '';
      if (searchInput) searchInput.value = '';
      state.filters.search = '';
      mobileSearchClearBtn.classList.remove('active');
      applyFilters();
      mobileSearchInput.focus();
    });
  }

  // Mobile Filter Accordion Toggle
  const btnMobileFilterToggle = document.getElementById('btnMobileFilterToggle');
  const filterRowControls = document.getElementById('filterRowControls');
  if (btnMobileFilterToggle && filterRowControls) {
    btnMobileFilterToggle.addEventListener('click', () => {
      filterRowControls.classList.toggle('expanded');
      btnMobileFilterToggle.classList.toggle('active');
    });
  }

  // Country Selects (desktop dropdown + mobile accordion select, kept in sync)
  const countrySelect = document.getElementById('countrySelect');
  const mobileCountrySelect = document.getElementById('mobileCountrySelect');
  const syncCountrySelects = (value, except) => {
    if (countrySelect && countrySelect !== except) countrySelect.value = value;
    if (mobileCountrySelect && mobileCountrySelect !== except) mobileCountrySelect.value = value;
  };
  if (countrySelect) {
    countrySelect.addEventListener('change', (e) => {
      state.filters.country = e.target.value;
      syncCountrySelects(state.filters.country, countrySelect);
      applyFilters();
    });
  }
  if (mobileCountrySelect) {
    mobileCountrySelect.addEventListener('change', (e) => {
      state.filters.country = e.target.value;
      syncCountrySelects(state.filters.country, mobileCountrySelect);
      applyFilters();
    });
  }

  // Status Pills
  document.querySelectorAll('.btn-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.btn-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.status = pill.dataset.status;
      applyFilters();
    });
  });

  // Select Filters
  const platformSelect = document.getElementById('platformSelect');
  if (platformSelect) {
    platformSelect.addEventListener('change', (e) => {
      state.filters.platform = e.target.value;
      applyFilters();
    });
  }

  const tagSelect = document.getElementById('tagSelect');
  if (tagSelect) {
    tagSelect.addEventListener('change', (e) => {
      state.filters.tag = e.target.value;
      applyFilters();
    });
  }

  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    yearSelect.addEventListener('change', (e) => {
      state.filters.year = e.target.value;
      applyFilters();
    });
  }

  // Sort Select
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      applyFilters();
    });
  }

  // View Mode Toggles
  const btnViewGrid = document.getElementById('btnViewGrid');
  const btnViewList = document.getElementById('btnViewList');

  if (btnViewGrid && btnViewList) {
    // Restore saved view mode (grid/list) from previous visit
    let savedView = 'grid';
    try {
      savedView = localStorage.getItem('datinghub_viewmode') || 'grid';
    } catch (e) {}
    if (savedView !== 'list') savedView = 'grid';
    state.viewMode = savedView;
    btnViewGrid.classList.toggle('active', savedView === 'grid');
    btnViewList.classList.toggle('active', savedView === 'list');

    const saveViewMode = mode => {
      try { localStorage.setItem('datinghub_viewmode', mode); } catch (e) {}
    };

    btnViewGrid.addEventListener('click', () => {
      state.viewMode = 'grid';
      btnViewGrid.classList.add('active');
      btnViewList.classList.remove('active');
      saveViewMode('grid');
      renderShows();
    });

    btnViewList.addEventListener('click', () => {
      state.viewMode = 'list';
      btnViewList.classList.add('active');
      btnViewGrid.classList.remove('active');
      saveViewMode('list');
      renderShows();
    });
  }

  const randomBtn = document.getElementById('btnRandomShow');
  if (randomBtn) randomBtn.addEventListener('click', pickRandomShow);

  const resetBtn = document.getElementById('btnResetFilters');
  if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);

  const emptyResetBtn = document.getElementById('btnEmptyReset');
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

  // Unified rAF-throttled scroll handler (perf: zero layout reads per scroll
  // event, cached metrics, DOM touched only on state change).
  // Header + filter bar are always visible (no auto-hide); this only toggles
  // the back-to-top button.
  const btnBackToTop = document.getElementById('btnBackToTop');
  let backToTopShown = false;
  let scrollTicking = false;

  function handleScrollFrame() {
    scrollTicking = false;
    const currentY = window.scrollY;

    if (btnBackToTop) {
      const shouldShow = currentY > 300;
      if (shouldShow !== backToTopShown) {
        backToTopShown = shouldShow;
        btnBackToTop.classList.toggle('show', shouldShow);
      }
    }
  }

  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(handleScrollFrame);
    }
  }, { passive: true });
  if (btnBackToTop) {
    btnBackToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Watch-link tooltip: full label on hover (desktop) / long-press (mobile)
  initWatchLinkTips();

  // A11y: trap Tab focus inside open modals
  initModalFocusTrap();

  // Hover preload: warm the 600px modal poster into cache while the user is
  // still deciding, so opening never decodes mid-morph (once per photo).
  const warmedPosters = new Set();
  document.addEventListener('mouseover', e => {
    const img = e.target && e.target.closest
      ? e.target.closest('.card-poster-img, .spotlight-poster, .list-item-poster')
      : null;
    if (!img) return;
    const orig = img.getAttribute('data-original-src');
    if (!orig || warmedPosters.has(orig)) return;
    warmedPosters.add(orig);
    const pre = new Image();
    pre.src = getProxiedImageUrl(orig, 600);
  }, { passive: true });

  // Mobile bottom-sheet: swipe down to dismiss
  initSheetSwipe();

  // Poster lightbox: original quality + zoom from detail modal
  initPosterLightbox();

  // Show hot carousel (prev/next arrows, dots, pause on hover)
  initSpotlightCarousel();

  // Episode editor popup (edit form: episode number + link)
  const btnEpisodeAdd = document.getElementById('btnEpisodeAdd');
  if (btnEpisodeAdd) btnEpisodeAdd.addEventListener('click', addEpisodeFromInputs);
  const episodeEpInput = document.getElementById('episodeEpInput');
  const episodeUrlInput = document.getElementById('episodeUrlInput');
  [episodeEpInput, episodeUrlInput].forEach(inp => {
    if (inp) inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addEpisodeFromInputs();
      }
    });
  });
  const btnEpisodeEditorSave = document.getElementById('btnEpisodeEditorSave');
  if (btnEpisodeEditorSave) btnEpisodeEditorSave.addEventListener('click', () => closeEpisodeEditor(true));
  const btnEpisodeEditorCancel = document.getElementById('btnEpisodeEditorCancel');
  if (btnEpisodeEditorCancel) btnEpisodeEditorCancel.addEventListener('click', () => closeEpisodeEditor(false));
  const btnEpisodeEditorClose = document.getElementById('btnEpisodeEditorClose');
  if (btnEpisodeEditorClose) btnEpisodeEditorClose.addEventListener('click', () => closeEpisodeEditor(false));
  const episodeEditorModal = document.getElementById('episodeEditorModal');
  if (episodeEditorModal) episodeEditorModal.addEventListener('click', e => {
    if (e.target === episodeEditorModal) closeEpisodeEditor(false);
  });

  // Episode picker popup (show detail: choose episode, open its link)
  const btnEpisodePickerClose = document.getElementById('btnEpisodePickerClose');
  if (btnEpisodePickerClose) btnEpisodePickerClose.addEventListener('click', closeEpisodePicker);
  const episodePickerModal = document.getElementById('episodePickerModal');
  if (episodePickerModal) episodePickerModal.addEventListener('click', e => {
    if (e.target === episodePickerModal) closeEpisodePicker();
  });

  // Keep link-row move buttons correctly enabled/disabled (capture runs first)
  document.addEventListener('click', e => {
    const row = e.target && e.target.closest ? e.target.closest('.link-editor-row') : null;
    if (row && row.parentElement) refreshLinkRowMoveButtons(row.parentElement);
  }, true);

  // Show Detail Modal Close
  const modalCloseBtn = document.getElementById('btnModalClose');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeShowDetail);

  const modalOverlay = document.getElementById('detailModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeShowDetail();
    });
  }

  document.querySelectorAll('#detailModal .modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchModalTab(btn.dataset.tab));
  });

  const modalShareBtn = document.getElementById('btnModalShare');
  if (modalShareBtn) {
    modalShareBtn.addEventListener('click', () => {
      if (state.activeShow) copyShareLink(state.activeShow);
    });
  }

  const modalFavBtn = document.getElementById('btnModalFavorite');
  if (modalFavBtn) {
    modalFavBtn.addEventListener('click', () => {
      if (state.activeShow) toggleFavorite(state.activeShow);
    });
  }

  // Settings Modal Open/Close & Tabs
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  if (btnOpenSettings) btnOpenSettings.addEventListener('click', openSettingsModal);

  const btnSettingsClose = document.getElementById('btnSettingsClose');
  if (btnSettingsClose) btnSettingsClose.addEventListener('click', closeSettingsModal);

  const settingsModal = document.getElementById('settingsModal');
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) closeSettingsModal();
    });
  }

  document.querySelectorAll('#settingsModal .modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSettingsTab(btn.dataset.stab));
  });

  // Spotlight search & select
  const spotlightSearch = document.getElementById('spotlightSearchInput');
  if (spotlightSearch) {
    spotlightSearch.addEventListener('input', populateSettingsSelects);
  }

  const btnAddSpotlight = document.getElementById('btnAddSpotlight');
  if (btnAddSpotlight) {
    btnAddSpotlight.addEventListener('click', () => {
      const select = document.getElementById('spotlightSelect');
      const uid = select ? select.value : '';
      const show = findShowByPin(uid);
      if (!show) {
        showToast('Hãy chọn 1 show trong danh sách trước.', 'fa-circle-info');
        return;
      }
      const staged = getStagedPins();
      if (staged.includes(show.id)) {
        showToast('Show này đã được ghim rồi.', 'fa-circle-info');
        return;
      }
      if (staged.length >= MAX_PINNED_SHOWS) {
        showToast(`Chỉ ghim tối đa ${MAX_PINNED_SHOWS} show hot.`, 'fa-triangle-exclamation');
        return;
      }
      staged.push(show.id);
      renderStagedPins();
    });
  }

  const btnSaveSpotlight = document.getElementById('btnSaveSpotlight');
  if (btnSaveSpotlight) {
    btnSaveSpotlight.addEventListener('click', () => {
      const staged = getStagedPins().slice(0, MAX_PINNED_SHOWS);
      // Write pin order into the data so it can be published to every visitor
      state.shows.forEach(s => { delete s.hotOrder; });
      staged.forEach((uid, i) => {
        const show = findShowByPin(uid);
        if (show) show.hotOrder = i + 1;
      });
      state.spotlightSlugs = staged;
      savePinnedSpotlightSlugs();
      saveShowsToLocalStorage();
      stagedSpotlightSlugs = null;
      setupSpotlightShow();
      closeSettingsModal();
      showToast(staged.length > 0 ? `Đã ghim ${staged.length} show hot! 📌` : 'Đã bỏ ghim show hot.', 'fa-thumbtack');
    });
  }

  // Edit show search & select
  const editSearch = document.getElementById('editSearchInput');
  if (editSearch) {
    editSearch.addEventListener('input', populateSettingsSelects);
  }

  const editSelect = document.getElementById('editShowSelect');
  if (editSelect) {
    editSelect.addEventListener('change', (e) => {
      loadShowToEditForm(parseInt(e.target.value, 10));
    });
  }

  // Dynamic link add buttons (Requirement 5)
  const btnAddEditVietsubLink = document.getElementById('btnAddEditVietsubLink');
  if (btnAddEditVietsubLink) {
    btnAddEditVietsubLink.addEventListener('click', () => {
      const list = document.getElementById('editVietsubLinksList');
      if (list) list.appendChild(createDynamicLinkRow('Nguồn Vietsub', ''));
    });
  }

  const btnAddEditOriginalLink = document.getElementById('btnAddEditOriginalLink');
  if (btnAddEditOriginalLink) {
    btnAddEditOriginalLink.addEventListener('click', () => {
      const list = document.getElementById('editOriginalLinksList');
      if (list) list.appendChild(createDynamicLinkRow('Nơi chiếu bản gốc', ''));
    });
  }

  const btnAddAddVietsubLink = document.getElementById('btnAddAddVietsubLink');
  if (btnAddAddVietsubLink) {
    btnAddAddVietsubLink.addEventListener('click', () => {
      const list = document.getElementById('addVietsubLinksList');
      if (list) list.appendChild(createDynamicLinkRow('Nguồn Vietsub', ''));
    });
  }

  const btnAddAddOriginalLink = document.getElementById('btnAddAddOriginalLink');
  if (btnAddAddOriginalLink) {
    btnAddAddOriginalLink.addEventListener('click', () => {
      const list = document.getElementById('addOriginalLinksList');
      if (list) list.appendChild(createDynamicLinkRow('Nơi chiếu bản gốc', ''));
    });
  }

  // Expand textarea buttons (Requirement 5)
  document.getElementById('btnExpandEditCast')?.addEventListener('click', () => {
    openLargeEditor('editCast', 'Chỉnh sửa Dàn Cast & Diễn viên');
  });

  document.getElementById('btnExpandEditDesc')?.addEventListener('click', () => {
    openLargeEditor('editDesc', 'Chỉnh sửa Giới thiệu nội dung');
  });

  document.getElementById('btnExpandAddCast')?.addEventListener('click', () => {
    openLargeEditor('addCast', 'Nhập Dàn Cast & Diễn viên');
  });

  document.getElementById('btnExpandAddDesc')?.addEventListener('click', () => {
    openLargeEditor('addDesc', 'Nhập Giới thiệu nội dung');
  });

  // Large Editor actions
  document.getElementById('btnLargeEditorApply')?.addEventListener('click', applyLargeEditor);
  document.getElementById('btnLargeEditorCancel')?.addEventListener('click', closeLargeEditor);
  document.getElementById('btnLargeEditorClose')?.addEventListener('click', closeLargeEditor);

  // Settings Save Buttons
  document.getElementById('btnSaveEditedShow')?.addEventListener('click', saveEditedShow);
  document.getElementById('btnSubmitAddShow')?.addEventListener('click', addNewShow);
  document.getElementById('btnDownloadJson')?.addEventListener('click', downloadUpdatedJson);
  document.getElementById('btnResetData')?.addEventListener('click', resetDataToDefault);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput && document.activeElement !== mobileSearchInput) {
      e.preventDefault();
      if (window.innerWidth <= 768 && mobileSearchInput) {
        mobileSearchInput.focus();
      } else if (searchInput) {
        searchInput.focus();
      }
    }
    if (e.key === 'Escape') {
      // Close only the TOPMOST layer: lightbox has its own Esc handler,
      // so just yield to it instead of also tearing down modals beneath.
      const lightbox = document.getElementById('imageLightbox');
      if (lightbox && lightbox.classList.contains('open')) return;
      const picker = document.getElementById('episodePickerModal');
      if (picker && picker.classList.contains('active')) { closeEpisodePicker(); return; }
      const epEditor = document.getElementById('episodeEditorModal');
      if (epEditor && epEditor.classList.contains('active')) { closeEpisodeEditor(false); return; }
      const large = document.getElementById('largeEditorModal');
      if (large && large.classList.contains('active')) { closeLargeEditor(); return; }
      const settings = document.getElementById('settingsModal');
      if (settings && settings.classList.contains('active')) { closeSettingsModal(); return; }
      closeShowDetail();
    }
  });

  // System Back button / swipe-back gesture: close the topmost detail modal,
  // or re-open it when navigating Forward to a #show= URL.
  window.addEventListener('popstate', () => {
    const detailModal = document.getElementById('detailModal');
    const isOpen = detailModal && detailModal.classList.contains('active');
    const hash = window.location.hash;
    if (isOpen && !hash.startsWith('#show=')) {
      state.pushedShowHash = false;
      closeShowDetail(false);
    } else if (!isOpen && hash.startsWith('#show=')) {
      const slug = hash.replace('#show=', '').trim();
      const match = state.shows.find(s => slugify(s.vietnamese) === slug);
      if (match) openShowDetail(match);
    }
  });
}

// Mobile bottom-sheet: drag down from the top handle zone to dismiss,
// native-app style. Only engages when the sheet content is scrolled to top
// so normal scrolling is never hijacked. Desktop untouched (touch only).
function initSheetSwipe() {
  if (initSheetSwipe.done) return;
  initSheetSwipe.done = true;
  const modal = document.getElementById('detailModal');
  const content = modal ? modal.querySelector('.modal-content') : null;
  const scroller = modal ? modal.querySelector('.modal-scrollable') : null;
  if (!modal || !content) return;
  const isSheet = () => window.matchMedia('(max-width: 768px)').matches;
  let startY = 0, curY = 0, dragging = false;

  content.addEventListener('touchstart', e => {
    if (!isSheet() || !modal.classList.contains('active')) return;
    if (scroller && scroller.scrollTop > 0) return;
    const t = e.touches[0];
    if (!t) return;
    // Handle zone: top 90px (grabber + hero header), nowhere else
    if (t.clientY - content.getBoundingClientRect().top > 90) return;
    startY = t.clientY;
    curY = startY;
    dragging = true;
    content.style.transition = 'none';
  }, { passive: true });

  content.addEventListener('touchmove', e => {
    if (!dragging) return;
    const t = e.touches[0];
    if (!t) return;
    curY = t.clientY;
    const dy = curY - startY;
    if (dy > 0) content.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  const resetDrag = () => {
    dragging = false;
    content.style.transition = '';
    content.style.transform = '';
  };
  content.addEventListener('touchend', () => {
    if (!dragging) return;
    const dy = curY - startY;
    resetDrag();
    if (dy > 120) closeShowDetail();
  });
  content.addEventListener('touchcancel', resetDrag);
}

// App Entry Point
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFavorites();
  initEventListeners();
  renderShowsSkeleton(8);
  loadShowsData();
});
