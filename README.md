# 🎙️ VoxAura AI Voice Studio

A premium, fully responsive AI text-to-speech website built with **HTML5, CSS3 and vanilla JavaScript**, with realistic voices powered by **ElevenLabs** through a small secure **Node.js/Express backend** (so your API key never touches the browser).

## Files

| File | What it does |
|---|---|
| `index.html` | Page structure: hero, studio, audio player, voice library, setup |
| `style.css` | Futuristic dark UI — violet/purple/cyan gradients, glassmorphism, animations |
| `script.js` | Voice selection, char counter, generation, custom audio player, 3D tilt |
| `server.js` | **Secure backend** — holds your API key server-side, proxies `/api/tts` to ElevenLabs |
| `package.json` | Backend dependencies |
| `.env.example` | Template for your secret config — copy to `.env` and fill in |

## Run locally (2 minutes)

1. **Get an ElevenLabs API key** — sign up at [elevenlabs.io](https://elevenlabs.io), go to Profile → API Keys. (Free tier includes monthly character quota.)
2. **Copy the env file and add your key:**
   ```bash
   cp .env.example .env
   # then open .env and paste your key into ELEVENLABS_API_KEY
   ```
3. **Install and start:**
   ```bash
   npm install
   npm start
   ```
4. Open **http://localhost:3000** → type text → pick a voice → **Generate Voice**.

> ⚠️ Don't open `index.html` directly with `file://` — the frontend calls `/api/tts` on the server, so the backend must be running.

## Configure voice IDs

Default voices live in the `VOICES` array at the top of `script.js` (name, ElevenLabs voice ID, gender, description). To use your own:

1. Go to [elevenlabs.io/app/voices](https://elevenlabs.io/app/voices), open a voice → copy its **ID**.
2. Replace any `id:` value in the `VOICES` array.
3. The Female / Male / All tabs filter automatically by the `gender` field.

You can also fetch your account's full voice list through the backend: `GET /api/voices` (key stays server-side).

## How the API integration works

```
Browser (script.js) ──POST /api/tts {text, voiceId}──▶ server.js (Express)
                                                              │  xi-api-key from .env
                                                              ▼
                                              api.elevenlabs.io/v1/text-to-speech/{voiceId}
                                                              │  audio/mpeg
                                                              ▼
Browser ◀── audio blob ── server.js streams it back
```

The frontend never sees your API key. The server validates text (non-empty, ≤ 5000 chars) and the voice ID format before forwarding.

## Deploy

- **Render / Railway / Fly.io:** push this folder, set the `ELEVENLABS_API_KEY` environment variable in the dashboard (don't commit `.env`), start command `npm start`.
- **VPS:** `npm install --production`, then run with PM2: `pm2 start server.js --name voxaura`.
- The frontend is static, so it can also live on GitHub Pages / Netlify — but `/api/tts` must point at your deployed backend (update the `fetch("/api/tts")` URL in `script.js` if it's on a different host).

## Extras

- Animated 3D background (perspective starfield + synthwave terrain, pure canvas — no libraries) with mouse parallax. Automatically disabled under `prefers-reduced-motion`.
- Keyboard shortcuts: `Ctrl`/`Cmd` + `Enter` generates audio from the script box, `←`/`→` switch pages.
- The header logo pulses while audio is playing.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Is the server running?" | Run `npm start` and open `http://localhost:3000` (not `file://`). |
| "API key is missing or invalid" | Copy `.env.example` → `.env`, paste the real key, restart the server. |
| 401 from ElevenLabs | Key is wrong or expired — regenerate it in your ElevenLabs profile. |
| "out of quota (payment required)" / 402 | The key is valid but the account has no credits left — top up or upgrade at elevenlabs.io, then retry. |
| "quota" / generation suddenly stops | Free-tier character limit reached — check Usage on elevenlabs.io. |
| Voice ID rejected | Copy the exact ID from the voice page; only letters/numbers, ~20 chars. |
| Audio plays but no waveform | That's cosmetic — the bars animate with CSS while playing; check DevTools for JS errors. |
| CORS errors when frontend/backend are on different hosts | Serve both from the same origin, or add `cors` middleware in `server.js`. |

## Accessibility & motion

- All controls have labels and are keyboard-operable; focus states are visible.
- `prefers-reduced-motion` disables tilt, orbs, and wave animations automatically.

## License

MIT — use it for your portfolio, hackathons, or client work.
