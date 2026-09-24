# Aura Social Security Specification & Threat Model

## 1. Core Data Invariants & Zero-Trust Architecture
1. **Unauthenticated Denial**: Any request where `request.auth == null` MUST be unconditionally rejected on all paths.
2. **Identity Integrity**: A user can never author, create, or pretend to be another UID (`authorId == request.auth.uid`, `senderId == request.auth.uid`, `userId == request.auth.uid`).
3. **Privilege & Role Immutability**: No client write can modify `role`, `isAdmin`, `verified`, `email`, or `createdAt`. Privilege escalation attempts are strictly rejected.
4. **Credential Isolation**: The `user_credentials` collection has zero client reads and writes (`allow read, write: if false;`). Authentication must be performed via Firebase Auth or backend Cloud Functions.
5. **Private Data Isolation**: Sensitive personal data (`email`, `phone`, `blockedUsers`, notification and media preferences) is stored in the `/users/{userId}/private/{docId}` subcollection where ONLY the owner (`request.auth.uid == userId`) has read and write permissions.
6. **Interaction Array Isolation**: Social interactions (`likedBy`, `bookmarkedBy`, `repostedBy`, `viewedBy`, `sharedBy`, `viewers`, `poll.voters`) can ONLY add or remove the acting user's own `request.auth.uid`. A user can never like or bookmark on behalf of another user or tamper with other entries.
7. **Conversation Secrecy**: Conversations and nested messages can ONLY be read or written by users present in `resource.data.participantIds`. New conversations MUST contain `request.auth.uid`.
8. **Ephemeral Story Highlights**: Highlights can only be read, created, updated, or deleted by their owner (`userId == request.auth.uid`).
9. **Notification Recipient Protection**: Notifications can only be read, modified, or deleted by the intended recipient (`recipientId == request.auth.uid`).
10. **Test Collection Lockdown**: Diagnostic collections (`/test/{docId}`) are fully locked down (`allow read, write: if false;`).

---

## 2. The "Dirty Dozen" Adversarial Payloads
The following payloads are crafted by penetration testing to probe every potential update gap or privilege leak:

| # | Attack Vector | Target Path | Injected Payload | Expected Rule Outcome |
|---|---|---|---|---|
| 1 | **Unauthenticated Snoop** | `/users/victim_123` | `GET` with `request.auth = null` | `PERMISSION_DENIED` |
| 2 | **Role Escalation Attack** | `/users/user_alpha` | `UPDATE { role: "admin", verified: true }` | `PERMISSION_DENIED` |
| 3 | **Credential Registry Exfiltration** | `/user_credentials/alice@example.com` | `GET` / `LIST` / `WRITE` | `PERMISSION_DENIED` |
| 4 | **PII Spy Attack** | `/users/target_bob/private/settings` | `GET` by `user_alpha` (`request.auth.uid != target_bob`) | `PERMISSION_DENIED` |
| 5 | **Post Author Spoofing** | `/posts/post_hacked` | `CREATE { authorId: "victim_uid", content: "I quit" }` | `PERMISSION_DENIED` |
| 6 | **Unauthorized Post Tampering** | `/posts/post_victim` | `UPDATE { content: "Defaced" }` by non-author | `PERMISSION_DENIED` |
| 7 | **Ghost Like Tampering** | `/posts/post_1` | `UPDATE { likedBy: ["victim_uid", "attacker_uid"] }` | `PERMISSION_DENIED` |
| 8 | **Eavesdropping on Private Chat** | `/conversations/conv_bob_carol/messages/m1` | `GET` by `eve_hacker` (`eve_hacker` not in `participantIds`) | `PERMISSION_DENIED` |
| 9 | **Chat Message Impersonation** | `/conversations/conv_1/messages/m2` | `CREATE { senderId: "victim_alice", text: "Wire me $1000" }` | `PERMISSION_DENIED` |
| 10 | **Highlight Exfiltration** | `/highlights/hl_private_123` | `GET` / `LIST` by non-owner | `PERMISSION_DENIED` |
| 11 | **Notification Hijacking** | `/notifications/notif_target` | `GET` / `UPDATE` by non-recipient | `PERMISSION_DENIED` |
| 12 | **Orphaned Message Injection** | `/conversations/conv_new/messages/m3` | `CREATE` into conversation where sender is not in `participantIds` | `PERMISSION_DENIED` |
