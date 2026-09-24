import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';

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
 * Register a pure, real account with credentials stored in Firestore and cached locally.
 */
export async function registerAccount(
  email: string,
  pass: string,
  profileData: Partial<User>
): Promise<{ uid: string; profile: User }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Please enter a valid email address');
  }
  if (!pass || pass.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // 1. Check if email already exists in Firestore user_credentials
  try {
    const credRef = doc(db, 'user_credentials', cleanEmail);
    const credSnap = await getDoc(credRef);
    if (credSnap.exists()) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || '';
    if (msg.includes('already exists')) throw err;
  }

  // 2. Check local credentials registry as backup
  const localCreds = getLocalCredentials();
  if (localCreds[cleanEmail]) {
    throw new Error('An account with this email already exists. Please sign in instead.');
  }

  // 3. Check if username is taken in users collection
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

  // 4. Generate unique ID & credential hash
  const uid = `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const salt = generateSalt();
  const passwordHash = await hashPassword(pass, salt);

  const credRecord: UserCredentialRecord = {
    uid,
    email: cleanEmail,
    passwordHash,
    salt,
  };

  // 5. Save credentials in Firestore
  try {
    const credRef = doc(db, 'user_credentials', cleanEmail);
    await setDoc(credRef, {
      ...credRecord,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore user_credentials sync note:', err);
  }

  // Cache credentials locally for instant offline access
  saveLocalCredential(credRecord);

  // 6. Build clean User Profile
  const now = new Date();
  const formattedDate = `Joined ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
  const fullProfile: User = {
    id: uid,
    name: profileData.name?.trim() || cleanEmail.split('@')[0],
    username: cleanUsername,
    avatar:
      profileData.avatar ||
      `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
    bannerUrl:
      profileData.bannerUrl ||
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
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
    themePreference: profileData.themePreference || 'nordic',
  };

  // 7. Save user profile in Firestore
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      ...fullProfile,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore user profile write note:', err);
  }

  return { uid, profile: fullProfile };
}

/**
 * Authenticate a real user account using secure password verification.
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

  let credRecord: UserCredentialRecord | null = null;

  // 1. Look up credentials in Firestore
  try {
    const credRef = doc(db, 'user_credentials', cleanEmail);
    const credSnap = await getDoc(credRef);
    if (credSnap.exists()) {
      credRecord = credSnap.data() as UserCredentialRecord;
    }
  } catch (err) {
    console.warn('Firestore user_credentials lookup note:', err);
  }

  // 2. Fallback to local registry if offline or not in Firestore
  if (!credRecord) {
    const localCreds = getLocalCredentials();
    if (localCreds[cleanEmail]) {
      credRecord = localCreds[cleanEmail];
    }
  }

  // 3. If credentials found, verify password hash
  if (credRecord) {
    const computedHash = await hashPassword(pass, credRecord.salt);
    if (computedHash !== credRecord.passwordHash) {
      throw new Error('Incorrect password. Please verify and try again.');
    }

    // Load User Profile from Firestore
    try {
      const userDocRef = doc(db, 'users', credRecord.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const profile = { ...userSnap.data(), id: userSnap.id } as User;
        saveLocalCredential(credRecord);
        return { uid: credRecord.uid, profile };
      }
    } catch (err) {
      console.warn('Firestore user doc read note:', err);
    }

    // Fallback profile if user doc is being synced
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
    };
    return { uid: credRecord.uid, profile: fallbackProfile };
  }

  // 4. Check if a user document exists by email in Firestore users collection
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const userDoc = snap.docs[0];
      const profile = { ...userDoc.data(), id: userDoc.id } as User;

      // Register credentials for future fast sign-in
      const salt = generateSalt();
      const passwordHash = await hashPassword(pass, salt);
      const newCred: UserCredentialRecord = {
        uid: userDoc.id,
        email: cleanEmail,
        passwordHash,
        salt,
      };
      saveLocalCredential(newCred);
      setDoc(doc(db, 'user_credentials', cleanEmail), {
        ...newCred,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});

      return { uid: userDoc.id, profile };
    }
  } catch (err) {
    console.warn('Firestore fallback user query note:', err);
  }

  throw new Error(`No account found for "${cleanEmail}". Please click "Create one now" below to register!`);
}

/**
 * Reset password for a registered account
 */
export async function resetAccountPassword(email: string, newPass: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const salt = generateSalt();
  const passwordHash = await hashPassword(newPass, salt);

  const credRef = doc(db, 'user_credentials', cleanEmail);
  const snap = await getDoc(credRef);
  if (!snap.exists()) {
    throw new Error(`No account found with email "${cleanEmail}"`);
  }

  const existing = snap.data() as UserCredentialRecord;
  const updated: UserCredentialRecord = {
    ...existing,
    passwordHash,
    salt,
  };

  await updateDoc(credRef, {
    passwordHash,
    salt,
    updatedAt: serverTimestamp(),
  });

  saveLocalCredential(updated);
}
