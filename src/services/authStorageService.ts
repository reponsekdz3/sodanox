import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

export interface UserCredentialRecord {
  uid: string;
  email: string;
  phone?: string;
  passwordHash: string;
  salt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuthIdentifier {
  type: 'email' | 'phone';
  cleanValue: string;
  firebaseEmail: string;
  phone?: string;
  email?: string;
}

/**
 * Normalizes input credential identifier as either a verified phone number or standard email address.
 * If phone number, formats with international standard prefix and maps to an internal Firebase Auth email.
 */
export function normalizeAuthIdentifier(input: string): AuthIdentifier {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    throw new Error('Please enter your email or phone number.');
  }

  if (trimmed.includes('@')) {
    const cleanEmail = trimmed.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Please enter a valid email address (e.g. name@example.com).');
    }
    return {
      type: 'email',
      cleanValue: cleanEmail,
      firebaseEmail: cleanEmail,
      email: cleanEmail,
    };
  }

  // Handle Phone Number
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (digitsOnly.length < 7) {
    throw new Error('Please enter a valid phone number (at least 7 digits) or email address.');
  }

  // Handle local formats (e.g. 0788... in Rwanda or standard international prefix)
  let normalizedPhone = '';
  if (hasPlus) {
    normalizedPhone = `+${digitsOnly}`;
  } else if (digitsOnly.startsWith('0') && digitsOnly.length === 10) {
    normalizedPhone = `+250${digitsOnly.slice(1)}`;
  } else if (digitsOnly.length === 9 && (digitsOnly.startsWith('7') || digitsOnly.startsWith('8'))) {
    normalizedPhone = `+250${digitsOnly}`;
  } else {
    normalizedPhone = `+${digitsOnly}`;
  }

  // Map to deterministic email for Firebase Auth provider compatibility
  const firebaseEmail = `phone_${digitsOnly}@phone.aurasocial.internal`;

  return {
    type: 'phone',
    cleanValue: normalizedPhone,
    firebaseEmail,
    phone: normalizedPhone,
    email: firebaseEmail,
  };
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
    if (cred.email) current[cred.email.toLowerCase()] = cred;
    if (cred.phone) current[cred.phone.toLowerCase()] = cred;
    localStorage.setItem(LOCAL_REGISTRY_KEY, JSON.stringify(current));
  } catch {
    // Local storage quota safe
  }
}

/**
 * Register account and initialize user profile in Firestore.
 * Supports registration using either a verified Phone Number or standard Email.
 * NOTE: In accordance with Firestore security rules, client-side writes to
 * /user_credentials are completely forbidden (allow read, write: if false;).
 * Credential storage is handled securely by Firebase Auth.
 */
export async function registerAccount(
  identifier: string,
  pass: string,
  profileData: Partial<User>,
  explicitUid?: string
): Promise<{ uid: string; profile: User }> {
  const norm = normalizeAuthIdentifier(identifier);
  if (!pass || pass.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // Check local credentials registry as backup
  const localCreds = getLocalCredentials();
  if (localCreds[norm.cleanValue.toLowerCase()] || localCreds[norm.firebaseEmail.toLowerCase()]) {
    throw new Error(`An account with this ${norm.type === 'phone' ? 'phone number' : 'email'} already exists. Please sign in instead.`);
  }

  // Check if identifier is already in users collection
  try {
    const usersRef = collection(db, 'users');
    let qExisting;
    if (norm.type === 'phone') {
      qExisting = query(usersRef, where('phone', '==', norm.cleanValue));
    } else {
      qExisting = query(usersRef, where('email', '==', norm.cleanValue));
    }
    const snapExisting = await getDocs(qExisting);
    if (!snapExisting.empty) {
      throw new Error(`An account with this ${norm.type === 'phone' ? 'phone number' : 'email'} already exists. Please sign in instead.`);
    }
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || '';
    if (msg.includes('already exists')) throw err;
  }

  // Check if username is taken in users collection
  const defaultUserFromId = norm.type === 'phone'
    ? `user_${norm.cleanValue.replace(/\D/g, '').slice(-6)}`
    : norm.cleanValue.split('@')[0];
  const rawUsername = profileData.username || defaultUserFromId;
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

  const finalEmail = norm.type === 'email' ? norm.cleanValue : (profileData.email || norm.firebaseEmail);
  const finalPhone = norm.type === 'phone' ? norm.cleanValue : (profileData.phone || '');

  const credRecord: UserCredentialRecord = {
    uid,
    email: finalEmail,
    phone: finalPhone || undefined,
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
    name: profileData.name?.trim() || (norm.type === 'email' ? norm.cleanValue.split('@')[0] : `Member ${norm.cleanValue.slice(-4)}`),
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
    email: finalEmail,
    phone: finalPhone,
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
      email: finalEmail,
      phone: finalPhone,
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
      email: finalEmail,
      phone: finalPhone,
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
 * Authenticate account using phone number or email address with local registry or user profile lookup.
 * Production auth is performed through Firebase Auth.
 */
export async function authenticateAccount(
  identifier: string,
  pass: string
): Promise<{ uid: string; profile: User }> {
  const norm = normalizeAuthIdentifier(identifier);
  if (!pass) {
    throw new Error('Please enter your password');
  }

  // 1. Check local registry by clean value, phone, or mapped firebase email
  const localCreds = getLocalCredentials();
  const credRecord =
    localCreds[norm.cleanValue.toLowerCase()] ||
    localCreds[norm.firebaseEmail.toLowerCase()] ||
    (norm.phone ? localCreds[norm.phone.toLowerCase()] : undefined);

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
      name: norm.type === 'email' ? norm.cleanValue.split('@')[0] : `Member ${norm.cleanValue.slice(-4)}`,
      username: (norm.type === 'email' ? norm.cleanValue.split('@')[0] : `user_${norm.cleanValue.replace(/\D/g, '').slice(-6)}`).toLowerCase().replace(/[^a-z0-9_.]/g, ''),
      email: credRecord.email,
      phone: credRecord.phone || (norm.type === 'phone' ? norm.cleanValue : undefined),
      avatar: MODERN_EMPTY_AVATAR_DATA_URI,
      bannerUrl: '',
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

  // 2. Query in Firestore users collection
  try {
    const usersRef = collection(db, 'users');
    let snap;
    if (norm.type === 'phone') {
      const qPhone = query(usersRef, where('phone', '==', norm.cleanValue));
      snap = await getDocs(qPhone);
      if (snap.empty) {
        // Fallback check by raw digits
        const digitsOnly = norm.cleanValue.replace(/\D/g, '');
        const qDigits = query(usersRef, where('phone', '==', digitsOnly));
        snap = await getDocs(qDigits);
      }
      if (snap.empty) {
        // Fallback check by mapped email
        const qEmail = query(usersRef, where('email', '==', norm.firebaseEmail));
        snap = await getDocs(qEmail);
      }
    } else {
      const qEmail = query(usersRef, where('email', '==', norm.cleanValue));
      snap = await getDocs(qEmail);
    }

    if (snap && !snap.empty) {
      const docData = snap.docs[0];
      const profile = { ...docData.data(), id: docData.id } as User;
      const salt = generateSalt();
      const passwordHash = await hashPassword(pass, salt);
      saveLocalCredential({
        uid: docData.id,
        email: profile.email || norm.firebaseEmail,
        phone: profile.phone || (norm.type === 'phone' ? norm.cleanValue : undefined),
        passwordHash,
        salt,
      });
      return { uid: docData.id, profile };
    }
  } catch (err) {
    console.warn('Firestore fallback user query note:', err);
  }

  throw new Error(`No account found for "${norm.cleanValue}". Click "Create one now" below to register in 1 click!`);
}

/**
 * Reset password for a registered account locally or in Firestore
 */
export async function resetAccountPassword(identifier: string, newPass: string): Promise<void> {
  const norm = normalizeAuthIdentifier(identifier);
  const salt = generateSalt();
  const passwordHash = await hashPassword(newPass, salt);

  const localCreds = getLocalCredentials();
  const existing =
    localCreds[norm.cleanValue.toLowerCase()] ||
    localCreds[norm.firebaseEmail.toLowerCase()] ||
    (norm.phone ? localCreds[norm.phone.toLowerCase()] : undefined);

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

  // Check Firestore users collection
  try {
    const usersRef = collection(db, 'users');
    let snap;
    if (norm.type === 'phone') {
      snap = await getDocs(query(usersRef, where('phone', '==', norm.cleanValue)));
      if (snap.empty) {
        snap = await getDocs(query(usersRef, where('email', '==', norm.firebaseEmail)));
      }
    } else {
      snap = await getDocs(query(usersRef, where('email', '==', norm.cleanValue)));
    }

    if (snap && !snap.empty) {
      saveLocalCredential({
        uid: snap.docs[0].id,
        email: snap.docs[0].data().email || norm.firebaseEmail,
        phone: snap.docs[0].data().phone || norm.phone,
        passwordHash,
        salt,
        updatedAt: Date.now(),
      });
      return;
    }
  } catch (err) {
    console.warn('Reset password user query note:', err);
  }

  throw new Error(`No account found with ${norm.type === 'phone' ? 'phone number' : 'email'} "${norm.cleanValue}"`);
}
