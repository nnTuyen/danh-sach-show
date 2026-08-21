// Full dataset of shows translated to English and Vietnamese
let showsData = [];

// Các biến phục vụ tính năng tải trang cuộn vô hạn (Lazy Loading DOM)
let activeFilteredShows = [];
let showsRenderedCount = 0;
const SHOWS_PER_PAGE = 12; // Số lượng show hiển thị mỗi lần cuộn
const DATA_VERSION = "20260728-optimize";
let sentinelObserver = null;
let searchTimeout = null; // Quản lý debounce tìm kiếm tránh lag phím
let _searchIndexCache = new Map();
const dialogState = {
  stack: [],
  restoreFocus: new WeakMap()
};

// Cache DOM references cho modal để tránh getElementById mỗi lần click
let _modalEls = null;
function getModalEls() {
  if (!_modalEls) {
    _modalEls = {
      modal: document.getElementById("show-modal"),
      container: document.getElementById("modal-container-el"),
      title: document.getElementById("modal-title-el"),
      zh: document.getElementById("modal-zh-el"),
      en: document.getElementById("modal-en-el"),
      vi: document.getElementById("modal-vi-el"),
      badges: document.getElementById("modal-badges-el"),
      ratingSlot: document.getElementById("modal-rating-slot"),
      poster: document.getElementById("modal-poster-el"),
      linksCard: document.getElementById("modal-links-card"),
      linksToggle: document.getElementById("modal-links-toggle"),
      linksSummary: document.getElementById("modal-links-summary"),
      linksEl: document.getElementById("modal-links-el"),
      desc: document.getElementById("modal-desc-el"),
      btnZh: document.getElementById("modal-copy-zh-btn"),
      btnEn: document.getElementById("modal-copy-en-btn"),
      btnVi: document.getElementById("modal-copy-vi-btn")
    };
  }
  return _modalEls;
}

function getFocusableElements(root) {
  return [...root.querySelectorAll([
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ].join(","))].filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function updateBackgroundInertState() {
  const hasOpenDialog = dialogState.stack.length > 0;
  const main = document.querySelector("main.container");
  if (!main) return;

  if (hasOpenDialog) {
    main.setAttribute("aria-hidden", "true");
    if ("inert" in main) main.inert = true;
  } else {
    main.removeAttribute("aria-hidden");
    if ("inert" in main) main.inert = false;
  }
}

function openAccessibleDialog(modal, focusTarget) {
  if (!modal) return;

  if (!dialogState.stack.includes(modal)) {
    dialogState.restoreFocus.set(modal, document.activeElement);
    dialogState.stack.push(modal);
  }

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
  updateBackgroundInertState();

  requestAnimationFrame(() => {
    const target = focusTarget || getFocusableElements(modal)[0] || modal;
    target?.focus?.({ preventScroll: true });
  });
}

function closeAccessibleDialog(modal, { keepScrollLocked = false, restoreFocus = true } = {}) {
  if (!modal) return;

  modal.classList.remove("active");
  dialogState.stack = dialogState.stack.filter(item => item !== modal);
  updateBackgroundInertState();

  if (!keepScrollLocked && dialogState.stack.length === 0) {
    document.body.style.overflow = "";
  }

  if (restoreFocus) {
    const previous = dialogState.restoreFocus.get(modal);
    if (previous && document.contains(previous)) {
      previous.focus?.({ preventScroll: true });
    }
  }
  dialogState.restoreFocus.delete(modal);
}

function getTopActiveDialog() {
  for (let i = dialogState.stack.length - 1; i >= 0; i -= 1) {
    if (dialogState.stack[i].classList.contains("active")) return dialogState.stack[i];
  }
  return null;
}

function handleDialogKeydown(e) {
  const modal = getTopActiveDialog();
  if (!modal) return;

  if (e.key === "Escape") {
    e.preventDefault();
    if (modal.id === "textarea-editor-modal") closeTextareaEditor();
    else if (modal.id === "settings-modal") closeSettingsModal();
    else if (modal.id === "show-modal") closeShowModal();
    return;
  }

  if (e.key !== "Tab") return;

  const focusable = getFocusableElements(modal);
  if (!focusable.length) {
    e.preventDefault();
    modal.focus?.({ preventScroll: true });
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus({ preventScroll: true });
  }
}

// Cache hiddenShowKeys để tránh parse JSON từ localStorage mỗi lần gọi
let _hiddenShowKeysCache = null;
let _hiddenShowKeysCacheDirty = true;

// Remove Vietnamese accents / diacritics for better searching
function removeVietnameseTones(str) {
  if (!str) return "";
  str = String(str);
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ý|Ỳ|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  str = str.replace(/\u0300|\u0301|\u0309|\u0303|\u0323/g, ""); // Huyền sắc hỏi ngã nặng 
  str = str.replace(/\u02c6|\u0306|\u031b/g, ""); // Â, Ă, Ơ, Ư
  return str;
}

// Custom descriptions database mapping based on show names
function getShowDescription(show) {
  return "";
}

// Active state tracker for filters
const COUNTRY_OPTIONS = [
  { code: "china", label: "Trung Quốc", flag: "🇨🇳" },
  { code: "korea", label: "Hàn Quốc", flag: "🇰🇷" },
  { code: "japan", label: "Nhật Bản", flag: "🇯🇵" },
  { code: "thailand", label: "Thái Lan", flag: "🇹🇭" },
  { code: "taiwan", label: "Đài Loan", flag: "🇹🇼" },
  { code: "hongkong", label: "Hồng Kông", flag: "🇭🇰" },
  { code: "other", label: "Khác", flag: "🌏" }
];

const COUNTRY_BY_CHINESE = [
  ["恋爱兄妹", "korea"],
  ["仔仔一堂", "hongkong"],
  ["男生男生配", "taiwan"]
];

const COUNTRY_BY_PLATFORM = {
  "TVB": "hongkong",
  "GagaOOLala": "taiwan"
};

let currentFilters = {
  search: "",
  status: "all",
  country: "all",
  tag: "all",
  sort: "name-asc"
};

const CUSTOM_SHOWS_STORAGE_KEY = "cnDatingShowsCustomShowsV1";
const HIDDEN_SHOWS_STORAGE_KEY = "cnDatingShowsHiddenShowsV1";
let currentModalIndex = null;
let settingsLocked = true;
let settingsSearchQuery = "";
let customShows = loadCustomShows();

function loadCustomShows() {
  try {
    const raw = localStorage.getItem(CUSTOM_SHOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item === "object") : [];
  } catch (err) {
    console.warn("Không đọc được danh sách show tự thêm:", err);
    return [];
  }
}

function saveCustomShows() {
  try {
    localStorage.setItem(CUSTOM_SHOWS_STORAGE_KEY, JSON.stringify(customShows));
  } catch (err) {
    console.warn("Lỗi khi lưu custom shows:", err);
  }
}

function cleanRuntimeFields(show) {
  const cleaned = { ...show };
  delete cleaned._index;
  delete cleaned._isCustom;
  delete cleaned._customId;
  delete cleaned._showsDataIndex;
  delete cleaned._searchToken;
  return cleaned;
}

function mergeLegacyCustomShowsIntoShowsData() {
  if (!Array.isArray(customShows) || !customShows.length) return;

  customShows.forEach(customShow => {
    const cleaned = cleanRuntimeFields(customShow);
    const duplicateIndex = showsData.findIndex(show =>
      show.chinese === cleaned.chinese ||
      (show.english && cleaned.english && show.english === cleaned.english) ||
      (show.vietnamese && cleaned.vietnamese && show.vietnamese === cleaned.vietnamese)
    );

    if (duplicateIndex >= 0) {
      showsData[duplicateIndex] = { ...showsData[duplicateIndex], ...cleaned };
    } else {
      showsData.push(cleaned);
    }
  });

  customShows = [];
  saveCustomShows();
  invalidateSearchIndex();
}

function loadHiddenShowKeys() {
  if (!_hiddenShowKeysCacheDirty && _hiddenShowKeysCache !== null) {
    return _hiddenShowKeysCache;
  }
  try {
    const raw = localStorage.getItem(HIDDEN_SHOWS_STORAGE_KEY);
    if (!raw) {
      _hiddenShowKeysCache = [];
    } else {
      const parsed = JSON.parse(raw);
      _hiddenShowKeysCache = Array.isArray(parsed) ? parsed.filter(item => typeof item === "string") : [];
    }
  } catch (err) {
    console.warn("Không đọc được danh sách show đã ẩn:", err);
    _hiddenShowKeysCache = [];
  }
  _hiddenShowKeysCacheDirty = false;
  return _hiddenShowKeysCache;
}

function saveHiddenShowKeys(keys) {
  try {
    localStorage.setItem(HIDDEN_SHOWS_STORAGE_KEY, JSON.stringify(keys));
  } catch (err) {
    console.warn("Lỗi khi lưu hidden show keys:", err);
  }
  _hiddenShowKeysCacheDirty = true;
  invalidateSearchIndex();
}

function getShowKey(show) {
  return show._customId || show.chinese;
}

// Pre-computed Search Index Builder
function computeShowSearchToken(show) {
  const values = [
    show.chinese,
    show.english,
    show.vietnamese,
    show.platform,
    countryLabel(getShowCountry(show)),
    show.time,
    show.episodeProgress,
    show.airingNote,
    show.detailNotes,
    show.description || getShowDescription(show),
    statusLabel(show.status),
    tagToString(show.tags)
  ];
  const raw = values.filter(Boolean).join(" ").toLowerCase();
  return `${raw} ${removeVietnameseTones(raw)}`;
}

function prepareShowsSearchTokens() {
  showsData.forEach(show => {
    show._searchToken = computeShowSearchToken(show);
  });
}

function invalidateSearchIndex() {
  _searchIndexCache = new Map();
  prepareShowsSearchTokens();
}

function findShowsDataIndexByKey(key) {
  return showsData.findIndex(show => getShowKey(show) === key);
}

function getAllShowsRaw() {
  const hidden = new Set(loadHiddenShowKeys());
  return showsData
    .map((show, idx) => ({ ...show, _showsDataIndex: idx, _isCustom: false }))
    .filter(show => !hidden.has(getShowKey(show)));
}

function resolveShowIndex(index) {
  const allShows = getAllShowsRaw();
  if (index < 0 || index >= allShows.length) return null;

  const baseShow = allShows[index];
  const isCustom = !!baseShow._isCustom;
  const customIndex = isCustom
    ? customShows.findIndex(show => getShowKey(show) === getShowKey(baseShow))
    : -1;

  return { baseShow, isCustom, customIndex };
}

function getShowRating(show) {
  const rating = Number(show?.rating);
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  return Math.min(5, Math.max(0, Math.round(rating)));
}

function isValidCountryCode(code) {
  return COUNTRY_OPTIONS.some(option => option.code === code);
}

function inferShowCountry(show) {
  for (const [keyword, country] of COUNTRY_BY_CHINESE) {
    if (show.chinese && show.chinese.includes(keyword)) return country;
  }
  if (show.platform && COUNTRY_BY_PLATFORM[show.platform]) {
    return COUNTRY_BY_PLATFORM[show.platform];
  }
  return "china";
}

function getShowCountry(show) {
  const stored = String(show?.country || "").trim();
  if (stored && isValidCountryCode(stored)) return stored;
  return inferShowCountry(show);
}

function getCountryMeta(code) {
  return COUNTRY_OPTIONS.find(option => option.code === code) || COUNTRY_OPTIONS[COUNTRY_OPTIONS.length - 1];
}

function countryLabel(code) {
  return getCountryMeta(code).label;
}

function renderCountryBadge(show) {
  const code = getShowCountry(show);
  const meta = getCountryMeta(code);
  return `<span class="badge badge-country ${code}" title="Quốc gia: ${escapeHtml(meta.label)}">${meta.flag} ${escapeHtml(meta.label)}</span>`;
}

function parseWatchLinkEntry(entry) {
  if (!entry) return null;

  if (typeof entry === "string") {
    const url = entry.trim();
    return url ? { url, label: "" } : null;
  }

  if (typeof entry === "object") {
    const url = String(entry.url || entry.link || "").trim();
    const label = String(entry.label || entry.name || "").trim();
    return url ? { url, label } : null;
  }

  return null;
}

function detectPlatformFromUrl(url) {
  if (!url) return "";
  const lower = url.toLowerCase();
  if (lower.includes("iqiyi.com") || lower.includes("iqiyi")) return "iQiyi";
  if (lower.includes("v.qq.com") || lower.includes("tencent")) return "Tencent Video";
  if (lower.includes("mgtv.com") || lower.includes("mango")) return "Mango TV";
  if (lower.includes("youku.com") || lower.includes("youku")) return "Youku";
  if (lower.includes("bilibili.com") || lower.includes("bili")) return "Bilibili";
  if (lower.includes("rophim1.vip") || lower.includes("rophim")) return "Rophim";
  if (lower.includes("yeuphim.biz") || lower.includes("yeuphim")) return "Yêu Phim";
  if (lower.includes("mamphim.site") || lower.includes("mamphim")) return "Mâm Phim";
  if (lower.includes("phimvietsub.site") || lower.includes("phimvietsub")) return "Phim Việt Sub";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "YouTube";
  if (lower.includes("ok.ru")) return "OK.ru";
  if (lower.includes("vkvideo")) return "vkvideo";
  if (lower.includes("dzen.ru")) return "dzen.ru";
  if (lower.includes("rumble.com") || lower.includes("rumble")) return "Rumble";
  if (lower.includes("dailymotion.com") || lower.includes("dailymotion")) return "Dailymotion";
  if (lower.includes("kisskh.co") || lower.includes("kisskh")) return "KissKh";
  if (lower.includes("d.tube") || lower.includes("dtube")) return "D.Tube";
  if (lower.includes("odysee.com") || lower.includes("odysee")) return "Odysee";
  return "";
}

function getWatchLinksByType(show, type) {
  const arrayKey = type === "chinese" ? "chineseWatchUrls" : "vietnameseWatchUrls";
  const legacyKey = type === "chinese" ? "chineseWatchUrl" : "vietnameseWatchUrl";
  const entries = [];
  const seen = new Set();

  const addEntry = raw => {
    const parsed = parseWatchLinkEntry(raw);
    if (!parsed || seen.has(parsed.url)) return;
    seen.add(parsed.url);
    entries.push(parsed);
  };

  if (Array.isArray(show[arrayKey])) {
    show[arrayKey].forEach(addEntry);
  }
  if (show[legacyKey]) {
    addEntry(show[legacyKey]);
  }

  const total = entries.length;
  return entries.map((entry, index) => {
    let label = entry.label;
    let detected = detectPlatformFromUrl(entry.url);
    let note = "";

    if (type === "chinese") {
      if (!label) {
        label = total > 1 ? `Nơi chiếu tiếng Trung #${index + 1}` : "Nơi chiếu tiếng Trung";
      }
      note = detected || show.platform || "Tiếng Trung";
    } else {
      if (!label) {
        label = total > 1 ? `Link tiếng Việt #${index + 1}` : "Web chiếu tiếng Việt";
      }
      note = detected || "Link phụ đề/thuyết minh";
    }

    return { url: entry.url, label, note };
  });
}

function getChineseWatchLinks(show) {
  return getWatchLinksByType(show, "chinese");
}

function getVietnameseWatchLinks(show) {
  return getWatchLinksByType(show, "vietnamese");
}

function collectWatchLinksFromItem(item, type) {
  return [...item.querySelectorAll(`.watch-link-row[data-watch-link-type="${type}"]`)]
    .map(row => {
      const url = row.querySelector(`input[data-watch-link-url-type="${type}"]`)?.value.trim() || "";
      const label = row.querySelector(`input[data-watch-link-label-type="${type}"]`)?.value.trim() || "";
      if (!url) return null;
      return label ? { url, label } : { url };
    })
    .filter(Boolean);
}

function applyWatchLinksToData(data, item) {
  const chineseLinks = collectWatchLinksFromItem(item, "chinese");
  const vietnameseLinks = collectWatchLinksFromItem(item, "vietnamese");

  if (chineseLinks.length) {
    data.chineseWatchUrls = chineseLinks;
    data.chineseWatchUrl = chineseLinks[0].url;
  } else {
    delete data.chineseWatchUrls;
    delete data.chineseWatchUrl;
  }

  if (vietnameseLinks.length) {
    data.vietnameseWatchUrls = vietnameseLinks;
    data.vietnameseWatchUrl = vietnameseLinks[0].url;
  } else {
    delete data.vietnameseWatchUrls;
    delete data.vietnameseWatchUrl;
  }

  return data;
}

function renderWatchLinkRow(index, type, link = { url: "", label: "" }, canRemove = true) {
  const labelPlaceholder = type === "chinese"
    ? "Tên hiển thị (VD: Tencent, Mango TV...)"
    : "Tên hiển thị (VD: FPT Play, VieON, YouTube...)";

  return `
        <div class="watch-link-row" data-watch-link-type="${type}">
          <input class="settings-input watch-link-label-input" type="text" data-watch-link-label-type="${type}" placeholder="${labelPlaceholder}" value="${escapeHtml(link.label || "")}" ${settingsLocked ? "disabled" : ""}>
          <div class="watch-link-url-line">
            <input class="settings-input watch-link-input" type="url" data-watch-link-url-type="${type}" placeholder="https://..." value="${escapeHtml(link.url || "")}" ${settingsLocked ? "disabled" : ""}>
            <div class="watch-link-actions">
              <button type="button" class="watch-link-move-btn" onclick="moveWatchLinkRow(this, 'up')" title="Di chuyển lên" ${settingsLocked ? "disabled" : ""}>
                <i class="fa-solid fa-arrow-up"></i>
              </button>
              <button type="button" class="watch-link-move-btn" onclick="moveWatchLinkRow(this, 'down')" title="Di chuyển xuống" ${settingsLocked ? "disabled" : ""}>
                <i class="fa-solid fa-arrow-down"></i>
              </button>
              <button type="button" class="watch-link-remove-btn" onclick="removeWatchLinkRow(this)" title="Xóa link" ${(canRemove && !settingsLocked) ? "" : "disabled"}>
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
}

function moveWatchLinkRow(button, direction) {
  if (settingsLocked) return;
  const row = button.closest(".watch-link-row");
  if (!row) return;

  const parent = row.parentElement;
  if (direction === "up") {
    const prev = row.previousElementSibling;
    if (prev && prev.classList.contains("watch-link-row")) {
      parent.insertBefore(row, prev);
    }
  } else if (direction === "down") {
    const next = row.nextElementSibling;
    if (next && next.classList.contains("watch-link-row")) {
      parent.insertBefore(next, row);
    }
  }
}

function updateWatchLinkRemoveButtons(editor) {
  if (!editor) return;
  const rows = editor.querySelectorAll(".watch-link-row");
  rows.forEach(row => {
    const removeBtn = row.querySelector(".watch-link-remove-btn");
    if (removeBtn) removeBtn.disabled = settingsLocked || rows.length <= 1;
  });
}

function addWatchLinkRow(index, type) {
  if (settingsLocked) return;

  const editor = document.getElementById(`watch-links-${index}-${type}`);
  if (!editor) return;

  const temp = document.createElement("div");
  temp.innerHTML = renderWatchLinkRow(index, type, { url: "", label: "" }, true);
  const row = temp.firstElementChild;
  editor.appendChild(row);
  updateWatchLinkRemoveButtons(editor);
  row.querySelector(`input[data-watch-link-label-type="${type}"]`)?.focus();
}

function removeWatchLinkRow(button) {
  if (settingsLocked) return;

  const row = button.closest(".watch-link-row");
  const editor = row?.parentElement;
  if (!row || !editor) return;

  if (editor.querySelectorAll(".watch-link-row").length <= 1) {
    row.querySelectorAll("input").forEach(input => { input.value = ""; });
    return;
  }

  row.remove();
  updateWatchLinkRemoveButtons(editor);
}

function compareShowsByRatingAndName(a, b) {
  const nameA = removeVietnameseTones((a.vietnamese || "").toLowerCase());
  const nameB = removeVietnameseTones((b.vietnamese || "").toLowerCase());
  return nameA.localeCompare(nameB, "vi");
}

function renderStarDisplay(rating) {
  const stars = Number(rating);
  if (!stars || stars <= 0) return "";
  const icons = Array.from({ length: 5 }, (_, index) => {
    const filled = index < stars;
    return `<i class="fa-${filled ? "solid" : "regular"} fa-star"></i>`;
  }).join("");
  return `<span class="show-rating" title="Đánh giá ${stars}/5">${icons}</span>`;
}

function updateStarPickerVisual(picker, rating) {
  if (!picker) return;
  picker.querySelectorAll(".star-btn").forEach((button, starIndex) => {
    const active = starIndex + 1 <= rating;
    button.classList.toggle("active", active);
    const icon = button.querySelector("i");
    if (icon) icon.className = `fa-${active ? "solid" : "regular"} fa-star`;
  });
}

function syncRatingPickers(index, rating) {
  const hiddenInput = document.getElementById(`settings-${index}-rating`);
  if (hiddenInput) hiddenInput.value = String(rating);
  document.querySelectorAll(`[data-rating-index="${index}"]`).forEach(picker => {
    updateStarPickerVisual(picker, rating);
  });
  const modalSlot = document.getElementById("modal-rating-slot");
  if (modalSlot && currentModalIndex === index) {
    modalSlot.innerHTML = renderInteractiveStarRating(index, rating);
  }
}

function renderInteractiveStarRating(index, rating) {
  const current = getShowRating({ rating });
  const stars = Array.from({ length: 5 }, (_, starIndex) => {
    const value = starIndex + 1;
    const active = value <= current;
    const clearHint = value === current && current > 0 ? " (bấm lại để xóa)" : "";
    return `<button type="button" class="star-btn ${active ? "active" : ""}" data-star-value="${value}" onclick="event.stopPropagation(); saveShowRating(${index}, ${value})" title="${value} sao${clearHint}"><i class="fa-${active ? "solid" : "regular"} fa-star"></i></button>`;
  }).join("");

  return `
        <div class="interactive-rating card-rating-picker" data-rating-index="${index}" onclick="event.stopPropagation()">
          <span class="interactive-rating-label">Đánh giá</span>
          ${stars}
        </div>
      `;
}

function saveShowRating(index, value) {
  const resolved = resolveShowIndex(index);
  if (!resolved) return;

  let rating = Math.min(5, Math.max(0, parseInt(value, 10) || 0));
  const currentShow = getEffectiveShows().find(show => show._index === index);
  const currentRating = getShowRating(currentShow || {});

  if (rating > 0 && rating === currentRating) {
    rating = 0;
  }

  if (resolved.isCustom) {
    const updated = { ...customShows[resolved.customIndex] };
    if (rating > 0) updated.rating = rating;
    else delete updated.rating;
    customShows[resolved.customIndex] = updated;
    saveCustomShows();
  } else {
    const baseIndex = resolved.baseShow._showsDataIndex;
    if (baseIndex !== undefined && baseIndex >= 0 && baseIndex < showsData.length) {
      if (rating > 0) showsData[baseIndex].rating = rating;
      else delete showsData[baseIndex].rating;
    }
  }

  syncRatingPickers(index, rating);
  updateStatistics();

  if (currentFilters.sort === "stars") {
    renderShows();
  }

  const showName = currentShow?.vietnamese || "show";
  if (rating > 0) {
    showToast(`Đã đánh giá "${showName}" ${rating} sao`);
  } else {
    showToast(`Đã xóa đánh giá của "${showName}"`);
  }
}

function getShowWithUserData(show) {
  return { ...show };
}

function getShowImage(show) {
  return show.image || show.poster || show.posterUrl || "";
}

function getShowYear(show) {
  const directYear = show.year || show.releaseYear || show.airYear || show.premiereYear;
  if (directYear) return String(directYear);

  const text = [show.time, show.releaseDate, show.airDate, show.premiereDate].filter(Boolean).join(" ");
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function getEffectiveShows() {
  return getAllShowsRaw().map((show, index) => ({
    ...getShowWithUserData(show),
    _index: index,
    _isCustom: !!show._isCustom
  }));
}

function updateStatistics() {
  const effectiveShows = getEffectiveShows();
  const stats = effectiveShows.reduce((acc, show) => {
    acc.total += 1;
    if (show.status === "upcoming") acc.upcoming += 1;
    else if (show.status === "airing") acc.airing += 1;
    else if (show.status === "completed") acc.completed += 1;
    return acc;
  }, { total: 0, upcoming: 0, airing: 0, completed: 0 });

  document.getElementById("stat-total").textContent = stats.total;
  document.getElementById("stat-upcoming").textContent = stats.upcoming;
  document.getElementById("stat-airing").textContent = stats.airing;
  document.getElementById("stat-completed").textContent = stats.completed;
}

function copyToClipboard(text, buttonElement, message = "Đã sao chép!") {
  navigator.clipboard.writeText(text).then(() => {
    const originalHtml = buttonElement.innerHTML;
    buttonElement.classList.add("success");
    buttonElement.innerHTML = '<i class="fa-solid fa-check"></i>';

    showToast(`${message}: "${text}"`);

    setTimeout(() => {
      buttonElement.classList.remove("success");
      buttonElement.innerHTML = originalHtml;
    }, 1500);
  }).catch(err => {
    showToast("Không thể sao chép! Lỗi hệ thống.", true);
    console.error("Lỗi copy: ", err);
  });
}

function showToast(msg, isError = false) {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  const icon = document.createElement("i");
  icon.className = isError ? "fa-solid fa-circle-exclamation" : "fa-solid fa-circle-check";
  if (isError) icon.style.color = "#ef4444";

  const message = document.createElement("span");
  message.textContent = msg;

  if (isError) {
    toast.style.borderColor = "#ef4444";
  }
  toast.append(icon, message);

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 50);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

function getPlatformClass(platform) {
  if (!platform) return "undecided";
  const lower = platform.toLowerCase();
  if (lower.includes("tencent") || lower.includes("qq")) return "tencent";
  if (lower.includes("mango") || lower.includes("mgtv")) return "mango";
  if (lower.includes("youku")) return "youku";
  if (lower.includes("iqiyi")) return "iqiyi";
  if (lower.includes("bili")) return "bilibili";
  if (lower.includes("rumble")) return "rumble";
  if (lower.includes("odysee")) return "odysee";
  if (lower.includes("kisskh")) return "kisskh";
  if (lower.includes("dtube")) return "dtube";
  if (lower.includes("mamphim")) return "mamphim";
  if (lower.includes("yeuphim")) return "yeuphim";
  if (lower.includes("rophim")) return "rophim";
  if (lower.includes("phimvietsub")) return "phimvietsub";
  if (lower.includes("ok.ru")) return "ok.ru";
  if (lower.includes("vkvideo")) return "vkvideo";
  if (lower.includes("dzen.ru")) return "dzen.ru";
  if (lower.includes("dailymotion")) return "dailymotion";
  if (lower.includes("youtube")) return "youtube";
  if (lower.includes("migu")) return "migu";
  if (lower.includes("tvb")) return "tvb";
  if (lower.includes("gaga")) return "gaga";
  return "undecided";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyUserEditableFields(show) {
  const description = show.description && show.description.trim() ? show.description.trim() : getShowDescription(show);
  const detailsHtml = renderDetailUpdates(show);
  document.getElementById("modal-desc-el").innerHTML = `<div class="modal-desc-text">${escapeHtml(description)}</div>${detailsHtml}`;
  renderShowPoster(show);
  renderShowLinks(show);
}

function renderDetailUpdates(show) {
  const chips = [];
  if (show.episodeProgress) {
    chips.push(`<span class="detail-info-chip"><i class="fa-solid fa-tv"></i>${escapeHtml(show.episodeProgress)}</span>`);
  }
  if (show.airingNote) {
    chips.push(`<span class="detail-info-chip"><i class="fa-solid fa-clock"></i>${escapeHtml(show.airingNote)}</span>`);
  }

  const notesHtml = show.detailNotes ? `
        <div class="couple-updates-section">
          <div class="couple-updates-title"><i class="fa-solid fa-note-sticky"></i> Ghi chú cập nhật</div>
          <div class="couple-updates-content">${escapeHtml(show.detailNotes.trim())}</div>
        </div>
      ` : "";

  if (!chips.length && !notesHtml) return "";
  return `
        ${chips.length ? `<div class="detail-info-bar">${chips.join("")}</div>` : ""}
        ${notesHtml}
      `;
}

function exportUserDataStore() {
  const json = JSON.stringify({
    showsData,
    hiddenShows: loadHiddenShowKeys()
  }, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    showToast("Đã copy JSON showsData hiện tại");
  }).catch(err => {
    console.error("Không copy được dữ liệu chỉnh sửa:", err);
    showToast("Không copy được JSON. Hãy mở DevTools để lấy localStorage.", true);
  });
}

function getPersistableShowsData() {
  const hidden = new Set(loadHiddenShowKeys());
  return showsData
    .filter(show => !hidden.has(getShowKey(show)))
    .map(show => cleanRuntimeFields(show));
}

function downloadUpdatedJson() {
  const json = JSON.stringify(getPersistableShowsData(), null, 2) + "\n";
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `showsData_updated_${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Đã tạo file showsData.json mới");
}

function statusLabel(status) {
  if (status === "upcoming") return "Sắp chiếu";
  if (status === "airing") return "Đang chiếu";
  return "Đã xong";
}

function renderTagBadge(tags) {
  if (tags.includes("all-female")) {
    return `<span class="badge badge-tag"><i class="fa-solid fa-venus-double"></i> Lesbian (GL)</span>`;
  }
  if (tags.includes("all-male")) {
    return `<span class="badge badge-tag"><i class="fa-solid fa-mars-double"></i> Gay (BL)</span>`;
  }
  if (tags.includes("bisexual")) {
    return `<span class="badge badge-tag"><i class="fa-solid fa-venus-mars"></i> Bisexual</span>`;
  }
  if (tags.includes("other")) {
    return `<span class="badge badge-tag" style="background: rgba(100, 116, 139, 0.2); color: #94a3b8; border-color: rgba(100, 116, 139, 0.3);"><i class="fa-solid fa-ellipsis"></i> Khác</span>`;
  }
  return "";
}

function renderStatusText(status) {
  return status === "upcoming" ? "Sắp chiếu" : status === "airing" ? "Đang chiếu" : "Đã xong";
}

function renderTimeHtml(time) {
  return time ? `<span class="time-note"><i class="fa-solid fa-clock"></i> ${escapeHtml(time)}</span>` : "";
}

function renderYearHtml(year) {
  return year ? `<span class="badge badge-year"><i class="fa-regular fa-calendar"></i> ${escapeHtml(year)}</span>` : "";
}

function getSortableYear(show) {
  const yearText = getShowYear(show);
  const matches = String(yearText || "").match(/\b(19|20)\d{2}\b/g);
  return matches ? Math.max(...matches.map(Number)) : -Infinity;
}

function compareShowsByVietnameseName(a, b) {
  return removeVietnameseTones(a.vietnamese || "").localeCompare(removeVietnameseTones(b.vietnamese || ""), "vi");
}

function tagToString(tags) {
  return Array.isArray(tags) ? tags.join(",") : (tags || "normal");
}

function stringToTags(value) {
  const tags = String(value || "normal")
    .split(",")
    .map(tag => tag.trim())
    .filter(Boolean);
  return tags.length ? tags : ["normal"];
}

function matchesSettingsSearch(show, query) {
  const normalizedQuery = removeVietnameseTones(String(query || "").toLowerCase().trim());
  if (!normalizedQuery) return true;

  return getShowSearchText(show, true).includes(normalizedQuery);
}

function buildShowSearchText(show, includeSettingsOnlyFields = false) {
  const values = [
    show.chinese,
    show.english,
    show.vietnamese,
    show.platform,
    countryLabel(getShowCountry(show)),
    show.time,
    show.episodeProgress,
    show.airingNote
  ];

  if (includeSettingsOnlyFields) {
    values.push(
      show.detailNotes,
      show.description || getShowDescription(show),
      statusLabel(show.status),
      tagToString(show.tags),
      show._isCustom ? "tu them show moi" : ""
    );
  }

  const raw = values.filter(Boolean).join(" ").toLowerCase();
  return `${raw} ${removeVietnameseTones(raw)}`;
}

function getShowSearchText(show, includeSettingsOnlyFields = false) {
  if (!includeSettingsOnlyFields && show._searchToken) {
    return show._searchToken;
  }
  return buildShowSearchText(show, includeSettingsOnlyFields);
}

function openSettingsModal() {
  settingsLocked = true;
  settingsSearchQuery = "";
  const settingsSearchBox = document.getElementById("settings-search-box");
  if (settingsSearchBox) settingsSearchBox.value = "";

  const settingsModal = document.getElementById("settings-modal");
  const closeButton = settingsModal?.querySelector(".modal-close");
  openAccessibleDialog(settingsModal, closeButton);

  const list = document.getElementById("settings-list");
  if (list) {
    list.style.display = "";
    list.innerHTML = `
          <div style="text-align: center; padding: 3rem 1.5rem; color: var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 0.75rem; color: var(--accent-color); display: block;"></i>
            Đang chuẩn bị dữ liệu cài đặt...
          </div>
        `;
  }

  setTimeout(() => {
    renderSettingsList();
    updateSettingsLockState();
    settingsSearchBox?.focus();
  }, 50);
}

function closeSettingsModal() {
  const modal = document.getElementById("settings-modal");
  closeAccessibleDialog(modal, { restoreFocus: true });

  const list = document.getElementById("settings-list");
  if (list) {
    list.style.display = "none";
  }

  setTimeout(() => {
    if (list) {
      list.innerHTML = "";
      list.style.display = "";
    }
  }, 250);
}

function toggleSettingsLock() {
  settingsLocked = !settingsLocked;
  updateSettingsLockState();
}

function updateSettingsLockState() {
  const lockBtn = document.getElementById("settings-lock-btn");
  if (!lockBtn) return;

  lockBtn.classList.toggle("locked", settingsLocked);
  lockBtn.innerHTML = settingsLocked
    ? '<i class="fa-solid fa-lock"></i> Đang khóa'
    : '<i class="fa-solid fa-unlock"></i> Đang mở khóa';

  document.querySelectorAll(".settings-input, .settings-select, .settings-textarea").forEach(input => {
    input.disabled = settingsLocked;
  });
  document.querySelectorAll(".settings-save-btn, .settings-delete-btn[data-delete-show]").forEach(button => {
    button.disabled = settingsLocked;
  });
  const addBtn = document.getElementById("settings-add-show-btn");
  if (addBtn) addBtn.disabled = settingsLocked;
  document.querySelectorAll(".watch-link-label-input, .watch-link-input, .watch-link-add-btn, .watch-link-remove-btn, .watch-link-move-btn").forEach(button => {
    button.disabled = settingsLocked;
  });
  document.querySelectorAll(".watch-links-editor").forEach(editor => {
    updateWatchLinkRemoveButtons(editor);
  });
}

function renderSettingsShowFormHtml(show) {
  return `
        <div class="settings-show-form-inner">
          <div class="settings-form-grid">
            ${settingsStarRating(show._index, getShowRating(show))}
            ${settingsInput(show._index, "chinese", "Tên gốc", show.chinese)}
            ${settingsInput(show._index, "english", "Tên tiếng Anh", show.english)}
            ${settingsInput(show._index, "vietnamese", "Tên tiếng Việt", show.vietnamese)}
            ${settingsSelect(show._index, "country", "Quốc gia / Vùng", getShowCountry(show), COUNTRY_OPTIONS.map(option => [option.code, `${option.flag} ${option.label}`]))}
            ${settingsSelect(show._index, "status", "Trạng thái", show.status, [
    ["upcoming", "Sắp chiếu"],
    ["airing", "Đang chiếu"],
    ["completed", "Đã kết thúc"]
  ])}
            ${settingsInput(show._index, "year", "Năm phát hành", getShowYear(show))}
            ${settingsInput(show._index, "platform", "Nhà phát hành / Nền tảng", show.platform || "")}
            ${settingsInput(show._index, "time", "Thời gian/Lịch chiếu", show.time || "")}
            ${settingsSelect(show._index, "tags", "Chủ đề / Tags", Array.isArray(show.tags) ? (show.tags[0] || "normal") : (show.tags || "normal"), [
    ["normal", "Bình thường"],
    ["all-female", "Lesbian (GL)"],
    ["all-male", "Gay (BL)"],
    ["bisexual", "Bisexual / Song tính"],
    ["other", "Khác (Không phải show hẹn hò)"]
  ])}
            ${settingsInput(show._index, "image", "Link hình ảnh", getShowImage(show), "span-2")}
            ${settingsWatchLinksGroup(show._index, "chinese", getChineseWatchLinks(show), "Link gốc")}
            ${settingsWatchLinksGroup(show._index, "vietnamese", getVietnameseWatchLinks(show), "Link xem tiếng Việt")}
            ${settingsInput(show._index, "episodeProgress", "Đang chiếu đến tập", show.episodeProgress || "")}
            ${settingsInput(show._index, "airingNote", "Ghi chú phát sóng", show.airingNote || "", "span-2")}
            ${settingsTextarea(show._index, "description", "Mô tả show", show.description || getShowDescription(show), "span-3")}
            ${settingsTextarea(show._index, "detailNotes", "Ghi chú chi tiết khác", show.detailNotes || "", "span-3")}
          </div>
          <div class="settings-show-actions">
            <button class="settings-save-btn" type="button" onclick="saveSettingsShow(${show._index})">
              <i class="fa-solid fa-floppy-disk"></i> Lưu show này
            </button>
            <button class="settings-delete-btn" data-delete-show type="button" onclick="deleteShow(${show._index})">
              <i class="fa-solid fa-trash"></i> Xóa show
            </button>
          </div>
        </div>
      `;
}

function renderSettingsList() {
  const list = document.getElementById("settings-list");
  const meta = document.getElementById("settings-search-meta");
  if (!list) return;

  const openIndices = new Set(
    [...document.querySelectorAll(".settings-show-item.open")].map(item => item.getAttribute("data-settings-index"))
  );
  const sortedShows = [...getEffectiveShows()].sort(compareShowsByRatingAndName);
  const query = settingsSearchQuery.trim();
  const filtered = sortedShows.filter(show => matchesSettingsSearch(show, query));

  if (meta) {
    meta.textContent = query
      ? `Hiển thị ${filtered.length} / ${sortedShows.length} show`
      : `${sortedShows.length} show`;
  }

  if (!filtered.length) {
    list.innerHTML = `
          <div class="settings-empty-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <h4>Không tìm thấy show</h4>
            <p>Thử từ khóa khác hoặc xóa nội dung ô tìm kiếm.</p>
          </div>
        `;
    updateSettingsLockState();
    return;
  }

  list.innerHTML = filtered.map(show => {
    const thumbUrl = getShowImage(show);
    const thumbHtml = thumbUrl
      ? `<img src="${escapeHtml(thumbUrl)}" alt="Ảnh ${escapeHtml(show.vietnamese)}" loading="lazy" decoding="async" width="44" height="44" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fa-regular fa-image\\'></i>';">`
      : `<i class="fa-regular fa-image"></i>`;
    const customBadge = show._isCustom ? `<span class="badge-custom">Tự thêm</span>` : "";
    const ratingHtml = renderStarDisplay(getShowRating(show));
    const isOpen = openIndices.has(String(show._index));
    const formHtml = isOpen ? renderSettingsShowFormHtml(show) : "";

    return `
          <div class="settings-show-item ${isOpen ? "open" : ""}" data-settings-index="${show._index}" id="settings-item-${show._index}">
            <div class="settings-show-header" onclick="toggleSettingsShow(${show._index})">
              <div class="settings-show-thumb">${thumbHtml}</div>
              <div class="settings-show-name">
                <div class="settings-show-name-zh">${escapeHtml(show.chinese)}</div>
                <div class="settings-show-name-vi">${escapeHtml(show.vietnamese)}${ratingHtml}</div>
              </div>
              <div class="settings-show-badges">
                ${customBadge}
                ${renderCountryBadge(show)}
                <span class="badge badge-status ${show.status}">${statusLabel(show.status)}</span>
                <span class="badge badge-plat ${getPlatformClass(show.platform)}">${escapeHtml(show.platform)}</span>
              </div>
              <i class="fa-solid fa-chevron-down settings-expand-icon"></i>
            </div>
            <div class="settings-show-form">
              ${formHtml}
            </div>
          </div>
        `;
  }).join("");

  updateSettingsLockState();
}

function settingsStarRating(index, rating) {
  const current = getShowRating({ rating });
  const stars = Array.from({ length: 5 }, (_, starIndex) => {
    const value = starIndex + 1;
    const active = value <= current;
    return `<button type="button" class="star-btn ${active ? "active" : ""}" data-star-value="${value}" onclick="setSettingsRating(${index}, ${value})" title="${value} sao" aria-label="Đánh giá ${value} sao"><i class="fa-${active ? "solid" : "regular"} fa-star"></i></button>`;
  }).join("");

  return `
        <div class="settings-field span-3">
          <label for="settings-${index}-rating">Đánh giá sao</label>
          <div class="star-rating-picker" data-rating-index="${index}">
            <input type="hidden" class="settings-input" id="settings-${index}-rating" data-field="rating" value="${current}">
            ${stars}
            <button type="button" class="star-clear-btn" onclick="setSettingsRating(${index}, 0)" aria-label="Xóa đánh giá sao">Xóa sao</button>
          </div>
        </div>
      `;
}

function setSettingsRating(index, value) {
  saveShowRating(index, value);
}

function addNewShow() {
  if (settingsLocked) {
    showToast("Mở khóa cài đặt trước khi thêm show mới", true);
    return;
  }

  const newShow = {
    chinese: "Tên show mới",
    english: "New Show",
    vietnamese: "Show mới",
    status: "upcoming",
    platform: "TBA",
    time: "",
    image: "",
    chineseWatchUrl: "",
    vietnameseWatchUrl: "",
    chineseWatchUrls: [],
    vietnameseWatchUrls: [],
    tags: ["normal"],
    country: "china",
    rating: 0,
    description: ""
  };

  showsData.push(newShow);
  invalidateSearchIndex();
  settingsSearchQuery = "";
  const settingsSearchBox = document.getElementById("settings-search-box");
  if (settingsSearchBox) settingsSearchBox.value = "";
  updateStatistics();
  renderShows();
  renderSettingsList();

  const newIndex = getAllShowsRaw().length - 1;
  const newItem = document.querySelector(`[data-settings-index="${newIndex}"]`);
  if (newItem && !newItem.classList.contains("open")) {
    toggleSettingsShow(newIndex);
  }
  newItem?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  showToast("Đã thêm show mới. Điền thông tin và bấm Lưu show này.");
}

function settingsInput(index, field, label, value, spanClass = "") {
  return `
        <div class="settings-field ${spanClass}">
          <label for="settings-${index}-${field}">${label}</label>
          <input class="settings-input" id="settings-${index}-${field}" data-field="${field}" value="${escapeHtml(value || "")}">
        </div>
      `;
}

function settingsSelect(index, field, label, value, options) {
  return `
        <div class="settings-field">
          <label for="settings-${index}-${field}">${label}</label>
          <select class="settings-select" id="settings-${index}-${field}" data-field="${field}">
            ${options.map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${value === optionValue ? "selected" : ""}>${optionLabel}</option>`).join("")}
          </select>
        </div>
      `;
}

function settingsTextarea(index, field, label, value, spanClass = "") {
  const isExpandable = field === "detailNotes" || field === "description";
  const notesClass = field === "detailNotes" ? "notes-textarea" : "";
  return `
        <div class="settings-field ${spanClass}">
          <div class="settings-label-row">
            <label for="settings-${index}-${field}">${label}</label>
            ${isExpandable ? `<button type="button" class="expand-field-btn" onclick="openTextareaEditor(${index}, '${field}', '${escapeHtml(label)}')"><i class="fa-solid fa-expand"></i> Mở rộng</button>` : ""}
          </div>
          <textarea class="settings-textarea ${notesClass}" id="settings-${index}-${field}" data-field="${field}">${escapeHtml(value || "")}</textarea>
        </div>
      `;
}

function settingsWatchLinksGroup(index, type, links, label, spanClass = "span-2") {
  const linkList = links.length ? links : [{ url: "", label: "" }];
  const rows = linkList.map((link, rowIndex) =>
    renderWatchLinkRow(index, type, link, linkList.length > 1)
  ).join("");

  return `
        <div class="settings-field ${spanClass}" data-watch-link-group="${type}">
          <label>${label}</label>
          <div class="watch-links-editor" id="watch-links-${index}-${type}">
            ${rows}
          </div>
          <button type="button" class="watch-link-add-btn" onclick="addWatchLinkRow(${index}, '${type}')" aria-label="Thêm link ${escapeHtml(label)}">
            <i class="fa-solid fa-plus"></i> Thêm link
          </button>
        </div>
      `;
}

function toggleSettingsShow(index) {
  const item = document.querySelector(`[data-settings-index="${index}"]`);
  if (!item) return;

  const isOpening = !item.classList.contains("open");

  if (isOpening) {
    const formContainer = item.querySelector(".settings-show-form");
    if (formContainer && formContainer.innerHTML.trim() === "") {
      const resolved = resolveShowIndex(index);
      if (resolved) {
        const showObj = { ...resolved.baseShow, _index: index };
        formContainer.innerHTML = renderSettingsShowFormHtml(showObj);

        formContainer.querySelectorAll(".settings-input, .settings-select, .settings-textarea").forEach(input => {
          input.disabled = settingsLocked;
        });
        formContainer.querySelectorAll(".settings-save-btn, .settings-delete-btn[data-delete-show]").forEach(button => {
          button.disabled = settingsLocked;
        });
        formContainer.querySelectorAll(".watch-link-label-input, .watch-link-input, .watch-link-add-btn, .watch-link-remove-btn, .watch-link-move-btn").forEach(button => {
          button.disabled = settingsLocked;
        });
        updateWatchLinkRemoveButtons(formContainer.querySelector(".watch-links-editor"));
      }
    }
  }

  item.classList.toggle("open");
}

function saveSettingsShow(index) {
  if (settingsLocked) return;

  const resolved = resolveShowIndex(index);
  if (!resolved) return;

  const item = document.querySelector(`[data-settings-index="${index}"]`);
  if (!item) return;

  if (resolved.isCustom) {
    // Handling custom show
  } else {
    const baseIndex = resolved.baseShow._showsDataIndex;
    if (baseIndex === undefined || baseIndex < 0 || baseIndex >= showsData.length) return;

    const data = { ...showsData[baseIndex] };

    item.querySelectorAll("[data-field]").forEach(input => {
      const field = input.getAttribute("data-field");
      const value = input.value.trim();

      if (field === "rating") {
        const rating = Math.min(5, Math.max(0, parseInt(value, 10) || 0));
        if (rating > 0) data.rating = rating;
        else delete data.rating;
        return;
      }

      if (field === "tags") {
        data.tags = stringToTags(value);
        return;
      }

      if (!value) {
        delete data[field];
      } else {
        data[field] = value;
      }
    });

    applyWatchLinksToData(data, item);
    showsData[baseIndex] = data;
  }

  invalidateSearchIndex();
  updateStatistics();
  renderShows();
  renderSettingsList();
  document.querySelector(`[data-settings-index="${index}"]`)?.classList.add("open");
  const savedShow = getEffectiveShows().find(show => show._index === index);
  showToast(`Đã lưu chỉnh sửa cho "${savedShow?.vietnamese || "show"}"`);
}

function deleteShow(index) {
  const resolved = resolveShowIndex(index);
  if (!resolved) return;

  const show = getShowWithUserData(resolved.baseShow);
  const showName = show.vietnamese || show.chinese || "show";
  const confirmMessage = `Xóa vĩnh viễn "${showName}" khỏi danh sách hiện tại? Nếu muốn giữ thay đổi này trong file, hãy bấm "Tải JSON đã cập nhật" sau khi xóa.`;

  if (!window.confirm(confirmMessage)) return;

  const baseIndex = resolved.baseShow._showsDataIndex;
  if (baseIndex !== undefined && baseIndex >= 0 && baseIndex < showsData.length) {
    showsData.splice(baseIndex, 1);
  }
  invalidateSearchIndex();

  if (currentModalIndex === index) {
    closeShowModal();
    currentModalIndex = null;
  }

  const settingsModal = document.getElementById("settings-modal");
  if (settingsModal.classList.contains("active")) {
    renderSettingsList();
  }

  updateStatistics();
  renderShows();
  showToast(`Đã xóa "${showName}" khỏi danh sách`);
}

function openSettingsForShow(index) {
  const show = getEffectiveShows().find(item => item._index === index);
  if (!show) return;

  closeShowModal();
  currentModalIndex = null;

  settingsLocked = false;
  settingsSearchQuery = show.vietnamese || show.chinese || "";
  const settingsSearchBox = document.getElementById("settings-search-box");
  if (settingsSearchBox) settingsSearchBox.value = settingsSearchQuery;

  renderSettingsList();
  updateSettingsLockState();
  const settingsModal = document.getElementById("settings-modal");
  openAccessibleDialog(settingsModal, settingsSearchBox || settingsModal?.querySelector(".modal-close"));

  requestAnimationFrame(() => {
    const item = document.querySelector(`[data-settings-index="${index}"]`);
    if (item && !item.classList.contains("open")) {
      toggleSettingsShow(index);
    }
    item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  showToast(`Đang chỉnh sửa "${show.vietnamese}"`);
}

function openSettingsForShowFromModal() {
  if (currentModalIndex === null) return;
  openSettingsForShow(currentModalIndex);
}

function deleteShowFromModal() {
  if (currentModalIndex === null) return;
  deleteShow(currentModalIndex);
}

function renderShowPoster(show) {
  const posterUrl = show.image || show.poster || show.posterUrl || "";
  const posterEl = document.getElementById("modal-poster-el");
  if (!posterEl) return;

  if (posterUrl) {
    posterEl.innerHTML = `<img src="${escapeHtml(posterUrl)}" alt="Ảnh show ${escapeHtml(show.vietnamese)}" loading="lazy" decoding="async" width="300" height="400" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'modal-poster-placeholder\\'><i class=\\'fa-regular fa-image\\'></i><div>Không tải được ảnh</div></div>';">`;
    return;
  }

  posterEl.innerHTML = `
        <div class="modal-poster-placeholder">
          <i class="fa-regular fa-image"></i>
          <div>Chưa có ảnh show</div>
          <small>Có thể thêm trường <strong>image</strong> vào dữ liệu show.</small>
        </div>
      `;
}

function renderShowLinks(show) {
  const viLinks = getVietnameseWatchLinks(show);
  const zhLinks = getChineseWatchLinks(show);

  if (Array.isArray(show.watchLinks)) {
    show.watchLinks.forEach(link => {
      const detected = detectPlatformFromUrl(link.url);
      const formatted = {
        label: link.label || "Link xem show",
        url: link.url,
        note: link.note || detected
      };
      const lowerLabel = formatted.label.toLowerCase();
      const lowerNote = (formatted.note || "").toLowerCase();
      if (lowerLabel.includes("trung") || lowerNote.includes("trung") || lowerNote.includes("origin")) {
        zhLinks.push(formatted);
      } else {
        viLinks.push(formatted);
      }
    });
  }

  const linksEl = document.getElementById("modal-links-el");
  const summaryEl = document.getElementById("modal-links-summary");

  const totalLinks = viLinks.length + zhLinks.length;

  if (summaryEl) {
    summaryEl.textContent = totalLinks > 0
      ? `${totalLinks} link`
      : "Chưa có link";
  }

  if (!linksEl) return;

  if (totalLinks === 0) {
    linksEl.innerHTML = `
          <div class="watch-link-item placeholder">
            <div>
              <span class="watch-link-label">Web chiếu tiếng Việt</span>
              <span class="watch-link-note">Chưa thêm link</span>
            </div>
            <i class="fa-solid fa-closed-captioning"></i>
          </div>
          <div class="watch-link-item placeholder">
            <div>
              <span class="watch-link-label">Nơi chiếu tiếng Trung</span>
              <span class="watch-link-note">Chưa thêm link</span>
            </div>
            <i class="fa-solid fa-link"></i>
          </div>
        `;
    return;
  }

  const fragment = document.createDocumentFragment();

  // 1. Render Vietnamese Watch Links
  if (viLinks.length > 0) {
    const viSectionTitle = document.createElement('div');
    viSectionTitle.className = 'modal-links-section-title';
    viSectionTitle.innerHTML = `<i class="fa-solid fa-closed-captioning" style="color: var(--accent-color);"></i> Bản Vietsub / Thuyết minh`;
    fragment.appendChild(viSectionTitle);

    const viLinksList = document.createElement('div');
    viLinksList.className = 'modal-links-list';
    viLinksList.innerHTML = viLinks.map(link => `
          <a class="watch-link-item" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            <div>
              <span class="watch-link-label">${escapeHtml(link.label || "Link xem tiếng Việt")}</span>
              ${link.note ? `<span class="watch-link-note">${escapeHtml(link.note)}</span>` : ""}
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        `).join("");
    fragment.appendChild(viLinksList);
  }

  // 2. Render Chinese Watch Links
  if (zhLinks.length > 0) {
    const zhSectionTitle = document.createElement('div');
    zhSectionTitle.className = 'modal-links-section-title';
    if (viLinks.length > 0) zhSectionTitle.style.marginTop = '1.25rem';
    zhSectionTitle.innerHTML = `<i class="fa-solid fa-earth-asia" style="color: var(--accent-color);"></i> Bản gốc`;
    fragment.appendChild(zhSectionTitle);

    const zhLinksList = document.createElement('div');
    zhLinksList.className = 'modal-links-list';
    zhLinksList.innerHTML = zhLinks.map(link => `
          <a class="watch-link-item" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
            <div>
              <span class="watch-link-label">${escapeHtml(link.label || "Link gốc")}</span>
              ${link.note ? `<span class="watch-link-note">${escapeHtml(link.note)}</span>` : ""}
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        `).join("");
    fragment.appendChild(zhLinksList);
  }

  linksEl.innerHTML = '';
  linksEl.appendChild(fragment);
}

// Modal Control Logic
function openShowModal(index) {
  currentModalIndex = index;
  const els = getModalEls();

  openAccessibleDialog(els.modal, els.modal.querySelector(".modal-close"));

  setTimeout(() => {
    const resolved = resolveShowIndex(index);
    if (!resolved) return;
    const show = getShowWithUserData(resolved.baseShow);

    els.linksCard.classList.remove("open");
    els.linksToggle.setAttribute("aria-expanded", "false");
    els.container.setAttribute("data-plat", getPlatformClass(show.platform));

    els.title.textContent = show.vietnamese;
    els.zh.textContent = show.chinese;
    els.en.textContent = show.english;
    els.vi.textContent = show.vietnamese;
    applyUserEditableFields(show);

    const statusText = renderStatusText(show.status);
    const tagBadgeHtml = renderTagBadge(show.tags || []);
    const timeHtml = renderTimeHtml(show.time);
    const year = getShowYear(show);
    const yearHtml = renderYearHtml(year);

    els.badges.innerHTML = `
          ${renderCountryBadge(show)}
          <span class="badge badge-status ${show.status}">${statusText}</span>
          <span class="badge badge-plat ${getPlatformClass(show.platform)}">${show.platform}</span>
          ${yearHtml}
          ${tagBadgeHtml}
          ${timeHtml}
        `;
    els.ratingSlot.innerHTML = renderInteractiveStarRating(index, getShowRating(show));

    els.btnZh.onclick = () => copyToClipboard(show.chinese, els.btnZh, "Đã copy tên gốc");
    els.btnEn.onclick = () => copyToClipboard(show.english, els.btnEn, "Đã copy tên Anh");
    els.btnVi.onclick = () => copyToClipboard(show.vietnamese, els.btnVi, "Đã copy tên Việt");
  }, 0);
}

function closeShowModal() {
  const els = getModalEls();
  closeAccessibleDialog(els.modal);
}

// Infinite Scroll: Lazy Loading DOM Nodes
function loadMoreShows() {
  const grid = document.getElementById("show-cards-grid");
  if (!grid) return;

  const oldSentinel = document.getElementById("shows-sentinel");
  if (oldSentinel) oldSentinel.remove();

  const start = showsRenderedCount;
  const end = Math.min(start + SHOWS_PER_PAGE, activeFilteredShows.length);

  if (start >= activeFilteredShows.length) return;

  const chunk = activeFilteredShows.slice(start, end);
  const fragment = document.createDocumentFragment();

  chunk.forEach(show => {
    const card = document.createElement("div");
    card.className = "show-card";
    card.setAttribute("data-plat", getPlatformClass(show.platform));

    const originalIndex = show._index;

    const statusText = renderStatusText(show.status);
    const tagBadgeHtml = renderTagBadge(show.tags || []);
    const timeHtml = renderTimeHtml(show.time);
    const year = getShowYear(show);
    const yearHtml = renderYearHtml(year);
    const ratingHtml = renderInteractiveStarRating(originalIndex, getShowRating(show));
    const thumbUrl = getShowImage(show);
    const thumbHtml = thumbUrl
      ? `<img src="${escapeHtml(thumbUrl)}" alt="Ảnh ${escapeHtml(show.vietnamese)}" loading="lazy" decoding="async" width="110" height="110" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fa-regular fa-image card-thumb-placeholder\\'></i>';">`
      : `<i class="fa-regular fa-image card-thumb-placeholder"></i>`;

    card.innerHTML = `
          <div>
            <div class="card-top-row">
              <div class="card-thumb">${thumbHtml}</div>
              <div class="card-top-info">
                <div class="card-header">
                  <div class="badges">
                    ${renderCountryBadge(show)}
                    <span class="badge badge-status ${show.status}">${statusText}</span>
                    <span class="badge badge-plat ${getPlatformClass(show.platform)}">${escapeHtml(show.platform)}</span>
                    ${yearHtml}
                    ${tagBadgeHtml}
                  </div>
                  ${timeHtml}
                  ${ratingHtml}
                </div>
              </div>
            </div>

            <div class="card-compact-title">
              <div class="card-title-main">${escapeHtml(show.vietnamese || show.english || show.chinese)}</div>
              <div class="card-title-sub">${escapeHtml(show.english || show.chinese)}</div>
            </div>
          </div>
          
          <button class="open-modal-btn" type="button" data-show-index="${originalIndex}" title="Mở cửa sổ chi tiết tiêu điểm show" aria-label="Xem chi tiết ${escapeHtml(show.vietnamese || show.english || show.chinese)}">
            <i class="fa-solid fa-up-right-from-square"></i> Xem chi tiết & Tiêu điểm
          </button>
        `;

    fragment.appendChild(card);
  });

  showsRenderedCount = end;

  if (showsRenderedCount < activeFilteredShows.length) {
    const sentinel = document.createElement("div");
    sentinel.id = "shows-sentinel";
    sentinel.style.height = "20px";
    sentinel.style.width = "100%";
    sentinel.style.gridColumn = "1 / -1";
    fragment.appendChild(sentinel);

    setupSentinelObserver(sentinel);
  }

  grid.appendChild(fragment);
}

function setupSentinelObserver(sentinel) {
  if (sentinelObserver) {
    sentinelObserver.disconnect();
  }

  sentinelObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMoreShows();
    }
  }, {
    rootMargin: "300px"
  });

  sentinelObserver.observe(sentinel);
}

function resetFilterButtonsUI() {
  const filterGroups = [
    { containerId: "status-filters", attr: "data-status", defaultValue: "all" },
    { containerId: "sort-controls", attr: "data-sort", defaultValue: "name-asc" },
    { containerId: "country-filters", attr: "data-country", defaultValue: "all" },
    { containerId: "tag-filters", attr: "data-tag", defaultValue: "all" }
  ];

  filterGroups.forEach(({ containerId, attr, defaultValue }) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const buttons = container.querySelectorAll(".filter-btn");
    buttons.forEach(btn => {
      const val = btn.getAttribute(attr);
      const isActive = val === defaultValue;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });
  });
}

function resetAllFilters() {
  currentFilters = {
    search: "",
    status: "all",
    country: "all",
    tag: "all",
    sort: "name-asc"
  };

  const searchBox = document.getElementById("search-box");
  if (searchBox) searchBox.value = "";
  const floatingSearchBox = document.getElementById("floating-search-box");
  if (floatingSearchBox) floatingSearchBox.value = "";

  resetFilterButtonsUI();
  renderShows();
  showToast("Đã xóa tất cả bộ lọc");
}

// Filter and Render Shows
function renderShows() {
  const grid = document.getElementById("show-cards-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const query = removeVietnameseTones(currentFilters.search.toLowerCase().trim());

  const filtered = getEffectiveShows().filter(show => {
    // Status Filter
    if (currentFilters.status !== "all" && show.status !== currentFilters.status) {
      return false;
    }

    if (currentFilters.country !== "all" && getShowCountry(show) !== currentFilters.country) {
      return false;
    }

    // Tag Filter
    if (currentFilters.tag !== "all") {
      if (currentFilters.tag === "normal" && ((show.tags || []).includes("all-female") || (show.tags || []).includes("all-male") || (show.tags || []).includes("bisexual") || (show.tags || []).includes("other"))) {
        return false;
      }
      if (currentFilters.tag === "all-female" && !(show.tags || []).includes("all-female")) {
        return false;
      }
      if (currentFilters.tag === "all-male" && !(show.tags || []).includes("all-male")) {
        return false;
      }
      if (currentFilters.tag === "bisexual" && !(show.tags || []).includes("bisexual")) {
        return false;
      }
      if (currentFilters.tag === "other" && !(show.tags || []).includes("other")) {
        return false;
      }
    }

    // Search Query filter (Using pre-computed search token)
    if (query !== "") {
      const token = show._searchToken || getShowSearchText(show);
      return token.includes(query);
    }

    return true;
  });

  // Sorting Logic
  filtered.sort((a, b) => {
    switch (currentFilters.sort) {
      case "name-desc":
        return compareShowsByVietnameseName(b, a);
      case "stars": {
        const ratingA = getShowRating(a);
        const ratingB = getShowRating(b);
        if (ratingB !== ratingA) return ratingB - ratingA;
        return compareShowsByVietnameseName(a, b);
      }
      case "year": {
        const yearA = getSortableYear(a);
        const yearB = getSortableYear(b);
        if (yearB !== yearA) return yearB - yearA;
        return compareShowsByVietnameseName(a, b);
      }
      case "name-en": {
        const enA = (a.english || "").toLowerCase();
        const enB = (b.english || "").toLowerCase();
        return enA.localeCompare(enB, "en");
      }
      case "watch-link": {
        const viA = getVietnameseWatchLinks(a).length;
        const viB = getVietnameseWatchLinks(b).length;
        const zhA = getChineseWatchLinks(a).length;
        const zhB = getChineseWatchLinks(b).length;
        const hasLinkA = (viA + zhA) > 0 ? 1 : 0;
        const hasLinkB = (viB + zhB) > 0 ? 1 : 0;
        if (hasLinkB !== hasLinkA) return hasLinkB - hasLinkA;
        return compareShowsByVietnameseName(a, b);
      }
      case "name-asc":
      default:
        return compareShowsByVietnameseName(a, b);
    }
  });

  const announcer = document.getElementById("filter-status-announcer");

  if (filtered.length === 0) {
    grid.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-ghost empty-state-icon"></i>
            <h3 class="empty-state-title">Không tìm thấy show nào!</h3>
            <p class="empty-state-desc">Không có kết quả phù hợp với từ khóa hoặc bộ lọc hiện tại. Hãy thử thay đổi tìm kiếm hoặc đặt lại bộ lọc.</p>
            <button class="empty-state-reset-btn" type="button" onclick="resetAllFilters()">
              <i class="fa-solid fa-rotate-left"></i> Xóa tất cả bộ lọc
            </button>
          </div>
        `;
    if (announcer) announcer.textContent = "Không tìm thấy show nào phù hợp.";
    return;
  }

  if (announcer) announcer.textContent = `Hiển thị ${filtered.length} show kết quả.`;

  activeFilteredShows = filtered;
  showsRenderedCount = 0;

  loadMoreShows();
}

async function loadShowsData() {
  try {
    const response = await fetch(`./showsData.json?v=${DATA_VERSION}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    showsData = await response.json();
    if (!Array.isArray(showsData)) throw new Error('showsData.json must contain an array');
    invalidateSearchIndex();
  } catch (err) {
    console.error('Cannot load showsData.json:', err);
    showToast('Khong tai duoc showsData.json. Hay chay qua local server hoac kiem tra file du lieu.', true);
    showsData = [];
  }
}

function setActiveFilterButton(activeButton, buttons) {
  buttons.forEach(button => {
    const isActive = button === activeButton;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function initializeAppEvents() {
  getModalEls();
  document.addEventListener("keydown", handleDialogKeydown);

  updateStatistics();
  renderShows();

  const grid = document.getElementById("show-cards-grid");
  grid?.addEventListener("click", (e) => {
    const btn = e.target.closest(".open-modal-btn[data-show-index]");
    if (btn) {
      const index = parseInt(btn.getAttribute("data-show-index"), 10);
      if (!isNaN(index)) openShowModal(index);
    }
  });

  const searchBox = document.getElementById("search-box");
  const floatingSearchBox = document.getElementById("floating-search-box");
  const floatingSearchWrapper = document.getElementById("floating-search-wrapper");
  const floatingSearchBtn = document.getElementById("floating-search-btn");
  const floatingSearchClearBtn = document.getElementById("floating-search-clear-btn");

  function updateSearchQuery(val) {
    if (searchBox) searchBox.value = val;
    if (floatingSearchBox) floatingSearchBox.value = val;
    currentFilters.search = val;

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderShows();
    }, 250);
  }

  searchBox?.addEventListener("input", (e) => {
    updateSearchQuery(e.target.value);
  });

  floatingSearchBox?.addEventListener("input", (e) => {
    updateSearchQuery(e.target.value);
  });

  floatingSearchBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = floatingSearchWrapper.classList.toggle("open");
    if (isOpen) {
      floatingSearchBox?.focus();
    }
  });

  floatingSearchClearBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    updateSearchQuery("");
    floatingSearchBox?.focus();
  });

  document.addEventListener("click", (e) => {
    if (floatingSearchWrapper?.classList.contains("open") && !floatingSearchWrapper.contains(e.target)) {
      floatingSearchWrapper.classList.remove("open");
    }
  });

  let settingsSearchTimeout = null;
  const settingsSearchBox = document.getElementById("settings-search-box");
  settingsSearchBox?.addEventListener("input", (e) => {
    settingsSearchQuery = e.target.value;
    clearTimeout(settingsSearchTimeout);
    settingsSearchTimeout = setTimeout(() => {
      renderSettingsList();
    }, 200);
  });

  const statusButtons = document.querySelectorAll("#status-filters .filter-btn");
  statusButtons.forEach(btn => btn.addEventListener("click", () => {
    setActiveFilterButton(btn, statusButtons);
    setTimeout(() => {
      currentFilters.status = btn.getAttribute("data-status");
      renderShows();
    }, 0);
  }));

  const sortButtons = document.querySelectorAll("#sort-controls .filter-btn");
  sortButtons.forEach(btn => btn.addEventListener("click", () => {
    setActiveFilterButton(btn, sortButtons);
    setTimeout(() => {
      currentFilters.sort = btn.getAttribute("data-sort");
      renderShows();
    }, 0);
  }));

  const countryButtons = document.querySelectorAll("#country-filters .filter-btn");
  countryButtons.forEach(btn => btn.addEventListener("click", () => {
    setActiveFilterButton(btn, countryButtons);
    setTimeout(() => {
      currentFilters.country = btn.getAttribute("data-country");
      renderShows();
    }, 0);
  }));

  const tagButtons = document.querySelectorAll("#tag-filters .filter-btn");
  tagButtons.forEach(btn => btn.addEventListener("click", () => {
    setActiveFilterButton(btn, tagButtons);
    setTimeout(() => {
      currentFilters.tag = btn.getAttribute("data-tag");
      renderShows();
    }, 0);
  }));

  document.getElementById("modal-links-toggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const linksCard = document.getElementById("modal-links-card");
    const isOpen = linksCard.classList.toggle("open");
    document.getElementById("modal-links-toggle").setAttribute("aria-expanded", String(isOpen));
  });

  const modalLinksEl = document.getElementById("modal-links-el");
  modalLinksEl?.addEventListener("click", (e) => {
    const link = e.target.closest(".watch-link-item");
    if (link) {
      e.stopPropagation();
    }
  });

  const scrollBtn = document.getElementById("scroll-btn");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) scrollBtn?.classList.add("visible");
    else scrollBtn?.classList.remove("visible");
  }, { passive: true });
  scrollBtn?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  const modal = document.getElementById("show-modal");
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeShowModal();
  });

  const settingsModal = document.getElementById("settings-modal");
  settingsModal?.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  const textareaEditorModal = document.getElementById("textarea-editor-modal");
  textareaEditorModal?.addEventListener("click", (e) => {
    if (e.target === textareaEditorModal) closeTextareaEditor();
  });
}

// Textarea Editor Modal Handlers
let activeEditorTarget = { index: null, field: null };

function openTextareaEditor(index, field, label) {
  activeEditorTarget = { index, field };

  const show = getEffectiveShows().find(s => s._index === index);
  const showName = show ? (show.vietnamese || show.chinese || "") : "";

  const titleEl = document.getElementById("textarea-editor-title");
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--accent-color);"></i> Chỉnh sửa ${label} <span style="font-size: 1.1rem; color: var(--text-muted); font-weight: normal; margin-left: 0.5rem;">— ${escapeHtml(showName)}</span>`;
  }

  const mainTextarea = document.getElementById(`settings-${index}-${field}`);
  const modalTextarea = document.getElementById("textarea-editor-input");

  if (mainTextarea && modalTextarea) {
    modalTextarea.value = mainTextarea.value;
  }

  if (modalTextarea) {
    modalTextarea.disabled = settingsLocked;
  }
  const modalActions = document.querySelector("#textarea-editor-modal .modal-action-btn.edit");
  if (modalActions) {
    modalActions.disabled = settingsLocked;
  }

  const modal = document.getElementById("textarea-editor-modal");
  if (modal) {
    openAccessibleDialog(modal, modalTextarea || modal.querySelector(".modal-close"));
  }
}

function closeTextareaEditor() {
  const modal = document.getElementById("textarea-editor-modal");

  const settingsModal = document.getElementById("settings-modal");
  const keepScrollLocked = settingsModal && settingsModal.classList.contains("active");
  closeAccessibleDialog(modal, { keepScrollLocked });
  activeEditorTarget = { index: null, field: null };
}

function saveTextareaEditor() {
  if (settingsLocked) return;

  const { index, field } = activeEditorTarget;
  if (index === null || field === null) return;

  const mainTextarea = document.getElementById(`settings-${index}-${field}`);
  const modalTextarea = document.getElementById("textarea-editor-input");

  if (mainTextarea && modalTextarea) {
    mainTextarea.value = modalTextarea.value;
  }

  closeTextareaEditor();
  showToast("Đã cập nhật nội dung (Nhớ bấm 'Lưu show này' để lưu lại)");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadShowsData();
  mergeLegacyCustomShowsIntoShowsData();
  initializeAppEvents();
});
