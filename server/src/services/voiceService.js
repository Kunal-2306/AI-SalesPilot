import fs from 'fs/promises';
import path from 'path';
import { getEffectiveAiConfig } from './aiService.js';

function pcm16ToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function transcribeAudioFile({ filePath, originalname, mimetype, language, user }) {
  const aiConfig = getEffectiveAiConfig(user);

  if (aiConfig.sttProvider === 'webspeech') {
    return {
      provider: 'browser-webspeech',
      text: '',
      message: 'STT provider is configured to Browser Web Speech API.',
    };
  }

  if (!aiConfig.groqApiKey) {
    const err = new Error(
      'Groq API key is not configured for Whisper STT. Add GROQ_API_KEY in server/.env or Settings.'
    );
    err.statusCode = 503;
    throw err;
  }

  const audioBuffer = await fs.readFile(filePath);
  const ext = path.extname(originalname || '') || '.webm';
  const safeName = originalname && /\.[a-z0-9]+$/i.test(originalname) ? originalname : `speech${ext}`;

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimetype || 'audio/webm' }), safeName);
  form.append('model', aiConfig.sttModel || 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');

  const effectiveLang = language || user?.voiceSettings?.language || 'auto';
  if (effectiveLang === 'en' || effectiveLang === 'hi') {
    form.append('language', effectiveLang);
  }

  const startedAt = Date.now();
  const response = await fetch(`${aiConfig.groqBaseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiConfig.groqApiKey}`,
    },
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = data?.error?.message || `Groq Whisper STT error (HTTP ${response.status})`;
    const err = new Error(
      response.status === 429
        ? `Groq STT rate limit reached: ${apiMessage}. Please retry shortly.`
        : `Groq STT error: ${apiMessage}`
    );
    err.statusCode = response.status;
    err.retryable = response.status === 429 || response.status >= 500;
    throw err;
  }

  return {
    provider: 'groq-whisper',
    model: aiConfig.sttModel || 'whisper-large-v3-turbo',
    detectedLanguage: data.language || effectiveLang,
    latencyMs: Date.now() - startedAt,
    text: (data.text || '').trim(),
  };
}

export async function synthesizeSpeechAudio({ text, user, voiceOverride, providerOverride }) {
  const aiConfig = getEffectiveAiConfig(user);
  const provider = providerOverride || aiConfig.ttsProvider || 'browser';

  if (provider !== 'gemini') {
    return {
      provider: 'browser-speech-synthesis',
      useBrowserTts: true,
      audioBuffer: null,
      message: 'Using zero-cost Browser SpeechSynthesis API.',
    };
  }

  if (!aiConfig.geminiApiKey) {
    const err = new Error(
      'GEMINI_API_KEY is not configured for Gemini TTS. Configure it in server/.env or Settings, or switch TTS to Browser SpeechSynthesis.'
    );
    err.statusCode = 503;
    throw err;
  }

  const model = aiConfig.geminiTtsModel || 'gemini-2.5-flash-preview-tts';
  const voiceName = voiceOverride || user?.voiceSettings?.ttsVoice || 'Kore';
  const startedAt = Date.now();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(aiConfig.geminiApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: text.slice(0, 3000) }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = data?.error?.message || `Gemini TTS error (HTTP ${response.status})`;
    const err = new Error(
      response.status === 429
        ? `Gemini TTS rate limit reached: ${apiMessage}. Retry or switch to Browser SpeechSynthesis.`
        : `Gemini TTS error: ${apiMessage}`
    );
    err.statusCode = response.status;
    err.retryable = response.status === 429 || response.status >= 500;
    throw err;
  }

  const inlineAudio = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inlineAudio?.data) {
    const err = new Error('Gemini TTS returned no audio payload.');
    err.statusCode = 502;
    throw err;
  }

  const rawBuffer = Buffer.from(inlineAudio.data, 'base64');
  const mime = inlineAudio.mimeType || 'audio/L16;rate=24000';
  let outputBuffer = rawBuffer;
  let contentType = mime;

  if (mime.includes('L16') || mime.includes('pcm')) {
    const rateMatch = mime.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
    outputBuffer = pcm16ToWav(rawBuffer, sampleRate, 1, 16);
    contentType = 'audio/wav';
  }

  return {
    provider: 'gemini-tts',
    useBrowserTts: false,
    model,
    voice: voiceName,
    contentType,
    latencyMs: Date.now() - startedAt,
    audioBuffer: outputBuffer,
  };
}
