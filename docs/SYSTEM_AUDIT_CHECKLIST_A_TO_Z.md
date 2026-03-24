# System Audit Checklist (A-Ö)

## 1) Backend runtime
- Start backend: `npm --prefix backend run dev`
- Check health: `curl -sS http://localhost:8080/health`
- Verify `/api` root and key endpoints respond.

## 2) Backend quality gates
- Syntax check: `npm --prefix backend run check`
- Unit tests: `npm --prefix backend run test`
- i18n lint: `npm --prefix backend run lint:i18n`
- Link check: `npm --prefix backend run check:links`

## 3) Security baseline
- Confirm helmet + CSP enabled in backend config.
- Confirm rate limits exist for auth/upload/admin sensitive routes.
- Confirm CORS is environment-restricted (not wildcard in prod).
- Confirm all POST/PUT/PATCH routes have zod validation.
- Confirm no unescaped `innerHTML` for user-controlled values in frontend JS.

## 4) Auth/Session
- Login (user/admin) works.
- Admin 2FA flow works.
- Refresh token flow works.
- Logout invalidates session.

## 5) Public frontend
- Home, properties, areas, about, contact, policy pages load.
- Language switch works without full reload where expected.
- Search/filter renders API data correctly.
- Property detail (`property-modal.html?id=...`) renders real DB data.

## 6) User frontend
- Dashboard/favorites/my listings/messages/profile load.
- Create listing step1->step2->step3->submit works.
- Listing reference format shown as `RG8-XXXX`.
- Favorites/messages/bookings show DB-backed state.

## 7) Admin frontend
- Dashboard/properties/users/review/messages/settings load.
- Site controls save/reload/restore/preview token buttons work.
- Review queue approve/reject/request-change works.
- Viewings page filters + CSV export work.

## 8) Data integrity
- Approved listing appears in public listings and detail pages.
- Delete/soft-delete behavior matches expectations.
- No hardcoded fallback should overwrite DB values.

## 9) Media
- Upload accepts expected formats/sizes only.
- Images are compressed/transformed at upload.
- Gallery/hero images lazy-load where applicable.
- Long images/floorplans are readable in gallery and lightbox.

## 10) Messaging & bookings
- Property contact form creates message thread.
- Agent/admin can reply; user can read/reply.
- Booking slots can be added/removed (agent/admin) and booked by logged-in users.
- Double-booking and invalid slot booking are blocked.

## 11) Observability
- Audit logs contain user, action, method, path, ip, outcome.
- Error logs are structured and actionable.

## 12) Release decision
- Green: all gates pass, no P0/P1 issues.
- Yellow: only minor UI polish left.
- Red: any security or data-integrity issue unresolved.

