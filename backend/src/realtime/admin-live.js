const { WebSocketServer } = require('ws');
const { verifyAccessToken } = require('../common/utils/token');
const { logInfo, logError } = require('../common/utils/logger');

let wss = null;
const clients = new Set();

function parseTokenFromRequest(req) {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    return String(url.searchParams.get('token') || '').trim();
  } catch (_err) {
    return '';
  }
}

function isAdminPayload(payload) {
  return payload && String(payload.role || '').toLowerCase() === 'admin';
}

function send(ws, message) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(message));
  } catch (_err) {
    // ignore send errors
  }
}

function broadcastAdminEvent(type, payload = {}) {
  const message = {
    type: String(type || 'event'),
    payload: payload || {},
    ts: new Date().toISOString(),
  };

  for (const ws of clients) {
    send(ws, message);
  }
}

function setupAdminLive(server) {
  if (wss) return;

  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url?.startsWith('/ws/admin-live')) return;

    const token = parseTokenFromRequest(req);
    let user = null;
    try {
      const payload = verifyAccessToken(token);
      if (!isAdminPayload(payload)) throw new Error('forbidden');
      user = { id: payload.sub, role: payload.role, email: payload.email || null };
    } catch (_err) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.user = user;
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    send(ws, { type: 'connected', payload: { ok: true }, ts: new Date().toISOString() });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });

    ws.on('message', () => {
      // currently one-way server -> admin clients
    });
  });

  logInfo('admin.live.websocket.started', { path: '/ws/admin-live' });
}

module.exports = {
  setupAdminLive,
  broadcastAdminEvent,
};
