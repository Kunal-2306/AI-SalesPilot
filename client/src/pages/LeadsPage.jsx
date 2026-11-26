import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../context/ToastContext';

export default function LeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sentimentFilter, setSentimentFilter] = useState('all');
  const [intentFilter, setIntentFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');

  const [selectedLeadDetail, setSelectedLeadDetail] = useState(null);
  const [editingLead, setEditingLead] = useState(null);
  const [creatingLead, setCreatingLead] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'warm',
    score: 50,
    budget: '',
    timeline: '',
    aiSummary: '',
    recommendedNextAction: '',
  });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      let minScore = 0;
      let maxScore = 100;
      if (scoreFilter === 'high') minScore = 75;
      else if (scoreFilter === 'medium') {
        minScore = 45;
        maxScore = 74;
      } else if (scoreFilter === 'low') maxScore = 44;

      const { data } = await api.get('/leads', {
        params: {
          search,
          status: statusFilter,
          sentiment: sentimentFilter,
          buyingIntent: intentFilter,
          minScore,
          maxScore,
        },
      });
      setLeads(data.leads || []);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sentimentFilter, intentFilter, scoreFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(fetchLeads, 200);
    return () => clearTimeout(timer);
  }, [fetchLeads]);

  const openDetails = async (id) => {
    try {
      const { data } = await api.get(`/leads/${id}`);
      setSelectedLeadDetail(data);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to load lead details', 'error');
    }
  };

  const openEdit = (lead) => {
    setEditingLead(lead);
    setFormState({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      status: lead.status || 'warm',
      score: lead.score ?? 50,
      budget: lead.budget || '',
      timeline: lead.timeline || '',
      aiSummary: lead.aiSummary || '',
      recommendedNextAction: lead.recommendedNextAction || '',
    });
  };

  const openCreate = () => {
    setCreatingLead(true);
    setFormState({
      name: '',
      email: '',
      phone: '',
      company: '',
      status: 'warm',
      score: 60,
      budget: '',
      timeline: '',
      aiSummary: '',
      recommendedNextAction: 'Schedule initial discovery call',
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (creatingLead) {
        await api.post('/leads', formState);
        toast('Lead created successfully', 'success');
        setCreatingLead(false);
      } else if (editingLead) {
        await api.put(`/leads/${editingLead._id}`, formState);
        toast('Lead updated successfully', 'success');
        setEditingLead(null);
      }
      fetchLeads();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save lead', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/leads/${deleteTarget._id}`);
      toast('Lead deleted', 'success');
      setDeleteTarget(null);
      fetchLeads();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to delete lead', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="pro-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads by name, company, email..."
              className="pro-input pl-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pro-input w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>

          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            className="pro-input w-auto"
          >
            <option value="all">All Scores</option>
            <option value="high">High (75–100)</option>
            <option value="medium">Medium (45–74)</option>
            <option value="low">Low (0–44)</option>
          </select>

          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="pro-input w-auto"
          >
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>

          <select
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="pro-input w-auto"
          >
            <option value="all">All Intent</option>
            <option value="high">High Intent</option>
            <option value="medium">Medium Intent</option>
            <option value="low">Low Intent</option>
          </select>
        </div>

        <button onClick={openCreate} className="pro-btn-primary">
          <Plus className="h-4 w-4" />
          Add Lead
        </button>
      </div>

      <div className="pro-card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Users className="mx-auto h-9 w-9 text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-semibold">No matching leads found</p>
            <p className="text-xs text-slate-500 mt-1">
              Start an AI voice call or add a lead manually to populate your pipeline.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#121622] text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3.5">Lead</th>
                  <th className="px-4 py-3.5">Company</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Score</th>
                  <th className="px-4 py-3.5">Sentiment</th>
                  <th className="hidden xl:table-cell px-4 py-3.5">Next Action</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {leads.map((lead) => (
                  <tr
                    key={lead._id}
                    onClick={() => openDetails(lead._id)}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#131824] transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900 dark:text-white">{lead.name}</p>
                      <p className="text-xs text-slate-500">{lead.email || lead.phone || 'No contact info'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">{lead.company || '—'}</td>
                    <td className="px-4 py-3.5"><StatusBadge value={lead.status} /></td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${lead.score}%` }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums">{lead.score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge value={lead.sentiment || 'neutral'} /></td>
                    <td className="hidden xl:table-cell px-4 py-3.5 max-w-[180px] truncate text-xs text-slate-500 dark:text-slate-400">
                      {lead.recommendedNextAction || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openDetails(lead._id)}
                          aria-label={`View details for ${lead.name}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950 cursor-pointer"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(lead)}
                          aria-label={`Edit ${lead.name}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit lead"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(lead)}
                          aria-label={`Delete ${lead.name}`}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 cursor-pointer"
                          title="Delete lead"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lead Details Modal */}
      {selectedLeadDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto pro-card p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold">{selectedLeadDetail.lead.name}</h2>
                  <StatusBadge value={selectedLeadDetail.lead.status} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedLeadDetail.lead.company || 'Company N/A'} · {selectedLeadDetail.lead.email || 'No email'} · Score: {selectedLeadDetail.lead.score}/100
                </p>
              </div>
              <button
                onClick={() => setSelectedLeadDetail(null)}
                aria-label="Close lead details"
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-sm">
              <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-500/20 p-4">
                <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300 text-xs uppercase tracking-wider mb-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI-Generated Summary
                </div>
                <p className="text-slate-700 dark:text-slate-300 text-sm">
                  {selectedLeadDetail.lead.aiSummary || 'No AI summary recorded yet.'}
                </p>
                <p className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  Recommended Follow-Up: {selectedLeadDetail.lead.recommendedNextAction}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <span className="text-slate-500">Budget</span>
                  <p className="font-semibold mt-0.5">{selectedLeadDetail.lead.budget || 'Not disclosed'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <span className="text-slate-500">Timeline</span>
                  <p className="font-semibold mt-0.5">{selectedLeadDetail.lead.timeline || 'Not disclosed'}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-3">
                  <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
                  Conversation History ({selectedLeadDetail.calls?.length || 0} calls)
                </h3>
                {!selectedLeadDetail.calls?.length ? (
                  <p className="text-xs text-slate-500">No voice calls linked to this lead yet.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedLeadDetail.calls.map((call) => (
                      <div key={call._id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{new Date(call.startedAt).toLocaleString()}</span>
                          <span className="tabular-nums">{call.durationSeconds}s</span>
                        </div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {(call.transcript || []).map((t, i) => (
                            <p key={i} className="text-xs">
                              <span className="font-bold">{t.role === 'user' ? 'Prospect' : 'AI'}:</span>{' '}
                              <span className="text-slate-600 dark:text-slate-300">{t.content}</span>
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {(editingLead || creatingLead) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="w-full max-w-lg pro-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{creatingLead ? 'Add New Lead' : 'Edit Lead'}</h2>
              <button
                type="button"
                onClick={() => {
                  setCreatingLead(false);
                  setEditingLead(null);
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                placeholder="Full Name"
                value={formState.name}
                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                className="pro-input"
              />
              <input
                placeholder="Company"
                value={formState.company}
                onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                className="pro-input"
              />
              <input
                type="email"
                placeholder="Email"
                value={formState.email}
                onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                className="pro-input"
              />
              <input
                placeholder="Phone"
                value={formState.phone}
                onChange={(e) => setFormState({ ...formState, phone: e.target.value })}
                className="pro-input"
              />
              <select
                value={formState.status}
                onChange={(e) => setFormState({ ...formState, status: e.target.value })}
                className="pro-input"
              >
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
              <input
                type="number"
                min={0}
                max={100}
                value={formState.score}
                onChange={(e) => setFormState({ ...formState, score: Number(e.target.value) })}
                className="pro-input"
              />
            </div>

            <input
              placeholder="Recommended Next Action"
              value={formState.recommendedNextAction}
              onChange={(e) => setFormState({ ...formState, recommendedNextAction: e.target.value })}
              className="pro-input"
            />

            <textarea
              rows={3}
              placeholder="AI / Rep Summary"
              value={formState.aiSummary}
              onChange={(e) => setFormState({ ...formState, aiSummary: e.target.value })}
              className="pro-input"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCreatingLead(false);
                  setEditingLead(null);
                }}
                className="pro-btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="pro-btn-primary">
                Save Lead
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Lead"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Lead"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
