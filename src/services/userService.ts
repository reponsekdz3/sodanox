import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { createNotification } from './notificationService';

const USERS_COLLECTION = 'users';

/**
 * Fetch a single user profile by UID
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as User;
    }
    return null;
  } catch (error) {
    console.warn('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Check if a username is available
 */
export async function checkUsernameAvailable(username: string, excludeUid?: string): Promise<boolean> {
  if (!username) return false;
  try {
    const cleanUsername = username.trim().toLowerCase();
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('username', '==', cleanUsername));
    const snap = await getDocs(q);
    if (snap.empty) return true;
    if (excludeUid && snap.docs.length === 1 && snap.docs[0].id === excludeUid) {
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Error checking username:', err);
    return true;
  }
}

/**
 * Create or overwrite a user profile in Firestore
 */
export async function createUserProfile(uid: string, profileData: Partial<User>): Promise<User> {
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  const now = new Date();
  const formattedDate = `Joined ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const fullProfile: User = {
    id: uid,
    name: profileData.name || 'Aura Member',
    username: profileData.username || `user_${uid.slice(0, 6)}`,
    avatar:
      profileData.avatar ||
      `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
    bannerUrl: profileData.bannerUrl || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    bio: profileData.bio || 'Exploring design, craft, and quiet conversations on Aura.',
    pronouns: profileData.pronouns || '',
    location: profileData.location || '',
    website: profileData.website || '',
    joinedDate: profileData.joinedDate || formattedDate,
    followersCount: profileData.followersCount || 0,
    followingCount: profileData.followingCount || 0,
    isFollowing: false,
    verified: profileData.verified || false,
    email: profileData.email || '',
    privateAccount: profileData.privateAccount || false,
    themePreference: profileData.themePreference || 'light',
    allowMessagesFrom: profileData.allowMessagesFrom || 'everyone',
  };

  await setDoc(userDocRef, {
    ...fullProfile,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return fullProfile;
}

/**
 * Update user profile fields (e.g. bio, name, avatar, bannerUrl, location, website)
 */
export async function updateUserProfile(uid: string, data: Partial<User>): Promise<void> {
  if (!uid) return;
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  await updateDoc(userDocRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all registered community users (for search and initiating chats)
 */
export async function getAllUsers(excludeUid?: string): Promise<User[]> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);
    const users: User[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as User;
      if (!excludeUid || data.id !== excludeUid) {
        users.push(data);
      }
    });
    return users;
  } catch (error) {
    console.warn('Error getting all users:', error);
    return [];
  }
}

/**
 * Follow or unfollow another user
 */
export async function toggleFollowUser(
  currentUid: string,
  targetUid: string,
  currentlyFollowing: boolean,
  currentUser?: User
): Promise<void> {
  if (!currentUid || !targetUid || currentUid === targetUid) return;

  const currentUserRef = doc(db, USERS_COLLECTION, currentUid);
  const targetUserRef = doc(db, USERS_COLLECTION, targetUid);

  if (currentlyFollowing) {
    // Unfollow
    await updateDoc(currentUserRef, {
      following: arrayRemove(targetUid),
      followingCount: Math.max(0, (await getUserProfile(currentUid))?.followingCount ?? 1) - 1,
    }).catch(() => {});
    await updateDoc(targetUserRef, {
      followers: arrayRemove(currentUid),
      followersCount: Math.max(0, (await getUserProfile(targetUid))?.followersCount ?? 1) - 1,
    }).catch(() => {});
  } else {
    // Follow
    await updateDoc(currentUserRef, {
      following: arrayUnion(targetUid),
      followingCount: ((await getUserProfile(currentUid))?.followingCount ?? 0) + 1,
    }).catch(() => {});
    await updateDoc(targetUserRef, {
      followers: arrayUnion(currentUid),
      followersCount: ((await getUserProfile(targetUid))?.followersCount ?? 0) + 1,
    }).catch(() => {});

    if (currentUser && targetUid !== currentUid) {
      await createNotification(targetUid, currentUser, 'follow', 'started following you');
    }
  }
}

/**
 * Get list of followers for a user
 */
export async function getFollowersList(userId: string): Promise<User[]> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return [];
    const followerIds: string[] = snap.data().followers || [];
    if (followerIds.length === 0) return [];

    const users: User[] = [];
    for (const fid of followerIds) {
      const u = await getUserProfile(fid);
      if (u) users.push(u);
    }
    return users;
  } catch (err) {
    console.warn('Error getting followers:', err);
    return [];
  }
}

/**
 * Get list of accounts followed by a user
 */
export async function getFollowingList(userId: string): Promise<User[]> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return [];
    const followingIds: string[] = snap.data().following || [];
    if (followingIds.length === 0) return [];

    const users: User[] = [];
    for (const fid of followingIds) {
      const u = await getUserProfile(fid);
      if (u) users.push(u);
    }
    return users;
  } catch (err) {
    console.warn('Error getting following list:', err);
    return [];
  }
}
