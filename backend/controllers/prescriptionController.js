import Prescription from "../models/Prescription.js";
import Reminder from "../models/Reminder.js";

const validateTiming = (timing) => {
  if (!timing || typeof timing !== "object") {
    return "Timing is required";
  }

  if (!["standard", "frequency", "interval"].includes(timing.mode)) {
    return "Invalid timing mode";
  }

  if (timing.mode === "standard") {
    const pattern = timing.standardPattern;

    if (!Array.isArray(pattern) || pattern.length !== 4) {
      return "Standard timing must be an array of 4 values";
    }

    const validPattern = pattern.every((value) => value === 0 || value === 1);

    if (!validPattern || pattern.every((value) => value === 0)) {
      return "Select at least one standard timing slot";
    }

    return null;
  }

  if (timing.mode === "frequency") {
    const count = Number(timing.frequencyPerDay);
    if (![1, 2, 3, 4].includes(count)) {
      return "Frequency must be 1, 2, 3, or 4 times per day";
    }
    return null;
  }

  const intervalHours = Number(timing.intervalHours);
  if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 24) {
    return "Interval must be between 1 and 24 hours";
  }

  return null;
};

const normalizeTiming = (timing) => {
  if (timing.mode === "standard") {
    return {
      mode: "standard",
      standardPattern: timing.standardPattern.map((value) => (value ? 1 : 0)),
    };
  }

  if (timing.mode === "frequency") {
    return {
      mode: "frequency",
      frequencyPerDay: Number(timing.frequencyPerDay),
    };
  }

  return {
    mode: "interval",
    intervalHours: Number(timing.intervalHours),
  };
};

export const createPrescription = async (req, res) => {
  try {
    const { medicineName, dosageMg, durationDays, notes, timing } = req.body;

    if (!medicineName || !dosageMg || !durationDays || !timing) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (Number(dosageMg) <= 0 || Number(durationDays) <= 0) {
      return res.status(400).json({ message: "Dosage and duration must be positive numbers" });
    }

    const timingError = validateTiming(timing);

    if (timingError) {
      return res.status(400).json({ message: timingError });
    }

    const prescription = await Prescription.create({
      userId: req.user.id,
      medicineName: medicineName.trim(),
      dosageMg: Number(dosageMg),
      durationDays: Number(durationDays),
      notes: notes?.trim() || "",
      timing: normalizeTiming(timing),
    });

    return res.status(201).json(prescription);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create prescription" });
  }
};

export const getPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ userId: req.user.id }).sort({ createdAt: -1 });
    return res.status(200).json(prescriptions);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch prescriptions" });
  }
};

export const deletePrescription = async (req, res) => {
  try {
    const deleted = await Prescription.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Prescription not found" });
    }

    await Reminder.deleteMany({
      userId: req.user.id,
      prescriptionId: deleted._id,
      status: "pending",
    });

    return res.status(200).json({ message: "Prescription deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete prescription" });
  }
};
