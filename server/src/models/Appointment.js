import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    callId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Call',
      default: null,
    },
    title: { type: String, required: true, trim: true },
    leadName: { type: String, default: 'Prospect', trim: true },
    leadEmail: { type: String, default: '', trim: true },
    leadPhone: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 30 },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'],
      default: 'confirmed',
    },
    meetingType: {
      type: String,
      enum: ['discovery_call', 'product_demo', 'proposal_review', 'follow_up'],
      default: 'product_demo',
    },
    notes: { type: String, default: '' },
    bookedBy: {
      type: String,
      enum: ['ai_agent', 'manual'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Appointment', appointmentSchema);
