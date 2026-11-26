# SalesPilot AI — Functionality, Integration & Security Audit Report

**Audit Date:** November 25, 2026  
**Audited Environment:** `http://localhost:5173` (Frontend) & `http://localhost:5000` (Backend)  
**Database:** MongoDB (`127.0.0.1:27017/salespilot`)

---

## 1. Architecture Inventory

### Frontend Pages & Components (`client/src/`)
- **Public & Auth:** `LandingPage.jsx` (`/`), `LoginPage.jsx` (`/login`), `RegisterPage.jsx` (`/register`)
- **Protected Workspace (`Layout.jsx`):**
  - `DashboardPage.jsx` (`/dashboard`) — MongoDB-derived KPIs, 7-day area chart, lead distribution donut chart, recent leads/calls/activity
  - `VoiceAgentPage.jsx` (`/voice`) — Live `AnalyserNode` waveform, Web Speech API STT + Whisper audio clip upload + text fallback, OpenAI TTS + Web Speech Synthesis playback, real-time CRM extraction & RAG citation panel
  - `LeadsPage.jsx` (`/leads`) — Search, status/score/sentiment/buying-intent filters, create/edit/delete, detail modal with conversation history & AI summary
  - `AppointmentsPage.jsx` (`/appointments`) — Monthly calendar grid, slot availability, manual booking, confirm/reschedule/cancel
  - `KnowledgeBasePage.jsx` (`/knowledge`) — PDF/TXT upload, indexing status, extracted text viewer, semantic RAG search tester
  - `CallAnalyticsPage.jsx` (`/analytics`) — Call summary strip, sentiment filter, search, lead score chart, full transcript viewer
  - `SettingsPage.jsx` (`/settings`) — Profile, OpenAI-compatible AI config, business & product catalog, voice settings, live health/connection tester

### Backend Routes & Services (`server/src/`)
- **Routes:** `/api/health`, `/api/auth/*`, `/api/dashboard/overview`, `/api/leads/*`, `/api/appointments/*`, `/api/knowledge/*`, `/api/calls/*`, `/api/voice/*`, `/api/settings/*`
- **Services:** `aiService.js`, `ragService.js`, `voiceService.js`, `appointmentService.js`
- **Real-Time:** Socket.IO authenticated room broadcasts (`call:turn`)

---

## 2. Working Features (Verified Live)
- **Authentication & Persistence:** User registration (`POST /api/auth/register`), login (`POST /api/auth/login`), password hashing (`bcrypt`), JWT verification (`GET /api/auth/me`), and protected dashboard routing verified via E2E tests and live browser registration (`Audit Tester`).
- **Voice-to-CRM End-to-End Pipeline:** `POST /api/calls/start` → multi-turn `POST /api/calls/:id/turn` → `POST /api/calls/:id/end` verified both in automated E2E tests and live browser session (`Maya Patel` / `Horizon Tech` extracted, scored `98/100`, sentiment updated, CRM record synced, and appointment auto-booked).
- **RAG Pipeline (PDF & TXT):** Chunking, vector embedding (`openai` or `local-tfidf` 256-dim trigram+word vectors), MongoDB storage, and cosine + lexical retrieval verified for both `.txt` and `.pdf` uploads.
- **Dashboard & Call Analytics:** All KPIs (`Total Leads`, `Hot Leads`, `Warm Leads`, `Cold Leads`, `Total AI Calls`, `Avg Call Duration`, `Appointments Booked`, `Conversion Rate`) and charts compute directly from MongoDB `Lead`, `Call`, `Appointment`, and `ActivityLog` collections.
- **Responsive Layout & Theme:** Light/Dark themes and mobile (`390x844`) layout + hamburger drawer verified with zero horizontal overflow and zero console/network errors.

---

## 3. Issues Found & Fixes Completed

| Category | Issue Found During Audit | Fix Implemented | Status |
|---|---|---|---|
| **Hero / Honesty** | Hero preview originally displayed static numbers (`RAG Match: 94%`, `Lead Score: 92/100`) and referenced SOC2 / 99.99% SLA without uploaded doc backing. | Replaced with an **Interactive Sample Preview** (3 switchable scenarios), explicitly labeled `Interactive Sample Preview / Simulated example`, and removed unverified SOC2/SLA commitments. | **Fixed** |
| **Appointments** | `POST /api/appointments`, `PUT /api/appointments/:id`, and AI auto-booking lacked overlap checking, allowing double-booking on the same time slot. | Added `appointmentService.js` (`findConflictingAppointment` & `findNextAvailableSlot`), returning HTTP `409 Conflict` on overlapping manual bookings/reschedules and advancing AI bookings to the next conflict-free slot. | **Fixed & Tested** |
| **PDF Upload (RAG)** | Small PDFs (<4KB) loaded by `fs.readFile` shared Node's 8KB pooled `Buffer` (`byteOffset > 0`), causing `pdf.js` (`pdf-parse`) to throw `bad XRef entry`. | Converted read buffers via `Uint8Array.from(buffer)` in `ragService.js` and added structured `400` error handling in `knowledgeRoutes.js`. | **Fixed & Tested** |
| **AI Conversation Memory** | `callRoutes.js` appended the current user message to `call.transcript` before calling `generateSalesTurn`, causing `aiService.js` to send the latest user prompt twice to OpenAI. | Deduplicated the trailing user message in `aiService.js` when constructing `historyMessages`. | **Fixed** |
| **Voice TTS State** | Browser `window.speechSynthesis.speak` can stall without firing `onend` in muted/headless tabs, leaving the UI stuck in `speaking`. | Added a deterministic safety timeout in `VoiceAgentPage.jsx` plus an `Interrupt & Speak` control and real-time mic RMS level indicator. | **Fixed** |
| **Security (Mass Assignment)** | `PUT /api/leads/:id`, `PUT /api/appointments/:id`, and `PUT /api/settings/*` passed raw `req.body` fields into updates. | Added explicit field whitelisting on all `PUT` routes, centralized `getJwtSecret()`, fixed CORS `origin` reflection, added stricter `authLimiter` on login/register, and handled Mongoose `CastError`/`ValidationError` as HTTP `400`. | **Fixed & Tested** |
| **CRM Table & A11y** | On `/leads` (`1280x800`), the `Actions` column required horizontal scrolling; modal close buttons lacked `aria-label`. | Tightened table padding, made rows clickable to open Lead Details, hid `Next Action` below `xl`, and added `aria-label` attributes. | **Fixed** |

---

## 4. API Integration & Database Status
- **MongoDB Status:** Connected (`127.0.0.1:27017/salespilot`). All 6 Mongoose collections (`User`, `Lead`, `Call`, `Appointment`, `KnowledgeDocument`, `ActivityLog`) persist real records.
- **OpenAI / LLM / STT / TTS Status:** Official OpenAI SDK v4 integration implemented for Chat Completions (`json_object`), Embeddings (`text-embedding-3-small`), Whisper STT (`whisper-1`), and OpenAI TTS (`tts-1`). Because no `OPENAI_API_KEY` is currently configured in `server/.env` or Settings, the application runs in its explicitly labeled **Development Fallback Mode** (`development-fallback` / `local-tfidf` + browser Web Speech API).

---

## 5. Remaining Limitations
1. **Live OpenAI Credentials:** Live GPT-4o-mini, Whisper audio transcription, and OpenAI MP3 TTS require adding a valid `OPENAI_API_KEY` in `server/.env` or **Settings → AI Configuration**.
2. **Browser SpeechRecognition Support:** Real-time continuous browser STT (`SpeechRecognition` / `webkitSpeechRecognition`) is supported in Chromium/Edge/Safari; unsupported browsers automatically display guidance to use **Whisper Clip** (when OpenAI key is set) or the text input fallback.
3. **Production Deployment Env:** `JWT_SECRET` must be set to a strong secret when deploying (`NODE_ENV=production` enforces this via `server/src/config/env.js`).

---

## 6. Verification Summary
- **Backend E2E Suite (`npm run test:server`):** **5/5** test suites passing against MongoDB (`health`, `auth`, `TXT & PDF upload + RAG search`, `multi-turn voice call + lead qualification + AI auto-booking`, `CRM filters + mass-assignment check + double-booking 409 check + dashboard analytics`).
- **Frontend Production Build (`npm run build`):** Passed cleanly via `vite build`.
- **Live Browser & Mobile Audit (`http://localhost:5173`):** All 9 functional and responsive checks (`1280x800` desktop & `390x844` mobile) verified with zero console errors and zero failed HTTP requests.
