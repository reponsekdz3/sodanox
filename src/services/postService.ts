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
  limit,
  arrayUnion,
  arrayRemove,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Post, Comment, User, Poll } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { createNotification } from './notificationService';

const POSTS_COLLECTION = 'posts';

export const INITIAL_COMMUNITY_POSTS: Omit<Post, 'id'>[] = [
  {
    author: {
      id: 'creator_clara_chen',
      name: 'Clara Chen',
      username: 'clarachen',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
      bio: 'Ceramicist & studio maker.',
      joinedDate: 'Joined May 2024',
      followersCount: 22400,
      followingCount: 520,
      isFollowing: true,
      verified: true,
    },
    timestamp: '15m ago',
    content: 'Unveiling a series of hand-thrown stoneware vessels cured in pine smoke. Notice how subtle raw iron speckles emerge through the satin matte glaze.',
    mediaUrl: '/src/assets/images/post_ceramic_art_1790174946314.jpg',
    mediaType: 'image',
    likesCount: 142,
    hasLiked: false,
    bookmarksCount: 29,
    isBookmarked: false,
    repostsCount: 18,
    hasReposted: false,
    commentsCount: 3,
    comments: [
      {
        id: 'c1',
        author: {
          id: 'creator_marcus_lind',
          name: 'Marcus Lind',
          username: 'marcuslind',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          bio: 'Product designer',
          joinedDate: 'Joined Jan 2024',
          followersCount: 8930,
          followingCount: 310,
          isFollowing: true,
          verified: true,
        },
        content: 'The quiet balance between the unglazed foot and upper rim is breathtaking.',
        timestamp: '10m ago',
        likesCount: 8,
        hasLiked: false,
      },
    ],
    tags: ['Ceramics', 'StudioCraft', 'TactileObject', 'SlowDesign'],
    sharesCount: 14,
  },
  {
    author: {
      id: 'creator_marcus_lind',
      name: 'Marcus Lind',
      username: 'marcuslind',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      bio: 'Product designer & spatial acoustic engineer.',
      joinedDate: 'Joined January 2024',
      followersCount: 8930,
      followingCount: 310,
      isFollowing: true,
      verified: true,
    },
    timestamp: '1h ago',
    content: 'Observing how morning fog softens architectural silhouettes against the fjord. Which tonal material palette do you find most calming in work spaces?',
    mediaUrl: '/src/assets/images/post_scenic_nordic_1790174933983.jpg',
    mediaType: 'image',
    likesCount: 384,
    hasLiked: false,
    bookmarksCount: 81,
    isBookmarked: false,
    repostsCount: 42,
    hasReposted: false,
    commentsCount: 12,
    comments: [],
    tags: ['NordicLight', 'SpatialDesign', 'Architecture', 'QuietSpaces'],
    poll: {
      id: 'poll_1',
      question: 'Which material warmth best grounds your creative focus?',
      options: [
        { id: 'opt_1', text: 'Bleached ash & muted linen', votes: 128 },
        { id: 'opt_2', text: 'Cast bronze & blackened oak', votes: 94 },
        { id: 'opt_3', text: 'Brushed aluminum & tactile felt', votes: 62 },
      ],
      totalVotes: 284,
    },
    sharesCount: 38,
  },
];

/**
 * Real-time subscription to community posts from Firestore
 */
export function subscribeToPosts(
  currentUid: string,
  onUpdate: (posts: Post[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const postsRef = collection(db, POSTS_COLLECTION);
  const q = query(postsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const postList: Post[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const likedBy: string[] = d.likedBy || [];
        const bookmarkedBy: string[] = d.bookmarkedBy || [];
        const repostedBy: string[] = d.repostedBy || [];
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
          bookmarksCount: bookmarkedBy.length || d.bookmarksCount || 0,
          isBookmarked: bookmarkedBy.includes(currentUid),
          repostsCount: repostedBy.length || d.repostsCount || 0,
          hasReposted: repostedBy.includes(currentUid),
          repostedBy,
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
          sharesCount: d.sharesCount || 0,
          createdAt: d.createdAt,
        });
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
 * Increment real share counter in Firestore
 */
export async function incrementPostShareCount(postId: string): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const snap = await getDocs(query(collection(db, POSTS_COLLECTION)));
    const target = snap.docs.find((d) => d.id === postId);
    if (!target) return;
    const currentShares = target.data().sharesCount || 0;
    await updateDoc(postRef, {
      sharesCount: currentShares + 1,
    });
  } catch (err) {
    console.warn('Error incrementing share count:', err);
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
