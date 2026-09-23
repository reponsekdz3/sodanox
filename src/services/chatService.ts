import {
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDoc,
  increment,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ChatConversation, Message, User } from '../types';

export function getDeterministicConvId(uid1: string, uid2: string): string {
  const sorted = [uid1, uid2].sort();
  return `conv_${sorted[0]}_${sorted[1]}`;
}

/**
 * Creates or retrieves a conversation between two users
 */
export async function getOrCreateConversation(
  currentUser: User,
  targetUser: User
): Promise<string> {
  const convId = getDeterministicConvId(currentUser.id, targetUser.id);
  const convRef = doc(db, 'conversations', convId);
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
        text: 'Direct chat initiated',
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
      createdAt: serverTimestamp(),
    });
  }

  return convId;
}

/**
 * Real-time subscription to all conversations for the current user
 */
export function subscribeToUserConversations(
  currentUid: string,
  onUpdate: (conversations: ChatConversation[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user' || currentUid === 'user_fallback') {
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
        const otherParticipantId = (data.participantIds as string[]).find(
          (id) => id !== currentUid
        );

        const participantObj =
          data.participants?.[otherParticipantId || ''] || {
            id: otherParticipantId || 'unknown',
            name: 'Community Member',
            username: 'member',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
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
            id: 'm_none',
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

      // Sort by updatedAt descending
      convList.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || '';
        const timeB = b.lastMessage?.timestamp || '';
        return timeB.localeCompare(timeA);
      });

      onUpdate(convList);
    },
    (err) => {
      console.error('Conversation subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time subscription to messages inside a specific conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (!conversationId || conversationId.startsWith('demo_')) {
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
          timestamp: d.timestamp || 'Just now',
          type: d.type || 'text',
          text: d.text || '',
          file: d.file,
          voice: d.voice,
          status: d.status || 'delivered',
          reaction: d.reaction,
        });
      });
      onUpdate(msgs);
    },
    (err) => {
      console.error('Messages subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Send a message in a conversation (text, file, voice, or image)
 */
export async function sendChatMessage(
  conversationId: string,
  messageData: Partial<Message>,
  currentUser: User,
  recipientId: string
): Promise<void> {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const convRef = doc(db, 'conversations', conversationId);

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const messageDoc = {
    conversationId,
    senderId: currentUser.id,
    senderName: currentUser.name,
    senderAvatar: currentUser.avatar,
    timestamp: timeFormatted,
    type: messageData.type || 'text',
    text: messageData.text || '',
    file: messageData.file || null,
    voice: messageData.voice || null,
    status: 'sent',
    createdAt: serverTimestamp(),
  };

  // Add to subcollection
  await addDoc(messagesRef, messageDoc);

  // Update conversation parent
  await updateDoc(convRef, {
    lastMessage: {
      id: `msg_${Date.now()}`,
      senderId: currentUser.id,
      timestamp: timeFormatted,
      type: messageData.type || 'text',
      text:
        messageData.type === 'voice'
          ? '🎙️ Voice note'
          : messageData.type === 'file'
          ? `📎 ${messageData.file?.name || 'File attachment'}`
          : messageData.type === 'image'
          ? '📷 Photo'
          : messageData.text || '',
      status: 'sent',
    },
    updatedAt: serverTimestamp(),
    [`unreadCounts.${recipientId}`]: increment(1),
    [`typing.${currentUser.id}`]: false,
  });
}

/**
 * Mark all messages in a conversation as read for current user
 */
export async function markConversationAsRead(
  conversationId: string,
  currentUid: string
): Promise<void> {
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`unreadCounts.${currentUid}`]: 0,
    });
  } catch (err) {
    console.error('Error marking conversation as read:', err);
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
  try {
    const convRef = doc(db, 'conversations', conversationId);
    await updateDoc(convRef, {
      [`typing.${currentUid}`]: isTyping,
    });
  } catch {
    // Ignore transient typing error
  }
}
