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
  runTransaction,
  limit,
  arrayUnion,
  arrayRemove,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
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

      // A live Firestore snapshot is authoritative; don't surface unconfirmed local-only reels.
      const merged = firestoreReels;

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
  const reelId = explicitReelId || doc(collection(db, REELS_COLLECTION)).id;
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
    createdAt: Date.now(),
  };

  if (!videoUrl || !posterUrl) throw new Error('A reel video and poster are required.');
  // Persist to Firestore first; local cache only receives confirmed server records.
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
    console.error('Reel creation failed; no local-only reel was retained:', err);
    throw err;
  }

  const current = getStoredReels().filter((reel) => reel.id !== reelId);
  saveStoredReels([newReel, ...current]);
  return newReel;
}

/**
 * Toggle like for a reel in Firestore & notify author
 */
export async function toggleLikeReel(
  reelId: string, currentUid: string, hasLiked: boolean, authorId?: string, actor?: User
): Promise<void> {
  if (!currentUid) throw new Error('Sign in before liking a reel.');
  const reelRef = doc(db, REELS_COLLECTION, reelId);
  const didLike = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reelRef);
    if (!snapshot.exists()) throw new Error('This reel no longer exists.');
    const likedBy: string[] = Array.isArray(snapshot.data().likedBy) ? snapshot.data().likedBy : [];
    const desired = !hasLiked;
    const alreadyLiked = likedBy.includes(currentUid);
    if (alreadyLiked === desired) return false;
    const next = desired ? [...likedBy, currentUid] : likedBy.filter((id) => id !== currentUid);
    transaction.update(reelRef, { likedBy: next, likesCount: next.length });
    return desired;
  });
  if (didLike && authorId && actor && authorId !== currentUid) {
    await createNotification(authorId, actor, 'like', 'liked your reel', reelId)
      .catch((error) => console.warn('Reel like saved, but its notification could not be delivered:', error));
  }
}
export async function toggleBookmarkReel(
  reelId: string, currentUid: string, isSaved: boolean
): Promise<void> {
  if (!currentUid) throw new Error('Sign in before saving a reel.');
  const reelRef = doc(db, REELS_COLLECTION, reelId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reelRef);
    if (!snapshot.exists()) throw new Error('This reel no longer exists.');
    const bookmarkedBy: string[] = Array.isArray(snapshot.data().bookmarkedBy) ? snapshot.data().bookmarkedBy : [];
    const desired = !isSaved;
    const alreadySaved = bookmarkedBy.includes(currentUid);
    if (alreadySaved === desired) return;
    const next = desired ? [...bookmarkedBy, currentUid] : bookmarkedBy.filter((id) => id !== currentUid);
    transaction.update(reelRef, { bookmarkedBy: next, bookmarksCount: next.length });
  });
}

export async function addCommentToReel(
  reelId: string, author: User, content: string, targetAuthorId?: string
): Promise<void> {
  const cleanContent = content.trim();
  if (!cleanContent || cleanContent.length > 2000) throw new Error('Comments must be between 1 and 2,000 characters.');
  const updateComment = httpsCallable<
    { collectionName: 'reels'; contentId: string; action: 'add'; content: string },
    { success: boolean; commentId: string }
  >(functions, 'updateContentComment');
  await updateComment({ collectionName: 'reels', contentId: reelId, action: 'add', content: cleanContent });
  if (targetAuthorId && targetAuthorId !== author.id) {
    await createNotification(targetAuthorId, author, 'comment', `commented: "${cleanContent.slice(0, 30)}..."`, reelId);
  }
}

export async function incrementReelShareCount(reelId: string): Promise<void> {
  if (!reelId) return;
  if (!auth.currentUser) throw new Error('Sign in to share a reel.');
  const record = httpsCallable<{ collectionName: 'reels'; contentId: string }, { success: boolean; recorded: boolean; sharesCount: number }>(
    functions, 'recordContentShare'
  );
  await record({ collectionName: 'reels', contentId: reelId });
}

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
