/**
 * VoxAura AI Voice Studio — secure backend (optional but recommended)
 * --------------------------------------------------------------------
 * Why this exists: the ElevenLabs API key MUST NOT live in frontend code.
 * This tiny Express server holds the key in a server-side env variable and
 * exposes a safe POST /api/tts endpoint for the browser to call.
 *
 * Run:  npm install && npm start   →  http://localhost:3000
 */
const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";
const MAX_CHARS = 5000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname)); // serves index.html, style.css, script.js

// Optional: fetch your account's voices through the server (key never leaks)
app.get("/api/voices", async (req, res) => {
  if (!ELEVENLABS_API_KEY) return res.status(500).json({ error: "ELEVENLABS_API_KEY is not set on the server. See .env.example." });
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });
    if (!r.ok) throw new Error(`ElevenLabs returned ${r.status}`);
    res.json(await r.json());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Main TTS endpoint — the frontend calls this, never ElevenLabs directly
app.post("/api/tts", async (req, res) => {
  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({
      error: "ELEVENLABS_API_KEY is not configured on the server. Copy .env.example to .env, add your key, and restart.",
    });
  }

  const { text, voiceId } = req.body || {};

  // ---- validation ----
  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Text is required." });
  }
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Text exceeds the ${MAX_CHARS}-character limit.` });
  }
  if (typeof voiceId !== "string" || !/^[A-Za-z0-9]{15,40}$/.test(voiceId)) {
    return res.status(400).json({ error: "A valid voiceId is required." });
  }

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: MODEL_ID,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!r.ok) {
      let detail = "";
      try {
        const j = await r.json();
        if (typeof j.detail === "string") detail = j.detail;
        else if (j.detail) detail = JSON.stringify(j.detail);
        else if (j.message) detail = j.message;
      } catch (_) {}
      if (r.status === 401) {
        return res.status(500).json({
          error: "ElevenLabs rejected the API key. Check ELEVENLABS_API_KEY and your quota.",
        });
      }
      if (r.status === 402) {
        return res.status(502).json({
          error:
            "ElevenLabs says this account is out of quota (payment required). " +
            "Add credits or upgrade your plan at elevenlabs.io, then try again.",
        });
      }
      return res.status(502).json({
        error: `ElevenLabs error (${r.status}). ${detail}`.trim(),
      });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (e) {
    console.error("[VoxAura] TTS proxy error:", e.message);
    res.status(502).json({ error: "Could not reach ElevenLabs. Check your connection and try again." });
  }
});

app.listen(PORT, () => {
  console.log(`\n  VoxAura AI Voice Studio running → http://localhost:${PORT}`);
  if (!ELEVENLABS_API_KEY) {
    console.log("  ⚠  ELEVENLABS_API_KEY is not set — generation will show a setup error until you add it.\n");
  }
});
