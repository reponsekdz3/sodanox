import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp,
  updateDoc, where, writeBatch, Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { NotificationItem, User } from '../types';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

const NOTIFICATIONS_COLLECTION = 'notifications';
const LOCAL_NOTIF_PREFIX = 'aura_cached_notifs_';

function getLocalNotifications(uid: string): NotificationItem[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_NOTIF_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) as NotificationItem[] : [];
  } catch {
    return [];
  }
}

function saveLocalNotifications(uid: string, items: NotificationItem[]): void {
  try { localStorage.setItem(`${LOCAL_NOTIF_PREFIX}${uid}`, JSON.stringify(items)); }
  catch (error) { console.warn('Notification cache could not be updated:', error); }
}

function mapNotification(id: string, data: Record<string, any>): NotificationItem {
  const actor = data.actor || {
    id: data.actorId || 'unknown',
    name: data.actorName || 'Member',
    username: data.actorUsername || 'member',
    avatar: data.actorAvatar || MODERN_EMPTY_AVATAR_DATA_URI,
    bio: '', joinedDate: '', followersCount: 0, followingCount: 0, isFollowing: false,
  };
  return {
    id,
    recipientId: data.recipientId,
    user: { ...actor, avatar: isMockOrEmptyAvatar(actor.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : actor.avatar },
    type: data.type || 'like',
    targetTitle: data.targetTitle || '',
    targetId: data.targetId || undefined,
    targetType: data.targetType || 'post',
    actionSnippet: data.actionSnippet || '',
    timestamp: data.timestamp || 'Just now',
    read: data.read === true,
    createdAt: data.createdAt,
  } as NotificationItem;
}

function updateLocal(uid: string, updater: (items: NotificationItem[]) => NotificationItem[]): void {
  saveLocalNotifications(uid, updater(getLocalNotifications(uid)));
}

/** Live subscription. Firestore is authoritative; localStorage is an offline read fallback only. */
export function subscribeToNotifications(
  currentUid: string,
  onUpdate: (notifications: NotificationItem[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user' || currentUid === 'user_fallback') return () => {};
  const cached = getLocalNotifications(currentUid);
  if (cached.length) onUpdate(cached);
  const q = query(collection(db, NOTIFICATIONS_COLLECTION), where('recipientId', '==', currentUid));
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((item) => mapNotification(item.id, item.data()));
    notifications.sort((a, b) => {
      const first = a.createdAt?.seconds || 0;
      const second = b.createdAt?.seconds || 0;
      return second - first;
    });
    saveLocalNotifications(currentUid, notifications);
    onUpdate(notifications);
  }, (error) => {
    console.error('Notifications could not be synchronized; showing cached records:', error);
    onUpdate(getLocalNotifications(currentUid));
    onError?.(error);
  });
}

/** Persist notification first; only then mirror the confirmed record into the local cache. */
export async function createNotification(
  recipientId: string,
  actor: User,
  type: NotificationItem['type'],
  targetTitle?: string,
  targetId?: string,
  targetType: NotificationItem['targetType'] = 'post',
  actionSnippet?: string
): Promise<void> {
  if (!recipientId || recipientId === actor.id) return;
  const payload = {
    recipientId,
    actorId: actor.id, actorName: actor.name, actorUsername: actor.username, actorAvatar: actor.avatar,
    actor: {
      id: actor.id, name: actor.name, username: actor.username, avatar: actor.avatar,
      verified: actor.verified || false, bio: actor.bio || '',
      followersCount: actor.followersCount || 0, followingCount: actor.followingCount || 0,
    },
    type, targetId: targetId || null, targetType: targetType || 'post',
    targetTitle: targetTitle || null, actionSnippet: actionSnippet || null,
    timestamp: 'Just now', read: false, createdAt: serverTimestamp(),
  };
  const created = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), payload);
  const local = mapNotification(created.id, { ...payload, createdAt: { seconds: Math.floor(Date.now() / 1000) } });
  updateLocal(recipientId, (items) => [local, ...items.filter((item) => item.id !== created.id)]);
}

/** Mark unread notifications as read in bounded batches before changing the local cache. */
export async function markAllNotificationsAsRead(currentUid: string): Promise<void> {
  if (!currentUid) throw new Error('A signed-in user is required.');
  const q = query(collection(db, NOTIFICATIONS_COLLECTION), where('recipientId', '==', currentUid), where('read', '==', false));
  const snapshot = await getDocs(q);
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = writeBatch(db);
    snapshot.docs.slice(index, index + 450).forEach((item) => batch.update(item.ref, { read: true }));
    await batch.commit();
  }
  updateLocal(currentUid, (items) => items.map((item) => ({ ...item, read: true })));
}

/** Delete all notifications from the server in bounded batches, then clear the local cache. */
export async function clearAllNotifications(currentUid: string): Promise<void> {
  if (!currentUid) throw new Error('A signed-in user is required.');
  const q = query(collection(db, NOTIFICATIONS_COLLECTION), where('recipientId', '==', currentUid));
  const snapshot = await getDocs(q);
  for (let index = 0; index < snapshot.docs.length; index += 450) {
    const batch = writeBatch(db);
    snapshot.docs.slice(index, index + 450).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
  saveLocalNotifications(currentUid, []);
}

export async function markNotificationAsRead(notificationId: string, currentUid: string): Promise<void> {
  if (!notificationId || !currentUid) throw new Error('A notification and signed-in user are required.');
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), { read: true });
  updateLocal(currentUid, (items) => items.map((item) => item.id === notificationId ? { ...item, read: true } : item));
}

export async function deleteNotification(notificationId: string, currentUid: string): Promise<void> {
  if (!notificationId || !currentUid) throw new Error('A notification and signed-in user are required.');
  await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
  updateLocal(currentUid, (items) => items.filter((item) => item.id !== notificationId));
}
