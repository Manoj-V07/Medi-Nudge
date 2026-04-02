import Prescription from "../models/Prescription.js";

const STANDARD_SLOT_TIMES = ["08:00", "13:00", "18:00", "21:00"];
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 20;

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const getDurationDays = (prescription) => {
  const rawValue = prescription.durationDays ?? prescription.duration;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeTiming = (timing) => {
  if (!timing) {
    return { type: "standard", value: [1, 0, 0, 0] };
  }

  if (timing.type) {
    return {
      type: timing.type,
      value: timing.value,
    };
  }

  if (timing.mode === "standard") {
    return {
      type: "standard",
      value: timing.standardPattern || timing.value || [1, 0, 0, 0],
    };
  }

  if (timing.mode === "frequency") {
    return {
      type: "frequency",
      value: timing.frequencyPerDay || timing.value || 1,
    };
  }

  return {
    type: "interval",
    value: timing.intervalHours || timing.value || 6,
  };
};

const parseTimeForDate = (baseDate, hhmm) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const value = new Date(baseDate);
  value.setHours(hours, minutes, 0, 0);
  return value;
};

const formatHHmm = (date) => {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const isPrescriptionActiveToday = (prescription, todayStart) => {
  const durationDays = getDurationDays(prescription);

  if (durationDays <= 0) {
    return false;
  }

  const startDate = startOfDay(prescription.createdAt || prescription.startDate || new Date());
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays - 1);
  endDate.setHours(23, 59, 59, 999);

  return todayStart >= startDate && todayStart <= endDate;
};

const getStandardTimes = (todayStart, patternValue) => {
  const pattern = Array.isArray(patternValue) ? patternValue : [1, 0, 0, 0];
  const times = [];

  pattern.forEach((flag, index) => {
    if (flag === 1 && STANDARD_SLOT_TIMES[index]) {
      times.push(parseTimeForDate(todayStart, STANDARD_SLOT_TIMES[index]));
    }
  });

  return times;
};

const getFrequencyTimes = (todayStart, frequencyValue) => {
  const count = Math.max(1, Number(frequencyValue) || 1);

  if (count === 1) {
    return [parseTimeForDate(todayStart, "08:00")];
  }

  const step = (DAY_END_HOUR - DAY_START_HOUR) / (count - 1);
  const hourSet = new Set();

  for (let index = 0; index < count; index += 1) {
    const hour = Math.round(DAY_START_HOUR + step * index);
    hourSet.add(Math.min(23, Math.max(0, hour)));
  }

  return Array.from(hourSet)
    .sort((a, b) => a - b)
    .map((hour) => {
      const value = new Date(todayStart);
      value.setHours(hour, 0, 0, 0);
      return value;
    });
};

const getIntervalTimes = (todayStart, intervalValue) => {
  const intervalHours = Math.max(1, Number(intervalValue) || 1);
  const times = [];

  for (let hour = DAY_START_HOUR; hour < 24; hour += intervalHours) {
    const value = new Date(todayStart);
    value.setHours(hour, 0, 0, 0);
    times.push(value);
  }

  return times;
};

const getTimesForToday = (todayStart, timing) => {
  if (timing.type === "standard") {
    return getStandardTimes(todayStart, timing.value);
  }

  if (timing.type === "frequency") {
    return getFrequencyTimes(todayStart, timing.value);
  }

  return getIntervalTimes(todayStart, timing.value);
};

export const generateTodayRemindersForUser = async (userId) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const scheduledDate = todayStart.toISOString().slice(0, 10);

  const prescriptions = await Prescription.find({ userId })
    .select("medicineName dosageMg dosage timing duration durationDays createdAt startDate")
    .lean();

  const reminders = [];

  for (const prescription of prescriptions) {
    if (!isPrescriptionActiveToday(prescription, todayStart)) {
      continue;
    }

    const timing = normalizeTiming(prescription.timing);
    const times = getTimesForToday(todayStart, timing);

    for (const time of times) {
      reminders.push({
        medicineName: prescription.medicineName,
        dosage: prescription.dosageMg ?? prescription.dosage ?? 0,
        time: formatHHmm(time),
        status: "pending",
        scheduledDate,
        scheduledAt: time,
      });
    }
  }

  reminders.sort((a, b) => a.scheduledAt - b.scheduledAt);

  return reminders.map(({ scheduledAt, ...reminder }) => reminder);
};
