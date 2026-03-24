const { v4: uuid } = require('uuid');
const crypto = require('node:crypto');
const { query, pool } = require('../src/db/client');
const { hashPassword } = require('../src/common/utils/password');
const { ROLES } = require('../src/common/constants/roles');

function isProduction() {
  return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
}

function strongRandomPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

function requiredSeedValue(name, value) {
  const v = String(value || '').trim();
  if (v) return v;
  throw new Error(`${name} must be set when seeding in production`);
}

async function run() {
  try {
    const seedDemoProperties = process.env.SEED_DEMO_PROPERTIES === 'true';
    const adminEmail = String(process.env.ADMIN_SEED_EMAIL || 'admin@rimalis.se').trim().toLowerCase();
    const userEmail = String(process.env.USER_SEED_EMAIL || 'user@rimalis.se').trim().toLowerCase();

    const adminPassword = isProduction()
      ? requiredSeedValue('ADMIN_SEED_PASSWORD', process.env.ADMIN_SEED_PASSWORD)
      : String(process.env.ADMIN_SEED_PASSWORD || strongRandomPassword()).trim();
    const userPassword = isProduction()
      ? requiredSeedValue('USER_SEED_PASSWORD', process.env.USER_SEED_PASSWORD)
      : String(process.env.USER_SEED_PASSWORD || strongRandomPassword()).trim();

    const adminHash = await hashPassword(adminPassword);
    const userHash = await hashPassword(userPassword);

    await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         updated_at = NOW()`,
      [uuid(), 'Admin Rimalis Group', adminEmail, adminHash, ROLES.ADMIN]
    );

    const userRes = await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         updated_at = NOW()
       RETURNING id`,
      [uuid(), 'User One', userEmail, userHash, ROLES.USER]
    );
    const userId = userRes.rows?.[0]?.id;

    if (seedDemoProperties) {
      const properties = [
        ['objekt-1', 'Objekt 1', 'Stockholm', 24500000, 'published'],
        ['objekt-2', 'Objekt 2', 'Stockholm', 19200000, 'pending'],
        ['objekt-3', 'Objekt 3', 'Stockholm', 31000000, 'draft'],
      ];

      for (const [id, title, location, price, status] of properties) {
        await query(
          `INSERT INTO properties (id, title, location, price, status, owner_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id)
           DO UPDATE SET
             title = EXCLUDED.title,
             location = EXCLUDED.location,
             price = EXCLUDED.price,
             status = EXCLUDED.status,
             owner_id = EXCLUDED.owner_id,
             updated_at = NOW()`,
          [id, title, location, price, status, userId]
        );
      }

      const { rows } = await query('SELECT id FROM reviews WHERE property_id = $1 LIMIT 1', ['objekt-2']);
      if (rows.length === 0) {
        await query(
          'INSERT INTO reviews (id, property_id, status) VALUES ($1, $2, $3)',
          [uuid(), 'objekt-2', 'pending']
        );
      }
    }

    if (userId) {
      const bookingRows = await query(
        'SELECT id FROM bookings WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (!bookingRows.rows.length && seedDemoProperties) {
        await query(
          `INSERT INTO bookings (id, user_id, property_id, scheduled_at, status)
           VALUES ($1, $2, $3, NOW() + INTERVAL '3 days', 'booked')`,
          [uuid(), userId, 'objekt-1']
        );
      }

      const searchRows = await query(
        'SELECT id FROM saved_searches WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (!searchRows.rows.length) {
        await query(
          `INSERT INTO saved_searches (id, user_id, name, criteria)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [uuid(), userId, 'Stockholm premium', JSON.stringify({ city: 'Stockholm', minPrice: 10000000 })]
        );
      }

    }

    await query('INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');

    const lines = [];
    lines.push(`Seed complete${seedDemoProperties ? ' (with demo properties)' : ' (without demo properties)'}`);
    lines.push(`Admin: ${adminEmail}`);
    lines.push(`User:  ${userEmail}`);
    if (!isProduction()) {
      lines.push('');
      lines.push('Generated seed passwords (development only):');
      if (!process.env.ADMIN_SEED_PASSWORD) lines.push(`- ADMIN_SEED_PASSWORD=${adminPassword}`);
      if (!process.env.USER_SEED_PASSWORD) lines.push(`- USER_SEED_PASSWORD=${userPassword}`);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  } catch (err) {
    const msg = err?.message || err?.detail || err?.code || JSON.stringify(err);
    process.stderr.write(`Seed failed: ${msg}\n`);
    if (err?.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
