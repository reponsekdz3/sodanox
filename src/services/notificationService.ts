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
  writeBatch,
  Unsubscribe,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { NotificationItem, User } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';

const NOTIFICATIONS_COLLECTION = 'notifications';

/**
 * Subscribe to real-time notifications for the current user
 */
export function subscribeToNotifications(
  currentUid: string,
  onUpdate: (notifications: NotificationItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user' || currentUid === 'user_fallback') {
    return () => {};
  }

  const notifRef = collection(db, NOTIFICATIONS_COLLECTION);
  const q = query(
    notifRef,
    where('recipientId', '==', currentUid),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: NotificationItem[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          recipientId: d.recipientId,
          user: d.actor || {
            id: d.actorId || 'someone',
            name: d.actorName || 'Aura Member',
            username: d.actorUsername || 'user',
            avatar:
              d.actorAvatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
            bio: '',
            joinedDate: '',
            followersCount: 0,
            followingCount: 0,
            isFollowing: false,
          },
          type: d.type || 'like',
          targetTitle: d.targetTitle || '',
          timestamp: d.timestamp || 'Just now',
          read: d.read ?? false,
          createdAt: d.createdAt,
        });
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Notifications subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Create a real notification in Firestore
 */
export async function createNotification(
  recipientId: string,
  actor: User,
  type: NotificationItem['type'],
  targetTitle?: string,
  targetId?: string
): Promise<void> {
  // Avoid sending notifications to oneself
  if (!recipientId || recipientId === actor.id) return;

  try {
    const notifRef = collection(db, NOTIFICATIONS_COLLECTION);
    await addDoc(notifRef, {
      recipientId,
      actorId: actor.id,
      actorName: actor.name,
      actorUsername: actor.username,
      actorAvatar: actor.avatar,
      actor: {
        id: actor.id,
        name: actor.name,
        username: actor.username,
        avatar: actor.avatar,
        verified: actor.verified || false,
      },
      type,
      targetId: targetId || null,
      targetTitle: targetTitle || null,
      timestamp: 'Just now',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead(currentUid: string): Promise<void> {
  try {
    const notifRef = collection(db, NOTIFICATIONS_COLLECTION);
    const q = query(notifRef, where('recipientId', '==', currentUid), where('read', '==', false));
    const snap = await getDocs(q);

    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, NOTIFICATIONS_COLLECTION);
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(docRef, { read: true });
  } catch (err) {
    console.error('Error marking notification read:', err);
  }
}

/**
 * Delete a single notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${NOTIFICATIONS_COLLECTION}/${notificationId}`);
  }
}

