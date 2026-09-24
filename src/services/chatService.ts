import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
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

export function getDeterministicConvId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
}

/**
 * Creates or retrieves a conversation between two users directly in Firestore
 */
export async function getOrCreateConversation(
  currentUser: User,
  targetUser: User
): Promise<string> {
  const convId = getDeterministicConvId(currentUser.id, targetUser.id);
  const convRef = doc(db, 'conversations', convId);

  try {
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      await setDoc(convRef, {
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
          timestamp: 'Just now',
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('Firestore getOrCreateConversation error:', err);
  }

  return convId;
}

/**
 * Real-time Firestore subscription to all conversations for current user
 */
export function subscribeToUserConversations(
  currentUid: string,
  onUpdate: (conversations: ChatConversation[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user') {
    return () => {};
  }

  const convsRef = collection(db, 'conversations');
  const q = query(
    convsRef,
    where('participantIds', 'array-contains', currentUid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const convList: ChatConversation[] = [];
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

        convList.push({
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
          messages: [],
        });
      });

      // Sort by last message or updated time descending
      convList.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || '';
        const timeB = b.lastMessage?.timestamp || '';
        return timeB.localeCompare(timeA);
      });

      onUpdate(convList);
    },
    (err) => {
      console.error('subscribeToUserConversations snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time Firestore subscription to messages inside a specific conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!conversationId) {
    return () => {};
  }

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        msgs.push({
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
      onUpdate(msgs);
    },
    (err) => {
      console.error('subscribeToMessages snapshot error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Send a message directly to Firestore with optional replyTo data
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

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const msgDocRef = doc(messagesRef);
  const convRef = doc(db, 'conversations', conversationId);

  const payload: any = {
    id: msgDocRef.id,
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

  if (messageData.file) {
    payload.file = messageData.file;
  }
  if (messageData.voice) {
    payload.voice = messageData.voice;
  }
  if (replyTo) {
    payload.replyTo = {
      id: replyTo.id,
      senderId: replyTo.senderId,
      senderName: replyTo.senderName || 'Sender',
      text: replyTo.text || '',
      type: replyTo.type || 'text',
    };
  }

  // 1. Write the message document
  await setDoc(msgDocRef, payload);

  // 2. Update conversation header: lastMessage, recipient unread count, typing cleared
  const lastMessageSnippet =
    messageData.type === 'voice'
      ? '🎙️ Voice note'
      : messageData.type === 'file'
      ? `📎 ${messageData.file?.name || 'File'}`
      : messageData.type === 'image'
      ? '📷 Photo'
      : messageData.text || '';

  await updateDoc(convRef, {
    lastMessage: {
      id: msgDocRef.id,
      senderId: currentUser.id,
      timestamp: timeFormatted,
      type: messageData.type || 'text',
      text: lastMessageSnippet,
      status: 'sent',
    },
    updatedAt: serverTimestamp(),
    [`unreadCounts.${recipientId}`]: increment(1),
    [`typing.${currentUser.id}`]: false,
  });

  return msgDocRef.id;
}

/**
 * Mark all incoming messages in a conversation as read in Firestore
 */
export async function markConversationAsRead(
  conversationId: string,
  currentUid: string
): Promise<void> {
  if (!conversationId || !currentUid) return;

  try {
    const convRef = doc(db, 'conversations', conversationId);
    // Reset user's unread counter
    await updateDoc(convRef, {
      [`unreadCounts.${currentUid}`]: 0,
    });

    // Update unread messages sent by the other participant to 'read'
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
    console.error('markConversationAsRead error:', err);
  }
}

/**
 * Update real-time typing indicator directly on the conversation doc in Firestore
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
  } catch (err) {
    // Non-fatal
  }
}

/**
 * React to a message in Firestore
 */
export async function addMessageReaction(
  conversationId: string,
  messageId: string,
  reaction: string
): Promise<void> {
  if (!conversationId || !messageId) return;
  try {
    const msgRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    await updateDoc(msgRef, {
      reaction,
    });
  } catch (err) {
    console.error('addMessageReaction error:', err);
  }
}
