/**
 * Railway-safe migration runner.
 *
 * Your existing migration files are written to be executed standalone and many of them call
 * process.exit(). Requiring them in-process will stop the runner after the first file.
 *
 * This script runs each migration in a separate Node process, in sorted order, so every
 * migration can safely exit without killing the whole sequence.
 *
 * Usage (locally or on Railway):
 *   node server/migrations/run-all-migrations-railway.js
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function getDatabaseUrlFromEnv(env) {
  return env.DATABASE_URL || env.MYSQL_URL || env.MYSQLDATABASE_URL || null;
}

function buildMigrationEnv(baseEnv) {
  const env = { ...baseEnv };

  // Many existing migrations expect DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/DB_PORT.
  // If Railway provides only DATABASE_URL / MYSQL_URL, derive those variables.
  const databaseUrl = getDatabaseUrlFromEnv(env);
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      env.DB_HOST = env.DB_HOST || url.hostname;
      env.DB_USER = env.DB_USER || decodeURIComponent(url.username || "");
      env.DB_PASSWORD =
        env.DB_PASSWORD || decodeURIComponent(url.password || "");
      env.DB_PORT = env.DB_PORT || String(url.port || "3306");
      env.DB_NAME = env.DB_NAME || (url.pathname || "").replace(/^\//, "");
    } catch (e) {
      // ignore; migrations may still work with explicit DB_* vars
    }
  }

  // Also support Railway's standard MySQL plugin env var names
  env.DB_HOST = env.DB_HOST || env.MYSQLHOST;
  env.DB_USER = env.DB_USER || env.MYSQLUSER;
  env.DB_PASSWORD = env.DB_PASSWORD || env.MYSQLPASSWORD;
  env.DB_PORT = env.DB_PORT || env.MYSQLPORT;
  env.DB_NAME = env.DB_NAME || env.MYSQLDATABASE;

  return env;
}

function listMigrationFiles(migrationsDir) {
  const blacklist = new Set([
    "run-all-migrations.js",
    "run-all-migrations-railway.js",
    "PHASE3_MIGRATIONS.js",
  ]);

  return fs
    .readdirSync(migrationsDir)
    .filter((f) => {
      if (!f.endsWith(".js") || blacklist.has(f)) return false;
      const m = /^(\d+)_/.exec(f);
      if (!m) return false;
      const n = Number(m[1]);
      return Number.isFinite(n) && n >= 1 && n <= 20;
    })
    .sort();
}

function run() {
  const migrationsDir = __dirname;
  const files = listMigrationFiles(migrationsDir);
  const migrationEnv = buildMigrationEnv(process.env);

  console.log(`🚀 Running ${files.length} migrations (Railway-safe)...\n`);

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    console.log(`➡️  Running: ${file}`);

    const res = spawnSync(process.execPath, [fullPath], {
      stdio: "inherit",
      env: migrationEnv,
    });

    const code = typeof res.status === "number" ? res.status : 1;
    if (code !== 0) {
      console.error(`\n❌ Migration failed: ${file} (exit code ${code})`);
      process.exit(code);
    }
  }

  console.log("\n✅ All migrations completed successfully.");
}

run();

