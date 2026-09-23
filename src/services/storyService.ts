import {
  collection,
  doc,
  addDoc,
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

const STORIES_COLLECTION = 'stories';
const HIGHLIGHTS_COLLECTION = 'highlights';

/**
 * Real-time subscription to stories from Firestore (user-created only, no mock seeds)
 */
export function subscribeToStories(
  currentUid: string,
  onUpdate: (stories: Story[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!currentUid) {
    onUpdate([]);
    return () => {};
  }

  const storiesRef = collection(db, STORIES_COLLECTION);
  const q = query(storiesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Story[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        const viewers: string[] = d.viewers || [];
        const hasUnseen = !viewers.includes(currentUid);

        list.push({
          id: docSnap.id,
          userId: d.userId,
          userName: d.userName,
          userUsername: d.userUsername,
          userAvatar: d.userAvatar,
          hasUnseen,
          items: d.items || [],
          viewers,
          createdAt: d.createdAt,
        });
      });

      onUpdate(list);
    },
    (err) => {
      console.warn('Stories subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Create or append to a user's story in Firestore
 */
export async function createStoryInFirestore(
  currentUser: User,
  newItem: StoryItem
): Promise<void> {
  try {
    const storiesRef = collection(db, STORIES_COLLECTION);
    const snap = await getDocs(storiesRef);
    const existingStoryDoc = snap.docs.find((d) => d.data().userId === currentUser.id);

    if (existingStoryDoc) {
      await updateDoc(doc(db, STORIES_COLLECTION, existingStoryDoc.id), {
        items: arrayUnion(newItem),
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(storiesRef, {
        userId: currentUser.id,
        userName: currentUser.name,
        userUsername: currentUser.username,
        userAvatar: currentUser.avatar,
        items: [newItem],
        viewers: [currentUser.id],
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, STORIES_COLLECTION);
  }
}

/**
 * Record a story view for the current user
 */
export async function recordStoryView(storyId: string, currentUid: string): Promise<void> {
  if (!currentUid || !storyId) return;
  try {
    const storyRef = doc(db, STORIES_COLLECTION, storyId);
    await updateDoc(storyRef, {
      viewers: arrayUnion(currentUid),
    });
  } catch (err) {
    console.warn('Error recording story view:', err);
  }
}

/**
 * Delete a story document
 */
export async function deleteStory(storyId: string): Promise<void> {
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
