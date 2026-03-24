// ===== FAVORITER =====

const FAVORITES_KEY = 'rimalis_favorites';
const LEGACY_FAVORITES_KEY = 'rimalisFavorites';

function i18n(key) {
  return window.RimalisI18n?.t?.(key, key) || key;
}

function migrateLegacyFavoritesKey() {
  const oldValue = localStorage.getItem(LEGACY_FAVORITES_KEY);
  const newValue = localStorage.getItem(FAVORITES_KEY);
  if (oldValue && !newValue) {
    localStorage.setItem(FAVORITES_KEY, oldValue);
  }
  if (oldValue) {
    localStorage.removeItem(LEGACY_FAVORITES_KEY);
  }
}

function readFavoritesFromStorage() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    localStorage.removeItem(FAVORITES_KEY);
    return [];
  }
}

migrateLegacyFavoritesKey();
let favorites = readFavoritesFromStorage();

function persistFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isLoggedIn() {
  return Boolean(window.RimalisAPI && window.RimalisAPI.getAccessToken());
}

async function syncFavoritesFromApi() {
  if (!isLoggedIn()) return;

  try {
    const body = await window.RimalisAPI.request('/favorites/me', { auth: true, optionalAuth: true });
    favorites = (body.favorites || []).map((f) => f.propertyId);
    persistFavorites();
  } catch (_err) {
    // fallback to local cache
  }
}

async function toggleFavorite(event, propertyId) {
  event.stopPropagation();

  const btn = event.currentTarget;
  const icon = btn.querySelector('i');
  const has = favorites.includes(propertyId);

  try {
    if (isLoggedIn()) {
      if (has) {
        await window.RimalisAPI.request(`/favorites/me/${propertyId}`, {
          method: 'DELETE',
          auth: true,
        });
      } else {
        await window.RimalisAPI.request(`/favorites/me/${propertyId}`, {
          method: 'POST',
          auth: true,
        });
      }
    }

    if (has) {
      favorites = favorites.filter((id) => id !== propertyId);
      icon.className = 'far fa-heart';
      btn.classList.remove('active');
      showNotification(i18n('favorites_removed'), 'info');
    } else {
      favorites.push(propertyId);
      icon.className = 'fas fa-heart';
      btn.classList.add('active');
      showNotification(i18n('favorites_saved'), 'success');
    }

    persistFavorites();
    updateFavoriteCounter();
  } catch (err) {
    showNotification(err.message || i18n('favorites_update_failed'), 'error');
  }
}

function updateFavoriteCounter() {
  const counter = document.getElementById('favoriteCounter');
  if (counter) {
    counter.textContent = favorites.length;
  }
}

function showFavorites() {
  if (favorites.length === 0) {
    showNotification(i18n('favorites_none'), 'info');
    return;
  }
  const favoriteNames = favorites.join(', ');
  showNotification(`${i18n('favorites_list_prefix')}: ${favoriteNames}`, 'success');
}

function loadFavorites() {
  document.querySelectorAll('.prop-card').forEach((card) => {
    const propertyId = card.dataset.property;
    const favBtn = card.querySelector('.favorite-btn');

    if (favBtn && propertyId) {
      const icon = favBtn.querySelector('i');
      if (favorites.includes(propertyId)) {
        icon.className = 'fas fa-heart';
        favBtn.classList.add('active');
      } else {
        icon.className = 'far fa-heart';
        favBtn.classList.remove('active');
      }
    }
  });

  updateFavoriteCounter();
}

async function initFavorites() {
  await syncFavoritesFromApi();
  loadFavorites();

  document.querySelectorAll('.favorite-btn').forEach((btn) => {
    btn.addEventListener('click', function (e) {
      const card = this.closest('.prop-card');
      if (card) {
        const propertyId = card.dataset.property;
        toggleFavorite(e, propertyId);
      }
    });
  });
}

async function clearAllFavorites() {
  if (isLoggedIn()) {
    try {
      await Promise.all(
        favorites.map((id) =>
          window.RimalisAPI.request(`/favorites/me/${id}`, {
            method: 'DELETE',
            auth: true,
          })
        )
      );
    } catch (_err) {
      // continue local clear
    }
  }

  favorites = [];
  localStorage.removeItem(FAVORITES_KEY);
  localStorage.removeItem(LEGACY_FAVORITES_KEY);

  document.querySelectorAll('.favorite-btn').forEach((btn) => {
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'far fa-heart';
    btn.classList.remove('active');
  });

  updateFavoriteCounter();
  showNotification(i18n('favorites_cleared'), 'info');
}

window.toggleFavorite = toggleFavorite;
window.clearAllFavorites = clearAllFavorites;
window.showFavorites = showFavorites;
window.initFavorites = initFavorites;
