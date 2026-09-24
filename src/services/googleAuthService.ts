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
  uid?: string;
  email: string;
  name: string;
  picture?: string;
  email_verified?: boolean;
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
  if (window.google?.accounts?.oauth2 || window.google?.accounts?.id) return true;

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
 * Fetch Google User Info using an OAuth2 Access Token
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Google user info: ${res.statusText}`);
  }

  const data = await res.json();
  return {
    sub: data.sub,
    uid: `user_g_${data.sub}`,
    email: data.email,
    name: data.name || data.given_name || 'Google Creator',
    picture: data.picture,
    email_verified: data.email_verified,
  };
}

/**
 * Primary Google Sign-In pipeline:
 * 1. Tries Firebase Auth signInWithPopup (with GoogleAuthProvider)
 * 2. If blocked by iframe or disabled in console, tries Google Identity Services (GIS) Token Client
 * 3. Returns normalized Google user profile
 */
export async function authenticateWithGoogle(): Promise<GoogleUserProfile> {
  // 1. Try Firebase Auth popup
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
    console.info('Firebase popup note:', err?.code || err?.message);
    if (err.code === 'auth/unauthorized-domain') {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sodanox.ai.studio';
      throw new Error(`origin_mismatch: Domain ${origin} (and sodanox.ai.studio) is not authorized in Firebase Authentication.`);
    }
  }

  // 2. Try Google Identity Services (GSI)
  await loadGsiScript();
  const clientId = oAuthClientId;

  if (window.google?.accounts?.oauth2 && clientId) {
    try {
      const tokenPromise = new Promise<{ access_token?: string; error?: string }>((resolve, reject) => {
        const client = window.google!.accounts!.oauth2!.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          callback: (response) => {
            if (response.error) {
              if (response.error.includes('origin_mismatch') || response.error.includes('unauthorized')) {
                reject(new Error(`origin_mismatch: Register https://sodanox.ai.studio and ${window.location.origin} in Google Cloud Console.`));
              } else {
                reject(new Error(response.error));
              }
            } else {
              resolve(response);
            }
          },
          error_callback: (err: any) => {
            const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err);
            if (errStr.includes('origin_mismatch') || err?.type === 'origin_mismatch') {
              reject(new Error(`origin_mismatch: Register https://sodanox.ai.studio and ${window.location.origin} in Google Cloud Console.`));
            } else {
              reject(err);
            }
          },
        });

        try {
          client.requestAccessToken({ prompt: 'select_account' });
        } catch (reqErr) {
          reject(reqErr);
        }
      });

      const tokenRes = await tokenPromise;
      if (tokenRes.access_token) {
        // Try linking to Firebase Auth with access token credential
        try {
          const cred = GoogleAuthProvider.credential(null, tokenRes.access_token);
          await signInWithCredential(auth, cred);
        } catch {
          // Non-fatal if Firebase Auth credential exchange is disabled
        }

        const info = await fetchGoogleUserInfo(tokenRes.access_token);
        return info;
      }
    } catch (gsiErr: unknown) {
      const err = gsiErr as { message?: string };
      console.warn('GIS Token client note:', err?.message);
      throw gsiErr;
    }
  }

  throw new Error('Google Sign-In is unavailable or popup was closed.');
}

/**
 * Powerful Firestore User Synchronizer for Google Auth:
 * - Upserts public user document in `users/{userId}`
 * - Persists private settings to `users/{userId}/private/settings`
 * - Adheres strictly to Zero-Trust rules (role/verified immutability)
 */
export async function syncGoogleProfileWithFirestore(
  googleProfile: GoogleUserProfile
): Promise<{ user: User; isNewUser: boolean }> {
  const cleanEmail = googleProfile.email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Google profile did not provide a valid email address.');
  }

  // Step 1: Check if a user document exists by email in Firestore
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', cleanEmail));
  const snap = await getDocs(q);

  let userId: string = '';
  let existingUser: User | null = null;

  if (!snap.empty) {
    const docData = snap.docs[0];
    userId = docData.id;
    existingUser = { ...docData.data(), id: userId } as User;
  } else if (googleProfile.uid) {
    // Check by uid directly
    const userDocRef = doc(db, 'users', googleProfile.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      userId = userSnap.id;
      existingUser = { ...userSnap.data(), id: userId } as User;
    }
  }

  const isNewUser = !existingUser;
  const targetUid = userId || googleProfile.uid || `user_g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // Modern Empty Avatar if none provided or if it is mock
  const rawAvatar = googleProfile.picture || existingUser?.avatar;
  const avatar = isMockOrEmptyAvatar(rawAvatar) ? MODERN_EMPTY_AVATAR_DATA_URI : rawAvatar!;

  if (existingUser) {
    // Merge latest Google information into existing profile
    const updatedProfile: User = {
      ...existingUser,
      name: existingUser.name || googleProfile.name,
      avatar: isMockOrEmptyAvatar(existingUser.avatar) ? avatar : existingUser.avatar,
      email: cleanEmail,
      emailVerified: true,
    };

    try {
      const userRef = doc(db, 'users', targetUid);
      // Public updates only to avoid permission denied
      await updateDoc(userRef, {
        name: updatedProfile.name,
        avatar: updatedProfile.avatar,
        updatedAt: serverTimestamp(),
      });
      // Private subcollection
      const privateRef = doc(db, 'users', targetUid, 'private', 'settings');
      await setDoc(
        privateRef,
        {
          email: cleanEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore Google user update note:', err);
    }

    return { user: updatedProfile, isNewUser: false };
  }

  // Create brand new Google User profile
  const baseUsername = (cleanEmail.split('@')[0] || 'creator').toLowerCase().replace(/[^a-z0-9_.]/g, '');
  const username = baseUsername.length >= 3 ? baseUsername : `creator_${baseUsername}`;

  const now = new Date();
  const formattedDate = `Joined ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const publicData = {
    id: targetUid,
    name: googleProfile.name || cleanEmail.split('@')[0],
    username,
    avatar,
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
    privateAccount: false,
    showOnlineStatus: true,
    allowReshare: true,
    themePreference: 'nordic',
    blockedUsers: [],
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
  } as unknown as User;

  // Persist to Firestore with separated public and private paths
  try {
    const userRef = doc(db, 'users', targetUid);
    await setDoc(userRef, publicData, { merge: true });
  } catch (err) {
    console.warn('Firestore new Google user write note:', err);
  }

  try {
    const privateRef = doc(db, 'users', targetUid, 'private', 'settings');
    await setDoc(privateRef, privateData, { merge: true });
  } catch (err) {
    console.warn('Firestore private settings write note:', err);
  }

  return { user: fullUser, isNewUser: true };
}
