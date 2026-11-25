import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  signInWithAuthorGoogle,
  signOutAuthor,
  subscribeAuthChanges,
} from './lib/firebase';
import {
  ensureUserBootstrap,
  publishPrabinStory,
  removeFakeSeedPosts,
  subscribeAllAuthorComments,
  subscribeAllPostsAdmin,
} from './lib/firestoreApi';
import { FAKE_SEED_IDS } from './data/seedPosts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthorLoginGate } from './components/AuthorLoginGate';
import { Navbar, type AuthorView } from './components/Navbar';
import { AuthorStudioView } from './components/AuthorStudioView';
import { AuthorWorksView } from './components/AuthorWorksView';
import { AuthorThoughtsView } from './components/AuthorThoughtsView';
import { AuthorPreviewView } from './components/AuthorPreviewView';
import { ADMIN_EMAIL, type AuthorCommentItem, type Post } from './types';

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [adminPosts, setAdminPosts] = useState<Post[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [authorComments, setAuthorComments] = useState<AuthorCommentItem[]>([]);

  const [activeView, setActiveView] = useState<AuthorView>('publish');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [previewPostId, setPreviewPostId] = useState<string | null>(null);
  const [starterBusy, setStarterBusy] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('prabin-theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('prabin-theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  useEffect(() => {
    const unsub = subscribeAuthChanges(async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const emailMatches =
          nextUser.email === ADMIN_EMAIL && Boolean(nextUser.emailVerified);
        if (emailMatches) {
          setIsAdmin(true);
          try {
            await ensureUserBootstrap(nextUser);
          } catch (err) {
            setAuthError(
              err instanceof Error
                ? 'Could not sync author profile with Firestore. Please check your connection and reload.'
                : 'Could not sync author profile.'
            );
          }
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
        setAdminPosts([]);
        setAuthorComments([]);
        setPostsLoaded(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Subscribe to all author manuscripts when signed in as prabinbaral52@gmail.com
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setAdminPosts([]);
      return;
    }
    const unsub = subscribeAllPostsAdmin(
      (list) => {
        setAdminPosts(list);
        setPostsLoaded(true);
      },
      () => {
        setPostsLoaded(true);
      }
    );
    return () => unsub();
  }, [authReady, user, isAdmin]);

  // Clean up any legacy fake seed posts and ensure Prabin's real story is available
  useEffect(() => {
    if (!authReady || !user || !isAdmin) return;
    const ids = adminPosts.map((p) => p.id);
    if (ids.some((id) => FAKE_SEED_IDS.includes(id))) {
      void removeFakeSeedPosts(ids).catch(() => {});
    }

    const realPosts = adminPosts.filter((p) => !FAKE_SEED_IDS.includes(p.id));
    if (postsLoaded && realPosts.length === 0) {
      const alreadySynced = (() => {
        try {
          return localStorage.getItem('prabin-story-synced-v1') === '1';
        } catch {
          return false;
        }
      })();
      if (!alreadySynced) {
        try {
          localStorage.setItem('prabin-story-synced-v1', '1');
        } catch {
          // ignore
        }
        void publishPrabinStory(user.uid).catch(() => {});
      }
    }
  }, [authReady, user, isAdmin, adminPosts, postsLoaded]);

  const cleanPosts = useMemo(
    () => adminPosts.filter((p) => !FAKE_SEED_IDS.includes(p.id)),
    [adminPosts]
  );

  // Subscribe to reader thoughts/comments across all stories and books
  useEffect(() => {
    if (!authReady || !user || !isAdmin) {
      setAuthorComments([]);
      return;
    }
    const unsub = subscribeAllAuthorComments(
      cleanPosts,
      (items) => setAuthorComments(items),
      () => {}
    );
    return () => unsub();
  }, [authReady, user, isAdmin, cleanPosts]);

  const previewPost = useMemo(
    () => (previewPostId ? cleanPosts.find((p) => p.id === previewPostId) ?? null : null),
    [cleanPosts, previewPostId]
  );

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithAuthorGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google sign-in was cancelled.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAuthor();
    setEditingPost(null);
    setPreviewPostId(null);
    setActiveView('publish');
  };

  const handleNavigate = (view: AuthorView) => {
    setActiveView(view);
    if (view !== 'preview') {
      setPreviewPostId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post);
    setActiveView('publish');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviewPost = (post: Post) => {
    setPreviewPostId(post.id);
    setActiveView('preview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePublishStarter = async () => {
    if (!user || !isAdmin || starterBusy) return;
    setStarterBusy(true);
    try {
      await publishPrabinStory(user.uid);
    } finally {
      setStarterBusy(false);
    }
  };

  // Author-Only Gate: visitors and non-admin emails cannot enter the portal
  if (!authReady || !user || !isAdmin) {
    return (
      <AuthorLoginGate
        user={user}
        authReady={authReady}
        isSigningIn={isSigningIn}
        authError={authError}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] dark:bg-[#141210] text-[#1C1917] dark:text-[#F5F2EB] transition-colors">
      <Navbar
        activeView={activeView}
        onNavigate={handleNavigate}
        user={user}
        thoughtsCount={authorComments.length}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        onSignOut={handleSignOut}
        hideBottomNav={activeView === 'preview'}
      />

      <main className="flex-1">
        {authError && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-4">
              <span>{authError}</span>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-xs font-medium underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {activeView === 'publish' && (
          <AuthorStudioView
            user={user}
            allPosts={cleanPosts}
            editingPost={editingPost}
            onClearEditing={() => setEditingPost(null)}
            onPublishStarter={handlePublishStarter}
            starterBusy={starterBusy}
            onOpenWorks={() => handleNavigate('works')}
          />
        )}

        {activeView === 'works' && (
          <AuthorWorksView
            posts={cleanPosts}
            authorId={user.uid}
            authorName={user.displayName || 'Prabin Baral'}
            onEditPost={handleEditPost}
            onPreviewPost={handlePreviewPost}
            onCreateNew={() => {
              setEditingPost(null);
              handleNavigate('publish');
            }}
            onPublishStarter={handlePublishStarter}
            starterBusy={starterBusy}
          />
        )}

        {activeView === 'thoughts' && (
          <AuthorThoughtsView
            posts={cleanPosts}
            comments={authorComments}
            onPreviewPost={handlePreviewPost}
          />
        )}

        {activeView === 'preview' && previewPost && (
          <AuthorPreviewView
            post={previewPost}
            comments={authorComments}
            onBack={() => handleNavigate('works')}
            onEdit={handleEditPost}
          />
        )}
      </main>

      {activeView !== 'preview' && (
        <footer className="hidden md:block border-t border-stone-200 dark:border-stone-800 py-6 text-xs text-stone-500 dark:text-stone-400">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <span>praBin Author Portal · {ADMIN_EMAIL}</span>
            <span>Connected to shared Firestore catalog</span>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
