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
  modalSeq: 0,          // bumped on every open/close intent; stale async callbacks compare it
  pendingFlipOpen: null,  // cancel handle for an in-flight open morph
  pendingFlipClose: null, // cancel handle for an in-flight close morph
  openedAt: 0,          // performance.now() of last open (grace for backdrop clicks)
  ownBackAt: 0,         // performance.now() of our own history.back() (self-detect popstate)
  modalHealTried: false, // self-heal re-render runs at most once per open (no loops)
  activeShow: null,
  activeEditorTargetId: null,
  editFormIdx: null,      // index of the show currently loaded in the edit form
  editFormSnapshot: ''    // serialized form content at load time (dirty check)
};

// Original tab title (restored when the detail modal closes)
const ORIGINAL_DOC_TITLE = document.title;

// Admin gate: the add/edit/pin/data tabs are only for the owner, unlocked by
// opening the site with ?admin=1 (bookmark it). Everyone else only sees the
// favorites-backup tab. Client-side hiding only: it keeps casual viewers out,
// it is not access control (a static site has no backend to enforce it).
const IS_ADMIN = (() => {
  try {
    return new URLSearchParams(window.location.search).get('admin') === '1';
  } catch (e) {
    return false;
  }
})();

function applyAdminGate() {
  if (IS_ADMIN) return;
  const adminTabs = ['stab-spotlight', 'stab-edit', 'stab-add', 'stab-data'];
  const tabBtns = Array.from(document.querySelectorAll('#settingsModal .modal-tab-btn'));
  tabBtns.forEach(btn => {
    const id = btn.getAttribute('data-stab');
    if (adminTabs.includes(id)) {
      btn.style.display = 'none';
      const pane = document.getElementById(id);
      if (pane) pane.style.display = 'none';
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      }
      if (pane && pane.classList.contains('active')) pane.classList.remove('active');
    }
  });
  // Favorites backup becomes the only (and default) tab for viewers.
  const favBtn = document.querySelector('#settingsModal .modal-tab-btn[data-stab="stab-fav"]');
  const favPane = document.getElementById('stab-fav');
  if (favBtn) {
    favBtn.classList.add('active');
    favBtn.setAttribute('aria-selected', 'true');
  }
  if (favPane) {
    favPane.classList.add('active');
    favPane.style.display = '';
  }
  const gear = document.getElementById('btnOpenSettings');
  if (gear) {
    gear.title = 'Sao lưu Yêu thích';
    gear.setAttribute('aria-label', 'Sao lưu Yêu thích');
  }
}

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

// Escape for single-quoted JS strings inside DOUBLE-quoted HTML attributes
// (onclick="copyText('...')"). escapeHtml is WRONG here: &#039; would be
// copied literally into the clipboard for names with apostrophes.
// The HTML attribute is delimited by '"', so '"' must be neutralised as the
// &quot; entity (decoded back to '"' before the JS runs) - a raw '"' would
// close the attribute and let the rest of the name become live markup.
function escapeJsSq(str) {
  if (!str) return '';
  return str
    .toString()
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, '\\n')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function removeVietnameseAccents(str) {
  if (!str) return '';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[\u2018\u2019\u201B\u2032\u2035]/g, "'") // curly quotes -> straight: a "Single's" search must match "Single’s Inferno"
    .toLowerCase()
    .trim();
}

function slugify(str) {
  if (!str) return '';
  return removeVietnameseAccents(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Only http(s) links may ever reach <a href> / window.open: a hand-edited
// showsData.json containing javascript:/data: URLs would otherwise be XSS.
// Returns a usable https URL, or null when the value must not be opened.
function sanitizeHttpUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null; // javascript:, data:, vbscript:...
  return 'https://' + u; // bare host: example.com/x
}

// Debounce: delay expensive filter+render while user is still typing (200-300ms)
function debounce(func, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// Logo C ("Lên Sóng") - brand mark for poster placeholders (no-image state).
// fill/stroke = currentColor so CSS controls colour per context.
const LOGO_C_MARK = `<g transform="translate(-10.2,-24.3) scale(1.14)"><path transform="translate(-3.4,20.8) scale(0.78)" fill="currentColor" d="M128 218 C96 194 62 162 48 136 C34 110 40 78 68 66 C92 56 116 66 128 88 C140 66 164 56 188 66 C216 78 222 110 208 136 C194 162 160 194 128 218 Z"/><path fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" d="M182.9 108.7 A20 20 0 0 1 182.9 139.3"/><path fill="none" stroke="currentColor" stroke-width="16" stroke-linecap="round" d="M198.3 90.3 A44 44 0 0 1 198.3 157.7"/></g>`;

// Skeleton placeholders: same footprint as real cards so CLS stays 0
function renderShowsSkeleton(count = 8) {
  const container = document.getElementById('showsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;
  if (emptyState) emptyState.style.display = 'none';
  container.style.display = state.viewMode === 'grid' ? 'grid' : 'flex';
  container.className = state.viewMode === 'grid' ? 'shows-grid' : 'shows-list';
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
        html: escapeHtml(status) || 'Chưa rõ'
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
  return match ? match[1] : escapeHtml(yearStr);
}

// Toast notification
function showToast(message, icon = 'fa-check') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  const toastIcon = document.createElement('i');
  toastIcon.className = `fa-solid ${icon}`;
  toastIcon.style.color = 'var(--primary-pink)';
  const toastText = document.createElement('span');
  toastText.textContent = message; // never innerHTML: show titles are data
  toast.appendChild(toastIcon);
  toast.appendChild(toastText);
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

function getWebsiteFaviconHtml(url) {
  const domain = getDomainFromUrl(url);

  if (!domain) {
    return `
      <div class="site-favicon-img" style="display:flex;align-items:center;justify-content:center;background:#ff2e7e;color:#fff;">
        <i class="fa-solid fa-play" style="font-size:11px;"></i>
      </div>`;
  }

  // Fixed official logo when available, otherwise Google's favicon service.
  // The <img> itself is deferred one frame (see hydrateFavicons): N uncached
  // favicon fetches landing on the click frame is what made "many link"
  // shows hitch on their first open.
  const lowerDomain = domain.toLowerCase();
  const overrideKey = Object.keys(FIXED_DOMAIN_LOGOS).find(k => lowerDomain === k || lowerDomain.endsWith('.' + k));
  const faviconUrl = overrideKey
    ? FIXED_DOMAIN_LOGOS[overrideKey]
    : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;

  return `<span class="site-favicon-img favicon-defer" data-favicon-url="${escapeHtml(faviconUrl)}" data-favicon-domain="${escapeHtml(domain)}" aria-hidden="true"></span>`;
}

// Swap every pending favicon placeholder for its real <img>. Called one frame
// after the modal opens, so icon fetch/decode never sits on the open frame.
function hydrateFavicons(root) {
  if (!root) return;
  root.querySelectorAll('.favicon-defer').forEach(el => {
    const url = el.getAttribute('data-favicon-url');
    if (!url) { el.remove(); return; }
    const img = document.createElement('img');
    img.src = url;
    img.alt = el.getAttribute('data-favicon-domain') || '';
    img.className = 'site-favicon-img';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.onerror = () => handleFaviconError(img);
    el.replaceWith(img);
  });
}

// Fallback play-button SVG for a failed favicon. Built as a data URI with NO
// quote characters, so it can safely be assigned from an inline onerror handler.
const FAVICON_FALLBACK_SRC = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect width='24' height='24' rx='6' fill='#6366f1'/><path d='M9.5 8L16 12L9.5 16V8Z' fill='#fff'/></svg>`
).replace(/'/g, '%27');

function handleFaviconError(img) {
  img.onerror = null;
  if (img.src !== FAVICON_FALLBACK_SRC) img.src = FAVICON_FALLBACK_SRC;
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

// Modal-size (600px) poster variants already fetched AND decoded in this
// session. renderShowDetail uses it to paint the modal poster from cache on
// the very first frame instead of waiting for an uncached proxy request.
const decodedModalPosters = new Set();
function warmModalPoster(url) {
  if (!url || decodedModalPosters.has(url)) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  const mark = () => decodedModalPosters.add(url);
  if (img.decode) { img.decode().then(mark).catch(() => {}); }
  else { img.onload = mark; }
}

// Poster <img> error handler: retry the original URL once, then fall back to
// `fallbackUrl` (or the custom `onFinal` replacement used by grid cards).
function handlePosterImgError(img, fallbackUrl, onFinal) {
  const original = img.getAttribute('data-original-src');
  if (original && !img.dataset.origTried) {
    img.dataset.origTried = '1';
    img.src = original;
    return;
  }
  img.onerror = null;
  if (typeof onFinal === 'function') { onFinal(img); return; }
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
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem('datinghub_theme');
  } catch (e) {
    savedTheme = null; // storage blocked: keep default 'auto', page still boots
  }
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
      try {
        localStorage.setItem('datinghub_theme', state.theme);
      } catch (e) { /* storage blocked: theme still applies for this session */ }
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
    const parsed = saved ? JSON.parse(saved) : [];
    // Any non-array shape (legacy "null", a bare string/number) must never
    // break boot: a throw here aborts the whole DOMContentLoaded chain and
    // leaves a blank page with no data.
    state.favorites = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    state.favorites = [];
  }
  updateFavoritesBadge();

  const favBtn = document.getElementById('btnOpenFavorites');
  if (favBtn) {
    favBtn.setAttribute('aria-pressed', 'false');
    favBtn.addEventListener('click', () => {
      state.filters.onlyFavorites = !state.filters.onlyFavorites;
      favBtn.classList.toggle('active', state.filters.onlyFavorites);
      favBtn.setAttribute('aria-pressed', state.filters.onlyFavorites ? 'true' : 'false');
      applyFilters();
      if (state.filters.onlyFavorites) {
        showToast(`Đang hiển thị ${state.filteredShows.length} show trong danh sách Yêu thích`, 'fa-bookmark');
      }
    });
  }
}

// Favorites used to be keyed by title (renaming a show or two shows sharing a
// title broke them). They now use the permanent id from ensureShowIds().
function favoriteKeyOf(show) {
  return show.id || show.vietnamese || show.english || show.chinese;
}

function isFavorited(show) {
  return state.favorites.includes(favoriteKeyOf(show));
}

// One-time migration of legacy title/slug keys to stable ids.
function migrateFavoritesToIds() {
  if (!Array.isArray(state.favorites) || state.favorites.length === 0) return;
  const seen = new Set();
  const next = [];
  let changed = false;
  state.favorites.forEach(key => {
    if (typeof key !== 'string' || !key.trim()) { changed = true; return; }
    let resolved = key;
    if (!state.shows.some(s => s.id === key)) {
      const legacy = state.shows.find(s =>
        s.vietnamese === key || s.english === key || s.chinese === key ||
        (typeof s.id === 'string' && slugify(s.vietnamese) === key));
      if (legacy && legacy.id) { resolved = legacy.id; changed = true; }
      else { next.push(key); return; } // unknown key: keep, never lose data
    }
    if (seen.has(resolved)) { changed = true; return; }
    seen.add(resolved);
    next.push(resolved);
  });
  if (changed) {
    state.favorites = next;
    try {
      localStorage.setItem('datinghub_favorites', JSON.stringify(state.favorites));
    } catch (e) { /* storage unavailable */ }
    updateFavoritesBadge();
  }
}

function toggleFavorite(show, e) {
  if (e) e.stopPropagation();
  const key = favoriteKeyOf(show);
  const index = state.favorites.indexOf(key);

  if (index > -1) {
    state.favorites.splice(index, 1);
    showToast(`Đã xóa "${show.vietnamese}" khỏi Yêu thích`, 'fa-heart-crack');
  } else {
    state.favorites.push(key);
    showToast(`Đã lưu "${show.vietnamese}" vào Yêu thích! 💕`, 'fa-heart');
  }

  try {
    localStorage.setItem('datinghub_favorites', JSON.stringify(state.favorites));
  } catch (e) { /* storage unavailable */ }
  updateFavoritesBadge();
  // Re-filter only when the grid actually depends on favorites: the Yêu thích
  // view must drop the card immediately, but anywhere else a full re-render
  // would reset infinite scroll and destroy the modal's source card (breaks
  // the close animation) for no visible change.
  if (state.filters.onlyFavorites) applyFilters();

  if (state.activeShow === show) {
    updateModalFavoriteButton(show);
  }
}

function updateFavoritesBadge() {
  const badge = document.getElementById('favCountBadge');
  if (!badge) return;
  const count = Array.isArray(state.favorites) ? state.favorites.length : 0;
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

// ============================================================
// FAVORITES BACKUP (export / import across browsers & machines)
// ============================================================
// Plain-text format, one show id per line (a " # Title" comment suffix is
// allowed for humans and stripped on import). Understands ids as well as
// legacy title/slug keys, so old backups keep working after renames.
const FAV_BACKUP_HEADER = 'DATING-SHOW-HUB-FAVORITES-v1';

function buildFavoritesBackup() {
  const keys = (Array.isArray(state.favorites) ? state.favorites : [])
    .filter(k => typeof k === 'string' && k.trim());
  if (keys.length === 0) return null;
  const lines = keys.map(k => {
    const show = state.shows.find(s => s.id === k);
    const title = show && show.vietnamese ? ` # ${show.vietnamese}` : '';
    return `${k}${title}`;
  });
  return `${FAV_BACKUP_HEADER}\n${lines.join('\n')}\n`;
}

function copyFavoritesBackup() {
  const code = buildFavoritesBackup();
  if (!code) {
    showToast('Chưa có show yêu thích nào để sao lưu', 'fa-bookmark');
    return;
  }
  const done = () => showToast(`Đã sao chép mã sao lưu (${state.favorites.length} show)`, 'fa-clipboard-check');
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
  } else {
    fallbackCopy(code, done);
  }
}

function downloadFavoritesBackup() {
  const code = buildFavoritesBackup();
  if (!code) {
    showToast('Chưa có show yêu thích nào để sao lưu', 'fa-bookmark');
    return;
  }
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const blob = new Blob([code], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `show-yeu-thich-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Đã tải file sao lưu (${state.favorites.length} show)`, 'fa-download');
}

// A backup key can be a stable id, a legacy title, or a slug: resolve it to
// a current show id, or null when this device simply doesn't have that show.
function resolveFavoriteKey(key) {
  if (!key || typeof key !== 'string') return null;
  key = key.trim();
  if (!key) return null;
  const byId = state.shows.find(s => s.id === key);
  if (byId && byId.id) return byId.id;
  const legacy = state.shows.find(s =>
    s.vietnamese === key || s.english === key || s.chinese === key ||
    slugify(s.vietnamese) === key);
  return legacy && legacy.id ? legacy.id : null;
}

// Merge (never wipe): adds missing shows, keeps what is already saved.
function importFavoritesBackup(text) {
  const raw = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    .filter(l => l !== FAV_BACKUP_HEADER)
    .map(l => {
      const hashIdx = l.indexOf(' # ');
      return (hashIdx > 0 ? l.slice(0, hashIdx) : l).trim();
    })
    .filter(Boolean);
  if (raw.length === 0) {
    showToast('Mã sao lưu trống, không có gì để khôi phục', 'fa-triangle-exclamation');
    return { added: 0, skipped: 0 };
  }
  if (!Array.isArray(state.favorites)) state.favorites = [];
  let added = 0, skipped = 0;
  raw.forEach(key => {
    const id = resolveFavoriteKey(key);
    if (!id) { skipped += 1; return; }
    if (!state.favorites.includes(id)) {
      state.favorites.push(id);
      added += 1;
    }
  });
  try {
    localStorage.setItem('datinghub_favorites', JSON.stringify(state.favorites));
  } catch (e) { /* storage unavailable */ }
  updateFavoritesBadge();
  applyFilters(); // the Yêu thích view (if active) picks the restored shows up
  if (state.activeShow) updateModalFavoriteButton(state.activeShow);
  if (added > 0 && skipped === 0) {
    showToast(`Đã khôi phục ${added} show yêu thích! 💕`, 'fa-heart');
  } else if (added > 0) {
    showToast(`Đã khôi phục ${added} show, bỏ qua ${skipped} mã lạ`, 'fa-heart');
  } else if (skipped > 0) {
    showToast(`Không khôi phục được show nào (${skipped} mã lạ)`, 'fa-triangle-exclamation');
  } else {
    showToast('Các show này đều đã có trong Yêu thích', 'fa-bookmark');
  }
  return { added, skipped };
}

function refreshFavBackupUI() {
  const count = Array.isArray(state.favorites) ? state.favorites.length : 0;
  const countEl = document.getElementById('favBackupCount');
  if (countEl) countEl.textContent = count;
  const empty = count === 0;
  ['btnCopyFavBackup', 'btnDownloadFavBackup'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.disabled = empty;
      btn.style.opacity = empty ? '0.5' : '';
      btn.title = empty ? 'Chưa có show yêu thích nào' : '';
    }
  });
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
// Coerce every record in place (identity preserved: loadShowsData compares
// `data === local.shows` afterwards) so mixed-type JSON can't break rendering.
function normalizeShowRecord(item) {
  ['vietnamese', 'english', 'chinese', 'country', 'status', 'platform',
   'time', 'image', 'description', 'detailNotes', 'year'].forEach(k => {
    const v = item[k];
    if (v == null) return; // absent stays absent (falsy checks already handle it)
    if (typeof v !== 'string') item[k] = String(v);
  });
  if (!Array.isArray(item.tags)) item.tags = [];
  if (item.rating == null || item.rating === '') {
    delete item.rating;
  } else {
    const r = Number(item.rating);
    if (Number.isFinite(r) && r > 0) item.rating = r;
    else delete item.rating;
  }
  ['vietnameseWatchUrls', 'chineseWatchUrls'].forEach(k => {
    if (item[k] == null) return;
    if (!Array.isArray(item[k])) item[k] = [];
    else item[k] = item[k].filter(l => l && typeof l === 'object' && typeof l.url === 'string');
  });
  return item;
}

async function loadShowsData() {
  try {
    const local = readLocalShows();
    let data = null;
    let fileVer = null;

    if (local) {
      // Fresh local edits win over an old file; a newer file
      // (fresh download copied in / redeployed) wins over old local data.
      fileVer = await getBundledFileVersion();
      if (shouldUseLocalShows(local, fileVer)) data = local.shows;
    }

    if (!data || !Array.isArray(data)) {
      const res = await fetch(`./showsData.json?v=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      data = await res.json();
      state.fileTag = (res.headers.get('ETag') || '').trim() || (fileVer && fileVer.tag) || null;
    } else {
      // Local copy is being displayed: remember which file version it sits on
      // top of, so a later save stamps it and redeploy comparisons stay exact.
      state.fileTag = fileVer ? fileVer.tag : null;
    }

    // Type-normalise first: one hand-edited entry (numeric platform, string
    // tags, null titles) would otherwise crash the render/trim/forEach paths.
    for (let i = data.length - 1; i >= 0; i--) {
      if (!data[i] || typeof data[i] !== 'object') data.splice(i, 1);
      else normalizeShowRecord(data[i]);
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
    migrateFavoritesToIds();
    // Load stored pins BEFORE syncing from the file: the sync only runs when
    // storage is empty, so the order matters (it used to always overwrite).
    state.spotlightSlugs = loadPinnedSpotlightSlugs();
    syncSpotlightSlugsFromData();

    // Preserve original file index for "None / Original sort"
    data.forEach((item, index) => {
      if (item._origIndex === undefined) item._origIndex = index;
    });

    // Only persist when the LOCAL copy was the one that won and got healed;
    // stamping file content with "now" would break the file-vs-local comparison.
    if (healedTitles > 0 && local && data === local.shows) saveShowsToLocalStorage();

    updateHeroStats();
    populatePlatformDropdown();
    populateYearDropdown();
    setupSpotlightShow();
    populateSettingsSelects();
    applyFilters();
    checkUrlHash();
  } catch (err) {
    console.error('Lỗi khi tải showsData.json:', err);
    // Never leave the 8 placeholder skeleton cards on screen forever.
    const grid = document.getElementById('showsGrid');
    const emptyState = document.getElementById('emptyState');
    if (grid) { grid.innerHTML = ''; grid.style.display = 'none'; }
    if (emptyState) {
      emptyState.style.display = 'flex'; // .empty-state is a flex column: 'block' breaks the centering
      const title = emptyState.querySelector('.empty-title, h3, p');
      if (title) title.textContent = 'Không tải được dữ liệu show. Vui lòng tải lại trang.';
    }
    showToast('Không tải được dữ liệu show. Vui lòng tải lại trang.', 'fa-triangle-exclamation');
  }
}

function saveShowsToLocalStorage() {
  try {
    localStorage.setItem('datinghub_local_shows', JSON.stringify({
      savedAt: Date.now(),
      fileTag: state.fileTag || null,
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

// Version of the bundled file: Last-Modified (when the server sends it) plus
// the ETag as a content tag. Lets a NEWER copied/redeployed showsData.json win
// over an older local copy (the old code always preferred localStorage, so
// updating the file had no visible effect).
// Cloudflare Pages sends NO Last-Modified (only ETag), so the tag alone has to
// be able to answer "did the file change since this local copy was saved?".
async function getBundledFileVersion() {
  try {
    const res = await fetch('./showsData.json', { method: 'HEAD' });
    const t = Date.parse(res.headers.get('Last-Modified') || '');
    return {
      time: Number.isNaN(t) ? null : t,
      tag: (res.headers.get('ETag') || '').trim() || null
    };
  } catch (e) {
    return { time: null, tag: null };
  }
}

// Decide whether the localStorage copy may override the deployed file.
// - Copy stamped with fileTag + server tag available: local edits made ON TOP
//   of this exact file version win; a redeployed file (new tag) wins over them.
// - Legacy copy without fileTag: fall back to savedAt vs Last-Modified.
// - Legacy copy and no Last-Modified (Cloudflare Pages): prefer the deployed
//   file - the old "fileTime null -> local wins" rule made every visitor with
//   an old saved copy render deleted image URLs forever, no matter how often
//   they refreshed.
function shouldUseLocalShows(local, ver) {
  if (!local || !Array.isArray(local.shows)) return false;
  if (local.fileTag && ver.tag) return local.fileTag === ver.tag;
  if (ver.time != null) return local.savedAt >= ver.time;
  return false;
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
  let raw = '';
  try {
    raw = localStorage.getItem('datinghub_spotlight') || '';
  } catch (e) {
    return []; // storage blocked (private mode): fall back to file pins
  }
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(s => typeof s === 'string').slice(0, MAX_PINNED_SHOWS);
  } catch (e) { /* old single-slug format handled below */ }
  return [raw].slice(0, MAX_PINNED_SHOWS);
}

function savePinnedSpotlightSlugs() {
  try {
    localStorage.setItem('datinghub_spotlight', JSON.stringify(state.spotlightSlugs));
  } catch (e) {
    console.warn('Không lưu được ghim spotlight (localStorage):', e);
  }
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

// #show= deep links use the permanent id (slugified titles collide, e.g.
// "Muộn còn hơn ế" vs "Muốn còn hơn ?"). Old slug links still resolve.
function hashKeyOfShow(show) {
  const key = show.id || slugify(show.vietnamese) || '';
  return encodeURIComponent(key);
}

function resolveShowFromHash(rawKey) {
  let key = (rawKey || '').trim();
  if (!key) return undefined;
  try {
    key = decodeURIComponent(key);
  } catch (e) { /* keep raw */ }
  return findShowByPin(key);
}

// Shows pinned for EVERY visitor via the data file (hotOrder 1..MAX), in order.
function getDataPinnedShows() {
  return state.shows
    .filter(s => {
      const n = Number(s.hotOrder);
      return Number.isInteger(n) && n >= 1 && n <= MAX_PINNED_SHOWS;
    })
    .sort((a, b) => Number(a.hotOrder) - Number(b.hotOrder))
    .slice(0, MAX_PINNED_SHOWS);
}

// If local pin storage is empty but the data file carries shared pins
// (hotOrder), adopt them so the settings pin list always reflects reality.
function syncSpotlightSlugsFromData() {
  if (state.spotlightSlugs.length > 0) return;
  const pinned = getDataPinnedShows();
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
  const fallback = state.shows.find(s => s.status === 'airing' && s.image)
    || state.shows[0];
  return fallback ? [fallback] : [];
}

function setupSpotlightShow() {
  // Pins shared with EVERY visitor live in the data file (hotOrder 1..4).
  // Personal localStorage pins are only a fallback when the data has none.
  let queue = getDataPinnedShows();
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
  // A modal owns the screen: covering the hero fires mouseleave, which must
  // not restart rotation behind the modal. doCloseShowDetail calls this again
  // after clearing activeShow, so rotation resumes on close.
  if (state.activeShow) return;
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
  const rating = candidate.rating ? Number(candidate.rating).toFixed(1) : '–';
  const title = escapeHtml(candidate.vietnamese || candidate.english || '');
  const posterHtml = candidate.image
    ? `<img src="${escapeHtml(getProxiedImageUrl(candidate.image, 360))}" data-original-src="${escapeHtml(candidate.image)}" alt="${title}" class="spotlight-poster" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" onload="this.classList.add('loaded')" onerror="handlePosterImgError(this, 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg')">`
    : `<div class="spotlight-poster" style="display:flex;align-items:center;justify-content:center;"><svg viewBox="17 47 230 150" fill="none" style="height:28px;width:auto;color:var(--primary-pink);" aria-hidden="true">${LOGO_C_MARK}</svg></div>`;
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

  // Poster / info panel are click targets too: open the same modal,
  // but leave inner controls (buttons, copy) and text selection alone.
  slide.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    if (e.target.closest('button, a, input, select, textarea')) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.toString().trim()) return;
    // Poster / info click = straight to the watch links; the "Chi tiết"
    // button keeps opening the description tab (tab-desc).
    openShowDetailAnimated(candidate, 'tab-watch', slide);
  });
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

// Single source of truth for "which filters are active", used both by the
// mobile filter badge and by the reset button (they used to disagree).
function getActiveFilterParts() {
  const f = state.filters;
  const parts = [];
  if (f.status !== 'all') {
    parts.push({ airing: 'Đang chiếu', completed: 'Hoàn thành', upcoming: 'Sắp chiếu' }[f.status] || f.status);
  }
  if (f.country !== 'all') parts.push(getCountryInfo(f.country).name);
  if (f.platform !== 'all') parts.push(f.platform);
  if (f.tag !== 'all') {
    parts.push({
      normal: 'Nam & Nữ', 'all-female': 'Les (GL)', 'all-male': 'Gay (BL)',
      bisexual: 'Song tính', other: 'Khác'
    }[f.tag] || f.tag);
  }
  if (f.year !== 'all') parts.push(`Năm ${f.year}`);
  if (f.onlyFavorites) parts.push('Yêu thích');
  if (f.sort !== 'airing-first') parts.push('Đã đổi thứ tự');
  return parts;
}

function hasActiveFilters() {
  return state.filters.search.trim() !== '' || getActiveFilterParts().length > 0;
}

function updateMobileFilterBadge() {
  const badge = document.getElementById('mobileFilterBadge');
  if (!badge) return;
  const parts = getActiveFilterParts();
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
  if (resetBtn) resetBtn.style.display = hasActiveFilters() ? 'inline-flex' : 'none';
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
    const isActive = p.dataset.status === 'all';
    p.classList.toggle('active', isActive);
    p.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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
  if (favBtn) favBtn.setAttribute('aria-pressed', 'false');

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
        // A queued entry can arrive after renderShows() already replaced the
        // sentinel - ignore it so a re-render never triggers an extra batch.
        const grid = document.getElementById('showsGrid');
        if (!grid || !grid.contains(entry.target)) return;
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
  const ratingValue = show.rating ? Number(show.rating).toFixed(1) : '–';
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
    posterHtml = `<div class="card-poster-fallback"><svg class="fallback-icon" viewBox="17 47 230 150" fill="none" aria-hidden="true">${LOGO_C_MARK}</svg><div class="fallback-title">${vnTitleEscaped}</div></div>`;
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

  // Attach safe image onerror fallback via the shared helper
  // (retry original once, then swap in the fallback art)
  const imgEl = card.querySelector('.card-poster-img');
  if (imgEl) {
    imgEl.onerror = () => handlePosterImgError(imgEl, null, () => {
      const wrapper = imgEl.parentElement;
      if (wrapper) {
        imgEl.remove();
        const fallback = document.createElement('div');
        fallback.className = 'card-poster-fallback';
        fallback.innerHTML = `<svg class="fallback-icon" viewBox="17 47 230 150" fill="none" aria-hidden="true">${LOGO_C_MARK}</svg><div class="fallback-title">${vnTitleEscaped}</div>`;
        wrapper.prepend(fallback);
      }
    });
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
  // Only restore focus when a modal was actually open (lastFocused is set on
  // open). Never touch window scroll here: the page scroll is already
  // preserved by the overflow:clip lock, and a redundant scrollTo() forces a
  // full-page repaint that reads as a homepage "blink" on close.
  // Otherwise Esc on the homepage would yank the page to top.
  if (lastFocusedBeforeModal && document.contains(lastFocusedBeforeModal)) {
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
    // The poster lightbox stacks above modals and must trap focus too
    const lightbox = document.getElementById('imageLightbox');
    const isLightboxOpen = lightbox && lightbox.classList.contains('open');
    const modal = isLightboxOpen
      ? lightbox
      : (openModals.length > 0 ? openModals[openModals.length - 1] : null); // topmost stacked modal
    if (!modal) return;
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

// Kill any morph still in flight (open or close). Without this, a close's
// pending finish()/timeout can land on a freshly reopened modal and tear it
// down again - that is the "closes then reopens" blip users saw.
function cancelPendingModalMotion() {
  if (state.pendingFlipOpen) { state.pendingFlipOpen(); state.pendingFlipOpen = null; }
  if (state.pendingFlipClose) { state.pendingFlipClose(); state.pendingFlipClose = null; }
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
  if (!content) {
    openShowDetail(show, defaultTab);
    return;
  }

  // Mobile bottom-sheet: pure translateY slide-up. The desktop FLIP scale
  // morph repaints the whole rich modal on phone GPUs (border flash, dropped
  // frames); a composited vertical slide stays smooth at any content weight.
  if (window.matchMedia('(max-width: 768px)').matches) {
    // suppressMotion keeps the built-in CSS transition off so it can't fight
    // the WAAPI slide (double transform = first-frame jump / blink).
    openShowDetail(show, defaultTab, { suppressMotion: true });
    if (!reduceMotion) {
      const anim = content.animate(
        [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
        { duration: 380, easing: 'cubic-bezier(.4, 0, .2, 1)' }
      );
      const reveal = () => content.classList.remove('no-anim');
      try { anim.onfinish = reveal; } catch (_) {}
      setTimeout(reveal, 450);
    } else {
      content.classList.remove('no-anim');
    }
    return;
  }

  if (reduceMotion || !state.detailSourceEl) {
    openShowDetail(show, defaultTab);
    return;
  }

  // 1. Render the modal instantly with its built-in motion suppressed.
  // openShowDetail also cancels any in-flight morph and clears leftover
  // inline transforms, so reopening during a close starts from a clean slate.
  openShowDetail(show, defaultTab, { suppressMotion: true });

  // 2. Morph synchronously in the same frame (no poster-decode wait, no
  // visibility:hidden). The old code hid the content for up to 80ms while
  // waiting for mp.decode(): the overlay was already .active, so users saw
  // one empty dimmed-backdrop frame = the intermittent "homepage blink".
  // Decoding mid-morph is fine: the poster fades in via its own opacity
  // transition and hover-prewarming already covers most cases.
  startFlipOpen(content, state.modalSeq);
}

function startFlipOpen(content, seq) {
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
  const onEnd = (e) => { if (e.propertyName === 'transform') finishOpen(); };
  const finishOpen = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    if (state.pendingFlipOpen === cancel) state.pendingFlipOpen = null;
    content.removeEventListener('transitionend', onEnd);
    // A close/newer open took over mid-flight: detach only, never reset styles
    // that now belong to another animation.
    if (seq !== state.modalSeq) return;
    flipCleanup(content, null);
    const m = content.closest('.modal-overlay');
    assertPaneVisible(m || document, m ? m.querySelector('.tab-pane.active') : null);
  };
  const cancel = () => { done = true; clearTimeout(timer); content.removeEventListener('transitionend', onEnd); };
  const timer = setTimeout(finishOpen, 600);
  state.pendingFlipOpen = cancel;
  content.addEventListener('transitionend', onEnd);
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

// Stacked modals share one page-scroll lock. Unlocking while any overlay or
// the poster lightbox is still open lets the background scroll under the
// open modal (reads as a homepage flash). Callers closing one layer must use
// unlockPageScrollIfFree() instead of unlockPageScroll().
function isAnyModalActive(exceptId) {
  const ids = ['detailModal', 'settingsModal', 'episodeEditorModal', 'episodePickerModal', 'largeEditorModal'];
  for (const id of ids) {
    if (id === exceptId) continue;
    const el = document.getElementById(id);
    if (el && el.classList.contains('active')) return true;
  }
  const lb = document.getElementById('imageLightbox');
  return !!(lb && lb.classList.contains('open'));
}

function unlockPageScrollIfFree(exceptId) {
  if (!isAnyModalActive(exceptId)) unlockPageScroll();
}

// Public entry: any throw inside the (long) body must not leave a half-open
// modal behind - stopped carousel, rewritten document.title and a pushed
// history entry with no modal on screen.
// opts.suppressMotion: render with the built-in open animation off (FLIP path
// owns the motion and reveals the content itself).
function openShowDetail(show, defaultTab = 'tab-watch', opts = {}) {
  if (!show || typeof show !== 'object') {
    console.error('openShowDetail: called with an invalid show, aborting open');
    return;
  }
  // New open intent: invalidate stale decode/timeout callbacks from the
  // previous open or an in-flight close, and start from clean motion styles.
  state.modalSeq += 1;
  state.modalHealTried = false;
  cancelPendingModalMotion();
  const content = modalContentEl();
  if (content) {
    // Kill any in-flight slide/morph (e.g. reopening mid-close): the cleared
    // inline styles below must own the transform, not a leftover animation.
    content.getAnimations().forEach(a => a.cancel());
    // Also kill stale tab-switch height/pane tweens - otherwise the box can
    // open at the previous tab's height and animate down (CLS jump on mobile).
    content.querySelectorAll('.modal-body, .tab-pane').forEach(el => el.getAnimations().forEach(a => a.cancel()));
    content.classList.remove('no-anim');
    content.style.transition = '';
    content.style.transform = '';
    content.style.borderRadius = '';
    content.style.visibility = '';
    if (opts.suppressMotion) {
      // Suppress only the built-in CSS open motion (the FLIP / bottom-sheet
      // path owns the motion and reveals the content itself). Never hide with
      // visibility:hidden here: the overlay is already .active, so a hidden
      // content means one blank-backdrop frame that reads as a blink.
      content.classList.add('no-anim');
    }
  }
  try {
    renderShowDetail(show, defaultTab);
    healModalContent(show, defaultTab);
    state.openedAt = performance.now();
    // Late phantom-visibility sweep: under throttled compositing the phantom
    // can strike after the sync open assert (e.g. mid-FLIP on a slow frame).
    // Skip when a newer open/close took over in the meantime.
    const openSeq = state.modalSeq;
    setTimeout(() => {
      if (openSeq !== state.modalSeq) return;
      const m = document.getElementById('detailModal');
      if (m && m.classList.contains('active')) assertPaneVisible(m, m.querySelector('.tab-pane.active'));
    }, 800);
  } catch (err) {
    console.error('Lỗi khi mở chi tiết show:', err);
    try { doCloseShowDetail(false); } catch (_) { /* best effort */ }
  }
}

// Post-render consistency check. The modal render is fully synchronous, so
// right after renderShowDetail the DOM must already show: exactly one active
// pane, the title matching the show, and a populated cast grid whenever the
// show actually has cast notes. If any of these is wrong the user gets an
// "empty frame" that previously needed a manual close + reopen.
function verifyModalContent(show) {
  const failures = [];
  const modal = document.getElementById('detailModal');
  if (!modal || !modal.classList.contains('active')) return ['modal-not-active'];
  if (modal.querySelectorAll('.tab-pane.active').length !== 1) {
    failures.push('pane-count=' + modal.querySelectorAll('.tab-pane.active').length);
  }
  const title = document.getElementById('modalTitle');
  if (!title || title.textContent !== show.vietnamese) failures.push('title-mismatch');
  if (show.detailNotes && show.detailNotes.trim()) {
    const grid = document.getElementById('modalCastGrid');
    if (!grid || grid.childElementCount === 0) failures.push('cast-empty');
  }
  return failures;
}

// Self-heal: re-render once synchronously when verification fails. A second
// identical render has always succeeded in testing; if it still fails the
// modal is closed instead of leaving a dead empty frame on screen, and the
// diagnostic stays in the console for debugging.
function healModalContent(show, defaultTab) {
  if (state.modalHealTried) return;
  const failures = verifyModalContent(show);
  if (failures.length === 0) return;
  state.modalHealTried = true;
  console.warn(`Modal content check failed (${failures.join(', ')}) for "${show && show.vietnamese}" - re-rendering once`);
  renderShowDetail(show, defaultTab);
  const retry = verifyModalContent(show);
  if (retry.length > 0) {
    console.error(`Modal re-render still bad (${retry.join(', ')}) - closing instead of an empty frame`);
    try { doCloseShowDetail(false); } catch (_) { /* best effort */ }
  }
}

// Modal poster placeholder: the heart mark on the card gradient. The <img> is
// hidden so this div takes over its grid cell (column 1 of .modal-header-hero),
// keeping .modal-info-col in column 2. Used for no-image shows AND posters
// whose URL fails to load - never another show's photo.
function showModalPosterFallback() {
  const poster = document.getElementById('modalPoster');
  if (!poster || !poster.parentElement) return;
  poster.style.display = 'none';
  if (poster.parentElement.querySelector('.modal-poster-fallback')) return;
  poster.insertAdjacentHTML('afterend', `<div class="modal-poster modal-poster-fallback" role="img" aria-label="Show chưa có ảnh bìa"><svg class="fallback-icon" viewBox="17 47 230 150" fill="none" aria-hidden="true">${LOGO_C_MARK}</svg></div>`);
}

function clearModalPosterFallback() {
  const poster = document.getElementById('modalPoster');
  if (!poster || !poster.parentElement) return;
  poster.parentElement.querySelectorAll('.modal-poster-fallback').forEach(el => el.remove());
}

function renderShowDetail(show, defaultTab = 'tab-watch') {
  state.activeShow = show;
  const modal = document.getElementById('detailModal');
  if (!modal) return;

  // Pause spotlight rotation while a modal owns the screen: a 6s tick firing
  // mid-morph steals the compositor and reads as stutter. Resumed on close.
  clearInterval(spotlightTimer);
  spotlightTimer = null;

  const hashKey = hashKeyOfShow(show);
  // pushState (not replaceState) so the system Back button / swipe-back gesture
  // returns to the list. Skip when already on this hash (direct-link load).
  if (hashKey && window.location.hash !== `#show=${hashKey}`) {
    window.history.pushState({}, '', `#show=${hashKey}`);
    state.pushedShowHash = true;
  }
  document.title = `${show.vietnamese} - Vietsub | Dating show 💕`;

  const poster = document.getElementById('modalPoster');
  if (poster) {
    delete poster.dataset.origTried;
    // Drop the heart placeholder left behind by a previously opened no-image show.
    clearModalPosterFallback();
    if (show.image) {
      poster.style.display = '';
      poster.setAttribute('data-original-src', show.image);
      // First-open flash of NEW shows: the 600px proxy variant of a freshly
      // added photo is not cached yet (wsrv must fetch+convert it first), so
      // the poster area painted empty for a few hundred ms on the first click
      // and then popped in - once cached, never again. Prefer the 600px URL
      // only when it was already decoded this session (pointerdown/hover warm
      // or a previous open); otherwise paint the card's already decoded
      // variant as the SECOND src write in the SAME task - the browser paints
      // only after the task, so no blank frame is ever shown. The 600px
      // variant keeps warming in the background for the next open.
      const modalUrl = getProxiedImageUrl(show.image, 600);
      const srcEl = state.detailSourceEl && state.detailSourceEl.querySelector
        ? state.detailSourceEl.querySelector('.card-poster-img, .list-item-poster, .spotlight-poster')
        : null;
      const fastUrl = (srcEl && srcEl.complete && srcEl.naturalWidth > 0 &&
          srcEl.getAttribute('data-original-src') === show.image)
        ? (srcEl.currentSrc || srcEl.src)
        : null;
      poster.src = decodedModalPosters.has(modalUrl) ? modalUrl : (fastUrl || modalUrl);
      warmModalPoster(modalUrl);
      poster.onerror = () => handlePosterImgError(poster, null, () => showModalPosterFallback());
    } else {
      // No poster in the data: keep the heart placeholder instead of borrowing
      // another show's image (the old show-0.jpg stand-in).
      poster.removeAttribute('data-original-src');
      poster.removeAttribute('src');
      poster.onerror = null;
      showModalPosterFallback();
    }
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

  // Rating now lives in the modal meta grid (Nền tảng / Lịch / Năm / Đánh giá)
  const ratingBadge = document.getElementById('modalRatingBadge');
  if (ratingBadge) {
    ratingBadge.textContent = show.rating ? Number(show.rating).toFixed(1) : '–';
  }

  const platformEl = document.getElementById('modalPlatform');
  if (platformEl) platformEl.textContent = show.platform || 'Online';

  const scheduleEl = document.getElementById('modalSchedule');
  if (scheduleEl) scheduleEl.textContent = show.time || 'Đang cập nhật';

  const yearEl = document.getElementById('modalYear');
  // Same formatting as the cards (raw values can be full dates like
  // "23-06-2026") and no invented fallback year - blank shows the same '–'
  // the rating column uses.
  if (yearEl) yearEl.textContent = formatYear(show.year) || '–';

  populateWatchLinks(show);
  populateCastMembers(show.detailNotes);

  const descEl = document.getElementById('modalDescription');
  if (descEl) descEl.textContent = show.description || 'Chưa có thông tin giới thiệu cho show này.';

  updateModalFavoriteButton(show);
  switchModalTab(defaultTab, { instant: true });

  freezeModalHeight(modal);
  modal.classList.add('active');
  lockPageScroll();
  focusModalEntry(modal);

  // Favicons hydrate a frame later: the open frame only does layout + morph.
  requestAnimationFrame(() => hydrateFavicons(modal));
}

function closeShowDetail(updateHistory = true) {
  const modal = document.getElementById('detailModal');
  // Ignore closes that arrive when nothing is open (double Esc, stray events,
  // or a close racing a not-yet-rendered open).
  if (!modal || !modal.classList.contains('active')) return;

  // New close intent: stop any in-flight open morph so its timeouts cannot
  // clean up styles that belong to this close (and vice versa below).
  state.modalSeq += 1;
  const seq = state.modalSeq;
  cancelPendingModalMotion();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const src = state.detailSourceEl;
  const content = modal.querySelector('.modal-content');

  // Mobile bottom-sheet: slide straight down (continues from any drag offset).
  // Same reason as the open path - no scale morph on phone GPUs.
  if (window.matchMedia('(max-width: 768px)').matches) {
    if (reduceMotion || !content) {
      doCloseShowDetail(updateHistory);
      return;
    }
    content.getAnimations().forEach(a => a.cancel());
    modal.classList.remove('active');
    content.style.transition = 'transform 380ms cubic-bezier(.4, 0, .2, 1)';
    content.style.transform = 'translateY(100%)';
    let done = false;
    const onEnd = (e) => { if (e.propertyName === 'transform') finish(); };
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (state.pendingFlipClose === cancel) state.pendingFlipClose = null;
      content.removeEventListener('transitionend', onEnd);
      if (seq !== state.modalSeq) return;
      flipCleanup(content, onEnd);
      doCloseShowDetail(updateHistory);
    };
    const cancel = () => { done = true; clearTimeout(timer); content.removeEventListener('transitionend', onEnd); };
    state.pendingFlipClose = cancel;
    content.addEventListener('transitionend', onEnd);
    const timer = setTimeout(finish, 560);
    return;
  }

  const flipping = !reduceMotion && src && src.isConnected;
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
    clearTimeout(timer);
    if (state.pendingFlipClose === cancel) state.pendingFlipClose = null;
    content.removeEventListener('transitionend', onEnd);
    // A newer open started while we were closing: that open owns the modal
    // now, so drop our cleanup instead of tearing its modal down.
    if (seq !== state.modalSeq) return;
    flipCleanup(content, onEnd);
    doCloseShowDetail(updateHistory);
  };
  const cancel = () => { done = true; clearTimeout(timer); content.removeEventListener('transitionend', onEnd); };
  state.pendingFlipClose = cancel;
  content.addEventListener('transitionend', onEnd);
  requestAnimationFrame(() => {
    if (seq !== state.modalSeq) return;
    content.style.transform = `translate(${dx}px, ${dy}px) scale(${s.width / t.width}, ${s.height / t.height})`;
    content.style.borderRadius = '14px';
  });
  const timer = setTimeout(finish, 520);
}

function doCloseShowDetail(updateHistory = true) {
  const modal = document.getElementById('detailModal');
  state.detailSourceEl = null;
  if (!modal) return;
  unfreezeModalHeight(modal);
  modal.classList.remove('active');
  unlockPageScrollIfFree('detailModal');
  state.activeShow = null;
  restoreFocusAfterModal();
  restartSpotlightTimer();
  document.title = ORIGINAL_DOC_TITLE;

  if (!updateHistory) return;
  if (state.pushedShowHash) {
    // We pushed this entry: go back so Back/Forward stay consistent.
    // ownBackAt lets the popstate handler recognise this traversal as our own
    // instead of letting it close a modal that was reopened in the meantime.
    state.pushedShowHash = false;
    state.ownBackAt = performance.now();
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

// Element focused before the lightbox opened (focus returns there on close)
let lightboxPrevFocus = null;

// Guards late lightbox loads: a slow original from an earlier open must not
// reveal into (or toast over) a newer one. Bumped on every open AND close.
let lightboxSeq = 0;
let lightboxSpinnerTimer = 0;

function openPosterLightbox(src, alt) {
  const box = document.getElementById('imageLightbox');
  const img = document.getElementById('imageLightboxImg');
  const ghost = document.getElementById('imageLightboxGhost');
  const spinner = document.getElementById('imageLightboxSpinner');
  if (!box || !img || !src) return;
  lightboxPrevFocus = document.activeElement;
  lightboxSeq += 1;
  const seq = lightboxSeq;
  lbPointers.clear();
  img.classList.remove('dragging');
  img.classList.remove('ready'); // start invisible: fade in only when decoded
  if (spinner) spinner.classList.remove('show');
  clearTimeout(lightboxSpinnerTimer);

  // Instant placeholder: the already-decoded modal poster, blurred.
  if (ghost) {
    const thumb = document.getElementById('modalPoster');
    const thumbSrc = (thumb && (thumb.currentSrc || thumb.src)) || '';
    if (thumbSrc) {
      ghost.src = thumbSrc;
      ghost.classList.add('show');
    } else {
      ghost.classList.remove('show');
    }
  }

  const reveal = () => {
    if (seq !== lightboxSeq) return;
    fitLightboxImage();
    clearTimeout(lightboxSpinnerTimer);
    if (spinner) spinner.classList.remove('show');
    img.classList.add('ready'); // compositor fade-in, no snap
    if (ghost) ghost.classList.remove('show'); // full-res covers it now
  };
  img.onload = reveal;
  img.onerror = () => {
    if (seq !== lightboxSeq) return;
    clearTimeout(lightboxSpinnerTimer);
    if (spinner) spinner.classList.remove('show');
    closePosterLightbox();
    showToast('Không tải được ảnh gốc', 'fa-triangle-exclamation');
  };
  const sameSrc = img.getAttribute('src') === src;
  img.src = src;
  if (alt) img.alt = alt;
  if (sameSrc && img.complete && img.naturalWidth) {
    reveal(); // cached: instant, no spinner possible
  } else {
    // Slow network only: show the ring after 300ms, never before.
    lightboxSpinnerTimer = setTimeout(() => {
      if (seq !== lightboxSeq || img.classList.contains('ready')) return;
      if (spinner) spinner.classList.add('show');
    }, 300);
  }
  box.classList.add('open');
  box.setAttribute('aria-hidden', 'false');
  lockPageScroll();
  const closeBtn = document.getElementById('imageLightboxClose');
  if (closeBtn) closeBtn.focus();
}

function closePosterLightbox() {
  const box = document.getElementById('imageLightbox');
  if (!box) return;
  lightboxSeq += 1; // invalidate any in-flight load/spinner of this open
  clearTimeout(lightboxSpinnerTimer);
  const spinner = document.getElementById('imageLightboxSpinner');
  if (spinner) spinner.classList.remove('show');
  const ghost = document.getElementById('imageLightboxGhost');
  if (ghost) ghost.classList.remove('show');
  lbPointers.clear();
  box.classList.remove('open');
  box.setAttribute('aria-hidden', 'true');
  if (lightboxPrevFocus && lightboxPrevFocus.isConnected) lightboxPrevFocus.focus();
  lightboxPrevFocus = null;
  unlockPageScrollIfFree();
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

  document.getElementById('imageLightboxClose')?.addEventListener('click', closePosterLightbox);
  document.getElementById('imageLightboxBackdrop')?.addEventListener('click', closePosterLightbox);
  document.getElementById('imageLightboxZoomIn')?.addEventListener('click', () => zoomLightboxAt(window.innerWidth / 2, window.innerHeight / 2, 1.4));
  document.getElementById('imageLightboxZoomOut')?.addEventListener('click', () => zoomLightboxAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.4));
  document.getElementById('imageLightboxReset')?.addEventListener('click', fitLightboxImage);
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

// Shared tab switcher (detail modal: data-tab, settings modal: data-stab).
// Transition: the incoming pane slides+fades in (direction follows tab order),
// .modal-body height tweens to the new pane height, and the scrollable eases
// back to the top — so the switch stays fluid even when the modal box is
// height-clamped (mobile bottom-sheet at 88dvh, where the box cannot change).
// Height/scroll use a symmetric ease-in-out: with a front-loaded ease-out the
// box finished most of its visible travel in the first ~120ms (and immediately
// hit the clamp on tall tabs), which read as a snap.
const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tweenScrollTop(el, to, dur, ease) {
  if (el._stTween) cancelAnimationFrame(el._stTween);
  const from = el.scrollTop;
  if (Math.abs(from - to) < 1) return;
  const start = performance.now();
  const step = now => {
    const t = Math.min(1, (now - start) / dur);
    el.scrollTop = from + (to - from) * ease(t);
    el._stTween = t < 1 ? requestAnimationFrame(step) : 0;
  };
  el._stTween = requestAnimationFrame(step);
}
// Mobile bottom-sheet height transition. The box only travels while its
// natural height (header + body) crosses the clamp ceiling; the rest of the
// body tween happens invisibly behind the ceiling. Skip that invisible part so
// the box starts moving immediately and takes ~460ms of visible slide in both
// directions (shrink: jump straight to the crossing height; grow: slide to the
// ceiling, then the hidden remainder finishes behind it). Desktop keeps the
// plain 460ms tween.
function animateBodyHeight(content, body, box0, h0, h1, mobile, easeHeight) {
  const T = 460;
  const plain = () => body.animate(
    [{ height: h0 + 'px' }, { height: h1 + 'px' }],
    { duration: T, easing: easeHeight });
  if (!mobile || !content) { plain(); return; }
  const box1 = content.getBoundingClientRect().height;
  const ceil = (parseFloat(content.style.maxHeight) || 0) || window.innerHeight * 0.9;
  if (Math.abs(box1 - box0) <= 1) { plain(); return; }
  const free0 = box0 < ceil - 1, free1 = box1 < ceil - 1;
  let C;
  if (free0 && !free1) C = box0 - h0;        // grows into the ceiling
  else if (!free0 && free1) C = box1 - h1;    // shrinks out of the ceiling
  else { plain(); return; }                   // never crosses: one 460ms leg
  const hStar = ceil - C;
  if (!(hStar > Math.min(h0, h1) && hStar < Math.max(h0, h1))) { plain(); return; }
  const start = h1 < h0 ? hStar : h0;         // shrink: start past the invisible leg
  const end = h1 < h0 ? h1 : hStar;           // grow: end at the ceiling crossing
  body.animate(
    [{ height: start + 'px' }, { height: end + 'px' }],
    { duration: T, easing: easeHeight });
}

function switchTabsIn(rootSelector, attrName, tabId, opts = {}) {
  const root = document.querySelector(rootSelector);
  if (!root) return;
  const panes = Array.from(root.querySelectorAll('.tab-pane'));
  let next = panes.find(p => p.id === tabId);
  if (!next && panes.length > 0) {
    // Unknown tab id from a stale caller: fall back to the first pane
    // instead of leaving buttons and panes desynced with nothing to show.
    console.warn(`switchTabsIn: unknown tab "${tabId}", falling back to "${panes[0].id}"`);
    next = panes[0];
    tabId = next.id;
  }
  const cur = panes.find(p => p.classList.contains('active'));

  const btns = Array.from(root.querySelectorAll('.modal-tab-btn'));
  const prevBtn = btns.find(b => b.classList.contains('active'));
  const prevTabId = prevBtn ? prevBtn.dataset[attrName] : '';
  btns.forEach(btn => {
    const on = btn.dataset[attrName] === tabId;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  if (!next || cur === next) return;

  const scroller = root.querySelector('.modal-scrollable');
  const isMobileSheet = window.matchMedia('(max-width: 768px)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (opts.instant || reduceMotion || !cur) {
    // On open the box must already have the target tab's height on its first
    // visible frame: a leftover height tween from a previous session shows as
    // "opens at the ceiling, then slides down" (CLS jump on mobile).
    const staleBody = root.querySelector('.modal-body');
    if (staleBody) staleBody.getAnimations().forEach(a => a.cancel());
    panes.forEach(p => p.getAnimations().forEach(a => a.cancel()));
    panes.forEach(p => p.classList.toggle('active', p === next));
    if (scroller && scroller.scrollTop > 1) scroller.scrollTop = 0;
    assertPaneVisible(root, next);
    return;
  }

  const body = root.querySelector('.modal-body');
  const h0 = body ? body.getBoundingClientRect().height : 0;
  if (body) body.getAnimations().forEach(a => a.cancel());
  next.getAnimations().forEach(a => a.cancel());

  const content = root.querySelector('.modal-content');
  const box0 = content ? content.getBoundingClientRect().height : 0;

  cur.classList.remove('active');
  next.classList.add('active');

  const ease = 'cubic-bezier(.4, 0, .2, 1)';
  const dur = 380;
  const easeHeight = 'cubic-bezier(.45, 0, .55, 1)';
  if (body && h0 > 0) {
    const h1 = body.getBoundingClientRect().height;
    if (Math.abs(h1 - h0) > 1) {
      animateBodyHeight(content, body, box0, h0, h1, isMobileSheet, easeHeight);
    }
  }

  const oldIdx = btns.findIndex(b => b.dataset[attrName] === prevTabId);
  const newIdx = btns.findIndex(b => b.dataset[attrName] === tabId);
  const dir = oldIdx < 0 || newIdx >= oldIdx ? 1 : -1;
  const slideAnim = next.animate([
    { opacity: 0, transform: `translateX(${dir * 28}px)` },
    { opacity: 1, transform: 'translateX(0)' }
  ], { duration: dur, easing: ease });

  // Paint settle (stuck-layer guard): on some Chromium/Edge GPUs the pane's
  // compositor layer can go stale after the slide, leaving the new tab as a
  // blank area even though the DOM is complete (needs manual close+reopen).
  // Committing the final frame then cancelling drops the animation layer and
  // the forced reflow repaints synchronously — pane, body and the scroll/
  // content ancestors in case the stale layer sits above the pane. A second
  // settle ~1.2s later covers a layer going stale again from a late image
  // decode. Guarded by a per-root token so a late settle never touches a
  // newer switch; cancelling never triggers onfinish, so only the newest
  // switch settles.
  const settleToken = (root._paintSettleToken = (root._paintSettleToken || 0) + 1);
  const settle = () => {
    if (root._paintSettleToken !== settleToken) return;
    try { slideAnim.commitStyles(); } catch (_) {}
    try { slideAnim.cancel(); } catch (_) {}
    next.style.opacity = '';
    next.style.transform = '';
    void next.offsetHeight;
    if (body) void body.offsetHeight;
    if (scroller) void scroller.offsetHeight;
    if (content) void content.offsetHeight;
    assertPaneVisible(root, next);
  };
  slideAnim.onfinish = () => { settle(); clearTimeout(settleTimer2); };
  const settleTimer = setTimeout(settle, dur + 150);
  const settleTimer2 = setTimeout(settle, dur + 1200);

  if (scroller && scroller.scrollTop > 1) {
    tweenScrollTop(scroller, 0, 460, easeInOutCubic);
  }

  // switchTabsIn is shared with the settings modal, so no detail-modal-only
  // work here; the phantom sweep above handles the blank-tab case.
}

// Phantom-visibility guard. Under throttled compositing (occluded window,
// some Edge/GPU drivers) .modal-body or the incoming pane can end up with a
// computed visibility:hidden that has NO cascade source (no matching rule,
// no inline style) right after a tab switch - the DOM and layout are intact
// but the whole tab paints blank until a manual close+reopen. Nothing ever
// legitimately hides these elements (the FLIP open hides .modal-content, an
// ancestor, which still wins), so forcing inline visible here is a no-op
// when healthy and an instant repaint when the phantom strikes.
function assertPaneVisible(root, next) {
  try {
    const body = root.querySelector('.modal-body');
    if (body && !body.style.visibility && getComputedStyle(body).visibility === 'hidden') {
      console.warn('assertPaneVisible: phantom hidden on .modal-body - forcing visible');
      body.style.visibility = 'visible';
    }
    if (next && !next.style.visibility && getComputedStyle(next).visibility === 'hidden') {
      console.warn('assertPaneVisible: phantom hidden on pane - forcing visible');
      next.style.visibility = 'visible';
    }
  } catch (_) {}
}

function switchModalTab(tabId, opts) {
  switchTabsIn('#detailModal', 'tab', tabId, opts);
}

// Renders one link group (detail modal). Returns how many SAFE buttons were
// created - unsafe/invalid URLs are dropped by createWatchLinkButton.
function fillWatchLinkList(list, container, defaultLabel, emptyHtml) {
  if (!container) return 0;
  container.innerHTML = '';
  const btns = [];
  (Array.isArray(list) ? list : []).forEach(item => {
    const btn = createWatchLinkButton(
      item && item.url,
      (item && item.label) || defaultLabel,
      item && item.episodes
    );
    if (btn) btns.push(btn);
  });
  btns.forEach(b => container.appendChild(b));
  if (btns.length === 0 && emptyHtml) container.innerHTML = emptyHtml;
  return btns.length;
}

// Requirement 3: Watch Link Buttons with REAL WEBSITE FAVICONS
function populateWatchLinks(show) {
  const vietsubContainer = document.getElementById('modalVietsubLinks');
  const originalContainer = document.getElementById('modalOriginalLinks');
  const chineseGroup = document.getElementById('modalChineseGroup');

  const vietsubList = (Array.isArray(show.vietnameseWatchUrls) && show.vietnameseWatchUrls.length > 0)
    ? show.vietnameseWatchUrls
    : (show.vietnameseWatchUrl ? [{ url: show.vietnameseWatchUrl, label: 'Nguồn Vietsub chính' }] : []);

  fillWatchLinkList(vietsubList, vietsubContainer, 'Xem Vietsub',
    `<div style="color: var(--text-muted); font-size: 13px;">Chưa có link Vietsub. Bạn có thể xem bản gốc bên dưới.</div>`);

  const originalList = (Array.isArray(show.chineseWatchUrls) && show.chineseWatchUrls.length > 0)
    ? show.chineseWatchUrls
    : (show.chineseWatchUrl ? [{ url: show.chineseWatchUrl, label: 'Nơi chiếu bản gốc' }] : []);

  const originalCount = fillWatchLinkList(originalList, originalContainer, 'Xem bản gốc', '');
  if (chineseGroup) chineseGroup.style.display = originalCount > 0 ? 'block' : 'none';
}

function createWatchLinkButton(url, label, episodes) {
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) return null;

  const a = document.createElement('a');
  a.href = safeUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'watch-link-btn';
  a.setAttribute('data-full-label', label || 'Xem Vietsub');

  const faviconHtml = getWebsiteFaviconHtml(safeUrl);
  const eps = Array.isArray(episodes) ? episodes.filter(e => e && e.url) : [];
  const hasEps = eps.length > 0;

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
    // Each new gesture starts clean: if the previous long-press never produced
    // a click (finger cancelled/moved), its flag must not swallow this tap.
    suppressClick = false;
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
  // touchcancel never produces a click, so drop the pending suppression too
  document.addEventListener('touchcancel', () => {
    cancelLongPress();
    suppressClick = false;
  }, { passive: true });
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

// One cast line -> structured fields. Handles the 3 formats found in
// showsData: "Nữ 1 - Tên | 30t | vai trò", "Nữ 1 - Tên (中文), 2004, vai trò"
// and separator-free "Nữ 5 - Tên (alias)  vai trò".
function parseCastLine(line) {
  const res = { gender: '', no: '', name: '', zh: '', age: '', role: '' };
  let rest = String(line).trim();

  const prefix = rest.match(/^(Nữ|Nam)\s*(\d+)\s*[-–—.]?\s*/);
  if (prefix) {
    res.gender = prefix[1] === 'Nữ' ? 'female' : 'male';
    res.no = prefix[2];
    rest = rest.slice(prefix[0].length);
  }

  // Parenthesized part: CJK -> Chinese name chip, digits -> age, else keep in name
  rest = rest.replace(/\(([^()]{1,40})\)/g, (m, inner) => {
    const t = inner.trim();
    if (/[一-鿿]/.test(t)) { res.zh = t; return ' '; }
    if (/^\d{2,4}\s*(?:t|tuổi)$/i.test(t) || /^\d{4}$/.test(t)) { res.age = t; return ' '; }
    return m;
  });

  // "Tên , 2004" -> "Tên, 2004" after paren removal so comma-split stays clean
  rest = rest.replace(/\s*,\s*/g, ', ');

  let parts;
  if (rest.includes('|')) {
    parts = rest.split('|');
  } else {
    // "Name<2+ spaces>role, with commas inside" beats plain comma-split,
    // but only when the head segment is comma-free.
    const spaced = rest.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    if (spaced.length >= 2 && !spaced[0].includes(',')) parts = spaced;
    else parts = rest.split(',');
  }
  parts = parts.map(s => s.trim()).filter(Boolean);

  res.name = parts.shift() || '';
  for (const p of parts) {
    // Age/birth parts (also dedupe "(24 tuổi)" + "| 24t"): never become role
    const m = p.match(/^(sinh ngày|tháng)\s+/i);
    const core = m ? p.slice(m[0].length) : p;
    if (/^(\d{1,3}\s*(?:t|tuổi)|\d{4}|\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}|\d{1,2}\s*\/\s*\d{4})$/i.test(core)) {
      if (!res.age) res.age = core.replace(/\s*\/\s*/g, '/');
      continue;
    }
    res.role = res.role ? res.role + ', ' + p : p;
  }
  res.name = res.name.replace(/\s+/g, ' ').trim();
  res.role = (res.role || '').replace(/\s+/g, ' ')
    .replace(/^[\s:;,·-]+/, '').replace(/[.\s]+$/, '').trim();
  if (!res.name) { res.name = String(line).trim(); res.role = ''; }
  return res;
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
  let groupGender = '';
  let seq = 0;
  lines.forEach(line => {
    const c = parseCastLine(line);

    // Group separator lines like "Nữ:" / "Nam:" render as a full-width heading
    if (/^(nữ|nam)\s*:?$/i.test(c.name)) {
      groupGender = /^nữ/i.test(c.name) ? 'female' : 'male';
      seq = 0;
      const sec = document.createElement('div');
      sec.className = 'cast-section';
      sec.innerHTML = `<span class="cast-section-label">${escapeHtml(c.name.replace(/\s*:+\s*$/, ''))}</span>`;
      container.appendChild(sec);
      return;
    }

    seq += 1;
    const gender = c.gender || groupGender;
    const no = String(c.no || seq).padStart(2, '0');
    const card = document.createElement('div');
    card.className = 'cast-card' + (gender ? ` cast-gender-${gender}` : '');
    const body = (c.zh || c.role) ? `
      <div class="cast-body">
        ${c.zh ? `<div class="cast-zh">${escapeHtml(c.zh)}</div>` : ''}
        ${c.role ? `<div class="cast-role">${escapeHtml(c.role)}</div>` : ''}
      </div>` : '';
    card.innerHTML = `
      <div class="cast-top">
        <span class="cast-no">${no}</span>
        <span class="cast-bar" aria-hidden="true"></span>
      </div>
      <div class="cast-head">
        <span class="cast-name">${escapeHtml(c.name)}</span>
        ${c.age ? `<span class="cast-age">${escapeHtml(c.age)}</span>` : ''}
      </div>${body}
    `;
    container.appendChild(card);
  });
}

function copyShareLink(show, e) {
  if (e) e.stopPropagation();
  const shareUrl = `${window.location.origin}${window.location.pathname}#show=${hashKeyOfShow(show)}`;
  copyText(shareUrl, 'link chia sẻ show');
}

function checkUrlHash() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#show=')) return;

  const matchedShow = resolveShowFromHash(hash.replace('#show=', ''));
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
  }, 400);
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
  refreshFavBackupUI();
  // Viewers must never land on an admin tab (e.g. a stale active state).
  if (!IS_ADMIN) switchSettingsTab('stab-fav');
  const restoreBox = document.getElementById('favRestoreBox');
  if (restoreBox) restoreBox.style.display = 'none';
  const restoreText = document.getElementById('favRestoreText');
  if (restoreText) restoreText.value = '';
  const restoreFile = document.getElementById('favRestoreFile');
  if (restoreFile) restoreFile.value = '';
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
  unlockPageScrollIfFree('settingsModal');
  restoreFocusAfterModal();
}

function switchSettingsTab(tabId) {
  switchTabsIn('#settingsModal', 'stab', tabId);
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

function populateSettingsSelects(options = {}) {
  // Called on every keystroke of BOTH settings searches. Reloading the edit
  // form from here silently threw away whatever the user had typed into it,
  // so a reload only happens when the loaded show is genuinely gone.
  const reloadEditForm = options.reloadEditForm === true;
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
    const prevValue = editSelect.value;
    const dirty = isEditFormDirty();

    let sorted = getAlphabeticalShows(editKeyword);
    // The show being edited must stay selectable while its form has unsaved
    // changes, otherwise Save would write the form into the wrong show.
    if (dirty && state.editFormIdx !== null &&
        !sorted.some(s => s._idx === state.editFormIdx) &&
        state.shows[state.editFormIdx]) {
      sorted = [{ ...state.shows[state.editFormIdx], _idx: state.editFormIdx }, ...sorted];
    }

    editSelect.innerHTML = '';
    sorted.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s._idx;
      opt.textContent = showFullNameLabel(s);
      editSelect.appendChild(opt);
    });

    const available = Array.from(editSelect.options).map(o => Number(o.value));
    let target = null;
    if (state.editFormIdx !== null && available.includes(state.editFormIdx)) target = state.editFormIdx;
    else if (prevValue !== '' && available.includes(Number(prevValue))) target = Number(prevValue);
    else if (available.length > 0) target = available[0];

    if (target !== null) {
      editSelect.value = String(target);
      // Only (re)load when explicitly requested (first open / after a save)
      // or when the select no longer matches the loaded form.
      if (reloadEditForm || target !== state.editFormIdx) loadShowToEditForm(target);
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
  document.getElementById('editRating').value = show.rating != null ? show.rating : '';
  document.getElementById('editImage').value = show.image || '';
  document.getElementById('editYear').value = show.year || '';
  setCheckedTags('editTagGroup', show.tags);

  // Multiple Vietsub + Original link rows (shared: both get a starter row
  // when the show has no links yet, so the empty list never looks broken)
  fillEditLinkRows('editVietsubLinksList',
    (Array.isArray(show.vietnameseWatchUrls) && show.vietnameseWatchUrls.length > 0)
      ? show.vietnameseWatchUrls
      : (show.vietnameseWatchUrl ? [{ label: 'Nguồn Vietsub', url: show.vietnameseWatchUrl }] : []),
    'Nguồn Vietsub');

  fillEditLinkRows('editOriginalLinksList',
    (Array.isArray(show.chineseWatchUrls) && show.chineseWatchUrls.length > 0)
      ? show.chineseWatchUrls
      : (show.chineseWatchUrl ? [{ label: 'Nguồn bản gốc', url: show.chineseWatchUrl }] : []),
    'Nguồn bản gốc');

  document.getElementById('editCast').value = show.detailNotes || '';
  document.getElementById('editDesc').value = show.description || '';

  state.editFormIdx = index;
  state.editFormSnapshot = readEditFormSnapshot();
}

function fillEditLinkRows(containerId, links, emptyRowLabel) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const list = Array.isArray(links) ? links : [];
  list.forEach(l => container.appendChild(createDynamicLinkRow(l.label, l.url, l.episodes)));
  if (list.length === 0) container.appendChild(createDynamicLinkRow(emptyRowLabel, ''));
}

// Snapshot of every field saveEditedShow() writes - used to detect unsaved
// edits so a search/rebuild never silently discards the user's work.
function readEditFormSnapshot() {
  const val = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  return JSON.stringify({
    vn: val('editVn'), zh: val('editZh'), en: val('editEn'),
    country: val('editCountry'), status: val('editStatus'),
    platform: val('editPlatform'), time: val('editTime'), rating: val('editRating'),
    image: val('editImage'), year: val('editYear'),
    tags: getCheckedTags('editTagGroup'),
    vlinks: collectDynamicLinks('editVietsubLinksList'),
    olinks: collectDynamicLinks('editOriginalLinksList'),
    cast: val('editCast'), desc: val('editDesc')
  });
}

function isEditFormDirty() {
  if (state.editFormIdx === null || !state.editFormSnapshot) return false;
  return readEditFormSnapshot() !== state.editFormSnapshot;
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
  unlockPageScrollIfFree('episodeEditorModal');
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
  const safeUrl = sanitizeHttpUrl(url);
  if (!safeUrl) {
    showToast('Link không hợp lệ (phải bắt đầu bằng http:// hoặc https://).', 'fa-triangle-exclamation');
    urlInput.focus();
    return;
  }
  episodeDraft = episodeDraft.filter(e => e.ep !== ep);
  episodeDraft.push({ ep, url: safeUrl });
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
      b.onclick = () => {
        const u = sanitizeHttpUrl(e.url);
        if (u) window.open(u, '_blank', 'noopener');
      };
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
  const ratingVal = parseFloat(document.getElementById('editRating').value);
  if (Number.isFinite(ratingVal)) show.rating = ratingVal;
  else delete show.rating; // empty rating stays empty instead of becoming a fake 5.0
  show.image = document.getElementById('editImage').value.trim();
  show.year = document.getElementById('editYear').value.trim(); // clearing the field is allowed
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
  // Rebuild the filter dropdowns BEFORE filtering: they can reset
  // state.filters.platform/year, and the grid must reflect the final state.
  populatePlatformDropdown();
  populateYearDropdown();
  applyFilters();
  updateHeroStats();          // status may have changed (hero counters)
  setupSpotlightShow();
  populateSettingsSelects();  // refresh A-Z labels after a rename
  renderStagedPins();
  state.editFormSnapshot = readEditFormSnapshot(); // form is now clean
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
  const addRatingVal = parseFloat(document.getElementById('addRating').value);

  const newShow = {
    vietnamese: vn,
    chinese: document.getElementById('addZh').value.trim(),
    english: document.getElementById('addEn').value.trim(),
    country: document.getElementById('addCountry').value,
    status: document.getElementById('addStatus').value,
    platform: document.getElementById('addPlatform').value.trim() || 'Online',
    time: document.getElementById('addTime').value.trim(),
    // No rating typed -> no rating at all (shown as "–"), never a fake 5.0
    rating: Number.isFinite(addRatingVal) ? addRatingVal : undefined,
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
  // Dropdowns first: they can rewrite state.filters, then the grid filters on
  // the final state (same order as saveEditedShow).
  populatePlatformDropdown();
  populateYearDropdown();
  applyFilters();
  populateSettingsSelects();

  showToast(`Đã thêm show mới: "${newShow.vietnamese}"!`, 'fa-plus');

  // Reset the WHOLE add form (previously country/status/platform/time/rating/
  // year were left filled from the previous entry)
  ['addVn', 'addZh', 'addEn', 'addImage', 'addCast', 'addDesc',
   'addPlatform', 'addTime', 'addRating', 'addYear'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const addCountry = document.getElementById('addCountry');
  if (addCountry) addCountry.value = 'china';
  const addStatus = document.getElementById('addStatus');
  if (addStatus) addStatus.value = 'airing';
  const vList = document.getElementById('addVietsubLinksList');
  if (vList) vList.innerHTML = '';
  const oList = document.getElementById('addOriginalLinksList');
  if (oList) oList.innerHTML = '';
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

  if (!targetEl || !editorModal || !editorTextarea || !editorTitle) return;

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

async function resetDataToDefault() {
  if (confirm('Bạn có chắc muốn khôi phục về dữ liệu gốc? Tất cả các show đã sửa/thêm cục bộ sẽ bị đặt lại.')) {
    try {
      localStorage.removeItem('datinghub_local_shows');
      localStorage.removeItem('datinghub_spotlight');
    } catch (e) { /* storage blocked */ }
    state.spotlightSlugs = [];
    await loadShowsData(); // wait for the file before announcing success
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

  // Desktop + Mobile Search (debounced: avoid re-render on every keystroke).
  // Both inputs share one state sync so the value AND the clear-button state
  // stay identical whichever field the user types in.
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchClearBtn = document.getElementById('mobileSearchClearBtn');
  const debouncedApplyFilters = debounce(() => applyFilters(), 250);

  const syncSearchState = (rawValue) => {
    state.filters.search = rawValue; // raw (untrimmed): a trailing space must be typeable
    if (searchInput && searchInput.value !== rawValue) searchInput.value = rawValue;
    if (mobileSearchInput && mobileSearchInput.value !== rawValue) mobileSearchInput.value = rawValue;
    const hasValue = rawValue.trim().length > 0;
    if (searchClearBtn) searchClearBtn.classList.toggle('active', hasValue);
    if (mobileSearchClearBtn) mobileSearchClearBtn.classList.toggle('active', hasValue);
  };

  const onSearchInput = (e) => {
    syncSearchState(e.target.value);
    debouncedApplyFilters();
  };
  if (searchInput) searchInput.addEventListener('input', onSearchInput);
  if (mobileSearchInput) mobileSearchInput.addEventListener('input', onSearchInput);

  const clearSearch = (focusEl) => {
    syncSearchState('');
    applyFilters();
    if (focusEl) focusEl.focus();
  };
  if (searchClearBtn) searchClearBtn.addEventListener('click', () => clearSearch(searchInput));
  if (mobileSearchClearBtn) mobileSearchClearBtn.addEventListener('click', () => clearSearch(mobileSearchInput));

  // Mobile Filter Accordion Toggle
  const btnMobileFilterToggle = document.getElementById('btnMobileFilterToggle');
  const filterRowControls = document.getElementById('filterRowControls');
  if (btnMobileFilterToggle && filterRowControls) {
    btnMobileFilterToggle.addEventListener('click', () => {
      const expanded = filterRowControls.classList.toggle('expanded');
      btnMobileFilterToggle.classList.toggle('active', expanded);
      btnMobileFilterToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
    // Initial state must match the CSS (controls are always visible on desktop)
    btnMobileFilterToggle.setAttribute(
      'aria-expanded',
      getComputedStyle(filterRowControls).display !== 'none' ? 'true' : 'false'
    );
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
      document.querySelectorAll('.btn-filter-pill').forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-pressed', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-pressed', 'true');
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
    btnViewGrid.setAttribute('aria-pressed', savedView === 'grid' ? 'true' : 'false');
    btnViewList.setAttribute('aria-pressed', savedView === 'list' ? 'true' : 'false');

    const saveViewMode = mode => {
      try { localStorage.setItem('datinghub_viewmode', mode); } catch (e) {}
    };

    btnViewGrid.addEventListener('click', () => {
      state.viewMode = 'grid';
      btnViewGrid.classList.add('active');
      btnViewList.classList.remove('active');
      btnViewGrid.setAttribute('aria-pressed', 'true');
      btnViewList.setAttribute('aria-pressed', 'false');
      saveViewMode('grid');
      renderShows();
    });

    btnViewList.addEventListener('click', () => {
      state.viewMode = 'list';
      btnViewList.classList.add('active');
      btnViewGrid.classList.remove('active');
      btnViewList.setAttribute('aria-pressed', 'true');
      btnViewGrid.setAttribute('aria-pressed', 'false');
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

  // Warm the fullscreen backdrop blur once while the browser is idle. The
  // first modal open otherwise sets up that blur pipeline right on the click
  // frame (a visible hitch); every later open reuses the warm pipeline.
  const warmBackdropBlur = () => {
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;'
      + 'pointer-events:none;z-index:-1;opacity:0.01;'
      + 'backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
    document.body.appendChild(probe);
    requestAnimationFrame(() => requestAnimationFrame(() => probe.remove()));
  };
  if (window.requestIdleCallback) requestIdleCallback(warmBackdropBlur, { timeout: 3000 });
  else setTimeout(warmBackdropBlur, 1500);

  // Hover preload: warm the 600px modal poster into cache while the user is
  // still deciding, so opening never decodes mid-morph (once per photo).
  // pointerdown covers phones (no hover): the press that opens the modal
  // gives the proxy image a head start before the click lands.
  const warmedPosters = new Set();
  const warmPosterFrom = target => {
    const img = target && target.closest
      ? target.closest('.card-poster-img, .spotlight-poster, .list-item-poster')
      : null;
    if (!img) return;
    const orig = img.getAttribute('data-original-src');
    if (!orig || warmedPosters.has(orig)) return;
    warmedPosters.add(orig);
    warmModalPoster(getProxiedImageUrl(orig, 600));
  };
  document.addEventListener('mouseover', e => warmPosterFrom(e.target), { passive: true });
  document.addEventListener('pointerdown', e => warmPosterFrom(e.target), { passive: true });

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
      if (e.target !== modalOverlay) return;
      // Double-click on a card: the 2nd click lands on the backdrop of the
      // modal that just opened and would close it instantly (reads as a blink).
      if (performance.now() - state.openedAt < 450) return;
      closeShowDetail();
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
      const next = parseInt(e.target.value, 10);
      if (isNaN(next) || next === state.editFormIdx) return;
      // Switching shows would throw away unsaved edits - make it explicit.
      if (isEditFormDirty() &&
          !window.confirm('Form đang có thay đổi chưa lưu. Chuyển sang show khác sẽ mất thay đổi. Tiếp tục?')) {
        e.target.value = state.editFormIdx !== null ? String(state.editFormIdx) : '';
        return;
      }
      loadShowToEditForm(next);
    });
  }

  // Dynamic link add buttons (Requirement 5): one table instead of 4 copies
  [
    ['btnAddEditVietsubLink', 'editVietsubLinksList', 'Nguồn Vietsub'],
    ['btnAddEditOriginalLink', 'editOriginalLinksList', 'Nơi chiếu bản gốc'],
    ['btnAddAddVietsubLink', 'addVietsubLinksList', 'Nguồn Vietsub'],
    ['btnAddAddOriginalLink', 'addOriginalLinksList', 'Nơi chiếu bản gốc']
  ].forEach(([btnId, listId, label]) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const list = document.getElementById(listId);
      if (list) list.appendChild(createDynamicLinkRow(label, ''));
    });
  });

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
  document.getElementById('btnCopyFavBackup')?.addEventListener('click', copyFavoritesBackup);
  document.getElementById('btnDownloadFavBackup')?.addEventListener('click', downloadFavoritesBackup);
  document.getElementById('btnToggleFavRestore')?.addEventListener('click', () => {
    const box = document.getElementById('favRestoreBox');
    if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('favRestoreFile')?.addEventListener('change', (e) => {
    const file = e.target && e.target.files ? e.target.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const area = document.getElementById('favRestoreText');
      if (area) area.value = typeof reader.result === 'string' ? reader.result : '';
      showToast(`Đã nạp file "${file.name}", bấm "Khôi phục ngay"`, 'fa-file-import');
    };
    reader.onerror = () => showToast('Không đọc được file, hãy thử lại', 'fa-triangle-exclamation');
    reader.readAsText(file);
  });
  document.getElementById('btnDoFavRestore')?.addEventListener('click', () => {
    const area = document.getElementById('favRestoreText');
    importFavoritesBackup(area ? area.value : '');
    refreshFavBackupUI();
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Never hijack typing: any editable field (incl. modal forms) keeps '/'.
      const el = document.activeElement;
      const typing = el && (
        el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
        el.isContentEditable
      );
      const modalOpen = !!document.querySelector('.modal-overlay.active, #imageLightbox.open');
      if (typing || modalOpen || e.defaultPrevented) return;
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
    const isOwnBack = state.ownBackAt && (performance.now() - state.ownBackAt < 1500);
    state.ownBackAt = 0;

    if (isOwnBack) {
      // Our own history.back() from closing. If a newer modal opened before
      // this event landed, keep it and only re-sync the URL - otherwise this
      // traversal used to close the fresh modal (blink / reopen blip).
      if (isOpen && state.activeShow) {
        const key = hashKeyOfShow(state.activeShow);
        if (key && hash !== `#show=${key}`) {
          window.history.replaceState({}, '', `#show=${key}`);
        }
      }
      return;
    }

    if (isOpen && !hash.startsWith('#show=')) {
      state.pushedShowHash = false;
      closeShowDetail(false);
    } else if (isOpen && hash.startsWith('#show=')) {
      // Forward to another show while one is open: switch in place.
      const key = hash.replace('#show=', '');
      const cur = state.activeShow ? hashKeyOfShow(state.activeShow) : '';
      if (key !== cur) {
        const match = resolveShowFromHash(key);
        if (match) {
          state.pushedShowHash = false;
          openShowDetail(match);
        }
      }
    } else if (!isOpen && hash.startsWith('#show=')) {
      const match = resolveShowFromHash(hash.replace('#show=', ''));
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
    dragging = false;
    if (dy > 120) {
      // Keep the dragged offset: the close slide continues from it
      // (resetDrag would snap the sheet back before the exit animation).
      closeShowDetail();
    } else {
      // Spring back from the offset instead of snapping to 0.
      content.style.transition = 'transform 300ms cubic-bezier(.4, 0, .2, 1)';
      content.style.transform = '';
    }
  });
  content.addEventListener('touchcancel', resetDrag);
}

// App Entry Point
document.addEventListener('DOMContentLoaded', () => {
  console.log('dating-hub app.js?v=20261005c');
  initTheme();
  applyAdminGate();
  initFavorites();
  initEventListeners();
  renderShowsSkeleton(8);
  loadShowsData();
});
