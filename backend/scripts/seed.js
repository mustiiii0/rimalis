const { v4: uuid } = require('uuid');
const { query, pool } = require('../src/db/client');
const { hashPassword } = require('../src/common/utils/password');
const { ROLES } = require('../src/common/constants/roles');

async function run() {
  try {
    const seedDemoProperties = process.env.SEED_DEMO_PROPERTIES === 'true';
    const adminHash = await hashPassword('Admin1234');
    const userHash = await hashPassword('User12345');

    await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         updated_at = NOW()`,
      [uuid(), 'Admin Rimalis Group', 'admin@rimalis.se', adminHash, ROLES.ADMIN]
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
      [uuid(), 'User One', 'user@rimalis.se', userHash, ROLES.USER]
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

    process.stdout.write(
      `Seed complete${seedDemoProperties ? ' (with demo properties)' : ' (without demo properties)'}\n`
    );
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
