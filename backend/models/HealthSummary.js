import mongoose from "mongoose";

const healthSummarySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    frequencyType: {
      type: String,
      enum: ["weekly", "15days", "monthly", "custom"],
      default: "weekly",
    },
    intervalDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 365,
    },
    lastSummaryDate: {
      type: Date,
      default: null,
    },
    summaryText: {
      type: String,
      default: "",
    },
    insightsText: {
      type: String,
      default: "",
    },
    periodStart: {
      type: Date,
      default: null,
    },
    periodEnd: {
      type: Date,
      default: null,
    },
    noteCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const HealthSummary = mongoose.model("HealthSummary", healthSummarySchema);

export default HealthSummary;
