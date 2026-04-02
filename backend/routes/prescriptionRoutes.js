import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  createPrescription,
  deletePrescription,
  getPrescriptions,
} from "../controllers/prescriptionController.js";

const router = express.Router();

router.post("/", authMiddleware, createPrescription);
router.get("/", authMiddleware, getPrescriptions);
router.delete("/:id", authMiddleware, deletePrescription);

export default router;
