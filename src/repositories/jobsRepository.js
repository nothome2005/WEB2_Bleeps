function createJobsRepository(db) {
  return {
    async createJob(userId, title, description, imagePath, now, status, idempotencyKey = null) {
      const result = await db.run(
        `
          INSERT INTO jobs (user_id, title, description, image_path, status, result, error, idempotency_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
        `,
        [userId, title, description, imagePath, status, idempotencyKey, now, now]
      );

      return db.get("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [result.lastID, userId]);
    },

    async getJobByIdempotencyKey(userId, idempotencyKey) {
      if (!idempotencyKey) return null;
      return db.get(
        "SELECT * FROM jobs WHERE user_id = ? AND idempotency_key = ?",
        [userId, idempotencyKey]
      );
    },

    async listJobsByUser(userId) {
      return db.all("SELECT * FROM jobs WHERE user_id = ? ORDER BY id DESC", [userId]);
    },

    async getJobByIdForUser(id, userId) {
      return db.get("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
    },

    async updateJobFields(id, userId, title, description, now) {
      await db.run(
        `
          UPDATE jobs
          SET title = ?, description = ?, updated_at = ?
          WHERE id = ? AND user_id = ?
        `,
        [title, description, now, id, userId]
      );

      return db.get("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
    },

    async updateJobImagePath(id, userId, imagePath, now) {
      await db.run(
        `
          UPDATE jobs
          SET image_path = ?, updated_at = ?
          WHERE id = ? AND user_id = ?
        `,
        [imagePath, now, id, userId]
      );

      return db.get("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
    },

    async deleteJobByIdForUser(id, userId) {
      await db.run("DELETE FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
    },

    async updateJobStatus(id, userId, status, result, error, s3Key, now) {
      await db.run(
        `
          UPDATE jobs
          SET status = ?, result = ?, error = ?, s3_key = ?, updated_at = ?
          WHERE id = ? AND user_id = ?
        `,
        [status, result, error, s3Key, now, id, userId]
      );

      return db.get("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
    },
  };
}

module.exports = {
  createJobsRepository,
};
