const STATUS_STYLES = {
  hot: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
  warm: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
  cold: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800/60',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  lost: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700',
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700',
  negative: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800/60',
  rescheduled: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  indexed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
  processing: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
  failed: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60',
};

const DOT_STYLES = {
  hot: 'bg-rose-500',
  warm: 'bg-amber-500',
  cold: 'bg-sky-500',
  converted: 'bg-emerald-500',
  positive: 'bg-emerald-500',
  confirmed: 'bg-emerald-500',
  completed: 'bg-emerald-500',
  indexed: 'bg-emerald-500',
  scheduled: 'bg-indigo-500',
  rescheduled: 'bg-amber-500',
  processing: 'bg-amber-500',
  negative: 'bg-rose-500',
  cancelled: 'bg-rose-500',
  failed: 'bg-rose-500',
  neutral: 'bg-slate-400',
  lost: 'bg-slate-400',
};

export default function StatusBadge({ value, className = '' }) {
  const key = (value || 'neutral').toLowerCase();
  const style = STATUS_STYLES[key] || STATUS_STYLES.neutral;
  const dot = DOT_STYLES[key] || DOT_STYLES.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize tracking-wide ${style} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {value || 'unknown'}
    </span>
  );
}
