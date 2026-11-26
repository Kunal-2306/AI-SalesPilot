import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Mic,
  Brain,
  CalendarCheck,
  LineChart,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Sun,
  Moon,
  PhoneCall,
  Database,
  Play,
  Info,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    icon: Mic,
    title: 'Low-Latency Voice Pipeline',
    description:
      'Captures live microphone speech, renders real-time frequency waveforms, and replies with natural voice synthesis.',
  },
  {
    icon: Brain,
    title: 'RAG Knowledge Retrieval',
    description:
      'Ingest product PDFs and playbooks. Semantic chunk retrieval grounds answers strictly in your uploaded company documents.',
  },
  {
    icon: Database,
    title: 'Autonomous CRM Qualification',
    description:
      'Extracts prospect identity, budget, timeline, and buying signals while updating lead scores (0–100) after every turn.',
  },
  {
    icon: CalendarCheck,
    title: 'In-Call Demo Scheduling',
    description:
      'Detects booking intent mid-conversation, checks open calendar slots, and confirms appointments automatically.',
  },
  {
    icon: LineChart,
    title: 'Sentiment & Objection Intel',
    description:
      'Surfaces customer sentiment shifts, recurring pricing or workflow objections, and concrete next-best sales actions.',
  },
  {
    icon: ShieldCheck,
    title: 'Authentication & Data Isolation',
    description:
      'JWT sessions, bcrypt password hashing, rate limiting, Helmet headers, and server-side API key isolation.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Index Your Playbooks',
    desc: 'Upload PDF brochures and TXT guides. Chunks and vector embeddings persist directly in MongoDB.',
  },
  {
    step: '02',
    title: 'Run Autonomous Calls',
    desc: 'Launch voice sessions with live interim transcription, RAG source citations, and instant sentiment tracking.',
  },
  {
    step: '03',
    title: 'Convert Pipeline Automatically',
    desc: 'Qualified leads, call summaries, and booked product demos sync straight to your executive CRM dashboard.',
  },
];

const SAMPLE_SCENARIOS = [
  {
    id: 'pricing',
    label: 'Pricing Inquiry',
    prospect: '"Hi, I\'m Maya from Northstar Ops. What plans do you offer for a 12-person sales team?"',
    aiReply:
      '"Hi Maya! Based on your workspace catalog, we offer the Starter Plan at $49/mo and the Growth Plan at $149/mo with unlimited RAG documents and analytics. Would you like a quick 30-minute walkthrough?"',
    sourceLabel: 'Workspace Product Catalog (Sample)',
    score: '68 / 100 (Warm)',
    sentiment: 'Positive',
    intent: 'Medium',
    action: 'Share Growth Plan breakdown',
    booked: false,
  },
  {
    id: 'booking',
    label: 'Book Demo',
    prospect: '"We have a $500/mo budget and need this next week. Can we schedule a product demo tomorrow at 2 PM?"',
    aiReply:
      '"Great — I\'ve scheduled your 30-minute product demo for tomorrow at 2:00 PM and logged your timeline and budget in the CRM. Anything specific you want us to cover?"',
    sourceLabel: 'Calendar Slots & CRM Engine (Sample)',
    score: '90 / 100 (Hot)',
    sentiment: 'Positive',
    intent: 'High',
    action: 'Demo slot reserved in Appointments',
    booked: true,
  },
  {
    id: 'objection',
    label: 'Handle Objection',
    prospect: '"Honestly, we already use an existing tool and switching sounds expensive right now."',
    aiReply:
      '"I completely understand evaluating switching costs. Teams usually offset setup time by automating lead qualification and eliminating manual CRM entry. Would an ROI comparison help?"',
    sourceLabel: 'Sales Objection Playbook (Sample)',
    score: '48 / 100 (Warm)',
    sentiment: 'Neutral',
    intent: 'Medium',
    action: 'Send ROI & migration checklist',
    booked: false,
  },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [activeScenarioId, setActiveScenarioId] = useState('pricing');

  const scenario = SAMPLE_SCENARIOS.find((s) => s.id === activeScenarioId) || SAMPLE_SCENARIOS[0];

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#090B10] text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#090B10]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-indigo-600 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-[16px] font-bold tracking-tight">
              SalesPilot <span className="text-indigo-600 dark:text-indigo-400">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121622] p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <Link to="/dashboard" className="pro-btn-primary py-2 text-xs sm:text-sm">
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
                >
                  Sign In
                </Link>
                <Link to="/register" className="pro-btn-primary py-2">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-grid-pattern pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="pointer-events-none absolute inset-x-0 -top-48 -z-10 flex justify-center blur-3xl opacity-25 dark:opacity-20">
          <div className="h-96 w-[48rem] rounded-full bg-gradient-to-tr from-indigo-600 via-slate-500 to-violet-500" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111520] px-3.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-xs mb-7">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Your Autonomous AI Sales Representative
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.08]">
              Autonomous Voice AI for{' '}
              <span className="text-indigo-600 dark:text-indigo-400">Enterprise Revenue Teams</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Qualify inbound leads over natural voice calls, retrieve grounded answers from your uploaded
              knowledge base, detect customer sentiment, and book confirmed demos directly into your CRM.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
              <Link to={user ? '/voice' : '/register'} className="pro-btn-primary px-6 py-3.5 text-sm sm:text-base">
                <PhoneCall className="h-4.5 w-4.5" />
                Start AI Call
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link to={user ? '/dashboard' : '/login'} className="pro-btn-secondary px-6 py-3.5 text-sm sm:text-base">
                Open Revenue Dashboard
              </Link>
            </div>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {['Speech-to-Text + TTS Pipeline', 'RAG Document Grounding', 'MongoDB CRM Persistence'].map(
                (item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {item}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Interactive Sample Preview Sandbox */}
          <div className="mt-14 mx-auto max-w-4xl pro-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 px-5 py-3 bg-slate-50/90 dark:bg-[#121622]">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  <Info className="h-3 w-3" />
                  Interactive Sample Preview
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  Simulated example — sign in to run live calls with your own database & docs
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {SAMPLE_SCENARIOS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveScenarioId(item.id)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                      activeScenarioId === item.id
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-[#171C2B] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Play className="h-2.5 w-2.5" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-slate-800">
              <div className="md:col-span-2 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Sample Conversation
                  </span>
                  <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Source: {scenario.sourceLabel}
                  </span>
                </div>
                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="rounded-xl bg-slate-100 dark:bg-[#141926] p-3.5 text-slate-700 dark:text-slate-200">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Sample Prospect
                    </span>
                    {scenario.prospect}
                  </div>
                  <div className="rounded-xl bg-indigo-600 text-white p-3.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-200 mb-1">
                      SalesPilot AI (Simulated Output)
                    </span>
                    {scenario.aiReply}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50/50 dark:bg-[#0B0E15] flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                    Sample CRM Extraction
                  </span>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lead Score</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                        {scenario.score}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Sentiment</span>
                      <span className="font-semibold">{scenario.sentiment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Buying Intent</span>
                      <span className="font-semibold">{scenario.intent}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 block">Next Action</span>
                      <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                        {scenario.action}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  to={user ? '/voice' : '/register'}
                  className="pro-btn-primary w-full py-2 text-xs"
                >
                  Try Real Voice Session
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white dark:bg-[#0C0F17] border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="pro-label">Platform Architecture</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Built for Real End-to-End Sales Execution
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Every module connects live speech processing, semantic retrieval, and persistent CRM intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#F9FAFB] dark:bg-[#111520] p-6 hover:border-indigo-500/40 transition-colors"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#171C2B] text-indigo-600 dark:text-indigo-400 mb-4 shadow-2xs">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-base font-bold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="pro-label">Workflow</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              From Company Docs to Booked Pipeline
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.step} className="pro-card p-6">
                <span className="inline-block rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  STEP {s.step}
                </span>
                <h3 className="mt-4 text-base font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 dark:bg-[#111521] p-8 sm:p-12 text-white shadow-xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Eliminate Missed Inbound Opportunities
                </h2>
                <p className="mt-2.5 text-slate-300 max-w-xl text-sm sm:text-base">
                  Respond immediately, capture structured qualification intelligence, and keep your CRM up to date automatically.
                </p>
              </div>
              <Link
                to={user ? '/voice' : '/register'}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 hover:bg-slate-100 transition-colors"
              >
                Launch Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-7 text-center text-xs text-slate-500">
        SalesPilot AI — Autonomous AI Sales Voice Agent Platform
      </footer>
    </div>
  );
}
