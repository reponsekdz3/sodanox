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

const REELS_COLLECTION = 'reels';

export const INITIAL_CREATOR_REELS: Omit<Reel, 'id'>[] = [
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
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-potter-molding-clay-on-a-potters-wheel-42220-large.mp4',
    posterUrl: '/src/assets/images/post_ceramic_art_1790174946314.jpg',
    caption: 'Centering 3kg of iron stoneware. Breath syncs with the wheel revolutions. Watch the collar pull up.',
    tags: ['PotteryProcess', 'SlowCraft', 'StudioSound', 'Ceramics'],
    audioTrack: {
      title: 'Water & Wet Clay',
      artist: 'Studio Ambience',
    },
    likesCount: 1240,
    hasLiked: false,
    commentsCount: 48,
    comments: [
      {
        id: 'rc1',
        author: {
          id: 'creator_marcus_lind',
          name: 'Marcus Lind',
          username: 'marcuslind',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          bio: 'Product designer',
          joinedDate: 'Jan 2024',
          followersCount: 8930,
          followingCount: 310,
          isFollowing: true,
          verified: true,
        },
        content: 'The rhythmic pressure on the third pull is pure mastery.',
        timestamp: '1h ago',
        likesCount: 19,
        hasLiked: false,
      },
    ],
    sharesCount: 182,
    isSaved: false,
  },
  {
    author: {
      id: 'creator_soren_moller',
      name: 'Søren Møller',
      username: 'soren.studio',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
      bio: 'Slow coffee roaster & editorial sound archivist.',
      joinedDate: 'Joined August 2024',
      followersCount: 5610,
      followingCount: 198,
      isFollowing: false,
      verified: false,
    },
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-making-drip-coffee-in-a-glass-pot-41907-large.mp4',
    posterUrl: '/src/assets/images/reel_coffee_craft_1790174957454.jpg',
    caption: 'Morning 45-second bloom with washed Yirgacheffe. 93°C water, gentle circular concentric pours.',
    tags: ['PouroverCoffee', 'MorningRitual', 'SpecialtyCoffee', 'SlowLiving'],
    audioTrack: {
      title: 'Gentle Pour & Quiet Morning',
      artist: 'Aura Acoustic Series',
    },
    likesCount: 890,
    hasLiked: false,
    commentsCount: 32,
    comments: [],
    sharesCount: 94,
    isSaved: false,
  },
  {
    author: {
      id: 'creator_marcus_lind',
      name: 'Marcus Lind',
      username: 'marcuslind',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      bio: 'Product designer & spatial acoustic engineer.',
      joinedDate: 'Joined Jan 2024',
      followersCount: 8930,
      followingCount: 310,
      isFollowing: true,
      verified: true,
    },
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-top-aerial-shot-of-seashore-with-rocks-and-waves-42171-large.mp4',
    posterUrl: '/src/assets/images/post_scenic_nordic_1790174933983.jpg',
    caption: 'Wind patterns carving across coastal stones at dusk. Natural reverberation testing for our upcoming sound install.',
    tags: ['NordicNature', 'AcousticEcology', 'FieldRecording', 'Scandinavia'],
    audioTrack: {
      title: 'Coastline Winds',
      artist: 'Nordic Archives',
    },
    likesCount: 2150,
    hasLiked: false,
    commentsCount: 76,
    comments: [],
    sharesCount: 310,
    isSaved: false,
  },
];

/**
 * Real-time subscription to reels from Firestore
 */
export function subscribeToReels(
  currentUid: string,
  onUpdate: (reels: Reel[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const reelsRef = collection(db, REELS_COLLECTION);
  const q = query(reelsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Reel[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
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
