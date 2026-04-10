const db = require("../db");

async function getSettingsFromDB() {
  const conn = await db.getConnection();
  try {
    const [[row]] = await conn.query(
      "SELECT * FROM app_settings WHERE id = 1"
    );
    return row || {};
  } finally {
    conn.release();
  }
}

module.exports = {
  getSettingsFromDB,
};
