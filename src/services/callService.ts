import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  Unsubscribe,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { createNotification } from './notificationService';
import { getDeterministicConvId, getOrCreateConversation, sendChatMessage } from './chatService';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

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
  offer?: {
    type: 'offer';
    sdp: string;
  };
  answer?: {
    type: 'answer';
    sdp: string;
  };
  callerCandidates?: RTCIceCandidateInit[];
  recipientCandidates?: RTCIceCandidateInit[];
  durationSeconds?: number;
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
  connectedAt?: any;
  endedAt?: any;
}

export const WEBRTC_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

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
      avatar: isMockOrEmptyAvatar(caller.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : caller.avatar,
    },
    recipientId: recipient.id,
    recipient: {
      id: recipient.id,
      name: recipient.name,
      username: recipient.username,
      avatar: isMockOrEmptyAvatar(recipient.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : recipient.avatar,
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

/**
 * Set WebRTC Offer SDP on call document
 */
export async function setCallOffer(
  callId: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      offer: {
        type: offer.type,
        sdp: offer.sdp,
      },
    });
  } catch (err) {
    console.warn('Error setting call offer:', err);
  }
}

/**
 * Set WebRTC Answer SDP on call document
 */
export async function setCallAnswer(
  callId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      status: 'connected',
      connectedAt: serverTimestamp(),
      answer: {
        type: answer.type,
        sdp: answer.sdp,
      },
    });
  } catch (err) {
    console.warn('Error setting call answer:', err);
  }
}

/**
 * Push an ICE Candidate from Caller
 */
export async function addCallerIceCandidate(
  callId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      callerCandidates: arrayUnion(JSON.parse(JSON.stringify(candidate))),
    });
  } catch (err) {
    console.warn('Error adding caller ICE candidate:', err);
  }
}

/**
 * Push an ICE Candidate from Recipient
 */
export async function addRecipientIceCandidate(
  callId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  try {
    const callRef = doc(db, CALLS_COLLECTION, callId);
    await updateDoc(callRef, {
      recipientCandidates: arrayUnion(JSON.parse(JSON.stringify(candidate))),
    });
  } catch (err) {
    console.warn('Error adding recipient ICE candidate:', err);
  }
}

/**
 * Record a real Call Log directly in the chat conversation
 * Creates or updates conversation and inserts an interactive Call card
 */
export async function recordCallLogToChat(
  caller: User,
  recipient: User,
  type: 'audio' | 'video',
  status: 'completed' | 'missed' | 'declined',
  durationSeconds: number = 0
): Promise<void> {
  try {
    const convId = getDeterministicConvId(caller.id, recipient.id);
    await getOrCreateConversation(caller, recipient);

    const callTypeText = type === 'video' ? 'Video call' : 'Audio call';
    let text = callTypeText;
    if (status === 'missed') {
      text = `Missed ${callTypeText.toLowerCase()}`;
    } else if (status === 'declined') {
      text = `Declined ${callTypeText.toLowerCase()}`;
    } else if (durationSeconds > 0) {
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      text = `${callTypeText} (${mins > 0 ? `${mins}m ` : ''}${secs}s)`;
    }

    await sendChatMessage(
      convId,
      {
        type: 'call',
        text,
        callMeta: {
          callType: type,
          status,
          durationSeconds,
        },
      },
      caller,
      recipient.id
    );
  } catch (err) {
    console.warn('Error recording call log to chat:', err);
  }
}

