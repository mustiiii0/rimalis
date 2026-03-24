# Cloudflare R2 Lifecycle (Recommended)

Use this together with app-side orphan cleanup (`cleanup:uploads`) for best control.

## Suggested rules

- `uploads/tmp/`: delete after 7 days
- `uploads/previews/`: delete after 30 days
- `uploads/images/`: do **not** hard-delete globally by age unless you separate archival prefixes

Reference config file:
- `backend/docs/r2-lifecycle-rules.json`

## Why both lifecycle + app cleanup?

- Lifecycle is perfect for temporary prefixes.
- App cleanup knows which files are still referenced in DB and safely removes only orphan objects.

## Apply in Cloudflare dashboard

1. Open R2 bucket.
2. Go to Lifecycle rules.
3. Add rules matching the prefixes above.
4. Keep production listing images managed by app cleanup unless you have explicit archive prefixes.

## Daily cleanup recommendation

- Enable server cron via env:
  - `MEDIA_CLEANUP_CRON_ENABLED=true`
  - `MEDIA_CLEANUP_CRON_TIME=03:20`
  - `MEDIA_CLEANUP_OLDER_THAN_DAYS=30`
- Or run externally (system cron / CI) with:
  - `npm --prefix backend run cleanup:uploads -- --apply --days=30 --prefix=uploads/images/`
  - install local cron helper: `npm --prefix backend run cleanup:cron:install`
