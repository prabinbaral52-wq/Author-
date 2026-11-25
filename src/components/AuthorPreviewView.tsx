import { useMemo, useState } from 'react';
import { ArrowLeft, Edit2, FileDown, Heart, MessageSquare, Trash2 } from 'lucide-react';
import { CoverImage } from './CoverImage';
import { deletePostComment } from '../lib/firestoreApi';
import type { AuthorCommentItem, Post } from '../types';

interface AuthorPreviewViewProps {
  post: Post;
  comments: AuthorCommentItem[];
  onBack: () => void;
  onEdit: (post: Post) => void;
}

interface ParsedChapter {
  id: string;
  title: string;
  paragraphs: string[];
}

function parseChapters(content: string): ParsedChapter[] {
  const lines = content.split(/\r?\n/);
  const chapters: ParsedChapter[] = [];
  let currentTitle = 'Opening';
  let buffer: string[] = [];

  const flushBuffer = () => {
    const joined = buffer.join('\n').trim();
    if (!joined) return;
    const paragraphs = joined
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (paragraphs.length > 0) {
      chapters.push({
        id: `chap-${chapters.length + 1}`,
        title: currentTitle,
        paragraphs,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      flushBuffer();
      currentTitle = headingMatch[1].trim();
    } else {
      buffer.push(line);
    }
  }
  flushBuffer();

  if (chapters.length === 0) {
    return [
      {
        id: 'chap-1',
        title: 'Full Text',
        paragraphs: content
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean),
      },
    ];
  }

  return chapters;
}

export function AuthorPreviewView({
  post,
  comments,
  onBack,
  onEdit,
}: AuthorPreviewViewProps) {
  const chapters = useMemo(() => parseChapters(post.content), [post.content]);
  const [activeChapterId, setActiveChapterId] = useState<string>(chapters[0]?.id ?? 'chap-1');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const postComments = useMemo(
    () => comments.filter((c) => c.postId === post.id),
    [comments, post.id]
  );

  const handleDeleteComment = async (c: AuthorCommentItem) => {
    setBusyId(c.id);
    try {
      await deletePostComment(c.postId, c.id, c.userId);
      setConfirmDeleteId(null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="sticky top-0 z-30 bg-[#FAF8F5]/95 dark:bg-[#141210]/95 backdrop-blur-md border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] pr-3 inline-flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:text-[#1C1917] dark:hover:text-[#F5F2EB] whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Works</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(post)}
            className="min-h-[36px] px-3 py-1 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Manuscript</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 lg:pt-12 space-y-10">
        <header className="space-y-4 pb-8 border-b border-stone-200 dark:border-stone-800">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span>{post.type === 'book' ? 'Book' : 'Short Story'}</span>
            <span aria-hidden="true">·</span>
            <span>{post.genre}</span>
            <span aria-hidden="true">·</span>
            <span>{post.published ? 'Published' : 'Draft'}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{post.wordCount.toLocaleString()} words</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1C1917] dark:text-[#F5F2EB] leading-[1.15]">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="font-serif italic text-lg sm:text-xl text-stone-600 dark:text-stone-300 leading-relaxed">
              {post.subtitle}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600 dark:text-stone-400">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <Heart className="w-4 h-4" />
                <span>{post.likesCount} reader likes</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span>{postComments.length} reader thoughts</span>
              </span>
            </div>

            {post.id === 'story-map-of-silence' && (
              <a
                href="/assets/aistudio/Map_of_Silence_-_Bilingual_Edition_1f9a61f6"
                download="Map_of_Silence_Bilingual_Edition.pdf"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1E3A8A] dark:text-[#93C5FD] hover:underline"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Download Original Bilingual PDF</span>
              </a>
            )}
          </div>
        </header>

        {post.coverUrl && (
          <figure>
            <CoverImage
              src={post.coverUrl}
              alt={post.title}
              title={post.title}
              className="w-full max-h-[400px] object-cover rounded-xl border border-stone-200 dark:border-stone-800"
            />
          </figure>
        )}

        {chapters.length > 1 && (
          <nav
            aria-label="Chapters"
            className="pb-4 border-b border-stone-200 dark:border-stone-800 flex items-center gap-2 overflow-x-auto"
          >
            {chapters.map((chap, idx) => (
              <button
                key={chap.id}
                type="button"
                onClick={() => {
                  setActiveChapterId(chap.id);
                  const el = document.getElementById(chap.id);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  activeChapterId === chap.id
                    ? 'bg-[#1E3A8A] text-white'
                    : 'bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300'
                }`}
              >
                {idx + 1}. {chap.title}
              </button>
            ))}
          </nav>
        )}

        <div className="space-y-10">
          {chapters.map((chap, chapIdx) => (
            <section key={chap.id} id={chap.id} className="scroll-mt-20 space-y-5">
              {chapters.length > 1 && (
                <h2 className="font-serif text-2xl font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                  {chap.title}
                </h2>
              )}
              <div
                className={`font-serif text-[18px] leading-[1.8] text-[#1C1917] dark:text-[#EAE5DC] space-y-5 ${
                  chapIdx === 0 ? 'editorial-prose' : ''
                }`}
              >
                {chap.paragraphs.map((para, pIdx) => (
                  <p key={pIdx}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Thoughts on this specific story */}
        <section className="pt-10 border-t border-stone-200 dark:border-stone-800 space-y-6">
          <h2 className="font-serif text-2xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <span>Reader Thoughts on This Work ({postComments.length})</span>
          </h2>

          {postComments.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              No reader thoughts on this work yet.
            </p>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {postComments.map((c) => (
                <div key={c.id} className="py-5 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {c.authorPhotoUrl ? (
                        <img
                          src={c.authorPhotoUrl}
                          alt={c.authorName}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-xs font-semibold">
                          {c.authorName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-semibold">{c.authorName}</span>
                      <span aria-hidden="true" className="text-stone-400">
                        ·
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400">
                        {new Date(c.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {confirmDeleteId === c.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-xs border border-stone-200 dark:border-stone-800 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busyId === c.id}
                          onClick={() => handleDeleteComment(c)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        aria-label="Delete comment"
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
