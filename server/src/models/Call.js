import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    sentiment: { type: String, default: 'neutral' },
    aiMode: { type: String, default: 'openai-live' },
    retrievedSources: [
      {
        docId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeDocument' },
        title: String,
        score: Number,
      },
    ],
  },
  { _id: true }
);

const callSchema = new mongoose.Schema(
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
      index: true,
    },
    sessionId: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned', 'error'],
      default: 'active',
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    transcript: [messageSchema],
    analysis: {
      sentiment: { type: String, enum: ['positive', 'neutral', 'negative'], default: 'neutral' },
      sentimentScore: { type: Number, default: 0 },
      leadScore: { type: Number, default: 50, min: 0, max: 100 },
      leadStatus: { type: String, enum: ['hot', 'warm', 'cold'], default: 'warm' },
      buyingIntent: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
      summary: { type: String, default: '' },
      objections: [{ type: String }],
      keyNeeds: [{ type: String }],
      recommendedNextAction: { type: String, default: '' },
      extractedLead: {
        name: { type: String, default: '' },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        company: { type: String, default: '' },
        budget: { type: String, default: '' },
        timeline: { type: String, default: '' },
      },
    },
    appointmentBookedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    aiMode: {
      type: String,
      default: 'groq-live',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Call', callSchema);
