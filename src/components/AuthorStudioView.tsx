import { useEffect, useState } from 'react';
import {
  BookOpen,
  Edit2,
  ExternalLink,
  FileText,
  FileUp,
  FolderOpen,
  Globe,
  Loader2,
  Plus,
  Send,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { COVER_PRESETS } from '../data/seedPosts';
import { clearDriveAccessToken, getDriveAccessToken } from '../lib/firebase';
import { fetchSearchGroundedResearch, saveAdminPost } from '../lib/firestoreApi';
import {
  extractTextFromPdfBytes,
  pickAndImportFromGoogleDrive,
  preloadGoogleDriveLibraries,
  requestDriveAccessToken,
} from '../lib/googleDrivePicker';
import { LIMITS, type Post, type PostType, type ResearchResult } from '../types';

interface AuthorStudioViewProps {
  user: User;
  allPosts: Post[];
  editingPost: Post | null;
  onClearEditing: () => void;
  onPublishStarter: () => void;
  starterBusy: boolean;
  onOpenWorks: () => void;
}

export function AuthorStudioView({
  user,
  allPosts,
  editingPost,
  onClearEditing,
  onPublishStarter,
  starterBusy,
  onOpenWorks,
}: AuthorStudioViewProps) {
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [type, setType] = useState<PostType>('story');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [genre, setGenre] = useState('Literary Fiction');
  const [coverUrl, setCoverUrl] = useState(COVER_PRESETS[0].url);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [published, setPublished] = useState(true);
  const [featured, setFeatured] = useState(false);

  const [driveConnected, setDriveConnected] = useState<boolean>(() => Boolean(getDriveAccessToken()));
  const [driveImporting, setDriveImporting] = useState(false);
  const [localImporting, setLocalImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Author Search-Grounded Fact-Checker
  const [factQuery, setFactQuery] = useState('');
  const [factBusy, setFactBusy] = useState(false);
  const [factResult, setFactResult] = useState<ResearchResult | null>(null);
  const [factError, setFactError] = useState<string | null>(null);

  useEffect(() => {
    preloadGoogleDriveLibraries();
  }, []);

  useEffect(() => {
    if (editingPost) {
      setEditingId(editingPost.id);
      setType(editingPost.type);
      setTitle(editingPost.title);
      setSubtitle(editingPost.subtitle);
      setGenre(editingPost.genre);
      setCoverUrl(editingPost.coverUrl || COVER_PRESETS[0].url);
      setExcerpt(editingPost.excerpt);
      setContent(editingPost.content);
      setPublished(editingPost.published);
      setFeatured(editingPost.featured);
      setFeedback(null);
      setImportError(null);
    }
  }, [editingPost]);

  const resetForm = () => {
    onClearEditing();
    setEditingId(undefined);
    setType('story');
    setTitle('');
    setSubtitle('');
    setGenre('Literary Fiction');
    setCoverUrl(COVER_PRESETS[0].url);
    setExcerpt('');
    setContent('');
    setPublished(true);
    setFeatured(false);
    setImportError(null);
  };

  const handleGoogleDrivePick = async () => {
    if (driveImporting) return;
    setImportError(null);
    setFeedback(null);
    setDriveImporting(true);

    try {
      let token = getDriveAccessToken();
      if (!token) {
        token = await requestDriveAccessToken(user.email);
        setDriveConnected(Boolean(token));
      }

      let imported = null;
      try {
        imported = await pickAndImportFromGoogleDrive(token);
      } catch (err) {
        if (err instanceof Error && err.message === 'DRIVE_AUTH_EXPIRED') {
          clearDriveAccessToken();
          token = await requestDriveAccessToken(user.email);
          setDriveConnected(Boolean(token));
          imported = await pickAndImportFromGoogleDrive(token);
        } else {
          throw err;
        }
      }

      if (!imported) {
        return;
      }

      setContent(imported.content);
      if (!title.trim() && imported.suggestedTitle) {
        setTitle(imported.suggestedTitle);
      }
      const words = imported.content.split(/\s+/).filter(Boolean).length;
      const pagesNote = imported.pageCount ? ` across ${imported.pageCount} pages` : '';
      setFeedback(
        `Imported "${imported.fileName}" from Google Drive (${words.toLocaleString()} words${pagesNote}).`
      );
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Unable to import story from Google Drive.'
      );
    } finally {
      setDriveImporting(false);
    }
  };

  const handleLocalFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setFeedback(null);
    setLocalImporting(true);

    try {
      const isPdf =
        file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      let loadedText = '';
      let suggestedTitle = file.name
        .replace(/\.(pdf|txt|md|markdown)$/i, '')
        .replace(/[-_]+/g, ' ')
        .trim()
        .slice(0, LIMITS.TITLE_MAX);
      let extraInfo = '';

      if (isPdf) {
        const bytes = await file.arrayBuffer();
        const extracted = await extractTextFromPdfBytes(bytes);
        if (!extracted.text.trim()) {
          throw new Error('No readable text was found in this PDF.');
        }
        loadedText = extracted.text;
        if (extracted.pdfTitle) {
          suggestedTitle = extracted.pdfTitle.slice(0, LIMITS.TITLE_MAX);
        }
        extraInfo = ` across ${extracted.pageCount} pages`;
      } else {
        loadedText = (await file.text()).trim().slice(0, LIMITS.CONTENT_MAX);
      }

      setContent(loadedText);
      if (!title.trim() && suggestedTitle) {
        setTitle(suggestedTitle);
      }
      const words = loadedText.split(/\s+/).filter(Boolean).length;
      setFeedback(`Loaded "${file.name}" (${words.toLocaleString()} words${extraInfo}).`);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Could not read the selected manuscript file.'
      );
    } finally {
      setLocalImporting(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || saving) return;
    setSaving(true);
    setFeedback(null);
    setImportError(null);
    try {
      await saveAdminPost(
        {
          id: editingId,
          type,
          title,
          subtitle,
          genre,
          coverUrl,
          excerpt,
          content,
          published,
          featured,
        },
        user.uid,
        user.displayName || 'Prabin Baral'
      );
      setFeedback(
        editingId
          ? 'Manuscript updated and synced.'
          : published
            ? 'Published! Readers on any connected reader portal can now read this story.'
            : 'Saved as draft.'
      );
      resetForm();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to save manuscript.');
    } finally {
      setSaving(false);
    }
  };

  const handleFactCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factQuery.trim() || factBusy) return;
    setFactBusy(true);
    setFactError(null);
    try {
      const res = await fetchSearchGroundedResearch({
        query: factQuery,
        contextTitle: title || undefined,
        contextExcerpt: excerpt || undefined,
        mode: 'author',
      });
      setFactResult(res);
    } catch (err) {
      setFactError(err instanceof Error ? err.message : 'Research check failed.');
    } finally {
      setFactBusy(false);
    }
  };

  const totalComments = allPosts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:pb-16 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
            {editingId ? 'Edit Manuscript' : 'Publish a Story or Book'}
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
            Import a PDF directly from Google Drive or upload a local file, refine your chapters, and publish to Firestore.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {allPosts.length === 0 && (
            <button
              type="button"
              disabled={starterBusy}
              onClick={onPublishStarter}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors whitespace-nowrap"
            >
              {starterBusy ? 'Publishing...' : "Publish 'Map of Silence'"}
            </button>
          )}
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="min-h-[44px] px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 text-sm font-medium inline-flex items-center gap-2 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <Plus className="w-4 h-4" />
              <span>Start Fresh</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Publishing Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-8 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-6 sm:p-8 space-y-6"
        >
          {/* Google Drive & Local PDF Import Bar */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-[#FAF8F5] dark:bg-[#141210] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1E3A8A] dark:text-[#93C5FD]" />
                <h2 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                  Import Story PDF or Document
                </h2>
              </div>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {driveConnected ? 'Google Drive connected' : 'Google Drive ready on click'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={driveImporting}
                onClick={handleGoogleDrivePick}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-[#1E3A8A] text-white text-sm font-medium hover:bg-[#172E6E] disabled:opacity-60 transition-colors inline-flex items-center gap-2"
              >
                {driveImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FolderOpen className="w-4 h-4" />
                )}
                <span>
                  {driveImporting ? 'Opening Google Drive...' : 'Choose PDF from Google Drive'}
                </span>
              </button>

              <label className="min-h-[44px] px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1C1917] text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer inline-flex items-center gap-2 transition-colors">
                {localImporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileUp className="w-4 h-4" />
                )}
                <span>{localImporting ? 'Extracting PDF...' : 'Upload Local PDF / .txt / .md'}</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
                  onChange={handleLocalFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {importError && (
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{importError}</p>
            )}
          </div>

          {/* Type Selector */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1 p-1 bg-stone-200/70 dark:bg-stone-900 rounded-lg">
              <button
                type="button"
                onClick={() => setType('story')}
                className={`min-h-[38px] px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  type === 'story'
                    ? 'bg-white dark:bg-[#1C1917] text-[#1C1917] dark:text-[#F5F2EB] shadow-sm'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Short Story
              </button>
              <button
                type="button"
                onClick={() => setType('book')}
                className={`min-h-[38px] px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  type === 'book'
                    ? 'bg-white dark:bg-[#1C1917] text-[#1C1917] dark:text-[#F5F2EB] shadow-sm'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Book
              </button>
            </div>
          </div>

          {/* Metadata Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                Title
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Map of Silence"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                Subtitle (optional)
              </label>
              <input
                type="text"
                maxLength={LIMITS.SUBTITLE_MAX}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="One-sentence deck beneath the headline"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                Genre
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.GENRE_MAX}
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="Literary Fiction, Memoir, Bilingual..."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                Cover Art Preset or Image URL
              </label>
              <select
                value={COVER_PRESETS.some((p) => p.url === coverUrl) ? coverUrl : '__custom__'}
                onChange={(e) => {
                  if (e.target.value !== '__custom__') setCoverUrl(e.target.value);
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 text-sm mb-2"
              >
                {COVER_PRESETS.map((preset) => (
                  <option key={preset.url} value={preset.url}>
                    {preset.label}
                  </option>
                ))}
                <option value="__custom__">Custom Image URL</option>
              </select>
              <input
                type="text"
                maxLength={LIMITS.COVER_URL_MAX}
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="https://... or preset path"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
              Synopsis / Excerpt
            </label>
            <textarea
              rows={2}
              maxLength={LIMITS.EXCERPT_MAX}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="A brief introduction shown to readers on the catalog card..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
                Full Story / Book Text (use &ldquo;## Chapter Title&rdquo; for chapters)
              </label>
              <span className="text-xs text-stone-400 tabular-nums">
                {content.split(/\s+/).filter(Boolean).length.toLocaleString()} words
              </span>
            </div>
            <textarea
              required
              rows={14}
              maxLength={LIMITS.CONTENT_MAX}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Choose a PDF from Google Drive above, or write/paste your manuscript here..."
              className="w-full px-4 py-3 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 font-serif text-base leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-4 h-4 accent-[#1E3A8A]"
              />
              <span>Publish immediately (visible in Reader Portal)</span>
            </label>

            <label className="inline-flex items-center gap-2.5 text-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-4 h-4 accent-[#1E3A8A]"
              />
              <span>Feature at top</span>
            </label>
          </div>

          {feedback && (
            <p className="text-sm text-[#1E3A8A] dark:text-[#93C5FD]">{feedback}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#1E3A8A] text-white text-sm font-medium hover:bg-[#172E6E] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Story'}
            </button>
          </div>
        </form>

        {/* Right Sidebar: Google Search Fact-Checker & Quick Works Overview */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-5 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#1E3A8A] dark:text-[#93C5FD]">
                <Globe className="w-3.5 h-3.5" />
                <span>Google Search Research</span>
              </div>
              <h2 className="font-serif text-lg font-semibold">Author Fact &amp; Setting Check</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Verify real-world dates, places, or cultural details before publishing.
              </p>
            </div>

            <form onSubmit={handleFactCheck} className="flex items-center gap-2">
              <input
                type="text"
                value={factQuery}
                onChange={(e) => setFactQuery(e.target.value)}
                maxLength={500}
                placeholder="Verify a fact, place, or date..."
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-[#FAF8F5] dark:bg-[#141210] border border-stone-200 dark:border-stone-800 text-sm"
              />
              <button
                type="submit"
                disabled={factBusy || !factQuery.trim()}
                aria-label="Verify with Google Search"
                className="min-h-[44px] min-w-[44px] rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center hover:bg-[#172E6E] disabled:opacity-50"
              >
                {factBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>

            {factError && (
              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-3">
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{factError}</p>
              </div>
            )}

            {factResult && (
              <div className="pt-3 border-t border-stone-200 dark:border-stone-800 space-y-3">
                <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                  {factResult.answer}
                </p>
                {factResult.sources.length > 0 && (
                  <ul className="space-y-1">
                    {factResult.sources.slice(0, 4).map((s) => (
                      <li key={s.uri}>
                        <a
                          href={s.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-start gap-1.5 text-xs text-[#1E3A8A] dark:text-[#93C5FD] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{s.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1C1917] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>Catalog Snapshot</span>
              </h2>
              <button
                type="button"
                onClick={onOpenWorks}
                className="text-xs font-medium text-[#1E3A8A] dark:text-[#93C5FD] hover:underline"
              >
                Manage All
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-[#FAF8F5] dark:bg-[#141210] p-3">
                <p className="text-xs text-stone-500 dark:text-stone-400">Works</p>
                <p className="font-serif text-xl font-semibold tabular-nums">{allPosts.length}</p>
              </div>
              <div className="rounded-lg bg-[#FAF8F5] dark:bg-[#141210] p-3">
                <p className="text-xs text-stone-500 dark:text-stone-400">Thoughts</p>
                <p className="font-serif text-xl font-semibold tabular-nums">{totalComments}</p>
              </div>
            </div>

            {allPosts.slice(0, 3).length > 0 && (
              <div className="divide-y divide-stone-200 dark:divide-stone-800 pt-1">
                {allPosts.slice(0, 3).map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-serif text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">
                        {p.published ? 'Published' : 'Draft'} · {p.commentsCount} thoughts
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(p.id);
                        setType(p.type);
                        setTitle(p.title);
                        setSubtitle(p.subtitle);
                        setGenre(p.genre);
                        setCoverUrl(p.coverUrl || COVER_PRESETS[0].url);
                        setExcerpt(p.excerpt);
                        setContent(p.content);
                        setPublished(p.published);
                        setFeatured(p.featured);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      aria-label={`Edit ${p.title}`}
                      className="min-h-[36px] min-w-[36px] rounded border border-stone-200 dark:border-stone-800 inline-flex items-center justify-center hover:bg-stone-50 dark:hover:bg-stone-800 shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
