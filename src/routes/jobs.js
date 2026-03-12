const express = require("express");
const { createJobsService } = require("../services/jobsService");

function sendServiceError(res, error) {
  const status = error?.status || 500;
  const message = status === 500 ? "internal server error" : error.message;
  return res.status(status).json({ error: message });
}

function createJobsRouter(db) {
  const router = express.Router();
  const jobsService = createJobsService(db);

  router.post("/jobs", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const job = await jobsService.create(userId, req.body);
      return res.status(201).json(job);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.get("/jobs", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const jobs = await jobsService.list(userId);
      return res.json(jobs);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.get("/jobs/:id", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const job = await jobsService.getById(userId, req.params.id);
      return res.json(job);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.put("/jobs/:id", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const updated = await jobsService.update(userId, req.params.id, req.body);
      return res.json(updated);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.delete("/jobs/:id", async (req, res) => {
    try {
      const userId = req.auth.userId;
      await jobsService.remove(userId, req.params.id);
      return res.status(204).send();
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.patch("/jobs/:id/status", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const updated = await jobsService.updateStatus(userId, req.params.id, req.body);
      return res.json(updated);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  return router;
}

module.exports = {
  createJobsRouter,
};
