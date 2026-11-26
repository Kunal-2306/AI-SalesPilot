import 'dotenv/config';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

const TEST_DB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salespilot_test';
const HAS_GROQ_KEY = Boolean(process.env.GROQ_API_KEY?.trim());

let server;
let baseUrl;
let authToken;
let createdCallId;
let createdLeadId;
let createdDocId;
let createdPdfDocId;

function buildMinimalPdfBuffer(text) {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const streamContent = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

function buildSilentWavBuffer(durationMs = 600, sampleRate = 16000) {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body
      ? options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

describe('SalesPilot AI Free AI Integration & End-to-End Tests', () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();

    const app = createApp();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}/api`;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it('1. Health endpoint reports connected DB', async () => {
    const res = await request('/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.equal(res.data.dbConnected, true);
  });

  it('2. Registers user, logs in, and verifies JWT session', async () => {
    const reg = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Jordan Lee',
        companyName: 'Velocity Cloud',
        email: 'jordan@velocity.test',
        password: 'password123',
      },
    });
    assert.equal(reg.status, 201);
    assert.ok(reg.data.token);

    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: 'jordan@velocity.test', password: 'password123' },
    });
    assert.equal(login.status, 200);
    authToken = login.data.token;

    const me = await request('/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, 'jordan@velocity.test');
    assert.equal(me.data.user.voiceSettings.sttProvider, 'groq');
    assert.equal(me.data.user.voiceSettings.ttsProvider, 'browser');
  });

  it('3. Uploads TXT & PDF to Knowledge Base, indexes chunks, and runs local RAG semantic search', async () => {
    const form = new FormData();
    const content =
      'Velocity Cloud Growth Plan includes automated voice lead qualification, RAG search, and CRM sync for $149 per month.';
    form.append('file', new Blob([content], { type: 'text/plain' }), 'growth-guide.txt');
    form.append('title', 'Growth Plan Pricing Guide');

    const uploadRes = await request('/knowledge/upload', { method: 'POST', body: form });
    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.data.document.status, 'indexed');
    assert.equal(uploadRes.data.document.embeddingProvider, 'local-tfidf');
    createdDocId = uploadRes.data.document._id;

    const searchRes = await request('/knowledge/search', {
      method: 'POST',
      body: { query: 'Growth Plan pricing CRM sync' },
    });
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.data.results.length >= 1);
    assert.equal(searchRes.data.results[0].title, 'Growth Plan Pricing Guide');

    const pdfBuf = buildMinimalPdfBuffer(
      'SalesPilot PDF Playbook: Annual Growth Tier includes onboarding automation.'
    );
    const pdfForm = new FormData();
    pdfForm.append('file', new Blob([pdfBuf], { type: 'application/pdf' }), 'playbook.pdf');
    pdfForm.append('title', 'PDF Sales Playbook');

    const pdfUploadRes = await request('/knowledge/upload', { method: 'POST', body: pdfForm });
    assert.equal(pdfUploadRes.status, 201);
    assert.equal(pdfUploadRes.data.document.fileType, 'pdf');
    assert.equal(pdfUploadRes.data.document.status, 'indexed');
    assert.ok(pdfUploadRes.data.document.extractedText.includes('Annual Growth Tier'));
    createdPdfDocId = pdfUploadRes.data.document._id;
  });

  it('4. Verifies Groq AI & Whisper STT behavior (live when GROQ_API_KEY is set, explicit 503 error without simulated fallback when missing)', async () => {
    const startRes = await request('/calls/start', { method: 'POST' });
    assert.equal(startRes.status, 201);
    assert.equal(startRes.data.providers.tts, 'Browser SpeechSynthesis');
    createdCallId = startRes.data.call._id;

    const wavForm = new FormData();
    wavForm.append('audio', new Blob([buildSilentWavBuffer()], { type: 'audio/wav' }), 'test.wav');
    const sttRes = await request('/voice/stt', { method: 'POST', body: wavForm });

    const turnRes = await request(`/calls/${createdCallId}/turn`, {
      method: 'POST',
      body: {
        message:
          'Hi, my name is Sarah Connor from Cyberdyne Systems, sarah@cyberdyne.io. Tell me about the Growth Plan pricing and book a demo tomorrow at 2 pm.',
      },
    });

    if (!HAS_GROQ_KEY) {
      assert.equal(sttRes.status, 503);
      assert.equal(turnRes.status, 503);
      assert.equal(turnRes.data.code, 'GROQ_KEY_MISSING');
    } else {
      assert.equal(sttRes.status, 200);
      assert.equal(sttRes.data.provider, 'groq-whisper');
      assert.equal(turnRes.status, 200);
      assert.equal(turnRes.data.aiMode, 'groq-live');
      assert.ok(turnRes.data.reply.length > 10);
      assert.ok(turnRes.data.retrievedSources.length >= 1);
      assert.ok(turnRes.data.lead);
      createdLeadId = turnRes.data.lead._id;

      // Turn 2: Hindi conversation + contextual memory check
      const hindiTurn = await request(`/calls/${createdCallId}/turn`, {
        method: 'POST',
        body: {
          language: 'hi',
          message: 'मेरा नाम याद है? और कृपया कल दोपहर 3 बजे डेमो बुक करें।',
        },
      });
      assert.equal(hindiTurn.status, 200);
      assert.equal(hindiTurn.data.aiMode, 'groq-live');
      assert.ok(hindiTurn.data.reply.length > 10);
    }

    const endRes = await request(`/calls/${createdCallId}/end`, {
      method: 'POST',
      body: { durationSeconds: 45 },
    });
    assert.equal(endRes.status, 200);
    assert.equal(endRes.data.call.status, 'completed');
  });

  it('5. Verifies CRM CRUD, double-booking 409 prevention, Browser TTS config, and MongoDB dashboard metrics', async () => {
    // Create a lead manually if Groq key wasn't present in this test run
    if (!createdLeadId) {
      const leadRes = await request('/leads', {
        method: 'POST',
        body: {
          name: 'Maya Patel',
          email: 'maya@horizontech.io',
          company: 'Horizon Tech',
          status: 'hot',
          score: 88,
          sentiment: 'positive',
          buyingIntent: 'high',
        },
      });
      assert.equal(leadRes.status, 201);
      createdLeadId = leadRes.data.lead._id;
    }

    const filteredLeadsRes = await request('/leads?sentiment=positive&buyingIntent=high');
    assert.equal(filteredLeadsRes.status, 200);
    assert.ok(filteredLeadsRes.data.leads.length >= 1);

    // Mass-assignment protection check
    const leadDetail = await request(`/leads/${createdLeadId}`);
    assert.equal(leadDetail.status, 200);
    const originalUserId = leadDetail.data.lead.userId;
    const leadUpdateRes = await request(`/leads/${createdLeadId}`, {
      method: 'PUT',
      body: { userId: '000000000000000000000000', timeline: 'Next week' },
    });
    assert.equal(leadUpdateRes.status, 200);
    assert.equal(String(leadUpdateRes.data.lead.userId), String(originalUserId));

    // Book appointment & verify 409 double-booking prevention
    const slotTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const bookRes = await request('/appointments', {
      method: 'POST',
      body: { title: 'Demo Call', leadId: createdLeadId, scheduledAt: slotTime },
    });
    assert.equal(bookRes.status, 201);

    const conflictRes = await request('/appointments', {
      method: 'POST',
      body: { title: 'Conflicting Demo', leadName: 'Test', scheduledAt: slotTime },
    });
    assert.equal(conflictRes.status, 409);

    const ttsRes = await request('/voice/tts', {
      method: 'POST',
      body: { text: 'Hello from SalesPilot AI' },
    });
    assert.equal(ttsRes.status, 200);
    assert.equal(ttsRes.data.useBrowserTts, true);
    assert.equal(ttsRes.data.provider, 'browser-speech-synthesis');

    const dashRes = await request('/dashboard/overview');
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.metrics.totalLeads >= 1);
    assert.ok(dashRes.data.metrics.totalCalls >= 1);
    assert.ok(dashRes.data.metrics.appointmentsBooked >= 1);

    const connRes = await request('/settings/test-connection', { method: 'POST' });
    assert.equal(connRes.status, 200);
    assert.equal(connRes.data.database.connected, true);
    assert.equal(connRes.data.rag.provider, 'local-tfidf');

    await request(`/knowledge/${createdDocId}`, { method: 'DELETE' });
    await request(`/knowledge/${createdPdfDocId}`, { method: 'DELETE' });
  });
});
