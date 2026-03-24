const { v4: uuid } = require('uuid');
const { query } = require('../../db/client');
const { logInfo, logError } = require('./logger');
const { env } = require('../../config/env');

function logSecurityEvent(req, event) {
  const payload = {
    eventType: event.eventType,
    severity: event.severity || 'info',
    userId: event.userId || req?.user?.id || null,
    requestId: req?.requestId || null,
    ipAddress: req?.ip || null,
    method: req?.method || null,
    path: req?.originalUrl || null,
    userAgent: req?.headers?.['user-agent'] || null,
    metadata: event.metadata || {},
  };

  logInfo('Security event', payload);

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  // Best-effort write; never break request flow if audit persistence fails.
  query(
    `INSERT INTO security_events
      (id, event_type, severity, user_id, request_id, ip_address, method, path, user_agent, metadata)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [
      uuid(),
      payload.eventType,
      payload.severity,
      payload.userId,
      payload.requestId,
      payload.ipAddress,
      payload.method,
      payload.path,
      payload.userAgent,
      JSON.stringify(payload.metadata),
    ]
  ).catch((err) => {
    logError('Failed to persist security event', {
      requestId: payload.requestId,
      eventType: payload.eventType,
      error: err.message,
    });
  });

  if (env.securityAlertWebhook && payload.severity === 'critical') {
    fetch(env.securityAlertWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Rimalis Group security alert: ${payload.eventType}`,
        event: payload,
      }),
    }).catch((err) => {
      logError('Failed to send security alert webhook', {
        requestId: payload.requestId,
        eventType: payload.eventType,
        error: err.message,
      });
    });
  }
}

module.exports = { logSecurityEvent };
