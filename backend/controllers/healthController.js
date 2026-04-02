import HealthEntry from "../models/HealthEntry.js";

export const addHealthEntry = async (req, res) => {
  try {
    const { date, notes } = req.body;

    if (!notes || !String(notes).trim()) {
      return res.status(400).json({ message: "Notes are required" });
    }

    const entryDate = date ? new Date(date) : new Date();

    if (Number.isNaN(entryDate.getTime())) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const created = await HealthEntry.create({
      userId: req.user.id,
      entryDate,
      notes: String(notes).trim(),
    });

    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: "Failed to add health note" });
  }
};

export const getHealthEntries = async (req, res) => {
  try {
    const entries = await HealthEntry.find({ userId: req.user.id })
      .sort({ entryDate: -1, createdAt: -1 })
      .lean();

    return res.status(200).json(entries);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch health notes" });
  }
};

export const deleteHealthEntry = async (req, res) => {
  try {
    const deleted = await HealthEntry.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Health note not found" });
    }

    return res.status(200).json({ message: "Health note deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete health note" });
  }
};
