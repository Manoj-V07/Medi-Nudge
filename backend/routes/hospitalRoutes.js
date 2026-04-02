import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { getNearbyHospitals } from "../controllers/hospitalController.js";

const router = express.Router();

// Minimal API: fetch nearby hospitals using user coordinates.
router.get("/", authMiddleware, getNearbyHospitals);

export default router;
