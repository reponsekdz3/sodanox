import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDoc,
  getDocs,
  writeBatch,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ChatConversation, Message, MessageReplyInfo, User } from '../types';

const LOCAL_CONVS_KEY = 'aura_chat_conversations';
const LOCAL_MSGS_PREFIX = 'aura_chat_msgs_';

export function getDeterministicConvId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
}

// -------------------------------------------------------------
// Local Storage Persistence Helpers
// -------------------------------------------------------------

function getStoredConversations(): ChatConversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONVS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredConversations(convs: ChatConversation[]) {
  try {
    localStorage.setItem(LOCAL_CONVS_KEY, JSON.stringify(convs));
  } catch {
    // LocalStorage quota safety
  }
}

function getNormalizedMillis(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') {
    return val < 1e11 ? val * 1000 : val;
  }
  if (typeof val?.toMillis === 'function') {
    return val.toMillis();
  }
  if (typeof val?.seconds === 'number') {
    return val.seconds * 1000;
  }
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

export function getStoredMessages(conversationId: string): Message[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_MSGS_PREFIX}${conversationId}`);
    const msgs: Message[] = raw ? JSON.parse(raw) : [];
    // Sanitize any legacy canned/fallback responses
    const filtered = msgs.filter(
      (m) =>
        !m.text?.includes('valenshagabimana') &&
        !m.text?.includes('architectural layouts here in Kigali')
    );
    if (filtered.length !== msgs.length) {
      setStoredMessages(conversationId, filtered);
    }
    return filtered;
  } catch {
    return [];
  }
}

function setStoredMessages(conversationId: string, messages: Message[]) {
  try {
    localStorage.setItem(`${LOCAL_MSGS_PREFIX}${conversationId}`, JSON.stringify(messages));
  } catch {
    // LocalStorage quota safety
  }
}

function notifyConversationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('aura_chat_convs_updated'));
  }
}

function notifyMessagesChanged(conversationId: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('aura_chat_msgs_updated', { detail: { conversationId } })
    );
  }
}

// -------------------------------------------------------------
// Core Chat Operations
// -------------------------------------------------------------

/**
 * Creates or retrieves a conversation between two users
 * Ensures instant local availability + Firestore sync
 */
export async function getOrCreateConversation(
  currentUser: User,
  targetUser: User
): Promise<string> {
  const convId = getDeterministicConvId(currentUser.id, targetUser.id);
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const convObject: ChatConversation = {
    id: convId,
    participant: {
      ...targetUser,
      isFollowing: targetUser.isFollowing || false,
    },
    lastMessage: {
      id: `init_${Date.now()}`,
      senderId: currentUser.id,
      timestamp: timeFormatted,
      type: 'text',
      text: 'Conversation started',
      status: 'read',
    },
    unreadCount: 0,
    isOnline: true,
    isTyping: false,
    messages: getStoredMessages(convId),
  };

  // 1. Update local cache immediately
  const existingConvs = getStoredConversations();
  const existingIndex = existingConvs.findIndex((c) => c.id === convId);
  if (existingIndex >= 0) {
    existingConvs[existingIndex] = {
      ...existingConvs[existingIndex],
      participant: convObject.participant,
    };
  } else {
    existingConvs.unshift(convObject);
  }
  setStoredConversations(existingConvs);
  notifyConversationsChanged();

  // 2. Sync to Firestore with merge: true so it never throws
  try {
    const convRef = doc(db, 'conversations', convId);
    await setDoc(
      convRef,
      {
        id: convId,
        participantIds: [currentUser.id, targetUser.id],
        participants: {
          [currentUser.id]: {
            id: currentUser.id,
            name: currentUser.name,
            username: currentUser.username,
            avatar: currentUser.avatar,
            verified: currentUser.verified || false,
          },
          [targetUser.id]: {
            id: targetUser.id,
            name: targetUser.name,
            username: targetUser.username,
            avatar: targetUser.avatar,
            verified: targetUser.verified || false,
          },
        },
        lastMessage: {
          id: `init_${Date.now()}`,
          senderId: currentUser.id,
          timestamp: timeFormatted,
          type: 'text',
          text: 'Conversation started',
          status: 'read',
        },
        unreadCounts: {
          [currentUser.id]: 0,
          [targetUser.id]: 0,
        },
        typing: {
          [currentUser.id]: false,
          [targetUser.id]: false,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore getOrCreateConversation note (persisted locally):', err);
  }

  return convId;
}

/**
 * Real-time subscription to all conversations for current user
 * Merges local persistent state with Firestore onSnapshot
 */
export function subscribeToUserConversations(
  currentUid: string,
  onUpdate: (conversations: ChatConversation[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user') {
    return () => {};
  }

  // 1. Instantly deliver cached conversations
  const deliverLocal = () => {
    const allStored = getStoredConversations();
    // Filter to conversations that belong to current user
    const userConvs = allStored.filter(
      (c) => c.participant?.id !== currentUid
    );
    if (userConvs.length > 0) {
      onUpdate(userConvs);
    }
  };

  deliverLocal();

  // 2. Listen to local conversation updates (across windows or immediate sends)
  const handleLocalEvent = () => deliverLocal();
  if (typeof window !== 'undefined') {
    window.addEventListener('aura_chat_convs_updated', handleLocalEvent);
  }

  // 3. Attach Firestore real-time listener
  let unsubscribeFirestore = () => {};
  try {
    const convsRef = collection(db, 'conversations');
    const q = query(
      convsRef,
      where('participantIds', 'array-contains', currentUid)
    );

    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const firestoreList: ChatConversation[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const otherParticipantId = (data.participantIds as string[])?.find(
            (id) => id !== currentUid
          );

          const participantObj =
            data.participants?.[otherParticipantId || ''] || {
              id: otherParticipantId || 'unknown',
              name: 'Community Creator',
              username: 'creator',
              avatar:
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
              verified: false,
            };

          const isTyping = Boolean(data.typing?.[otherParticipantId || '']);
          const unreadCount = Number(data.unreadCounts?.[currentUid] || 0);

          firestoreList.push({
            id: docSnap.id,
            participant: {
              ...participantObj,
              isFollowing: false,
              joinedDate: '',
              followersCount: 0,
              followingCount: 0,
              bio: '',
            },
            lastMessage: data.lastMessage || {
              id: 'm_init',
              senderId: '',
              timestamp: '',
              type: 'text',
              text: 'No messages yet',
              status: 'read',
            },
            unreadCount,
            isOnline: true,
            isTyping,
            messages: getStoredMessages(docSnap.id),
          });
        });

        // Merge with local conversations to guarantee unsynced or newly created conversations aren't lost
        const localList = getStoredConversations();
        const mergedMap = new Map<string, ChatConversation>();

        localList.forEach((c) => mergedMap.set(c.id, c));
        firestoreList.forEach((c) => mergedMap.set(c.id, c));

        const merged = Array.from(mergedMap.values());
        setStoredConversations(merged);

        merged.sort((a, b) => {
          const timeA = a.lastMessage?.timestamp || '';
          const timeB = b.lastMessage?.timestamp || '';
          return timeB.localeCompare(timeA);
        });

        onUpdate(merged);
      },
      (err) => {
        console.warn('subscribeToUserConversations snapshot note (using local cache):', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('subscribeToUserConversations setup note:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('aura_chat_convs_updated', handleLocalEvent);
    }
    unsubscribeFirestore();
  };
}

/**
 * Real-time subscription to messages inside a specific conversation
 * Guarantees 0ms local response + Firestore synchronization
 */
export function subscribeToMessages(
  conversationId: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!conversationId) {
    return () => {};
  }

  // 1. Immediately deliver stored messages so UI is never blank
  const deliverStored = () => {
    const stored = getStoredMessages(conversationId);
    onUpdate(stored);
  };

  deliverStored();

  // 2. Listen to local message updates
  const handleLocalMsgEvent = (e: Event) => {
    const custom = e as CustomEvent<{ conversationId?: string }>;
    if (!custom.detail?.conversationId || custom.detail.conversationId === conversationId) {
      deliverStored();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('aura_chat_msgs_updated', handleLocalMsgEvent);
  }

  // 3. Real-time Firestore query (sort client-side to prevent pending timestamp null issues)
  let unsubscribeFirestore = () => {};
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');

    unsubscribeFirestore = onSnapshot(
      messagesRef,
      (snapshot) => {
        const firestoreMsgs: Message[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          firestoreMsgs.push({
            id: docSnap.id,
            senderId: d.senderId,
            senderName: d.senderName,
            senderAvatar: d.senderAvatar,
            timestamp: d.timestamp || 'Just now',
            type: d.type || 'text',
            text: d.text || '',
            file: d.file || undefined,
            voice: d.voice || undefined,
            status: d.status || 'delivered',
            reaction: d.reaction,
            replyTo: d.replyTo || undefined,
            readAt: d.readAt,
            createdAt: d.createdAt,
          });
        });

        // Merge with local messages
        const localMsgs = getStoredMessages(conversationId);
        const map = new Map<string, Message>();

        localMsgs.forEach((m) => map.set(m.id, m));
        firestoreMsgs.forEach((m) => map.set(m.id, m));

        const merged = Array.from(map.values());

        // Sort chronologically using normalized millisecond timestamps
        merged.sort((a, b) => {
          const tA = getNormalizedMillis(a.createdAt);
          const tB = getNormalizedMillis(b.createdAt);
          if (tA && tB && tA !== tB) return tA - tB;
          return (a.timestamp || '').localeCompare(b.timestamp || '');
        });

        setStoredMessages(conversationId, merged);
        onUpdate(merged);
      },
      (err) => {
        console.warn('subscribeToMessages snapshot note (showing local messages):', err);
        if (onError) onError(err);
      }
    );
  } catch (err) {
    console.warn('subscribeToMessages setup note:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('aura_chat_msgs_updated', handleLocalMsgEvent);
    }
    unsubscribeFirestore();
  };
}

/**
 * Send a message with instant local persistence and Firestore sync
 */
export async function sendChatMessage(
  conversationId: string,
  messageData: Partial<Message>,
  currentUser: User,
  recipientId: string,
  replyTo?: MessageReplyInfo
): Promise<string> {
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const lastMessageSnippet =
    messageData.type === 'voice'
      ? '🎙️ Voice note'
      : messageData.type === 'file'
      ? `📎 ${messageData.file?.name || 'File'}`
      : messageData.type === 'image'
      ? '📷 Photo'
      : messageData.text || '';

  const fullMessage: Message = {
    id: messageId,
    senderId: currentUser.id,
    senderName: currentUser.name,
    senderAvatar: currentUser.avatar,
    timestamp: timeFormatted,
    type: messageData.type || 'text',
    text: messageData.text || '',
    status: 'sent',
    file: messageData.file,
    voice: messageData.voice,
    replyTo: replyTo
      ? {
          id: replyTo.id,
          senderId: replyTo.senderId,
          senderName: replyTo.senderName || 'Sender',
          text: replyTo.text || '',
          type: replyTo.type || 'text',
        }
      : undefined,
    createdAt: Date.now(),
  };

  // 1. Store locally first (0ms latency, guaranteed visibility)
  const currentMessages = getStoredMessages(conversationId);
  currentMessages.push(fullMessage);
  setStoredMessages(conversationId, currentMessages);

  // 2. Update local conversation record
  const currentConvs = getStoredConversations();
  const convIdx = currentConvs.findIndex((c) => c.id === conversationId);
  if (convIdx >= 0) {
    currentConvs[convIdx] = {
      ...currentConvs[convIdx],
      lastMessage: {
        id: messageId,
        senderId: currentUser.id,
        timestamp: timeFormatted,
        type: messageData.type || 'text',
        text: lastMessageSnippet,
        status: 'sent',
      },
      unreadCount: 0,
    };
    // Move to front
    const updated = currentConvs.splice(convIdx, 1)[0];
    currentConvs.unshift(updated);
  }
  setStoredConversations(currentConvs);

  // Notify active listeners
  notifyMessagesChanged(conversationId);
  notifyConversationsChanged();

  // 3. Sync to Firestore in background
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const msgDocRef = doc(messagesRef, messageId);
    const convRef = doc(db, 'conversations', conversationId);

    const payload: any = {
      id: messageId,
      conversationId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      timestamp: timeFormatted,
      type: messageData.type || 'text',
      text: messageData.text || '',
      status: 'sent',
      createdAt: serverTimestamp(),
    };

    if (messageData.file) payload.file = messageData.file;
    if (messageData.voice) payload.voice = messageData.voice;
    if (fullMessage.replyTo) payload.replyTo = fullMessage.replyTo;

    await setDoc(msgDocRef, payload);

    await setDoc(
      convRef,
      {
        id: conversationId,
        participantIds: [currentUser.id, recipientId],
        lastMessage: {
          id: messageId,
          senderId: currentUser.id,
          timestamp: timeFormatted,
          type: messageData.type || 'text',
          text: lastMessageSnippet,
          status: 'sent',
        },
        updatedAt: serverTimestamp(),
        [`unreadCounts.${recipientId}`]: increment(1),
        [`typing.${currentUser.id}`]: false,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('sendChatMessage Firestore sync note (saved locally):', err);
  }

  return messageId;
}

/**
 * Mark all incoming messages in a conversation as read
 */
export async function markConversationAsRead(
  conversationId: string,
  currentUid: string
): Promise<void> {
  if (!conversationId || !currentUid) return;

  // Local reset
  const convs = getStoredConversations();
  const target = convs.find((c) => c.id === conversationId);
  if (target) {
    target.unreadCount = 0;
    setStoredConversations(convs);
    notifyConversationsChanged();
  }

  try {
    const convRef = doc(db, 'conversations', conversationId);
    await setDoc(
      convRef,
      {
        [`unreadCounts.${currentUid}`]: 0,
      },
      { merge: true }
    );

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const unreadQuery = query(
      messagesRef,
      where('senderId', '!=', currentUid)
    );
    const snap = await getDocs(unreadQuery);

    if (!snap.empty) {
      const batch = writeBatch(db);
      let needsCommit = false;
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== 'read') {
          batch.update(docSnap.ref, {
            status: 'read',
            readAt: serverTimestamp(),
          });
          needsCommit = true;
        }
      });
      if (needsCommit) {
        await batch.commit();
      }
    }
  } catch (err) {
    // Non-fatal
  }
}

/**
 * Update real-time typing indicator
 */
export async function setTypingIndicator(
  conversationId: string,
  currentUid: string,
  isTyping: boolean
): Promise<void> {
  if (!conversationId || !currentUid) return;
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await setDoc(
      convRef,
      {
        [`typing.${currentUid}`]: isTyping,
      },
      { merge: true }
    );
  } catch {
    // Non-fatal
  }
}

/**
 * React to a message with emoji
 */
export async function addMessageReaction(
  conversationId: string,
  messageId: string,
  reaction: string
): Promise<void> {
  if (!conversationId || !messageId) return;

  // Update locally
  const msgs = getStoredMessages(conversationId);
  const target = msgs.find((m) => m.id === messageId);
  if (target) {
    target.reaction = reaction;
    setStoredMessages(conversationId, msgs);
    notifyMessagesChanged(conversationId);
  }

  try {
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await setDoc(
      msgRef,
      {
        reaction,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('addMessageReaction note:', err);
  }
}

/**
 * Delete a single chat message
 */
export async function deleteChatMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  if (!conversationId || !messageId) return;

  // Delete from local cache
  const msgs = getStoredMessages(conversationId);
  const filtered = msgs.filter((m) => m.id !== messageId);
  setStoredMessages(conversationId, filtered);
  notifyMessagesChanged(conversationId);

  try {
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await deleteDoc(msgRef);
  } catch (err) {
    console.warn('deleteChatMessage Firestore note:', err);
  }
}

/**
 * Clear all messages in a conversation
 */
export async function clearConversationMessages(
  conversationId: string
): Promise<void> {
  if (!conversationId) return;

  setStoredMessages(conversationId, []);
  notifyMessagesChanged(conversationId);

  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const snap = await getDocs(messagesRef);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (err) {
    console.warn('clearConversationMessages note:', err);
  }
}
