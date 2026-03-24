(function () {
  const DEFAULT_I18N = {
    sv: {
      no_image: 'Ingen bild',
      property_card_title_fallback: 'Objekt',
      property_location_missing: 'Plats saknas',
      properties_showing: 'Visar',
      properties_of: 'av',
      properties_items: 'objekt',
      properties_none_published: 'Inga publicerade objekt just nu.',
      search_all_properties: 'alla objekt',
      search_no_results: 'Inga resultat hittades.',
    },
    en: {
      no_image: 'No image',
      property_card_title_fallback: 'Property',
      property_location_missing: 'Location unavailable',
      properties_showing: 'Showing',
      properties_of: 'of',
      properties_items: 'properties',
      properties_none_published: 'No published properties right now.',
      search_all_properties: 'all properties',
      search_no_results: 'No results found.',
    },
    ar: {
      no_image: 'لا توجد صورة',
      property_card_title_fallback: 'عقار',
      property_location_missing: 'الموقع غير متاح',
      properties_showing: 'عرض',
      properties_of: 'من',
      properties_items: 'عقار',
      properties_none_published: 'لا توجد إعلانات منشورة حاليًا.',
      search_all_properties: 'كل العقارات',
      search_no_results: 'لم يتم العثور على نتائج.',
    },
  };

  function getLang() {
    const lang = String(localStorage.getItem('rimalis_language') || 'sv').toLowerCase();
    if (lang === 'en') return 'en';
    if (lang === 'ar') return 'ar';
    return 'sv';
  }

  function fallbackFor(key) {
    const lang = getLang();
    return DEFAULT_I18N[lang]?.[key] || DEFAULT_I18N.sv[key] || key;
  }

  function i18n(key, fallback) {
    const translated = window.RimalisI18n?.t?.(key, fallback);
    if (!translated || translated === key) {
      return fallback || fallbackFor(key);
    }
    return translated;
  }

  function featureText(value, key, fallbackLabel) {
    if (value == null || value === '') return '—';
    return `${value} ${i18n(key, fallbackLabel)}`.trim();
  }

  function localizePropertyType(value) {
    const raw = String(value || '').trim();
    if (!raw) return i18n('property_type_default', 'Bostad');

    const normalized = raw.toLowerCase();
    if (['villa', 'villa/hus', 'house'].includes(normalized)) return i18n('property_type_house', 'Villa');
    if (['lägenhet', 'lagenhet', 'apartment'].includes(normalized)) return i18n('property_type_apartment', 'Lägenhet');
    if (['radhus', 'townhouse'].includes(normalized)) return i18n('property_type_townhouse', 'Radhus');
    if (['fritidshus', 'holiday home', 'holiday_home'].includes(normalized)) return i18n('property_type_holiday_home', 'Fritidshus');
    if (['byggmark', 'land', 'plot', 'tomt'].includes(normalized)) return i18n('property_type_land', 'Byggmark');
    return raw;
  }

  function formatMkr(price) {
    return window.RimalisI18n?.formatCurrencySEK?.(price) || '-';
  }

  function formatCount(count) {
    return window.RimalisI18n?.formatNumber?.(count) || String(count || 0);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function safeImageUrl(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/static/uploads/')) return trimmed;
    if (trimmed.startsWith('/api/media/private/')) return trimmed;
    if (trimmed.startsWith('/uploads/')) return trimmed;
    if (trimmed.startsWith('data:image/')) return trimmed;
    return '';
  }

  function placeholderImage(title) {
    const label = encodeURIComponent(title || i18n('no_image'));
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#121212"/><text x="50%" y="50%" fill="#888" font-size="42" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`
    )}`;
  }

  function applyImgFallback(img, fallbackSrc) {
    if (!img) return;
    if (img.dataset.fallbackBound === '1') return;
    img.dataset.fallbackBound = '1';
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied === '1') return;
      img.dataset.fallbackApplied = '1';
      img.removeAttribute('srcset');
      img.src = fallbackSrc;
    });
  }

  function getAreaName(property) {
    const raw = String(
      property?.city ||
      property?.location ||
      property?.address ||
      property?.listingDetails?.city ||
      ''
    ).trim();
    if (!raw) return '';
    return raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)[0] || raw;
  }

  function createAreaImageUrl(group = []) {
    const withImage = group.find((item) => safeImageUrl(item?.imageUrl));
    return safeImageUrl(withImage?.imageUrl);
  }

  function areaImageFallback(name) {
    const key = String(name || '').trim().toLowerCase();
    const map = {
      stockholm: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=900',
      goteborg: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=900',
      göteborg: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&q=80&w=900',
      malmo: 'https://images.unsplash.com/photo-1592595896616-c37162298647?auto=format&fit=crop&q=80&w=900',
      malmö: 'https://images.unsplash.com/photo-1592595896616-c37162298647?auto=format&fit=crop&q=80&w=900',
      uppsala: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=900',
    };
    return map[key] || 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&q=80&w=900';
  }

  function createAreaCard(name, count, imageUrl) {
    const card = document.createElement('a');
    card.className = 'area-card';
    card.href = `properties.html?q=${encodeURIComponent(name)}`;
    card.setAttribute('aria-label', `${name} (${count})`);

    const image = document.createElement('img');
    image.src = imageUrl || areaImageFallback(name);
    image.alt = name;
    image.loading = 'lazy';
    applyImgFallback(image, areaImageFallback(name));

    const overlay = document.createElement('div');
    overlay.className = 'area-overlay';

    const content = document.createElement('div');
    content.className = 'area-content';

    const title = document.createElement('div');
    title.className = 'area-name';
    title.textContent = name;

    const subtitle = document.createElement('div');
    subtitle.className = 'area-count';
    subtitle.textContent = `${formatCount(count)} ${i18n('properties_items', 'objekt')}`;

    content.appendChild(title);
    content.appendChild(subtitle);
    card.appendChild(image);
    card.appendChild(overlay);
    card.appendChild(content);
    return card;
  }

  function createImageElement(property) {
    const safeUrl = safeImageUrl(property.imageUrl);
    const showWatermark = Boolean(property?.listingDetails?.watermarkEnabled) && String(property?.status || '').toLowerCase() === 'published';
    const wrapper = document.createElement('div');
    wrapper.className = 'relative w-full h-full';
    if (safeUrl) {
      const img = document.createElement('img');
      img.src = safeUrl;
      img.className = 'w-full h-full object-cover';
      img.alt = property.title || 'Objekt';
      img.loading = 'lazy';
      applyImgFallback(img, placeholderImage(property.title || i18n('no_image')));
      wrapper.appendChild(img);
      if (showWatermark) {
        const wm = document.createElement('span');
        wm.className = 'absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[0.14em] text-black bg-[#e2ff31]/95';
        wm.textContent = 'RIMALIS';
        wrapper.appendChild(wm);
      }
      return wrapper;
    }
    const noImage = document.createElement('div');
    noImage.className = 'w-full h-full bg-white/5 flex items-center justify-center text-white/40 text-sm';
    noImage.textContent = i18n('no_image');
    return noImage;
  }

  function resolveAgentName(property) {
    const candidates = [
      property?.owner?.name,
      property?.ownerName,
      property?.listingDetails?.publisherName,
      property?.listingDetails?.agentName,
      property?.agentName,
      property?.contactName,
    ];

    const match = candidates.find((value) => String(value || '').trim());
    return match ? String(match).trim() : i18n('property_agent_default_name');
  }

  function createCardElement(property, compact = false) {
    const detailsData = property.listingDetails || {};
    const area = detailsData.area ?? property.livingArea;
    const rooms = detailsData.rooms ?? property.rooms;
    const parking = detailsData.parkingSpaces ?? property.parkingSpaces;
    const propertyType = localizePropertyType(property.propertyType || detailsData.propertyType || property.category || '');
    const agentName = resolveAgentName(property);
    const agentRole = i18n('property_agent_title', 'Fastighetsmäklare');
    const card = document.createElement('div');
    card.className = 'prop-card group';
    card.dataset.property = String(property.id || '');
    card.dataset.openId = String(property.id || '');

    const favBtn = document.createElement('button');
    favBtn.className = 'favorite-btn';
    favBtn.type = 'button';
    favBtn.dataset.favoriteId = String(property.id || '');
    const favIcon = document.createElement('i');
    favIcon.className = 'far fa-heart';
    favBtn.appendChild(favIcon);

    const media = document.createElement('div');
    media.className = 'mobile-home-property-media';
    media.appendChild(createImageElement(property));

    const body = document.createElement('div');
    body.className = 'mobile-home-property-body';
    const priceRow = document.createElement('div');
    priceRow.className = 'mobile-home-property-price-row';
    const pPrice = document.createElement('p');
    pPrice.className = 'mobile-home-property-price';
    pPrice.textContent = formatMkr(property.price);
    const typePill = document.createElement('span');
    typePill.className = 'mobile-home-property-type';
    typePill.textContent = propertyType;
    priceRow.appendChild(pPrice);
    priceRow.appendChild(typePill);
    body.appendChild(priceRow);

    const h3 = document.createElement('h3');
    h3.className = 'mobile-home-property-title';
    h3.textContent = property.title || i18n('property_card_title_fallback');
    body.appendChild(h3);

    const pLoc = document.createElement('p');
    pLoc.className = 'mobile-home-property-location';
    const pin = document.createElement('i');
    pin.className = 'fas fa-map-pin';
    pLoc.appendChild(pin);
    pLoc.appendChild(document.createTextNode(property.location || i18n('property_location_missing')));
    body.appendChild(pLoc);

    if (!compact) {
      const details = document.createElement('div');
      details.className = 'mobile-home-property-features';
      const d1 = document.createElement('span');
      d1.className = 'mobile-home-property-feature';
      const d1i = document.createElement('i');
      d1i.className = 'fas fa-ruler-combined mr-2';
      d1.appendChild(d1i);
      d1.appendChild(document.createTextNode(featureText(area, 'unit_sqm', 'kvm')));
      const d2 = document.createElement('span');
      d2.className = 'mobile-home-property-feature';
      const d2i = document.createElement('i');
      d2i.className = 'fas fa-bed mr-2';
      d2.appendChild(d2i);
      d2.appendChild(document.createTextNode(featureText(rooms, 'property_feature_rooms', 'rum')));
      const d3 = document.createElement('span');
      d3.className = 'mobile-home-property-feature';
      const d3i = document.createElement('i');
      d3i.className = parking != null && parking !== '' ? 'fas fa-car mr-2' : 'fas fa-building mr-2';
      d3.appendChild(d3i);
      d3.appendChild(document.createTextNode(parking != null && parking !== '' ? featureText(parking, 'unit_parking_short', 'pl') : propertyType));
      details.appendChild(d1);
      details.appendChild(d2);
      details.appendChild(d3);
      body.appendChild(details);

      const agent = document.createElement('div');
      agent.className = 'mobile-home-property-agent';
      const agentAvatar = document.createElement('div');
      agentAvatar.className = 'mobile-home-property-agent-avatar';
      const initials = (agentName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2) || 'RG').toUpperCase();
      agentAvatar.textContent = initials;
      const agentMeta = document.createElement('div');
      agentMeta.className = 'mobile-home-property-agent-meta';
      const agentTitle = document.createElement('div');
      agentTitle.className = 'mobile-home-property-agent-name';
      agentTitle.textContent = agentName;
      const agentRoleEl = document.createElement('div');
      agentRoleEl.className = 'mobile-home-property-agent-role';
      agentRoleEl.textContent = agentRole;
      agentMeta.appendChild(agentTitle);
      agentMeta.appendChild(agentRoleEl);
      agent.appendChild(agentAvatar);
      agent.appendChild(agentMeta);
      body.appendChild(agent);
    }
    card.appendChild(favBtn);
    card.appendChild(media);
    card.appendChild(body);
    return card;
  }

  function bindGridActions(grid) {
    if (!grid || grid.dataset.boundActions) return;
    grid.addEventListener('click', (event) => {
      const favBtn = event.target.closest('[data-favorite-id]');
      if (favBtn) {
        event.stopPropagation();
        if (typeof window.toggleFavorite === 'function') {
          window.toggleFavorite(event, favBtn.dataset.favoriteId);
        }
        return;
      }
      const card = event.target.closest('[data-open-id]');
      if (card?.dataset.openId) {
        const base = (window.location.pathname || '').includes('/templates/mobile/')
          ? '/templates/mobile/public/property-modal.html'
          : '/templates/public/property-modal.html';
        window.location.href = `${base}?id=${encodeURIComponent(card.dataset.openId)}`;
      }
    });
    grid.dataset.boundActions = '1';
  }

  function renderCards(grid, properties, compact = false) {
    grid.textContent = '';
    properties.forEach((p) => grid.appendChild(createCardElement(p, compact)));
    bindGridActions(grid);
  }

  async function fetchPublished() {
    if (!window.RimalisAPI) return [];
    const body = await window.RimalisAPI.request(`/properties/public?_ts=${Date.now()}`);
    return body.properties || [];
  }

  async function renderHomeFeatured() {
    const grid = document.getElementById('featuredPropertiesGrid');
    if (!grid) return;

    const properties = await fetchPublished();
    renderCards(grid, properties.slice(0, 3));
    if (window.initFavorites) await window.initFavorites();
  }

  async function renderHomeAreas() {
    const grid = document.getElementById('homeAreasGrid');
    if (!grid) return;

    const properties = await fetchPublished();
    const groups = new Map();

    properties.forEach((property) => {
      const areaName = getAreaName(property);
      if (!areaName) return;
      const key = areaName.toLocaleLowerCase(window.RimalisI18n?.localeFor?.() || 'sv-SE');
      if (!groups.has(key)) {
        groups.set(key, {
          name: areaName,
          count: 0,
          items: [],
        });
      }
      const current = groups.get(key);
      current.count += 1;
      current.items.push(property);
    });

    const topAreas = [...groups.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, window.RimalisI18n?.localeFor?.() || 'sv-SE'))
      .slice(0, 4);

    grid.textContent = '';

    if (!topAreas.length) {
      const empty = document.createElement('div');
      empty.className = 'mobile-card mobile-home-empty-state';
      empty.textContent = i18n('properties_none_published', 'Inga publicerade objekt just nu.');
      grid.appendChild(empty);
      return;
    }

    topAreas.forEach((area) => {
      grid.appendChild(createAreaCard(area.name, area.count, createAreaImageUrl(area.items)));
    });
  }

  async function renderPropertiesPage() {
    const grid = document.getElementById('propertiesGrid');
    const countText = document.getElementById('propertiesCountText');
    const paginationInfo = document.getElementById('propertiesPaginationInfo');
    if (!grid) return;

    const properties = await fetchPublished();
    if (countText) {
      countText.textContent = `${i18n('properties_showing')} ${properties.length} ${i18n('properties_of')} ${properties.length} ${i18n('properties_items')}`;
    }
    if (paginationInfo) {
      paginationInfo.textContent = properties.length > 0 ? '' : i18n('properties_none_published');
    }

    if (properties.length === 0) {
      grid.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'glass-dark rounded-3xl p-8 text-white/60 col-span-full';
      empty.textContent = i18n('properties_none_published');
      grid.appendChild(empty);
      return;
    }

    renderCards(grid, properties);
    if (window.initFavorites) await window.initFavorites();
  }

  async function renderSearchPage() {
    const grid = document.getElementById('resultsGrid');
    if (!grid) return;

    const q = (new URLSearchParams(window.location.search).get('q') || '').toLowerCase().trim();
    const termEl = document.getElementById('searchTerm');
    if (termEl) termEl.textContent = q || i18n('search_all_properties');

    let properties = await fetchPublished();
    if (q) {
      properties = properties.filter((p) =>
        `${p.title} ${p.location}`.toLowerCase().includes(q)
      );
    }

    if (properties.length === 0) {
      grid.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'glass-dark rounded-3xl p-8 text-white/60 col-span-full';
      empty.textContent = i18n('search_no_results');
      grid.appendChild(empty);
      return;
    }

    renderCards(grid, properties, true);
    if (window.initFavorites) await window.initFavorites();
  }

  document.addEventListener('DOMContentLoaded', async function () {
    await Promise.allSettled([
      renderHomeFeatured(),
      renderHomeAreas(),
      renderPropertiesPage(),
      renderSearchPage(),
    ]);
  });

  window.addEventListener('rimalis:language-changed', async function () {
    await Promise.allSettled([
      renderHomeFeatured(),
      renderHomeAreas(),
      renderPropertiesPage(),
      renderSearchPage(),
    ]);
  });

  window.addEventListener('rimalis:i18n-applied', async function () {
    await Promise.allSettled([
      renderHomeFeatured(),
      renderHomeAreas(),
      renderPropertiesPage(),
      renderSearchPage(),
    ]);
  });
})();
