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
import { Reel, Comment, User } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { createNotification } from './notificationService';
import { isMockArtifact } from './postService';

const REELS_COLLECTION = 'reels';

/**
 * Real-time subscription to reels from Firestore
 */
export function subscribeToReels(
  currentUid: string,
  onUpdate: (reels: Reel[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const reelsRef = collection(db, REELS_COLLECTION);

  return onSnapshot(
    reelsRef,
    (snapshot) => {
      const list: Reel[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();

        // Purge mock/seed reels
        if (
          isMockArtifact(d.author?.id, d.author?.username) ||
          docSnap.id.startsWith('demo_') ||
          docSnap.id.startsWith('starter_')
        ) {
          return;
        }

        const likedBy: string[] = d.likedBy || [];
        const bookmarkedBy: string[] = d.bookmarkedBy || [];

        list.push({
          id: docSnap.id,
          author: d.author,
          videoUrl: d.videoUrl,
          posterUrl: d.posterUrl || '',
          caption: d.caption || '',
          tags: d.tags || [],
          audioTrack: d.audioTrack || { title: 'Original Sound', artist: d.author?.name || 'Creator' },
          likesCount: likedBy.length || d.likesCount || 0,
          hasLiked: likedBy.includes(currentUid),
          commentsCount: (d.comments || []).length || d.commentsCount || 0,
          comments: d.comments || [],
          sharesCount: d.sharesCount || 0,
          isSaved: bookmarkedBy.includes(currentUid),
        });
      });

      // Sort client-side so new reels appear first
      list.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : Date.now();
        const timeB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });

      onUpdate(list);
    },
    (err) => {
      console.warn('Reels subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Create a new Reel in Firestore
 */
export async function createReelInFirestore(
  author: User,
  videoUrl: string,
  posterUrl: string,
  caption: string,
  tags: string[],
  audioTrack?: { title: string; artist: string }
): Promise<void> {
  try {
    const reelsRef = collection(db, REELS_COLLECTION);
    await addDoc(reelsRef, {
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatar: author.avatar,
        verified: author.verified || false,
      },
      videoUrl,
      posterUrl,
      caption,
      tags,
      audioTrack: audioTrack || { title: 'Original Audio', artist: author.name },
      likesCount: 0,
      likedBy: [],
      commentsCount: 0,
      comments: [],
      sharesCount: 0,
      bookmarkedBy: [],
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, REELS_COLLECTION);
  }
}

/**
 * Toggle like for a reel in Firestore & notify author
 */
export async function toggleLikeReel(
  reelId: string,
  currentUid: string,
  hasLiked: boolean,
  authorId?: string,
  actor?: User
): Promise<void> {
  try {
    const reelRef = doc(db, REELS_COLLECTION, reelId);
    if (hasLiked) {
      await updateDoc(reelRef, {
        likedBy: arrayRemove(currentUid),
      });
    } else {
      await updateDoc(reelRef, {
        likedBy: arrayUnion(currentUid),
      });
      if (authorId && actor) {
        await createNotification(authorId, actor, 'like', 'liked your reel', reelId);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${REELS_COLLECTION}/${reelId}`);
  }
}

/**
 * Toggle bookmark for a reel in Firestore
 */
export async function toggleBookmarkReel(
  reelId: string,
  currentUid: string,
  isSaved: boolean
): Promise<void> {
  try {
    const reelRef = doc(db, REELS_COLLECTION, reelId);
    if (isSaved) {
      await updateDoc(reelRef, {
        bookmarkedBy: arrayRemove(currentUid),
      });
    } else {
      await updateDoc(reelRef, {
        bookmarkedBy: arrayUnion(currentUid),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${REELS_COLLECTION}/${reelId}`);
  }
}

/**
 * Add a comment to a reel in Firestore & notify author
 */
export async function addCommentToReel(
  reelId: string,
  author: User,
  content: string,
  targetAuthorId?: string
): Promise<void> {
  try {
    const reelRef = doc(db, REELS_COLLECTION, reelId);
    const newComment: Comment = {
      id: `rc_${Date.now()}`,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatar: author.avatar,
        bio: author.bio,
        joinedDate: author.joinedDate,
        followersCount: author.followersCount,
        followingCount: author.followingCount,
        isFollowing: false,
      },
      content,
      timestamp: 'Just now',
      likesCount: 0,
      hasLiked: false,
    };

    await updateDoc(reelRef, {
      comments: arrayUnion(newComment),
    });

    if (targetAuthorId && targetAuthorId !== author.id) {
      await createNotification(targetAuthorId, author, 'comment', `commented: "${content.slice(0, 30)}..."`, reelId);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${REELS_COLLECTION}/${reelId}`);
  }
}

/**
 * Increment share counter for a reel in Firestore
 */
export async function incrementReelShareCount(reelId: string): Promise<void> {
  try {
    const reelRef = doc(db, REELS_COLLECTION, reelId);
    const snap = await getDocs(query(collection(db, REELS_COLLECTION)));
    const target = snap.docs.find((d) => d.id === reelId);
    if (!target) return;
    const currentShares = target.data().sharesCount || 0;
    await updateDoc(reelRef, {
      sharesCount: currentShares + 1,
    });
  } catch (err) {
    console.warn('Error incrementing reel share count:', err);
  }
}

/**
 * Create a new Reel in Firestore
 */
export async function createNewReel(
  author: User,
  data: {
    videoUrl: string;
    posterUrl: string;
    caption: string;
    tags: string[];
    audioTitle: string;
    audioArtist: string;
  }
): Promise<void> {
  try {
    const reelsRef = collection(db, REELS_COLLECTION);
    await addDoc(reelsRef, {
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatar: author.avatar,
        verified: author.verified || false,
      },
      videoUrl: data.videoUrl,
      posterUrl: data.posterUrl,
      caption: data.caption,
      tags: data.tags,
      audioTrack: {
        title: data.audioTitle || 'Original Sound',
        artist: data.audioArtist || author.name,
      },
      likesCount: 0,
      likedBy: [],
      bookmarksCount: 0,
      bookmarkedBy: [],
      commentsCount: 0,
      comments: [],
      sharesCount: 0,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, REELS_COLLECTION);
  }
}
