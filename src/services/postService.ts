import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  getDoc,
  runTransaction,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
import { Post, Comment, User, Poll } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { createNotification } from './notificationService';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

const POSTS_COLLECTION = 'posts';
const LOCAL_POSTS_CACHE_KEY = 'aura_community_posts_cache';
const LOCAL_DELETED_POSTS_KEY = 'aura_deleted_posts_registry';

export function isMockArtifact(id?: string, username?: string): boolean {
  if (!id && !username) return false;
  const lowerId = (id || '').toLowerCase();
  const lowerUser = (username || '').toLowerCase();
  return (
    lowerId.startsWith('creator_') ||
    lowerId.startsWith('mock_') ||
    lowerId.startsWith('demo_') ||
    lowerId.startsWith('aurachats_') ||
    lowerUser === 'clarachen' ||
    lowerUser === 'soren.studio'
  );
}

export const COMMUNITY_WELCOME_POSTS: Post[] = []; // No fictional seed posts are shipped to members.
export function getStoredPosts(): Post[] {
  try {
    const raw = localStorage.getItem(LOCAL_POSTS_CACHE_KEY);
    if (!raw) return [];
    const parsed: Post[] = JSON.parse(raw);
    const deleted = getDeletedPostIds();
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && !deleted.has(p.id) && !isMockArtifact(p.author?.id, p.author?.username))
      : [];
  } catch {
    return [];
  }
}

export function saveStoredPosts(posts: Post[]) {
  try {
    const deleted = getDeletedPostIds();
    const clean = posts.filter((p) => p && !deleted.has(p.id) && !isMockArtifact(p.author?.id, p.author?.username));
    localStorage.setItem(LOCAL_POSTS_CACHE_KEY, JSON.stringify(clean.slice(0, 150)));
  } catch {
    // Local storage quota safe
  }
}

export function getDeletedPostIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_POSTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markPostDeletedLocally(postId: string) {
  try {
    const set = getDeletedPostIds();
    set.add(postId);
    localStorage.setItem(LOCAL_DELETED_POSTS_KEY, JSON.stringify(Array.from(set)));
    // Also remove from cache immediately
    const current = getStoredPosts().filter((p) => p.id !== postId);
    saveStoredPosts(current);
  } catch {
    // Safe
  }
}

/**
 * Real-time subscription to community posts from Firestore with resilient local cache merge.
 * Posts NEVER disappear after 10 seconds or on page refresh.
 */
export function subscribeToPosts(
  currentUid: string,
  onUpdate: (posts: Post[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  // 1. Immediately emit cached posts if present for zero-latency instant rendering
  const initialCached = getStoredPosts();
  onUpdate(initialCached);

  const postsRef = collection(db, POSTS_COLLECTION);

  return onSnapshot(
    postsRef,
    (snapshot) => {
      const deleted = getDeletedPostIds();
      const firestorePosts: Post[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();

        // Strictly purge and ignore mock / seed posts or locally deleted posts
        if (
          isMockArtifact(d.author?.id, d.author?.username) ||
          docSnap.id.startsWith('starter_') ||
          docSnap.id.startsWith('demo_') ||
          deleted.has(docSnap.id)
        ) {
          return;
        }

        const likedBy: string[] = d.likedBy || [];
        const bookmarkedBy: string[] = d.bookmarkedBy || [];
        const repostedBy: string[] = d.repostedBy || [];
        const viewedBy: string[] = d.viewedBy || [];
        const sharedBy: string[] = d.sharedBy || [];
        const voters: Record<string, string> = d.poll?.voters || {};

        // Process comments and check likedBy per comment
        const rawComments: any[] = d.comments || [];
        const comments: Comment[] = rawComments.map((c) => {
          const cLikedBy: string[] = c.likedBy || [];
          const rawReplies: any[] = c.replies || [];
          const cAvatar = isMockOrEmptyAvatar(c.author?.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : c.author?.avatar;
          return {
            id: c.id,
            author: c.author ? { ...c.author, avatar: cAvatar } : c.author,
            content: c.content,
            timestamp: c.timestamp || 'Just now',
            likesCount: cLikedBy.length || c.likesCount || 0,
            hasLiked: cLikedBy.includes(currentUid) || !!c.hasLiked,
            replies: rawReplies.map((r) => {
              const rLikedBy: string[] = r.likedBy || [];
              const rAvatar = isMockOrEmptyAvatar(r.author?.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : r.author?.avatar;
              return {
                id: r.id,
                author: r.author ? { ...r.author, avatar: rAvatar } : r.author,
                content: r.content,
                timestamp: r.timestamp || 'Just now',
                likesCount: rLikedBy.length || r.likesCount || 0,
                hasLiked: rLikedBy.includes(currentUid) || !!r.hasLiked,
              };
            }),
          };
        });

        const viewsCount = typeof d.viewsCount === 'number' ? d.viewsCount : viewedBy.length;
        const postAuthorAvatar = isMockOrEmptyAvatar(d.author?.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : d.author?.avatar;
        const postAuthor = d.author ? { ...d.author, avatar: postAuthorAvatar } : d.author;

        const quotedPostData = d.quotedPost
          ? {
              ...d.quotedPost,
              author: d.quotedPost.author
                ? {
                    ...d.quotedPost.author,
                    avatar: isMockOrEmptyAvatar(d.quotedPost.author.avatar)
                      ? MODERN_EMPTY_AVATAR_DATA_URI
                      : d.quotedPost.author.avatar,
                  }
                : d.quotedPost.author,
            }
          : undefined;

        firestorePosts.push({
          id: docSnap.id,
          author: postAuthor,
          timestamp: d.timestamp || 'Recent',
          content: d.content || '',
          mediaUrl: d.mediaUrl,
          mediaUrls: d.mediaUrls || (d.mediaUrl ? [d.mediaUrl] : []),
          mediaType: d.mediaType,
          location: d.location,
          audience: d.audience || 'public',
          commentsDisabled: d.commentsDisabled || false,
          likesCount: likedBy.length || d.likesCount || 0,
          hasLiked: likedBy.includes(currentUid),
          likedBy,
          bookmarksCount: bookmarkedBy.length || d.bookmarksCount || 0,
          isBookmarked: bookmarkedBy.includes(currentUid),
          repostsCount: repostedBy.length || d.repostsCount || 0,
          hasReposted: repostedBy.includes(currentUid),
          repostedBy,
          viewsCount,
          viewedBy,
          sharedBy,
          repostAuthor: d.repostAuthor,
          repostComment: d.repostComment,
          quotedPost: quotedPostData,
          commentsCount: comments.length,
          comments,
          tags: d.tags || [],
          poll: d.poll
            ? {
                id: d.poll.id || 'poll',
                question: d.poll.question,
                options: d.poll.options || [],
                totalVotes: d.poll.totalVotes || 0,
                userVotedId: voters[currentUid],
              }
            : undefined,
          sharesCount: typeof d.sharesCount === 'number' ? d.sharesCount : sharedBy.length,
          createdAt: d.createdAt,
        });
      });

      // The live Firestore snapshot is authoritative; never merge unconfirmed local-only writes.
      const merged = firestorePosts;

      // Sort client-side so latest posts appear at the top of the feed
      merged.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis
          ? (a as any).createdAt.toMillis()
          : typeof a.createdAt === 'number'
          ? a.createdAt
          : Date.now();
        const timeB = (b as any).createdAt?.toMillis
          ? (b as any).createdAt.toMillis()
          : typeof b.createdAt === 'number'
          ? b.createdAt
          : Date.now();
        return timeB - timeA;
      });

      // Update persistent local cache
      saveStoredPosts(merged);
      onUpdate(merged);
    },
    (err) => {
      console.warn('Posts subscription notice (falling back to local cache):', err);
      const fallback = getStoredPosts();
      onUpdate(fallback);
      if (onError) onError(err);
    }
  );
}

/**
 * Create a new post in Firestore and local persistent storage simultaneously.
 */
export async function createNewPost(
  author: User,
  content: string,
  mediaUrl?: string,
  mediaType: 'image' | 'video' = 'image',
  tags: string[] = [],
  poll?: Poll,
  quotedPost?: Post,
  extraOptions?: {
    mediaUrls?: string[];
    location?: string;
    audience?: 'public' | 'followers';
    commentsDisabled?: boolean;
    explicitPostId?: string;
  }
): Promise<Post> {
  const mediaUrls = extraOptions?.mediaUrls || (mediaUrl ? [mediaUrl] : []);
  const newPostId = extraOptions?.explicitPostId || doc(collection(db, POSTS_COLLECTION)).id;

  const cleanAvatar = isMockOrEmptyAvatar(author.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : author.avatar;
  const authorData: User = {
    id: author.id,
    name: author.name,
    username: author.username,
    avatar: cleanAvatar,
    verified: author.verified || false,
    bio: author.bio || '',
    joinedDate: author.joinedDate || '',
    followersCount: author.followersCount || 0,
    followingCount: author.followingCount || 0,
  };

  const newPost: Post = {
    id: newPostId,
    author: authorData,
    content,
    mediaUrl: mediaUrl || (mediaUrls.length > 0 ? mediaUrls[0] : ''),
    mediaUrls,
    mediaType,
    tags,
    location: extraOptions?.location || '',
    audience: extraOptions?.audience || 'public',
    commentsDisabled: extraOptions?.commentsDisabled || false,
    likesCount: 0,
    likedBy: [],
    hasLiked: false,
    bookmarksCount: 0,
    bookmarkedBy: [],
    isBookmarked: false,
    repostsCount: 0,
    repostedBy: [],
    hasReposted: false,
    commentsCount: 0,
    comments: [],
    sharesCount: 0,
    sharedBy: [],
    viewsCount: 0,
    viewedBy: [],
    poll: poll || undefined,
    quotedPost: quotedPost || undefined,
    timestamp: 'Just now',
    createdAt: Date.now(),
  };

  // Persist first. Local cache is updated only after Firestore confirms the write.
  try {
    const postRef = doc(db, POSTS_COLLECTION, newPostId);
    await setDoc(postRef, {
      id: newPostId,
      authorId: author.id,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatar: cleanAvatar,
        verified: author.verified || false,
      },
      content,
      mediaUrl: mediaUrl || (mediaUrls.length > 0 ? mediaUrls[0] : ''),
      mediaUrls,
      mediaType,
      tags,
      location: extraOptions?.location || '',
      audience: extraOptions?.audience || 'public',
      commentsDisabled: extraOptions?.commentsDisabled || false,
      likesCount: 0,
      likedBy: [],
      bookmarksCount: 0,
      bookmarkedBy: [],
      repostsCount: 0,
      repostedBy: [],
      commentsCount: 0,
      comments: [],
      sharesCount: 0,
      sharedBy: [],
      viewsCount: 0,
      viewedBy: [],
      poll: poll || null,
      quotedPost: quotedPost
        ? {
            id: quotedPost.id,
            author: quotedPost.author,
            content: quotedPost.content,
            mediaUrl: quotedPost.mediaUrl,
            timestamp: quotedPost.timestamp,
          }
        : null,
      timestamp: 'Just now',
      createdAt: serverTimestamp(),
    });

    if (quotedPost && quotedPost.author.id !== author.id) {
      await createNotification(
        quotedPost.author.id,
        author,
        'repost',
        `quoted your post: "${content.slice(0, 30)}..."`,
        quotedPost.id
      ).catch(() => {});
    }
  } catch (err) {
    console.error('Post creation failed; no local-only post was retained:', err);
    throw err;
  }

  const currentStored = getStoredPosts().filter((post) => post.id !== newPostId);
  saveStoredPosts([newPost, ...currentStored]);
  return newPost;
}

/**
 * Real Toggle like for a post in Firestore & notify author
 */
export async function toggleLikePost(
  postId: string, currentUid: string, hasLiked: boolean, targetAuthorId?: string, actor?: User
): Promise<void> {
  if (!postId || !currentUid) throw new Error('A signed-in user and post are required.');
  const postRef = doc(db, POSTS_COLLECTION, postId);
  const didLike = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists()) throw new Error('This post no longer exists.');
    const likedBy: string[] = Array.isArray(snapshot.data().likedBy) ? snapshot.data().likedBy : [];
    const alreadyLiked = likedBy.includes(currentUid);
    const desired = !hasLiked;
    if (alreadyLiked === desired) return false;
    const next = desired ? [...likedBy, currentUid] : likedBy.filter((id) => id !== currentUid);
    transaction.update(postRef, { likedBy: next, likesCount: next.length });
    return desired;
  });
  if (didLike && targetAuthorId && actor && targetAuthorId !== currentUid) {
    await createNotification(targetAuthorId, actor, 'like', 'liked your post', postId)
      .catch((error) => console.warn('Like saved, but its notification could not be delivered:', error));
  }
}


export async function toggleBookmarkPost(
  postId: string, currentUid: string, isBookmarked: boolean
): Promise<void> {
  if (!postId || !currentUid) throw new Error('A signed-in user and post are required.');
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists()) throw new Error('This post no longer exists.');
    const bookmarkedBy: string[] = Array.isArray(snapshot.data().bookmarkedBy) ? snapshot.data().bookmarkedBy : [];
    const desired = !isBookmarked;
    const alreadySaved = bookmarkedBy.includes(currentUid);
    if (alreadySaved === desired) return;
    const next = desired ? [...bookmarkedBy, currentUid] : bookmarkedBy.filter((id) => id !== currentUid);
    transaction.update(postRef, { bookmarkedBy: next, bookmarksCount: next.length });
  });
}


export async function toggleRepostPost(
  postId: string, currentUser: User, hasReposted: boolean, quoteComment?: string, targetAuthorId?: string, originalPost?: Post
): Promise<void> {
  const isQuote = Boolean(quoteComment && quoteComment.trim() && originalPost);
  if (isQuote && originalPost) {
    await createNewPost(currentUser, quoteComment!.trim(), undefined, 'image', originalPost.tags || [], undefined, originalPost);
  }
  const postRef = doc(db, POSTS_COLLECTION, postId);
  const didRepost = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists()) throw new Error('This post no longer exists.');
    const repostedBy: string[] = Array.isArray(snapshot.data().repostedBy) ? snapshot.data().repostedBy : [];
    const desired = isQuote ? true : !hasReposted;
    const alreadyReposted = repostedBy.includes(currentUser.id);
    if (alreadyReposted === desired) return false;
    const next = desired ? [...repostedBy, currentUser.id] : repostedBy.filter((id) => id !== currentUser.id);
    transaction.update(postRef, { repostedBy: next, repostsCount: next.length });
    return desired;
  });
  if (didRepost && targetAuthorId && targetAuthorId !== currentUser.id) {
    await createNotification(targetAuthorId, currentUser, 'repost', 'reposted your post', postId)
      .catch((error) => console.warn('Repost saved, but its notification could not be delivered:', error));
  }
}

export async function incrementPostShareCount(postId: string, actor?: User, targetAuthorId?: string): Promise<void> {
  if (!postId || !actor?.id) throw new Error('Sign in to share a post.');
  const record = httpsCallable<{ collectionName: 'posts'; contentId: string }, { success: boolean; recorded: boolean; sharesCount: number }>(
    functions, 'recordContentShare'
  );
  const result = await record({ collectionName: 'posts', contentId: postId });
  if (result.data.recorded && targetAuthorId && targetAuthorId !== actor.id) {
    await createNotification(targetAuthorId, actor, 'share', 'shared your reflection', postId, 'post')
      .catch((error) => console.warn('Post share saved, but its notification could not be delivered:', error));
  }
}

export async function recordPostView(postId: string, viewerId: string): Promise<void> {
  if (!postId || !viewerId) return;
  const postRef = doc(db, POSTS_COLLECTION, postId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists()) return;
    const viewedBy: string[] = Array.isArray(snapshot.data().viewedBy) ? snapshot.data().viewedBy : [];
    if (viewedBy.includes(viewerId)) return;
    const next = [...viewedBy, viewerId];
    transaction.update(postRef, { viewedBy: next, viewsCount: next.length });
  });
}


export async function addCommentToPost(
  postId: string, author: User, content: string, replyToCommentId?: string, targetAuthorId?: string
): Promise<void> {
  const cleanContent = content.trim();
  if (!cleanContent || cleanContent.length > 2000) throw new Error('Comments must be between 1 and 2,000 characters.');
  const updateComment = httpsCallable<
    { collectionName: 'posts'; contentId: string; action: 'add' | 'reply'; commentId?: string; content: string },
    { success: boolean; commentId: string }
  >(functions, 'updateContentComment');
  await updateComment({
    collectionName: 'posts', contentId: postId,
    action: replyToCommentId ? 'reply' : 'add', commentId: replyToCommentId, content: cleanContent,
  });
  if (!replyToCommentId && targetAuthorId && targetAuthorId !== author.id) {
    await createNotification(targetAuthorId, author, 'comment', `commented: "${cleanContent.slice(0, 30)}..."`, postId)
      .catch((error) => console.warn('Comment saved, but its notification could not be delivered:', error));
  }
}


export async function toggleLikeComment(postId: string, commentId: string, currentUid: string): Promise<void> {
  if (!currentUid) throw new Error('Sign in before liking a comment.');
  const updateComment = httpsCallable<
    { collectionName: 'posts'; contentId: string; action: 'toggle_like'; commentId: string },
    { success: boolean }
  >(functions, 'updateContentComment');
  await updateComment({ collectionName: 'posts', contentId: postId, action: 'toggle_like', commentId });
}


export async function voteInPoll(postId: string, optionId: string, currentUid: string): Promise<void> {
  if (!currentUid) throw new Error('Sign in before voting in a poll.');
  const vote = httpsCallable<{ postId: string; optionId: string }, { success: boolean; totalVotes: number; optionId: string }>(
    functions, 'voteInPostPoll'
  );
  await vote({ postId, optionId });
}


export async function deletePostFromFirestore(postId: string): Promise<void> {
  if (!postId) throw new Error('A post ID is required.');
  await deleteDoc(doc(db, POSTS_COLLECTION, postId));
  markPostDeletedLocally(postId);
}


export async function updatePostContent(postId: string, content: string): Promise<void> {
  const cleanContent = content.trim();
  if (!postId || !cleanContent) throw new Error('A post and non-empty content are required.');
  await updateDoc(doc(db, POSTS_COLLECTION, postId), { content: cleanContent, isEdited: true, updatedAt: serverTimestamp() });
}


export async function deleteCommentFromPost(postId: string, commentId: string, replyId?: string): Promise<void> {
  const removeComment = httpsCallable<
    { collectionName: 'posts'; contentId: string; action: 'delete'; commentId: string; replyId?: string },
    { success: boolean }
  >(functions, 'updateContentComment');
  await removeComment({ collectionName: 'posts', contentId: postId, action: 'delete', commentId, replyId });
}