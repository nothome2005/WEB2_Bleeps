const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const DB_FILE = path.join(__dirname, "..", "data", "bleep.db");

async function initDb() {
  const db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}

module.exports = {
  initDb,
};
