(function () {
  function t(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback) || fallback;
  }

  function currentFileName() {
    const path = window.location.pathname || '';
    const file = path.split('/').pop() || '';
    return file.toLowerCase();
  }

  function resolveActiveKey(file) {
    if (file === 'dashboard.html') return 'overview';
    if (file === 'favorites.html') return 'favorites';
    if (file === 'my_listings.html') return 'my_listings';
    if (file === 'messages.html') return 'messages';
    if (file === 'profile.html' || file === 'settings.html' || file === 'profile_settings.html') return 'profile_settings';
    if (file === 'bookings.html') return 'my_listings';
    if (file === 'saved-searches.html') return 'profile_settings';
    if (file === 'step1_listing_info.html' || file === 'step2_media.html' || file === 'step3_preview_submit.html' || file === 'submitted_success.html') return 'my_listings';
    return '';
  }

  function renderUserMenu() {
    const nav = document.querySelector('aside nav.space-y-2');
    if (!nav) return;

    const items = window.RimalisMenuConfig?.getUserItems?.() || [];
    const activeKey = resolveActiveKey(currentFileName());

    nav.textContent = '';
    items.forEach((item) => {
      const isActive = item.key === activeKey;
      const baseClass = 'flex items-center gap-4 p-5 rounded-2xl hover:bg-[#e2ff31] hover:text-black transition-all text-lg';
      const activeClass = isActive ? ' bg-[#e2ff31] text-black' : '';
      const extraClass = item.kind === 'logout' ? ' mt-8 hover:bg-red-500/20 hover:text-red-500' : '';

      const a = document.createElement('a');
      a.href = item.href;
      a.className = `${baseClass}${activeClass}${extraClass}`;
      if (item.kind === 'logout') {
        a.addEventListener('click', (event) => {
          event.preventDefault();
          if (typeof window.logout === 'function') window.logout();
        });
      }

      const icon = document.createElement('i');
      icon.className = `fas ${item.icon} w-6 text-xl`;
      a.appendChild(icon);

      const span = document.createElement('span');
      span.setAttribute('data-i18n', item.labelKey);
      span.textContent = t(item.labelKey, item.fallback);
      a.appendChild(span);

      nav.appendChild(a);
    });
  }

  document.addEventListener('DOMContentLoaded', renderUserMenu);
  window.addEventListener('rimalis:language-changed', renderUserMenu);
})();
