// server/migrate_quotations.js
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'prayosha',
  });

  const [rows] = await conn.query('SELECT id, items, total_value FROM quotations');
  console.log('Rows to check:', rows.length);

  for (const r of rows) {
    let items = r.items;
    if (!items) {
      // set empty items array if null
      items = [];
    } else {
      // if driver returns string, try parse
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch(e) { items = []; }
      }
    }

    // compute totals from items
    let subtotal = 0;
    for (const it of items) {
      const qty = Number(it.qty || 0);
      const unit = Number(it.unit_price || 0);
      const discount = Number(it.discount_percent || 0);
      const gross = qty * unit;
      const afterDiscount = gross - (gross * discount / 100);
      const tax = afterDiscount * (Number(it.tax_rate || 0) / 100);
      const lineTotal = afterDiscount + tax;
      subtotal += lineTotal;
    }
    const newTotal = Math.round(subtotal * 100) / 100;

    // update row to ensure items is stored as JSON and total_value is correct
    try {
      await conn.query('UPDATE quotations SET items = ?, total_value = ? WHERE id = ?', [JSON.stringify(items), newTotal, r.id]);
      console.log('Updated quotation', r.id, '-> total', newTotal);
    } catch (err) {
      console.error('Failed updating id', r.id, err);
    }
  }

  await conn.end();
  console.log('Done migration.');
})();
