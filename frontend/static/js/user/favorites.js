// ===== USER FAVORITES =====

document.addEventListener('DOMContentLoaded', async function () {
  if (!window.RimalisAPI) return;
  await hydrateFavoritesPage();

  const sortSelect = document.getElementById('userFavoritesSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', function () {
      renderFavoritesFromState();
    });
  }
});

window.addEventListener('rimalis:language-changed', async function () {
  if (!window.RimalisAPI) return;
  await hydrateFavoritesPage();
});

function i18n(key, fallback) {
  return window.RimalisI18n?.t?.(key, fallback) || fallback;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function ensureI18nReady() {
  if (window.RimalisI18n?.refresh) {
    await window.RimalisI18n.refresh(window.RimalisI18n.getLang?.());
  }
}

function formatPrice(price) {
  return window.RimalisI18n?.formatCurrencySEK?.(price) || i18n('value_not_set');
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

let favoritesState = [];

function getSortKey() {
  const sortSelect = document.getElementById('userFavoritesSort');
  return sortSelect?.value || 'latest';
}

function sortFavorites(items, sortKey) {
  const copy = [...items];

  if (sortKey === 'price_asc') {
    copy.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    return copy;
  }

  if (sortKey === 'price_desc') {
    copy.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    return copy;
  }

  if (sortKey === 'area_asc') {
    copy.sort((a, b) => String(a.location || '').localeCompare(String(b.location || ''), window.RimalisI18n?.localeFor?.() || 'sv-SE'));
    return copy;
  }

  copy.sort((a, b) => {
    const at = new Date(a.savedAt || a.createdAt || 0).getTime();
    const bt = new Date(b.savedAt || b.createdAt || 0).getTime();
    return bt - at;
  });
  return copy;
}

function renderFavoritesFromState() {
  const grid = document.getElementById('favoritesGrid');
  if (!grid) return;

  const sorted = sortFavorites(favoritesState, getSortKey());

  if (sorted.length === 0) {
    const box = document.createElement('div');
    box.className = 'glass-dark rounded-3xl p-8 text-white/60';
    box.textContent = i18n('user_no_favorites_yet');
    grid.textContent = '';
    grid.appendChild(box);
    return;
  }

  grid.textContent = '';
  sorted.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'prop-card group relative';
    card.dataset.property = String(p.propertyId || '');
    const favBtn = document.createElement('button');
    favBtn.className = 'favorite-btn active';
    favBtn.dataset.favoriteId = String(p.propertyId || '');
    const favIcon = document.createElement('i');
    favIcon.className = 'fas fa-heart';
    favBtn.appendChild(favIcon);
    card.appendChild(favBtn);

    const body = document.createElement('div');
    body.className = 'flex gap-6 p-6';
    const media = document.createElement('div');
    media.className = 'w-48 h-48 rounded-2xl overflow-hidden flex-shrink-0';
    const imgUrl = safeImage(p.imageUrl || (Array.isArray(p.imageUrls) ? p.imageUrls[0] : ''));
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.className = 'w-full h-full object-cover';
      img.alt = p.title || i18n('property_card_title_fallback');
      img.loading = 'lazy';
      media.appendChild(img);
    } else {
      const noImage = document.createElement('div');
      noImage.className = 'w-full h-full bg-white/5 flex items-center justify-center text-white/40 text-sm';
      noImage.textContent = i18n('no_image');
      media.appendChild(noImage);
    }

    const content = document.createElement('div');
    content.className = 'flex-1';
    const title = document.createElement('h3');
    title.className = 'text-2xl font-bold mb-1';
    title.textContent = p.title || i18n('property_card_title_fallback');
    const location = document.createElement('p');
    location.className = 'text-white/40 mb-3 flex items-center gap-2';
    const pin = document.createElement('i');
    pin.className = 'fas fa-map-pin';
    location.appendChild(pin);
    location.appendChild(document.createTextNode(p.location || i18n('value_not_set')));
    const meta = document.createElement('div');
    meta.className = 'space-y-2 mb-4';
    const line = document.createElement('p');
    line.className = 'text-white/60';
    const refSpan = document.createElement('span');
    refSpan.className = 'text-white';
    refSpan.textContent = p.referenceCode || i18n('value_not_set');
    line.appendChild(refSpan);
    line.appendChild(document.createTextNode(` · ${p.status || i18n('user_status_unknown')}`));
    const price = document.createElement('p');
    price.className = 'text-2xl font-bold text-[#e2ff31]';
    price.textContent = formatPrice(p.price);
    meta.appendChild(line);
    meta.appendChild(price);
    const actions = document.createElement('div');
    actions.className = 'flex gap-3';
    const openBtn = document.createElement('button');
    openBtn.className = 'btn-primary flex-1';
    openBtn.dataset.openId = String(p.propertyId || '');
    openBtn.textContent = i18n('user_view_details');
    actions.appendChild(openBtn);
    content.appendChild(title);
    content.appendChild(location);
    content.appendChild(meta);
    content.appendChild(actions);
    body.appendChild(media);
    body.appendChild(content);
    card.appendChild(body);
    grid.appendChild(card);
  });

  if (!grid.dataset.boundClicks) {
    grid.addEventListener('click', (event) => {
      const fav = event.target.closest('button[data-favorite-id]');
      if (fav) {
        const propertyId = fav.dataset.favoriteId;
        if (propertyId && typeof window.toggleFavorite === 'function') {
          window.toggleFavorite(event, propertyId);
        }
        return;
      }
      const open = event.target.closest('button[data-open-id]');
      if (open?.dataset.openId) {
        window.location.href = `../public/property-modal.html?id=${encodeURIComponent(open.dataset.openId)}`;
      }
    });
    grid.dataset.boundClicks = '1';
  }
}

async function hydrateFavoritesPage() {
  const grid = document.getElementById('favoritesGrid');
  const countText = document.getElementById('favoritesCountText');
  const paginationInfo = document.getElementById('favoritesPaginationInfo');
  if (!grid) return;

  try {
    await ensureI18nReady();
    const favBody = await window.RimalisAPI.request('/favorites/me', { auth: true });
    let favorites = (favBody.favorites || []).filter((f) => f?.propertyId);
    favorites = await Promise.all(
      favorites.map(async (fav) => {
        const hasEnoughData =
          String(fav.title || '').trim() &&
          Number(fav.price || 0) > 0 &&
          safeImage(fav.imageUrl || (Array.isArray(fav.imageUrls) ? fav.imageUrls[0] : ''));
        if (hasEnoughData) return fav;
        try {
          const prop = await window.RimalisAPI.request(`/properties/${encodeURIComponent(fav.propertyId)}`);
          const p = prop?.property || {};
          return {
            ...fav,
            title: fav.title || p.title || fav.propertyId,
            location: fav.location || p.location || '',
            price: Number(fav.price || p.price || 0),
            status: fav.status || p.status || '',
            referenceCode: fav.referenceCode || p.referenceCode || '',
            imageUrl: safeImage(fav.imageUrl) || safeImage(p.imageUrl) || '',
            imageUrls: Array.isArray(p.imageUrls) ? p.imageUrls : [],
          };
        } catch (_err) {
          return fav;
        }
      })
    );
    if (countText) countText.textContent = `${i18n('user_you_have')} ${favorites.length} ${i18n('user_saved_properties')}`;
    if (paginationInfo) paginationInfo.textContent = favorites.length ? '' : i18n('user_no_pages_to_show');

    favoritesState = favorites;
    renderFavoritesFromState();

    if (window.initFavorites) await window.initFavorites();
  } catch (_err) {
    favoritesState = [];
    const box = document.createElement('div');
    box.className = 'glass-dark rounded-3xl p-8 text-white/60';
    box.textContent = i18n('user_could_not_load_favorites');
    grid.textContent = '';
    grid.appendChild(box);
    if (countText) countText.textContent = `${i18n('user_you_have')} 0 ${i18n('user_saved_properties')}`;
    if (paginationInfo) paginationInfo.textContent = '';
  }
}

window.clearAllFavorites = async function clearAllFavorites() {
  if (!window.RimalisAPI) return;
  const ok = window.confirm(i18n('user_clear_all_favorites_q'));
  if (!ok) return;

  try {
    const body = await window.RimalisAPI.request('/favorites/me', { auth: true });
    const favorites = body.favorites || [];
    await Promise.allSettled(
      favorites.map((f) => window.RimalisAPI.request(`/favorites/me/${encodeURIComponent(f.propertyId)}`, {
        method: 'DELETE',
        auth: true,
      }))
    );
    await hydrateFavoritesPage();
    if (window.initFavorites) await window.initFavorites();
    showNotification(i18n('user_all_favorites_cleared'), 'success');
  } catch (err) {
    showNotification(err.message || i18n('user_could_not_clear_favorites'), 'error');
  }
};
