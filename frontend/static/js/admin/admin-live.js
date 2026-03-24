(function () {
  let ws = null;
  let reconnectTimer = null;
  const listeners = new Set();

  function buildUrl() {
    const token = window.RimalisAPI?.getAccessToken?.();
    if (!token) return null;

    const apiBase = window.RimalisAPI?.API_BASE || `${window.location.origin}/api`;
    const base = apiBase.replace(/\/api\/?$/, '');
    const wsBase = base.startsWith('https://')
      ? base.replace(/^https:/, 'wss:')
      : base.replace(/^http:/, 'ws:');
    return `${wsBase}/ws/admin-live?token=${encodeURIComponent(token)}`;
  }

  function emit(event) {
    listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (_err) {
        // noop
      }
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 2000);
  }

  function connect() {
    const url = buildUrl();
    if (!url) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket(url);
    } catch (_err) {
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', () => {
      emit({ type: 'socket.open', payload: {} });
    });

    ws.addEventListener('message', (event) => {
      try {
        const body = JSON.parse(event.data || '{}');
        emit(body);
      } catch (_err) {
        // ignore malformed packets
      }
    });

    ws.addEventListener('close', () => {
      emit({ type: 'socket.close', payload: {} });
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      emit({ type: 'socket.error', payload: {} });
      try {
        ws.close();
      } catch (_err) {
        // noop
      }
    });
  }

  function onEvent(handler) {
    if (typeof handler !== 'function') return () => {};
    listeners.add(handler);
    return () => listeners.delete(handler);
  }

  function init() {
    if (!window.RimalisAPI) return;
    connect();
  }

  document.addEventListener('DOMContentLoaded', init);

  window.AdminLive = {
    onEvent,
    reconnect: connect,
  };
})();
