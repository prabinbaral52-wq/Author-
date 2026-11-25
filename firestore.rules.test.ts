import assert from 'node:assert/strict';

/**
 * Adversarial "Dirty Dozen" Rules Test Specification for praBin.
 * Designed to verify all 12 security payloads against firestore.rules
 * when run against a Firebase Emulator or security-rules test harness.
 */
export const dirtyDozenPayloads = [
  {
    name: '1. Unauthenticated Post Creation',
    actor: null,
    operation: 'create',
    path: 'posts/hack1',
    payload: { id: 'hack1', title: 'Unauthorized Book', published: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Non-Admin Post Creation',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'create',
    path: 'posts/fakebook',
    payload: { id: 'fakebook', authorId: 'reader-1', title: 'Imposter Story', published: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Privilege Escalation on Profile Create',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'create',
    path: 'users/reader-1',
    payload: { uid: 'reader-1', displayName: 'Reader', photoUrl: '', bio: '', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Privilege Escalation on Profile Update',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'update',
    path: 'users/reader-1',
    payload: { role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow Field Injection on Post',
    actor: { uid: 'admin-1', email: 'prabinbaral52@gmail.com', email_verified: true },
    operation: 'create',
    path: 'posts/shadow-post',
    payload: { id: 'shadow-post', isVerified: true, title: 'Shadow Test' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Identity Spoofing on Like/Comment',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'create',
    path: 'posts/post-1/likes/reader-2',
    payload: { userId: 'reader-2', postId: 'post-1', postTitle: 'Test', postType: 'story' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Unatomic Counter Tampering',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'update',
    path: 'posts/post-1',
    payload: { likesCount: 500 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Cross-User PII Read',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'get',
    path: 'users/reader-2/private/info',
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Cross-User Reading History Scrape',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'list',
    path: 'users/reader-2/readingHistory',
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Email Spoofing Attack (Unverified Admin Email)',
    actor: { uid: 'spoof-1', email: 'prabinbaral52@gmail.com', email_verified: false },
    operation: 'create',
    path: 'posts/spoof-post',
    payload: { id: 'spoof-post', authorId: 'spoof-1', title: 'Spoofed' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Resource Poisoning (Oversized / Invalid Path ID)',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'create',
    path: 'posts/post-1/comments/' + 'a'.repeat(200),
    payload: { body: 'x'.repeat(2500) },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Client Timestamp Forgery',
    actor: { uid: 'reader-1', email: 'reader@example.com', email_verified: true },
    operation: 'create',
    path: 'posts/post-1/comments/c1',
    payload: { id: 'c1', postId: 'post-1', userId: 'reader-1', createdAt: '1999-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
];

assert.equal(dirtyDozenPayloads.length, 12);
