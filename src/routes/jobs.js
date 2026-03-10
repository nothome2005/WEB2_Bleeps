const express = require("express");

const STATUSES = {
  CREATED: "CREATED",
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  DONE: "DONE",
  ERROR: "ERROR",
};

const ALLOWED_TRANSITIONS = {
  [STATUSES.CREATED]: new Set([STATUSES.QUEUED]),
  [STATUSES.QUEUED]: new Set([STATUSES.PROCESSING, STATUSES.ERROR]),
  [STATUSES.PROCESSING]: new Set([STATUSES.DONE, STATUSES.ERROR]),
  [STATUSES.DONE]: new Set(),
  [STATUSES.ERROR]: new Set(),
};

function isValidStatus(status) {
  return Object.values(STATUSES).includes(status);
}

function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Boolean(allowed && allowed.has(toStatus));
}

function toJobResponse(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }
  return value.trim();
}

function createJobsRouter(db) {
  const router = express.Router();

  router.post("/jobs", async (req, res) => {
    const { title, description = null } = req.body ?? {};
    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle) {
      return res.status(400).json({ error: "title is required and must be a string" });
    }

    const normalizedDescription = description == null ? null : normalizeText(description);
    if (description != null && normalizedDescription == null) {
      return res.status(400).json({ error: "description must be a string when provided" });
    }

    const now = new Date().toISOString();
    const result = await db.run(
      `
        INSERT INTO jobs (title, description, status, result, error, created_at, updated_at)
        VALUES (?, ?, ?, NULL, NULL, ?, ?)
      `,
      [normalizedTitle, normalizedDescription, STATUSES.CREATED, now, now]
    );

    const job = await db.get("SELECT * FROM jobs WHERE id = ?", [result.lastID]);
    return res.status(201).json(toJobResponse(job));
  });

  router.get("/jobs", async (_req, res) => {
    const rows = await db.all("SELECT * FROM jobs ORDER BY id DESC");
    res.json(rows.map(toJobResponse));
  });

  router.get("/jobs/:id", async (req, res) => {
    const job = await db.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    if (!job) {
      return res.status(404).json({ error: "job not found" });
    }
    return res.json(toJobResponse(job));
  });

  router.put("/jobs/:id", async (req, res) => {
    const { title, description = null } = req.body ?? {};
    const normalizedTitle = normalizeText(title);
    if (!normalizedTitle) {
      return res.status(400).json({ error: "title is required and must be a string" });
    }

    const normalizedDescription = description == null ? null : normalizeText(description);
    if (description != null && normalizedDescription == null) {
      return res.status(400).json({ error: "description must be a string when provided" });
    }

    const existing = await db.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: "job not found" });
    }

    const now = new Date().toISOString();
    await db.run(
      `
        UPDATE jobs
        SET title = ?, description = ?, updated_at = ?
        WHERE id = ?
      `,
      [normalizedTitle, normalizedDescription, now, req.params.id]
    );

    const updated = await db.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    return res.json(toJobResponse(updated));
  });

  router.delete("/jobs/:id", async (req, res) => {
    const existing = await db.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: "job not found" });
    }

    await db.run("DELETE FROM jobs WHERE id = ?", [req.params.id]);
    return res.status(204).send();
  });

  router.patch("/jobs/:id/status", async (req, res) => {
    const { status, result = null, error = null } = req.body ?? {};
    if (!isValidStatus(status)) {
      return res.status(400).json({ error: "invalid status" });
    }

    const job = await db.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    if (!job) {
      return res.status(404).json({ error: "job not found" });
    }

    if (!canTransition(job.status, status)) {
      return res.status(409).json({
        error: `invalid transition: ${job.status} -> ${status}`,
      });
    }

    const nextResult = status === STATUSES.DONE ? result : null;
    const nextError = status === STATUSES.ERROR ? error || "Unknown processing error" : null;
    const now = new Date().toISOString();

    await db.run(
      `
        UPDATE jobs
        SET status = ?, result = ?, error = ?, updated_at = ?
        WHERE id = ?
      `,
      [status, nextResult, nextError, now, req.params.id]
    );

    const updated = await db.get("SELECT * FROM jobs WHERE id = ?", [req.params.id]);
    return res.json(toJobResponse(updated));
  });

  return router;
}

module.exports = {
  createJobsRouter,
};
