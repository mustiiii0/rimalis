(function () {
  function t(key, fallback) {
    return window.RimalisI18n?.t?.(key, fallback) || fallback;
  }

  function currentFileName() {
    const path = window.location.pathname || '';
    const file = path.split('/').pop() || '';
    return file.toLowerCase();
  }

  function renderAdminMenu() {
    const nav = document.querySelector('.admin-sidebar .nav-list');
    if (!nav) return;

    const file = currentFileName();
    const items = window.RimalisMenuConfig?.getAdminItems?.() || [];

    nav.textContent = '';
    items.forEach((item) => {
      const isActive = file === item.href.toLowerCase();
      const isLogout = item.kind === 'logout';
      const classes = `nav-link${isActive ? ' active' : ''}${isLogout ? ' logout' : ''}`;
      const link = document.createElement('a');
      link.className = classes;
      link.href = item.href;
      const icon = document.createElement('i');
      icon.className = `fas ${item.icon}`;
      const label = document.createElement('span');
      label.dataset.i18n = item.labelKey;
      label.textContent = t(item.labelKey, item.fallback);
      link.appendChild(icon);
      link.appendChild(label);
      nav.appendChild(link);
    });
  }

  document.addEventListener('DOMContentLoaded', renderAdminMenu);
  window.addEventListener('rimalis:language-changed', renderAdminMenu);
})();
