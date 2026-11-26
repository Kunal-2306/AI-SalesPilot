import { useCallback, useEffect, useState } from 'react';
import { Upload, FileText, Trash2, Eye, Search, BookOpen, X, Loader2 } from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [viewingDoc, setViewingDoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/knowledge');
      setDocuments(data.documents || []);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to load knowledge documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      toast('Please select a PDF or TXT file', 'warning');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title.trim()) formData.append('title', title.trim());

      await api.post('/knowledge/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast('Document uploaded, chunked, and indexed!', 'success');
      setTitle('');
      setFile(null);
      fetchDocs();
    } catch (err) {
      toast(err.response?.data?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.post('/knowledge/search', { query: searchQuery, topK: 5 });
      setSearchResults(data.results || []);
    } catch (err) {
      toast(err.response?.data?.message || 'Search failed', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/knowledge/${deleteTarget._id}`);
      toast('Document deleted', 'success');
      setDeleteTarget(null);
      fetchDocs();
    } catch (err) {
      toast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form onSubmit={handleUpload} className="pro-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Upload className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="text-[15px] font-bold">Upload Sales Knowledge (PDF / TXT)</h2>
          </div>
          <p className="text-xs text-slate-500">
            Documents are extracted, chunked, and embedded into MongoDB for real-time RAG grounding.
          </p>

          <input
            type="text"
            placeholder="Document title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="pro-input"
          />

          <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#131824] p-6 cursor-pointer hover:border-indigo-500 transition-colors">
            <FileText className="h-7 w-7 text-indigo-500 mb-2" />
            <span className="text-xs font-semibold">
              {file ? file.name : 'Click to select a .pdf or .txt file'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">Maximum file size: 10 MB</span>
            <input
              type="file"
              accept=".pdf,.txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <button type="submit" disabled={uploading || !file} className="pro-btn-primary w-full">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Indexing document...' : 'Upload & Index Document'}
          </button>
        </form>

        <div className="pro-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4.5 w-4.5 text-indigo-600" />
            <h2 className="text-[15px] font-bold">Semantic RAG Search</h2>
          </div>
          <p className="text-xs text-slate-500">
            Query your indexed corpus with vector + lexical similarity scoring.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. enterprise pricing, SOC2 compliance, onboarding..."
              className="pro-input flex-1"
            />
            <button type="submit" disabled={searching} className="pro-btn-primary">
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                Enter a query to inspect matching chunks and relevance scores.
              </p>
            ) : (
              searchResults.map((res, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/70 dark:bg-[#131824] p-3 text-xs">
                  <div className="flex justify-between font-semibold mb-1">
                    <span className="text-indigo-600 dark:text-indigo-400">{res.title}</span>
                    <span className="text-slate-400 tabular-nums">{Math.round(res.score * 100)}% match</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{res.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="pro-card p-6">
        <h2 className="text-[15px] font-bold mb-4">Indexed Documents</h2>
        {loading ? (
          <Skeleton className="h-36 w-full" />
        ) : documents.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-xs font-medium text-slate-500">No documents uploaded yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div
                key={doc._id}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-[#131824] p-4"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{doc.title}</p>
                    <StatusBadge value={doc.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    {doc.fileType.toUpperCase()} · {(doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '0 KB')} · {doc.chunkCount} chunks · {doc.embeddingProvider}
                  </p>
                  {doc.errorMessage && (
                    <p className="text-[11px] text-rose-500 mt-0.5 truncate">{doc.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setViewingDoc(doc)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 cursor-pointer"
                    title="View extracted content"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(doc)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 cursor-pointer"
                    title="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col pro-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold">{viewingDoc.title}</h2>
                <p className="text-xs text-slate-500">
                  {viewingDoc.chunkCount} chunks · {viewingDoc.originalFilename}
                </p>
              </div>
              <button onClick={() => setViewingDoc(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <pre className="mt-4 flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 dark:bg-[#090B10] border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-700 dark:text-slate-300 font-mono">
              {viewingDoc.extractedText || 'No extracted text.'}
            </pre>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Knowledge Document"
        message={`Delete "${deleteTarget?.title}" and all indexed chunks?`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
