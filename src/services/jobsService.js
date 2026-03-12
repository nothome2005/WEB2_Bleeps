const { createJobsRepository } = require("../repositories/jobsRepository");

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

function toJobResponse(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createJobsService(db) {
  const repository = createJobsRepository(db);

  return {
    async create(userId, payload) {
      const { title, description = null } = payload ?? {};
      const normalizedTitle = normalizeText(title);
      if (!normalizedTitle) {
        throw createHttpError(400, "title is required and must be a string");
      }

      const normalizedDescription = description == null ? null : normalizeText(description);
      if (description != null && normalizedDescription == null) {
        throw createHttpError(400, "description must be a string when provided");
      }

      const now = new Date().toISOString();
      const job = await repository.createJob(
        userId,
        normalizedTitle,
        normalizedDescription,
        now,
        STATUSES.CREATED
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
        now
      );

      return toJobResponse(updated);
    },
  };
}

module.exports = {
  createJobsService,
};
