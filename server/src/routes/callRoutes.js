import express from 'express';
import crypto from 'crypto';
import Call from '../models/Call.js';
import Lead from '../models/Lead.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { generateSalesTurn, getEffectiveAiConfig } from '../services/aiService.js';
import { retrieveRelevantChunks } from '../services/ragService.js';
import { findNextAvailableSlot } from '../services/appointmentService.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const { sentiment = 'all', status = 'all' } = req.query;
    const query = { userId: req.user._id };
    if (sentiment !== 'all') query['analysis.sentiment'] = sentiment;
    if (status !== 'all') query.status = status;

    const calls = await Call.find(query)
      .populate('leadId', 'name email company status score')
      .populate('appointmentBookedId', 'title scheduledAt status')
      .sort({ startedAt: -1 })
      .lean();

    res.json({ calls });
  } catch (err) {
    next(err);
  }
});

router.post('/start', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );
    const aiConfig = getEffectiveAiConfig(user);
    const companyName = user.businessSettings?.companyName || user.companyName || 'SalesPilot AI';
    const language = req.body.language || user?.voiceSettings?.language || 'auto';

    const greeting =
      language === 'hi'
        ? `नमस्ते! मैं ${companyName} का AI सेल्स प्रतिनिधि हूँ। आज कॉल पर जुड़ने के लिए धन्यवाद — बताइए मैं आपकी टीम की क्या मदद कर सकता हूँ?`
        : `Hello! I'm the AI sales representative for ${companyName}. Thanks for joining the call today — how can I help your team?`;

    const call = await Call.create({
      userId: req.user._id,
      leadId: req.body.leadId || null,
      sessionId: `call_${crypto.randomBytes(6).toString('hex')}`,
      status: 'active',
      startedAt: new Date(),
      aiMode: aiConfig.hasGroqKey ? 'groq-live' : 'unconfigured',
      transcript: [
        {
          role: 'assistant',
          content: greeting,
          sentiment: 'positive',
          aiMode: aiConfig.hasGroqKey ? 'groq-live' : 'unconfigured',
        },
      ],
    });

    await logActivity(req.user._id, 'call_started', 'Voice call session started', `Session ${call.sessionId}`);

    res.status(201).json({
      call,
      greeting,
      aiMode: call.aiMode,
      providers: {
        stt: aiConfig.sttProvider === 'webspeech' ? 'Browser Web Speech' : `Groq Whisper (${aiConfig.sttModel})`,
        llm: `Groq (${aiConfig.model})`,
        tts: aiConfig.ttsProvider === 'gemini' ? `Google Gemini (${aiConfig.geminiTtsModel})` : 'Browser SpeechSynthesis',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/turn', protect, async (req, res, next) => {
  try {
    const { message, language } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Customer message text is required' });
    }

    const call = await Call.findOne({ _id: req.params.id, userId: req.user._id });
    if (!call) return res.status(404).json({ message: 'Call session not found' });

    const user = await User.findById(req.user._id).select(
      '+aiSettings.groqApiKey +aiSettings.geminiApiKey'
    );

    // 1. RAG Retrieval (local TF-IDF + vector similarity over MongoDB chunks)
    const retrievedChunks = await retrieveRelevantChunks(req.user._id, message, null, 3);

    // 2. Call Real Groq LLM (throws explicit error if key missing or rate-limited — never fakes responses)
    const { aiMode, provider, result, modelUsed, tokensUsed, latencyMs } = await generateSalesTurn({
      user,
      call,
      userMessage: message.trim(),
      retrievedChunks,
      language,
    });

    // 3. Persist both turns only after Groq succeeds (so retry never duplicates turns!)
    call.transcript.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
      sentiment: result.sentiment,
    });

    call.transcript.push({
      role: 'assistant',
      content: result.reply,
      timestamp: new Date(),
      sentiment: 'positive',
      aiMode,
      retrievedSources: retrievedChunks.map((c) => ({
        docId: c.docId,
        title: c.title,
        score: c.score,
      })),
    });

    call.aiMode = aiMode;
    call.analysis = {
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      leadScore: result.leadScore,
      leadStatus: result.leadStatus,
      buyingIntent: result.buyingIntent,
      summary: result.summary,
      objections: result.objections,
      keyNeeds: result.keyNeeds,
      recommendedNextAction: result.recommendedNextAction,
      extractedLead: result.extractedLead,
    };

    // 4. Auto-create or update CRM Lead
    let lead = call.leadId ? await Lead.findById(call.leadId) : null;
    const ext = result.extractedLead || {};
    const hasLeadSignal = ext.name || ext.email || ext.phone || ext.company || call.transcript.length >= 3;

    if (!lead && hasLeadSignal) {
      if (ext.email) {
        lead = await Lead.findOne({ userId: req.user._id, email: ext.email.toLowerCase() });
      }
      if (!lead) {
        lead = await Lead.create({
          userId: req.user._id,
          name: ext.name || 'Voice Prospect',
          email: ext.email || '',
          phone: ext.phone || '',
          company: ext.company || '',
          status: result.leadStatus,
          score: result.leadScore,
          buyingIntent: result.buyingIntent,
          sentiment: result.sentiment,
          budget: ext.budget || '',
          timeline: ext.timeline || '',
          painPoints: result.keyNeeds,
          objections: result.objections,
          aiSummary: result.summary,
          recommendedNextAction: result.recommendedNextAction,
          source: 'voice_call',
          lastContactedAt: new Date(),
        });
        await logActivity(
          req.user._id,
          'lead_created',
          `AI qualified new lead: ${lead.name}`,
          `Score ${lead.score}/100 (${lead.status})`
        );
      }
      call.leadId = lead._id;
    } else if (lead) {
      if (ext.name && (lead.name === 'Voice Prospect' || lead.name === 'Unknown Prospect')) lead.name = ext.name;
      if (ext.email && !lead.email) lead.email = ext.email;
      if (ext.phone && !lead.phone) lead.phone = ext.phone;
      if (ext.company && !lead.company) lead.company = ext.company;
      if (ext.budget) lead.budget = ext.budget;
      if (ext.timeline) lead.timeline = ext.timeline;
      lead.status = lead.status === 'converted' ? 'converted' : result.leadStatus;
      lead.score = result.leadScore;
      lead.buyingIntent = result.buyingIntent;
      lead.sentiment = result.sentiment;
      lead.painPoints = [...new Set([...(lead.painPoints || []), ...result.keyNeeds])];
      lead.objections = [...new Set([...(lead.objections || []), ...result.objections])];
      lead.aiSummary = result.summary;
      lead.recommendedNextAction = result.recommendedNextAction;
      lead.lastContactedAt = new Date();
      await lead.save();
    }

    // 5. Auto-book appointment if AI detected booking intent (with double-booking prevention)
    let bookedAppointment = null;
    if (result.appointmentIntent?.wantsToBook && !call.appointmentBookedId) {
      const requestedAt = result.appointmentIntent.suggestedDateTimeIso
        ? new Date(result.appointmentIntent.suggestedDateTimeIso)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { scheduledAt } = await findNextAvailableSlot({
        userId: req.user._id,
        preferredDate: requestedAt,
        durationMinutes: 30,
      });

      bookedAppointment = await Appointment.create({
        userId: req.user._id,
        leadId: lead?._id || null,
        callId: call._id,
        title: `AI Booked Demo - ${lead?.name || ext.name || 'Prospect'}`,
        leadName: lead?.name || ext.name || 'Voice Prospect',
        leadEmail: lead?.email || ext.email || '',
        leadPhone: lead?.phone || ext.phone || '',
        company: lead?.company || ext.company || '',
        scheduledAt,
        durationMinutes: 30,
        status: 'confirmed',
        meetingType: result.appointmentIntent.meetingType || 'product_demo',
        notes: result.appointmentIntent.notes || result.summary,
        bookedBy: 'ai_agent',
      });

      call.appointmentBookedId = bookedAppointment._id;
      if (lead) {
        lead.status = 'converted';
        lead.score = Math.max(lead.score, 90);
        await lead.save();
      }

      await logActivity(
        req.user._id,
        'appointment_booked',
        `AI booked appointment: ${bookedAppointment.title}`,
        new Date(bookedAppointment.scheduledAt).toLocaleString()
      );
    }

    call.durationSeconds = Math.max(
      1,
      Math.round((Date.now() - new Date(call.startedAt).getTime()) / 1000)
    );
    await call.save();

    const io = req.app.get('io');
    if (io) {
      io.to(String(req.user._id)).emit('call:turn', {
        callId: call._id,
        analysis: call.analysis,
        lead,
        bookedAppointment,
      });
    }

    res.json({
      reply: result.reply,
      detectedLanguage: result.detectedLanguage,
      aiMode,
      provider,
      modelUsed,
      tokensUsed,
      latencyMs,
      analysis: call.analysis,
      retrievedSources: retrievedChunks,
      lead,
      bookedAppointment,
      callId: call._id,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        message: err.message,
        code: err.code || 'GROQ_ERROR',
        retryable: Boolean(err.retryable),
      });
    }
    next(err);
  }
});

router.post('/:id/end', protect, async (req, res, next) => {
  try {
    const call = await Call.findOne({ _id: req.params.id, userId: req.user._id });
    if (!call) return res.status(404).json({ message: 'Call session not found' });

    call.status = 'completed';
    call.endedAt = new Date();
    call.durationSeconds =
      typeof req.body.durationSeconds === 'number'
        ? req.body.durationSeconds
        : Math.max(1, Math.round((call.endedAt.getTime() - new Date(call.startedAt).getTime()) / 1000));

    await call.save();
    await logActivity(
      req.user._id,
      'call_ended',
      `Call completed (${call.durationSeconds}s)`,
      call.analysis?.summary || `Lead score: ${call.analysis?.leadScore ?? 50}`
    );

    res.json({ call });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const call = await Call.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('leadId')
      .populate('appointmentBookedId')
      .lean();
    if (!call) return res.status(404).json({ message: 'Call not found' });
    res.json({ call });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    const call = await Call.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!call) return res.status(404).json({ message: 'Call not found' });
    res.json({ message: 'Call record deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
