import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { getJwtSecret } from '../config/env.js';
import { getEffectiveAiConfig } from '../services/aiService.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later.' },
});

const signToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sanitizeUser = (userDoc) => {
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete obj.password;
  const effective = getEffectiveAiConfig(userDoc);
  obj.aiSettings = {
    ...(obj.aiSettings || {}),
    hasGroqKey: effective.hasGroqKey,
    hasGeminiKey: effective.hasGeminiKey,
    groqApiKey: obj.aiSettings?.groqApiKey ? '••••••••••••' : '',
    geminiApiKey: obj.aiSettings?.geminiApiKey ? '••••••••••••' : '',
    model: effective.model,
    sttModel: effective.sttModel,
    geminiTtsModel: effective.geminiTtsModel,
    groqBaseUrl: effective.groqBaseUrl,
  };
  return obj;
};

router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { name, email, password, companyName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      companyName: companyName || 'SalesPilot Workspace',
      businessSettings: {
        companyName: companyName || 'SalesPilot Workspace',
      },
    });

    const token = signToken(user._id);
    res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password +aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', protect, async (req, res, next) => {
  try {
    const { name, companyName, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select(
      '+password +aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );

    if (name) user.name = name;
    if (companyName) user.companyName = companyName;

    if (newPassword) {
      if (!currentPassword || !(await user.comparePassword(currentPassword))) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }
      user.password = newPassword;
    }

    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
