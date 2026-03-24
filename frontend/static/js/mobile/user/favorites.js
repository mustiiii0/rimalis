let favoritesState = [];
let favoritesCollection = 'all';
let favoritesSearch = '';
let editMode = false;
let selectedFavorites = new Set();

document.addEventListener('DOMContentLoaded', async function () {
  if (!window.RimalisAPI) return;
  bindFavoritesChrome();
  await hydrateFavoritesPage();

  const sortSelect = document.getElementById('userFavoritesSort');
  sortSelect?.addEventListener('change', renderFavoritesFromState);

  const searchInput = document.getElementById('favoritesSearchInput');
  searchInput?.addEventListener('input', function () {
    favoritesSearch = String(searchInput.value || '').trim().toLowerCase();
    const clearButton = document.getElementById('favoritesSearchClear');
    if (clearButton) clearButton.hidden = !favoritesSearch;
    renderFavoritesFromState();
  });

  document.querySelectorAll('#favoritesCollectionGrid [data-collection]').forEach((item) => {
    item.addEventListener('click', function () {
      favoritesCollection = item.dataset.collection || 'all';
      document.querySelectorAll('#favoritesCollectionGrid [data-collection]').forEach((entry) => entry.classList.toggle('active', entry === item));
      renderFavoritesFromState();
    });
  });
});

window.addEventListener('rimalis:language-changed', async function () {
  if (!window.RimalisAPI) return;
  await hydrateFavoritesPage();
});

function bindFavoritesChrome() {
  const modal = document.getElementById('favoritesDeleteModal');
  const editBtn = document.getElementById('favoritesEditModeBtn');
  const cancelBtn = document.getElementById('favoritesDeleteCancel');
  const confirmBtn = document.getElementById('favoritesDeleteConfirm');
  const clearSearchBtn = document.getElementById('favoritesSearchClear');
  const selectAllBtn = document.getElementById('favoritesSelectAllBtn');
  const deleteSelectedBtn = document.getElementById('favoritesDeleteSelectedBtn');

  editBtn?.addEventListener('click', function () {
    toggleEditMode();
  });

  cancelBtn?.addEventListener('click', closeDeleteModal);
  confirmBtn?.addEventListener('click', deleteSelectedFavorites);

  clearSearchBtn?.addEventListener('click', function () {
    const input = document.getElementById('favoritesSearchInput');
    if (input) input.value = '';
    favoritesSearch = '';
    clearSearchBtn.hidden = true;
    renderFavoritesFromState();
  });

  selectAllBtn?.addEventListener('click', function () {
    selectedFavorites = new Set(filteredFavorites(favoritesState).map((item) => String(item.propertyId || item.id || '')));
    updateEditBar();
    renderFavoritesFromState();
  });

  deleteSelectedBtn?.addEventListener('click', function () {
    if (!selectedFavorites.size) {
      window.showNotification?.(i18n('favorites_none_selected', 'Inga favoriter valda'), 'error');
      return;
    }
    openDeleteModal();
  });

  modal?.addEventListener('click', function (event) {
    if (event.target === modal) closeDeleteModal();
  });

  if (!document.body.dataset.boundFavoriteClicks) {
    document.body.addEventListener('click', async function (event) {
      const favorite = event.target.closest('button[data-favorite-id]');
      if (favorite) {
        const propertyId = favorite.dataset.favoriteId;
        if (propertyId && typeof window.toggleFavorite === 'function') {
          window.toggleFavorite(event, propertyId);
        }
        return;
      }

      const select = event.target.closest('button[data-select-id]');
      if (select) {
        event.preventDefault();
        const propertyId = String(select.dataset.selectId || '');
        if (!propertyId) return;
        if (selectedFavorites.has(propertyId)) selectedFavorites.delete(propertyId);
        else selectedFavorites.add(propertyId);
        updateEditBar();
        renderFavoritesFromState();
        return;
      }

      const openCard = event.target.closest('[data-property]');
      if (!editMode && openCard?.dataset.property && !event.target.closest('button')) {
        window.location.href = `/templates/mobile/public/property-modal.html?id=${encodeURIComponent(openCard.dataset.property)}`;
      }
    });
    document.body.dataset.boundFavoriteClicks = '1';
  }
}

function i18n(key, fallback) {
  return window.RimalisI18n?.t?.(key, fallback) || fallback;
}

async function ensureI18nReady() {
  if (window.RimalisI18n?.refresh) {
    await window.RimalisI18n.refresh(window.RimalisI18n.getLang?.());
  }
}

function formatPrice(price) {
  return window.RimalisI18n?.formatCurrencySEK?.(price) || i18n('value_not_set', '-');
}

function formatNumber(value) {
  return window.RimalisI18n?.formatNumber?.(value) || String(value);
}

function localizePropertyType(value) {
  const raw = String(value || '').trim();
  if (!raw) return i18n('property_type_default', 'Bostad');
  const normalized = raw.toLowerCase();
  if (['villa', 'villa/hus', 'hus', 'house'].includes(normalized)) return i18n('property_type_house', 'Villa/Hus');
  if (['lägenhet', 'lagenhet', 'apartment'].includes(normalized)) return i18n('property_type_apartment', 'Lägenhet');
  if (['radhus', 'townhouse'].includes(normalized)) return i18n('property_type_townhouse', 'Radhus');
  if (['fritidshus', 'fritid', 'holiday home', 'holiday_home'].includes(normalized)) return i18n('property_type_holiday_home', 'Fritidshus');
  if (['byggmark', 'land', 'plot', 'tomt'].includes(normalized)) return i18n('property_type_land', 'Byggmark');
  return raw;
}

function safeImage(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/static/uploads/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  return '';
}

function getSortKey() {
  return document.getElementById('userFavoritesSort')?.value || 'latest';
}

function sortFavorites(items, sortKey) {
  const copy = [...items];

  if (sortKey === 'price_asc') return copy.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (sortKey === 'price_desc') return copy.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (sortKey === 'area_asc') {
    return copy.sort((a, b) => String(a.location || '').localeCompare(String(b.location || ''), window.RimalisI18n?.localeFor?.() || 'sv-SE'));
  }

  return copy.sort((a, b) => new Date(b.savedAt || b.createdAt || 0).getTime() - new Date(a.savedAt || a.createdAt || 0).getTime());
}

function filteredFavorites(items) {
  return items.filter((item) => {
    const haystack = `${item.title || ''} ${item.location || ''} ${item.ownerName || ''}`.toLowerCase();
    if (favoritesSearch && !haystack.includes(favoritesSearch)) return false;

    const typeValue = `${item.propertyType || item.type || ''}`.toLowerCase();
    if (favoritesCollection === 'villa' && !typeValue.includes('villa') && !typeValue.includes('hus')) return false;
    if (favoritesCollection === 'lagenhet' && !typeValue.includes('lägen') && !typeValue.includes('apartment')) return false;
    return true;
  });
}

function updateStats(items) {
  const total = items.length;
  const villas = items.filter((item) => {
    const typeValue = `${item.propertyType || item.type || ''}`.toLowerCase();
    return typeValue.includes('villa') || typeValue.includes('hus');
  }).length;
  const apartments = items.filter((item) => {
    const typeValue = `${item.propertyType || item.type || ''}`.toLowerCase();
    return typeValue.includes('lägen') || typeValue.includes('apartment');
  }).length;

  const values = {
    favoritesStatTotal: total,
    favoritesStatVilla: villas,
    favoritesStatApartment: apartments,
  };

  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  });
}

function updateEditBar() {
  const bar = document.getElementById('favoritesEditBar');
  const count = document.getElementById('favoritesSelectedCount');
  const editBtn = document.getElementById('favoritesEditModeBtn');
  if (bar) bar.hidden = !editMode;
  if (count) count.textContent = `${formatNumber(selectedFavorites.size)} ${i18n('favorites_selected_count_suffix', 'markerade')}`;
  editBtn?.classList.toggle('active', editMode);
}

function renderFavoritesFromState() {
  const list = document.getElementById('favoritesList');
  const countNumber = document.getElementById('favoritesCountNumber');
  const countText = document.getElementById('favoritesCountText');
  if (!list) return;

  const filtered = filteredFavorites(favoritesState);
  const sorted = sortFavorites(filtered, getSortKey());
  updateStats(filtered);

  if (countNumber) countNumber.textContent = formatNumber(sorted.length);
  if (countText) {
    countText.textContent = sorted.length === 1
      ? i18n('favorites_count_single', 'favorit')
      : i18n('favorites_count_plural', 'favoriter');
  }

  list.textContent = '';

  if (!sorted.length) {
    const box = document.createElement('div');
    box.className = 'mobile-favorites-empty';
    box.textContent = i18n('user_no_favorites_yet', 'Du har inga favoriter ännu.');
    list.appendChild(box);
    updateEditBar();
    return;
  }

  sorted.forEach((property) => {
    const propertyId = String(property.propertyId || property.id || '');
    const isSelected = selectedFavorites.has(propertyId);
    list.appendChild(createFavoriteCard(property, { editMode, isSelected }));
  });

  updateEditBar();
}

function appendIcon(parent, classes) {
  const icon = document.createElement('i');
  icon.className = classes;
  parent.appendChild(icon);
  return icon;
}

function createFavoriteDetail(iconClass, label) {
  const span = document.createElement('span');
  appendIcon(span, iconClass);
  span.appendChild(document.createTextNode(` ${label}`));
  return span;
}

function createFavoriteCard(property, { editMode = false, isSelected = false } = {}) {
  const imgUrl = safeImage(property.imageUrl || (Array.isArray(property.imageUrls) ? property.imageUrls[0] : ''));
  const location = property.location || i18n('value_not_set', '-');
  const detailArea = Number(property.livingArea || property.area || 0);
  const detailRooms = Number(property.rooms || 0);
  const propertyType = localizePropertyType(property.propertyType || property.type || property.status || '');
  const agentName = property.ownerName || property.agentName || property.contactName || 'Rimalis';
  const propertyId = String(property.propertyId || property.id || '');
  const savedLabel = window.RimalisI18n?.formatRelativeTime?.(property.savedAt || property.createdAt) || i18n('favorites_saved_label', 'Sparad');

  const card = document.createElement('article');
  card.className = 'list-item';
  if (editMode) card.classList.add('edit-mode');
  card.dataset.property = propertyId;

  if (imgUrl) {
    const img = document.createElement('img');
    img.src = imgUrl;
    img.className = 'list-image';
    img.alt = property.title || i18n('property_type_default', 'Bostad');
    img.loading = 'lazy';
    card.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'list-image';
    card.appendChild(placeholder);
  }

  const selectBtn = document.createElement('button');
  selectBtn.className = `mobile-favorites-selectbox ${isSelected ? 'checked' : ''}`.trim();
  selectBtn.type = 'button';
  selectBtn.dataset.selectId = propertyId;
  appendIcon(selectBtn, 'fas fa-check');

  const favoriteBtn = document.createElement('button');
  favoriteBtn.className = 'favorite-btn favorite-btn--list active';
  favoriteBtn.type = 'button';
  favoriteBtn.dataset.favoriteId = propertyId;
  appendIcon(favoriteBtn, 'fas fa-heart');

  const content = document.createElement('div');
  content.className = 'list-item__content';

  const top = document.createElement('div');
  top.className = 'list-item__top';
  const price = document.createElement('div');
  price.className = 'list-price';
  price.textContent = formatPrice(property.price);
  const type = document.createElement('div');
  type.className = 'list-type';
  type.textContent = propertyType;
  top.append(price, type);

  const title = document.createElement('div');
  title.className = 'list-title';
  title.textContent = property.title || i18n('property_type_default', 'Bostad');

  const address = document.createElement('div');
  address.className = 'list-address';
  appendIcon(address, 'fas fa-map-pin');
  address.appendChild(document.createTextNode(` ${location}`));

  const details = document.createElement('div');
  details.className = 'list-details';
  if (detailArea) details.appendChild(createFavoriteDetail('fas fa-vector-square', `${formatNumber(detailArea)} ${i18n('unit_sqm', 'm²')}`));
  if (detailRooms) details.appendChild(createFavoriteDetail('fas fa-bed', `${formatNumber(detailRooms)} ${i18n('property_feature_rooms', 'rum')}`));

  const agent = document.createElement('div');
  agent.className = 'list-agent';
  const agentWrap = document.createElement('span');
  const avatar = document.createElement('span');
  avatar.className = 'agent-avatar';
  avatar.textContent = getInitials(agentName);
  const name = document.createElement('span');
  name.className = 'agent-name';
  name.textContent = agentName;
  agentWrap.append(avatar, document.createTextNode(' '), name);
  const date = document.createElement('span');
  date.className = 'list-date';
  appendIcon(date, 'fas fa-clock');
  date.appendChild(document.createTextNode(` ${savedLabel}`));
  agent.append(agentWrap, date);

  content.append(top, title, address, details, agent);
  card.append(selectBtn, favoriteBtn, content);
  return card;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(label) {
  return String(label || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'RM';
}

async function hydrateFavoritesPage() {
  const list = document.getElementById('favoritesList');
  if (!list) return;

  try {
    await ensureI18nReady();
    const favBody = await window.RimalisAPI.request('/favorites/me', { auth: true });
    let favorites = (favBody.favorites || []).filter((item) => item?.propertyId);

    favorites = await Promise.all(
      favorites.map(async (favorite) => {
        const hasEnoughData =
          String(favorite.title || '').trim() &&
          Number(favorite.price || 0) > 0 &&
          safeImage(favorite.imageUrl || (Array.isArray(favorite.imageUrls) ? favorite.imageUrls[0] : ''));

        if (hasEnoughData) return favorite;

        try {
          const propertyBody = await window.RimalisAPI.request(`/properties/${encodeURIComponent(favorite.propertyId)}`);
          const property = propertyBody?.property || {};
          return {
            ...favorite,
            title: favorite.title || property.title || favorite.propertyId,
            location: favorite.location || property.location || '',
            price: Number(favorite.price || property.price || 0),
            status: favorite.status || property.status || '',
            referenceCode: favorite.referenceCode || property.referenceCode || '',
            propertyType: favorite.propertyType || property.propertyType || property.type || '',
            livingArea: favorite.livingArea || property.livingArea || 0,
            rooms: favorite.rooms || property.rooms || 0,
            ownerName: favorite.ownerName || property.ownerName || property.agentName || '',
            imageUrl: safeImage(favorite.imageUrl) || safeImage(property.imageUrl) || '',
            imageUrls: Array.isArray(property.imageUrls) ? property.imageUrls : [],
          };
        } catch (_error) {
          return favorite;
        }
      })
    );

    favoritesState = favorites;
    renderFavoritesFromState();
    if (window.initFavorites) await window.initFavorites();
  } catch (_error) {
    favoritesState = [];
    const box = document.createElement('div');
    box.className = 'mobile-favorites-error';
    box.textContent = i18n('user_could_not_load_favorites', 'Kunde inte ladda favoriter.');
    list.textContent = '';
    list.appendChild(box);
    const countNumber = document.getElementById('favoritesCountNumber');
    const countTextNode = document.getElementById('favoritesCountText');
    if (countNumber) countNumber.textContent = '0';
    if (countTextNode) countTextNode.textContent = i18n('favorites_count_plural', 'favoriter');
  }
}

function openDeleteModal() {
  const modal = document.getElementById('favoritesDeleteModal');
  const text = document.getElementById('favoritesDeleteModalText');
  if (text) text.textContent = `${formatNumber(selectedFavorites.size)} ${i18n('favorites_selected_count_suffix', 'markerade')}`;
  modal?.classList.add('show');
}

function closeDeleteModal() {
  document.getElementById('favoritesDeleteModal')?.classList.remove('show');
}

function toggleEditMode() {
  editMode = !editMode;
  if (!editMode) selectedFavorites.clear();
  updateEditBar();
  renderFavoritesFromState();
}

async function deleteSelectedFavorites() {
  if (!selectedFavorites.size || !window.RimalisAPI) return;
  try {
    await Promise.allSettled(
      Array.from(selectedFavorites).map((propertyId) => window.RimalisAPI.request(`/favorites/me/${encodeURIComponent(propertyId)}`, {
        method: 'DELETE',
        auth: true,
      }))
    );
    selectedFavorites.clear();
    closeDeleteModal();
    editMode = false;
    await hydrateFavoritesPage();
    if (window.initFavorites) await window.initFavorites();
    window.showNotification?.(i18n('user_all_favorites_cleared', 'Favoriter togs bort'), 'success');
  } catch (error) {
    window.showNotification?.(error.message || i18n('user_could_not_clear_favorites', 'Kunde inte ta bort favoriter'), 'error');
  }
}
