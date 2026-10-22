import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, oAuthClientId } from '../firebase/config';
import { User } from '../types';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

export interface GoogleUserProfile {
  sub?: string;
  uid: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
}

export interface GoogleAuthErrorInfo {
  code: string;
  message: string;
  hostname?: string;
  origin?: string;
  firebaseSettingsUrl?: string;
}

export function getCurrentDomainInfo() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const projectId = 'gen-lang-client-0541693297';
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;
  const firebaseProvidersUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;
  return { hostname, origin, projectId, firebaseSettingsUrl, firebaseProvidersUrl };
}

// Global declaration for Google Identity Services (GSI)
declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: unknown) => void;
          prompt: (notification?: unknown) => void;
          renderButton: (parent: HTMLElement, options: unknown) => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

/**
 * Ensures Google Identity Services (GSI) script is loaded
 */
export async function loadGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.google?.accounts?.id || window.google?.accounts?.oauth2) return true;

  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      setTimeout(() => resolve(Boolean(window.google?.accounts)), 2000);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Primary Google Sign-In pipeline:
 * 1. If an ID Token is provided (e.g. from Google Identity Services button), uses signInWithCredential.
 * 2. Otherwise uses Firebase Auth signInWithPopup.
 * 3. Returns the authenticated Firebase user profile with guaranteed uid matching auth.currentUser.uid.
 */
export async function authenticateWithGoogle(idToken?: string): Promise<GoogleUserProfile> {
  // Case A: ID Token from Google Identity Services
  if (idToken) {
    try {
      const cred = GoogleAuthProvider.credential(idToken);
      const res = await signInWithCredential(auth, cred);
      const fbUser = res.user;
      return {
        uid: fbUser.uid,
        sub: fbUser.providerData[0]?.uid || fbUser.uid,
        email: fbUser.email || '',
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google User',
        picture: fbUser.photoURL || undefined,
        email_verified: fbUser.emailVerified,
      };
    } catch (tokenErr: unknown) {
      console.warn('Google credential sign-in note:', tokenErr);
      throw tokenErr;
    }
  }

  // Case B: Interactive Firebase Auth Popup
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    const cred = await signInWithPopup(auth, provider);
    if (cred.user) {
      const fbUser = cred.user;
      return {
        uid: fbUser.uid,
        sub: fbUser.providerData[0]?.uid || fbUser.uid,
        email: fbUser.email || '',
        name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google User',
        picture: fbUser.photoURL || undefined,
        email_verified: fbUser.emailVerified,
      };
    }
  } catch (fbErr: unknown) {
    const err = fbErr as { code?: string; message?: string };
    const domainInfo = getCurrentDomainInfo();
    console.warn('Firebase popup sign-in error:', err?.code, err?.message);

    if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
      const customErr = new Error(
        `Domain ${domainInfo.hostname} is not authorized in Firebase Authentication. Please add it to your Authorized Domains in the Firebase Console.`
      ) as Error & GoogleAuthErrorInfo;
      customErr.code = 'auth/unauthorized-domain';
      customErr.hostname = domainInfo.hostname;
      customErr.origin = domainInfo.origin;
      customErr.firebaseSettingsUrl = domainInfo.firebaseSettingsUrl;
      throw customErr;
    }

    if (err.code === 'auth/popup-blocked' || err.message?.includes('popup-blocked')) {
      const customErr = new Error(
        'The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.'
      ) as Error & GoogleAuthErrorInfo;
      customErr.code = 'auth/popup-blocked';
      throw customErr;
    }

    if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      const customErr = new Error(
        'The sign-in window was closed before completing Google authentication.'
      ) as Error & GoogleAuthErrorInfo;
      customErr.code = 'auth/popup-closed-by-user';
      throw customErr;
    }

    throw fbErr;
  }

  throw new Error('Google Sign-In did not complete.');
}

/**
 * Powerful Firestore User Synchronizer for Google Auth:
 * - Upserts public user document in `users/{authUid}`
 * - Persists private settings to `users/{authUid}/private/settings`
 * - Guarantees document ID matches auth.currentUser.uid to satisfy Zero-Trust rules
 */
export async function syncGoogleProfileWithFirestore(
  googleProfile: GoogleUserProfile
): Promise<{ user: User; isNewUser: boolean }> {
  const cleanEmail = googleProfile.email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Google profile did not provide a valid email address.');
  }

  // The UID MUST be the authenticated Firebase UID for rules to pass isOwner(userId)
  const authUid = googleProfile.uid || auth.currentUser?.uid;
  if (!authUid) {
    throw new Error('User is not authenticated with Firebase Auth.');
  }

  // Step 1: Check existing profile at users/{authUid}
  const userDocRef = doc(db, 'users', authUid);
  const userSnap = await getDoc(userDocRef);

  const rawAvatar = googleProfile.picture;
  const cleanAvatar = isMockOrEmptyAvatar(rawAvatar) ? MODERN_EMPTY_AVATAR_DATA_URI : (rawAvatar || MODERN_EMPTY_AVATAR_DATA_URI);

  if (userSnap.exists()) {
    const existing = { ...userSnap.data(), id: userSnap.id } as User;
    const updatedProfile: User = {
      ...existing,
      name: existing.name || googleProfile.name,
      avatar: isMockOrEmptyAvatar(existing.avatar) ? cleanAvatar : existing.avatar,
      email: cleanEmail,
      emailVerified: true,
    };

    try {
      // Update public fields (strictly disallowing role/verified modification)
      await updateDoc(userDocRef, {
        name: updatedProfile.name,
        avatar: updatedProfile.avatar,
        updatedAt: serverTimestamp(),
      });

      // Update private subcollection
      const privateRef = doc(db, 'users', authUid, 'private', 'settings');
      await setDoc(
        privateRef,
        {
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore Google user update notice:', err);
    }

    return { user: updatedProfile, isNewUser: false };
  }

  // Step 2: Create a brand new Google user profile (Sign-Up flow)
  let baseUsername = (cleanEmail.split('@')[0] || 'creator').toLowerCase().replace(/[^a-z0-9_.]/g, '');
  if (baseUsername.length < 3) baseUsername = `aura_${baseUsername}`;

  // Ensure unique username
  let finalUsername = baseUsername;
  try {
    const isAvail = await checkUsernameAvailable(finalUsername);
    if (!isAvail) {
      finalUsername = `${baseUsername}_${Math.floor(Math.random() * 899 + 100)}`;
    }
  } catch {
    // Graceful fallback
  }

  const now = new Date();
  const formattedDate = `Joined ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const publicData = {
    id: authUid,
    name: googleProfile.name || cleanEmail.split('@')[0],
    username: finalUsername,
    avatar: cleanAvatar,
    bannerUrl: '',
    bio: 'Mindful creator on Aura · Signed in with verified Google account.',
    pronouns: '',
    location: '',
    website: '',
    joinedDate: formattedDate,
    followersCount: 0,
    followingCount: 0,
    followers: [],
    following: [],
    verified: false,
    email: cleanEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const privateData = {
    email: cleanEmail,
    blockedUsers: [],
    privateAccount: false,
    showOnlineStatus: true,
    allowReshare: true,
    themePreference: 'nordic',
    notificationPreferences: {
      likes: true,
      comments: true,
      directChats: true,
      calls: true,
      follows: true,
    },
    mediaPreferences: {
      autoPlayReels: true,
      highQualityUploads: true,
      soundEffects: true,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const fullUser: User = {
    ...publicData,
    email: cleanEmail,
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    themePreference: 'nordic',
    emailVerified: true,
    notificationPreferences: privateData.notificationPreferences,
    mediaPreferences: privateData.mediaPreferences,
    blockedUsers: [],
    privateAccount: false,
    showOnlineStatus: true,
    allowReshare: true,
  } as unknown as User;

  // Persist to users/{authUid} and users/{authUid}/private/settings
  try {
    await setDoc(userDocRef, publicData);
  } catch (err) {
    console.error('Firestore new Google user public profile error:', err);
  }

  try {
    const privateRef = doc(db, 'users', authUid, 'private', 'settings');
    await setDoc(privateRef, privateData);
  } catch (err) {
    console.warn('Firestore new Google user private settings notice:', err);
  }

  return { user: fullUser, isNewUser: true };
}
