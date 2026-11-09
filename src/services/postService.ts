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
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
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
  if (lowerId.startsWith('aurachats_')) return false;
  return (
    lowerId.startsWith('creator_') ||
    lowerId.startsWith('mock_') ||
    lowerId.startsWith('demo_') ||
    lowerUser === 'clarachen' ||
    lowerUser === 'soren.studio'
  );
}

export const COMMUNITY_WELCOME_POSTS: Post[] = [
  {
    id: 'aurachats_welcome_01',
    author: {
      id: 'aurachats_official',
      name: 'AuraChats Official',
      username: 'aurachats',
      avatar: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="%2310B981"/><stop offset="100%" stop-color="%23064E3B"/></radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(%23g)"/><text x="50" y="58" font-family="sans-serif" font-size="34" font-weight="bold" fill="white" text-anchor="middle">A</text></svg>',
      bio: 'Welcome to AuraChats — the modern dark emerald platform for messaging, voice reflections, calls, and stories.',
      joinedDate: 'Joined March 2026',
      followersCount: 1240,
      followingCount: 32,
      verified: true,
    },
    timestamp: 'Just now',
    content: 'Welcome to AuraChats! 🌿 Designed with a rich dark modern green palette, instant voice notes, full 4K UHD resolutions, custom aspect ratios, real live story additions, and direct post sharing straight into messages. Tap on any post to view details, join the discussion, or vote below!',
    tags: ['aurachats', 'welcome', 'community', 'modern'],
    likesCount: 42,
    hasLiked: false,
    likedBy: [],
    bookmarksCount: 21,
    isBookmarked: false,
    repostsCount: 14,
    hasReposted: false,
    repostedBy: [],
    viewsCount: 380,
    commentsCount: 2,
    sharesCount: 19,
    poll: {
      id: 'poll_welcome_01',
      question: 'Which AuraChats feature do you find most essential?',
      options: [
        { id: 'opt_1', text: '4K Resolutions & Aspect Ratio Cropping', votes: 34 },
        { id: 'opt_2', text: 'Instant Voice Notes & Audio/Video Calling', votes: 41 },
        { id: 'opt_3', text: 'Modern Live Stories & Profile Highlights', votes: 29 },
        { id: 'opt_4', text: 'Direct Post Sharing to Messages', votes: 38 },
      ],
      totalVotes: 142,
    },
    comments: [
      {
        id: 'c_welcome_01',
        author: {
          id: 'aurachats_member_01',
          name: 'Sarah Chen',
          username: 'sarahc',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          bio: 'Interface design & tactile architecture.',
          joinedDate: 'Joined 2026',
          followersCount: 410,
          followingCount: 180,
        },
        content: 'The new Dark Modern Green aesthetic is stunning! The progress bar with linear percentages during image upload feels remarkably fast.',
        timestamp: '12m ago',
        likesCount: 8,
        hasLiked: false,
        replies: [],
      },
    ],
  },
  {
    id: 'aurachats_welcome_02',
    author: {
      id: 'aurachats_creator_02',
      name: 'Julian Vance',
      username: 'julianv',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      bio: 'Acoustic research & Nordic design.',
      joinedDate: 'Joined 2026',
      followersCount: 860,
      followingCount: 95,
    },
    timestamp: '45m ago',
    content: 'Capturing morning clarity in the workshop. Posted using 4:5 portrait aspect ratio with high fidelity compression. Notice the crisp gradients and shadow detail.',
    mediaUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
    mediaUrls: ['https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80'],
    mediaType: 'image',
    resolution: '1080p',
    aspectRatio: '4:5',
    tags: ['craft', 'architecture', 'nordic', 'studio'],
    likesCount: 65,
    hasLiked: false,
    likedBy: [],
    bookmarksCount: 31,
    isBookmarked: false,
    repostsCount: 9,
    hasReposted: false,
    repostedBy: [],
    viewsCount: 512,
    commentsCount: 0,
    sharesCount: 16,
    comments: [],
  },
];

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
  onUpdate(initialCached.length > 0 ? initialCached : COMMUNITY_WELCOME_POSTS);

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

      // Merge Firestore posts with any local cached posts by this user that are still syncing
      const cached = getStoredPosts();
      const firestoreIds = new Set(firestorePosts.map((p) => p.id));
      const localOnly = cached.filter((p) => !firestoreIds.has(p.id) && !deleted.has(p.id));

      const merged = [...firestorePosts, ...localOnly];

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
      const finalPosts = merged.length > 0 ? merged : COMMUNITY_WELCOME_POSTS;
      saveStoredPosts(finalPosts);
      onUpdate(finalPosts);
    },
    (err) => {
      console.warn('Posts subscription notice (falling back to local cache):', err);
      const fallback = getStoredPosts();
      onUpdate(fallback.length > 0 ? fallback : COMMUNITY_WELCOME_POSTS);
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
  const newPostId = extraOptions?.explicitPostId || `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

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
    createdAt: { toMillis: () => Date.now() } as any,
  };

  // 1. Immediately write to persistent local cache so post NEVER disappears on refresh
  const currentStored = getStoredPosts().filter((p) => p.id !== newPostId);
  saveStoredPosts([newPost, ...currentStored]);

  // 2. Write to Firestore with identical ID
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
    console.warn('Firestore post sync notice (saved safely in local persistent cache):', err);
  }

  return newPost;
}

/**
 * Real Toggle like for a post in Firestore & notify author
 */
export async function toggleLikePost(
  postId: string,
  currentUid: string,
  hasLiked: boolean,
  targetAuthorId?: string,
  actor?: User
): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    if (hasLiked) {
      await updateDoc(postRef, {
        likedBy: arrayRemove(currentUid),
      });
    } else {
      await updateDoc(postRef, {
        likedBy: arrayUnion(currentUid),
      });
      if (targetAuthorId && actor && targetAuthorId !== currentUid) {
        await createNotification(targetAuthorId, actor, 'like', 'liked your post', postId);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Real Toggle bookmark for a post in Firestore
 */
export async function toggleBookmarkPost(
  postId: string,
  currentUid: string,
  isBookmarked: boolean
): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    if (isBookmarked) {
      await updateDoc(postRef, {
        bookmarkedBy: arrayRemove(currentUid),
      });
    } else {
      await updateDoc(postRef, {
        bookmarkedBy: arrayUnion(currentUid),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Real Repost action:
 * - If quick repost: toggles user's ID in post's repostedBy list
 * - If quote repost: creates a new post with the original post attached as `quotedPost`
 */
export async function toggleRepostPost(
  postId: string,
  currentUser: User,
  hasReposted: boolean,
  targetAuthorId?: string,
  quoteComment?: string,
  originalPost?: Post
): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);

    if (quoteComment && quoteComment.trim() && originalPost) {
      // Create quote post
      await createNewPost(
        currentUser,
        quoteComment.trim(),
        undefined,
        'image',
        originalPost.tags || [],
        undefined,
        originalPost
      );
      // Increment original repost count
      await updateDoc(postRef, {
        repostedBy: arrayUnion(currentUser.id),
      });
      return;
    }

    if (hasReposted) {
      await updateDoc(postRef, {
        repostedBy: arrayRemove(currentUser.id),
      });
    } else {
      await updateDoc(postRef, {
        repostedBy: arrayUnion(currentUser.id),
      });
      if (targetAuthorId && targetAuthorId !== currentUser.id) {
        await createNotification(targetAuthorId, currentUser, 'repost', 'reposted your post', postId);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Increment real share counter in Firestore & notify the post author
 */
export async function incrementPostShareCount(
  postId: string,
  actor?: User,
  targetAuthorId?: string
): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const updates: Record<string, any> = {
      sharesCount: increment(1),
    };
    if (actor?.id) {
      updates.sharedBy = arrayUnion(actor.id);
    }
    await updateDoc(postRef, updates);

    if (actor && targetAuthorId && targetAuthorId !== actor.id) {
      await createNotification(
        targetAuthorId,
        actor,
        'share',
        'shared your reflection',
        postId,
        'post'
      );
    }
  } catch (err) {
    console.warn('Error incrementing share count:', err);
  }
}

/**
 * Real Post View / Impression tracker in Firestore
 */
export async function recordPostView(postId: string, viewerId: string): Promise<void> {
  if (!postId || !viewerId) return;
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await updateDoc(postRef, {
      viewedBy: arrayUnion(viewerId),
      viewsCount: increment(1),
    });
  } catch (err) {
    // Non-fatal, suppress permissions or network glitches during rapid scroll
  }
}

/**
 * Add a comment or reply to a post in Firestore & notify author
 */
export async function addCommentToPost(
  postId: string,
  author: User,
  content: string,
  replyToCommentId?: string,
  targetAuthorId?: string
): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const snap = await getDocs(query(collection(db, POSTS_COLLECTION)));
    const target = snap.docs.find((d) => d.id === postId);
    if (!target) return;

    const data = target.data();
    const existingComments: any[] = data.comments || [];

    if (replyToCommentId) {
      // Add nested reply to comment
      const newReply = {
        id: `cr_${Date.now()}`,
        author: {
          id: author.id,
          name: author.name,
          username: author.username,
          avatar: author.avatar,
          verified: author.verified || false,
        },
        content,
        timestamp: 'Just now',
        likesCount: 0,
        likedBy: [],
      };

      const updated = existingComments.map((c) => {
        if (c.id === replyToCommentId) {
          const replies = c.replies || [];
          return { ...c, replies: [...replies, newReply] };
        }
        return c;
      });

      await updateDoc(postRef, { comments: updated });
    } else {
      // Add top-level comment
      const newComment = {
        id: `c_${Date.now()}`,
        author: {
          id: author.id,
          name: author.name,
          username: author.username,
          avatar: author.avatar,
          verified: author.verified || false,
        },
        content,
        timestamp: 'Just now',
        likesCount: 0,
        likedBy: [],
        replies: [],
      };

      await updateDoc(postRef, {
        comments: arrayUnion(newComment),
      });
    }

    if (targetAuthorId && targetAuthorId !== author.id) {
      await createNotification(
        targetAuthorId,
        author,
        'comment',
        `commented: "${content.slice(0, 30)}..."`,
        postId
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Toggle like for a comment or nested reply in Firestore
 */
export async function toggleLikeComment(
  postId: string,
  commentId: string,
  currentUid: string
): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const snap = await getDocs(query(collection(db, POSTS_COLLECTION)));
    const target = snap.docs.find((d) => d.id === postId);
    if (!target) return;

    const comments: any[] = target.data().comments || [];
    const updatedComments = comments.map((c) => {
      if (c.id === commentId) {
        const likedBy: string[] = c.likedBy || [];
        const hasLiked = likedBy.includes(currentUid);
        const newLikedBy = hasLiked
          ? likedBy.filter((id) => id !== currentUid)
          : [...likedBy, currentUid];
        return {
          ...c,
          likedBy: newLikedBy,
          likesCount: newLikedBy.length,
        };
      }
      // Check replies
      if (c.replies && c.replies.length > 0) {
        const updatedReplies = c.replies.map((r: any) => {
          if (r.id === commentId) {
            const likedBy: string[] = r.likedBy || [];
            const hasLiked = likedBy.includes(currentUid);
            const newLikedBy = hasLiked
              ? likedBy.filter((id) => id !== currentUid)
              : [...likedBy, currentUid];
            return {
              ...r,
              likedBy: newLikedBy,
              likesCount: newLikedBy.length,
            };
          }
          return r;
        });
        return { ...c, replies: updatedReplies };
      }
      return c;
    });

    await updateDoc(postRef, { comments: updatedComments });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Vote in a poll in Firestore
 */
export async function voteInPoll(postId: string, optionId: string, currentUid: string): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const snap = await getDocs(query(collection(db, POSTS_COLLECTION)));
    const targetDoc = snap.docs.find((d) => d.id === postId);
    if (!targetDoc) return;

    const data = targetDoc.data();
    const poll = data.poll;
    if (!poll || !poll.options) return;

    const voters = poll.voters || {};
    if (voters[currentUid]) return; // already voted

    const updatedOptions = poll.options.map((opt: { id: string; text: string; votes: number }) => {
      if (opt.id === optionId) {
        return { ...opt, votes: (opt.votes || 0) + 1 };
      }
      return opt;
    });

    await updateDoc(postRef, {
      'poll.options': updatedOptions,
      'poll.totalVotes': (poll.totalVotes || 0) + 1,
      [`poll.voters.${currentUid}`]: optionId,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Delete a post from Firestore
 */
export async function deletePostFromFirestore(postId: string): Promise<void> {
  markPostDeletedLocally(postId);
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await deleteDoc(postRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Update post content (Edit post) in Firestore
 */
export async function updatePostContent(postId: string, content: string): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await updateDoc(postRef, {
      content,
      isEdited: true,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}

/**
 * Delete a comment or reply from a post in Firestore
 */
export async function deleteCommentFromPost(
  postId: string,
  commentId: string,
  replyId?: string
): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const snap = await getDocs(query(collection(db, POSTS_COLLECTION)));
    const target = snap.docs.find((d) => d.id === postId);
    if (!target) return;

    const comments: any[] = target.data().comments || [];
    let updatedComments: any[] = [];

    if (replyId) {
      // Remove reply inside comment
      updatedComments = comments.map((c) => {
        if (c.id === commentId && c.replies) {
          return {
            ...c,
            replies: c.replies.filter((r: any) => r.id !== replyId),
          };
        }
        return c;
      });
    } else {
      // Remove top-level comment
      updatedComments = comments.filter((c) => c.id !== commentId);
    }

    await updateDoc(postRef, { comments: updatedComments });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${POSTS_COLLECTION}/${postId}`);
  }
}
