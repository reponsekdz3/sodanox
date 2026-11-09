import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  arrayUnion,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Story, StoryItem, User, StoryHighlight } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { createNotification } from './notificationService';
import { isMockArtifact } from './postService';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

const STORIES_COLLECTION = 'stories';
const HIGHLIGHTS_COLLECTION = 'highlights';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const LOCAL_STORIES_CACHE_KEY = 'aura_community_stories_cache';

/**
 * Check if a story item was created within the last 24 hours
 */
export function isStoryItemActive(item: StoryItem, fallbackTimestampMs?: number): boolean {
  const now = Date.now();
  const created = item.createdAtMs || fallbackTimestampMs || now;
  return now - created < TWENTY_FOUR_HOURS_MS;
}

export function getStoredStories(): Story[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORIES_CACHE_KEY);
    if (!raw) return [];
    const parsed: Story[] = JSON.parse(raw);
    const now = Date.now();
    return Array.isArray(parsed)
      ? parsed
          .map((s) => ({
            ...s,
            items: (s.items || []).filter((item) => isStoryItemActive(item)),
          }))
          .filter((s) => s.items && s.items.length > 0 && !isMockArtifact(s.userId, s.userUsername))
      : [];
  } catch {
    return [];
  }
}

export function saveStoredStories(stories: Story[]) {
  try {
    const active = stories.filter((s) => s && s.items && s.items.length > 0 && !isMockArtifact(s.userId, s.userUsername));
    localStorage.setItem(LOCAL_STORIES_CACHE_KEY, JSON.stringify(active));
  } catch {
    // Local storage quota safe
  }
}

/**
 * Real-time subscription to stories from Firestore with persistent local cache merge.
 */
export function subscribeToStories(
  currentUid: string,
  onUpdate: (stories: Story[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  // 1. Instantly emit cached stories for immediate UI display
  const initialCached = getStoredStories();
  if (initialCached.length > 0) {
    onUpdate(initialCached);
  }

  if (!currentUid) {
    return () => {};
  }

  const storiesRef = collection(db, STORIES_COLLECTION);

  return onSnapshot(
    storiesRef,
    (snapshot) => {
      const firestoreStories: Story[] = [];
      const now = Date.now();

      snapshot.forEach((docSnap) => {
        const d = docSnap.data();

        // Purge mock/seed stories
        if (
          isMockArtifact(d.userId, d.userUsername) ||
          docSnap.id.startsWith('demo_') ||
          docSnap.id.startsWith('starter_')
        ) {
          return;
        }

        const docCreatedAtMs = d.createdAt?.toMillis
          ? d.createdAt.toMillis()
          : d.createdAtMs || now;

        // STRICT 24-HOUR LIFESPAN ENFORCEMENT
        const rawItems: StoryItem[] = d.items || [];
        const activeItems = rawItems.filter((item) => {
          const itemTime = item.createdAtMs || docCreatedAtMs;
          return now - itemTime < TWENTY_FOUR_HOURS_MS;
        });

        if (activeItems.length === 0) {
          return;
        }

        const viewers: string[] = d.viewers || [];
        const hasUnseen = !viewers.includes(currentUid);

        firestoreStories.push({
          id: docSnap.id,
          userId: d.userId,
          userName: d.userName,
          userUsername: d.userUsername,
          userAvatar: isMockOrEmptyAvatar(d.userAvatar) ? MODERN_EMPTY_AVATAR_DATA_URI : d.userAvatar,
          hasUnseen,
          items: activeItems,
          viewers,
          createdAt: d.createdAt,
        });
      });

      // Merge Firestore stories with local cached stories (keeping fresh items)
      const cached = getStoredStories();
      const firestoreUserIds = new Set(firestoreStories.map((s) => s.userId));
      const localOnly = cached.filter((s) => !firestoreUserIds.has(s.userId));

      const merged = [...firestoreStories, ...localOnly];

      // Sort client-side so stories with fresh items appear first
      merged.sort((a, b) => {
        const timeA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : Date.now();
        const timeB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });

      saveStoredStories(merged);
      onUpdate(merged);
    },
    (err) => {
      console.warn('Stories subscription notice (using local cached stories):', err);
      const fallback = getStoredStories();
      if (fallback.length > 0) {
        onUpdate(fallback);
      }
      if (onError) onError(err);
    }
  );
}

/**
 * Create or append to a user's story in Firestore and local cache
 */
export async function createStoryInFirestore(
  currentUser: User,
  newItem: StoryItem
): Promise<void> {
  const itemWithTimestamp: StoryItem = {
    ...newItem,
    createdAtMs: newItem.createdAtMs || Date.now(),
  };

  const storyDocId = `story_${currentUser.id}`;

  // 1. Immediately update local persistent cache so story NEVER disappears on refresh
  const currentStories = getStoredStories();
  const existingIndex = currentStories.findIndex((s) => s.userId === currentUser.id);

  if (existingIndex !== -1) {
    const updated = [...currentStories];
    updated[existingIndex] = {
      ...updated[existingIndex],
      items: [...updated[existingIndex].items, itemWithTimestamp],
      createdAt: { toMillis: () => Date.now() } as any,
    };
    saveStoredStories(updated);
  } else {
    const newStory: Story = {
      id: storyDocId,
      userId: currentUser.id,
      userName: currentUser.name,
      userUsername: currentUser.username,
      userAvatar: isMockOrEmptyAvatar(currentUser.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : currentUser.avatar,
      hasUnseen: false,
      items: [itemWithTimestamp],
      viewers: [currentUser.id],
      createdAt: { toMillis: () => Date.now() } as any,
    };
    saveStoredStories([newStory, ...currentStories]);
  }

  // 2. Persist to Firestore
  try {
    const storyDocRef = doc(db, STORIES_COLLECTION, storyDocId);
    await setDoc(
      storyDocRef,
      {
        id: storyDocId,
        userId: currentUser.id,
        userName: currentUser.name,
        userUsername: currentUser.username,
        userAvatar: isMockOrEmptyAvatar(currentUser.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : currentUser.avatar,
        items: arrayUnion(itemWithTimestamp),
        viewers: arrayUnion(currentUser.id),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore story sync notice (stored safely in local persistent cache):', err);
  }
}

/**
 * Record a story view for the current user with detailed viewer info
 */
export async function recordStoryView(
  storyId: string,
  currentUid: string,
  viewerUser?: User
): Promise<void> {
  if (!currentUid || !storyId) return;
  try {
    const storyRef = doc(db, STORIES_COLLECTION, storyId);
    const updates: Record<string, any> = {
      viewers: arrayUnion(currentUid),
    };
    if (viewerUser) {
      updates.viewersList = arrayUnion({
        userId: viewerUser.id,
        userName: viewerUser.name,
        userAvatar: viewerUser.avatar || '',
        viewedAt: 'Just now',
      });
    }
    await updateDoc(storyRef, updates);
  } catch (err) {
    console.warn('Error recording story view:', err);
  }
}

/**
 * Toggle like for a story item in Firestore
 */
export async function toggleLikeStory(
  storyId: string,
  itemIndex: number,
  userId: string,
  user: User
): Promise<void> {
  try {
    const storyRef = doc(db, STORIES_COLLECTION, storyId);
    const snap = await getDocs(query(collection(db, STORIES_COLLECTION)));
    const docSnap = snap.docs.find((d) => d.id === storyId);
    if (!docSnap) return;

    const data = docSnap.data();
    const items = [...(data.items || [])];
    if (!items[itemIndex]) return;

    const item = { ...items[itemIndex] };
    const likedBy: string[] = item.likedBy || [];
    const hasLiked = likedBy.includes(userId);

    const updatedLikedBy = hasLiked
      ? likedBy.filter((id) => id !== userId)
      : [...likedBy, userId];

    item.likedBy = updatedLikedBy;
    item.likesCount = updatedLikedBy.length;
    items[itemIndex] = item;

    await updateDoc(storyRef, { items });

    // Notify story author if not self and liked
    if (!hasLiked && data.userId && data.userId !== userId) {
      await createNotification(data.userId, user, 'like', 'liked your story', storyId);
    }
  } catch (err) {
    console.warn('Error toggling story like:', err);
  }
}

/**
 * Delete a story document
 */
export async function deleteStory(storyId: string): Promise<void> {
  const current = getStoredStories().filter((s) => s.id !== storyId && `story_${s.userId}` !== storyId);
  saveStoredStories(current);
  try {
    const storyRef = doc(db, STORIES_COLLECTION, storyId);
    await deleteDoc(storyRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${STORIES_COLLECTION}/${storyId}`);
  }
}

/**
 * Vote on a Story Poll sticker
 */
export async function voteStoryPoll(
  storyId: string,
  itemIndex: number,
  optionId: string,
  userId: string
): Promise<void> {
  try {
    const storyRef = doc(db, STORIES_COLLECTION, storyId);
    const snap = await getDocs(query(collection(db, STORIES_COLLECTION)));
    const docSnap = snap.docs.find((d) => d.id === storyId);
    if (!docSnap) return;

    const data = docSnap.data();
    const items = [...(data.items || [])];
    if (!items[itemIndex]) return;

    const item = { ...items[itemIndex] };
    const stickers = [...(item.stickers || [])];
    const pollIndex = stickers.findIndex((s) => s.type === 'poll');

    if (pollIndex !== -1) {
      const pollSticker = { ...stickers[pollIndex] };
      const pollData = { ...pollSticker.data };
      const currentVotes: Record<string, string> = pollData.userVotes || {};

      if (currentVotes[userId] === optionId) return; // already voted same

      currentVotes[userId] = optionId;
      pollData.userVotes = currentVotes;

      if (pollData.options) {
        pollData.options = pollData.options.map((opt: { id: string; text: string; votes: number }) => {
          const count = Object.values(currentVotes).filter((v) => v === opt.id).length;
          return { ...opt, votes: count };
        });
      }

      pollSticker.data = pollData;
      stickers[pollIndex] = pollSticker;
      item.stickers = stickers;
      items[itemIndex] = item;

      await updateDoc(storyRef, { items });
    }
  } catch (err) {
    console.warn('Error voting on story poll:', err);
  }
}

/**
 * Answer a Story Question sticker
 */
export async function answerStoryQuestion(
  storyId: string,
  itemIndex: number,
  answer: string,
  user: User
): Promise<void> {
  try {
    const storyRef = doc(db, STORIES_COLLECTION, storyId);
    const snap = await getDocs(query(collection(db, STORIES_COLLECTION)));
    const docSnap = snap.docs.find((d) => d.id === storyId);
    if (!docSnap) return;

    const data = docSnap.data();
    const items = [...(data.items || [])];
    if (!items[itemIndex]) return;

    const item = { ...items[itemIndex] };
    const stickers = [...(item.stickers || [])];
    const questionIndex = stickers.findIndex((s) => s.type === 'question');

    if (questionIndex !== -1) {
      const qSticker = { ...stickers[questionIndex] };
      const qData = { ...qSticker.data };
      const answers = qData.answers || [];

      answers.push({
        userId: user.id,
        userName: user.name,
        userAvatar: user.avatar,
        answer: answer.trim(),
        timestamp: 'Just now',
      });

      qData.answers = answers;
      qSticker.data = qData;
      stickers[questionIndex] = qSticker;
      item.stickers = stickers;
      items[itemIndex] = item;

      await updateDoc(storyRef, { items });
    }
  } catch (err) {
    console.warn('Error answering story question:', err);
  }
}

/**
 * Highlights: Create a Story Highlight
 */
export async function createStoryHighlight(
  userId: string,
  title: string,
  coverUrl: string,
  items: StoryItem[]
): Promise<string> {
  try {
    const highlightsRef = collection(db, HIGHLIGHTS_COLLECTION);
    const docRef = await addDoc(highlightsRef, {
      userId,
      title: title.trim(),
      coverUrl,
      items,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, HIGHLIGHTS_COLLECTION);
    throw err;
  }
}

/**
 * Highlights: Subscribe to a user's Highlights
 */
export function subscribeToUserHighlights(
  userId: string,
  onUpdate: (highlights: StoryHighlight[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const highlightsRef = collection(db, HIGHLIGHTS_COLLECTION);
  const q = query(highlightsRef, where('userId', '==', userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: StoryHighlight[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          userId: d.userId,
          title: d.title,
          coverUrl: d.coverUrl,
          items: d.items || [],
          createdAt: d.createdAt,
        });
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Highlights subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Delete a Story Highlight
 */
export async function deleteStoryHighlight(highlightId: string): Promise<void> {
  try {
    const ref = doc(db, HIGHLIGHTS_COLLECTION, highlightId);
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${HIGHLIGHTS_COLLECTION}/${highlightId}`);
  }
}
