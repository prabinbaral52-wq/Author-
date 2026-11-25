import { useMemo, useState } from 'react';
import { BookOpen, Eye, Heart, MessageSquare, Search, Trash2 } from 'lucide-react';
import { deletePostComment } from '../lib/firestoreApi';
import type { AuthorCommentItem, Post } from '../types';

interface AuthorThoughtsViewProps {
  posts: Post[];
  comments: AuthorCommentItem[];
  onPreviewPost: (post: Post) => void;
}

export function AuthorThoughtsView({
  posts,
  comments,
  onPreviewPost,
}: AuthorThoughtsViewProps) {
  const [selectedPostFilter, setSelectedPostFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const postMap = useMemo(() => {
    const map = new Map<string, Post>();
    for (const p of posts) {
      map.set(p.id, p);
    }
    return map;
  }, [posts]);

  const totalLikes = useMemo(
    () => posts.reduce((sum, p) => sum + (p.likesCount || 0), 0),
    [posts]
  );

  const uniqueReaders = useMemo(() => {
    const names = new Set(comments.map((c) => c.userId || c.authorName));
    return names.size;
  }, [comments]);

  const filteredComments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return comments.filter((c) => {
      if (selectedPostFilter !== 'all' && c.postId !== selectedPostFilter) {
        return false;
      }
      if (!q) return true;
      return (
        c.authorName.toLowerCase().includes(q) ||
        c.body.toLowerCase().includes(q) ||
        c.postTitle.toLowerCase().includes(q)
      );
    });
  }, [comments, selectedPostFilter, searchQuery]);

  const handleDeleteThought = async (comment: AuthorCommentItem) => {
    setBusyId(comment.id);
    setErrorMsg(null);
    try {
      await deletePostComment(comment.postId, comment.id, comment.userId);
      setConfirmDeleteId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to remove comment.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:pb-16 space-y-8">
      <div className="pb-6 border-b border-stone-200 dark:border-stone-800 space-y-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            Reader Thoughts &amp; Reflections
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            See every reader who shared a thought, what they wrote, and which story or book inspired it.
          </p>
        </div>

        {/* Clean Author Metrics */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl pt-2">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-4">
            <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Total Thoughts</span>
            </p>
            <p className="font-serif text-2xl font-semibold mt-1 tabular-nums">
              {comments.length}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-4">
            <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Readers</span>
            </p>
            <p className="font-serif text-2xl font-semibold mt-1 tabular-nums">
              {uniqueReaders}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-4">
            <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5" />
              <span>Total Likes</span>
            </p>
            <p className="font-serif text-2xl font-semibold mt-1 tabular-nums">{totalLikes}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by reader name, thought, or story title..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 text-sm"
          />
        </div>

        <select
          aria-label="Filter by story or book"
          value={selectedPostFilter}
          onChange={(e) => setSelectedPostFilter(e.target.value)}
          className="min-h-[44px] px-3.5 py-2 rounded-lg bg-white dark:bg-[#1C1917] border border-stone-200 dark:border-stone-800 text-sm sm:w-72"
        >
          <option value="all">All Stories &amp; Books ({comments.length})</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {filteredComments.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-10 text-center space-y-2">
          <MessageSquare className="w-8 h-8 mx-auto text-stone-400" />
          <h2 className="font-serif text-xl font-semibold">
            {comments.length === 0 ? 'No reader thoughts yet' : 'No matching thoughts'}
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
            {comments.length === 0
              ? 'When readers reflect or comment on your published stories from the reader portal, every reader’s name and thought will appear here in real time.'
              : 'Try clearing your search or selecting All Stories & Books.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredComments.map((comment) => {
            const targetPost = postMap.get(comment.postId);
            return (
              <article
                key={`${comment.postId}-${comment.id}`}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-5 sm:p-6 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {comment.authorPhotoUrl ? (
                      <img
                        src={comment.authorPhotoUrl}
                        alt={comment.authorName}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-stone-200 dark:border-stone-800"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-sm font-semibold shrink-0">
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EB] truncate">
                        {comment.authorName}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {comment.postType === 'book' ? 'Book' : 'Story'} ·{' '}
                        <span className="font-medium text-[#1E3A8A] dark:text-[#93C5FD]">
                          {comment.postTitle}
                        </span>{' '}
                        ·{' '}
                        {new Date(comment.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {targetPost && (
                      <button
                        type="button"
                        onClick={() => onPreviewPost(targetPost)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-stone-50 dark:hover:bg-stone-800"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Story</span>
                      </button>
                    )}

                    {confirmDeleteId === comment.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === comment.id}
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[38px] px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-800 text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busyId === comment.id}
                          onClick={() => handleDeleteThought(comment)}
                          className="min-h-[38px] px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          {busyId === comment.id ? 'Removing...' : 'Confirm'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(comment.id)}
                        aria-label={`Remove comment by ${comment.authorName}`}
                        className="min-h-[38px] min-w-[38px] rounded-lg border border-stone-200 dark:border-stone-800 inline-flex items-center justify-center text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="font-serif text-base text-[#1C1917] dark:text-[#EAE5DC] leading-relaxed whitespace-pre-line">
                  {comment.body}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
