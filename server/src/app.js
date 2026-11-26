import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import callRoutes from './routes/callRoutes.js';
import voiceRoutes from './routes/voiceRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true,
      credentials: true,
    })
  );

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', limiter);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SalesPilot AI API',
      dbConnected: mongoose.connection.readyState === 1,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/knowledge', knowledgeRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/voice', voiceRoutes);
  app.use('/api/settings', settingsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
