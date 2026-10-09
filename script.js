/* =========================================================
   VoxAura AI Voice Studio — script.js
   Slide-deck navigation + TTS generation + custom player
   ========================================================= */
"use strict";

/* ---------- Config: edit voice IDs here (get them from elevenlabs.io/app/voices) ---------- */
const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",    gender: "female", desc: "Calm, warm narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah",     gender: "female", desc: "Soft, expressive tone" },
  { id: "XB0fDUnXU5powFXDhCwa", name: "Charlotte", gender: "female", desc: "Bright, youthful energy" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica",   gender: "female", desc: "Conversational & friendly" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",       gender: "male",  desc: "Deep, authoritative" },
  { id: "2EiwWnXFnvU5JabPnv8n", name: "Clyde",      gender: "male",  desc: "Laid-back American" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger",      gender: "male",  desc: "Confident, steady" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie",    gender: "male",  desc: "Casual, natural" },
  { id: "onwK4e9oIivwZc0Y0YHh", name: "Daniel",     gender: "male",  desc: "British presenter" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George",     gender: "male",  desc: "Warm, storytelling" },
];
const MAX_CHARS = 5000;
const SLIDE_COUNT = 4;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const slidesEl  = $("slides");
const slideEls  = [...slidesEl.querySelectorAll(".slide")];
const deckTabs  = [...document.querySelectorAll(".deck-tab")];
const dotsWrap  = $("dots");
const veil      = $("veil");
const loader    = $("loader");
const textInput   = $("textInput");
const charCounter = $("charCounter");
const genderTabs  = [...document.querySelectorAll(".gender-tab")];
const voiceGrid   = $("voiceGrid");
const voiceSelect = $("voiceSelect");
const voiceLibrary= $("voiceLibrary");
const generateBtn = $("generateBtn");
const clearBtn    = $("clearBtn");
const statusBox   = $("statusBox");
const audioEl     = $("audioEl");
const playerEmpty = $("playerEmpty");
const player      = $("player");
const playerSub   = $("playerSub");
const playPauseBtn= $("playPauseBtn");
const seekBar     = $("seekBar");
const currentTimeEl = $("currentTime");
const totalTimeEl = $("totalTime");
const volumeBar   = $("volumeBar");
const downloadBtn = $("downloadBtn");
const waveform    = $("waveform");
const newBtn      = $("newBtn");

let currentSlide = 0;
let selectedVoice = null;
let activeFilter = "female";
let audioUrl = null;
let isGenerating = false;

/* ---------- Slide navigation ---------- */
function buildDots() {
  dotsWrap.innerHTML = "";
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const d = document.createElement("button");
    d.type = "button"; d.className = "dot"; d.setAttribute("aria-label", `Go to slide ${i + 1}`);
    d.addEventListener("click", () => goToSlide(i));
    dotsWrap.appendChild(d);
  }
}

/* ---------- Slide navigation : veil sweep + crossfade ---------- */
function setSlide(i) {
  currentSlide = i;
  slideEls.forEach((s, idx) => s.classList.toggle("active", idx === currentSlide));
  deckTabs.forEach((t, idx) => t.classList.toggle("is-active", idx === currentSlide));
  [...dotsWrap.children].forEach((d, idx) => d.classList.toggle("is-active", idx === currentSlide));
  // restart the staggered enter animation on the incoming slide
  const active = slideEls[currentSlide];
  active.querySelectorAll(".anim-in").forEach(el => { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; });
  // keep scroll at top of the newly shown slide
  $("deck").scrollTop = 0;
}

let isTransitioning = false;
function goToSlide(i, instant = false) {
  i = Math.max(0, Math.min(SLIDE_COUNT - 1, i));
  if (i === currentSlide || isTransitioning) return;
  if (instant || reduceMotion) { setSlide(i); return; }
  // cinematic sweep: swap slides while the veil covers the screen
  isTransitioning = true;
  veil.classList.remove("run");
  void veil.offsetWidth;
  veil.classList.add("run");
  setTimeout(() => setSlide(i), 320);
  setTimeout(() => { veil.classList.remove("run"); isTransitioning = false; }, 740);
}

deckTabs.forEach(t => t.addEventListener("click", () => goToSlide(+t.dataset.goto)));
document.querySelectorAll("[data-goto]").forEach(b => {
  if (b.classList.contains("deck-tab")) return;
  b.addEventListener("click", () => goToSlide(+b.dataset.goto));
});
document.addEventListener("keydown", e => {
  const typing = /^(TEXTAREA|INPUT|SELECT)$/.test(document.activeElement?.tagName);
  if (typing) return;
  if (e.key === "ArrowRight") goToSlide(currentSlide + 1);
  if (e.key === "ArrowLeft") goToSlide(currentSlide - 1);
});

/* ---------- Status messages ---------- */
function setStatus(message, type) {
  if (!message) { statusBox.className = "status"; statusBox.textContent = ""; return; }
  statusBox.className = "status show " + type;
  statusBox.textContent = message;
}

/* ---------- Character counter ---------- */
function updateCounter() {
  const len = textInput.value.length;
  charCounter.textContent = `${len.toLocaleString()} / ${MAX_CHARS.toLocaleString()}`;
  charCounter.classList.toggle("near-limit", len > MAX_CHARS * 0.85 && len < MAX_CHARS);
  charCounter.classList.toggle("at-limit", len >= MAX_CHARS);
}
textInput.addEventListener("input", updateCounter);
clearBtn.addEventListener("click", () => { textInput.value = ""; updateCounter(); setStatus(""); textInput.focus(); });
newBtn.addEventListener("click", () => { goToSlide(0); setTimeout(() => textInput.focus(), 700); });

/* ---------- Voice selection ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderVoiceGrid() {
  voiceGrid.innerHTML = "";
  voiceSelect.innerHTML = "";
  const list = VOICES.filter(v => activeFilter === "all" || v.gender === activeFilter);
  if (!selectedVoice || !list.includes(selectedVoice)) selectedVoice = list[0] || null;

  list.forEach(v => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "voice-card" + (v === selectedVoice ? " is-selected" : "");
    card.setAttribute("aria-pressed", v === selectedVoice ? "true" : "false");
    card.innerHTML =
      `<strong>${escapeHtml(v.name)}</strong>` +
      `<small>${escapeHtml(v.desc)}</small>` +
      `<span class="voice-tag ${v.gender === "female" ? "f" : "m"}">${v.gender}</span>`;
    card.addEventListener("click", () => selectVoice(v));
    voiceGrid.appendChild(card);

    const opt = document.createElement("option");
    opt.value = v.id; opt.textContent = `${v.name} — ${v.desc}`;
    if (v === selectedVoice) opt.selected = true;
    voiceSelect.appendChild(opt);
  });
}

voiceSelect.addEventListener("change", () => {
  const v = VOICES.find(x => x.id === voiceSelect.value);
  if (v) selectVoice(v);
});

function selectVoice(v) {
  selectedVoice = v;
  renderVoiceGrid();
}

genderTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    genderTabs.forEach(t => { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("is-active");
    tab.setAttribute("aria-selected", "true");
    activeFilter = tab.dataset.gender;
    renderVoiceGrid();
  });
});

function renderLibrary() {
  voiceLibrary.innerHTML = "";
  VOICES.forEach(v => {
    const card = document.createElement("div");
    card.className = "lib-card";
    card.innerHTML =
      `<strong>${escapeHtml(v.name)}</strong> <span class="voice-tag ${v.gender === "female" ? "f" : "m"}">${v.gender}</span>` +
      `<p>${escapeHtml(v.desc)}</p>` +
      `<button class="use-btn" type="button">Use this voice</button>`;
    card.querySelector(".use-btn").addEventListener("click", () => {
      activeFilter = "all";
      genderTabs.forEach(t => {
        const on = t.dataset.gender === "all";
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", String(on));
      });
      selectVoice(v);
      goToSlide(0); // jump back to Studio slide
    });
    voiceLibrary.appendChild(card);
  });
}

/* ---------- Generate voice → slides to the Player page ---------- */
generateBtn.addEventListener("click", async () => {
  if (isGenerating) return; // prevent duplicate requests

  const text = textInput.value.trim();
  if (!text) {
    setStatus("Please enter some text first — the studio can't voice an empty script.", "error");
    textInput.focus();
    return;
  }
  if (!selectedVoice) {
    setStatus("Please select a voice before generating.", "error");
    return;
  }

  isGenerating = true;
  generateBtn.disabled = true;
  loader.hidden = false;

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: selectedVoice.id }),
    });

    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = j.error || ""; } catch (_) {}
      throw new Error(detail || `Server responded with ${res.status}`);
    }

    const blob = await res.blob();
    if (!blob || blob.size === 0) throw new Error("The server returned an empty audio file.");

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audioEl.src = audioUrl;
    downloadBtn.disabled = false;
    player.hidden = false;
    playerEmpty.style.display = "none";
    playerSub.textContent = `Generated with ${selectedVoice.name} · ${text.length.toLocaleString()} characters`;
    setStatus("");
    loader.hidden = true;
    goToSlide(1); // ← slide to the Player page (no scrolling)
    audioEl.play().catch(() => {}); // autoplay if the browser allows
  } catch (err) {
    console.error("[VoxAura] TTS failed:", err);
    setStatus("Couldn't generate audio. " + friendlyError(err), "error");
    loader.hidden = true;
  } finally {
    isGenerating = false;
    generateBtn.disabled = false;
  }
});

function friendlyError(err) {
  const msg = String(err && err.message || "");
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return "Is the server running? Start it with `npm start` and open http://localhost:3000 — the frontend can't reach the API on its own.";
  if (/API key/i.test(msg))
    return "The ElevenLabs API key is missing or invalid. Check .env and restart the server.";
  if (/voice/i.test(msg))
    return "The voice ID was rejected. Check the VOICES list in script.js.";
  if (/out of quota|402/i.test(msg))
    return "ElevenLabs says this API key's account is out of quota. Add credits or upgrade at elevenlabs.io, then try again.";
  if (/quota|payment/i.test(msg))
    return "ElevenLabs rejected the request — check your key, quota, and subscription status.";
  if (/empty/i.test(msg))
    return "The API returned no audio. Try shorter text and check your voice ID.";
  return msg || "Something went wrong on the server. Check the terminal for details.";
}

/* ---------- Custom audio player ---------- */
function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

playPauseBtn.addEventListener("click", () => {
  if (!audioEl.src) return;
  if (audioEl.paused) audioEl.play().catch(e => console.warn("Playback failed:", e.message));
  else audioEl.pause();
});

const logoEl = document.getElementById("siteLogo");
audioEl.addEventListener("play", () => {
  playPauseBtn.classList.add("is-playing");
  playPauseBtn.setAttribute("aria-label", "Pause");
  waveform.classList.add("playing");
  if (logoEl) logoEl.classList.add("is-live");   // logo pulses while audio plays
});
audioEl.addEventListener("pause", () => {
  playPauseBtn.classList.remove("is-playing");
  playPauseBtn.setAttribute("aria-label", "Play");
  waveform.classList.remove("playing");
  if (logoEl) logoEl.classList.remove("is-live");
});
audioEl.addEventListener("loadedmetadata", () => { totalTimeEl.textContent = fmtTime(audioEl.duration); });
audioEl.addEventListener("timeupdate", () => {
  const pct = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
  seekBar.value = pct;
  seekBar.style.setProperty("--fill", pct + "%");
  currentTimeEl.textContent = fmtTime(audioEl.currentTime);
});
seekBar.addEventListener("input", () => {
  if (audioEl.duration) audioEl.currentTime = (seekBar.value / 100) * audioEl.duration;
});
audioEl.addEventListener("ended", () => {
  playPauseBtn.classList.remove("is-playing");
  waveform.classList.remove("playing");
  if (logoEl) logoEl.classList.remove("is-live");
});

volumeBar.addEventListener("input", () => {
  audioEl.volume = parseFloat(volumeBar.value);
  volumeBar.style.setProperty("--fill", (volumeBar.value * 100) + "%");
});
volumeBar.style.setProperty("--fill", "100%");

downloadBtn.addEventListener("click", () => {
  if (!audioUrl) return;
  const a = document.createElement("a");
  a.href = audioUrl;
  a.download = `voxaura-${selectedVoice ? selectedVoice.name.toLowerCase() : "voice"}-${Date.now()}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

/* ---------- 3D animated background : perspective starfield + synthwave terrain ----------
   Pure vanilla canvas. No libraries. Pauses when the tab is hidden,
   and disables itself entirely under prefers-reduced-motion. */
(function initBackdrop() {
  const canvas = document.getElementById("bg3d");
  if (!canvas) return;
  if (reduceMotion) { canvas.style.display = "none"; return; }
  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.style.display = "none"; return; }

  let W = 0, H = 0, running = true, rafId = 0;
  let mx = 0, my = 0, tmx = 0, tmy = 0;   // smoothed mouse parallax
  let glowX = -9999, glowY = -9999;       // cursor glow position

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", e => {
    tmx = (e.clientX / W) * 2 - 1;
    tmy = (e.clientY / H) * 2 - 1;
    glowX = e.clientX; glowY = e.clientY;
  }, { passive: true });

  /* --- starfield : true 3D perspective projection --- */
  const COLORS = ["139,92,246", "168,85,247", "34,211,238", "232,121,249"];
  const stars = [];
  function resetStar(s, initial) {
    s.x = Math.random() * 2 - 1;
    s.y = Math.random() * 2 - 1;
    s.z = initial ? 0.08 + Math.random() * 0.92 : 0.92 + Math.random() * 0.08;
    s.c = COLORS[(Math.random() * COLORS.length) | 0];
    s.sp = 0.25 + Math.random() * 0.75;
    s.tw = Math.random() * Math.PI * 2;
  }
  for (let i = 0; i < 140; i++) { const s = {}; resetStar(s, true); stars.push(s); }

  function drawStars(dt) {
    const cx = W / 2 + mx * 36, cy = H * 0.42 + my * 24;
    const focal = H * 0.85, aspect = W / H;
    for (const s of stars) {
      s.z -= dt * 0.22 * s.sp;
      s.tw += dt * 2.2;
      if (s.z < 0.06) resetStar(s, false);
      const z = Math.max(s.z, 0.06);
      const px = cx + (s.x * aspect / z) * focal * 0.55;
      const py = cy + (s.y / z) * focal * 0.55;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      const near = 1 - z;
      const a = (0.10 + near * 0.72) * (0.6 + 0.4 * Math.sin(s.tw));
      ctx.beginPath();
      ctx.arc(px, py, 0.5 + near * 2.4, 0, 6.2832);
      ctx.fillStyle = `rgba(${s.c},${a.toFixed(3)})`;
      ctx.fill();
    }
  }

  /* --- synthwave terrain : layered sine rows with fake perspective --- */
  const ROWS = 16, COLS = 72;
  function drawTerrain(t) {
    const horizon = H * 0.60, par = mx * 14;
    for (let j = 0; j <= ROWS; j++) {
      const v = j / ROWS;                                   // 0 far → 1 near
      const yB = horizon + Math.pow(v, 1.9) * (H - horizon + 40);
      const amp = 4 + v * 52;
      const alpha = 0.03 + v * 0.20;
      ctx.beginPath();
      for (let i = 0; i <= COLS; i++) {
        const x = (i / COLS) * (W + 80) - 40 + par * v;
        const y = yB
          + Math.sin(i * 0.32 + t * 1.5 + v * 6.0) * amp * 0.38
          + Math.sin(i * 0.11 - t * 0.8 + v * 3.2) * amp * 0.62;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = v > 0.55
        ? `rgba(34,211,238,${alpha.toFixed(3)})`
        : `rgba(139,92,246,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "rgba(139,92,246,0)");
    g.addColorStop(0.5, "rgba(34,211,238,0.35)");
    g.addColorStop(1, "rgba(139,92,246,0)");
    ctx.strokeStyle = g; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(W, horizon); ctx.stroke();
  }

  function drawGlow() {
    if (glowX < -1000) return;
    const r = 260;
    const g = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, r);
    g.addColorStop(0, "rgba(139,92,246,0.07)");
    g.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = g;
    ctx.fillRect(glowX - r, glowY - r, r * 2, r * 2);
  }

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    mx += (tmx - mx) * 0.045;
    my += (tmy - my) * 0.045;
    ctx.clearRect(0, 0, W, H);
    drawTerrain(now / 1000);
    drawStars(dt);
    drawGlow();
    rafId = requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { running = false; cancelAnimationFrame(rafId); }
    else { running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
  });
  rafId = requestAnimationFrame(frame);
})();

/* ---------- 3D tilt on cards ---------- */
document.querySelectorAll("[data-tilt]").forEach(card => {
  if (reduceMotion) return;
  let raf = null;
  card.addEventListener("mousemove", e => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(1000px) rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg)`;
      raf = null;
    });
  });
  card.addEventListener("mouseleave", () => {
    if (raf) cancelAnimationFrame(raf); raf = null;
    card.style.transform = "";
  });
});

/* Pro shortcut: Ctrl/Cmd + Enter generates from anywhere in the script box */
textInput.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    generateBtn.click();
  }
});

/* ---------- Init ---------- */
buildDots();
renderVoiceGrid();
renderLibrary();
updateCounter();
setSlide(0);
