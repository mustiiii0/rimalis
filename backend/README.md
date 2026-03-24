# Rimalis Group Backend

Backend is built with Express and a modular structure for `public`, `auth`, `user`, and `admin` domains.

## Structure

```text
backend/
  src/
    app.js
    server.js
    config/
    common/
      middleware/
      utils/
      errors/
      validators/
      constants/
    modules/
      auth/
      users/
      admin/
      public/
      properties/
      messages/
      favorites/
      reviews/
    routes/
    db/
```

## Security included

- `helmet` for secure headers
- CORS allow-list (`CORS_ORIGIN`)
- `express-rate-limit` for API and auth endpoints
- JWT access/refresh token flow
- HttpOnly refresh cookie flow for rotation/logout
- Role-based access control (`requireRole`)
- Zod schema validation middleware
- Centralized error handling
- Request ID for tracing
- Audit middleware for admin actions
- Security events persistence (`security_events`) + optional webhook alerts

Detailed production hardening: `docs/PRODUCTION_SECURITY.md`

## Setup

1. Install dependencies:

```bash
cd backend
npm install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Run database migrations and seed:

```bash
npm run migrate
npm run seed
```

4. Start in development:

```bash
npm run dev
```

Or production:

```bash
npm start
```

## Scripts

- `npm run dev` - start with nodemon
- `npm start` - start with node
- `npm run check` - syntax check all JS files
- `npm run migrate` - run SQL migrations
- `npm run seed` - seed admin user and sample data
- `npm run migrate:seed` - run migrations + seed
- `npm test` - run API security tests

## API base

- Health: `GET /health`
- Public: `/api/public/*`
- Auth: `/api/auth/*`
- Users: `/api/users/*`
- Admin: `/api/admin/*`
- Properties: `/api/properties/*`
- Messages: `/api/messages/*`
- Favorites: `/api/favorites/*`
- Reviews: `/api/reviews/*`

## Seeded users

- Admin email: `ADMIN_SEED_EMAIL` (default `admin@rimalis.se`)
- User email: `USER_SEED_EMAIL` (default `user@rimalis.se`)
- Development: if `ADMIN_SEED_PASSWORD` / `USER_SEED_PASSWORD` are unset, `npm run seed` generates strong passwords and prints them once.
- Production: `ADMIN_SEED_PASSWORD` and `USER_SEED_PASSWORD` must be set (the seed script refuses to run otherwise).

## Database

- PostgreSQL via `DATABASE_URL`
- SQL migrations in `src/db/migrations`
