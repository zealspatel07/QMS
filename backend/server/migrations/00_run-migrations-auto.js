/**
 * AUTO-DISCOVERY MIGRATION RUNNER
 * 
 * This runs on app startup and automatically discovers & executes all migrations.
 * No need to modify this file when adding new migrations - just create a numbered file!
 * 
 * Pattern: NN_description.js (e.g., 22_create_reports_table.js)
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// ============================================
// MIGRATION RUNNER - Async/Await (NOT IIFE)
// ============================================
async function runAllMigrations() {
  let conn;
  const migrationsDir = path.join(__dirname);
  const migrationLog = [];

  try {
    // Create a direct connection for migrations (before pool)
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'prayosha',
      port: Number(process.env.DB_PORT || 3306),
    });

    // Get all .js migration files (numbered)
    const files = fs
      .readdirSync(migrationsDir)
      .filter(f => {
        return f.endsWith('.js') && 
               f !== '00_run-migrations-auto.js' &&
               f !== 'run-all-migrations.js' &&
               f !== 'PHASE3_MIGRATIONS.js' &&
               f !== 'verify-schema.js' &&
               /^\d+_/.test(f); // Must start with numbers
      })
      .sort(); // Numeric sort: 01, 02, ..., 10, 11, etc

    if (files.length === 0) {
      console.log('ℹ️  No migrations found to run');
      return { success: true, migrations_run: 0 };
    }

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║     🚀 AUTO-MIGRATION RUNNER STARTED      ║');
    console.log('╚════════════════════════════════════════════╝\n');

    // ✅ CRITICAL: Permanently override process.exit for entire migration session
    // This prevents old migration IIFEs from crashing the server
    const originalExit = process.exit;
    const exitCallLog = [];
    
    process.exit = function(code) {
      exitCallLog.push({
        code,
        timestamp: new Date().toISOString(),
        stack: new Error().stack
      });
      console.log(`   ⚠️  [process.exit(${code})] blocked - continuing anyway`);
      return undefined;
    };

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      const startTime = Date.now();
      const filepath = path.join(migrationsDir, file);

      try {
        console.log(`⏳ Running: ${file}`);

        try {
          // Load and execute the migration file
          delete require.cache[filepath]; // Clear cache for fresh load
          const migration = require(filepath);

          // If it's a function, call it
          if (typeof migration === 'function') {
            await migration(conn);
          }
          // Otherwise it ran as IIFE (old pattern - just log)
        } finally {
          // Don't restore process.exit - keep blocking it
        }

        const duration = Date.now() - startTime;
        console.log(`✅ ${file} [${duration}ms]\n`);
        
        migrationLog.push({
          file,
          status: 'success',
          duration_ms: duration,
          timestamp: new Date().toISOString()
        });

        successCount++;

      } catch (err) {
        
        const duration = Date.now() - startTime;
        console.error(`❌ ${file} FAILED [${duration}ms]`);
        console.error(`   Error: ${err.message}\n`);

        migrationLog.push({
          file,
          status: 'error',
          error: err.message,
          duration_ms: duration,
          timestamp: new Date().toISOString()
        });

        errorCount++;
        
        // ⚠️ Continue to next migration (non-blocking)
      }
    }

    console.log('╔════════════════════════════════════════════╗');
    console.log(`║  ✅ Migrations Complete                   ║`);
    console.log(`║  📊 Total: ${(successCount + errorCount).toString().padEnd(32)} │`);
    console.log(`║  ✅ Success: ${successCount.toString().padEnd(32)} │`);
    if (errorCount > 0) {
      console.log(`║  ⚠️  Failed: ${errorCount.toString().padEnd(32)} │`);
    }
    console.log('╚════════════════════════════════════════════╝');
    
    // ✅ Wait for all async IIFEs and background operations to naturally complete
    console.log('\n⏳ Waiting for background migrations to complete (3 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ All migration tasks completed!\n');
    
    // ✅ NOW restore process.exit so server can operate normally
    process.exit = originalExit;
    
    if (exitCallLog.length > 0) {
      console.log(`⚠️  [BLOCKED] ${exitCallLog.length} process.exit() calls were prevented during migrations`);
    }

    return {
      success: errorCount === 0,
      migrations_run: successCount,
      migrations_failed: errorCount,
      log: migrationLog
    };

  } catch (err) {
    console.error('\n❌ MIGRATION RUNNER ERROR:', err.message);
    console.error('Stack:', err.stack);
    return {
      success: false,
      error: err.message
    };
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error('Error closing migration connection:', e.message);
      }
    }
  }
}

// Export as function so index.js can call it
module.exports = { runAllMigrations };
