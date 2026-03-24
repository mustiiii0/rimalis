(function () {
  function i18n(key) {
    return window.RimalisI18n?.t?.(key, key) || key;
  }

  function pagePath() {
    return window.location.pathname || '';
  }

  function templatePath(section, file) {
    return `../${section}/${file}`;
  }

  function patchLogoutFunction() {
    window.logout = async function logout() {
      const ok = window.confirm(i18n('common_confirm_logout'));
      if (!ok) return;
      window.RimalisAPI.writeAuthDebug?.('manual_logout', { confirmed: true });
      await window.RimalisAPI.logout();
      window.location.href = templatePath('public', 'home.html');
    };
  }

  function safeAvatarUrl(url) {
    const fallback = '/static/image/avatar-placeholder.svg';
    if (typeof url !== 'string') return fallback;
    const trimmed = url.trim();
    if (!trimmed) return fallback;
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('/static/uploads/') ||
      trimmed.startsWith('/uploads/') ||
      trimmed.startsWith('data:image/')
    ) {
      return trimmed;
    }
    return fallback;
  }

  function hydrateUserSidebar(user) {
    if (!user) return;

    const headingEls = document.querySelectorAll('#userSidebarName, #userProfileSidebarName');
    const emailEls = document.querySelectorAll('#userSidebarEmail, #userProfileSidebarEmail');
    const avatarEls = document.querySelectorAll('#userSidebarAvatar, #userProfileAvatarPreview, #userProfileSidebarAvatar');

    headingEls.forEach((el) => {
      if (user.name) el.textContent = user.name;
    });
    emailEls.forEach((el) => {
      if (user.email) el.textContent = user.email;
    });
    avatarEls.forEach((el) => {
      if (el instanceof HTMLImageElement) {
        el.src = safeAvatarUrl(user.avatarUrl);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.RimalisAPI) return;

    (async function initPageGuards() {
      const path = pagePath();

      if (path.includes('/templates/admin/')) {
        if (!window.RimalisAPI.requireAuthPage()) return;

        try {
          const me = await window.RimalisAPI.request('/users/me', { auth: true });
          const role = (me?.user?.role || '').toLowerCase();
          if (role !== 'admin') {
            window.RimalisAPI.writeAuthDebug?.('admin_guard_redirect', { reason: 'role_mismatch', role });
            await window.RimalisAPI.logout();
            window.location.href = templatePath('auth', 'login.html');
            return;
          }
        } catch (_err) {
          window.RimalisAPI.writeAuthDebug?.('admin_guard_redirect', { reason: 'me_request_failed' });
          await window.RimalisAPI.logout();
          window.location.href = templatePath('auth', 'login.html');
          return;
        }

        patchLogoutFunction();
        return;
      }

      if (path.includes('/templates/user/') || path.includes('/templates/mobile/user/')) {
        if (!window.RimalisAPI.requireAuthPage()) return;
        patchLogoutFunction();
        const cachedUser = window.RimalisAPI.getUser();
        hydrateUserSidebar(cachedUser);

        try {
          const me = await window.RimalisAPI.request('/users/me', { auth: true });
          const current = window.RimalisAPI.getUser() || {};
          const nextUser = { ...current, ...(me?.user || {}) };
          window.RimalisAPI.setSession({
            accessToken: window.RimalisAPI.getAccessToken(),
            refreshToken: window.RimalisAPI.getRefreshToken(),
            user: nextUser,
          });
          hydrateUserSidebar(nextUser);
        } catch (_err) {
          // fallback to cached session values
        }
      }
    })();
  });
})();
