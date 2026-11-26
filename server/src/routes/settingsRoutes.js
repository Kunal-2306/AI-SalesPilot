import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import { protect } from '../middleware/auth.js';
import { getEffectiveAiConfig, testAiConnection } from '../services/aiService.js';

const router = express.Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );
    const aiConfig = getEffectiveAiConfig(user);

    res.json({
      profile: {
        name: user.name,
        email: user.email,
        companyName: user.companyName,
      },
      aiSettings: {
        hasGroqKey: aiConfig.hasGroqKey,
        hasGeminiKey: aiConfig.hasGeminiKey,
        groqKeySource: user.aiSettings?.groqApiKey
          ? 'workspace'
          : process.env.GROQ_API_KEY
            ? 'server-env'
            : 'none',
        geminiKeySource: user.aiSettings?.geminiApiKey
          ? 'workspace'
          : process.env.GEMINI_API_KEY
            ? 'server-env'
            : 'none',
        groqBaseUrl: aiConfig.groqBaseUrl,
        llmProvider: aiConfig.llmProvider,
        model: aiConfig.model,
        sttModel: aiConfig.sttModel,
        geminiTtsModel: aiConfig.geminiTtsModel,
        temperature: aiConfig.temperature,
        systemPrompt: aiConfig.systemPrompt,
      },
      businessSettings: user.businessSettings,
      voiceSettings: user.voiceSettings,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/ai', protect, async (req, res, next) => {
  try {
    const {
      groqApiKey,
      clearGroqKey,
      geminiApiKey,
      clearGeminiKey,
      groqBaseUrl,
      model,
      sttModel,
      geminiTtsModel,
      temperature,
      systemPrompt,
    } = req.body;

    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );

    if (clearGroqKey) {
      user.aiSettings.groqApiKey = '';
    } else if (typeof groqApiKey === 'string' && groqApiKey.trim() && !groqApiKey.includes('••')) {
      user.aiSettings.groqApiKey = groqApiKey.trim();
    }

    if (clearGeminiKey) {
      user.aiSettings.geminiApiKey = '';
    } else if (
      typeof geminiApiKey === 'string' &&
      geminiApiKey.trim() &&
      !geminiApiKey.includes('••')
    ) {
      user.aiSettings.geminiApiKey = geminiApiKey.trim();
    }

    if (groqBaseUrl !== undefined) user.aiSettings.groqBaseUrl = groqBaseUrl;
    if (model !== undefined) user.aiSettings.model = model;
    if (sttModel !== undefined) user.aiSettings.sttModel = sttModel;
    if (geminiTtsModel !== undefined) user.aiSettings.geminiTtsModel = geminiTtsModel;
    if (temperature !== undefined) user.aiSettings.temperature = Number(temperature);
    if (systemPrompt !== undefined) user.aiSettings.systemPrompt = systemPrompt;

    await user.save();
    const aiConfig = getEffectiveAiConfig(user);
    res.json({
      message: 'Free AI configuration saved',
      hasGroqKey: aiConfig.hasGroqKey,
      hasGeminiKey: aiConfig.hasGeminiKey,
      aiSettings: {
        ...user.aiSettings.toObject(),
        groqApiKey: user.aiSettings.groqApiKey ? '••••••••••••' : '',
        geminiApiKey: user.aiSettings.geminiApiKey ? '••••••••••••' : '',
        hasGroqKey: aiConfig.hasGroqKey,
        hasGeminiKey: aiConfig.hasGeminiKey,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.put('/business', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const allowed = [
      'companyName',
      'industry',
      'tagline',
      'description',
      'website',
      'timezone',
      'workingHours',
      'products',
    ];
    const current = user.businessSettings.toObject();
    for (const key of allowed) {
      if (req.body[key] !== undefined) current[key] = req.body[key];
    }
    user.businessSettings = current;
    await user.save();
    res.json({
      message: 'Business & product configuration saved',
      businessSettings: user.businessSettings,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/voice', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const allowed = ['sttProvider', 'ttsProvider', 'ttsVoice', 'language', 'speechRate', 'autoListen'];
    const current = user.voiceSettings.toObject();
    for (const key of allowed) {
      if (req.body[key] !== undefined) current[key] = req.body[key];
    }
    user.voiceSettings = current;
    await user.save();
    res.json({ message: 'Voice configuration saved', voiceSettings: user.voiceSettings });
  } catch (err) {
    next(err);
  }
});

router.post('/test-connection', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );
    const aiConfig = getEffectiveAiConfig(user);
    const [aiStatus, indexedDocs] = await Promise.all([
      testAiConnection(aiConfig),
      KnowledgeDocument.countDocuments({ userId: req.user._id, status: 'indexed' }),
    ]);

    res.json({
      database: {
        connected: mongoose.connection.readyState === 1,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      },
      ai: aiStatus,
      rag: {
        provider: 'local-tfidf',
        indexedDocuments: indexedDocs,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
