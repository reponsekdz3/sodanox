import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Unsubscribe,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { createNotification } from './notificationService';

export interface CallSession {
  id: string;
  callerId: string;
  caller: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  recipientId: string;
  recipient: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'declined';
  lastReaction?: {
    emoji: string;
    senderId: string;
    timestamp: number;
  };
  lastQuickMessage?: {
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
  };
  createdAt?: any;
  endedAt?: any;
}

const CALLS_COLLECTION = 'calls';

/**
 * Initiate an outgoing audio/video call to a recipient
 */
export async function initiateCallSession(
  caller: User,
  recipient: User,
  type: 'audio' | 'video'
): Promise<string> {
  const callId = `call_${caller.id}_${recipient.id}_${Date.now()}`;
  const callRef = doc(db, CALLS_COLLECTION, callId);

  const newSession: CallSession = {
    id: callId,
    callerId: caller.id,
    caller: {
      id: caller.id,
      name: caller.name,
      username: caller.username,
      avatar: caller.avatar,
    },
    recipientId: recipient.id,
    recipient: {
      id: recipient.id,
      name: recipient.name,
      username: recipient.username,
      avatar: recipient.avatar,
    },
    type,
    status: 'ringing',
    createdAt: serverTimestamp(),
  };

  await setDoc(callRef, newSession);

  // Send real notification to recipient
  await createNotification(
    recipient.id,
    caller,
    'call',
    `started an encrypted ${type} call`,
    callId,
    'profile'
  ).catch((err) => console.warn('Notification send note:', err));

  return callId;
}

/**
 * Real-time listener for incoming ringing calls to the current user
 */
export function subscribeToIncomingCalls(
  currentUid: string,
  onIncomingCall: (session: CallSession | null) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user') {
    return () => {};
  }

  const callsRef = collection(db, CALLS_COLLECTION);
  const q = query(
    callsRef,
    where('recipientId', '==', currentUid),
    where('status', '==', 'ringing')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onIncomingCall(null);
        return;
      }
      // Get the freshest ringing call
      const docSnap = snapshot.docs[0];
      const data = docSnap.data() as CallSession;
      onIncomingCall(data);
    },
    (err) => {
      console.warn('Incoming calls subscription note:', err);
    }
  );
}

/**
 * Subscribe to status updates and events for an active call session
 */
export function subscribeToCallSession(
  callId: string,
  onUpdate: (session: CallSession | null) => void
): Unsubscribe {
  if (!callId) return () => {};

  const callRef = doc(db, CALLS_COLLECTION, callId);

  return onSnapshot(
    callRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(docSnap.data() as CallSession);
    },
    (err) => {
      console.warn('Call session subscription note:', err);
    }
  );
}

/**
 * Recipient accepts the incoming call
 */
export async function acceptCallSession(callId: string): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      status: 'connected',
      connectedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Error accepting call:', err);
  }
}

/**
 * Recipient declines the call
 */
export async function declineCallSession(callId: string): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      status: 'declined',
      endedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Error declining call:', err);
  }
}

/**
 * Either party hangs up / ends the call
 */
export async function endCallSession(callId: string): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      status: 'ended',
      endedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Error ending call session:', err);
  }
}

/**
 * Send in-call emoji reaction
 */
export async function sendCallReaction(
  callId: string,
  emoji: string,
  senderId: string
): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      lastReaction: {
        emoji,
        senderId,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    console.warn('Error sending call reaction:', err);
  }
}

/**
 * Send in-call quick text message
 */
export async function sendCallQuickMessage(
  callId: string,
  text: string,
  senderId: string,
  senderName: string
): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      lastQuickMessage: {
        text,
        senderId,
        senderName,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    console.warn('Error sending in-call message:', err);
  }
}
