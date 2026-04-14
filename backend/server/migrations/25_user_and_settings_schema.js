// backend/migrations/17_user_and_settings_schema.js
// Create user roles, permissions, system settings, and notification tracking tables

const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  let conn;

  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'prayosha',
    });

    console.log('🔄 Migration 17: Creating User, Roles & Settings Schema...\n');

    // ============================================
    // 1. ROLES TABLE
    // ============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        permissions JSON,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=INNODB
    `);
    console.log('✅ Created roles table');

    // ============================================
    // 2. USER_ROLES junction table
    // ============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_by INT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY unique_user_role (user_id, role_id)
      ) ENGINE=INNODB
    `);
    console.log('✅ Created user_roles table');

    // ============================================
    // 3. SYSTEM_SETTINGS TABLE
    // ============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(255) NOT NULL UNIQUE,
        setting_value LONGTEXT,
        data_type VARCHAR(50),
        description TEXT,
        category VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=INNODB
    `);
    console.log('✅ Created system_settings table');

    // ============================================
    // 4. NOTIFICATIONS TABLE
    // ============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255),
        message LONGTEXT,
        notification_type VARCHAR(50),
        category VARCHAR(100),
        reference_type VARCHAR(50),
        reference_id INT,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_unread (user_id, is_read),
        INDEX idx_created_at (created_at)
      ) ENGINE=INNODB
    `);
    console.log('✅ Created notifications table');

    // ============================================
    // 5. EMAIL_LOGS TABLE (for audit trail)
    // ============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        from_user_id INT,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255),
        body LONGTEXT,
        email_type VARCHAR(50),
        reference_type VARCHAR(50),
        reference_id INT,
        status VARCHAR(50),
        sent_at TIMESTAMP NULL,
        error_message LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=INNODB
    `);
    console.log('✅ Created email_logs table');

    // ============================================
    // 6. AUDIT_LOG TABLE (for tracking changes)
    // ============================================
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(50),
        module VARCHAR(100),
        entity_type VARCHAR(100),
        entity_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_user (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=INNODB
    `);
    console.log('✅ Created audit_logs table');

    // ============================================
    // 7. PERMISSION TEMPLATES for quick setup
    // ============================================
    const rolePermissions = {
      admin: {
        users: ['create', 'read', 'update', 'delete'],
        settings: ['read', 'update'],
        quotations: ['create', 'read', 'update', 'delete'],
        indents: ['create', 'read', 'update', 'delete'],
        purchase_orders: ['create', 'read', 'update', 'delete'],
        vendors: ['create', 'read', 'update', 'delete'],
        customers: ['create', 'read', 'update', 'delete'],
        reports: ['read'],
        notifications: ['read'],
        email_notifications: ['send'],
      },
      sales: {
        quotations: ['create', 'read', 'update'],
        customers: ['create', 'read', 'update'],
        indents: ['read'],
        reports: ['read'],
        notifications: ['read'],
      },
      purchase: {
        indents: ['read'],
        purchase_orders: ['create', 'read', 'update'],
        vendors: ['read'],
        quotations: ['read'],
        reports: ['read'],
        notifications: ['read'],
        email_notifications: ['send'],
      },
      viewer: {
        quotations: ['read'],
        indents: ['read'],
        purchase_orders: ['read'],
        vendors: ['read'],
        customers: ['read'],
        reports: ['read'],
        notifications: ['read'],
      },
    };

    // Insert roles
    for (const [roleName, permissions] of Object.entries(rolePermissions)) {
      await conn.query(
        `INSERT IGNORE INTO roles (name, description, permissions) VALUES (?, ?, ?)`,
        [
          roleName.charAt(0).toUpperCase() + roleName.slice(1),
          `${roleName} role with appropriate permissions`,
          JSON.stringify(permissions),
        ]
      );
    }
    console.log('✅ Inserted default roles with permissions');

    // ============================================
    // 8. INSERT DEFAULT SETTINGS
    // ============================================
    const defaultSettings = [
      {
        key: 'email_enabled',
        value: 'false',
        type: 'boolean',
        category: 'email',
        description: 'Enable/disable email notifications',
      },
      {
        key: 'email_smtp_host',
        value: 'smtp.gmail.com',
        type: 'string',
        category: 'email',
        description: 'SMTP server hostname',
      },
      {
        key: 'email_smtp_port',
        value: '587',
        type: 'number',
        category: 'email',
        description: 'SMTP server port',
      },
      {
        key: 'email_from_address',
        value: 'noreply@company.com',
        type: 'string',
        category: 'email',
        description: 'From email address',
      },
      {
        key: 'email_from_name',
        value: 'QMS System',
        type: 'string',
        category: 'email',
        description: 'From email display name',
      },
      {
        key: 'ceo_email',
        value: 'ceo@company.com',
        type: 'string',
        category: 'notifications',
        description: 'CEO email address for critical notifications',
      },
      {
        key: 'auto_notification_po_approval',
        value: 'true',
        type: 'boolean',
        category: 'notifications',
        description: 'Auto-notify CEO when PO created over amount',
      },
      {
        key: 'po_approval_threshold',
        value: '100000',
        type: 'number',
        category: 'purchase',
        description: 'PO amount requiring CEO approval',
      },
      {
        key: 'company_name',
        value: 'Your Company Name',
        type: 'string',
        category: 'general',
        description: 'Company name for branding',
      },
      {
        key: 'company_address',
        value: '',
        type: 'string',
        category: 'general',
        description: 'Company address',
      },
    ];

    for (const setting of defaultSettings) {
      await conn.query(
        `INSERT IGNORE INTO system_settings (setting_key, setting_value, data_type, category, description) 
         VALUES (?, ?, ?, ?, ?)`,
        [setting.key, setting.value, setting.type, setting.category, setting.description]
      );
    }
    console.log('✅ Inserted default system settings');

    await conn.end();
    console.log('\n✅ Migration 17 completed successfully!');
    console.log('\n📋 Tables created:');
    console.log('   • roles');
    console.log('   • user_roles');
    console.log('   • system_settings');
    console.log('   • notifications');
    console.log('   • email_logs');
    console.log('   • audit_logs');
    process.exit(0);

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (conn) await conn.end();
    process.exit(1);
  }
})();
