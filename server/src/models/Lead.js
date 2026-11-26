import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, default: 'Unknown Prospect', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    phone: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    roleTitle: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['hot', 'warm', 'cold', 'converted', 'lost'],
      default: 'warm',
      index: true,
    },
    score: { type: Number, default: 50, min: 0, max: 100 },
    buyingIntent: {
      type: String,
      enum: ['high', 'medium', 'low', 'unknown'],
      default: 'medium',
    },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral',
    },
    budget: { type: String, default: '' },
    timeline: { type: String, default: '' },
    painPoints: [{ type: String }],
    interests: [{ type: String }],
    objections: [{ type: String }],
    aiSummary: { type: String, default: '' },
    recommendedNextAction: { type: String, default: 'Follow up with tailored product overview' },
    source: {
      type: String,
      enum: ['voice_call', 'manual', 'web'],
      default: 'voice_call',
    },
    lastContactedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

leadSchema.index({ userId: 1, status: 1, score: -1 });

export default mongoose.model('Lead', leadSchema);
