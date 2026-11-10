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
  getDoc,
  runTransaction,
  arrayUnion,
  Unsubscribe,
} from 'firebase/firestore';
import { db, functions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';
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
  const storyDocId = 'story_' + currentUser.id;
  const storyDocRef = doc(db, STORIES_COLLECTION, storyDocId);

  // Cloud persistence is authoritative. A transaction creates the document once
  // and appends later items without rewriting the immutable createdAt field.
  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(storyDocRef);
      if (snapshot.exists()) {
        const existing = snapshot.data();
        if (existing.userId !== currentUser.id) {
          throw new Error('This story belongs to another account.');
        }
        transaction.update(storyDocRef, {
          items: arrayUnion(itemWithTimestamp),
          viewers: arrayUnion(currentUser.id),
          updatedAt: serverTimestamp(),
        });
      } else {
        transaction.set(storyDocRef, {
          id: storyDocId,
          userId: currentUser.id,
          userName: currentUser.name,
          userUsername: currentUser.username,
          userAvatar: isMockOrEmptyAvatar(currentUser.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : currentUser.avatar,
          items: [itemWithTimestamp],
          viewers: [currentUser.id],
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          createdAtMs: Date.now(),
        });
      }
    });
  } catch (err) {
    console.error('Story could not be persisted to Firestore:', err);
    throw err instanceof Error ? err : new Error('Story could not be uploaded to the cloud. Please try again.');
  }

  const currentStories = getStoredStories();
  const existingIndex = currentStories.findIndex((item) => item.userId === currentUser.id);
  if (existingIndex !== -1) {
    const updated = [...currentStories];
    updated[existingIndex] = {
      ...updated[existingIndex],
      items: [...updated[existingIndex].items, itemWithTimestamp],
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
}

/**
 * Update a story item owned by the authenticated user.
 * Only the editor-supported fields are accepted; media and ownership stay immutable.
 */
export async function updateStoryItem(
  storyId: string,
  userId: string,
  itemIndex: number,
  updates: Partial<Pick<StoryItem, 'caption' | 'moodTag' | 'filter' | 'textOverlay'>>
): Promise<StoryItem> {
  if (!storyId || !userId || !Number.isInteger(itemIndex) || itemIndex < 0) {
    throw new Error('A valid story and item are required.');
  }
  const storyRef = doc(db, STORIES_COLLECTION, storyId);
  const snapshot = await getDoc(storyRef);
  if (!snapshot.exists()) throw new Error('This story no longer exists.');
  const data = snapshot.data();
  if (data.userId !== userId) throw new Error('You can only edit your own stories.');
  const items: StoryItem[] = Array.isArray(data.items) ? [...data.items] : [];
  if (!items[itemIndex]) throw new Error('The story item could not be found.');
  const currentItem = items[itemIndex];
  const updatedItem: StoryItem = { ...currentItem };
  const editableFields = ['caption', 'moodTag', 'filter', 'textOverlay'] as const;
  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      const value = updates[field];
      if (value === undefined) delete (updatedItem as any)[field];
      else (updatedItem as any)[field] = value;
    }
  }
  items[itemIndex] = updatedItem;
  await updateDoc(storyRef, { items, updatedAt: serverTimestamp() });
  const cached = getStoredStories();
  saveStoredStories(cached.map((story) => story.id === storyId
    ? { ...story, items: story.items.map((item, index) => index === itemIndex ? updatedItem : item) }
    : story));
  return updatedItem;
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
  const mutate = httpsCallable<{ storyId: string; itemIndex: number; action: 'like' }, { liked: boolean; authorId: string }>(
    functions, 'updateStoryInteraction'
  );
  const response = await mutate({ storyId, itemIndex, action: 'like' });
  const result = response.data;
  if (result.liked && result.authorId && result.authorId !== userId) {
    await createNotification(result.authorId, user, 'like', 'liked your story', storyId);
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
  if (!userId) throw new Error('Sign in to vote in this poll.');
  const mutate = httpsCallable<{ storyId: string; itemIndex: number; action: 'vote_poll'; optionId: string }, { voted: boolean }>(
    functions, 'updateStoryInteraction'
  );
  await mutate({ storyId, itemIndex, action: 'vote_poll', optionId });
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
  const cleanAnswer = answer.trim();
  if (!cleanAnswer) throw new Error('Write an answer before sending.');
  const mutate = httpsCallable<{ storyId: string; itemIndex: number; action: 'answer_question'; answer: string }, { answered: boolean }>(
    functions, 'updateStoryInteraction'
  );
  await mutate({ storyId, itemIndex, action: 'answer_question', answer: cleanAnswer });
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
