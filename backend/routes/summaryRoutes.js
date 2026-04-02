import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  generateSummary,
  getLatestSummary,
} from "../controllers/summaryController.js";

const router = express.Router();

router.post("/generate", authMiddleware, generateSummary);
router.get("/", authMiddleware, getLatestSummary);

export default router;
