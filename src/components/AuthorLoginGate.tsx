import { Feather, Lock, LogOut, Moon, Sun } from 'lucide-react';
import type { User } from 'firebase/auth';
import { ADMIN_EMAIL } from '../types';

interface AuthorLoginGateProps {
  user: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  authError: string | null;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function AuthorLoginGate({
  user,
  authReady,
  isSigningIn,
  authError,
  darkMode,
  onToggleDarkMode,
  onSignIn,
  onSignOut,
}: AuthorLoginGateProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#141210] text-[#1C1917] dark:text-[#F5F2EB] transition-colors">
      <header className="w-full border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-2xl font-bold tracking-tight">praBin</span>
            <span className="text-xs text-stone-500 dark:text-stone-400">Author Portal</span>
          </div>

          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            className="min-h-[44px] min-w-[44px] rounded-lg border border-stone-200 dark:border-stone-800 inline-flex items-center justify-center text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-7 sm:p-9 space-y-6 shadow-sm">
          {!authReady ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-10 h-10 mx-auto rounded-full border-2 border-stone-300 dark:border-stone-700 border-t-[#1E3A8A] animate-spin" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Checking author session...
              </p>
            </div>
          ) : user ? (
            <>
              <div className="space-y-2">
                <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 flex items-center justify-center text-[#9A3412] dark:text-[#FDBA74]">
                  <Lock className="w-5 h-5" />
                </div>
                <h1 className="font-serif text-2xl font-semibold">Author Access Restricted</h1>
                <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                  You are signed in as{' '}
                  <span className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                    {user.email}
                  </span>
                  . This publishing workspace is reserved exclusively for{' '}
                  <span className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">
                    {ADMIN_EMAIL}
                  </span>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#1E3A8A] text-white text-sm font-medium hover:bg-[#172E6E] transition-colors inline-flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out &amp; Switch Account</span>
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2.5">
                <div className="w-11 h-11 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-[#1E3A8A] dark:text-[#93C5FD]">
                  <Feather className="w-5 h-5" />
                </div>
                <h1 className="font-serif text-3xl font-semibold tracking-tight">
                  praBin Author Portal
                </h1>
                <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                  Sign in with <span className="font-medium text-[#1C1917] dark:text-[#F5F2EB]">{ADMIN_EMAIL}</span> to import story PDFs from Google Drive, publish books or short stories, and read thoughts shared by readers.
                </p>
              </div>

              {authError && (
                <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                  {authError}
                </div>
              )}

              <button
                type="button"
                disabled={isSigningIn}
                onClick={onSignIn}
                className="gsi-material-button w-full"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
                  </span>
                  <span className="sr-only">Sign in with Google</span>
                </div>
              </button>

              <p className="text-xs text-stone-500 dark:text-stone-400 text-center">
                Stories published here sync automatically to any reader portal connected to this database.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
