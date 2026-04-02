import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

const restrictedReply =
  "I am not a medical professional. Please consult a doctor.";

// Fast keyword checks to block restricted medical advice requests.
const isRestrictedQuery = (message) => {
  const restrictedPatterns = [
    /diagnos/i,
    /treat/i,
    /prescrib/i,
    /dosage/i,
    /dose/i,
    /which\s+medicine/i,
    /what\s+medicine\s+should\s+i\s+take/i,
    /cure/i,
    /am\s+i\s+sick/i,
  ];

  return restrictedPatterns.some((pattern) => pattern.test(message));
};

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (message.trim().length > 1000) {
      return res
        .status(400)
        .json({ message: "Message should be less than 1000 characters" });
    }

    if (isRestrictedQuery(message)) {
      return res.status(200).json({ reply: restrictedReply });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ message: "Groq API key is missing" });
    }

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
              "You are a disease-awareness chatbot. Allowed topics: disease overview, symptoms, causes, prevention, and general medicine information. Not allowed: diagnosis, treatment suggestions, or acting like a doctor. If the user asks restricted medical advice, respond exactly with: \"" +
              restrictedReply +
              "\". " +
              "For allowed questions, respond in a highly readable structured format. Use bold section headers exactly like **Overview**, **Common Symptoms**, **Possible Causes**, **Prevention**, and **When to Seek Medical Help** when relevant. Put each heading on its own line, then list short bullet points under it. Keep the response concise, avoid long paragraphs, and use markdown-style bullets or numbered lists.",
          },
          {
            role: "user",
            content: message.trim(),
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => ({}));
      const errorMessage =
        errorPayload?.error?.message ||
        errorPayload?.message ||
        "Failed to get chatbot response from Groq API";

      if (response.status === 429) {
        return res.status(503).json({
          message:
            "Groq API quota exceeded. Please check your Groq plan/billing and try again.",
        });
      }

      if (response.status === 400 || response.status === 404) {
        return res.status(500).json({
          message:
            "Configured Groq model is not available. Set GROQ_MODEL to a supported model.",
        });
      }

      return res.status(500).json({ message: errorMessage });
    }

    const result = await response.json();
    const reply = result?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(500).json({
        message: "Groq API returned an empty response",
      });
    }

    return res.status(200).json({ reply });
  } catch (error) {
    const status = Number(error?.status || 0);
    console.error("Groq chat error:", error?.message || error);

    if (status === 429) {
      return res.status(503).json({
        message:
          "Groq API quota exceeded. Please check your Groq plan/billing and try again.",
      });
    }

    if (status === 404) {
      return res.status(500).json({
        message:
          "Configured Groq model is not available. Set GROQ_MODEL to a supported model.",
      });
    }

    return res.status(500).json({
      message: "Failed to get chatbot response from Groq API",
    });
  }
});

export default router;
