function createJobsRepository(db) {
  return {
    async createJob(userId, title, description, now, status) {
      const result = await db.run(
        `
          INSERT INTO jobs (user_id, title, description, status, result, error, created_at, updated_at)
          VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
        `,
        [userId, title, description, status, now, now]
      );

      return db.get("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [result.lastID, userId]);
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

    async deleteJobByIdForUser(id, userId) {
      await db.run("DELETE FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
    },

    async updateJobStatus(id, userId, status, result, error, now) {
      await db.run(
        `
          UPDATE jobs
          SET status = ?, result = ?, error = ?, updated_at = ?
          WHERE id = ? AND user_id = ?
        `,
        [status, result, error, now, id, userId]
      );

      return db.get("SELECT * FROM jobs WHERE id = ? AND user_id = ?", [id, userId]);
    },
  };
}

module.exports = {
  createJobsRepository,
};
