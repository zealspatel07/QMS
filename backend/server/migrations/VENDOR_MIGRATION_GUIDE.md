# Vendor Schema Migration Guide

## Overview
This migration fixes the database mismatch issue preventing vendor details from being fetched. It creates all necessary vendor-related tables and ensures proper relationships between them.

## Migration File
**Location:** `backend/server/migrations/04_vendor_schema_migration.js`

## What Gets Created

### 1. **vendors** table
   - Stores core vendor information
   - Fields: vendor_code, name, contact_person, phone, email, address, city, state, country, gst_number, rating, is_active
   - Primary key: id
   - Indexes: vendor_code, is_active

### 2. **vendor_contacts** table
   - Stores multiple contacts per vendor
   - Fields: vendor_id, name, designation, phone, email, is_primary
   - Foreign key: vendor_id ➜ vendors.id
   - Indexes: vendor_id, is_primary

### 3. **vendor_performance** table
   - Tracks vendor performance metrics
   - Fields: vendor_id, total_orders, total_quantity, on_time_deliveries, delayed_deliveries, quality_score, delivery_score, overall_rating
   - One record per vendor (unique vendor_id)
   - Foreign key: vendor_id ➜ vendors.id

### 4. **vendor_procurement_stats** table
   - Stores procurement statistics
   - Fields: vendor_id, total_orders, total_value, last_order_date
   - One record per vendor (unique vendor_id)
   - Foreign key: vendor_id ➜ vendors.id

## How to Run

### Option 1: Direct Execution
```bash
cd backend/server
node migrations/04_vendor_schema_migration.js
```

### Option 2: From Project Root
```bash
cd backend
node server/migrations/04_vendor_schema_migration.js
```

### Option 3: Using npm script (add to package.json if needed)
```bash
npm run migrate:vendors
```

## Expected Output
```
========================================
🚀 VENDOR SCHEMA MIGRATION
========================================

✅ Database connection established

📋 Processing vendors table...
  ✅ Created vendors table

📋 Processing vendor_contacts table...
  ✅ Created vendor_contacts table

📋 Processing vendor_performance table...
  ✅ Created vendor_performance table

📋 Processing vendor_procurement_stats table...
  ✅ Created vendor_procurement_stats table

✨ Verifying schema...

  ✅ vendors
  ✅ vendor_contacts
  ✅ vendor_performance
  ✅ vendor_procurement_stats

========================================
🎉 VENDOR SCHEMA MIGRATION COMPLETED
All vendor tables created successfully!
========================================
```

## Key Features
✅ **Idempotent**: Safe to run multiple times
✅ **Smart Detection**: Only creates missing tables/columns
✅ **Foreign Keys**: Proper relationships with CASCADE delete
✅ **Error Handling**: Graceful handling of existing structures
✅ **Verification**: Confirms all tables created successfully

## Troubleshooting

### Error: FOREIGN KEY constraint
**Cause**: Table doesn't exist or column mismatch
**Solution**: Ensure vendors table is created first (it is in this script)

### Error: Duplicate entry
**Cause**: Trying to run twice with same data
**Solution**: Safe to re-run, it checks for existing tables

### Error: Connection refused
**Cause**: Database not running
**Solution**: Make sure MySQL is running and db.js credentials are correct

## Next Steps (After Migration)
1. Run the vendorsDetailsAPI to fetch from the database
2. Test the Vendors page in the UI
3. Verify vendor details are displaying correctly

## Database Mismatch Fix Summary
This migration resolves the mismatch by:
- Creating proper table structure matching the API expectations
- Establishing correct foreign key relationships
- Adding required indexes for performance
- Ensuring data consistency with proper timestamps
- Supporting all vendor-related operations (contacts, performance, procurement stats)

## Support
If you need to modify the migration:
1. Edit `04_vendor_schema_migration.js`
2. Re-run the migration (it's safe)
3. Check backend logs for any issues
