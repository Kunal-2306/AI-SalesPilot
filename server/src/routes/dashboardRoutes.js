import express from 'express';
import Lead from '../models/Lead.js';
import Call from '../models/Call.js';
import Appointment from '../models/Appointment.js';
import ActivityLog from '../models/ActivityLog.js';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/overview', protect, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const [leads, calls, appointments, recentActivity, docCount] = await Promise.all([
      Lead.find({ userId }).sort({ createdAt: -1 }).lean(),
      Call.find({ userId }).sort({ startedAt: -1 }).populate('leadId', 'name company status score').lean(),
      Appointment.find({ userId }).sort({ scheduledAt: 1 }).lean(),
      ActivityLog.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
      KnowledgeDocument.countDocuments({ userId, status: 'indexed' }),
    ]);

    const totalLeads = leads.length;
    const hotLeads = leads.filter((l) => l.status === 'hot').length;
    const warmLeads = leads.filter((l) => l.status === 'warm').length;
    const coldLeads = leads.filter((l) => l.status === 'cold').length;
    const convertedLeads = leads.filter((l) => l.status === 'converted').length;

    const totalCalls = calls.length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.durationSeconds || 0), 0);
    const avgCallDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;

    const activeAppointments = appointments.filter((a) => a.status !== 'cancelled');
    const appointmentsBooked = activeAppointments.length;

    // Conversion rate: percentage of leads that converted or booked an appointment
    const leadsWithBookings = new Set(
      activeAppointments.filter((a) => a.leadId).map((a) => String(a.leadId))
    );
    const convertedCount = leads.filter(
      (l) => l.status === 'converted' || leadsWithBookings.has(String(l._id))
    ).length;
    const conversionRate =
      totalLeads > 0
        ? Number(((convertedCount / totalLeads) * 100).toFixed(1))
        : totalCalls > 0
          ? Number(((appointmentsBooked / totalCalls) * 100).toFixed(1))
          : 0;

    // Build 7-day sales performance series from actual DB records
    const dayMap = new Map();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isoDate: key,
        calls: 0,
        leads: 0,
        appointments: 0,
      });
    }

    for (const c of calls) {
      const key = new Date(c.startedAt || c.createdAt).toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.get(key).calls += 1;
    }
    for (const l of leads) {
      const key = new Date(l.createdAt).toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.get(key).leads += 1;
    }
    for (const a of activeAppointments) {
      const key = new Date(a.createdAt || a.scheduledAt).toISOString().slice(0, 10);
      if (dayMap.has(key)) dayMap.get(key).appointments += 1;
    }

    const leadDistribution = [
      { name: 'Hot', value: hotLeads, color: '#ef4444' },
      { name: 'Warm', value: warmLeads, color: '#f59e0b' },
      { name: 'Cold', value: coldLeads, color: '#3b82f6' },
      { name: 'Converted', value: convertedLeads, color: '#10b981' },
    ];

    res.json({
      metrics: {
        totalLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        convertedLeads,
        totalCalls,
        avgCallDuration,
        appointmentsBooked,
        conversionRate,
        indexedDocs: docCount,
      },
      salesPerformance: Array.from(dayMap.values()),
      leadDistribution,
      recentCalls: calls.slice(0, 5),
      recentLeads: leads.slice(0, 5),
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
