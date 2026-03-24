(function () {
  function isMobilePage() {
    return (window.location.pathname || '').includes('/templates/mobile/');
  }

  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function loadSavedSearches() {
    const container = document.getElementById('savedSearchesContainer');
    if (!container || !window.RimalisAPI) return;

    try {
      const body = await window.RimalisAPI.request('/users/me/saved-searches', { auth: true });
      const items = body.savedSearches || [];

      if (!items.length) {
        const box = document.createElement('div');
        box.className = isMobilePage()
          ? 'mobile-saved-searches-empty'
          : 'glass-dark rounded-3xl p-6 text-white/60';
        box.textContent = i18n('user_no_saved_searches_yet');
        container.textContent = '';
        container.appendChild(box);
        return;
      }

      container.textContent = '';
      items.forEach((s) => {
        const row = document.createElement('div');
        row.className = isMobilePage()
          ? 'mobile-saved-search-card'
          : 'glass-dark rounded-3xl p-6 flex items-center justify-between gap-4';

        const head = document.createElement('div');
        if (isMobilePage()) head.className = 'mobile-saved-search-card__head';

        const left = document.createElement('div');
        const title = document.createElement('h3');
        title.className = isMobilePage() ? 'mobile-saved-search-card__title' : 'text-xl font-bold';
        title.textContent = s.name || '-';
        const filters = document.createElement('p');
        filters.className = isMobilePage() ? 'mobile-saved-search-card__filters' : 'text-white/40';
        filters.textContent = Object.entries(s.criteria || {}).map(([k, v]) => `${k}: ${v}`).join(' • ') || i18n('user_no_filters');
        left.appendChild(title);
        left.appendChild(filters);

        const btn = document.createElement('button');
        btn.className = isMobilePage() ? 'mobile-saved-search-card__remove' : 'btn-outline';
        btn.dataset.searchId = String(s.id || '');
        btn.textContent = i18n('user_remove');
        btn.addEventListener('click', async () => {
          try {
            await window.RimalisAPI.request(`/users/me/saved-searches/${btn.dataset.searchId}`, {
              method: 'DELETE',
              auth: true,
            });
            await loadSavedSearches();
            showNotification(i18n('user_saved_search_removed'), 'info');
          } catch (err) {
            showNotification(err.message || i18n('user_remove_failed'), 'error');
          }
        });
        if (isMobilePage()) {
          head.appendChild(left);
          head.appendChild(btn);
          row.appendChild(head);
        } else {
          row.appendChild(left);
          row.appendChild(btn);
        }
        container.appendChild(row);
      });
    } catch (err) {
      const box = document.createElement('div');
      box.className = isMobilePage()
        ? 'mobile-saved-searches-error'
        : 'glass-dark rounded-3xl p-6 text-red-300';
      box.textContent = err.message || i18n('user_load_saved_searches_failed');
      container.textContent = '';
      container.appendChild(box);
    }
  }

  document.addEventListener('DOMContentLoaded', loadSavedSearches);
})();
