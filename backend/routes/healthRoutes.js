import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  addHealthEntry,
  deleteHealthEntry,
  getHealthEntries,
} from "../controllers/healthController.js";

const router = express.Router();

router.post("/", authMiddleware, addHealthEntry);
router.get("/", authMiddleware, getHealthEntries);
router.delete("/:id", authMiddleware, deleteHealthEntry);

export default router;
