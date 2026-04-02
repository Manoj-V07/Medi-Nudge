import HealthEntry from "../models/HealthEntry.js";
import HealthSummary from "../models/HealthSummary.js";
import User from "../models/User.js";

const startOfDay = (date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};

const resolveSettings = (payload, currentSummary) => {
  const nextType = payload?.frequencyType || currentSummary?.frequencyType || "weekly";

  if (nextType === "weekly") {
    return { frequencyType: nextType, intervalDays: 7 };
  }

  if (nextType === "15days") {
    return { frequencyType: nextType, intervalDays: 15 };
  }

  if (nextType === "monthly") {
    return { frequencyType: nextType, intervalDays: 30 };
  }

  const customDays = Number(payload?.customDays || payload?.intervalDays || currentSummary?.intervalDays || 7);
  return {
    frequencyType: "custom",
    intervalDays: Math.max(1, Math.min(365, customDays)),
  };
};

const splitSummarySections = (text) => {
  const sections = String(text || "").split(/\n\s*Insights\s*:/i);

  if (sections.length === 1) {
    return {
      summaryText: sections[0].replace(/^Summary\s*:/i, "").trim(),
      insightsText: "General insights were included in the summary text.",
    };
  }

  return {
    summaryText: sections[0].replace(/^Summary\s*:/i, "").trim(),
    insightsText: sections.slice(1).join("\n").trim(),
  };
};

const generateGroqSummary = async (notesPayload) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("Groq API key missing");
  }

  const prompt = [
    "Summarize the following health notes and provide general insights. Do not give medical advice or diagnosis.",
    "Return exactly two sections:",
    "Summary:",
    "Insights:",
    "",
    notesPayload,
  ].join("\n");

  const modelName = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: "system",
          content:
            "You summarize personal health notes into clear, non-medical summaries and general insights only. Never provide diagnosis or treatment advice. Return two sections titled Summary: and Insights:.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error("Groq summary request failed");
  }

  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content?.trim() || "";

  if (!text.trim()) {
    throw new Error("Groq returned empty content");
  }

  return splitSummarySections(text);
};

export const generateSummary = async (req, res) => {
  try {
    const existing = await HealthSummary.findOne({ userId: req.user.id });
    const { frequencyType, intervalDays } = resolveSettings(req.body, existing);
    const forceGenerate = Boolean(req.body?.force);

    const now = new Date();
    const dueDate = existing?.lastSummaryDate
      ? new Date(existing.lastSummaryDate.getTime() + intervalDays * 24 * 60 * 60 * 1000)
      : null;

    if (!forceGenerate && dueDate && now < dueDate) {
      return res.status(200).json({
        generated: false,
        message: "Summary not due yet",
        summary: existing,
      });
    }

    const periodEnd = endOfDay(now);
    const periodStart = startOfDay(now);
    periodStart.setDate(periodStart.getDate() - (intervalDays - 1));

    const notes = await HealthEntry.find({
      userId: req.user.id,
      entryDate: { $gte: periodStart, $lte: periodEnd },
    })
      .sort({ entryDate: 1, createdAt: 1 })
      .lean();

    let summaryText = "No health notes found for the selected period.";
    let insightsText = "Write daily notes to get meaningful summaries and trends.";

    if (notes.length > 0) {
      const notesPayload = notes
        .map((item) => `${new Date(item.entryDate).toISOString().slice(0, 10)}: ${item.notes}`)
        .join("\n");

      const groqOutput = await generateGroqSummary(notesPayload);
      summaryText = groqOutput.summaryText;
      insightsText = groqOutput.insightsText;
    }

    const summary = await HealthSummary.findOneAndUpdate(
      { userId: req.user.id },
      {
        userId: req.user.id,
        frequencyType,
        intervalDays,
        lastSummaryDate: now,
        summaryText,
        insightsText,
        periodStart,
        periodEnd,
        noteCount: notes.length,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const user = await User.findById(req.user.id).select("name caregiverPhone").lean();
    console.log(
      `[CAREGIVER SIMULATION] Summary sent to caregiver ${user?.caregiverPhone || "N/A"} for ${user?.name || "user"}`
    );

    return res.status(200).json({
      generated: true,
      message: "Summary generated and sent to caregiver",
      summary,
    });
  } catch (error) {
    const message =
      error.message === "Groq API key missing"
        ? "Groq API key is missing"
        : "Failed to generate summary";

    return res.status(500).json({ message });
  }
};

export const getLatestSummary = async (req, res) => {
  try {
    const summary = await HealthSummary.findOne({ userId: req.user.id }).lean();
    return res.status(200).json(summary || null);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch summary" });
  }
};
