(function () {
  const state = {
    properties: [],
    rendered: [],
    search: '',
    selectedFilters: new Set(),
    view: 'grid',
  };

  const FALLBACKS = {
    no_image: 'Ingen bild',
    empty: 'Inga resultat hittades.',
  };

  function $(id) {
    return document.getElementById(id);
  }

  function t(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback) || fallback;
  }

  function formatNumber(value) {
    return window.RimalisI18n?.formatNumber?.(value) || String(value);
  }

  function localizedType(value) {
    const raw = String(value || '').trim();
    if (!raw) return t('property_type_default', 'Bostad');
    const normalized = raw.toLowerCase();
    if (['villa', 'villa/hus', 'hus', 'house'].includes(normalized)) return t('property_type_house', 'Villa/Hus');
    if (['lägenhet', 'lagenhet', 'apartment'].includes(normalized)) return t('property_type_apartment', 'Lägenhet');
    if (['radhus', 'townhouse'].includes(normalized)) return t('property_type_townhouse', 'Radhus');
    if (['fritidshus', 'fritid', 'holiday home', 'holiday_home'].includes(normalized)) return t('property_type_holiday_home', 'Fritidshus');
    if (['byggmark', 'land', 'plot', 'tomt'].includes(normalized)) return t('property_type_land', 'Byggmark');
    return raw;
  }

  function formatSek(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '-';
    if (window.RimalisI18n?.formatCurrencySEK) {
      return window.RimalisI18n.formatCurrencySEK(amount, { compact: false });
    }
    return `${amount.toLocaleString('sv-SE')} kr`;
  }

  function safeImage(url) {
    if (typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('/static/uploads/')) return trimmed;
    return '';
  }

  function initials(name) {
    return String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '--';
  }

  async function fetchPublished() {
    if (!window.RimalisAPI?.request) return [];
    const body = await window.RimalisAPI.request(`/properties/public?_ts=${Date.now()}`);
    return Array.isArray(body.properties) ? body.properties : [];
  }

  function propertyBadge(property) {
    const status = String(property?.status || '').toLowerCase();
    const description = String(property?.description || '').toLowerCase();
    const price = Number(property?.price || 0);
    if (status === 'sold') return t('status_sold', 'SÅLD');
    if (description.includes('nyproduktion')) return t('new_production', 'NY PRODUKTION');
    if (description.includes('prissänkt') || description.includes('prissankt')) return t('price_reduced', 'PRISSÄNKT');
    if (price >= 10000000) return t('exclusive', 'EXKLUSIV');
    if (status === 'published') return t('new_short', 'NY');
    return t('property_status_active', 'AKTIV');
  }

  function propertyBadgeClass(property) {
    const badge = propertyBadge(property);
    if (badge === 'SÅLD') return 'is-sold';
    if (badge === 'NY' || badge === 'NY PRODUKTION') return 'is-new';
    if (badge === 'PRISSÄNKT') return 'is-reduced';
    return '';
  }

  function agentName(property) {
    return property?.owner?.name || property?.ownerName || property?.listingDetails?.publisherName || t('seller', 'Säljare');
  }

  function agentAvatar(property) {
    return property?.owner?.avatarUrl || '';
  }

  function propertyTitle(property) {
    return String(property?.title || property?.listingDetails?.title || property?.name || '')
      .trim() || t('property_type_default', 'Bostad');
  }

  function normalizeFilters(properties) {
    const term = state.search.trim().toLowerCase();
    return properties.filter((property) => {
      const details = property.listingDetails || {};
      const area = Number(details.area ?? property.livingArea ?? 0);
      const rooms = Number(details.rooms ?? property.rooms ?? 0);
      const price = Number(property.price ?? 0);
      const type = String(property.propertyType || '').toLowerCase();
      const text = `${property.title || ''} ${property.location || ''} ${property.address || ''}`.toLowerCase();

      if (term && !text.includes(term)) return false;
      if (state.selectedFilters.has('Pool') && !String(property.description || '').toLowerCase().includes('pool')) return false;
      if (state.selectedFilters.has('2+ rum') && rooms < 2) return false;
      if (state.selectedFilters.has('3+ rum') && rooms < 3) return false;
      if (state.selectedFilters.has('4+ rum') && rooms < 4) return false;
      if (state.selectedFilters.has('5+ rum') && rooms < 5) return false;
      if (state.selectedFilters.has('80+ kvm') && area < 80) return false;
      if (state.selectedFilters.has('120+ kvm') && area < 120) return false;
      if (state.selectedFilters.has('160+ kvm') && area < 160) return false;
      if (state.selectedFilters.has('200+ kvm') && area < 200) return false;
      if (state.selectedFilters.has('Villa') && !type.includes('villa')) return false;
      if (state.selectedFilters.has('Lägenhet') && !type.includes('lägenhet')) return false;
      if (state.selectedFilters.has('Radhus') && !type.includes('radhus')) return false;

      const min = Number(($('minPrice')?.value || '0').replace(/\s/g, '')) || 0;
      const max = Number(($('maxPrice')?.value || '').replace(/\s/g, '')) || 0;
      if (min > 0 && price < min) return false;
      if (max > 0 && price > max) return false;
      return true;
    });
  }

  function sortProperties(properties) {
    const sort = $('propertiesSort')?.value || '';
    const clone = [...properties];
    const sortKey = $('propertiesSort')?.selectedOptions?.[0]?.dataset.sortKey || '';
    if (sortKey === 'price_asc') clone.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    else if (sortKey === 'price_desc') clone.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    else if (sortKey === 'area_desc') clone.sort((a, b) => Number((b.listingDetails || {}).area || b.livingArea || 0) - Number((a.listingDetails || {}).area || a.livingArea || 0));
    else if (sortKey === 'area_asc') clone.sort((a, b) => Number((a.listingDetails || {}).area || a.livingArea || 0) - Number((b.listingDetails || {}).area || b.livingArea || 0));
    return clone;
  }

  function appendIcon(parent, classes) {
    const icon = document.createElement('i');
    icon.className = classes;
    parent.appendChild(icon);
    return icon;
  }

  function createDetailPill(iconClass, text) {
    const pill = document.createElement('span');
    pill.className = 'detail-pill';
    appendIcon(pill, iconClass);
    const label = document.createElement('span');
    label.textContent = text;
    pill.appendChild(label);
    return pill;
  }

  function renderEmptyState(grid) {
    const empty = document.createElement('div');
    empty.className = 'mobile-properties-empty';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'mobile-properties-empty__icon';
    appendIcon(iconWrap, 'fas fa-search');

    const title = document.createElement('h3');
    title.textContent = t('properties_empty_title', 'Inga bostäder hittades');

    const body = document.createElement('p');
    body.textContent = t('search_no_results', FALLBACKS.empty);

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'mobileResetEmpty';
    button.textContent = t('filters_reset_all', 'Återställ filter');
    button.addEventListener('click', resetFilters);

    empty.append(iconWrap, title, body, button);
    grid.appendChild(empty);
  }

  function createAgentAvatar(property) {
    const avatar = document.createElement('div');
    avatar.className = 'agent-avatar';
    const avatarUrl = agentAvatar(property);
    const name = agentName(property);
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = name;
      avatar.appendChild(img);
    } else {
      avatar.textContent = initials(name);
    }
    return avatar;
  }

  function createPropertyCard(property) {
    const details = property.listingDetails || {};
    const image = safeImage(property.imageUrl) || safeImage((property.imageUrls || [])[0]) || '';
    const badge = propertyBadge(property);
    const title = propertyTitle(property);
    const location = property.address || property.location || t('property_location_missing', 'Plats saknas');
    const area = details.area ?? property.livingArea ?? null;
    const rooms = details.rooms ?? property.rooms ?? null;
    const typeLabel = localizedType(property.propertyType || property.type || '');
    const statusLabel = String(property.status || '').toLowerCase() === 'published'
      ? t('property_status_active', 'Aktiv')
      : localizedType(property.propertyType || property.type || property.status || '');
    const favoriteActive = Number(property.saves || 0) > 0;

    const card = document.createElement('article');
    card.className = 'property-card';

    const imageWrap = document.createElement('div');
    imageWrap.className = 'card-image';
    if (image) {
      const img = document.createElement('img');
      img.src = image;
      img.alt = property.title || FALLBACKS.no_image;
      img.loading = 'lazy';
      imageWrap.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'card-image-fallback';
      appendIcon(fallback, 'fas fa-house');
      imageWrap.appendChild(fallback);
    }

    const badgeEl = document.createElement('span');
    badgeEl.className = `image-badge ${propertyBadgeClass(property)}`;
    appendIcon(badgeEl, 'fas fa-bolt');
    badgeEl.appendChild(document.createTextNode(badge));

    const favoriteBtn = document.createElement('button');
    favoriteBtn.className = `favorite-btn ${favoriteActive ? 'active is-active' : ''}`.trim();
    favoriteBtn.type = 'button';
    favoriteBtn.dataset.favoriteId = String(property.id);
    appendIcon(favoriteBtn, `${favoriteActive ? 'fas' : 'far'} fa-heart`);

    imageWrap.append(imageWrap.firstChild, badgeEl, favoriteBtn);

    const content = document.createElement('div');
    content.className = 'card-content';

    const priceRow = document.createElement('div');
    priceRow.className = 'price-row';
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = formatSek(property.price);
    priceRow.appendChild(price);

    const titleEl = document.createElement('h3');
    titleEl.className = 'property-title';
    titleEl.textContent = title;

    const address = document.createElement('div');
    address.className = 'address';
    address.textContent = location;

    const detailsRow = document.createElement('div');
    detailsRow.className = 'details-row';
    if (typeLabel) detailsRow.appendChild(createDetailPill('fas fa-house', typeLabel));
    if (rooms) detailsRow.appendChild(createDetailPill('fas fa-bed', `${formatNumber(rooms)} ${t('property_feature_rooms', 'rum')}`));
    if (area) detailsRow.appendChild(createDetailPill('fas fa-vector-square', `${formatNumber(area)} ${t('unit_sqm', 'm²')}`));
    if (statusLabel) detailsRow.appendChild(createDetailPill('fas fa-circle-dot', statusLabel));

    const agentInfo = document.createElement('div');
    agentInfo.className = 'agent-info';
    agentInfo.appendChild(createAgentAvatar(property));
    const agentNameEl = document.createElement('span');
    agentNameEl.className = 'agent-name';
    agentNameEl.textContent = agentName(property);
    const agentStatus = document.createElement('span');
    agentStatus.className = 'agent-status';
    agentStatus.textContent = property.owner ? `● ${t('online_status', 'Online')}` : '';
    agentInfo.append(agentNameEl, agentStatus);

    content.append(priceRow, titleEl, address, detailsRow, agentInfo);
    card.append(imageWrap, content);

    card.addEventListener('click', () => {
      window.location.href = propertyUrl(property.id);
    });

    favoriteBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (typeof window.toggleFavorite === 'function') {
        window.toggleFavorite(event, String(property.id));
      }
    });

    return card;
  }

  function renderChips() {
    const container = $('mobileFilterChips');
    if (!container) return;
    container.replaceChildren();
    container.hidden = !state.selectedFilters.size;
    [...state.selectedFilters].forEach((label) => {
      const chip = document.createElement('button');
      chip.className = 'mobile-properties-chip';
      chip.type = 'button';
      chip.append(document.createTextNode(`${label} `));
      appendIcon(chip, 'fas fa-times');
      chip.addEventListener('click', () => {
        state.selectedFilters.delete(label);
        updateBadge();
        render();
      });
      container.appendChild(chip);
    });
    const clear = document.createElement('button');
    clear.className = 'mobile-properties-clear-all';
    clear.type = 'button';
    clear.textContent = t('filters_reset_all', 'Rensa alla');
    clear.addEventListener('click', resetFilters);
    container.appendChild(clear);
  }

  function updateBadge() {
    const badge = $('mobileFilterBadge');
    if (!badge) return;
    const count = state.selectedFilters.size;
    badge.textContent = String(count);
    badge.hidden = !count;
  }

  function propertyUrl(id) {
    return `/templates/mobile/public/property-modal.html?id=${encodeURIComponent(id)}`;
  }

  function renderGrid() {
    const grid = $('propertiesGrid');
    if (!grid) return;
    grid.replaceChildren();

    if (!state.rendered.length) {
      renderEmptyState(grid);
      return;
    }

    state.rendered.forEach((property) => {
      grid.appendChild(createPropertyCard(property));
    });

    if (window.initFavorites) {
      window.initFavorites();
    }
  }

  function renderCount() {
    const countText = $('propertiesCountText');
    const pageInfo = $('propertiesPaginationInfo');
    if (countText) {
      countText.replaceChildren();
      const value = document.createElement('span');
      value.className = 'results-count__value';
      value.textContent = formatNumber(state.rendered.length);
      const label = document.createElement('span');
      label.className = 'results-count__label';
      label.textContent = t('properties_count_label', 'bostäder');
      countText.append(value, label);
    }
    if (pageInfo) {
      pageInfo.textContent = state.rendered.length
        ? t('properties_map_published_count', 'Här visas {count} publicerade bostäder på karta.').replace('{count}', formatNumber(state.rendered.length))
        : t('properties_none_published', 'Inga publicerade objekt just nu.');
    }
  }

  function render() {
    state.rendered = sortProperties(normalizeFilters(state.properties));
    renderChips();
    renderCount();
    renderGrid();
    const applyButton = $('applyPrice');
    if (applyButton) {
      applyButton.textContent = `${t('show', 'Visa')} ${formatNumber(state.rendered.length)} ${t('properties_count_label', 'bostäder')}`;
    }
  }

  function resetFilters() {
    state.selectedFilters.clear();
    state.search = '';
    if ($('searchInput')) $('searchInput').value = '';
    if ($('minPrice')) $('minPrice').value = '0';
    if ($('maxPrice')) $('maxPrice').value = '20000000';
    document.querySelectorAll('.mobile-properties-option.selected').forEach((node) => node.classList.remove('selected'));
    updateBadge();
    render();
  }

  function toggleFilterModal(force) {
    const modal = $('mobileFilterModal');
    if (!modal) return;
    const next = typeof force === 'boolean' ? force : !modal.classList.contains('show');
    modal.classList.toggle('show', next);
  }

  function bindEvents() {
    $('mobileFilterOpen')?.addEventListener('click', () => toggleFilterModal(true));
    $('mobileFilterClose')?.addEventListener('click', () => toggleFilterModal(false));
    $('mobileFilterModal')?.addEventListener('click', (event) => {
      if (event.target === $('mobileFilterModal')) toggleFilterModal(false);
    });
    $('searchInput')?.addEventListener('input', (event) => {
      state.search = event.target.value || '';
      if ($('mobileSearchClear')) $('mobileSearchClear').hidden = !state.search;
      updateBadge();
      render();
    });
    $('mobileSearchClear')?.addEventListener('click', () => {
      if ($('searchInput')) $('searchInput').value = '';
      state.search = '';
      $('mobileSearchClear').hidden = true;
      updateBadge();
      render();
    });
    $('propertiesSort')?.addEventListener('change', render);
    $('mobileBackBtn')?.addEventListener('click', () => window.history.back());

    document.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.filter-chip').forEach((other) => other.classList.remove('active'));
        this.classList.add('active');
      });
    });

    document.querySelectorAll('.quick-filter-item').forEach((item) => {
      item.addEventListener('click', function () {
        document.querySelectorAll('.quick-filter-item').forEach((other) => other.classList.remove('active'));
        this.classList.add('active');
      });
    });

    document.querySelectorAll('.mobile-properties-option').forEach((option) => {
      option.addEventListener('click', () => {
        option.classList.toggle('selected');
        const value = option.dataset.value || option.textContent.trim();
        if (option.classList.contains('selected')) state.selectedFilters.add(value);
        else state.selectedFilters.delete(value);
        updateBadge();
      });
    });

    $('applyPrice')?.addEventListener('click', () => {
      toggleFilterModal(false);
      render();
    });

    $('mobileResetFilters')?.addEventListener('click', resetFilters);
    $('mapToggleBtn')?.addEventListener('click', toggleMapView);
    $('mapBackToList')?.addEventListener('click', () => toggleMapView(false));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') toggleFilterModal(false);
    });
  }

  function toggleMapView(force) {
    const grid = $('propertiesGrid');
    const map = $('mapView');
    const toggle = $('mapToggleBtn');
    const next = typeof force === 'boolean' ? force : state.view !== 'map';
    state.view = next ? 'map' : 'grid';
    if (grid) grid.hidden = Boolean(next);
    if (map) map.classList.toggle('active', next);
    if (toggle) {
      toggle.replaceChildren();
      appendIcon(toggle, next ? 'fas fa-list' : 'fas fa-map');
    }
  }

  async function init() {
    bindEvents();
    updateBadge();
    if ($('mobileSearchClear')) $('mobileSearchClear').hidden = !state.search;
    try {
      state.properties = await fetchPublished();
      render();
    } catch (_error) {
      state.properties = [];
      render();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.toggleFilterModal = toggleFilterModal;
})();
