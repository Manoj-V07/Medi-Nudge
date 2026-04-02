import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import prescriptionRoutes from "./routes/prescriptionRoutes.js";
import reminderRoutes from "./routes/reminderRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import summaryRoutes from "./routes/summaryRoutes.js";
import hospitalRoutes from "./routes/hospitalRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  ...(process.env.CLIENT_URLS || "").split(",").map((value) => value.trim()).filter(Boolean),
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL.trim()] : []),
  "http://localhost:5173",
];

const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

connectDB();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header) and approved frontend origins.
      if (!origin || uniqueAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/prescription", prescriptionRoutes);
app.use("/api", reminderRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/hospitals", hospitalRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
