const express = require("express");
const { createJobsService } = require("../services/jobsService");
const { storageService } = require("../services/storageService");

function sendServiceError(res, error) {
  const status = error?.status || 500;
  const message = status === 500 ? "internal server error" : error.message;
  return res.status(status).json({ error: message });
}

const PUBLIC_API_BASE = process.env.PUBLIC_API_BASE || "http://localhost:3000";

const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../data"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

function createJobsRouter(db, broker = null) {
  const router = express.Router();
  const jobsService = createJobsService(db, broker);

  function attachDownloadUrl(job) {
    if (job && (job.result || job.s3Key)) {
      job.downloadUrl = `${PUBLIC_API_BASE}/jobs/${job.id}/result`;
    }
    return job;
  }

  router.post("/jobs", upload.single("image"), async (req, res) => {
    try {
      const userId = req.auth.userId;
      const jobData = {
        title: req.body.title || "Untitled Job",
        description: req.body.description,
        imagePath: req.file ? req.file.filename : null,
      };
      const job = await jobsService.create(userId, jobData);
      return res.status(201).json(job);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.get("/jobs", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const jobs = await jobsService.list(userId);
      const mappedJobs = jobs.map(attachDownloadUrl);
      return res.json(mappedJobs);
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.get("/jobs/:id", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const job = await jobsService.getById(userId, req.params.id);
      return res.json(attachDownloadUrl(job));
    } catch (error) {
      return sendServiceError(res, error);
    }
  });

  router.get("/jobs/:id/result", async (req, res) => {
    try {
      const userId = req.auth.userId;
      const job = await jobsService.getById(userId, req.params.id);
      const resultKey = job.result || job.s3Key;
      if (!resultKey) {
        return res.status(404).json({ error: "result not found" });
      }

      const content = await storageService.getObjectText(resultKey);
      return res.type("text/plain").send(content);
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
