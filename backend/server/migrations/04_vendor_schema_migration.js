#!/usr/bin/env node

/**
 * Vendor Schema Migration - Standalone Script
 * Run this to fix database mismatch and create all vendor-related tables
 * 
 * Usage:
 *   node 04_vendor_schema_migration.js
 * 
 * This script will:
 * 1. Create vendors table with all required fields
 * 2. Create vendor_contacts table
 * 3. Create vendor_performance table
 * 4. Create vendor_procurement_stats table
 * 5. Add missing columns if tables exist
 */

const db = require('../db');

async function tableExists(conn, table) {
  try {
    const [rows] = await conn.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    `, [table]);
    return rows[0].count > 0;
  } catch (err) {
    console.error(`Error checking table ${table}:`, err.message);
    return false;
  }
}

async function columnExists(conn, table, column) {
  try {
    const [rows] = await conn.query(`
      SELECT COUNT(*) as count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    `, [table, column]);
    return rows[0].count > 0;
  } catch (err) {
    return false;
  }
}

async function addColumn(conn, table, column, definition) {
  try {
    if (!(await columnExists(conn, table, column))) {
      await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`  ✅ Added column ${column} to ${table}`);
    }
  } catch (err) {
    console.log(`  ⏭️  Column ${column} already exists in ${table}`);
  }
}

async function runVendorMigration() {
  let conn;

  try {
    console.log('\n========================================');
    console.log('🚀 VENDOR SCHEMA MIGRATION');
    console.log('========================================\n');

    conn = await db.getConnection();
    console.log('✅ Database connection established\n');

    // =========================
    // 1. CREATE/UPDATE VENDORS TABLE
    // =========================
    console.log('📋 Processing vendors table...');
    
    const vendorsExists = await tableExists(conn, 'vendors');
    
    if (!vendorsExists) {
      await conn.query(`
        CREATE TABLE vendors (
          id INT AUTO_INCREMENT PRIMARY KEY,
          vendor_code VARCHAR(100) NOT NULL UNIQUE COMMENT 'Unique vendor identifier',
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          phone VARCHAR(20),
          email VARCHAR(255),
          address LONGTEXT,
          city VARCHAR(100),
          state VARCHAR(100),
          country VARCHAR(100),
          gst_number VARCHAR(50) COMMENT 'GST registration number',
          rating DECIMAL(3, 2) DEFAULT 0.00,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_vendor_code (vendor_code),
          INDEX idx_is_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ Created vendors table\n');
    } else {
      console.log('  ℹ️  vendors table exists, checking for missing columns...');
      await addColumn(conn, 'vendors', 'vendor_code', 'VARCHAR(100)');
      await addColumn(conn, 'vendors', 'contact_person', 'VARCHAR(255)');
      await addColumn(conn, 'vendors', 'phone', 'VARCHAR(20)');
      await addColumn(conn, 'vendors', 'email', 'VARCHAR(255)');
      await addColumn(conn, 'vendors', 'address', 'LONGTEXT');
      await addColumn(conn, 'vendors', 'city', 'VARCHAR(100)');
      await addColumn(conn, 'vendors', 'state', 'VARCHAR(100)');
      await addColumn(conn, 'vendors', 'country', 'VARCHAR(100)');
      await addColumn(conn, 'vendors', 'gst_number', 'VARCHAR(50)');
      await addColumn(conn, 'vendors', 'rating', 'DECIMAL(3, 2) DEFAULT 0.00');
      await addColumn(conn, 'vendors', 'is_active', 'BOOLEAN DEFAULT TRUE');
      console.log('');
    }

    // =========================
    // 2. CREATE/UPDATE VENDOR_CONTACTS TABLE
    // =========================
    console.log('📋 Processing vendor_contacts table...');
    
    const contactsExists = await tableExists(conn, 'vendor_contacts');
    
    if (!contactsExists) {
      await conn.query(`
        CREATE TABLE vendor_contacts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          vendor_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          designation VARCHAR(255),
          phone VARCHAR(20),
          email VARCHAR(255),
          is_primary BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_vc_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
          INDEX idx_vendor_id (vendor_id),
          INDEX idx_is_primary (is_primary)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ Created vendor_contacts table\n');
    } else {
      console.log('  ✅ vendor_contacts table already exists\n');
    }

    // =========================
    // 3. CREATE/UPDATE VENDOR_PERFORMANCE TABLE
    // =========================
    console.log('📋 Processing vendor_performance table...');
    
    const perfExists = await tableExists(conn, 'vendor_performance');
    
    if (!perfExists) {
      await conn.query(`
        CREATE TABLE vendor_performance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          vendor_id INT NOT NULL UNIQUE,
          total_orders INT DEFAULT 0,
          total_quantity INT DEFAULT 0,
          on_time_deliveries INT DEFAULT 0,
          delayed_deliveries INT DEFAULT 0,
          quality_score DECIMAL(5, 2) DEFAULT 0.00,
          delivery_score DECIMAL(5, 2) DEFAULT 0.00,
          overall_rating DECIMAL(3, 2) DEFAULT 0.00,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_vp_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
          INDEX idx_vendor_id (vendor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ Created vendor_performance table\n');
    } else {
      console.log('  ✅ vendor_performance table already exists\n');
    }

    // =========================
    // 4. CREATE/UPDATE VENDOR_PROCUREMENT_STATS TABLE
    // =========================
    console.log('📋 Processing vendor_procurement_stats table...');
    
    const statsExists = await tableExists(conn, 'vendor_procurement_stats');
    
    if (!statsExists) {
      await conn.query(`
        CREATE TABLE vendor_procurement_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          vendor_id INT NOT NULL UNIQUE,
          total_orders INT DEFAULT 0,
          total_value DECIMAL(12, 2) DEFAULT 0.00,
          last_order_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_vps_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
          INDEX idx_vendor_id (vendor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('  ✅ Created vendor_procurement_stats table\n');
    } else {
      console.log('  ✅ vendor_procurement_stats table already exists\n');
    }

    // =========================
    // VERIFY SCHEMA
    // =========================
    console.log('✨ Verifying schema...\n');
    
    const tables = ['vendors', 'vendor_contacts', 'vendor_performance', 'vendor_procurement_stats'];
    let allGood = true;
    
    for (const table of tables) {
      const exists = await tableExists(conn, table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
      if (!exists) allGood = false;
    }

    console.log('\n========================================');
    if (allGood) {
      console.log('🎉 VENDOR SCHEMA MIGRATION COMPLETED');
      console.log('All vendor tables created successfully!');
    } else {
      console.log('⚠️  MIGRATION COMPLETED WITH WARNINGS');
      console.log('Some tables may not have been created');
    }
    console.log('========================================\n');

  } catch (err) {
    console.error('\n❌ MIGRATION ERROR:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  } finally {
    if (conn) conn.release();
  }
}

// Run the migration
runVendorMigration();
