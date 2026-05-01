const { createJobsRepository } = require("../repositories/jobsRepository");
const { v4: uuidv4 } = require("uuid");

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

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isValidStatus(status) {
  return Object.values(STATUSES).includes(status);
}

function canTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  return Boolean(allowed && allowed.has(toStatus));
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }
  return value.trim();
}

function normalizeOptionalText(value) {
  if (value == null) {
    return null;
  }

  const normalized = normalizeText(value);
  if (normalized == null) {
    return null;
  }

  return normalized;
}

function toJobResponse(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    imagePath: row.image_path,
    status: row.status,
    result: row.result ?? row.s3_key ?? null,
    s3Key: row.s3_key ?? null,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createJobsService(db, broker = null) {
  const repository = createJobsRepository(db);

  async function publishJobToQueue(jobId, userId, title, imagePath, idempotencyKey) {
    if (!broker) {
      console.warn("[JobsService] Broker not configured, skipping message publish");
      return;
    }

    try {
      await broker.publishMessage({
        jobId,
        userId,
        title,
        imagePath,
        idempotencyKey,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[JobsService] Failed to publish job to queue:", error);
      throw createHttpError(500, "Failed to queue job for processing");
    }
  }

  return {
    async create(userId, payload) {
      const { title, description = null, imagePath = null } = payload ?? {};
      const normalizedTitle = normalizeText(title);
      if (!normalizedTitle) {
        throw createHttpError(400, "title is required and must be a string");
      }

      const normalizedDescription = normalizeOptionalText(description);
      if (description != null && normalizedDescription == null) {
        throw createHttpError(400, "description must be a string when provided");
      }

      const normalizedImagePath = normalizeOptionalText(imagePath);
      if (imagePath != null && !normalizedImagePath) {
        throw createHttpError(400, "imagePath must be a string when provided");
      }

      const now = new Date().toISOString();
      const idempotencyKey = uuidv4();

      const job = await repository.createJob(
        userId,
        normalizedTitle,
        normalizedDescription,
        normalizedImagePath,
        now,
        STATUSES.CREATED,
        idempotencyKey
      );
      return toJobResponse(job);
    },

    async list(userId) {
      const rows = await repository.listJobsByUser(userId);
      return rows.map(toJobResponse);
    },

    async getById(userId, id) {
      const job = await repository.getJobByIdForUser(id, userId);
      if (!job) {
        throw createHttpError(404, "job not found");
      }
      return toJobResponse(job);
    },

    async update(userId, id, payload) {
      const { title, description = null } = payload ?? {};
      const normalizedTitle = normalizeText(title);
      if (!normalizedTitle) {
        throw createHttpError(400, "title is required and must be a string");
      }

      const normalizedDescription = description == null ? null : normalizeText(description);
      if (description != null && normalizedDescription == null) {
        throw createHttpError(400, "description must be a string when provided");
      }

      const existing = await repository.getJobByIdForUser(id, userId);
      if (!existing) {
        throw createHttpError(404, "job not found");
      }

      const now = new Date().toISOString();
      const updated = await repository.updateJobFields(
        id,
        userId,
        normalizedTitle,
        normalizedDescription,
        now
      );

      return toJobResponse(updated);
    },

    async remove(userId, id) {
      const existing = await repository.getJobByIdForUser(id, userId);
      if (!existing) {
        throw createHttpError(404, "job not found");
      }

      await repository.deleteJobByIdForUser(id, userId);
    },

    async updateStatus(userId, id, payload) {
      const { status, result = null, error = null } = payload ?? {};
      if (!isValidStatus(status)) {
        throw createHttpError(400, "invalid status");
      }

      const job = await repository.getJobByIdForUser(id, userId);
      if (!job) {
        throw createHttpError(404, "job not found");
      }

      if (!canTransition(job.status, status)) {
        throw createHttpError(409, `invalid transition: ${job.status} -> ${status}`);
      }

      const nextResult = status === STATUSES.DONE ? result : null;
      const nextError = status === STATUSES.ERROR ? error || "Unknown processing error" : null;
      const now = new Date().toISOString();

      const updated = await repository.updateJobStatus(
        id,
        userId,
        status,
        nextResult,
        nextError,
        null,
        now
      );

      // If transitioning to QUEUED, publish to message broker
      if (status === STATUSES.QUEUED) {
        await publishJobToQueue(
          updated.id,
          userId,
          updated.title,
          updated.image_path,
          updated.idempotency_key
        );
      }

      return toJobResponse(updated);
    },
  };
}

module.exports = {
  createJobsService,
};
