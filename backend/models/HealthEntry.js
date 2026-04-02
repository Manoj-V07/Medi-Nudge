import mongoose from "mongoose";

const healthEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    entryDate: {
      type: Date,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  {
    timestamps: true,
  }
);

const HealthEntry = mongoose.model("HealthEntry", healthEntrySchema);

export default HealthEntry;
