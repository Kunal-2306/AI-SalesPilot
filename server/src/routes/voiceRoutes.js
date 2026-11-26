import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { transcribeAudioFile, synthesizeSpeechAudio } from '../services/voiceService.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.resolve('uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.webm';
    cb(null, `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
});

router.post('/stt', protect, audioUpload.single('audio'), async (req, res, next) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Audio file is required' });
    }

    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );
    const result = await transcribeAudioFile({
      filePath,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      language: req.body?.language,
      user,
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        message: err.message,
        retryable: Boolean(err.retryable),
        provider: 'groq-whisper',
      });
    }
    next(err);
  } finally {
    if (filePath) {
      fs.unlink(filePath).catch(() => {});
    }
  }
});

router.post('/tts', protect, async (req, res, next) => {
  try {
    const { text, voice, provider } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text is required for speech synthesis' });
    }

    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );
    const result = await synthesizeSpeechAudio({
      text,
      user,
      voiceOverride: voice,
      providerOverride: provider,
    });

    if (result.useBrowserTts || !result.audioBuffer) {
      return res.json({
        useBrowserTts: true,
        provider: result.provider,
        message: result.message,
      });
    }

    res.set({
      'Content-Type': result.contentType || 'audio/wav',
      'Content-Length': result.audioBuffer.length,
      'X-TTS-Provider': result.provider,
      'X-TTS-Model': result.model,
      'X-TTS-Voice': result.voice,
      'X-TTS-Latency-Ms': String(result.latencyMs),
    });
    res.send(result.audioBuffer);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        message: err.message,
        retryable: Boolean(err.retryable),
        provider: 'gemini-tts',
      });
    }
    next(err);
  }
});

export default router;
