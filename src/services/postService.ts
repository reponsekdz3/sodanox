import {
  collection,
  doc,
  addDoc,
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
import { db } from '../firebase/config';
import { Post, Comment, User, Poll } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { createNotification } from './notificationService';

const POSTS_COLLECTION = 'posts';

export function isMockArtifact(id?: string, username?: string): boolean {
  if (!id && !username) return false;
  const lowerId = (id || '').toLowerCase();
  const lowerUser = (username || '').toLowerCase();
  return (
    lowerId.startsWith('creator_') ||
    lowerId.startsWith('mock_') ||
    lowerId.startsWith('demo_') ||
    lowerId.startsWith('starter_') ||
    lowerUser === 'clarachen' ||
    lowerUser === 'marcuslind' ||
    lowerUser === 'soren.studio' ||
    lowerUser === 'elena_arch'
  );
}

/**
 * Real-time subscription to community posts from Firestore (100% real user content)
 */
export function subscribeToPosts(
  currentUid: string,
  onUpdate: (posts: Post[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const postsRef = collection(db, POSTS_COLLECTION);

  return onSnapshot(
    postsRef,
    (snapshot) => {
      const postList: Post[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();

        // Strictly purge and ignore mock / seed posts
        if (
          isMockArtifact(d.author?.id, d.author?.username) ||
          docSnap.id.startsWith('starter_') ||
          docSnap.id.startsWith('demo_')
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
          return {
            id: c.id,
            author: c.author,
            content: c.content,
            timestamp: c.timestamp || 'Just now',
            likesCount: cLikedBy.length || c.likesCount || 0,
            hasLiked: cLikedBy.includes(currentUid) || !!c.hasLiked,
            replies: rawReplies.map((r) => {
              const rLikedBy: string[] = r.likedBy || [];
              return {
                id: r.id,
                author: r.author,
                content: r.content,
                timestamp: r.timestamp || 'Just now',
                likesCount: rLikedBy.length || r.likesCount || 0,
                hasLiked: rLikedBy.includes(currentUid) || !!r.hasLiked,
              };
            }),
          };
        });

        const viewsCount = typeof d.viewsCount === 'number' ? d.viewsCount : viewedBy.length;

        postList.push({
          id: docSnap.id,
          author: d.author,
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
          quotedPost: d.quotedPost,
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

      // Sort client-side so latest posts appear at the top of the feed
      postList.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : Date.now();
        const timeB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });

      onUpdate(postList);
    },
    (err) => {
      console.warn('Posts subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Create a new post in Firestore
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
  }
): Promise<void> {
  try {
    const postsRef = collection(db, POSTS_COLLECTION);
    const mediaUrls = extraOptions?.mediaUrls || (mediaUrl ? [mediaUrl] : []);

    await addDoc(postsRef, {
      authorId: author.id,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatar: author.avatar,
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
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, POSTS_COLLECTION);
  }
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
