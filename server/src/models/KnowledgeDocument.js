import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    keywords: { type: [String], default: [] },
  },
  { _id: false }
);

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    originalFilename: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'txt'], required: true },
    fileSize: { type: Number, default: 0 },
    extractedText: { type: String, default: '' },
    status: {
      type: String,
      enum: ['processing', 'indexed', 'failed'],
      default: 'processing',
    },
    errorMessage: { type: String, default: '' },
    chunkCount: { type: Number, default: 0 },
    embeddingProvider: {
      type: String,
      enum: ['openai', 'local-tfidf'],
      default: 'local-tfidf',
    },
    chunks: [chunkSchema],
  },
  { timestamps: true }
);

export default mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
