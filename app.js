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
    sort: 'airing-first', // Default sort is airing-first
    onlyFavorites: false
  },
  viewMode: 'grid', // 'grid' | 'list'
  theme: 'dark',
  favorites: [],
    spotlightSlugs: [],
  activeShow: null,
  activeEditorTargetId: null
};

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

// Format year string nicely (e.g. "1-6-2026" -> "2026", "2025" -> "2025")
function formatYear(yearStr) {
  if (!yearStr) return '';
  const match = yearStr.toString().match(/\b(20\d\d)\b/);
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
// THEME MANAGER
// ============================================================
function initTheme() {
  const savedTheme = localStorage.getItem('datinghub_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  state.theme = savedTheme || (prefersDark ? 'dark' : 'light');
  applyTheme(state.theme);

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('datinghub_theme', state.theme);
      applyTheme(state.theme);
      showToast(`Đã chuyển sang giao diện ${state.theme === 'dark' ? 'Tối' : 'Sáng'}`);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    themeIcon.title = theme === 'dark' ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối';
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
    const localModified = localStorage.getItem('datinghub_local_shows');
    let data;

    if (localModified) {
      try {
        data = JSON.parse(localModified);
      } catch (e) {
        data = null;
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

    // Preserve original file index for "None / Original sort"
    data.forEach((item, index) => {
      if (item._origIndex === undefined) item._origIndex = index;
    });

    state.shows = data;
    if (healedTitles > 0 && localModified) saveShowsToLocalStorage();
    state.spotlightSlugs = loadPinnedSpotlightSlugs();

    updateHeroStats();
    populatePlatformDropdown();
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
    localStorage.setItem('datinghub_local_shows', JSON.stringify(state.shows));
  } catch (e) {
    console.warn('LocalStorage limit exceeded');
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

function populatePlatformDropdown() {
  const select = document.getElementById('platformSelect');
  if (!select) return;

  const platforms = new Set();
  state.shows.forEach(s => {
    if (s.platform && s.platform !== 'TBA') platforms.add(s.platform.trim());
  });

  const sortedPlatforms = Array.from(platforms).sort();
  select.innerHTML = '<option value="all">Mọi nền tảng</option>';
  sortedPlatforms.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
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
  box.innerHTML = `<div style="font-size: 13px; font-weight: 700; margin-bottom: 2px;">Đã ghim (${staged.length}/${MAX_PINNED_SHOWS}) — show đầu hiển thị trước:</div>` + staged.map((slug, i) => {
    const show = state.shows.find(s => slugify(s.vietnamese) === slug);
    const name = show ? show.vietnamese : slug;
    return `<div class="pinned-show-item">
      <span class="pinned-show-num">${i + 1}</span>
      <span class="pinned-show-name">${escapeHtml(name)}</span>
      <span class="pinned-move-group">
        <button type="button" class="btn-pin-move" data-slug="${escapeHtml(slug)}" data-move="-1" title="Chuyển lên trên"${i === 0 ? ' disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
        <button type="button" class="btn-pin-move" data-slug="${escapeHtml(slug)}" data-move="1" title="Chuyển xuống dưới"${i === staged.length - 1 ? ' disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
      </span>
      <button type="button" class="btn-remove-row btn-unpin" data-slug="${escapeHtml(slug)}" title="Bỏ ghim"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  }).join('');
  box.querySelectorAll('.btn-unpin').forEach(btn => {
    btn.onclick = () => {
      stagedSpotlightSlugs = getStagedPins().filter(s => s !== btn.dataset.slug);
      renderStagedPins();
    };
  });
  box.querySelectorAll('.btn-pin-move').forEach(btn => {
    btn.onclick = () => {
      const staged = getStagedPins();
      const i = staged.indexOf(btn.dataset.slug);
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
      .map(slug => state.shows.find(s => slugify(s.vietnamese) === slug))
      .filter(Boolean)
      .slice(0, MAX_PINNED_SHOWS);
  }
  spotlightQueue = queue.length > 0 ? queue : getDefaultSpotlightCandidates();
  spotlightIndex = 0;
  if (spotlightQueue.length === 0) return;
  renderSpotlightShow(spotlightQueue[0]);
  renderSpotlightDots();
  restartSpotlightTimer();
}

function restartSpotlightTimer() {
  clearInterval(spotlightTimer);
  spotlightTimer = null;
  if (spotlightQueue.length > 1) {
    spotlightTimer = setInterval(() => {
      spotlightIndex = (spotlightIndex + 1) % spotlightQueue.length;
      renderSpotlightShow(spotlightQueue[spotlightIndex]);
      renderSpotlightDots();
    }, 6000);
  }
}

function goSpotlight(index) {
  if (spotlightQueue.length === 0) return;
  spotlightIndex = (index + spotlightQueue.length) % spotlightQueue.length;
  renderSpotlightShow(spotlightQueue[spotlightIndex]);
  renderSpotlightDots();
  restartSpotlightTimer();
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
  }
}

function renderSpotlightShow(candidate) {
  if (!candidate) return;

  const poster = document.getElementById('spotlightPoster');
  const title = document.getElementById('spotlightTitle');
  const subs = document.getElementById('spotlightSubs');
  const desc = document.getElementById('spotlightDesc');
  const country = document.getElementById('spotlightCountry');
  const rating = document.getElementById('spotlightRating');

  if (poster) {
    delete poster.dataset.origTried;
    if (candidate.image) {
      poster.setAttribute('data-original-src', candidate.image);
      poster.src = getProxiedImageUrl(candidate.image, 360);
    } else {
      poster.removeAttribute('data-original-src');
      poster.src = './images/show-0.jpg';
    }
    poster.onerror = () => handlePosterImgError(poster, 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg');
  }
  if (title) title.textContent = candidate.vietnamese || candidate.english;

  if (subs) {
    subs.innerHTML = `
      ${candidate.english ? `<span class="name-chip">${escapeHtml(candidate.english)} <button class="btn-copy-name" title="Sao chép tên tiếng Anh" onclick="copyText('${escapeHtml(candidate.english)}', 'tên tiếng Anh', event)"><i class="fa-regular fa-copy"></i></button></span>` : ''}
    `;
  }

  if (desc) desc.textContent = candidate.description || 'Chương trình truyền hình thực tế hẹn hò đặc sắc.';
  if (country) {
    const cInfo = getCountryInfo(candidate.country);
    country.innerHTML = `${countryFlagHtml(candidate.country)} ${cInfo.name}`;
  }
  if (rating) rating.innerHTML = `<i class="fa-solid fa-star" style="color: #fbbf24;"></i> ${candidate.rating ? Number(candidate.rating).toFixed(1) : '5.0'}`;

  const watchBtn = document.getElementById('btnSpotlightWatch');
  const detailBtn = document.getElementById('btnSpotlightDetail');
  if (watchBtn) watchBtn.onclick = () => openShowDetail(candidate, 'tab-watch');
  if (detailBtn) detailBtn.onclick = () => openShowDetail(candidate, 'tab-desc');

  const heroEl = document.getElementById('heroSpotlight');
  if (heroEl) {
    heroEl.classList.remove('spotlight-enter');
    void heroEl.offsetWidth;
    heroEl.classList.add('spotlight-enter');
  }
}

// ============================================================
// FILTERING & SEARCH
// ============================================================
function applyFilters() {
  const { search, country, status, platform, tag, sort, onlyFavorites } = state.filters;
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
    sort: 'airing-first',
    onlyFavorites: false
  };

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  if (mobileSearchInput) mobileSearchInput.value = '';

  document.getElementById('searchClearBtn')?.classList.remove('active');
  document.getElementById('mobileSearchClearBtn')?.classList.remove('active');

  document.querySelectorAll('#countryPillsContainer .pill-country').forEach(p => {
    p.classList.toggle('active', p.dataset.country === 'all');
  });

  const mobileCountrySelect = document.getElementById('mobileCountrySelect');
  if (mobileCountrySelect) mobileCountrySelect.value = 'all';

  document.querySelectorAll('.btn-filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.status === 'all');
  });

  const platformSelect = document.getElementById('platformSelect');
  if (platformSelect) platformSelect.value = 'all';

  const tagSelect = document.getElementById('tagSelect');
  if (tagSelect) tagSelect.value = 'all';

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
  state.filteredShows.slice(start, end).forEach(show => {
    fragment.appendChild(state.viewMode === 'grid' ? createGridCard(show) : createListItem(show));
  });
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
  card.onclick = () => openShowDetail(show);

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const ratingValue = show.rating ? Number(show.rating).toFixed(1) : '5.0';
  const vnTitleEscaped = escapeHtml(fixBrokenTitleCase(show.vietnamese));
  const enTitleEscaped = escapeHtml(fixBrokenTitleCase(show.english) || '');
  const yearFormatted = formatYear(show.year);

  let posterHtml = '';
  if (show.image) {
    posterHtml = `<img src="${escapeHtml(getProxiedImageUrl(show.image, 400))}" data-original-src="${escapeHtml(show.image)}" alt="${vnTitleEscaped}" class="card-poster-img" loading="lazy" decoding="async" onload="this.classList.add('loaded')">`;
  } else {
    posterHtml = `<div class="card-poster-fallback"><i class="fa-solid fa-heart fallback-icon"></i><div class="fallback-title">${vnTitleEscaped}</div></div>`;
  }

  card.innerHTML = `
    <div class="card-poster-wrapper">
      ${posterHtml}
      <div class="card-poster-gradient">
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
  }

  // Bind Actions
  const watchBtn = card.querySelector('[data-action="watch"]');
  if (watchBtn) watchBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-watch'); };

  const detailBtn = card.querySelector('[data-action="detail"]');
  if (detailBtn) detailBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-desc'); };

  return card;
}

function createListItem(show) {
  const item = document.createElement('div');
  item.className = 'show-list-item';
  item.onclick = () => openShowDetail(show);

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const vnTitleEscaped = escapeHtml(fixBrokenTitleCase(show.vietnamese));
  const yearFormatted = formatYear(show.year);
  const listPosterOrig = show.image || '';
  const listPosterSrc = listPosterOrig
    ? getProxiedImageUrl(listPosterOrig, 140)
    : 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg';

  item.innerHTML = `
    <img src="${escapeHtml(listPosterSrc)}"${listPosterOrig ? ` data-original-src="${escapeHtml(listPosterOrig)}"` : ''} alt="${vnTitleEscaped}" class="list-item-poster" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="handlePosterImgError(this, 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg');">
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
  if (watchBtn) watchBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-watch'); };

  return item;
}

// ============================================================
// SHOW DETAIL MODAL (FAVICONS & COPY BUTTONS IN MODAL)
// ============================================================
function openShowDetail(show, defaultTab = 'tab-watch') {
  state.activeShow = show;
  const modal = document.getElementById('detailModal');
  if (!modal) return;

  const slug = slugify(show.vietnamese);
  if (slug) window.history.replaceState(null, '', `#show=${slug}`);

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
      ${show.chinese ? `<span class="name-chip">${escapeHtml(show.chinese)} <button class="btn-copy-name" title="Sao chép tên tiếng Trung" onclick="copyText('${escapeHtml(show.chinese)}', 'tên tiếng Trung', event)"><i class="fa-regular fa-copy"></i> Copy</button></span>` : ''}
      ${show.english ? `<span class="name-chip">${escapeHtml(show.english)} <button class="btn-copy-name" title="Sao chép tên tiếng Anh" onclick="copyText('${escapeHtml(show.english)}', 'tên tiếng Anh', event)"><i class="fa-regular fa-copy"></i> Copy</button></span>` : ''}
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

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeShowDetail() {
  const modal = document.getElementById('detailModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  state.activeShow = null;

  if (window.location.hash.startsWith('#show=')) {
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
  document.body.style.overflow = 'hidden';
}

function closePosterLightbox() {
  const box = document.getElementById('imageLightbox');
  if (!box) return;
  lbPointers.clear();
  box.classList.remove('open');
  box.setAttribute('aria-hidden', 'true');
  const detailModal = document.getElementById('detailModal');
  if (!detailModal || !detailModal.classList.contains('active')) {
    document.body.style.overflow = '';
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
  openShowDetail(show);
  showToast(`Khám phá ngẫu nhiên: "${show.vietnamese}" 🎲`, 'fa-dice');
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
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
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
      opt.value = slugify(s.vietnamese);
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
    document.body.style.overflow = 'hidden';
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
    document.body.style.overflow = '';
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
  saveShowsToLocalStorage();
  updateHeroStats();
  applyFilters();
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

  // Desktop Search
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.trim();
      const mobInput = document.getElementById('mobileSearchInput');
      if (mobInput) mobInput.value = state.filters.search;
      if (searchClearBtn) searchClearBtn.classList.toggle('active', state.filters.search.length > 0);
      applyFilters();
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
      applyFilters();
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

  // Country Pills (Desktop & Tablet)
  const countryContainer = document.getElementById('countryPillsContainer');
  if (countryContainer) {
    countryContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-country');
      if (!pill) return;

      countryContainer.querySelectorAll('.pill-country').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.country = pill.dataset.country;

      // Sync mobile country select
      const mobSelect = document.getElementById('mobileCountrySelect');
      if (mobSelect) mobSelect.value = state.filters.country;

      applyFilters();
    });
  }

  // Mobile Country Select (inside accordion)
  const mobileCountrySelect = document.getElementById('mobileCountrySelect');
  if (mobileCountrySelect) {
    mobileCountrySelect.addEventListener('change', (e) => {
      state.filters.country = e.target.value;
      if (countryContainer) {
        countryContainer.querySelectorAll('.pill-country').forEach(p => {
          p.classList.toggle('active', p.dataset.country === state.filters.country);
        });
      }
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
  // Desktop: site header (search bar) always visible; filter bar (country + sort)
  // hides when scrolling down and shows when scrolling up. Mobile: always visible.
  const btnBackToTop = document.getElementById('btnBackToTop');
  const filterScrollHeader = document.querySelector('.site-header');
  const filterScrollSection = document.querySelector('.filter-section');
  const filterScrollMain = document.querySelector('main');
  let filterLastScrollY = window.scrollY;
  let filterScrollUpTravel = 0;
  let filterHideThreshold = Infinity;
  let backToTopShown = false;
  let filterBarHidden = false;
  let scrollTicking = false;

  function measureFilterBar() {
    if (!filterScrollHeader || !filterScrollMain) return;
    const headerHeight = filterScrollHeader.offsetHeight || 68;
    filterHideThreshold = filterScrollMain.getBoundingClientRect().top + window.scrollY - headerHeight;
  }

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

    if (filterScrollHeader && filterScrollSection && filterScrollMain) {
      const delta = currentY - filterLastScrollY;
      if (window.innerWidth <= 768) {
        filterScrollUpTravel = 0;
        if (filterBarHidden) {
          filterBarHidden = false;
          filterScrollSection.classList.remove('filters-hidden');
        }
      } else if (delta > 0) {
        filterScrollUpTravel = 0;
        if (!filterBarHidden && currentY >= filterHideThreshold) {
          filterBarHidden = true;
          filterScrollSection.classList.add('filters-hidden');
        }
      } else if (delta < 0) {
        filterScrollUpTravel += -delta;
        if (filterScrollUpTravel >= 4 && filterBarHidden) {
          filterBarHidden = false;
          filterScrollSection.classList.remove('filters-hidden');
        }
      }
    }
    filterLastScrollY = currentY;
  }

  measureFilterBar();
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(handleScrollFrame);
    }
  }, { passive: true });
  window.addEventListener('load', measureFilterBar);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureFilterBar);
  let filterMeasureTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(filterMeasureTimer);
    filterMeasureTimer = setTimeout(measureFilterBar, 150);
  });
  if (btnBackToTop) {
    btnBackToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Watch-link tooltip: full label on hover (desktop) / long-press (mobile)
  initWatchLinkTips();

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
      const slug = select ? select.value : '';
      if (!slug) {
        showToast('Hãy chọn 1 show trong danh sách trước.', 'fa-circle-info');
        return;
      }
      const staged = getStagedPins();
      if (staged.includes(slug)) {
        showToast('Show này đã được ghim rồi.', 'fa-circle-info');
        return;
      }
      if (staged.length >= MAX_PINNED_SHOWS) {
        showToast(`Chỉ ghim tối đa ${MAX_PINNED_SHOWS} show hot.`, 'fa-triangle-exclamation');
        return;
      }
      staged.push(slug);
      renderStagedPins();
    });
  }

  const btnSaveSpotlight = document.getElementById('btnSaveSpotlight');
  if (btnSaveSpotlight) {
    btnSaveSpotlight.addEventListener('click', () => {
      const staged = getStagedPins().slice(0, MAX_PINNED_SHOWS);
      // Write pin order into the data so it can be published to every visitor
      state.shows.forEach(s => { delete s.hotOrder; });
      staged.forEach((slug, i) => {
        const show = state.shows.find(s => slugify(s.vietnamese) === slug);
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
      closeShowDetail();
      closeSettingsModal();
      closeLargeEditor();
    }
  });
}

// App Entry Point
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFavorites();
  initEventListeners();
  loadShowsData();
});
