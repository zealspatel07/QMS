// server/migrations/19_fix_email_uniqueness_safe.js

const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('🔧 Fixing UNIQUE constraints on users.email...');

    // 🔍 Get all UNIQUE indexes on email
    const [indexes] = await conn.query(`
      SELECT DISTINCT INDEX_NAME
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
        AND COLUMN_NAME = 'email'
        AND NON_UNIQUE = 0
    `);

    if (indexes.length === 0) {
      console.log('ℹ No UNIQUE indexes found on email');
    }

    for (const idx of indexes) {
      const indexName = idx.INDEX_NAME;

      // ❌ Skip PRIMARY (never drop)
      if (indexName === 'PRIMARY') continue;

      // ❌ Skip invalid alias (same as column name)
      if (indexName.toLowerCase() === 'email') {
        console.log(`⚠ Skipping invalid index name: ${indexName}`);
        continue;
      }

      try {
        console.log(`👉 Dropping index: ${indexName}`);

        await conn.query(`
          ALTER TABLE users DROP INDEX \`${indexName}\`
        `);

        console.log(`✅ Dropped: ${indexName}`);

      } catch (err) {
        console.warn(`⚠ Failed to drop ${indexName}: ${err.message}`);
      }
    }

    console.log('\n📊 FINAL INDEX STATE:');
    const [finalIndexes] = await conn.query(`
      SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
    `);

    finalIndexes.forEach(i => {
      console.log(
        `- ${i.INDEX_NAME} (${i.COLUMN_NAME}) | UNIQUE: ${i.NON_UNIQUE === 0 ? 'YES' : 'NO'}`
      );
    });

    console.log('\n🎉 Migration completed safely');

    await conn.end();
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();