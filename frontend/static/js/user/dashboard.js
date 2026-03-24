// ===== USER DASHBOARD =====

document.addEventListener('DOMContentLoaded', async function () {
  if (!window.RimalisAPI) return;
  await hydrateDashboard();
});

window.addEventListener('rimalis:language-changed', async function () {
  if (!window.RimalisAPI) return;
  await hydrateDashboard();
});

async function ensureI18nReady() {
  if (window.RimalisI18n?.refresh) {
    await window.RimalisI18n.refresh(window.RimalisI18n.getLang?.());
  }
}

async function hydrateDashboard() {
  await ensureI18nReady();
  applyDashboardStaticTexts();
  const needsStats = Boolean(
    document.getElementById('statFavorites')
    || document.getElementById('statBookings')
    || document.getElementById('statSavedSearches')
    || document.getElementById('statUnreadMessages')
    || document.getElementById('mobileDashboardListings')
    || document.getElementById('statFavoritesText')
    || document.getElementById('statBookingsText')
    || document.getElementById('statSavedSearchesText')
    || document.getElementById('statUnreadMessagesText'),
  );
  await Promise.allSettled([
    loadProfileSummary(),
    needsStats ? loadDashboardStats() : Promise.resolve(),
    loadRecentActivity(),
    loadRecentProperties(),
  ]);
}

function i18n(key, fallback) {
  return window.RimalisI18n?.t?.(key, fallback) || fallback;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeImageUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/(?:static|uploads|api)\//i.test(value)) return value;
  return '';
}

function applyDashboardStaticTexts() {
  const mappings = [
    ['dashboardWelcomePrefix', 'user_dashboard_welcome_prefix', 'Välkommen tillbaka,'],
    ['dashboardIntroText', 'user_dashboard_intro', 'Här är en översikt över ditt konto och dina aktiviteter.'],
    ['statFavoritesTitle', 'user_dashboard_saved_favorites_title', 'Sparade favoriter'],
    ['statFavoritesCta', 'user_dashboard_cta_view_all', 'Visa alla'],
    ['statBookingsTitle', 'user_dashboard_booked_viewings_title', 'Bokade visningar'],
    ['statBookingsCta', 'user_dashboard_cta_view_times', 'Se tider'],
    ['statSavedSearchesTitle', 'user_dashboard_active_alerts_title', 'Aktiva bevakningar'],
    ['statSavedSearchesCta', 'user_dashboard_cta_manage', 'Hantera'],
    ['statUnreadMessagesTitle', 'user_dashboard_unread_messages_title', 'Olästa meddelanden'],
    ['statUnreadMessagesCta', 'user_dashboard_cta_read', 'Läs'],
    ['recentActivityTitle', 'user_dashboard_recent_activity_title', 'Senaste aktivitet'],
  ];

  mappings.forEach(([id, key, fallback]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = i18n(key, fallback);
  });
}

function formatPrice(price) {
  return window.RimalisI18n?.formatCurrencySEK?.(price) || '-';
}

async function loadProfileSummary() {
  try {
    const body = await window.RimalisAPI.request('/users/me', { auth: true });
    const user = body.user;

    const nameEl = document.getElementById('dashboardWelcomeName');
    const prefixEl = document.getElementById('dashboardWelcomePrefix');
    if (nameEl && user?.name) {
      const firstName = user.name.split(' ')[0];
      nameEl.textContent = firstName;

      const isRtl = document.documentElement.getAttribute('dir') === 'rtl';
      if (isRtl) {
        // Keep latin names stable inside Arabic sentence order.
        nameEl.setAttribute('dir', 'ltr');
        nameEl.style.unicodeBidi = 'isolate';
        if (prefixEl) {
          prefixEl.setAttribute('dir', 'rtl');
          prefixEl.style.unicodeBidi = 'plaintext';
        }
      } else {
        nameEl.removeAttribute('dir');
        nameEl.style.unicodeBidi = '';
        if (prefixEl) {
          prefixEl.removeAttribute('dir');
          prefixEl.style.unicodeBidi = '';
        }
      }
    }
  } catch (_err) {
    // ignore
  }
}

async function loadDashboardStats() {
  try {
    const [favBody, msgBody, bookingsBody, searchesBody] = await Promise.all([
      window.RimalisAPI.request('/favorites/me', { auth: true }),
      window.RimalisAPI.request('/messages/me', { auth: true }),
      window.RimalisAPI.request('/users/me/bookings', { auth: true }),
      window.RimalisAPI.request('/users/me/saved-searches', { auth: true }),
    ]);

    const favoritesCount = (favBody.favorites || []).length;
    const bookingsCount = (bookingsBody.bookings || []).length;
    const savedSearchesCount = (searchesBody.savedSearches || []).length;
    const unreadMessages = (msgBody.messages || []).filter((m) => m.state !== 'read').length;

    const statFavorites = document.getElementById('statFavorites');
    const statBookings = document.getElementById('statBookings');
    const statSavedSearches = document.getElementById('statSavedSearches');
    const statUnreadMessages = document.getElementById('statUnreadMessages');

    const statFavoritesText = document.getElementById('statFavoritesText');
    const statBookingsText = document.getElementById('statBookingsText');
    const statSavedSearchesText = document.getElementById('statSavedSearchesText');
    const statUnreadMessagesText = document.getElementById('statUnreadMessagesText');

    if (statFavorites) statFavorites.textContent = String(favoritesCount);
    if (statBookings) statBookings.textContent = String(bookingsCount);
    if (statSavedSearches) statSavedSearches.textContent = String(savedSearchesCount);
    if (statUnreadMessages) statUnreadMessages.textContent = String(unreadMessages);

    if (statFavoritesText) statFavoritesText.textContent = `${i18n('user_you_have')} ${favoritesCount} ${i18n('user_saved_properties')}`;
    if (statBookingsText) statBookingsText.textContent = `${bookingsCount} ${i18n('user_upcoming_viewings')}`;
    if (statSavedSearchesText) statSavedSearchesText.textContent = `${savedSearchesCount} ${i18n('user_saved_searches')}`;
    if (statUnreadMessagesText) statUnreadMessagesText.textContent = `${unreadMessages} ${i18n('user_new_messages')}`;
  } catch (_err) {
    // ignore
  }
}

async function loadRecentActivity() {
  const container = document.getElementById('recentActivityFeed');
  if (!container) return;

  try {
    const [favBody, msgBody] = await Promise.all([
      window.RimalisAPI.request('/favorites/me', { auth: true }),
      window.RimalisAPI.request('/messages/me', { auth: true }),
    ]);

    const latestFavRaw = (favBody.favorites || [])[0];
    let latestFav = latestFavRaw;
    if (latestFavRaw && (!latestFavRaw.title || !String(latestFavRaw.title).trim())) {
      try {
        const propBody = await window.RimalisAPI.request(`/properties/${encodeURIComponent(latestFavRaw.propertyId)}`);
        const p = propBody?.property || {};
        latestFav = {
          ...latestFavRaw,
          title: p.title || latestFavRaw.title || latestFavRaw.propertyId,
        };
      } catch (_err) {
        latestFav = latestFavRaw;
      }
    }
    const latestMsg = (msgBody.messages || [])[0];

    const items = [];
    if (latestFav) {
      items.push({
        icon: 'heart',
        labelPrefix: i18n('user_saved_item'),
        labelValue: latestFav.title || latestFav.referenceCode || latestFav.propertyId || '-',
        time: i18n('user_recently'),
      });
    }

    if (latestMsg) {
      items.push({
        icon: 'envelope',
        labelPrefix: `${i18n('user_new_message')}:`,
        labelValue: latestMsg.subject || '-',
        time: i18n('user_recently'),
      });
    }

    if (items.length === 0) return;

    container.textContent = '';
    items.forEach((a) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all';
      const iconWrap = document.createElement('div');
      iconWrap.className = 'w-12 h-12 bg-[#e2ff31]/10 rounded-full flex items-center justify-center';
      const icon = document.createElement('i');
      icon.className = `fas fa-${a.icon} text-[#e2ff31]`;
      iconWrap.appendChild(icon);
      const textWrap = document.createElement('div');
      textWrap.className = 'flex-1';
      const pMain = document.createElement('p');
      pMain.className = 'font-bold';
      pMain.appendChild(document.createTextNode(`${a.labelPrefix} `));
      const span = document.createElement('span');
      span.className = 'text-[#e2ff31]';
      span.textContent = a.labelValue;
      pMain.appendChild(span);
      const pTime = document.createElement('p');
      pTime.className = 'text-white/40 text-sm';
      pTime.textContent = a.time;
      textWrap.appendChild(pMain);
      textWrap.appendChild(pTime);
      row.appendChild(iconWrap);
      row.appendChild(textWrap);
      container.appendChild(row);
    });
  } catch (_err) {
    // ignore
  }
}

async function loadRecentProperties() {
  const grid = document.getElementById('recentPropertiesGrid');
  if (!grid || !window.RimalisAPI) return;

  try {
    const body = await window.RimalisAPI.request('/users/me/listings', { auth: true });
    const properties = (body.listings || []).slice(0, 3);

    if (!properties.length) {
      grid.textContent = '';
      const empty = document.createElement('div');
      empty.className = 'glass-dark rounded-[32px] p-8 md:col-span-3 text-white/60';
      empty.textContent = i18n('user_no_listings_yet');
      grid.appendChild(empty);
      return;
    }

    grid.textContent = '';
    properties.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'prop-card group cursor-pointer';
      card.dataset.openId = String(p.id || '');
      const media = document.createElement('div');
      media.className = 'relative h-[280px]';
      const image = safeImageUrl(p.imageUrl);
      if (image) {
        const img = document.createElement('img');
        img.src = image;
        img.className = 'w-full h-full object-cover';
        img.alt = p.title || i18n('property_card_title_fallback');
        img.loading = 'lazy';
        media.appendChild(img);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'w-full h-full bg-white/5 flex items-center justify-center text-white/40 text-sm';
        placeholder.textContent = i18n('no_image');
        media.appendChild(placeholder);
      }
      const favWrap = document.createElement('div');
      favWrap.className = 'absolute top-4 right-4';
      const favBtn = document.createElement('button');
      favBtn.className = 'favorite-btn static';
      favBtn.dataset.favoriteId = String(p.id || '');
      const favIcon = document.createElement('i');
      favIcon.className = 'far fa-heart';
      favBtn.appendChild(favIcon);
      favWrap.appendChild(favBtn);
      media.appendChild(favWrap);

      const content = document.createElement('div');
      content.className = 'p-6';
      const title = document.createElement('h3');
      title.className = 'text-2xl font-bold mb-1';
      title.textContent = p.title || i18n('property_card_title_fallback');
      const location = document.createElement('p');
      location.className = 'text-white/40 mb-2';
      location.textContent = p.location || i18n('value_not_set');
      const meta = document.createElement('div');
      meta.className = 'flex justify-between items-center';
      const price = document.createElement('p');
      price.className = 'text-[#e2ff31] font-bold text-2xl';
      price.textContent = formatPrice(p.price);
      const status = document.createElement('span');
      status.className = 'text-white/40 text-sm';
      status.textContent = formatStatus(p.status);
      meta.appendChild(price);
      meta.appendChild(status);
      content.appendChild(title);
      content.appendChild(location);
      content.appendChild(meta);
      card.appendChild(media);
      card.appendChild(content);
      grid.appendChild(card);
    });

    if (!grid.dataset.boundClicks) {
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
          window.location.href = `../public/property-modal.html?id=${encodeURIComponent(card.dataset.openId)}`;
        }
      });
      grid.dataset.boundClicks = '1';
    }

    if (window.initFavorites) await window.initFavorites();
  } catch (_err) {
    // ignore
  }
}

function formatStatus(status) {
  if (status === 'published') return i18n('user_status_active');
  if (status === 'pending') return i18n('user_status_pending');
  if (status === 'sold') return i18n('user_status_sold');
  if (status === 'draft') return i18n('user_status_draft');
  return status || i18n('user_status_unknown');
}
