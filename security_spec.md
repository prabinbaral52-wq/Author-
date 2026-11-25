# Security Specification — praBin Literary Platform

## 1. Data Invariants
1. **Admin Publishing Only**: Only the verified author/admin (`prabinbaral52@gmail.com` with `email_verified == true` or `/admins/{uid}`) may create, edit, publish/unpublish, feature, or delete `/posts/{postId}` documents.
2. **Published Visibility Gate**: Draft posts (`published == false`) are strictly invisible to non-admin readers (`get` and `list` require `resource.data.published == true || isAdmin()`).
3. **Atomic Like Synchronization**: A reader can create `/posts/{postId}/likes/{uid}` ONLY for themselves (`userId == request.auth.uid`) on an existing published post, and must atomically increment `likesCount` on `/posts/{postId}` by `+1` in the same batch (`getAfter` / `existsAfter`). Unliking must atomically delete the like doc and decrement `likesCount` by `1`.
4. **Atomic Comment Integrity**: A verified reader can create a comment in `/posts/{postId}/comments/{commentId}` with `userId == request.auth.uid` on an existing published post while atomically incrementing `commentsCount` by `+1`. Only the comment author or admin can delete a comment (atomically decrementing `commentsCount` by `1`).
5. **PII Isolation & Role Lock**: User emails are isolated in `/users/{userId}/private/info` readable only by the owner or admin. Users creating their own `/users/{userId}` profile MUST set `role == 'reader'` (unless `isAdmin()`) and cannot escalate their `role` on update.
6. **Personal Reading History & Activity Isolation**: `/users/{userId}/readingHistory/{postId}` and `/users/{userId}/activity/{activityId}` are strictly scoped to `isOwner(userId)` for both reads and writes, preventing cross-user scraping.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Post Creation**: Anonymous/signed-out write to `/posts/hack1` -> `PERMISSION_DENIED`.
2. **Non-Admin Post Creation**: Verified standard reader creates `/posts/fakebook` -> `PERMISSION_DENIED`.
3. **Privilege Escalation on Profile Create**: Standard reader creates `/users/{uid}` with `role: "admin"` -> `PERMISSION_DENIED`.
4. **Privilege Escalation on Profile Update**: Standard reader updates `/users/{uid}` changing `role` from `"reader"` to `"admin"` -> `PERMISSION_DENIED`.
5. **Shadow Field Injection on Post/Comment**: Admin/User includes unexpected ghost key `{ isVerified: true }` -> `PERMISSION_DENIED`.
6. **Identity Spoofing on Like/Comment**: User A writes `/posts/{postId}/likes/userB` or comment with `userId: "userB"` -> `PERMISSION_DENIED`.
7. **Unatomic Counter Tampering**: Reader increments `likesCount` on `/posts/{postId}` by `+500` or without creating their like doc -> `PERMISSION_DENIED`.
8. **Cross-User PII Read**: User A reads `/users/userB/private/info` -> `PERMISSION_DENIED`.
9. **Cross-User Reading History Scrape**: User A lists `/users/userB/readingHistory` -> `PERMISSION_DENIED`.
10. **Email Spoofing Attack**: User with `email: "prabinbaral52@gmail.com"` and `email_verified: false` tries to create a post -> `PERMISSION_DENIED`.
11. **Resource Poisoning (Oversized ID / String)**: Path ID > 128 chars or invalid characters (`../hack`) or comment `body` > 2000 chars -> `PERMISSION_DENIED`.
12. **Client Timestamp Forgery**: Creating a comment or post with backdated `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
