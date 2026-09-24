/**
 * DATING SHOW HUB (HẸN HÒ HUB)
 * Complete Modern Application Logic with Settings, Custom Brand Logos & Mobile Fixes
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
    sort: 'airing-first', // Default sort is airing-first as requested
    onlyFavorites: false
  },
  viewMode: 'grid', // 'grid' | 'list'
  theme: 'dark',
  favorites: [],
  spotlightSlug: '', // Pinned show slug
  activeShow: null
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

const COUNTRY_MAP = {
  china: { name: 'Trung Quốc', flag: '🇨🇳' },
  korea: { name: 'Hàn Quốc', flag: '🇰🇷' },
  japan: { name: 'Nhật Bản', flag: '🇯🇵' },
  thailand: { name: 'Thái Lan', flag: '🇹🇭' },
  hongkong: { name: 'Hồng Kông', flag: '🇭🇰' },
  taiwan: { name: 'Đài Loan', flag: '🇹🇼' },
  other: { name: 'Khác', flag: '🌏' }
};

function getCountryInfo(code) {
  return COUNTRY_MAP[code] || { name: 'Khác', flag: '🌏' };
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

// Copy helper with feedback
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
// BRAND LOGOS FOR STREAMING PLATFORMS (SVGs)
// ============================================================
function getPlatformLogoSvg(url, label) {
  const combined = ((url || '') + ' ' + (label || '')).toLowerCase();

  // 1. Bilibili (Cute Retro TV)
  if (combined.includes('bilibili')) {
    return `
      <div class="brand-logo-icon" title="Bilibili">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#00A1D6"/>
          <path d="M7 5L9.5 7.5M17 5L14.5 7.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
          <rect x="4" y="7.5" width="16" height="11.5" rx="3" fill="#fff"/>
          <circle cx="8.5" cy="12.5" r="1.5" fill="#00A1D6"/>
          <circle cx="15.5" cy="12.5" r="1.5" fill="#00A1D6"/>
          <path d="M10 15.5C11 16.5 13 16.5 14 15.5" stroke="#00A1D6" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  // 2. YouTube
  if (combined.includes('youtube') || combined.includes('youtu.be')) {
    return `
      <div class="brand-logo-icon" title="YouTube">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#FF0000"/>
          <path d="M10 8L16 12L10 16V8Z" fill="#fff"/>
        </svg>
      </div>`;
  }

  // 3. WeTV / Tencent Video
  if (combined.includes('wetv') || combined.includes('qq.com') || combined.includes('tencent')) {
    return `
      <div class="brand-logo-icon" title="WeTV / Tencent Video">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#00b578"/>
          <path d="M6 7L12 17L18 7" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 7L12 11L14 7" stroke="#ffeb3b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`;
  }

  // 4. iQIYI
  if (combined.includes('iqiyi')) {
    return `
      <div class="brand-logo-icon" title="iQIYI">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#00be06"/>
          <circle cx="12" cy="12" r="6" stroke="#fff" stroke-width="2"/>
          <circle cx="12" cy="12" r="2.5" fill="#fff"/>
        </svg>
      </div>`;
  }

  // 5. Telegram
  if (combined.includes('telegram') || combined.includes('t.me')) {
    return `
      <div class="brand-logo-icon" title="Telegram">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#24A1DE"/>
          <path d="M5 11.5L18 6.5L15 17.5L11 13.5L8.5 15.5V12.5L15 8.5L7.5 12.5L5 11.5Z" fill="#fff"/>
        </svg>
      </div>`;
  }

  // 6. Odysee
  if (combined.includes('odysee')) {
    return `
      <div class="brand-logo-icon" title="Odysee">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#E50054"/>
          <circle cx="12" cy="12" r="5" fill="#fff"/>
          <circle cx="12" cy="12" r="2.5" fill="#E50054"/>
        </svg>
      </div>`;
  }

  // 7. Ok.ru
  if (combined.includes('ok.ru')) {
    return `
      <div class="brand-logo-icon" title="Ok.ru">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#EE8208"/>
          <circle cx="12" cy="8.5" r="3" stroke="#fff" stroke-width="1.8"/>
          <path d="M8 14.5C9.5 16 14.5 16 16 14.5M9 16L7 18.5M15 16L17 18.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  // 8. Dzen / Yandex
  if (combined.includes('dzen') || combined.includes('yandex')) {
    return `
      <div class="brand-logo-icon" title="Dzen">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#111"/>
          <path d="M12 4V20M4 12H20M6.5 6.5L17.5 17.5M6.5 17.5L17.5 6.5" stroke="#FF3333" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>`;
  }

  // 9. Netflix
  if (combined.includes('netflix')) {
    return `
      <div class="brand-logo-icon" title="Netflix">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#000"/>
          <path d="M7 5V19L10 19V8.5L14 19H17V5L14 5V15.5L10 5H7Z" fill="#E50914"/>
        </svg>
      </div>`;
  }

  // 10. Mango TV (Hunan)
  if (combined.includes('mango') || combined.includes('mgtv')) {
    return `
      <div class="brand-logo-icon" title="Mango TV">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#FF5500"/>
          <path d="M12 5C8 5 5 8.5 5 13C5 17 8.5 19 12 19C15.5 19 19 17 19 13C19 8.5 16 5 12 5Z" fill="#fff"/>
          <circle cx="12" cy="12" r="3" fill="#FF5500"/>
        </svg>
      </div>`;
  }

  // 11. Youku
  if (combined.includes('youku')) {
    return `
      <div class="brand-logo-icon" title="Youku">
        <svg viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#1482F0"/>
          <circle cx="9" cy="12" r="4" fill="#fff"/>
          <circle cx="15" cy="12" r="4" fill="#FF1E56"/>
        </svg>
      </div>`;
  }

  // Fallback: Modern Video Player Badge
  return `
    <div class="brand-logo-icon" title="Video Player">
      <svg viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#ff2e7e"/>
        <path d="M9.5 8L16 12L9.5 16V8Z" fill="#fff"/>
      </svg>
    </div>`;
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

// ============================================================
// DATA LOADING & PERSISTENCE
// ============================================================
async function loadShowsData() {
  try {
    // Check if user has locally modified shows in localStorage
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

    // Attach original index for "None / Original sort"
    data.forEach((item, index) => {
      if (item._origIndex === undefined) item._origIndex = index;
    });

    state.shows = data;

    // Load pinned spotlight show from localStorage
    state.spotlightSlug = localStorage.getItem('datinghub_spotlight') || '';

    updateHeroStats();
    populatePlatformDropdown();
    setupSpotlightShow();
    populateSettingsSelects();
    applyFilters();
    checkUrlHash();
  } catch (err) {
    console.error('Lỗi khi tải showsData.json:', err);
    showToast('Không tải được dữ liệu show. Vui lòng thử tải lại trang.', 'fa-triangle-exclamation');
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

// ============================================================
// SPOTLIGHT PINNING (HERO BANNER)
// ============================================================
function setupSpotlightShow() {
  let candidate = null;

  // 1. Look for user's pinned show
  if (state.spotlightSlug) {
    candidate = state.shows.find(s => slugify(s.vietnamese) === state.spotlightSlug);
  }

  // 2. Default: Look for "Tín Hiệu Con Tim S9" as specifically mentioned by user
  if (!candidate) {
    candidate = state.shows.find(s => (s.vietnamese || '').toLowerCase().includes('tín hiệu con tim s9'));
  }

  // 3. Fallback: Airing show or first show
  if (!candidate) {
    candidate = state.shows.find(s => s.status === 'airing' && s.image) || state.shows[0];
  }

  if (!candidate) return;

  const poster = document.getElementById('spotlightPoster');
  const title = document.getElementById('spotlightTitle');
  const subs = document.getElementById('spotlightSubs');
  const desc = document.getElementById('spotlightDesc');
  const country = document.getElementById('spotlightCountry');
  const platform = document.getElementById('spotlightPlatform');
  const rating = document.getElementById('spotlightRating');

  if (poster) {
    poster.src = candidate.image || './images/show-0.jpg';
    poster.onerror = () => { poster.src = 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg'; };
  }
  if (title) title.textContent = candidate.vietnamese || candidate.english;

  // Render subtitles with copy buttons
  if (subs) {
    subs.innerHTML = `
      ${candidate.chinese ? `<span class="name-chip">${escapeHtml(candidate.chinese)} <button class="btn-copy-name" title="Sao chép tên tiếng Trung" onclick="copyText('${escapeHtml(candidate.chinese)}', 'tên tiếng Trung', event)"><i class="fa-regular fa-copy"></i></button></span>` : ''}
      ${candidate.english ? `<span class="name-chip">${escapeHtml(candidate.english)} <button class="btn-copy-name" title="Sao chép tên tiếng Anh" onclick="copyText('${escapeHtml(candidate.english)}', 'tên tiếng Anh', event)"><i class="fa-regular fa-copy"></i></button></span>` : ''}
    `;
  }

  if (desc) desc.textContent = candidate.description || 'Chương trình truyền hình thực tế hẹn hò đặc sắc.';
  if (country) {
    const cInfo = getCountryInfo(candidate.country);
    country.innerHTML = `${cInfo.flag} ${cInfo.name}`;
  }
  if (platform) platform.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${candidate.platform || 'Online'}`;
  if (rating) rating.innerHTML = `<i class="fa-solid fa-star" style="color: #fbbf24;"></i> ${candidate.rating ? Number(candidate.rating).toFixed(1) : '5.0'}`;

  const watchBtn = document.getElementById('btnSpotlightWatch');
  const detailBtn = document.getElementById('btnSpotlightDetail');
  if (watchBtn) watchBtn.onclick = () => openShowDetail(candidate, 'tab-watch');
  if (detailBtn) detailBtn.onclick = () => openShowDetail(candidate, 'tab-desc');
}

// ============================================================
// FILTERING & SEARCH ENGINE
// ============================================================
function applyFilters() {
  const { search, country, status, platform, tag, sort, onlyFavorites } = state.filters;
  const searchKeyword = removeVietnameseAccents(search);

  let result = state.shows.filter(show => {
    if (onlyFavorites && !isFavorited(show)) return false;
    if (country !== 'all' && show.country !== country) return false;
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

  // SORTING (Requirement 4: Default airing-first, option none for original)
  if (sort === 'airing-first') {
    result.sort((a, b) => {
      if (a.status === 'airing' && b.status !== 'airing') return -1;
      if (b.status === 'airing' && a.status !== 'airing') return 1;
      return (a._origIndex || 0) - (b._origIndex || 0);
    });
  } else if (sort === 'none') {
    // Keep original file ordering
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
  if (countEl) countEl.textContent = state.filteredShows.length;

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
// RENDERING SHOW CARDS (SAFE ESCAPING & COPY BUTTONS)
// ============================================================
function renderShows() {
  const container = document.getElementById('showsGrid');
  const emptyState = document.getElementById('emptyState');
  if (!container) return;

  if (state.filteredShows.length === 0) {
    container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  container.style.display = state.viewMode === 'grid' ? 'grid' : 'flex';
  container.className = state.viewMode === 'grid' ? 'shows-grid' : 'shows-list';
  if (emptyState) emptyState.style.display = 'none';

  const fragment = document.createDocumentFragment();
  state.filteredShows.forEach(show => {
    const card = state.viewMode === 'grid' ? createGridCard(show) : createListItem(show);
    fragment.appendChild(card);
  });

  container.innerHTML = '';
  container.appendChild(fragment);
}

function createGridCard(show) {
  const card = document.createElement('div');
  card.className = 'show-card';
  card.onclick = () => openShowDetail(show);

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const favorited = isFavorited(show);
  const ratingValue = show.rating ? Number(show.rating).toFixed(1) : '5.0';
  const vnTitleEscaped = escapeHtml(show.vietnamese);
  const zhTitleEscaped = escapeHtml(show.chinese || '');
  const enTitleEscaped = escapeHtml(show.english || '');

  // SAFE Poster Building (Prevent quote breaking bug)
  let posterHtml = '';
  if (show.image) {
    posterHtml = `<img src="${escapeHtml(show.image)}" alt="${vnTitleEscaped}" class="card-poster-img" loading="lazy">`;
  } else {
    posterHtml = `<div class="card-poster-fallback"><i class="fa-solid fa-heart fallback-icon"></i><div class="fallback-title">${vnTitleEscaped}</div></div>`;
  }

  card.innerHTML = `
    <div class="card-poster-wrapper">
      ${posterHtml}
      <div class="card-top-badges">
        <span class="badge-status ${statusInfo.className}">${statusInfo.html}</span>
        <div class="card-action-btns">
          <button class="btn-card-icon ${favorited ? 'favorited' : ''}" title="${favorited ? 'Xóa khỏi yêu thích' : 'Lưu yêu thích'}" data-action="fav">
            <i class="${favorited ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
          </button>
          <button class="btn-card-icon" title="Sao chép link chia sẻ" data-action="share">
            <i class="fa-solid fa-share-nodes"></i>
          </button>
        </div>
      </div>
      <div class="card-poster-gradient">
        <div class="card-rating-pill">
          <i class="fa-solid fa-star"></i>
          <span>${ratingValue}</span>
        </div>
      </div>
    </div>

    <div class="card-content">
      <div class="card-meta-row">
        <span class="card-country-badge">${countryInfo.flag} ${countryInfo.name}</span>
        <span class="card-platform-badge">${escapeHtml(show.platform || 'Online')}</span>
      </div>

      <h3 class="card-title-vn" title="${vnTitleEscaped}">${vnTitleEscaped}</h3>

      <!-- Subtitles with individual Copy Buttons (Requirement 8) -->
      <div class="card-title-sub-row">
        <div class="card-sub-names" title="${zhTitleEscaped} • ${enTitleEscaped}">
          ${zhTitleEscaped ? `<span>${zhTitleEscaped}</span>` : ''}
          ${zhTitleEscaped && enTitleEscaped ? ' • ' : ''}
          ${enTitleEscaped ? `<span>${enTitleEscaped}</span>` : ''}
        </div>
        ${zhTitleEscaped ? `<button class="btn-copy-name" title="Sao chép tên tiếng Trung: ${zhTitleEscaped}" data-copy-zh="${zhTitleEscaped}"><i class="fa-regular fa-copy"></i> Trung</button>` : ''}
        ${enTitleEscaped ? `<button class="btn-copy-name" title="Sao chép tên tiếng Anh: ${enTitleEscaped}" data-copy-en="${enTitleEscaped}"><i class="fa-regular fa-copy"></i> Anh</button>` : ''}
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

  // Attach safe image onerror fallback via DOM
  const imgEl = card.querySelector('.card-poster-img');
  if (imgEl) {
    imgEl.onerror = () => {
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
  const favBtn = card.querySelector('[data-action="fav"]');
  if (favBtn) favBtn.onclick = (e) => toggleFavorite(show, e);

  const shareBtn = card.querySelector('[data-action="share"]');
  if (shareBtn) shareBtn.onclick = (e) => copyShareLink(show, e);

  const watchBtn = card.querySelector('[data-action="watch"]');
  if (watchBtn) watchBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-watch'); };

  const detailBtn = card.querySelector('[data-action="detail"]');
  if (detailBtn) detailBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-desc'); };

  // Copy Name Buttons
  const copyZhBtn = card.querySelector('[data-copy-zh]');
  if (copyZhBtn) copyZhBtn.onclick = (e) => copyText(show.chinese, 'tên tiếng Trung', e);

  const copyEnBtn = card.querySelector('[data-copy-en]');
  if (copyEnBtn) copyEnBtn.onclick = (e) => copyText(show.english, 'tên tiếng Anh', e);

  return card;
}

function createListItem(show) {
  const item = document.createElement('div');
  item.className = 'show-list-item';
  item.onclick = () => openShowDetail(show);

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const favorited = isFavorited(show);
  const vnTitleEscaped = escapeHtml(show.vietnamese);

  item.innerHTML = `
    <img src="${escapeHtml(show.image || 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg')}" alt="${vnTitleEscaped}" class="list-item-poster" onerror="this.src='https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg';">
    <div class="list-item-info">
      <div class="list-item-title">${vnTitleEscaped}</div>
      <div class="list-item-sub">
        <span>${escapeHtml(show.chinese || '')}</span>
        ${show.chinese && show.english ? '•' : ''}
        <span>${escapeHtml(show.english || '')}</span>
        ${show.chinese ? `<button class="btn-copy-name" data-copy-zh="${escapeHtml(show.chinese)}"><i class="fa-regular fa-copy"></i> Trung</button>` : ''}
        ${show.english ? `<button class="btn-copy-name" data-copy-en="${escapeHtml(show.english)}"><i class="fa-regular fa-copy"></i> Anh</button>` : ''}
      </div>
      <div class="list-item-meta">
        <span>${countryInfo.flag} ${countryInfo.name}</span>
        <span>•</span>
        <span>${escapeHtml(show.platform || 'Online')}</span>
        <span>•</span>
        <span class="badge-status ${statusInfo.className}" style="font-size: 10px; padding: 2px 6px;">${statusInfo.html}</span>
      </div>
    </div>
    <div class="list-item-actions">
      <button class="btn-card-icon ${favorited ? 'favorited' : ''}" data-action="fav" title="Yêu thích">
        <i class="${favorited ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
      </button>
      <button class="btn-primary" style="padding: 6px 14px; font-size: 12px;" data-action="watch">
        <i class="fa-solid fa-play"></i> Xem
      </button>
    </div>
  `;

  const favBtn = item.querySelector('[data-action="fav"]');
  if (favBtn) favBtn.onclick = (e) => toggleFavorite(show, e);

  const watchBtn = item.querySelector('[data-action="watch"]');
  if (watchBtn) watchBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-watch'); };

  const copyZh = item.querySelector('[data-copy-zh]');
  if (copyZh) copyZh.onclick = (e) => copyText(show.chinese, 'tên tiếng Trung', e);

  const copyEn = item.querySelector('[data-copy-en]');
  if (copyEn) copyEn.onclick = (e) => copyText(show.english, 'tên tiếng Anh', e);

  return item;
}

// ============================================================
// SHOW DETAIL MODAL (SCROLLBAR FIX + BRAND LOGOS + COPY)
// ============================================================
function openShowDetail(show, defaultTab = 'tab-watch') {
  state.activeShow = show;
  const modal = document.getElementById('detailModal');
  if (!modal) return;

  const slug = slugify(show.vietnamese);
  if (slug) window.history.replaceState(null, '', `#show=${slug}`);

  const poster = document.getElementById('modalPoster');
  if (poster) {
    poster.src = show.image || 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg';
    poster.onerror = () => { poster.src = 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg'; };
  }

  const title = document.getElementById('modalTitle');
  if (title) title.textContent = show.vietnamese;

  // Subtitles with Copy Buttons in modal
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
  if (countryBadge) countryBadge.innerHTML = `${countryInfo.flag} ${countryInfo.name}`;

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
  if (descEl) descEl.textContent = show.description || 'Chưa có thông tin tóm tắt cho show này.';

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

function switchModalTab(tabId) {
  document.querySelectorAll('#detailModal .modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('#detailModal .tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

// Watch link buttons with CUSTOM PLATFORM LOGO (Requirement 3)
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
      const btn = createWatchLinkButton(item.url, item.label || 'Xem Vietsub');
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
      const btn = createWatchLinkButton(item.url, item.label || 'Xem bản gốc');
      if (originalContainer) originalContainer.appendChild(btn);
    });
  } else {
    if (chineseGroup) chineseGroup.style.display = 'none';
  }
}

function createWatchLinkButton(url, label) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'watch-link-btn';

  const logoSvg = getPlatformLogoSvg(url, label);

  a.innerHTML = `
    <span class="watch-link-label">
      ${logoSvg}
      <span>${escapeHtml(label)}</span>
    </span>
    <i class="fa-solid fa-arrow-up-right-from-square" style="color: var(--text-muted); font-size: 11px;"></i>
  `;

  return a;
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
// SETTINGS & SHOW MANAGEMENT (Requirement 2)
// ============================================================
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  populateSettingsSelects();
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

function populateSettingsSelects() {
  const spotlightSelect = document.getElementById('spotlightSelect');
  const editSelect = document.getElementById('editShowSelect');

  if (spotlightSelect) {
    spotlightSelect.innerHTML = '';
    state.shows.forEach(s => {
      const opt = document.createElement('option');
      opt.value = slugify(s.vietnamese);
      opt.textContent = `${s.vietnamese} (${s.country || 'N/A'})`;
      if (slugify(s.vietnamese) === state.spotlightSlug) opt.selected = true;
      spotlightSelect.appendChild(opt);
    });
    updateSpotlightPreview();
  }

  if (editSelect) {
    editSelect.innerHTML = '';
    state.shows.forEach((s, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${s.vietnamese} - ${s.chinese || s.english || ''}`;
      editSelect.appendChild(opt);
    });
    loadShowToEditForm(0);
  }
}

function updateSpotlightPreview() {
  const select = document.getElementById('spotlightSelect');
  const box = document.getElementById('spotlightPreviewBox');
  if (!select || !box) return;

  const slug = select.value;
  const show = state.shows.find(s => slugify(s.vietnamese) === slug);
  if (show) {
    box.innerHTML = `
      <strong>Show được chọn:</strong> ${escapeHtml(show.vietnamese)}<br>
      <span style="color: var(--text-muted); font-size: 12px;">${escapeHtml(show.chinese || '')} • ${escapeHtml(show.english || '')} • ${escapeHtml(show.platform || 'Online')}</span>
    `;
  }
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

  const vietsubUrl = (show.vietnameseWatchUrls && show.vietnameseWatchUrls[0]) ? show.vietnameseWatchUrls[0].url : (show.vietnameseWatchUrl || '');
  document.getElementById('editVietsubUrl').value = vietsubUrl;

  document.getElementById('editCast').value = show.detailNotes || '';
  document.getElementById('editDesc').value = show.description || '';
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
  show.detailNotes = document.getElementById('editCast').value;
  show.description = document.getElementById('editDesc').value;

  const vUrl = document.getElementById('editVietsubUrl').value.trim();
  if (vUrl) {
    show.vietnameseWatchUrl = vUrl;
    if (!show.vietnameseWatchUrls || show.vietnameseWatchUrls.length === 0) {
      show.vietnameseWatchUrls = [{ url: vUrl, label: 'Nguồn Vietsub' }];
    } else {
      show.vietnameseWatchUrls[0].url = vUrl;
    }
  }

  saveShowsToLocalStorage();
  applyFilters();
  setupSpotlightShow();
  showToast(`Đã lưu cập nhật cho show "${show.vietnamese}"!`, 'fa-floppy-disk');
}

function addNewShow() {
  const vn = document.getElementById('addVn').value.trim();
  if (!vn) {
    alert('Vui lòng nhập Tên tiếng Việt cho show!');
    return;
  }

  const vUrl = document.getElementById('addVietsubUrl').value.trim();

  const newShow = {
    vietnamese: vn,
    chinese: document.getElementById('addZh').value.trim(),
    english: document.getElementById('addEn').value.trim(),
    country: document.getElementById('addCountry').value,
    status: document.getElementById('addStatus').value,
    platform: document.getElementById('addPlatform').value.trim() || 'Online',
    time: document.getElementById('addTime').value.trim(),
    rating: parseFloat(document.getElementById('addRating').value) || 5,
    image: document.getElementById('addImage').value.trim(),
    vietnameseWatchUrl: vUrl,
    vietnameseWatchUrls: vUrl ? [{ url: vUrl, label: 'Nguồn Vietsub' }] : [],
    chineseWatchUrls: [],
    detailNotes: document.getElementById('addCast').value,
    description: document.getElementById('addDesc').value,
    tags: ['normal'],
    year: new Date().getFullYear().toString(),
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
  document.getElementById('addVietsubUrl').value = '';
  document.getElementById('addCast').value = '';
  document.getElementById('addDesc').value = '';

  // Switch to Spotlight or list
  closeSettingsModal();
}

function downloadUpdatedJson() {
  // Strip temporary helper _origIndex before saving
  const cleanData = state.shows.map(s => {
    const clone = { ...s };
    delete clone._origIndex;
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
    state.spotlightSlug = '';
    loadShowsData();
    showToast('Đã khôi phục dữ liệu ban đầu', 'fa-rotate-left');
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function initEventListeners() {
  // Brand Logo Click -> Reset to top
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
      if (searchClearBtn) searchClearBtn.classList.toggle('active', state.filters.search.length > 0);
      applyFilters();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      state.filters.search = '';
      searchClearBtn.classList.remove('active');
      applyFilters();
      searchInput.focus();
    });
  }

  // Mobile Search Toggle & Input (Requirement 6)
  const btnMobileSearchToggle = document.getElementById('btnMobileSearchToggle');
  const mobileSearchBar = document.getElementById('mobileSearchBar');
  const mobileSearchInput = document.getElementById('mobileSearchInput');
  const mobileSearchClearBtn = document.getElementById('mobileSearchClearBtn');

  if (btnMobileSearchToggle && mobileSearchBar) {
    btnMobileSearchToggle.addEventListener('click', () => {
      mobileSearchBar.classList.toggle('show');
      if (mobileSearchBar.classList.contains('show') && mobileSearchInput) {
        mobileSearchInput.focus();
      }
    });
  }

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

  // Mobile Filter Accordion Toggle (Requirement 5)
  const btnMobileFilterToggle = document.getElementById('btnMobileFilterToggle');
  const filterRowControls = document.getElementById('filterRowControls');
  if (btnMobileFilterToggle && filterRowControls) {
    btnMobileFilterToggle.addEventListener('click', () => {
      filterRowControls.classList.toggle('expanded');
      btnMobileFilterToggle.classList.toggle('active');
    });
  }

  // Country Pills
  const countryContainer = document.getElementById('countryPillsContainer');
  if (countryContainer) {
    countryContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-country');
      if (!pill) return;

      countryContainer.querySelectorAll('.pill-country').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.filters.country = pill.dataset.country;
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

  // Sort Dropdown (Requirement 4)
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
    btnViewGrid.addEventListener('click', () => {
      state.viewMode = 'grid';
      btnViewGrid.classList.add('active');
      btnViewList.classList.remove('active');
      renderShows();
    });

    btnViewList.addEventListener('click', () => {
      state.viewMode = 'list';
      btnViewList.classList.add('active');
      btnViewGrid.classList.remove('active');
      renderShows();
    });
  }

  // Random Show Button
  const randomBtn = document.getElementById('btnRandomShow');
  if (randomBtn) randomBtn.addEventListener('click', pickRandomShow);

  // Reset Filters Buttons
  const resetBtn = document.getElementById('btnResetFilters');
  if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);

  const emptyResetBtn = document.getElementById('btnEmptyReset');
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

  // Back to Top Button (Requirement 7)
  const btnBackToTop = document.getElementById('btnBackToTop');
  if (btnBackToTop) {
    window.addEventListener('scroll', () => {
      btnBackToTop.classList.toggle('show', window.scrollY > 300);
    });
    btnBackToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Show Detail Modal Close
  const modalCloseBtn = document.getElementById('btnModalClose');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeShowDetail);

  const modalOverlay = document.getElementById('detailModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeShowDetail();
    });
  }

  // Detail Modal Tab Switching
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

  // Settings Modal Open/Close & Tabs (Requirement 2)
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

  const spotlightSelect = document.getElementById('spotlightSelect');
  if (spotlightSelect) {
    spotlightSelect.addEventListener('change', updateSpotlightPreview);
  }

  const btnSaveSpotlight = document.getElementById('btnSaveSpotlight');
  if (btnSaveSpotlight) {
    btnSaveSpotlight.addEventListener('click', () => {
      const select = document.getElementById('spotlightSelect');
      state.spotlightSlug = select.value;
      localStorage.setItem('datinghub_spotlight', state.spotlightSlug);
      setupSpotlightShow();
      closeSettingsModal();
      showToast('Đã ghim show lên vị trí nổi bật đầu trang! 📌', 'fa-thumbtack');
    });
  }

  const editSelect = document.getElementById('editShowSelect');
  if (editSelect) {
    editSelect.addEventListener('change', (e) => {
      loadShowToEditForm(parseInt(e.target.value, 10));
    });
  }

  const btnSaveEdited = document.getElementById('btnSaveEditedShow');
  if (btnSaveEdited) btnSaveEdited.addEventListener('click', saveEditedShow);

  const btnSubmitAdd = document.getElementById('btnSubmitAddShow');
  if (btnSubmitAdd) btnSubmitAdd.addEventListener('click', addNewShow);

  const btnDownloadJson = document.getElementById('btnDownloadJson');
  if (btnDownloadJson) btnDownloadJson.addEventListener('click', downloadUpdatedJson);

  const btnResetData = document.getElementById('btnResetData');
  if (btnResetData) btnResetData.addEventListener('click', resetDataToDefault);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput && document.activeElement !== mobileSearchInput) {
      e.preventDefault();
      if (window.innerWidth <= 768 && mobileSearchBar) {
        mobileSearchBar.classList.add('show');
        if (mobileSearchInput) mobileSearchInput.focus();
      } else if (searchInput) {
        searchInput.focus();
      }
    }
    if (e.key === 'Escape') {
      closeShowDetail();
      closeSettingsModal();
    }
  });
}

// ============================================================
// APP ENTRY POINT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFavorites();
  initEventListeners();
  loadShowsData();
});
