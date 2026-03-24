# Security Review 2026-03-14

Repository: `/Users/musti/Desktop/side`

## Summary

The system has a solid baseline with `helmet`, CORS allow-listing, JWT auth, hashed refresh tokens, request validation, role checks, and rate limiting. It is not yet "fully secure", but the most immediate auth/session weakness has been improved in this pass.

Implemented in this review:

- Replaced header-only pseudo-CSRF validation with double-submit CSRF validation using a cookie plus `X-CSRF-Token` header.
- Stopped accepting refresh tokens from request bodies in backend auth controllers.
- Updated the frontend API client to rely on the `HttpOnly` refresh cookie for refresh/logout flows instead of sending refresh tokens from browser storage.
- Removed the remaining direct `innerHTML`/`insertAdjacentHTML` render paths from `property-modal.js` by converting gallery controls, booking actions, similar listings, skeleton states, and viewing slots to DOM node construction.
- Hardened production CSP to use nonce-based `script-src` for `<script>` elements, automatic nonce injection for served HTML templates, `script-src-attr 'none'`, and a tightened `style-src` without `'unsafe-inline'` after removing inline executable code and inline styles.
- Removed inline `onclick` handlers from the main desktop public pages (`home`, `properties`, `areas`, `about`, `contact`) by moving them to `data-*` hooks and JS event listeners.
- Removed inline `onclick` handlers and inline page scripts from the main mobile public pages (`home`, `areas`, `about`, `contact`) by moving them to `data-*` hooks and external JS handlers.
- Removed inline event handlers from the main auth/user templates (logout links, back buttons, upload triggers, favorites clear action) and moved mobile register/profile helper scripts out of the templates.
- Removed inline event handlers from both desktop and mobile `property-modal` templates by routing actions through shared `data-*` hooks in the public modal layer.
- Reduced frontend DOM XSS exposure in create-listing flows by replacing address suggestion rendering and preview-detail rendering with DOM node construction in desktop/mobile create-listing scripts.
- Reduced additional frontend DOM XSS exposure in the mobile properties feed, language selector, profile badge, and chat typing indicator by replacing direct HTML assignment with DOM node construction in their render paths.
- Reduced mobile chat XSS exposure by replacing booking-card, empty-state, and new-chat contact rendering in `mobile/user/messages.js` with DOM node construction.
- Reduced mobile profile, favorites, and my-listings XSS exposure by replacing recent-favorites cards, favorite listing cards, listing metadata, and action icons with DOM node construction.
- Restricted the translation layer so HTML rendering in `i18n.js` is now limited to an explicit allowlist of audited keys used by hero/legal/auth content, instead of being available to any `data-i18n-html` usage.
- Added a regression test in `backend/src/tests/security-hardening.test.js` that scans templates and frontend scripts for reintroduced inline handlers, `javascript:` URLs, and non-allowlisted direct HTML sinks.
- Hardened production env validation in `backend/src/config/env.js` so weak/default JWT secrets and missing `TRUST_PROXY=true` now fail fast instead of allowing an insecure production boot.
- Added auth cookie regression tests and updated cookie option helpers in `backend/src/modules/auth/auth.controller.js` so production `secure`/`sameSite` behavior is verified and no longer depends on a stale module-load environment snapshot.
- Added rate limiting for signed media URL generation and hardened multipart upload handling so oversized, extra-file, and excess-part upload requests are normalized and rejected predictably.
- Fixed a public property exposure issue by ensuring `GET /api/properties/:id` only resolves published, non-deleted listings instead of returning any non-deleted listing by ID.
- Fixed a public viewing exposure issue by requiring the underlying property to be published before public slot listing or booking is allowed.
- Tightened public message reply handling by validating public reply tokens as UUIDs and applying a dedicated rate limit to public message/reply endpoints.
- Added fail-fast production validation for signed media and R2 storage so weak media secrets, insecure R2 endpoints, and insecure public media bases are rejected before boot.

Verification:

- `node --check frontend/static/js/shared/api.js`
- `node --check backend/src/modules/auth/auth.controller.js`
- `node --check backend/src/common/middleware/csrf.js`
- `node --test backend/src/tests/security-hardening.test.js backend/src/tests/auth-admin-security.test.js`

## Findings

### [Addressed] Weak CSRF protection

- File: `/Users/musti/Desktop/side/backend/src/common/middleware/csrf.js`
- Previous behavior: requests were accepted when `X-Requested-With: XMLHttpRequest` was present.
- Risk: this is not a real CSRF defense for cookie-authenticated flows and is weaker than a token-based approach.
- Fix: the middleware now requires both `X-Requested-With: XMLHttpRequest` and a matching CSRF header/cookie pair.

### [Addressed] Refresh token could be supplied from browser-controlled request body

- File: `/Users/musti/Desktop/side/backend/src/modules/auth/auth.controller.js`
- Previous behavior: refresh/logout accepted the refresh token from cookies or `req.body.refreshToken`.
- Risk: this unnecessarily widened the attack surface and encouraged frontend handling of refresh tokens.
- Fix: refresh/logout now read refresh tokens only from cookies.

### [Addressed] Frontend refresh flow relied on browser storage for refresh tokens

- File: `/Users/musti/Desktop/side/frontend/static/js/shared/api.js`
- Previous behavior: the client stored refresh tokens in `localStorage` and sent them in the refresh/logout request body.
- Risk: XSS exposure of long-lived tokens and weaker session containment.
- Fix: the client now removes refresh tokens from storage and relies on the `HttpOnly` cookie for refresh/logout.

### [Addressed] Production CSP no longer depends on inline script/style allowances

- Files:
  - `/Users/musti/Desktop/side/backend/src/config/security.js`
  - `/Users/musti/Desktop/side/backend/src/app.js`
- Previous behavior: production CSP depended on inline compatibility through global `'unsafe-inline'` allowances.
- Fix: production now uses nonce-based `script-src`, injects matching nonces into served HTML `<script>` tags, sets `script-src-attr 'none'`, and removes `'unsafe-inline'` from `style-src` after migrating inline handlers/styles out of templates and frontend JS.
- Residual risk: CSP is much stronger now, but future template or JS regressions could silently weaken it unless tests and code review keep guarding inline patterns.

### [Partially addressed] Translation-layer HTML is now narrowly allowlisted

- File:
  - `/Users/musti/Desktop/side/frontend/static/js/public/i18n.js`
- Previous behavior: any element using `data-i18n-html` could receive translated HTML through the generic i18n layer.
- Fix: translated HTML is now limited to an explicit allowlist of audited keys for hero highlights, auth legal copy, and legal-page rich content; other keys fall back to text rendering.
- Residual risk: the allowlisted legal/auth rich-text keys still rely on trusted translation content, so if translation sources ever become untrusted, this remains an XSS boundary that should be protected with sanitization or a structured rich-text format.

### [Addressed] Property modal DOM rendering surface removed from direct HTML sinks

- File: `/Users/musti/Desktop/side/frontend/static/js/public/property-modal.js`
- Previous behavior: the file used multiple direct HTML sinks for similar listings, viewing slots, load/error states, gallery controls, detail grids, and booking button states.
- Fix: these paths now build UI with DOM APIs and shared button-loading helpers instead of direct HTML assignment.

### [Open] Development secrets/defaults still exist in repo-local env

- Files:
  - `/Users/musti/Desktop/side/backend/src/config/env.js`
  - `/Users/musti/Desktop/side/backend/.env`
- Risk: accidental reuse of weak secrets outside intended local development.
- Recommendation: rotate secrets per environment, keep local defaults non-production only, and enforce deployment checks outside app code as well.

## Next recommended work

1. Audit the remaining high-risk `innerHTML` sinks outside `property-modal` and create-listing flows.
2. Review auth/session lifetime, logout semantics, and add runtime checks around cookie flags in real deployment.
3. Add lightweight regression checks for inline markup patterns in CI so CSP stays strict over time.

## Production Verification

A runnable production readiness check is now available in `/Users/musti/Desktop/side/backend/scripts/check-production-readiness.js`.

Run it with:

- `npm --prefix backend run check:production`
- optionally set `PRODUCTION_BASE_URL=https://your-domain.example` to probe `/health` and response security headers

It verifies:

- production env mode and proxy expectations
- strong JWT and signed-media secrets
- storage driver and R2 completeness/HTTPS
- signed media base URL safety
- optional remote header presence on the live deployment
