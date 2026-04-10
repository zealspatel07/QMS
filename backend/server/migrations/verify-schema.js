// server/migrations/verify-schema.js
/**
 * Verify Schema Script
 * Checks if all required tables exist and shows their structure
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifySchema() {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'prayosha',
    });

    const requiredTables = [
      'indents',
      'indent_items',
      'indent_documents',
      'vendors',
      'purchase_orders',
      'po_items'
    ];

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 Database Schema Verification');
    console.log('═══════════════════════════════════════════════════\n');

    // Check each table
    let allTablesExist = true;
    const tableStatus = {};

    for (const tableName of requiredTables) {
      try {
        const [rows] = await conn.query(`DESCRIBE ${tableName}`);
        tableStatus[tableName] = {
          exists: true,
          columns: rows.length
        };
        console.log(`✅ ${tableName.padEnd(20)} - ${rows.length} columns`);
      } catch (err) {
        tableStatus[tableName] = {
          exists: false
        };
        console.log(`❌ ${tableName.padEnd(20)} - MISSING`);
        allTablesExist = false;
      }
    }

    console.log('\n───────────────────────────────────────────────────');

    // Show detailed schema if all tables exist
    if (allTablesExist) {
      console.log('\n📋 Detailed Table Structures:\n');

      for (const tableName of requiredTables) {
        const [columns] = await conn.query(`DESCRIBE ${tableName}`);
        console.log(`\n▶ ${tableName.toUpperCase()}`);
        console.log('┌─ Column Name'.padEnd(35) + '│ Type'.padEnd(30) + '│ Null │ Key');
        console.log('├' + '─'.repeat(34) + '┼' + '─'.repeat(29) + '┼──────┼────');

        for (const col of columns) {
          const colName = col.Field.padEnd(33);
          const colType = (col.Type).padEnd(29);
          const colNull = (col.Null === 'YES' ? 'YES' : 'NO').padEnd(6);
          const colKey = col.Key || '';
          console.log(`│ ${colName}│ ${colType}│ ${colNull}│ ${colKey}`);
        }
        console.log('');
      }

      // Show relationships
      console.log('\n🔗 Table Relationships (Foreign Keys):\n');
      
      const relationships = [
        'indent_items → indents (indent_id)',
        'indent_documents → indents (indent_id)',
        'po_items → purchase_orders (po_id)',
        'po_items → indent_items (indent_item_id)',
        'po_items → vendors (vendor_id)',
        'purchase_orders → indents (indent_id)'
      ];

      relationships.forEach(rel => {
        console.log(`  ➜ ${rel}`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════');
    if (allTablesExist) {
      console.log('✅ All required tables exist and are properly configured!');
    } else {
      console.log('⚠️  Some tables are missing. Run migrations to create them.');
      console.log('   Command: node server/migrations/run-all-migrations.js');
    }
    console.log('═══════════════════════════════════════════════════\n');

    await conn.end();

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
}

verifySchema();
