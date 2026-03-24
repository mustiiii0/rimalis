# System Audit Report (2026-03-07)

## Scope
- Backend + frontend audit across public, user, and admin flows.
- Security, correctness, data integrity, and UX error handling.

## Executed checks
- `npm --prefix backend run check` ✅
- `npm --prefix backend run test` ✅ (11/11)
- `npm --prefix backend run lint:i18n` ✅

## Changes applied in this audit pass
1. XSS hardening in notification rendering:
   - `frontend/static/js/public/main.js`
   - Replaced `innerHTML` with `textContent` in toast notification.
2. XSS hardening in chat rendering:
   - `frontend/static/js/public/chat.js`
   - Replaced dynamic `innerHTML` message injection with safe DOM `textContent`.
   - Rebuilt typing indicator DOM without HTML string interpolation.
3. Site controls UX stability:
   - `frontend/static/js/admin/site-controls.js`
   - Changed versions/audit history loading to `Promise.allSettled` and fail only when both calls fail.
   - Prevents false `Internal server error` toast after successful save when one non-critical history request fails.

## Current status
- Core system is operational.
- Admin site-controls save path is functioning.
- Security posture improved by removing known client-side injection points above.

## Remaining priorities (next pass)
1. Remove/replace remaining risky `innerHTML` usage across all frontend scripts.
2. Move session storage away from `localStorage` to stricter cookie-first session design for higher XSS resilience.
3. Tighten CSP in production (reduce/avoid `unsafe-inline`).
4. Add full E2E regression flow for:
   - create listing -> admin review approve -> public visibility
   - message thread reply loop
   - booking slot create/book/cancel.

## Release recommendation
- **Yellow**: acceptable for continued staging/testing.
- **Not green for production** until the remaining security priorities above are closed.

