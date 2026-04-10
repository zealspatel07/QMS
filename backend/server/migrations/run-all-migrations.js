const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const migrationsDir = path.join(__dirname);

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') && f !== 'run-all-migrations.js')
    .sort(); // ensures 01 → 13 order

  console.log("🚀 Running all migrations...\n");

  for (const file of files) {
    console.log(`➡️ Running: ${file}`);
    require(path.join(migrationsDir, file));
  }
}

runMigrations();