const fs = require('fs/promises');
const path = require('path');
const { pool } = require('../src/db/client');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function run() {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const migrationsDir = path.resolve(__dirname, '../src/db/migrations');
    const files = (await fs.readdir(migrationsDir))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1',
        [file]
      );

      if (rows.length > 0) {
        continue;
      }

      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(version, applied_at) VALUES($1, NOW())',
        [file]
      );
      await client.query('COMMIT');
      process.stdout.write(`Applied migration: ${file}\n`);
    }

    process.stdout.write('Migration complete\n');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_err) {
      // no-op
    }
    process.stderr.write(`Migration failed: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
