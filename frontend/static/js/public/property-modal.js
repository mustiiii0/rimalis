// ===== PROPERTY MODAL (API-DRIVEN) =====

let currentImageIndex = 0;
let currentProperty = null;
let similarProperties = [];
let viewingSlots = [];
let selectedViewingSlotId = '';
const PROPERTY_MODAL_FAVORITES_KEY = 'rimalis_favorites';
const PROPERTY_MODAL_LEGACY_FAVORITES_KEY = 'rimalisFavorites';
const PROPERTY_MODAL_PENDING_CHAT_KEY = 'rimalis_pending_chat_thread';
let hasBootstrapped = false;
let hasBoundPropertyModalActions = false;

function templatePath(path) {
  const normalized = String(path || '');
  return (window.location.pathname || '').includes('/templates/mobile/')
    ? normalized.replace('/templates/', '/templates/mobile/')
    : normalized;
}

function migrateLegacyFavoritesKey() {
  const oldValue = localStorage.getItem(PROPERTY_MODAL_LEGACY_FAVORITES_KEY);
  if (oldValue && !localStorage.getItem(PROPERTY_MODAL_FAVORITES_KEY)) {
    localStorage.setItem(PROPERTY_MODAL_FAVORITES_KEY, oldValue);
  }
  if (oldValue) localStorage.removeItem(PROPERTY_MODAL_LEGACY_FAVORITES_KEY);
}

function goBackToListings() {
  if (document.referrer && document.referrer.startsWith(window.location.origin)) {
    window.history.back();
    return;
  }
  window.location.href = templatePath('/templates/public/properties.html');
}

function getCurrentPropertyId() {
  return currentProperty?.id || getPropertyIdFromUrl();
}

function getPropertyIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('id') || '').trim();
}

function getPropertyIdCandidates(rawId) {
  const id = String(rawId || '').trim();
  if (!id) return [];
  const candidates = [id];
  if (id.startsWith('listing-')) {
    candidates.push(id.slice('listing-'.length));
  } else {
    candidates.push(`listing-${id}`);
  }
  return [...new Set(candidates.filter(Boolean))];
}

function withTimeout(promise, timeoutMs = 15000, message = 'Request timeout') {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) window.clearTimeout(timer);
  });
}

async function fetchPropertyById(rawId) {
  const candidates = getPropertyIdCandidates(rawId);
  let lastError = null;

  for (const id of candidates) {
    try {
      const body = await withTimeout(
        requestJson(`/properties/${encodeURIComponent(id)}`),
        12000,
        i18n('property_request_timeout', 'Tidsgränsen nåddes vid hämtning av objektet')
      );
      if (body?.property) return body.property;
    } catch (err) {
      lastError = err;
      if (err?.status && err.status !== 404) break;
    }
  }

  throw lastError || new Error(i18n('property_load_failed'));
}

function i18n(key, fallback = key) {
  return window.RimalisI18n?.t?.(key, fallback) || fallback;
}

async function requestJson(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  const hasBody = options.body !== undefined && options.body !== null;

  if (window.RimalisAPI?.request) {
    return window.RimalisAPI.request(path, {
      method,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      auth: Boolean(options.auth),
      headers,
    });
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      'X-Requested-With': 'XMLHttpRequest',
      ...headers,
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
    credentials: 'include',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const err = new Error(body.message || `HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return body;
}

function formatSek(price) {
  return window.RimalisI18n?.formatCurrencySEK?.(price, { compact: false }) || '-';
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatMaybeNumber(value) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : String(value);
}

function withUnit(value, unit) {
  if (value === null || value === undefined || value === '' || value === '-') return '-';
  return `${value} ${unit}`.trim();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeImageUrl(url, fallback) {
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/static/uploads/')) return trimmed;
  if (trimmed.startsWith('/uploads/')) return trimmed;
  if (trimmed.startsWith('data:image/')) return trimmed;
  return fallback;
}

function placeholderImage(title) {
  const label = encodeURIComponent(title || i18n('no_image'));
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#121212"/><text x="50%" y="50%" fill="#888" font-size="42" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
  )}`;
}

function placeholderAvatar(name) {
  const safeName = escapeHtml(name || i18n('property_agent_fallback'));
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#1c1c1f"/><circle cx="200" cy="150" r="72" fill="#2a2a2f"/><rect x="92" y="240" width="216" height="120" rx="60" fill="#2a2a2f"/><text x="50%" y="92%" fill="#a1a1a8" font-size="22" text-anchor="middle">${safeName}</text></svg>`
  )}`;
}

function referenceFromId(id) {
  const source = String(id || '');
  if (!source) return '-';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash * 31) + source.charCodeAt(i)) >>> 0;
  }
  return `RG8-${String(hash % 10000).padStart(4, '0')}`;
}

function renderLoadError(message, rawId = '') {
  const title = document.getElementById('propertyTitle');
  const ref = document.getElementById('propertyRef');
  const location = document.getElementById('propertyLocationText');
  const address = document.getElementById('propertyAddressText');
  const price = document.getElementById('propertyPrice');
  const gallery = document.getElementById('mainImage');
  const details = document.getElementById('propertyDescription');

  if (title) title.textContent = i18n('property_load_failed');
  if (ref) ref.textContent = `${i18n('property_reference_label')}: ${referenceFromId(rawId)}`;
  if (location) location.textContent = '-';
  if (address) address.textContent = '-';
  if (price) price.textContent = '-';
  if (details) details.textContent = message || i18n('property_try_again');
  if (gallery) {
    gallery.textContent = '';
    const errorBox = document.createElement('div');
    errorBox.className = 'w-full h-full bg-white/5 flex items-center justify-center text-red-300 text-sm px-6 text-center';
    errorBox.textContent = message || i18n('property_try_again');
    gallery.appendChild(errorBox);
  }
}

function mapPropertyFromApi(property) {
  const details = property?.listingDetails || {};
  const type = String(property?.propertyType || '').trim();
  const bathrooms = details.bathrooms ?? '-';
  const floor = details.floor ?? details.floors ?? '-';
  const length = details.length ?? '-';
  const width = details.width ?? '-';
  const fallbackImage = placeholderImage(property.title);
  const rawImages = Array.isArray(property?.imageUrls)
    ? property.imageUrls
    : (Array.isArray(details?.imageUrls) ? details.imageUrls : []);
  const sanitizedImages = rawImages
    .map((url) => safeImageUrl(url, ''))
    .filter(Boolean);
  const heroImage = safeImageUrl(property.imageUrl, sanitizedImages[0] || fallbackImage);
  const floorPlanImage = safeImageUrl(property.floorPlanUrl, heroImage);
  const imageSet = new Set([heroImage, ...sanitizedImages]);
  if (floorPlanImage && floorPlanImage !== heroImage) imageSet.add(floorPlanImage);
  const images = [...imageSet];
  const ownerName =
    property?.owner?.name ||
    property?.ownerName ||
    property?.owner_name ||
    property?.publisherName ||
    property?.publisher_name ||
    details?.publisherName ||
    details?.ownerName ||
    details?.owner_name ||
    i18n('property_agent_default_name');
  const ownerEmail =
    property?.owner?.email ||
    property?.ownerEmail ||
    property?.owner_email ||
    '';
  const ownerPhone =
    property?.owner?.phone ||
    property?.ownerPhone ||
    property?.owner_phone ||
    '';
  const ownerWhatsappPhone =
    property?.owner?.whatsappPhone ||
    property?.owner?.whatsapp_phone ||
    property?.ownerWhatsappPhone ||
    property?.owner_whatsapp_phone ||
    '';
  const ownerTitle =
    property?.owner?.title ||
    property?.owner?.role ||
    details?.agentTitle ||
    i18n('property_agent_title');
  const ownerBio =
    property?.owner?.bio ||
    details?.agentBio ||
    '';
  const ownerAvatar = property?.owner?.avatarUrl || placeholderAvatar(ownerName);
  const priceValue = toNumber(property?.price);
  return {
    id: property.id,
    status: String(property?.status || '').trim().toLowerCase(),
    ownerId: property.ownerId || property.owner_id || property?.owner?.id || null,
    ref: property.referenceCode || referenceFromId(property.id),
    title: property.title || i18n('property_no_title'),
    location: property.location || i18n('property_location_missing'),
    address: property.address || details.address || '',
    price: formatSek(property.price),
    priceValue,
    oldPrice: '',
    description: property.description || i18n('property_desc_pending'),
    images,
    floorplan: floorPlanImage,
    features: {
      area: formatMaybeNumber(details.area ?? property.livingArea),
      rooms: formatMaybeNumber(details.rooms ?? property.rooms),
      bathrooms: formatMaybeNumber(bathrooms),
      floor: formatMaybeNumber(floor),
      length: formatMaybeNumber(length),
      width: formatMaybeNumber(width),
      propertyType: type || '-',
    },
    propertyType: type,
    listingDetails: details,
    agent: {
      name: ownerName,
      title: ownerTitle,
      bio: ownerBio,
      phone: ownerPhone,
      whatsappPhone: ownerWhatsappPhone,
      email: ownerEmail,
      image: ownerAvatar,
    },
  };
}

function buildMapQuery(property) {
  const address = String(property?.address || '').trim();
  const city = String(property?.location || '').trim();
  return [address, city].filter(Boolean).join(', ') || city || address || 'Stockholm';
}

function updatePropertyMap(property) {
  const frame = document.getElementById('propertyMapFrame');
  const link = document.getElementById('propertyMapLink');
  const query = buildMapQuery(property);
  const encoded = encodeURIComponent(query);
  if (frame) frame.src = `https://www.google.com/maps?q=${encoded}&output=embed`;
  if (frame) frame.title = i18n('property_map_frame_title', 'Objektskarta');
  if (link) link.href = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function normalizeType(typeValue) {
  return String(typeValue || '')
    .trim()
    .toLowerCase();
}

function cityFromLocation(locationValue) {
  const raw = String(locationValue || '').trim();
  if (!raw) return '';
  return raw.split(',')[0].trim().toLowerCase();
}

function pickSimilarProperties(properties, current) {
  const source = Array.isArray(properties) ? properties : [];
  const currentType = normalizeType(current?.propertyType);
  const currentCity = cityFromLocation(current?.location);
  const currentPrice = toNumber(current?.priceValue);
  const minPrice = currentPrice > 0 ? currentPrice * 0.7 : 0;
  const maxPrice = currentPrice > 0 ? currentPrice * 1.3 : 0;

  return source
    .filter((p) => p && p.id !== current.id)
    .map((p) => {
      const pType = normalizeType(p.propertyType);
      const pCity = cityFromLocation(p.location);
      const pPrice = toNumber(p.price);
      let score = 0;

      if (currentCity && pCity && currentCity === pCity) score += 5;
      if (currentType && pType && currentType === pType) score += 4;
      if (currentPrice > 0 && pPrice >= minPrice && pPrice <= maxPrice) score += 3;
      if (currentPrice > 0 && pPrice > 0 && Math.abs(pPrice - currentPrice) <= currentPrice * 0.1) score += 2;

      return {
        ...p,
        __score: score,
        __priceDiff: currentPrice > 0 && pPrice > 0 ? Math.abs(pPrice - currentPrice) : Number.MAX_SAFE_INTEGER,
      };
    })
    .sort((a, b) => {
      if (b.__score !== a.__score) return b.__score - a.__score;
      return a.__priceDiff - b.__priceDiff;
    })
    .slice(0, 6);
}

function shouldShowWatermark(propertyLike) {
  if (!propertyLike?.listingDetails?.watermarkEnabled) return false;
  const status = String(propertyLike?.status || '').trim().toLowerCase();
  return !status || status === 'published';
}

function watermarkBadgeMarkup() {
  return '<span class="property-watermark-badge">RIMALIS</span>';
}

function propertyHeroBadge(propertyLike) {
  const details = propertyLike?.listingDetails || {};
  const status = String(propertyLike?.status || '').trim().toLowerCase();
  const description = String(propertyLike?.description || '').toLowerCase();
  if (status === 'sold') return i18n('property_status_sold', 'Såld');
  if (description.includes('nyproduktion')) return i18n('property_tag_new_build', 'Nyproduktion');
  if (details.watermarkEnabled) return i18n('property_tag_verified', 'Verifierad');
  return i18n('property_status_active', 'Ny i marknaden');
}

function galleryMainImageMarkup(imageUrl, index, title) {
  const img = safeImageUrl(imageUrl, placeholderImage(title));
  const watermark = shouldShowWatermark(currentProperty) ? watermarkBadgeMarkup() : '';
  const count = Array.isArray(currentProperty?.images) ? currentProperty.images.length : 0;
  const floorPlanCount = currentProperty?.floorplan ? 1 : 0;
  const heroBadge = propertyHeroBadge(currentProperty);
  return `
    <img class="pm-main-image" src="${img}" alt="${escapeHtml(title)}" data-open-lightbox="${index}" fetchpriority="high">
    <div class="gallery-top-meta">
      <span class="gallery-top-badge"><i class="fas fa-bolt"></i>${escapeHtml(heroBadge)}</span>
      <div class="gallery-top-stats">
        <span class="gallery-top-stat"><i class="fas fa-camera"></i>${count}</span>
        <span class="gallery-top-stat"><i class="fas fa-file-image"></i>${floorPlanCount}</span>
      </div>
    </div>
    <button class="main-gallery-nav prev" type="button" data-gallery-nav="-1" aria-label="${escapeHtml(i18n('property_previous_image', 'Föregående bild'))}">
      <i class="fas fa-chevron-left"></i>
    </button>
    <button class="main-gallery-nav next" type="button" data-gallery-nav="1" aria-label="${escapeHtml(i18n('property_next_image', 'Nästa bild'))}">
      <i class="fas fa-chevron-right"></i>
    </button>
    <div class="mobile-gallery-count"><span>${index + 1} / ${count || 1}</span></div>
    ${watermark}
  `;
}

function galleryThumbMarkup(imageUrl, index, title, active) {
  const img = safeImageUrl(imageUrl, placeholderImage(title));
  const watermark = shouldShowWatermark(currentProperty) ? watermarkBadgeMarkup() : '';
  return `
    <button type="button" class="gallery-thumb ${active ? 'active' : ''}" data-gallery-index="${index}" aria-label="${escapeHtml(title)} ${index + 1}">
      <img class="pm-thumb-image" src="${img}" alt="${escapeHtml(title)}" loading="lazy">
      ${watermark}
    </button>
  `;
}

function renderMainGalleryImage(container, imageUrl, index, title) {
  if (!container) return;
  container.textContent = '';

  const img = document.createElement('img');
  img.className = 'pm-main-image';
  img.src = safeImageUrl(imageUrl, placeholderImage(title));
  img.alt = title;
  img.setAttribute('data-open-lightbox', String(index));
  img.setAttribute('fetchpriority', 'high');
  container.appendChild(img);

  const topMeta = document.createElement('div');
  topMeta.className = 'gallery-top-meta';

  const heroBadge = document.createElement('span');
  heroBadge.className = 'gallery-top-badge';
  const heroIcon = document.createElement('i');
  heroIcon.className = 'fas fa-bolt';
  heroBadge.append(heroIcon, document.createTextNode(propertyHeroBadge(currentProperty)));

  const stats = document.createElement('div');
  stats.className = 'gallery-top-stats';

  const count = Array.isArray(currentProperty?.images) ? currentProperty.images.length : 0;
  const floorPlanCount = currentProperty?.floorplan ? 1 : 0;
  const camera = document.createElement('span');
  camera.className = 'gallery-top-stat';
  const cameraIcon = document.createElement('i');
  cameraIcon.className = 'fas fa-camera';
  camera.append(cameraIcon, document.createTextNode(String(count)));
  const floor = document.createElement('span');
  floor.className = 'gallery-top-stat';
  const floorIcon = document.createElement('i');
  floorIcon.className = 'fas fa-file-image';
  floor.append(floorIcon, document.createTextNode(String(floorPlanCount)));
  stats.append(camera, floor);
  topMeta.append(heroBadge, stats);
  container.appendChild(topMeta);

  const prev = document.createElement('button');
  prev.className = 'main-gallery-nav prev';
  prev.type = 'button';
  prev.dataset.galleryNav = '-1';
  prev.setAttribute('aria-label', i18n('property_previous_image', 'Föregående bild'));
  const prevIcon = document.createElement('i');
  prevIcon.className = 'fas fa-chevron-left';
  prev.appendChild(prevIcon);

  const next = document.createElement('button');
  next.className = 'main-gallery-nav next';
  next.type = 'button';
  next.dataset.galleryNav = '1';
  next.setAttribute('aria-label', i18n('property_next_image', 'Nästa bild'));
  const nextIcon = document.createElement('i');
  nextIcon.className = 'fas fa-chevron-right';
  next.appendChild(nextIcon);

  const counter = document.createElement('div');
  counter.className = 'mobile-gallery-count';
  const counterText = document.createElement('span');
  counterText.textContent = `${index + 1} / ${count || 1}`;
  counter.appendChild(counterText);

  container.append(prev, next, counter);

  if (shouldShowWatermark(currentProperty)) {
    const wm = document.createElement('span');
    wm.className = 'property-watermark-badge';
    wm.textContent = 'RIMALIS';
    container.appendChild(wm);
  }
}

function renderGalleryThumb(container, imageUrl, index, title, active) {
  if (!container) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `gallery-thumb ${active ? 'active' : ''}`.trim();
  button.dataset.galleryIndex = String(index);
  button.setAttribute('aria-label', `${title} ${index + 1}`);

  const img = document.createElement('img');
  img.className = 'pm-thumb-image';
  img.src = safeImageUrl(imageUrl, placeholderImage(title));
  img.alt = title;
  img.loading = 'lazy';
  button.appendChild(img);

  if (shouldShowWatermark(currentProperty)) {
    const wm = document.createElement('span');
    wm.className = 'property-watermark-badge';
    wm.textContent = 'RIMALIS';
    button.appendChild(wm);
  }

  container.appendChild(button);
}

function setButtonLoading(btn, text) {
  if (!btn) return () => {};
  const snapshot = {
    disabled: btn.disabled,
    children: Array.from(btn.childNodes).map((node) => node.cloneNode(true)),
  };
  btn.disabled = true;
  btn.textContent = '';
  const icon = document.createElement('i');
  icon.className = 'fas fa-spinner fa-spin';
  btn.append(icon, document.createTextNode(text));
  return () => {
    btn.disabled = snapshot.disabled;
    btn.textContent = '';
    snapshot.children.forEach((node) => btn.appendChild(node));
  };
}

function applySmartFitToImage(img, container) {
  if (!img || !container) return;
  const apply = () => {
    const w = Number(img.naturalWidth || 0);
    const h = Number(img.naturalHeight || 0);
    if (!w || !h) return;
    if (container.id === 'mainImage') {
      container.classList.remove('long-image-mode');
      img.classList.remove('fit-contain');
      return;
    }
    const ratio = w / h;
    const isLong = ratio >= 1.85 || ratio <= 0.7;
    container.classList.toggle('long-image-mode', isLong);
    img.classList.toggle('fit-contain', isLong);
  };
  if (img.complete) apply();
  img.addEventListener('load', apply, { once: true });
}

function enhanceGalleryFit() {
  const mainWrap = document.getElementById('mainImage');
  const mainImg = mainWrap?.querySelector('.pm-main-image');
  if (mainWrap && mainImg) applySmartFitToImage(mainImg, mainWrap);

  document.querySelectorAll('#gallerySide .gallery-thumb').forEach((thumb) => {
    const thumbImg = thumb.querySelector('.pm-thumb-image');
    if (thumbImg) applySmartFitToImage(thumbImg, thumb);
  });
}

async function initPropertyModal() {
  window.__propertyModalBooting = true;
  setPropertyModalSkeleton(true);
  const rawPropertyId = getPropertyIdFromUrl();
  if (!rawPropertyId) {
    const message = i18n('property_invalid');
    renderLoadError(message, rawPropertyId);
    if (typeof showNotification === 'function') showNotification(message, 'error');
    return;
  }

  try {
    const property = await fetchPropertyById(rawPropertyId);
    currentProperty = mapPropertyFromApi(property);
    similarProperties = [];

    document.title = `Rimalis Group | ${currentProperty.title}`;
    updatePropertyInfo(currentProperty);
    updateGallery(currentProperty.images);
    updateAgent(currentProperty.agent);
    updateSimilarProperties();
    updateFavoriteStatus(currentProperty.id);
    initLightbox();
    initImageGallery();
    window.__propertyModalLoaded = true;

    try {
      const listRes = await withTimeout(
        requestJson('/properties/public'),
        12000,
        i18n('property_request_timeout', 'Tidsgränsen nåddes vid hämtning av liknande objekt')
      );
      similarProperties = pickSimilarProperties(listRes.properties || [], currentProperty);
      updateSimilarProperties();
    } catch (_err) {
      similarProperties = [];
      updateSimilarProperties();
    }
  } catch (err) {
    const message = err?.message || i18n('property_load_failed');
    renderLoadError(message, rawPropertyId);
    if (typeof showNotification === 'function') {
      showNotification(message, 'error');
    }
    window.__propertyModalLoaded = true;
  } finally {
    setPropertyModalSkeleton(false);
    window.__propertyModalBooting = false;
  }
}

function setPropertyModalSkeleton(isLoading) {
  const body = document.body;
  if (body) body.classList.toggle('property-modal-loading', Boolean(isLoading));

  const title = document.getElementById('propertyTitle');
  const location = document.getElementById('propertyLocationText');
  const price = document.getElementById('propertyPrice');
  const description = document.getElementById('propertyDescription');
  const mainImage = document.getElementById('mainImage');
  const gallerySide = document.getElementById('gallerySide');
  const detailsGrid = document.getElementById('propertyDetailsGrid');
  const similar = document.getElementById('similarProperties');
  const floorplanImage = document.getElementById('floorplanImage');
  const agentName = document.getElementById('agentName');
  const agentTitle = document.getElementById('agentTitle');
  const agentImage = document.getElementById('agentImage');

  if (!isLoading) return;

  if (title) title.textContent = i18n('common_loading', 'Laddar...');
  if (location) location.textContent = '-';
  if (price) price.textContent = '-';
  if (description) description.textContent = i18n('common_loading', 'Laddar...');
  if (mainImage) {
    mainImage.textContent = '';
    const skeleton = document.createElement('div');
    skeleton.className = 'pm-skeleton-box pm-skeleton-main';
    mainImage.appendChild(skeleton);
  }
  if (gallerySide) {
    gallerySide.textContent = '';
    Array.from({ length: 4 }).forEach(() => {
      const thumb = document.createElement('div');
      thumb.className = 'gallery-thumb pm-skeleton-box pm-skeleton-thumb';
      gallerySide.appendChild(thumb);
    });
  }
  if (detailsGrid) {
    detailsGrid.textContent = '';
    Array.from({ length: 6 }).forEach(() => {
      const row = document.createElement('div');
      row.className = 'detail-row';
      const label = document.createElement('span');
      label.className = 'detail-label pm-skeleton-text';
      label.textContent = i18n('common_loading', 'Laddar...');
      const value = document.createElement('span');
      value.className = 'detail-value pm-skeleton-text';
      value.textContent = '...';
      row.append(label, value);
      detailsGrid.appendChild(row);
    });
  }
  if (similar) {
    similar.textContent = '';
    Array.from({ length: 3 }).forEach(() => {
      const card = document.createElement('div');
      card.className = 'similar-card';
      const imageWrap = document.createElement('div');
      imageWrap.className = 'similar-image-wrap pm-skeleton-box pm-skeleton-similar';
      const info = document.createElement('div');
      info.className = 'similar-info';
      const title = document.createElement('h4');
      title.className = 'pm-skeleton-text';
      title.textContent = i18n('common_loading', 'Laddar...');
      const location = document.createElement('div');
      location.className = 'similar-location pm-skeleton-text';
      location.textContent = '-';
      const price = document.createElement('div');
      price.className = 'similar-price pm-skeleton-text';
      price.textContent = '-';
      info.append(title, location, price);
      card.append(imageWrap, info);
      similar.appendChild(card);
    });
  }
  if (floorplanImage) {
    floorplanImage.src = placeholderImage(i18n('common_loading', 'Laddar...'));
  }
  if (agentImage) {
    agentImage.src = placeholderAvatar(i18n('common_loading', 'Laddar...'));
  }
  if (agentName) agentName.textContent = i18n('common_loading', 'Laddar...');
  if (agentTitle) agentTitle.textContent = i18n('property_agent_title', 'Ansvarig agent');
}

function updatePropertyInfo(property) {
  const isLandType =
    property.features.propertyType === 'Byggmark' ||
    property.features.propertyType === 'Odlingsmark';

  setElementText('propertyRef', `${i18n('property_reference_label')}: ${property.ref}`);
  setElementText('propertyTitle', property.title);
  setElementText('propertyLocationText', property.location);
  setElementText('propertyAddressText', property.address || property.location || '-');
  setElementText('propertyPrice', property.price);
  setElementText('propertyOldPrice', property.oldPrice || '');
  setElementText('propertyDescription', property.description);
  setElementText('bookingPropertyTitle', property.title);
  setElementText('bookingPropertyAddress', property.address || property.location || '-');

  setElementText('featureArea', property.features.area);
  setElementText('featureAreaLabel', i18n('property_feature_area', 'kvm'));

  if (isLandType) {
    setElementText('featureRooms', property.features.length);
    setElementText('featureBathrooms', property.features.width);
    setElementText('featureFloor', '-');
    setElementText('featureRoomsLabel', i18n('property_detail_length', 'Längd'));
    setElementText('featureBathroomsLabel', i18n('property_detail_width', 'Bredd'));
    setElementText('featureFloorLabel', i18n('property_feature_not_applicable', 'Ej tillämpligt'));
    setIconClass('featureSecondaryIcon', 'fas fa-ruler-horizontal');
    setIconClass('featureTertiaryIcon', 'fas fa-ruler-vertical');
    setIconClass('featureFloorIcon', 'fas fa-minus');
  } else {
    setElementText('featureRooms', property.features.rooms);
    setElementText('featureBathrooms', property.features.bathrooms);
    setElementText('featureFloor', property.features.floor);
    setElementText('featureRoomsLabel', i18n('property_feature_rooms', 'Rum'));
    setElementText('featureBathroomsLabel', i18n('property_feature_bathrooms', 'Badrum'));
    setElementText('featureFloorLabel', i18n('property_feature_floor', 'Våning'));
    setIconClass('featureSecondaryIcon', 'fas fa-bed');
    setIconClass('featureTertiaryIcon', 'fas fa-bath');
    setIconClass('featureFloorIcon', 'fas fa-building');
  }

  setElementText('featurePropertyType', property.features.propertyType);
  setElementText('featurePropertyTypeLabel', i18n('property_feature_type', 'Annons typ'));
  renderPropertyDetails(property);
  updatePropertyMap(property);

  setElementSrc('floorplanImage', property.floorplan);
  initBookingPanelDefaults();
  updateOwnerSlotManagerVisibility();
}

function renderPropertyDetails(property) {
  const grid = document.getElementById('propertyDetailsGrid');
  if (!grid) return;

  const type = String(property.propertyType || '');
  const d = property.listingDetails || {};
  const rows = [];

  if (d.buildYear != null && d.buildYear !== '') rows.push([i18n('property_detail_build_year'), String(d.buildYear)]);
  if ((type === 'Villa/Hus' || type === 'Villa') && d.lotArea != null && d.lotArea !== '') {
    rows.push([i18n('property_detail_lot_area'), withUnit(d.lotArea, 'kvm')]);
  }
  if (d.floors != null && d.floors !== '') rows.push([i18n('property_detail_floors'), String(d.floors)]);
  if (d.floor != null && d.floor !== '') rows.push([i18n('property_detail_floor'), String(d.floor)]);
  if (d.buildArea != null && d.buildArea !== '') rows.push([i18n('property_detail_build_area'), withUnit(d.buildArea, 'kvm')]);
  if (d.length != null && d.length !== '') rows.push([i18n('property_detail_length'), withUnit(d.length, 'm')]);
  if (d.width != null && d.width !== '') rows.push([i18n('property_detail_width'), withUnit(d.width, 'm')]);
  if (d.balconies != null && d.balconies !== '') rows.push([i18n('property_detail_balcony'), String(d.balconies)]);
  if (d.bathrooms != null && d.bathrooms !== '') rows.push([i18n('property_detail_bathroom'), String(d.bathrooms)]);
  if (d.toilets != null && d.toilets !== '') rows.push([i18n('property_detail_toilet'), String(d.toilets)]);

  grid.textContent = '';

  if (!rows.length) {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const label = document.createElement('span');
    label.className = 'detail-label';
    label.textContent = i18n('property_details_label');
    const value = document.createElement('span');
    value.className = 'detail-value';
    value.textContent = '-';
    row.append(label, value);
    grid.appendChild(row);
    return;
  }

  rows.forEach(([labelText, valueText]) => {
    const row = document.createElement('div');
    row.className = 'detail-row';
    const label = document.createElement('span');
    label.className = 'detail-label';
    label.textContent = String(labelText);
    const value = document.createElement('span');
    value.className = 'detail-value';
    value.textContent = String(valueText);
    row.append(label, value);
    grid.appendChild(row);
  });
}

function updateAgent(agent) {
  setElementSrc('agentImage', agent.image);
  setElementText('agentName', agent.name);
  setElementText('agentTitle', agent.title);
  setElementText('quickAgentName', agent.name);
  setElementText('quickAgentTitle', agent.title);
  const callBtn = document.getElementById('agentCallBtn');
  const whatsappBtn = document.getElementById('agentWhatsappBtn');
  if (callBtn) callBtn.dataset.phone = agent.phone || '';
  if (whatsappBtn) whatsappBtn.dataset.phone = agent.whatsappPhone || agent.phone || '';
  const hasPhone = Boolean(String(agent.phone || '').trim());
  const hasWhatsappPhone = Boolean(String(agent.whatsappPhone || agent.phone || '').trim());
  if (callBtn) {
    callBtn.disabled = !hasPhone;
    callBtn.classList.toggle('opacity-50', !hasPhone);
    callBtn.classList.toggle('cursor-not-allowed', !hasPhone);
  }
  if (whatsappBtn) {
    whatsappBtn.disabled = !hasWhatsappPhone;
    whatsappBtn.classList.toggle('opacity-50', !hasWhatsappPhone);
    whatsappBtn.classList.toggle('cursor-not-allowed', !hasWhatsappPhone);
  }
  const bioEl = document.getElementById('agentBio');
  if (bioEl) {
    const text = String(agent.bio || '').trim();
    bioEl.textContent = text;
    bioEl.style.display = text ? '' : 'none';
  }

  const detailsWrap = document.getElementById('agentContactDetails');
  const phoneWrap = document.getElementById('agentContactPhoneWrap');
  const whatsappWrap = document.getElementById('agentContactWhatsappWrap');
  const emailWrap = document.getElementById('agentContactEmailWrap');
  const quickDetailsWrap = document.getElementById('quickContactDetails');
  const quickPhoneWrap = document.getElementById('quickPhoneWrap');
  const quickWhatsappWrap = document.getElementById('quickWhatsappWrap');
  const quickEmailWrap = document.getElementById('quickEmailWrap');
  const phoneValue = String(agent.phone || '').trim();
  const whatsappValue = String(agent.whatsappPhone || '').trim();
  const emailValue = String(agent.email || '').trim();

  if (phoneWrap) {
    phoneWrap.hidden = !phoneValue;
    setElementText('agentContactPhone', phoneValue);
  }
  if (whatsappWrap) {
    whatsappWrap.hidden = !whatsappValue;
    setElementText('agentContactWhatsapp', whatsappValue);
  }
  if (emailWrap) {
    emailWrap.hidden = !emailValue;
    setElementText('agentContactEmail', emailValue);
  }
  if (quickPhoneWrap) {
    quickPhoneWrap.hidden = !phoneValue;
    setElementText('quickAgentPhone', phoneValue);
  }
  if (quickWhatsappWrap) {
    quickWhatsappWrap.hidden = !whatsappValue;
    setElementText('quickAgentWhatsapp', whatsappValue);
  }
  if (quickEmailWrap) {
    quickEmailWrap.hidden = !emailValue;
    setElementText('quickAgentEmail', emailValue);
  }
  if (detailsWrap) {
    const hasAny = Boolean(phoneValue || whatsappValue || emailValue);
    detailsWrap.hidden = !hasAny;
  }
  if (quickDetailsWrap) {
    const hasAnyQuick = Boolean(phoneValue || whatsappValue || emailValue);
    quickDetailsWrap.hidden = !hasAnyQuick;
  }
}

function updateGallery(images) {
  const mainImage = document.getElementById('mainImage');
  const gallerySide = document.getElementById('gallerySide');
  if (!mainImage || !gallerySide || !images?.length) return;

  renderMainGalleryImage(mainImage, images[0], 0, currentProperty.title);
  currentImageIndex = 0;
  gallerySide.textContent = '';
  setElementText('galleryCounter', `1 / ${images.length}`);

  images.forEach((image, idx) => {
    renderGalleryThumb(gallerySide, image, idx, currentProperty.title, idx === 0);
  });
  enhanceGalleryFit();
}

function navigateMainImage(step, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (!currentProperty?.images?.length) return;
  const nextIndex = (currentImageIndex + Number(step) + currentProperty.images.length) % currentProperty.images.length;
  changeImage(nextIndex);
}

function updateFavoriteStatus(propertyId) {
  const favorites = JSON.parse(localStorage.getItem(PROPERTY_MODAL_FAVORITES_KEY) || '[]');
  const favBtn = document.getElementById('propertyFavoriteButton');
  if (!favBtn) return;

  const icon = favBtn.querySelector('i');
  if (favorites.includes(propertyId)) {
    icon.className = 'fas fa-heart';
    favBtn.classList.add('active');
  } else {
    icon.className = 'far fa-heart';
    favBtn.classList.remove('active');
  }
}

function togglePropertyFavorite() {
  const propertyId = getCurrentPropertyId();
  if (!propertyId) return;

  const favorites = JSON.parse(localStorage.getItem(PROPERTY_MODAL_FAVORITES_KEY) || '[]');
  const index = favorites.indexOf(propertyId);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(propertyId);
  }
  localStorage.setItem(PROPERTY_MODAL_FAVORITES_KEY, JSON.stringify(favorites));
  updateFavoriteStatus(propertyId);
  showNotification(
    index >= 0
      ? i18n('property_removed_from_favorites', 'Borttagen från favoriter')
      : i18n('property_added_to_favorites', 'Sparad i favoriter'),
    'success'
  );
}

function updateSimilarProperties() {
  const container = document.getElementById('similarProperties');
  if (!container) return;

  container.textContent = '';
  similarProperties.forEach((p) => {
    const card = document.createElement('a');
    card.className = 'similar-card';
    card.href = `${templatePath('/templates/public/property-modal.html')}?id=${encodeURIComponent(p.id)}`;

    const imageWrap = document.createElement('div');
    imageWrap.className = 'similar-image-wrap';

    const image = document.createElement('img');
    image.src = safeImageUrl(p.imageUrl, placeholderImage(p.title));
    image.alt = p.title || i18n('property_card_title_fallback');
    image.loading = 'lazy';
    imageWrap.appendChild(image);

    if (shouldShowWatermark(p)) {
      const wm = document.createElement('span');
      wm.className = 'property-watermark-badge';
      wm.textContent = 'RIMALIS';
      imageWrap.appendChild(wm);
    }

    const info = document.createElement('div');
    info.className = 'similar-info';

    const title = document.createElement('h4');
    title.textContent = p.title || i18n('property_card_title_fallback');

    const location = document.createElement('div');
    location.className = 'similar-location';
    location.textContent = p.location || i18n('property_location_missing');

    const price = document.createElement('div');
    price.className = 'similar-price';
    price.textContent = formatSek(p.price);

    info.append(title, location, price);
    card.append(imageWrap, info);
    container.appendChild(card);
  });
}

function changeImage(index) {
  if (!currentProperty) return;
  currentImageIndex = index;
  const mainImage = document.getElementById('mainImage');
  if (mainImage) {
    renderMainGalleryImage(mainImage, currentProperty.images[index], index, currentProperty.title);
    enhanceGalleryFit();
  }
  setElementText('galleryCounter', `${index + 1} / ${currentProperty.images.length}`);

  document.querySelectorAll('#gallerySide .gallery-thumb').forEach((thumb, idx) => {
    const isActive = idx === index;
    thumb.classList.toggle('active', isActive);
    if (isActive) {
      thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function initImageGallery() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
  });
}

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const close = document.getElementById('lightboxClose');
  const prev = document.getElementById('lightboxPrev');
  const next = document.getElementById('lightboxNext');

  close?.addEventListener('click', closeLightbox);
  prev?.addEventListener('click', prevImage);
  next?.addEventListener('click', nextImage);

  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
}

function openLightbox(index) {
  if (!currentProperty) return;
  const lightbox = document.getElementById('lightbox');
  const lightboxContent = lightbox?.querySelector('.lightbox-content');
  const lightboxImg = document.getElementById('lightboxImg');
  if (!lightbox || !lightboxImg) return;

  currentImageIndex = index;
  lightboxImg.src = safeImageUrl(currentProperty.images[index], placeholderImage(currentProperty.title));
  if (lightboxContent) {
    lightboxContent.classList.remove('long-image-mode');
  }
  lightboxImg.onload = () => {
    const w = Number(lightboxImg.naturalWidth || 0);
    const h = Number(lightboxImg.naturalHeight || 0);
    if (!w || !h || !lightboxContent) return;
    const ratio = w / h;
    const isLong = ratio >= 1.85 || ratio <= 0.7;
    lightboxContent.classList.toggle('long-image-mode', isLong);
  };
  lightbox.classList.add('active');
}

function openFloorplanLightbox() {
  if (!currentProperty?.images?.length) return;
  const floor = safeImageUrl(currentProperty.floorplan, '');
  const floorIndex = floor ? currentProperty.images.findIndex((img) => img === floor) : -1;
  openLightbox(floorIndex >= 0 ? floorIndex : 0);
}

function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('active');
}

function prevImage() {
  if (!currentProperty) return;
  currentImageIndex = (currentImageIndex - 1 + currentProperty.images.length) % currentProperty.images.length;
  const lightboxImg = document.getElementById('lightboxImg');
  if (lightboxImg) lightboxImg.src = safeImageUrl(currentProperty.images[currentImageIndex], placeholderImage(currentProperty.title));
}

function nextImage() {
  if (!currentProperty) return;
  currentImageIndex = (currentImageIndex + 1) % currentProperty.images.length;
  const lightboxImg = document.getElementById('lightboxImg');
  if (lightboxImg) lightboxImg.src = safeImageUrl(currentProperty.images[currentImageIndex], placeholderImage(currentProperty.title));
}

function contactAgent(type) {
  if (!currentProperty) return;
  const agent = currentProperty.agent;

  if (type === 'call') {
    const phone = String(agent.phone || '').trim();
    if (!phone) {
      showNotification(i18n('property_no_phone'), 'error');
      toggleMessagePanel(true);
      return;
    }
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
    return;
  }

  if (type === 'email') {
    window.location.href = `mailto:${agent.email}?subject=${i18n('property_email_subject')} ${currentProperty.title}`;
    return;
  }

  if (type === 'whatsapp') {
    const cleanPhone = String(agent.whatsappPhone || agent.phone || '').replace(/[^\d+]/g, '');
    if (!cleanPhone) {
      showNotification(i18n('property_no_phone_whatsapp'), 'error');
      toggleMessagePanel(true);
      return;
    }
    const msg = encodeURIComponent(`${i18n('property_whatsapp_intro')} "${currentProperty.title}" (${currentProperty.ref}).`);
    window.open(`https://wa.me/${cleanPhone.replace(/^\+/, '')}?text=${msg}`, '_blank', 'noopener');
  }
}

function bookViewing() {
  if (!currentProperty) return;
  toggleBookingPanel(true);
}

function todayDateInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateInputValueFromDateLike(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initBookingPanelDefaults() {
  const input = document.getElementById('bookingDate');
  if (!input) return;
  if (!input.value) input.value = todayDateInputValue();
}

function updateOwnerSlotManagerVisibility() {
  const panel = document.getElementById('ownerSlotPanel');
  if (!panel || !currentProperty) return;
  const user = window.RimalisAPI?.getUser?.();
  const canManage = Boolean(
    user && (
      user.role === 'admin' ||
      (currentProperty.ownerId && String(user.id || '') === String(currentProperty.ownerId))
    )
  );
  panel.hidden = !canManage;
}

function renderViewingSlots(slots) {
  const list = document.getElementById('bookingSlotList');
  const confirmBtn = document.getElementById('confirmBookingBtn');
  if (!list) return;

  if (!Array.isArray(slots) || !slots.length) {
    list.textContent = '';
    const empty = document.createElement('div');
    empty.className = 'slot-empty';
    empty.textContent = i18n('property_no_slots', 'Inga lediga tider för valt datum');
    list.appendChild(empty);
    selectedViewingSlotId = '';
    if (confirmBtn) confirmBtn.disabled = true;
    return;
  }

  list.textContent = '';
  slots.forEach((slot) => {
    const starts = new Date(slot.startsAt);
    const ends = new Date(slot.endsAt);
    const dayLabel = window.RimalisI18n?.formatDate?.(starts, { weekday: 'long' }) || starts.toLocaleDateString('sv-SE', { weekday: 'long' });
    const label = `${window.RimalisI18n?.formatTime?.(starts) || starts.toLocaleTimeString()} - ${window.RimalisI18n?.formatTime?.(ends) || ends.toLocaleTimeString()}`;
    const shortTime = window.RimalisI18n?.formatTime?.(starts) || starts.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    const available = Number(slot.availableCount || 0);
    const isSelectable = available > 0 && String(slot.status || '').toLowerCase() === 'open';
    const isActive = isSelectable && selectedViewingSlotId === slot.id;
    const statusText = isSelectable ? shortTime : i18n('property_slot_full', 'Fullbokad');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `slot-item ${isActive ? 'active' : ''} ${!isSelectable ? 'opacity-60 cursor-not-allowed' : ''}`.trim();
    btn.dataset.slotId = String(slot.id || '');
    btn.disabled = !isSelectable;

    const strong = document.createElement('strong');
    strong.textContent = capitalizeWords(dayLabel);
    const span = document.createElement('span');
    span.textContent = statusText;
    const small = document.createElement('small');
    small.textContent = isSelectable ? label : i18n('property_slot_unavailable', 'Ej bokningsbar');

    btn.append(strong, span, small);
    list.appendChild(btn);
  });

  list.querySelectorAll('[data-slot-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      selectedViewingSlotId = btn.dataset.slotId || '';
      renderViewingSlots(viewingSlots);
      if (confirmBtn) confirmBtn.disabled = !selectedViewingSlotId;
    });
  });
}

function capitalizeWords(value) {
  return String(value || '')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

async function refreshViewingSlots() {
  if (!currentProperty) return;
  const input = document.getElementById('bookingDate');
  const selectedDate = input?.value || todayDateInputValue();
  const start = new Date(`${selectedDate}T00:00:00`);
  const end = new Date(`${selectedDate}T23:59:59`);
  const qs = new URLSearchParams({
    fromAt: start.toISOString(),
    toAt: end.toISOString(),
  });

  const res = await requestJson(`/viewings/slots/public/${encodeURIComponent(currentProperty.id)}?${qs.toString()}`);
  viewingSlots = Array.isArray(res.slots) ? res.slots : [];
  selectedViewingSlotId = '';
  renderViewingSlots(viewingSlots);
}

async function jumpToNextAvailableViewingDate() {
  if (!currentProperty) return false;
  const input = document.getElementById('bookingDate');
  if (!input) return false;

  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 90);

  const qs = new URLSearchParams({
    fromAt: from.toISOString(),
    toAt: to.toISOString(),
  });

  const res = await requestJson(`/viewings/slots/public/${encodeURIComponent(currentProperty.id)}?${qs.toString()}`);
  const upcoming = Array.isArray(res.slots) ? res.slots : [];
  if (!upcoming.length) return false;

  const nextDate = dateInputValueFromDateLike(upcoming[0]?.startsAt);
  if (!nextDate) return false;
  input.value = nextDate;
  await refreshViewingSlots();
  return true;
}

function toggleBookingPanel(forceState) {
  const panel = document.getElementById('propertyBookingPanel');
  if (!panel) return;
  const shouldOpen = typeof forceState === 'boolean'
    ? forceState
    : panel.hidden;
  panel.hidden = !shouldOpen;
  if (!shouldOpen) return;

  initBookingPanelDefaults();
  refreshViewingSlots()
    .then(async () => {
      if (!viewingSlots.length) {
        try {
          await jumpToNextAvailableViewingDate();
        } catch (_) {
          // noop
        }
      }
    })
    .catch((err) => {
      const list = document.getElementById('bookingSlotList');
      if (list) {
        list.textContent = '';
        const empty = document.createElement('div');
        empty.className = 'slot-empty';
        empty.textContent = err?.message || i18n('property_load_slots_failed', 'Kunde inte hämta tider');
        list.appendChild(empty);
      }
    });
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

async function confirmViewingBooking() {
  if (!selectedViewingSlotId || !currentProperty) {
    showNotification(i18n('property_select_slot', 'Välj en tid först'), 'error');
    return;
  }
  const user = window.RimalisAPI?.getUser?.();
  if (!user) {
    showNotification(i18n('property_login_to_book', 'Logga in för att boka visning'), 'info');
    window.location.href = `${templatePath('/templates/auth/login.html')}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return;
  }

  const btn = document.getElementById('confirmBookingBtn');
  const restoreButton = setButtonLoading(btn, i18n('sending', 'Skickar...'));

  try {
    await requestJson('/viewings/book', {
      method: 'POST',
      auth: true,
      body: {
        slotId: selectedViewingSlotId,
        propertyId: currentProperty.id,
      },
    });
    showNotification(i18n('property_booking_success', 'Visning bokad'), 'success');
    await refreshViewingSlots();
  } catch (err) {
    showNotification(err?.message || i18n('property_booking_failed', 'Kunde inte boka visning'), 'error');
  } finally {
    if (btn) {
      restoreButton();
      btn.disabled = !selectedViewingSlotId;
    }
  }
}

async function createViewingSlot() {
  if (!currentProperty) return;
  const start = document.getElementById('ownerSlotStart')?.value;
  const end = document.getElementById('ownerSlotEnd')?.value;
  const capacity = Number(document.getElementById('ownerSlotCapacity')?.value || 1);
  if (!start || !end) {
    showNotification(i18n('property_fill_slot_times', 'Ange start och slut tid'), 'error');
    return;
  }

  try {
    const created = await requestJson('/viewings/slots/me', {
      method: 'POST',
      auth: true,
      body: {
        propertyId: currentProperty.id,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        capacity,
      },
    });
    const createdStart = created?.slot?.startsAt || new Date(start).toISOString();
    const createdDate = dateInputValueFromDateLike(createdStart);
    const bookingDateInput = document.getElementById('bookingDate');
    if (bookingDateInput && createdDate) {
      bookingDateInput.value = createdDate;
    }
    showNotification(i18n('property_slot_created', 'Tid skapad'), 'success');
    await refreshViewingSlots();
    if (Array.isArray(viewingSlots) && viewingSlots.length === 1) {
      selectedViewingSlotId = viewingSlots[0].id;
      renderViewingSlots(viewingSlots);
    }
  } catch (err) {
    showNotification(err?.message || i18n('property_slot_create_failed', 'Kunde inte skapa tid'), 'error');
  }
}

function shareUrl() {
  return window.location.href;
}

function openShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.hidden = false;
}

function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) modal.hidden = true;
}

async function shareVia(channel) {
  const title = currentProperty?.title || 'Rimalis Group';
  const url = shareUrl();
  const text = `${title} - ${url}`;

  if (channel === 'copy') {
    try {
      await navigator.clipboard.writeText(url);
      showNotification(i18n('property_link_copied', 'Länk kopierad'), 'success');
      closeShareModal();
    } catch (_err) {
      showNotification(i18n('property_link_copy_failed', 'Kunde inte kopiera länk'), 'error');
    }
    return;
  }

  if (channel === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    closeShareModal();
    return;
  }

  if (channel === 'messenger') {
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=291494419107518&redirect_uri=${encodeURIComponent(url)}`, '_blank', 'noopener');
    closeShareModal();
    return;
  }
}

function getLoggedInUserContact() {
  const user = window.RimalisAPI?.getUser?.() || null;
  if (!user) return null;
  const combinedName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

  const nestedPhone =
    user.contact?.phone ||
    user.contactInfo?.phone ||
    user.profile?.phone ||
    user.profile?.phoneNumber ||
    user.details?.phone ||
    user.details?.phoneNumber ||
    user.attributes?.phone ||
    user.attributes?.phoneNumber ||
    '';

  const nestedName =
    user.profile?.name ||
    user.profile?.fullName ||
    user.contact?.name ||
    user.details?.name ||
    '';

  const nestedEmail =
    user.contact?.email ||
    user.contactInfo?.email ||
    user.profile?.email ||
    user.details?.email ||
    '';

  return {
    name: String(user.name || user.fullName || combinedName || nestedName).trim(),
    email: String(user.email || nestedEmail).trim(),
    phone: String(
      user.phone ||
      user.phoneNumber ||
      user.mobile ||
      user.mobilePhone ||
      user.tel ||
      user.telephone ||
      nestedPhone
    ).trim(),
  };
}

function prefillLoggedInMessageFields() {
  const contact = getLoggedInUserContact();
  if (!contact) return false;

  const nameInput = document.getElementById('propertyMsgName');
  const emailInput = document.getElementById('propertyMsgEmail');
  const phoneInput = document.getElementById('propertyMsgPhone');

  if (nameInput && !nameInput.value) nameInput.value = contact.name;
  if (emailInput && !emailInput.value) emailInput.value = contact.email;
  if (phoneInput && !phoneInput.value) phoneInput.value = contact.phone;
  return true;
}

async function hydrateLoggedInUserProfileForMessaging() {
  const accessToken = window.RimalisAPI?.getAccessToken?.() || '';
  if (!accessToken) return null;

  const current = window.RimalisAPI?.getUser?.() || null;
  if (current?.phone) return current;

  try {
    const body = await requestJson('/users/me', { auth: true });
    const freshUser = body?.user || null;
    if (!freshUser) return current;

    window.RimalisAPI?.setSession?.({
      accessToken,
      refreshToken: window.RimalisAPI?.getRefreshToken?.() || '',
      user: { ...(current || {}), ...freshUser },
    });
    return { ...(current || {}), ...freshUser };
  } catch (_err) {
    return current;
  }
}

function toggleMessagePanel(forceState) {
  const panel = document.getElementById('propertyMessagePanel');
  if (!panel) return;
  const shouldOpen = typeof forceState === 'boolean'
    ? forceState
    : panel.hidden;
  panel.hidden = !shouldOpen;

  if (shouldOpen) {
    prefillLoggedInMessageFields();
    const textInput = document.getElementById('propertyMsgText');
    hydrateLoggedInUserProfileForMessaging().then(() => {
      prefillLoggedInMessageFields();
    });
    window.setTimeout(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      textInput?.focus();
    }, 60);
  }
}

function initPropertyMessageForm() {
  const form = document.getElementById('propertyMessageForm');
  if (!form) return;
  prefillLoggedInMessageFields();
  hydrateLoggedInUserProfileForMessaging().then(() => {
    prefillLoggedInMessageFields();
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!currentProperty) return;

    const name = document.getElementById('propertyMsgName')?.value?.trim() || '';
    const email = document.getElementById('propertyMsgEmail')?.value?.trim() || '';
    const phone = document.getElementById('propertyMsgPhone')?.value?.trim() || '';
    const text = document.getElementById('propertyMsgText')?.value?.trim() || '';

    if (!name || !email || !phone || !text) {
      showNotification(i18n('property_fill_required'), 'error');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const restoreButton = setButtonLoading(submitButton, i18n('sending'));

    try {
      const response = await requestJson('/messages/public', {
        method: 'POST',
        body: {
          propertyId: currentProperty.id,
          name,
          email,
          phone,
          message: text,
        },
      });
      const createdMessageId = response?.message?.id ? String(response.message.id) : '';
      const isLoggedIn = Boolean(window.RimalisAPI?.getAccessToken?.());
      if (createdMessageId && isLoggedIn) {
        try {
          localStorage.setItem(PROPERTY_MODAL_PENDING_CHAT_KEY, createdMessageId);
        } catch (_err) {
          // ignore storage failure
        }
      }
      showNotification(i18n('property_message_sent'), 'success');
      form.reset();
      toggleMessagePanel(false);
      if (createdMessageId && isLoggedIn) {
        const messagesPath = templatePath('/templates/user/messages.html');
        window.setTimeout(() => {
          window.location.href = `${messagesPath}?thread=${encodeURIComponent(createdMessageId)}`;
        }, 250);
      }
    } catch (error) {
      showNotification(error?.message || i18n('property_message_failed'), 'error');
    } finally {
      if (submitButton) {
        restoreButton();
        submitButton.disabled = false;
      }
    }
  });
}

function setElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setElementSrc(id, src) {
  const el = document.getElementById(id);
  if (el) el.src = safeImageUrl(src, placeholderImage(i18n('no_image')));
}

function setIconClass(id, className) {
  const el = document.getElementById(id);
  if (el) el.className = className;
}

function bootstrapPropertyModal() {
  if (hasBootstrapped) return;
  hasBootstrapped = true;
  try {
    migrateLegacyFavoritesKey();
  } catch (_err) {}
  try {
    initPropertyMessageForm();
  } catch (_err) {}
  try {
    initPropertyModal();
  } catch (_err) {}
}

function bindAgentActionButtonsFallback() {
  if (hasBoundPropertyModalActions) return;
  hasBoundPropertyModalActions = true;
  const propertyBackBtn = document.getElementById('propertyBackBtn');
  const callBtn = document.getElementById('agentCallBtn');
  const whatsappBtn = document.getElementById('agentWhatsappBtn');
  const messageBtn = document.getElementById('agentMessageBtn');
  const bookingBtn = document.getElementById('agentBookingBtn');
  const bottomBookingBtn = document.getElementById('bottomBookingBtn');
  const bottomMessageBtn = document.getElementById('bottomMessageBtn');
  const galleryOpenLightboxBtn = document.getElementById('galleryOpenLightboxBtn');
  const floorplanOpenTrigger = document.getElementById('floorplanOpenTrigger');
  const propertyMessageCloseBtn = document.getElementById('propertyMessageCloseBtn');
  const bookingPanelCloseBtn = document.getElementById('bookingPanelCloseBtn');
  const shareModalCloseBtn = document.getElementById('shareModalCloseBtn');
  const refreshViewingSlotsBtn = document.getElementById('refreshViewingSlotsBtn');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');
  const createViewingSlotBtn = document.getElementById('createViewingSlotBtn');
  const bookingPanel = document.getElementById('propertyBookingPanel');
  const shareModal = document.getElementById('shareModal');
  const favoriteBtn = document.getElementById('propertyFavoriteButton');
  const inlineBookingLink = document.getElementById('inlineBookingLink');
  const bookPrivateViewingLink = document.getElementById('bookPrivateViewingLink');

  propertyBackBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    goBackToListings();
  });
  favoriteBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    togglePropertyFavorite();
  });
  callBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    contactAgent('call');
  });
  whatsappBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    contactAgent('whatsapp');
  });
  messageBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    toggleMessagePanel();
  });
  bookingBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    bookViewing();
  });
  bottomBookingBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    toggleBookingPanel(true);
  });
  bottomMessageBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    toggleMessagePanel(true);
  });
  inlineBookingLink?.addEventListener('click', function (event) {
    event.preventDefault();
    toggleBookingPanel(true);
  });
  bookPrivateViewingLink?.addEventListener('click', function (event) {
    event.preventDefault();
    toggleBookingPanel(true);
  });
  galleryOpenLightboxBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    openLightbox(0);
  });
  floorplanOpenTrigger?.addEventListener('click', function () {
    openFloorplanLightbox();
  });
  propertyMessageCloseBtn?.addEventListener('click', function () {
    toggleMessagePanel(false);
  });
  bookingPanelCloseBtn?.addEventListener('click', function () {
    toggleBookingPanel(false);
  });
  shareModalCloseBtn?.addEventListener('click', function () {
    closeShareModal();
  });
  refreshViewingSlotsBtn?.addEventListener('click', function () {
    refreshViewingSlots();
  });
  confirmBookingBtn?.addEventListener('click', function () {
    confirmViewingBooking();
  });
  createViewingSlotBtn?.addEventListener('click', function () {
    createViewingSlot();
  });
  const bookingDate = document.getElementById('bookingDate');
  bookingDate?.addEventListener('change', function () {
    refreshViewingSlots().catch(() => {});
  });
  const shareBtn = document.getElementById('sharePropertyBtn');
  shareBtn?.addEventListener('click', function (event) {
    event.preventDefault();
    openShareModal();
  });
  bookingPanel?.addEventListener('click', function (event) {
    if (event.target === bookingPanel) toggleBookingPanel(false);
  });
  shareModal?.addEventListener('click', function (event) {
    if (event.target === shareModal) closeShareModal();
  });
  document.querySelectorAll('[data-share-channel]').forEach((button) => {
    button.addEventListener('click', function () {
      shareVia(button.dataset.shareChannel || 'copy');
    });
  });
  document.addEventListener('click', function (event) {
    const lightboxTrigger = event.target.closest('[data-open-lightbox]');
    if (lightboxTrigger) {
      event.preventDefault();
      openLightbox(Number(lightboxTrigger.dataset.openLightbox || 0));
      return;
    }

    const galleryNav = event.target.closest('[data-gallery-nav]');
    if (galleryNav) {
      event.preventDefault();
      navigateMainImage(Number(galleryNav.dataset.galleryNav || 0), event);
      return;
    }

    const galleryThumb = event.target.closest('[data-gallery-index]');
    if (galleryThumb) {
      event.preventDefault();
      changeImage(Number(galleryThumb.dataset.galleryIndex || 0));
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    bindAgentActionButtonsFallback();
    bootstrapPropertyModal();
  });
} else {
  bindAgentActionButtonsFallback();
  bootstrapPropertyModal();
}

window.addEventListener('load', function () {
  bindAgentActionButtonsFallback();
  bootstrapPropertyModal();
});

window.addEventListener('rimalis:language-changed', function () {
  if (!currentProperty) return;
  updatePropertyInfo(currentProperty);
  updateSimilarProperties();
});

window.goBackToListings = goBackToListings;
window.getPropertyIdFromUrl = getPropertyIdFromUrl;
window.getCurrentPropertyId = getCurrentPropertyId;
window.changeImage = changeImage;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.prevImage = prevImage;
window.nextImage = nextImage;
window.navigateMainImage = navigateMainImage;
window.contactAgent = contactAgent;
window.bookViewing = bookViewing;
window.toggleMessagePanel = toggleMessagePanel;
window.toggleBookingPanel = toggleBookingPanel;
window.refreshViewingSlots = refreshViewingSlots;
window.confirmViewingBooking = confirmViewingBooking;
window.createViewingSlot = createViewingSlot;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.shareVia = shareVia;
