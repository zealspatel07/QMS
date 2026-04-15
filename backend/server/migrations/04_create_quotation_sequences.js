 const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS quotation_sequences (
      id INT AUTO_INCREMENT PRIMARY KEY,
      financial_year VARCHAR(10) NOT NULL UNIQUE,
      last_number INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await conn.query(`
    INSERT INTO quotation_sequences (financial_year, last_number)
    VALUES ('202526', 0)
    ON DUPLICATE KEY UPDATE financial_year = financial_year
  `);

  console.log("✓ quotation_sequences ready");

  await conn.end();
})();