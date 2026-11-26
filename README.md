# SalesPilot AI — Autonomous AI Sales Voice Agent

**Tagline:** Your Autonomous AI Sales Representative.

SalesPilot AI is a full-stack AI SaaS application built with React, Vite, Tailwind CSS, Node.js, Express, MongoDB, Socket.IO, and OpenAI-compatible AI & Voice APIs.

## Core Capabilities

- **Real-Time Voice Conversation Engine:** Live audio waveform visualizer, microphone capture, speech-to-text (OpenAI Whisper or Web Speech API), contextual conversation memory, RAG document retrieval, and speech synthesis (OpenAI TTS or Web Speech Synthesis).
- **RAG Knowledge Base:** Upload PDF and TXT company documents; chunks and embeddings are stored in MongoDB with cosine similarity retrieval.
- **Autonomous CRM Qualification:** Extracts prospect contact details, budget, timeline, sentiment, buying intent, objections, lead score (0–100), and recommended next actions.
- **Automated Appointment Scheduling:** Detects booking intent mid-call, confirms slots, and provides a calendar management UI.
- **Live Analytics Dashboard:** Real MongoDB-derived metrics, Recharts visualizations, and Socket.IO updates.
- **Explicit Development Fallback:** Works out-of-the-box without an OpenAI API key using deterministic NLP + local TF-IDF/trigram vector embeddings (clearly labeled `Development Fallback Mode`), and upgrades seamlessly when an OpenAI-compatible API key is provided in `.env` or Settings.

## Project Structure

- `client/` — React + Vite + Tailwind CSS frontend (Vercel-ready)
- `server/` — Express + Mongoose + Socket.IO + OpenAI backend (Render-ready)

## Local Setup

1. Copy environment templates:
   - `server/.env.example` -> `server/.env`
   - `client/.env.example` -> `client/.env`
2. Ensure MongoDB is running locally (`mongodb://127.0.0.1:27017/salespilot`) or configure `MONGODB_URI`.
3. Install dependencies and start both servers:
   ```bash
   npm run install:all
   npm run dev
   ```
4. Run backend end-to-end tests:
   ```bash
   npm run test:server
   ```
5. Build frontend for production:
   ```bash
   npm run build
   ```
