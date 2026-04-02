import mongoose from "mongoose";

const timingSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ["standard", "frequency", "interval"],
      required: true,
    },
    standardPattern: {
      type: [Number],
      default: undefined,
    },
    frequencyPerDay: {
      type: Number,
      default: undefined,
    },
    intervalHours: {
      type: Number,
      default: undefined,
    },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      min: 1,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    timing: {
      type: timingSchema,
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Prescription = mongoose.model("Prescription", prescriptionSchema);

export default Prescription;
