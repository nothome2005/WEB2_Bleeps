const { createJobsRepository } = require("../repositories/jobsRepository");
const broker = require("../broker");
const { EVENT_QUEUE_NAME, EVENT_ROUTING_KEYS, EXCHANGE_NAME } = broker;
const { broadcastToUser } = require("../ws");
const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || "http://localhost:3000";

function nowIso() {
  return new Date().toISOString();
}

async function moveJobStatus(repository, event) {
  const jobId = event.jobId;
  const userId = event.userId;

  if (!jobId || !userId) {
    throw new Error("worker event must include jobId and userId");
  }

  const current = await repository.getJobByIdForUser(jobId, userId);
  if (!current) {
    console.warn("[WorkerEvents] Job not found for event", { jobId, userId });
    return;
  }

  if (event.status === "PROCESSING") {
    if (current.status === "PROCESSING") {
      return;
    }

    await repository.updateJobStatus(jobId, userId, "PROCESSING", null, null, null, nowIso());
    return;
  }

  if (event.status === "DONE") {
    if (current.status !== "PROCESSING") {
      await repository.updateJobStatus(jobId, userId, "PROCESSING", null, null, null, nowIso());
    }

    await repository.updateJobStatus(
      jobId,
      userId,
      "DONE",
      event.s3Key ?? event.result ?? null,
      null,
      event.s3Key ?? null,
      nowIso()
    );
    return;
  }

  if (event.status === "ERROR") {
    if (current.status !== "PROCESSING") {
      await repository.updateJobStatus(jobId, userId, "PROCESSING", null, null, null, nowIso());
    }

    await repository.updateJobStatus(
      jobId,
      userId,
      "ERROR",
      null,
      event.error || "Unknown processing error",
      null,
      nowIso()
    );
  }
}

async function startWorkerEventConsumer(db, brokerInstance) {
  const repository = createJobsRepository(db);

  async function broadcastJobSnapshot(payload) {
    const fullJob = await repository.getJobByIdForUser(payload.jobId, payload.userId);
    if (!fullJob) {
      return;
    }

    const jobResponse = {
      id: fullJob.id,
      userId: fullJob.user_id,
      title: fullJob.title,
      description: fullJob.description,
      imagePath: fullJob.image_path,
      status: fullJob.status,
      result: fullJob.result ?? fullJob.s3_key ?? null,
      error: fullJob.error,
      createdAt: fullJob.created_at,
      updatedAt: fullJob.updated_at,
    };

    if (jobResponse.result) {
      jobResponse.downloadUrl = `${PUBLIC_API_BASE}/jobs/${fullJob.id}/result`;
    }

    broadcastToUser(payload.userId, {
      type: "job_updated",
      job: jobResponse,
      event: payload,
    });
  }

  // Use broker's subscribe method which handles all channel operations
  await brokerInstance.subscribeToWorkerEvents(async (payload, routingKey) => {
    if (routingKey === "transcription.progress") {
      console.log("[WorkerEvents] Progress", {
        jobId: payload.jobId,
        userId: payload.userId,
        progress: payload.progress,
        message: payload.message,
      });
      await broadcastJobSnapshot(payload);
    } else {
      await moveJobStatus(repository, payload);
      await broadcastJobSnapshot(payload);
    }
  });

  console.log("[WorkerEvents] Consumer ready");
}

module.exports = {
  startWorkerEventConsumer,
};