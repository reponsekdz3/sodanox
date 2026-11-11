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
  updateDoc,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ChatConversation, Message, MessageReplyInfo, User } from '../types';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

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
  if (!currentUser.id || !targetUser.id || currentUser.id === targetUser.id) {
    throw new Error('Choose another member to start a conversation.');
  }
  const convId = getDeterministicConvId(currentUser.id, targetUser.id);
  const convRef = doc(db, 'conversations', convId);
  const existingSnapshot = await getDoc(convRef);
  const timeFormatted = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const currentParticipant = {
    id: currentUser.id, name: currentUser.name, username: currentUser.username,
    avatar: currentUser.avatar, verified: currentUser.verified || false,
  };
  const targetParticipant = {
    id: targetUser.id, name: targetUser.name, username: targetUser.username,
    avatar: targetUser.avatar, verified: targetUser.verified || false,
  };

  if (!existingSnapshot.exists()) {
    await setDoc(convRef, {
      id: convId,
      participantIds: [currentUser.id, targetUser.id],
      participants: { [currentUser.id]: currentParticipant, [targetUser.id]: targetParticipant },
      lastMessage: {
        id: `init_${Date.now()}`, senderId: currentUser.id, timestamp: timeFormatted,
        type: 'text', text: 'Conversation started', status: 'read',
      },
      unreadCounts: { [currentUser.id]: 0, [targetUser.id]: 0 },
      typing: { [currentUser.id]: false, [targetUser.id]: false },
      updatedAt: serverTimestamp(),
    });
  } else {
    const participantIds: string[] = existingSnapshot.data().participantIds || [];
    if (!participantIds.includes(currentUser.id) || !participantIds.includes(targetUser.id)) {
      throw new Error('This conversation does not belong to the selected participants.');
    }
  }

  // Cache only a conversation that has been confirmed by Firestore.
  const convObject: ChatConversation = {
    id: convId,
    participant: { ...targetUser, isFollowing: targetUser.isFollowing || false },
    lastMessage: existingSnapshot.exists()
      ? (existingSnapshot.data().lastMessage as ChatConversation['lastMessage'])
      : { id: `init_${Date.now()}`, senderId: currentUser.id, timestamp: timeFormatted, type: 'text', text: 'Conversation started', status: 'read' },
    unreadCount: 0,
    isOnline: true,
    isTyping: false,
    messages: getStoredMessages(convId),
  };
  const existingConvs = getStoredConversations();
  const existingIndex = existingConvs.findIndex((conversation) => conversation.id === convId);
  if (existingIndex >= 0) {
    existingConvs[existingIndex] = { ...existingConvs[existingIndex], participant: convObject.participant };
  } else {
    existingConvs.unshift(convObject);
  }
  setStoredConversations(existingConvs);
  notifyConversationsChanged();
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

  let serverSnapshotReady = false;

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

  // 2. Before the first server snapshot, local updates can keep a new offline
  // conversation visible. Once Firestore responds, its list is authoritative.
  const handleLocalEvent = () => { if (!serverSnapshotReady) deliverLocal(); };
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

          const rawParticipant = data.participants?.[otherParticipantId || ''];
          const rawAvatar = rawParticipant?.avatar;
          const cleanAvatar = isMockOrEmptyAvatar(rawAvatar) ? MODERN_EMPTY_AVATAR_DATA_URI : rawAvatar;

          const participantObj = {
            id: otherParticipantId || 'unknown',
            name: rawParticipant?.name || 'Community Member',
            username: rawParticipant?.username || 'member',
            avatar: cleanAvatar,
            verified: Boolean(rawParticipant?.verified),
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

        // The successful server snapshot is authoritative: stale local-only
        // conversations must not reappear after deletion or an earlier failed write.
        serverSnapshotReady = true;
        const merged = firestoreList;
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
  onError?: (err: unknown) => void,
  currentUid?: string
): Unsubscribe {
  if (!conversationId) return () => {};
  let clearedAtMs = 0;
  let stateReady = !currentUid;
  let pendingFirestoreMessages: Message[] | null = null;
  const normalizedTime = (value: any): number => {
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return 0;
  };
  const visible = (messages: Message[]) => messages.filter((message) =>
    !clearedAtMs || normalizedTime(message.createdAt) > clearedAtMs
  );
  const deliverStored = () => {
    if (!stateReady) { onUpdate([]); return; }
    onUpdate(visible(getStoredMessages(conversationId)));
  };

  let serverSnapshotReady = false;
  const handleLocalMsgEvent = (event: Event) => {
    const custom = event as CustomEvent<{ conversationId?: string }>;
    if (!serverSnapshotReady && (!custom.detail?.conversationId || custom.detail.conversationId === conversationId)) deliverStored();
  };
  if (typeof window !== 'undefined') window.addEventListener('aura_chat_msgs_updated', handleLocalMsgEvent);

  let unsubscribeFirestore: Unsubscribe = () => {};
  let unsubscribeUserState: Unsubscribe = () => {};
  const publishMessages = (firestoreMessages: Message[]) => {
    if (!stateReady) { pendingFirestoreMessages = firestoreMessages; return; }
    // A live server result replaces cache data; the cache is only an offline fallback.
    const confirmed = visible(firestoreMessages);
    confirmed.sort((a, b) => {
      const first = normalizedTime(a.createdAt);
      const second = normalizedTime(b.createdAt);
      if (first && second && first !== second) return first - second;
      return (a.timestamp || '').localeCompare(b.timestamp || '');
    });
    serverSnapshotReady = true;
    setStoredMessages(conversationId, confirmed);
    onUpdate(confirmed);
  };
  try {
    if (currentUid) {
      const stateRef = doc(db, 'conversations', conversationId, 'userState', currentUid);
      unsubscribeUserState = onSnapshot(stateRef, (snapshot) => {
        clearedAtMs = snapshot.exists() ? normalizedTime(snapshot.data().clearedAt) : 0;
        stateReady = true;
        deliverStored();
        if (pendingFirestoreMessages) {
          publishMessages(pendingFirestoreMessages);
          pendingFirestoreMessages = null;
        }
      }, (error) => {
        console.warn('Private conversation state could not be read:', error);
        onError?.(error);
      });
    }
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    unsubscribeFirestore = onSnapshot(messagesRef, (snapshot) => {
      const firestoreMsgs: Message[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar,
          timestamp: data.timestamp || 'Just now',
          type: data.type || 'text',
          text: data.text || '',
          file: data.file || undefined,
          voice: data.voice || undefined,
          callMeta: data.callMeta || undefined,
          sharedPost: data.sharedPost || undefined,
          status: data.status || 'delivered',
          reaction: data.reaction,
          replyTo: data.replyTo || undefined,
          readAt: data.readAt,
          createdAt: data.createdAt,
        } as Message;
      });
      publishMessages(firestoreMsgs);
    }, (error) => {
      console.warn('Message subscription failed; cached messages remain available:', error);
      onError?.(error);
    });
  } catch (error) {
    console.error('Message subscription could not be initialized:', error);
    onError?.(error);
  }
  return () => {
    if (typeof window !== 'undefined') window.removeEventListener('aura_chat_msgs_updated', handleLocalMsgEvent);
    unsubscribeUserState();
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
  if (!conversationId || !currentUser.id || !recipientId) {
    throw new Error('A signed-in sender, recipient, and conversation are required.');
  }
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const msgDocRef = doc(messagesRef);
  const messageId = msgDocRef.id;
  const lastMessageSnippet =
    messageData.type === 'call'
      ? (messageData.callMeta?.status === 'missed' ? '📞 Missed call'
        : messageData.callMeta?.status === 'declined' ? '📞 Call declined'
        : `${messageData.callMeta?.callType === 'video' ? '📹 Video' : '📞 Audio'} call${messageData.callMeta?.durationSeconds ? ` (${Math.floor(messageData.callMeta.durationSeconds / 60)}m ${messageData.callMeta.durationSeconds % 60}s)` : ''}`)
      : messageData.type === 'voice' ? '🎙️ Voice note'
      : messageData.type === 'file' ? `📎 ${messageData.file?.name || 'File'}`
      : messageData.type === 'image' ? '📷 Photo'
      : messageData.type === 'post' ? `📌 Post from @${messageData.sharedPost?.authorUsername || 'creator'}`
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
    callMeta: messageData.callMeta,
    sharedPost: messageData.sharedPost,
    replyTo: replyTo ? {
      id: replyTo.id, senderId: replyTo.senderId,
      senderName: replyTo.senderName || 'Sender', text: replyTo.text || '', type: replyTo.type || 'text',
    } : undefined,
    createdAt: now.getTime(),
  };
  const payload: Record<string, any> = {
    id: messageId, conversationId, senderId: currentUser.id, senderName: currentUser.name,
    senderAvatar: currentUser.avatar, timestamp: timeFormatted, type: fullMessage.type,
    text: fullMessage.text, status: 'sent', createdAt: serverTimestamp(),
  };
  if (messageData.file) payload.file = messageData.file;
  if (messageData.voice) payload.voice = messageData.voice;
  if (messageData.callMeta) payload.callMeta = messageData.callMeta;
  if (messageData.sharedPost) payload.sharedPost = messageData.sharedPost;
  if (fullMessage.replyTo) payload.replyTo = fullMessage.replyTo;

  const convRef = doc(db, 'conversations', conversationId);
  const batch = writeBatch(db);
  batch.set(msgDocRef, payload);
  batch.update(convRef, {
    lastMessage: {
      id: messageId, senderId: currentUser.id, timestamp: timeFormatted,
      type: fullMessage.type, text: lastMessageSnippet, status: 'sent',
    },
    updatedAt: serverTimestamp(),
    [`unreadCounts.${recipientId}`]: increment(1),
    [`typing.${currentUser.id}`]: false,
  });
  // Message and conversation preview commit together. If either fails, nothing is
  // retained as a successful local-only message.
  await batch.commit();

  const localMessages = getStoredMessages(conversationId).filter((message) => message.id !== messageId);
  localMessages.push(fullMessage);
  setStoredMessages(conversationId, localMessages);
  const conversations = getStoredConversations();
  const conversationIndex = conversations.findIndex((conversation) => conversation.id === conversationId);
  if (conversationIndex >= 0) {
    conversations[conversationIndex] = {
      ...conversations[conversationIndex],
      lastMessage: {
        id: messageId, senderId: currentUser.id, timestamp: timeFormatted,
        type: fullMessage.type, text: lastMessageSnippet, status: 'sent',
      },
      unreadCount: 0,
    };
    const updated = conversations.splice(conversationIndex, 1)[0];
    conversations.unshift(updated);
    setStoredConversations(conversations);
  }
  notifyMessagesChanged(conversationId);
  notifyConversationsChanged();
  return messageId;
}

/**
 * Mark all incoming messages in a conversation as read
 */
export async function markConversationAsRead(conversationId: string, currentUid: string): Promise<void> {
  if (!conversationId || !currentUid) return;
  const convRef = doc(db, 'conversations', conversationId);
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const unreadQuery = query(messagesRef, where('senderId', '!=', currentUid));
  const snapshot = await getDocs(unreadQuery);
  const unreadDocs = snapshot.docs.filter((docSnap) => docSnap.data().status !== 'read');
  if (unreadDocs.length === 0) {
    await updateDoc(convRef, { [`unreadCounts.${currentUid}`]: 0 });
  } else {
    for (let index = 0; index < unreadDocs.length; index += 450) {
      const batch = writeBatch(db);
      if (index === 0) batch.update(convRef, { [`unreadCounts.${currentUid}`]: 0 });
      unreadDocs.slice(index, index + 450).forEach((docSnap) => {
        batch.update(docSnap.ref, { status: 'read', readAt: serverTimestamp() });
      });
      await batch.commit();
    }
  }
  // Only change local unread state after Firebase commits successfully.
  const conversations = getStoredConversations();
  const target = conversations.find((conversation) => conversation.id === conversationId);
  if (target) {
    target.unreadCount = 0;
    setStoredConversations(conversations);
    notifyConversationsChanged();
  }
  const messages = getStoredMessages(conversationId).map((message) =>
    message.senderId !== currentUid ? { ...message, status: 'read' as const } : message
  );
  setStoredMessages(conversationId, messages);
  notifyMessagesChanged(conversationId);
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
    await updateDoc(convRef, {
      [`typing.${currentUid}`]: isTyping,
    });
  } catch {
    // Non-fatal
  }
}

/**
 * React to a message with emoji
 */
export async function addMessageReaction(conversationId: string, messageId: string, reaction: string): Promise<void> {
  if (!conversationId || !messageId) return;
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  await updateDoc(msgRef, { reaction });
  const messages = getStoredMessages(conversationId);
  const target = messages.find((message) => message.id === messageId);
  if (target) {
    target.reaction = reaction;
    setStoredMessages(conversationId, messages);
    notifyMessagesChanged(conversationId);
  }
}

/**
 * Delete a single chat message
 */
export async function deleteChatMessage(conversationId: string, messageId: string): Promise<void> {
  if (!conversationId || !messageId) return;
  const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  // Firestore only lets the author delete their message. Do not hide it locally
  // until that owner-authorized server delete has succeeded.
  await deleteDoc(msgRef);
  const messages = getStoredMessages(conversationId).filter((message) => message.id !== messageId);
  setStoredMessages(conversationId, messages);
  notifyMessagesChanged(conversationId);
}

/**
 * Clear all messages in a conversation
 */
export async function clearConversationMessages(conversationId: string, currentUid: string): Promise<void> {
  if (!conversationId || !currentUid) return;
  const stateRef = doc(db, 'conversations', conversationId, 'userState', currentUid);
  // A per-participant clear marker hides history only for this member; original
  // message records remain available to the other participant and are not destroyed.
  await setDoc(stateRef, { clearedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  setStoredMessages(conversationId, []);
  notifyMessagesChanged(conversationId);
}