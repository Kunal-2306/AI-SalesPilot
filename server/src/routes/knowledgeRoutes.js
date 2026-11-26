import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import KnowledgeDocument from '../models/KnowledgeDocument.js';
import { protect } from '../middleware/auth.js';
import {
  extractTextFromFile,
  indexKnowledgeDocument,
  retrieveRelevantChunks,
} from '../services/ragService.js';
import { logActivity } from '../utils/activity.js';

const router = express.Router();

const upload = multer({
  dest: path.resolve('uploads'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are supported'));
    }
  },
});

router.get('/', protect, async (req, res, next) => {
  try {
    const documents = await KnowledgeDocument.find({ userId: req.user._id })
      .select('-chunks.embedding')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ documents });
  } catch (err) {
    next(err);
  }
});

router.post('/upload', protect, upload.single('file'), async (req, res, next) => {
  const uploadedPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please attach a PDF or TXT file' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const title = req.body.title?.trim() || req.file.originalname;

    let extractedText = '';
    try {
      extractedText = await extractTextFromFile(uploadedPath, ext);
    } catch (parseErr) {
      return res.status(400).json({
        message: `Failed to parse ${ext.toUpperCase()} file: ${parseErr.message}`,
      });
    }
    const doc = await KnowledgeDocument.create({
      userId: req.user._id,
      title,
      originalFilename: req.file.originalname,
      fileType: ext,
      fileSize: req.file.size,
      extractedText,
      status: 'processing',
    });

    const indexedDoc = await indexKnowledgeDocument(doc._id);

    await logActivity(
      req.user._id,
      'knowledge_uploaded',
      `Indexed document: ${indexedDoc.title}`,
      `${indexedDoc.chunkCount} chunks (${indexedDoc.embeddingProvider})`
    );

    const responseDoc = indexedDoc.toObject();
    delete responseDoc.chunks;
    res.status(201).json({ document: responseDoc });
  } catch (err) {
    next(err);
  } finally {
    if (uploadedPath) {
      fs.unlink(uploadedPath).catch(() => {});
    }
  }
});

router.post('/search', protect, async (req, res, next) => {
  try {
    const { query, topK = 5 } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await retrieveRelevantChunks(req.user._id, query, null, Number(topK));
    res.json({ query, results });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', protect, async (req, res, next) => {
  try {
    const document = await KnowledgeDocument.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .select('-chunks.embedding')
      .lean();
    if (!document) return res.status(404).json({ message: 'Document not found' });
    res.json({ document });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', protect, async (req, res, next) => {
  try {
    const doc = await KnowledgeDocument.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json({ message: 'Knowledge document deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
