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
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

const REELS_COLLECTION = 'reels';
const LOCAL_REELS_CACHE_KEY = 'aura_community_reels_cache';
const LOCAL_DELETED_REELS_KEY = 'aura_deleted_reels_registry';

export function getStoredReels(): Reel[] {
  try {
    const raw = localStorage.getItem(LOCAL_REELS_CACHE_KEY);
    if (!raw) return [];
    const parsed: Reel[] = JSON.parse(raw);
    const deleted = getDeletedReelIds();
    return Array.isArray(parsed)
      ? parsed.filter((r) => r && !deleted.has(r.id) && !isMockArtifact(r.author?.id, r.author?.username))
      : [];
  } catch {
    return [];
  }
}

export function saveStoredReels(reels: Reel[]) {
  try {
    const deleted = getDeletedReelIds();
    const clean = reels.filter((r) => r && !deleted.has(r.id) && !isMockArtifact(r.author?.id, r.author?.username));
    localStorage.setItem(LOCAL_REELS_CACHE_KEY, JSON.stringify(clean.slice(0, 100)));
  } catch {
    // Safe
  }
}

export function getDeletedReelIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DELETED_REELS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function markReelDeletedLocally(reelId: string) {
  try {
    const set = getDeletedReelIds();
    set.add(reelId);
    localStorage.setItem(LOCAL_DELETED_REELS_KEY, JSON.stringify(Array.from(set)));
    const current = getStoredReels().filter((r) => r.id !== reelId);
    saveStoredReels(current);
  } catch {
    // Safe
  }
}

/**
 * Real-time subscription to reels from Firestore with persistent local cache merge.
 */
export function subscribeToReels(
  currentUid: string,
  onUpdate: (reels: Reel[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  // 1. Immediately emit cached reels for instant playback on refresh
  const initialCached = getStoredReels();
  if (initialCached.length > 0) {
    onUpdate(initialCached);
  }

  const reelsRef = collection(db, REELS_COLLECTION);

  return onSnapshot(
    reelsRef,
    (snapshot) => {
      const deleted = getDeletedReelIds();
      const firestoreReels: Reel[] = [];

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();

        // Purge mock/seed reels or locally deleted reels
        if (
          isMockArtifact(d.author?.id, d.author?.username) ||
          docSnap.id.startsWith('demo_') ||
          docSnap.id.startsWith('starter_') ||
          deleted.has(docSnap.id)
        ) {
          return;
        }

        const likedBy: string[] = d.likedBy || [];
        const bookmarkedBy: string[] = d.bookmarkedBy || [];

        const authorAvatar = isMockOrEmptyAvatar(d.author?.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : d.author?.avatar;
        const reelAuthor = d.author ? { ...d.author, avatar: authorAvatar } : d.author;
        const rawComments: any[] = d.comments || [];
        const comments: Comment[] = rawComments.map((c) => ({
          ...c,
          author: c.author
            ? {
                ...c.author,
                avatar: isMockOrEmptyAvatar(c.author.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : c.author.avatar,
              }
            : c.author,
        }));

        firestoreReels.push({
          id: docSnap.id,
          author: reelAuthor,
          videoUrl: d.videoUrl,
          posterUrl: d.posterUrl || '',
          caption: d.caption || '',
          tags: d.tags || [],
          audioTrack: d.audioTrack || { title: 'Original Sound', artist: d.author?.name || 'Creator' },
          likesCount: likedBy.length || d.likesCount || 0,
          hasLiked: likedBy.includes(currentUid),
          commentsCount: comments.length || d.commentsCount || 0,
          comments,
          sharesCount: d.sharesCount || 0,
          isSaved: bookmarkedBy.includes(currentUid),
          createdAt: d.createdAt,
        });
      });

      // Merge Firestore reels with locally cached reels
      const cached = getStoredReels();
      const firestoreIds = new Set(firestoreReels.map((r) => r.id));
      const localOnly = cached.filter((r) => !firestoreIds.has(r.id) && !deleted.has(r.id));

      const merged = [...firestoreReels, ...localOnly];

      // Sort client-side so new reels appear first
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

      saveStoredReels(merged);
      onUpdate(merged);
    },
    (err) => {
      console.warn('Reels subscription notice (using local cached reels):', err);
      const fallback = getStoredReels();
      if (fallback.length > 0) {
        onUpdate(fallback);
      }
      if (onError) onError(err);
    }
  );
}

/**
 * Create a new Reel in Firestore and local persistent cache
 */
export async function createReelInFirestore(
  author: User,
  videoUrl: string,
  posterUrl: string,
  caption: string,
  tags: string[],
  audioTrack?: { title: string; artist: string },
  explicitReelId?: string
): Promise<Reel> {
  const reelId = explicitReelId || `reel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanAvatar = isMockOrEmptyAvatar(author.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : author.avatar;

  const newReel: Reel = {
    id: reelId,
    author: {
      ...author,
      avatar: cleanAvatar,
      verified: author.verified || false,
    },
    videoUrl,
    posterUrl,
    caption,
    tags,
    audioTrack: audioTrack || { title: 'Original Sound', artist: author.name },
    likesCount: 0,
    likedBy: [],
    hasLiked: false,
    commentsCount: 0,
    comments: [],
    sharesCount: 0,
    isSaved: false,
    createdAt: { toMillis: () => Date.now() } as any,
  };

  // 1. Immediately store in persistent local cache so reel NEVER disappears on refresh
  const current = getStoredReels().filter((r) => r.id !== reelId);
  saveStoredReels([newReel, ...current]);

  // 2. Persist to Firestore with explicit ID
  try {
    const reelRef = doc(db, REELS_COLLECTION, reelId);
    await setDoc(reelRef, {
      id: reelId,
      authorId: author.id,
      author: {
        id: author.id,
        name: author.name,
        username: author.username,
        avatar: cleanAvatar,
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
    console.warn('Firestore reel sync notice (stored safely in local persistent cache):', err);
  }

  return newReel;
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
): Promise<Reel> {
  return createReelInFirestore(
    author,
    data.videoUrl,
    data.posterUrl,
    data.caption,
    data.tags,
    {
      title: data.audioTitle || 'Original Sound',
      artist: data.audioArtist || author.name,
    }
  );
}
