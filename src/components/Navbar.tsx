import { BookOpen, LogOut, MessageSquare, Moon, PenSquare, Sun } from 'lucide-react';
import type { User } from 'firebase/auth';

export type AuthorView = 'publish' | 'works' | 'thoughts' | 'preview';

interface NavbarProps {
  activeView: AuthorView;
  onNavigate: (view: AuthorView) => void;
  user: User;
  thoughtsCount: number;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSignOut: () => void;
  hideBottomNav?: boolean;
}

export function Navbar({
  activeView,
  onNavigate,
  user,
  thoughtsCount,
  darkMode,
  onToggleDarkMode,
  onSignOut,
  hideBottomNav = false,
}: NavbarProps) {
  const navItems: Array<{ id: AuthorView; label: string }> = [
    { id: 'publish', label: 'Publish & Import' },
    { id: 'works', label: 'My Works' },
    {
      id: 'thoughts',
      label: thoughtsCount > 0 ? `Reader Thoughts (${thoughtsCount})` : 'Reader Thoughts',
    },
  ];

  return (
    <>
      <header className="w-full border-b border-stone-200 dark:border-stone-800 bg-[#FAF8F5] dark:bg-[#141210]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('publish')}
            className="flex items-baseline gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] rounded"
          >
            <span className="font-serif text-2xl font-bold tracking-tight text-[#1C1917] dark:text-[#F5F2EB]">
              praBin
            </span>
            <span className="text-xs text-stone-500 dark:text-stone-400">Author Portal</span>
          </button>

          {/* Zone 2: Concise Single-Line Navigation Links */}
          <nav aria-label="Author navigation" className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => {
              const isActive =
                activeView === item.id || (item.id === 'works' && activeView === 'preview');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`py-1.5 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                    isActive
                      ? 'border-[#1E3A8A] dark:border-[#93C5FD] text-[#1C1917] dark:text-[#F5F2EB]'
                      : 'border-transparent text-stone-600 dark:text-stone-400 hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Theme Toggle & Sign Out */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-stone-200 dark:border-stone-800 inline-flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onSignOut}
              title={`Signed in as ${user.email || 'Prabin Baral'}`}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Author'}
                  referrerPolicy="no-referrer"
                  className="w-5 h-5 rounded-full object-cover"
                />
              )}
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Tab Bar */}
      {!hideBottomNav && (
        <nav
          aria-label="Mobile Author Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF8F5]/95 dark:bg-[#141210]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 pb-safe"
        >
          <div className="grid grid-cols-3 items-center h-16 px-1">
            <button
              type="button"
              onClick={() => onNavigate('publish')}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeView === 'publish'
                  ? 'text-[#1E3A8A] dark:text-[#93C5FD]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <PenSquare className="w-5 h-5" strokeWidth={activeView === 'publish' ? 2.25 : 1.75} />
              <span className="text-[11px] font-medium whitespace-nowrap">Publish</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('works')}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeView === 'works' || activeView === 'preview'
                  ? 'text-[#1E3A8A] dark:text-[#93C5FD]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <BookOpen
                className="w-5 h-5"
                strokeWidth={activeView === 'works' || activeView === 'preview' ? 2.25 : 1.75}
              />
              <span className="text-[11px] font-medium whitespace-nowrap">My Works</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('thoughts')}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                activeView === 'thoughts'
                  ? 'text-[#1E3A8A] dark:text-[#93C5FD]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              <MessageSquare
                className="w-5 h-5"
                strokeWidth={activeView === 'thoughts' ? 2.25 : 1.75}
              />
              <span className="text-[11px] font-medium whitespace-nowrap">
                Thoughts{thoughtsCount > 0 ? ` (${thoughtsCount})` : ''}
              </span>
            </button>
          </div>
        </nav>
      )}
    </>
  );
}
