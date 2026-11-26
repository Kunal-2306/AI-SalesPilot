import express from 'express';
import Lead from '../models/Lead.js';
import Call from '../models/Call.js';
import Appointment from '../models/Appointment.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const {
      search = '',
      status = 'all',
      sentiment = 'all',
      buyingIntent = 'all',
      minScore = 0,
      maxScore = 100,
    } = req.query;
    const query = { userId: req.user._id };

    if (status && status !== 'all') {
      query.status = status;
    }
    if (sentiment && sentiment !== 'all') {
      query.sentiment = sentiment;
    }
    if (buyingIntent && buyingIntent !== 'all') {
      query.buyingIntent = buyingIntent;
    }

    query.score = {
      $gte: Number(minScore) || 0,
      $lte: Number(maxScore) || 100,
    };

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { email: regex }, { company: regex }, { phone: regex }];
    }

    const leads = await Lead.find(query).sort({ score: -1, updatedAt: -1 }).lean();
    res.json({ leads });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const lead = await Lead.create({
      ...req.body,
      userId: req.user._id,
      source: req.body.source || 'manual',
    });

    await logActivity(req.user._id, 'lead_created', `Lead created: ${lead.name}`, lead.company || '');
    res.status(201).json({ lead });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id }).lean();
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const [calls, appointments] = await Promise.all([
      Call.find({ userId: req.user._id, leadId: lead._id }).sort({ startedAt: -1 }).lean(),
      Appointment.find({ userId: req.user._id, leadId: lead._id }).sort({ scheduledAt: -1 }).lean(),
    ]);

    res.json({ lead, calls, appointments });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, async (req, res, next) => {
  try {
    const allowedFields = [
      'name',
      'email',
      'phone',
      'company',
      'roleTitle',
      'status',
      'score',
      'buyingIntent',
      'sentiment',
      'budget',
      'timeline',
      'painPoints',
      'interests',
      'objections',
      'aiSummary',
      'recommendedNextAction',
    ];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    await logActivity(req.user._id, 'lead_updated', `Lead updated: ${lead.name}`, `Status: ${lead.status}`);
    res.json({ lead });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
