import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'call_started',
        'call_ended',
        'lead_created',
        'lead_updated',
        'appointment_booked',
        'appointment_updated',
        'knowledge_uploaded',
      ],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model('ActivityLog', activityLogSchema);
