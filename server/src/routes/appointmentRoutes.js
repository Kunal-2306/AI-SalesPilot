import express from 'express';
import Appointment from '../models/Appointment.js';
import Lead from '../models/Lead.js';
import { protect } from '../middleware/auth.js';
import { logActivity } from '../utils/activity.js';
import { findConflictingAppointment } from '../services/appointmentService.js';

const router = express.Router();

router.get('/', protect, async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = { userId: req.user._id };
    if (status && status !== 'all') query.status = status;

    const appointments = await Appointment.find(query)
      .populate('leadId', 'name email company status score')
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
});

router.get('/slots', protect, async (req, res, next) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    const booked = await Appointment.find({
      userId: req.user._id,
      status: { $ne: 'cancelled' },
      scheduledAt: { $gte: dayStart, $lte: dayEnd },
    }).lean();

    const slots = [];
    for (let h = 9; h <= 17; h += 1) {
      const slotStart = new Date(`${dateStr}T${String(h).padStart(2, '0')}:00:00.000Z`).getTime();
      const slotEnd = slotStart + 30 * 60 * 1000;

      const hasOverlap = booked.some((b) => {
        const bStart = new Date(b.scheduledAt).getTime();
        const bEnd = bStart + (b.durationMinutes || 30) * 60 * 1000;
        return slotStart < bEnd && slotEnd > bStart;
      });

      slots.push({
        timeLabel: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'} UTC`,
        iso: new Date(slotStart).toISOString(),
        available: !hasOverlap,
      });
    }

    res.json({ date: dateStr, slots });
  } catch (err) {
    next(err);
  }
});

router.post('/', protect, async (req, res, next) => {
  try {
    const {
      title,
      leadId,
      leadName,
      leadEmail,
      leadPhone,
      company,
      scheduledAt,
      durationMinutes = 30,
      meetingType,
      notes,
    } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ message: 'scheduledAt timestamp is required' });
    }

    const parsedDate = new Date(scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid scheduledAt date format' });
    }

    const conflict = await findConflictingAppointment({
      userId: req.user._id,
      scheduledAt: parsedDate,
      durationMinutes: Number(durationMinutes) || 30,
    });

    if (conflict) {
      return res.status(409).json({
        message: `Time slot conflicts with "${conflict.title}" at ${new Date(conflict.scheduledAt).toLocaleString()}`,
        conflict,
      });
    }

    let resolvedLeadName = leadName;
    let resolvedEmail = leadEmail;
    let resolvedCompany = company;

    if (leadId) {
      const lead = await Lead.findOne({ _id: leadId, userId: req.user._id });
      if (lead) {
        resolvedLeadName = resolvedLeadName || lead.name;
        resolvedEmail = resolvedEmail || lead.email;
        resolvedCompany = resolvedCompany || lead.company;
      }
    }

    const appointment = await Appointment.create({
      userId: req.user._id,
      leadId: leadId || null,
      title: title || `Sales Demo - ${resolvedLeadName || 'Prospect'}`,
      leadName: resolvedLeadName || 'Prospect',
      leadEmail: resolvedEmail || '',
      leadPhone: leadPhone || '',
      company: resolvedCompany || '',
      scheduledAt: parsedDate,
      durationMinutes: Number(durationMinutes) || 30,
      status: 'confirmed',
      meetingType: meetingType || 'product_demo',
      notes: notes || '',
      bookedBy: 'manual',
    });

    await logActivity(
      req.user._id,
      'appointment_booked',
      `Appointment confirmed: ${appointment.title}`,
      new Date(appointment.scheduledAt).toLocaleString()
    );

    res.status(201).json({ appointment });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', protect, async (req, res, next) => {
  try {
    const existing = await Appointment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!existing) return res.status(404).json({ message: 'Appointment not found' });

    const allowedFields = [
      'title',
      'leadName',
      'leadEmail',
      'leadPhone',
      'company',
      'durationMinutes',
      'status',
      'meetingType',
      'notes',
    ];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (req.body.scheduledAt !== undefined) {
      const parsedDate = new Date(req.body.scheduledAt);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid scheduledAt date format' });
      }
      const conflict = await findConflictingAppointment({
        userId: req.user._id,
        scheduledAt: parsedDate,
        durationMinutes: Number(updates.durationMinutes ?? existing.durationMinutes) || 30,
        excludeId: existing._id,
      });
      if (conflict) {
        return res.status(409).json({
          message: `Rescheduled time conflicts with "${conflict.title}"`,
          conflict,
        });
      }
      updates.scheduledAt = parsedDate;
      if (!updates.status) updates.status = 'rescheduled';
    }

    const appointment = await Appointment.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    await logActivity(
      req.user._id,
      'appointment_updated',
      `Appointment ${appointment.status}: ${appointment.title}`,
      new Date(appointment.scheduledAt).toLocaleString()
    );

    res.json({ appointment });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    const appointment = await Appointment.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });
    res.json({ message: 'Appointment deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
