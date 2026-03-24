# Rimalis Group Production Security Guide

This guide covers deployment hardening for reverse proxy, TLS, WAF, logging, and monitoring.

## 1) Required Environment

Set these in production:

- `NODE_ENV=production`
- `TRUST_PROXY=true`
- `JWT_ACCESS_SECRET` with at least 32 chars
- `JWT_REFRESH_SECRET` with at least 32 chars
- `CORS_ORIGIN=https://your-frontend-domain`
- `SECURITY_ALERT_WEBHOOK` (optional, Slack/SIEM endpoint)

## 2) Reverse Proxy (Nginx)

Use Nginx in front of Node:

```nginx
server {
    listen 80;
    server_name api.rimalis.group.se;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.rimalis.group.se;

    ssl_certificate /etc/letsencrypt/live/api.rimalis.group.se/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.rimalis.group.se/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 3) WAF / Edge Protection

Recommended:

- Cloudflare or AWS WAF in front of Nginx
- Enable managed rules for:
  - SQL Injection
  - XSS
  - Path traversal
  - Known bot abuse
- Add per-IP rate limits at edge for `/api/auth/*`

## 4) TLS and Cookies

- Keep TLS termination at edge/reverse proxy
- Refresh token cookie is `httpOnly`; keep `secure` enabled in production
- Keep `SameSite=Lax` unless cross-site architecture requires stricter handling

## 5) Security Logging and Alerts

Backend writes security events to `security_events` table and JSON logs.

Critical events can be forwarded via `SECURITY_ALERT_WEBHOOK`:

- `request.server_error`
- Other critical severity events

Monitor:

- auth failures (`auth.invalid_token`, `auth.missing_token`)
- CSRF blocks (`csrf.blocked`)
- rate limits (`rate_limit.api`, `rate_limit.auth`)
- admin action trail (`admin.*`)

## 6) Database Security

- Use dedicated DB user with least privilege
- Block direct DB exposure to internet
- Enable automatic backups and PITR if available
- Rotate DB credentials regularly

## 7) Operational Checklist

- Run migrations before deployment: `npm run migrate`
- Health check endpoint: `GET /health`
- Keep dependencies patched (`npm audit`, scheduled updates)
- Keep log retention and incident review cadence

## 8) Incident Response (Minimum)

If suspicious activity is detected:

1. Revoke refresh tokens for affected users
2. Rotate JWT secrets if compromise suspected
3. Review `security_events` around incident window
4. Block attacking IP/range at WAF
5. Document incident and corrective actions
