import Reminder from "../models/Reminder.js";
import User from "../models/User.js";

let isSchedulerRunning = false;

const TEN_MINUTES = 10 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

const runReminderCycle = async () => {
  try {
    const now = new Date();
    const pendingReminders = await Reminder.find({
      status: "pending",
      scheduledFor: { $lte: now },
    });

    for (const reminder of pendingReminders) {
      // First due notification.
      if (!reminder.firstNotifiedAt) {
        console.log(
          `[NOTIFY] ${reminder.medicineName} (${reminder.dosageMg}mg) due at ${reminder.scheduledFor.toLocaleTimeString()}`
        );

        reminder.firstNotifiedAt = now;
        reminder.lastNotifiedAt = now;
        await reminder.save();
        continue;
      }

      const elapsed = now.getTime() - reminder.firstNotifiedAt.getTime();

      // If user did not respond in 10 minutes, send one more reminder.
      if (elapsed >= TEN_MINUTES && !reminder.remindedAfter10Min) {
        console.log(
          `[REMIND AGAIN] ${reminder.medicineName} was not acknowledged in 10 minutes.`
        );

        reminder.remindedAfter10Min = true;
        reminder.lastNotifiedAt = now;
        await reminder.save();
      }

      // If still no response after 30 minutes, escalate to caregiver and mark missed.
      if (elapsed >= THIRTY_MINUTES && !reminder.caregiverAlertSent) {
        const user = await User.findById(reminder.userId).select("name caregiverPhone");
        const caregiverPhone = user?.caregiverPhone || "No caregiver number found";

        console.log(
          `[CAREGIVER ALERT] ${reminder.medicineName} missed for user ${user?.name || "Unknown"}. Caregiver: ${caregiverPhone}`
        );

        reminder.caregiverAlertSent = true;
        reminder.status = "missed";
        await reminder.save();
      }
    }
  } catch (error) {
    console.error("Reminder scheduler error:", error.message);
  }
};

export const startReminderScheduler = () => {
  if (isSchedulerRunning) {
    return;
  }

  isSchedulerRunning = true;
  setInterval(runReminderCycle, 60 * 1000);
  console.log("Reminder scheduler started");
};
