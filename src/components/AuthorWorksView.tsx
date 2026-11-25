import { useState } from 'react';
import { BookOpen, Edit2, Eye, Plus, Trash2 } from 'lucide-react';
import { CoverImage } from './CoverImage';
import { deleteAdminPost, saveAdminPost } from '../lib/firestoreApi';
import type { Post } from '../types';

interface AuthorWorksViewProps {
  posts: Post[];
  authorId: string;
  authorName: string;
  onEditPost: (post: Post) => void;
  onPreviewPost: (post: Post) => void;
  onCreateNew: () => void;
  onPublishStarter: () => void;
  starterBusy: boolean;
}

export function AuthorWorksView({
  posts,
  authorId,
  authorName,
  onEditPost,
  onPreviewPost,
  onCreateNew,
  onPublishStarter,
  starterBusy,
}: AuthorWorksViewProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleTogglePublished = async (post: Post) => {
    setBusyId(post.id);
    setFeedback(null);
    try {
      await saveAdminPost(
        {
          id: post.id,
          type: post.type,
          title: post.title,
          subtitle: post.subtitle,
          genre: post.genre,
          coverUrl: post.coverUrl,
          excerpt: post.excerpt,
          content: post.content,
          published: !post.published,
          featured: post.featured,
        },
        authorId,
        authorName
      );
      setFeedback(
        !post.published
          ? `"${post.title}" is now published and synced to the database.`
          : `"${post.title}" moved to drafts.`
      );
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to update status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async (post: Post) => {
    setBusyId(post.id);
    setFeedback(null);
    try {
      await deleteAdminPost(post.id);
      setConfirmDeleteId(null);
      setFeedback(`Deleted "${post.title}".`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to delete work.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:pb-16 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            My Published Works &amp; Drafts
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Published stories and books appear automatically in any connected reader portal.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-[#1E3A8A] text-white text-sm font-medium hover:bg-[#172E6E] transition-colors inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Upload New Story</span>
        </button>
      </div>

      {feedback && (
        <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] px-4 py-3 text-sm text-[#1E3A8A] dark:text-[#93C5FD]">
          {feedback}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-10 text-center space-y-4">
          <BookOpen className="w-8 h-8 mx-auto text-stone-400" />
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-semibold">No manuscripts yet</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 max-w-md mx-auto">
              Upload a story PDF from Google Drive, or publish your bilingual story &ldquo;Map of Silence&rdquo; to get started.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onCreateNew}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-[#1E3A8A] text-white text-sm font-medium hover:bg-[#172E6E]"
            >
              Upload from Drive
            </button>
            <button
              type="button"
              disabled={starterBusy}
              onClick={onPublishStarter}
              className="min-h-[44px] px-5 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              {starterBusy ? 'Publishing...' : "Publish 'Map of Silence'"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-5 sm:p-6 flex flex-col gap-4"
            >
              <div className="flex items-start gap-4">
                <CoverImage
                  src={post.coverUrl}
                  alt={post.title}
                  title={post.title}
                  className="w-20 h-24 rounded-lg object-cover border border-stone-200 dark:border-stone-800 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                    <span>{post.type === 'book' ? 'Book' : 'Short Story'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.genre}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        post.published
                          ? 'font-medium text-emerald-700 dark:text-emerald-400'
                          : 'font-medium text-amber-700 dark:text-amber-400'
                      }
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <h2 className="font-serif text-xl font-semibold text-[#1C1917] dark:text-[#F5F2EB] leading-snug">
                    {post.title}
                  </h2>

                  <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    {post.wordCount.toLocaleString()} words · {post.likesCount} likes ·{' '}
                    {post.commentsCount} reader thoughts
                  </p>
                </div>
              </div>

              {post.excerpt && (
                <p className="text-sm text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
                  {post.excerpt}
                </p>
              )}

              {confirmDeleteId === post.id ? (
                <div className="mt-auto pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                    Delete &ldquo;{post.title}&rdquo; permanently?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === post.id}
                      onClick={() => setConfirmDeleteId(null)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busyId === post.id}
                      onClick={() => handleConfirmDelete(post)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {busyId === post.id ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-auto pt-3 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPreviewPost(post)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditPost(post)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === post.id}
                    onClick={() => handleTogglePublished(post)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
                  >
                    {post.published ? 'Move to Draft' : 'Publish Live'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(post.id)}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center gap-1.5 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
