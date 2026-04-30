const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

async function createTestDb() {
  const db = await open({
    filename: ":memory:",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      result TEXT,
      error TEXT,
      idempotency_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.exec("CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL");

  return db;
}

async function closeTestDb(db) {
  if (db) {
    await db.close();
  }
}

module.exports = {
  createTestDb,
  closeTestDb,
};
