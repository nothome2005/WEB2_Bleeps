jest.mock("../../../src/repositories/jobsRepository", () => ({
  createJobsRepository: jest.fn(),
}));

const { createJobsRepository } = require("../../../src/repositories/jobsRepository");
const { createJobsService } = require("../../../src/services/jobsService");

describe("jobsService (unit)", () => {
  let repository;
  let service;

  beforeEach(() => {
    repository = {
      createJob: jest.fn(),
      listJobsByUser: jest.fn(),
      getJobByIdForUser: jest.fn(),
      updateJobFields: jest.fn(),
      deleteJobByIdForUser: jest.fn(),
      updateJobStatus: jest.fn(),
    };

    createJobsRepository.mockReturnValue(repository);
    service = createJobsService({});
  });

  test("create: throws 400 when title is missing", async () => {
    await expect(service.create("user-1", { description: "x" })).rejects.toMatchObject({
      status: 400,
      message: "title is required and must be a string",
    });
  });

  test("create: throws 400 when description is not a string", async () => {
    await expect(service.create("user-1", { title: "job", description: 123 })).rejects.toMatchObject({
      status: 400,
      message: "description must be a string when provided",
    });
  });

  test("getById: throws 404 when job does not exist", async () => {
    repository.getJobByIdForUser.mockResolvedValue(null);

    await expect(service.getById("user-1", 777)).rejects.toMatchObject({
      status: 404,
      message: "job not found",
    });
  });

  test("updateStatus: throws 400 for invalid status", async () => {
    await expect(service.updateStatus("user-1", 1, { status: "BAD" })).rejects.toMatchObject({
      status: 400,
      message: "invalid status",
    });
  });

  test("updateStatus: throws 409 for invalid transition", async () => {
    repository.getJobByIdForUser.mockResolvedValue({
      id: 1,
      user_id: "user-1",
      status: "DONE",
    });

    await expect(service.updateStatus("user-1", 1, { status: "CREATED" })).rejects.toMatchObject({
      status: 409,
      message: "invalid transition: DONE -> CREATED",
    });
  });

  test("updateStatus: publishes message on CREATED -> QUEUED", async () => {
    const broker = {
      publishMessage: jest.fn().mockResolvedValue(undefined),
    };

    service = createJobsService({}, broker);

    repository.getJobByIdForUser.mockResolvedValue({
      id: 1,
      user_id: "user-1",
      title: "My Job",
      status: "CREATED",
      idempotency_key: "idem-1",
    });

    repository.updateJobStatus.mockResolvedValue({
      id: 1,
      user_id: "user-1",
      title: "My Job",
      description: null,
      status: "QUEUED",
      result: null,
      error: null,
      idempotency_key: "idem-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:01.000Z",
    });

    const updated = await service.updateStatus("user-1", 1, { status: "QUEUED" });

    expect(updated.status).toBe("QUEUED");
    expect(broker.publishMessage).toHaveBeenCalledTimes(1);
    expect(broker.publishMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 1,
        userId: "user-1",
        title: "My Job",
        idempotencyKey: "idem-1",
      })
    );
  });

  test("updateStatus: maps broker failure to 500", async () => {
    const broker = {
      publishMessage: jest.fn().mockRejectedValue(new Error("broker down")),
    };

    service = createJobsService({}, broker);

    repository.getJobByIdForUser.mockResolvedValue({
      id: 1,
      user_id: "user-1",
      title: "My Job",
      status: "CREATED",
      idempotency_key: "idem-1",
    });

    repository.updateJobStatus.mockResolvedValue({
      id: 1,
      user_id: "user-1",
      title: "My Job",
      description: null,
      status: "QUEUED",
      result: null,
      error: null,
      idempotency_key: "idem-1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:01.000Z",
    });

    await expect(service.updateStatus("user-1", 1, { status: "QUEUED" })).rejects.toMatchObject({
      status: 500,
      message: "Failed to queue job for processing",
    });
  });
});
