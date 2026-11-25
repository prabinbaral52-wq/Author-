import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  ADMIN_EMAIL,
  LIMITS,
  type AuthorCommentItem,
  type Post,
  type PostComment,
  type PostType,
  type ReadingHistoryItem,
  type ResearchResult,
  type UserActivityItem,
  type UserProfile,
} from '../types';
import { FAKE_SEED_IDS, PRABIN_REAL_WORKS } from '../data/seedPosts';

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof value === 'number') {
    return value;
  }
  return Date.now();
}

function sanitizeId(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.ID_MAX);
  return cleaned || `work-${Date.now()}`;
}

function mapDocToPost(id: string, data: Record<string, unknown>): Post {
  return {
    id,
    authorId: String(data.authorId ?? ''),
    authorName: String(data.authorName ?? 'Prabin Baral'),
    type: data.type === 'book' ? 'book' : 'story',
    title: String(data.title ?? ''),
    subtitle: String(data.subtitle ?? ''),
    genre: String(data.genre ?? 'Fiction'),
    coverUrl: String(data.coverUrl ?? ''),
    excerpt: String(data.excerpt ?? ''),
    content: String(data.content ?? ''),
    readingTimeMinutes: Number(data.readingTimeMinutes ?? 1),
    wordCount: Number(data.wordCount ?? 1),
    published: Boolean(data.published),
    featured: Boolean(data.featured),
    likesCount: Number(data.likesCount ?? 0),
    commentsCount: Number(data.commentsCount ?? 0),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export async function ensureUserBootstrap(user: User): Promise<boolean> {
  const isUserAdmin = user.email === ADMIN_EMAIL && user.emailVerified;
  const userRef = doc(db, 'users', user.uid);
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');

  try {
    const snap = await getDoc(userRef);
    const safeName = (user.displayName || user.email?.split('@')[0] || 'Reader').slice(
      0,
      LIMITS.DISPLAY_NAME_MAX
    );
    const safePhoto = (user.photoURL || '').slice(0, LIMITS.COVER_URL_MAX);

    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: safeName,
        photoUrl: safePhoto,
        bio: isUserAdmin
          ? 'Author & storyteller sharing books and short stories on praBin.'
          : 'Reader exploring stories and books on praBin.',
        role: isUserAdmin ? 'admin' : 'reader',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await setDoc(
      privateRef,
      {
        uid: user.uid,
        email: (user.email || '').slice(0, 160),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (isUserAdmin) {
      const adminRef = doc(db, 'admins', user.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          email: (user.email || '').slice(0, 160),
          createdAt: serverTimestamp(),
        });
      }
      return true;
    }

    const adminSnap = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
    return Boolean(adminSnap?.exists());
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export function subscribePublishedPosts(
  onData: (posts: Post[]) => void,
  onError: (err: Error) => void
) {
  const path = 'posts';
  const q = query(collection(db, path), where('published', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapDocToPost(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export function subscribeAllPostsAdmin(
  onData: (posts: Post[]) => void,
  onError: (err: Error) => void
) {
  const path = 'posts';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const list = snapshot.docs
        .map((d) => mapDocToPost(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export function subscribeComments(
  postId: string,
  onData: (comments: PostComment[]) => void,
  onError: (err: Error) => void
) {
  const path = `posts/${postId}/comments`;
  const q = query(collection(db, path), where('postId', '==', postId));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            postId: String(data.postId ?? postId),
            userId: String(data.userId ?? ''),
            authorName: String(data.authorName ?? 'Reader'),
            authorPhotoUrl: String(data.authorPhotoUrl ?? ''),
            body: String(data.body ?? ''),
            createdAt: toMillis(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export function subscribeAllAuthorComments(
  posts: Post[],
  onData: (comments: AuthorCommentItem[]) => void,
  onError: (err: Error) => void
) {
  if (posts.length === 0) {
    onData([]);
    return () => {};
  }

  const byPost = new Map<string, AuthorCommentItem[]>();
  const unsubscribers: Array<() => void> = [];

  const emitMerged = () => {
    const merged: AuthorCommentItem[] = [];
    for (const items of byPost.values()) {
      merged.push(...items);
    }
    merged.sort((a, b) => b.createdAt - a.createdAt);
    onData(merged);
  };

  for (const post of posts) {
    const path = `posts/${post.id}/comments`;
    const q = query(collection(db, path), where('postId', '==', post.id));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items: AuthorCommentItem[] = snapshot.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            postId: String(data.postId ?? post.id),
            postTitle: post.title,
            postType: post.type,
            userId: String(data.userId ?? ''),
            authorName: String(data.authorName ?? 'Reader'),
            authorPhotoUrl: String(data.authorPhotoUrl ?? ''),
            body: String(data.body ?? ''),
            createdAt: toMillis(data.createdAt),
          };
        });
        byPost.set(post.id, items);
        emitMerged();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (err) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    );
    unsubscribers.push(unsub);
  }

  return () => {
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}

export async function checkUserLikedPost(postId: string, userId: string): Promise<boolean> {
  const path = `posts/${postId}/likes/${userId}`;
  try {
    const snap = await getDoc(doc(db, 'posts', postId, 'likes', userId));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function toggleLikePost(post: Post, userId: string): Promise<boolean> {
  const postRef = doc(db, 'posts', post.id);
  const likeRef = doc(db, 'posts', post.id, 'likes', userId);
  const activityId = `like-${post.id}`.slice(0, LIMITS.ID_MAX);
  const activityRef = doc(db, 'users', userId, 'activity', activityId);

  try {
    const likedNow = await runTransaction(db, async (tx) => {
      const postSnap = await tx.get(postRef);
      if (!postSnap.exists()) {
        throw new Error('Post no longer exists.');
      }
      const likeSnap = await tx.get(likeRef);
      const currentLikes = Number(postSnap.data().likesCount ?? 0);

      if (likeSnap.exists()) {
        tx.delete(likeRef);
        tx.update(postRef, { likesCount: Math.max(0, currentLikes - 1) });
        tx.delete(activityRef);
        return false;
      } else {
        tx.set(likeRef, {
          userId,
          postId: post.id,
          postTitle: post.title.slice(0, LIMITS.TITLE_MAX),
          postType: post.type,
          createdAt: serverTimestamp(),
        });
        tx.update(postRef, { likesCount: currentLikes + 1 });
        tx.set(activityRef, {
          id: activityId,
          type: 'like',
          postId: post.id,
          postTitle: post.title.slice(0, LIMITS.TITLE_MAX),
          postType: post.type,
          commentExcerpt: '',
          createdAt: serverTimestamp(),
        });
        return true;
      }
    });
    return likedNow;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `posts/${post.id}/likes/${userId}`);
  }
}

export async function addPostComment(post: Post, user: User, rawBody: string): Promise<void> {
  const cleanBody = rawBody.trim().slice(0, LIMITS.COMMENT_MAX);
  if (!cleanBody) return;

  const commentId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const postRef = doc(db, 'posts', post.id);
  const commentRef = doc(db, 'posts', post.id, 'comments', commentId);
  const activityId = `comment-${commentId}`.slice(0, LIMITS.ID_MAX);
  const activityRef = doc(db, 'users', user.uid, 'activity', activityId);

  const authorName = (user.displayName || user.email?.split('@')[0] || 'Reader').slice(
    0,
    LIMITS.AUTHOR_NAME_MAX
  );
  const authorPhotoUrl = (user.photoURL || '').slice(0, LIMITS.COVER_URL_MAX);

  try {
    await runTransaction(db, async (tx) => {
      const postSnap = await tx.get(postRef);
      if (!postSnap.exists()) {
        throw new Error('Post not found.');
      }
      const currentCount = Number(postSnap.data().commentsCount ?? 0);

      tx.set(commentRef, {
        id: commentId,
        postId: post.id,
        userId: user.uid,
        authorName,
        authorPhotoUrl,
        body: cleanBody,
        createdAt: serverTimestamp(),
      });
      tx.update(postRef, { commentsCount: currentCount + 1 });
      tx.set(activityRef, {
        id: activityId,
        type: 'comment',
        postId: post.id,
        postTitle: post.title.slice(0, LIMITS.TITLE_MAX),
        postType: post.type,
        commentExcerpt: cleanBody.slice(0, LIMITS.ACTIVITY_EXCERPT_MAX),
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `posts/${post.id}/comments/${commentId}`);
  }
}

export async function deletePostComment(
  postId: string,
  commentId: string,
  commentUserId: string
): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const isOwnComment = auth.currentUser?.uid === commentUserId;
  const activityRef = doc(db, 'users', commentUserId, 'activity', `comment-${commentId}`);

  try {
    await runTransaction(db, async (tx) => {
      const postSnap = await tx.get(postRef);
      const currentCount = postSnap.exists() ? Number(postSnap.data().commentsCount ?? 0) : 0;

      tx.delete(commentRef);
      if (postSnap.exists()) {
        tx.update(postRef, { commentsCount: Math.max(0, currentCount - 1) });
      }
      if (isOwnComment) {
        tx.delete(activityRef);
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
  }
}

export async function upsertReadingHistory(
  userId: string,
  post: Post,
  progressPercent: number,
  bookmarkedOverride?: boolean
): Promise<void> {
  if (post.isPreviewOnly) return;
  const path = `users/${userId}/readingHistory/${post.id}`;
  const ref = doc(db, 'users', userId, 'readingHistory', post.id);
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progressPercent)));

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        postId: post.id,
        postTitle: post.title.slice(0, LIMITS.TITLE_MAX),
        postType: post.type,
        postCoverUrl: post.coverUrl.slice(0, LIMITS.COVER_URL_MAX),
        authorName: post.authorName.slice(0, LIMITS.AUTHOR_NAME_MAX),
        progressPercent: clampedProgress,
        bookmarked: bookmarkedOverride ?? false,
        startedAt: serverTimestamp(),
        lastReadAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      const nextProgress = Math.max(Number(existingData.progressPercent ?? 0), clampedProgress);
      const nextBookmarked =
        bookmarkedOverride !== undefined ? bookmarkedOverride : Boolean(existingData.bookmarked);
      await updateDoc(ref, {
        postTitle: post.title.slice(0, LIMITS.TITLE_MAX),
        postType: post.type,
        postCoverUrl: post.coverUrl.slice(0, LIMITS.COVER_URL_MAX),
        authorName: post.authorName.slice(0, LIMITS.AUTHOR_NAME_MAX),
        progressPercent: nextProgress,
        bookmarked: nextBookmarked,
        lastReadAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  userId: string,
  onData: (profile: UserProfile | null) => void,
  onError: (err: Error) => void
) {
  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      onData({
        uid: String(d.uid ?? userId),
        displayName: String(d.displayName ?? 'Reader'),
        photoUrl: String(d.photoUrl ?? ''),
        bio: String(d.bio ?? ''),
        role: d.role === 'admin' ? 'admin' : 'reader',
        createdAt: toMillis(d.createdAt),
        updatedAt: toMillis(d.updatedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export async function updateUserProfile(
  userId: string,
  displayName: string,
  bio: string
): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      displayName: displayName.trim().slice(0, LIMITS.DISPLAY_NAME_MAX) || 'Reader',
      bio: bio.trim().slice(0, LIMITS.BIO_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeReadingHistory(
  userId: string,
  onData: (items: ReadingHistoryItem[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${userId}/readingHistory`;
  return onSnapshot(
    collection(db, 'users', userId, 'readingHistory'),
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            postId: String(data.postId ?? d.id),
            postTitle: String(data.postTitle ?? ''),
            postType: (data.postType === 'book' ? 'book' : 'story') as PostType,
            postCoverUrl: String(data.postCoverUrl ?? ''),
            authorName: String(data.authorName ?? 'Prabin Baral'),
            progressPercent: Number(data.progressPercent ?? 0),
            bookmarked: Boolean(data.bookmarked),
            startedAt: toMillis(data.startedAt),
            lastReadAt: toMillis(data.lastReadAt),
          };
        })
        .sort((a, b) => b.lastReadAt - a.lastReadAt);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export function subscribeUserActivity(
  userId: string,
  onData: (items: UserActivityItem[]) => void,
  onError: (err: Error) => void
) {
  const path = `users/${userId}/activity`;
  return onSnapshot(
    collection(db, 'users', userId, 'activity'),
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            type: (data.type === 'like' ? 'like' : 'comment') as 'like' | 'comment',
            postId: String(data.postId ?? ''),
            postTitle: String(data.postTitle ?? ''),
            postType: (data.postType === 'book' ? 'book' : 'story') as PostType,
            commentExcerpt: String(data.commentExcerpt ?? ''),
            createdAt: toMillis(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  );
}

export interface PostInputPayload {
  id?: string;
  type: PostType;
  title: string;
  subtitle: string;
  genre: string;
  coverUrl: string;
  excerpt: string;
  content: string;
  published: boolean;
  featured: boolean;
}

export async function saveAdminPost(
  payload: PostInputPayload,
  authorId: string,
  authorName: string
): Promise<string> {
  const content = payload.content.trim().slice(0, LIMITS.CONTENT_MAX);
  const words = content.split(/\s+/).filter(Boolean).length;
  const wordCount = Math.max(1, words);
  const readingTimeMinutes = Math.max(1, Math.min(1000, Math.ceil(wordCount / 220)));

  const postId = payload.id
    ? sanitizeId(payload.id)
    : sanitizeId(`${payload.type}-${payload.title}-${Date.now().toString(36)}`);

  const path = `posts/${postId}`;
  const ref = doc(db, 'posts', postId);

  const cleanTitle = payload.title.trim().slice(0, LIMITS.TITLE_MAX) || 'Untitled Manuscript';
  const cleanSubtitle = payload.subtitle.trim().slice(0, LIMITS.SUBTITLE_MAX);
  const cleanGenre = payload.genre.trim().slice(0, LIMITS.GENRE_MAX) || 'Literary Fiction';
  const cleanCoverUrl = payload.coverUrl.trim().slice(0, LIMITS.COVER_URL_MAX);
  const cleanExcerpt =
    payload.excerpt.trim().slice(0, LIMITS.EXCERPT_MAX) ||
    content.replace(/^#+\s*/gm, '').slice(0, 220);

  try {
    const existingSnap = await getDoc(ref);
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        id: postId,
        authorId,
        authorName: authorName.trim().slice(0, LIMITS.AUTHOR_NAME_MAX) || 'Prabin Baral',
        type: payload.type,
        title: cleanTitle,
        subtitle: cleanSubtitle,
        genre: cleanGenre,
        coverUrl: cleanCoverUrl,
        excerpt: cleanExcerpt,
        content,
        readingTimeMinutes,
        wordCount,
        published: payload.published,
        featured: payload.featured,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        type: payload.type,
        title: cleanTitle,
        subtitle: cleanSubtitle,
        genre: cleanGenre,
        coverUrl: cleanCoverUrl,
        excerpt: cleanExcerpt,
        content,
        readingTimeMinutes,
        wordCount,
        published: payload.published,
        featured: payload.featured,
        updatedAt: serverTimestamp(),
      });
    }
    return postId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAdminPost(postId: string): Promise<void> {
  const path = `posts/${postId}`;
  try {
    await deleteDoc(doc(db, 'posts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeFakeSeedPosts(existingIds: string[]): Promise<void> {
  const toDelete = existingIds.filter((id) => FAKE_SEED_IDS.includes(id));
  if (toDelete.length === 0) return;
  const batch = writeBatch(db);
  for (const id of toDelete) {
    batch.delete(doc(db, 'posts', id));
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'posts/cleanup');
  }
}

export async function publishPrabinStory(authorId: string): Promise<void> {
  const batch = writeBatch(db);
  for (const item of PRABIN_REAL_WORKS) {
    const ref = doc(db, 'posts', item.id);
    batch.set(ref, {
      ...item,
      authorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'posts/story-map-of-silence');
  }
}

export async function fetchSearchGroundedResearch(params: {
  query: string;
  contextTitle?: string;
  contextExcerpt?: string;
  mode?: 'reader' | 'author';
}): Promise<ResearchResult> {
  const res = await fetch('/api/gemini/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { error?: string; answer?: string; sources?: ResearchResult['sources'] };
  if (!res.ok) {
    throw new Error(data.error || 'Failed to complete grounded research.');
  }
  return {
    answer: data.answer || '',
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}
