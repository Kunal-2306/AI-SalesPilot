import fs from 'fs/promises';
import KnowledgeDocument from '../models/KnowledgeDocument.js';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
  'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were',
  'will', 'with', 'you', 'your', 'we', 'our', 'this', 'can', 'do', 'how',
  'what', 'when', 'where', 'who', 'why', 'which', 'or', 'if', 'about', 'me',
]);

export function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Deterministic 256-dimension normalized vector embedding using word + trigram hashing.
 * Runs 100% locally with zero paid API dependency.
 */
export function computeLocalEmbedding(text) {
  const dims = 256;
  const vec = new Array(dims).fill(0);
  const tokens = tokenize(text);

  const hashToken = (str) => {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  };

  for (const token of tokens) {
    const idx = hashToken(token) % dims;
    vec[idx] += 2.0;
    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i += 1) {
        const tri = token.slice(i, i + 3);
        vec[hashToken(tri) % dims] += 0.6;
      }
    }
  }

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function chunkText(text, maxChars = 650, overlap = 100) {
  const cleaned = (text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleaned) return [];

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + maxChars, cleaned.length);
    if (end < cleaned.length) {
      const slice = cleaned.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf('\n\n'),
        slice.lastIndexOf('. '),
        slice.lastIndexOf('? '),
        slice.lastIndexOf('! ')
      );
      if (lastBreak > maxChars * 0.4) {
        end = start + lastBreak + 1;
      }
    }

    const chunkContent = cleaned.slice(start, end).trim();
    if (chunkContent) {
      chunks.push(chunkContent);
    }

    if (end >= cleaned.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

export async function extractTextFromFile(filePath, fileType) {
  if (fileType === 'txt') {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim();
  }

  if (fileType === 'pdf') {
    const buffer = await fs.readFile(filePath);
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const data = await pdfParse(Uint8Array.from(buffer));
    return (data.text || '').trim();
  }

  throw new Error(`Unsupported file type: ${fileType}`);
}

export async function indexKnowledgeDocument(docId) {
  const doc = await KnowledgeDocument.findById(docId);
  if (!doc) throw new Error('Knowledge document not found');

  try {
    const rawChunks = chunkText(doc.extractedText);
    if (rawChunks.length === 0) {
      doc.status = 'failed';
      doc.errorMessage = 'Document contained no extractable text.';
      await doc.save();
      return doc;
    }

    const indexedChunks = rawChunks.map((content, idx) => ({
      chunkIndex: idx,
      content,
      embedding: computeLocalEmbedding(content),
      keywords: [...new Set(tokenize(content))].slice(0, 20),
    }));

    doc.chunks = indexedChunks;
    doc.chunkCount = indexedChunks.length;
    doc.embeddingProvider = 'local-tfidf';
    doc.status = 'indexed';
    doc.errorMessage = '';
    await doc.save();
    return doc;
  } catch (err) {
    doc.status = 'failed';
    doc.errorMessage = err.message;
    await doc.save();
    throw err;
  }
}

export async function retrieveRelevantChunks(userId, query, _aiConfig, topK = 4) {
  const docs = await KnowledgeDocument.find({ userId, status: 'indexed' }).lean();
  if (!docs.length || !query?.trim()) return [];

  const queryTokens = new Set(tokenize(query));
  const localQueryVec = computeLocalEmbedding(query);

  const scored = [];
  for (const doc of docs) {
    for (const chunk of doc.chunks || []) {
      const vectorScore =
        chunk.embedding?.length === localQueryVec.length
          ? cosineSimilarity(localQueryVec, chunk.embedding)
          : cosineSimilarity(localQueryVec, computeLocalEmbedding(chunk.content));

      const chunkKeywords = chunk.keywords || tokenize(chunk.content);
      let overlapCount = 0;
      for (const kw of chunkKeywords) {
        if (queryTokens.has(kw)) overlapCount += 1;
      }
      const lexicalScore = queryTokens.size > 0 ? overlapCount / Math.max(queryTokens.size, 1) : 0;
      const combinedScore = Number((vectorScore * 0.72 + lexicalScore * 0.28).toFixed(4));

      if (combinedScore > 0.05) {
        scored.push({
          docId: doc._id,
          title: doc.title,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          score: combinedScore,
        });
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
