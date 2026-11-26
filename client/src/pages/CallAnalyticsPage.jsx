import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Clock, Eye, X, Trash2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';

export default function CallAnalyticsPage() {
  const { toast } = useToast();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCall, setSelectedCall] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCalls = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/calls', { params: { sentiment: sentimentFilter } });
      setCalls(data.calls || []);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to load call analytics', 'error');
    } finally {
      setLoading(false);
    }
  }, [sentimentFilter, toast]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/calls/${deleteTarget._id}`);
      toast('Call record deleted', 'success');
      setDeleteTarget(null);
      loadCalls();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to delete call', 'error');
    }
  };

  const filteredCalls = calls.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const leadName = (c.leadId?.name || c.analysis?.extractedLead?.name || c.sessionId || '').toLowerCase();
    const summary = (c.analysis?.summary || '').toLowerCase();
    return leadName.includes(q) || summary.includes(q);
  });

  const avgDuration = filteredCalls.length
    ? Math.round(filteredCalls.reduce((s, c) => s + (c.durationSeconds || 0), 0) / filteredCalls.length)
    : 0;
  const avgScore = filteredCalls.length
    ? Math.round(filteredCalls.reduce((s, c) => s + (c.analysis?.leadScore ?? 50), 0) / filteredCalls.length)
    : 0;
  const positiveCalls = filteredCalls.filter((c) => c.analysis?.sentiment === 'positive').length;

  const chartData = filteredCalls
    .slice(0, 10)
    .reverse()
    .map((c, idx) => ({
      name: c.leadId?.name || c.analysis?.extractedLead?.name || `Call #${idx + 1}`,
      leadScore: c.analysis?.leadScore ?? 0,
    }));

  return (
    <div className="space-y-5">
      <div className="pro-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4.5 w-4.5 text-indigo-600" />
          <h2 className="text-[15px] font-bold">Call Intelligence & Sentiment History</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by lead or summary..."
            className="pro-input w-56 py-2"
          />
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="pro-input w-auto py-2"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>
      </div>

      {/* Real DB Call Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="pro-card p-4">
          <p className="text-[11px] font-medium text-slate-500">Analyzed Calls</p>
          <p className="text-2xl font-extrabold tabular-nums mt-1">{filteredCalls.length}</p>
        </div>
        <div className="pro-card p-4">
          <p className="text-[11px] font-medium text-slate-500">Avg Duration</p>
          <p className="text-2xl font-extrabold tabular-nums mt-1">{avgDuration}s</p>
        </div>
        <div className="pro-card p-4">
          <p className="text-[11px] font-medium text-slate-500">Avg Lead Score</p>
          <p className="text-2xl font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">{avgScore}/100</p>
        </div>
        <div className="pro-card p-4">
          <p className="text-[11px] font-medium text-slate-500">Positive Sentiment</p>
          <p className="text-2xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">{positiveCalls}</p>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="pro-card p-6">
          <h3 className="text-sm font-bold mb-4">Lead Score Across Recent Calls</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.14} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="leadScore" name="Lead Score" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-3.5">
        {loading ? (
          <Skeleton className="h-44 w-full" />
        ) : filteredCalls.length === 0 ? (
          <div className="pro-card p-12 text-center">
            <p className="text-xs font-medium text-slate-500">No matching calls recorded yet.</p>
          </div>
        ) : (
          filteredCalls.map((call) => (
            <div key={call._id} className="pro-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-bold text-sm">
                    {call.leadId?.name || call.analysis?.extractedLead?.name || call.sessionId}
                  </h3>
                  <StatusBadge value={call.analysis?.sentiment || 'neutral'} />
                  <StatusBadge value={call.analysis?.leadStatus || 'warm'} />
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {call.durationSeconds || 0}s
                  </span>
                  <span>Score: {call.analysis?.leadScore ?? 50}/100</span>
                  <span>Intent: {call.analysis?.buyingIntent || 'medium'}</span>
                  <button
                    onClick={() => setSelectedCall(call)}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 px-2.5 py-1 font-semibold text-indigo-600 dark:text-indigo-300 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" /> Transcript
                  </button>
                  <button
                    onClick={() => setDeleteTarget(call)}
                    className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {call.analysis?.summary && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">{call.analysis.summary}</p>
              )}

              <div className="flex flex-wrap gap-4 text-xs">
                {call.analysis?.objections?.length > 0 && (
                  <div>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">Objections: </span>
                    <span className="text-slate-500">{call.analysis.objections.join(', ')}</span>
                  </div>
                )}
                {call.analysis?.recommendedNextAction && (
                  <div>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">Next Action: </span>
                    <span className="text-slate-500">{call.analysis.recommendedNextAction}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col pro-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold">Call Transcript</h2>
                <p className="text-xs text-slate-500">{new Date(selectedCall.startedAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedCall(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              {(selectedCall.transcript || []).map((msg, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900 ml-8'
                      : 'bg-slate-100 dark:bg-[#151A26] mr-8'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {msg.role === 'user' ? 'Customer' : 'SalesPilot AI'}
                  </p>
                  <p>{msg.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Call Record"
        message="Delete this call transcript and analytics record?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
