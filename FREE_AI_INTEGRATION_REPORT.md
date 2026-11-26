# SalesPilot AI — Free AI Integration Report

**Date:** November 26, 2026  
**Workspace:** `c:\Users\kunal\Downloads\Ai`

---

## 1. Active Free AI Architecture & Providers

| Layer | Active Provider | Model / API | Endpoint / Mechanism | Live Verification Status |
|---|---|---|---|---|
| **Speech-to-Text (STT)** | **Groq** (Primary) / Browser Web Speech (Configurable) | `whisper-large-v3-turbo` | `https://api.groq.com/openai/v1/audio/transcriptions` | **Verified Live** (`587ms` latency on spoken WAV -> accurate English transcript) |
| **LLM Intelligence** | **Groq** | `openai/gpt-oss-120b` (default, also supports `openai/gpt-oss-20b` & `qwen/qwen3.8-27b`) | `https://api.groq.com/openai/v1/chat/completions` | **Verified Live** (`2209ms` latency, English & Hindi Devanagari turns, JSON extraction) |
| **Text-to-Speech (TTS)** | **Browser SpeechSynthesis** (Primary, zero-cost) / **Google Gemini TTS** (Optional) | Browser OS voices (`en-US`/`hi-IN`) or `gemini-2.5-flash-preview-tts` | `window.speechSynthesis` / Gemini `generateContent` | **Browser TTS Verified** (`useBrowserTts: true`); Gemini TTS awaits optional `GEMINI_API_KEY` |
| **RAG Embeddings** | **Local TF-IDF + Trigram Vectorizer** | Deterministic 256-dim L2-normalized vector + lexical overlap | In-process (`server/src/services/ragService.js`) persisted in MongoDB | **Verified Live** (PDF & TXT indexing + semantic search) |

---

## 2. Live Verification Results (After `GROQ_API_KEY` Configured)

1. **Environment Loading & Security:** `GROQ_API_KEY` loaded cleanly from `server/.env` (`hasGroqKey: true`, `groqKeySource: 'server-env'`); key is never returned to the frontend.
2. **Groq Connectivity (`/api/settings/test-connection`):** `connected: true`, `mode: 'groq-live'`, `11` models available on account (`chatModelAvailable: true`, `sttModelAvailable: true`).
3. **Model Discovery Fix:** Account inspection showed `llama-3.3-70b-versatile` returned `404` on this Groq account, while `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, and `whisper-large-v3-turbo` are active. Default chat model updated to `openai/gpt-oss-120b`.
4. **Live Groq Whisper STT (`/api/voice/stt`):** Tested with a real spoken English WAV (`233,050` bytes); `whisper-large-v3-turbo` transcribed `"Hello, my name is Urjan Mehta and I want to buy the growth plan for my team."` in `587ms`.
5. **Live Groq LLM + CRM + Hindi/English (`/api/calls/:id/turn`):**
   - English turn returned a grounded Growth Plan response (`$149/mo`, `2,500` voice minutes) in `2209ms` (`1728` tokens) and extracted `Urjan Mehta`, `arjun@techbharat.in`, `$200/mo` (`leadScore: 80`).
   - Hindi follow-up turn (`language: 'hi'`) preserved contextual memory (`"हाँ, आपका नाम उर्जन मेहता है..."`) and persisted `1` Call, `1` Lead (`score: 85`), and `1` Appointment in MongoDB.
6. **Backend E2E Suite (`npm run test:server`):** **5/5** tests passed live against MongoDB + Groq API.
7. **Frontend Production Build (`npm run build`):** Passed cleanly (`vite build`).

---

## 3. Remaining Limitations & Notes
1. **Browser Interactive Voice Verification:** Live browser microphone/speaker interaction in `http://localhost:5173/voice` was taken over by the user in the browser pane (`[BROWSER_USER_TAKEOVER]`) right at `"Start Call"`, so client-side live mic `MediaRecorder` + audible `SpeechSynthesis` playback should be confirmed interactively in the user's own browser tab.
2. **Hindi System Voices in Browser TTS:** `Browser SpeechSynthesis` depends on OS voices installed (`en-US`/`hi-IN`); if `hi-IN` is missing on a device, the UI shows a warning toast and falls back to the browser's default voice.
3. **Optional Gemini TTS:** `GEMINI_API_KEY` is not set (`geminiConfigured: false`), so `TTS_PROVIDER=browser` is active by default.
