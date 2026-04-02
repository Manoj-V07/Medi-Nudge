import { generateTodayRemindersForUser } from "../services/reminderService.js";

export const getTodayReminders = async (req, res) => {
  try {
    const reminders = await generateTodayRemindersForUser(req.user.id);
    return res.status(200).json(reminders);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch reminders" });
  }
};
