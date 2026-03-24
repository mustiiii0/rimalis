(function () {
  const ACCESS_TOKEN_KEY = 'rimalis_access_token';
  const LEGACY_ACCESS_TOKEN_KEY = 'rimalis_access_token';
  const REFRESH_TOKEN_KEY = 'rimalis_refresh_token';
  const LEGACY_REFRESH_TOKEN_KEY = 'rimalis_refresh_token';
  const USER_KEY = 'rimalis_user';
  const LEGACY_USER_KEY = 'rimalis_user';
  const AUTH_DEBUG_KEY = 'rimalis_auth_debug_log';
  let refreshInFlight = null;

  const origin = window.location && window.location.origin ? window.location.origin : '';
  const inferredApiBase =
    origin && origin.includes(':8000')
      ? 'http://localhost:8080/api'
      : origin
        ? `${origin}/api`
        : 'http://localhost:8080/api';
  const API_BASE = window.RIMALIS_API_BASE || inferredApiBase;

  function getCookie(name) {
    const target = `${name}=`;
    const cookies = String(document.cookie || '').split(';');
    for (const part of cookies) {
      const trimmed = part.trim();
      if (trimmed.startsWith(target)) {
        return decodeURIComponent(trimmed.slice(target.length));
      }
    }
    return '';
  }

  function writeAuthDebug(event, details = {}) {
    try {
      const existing = readJson(AUTH_DEBUG_KEY, []);
      const next = Array.isArray(existing) ? existing.slice(-39) : [];
      next.push({
        at: new Date().toISOString(),
        page: window.location.pathname || '',
        event,
        details,
      });
      localStorage.setItem(AUTH_DEBUG_KEY, JSON.stringify(next));
    } catch (_err) {
      // ignore debug logging failures
    }
  }

  function migrateLegacySessionKeys() {
    if (LEGACY_ACCESS_TOKEN_KEY !== ACCESS_TOKEN_KEY) {
      const oldAccess = localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
      if (oldAccess && !localStorage.getItem(ACCESS_TOKEN_KEY)) {
        localStorage.setItem(ACCESS_TOKEN_KEY, oldAccess);
      }
      localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    }

    if (LEGACY_REFRESH_TOKEN_KEY !== REFRESH_TOKEN_KEY) {
      const oldRefresh = localStorage.getItem(LEGACY_REFRESH_TOKEN_KEY);
      if (oldRefresh && !localStorage.getItem(REFRESH_TOKEN_KEY)) {
        localStorage.setItem(REFRESH_TOKEN_KEY, oldRefresh);
      }
      localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    }

    if (LEGACY_USER_KEY !== USER_KEY) {
      const oldUser = localStorage.getItem(LEGACY_USER_KEY);
      if (oldUser && !localStorage.getItem(USER_KEY)) {
        localStorage.setItem(USER_KEY, oldUser);
      }
      localStorage.removeItem(LEGACY_USER_KEY);
    }
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_err) {
      return fallback;
    }
  }

  function getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
  }

  function getUser() {
    return readJson(USER_KEY, null);
  }

  function setSession(payload) {
    if (!payload) return;
    if (payload.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    if (payload.user) localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }

  function clearSession() {
    writeAuthDebug('clear_session', {
      hasAccessToken: Boolean(getAccessToken()),
      hasRefreshToken: Boolean(getRefreshToken()),
      hasUser: Boolean(getUser()),
    });
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
  }

  async function refreshAccessToken() {
    if (refreshInFlight) {
      writeAuthDebug('refresh_joined_existing', {});
      return refreshInFlight;
    }

    const csrfToken = getCookie('rimalis_csrf_token');
    writeAuthDebug('refresh_attempt', { hasRefreshCookie: Boolean(getCookie('rimalis_refresh_token')) });

    refreshInFlight = (async function () {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({}),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success === false) {
        writeAuthDebug('refresh_failed', {
          status: response.status,
          message: body.message || 'Session expired',
        });
        clearSession();
        throw new Error(body.message || 'Session expired');
      }

      writeAuthDebug('refresh_succeeded', { status: response.status });
      setSession({ accessToken: body.accessToken, user: body.user });
      return body.accessToken;
    })();

    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  }

  async function request(path, options = {}, retry = true) {
    const url = `${API_BASE}${path}`;
    const headers = { ...(options.headers || {}) };
    const optionalAuth = Boolean(options.optionalAuth);

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    headers['X-Requested-With'] = headers['X-Requested-With'] || 'XMLHttpRequest';
    const csrfToken = getCookie('rimalis_csrf_token');
    if (csrfToken && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    if (options.auth) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body,
      credentials: 'include',
    });

    const body = await response.json().catch(() => ({}));

    if (response.status === 401 && options.auth && retry) {
      writeAuthDebug('request_401', {
        path,
        method: options.method || 'GET',
        optionalAuth,
      });
      try {
        await refreshAccessToken();
        return request(path, options, false);
      } catch (_err) {
        if (!optionalAuth) {
          clearSession();
        }
      }
    }

    if (!response.ok || body.success === false) {
      const err = new Error(body.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.body = body;
      throw err;
    }

    return body;
  }

  function authHeader() {
    const token = getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function requireAuthPage() {
    if (!getAccessToken()) {
      writeAuthDebug('require_auth_redirect', {
        target: '../auth/login.html',
        reason: 'missing_access_token',
      });
      window.location.href = '../auth/login.html';
      return false;
    }
    return true;
  }

  function requireAdminPage() {
    const user = getUser();
    if (!user || user.role !== 'admin') {
      writeAuthDebug('require_admin_redirect', {
        target: '../auth/login.html',
        role: user?.role || null,
      });
      window.location.href = '../auth/login.html';
      return false;
    }
    return true;
  }

  async function logout() {
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    } catch (_err) {
      // ignore
    }
    clearSession();
  }

  migrateLegacySessionKeys();

  const api = {
    API_BASE,
    request,
    authHeader,
    getAccessToken,
    getRefreshToken,
    getUser,
    setSession,
    clearSession,
    refreshAccessToken,
    requireAuthPage,
    requireAdminPage,
    logout,
    writeAuthDebug,
  };

  window.RimalisAPI = api;
})();
