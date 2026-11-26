import Appointment from '../models/Appointment.js';

/**
 * Checks whether a proposed [scheduledAt, scheduledAt + durationMinutes) interval
 * overlaps any existing non-cancelled appointment for the user.
 */
export async function findConflictingAppointment({
  userId,
  scheduledAt,
  durationMinutes = 30,
  excludeId = null,
}) {
  const reqStart = new Date(scheduledAt).getTime();
  const reqEnd = reqStart + durationMinutes * 60 * 1000;

  const windowStart = new Date(reqStart - 4 * 60 * 60 * 1000);
  const windowEnd = new Date(reqEnd + 4 * 60 * 60 * 1000);

  const query = {
    userId,
    status: { $ne: 'cancelled' },
    scheduledAt: { $gte: windowStart, $lte: windowEnd },
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const candidates = await Appointment.find(query).lean();
  for (const appt of candidates) {
    const apptStart = new Date(appt.scheduledAt).getTime();
    const apptEnd = apptStart + (appt.durationMinutes || 30) * 60 * 1000;
    if (reqStart < apptEnd && reqEnd > apptStart) {
      return appt;
    }
  }
  return null;
}

/**
 * Finds the requested slot if free, or advances in 30-minute increments
 * to prevent AI auto-booking from double-booking an occupied slot.
 */
export async function findNextAvailableSlot({
  userId,
  preferredDate,
  durationMinutes = 30,
}) {
  let candidate = new Date(preferredDate);
  if (Number.isNaN(candidate.getTime())) {
    candidate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    candidate.setMinutes(0, 0, 0);
  }

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const conflict = await findConflictingAppointment({
      userId,
      scheduledAt: candidate,
      durationMinutes,
    });
    if (!conflict) {
      return { scheduledAt: candidate, shifted: attempt > 0 };
    }
    candidate = new Date(candidate.getTime() + 30 * 60 * 1000);
  }

  return { scheduledAt: candidate, shifted: true };
}
