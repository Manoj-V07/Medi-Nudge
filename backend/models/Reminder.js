import mongoose from "mongoose";

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Prescription",
      required: true,
      index: true,
    },
    medicineName: {
      type: String,
      required: true,
      trim: true,
    },
    dosageMg: {
      type: Number,
      required: true,
    },
    scheduledFor: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "taken", "missed"],
      default: "pending",
      index: true,
    },
    action: {
      type: String,
      enum: ["taken", "skip", "snooze"],
      default: null,
    },
    actionAt: {
      type: Date,
      default: null,
    },
    snoozeCount: {
      type: Number,
      default: 0,
    },
    firstNotifiedAt: {
      type: Date,
      default: null,
    },
    lastNotifiedAt: {
      type: Date,
      default: null,
    },
    remindedAfter10Min: {
      type: Boolean,
      default: false,
    },
    caregiverAlertSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Reminder = mongoose.model("Reminder", reminderSchema);

export default Reminder;
