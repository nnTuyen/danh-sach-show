/**
 * DATING SHOW HUB (HẸN HÒ HUB)
 * Modern Application Logic & Controller
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
    sort: 'default',
    onlyFavorites: false
  },
  viewMode: 'grid', // 'grid' | 'list'
  theme: 'dark',
  favorites: [],
  activeShow: null
};

// ============================================================
// UTILITIES
// ============================================================

// Remove Vietnamese accents for fast fuzzy search
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

// Convert title to URL slug for deep linking
function slugify(str) {
  if (!str) return '';
  return removeVietnameseAccents(str)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Country label and flag helper
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

// Status label helper
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
  }, 3000);
}

// ============================================================
// THEME MANAGER (DARK & LIGHT MODE)
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
// FAVORITES (BOOKMARKS) SYSTEM
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

  // If active show is in modal, update modal button too
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
// DATA FETCHING & POPULATING
// ============================================================
async function loadShowsData() {
  try {
    const timestamp = Date.now();
    const res = await fetch(`./showsData.json?v=${timestamp}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Data is not an array');

    state.shows = data;
    updateHeroStats();
    populatePlatformDropdown();
    setupSpotlightShow();
    applyFilters();
    checkUrlHash();
  } catch (err) {
    console.error('Lỗi khi tải showsData.json:', err);
    showToast('Không tải được dữ liệu show. Vui lòng tải lại trang.', 'fa-triangle-exclamation');
  }
}

// Populate stats in hero banner
function updateHeroStats() {
  const total = state.shows.length;
  const airing = state.shows.filter(s => s.status === 'airing').length;

  const totalEl = document.getElementById('statTotalShows');
  const airingEl = document.getElementById('statAiringShows');
  if (totalEl) totalEl.textContent = total;
  if (airingEl) airingEl.textContent = airing;
}

// Populate platforms in filter dropdown
function populatePlatformDropdown() {
  const select = document.getElementById('platformSelect');
  if (!select) return;

  const platforms = new Set();
  state.shows.forEach(s => {
    if (s.platform && s.platform !== 'TBA') platforms.add(s.platform.trim());
  });

  const sortedPlatforms = Array.from(platforms).sort();
  sortedPlatforms.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    select.appendChild(opt);
  });
}

// Spotlight feature card in hero
function setupSpotlightShow() {
  // Pick an airing show with 5-star rating or first show
  const candidate = state.shows.find(s => s.status === 'airing' && s.image) || state.shows[0];
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
  if (subs) subs.textContent = [candidate.chinese, candidate.english].filter(Boolean).join(' • ');
  if (desc) desc.textContent = candidate.description || 'Chương trình truyền hình thực tế hẹn hò đặc sắc.';
  if (country) {
    const cInfo = getCountryInfo(candidate.country);
    country.innerHTML = `${cInfo.flag} ${cInfo.name}`;
  }
  if (platform) platform.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${candidate.platform || 'Online'}`;
  if (rating) rating.innerHTML = `<i class="fa-solid fa-star" style="color: #fbbf24;"></i> ${candidate.rating ? candidate.rating + '.0' : '5.0'}`;

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
    // 1. Favorites only
    if (onlyFavorites && !isFavorited(show)) {
      return false;
    }

    // 2. Country Filter
    if (country !== 'all' && show.country !== country) {
      return false;
    }

    // 3. Status Filter
    if (status !== 'all' && show.status !== status) {
      return false;
    }

    // 4. Platform Filter
    if (platform !== 'all' && (show.platform || '').trim() !== platform) {
      return false;
    }

    // 5. Tag Filter
    if (tag !== 'all') {
      const showTags = show.tags || [];
      if (!showTags.includes(tag)) return false;
    }

    // 6. Text Search Filter
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

  // Sorting
  if (sort === 'rating-desc') {
    result.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  } else if (sort === 'title-asc') {
    result.sort((a, b) => (a.vietnamese || '').localeCompare(b.vietnamese || '', 'vi'));
  } else if (sort === 'airing-first') {
    result.sort((a, b) => {
      if (a.status === 'airing' && b.status !== 'airing') return -1;
      if (b.status === 'airing' && a.status !== 'airing') return 1;
      return 0;
    });
  }

  state.filteredShows = result;
  renderShows();
  updateResultsCount();
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
    state.filters.sort !== 'default' ||
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
    sort: 'default',
    onlyFavorites: false
  };

  // Reset UI components
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  document.getElementById('searchClearBtn')?.classList.remove('active');

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
  if (sortSelect) sortSelect.value = 'default';

  const favBtn = document.getElementById('btnOpenFavorites');
  if (favBtn) favBtn.classList.remove('active');

  applyFilters();
  showToast('Đã khôi phục tất cả bộ lọc', 'fa-rotate-left');
}

// ============================================================
// RENDERING SHOWS (GRID & LIST)
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

// Create 3D Grid Card
function createGridCard(show) {
  const card = document.createElement('div');
  card.className = 'show-card';
  card.onclick = () => openShowDetail(show);

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const favorited = isFavorited(show);
  const ratingValue = show.rating ? Number(show.rating).toFixed(1) : '5.0';

  const posterHtml = show.image
    ? `<img src="${show.image}" alt="${show.vietnamese}" class="card-poster-img" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'card-poster-fallback\\'><i class=\\'fa-solid fa-heart fallback-icon\\'></i><div class=\\'fallback-title\\'>${show.vietnamese}</div></div>';">`
    : `<div class="card-poster-fallback">
         <i class="fa-solid fa-heart fallback-icon"></i>
         <div class="fallback-title">${show.vietnamese}</div>
       </div>`;

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
        <span class="card-platform-badge">${show.platform || 'Online'}</span>
      </div>

      <h3 class="card-title-vn" title="${show.vietnamese}">${show.vietnamese}</h3>
      <div class="card-title-sub">${[show.chinese, show.english].filter(Boolean).join(' • ')}</div>

      ${show.time ? `<div class="card-schedule"><i class="fa-regular fa-clock"></i> <span>${show.time}</span></div>` : ''}

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

  // Bind specific actions
  const favBtn = card.querySelector('[data-action="fav"]');
  if (favBtn) favBtn.onclick = (e) => toggleFavorite(show, e);

  const shareBtn = card.querySelector('[data-action="share"]');
  if (shareBtn) shareBtn.onclick = (e) => copyShareLink(show, e);

  const watchBtn = card.querySelector('[data-action="watch"]');
  if (watchBtn) watchBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-watch'); };

  const detailBtn = card.querySelector('[data-action="detail"]');
  if (detailBtn) detailBtn.onclick = (e) => { e.stopPropagation(); openShowDetail(show, 'tab-desc'); };

  return card;
}

// Create List Item (Compact View)
function createListItem(show) {
  const item = document.createElement('div');
  item.className = 'show-list-item';
  item.onclick = () => openShowDetail(show);

  const countryInfo = getCountryInfo(show.country);
  const statusInfo = getStatusBadge(show.status);
  const favorited = isFavorited(show);

  item.innerHTML = `
    <img src="${show.image || 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg'}" alt="${show.vietnamese}" class="list-item-poster" onerror="this.src='https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg';">
    <div class="list-item-info">
      <div class="list-item-title">${show.vietnamese}</div>
      <div class="list-item-sub">${[show.chinese, show.english].filter(Boolean).join(' • ')}</div>
      <div class="list-item-meta">
        <span>${countryInfo.flag} ${countryInfo.name}</span>
        <span>•</span>
        <span>${show.platform || 'Online'}</span>
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

  return item;
}

// ============================================================
// SHOW DETAIL MODAL & CAST PARSER
// ============================================================
function openShowDetail(show, defaultTab = 'tab-watch') {
  state.activeShow = show;
  const modal = document.getElementById('detailModal');
  if (!modal) return;

  // Update URL hash for sharing
  const slug = slugify(show.vietnamese);
  if (slug) window.history.replaceState(null, '', `#show=${slug}`);

  // Populate Hero Header
  const poster = document.getElementById('modalPoster');
  if (poster) {
    poster.src = show.image || 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg';
    poster.onerror = () => { poster.src = 'https://cdn.jsdelivr.net/gh/nnTuyen/danh-sach-show@main/images/show-0.jpg'; };
  }

  const title = document.getElementById('modalTitle');
  if (title) title.textContent = show.vietnamese;

  const subs = document.getElementById('modalSubtitles');
  if (subs) subs.textContent = [show.chinese, show.english].filter(Boolean).join(' • ');

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

  // Populate Vietsub Watch Links
  populateWatchLinks(show);

  // Populate Cast
  populateCastMembers(show.detailNotes);

  // Populate Description
  const descEl = document.getElementById('modalDescription');
  if (descEl) descEl.textContent = show.description || 'Chưa có thông tin tóm tắt cho show này.';

  // Update Favorite Button in modal
  updateModalFavoriteButton(show);

  // Activate Tab
  switchModalTab(defaultTab);

  // Open Modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeShowDetail() {
  const modal = document.getElementById('detailModal');
  if (!modal) return;
  modal.classList.remove('active');
  document.body.style.overflow = '';
  state.activeShow = null;

  // Clean URL hash without reload
  if (window.location.hash.startsWith('#show=')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

function switchModalTab(tabId) {
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

// Generate Watch Link Buttons with Platform Icons
function populateWatchLinks(show) {
  const vietsubContainer = document.getElementById('modalVietsubLinks');
  const originalContainer = document.getElementById('modalOriginalLinks');
  const chineseGroup = document.getElementById('modalChineseGroup');

  if (vietsubContainer) vietsubContainer.innerHTML = '';
  if (originalContainer) originalContainer.innerHTML = '';

  // 1. Vietsub Links
  let vietsubList = [];
  if (Array.isArray(show.vietnameseWatchUrls) && show.vietnameseWatchUrls.length > 0) {
    vietsubList = show.vietnameseWatchUrls;
  } else if (show.vietnameseWatchUrl) {
    vietsubList = [{ url: show.vietnameseWatchUrl, label: 'Nguồn Vietsub chính' }];
  }

  if (vietsubList.length > 0) {
    vietsubList.forEach(item => {
      const btn = createWatchLinkButton(item.url, item.label || 'Xem Vietsub', true);
      if (vietsubContainer) vietsubContainer.appendChild(btn);
    });
  } else {
    if (vietsubContainer) {
      vietsubContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 13px;">Chưa cập nhật link Vietsub cho show này. Bạn có thể xem bản gốc bên dưới.</div>`;
    }
  }

  // 2. Original / Chinese Links
  let originalList = [];
  if (Array.isArray(show.chineseWatchUrls) && show.chineseWatchUrls.length > 0) {
    originalList = show.chineseWatchUrls;
  } else if (show.chineseWatchUrl) {
    originalList = [{ url: show.chineseWatchUrl, label: 'Nơi chiếu bản gốc' }];
  }

  if (originalList.length > 0) {
    if (chineseGroup) chineseGroup.style.display = 'block';
    originalList.forEach(item => {
      const btn = createWatchLinkButton(item.url, item.label || 'Xem bản gốc', false);
      if (originalContainer) originalContainer.appendChild(btn);
    });
  } else {
    if (chineseGroup) chineseGroup.style.display = 'none';
  }
}

function createWatchLinkButton(url, label, isVietsub) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.className = 'watch-link-btn';

  // Detect Platform Brand Icon
  let icon = 'fa-play';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('bilibili')) icon = 'fa-tv';
  else if (lowerUrl.includes('youtube') || lowerUrl.includes('youtu.be')) icon = 'fa-youtube';
  else if (lowerUrl.includes('wetv') || lowerUrl.includes('qq.com')) icon = 'fa-video';
  else if (lowerUrl.includes('ok.ru')) icon = 'fa-circle-play';
  else if (lowerUrl.includes('odysee')) icon = 'fa-satellite-dish';
  else if (lowerUrl.includes('iqiyi')) icon = 'fa-film';

  a.innerHTML = `
    <span class="watch-link-label">
      <i class="fa-solid ${icon}"></i>
      <span>${label}</span>
    </span>
    <i class="fa-solid fa-arrow-up-right-from-square" style="color: var(--text-muted); font-size: 12px;"></i>
  `;

  return a;
}

// Parse Cast members from detailNotes text
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

    // Try splitting by " - " or " | "
    let namePart = line;
    let infoPart = '';

    if (line.includes(' - ')) {
      const parts = line.split(' - ');
      namePart = parts[0] + ' - ' + (parts[1] || '').split('|')[0];
      infoPart = parts.slice(1).join(' - ');
    }

    card.innerHTML = `
      <div class="cast-name">${line.split('|')[0].trim()}</div>
      ${line.includes('|') ? `<div class="cast-info">${line.substring(line.indexOf('|') + 1).trim()}</div>` : ''}
    `;

    container.appendChild(card);
  });
}

// ============================================================
// SHARING & DEEP LINKING
// ============================================================
function copyShareLink(show, e) {
  if (e) e.stopPropagation();
  const slug = slugify(show.vietnamese);
  const shareUrl = `${window.location.origin}${window.location.pathname}#show=${slug}`;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast(`Đã sao chép link "${show.vietnamese}"!`, 'fa-link');
    }).catch(() => fallbackCopy(shareUrl));
  } else {
    fallbackCopy(shareUrl);
  }
}

function fallbackCopy(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showToast('Đã sao chép link show vào bộ nhớ tạm!', 'fa-link');
  } catch (err) {
    prompt('Sao chép link bên dưới để chia sẻ:', text);
  }
  document.body.removeChild(textArea);
}

// Check if user visited via a shared link (#show=...)
function checkUrlHash() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#show=')) return;

  const targetSlug = hash.replace('#show=', '').trim();
  const matchedShow = state.shows.find(s => slugify(s.vietnamese) === targetSlug);

  if (matchedShow) {
    setTimeout(() => {
      openShowDetail(matchedShow);
    }, 400);
  }
}

// Pick a random show 🎲
function pickRandomShow() {
  if (state.shows.length === 0) return;
  const randomIndex = Math.floor(Math.random() * state.shows.length);
  const show = state.shows[randomIndex];
  openShowDetail(show);
  showToast(`Khám phá ngẫu nhiên: "${show.vietnamese}" 🎲`, 'fa-dice');
}

// ============================================================
// EVENT LISTENERS INITIALIZATION
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

  // Search Input
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.trim();
      if (searchClearBtn) searchClearBtn.classList.toggle('active', state.filters.search.length > 0);
      applyFilters();
    });

    // Keyboard shortcut (/)
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === 'Escape') {
        closeShowDetail();
      }
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

  // Modal Close Events
  const modalCloseBtn = document.getElementById('btnModalClose');
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeShowDetail);

  const modalOverlay = document.getElementById('detailModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeShowDetail();
    });
  }

  // Modal Tab Switching
  document.querySelectorAll('.modal-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchModalTab(btn.dataset.tab));
  });

  // Modal Action Buttons
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
