
const mysql = require("mysql2/promise");
console.log("ENV CHECK:", process.env.DB_HOST);
let pool = null;

function initPool() {
  if (pool) return pool;

  // ✅ PRODUCTION (Railway)
  if (process.env.MYSQL_URL) {
    console.log("Using Railway DATABASE_URL");

    pool = mysql.createPool(process.env.MYSQL_URL);
    return pool;
  }

  // ✅ LOCAL DEVELOPMENT (fallback)
  const {
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    DB_PORT,
  } = process.env;

  console.log("Using LOCAL DB config");

  if (!DB_HOST || !DB_USER || !DB_NAME) {
    throw new Error("Missing DB config for local environment");
  }

  pool = mysql.createPool({
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.replace("/", ""),
    port: url.port || 3306,
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