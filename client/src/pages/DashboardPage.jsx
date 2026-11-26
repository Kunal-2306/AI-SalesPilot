import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Flame,
  PhoneCall,
  Clock,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
  Activity,
  Mic,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../api/client';
import { DashboardSkeleton } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';

export default function DashboardPage() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/dashboard/overview');
        setData(res.data);
      } catch (err) {
        toast(err.response?.data?.message || 'Failed to load dashboard metrics', 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  if (loading) return <DashboardSkeleton />;

  const m = data?.metrics || {};
  const leadDist = (data?.leadDistribution || []).filter((d) => d.value > 0);

  const kpis = [
    {
      label: 'Total Leads',
      value: m.totalLeads ?? 0,
      sub: `${m.hotLeads ?? 0} Hot · ${m.warmLeads ?? 0} Warm · ${m.coldLeads ?? 0} Cold`,
      icon: Users,
      accent: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400',
    },
    {
      label: 'Hot Leads',
      value: m.hotLeads ?? 0,
      sub: `Active Hot · ${m.convertedLeads ?? 0} Converted`,
      icon: Flame,
      accent: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400',
    },
    {
      label: 'Total AI Calls',
      value: m.totalCalls ?? 0,
      sub: `Average duration: ${m.avgCallDuration ?? 0}s`,
      icon: PhoneCall,
      accent: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-400',
    },
    {
      label: 'Appointments Booked',
      value: m.appointmentsBooked ?? 0,
      sub: `${m.conversionRate ?? 0}% pipeline conversion`,
      icon: CalendarCheck,
      accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, sub, icon: Icon, accent }) => (
          <div key={label} className="pro-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                {label}
              </span>
              <div className={`rounded-lg p-2 ${accent}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {value}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Secondary Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="pro-card px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500">Warm Leads</p>
            <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{m.warmLeads ?? 0}</p>
          </div>
          <TrendingUp className="h-4 w-4 text-amber-500" />
        </div>
        <div className="pro-card px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500">Cold Leads</p>
            <p className="text-lg font-bold tabular-nums text-sky-600 dark:text-sky-400">{m.coldLeads ?? 0}</p>
          </div>
          <Users className="h-4 w-4 text-sky-500" />
        </div>
        <div className="pro-card px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500">Avg Call Duration</p>
            <p className="text-lg font-bold tabular-nums">{m.avgCallDuration ?? 0}s</p>
          </div>
          <Clock className="h-4 w-4 text-slate-400" />
        </div>
        <div className="pro-card px-4 py-3.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500">Conversion Rate</p>
            <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {m.conversionRate ?? 0}%
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-emerald-500" />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 pro-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold">Sales Performance (Last 7 Days)</h2>
              <p className="text-xs text-slate-500">AI voice sessions, qualified leads, and booked demos</p>
            </div>
            <Link to="/voice" className="pro-btn-primary px-3.5 py-1.5 text-xs">
              <Mic className="h-3.5 w-3.5" /> New Call
            </Link>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.salesPerformance || []}>
                <defs>
                  <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.14} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid rgba(148,163,184,0.2)',
                    backgroundColor: '#0F131C',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="calls" name="AI Calls" stroke="#4f46e5" strokeWidth={2} fill="url(#colorCalls)" />
                <Area type="monotone" dataKey="leads" name="Leads" stroke="#10b981" strokeWidth={2} fill="url(#colorLeads)" />
                <Area type="monotone" dataKey="appointments" name="Appointments" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="pro-card p-6 flex flex-col">
          <h2 className="text-[15px] font-bold">Lead Distribution</h2>
          <p className="text-xs text-slate-500 mb-4">Pipeline segmentation by score</p>

          {leadDist.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
              <Users className="h-9 w-9 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-medium text-slate-500">No leads recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">Launch an AI call to qualify prospects.</p>
            </div>
          ) : (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={leadDist}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {leadDist.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mt-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                {leadDist.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-500 dark:text-slate-400">{item.name}</span>
                    <span className="font-bold tabular-nums ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Tables & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="pro-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold">Recent Leads</h2>
            <Link to="/leads" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View all
            </Link>
          </div>

          {!data?.recentLeads?.length ? (
            <p className="text-xs text-slate-500 py-8 text-center">No leads yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentLeads.map((lead) => (
                <div
                  key={lead._id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#131824] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{lead.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {lead.company || lead.email || 'Voice Prospect'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">
                      {lead.score}
                    </span>
                    <StatusBadge value={lead.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pro-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-bold">Recent Calls</h2>
            <Link to="/analytics" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              Analytics
            </Link>
          </div>

          {!data?.recentCalls?.length ? (
            <p className="text-xs text-slate-500 py-8 text-center">No calls yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentCalls.map((call) => (
                <div
                  key={call._id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#131824] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {call.leadId?.name || call.analysis?.extractedLead?.name || call.sessionId}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {call.durationSeconds || 0}s · {call.transcript?.length || 0} turns
                    </p>
                  </div>
                  <StatusBadge value={call.analysis?.sentiment || 'neutral'} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pro-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-indigo-600" />
            <h2 className="text-[15px] font-bold">Activity Log</h2>
          </div>

          {!data?.recentActivity?.length ? (
            <p className="text-xs text-slate-500 py-8 text-center">Activity events will appear here.</p>
          ) : (
            <div className="space-y-3">
              {data.recentActivity.slice(0, 6).map((act) => (
                <div key={act._id} className="flex items-start gap-2.5 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{act.title}</p>
                    {act.description && <p className="text-[11px] text-slate-500 truncate">{act.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
