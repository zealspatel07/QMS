# Database Migrations Guide

This directory contains all database migration scripts for the QMS (Quality Management System) application.

## Overview

The migrations are designed to create the following tables:

1. **indents** - Main indent/requisition records
2. **indent_items** - Items within each indent
3. **indent_documents** - Document uploads for indents
4. **vendors** - Vendor master data
5. **purchase_orders** - Purchase order records
6. **po_items** - Items within each purchase order

## Migration Files

| File | Description |
|------|-------------|
| `01_create_indents_table.js` | Creates indents, indent_items, and indent_documents tables |
| `02_create_vendors_table.js` | Creates vendors table |
| `03_create_purchase_orders_table.js` | Creates purchase_orders and po_items tables |
| `run-all-migrations.js` | Master runner to execute all migrations |

## How to Run Migrations

### Option 1: Run All Migrations
```bash
cd backend/server/migrations
node run-all-migrations.js
```

### Option 2: Run Individual Migration
```bash
cd backend/server/migrations
node 01_create_indents_table.js
node 02_create_vendors_table.js
node 03_create_purchase_orders_table.js
```

### Option 3: Add npm script (optional)
Add to `package.json`:
```json
{
  "scripts": {
    "migrate": "node server/migrations/01_create_indents_table.js && node server/migrations/02_create_vendors_table.js && node server/migrations/03_create_purchase_orders_table.js",
    "migrate:run-all": "node server/migrations/run-all-migrations.js"
  }
}
```

Then run:
```bash
npm run migrate
```

## Database Schema

### indents
```
id (INT, PK)
indent_number (VARCHAR, UNIQUE)
customer_name (VARCHAR)
preferred_vendor (VARCHAR)
indent_date (DATE)
notes (LONGTEXT)
status (VARCHAR) - Default: 'submitted'
created_by (VARCHAR)
created_by_name (VARCHAR)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### indent_items
```
id (INT, PK)
indent_id (INT, FK → indents.id)
product_id (INT)
product_name (VARCHAR)
model_number (VARCHAR)
product_description (LONGTEXT)
quantity (DECIMAL)
created_at (TIMESTAMP)
```

### indent_documents
```
id (INT, PK)
indent_id (INT, FK → indents.id)
file_name (VARCHAR)
file_path (VARCHAR)
uploaded_by (VARCHAR)
created_at (TIMESTAMP)
```

### vendors
```
id (INT, PK)
vendor_code (VARCHAR)
name (VARCHAR, UNIQUE)
contact_person (VARCHAR)
phone (VARCHAR)
email (VARCHAR)
address (LONGTEXT)
city (VARCHAR)
state (VARCHAR)
country (VARCHAR) - Default: 'India'
gst_number (VARCHAR)
rating (DECIMAL)
is_active (TINYINT) - Default: 1
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### purchase_orders
```
id (INT, PK)
po_number (VARCHAR, UNIQUE)
indent_id (INT, FK → indents.id)
order_date (DATETIME)
status (VARCHAR) - Default: 'created'
created_by (VARCHAR)
created_by_name (VARCHAR)
vendor_name (VARCHAR)
vendor_gst (VARCHAR)
vendor_state_code (VARCHAR)
contact_person (VARCHAR)
contact_email (VARCHAR)
contact_phone (VARCHAR)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### po_items
```
id (INT, PK)
po_id (INT, FK → purchase_orders.id)
indent_item_id (INT, FK → indent_items.id)
product_name (VARCHAR)
product_description (LONGTEXT)
ordered_qty (DECIMAL)
received_qty (DECIMAL)
vendor_id (INT, FK → vendors.id)
unit_price (DECIMAL)
line_total (DECIMAL)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

## Prerequisites

1. **Environment Variables**: Ensure `.env` file is configured with:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=prayosha
   DB_PORT=3306
   ```

2. **MySQL Server**: Running MySQL 5.7+ or MariaDB 10.3+

3. **Node.js Packages**: Required packages installed
   ```bash
   npm install mysql2 dotenv
   ```

## Troubleshooting

### Connection Error
- Check if MySQL server is running
- Verify credentials in `.env` file
- Ensure database exists

### Table Already Exists
- Migrations use `CREATE TABLE IF NOT EXISTS` so they're safe to re-run
- Use `DROP TABLE` if you need to reset

### Foreign Key Constraint Error
- Ensure tables are created in the correct order
- Drop dependent tables first if rebuilding

## Rolling Back (Manual)

If you need to delete all tables:
```sql
DROP TABLE IF EXISTS po_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS indent_documents;
DROP TABLE IF EXISTS indent_items;
DROP TABLE IF EXISTS indents;
DROP TABLE IF EXISTS vendors;
```

## Notes

- All migrations use `InnoDB` engine for transaction support
- UTC8MB4 charset for proper Unicode support
- Appropriate indexes are created for common query patterns
- Foreign keys include `ON DELETE CASCADE` or `ON DELETE SET NULL` as needed
- Timestamps include auto-update on modification
