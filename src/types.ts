export type PostType = 'book' | 'story';

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  type: PostType;
  title: string;
  subtitle: string;
  genre: string;
  coverUrl: string;
  excerpt: string;
  content: string;
  readingTimeMinutes: number;
  wordCount: number;
  published: boolean;
  featured: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: number;
  updatedAt: number;
  isPreviewOnly?: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  authorName: string;
  authorPhotoUrl: string;
  body: string;
  createdAt: number;
}

export interface AuthorCommentItem extends PostComment {
  postTitle: string;
  postType: PostType;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoUrl: string;
  bio: string;
  role: 'reader' | 'admin';
  createdAt: number;
  updatedAt: number;
}

export interface ReadingHistoryItem {
  postId: string;
  postTitle: string;
  postType: PostType;
  postCoverUrl: string;
  authorName: string;
  progressPercent: number;
  bookmarked: boolean;
  startedAt: number;
  lastReadAt: number;
}

export interface UserActivityItem {
  id: string;
  type: 'like' | 'comment';
  postId: string;
  postTitle: string;
  postType: PostType;
  commentExcerpt: string;
  createdAt: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ResearchResult {
  answer: string;
  sources: GroundingSource[];
}

export const LIMITS = {
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  ID_MAX: 128,
  AUTHOR_NAME_MAX: 80,
  TITLE_MAX: 160,
  SUBTITLE_MAX: 240,
  GENRE_MAX: 60,
  COVER_URL_MAX: 600,
  EXCERPT_MAX: 600,
  CONTENT_MAX: 250000,
  COMMENT_MAX: 2000,
  BIO_MAX: 400,
  DISPLAY_NAME_MAX: 80,
  ACTIVITY_EXCERPT_MAX: 240,
} as const;

export const ADMIN_EMAIL = 'prabinbaral52@gmail.com';
