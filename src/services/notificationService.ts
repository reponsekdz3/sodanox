import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Unsubscribe,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { NotificationItem, User } from '../types';

const NOTIFICATIONS_COLLECTION = 'notifications';
const LOCAL_NOTIF_PREFIX = 'aura_cached_notifs_';

function getLocalNotifications(uid: string): NotificationItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_NOTIF_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalNotifications(uid: string, items: NotificationItem[]): void {
  try {
    localStorage.setItem(`${LOCAL_NOTIF_PREFIX}${uid}`, JSON.stringify(items));
  } catch {
    // Quota safe
  }
}

/**
 * Subscribe to real-time notifications for the current user
 * Resilient to Firestore composite index & unauthenticated states
 */
export function subscribeToNotifications(
  currentUid: string,
  onUpdate: (notifications: NotificationItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user' || currentUid === 'user_fallback') {
    return () => {};
  }

  // Broadcast cached notifications immediately
  const cached = getLocalNotifications(currentUid);
  if (cached.length > 0) {
    onUpdate(cached);
  }

  try {
    const notifRef = collection(db, NOTIFICATIONS_COLLECTION);
    // Use single-field where to avoid composite index requirements
    const q = query(
      notifRef,
      where('recipientId', '==', currentUid)
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
            targetId: d.targetId || undefined,
            targetType: d.targetType || 'post',
            actionSnippet: d.actionSnippet || '',
            timestamp: d.timestamp || 'Just now',
            read: d.read ?? false,
            createdAt: d.createdAt,
          });
        });

        // Merge with local fallback notifications
        const currentCached = getLocalNotifications(currentUid);
        for (const loc of currentCached) {
          if (!items.some((i) => i.id === loc.id)) {
            items.push(loc);
          }
        }

        // Sort in memory by time descending
        items.sort((a, b) => {
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        saveLocalNotifications(currentUid, items);
        onUpdate(items);
      },
      (err) => {
        console.warn('Notifications fallback to local cache:', err);
        const fallback = getLocalNotifications(currentUid);
        onUpdate(fallback);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('Notifications subscription setup note:', err);
    onUpdate(getLocalNotifications(currentUid));
    return () => {};
  }
}

/**
 * Create a real notification with local instant cache and Firestore broadcast
 */
export async function createNotification(
  recipientId: string,
  actor: User,
  type: NotificationItem['type'],
  targetTitle?: string,
  targetId?: string,
  targetType: NotificationItem['targetType'] = 'post',
  actionSnippet?: string
): Promise<void> {
  // Avoid sending notifications to oneself
  if (!recipientId || recipientId === actor.id) return;

  const localItem: NotificationItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    recipientId,
    user: actor,
    type,
    targetTitle,
    targetId,
    targetType,
    actionSnippet,
    timestamp: 'Just now',
    read: false,
  };

  // 1. Immediately cache for recipient
  const existing = getLocalNotifications(recipientId);
  saveLocalNotifications(recipientId, [localItem, ...existing]);

  // 2. Persist to Firestore
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
        bio: actor.bio || '',
        followersCount: actor.followersCount || 0,
        followingCount: actor.followingCount || 0,
      },
      type,
      targetId: targetId || null,
      targetType: targetType || 'post',
      targetTitle: targetTitle || null,
      actionSnippet: actionSnippet || null,
      timestamp: 'Just now',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore notification note (saved locally):', err);
  }
}

/**
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead(currentUid: string): Promise<void> {
  // Update local cache
  const existing = getLocalNotifications(currentUid);
  const updated = existing.map((item) => ({ ...item, read: true }));
  saveLocalNotifications(currentUid, updated);

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
    console.warn('Mark all notifications read note:', err);
  }
}

/**
 * Clear/delete all notifications for current user
 */
export async function clearAllNotifications(currentUid: string): Promise<void> {
  // Clear local cache
  saveLocalNotifications(currentUid, []);

  try {
    const notifRef = collection(db, NOTIFICATIONS_COLLECTION);
    const q = query(notifRef, where('recipientId', '==', currentUid));
    const snap = await getDocs(q);

    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
  } catch (err) {
    console.warn('Clear notifications note:', err);
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
    console.warn('Mark notification read note:', err);
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
    console.warn('Delete notification note:', err);
  }
}
