import { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  PhoneCall,
  Users,
  CalendarDays,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Sparkles,
  Mic,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_GROUPS = [
  {
    section: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Overview', desc: 'Pipeline KPIs & revenue activity', icon: LayoutDashboard },
      { to: '/voice', label: 'Voice Agent', desc: 'Autonomous AI call console', icon: Mic },
      { to: '/leads', label: 'Leads CRM', desc: 'Qualified prospects & BANT memory', icon: Users },
      { to: '/appointments', label: 'Appointments', desc: 'Scheduled demos & slots', icon: CalendarDays },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { to: '/knowledge', label: 'Knowledge Base', desc: 'RAG documents & semantic index', icon: BookOpen },
      { to: '/analytics', label: 'Call Analytics', desc: 'Sentiment, objections & transcripts', icon: BarChart3 },
    ],
  },
  {
    section: 'System',
    items: [
      { to: '/settings', label: 'Settings', desc: 'Models, business & voice config', icon: Settings },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const currentRoute = allItems.find((item) => location.pathname.startsWith(item.to)) || {
    label: 'Workspace',
    desc: 'SalesPilot AI Operations',
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const renderNavLinks = (onNavigate) =>
    NAV_GROUPS.map((group) => (
      <div key={group.section} className="mb-5">
        <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">
          {group.section}
        </p>
        <div className="space-y-0.5">
          {group.items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50/90 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    ));

  return (
    <div className="min-h-screen flex bg-[#F7F8FA] dark:bg-[#090B10] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0C0F17]">
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200/80 dark:border-slate-800/80">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 dark:bg-indigo-600 text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                SalesPilot <span className="text-indigo-600 dark:text-indigo-400">AI</span>
              </span>
              <p className="text-[10px] font-medium text-slate-400 leading-none mt-0.5">
                {user?.companyName || 'Revenue OS'}
              </p>
            </div>
          </Link>
        </div>

        <div className="p-3.5">
          <Link to="/voice" className="pro-btn-primary w-full py-2.5 text-[13px]">
            <PhoneCall className="h-3.5 w-3.5" />
            Launch AI Call
          </Link>
        </div>

        <nav className="flex-1 px-3 py-1 overflow-y-auto">{renderNavLinks()}</nav>

        <div className="border-t border-slate-200/80 dark:border-slate-800/80 p-3.5">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200/70 dark:border-slate-800/80 p-2.5 mb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 font-bold text-xs">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                {user?.name || 'Sales Rep'}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 flex w-72 flex-col bg-white dark:bg-[#0C0F17] border-r border-slate-200 dark:border-slate-800">
            <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
              <span className="text-base font-bold">
                SalesPilot <span className="text-indigo-600">AI</span>
              </span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto">
              {renderNavLinks(() => setMobileOpen(false))}
            </nav>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-rose-600"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#090B10]/85 backdrop-blur-md px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>Workspace</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-slate-700 dark:text-slate-300 font-medium">{currentRoute.label}</span>
              </div>
              <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate">
                {currentRoute.desc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to="/settings"
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                user?.aiSettings?.hasGroqKey
                  ? 'border-emerald-500/25 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-amber-500/25 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  user?.aiSettings?.hasGroqKey ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              {user?.aiSettings?.hasGroqKey ? 'Groq AI Live' : 'Configure Groq Key'}
            </Link>

            <button
              onClick={toggleTheme}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121622] p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1380px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
