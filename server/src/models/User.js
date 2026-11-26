import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: String, required: true, trim: true },
    billingCycle: { type: String, default: 'monthly' },
    description: { type: String, default: '' },
    features: [{ type: String }],
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    companyName: { type: String, default: 'SalesPilot Workspace', trim: true },
    role: { type: String, enum: ['admin', 'rep'], default: 'admin' },
    aiSettings: {
      groqApiKey: { type: String, default: '', select: false },
      groqBaseUrl: { type: String, default: 'https://api.groq.com/openai/v1' },
      llmProvider: { type: String, default: 'groq' },
      model: { type: String, default: 'openai/gpt-oss-120b' },
      sttModel: { type: String, default: 'whisper-large-v3-turbo' },
      geminiApiKey: { type: String, default: '', select: false },
      geminiTtsModel: { type: String, default: 'gemini-2.5-flash-preview-tts' },
      temperature: { type: Number, default: 0.4, min: 0, max: 1.5 },
      systemPrompt: {
        type: String,
        default:
          'You are SalesPilot AI, an expert consultative AI sales representative. Be concise, natural, empathetic, and persuasive. Answer strictly using the provided business knowledge and product catalog when quoting prices or specs. Qualify the prospect (needs, budget, timeline, decision authority) and smoothly offer to book a demo or discovery appointment when appropriate.',
      },
    },
    businessSettings: {
      companyName: { type: String, default: 'Acme Cloud Solutions' },
      industry: { type: String, default: 'B2B SaaS' },
      tagline: { type: String, default: 'Automate revenue operations with intelligent workflows.' },
      description: {
        type: String,
        default:
          'We help B2B teams automate lead qualification, customer onboarding, and pipeline analytics.',
      },
      website: { type: String, default: 'https://salespilot.ai' },
      timezone: { type: String, default: 'UTC' },
      workingHours: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '17:00' },
        days: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      },
      products: {
        type: [productSchema],
        default: [
          {
            name: 'Starter Plan',
            price: '$49/mo',
            billingCycle: 'monthly',
            description: 'Ideal for small sales teams getting started with AI voice qualification.',
            features: ['Up to 500 AI voice minutes', 'CRM lead scoring', 'Calendar booking'],
          },
          {
            name: 'Growth Plan',
            price: '$149/mo',
            billingCycle: 'monthly',
            description: 'Full autonomous voice AI with custom RAG knowledge base & analytics.',
            features: ['2,500 AI voice minutes', 'Unlimited RAG documents', 'Sentiment & objection AI'],
          },
          {
            name: 'Enterprise Plan',
            price: '$499/mo',
            billingCycle: 'monthly',
            description: 'Dedicated voice infrastructure and CRM workflow automation.',
            features: ['Unlimited voice minutes', 'Custom LLM endpoints', 'Dedicated onboarding'],
          },
        ],
      },
    },
    voiceSettings: {
      sttProvider: { type: String, enum: ['groq', 'webspeech'], default: 'groq' },
      ttsProvider: { type: String, enum: ['browser', 'gemini'], default: 'browser' },
      ttsVoice: { type: String, default: 'Kore' },
      language: { type: String, enum: ['auto', 'en', 'hi'], default: 'auto' },
      speechRate: { type: Number, default: 1.0, min: 0.7, max: 1.4 },
      autoListen: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
