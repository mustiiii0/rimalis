(function () {
  function pathFor(section, file) {
    const prefix = (window.location.pathname || '').includes('/templates/mobile/') ? '/templates/mobile/' : '/templates/';
    return `${prefix}${section}/${file}`;
  }

  function userProfileHref() {
    return (window.location.pathname || '').includes('/templates/mobile/')
      ? 'profile.html'
      : 'profile_settings.html';
  }

  const USER_ITEMS = [
    { key: 'overview', href: 'dashboard.html', icon: 'fa-chart-pie', labelKey: 'user_sidebar_overview', fallback: 'Översikt' },
    { key: 'favorites', href: 'favorites.html', icon: 'fa-heart', labelKey: 'user_sidebar_favorites', fallback: 'Favoriter' },
    { key: 'my_listings', href: 'my_listings.html', icon: 'fa-home', labelKey: 'user_sidebar_my_listings', fallback: 'Mina annonser' },
    { key: 'messages', href: 'messages.html', icon: 'fa-envelope', labelKey: 'user_sidebar_messages', fallback: 'Meddelanden' },
    { key: 'profile_settings', href: userProfileHref(), icon: 'fa-user', labelKey: 'user_sidebar_profile', fallback: 'Profil' },
    { key: 'logout', href: pathFor('auth', 'login.html'), icon: 'fa-sign-out-alt', labelKey: 'common_logout', fallback: 'Logga ut', kind: 'logout' },
  ];

  const ADMIN_ITEMS = [
    { key: 'dashboard', href: 'dashboard.html', icon: 'fa-chart-line', labelKey: 'admin_sidebar_overview', fallback: 'Översikt' },
    { key: 'properties', href: 'properties.html', icon: 'fa-building', labelKey: 'admin_sidebar_properties', fallback: 'Fastigheter' },
    { key: 'users', href: 'users.html', icon: 'fa-users', labelKey: 'admin_sidebar_users', fallback: 'Användare' },
    { key: 'review_queue', href: 'review_queue.html', icon: 'fa-clipboard-check', labelKey: 'admin_sidebar_review_queue', fallback: 'Granska annonser' },
    { key: 'viewings', href: 'viewings.html', icon: 'fa-calendar-check', labelKey: 'admin_sidebar_viewings', fallback: 'Visningar' },
    { key: 'messages', href: 'messages.html', icon: 'fa-envelope', labelKey: 'admin_sidebar_messages', fallback: 'Meddelanden' },
    { key: 'support', href: 'support.html', icon: 'fa-life-ring', labelKey: 'admin_sidebar_support', fallback: 'Support' },
    { key: 'media_health', href: 'media_health.html', icon: 'fa-hard-drive', labelKey: 'admin_sidebar_media_health', fallback: 'Media health' },
    { key: 'settings', href: 'settings.html', icon: 'fa-sliders-h', labelKey: 'admin_sidebar_settings', fallback: 'Inställningar' },
    { key: 'site_controls', href: 'site_controls.html', icon: 'fa-sitemap', labelKey: 'admin_sidebar_site_controls', fallback: 'Sidstyrning' },
    { key: 'audit_log', href: 'audit_log.html', icon: 'fa-shield-alt', labelKey: 'admin_sidebar_audit_log', fallback: 'Audit-logg' },
    { key: 'logout', href: '../auth/login.html', icon: 'fa-sign-out-alt', labelKey: 'common_logout', fallback: 'Logga ut', kind: 'logout' },
  ];

  const PUBLIC_MAIN_ITEMS = [
    { key: 'home', path: pathFor('public', 'home.html'), labelKey: 'nav_home', fallback: 'Hem' },
    { key: 'properties', path: pathFor('public', 'properties.html'), labelKey: 'nav_properties', fallback: 'Bostäder' },
    { key: 'areas', path: pathFor('public', 'areas.html'), labelKey: 'nav_areas', fallback: 'Områden' },
    { key: 'about', path: pathFor('public', 'about.html'), labelKey: 'nav_about', fallback: 'Om oss' },
    { key: 'contact', path: pathFor('public', 'contact.html'), labelKey: 'nav_contact', fallback: 'Kontakt' },
  ];

  window.RimalisMenuConfig = {
    getUserItems: function getUserItems() {
      return USER_ITEMS.slice();
    },
    getAdminItems: function getAdminItems() {
      return ADMIN_ITEMS.slice();
    },
    getPublicMainItems: function getPublicMainItems() {
      return PUBLIC_MAIN_ITEMS.slice();
    },
  };
})();
