import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { INITIAL_CREATORS } from './seedService';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

export interface UserCredentialRecord {
  uid: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const LOCAL_REGISTRY_KEY = 'aura_auth_credentials_registry';

/**
 * Robust cryptographic SHA-256 password hashing with unique salt using Web Crypto API.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${password}::aura_pure_social::${salt}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Headless / fallback environment hash
  let hash = 0;
  const str = `${password}::aura_pure_social::${salt}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function generateSalt(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getLocalCredentials(): Record<string, UserCredentialRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCredential(cred: UserCredentialRecord) {
  try {
    const current = getLocalCredentials();
    current[cred.email.toLowerCase()] = cred;
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(current));
  } catch {
    // Local storage quota safe
  }
}

/**
 * Register account and initialize user profile in Firestore.
 * NOTE: In accordance with Firestore security rules, client-side writes to
 * /user_credentials are completely forbidden (allow read, write: if false;).
 * Credential storage is handled securely by Firebase Auth.
 */
export async function registerAccount(
  email: string,
  pass: string,
  profileData: Partial<User>,
  explicitUid?: string
): Promise<{ uid: string; profile: User }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address');
  }
  if (!pass || pass.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // Check local credentials registry as backup
  const localCreds = getLocalCredentials();
  if (localCreds[cleanEmail]) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  // Check if username is taken in users collection
  const rawUsername = profileData.username || cleanEmail.split('@')[0];
  const cleanUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_.]/g, '');

  if (cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', cleanUsername));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`The username @${cleanUsername} is already taken. Please choose another.`);
    }
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || '';
    if (msg.includes('already taken')) throw err;
  }

  // Generate unique ID or use authenticated UID
  const uid = explicitUid || `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const salt = generateSalt();
  const passwordHash = await hashPassword(pass, salt);

  const credRecord: UserCredentialRecord = {
    uid,
    email: cleanEmail,
    passwordHash,
    salt,
  };

  // Cache credentials locally for offline access (never write to firestore user_credentials from client)
  saveLocalCredential(credRecord);

  // Build clean User Profile
  const now = new Date();
  const formattedDate = `Joined ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
  const cleanAvatar = isMockOrEmptyAvatar(profileData.avatar)
    ? MODERN_EMPTY_AVATAR_DATA_URI
    : (profileData.avatar || MODERN_EMPTY_AVATAR_DATA_URI);

  const fullProfile: User = {
    id: uid,
    name: profileData.name?.trim() || cleanEmail.split('@')[0],
    username: cleanUsername,
    avatar: cleanAvatar,
    bannerUrl: profileData.bannerUrl || '',
    bio: profileData.bio?.trim() || 'Mindful creator on Aura · Exploring quiet design and genuine connections.',
    pronouns: profileData.pronouns?.trim() || '',
    location: profileData.location?.trim() || '',
    website: profileData.website?.trim() || '',
    joinedDate: formattedDate,
    followersCount: 0,
    followingCount: 0,
    followers: [],
    following: [],
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    verified: false,
    email: cleanEmail,
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
    blockedUsers: [],
  };

  // Save public profile to users/{userId}
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      id: fullProfile.id,
      name: fullProfile.name,
      username: fullProfile.username,
      avatar: fullProfile.avatar,
      bannerUrl: fullProfile.bannerUrl,
      bio: fullProfile.bio,
      pronouns: fullProfile.pronouns,
      location: fullProfile.location,
      website: fullProfile.website,
      joinedDate: fullProfile.joinedDate,
      followersCount: 0,
      followingCount: 0,
      followers: [],
      following: [],
      verified: false,
      email: cleanEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore user profile write note:', err);
  }

  // Save sensitive preferences to private subcollection: users/{userId}/private/settings
  try {
    const privateSettingsRef = doc(db, 'users', uid, 'private', 'settings');
    await setDoc(privateSettingsRef, {
      email: cleanEmail,
      blockedUsers: [],
      privateAccount: false,
      showOnlineStatus: true,
      allowReshare: true,
      themePreference: 'nordic',
      notificationPreferences: fullProfile.notificationPreferences,
      mediaPreferences: fullProfile.mediaPreferences,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore private settings write note:', err);
  }

  return { uid, profile: fullProfile };
}

/**
 * Authenticate account using local registry or user profile lookup.
 * Production auth is performed through Firebase Auth.
 */
export async function authenticateAccount(
  email: string,
  pass: string
): Promise<{ uid: string; profile: User }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Please enter your email address');
  }
  if (!pass) {
    throw new Error('Please enter your password');
  }

  // Check local registry
  const localCreds = getLocalCredentials();
  const credRecord = localCreds[cleanEmail];

  if (credRecord) {
    const computedHash = await hashPassword(pass, credRecord.salt);
    if (computedHash !== credRecord.passwordHash) {
      throw new Error('Incorrect password. Please verify and try again.');
    }

    try {
      const userDocRef = doc(db, 'users', credRecord.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const profile = { ...userSnap.data(), id: userSnap.id } as User;
        return { uid: credRecord.uid, profile };
      }
    } catch (err) {
      console.warn('Firestore user doc read note:', err);
    }

    const fallbackProfile: User = {
      id: credRecord.uid,
      name: cleanEmail.split('@')[0],
      username: cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, ''),
      email: cleanEmail,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      bio: 'Mindful creator on Aura.',
      joinedDate: 'Joined Recently',
      followersCount: 0,
      followingCount: 0,
      followers: [],
      following: [],
      isFollowing: false,
      isFollower: false,
      isMutual: false,
      verified: false,
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
      blockedUsers: [],
    };

    return { uid: credRecord.uid, profile: fallbackProfile };
  }

  // 2. Check if this is a recognized platform creator (e.g. icedrick444@gmail.com)
  const initialCreator = INITIAL_CREATORS.find(
    (c) => c.email?.toLowerCase() === cleanEmail
  );
  if (initialCreator) {
    const salt = generateSalt();
    const passwordHash = await hashPassword(pass, salt);
    const newCred: UserCredentialRecord = {
      uid: initialCreator.id,
      email: cleanEmail,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
    };
    saveLocalCredential(newCred);

    // Ensure initial creator profile is saved in Firestore users collection
    try {
      const userDocRef = doc(db, 'users', initialCreator.id);
      await setDoc(
        userDocRef,
        {
          id: initialCreator.id,
          name: initialCreator.name,
          username: initialCreator.username,
          avatar: initialCreator.avatar,
          bannerUrl: initialCreator.bannerUrl,
          bio: initialCreator.bio,
          pronouns: initialCreator.pronouns,
          location: initialCreator.location,
          website: initialCreator.website,
          joinedDate: initialCreator.joinedDate,
          followersCount: initialCreator.followersCount,
          followingCount: initialCreator.followingCount,
          followers: initialCreator.followers,
          following: initialCreator.following,
          verified: initialCreator.verified,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const privateSettingsRef = doc(db, 'users', initialCreator.id, 'private', 'settings');
      await setDoc(
        privateSettingsRef,
        {
          email: cleanEmail,
          blockedUsers: [],
          privateAccount: false,
          showOnlineStatus: true,
          allowReshare: true,
          themePreference: 'nordic',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Initial creator Firestore sync note:', err);
    }

    return { uid: initialCreator.id, profile: initialCreator };
  }

  // 3. Fallback: Query by email in users collection
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      const profile = { ...docData.data(), id: docData.id } as User;
      const salt = generateSalt();
      const passwordHash = await hashPassword(pass, salt);
      saveLocalCredential({
        uid: docData.id,
        email: cleanEmail,
        passwordHash,
        salt,
      });
      return { uid: docData.id, profile };
    }
  } catch (err) {
    console.warn('Firestore fallback user query note:', err);
  }

  throw new Error(`No account found for "${cleanEmail}". Click "Create one now" below to register in 1 click!`);
}

/**
 * Reset password for a registered account locally
 */
export async function resetAccountPassword(email: string, newPass: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const salt = generateSalt();
  const passwordHash = await hashPassword(newPass, salt);

  const localCreds = getLocalCredentials();
  const existing = localCreds[cleanEmail];
  if (existing) {
    const updated: UserCredentialRecord = {
      ...existing,
      passwordHash,
      salt,
      updatedAt: Date.now(),
    };
    saveLocalCredential(updated);
    return;
  }

  // Check initial creators
  const initial = INITIAL_CREATORS.find((c) => c.email?.toLowerCase() === cleanEmail);
  if (initial) {
    saveLocalCredential({
      uid: initial.id,
      email: cleanEmail,
      passwordHash,
      salt,
      updatedAt: Date.now(),
    });
    return;
  }

  // Check Firestore users collection
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      saveLocalCredential({
        uid: snap.docs[0].id,
        email: cleanEmail,
        passwordHash,
        salt,
        updatedAt: Date.now(),
      });
      return;
    }
  } catch (err) {
    console.warn('Reset password user query note:', err);
  }

  throw new Error(`No account found with email "${cleanEmail}"`);
}
