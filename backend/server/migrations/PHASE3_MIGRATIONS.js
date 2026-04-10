/**
 * PHASE 3: DATABASE MIGRATIONS
 * Schema for Audit Logs, Approval Workflows, Vendor Metrics, Risk Scoring
 * 
 * Usage: Copy migrations to backend/server/migrations/
 */

// ============================================
// 19_create_audit_log_table.js
// ============================================
exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.datetime('timestamp').notNullable().defaultTo(knex.fn.now());
    table.integer('user_id').unsigned();
    table.string('user_name').notNullable();
    table.string('action').notNullable(); // CREATE, READ, UPDATE, DELETE, APPROVE, REJECT
    table.string('module').notNullable(); // PO, QUOTATION, INDENT, VENDOR, GRN, USER
    table.integer('entity_id').unsigned();
    table.json('changes').comment('JSON of before/after values');
    table.string('ip_address');
    table.string('status').notNullable().defaultTo('success'); // success, failed
    table.text('error_message');
    table.string('user_role');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};

// ============================================
// 20_create_approval_workflows_table.js
// ============================================
exports.up = function(knex) {
  return knex.schema.createTable('approval_workflows', (table) => {
    table.increments('id').primary();
    table.string('reference_type').notNullable(); // PO, QUOTATION, VENDOR_CREATION, GRN_REJECTION
    table.integer('reference_id').unsigned().notNullable();
    table.string('reference_number').notNullable();
    table.decimal('amount', 15, 2).notNullable();
    table.string('requested_by').notNullable();
    table.string('requested_by_email').notNullable();
    table.datetime('requested_at').notNullable().defaultTo(knex.fn.now());
    table.text('description');
    table.string('status').notNullable().defaultTo('pending'); // pending, approved, rejected, withdrawn
    table.integer('total_approvers').unsigned().defaultTo(0);
    table.integer('approvals_received').unsigned().defaultTo(0);
    table.string('urgency_level').defaultTo('normal'); // normal, high, critical
    table.datetime('deadline');
    table.datetime('completed_at');
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    table.index('reference_type');
    table.index('reference_id');
    table.index('status');
    table.index('requested_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('approval_workflows');
};

// ============================================
// 21_create_approval_steps_table.js
// ============================================
exports.up = function(knex) {
  return knex.schema.createTable('approval_steps', (table) => {
    table.increments('id').primary();
    table.integer('workflow_id').unsigned().notNullable().references('id').inTable('approval_workflows').onDelete('CASCADE');
    table.integer('step_number').unsigned().notNullable();
    table.string('approver_role').notNullable(); // MANAGER, DIRECTOR, VP_FINANCE, CFO
    table.integer('approver_id').unsigned();
    table.string('approver_name').notNullable();
    table.string('approver_email').notNullable();
    table.decimal('approval_threshold', 15, 2);
    table.string('status').notNullable().defaultTo('pending'); // pending, approved, rejected
    table.text('comments');
    table.datetime('approved_at');
    table.string('signature'); // Could store digital signature
    table.datetime('created_at').defaultTo(knex.fn.now());
    table.datetime('updated_at').defaultTo(knex.fn.now());
    
    table.index('workflow_id');
    table.index('approver_id');
    table.index('status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('approval_steps');
};

// ============================================
// 22_create_vendor_performance_metrics_table.js
// ============================================
exports.up = function(knex) {
  return knex.schema.createTable('vendor_performance_metrics', (table) => {
    table.increments('id').primary();
    table.integer('vendor_id').unsigned().notNullable().references('id').inTable('vendors').onDelete('CASCADE');
    table.integer('year').unsigned().notNullable();
    table.integer('month').unsigned().notNullable();
    
    // Delivery metrics
    table.integer('total_pos').unsigned().defaultTo(0);
    table.integer('on_time_pos').unsigned().defaultTo(0);
    table.integer('late_pos').unsigned().defaultTo(0);
    table.decimal('on_time_percentage', 5, 2).defaultTo(0);
    table.decimal('avg_delay_days', 8, 2).defaultTo(0);
    
    // Quality metrics
    table.integer('grns_received').unsigned().defaultTo(0);
    table.integer('grns_passed').unsigned().defaultTo(0);
    table.integer('grns_rejected').unsigned().defaultTo(0);
    table.decimal('quality_score', 5, 2).defaultTo(0);
    
    // Communication metrics
    table.integer('communication_score').unsigned().defaultTo(5);
    table.integer('response_time_hours').unsigned().defaultTo(0);
    
    // Financial metrics
    table.decimal('total_po_value', 15, 2).defaultTo(0);
    table.decimal('avg_po_value', 12, 2).defaultTo(0);
    table.integer('payment_terms_days').unsigned().defaultTo(0);
    table.decimal('price_variance_percent', 5, 2).defaultTo(0);
    
    // Overall rating
    table.integer('overall_rating').unsigned().defaultTo(0); // 1-5 stars
    table.string('performance_tier').defaultTo('standard'); // bronze, silver, gold, platinum
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['vendor_id', 'year', 'month']);
    table.unique(['vendor_id', 'year', 'month']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('vendor_performance_metrics');
};

// ============================================
// 23_create_vendor_risk_assessment_table.js
// ============================================
exports.up = function(knex) {
  return knex.schema.createTable('vendor_risk_assessment', (table) => {
    table.increments('id').primary();
    table.integer('vendor_id').unsigned().notNullable().references('id').inTable('vendors').onDelete('CASCADE');
    
    // Risk factors
    table.string('financial_risk_level').defaultTo('low'); // low, medium, high, critical
    table.string('delivery_risk_level').defaultTo('low');
    table.string('quality_risk_level').defaultTo('low');
    table.string('compliance_risk_level').defaultTo('low');
    
    // Risk scores (0-100)
    table.integer('financial_risk_score').unsigned().defaultTo(0);
    table.integer('delivery_risk_score').unsigned().defaultTo(0);
    table.integer('quality_risk_score').unsigned().defaultTo(0);
    table.integer('compliance_risk_score').unsigned().defaultTo(0);
    table.integer('overall_risk_score').unsigned().defaultTo(0);
    
    // Mitigation measures
    text('financial_mitigation');
    text('delivery_mitigation');
    text('quality_mitigation');
    text('compliance_mitigation');
    
    // Flags
    table.boolean('is_blacklisted').defaultTo(false);
    table.datetime('blacklist_date');
    text('blacklist_reason');
    table.boolean('requires_approval').defaultTo(false);
    table.boolean('needs_audit').defaultTo(false);
    
    table.timestamp('last_assessed_at').defaultTo(knex.fn.now());
    table.integer('assessed_by_user_id').unsigned();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.unique('vendor_id');
    table.index('overall_risk_score');
    table.index('is_blacklisted');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('vendor_risk_assessment');
};

// ============================================
// 24_add_approval_fields_to_purchase_orders.js
// ============================================
exports.up = function(knex) {
  return knex.schema.table('purchase_orders', (table) => {
    table.integer('approval_workflow_id').unsigned().references('id').inTable('approval_workflows').onDelete('SET NULL');
    table.string('approval_status').defaultTo('approved'); // approved, pending, rejected
    table.datetime('approved_at');
    table.string('approved_by');
    table.boolean('requires_approval').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('purchase_orders', (table) => {
    table.dropColumn('approval_workflow_id');
    table.dropColumn('approval_status');
    table.dropColumn('approved_at');
    table.dropColumn('approved_by');
    table.dropColumn('requires_approval');
  });
};

// ============================================
// 25_add_metrics_fields_to_grn.js
// ============================================
exports.up = function(knex) {
  return knex.schema.table('grn', (table) => {
    table.string('quality_check_status').defaultTo('pending'); // pending, pass, fail
    table.text('quality_remarks');
    table.integer('accepted_items').unsigned().defaultTo(0);
    table.integer('rejected_items').unsigned().defaultTo(0);
    table.integer('damaged_items').unsigned().defaultTo(0);
    table.datetime('quality_checked_by_user_id').unsigned();
    table.datetime('quality_checked_at');
  });
};

exports.down = function(knex) {
  return knex.schema.table('grn', (table) => {
    table.dropColumn('quality_check_status');
    table.dropColumn('quality_remarks');
    table.dropColumn('accepted_items');
    table.dropColumn('rejected_items');
    table.dropColumn('damaged_items');
    table.dropColumn('quality_checked_by_user_id');
    table.dropColumn('quality_checked_at');
  });
};

// ============================================
// 26_create_notification_preferences_table.js
// ============================================
exports.up = function(knex) {
  return knex.schema.createTable('notification_preferences', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    
    // Email notifications
    table.boolean('email_po_created').defaultTo(true);
    table.boolean('email_po_approved').defaultTo(true);
    table.boolean('email_po_delayed').defaultTo(true);
    table.boolean('email_quotation_received').defaultTo(true);
    table.boolean('email_approval_required').defaultTo(true);
    table.boolean('email_grn_pending').defaultTo(true);
    
    // SMS notifications
    table.boolean('sms_critical_alerts').defaultTo(true);
    table.boolean('sms_approval_required').defaultTo(false);
    
    // In-app notifications
    table.boolean('push_all_events').defaultTo(true);
    
    // Delivery preferences
    table.string('notification_frequency').defaultTo('immediate'); // immediate, daily, weekly
    table.time('quiet_hours_start');
    table.time('quiet_hours_end');
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.unique('user_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('notification_preferences');
};

// ============================================
// MIGRATION RUNNER - Add to backend/server/migrations/run-all-migrations.js
// ============================================
/*
const migrations = [
  require('./19_create_audit_log_table'),
  require('./20_create_approval_workflows_table'),
  require('./21_create_approval_steps_table'),
  require('./22_create_vendor_performance_metrics_table'),
  require('./23_create_vendor_risk_assessment_table'),
  require('./24_add_approval_fields_to_purchase_orders'),
  require('./25_add_metrics_fields_to_grn'),
  require('./26_create_notification_preferences_table'),
];

async function runPhase3Migrations() {
  console.log('Running Phase 3 Migrations...');
  for (const migration of migrations) {
    try {
      await migration.up(knex);
      console.log(`✓ ${migration.name || 'Migration'} completed`);
    } catch (error) {
      console.error('Migration failed:', error);
    }
  }
}

module.exports = runPhase3Migrations;
*/
