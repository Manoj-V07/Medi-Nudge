import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getTodayReminders } from "../controllers/reminderController.js";

const router = express.Router();

router.get("/reminders", authMiddleware, getTodayReminders);

export default router;
