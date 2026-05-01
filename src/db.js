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
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_path TEXT,
      status TEXT NOT NULL,
      result TEXT,
      s3_key TEXT,
      error TEXT,
      idempotency_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const columns = await db.all("PRAGMA table_info(jobs)");
  const hasUserId = columns.some((column) => column.name === "user_id");
  if (!hasUserId) {
    await db.exec("ALTER TABLE jobs ADD COLUMN user_id TEXT");
    await db.exec("UPDATE jobs SET user_id = 'legacy-user' WHERE user_id IS NULL");
  }

  const hasIdempotencyKey = columns.some((column) => column.name === "idempotency_key");
  if (!hasIdempotencyKey) {
    await db.exec("ALTER TABLE jobs ADD COLUMN idempotency_key TEXT");
  }

  const hasImagePath = columns.some((column) => column.name === "image_path");
  if (!hasImagePath) {
    await db.exec("ALTER TABLE jobs ADD COLUMN image_path TEXT");
  }

  const hasS3Key = columns.some((column) => column.name === "s3_key");
  if (!hasS3Key) {
    await db.exec("ALTER TABLE jobs ADD COLUMN s3_key TEXT");
  }

  await db.exec("CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)");
  await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL");

  // Clear data on startup as requested
  console.log("[DB] Clearing all jobs for a clean start...");
  await db.exec("DELETE FROM jobs");

  return db;
}

module.exports = {
  initDb,
};
