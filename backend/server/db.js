// server/db.js
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env")
});
const mysql = require("mysql2/promise");
console.log("ENV CHECK:", process.env.DB_HOST);
let pool = null;

function initPool() {
  if (pool) return pool;

  const {
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    DB_PORT,
  } = process.env;

  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error("Missing DB_* environment variables");
  }

  pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD || "",
    database: DB_NAME,
    port: Number(DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  return pool;
}

module.exports = {
  getConnection: async () => {
    const p = initPool();
    return p.getConnection();
  },

  endPool: async () => {
    if (pool) {
      await pool.end();
      pool = null;
    }
  },
};
