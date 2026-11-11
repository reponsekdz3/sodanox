import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  writeBatch,
  collection,
  getDocs,
  query,
  where,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { User } from '../types';
import { createNotification } from './notificationService';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../components/common/ModernAvatar';

const USERS_COLLECTION = 'users';
const LOCAL_USERS_CACHE_KEY = 'aura_pure_users_cache';

function getCachedUsers(): User[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedUsers(users: User[]) {
  try {
    localStorage.setItem(LOCAL_USERS_CACHE_KEY, JSON.stringify(users));
  } catch {
    // LocalStorage quota safety
  }
}

/**
 * Fetch a single user profile by UID
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  if (!uid) return null;

  // 1. Check in-memory community cache first
  const cached = getCachedUsers().find((u) => u.id === uid);
  if (cached) return cached;

  // 2. Check local session storage if this is the active user
  try {
    const local = localStorage.getItem('aura_current_user');
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (parsed.id === uid || parsed.uid === uid)) {
        return parsed as User;
      }
    }
  } catch {
    // Non-critical local storage parse error
  }

  // 3. Query Firestore
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const profile = {
        ...data,
        id: snap.id,
        followers: data.followers || [],
        following: data.following || [],
        followersCount: typeof data.followersCount === 'number' ? Math.max(0, data.followersCount) : (data.followers?.length || 0),
        followingCount: typeof data.followingCount === 'number' ? Math.max(0, data.followingCount) : (data.following?.length || 0),
      } as User;

      // If active caller is the owner, securely fetch sensitive PII from private subcollection
      if (auth.currentUser?.uid === uid) {
        try {
          const privateDocRef = doc(db, USERS_COLLECTION, uid, 'private', 'settings');
          const privateSnap = await getDoc(privateDocRef);
          if (privateSnap.exists()) {
            const privData = privateSnap.data();
            profile.email = privData.email || profile.email;
            profile.blockedUsers = privData.blockedUsers || [];
            profile.notificationPreferences = privData.notificationPreferences || profile.notificationPreferences;
            profile.mediaPreferences = privData.mediaPreferences || profile.mediaPreferences;
            profile.privateAccount = privData.privateAccount ?? profile.privateAccount;
            profile.showOnlineStatus = privData.showOnlineStatus ?? profile.showOnlineStatus;
            profile.allowReshare = privData.allowReshare ?? profile.allowReshare;
            profile.themePreference = privData.themePreference || profile.themePreference;
          }
        } catch {
          // Graceful fallback
        }
      }

      const current = getCachedUsers();
      const idx = current.findIndex((u) => u.id === uid);
      if (idx >= 0) current[idx] = profile;
      else current.push(profile);
      saveCachedUsers(current);

      return profile;
    }
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isOffline = msg.includes('offline') || msg.includes('unavailable') || msg.includes('failed-precondition');
    if (!isOffline) {
      console.warn('Error fetching user profile (using cached if available):', error);
    }
    return cached || null;
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
    console.error('Username availability could not be verified:', err);
    // Fail closed: signup must not proceed when uniqueness cannot be checked.
    return false;
  }
}

/**
 * Fetch a user profile by unique username handle
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  if (!username) return null;
  const clean = username.trim().toLowerCase().replace(/^@/, '');

  // 1. Check local cached users
  const cached = getCachedUsers().find((u) => u.username.toLowerCase() === clean);
  if (cached) return cached;

  // 2. Query Firestore users collection
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('username', '==', clean));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const profile = {
        ...data,
        id: docSnap.id,
        followers: data.followers || [],
        following: data.following || [],
        followersCount: typeof data.followersCount === 'number' ? Math.max(0, data.followersCount) : (data.followers?.length || 0),
        followingCount: typeof data.followingCount === 'number' ? Math.max(0, data.followingCount) : (data.following?.length || 0),
      } as User;

      const current = getCachedUsers();
      if (!current.some((u) => u.id === profile.id)) {
        current.push(profile);
        saveCachedUsers(current);
      }
      return profile;
    }
  } catch (err) {
    console.warn('Error fetching user by username:', err);
  }

  return null;
}

/**
 * Create or overwrite a user profile in Firestore
 */
export async function createUserProfile(uid: string, profileData: Partial<User>): Promise<User> {
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  const now = new Date();
  const formattedDate = `Joined ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

  const cleanUsername = (profileData.username || `aura_${uid.slice(0, 6)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '');

  const cleanAvatar = isMockOrEmptyAvatar(profileData.avatar)
    ? MODERN_EMPTY_AVATAR_DATA_URI
    : (profileData.avatar || MODERN_EMPTY_AVATAR_DATA_URI);

  const fullProfile: User = {
    id: uid,
    name: profileData.name?.trim() || '',
    username: cleanUsername,
    avatar: cleanAvatar,
    bannerUrl: profileData.bannerUrl || '',
    bio: profileData.bio || '',
    pronouns: profileData.pronouns || '',
    location: profileData.location || '',
    website: profileData.website || '',
    joinedDate: profileData.joinedDate || formattedDate,
    followersCount: 0,
    followingCount: 0,
    followers: [],
    following: [],
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    verified: false,
    email: profileData.email || '',
    privateAccount: profileData.privateAccount || false,
    themePreference: profileData.themePreference || 'nordic',
    allowMessagesFrom: profileData.allowMessagesFrom || 'everyone',
    showOnlineStatus: profileData.showOnlineStatus !== false,
    allowReshare: profileData.allowReshare !== false,
    notificationPreferences: profileData.notificationPreferences || {
      likes: true,
      comments: true,
      directChats: true,
      calls: true,
      follows: true,
    },
    mediaPreferences: profileData.mediaPreferences || {
      autoPlayReels: true,
      highQualityUploads: true,
      soundEffects: true,
    },
    blockedUsers: profileData.blockedUsers || [],
  };

  // Public fields written to users/{userId}
  const publicData = {
    id: uid,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // Private sensitive fields written to users/{userId}/private/settings
  const privateData = {
    email: profileData.email || '',
    blockedUsers: profileData.blockedUsers || [],
    privateAccount: profileData.privateAccount || false,
    themePreference: profileData.themePreference || 'nordic',
    allowMessagesFrom: profileData.allowMessagesFrom || 'everyone',
    showOnlineStatus: profileData.showOnlineStatus !== false,
    allowReshare: profileData.allowReshare !== false,
    notificationPreferences: fullProfile.notificationPreferences,
    mediaPreferences: fullProfile.mediaPreferences,
    updatedAt: serverTimestamp(),
  };

  if (!uid || !fullProfile.name || !cleanUsername) {
    throw new Error('A valid account ID, display name, and username are required to create a profile.');
  }
  if (!auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('The active sign-in session does not match this profile. Please sign in again.');
  }

  const privateRef = doc(db, USERS_COLLECTION, uid, 'private', 'settings');
  const batch = writeBatch(db);
  batch.set(userDocRef, publicData, { merge: true });
  batch.set(privateRef, privateData, { merge: true });
  // Do not claim profile creation until both public and private documents commit.
  await batch.commit();

  const cached = getCachedUsers();
  const idx = cached.findIndex((u) => u.id === uid);
  if (idx >= 0) cached[idx] = fullProfile;
  else cached.push(fullProfile);
  saveCachedUsers(cached);

  return fullProfile;
}

/**
 * Update user profile fields with strict privilege separation
 */
export async function updateUserProfile(uid: string, data: Partial<User>): Promise<void> {
  if (!uid) return;
  const userDocRef = doc(db, USERS_COLLECTION, uid);

  // 1. Separate public fields from private settings and strip immutable keys (role, verified, id, createdAt)
  const publicUpdates: Record<string, any> = {};
  if (data.name !== undefined) publicUpdates.name = data.name;
  if (data.bio !== undefined) publicUpdates.bio = data.bio;
  if (data.location !== undefined) publicUpdates.location = data.location;
  if (data.website !== undefined) publicUpdates.website = data.website;
  if (data.pronouns !== undefined) publicUpdates.pronouns = data.pronouns;
  if (data.avatar !== undefined) publicUpdates.avatar = data.avatar;
  if (data.bannerUrl !== undefined) publicUpdates.bannerUrl = data.bannerUrl;
  if (data.username !== undefined) publicUpdates.username = data.username;
  publicUpdates.updatedAt = serverTimestamp();

  // 2. Sensitive fields to private subcollection
  const privateUpdates: Record<string, any> = {};
  if (data.email !== undefined) privateUpdates.email = data.email;
  if (data.blockedUsers !== undefined) privateUpdates.blockedUsers = data.blockedUsers;
  if (data.notificationPreferences !== undefined) privateUpdates.notificationPreferences = data.notificationPreferences;
  if (data.mediaPreferences !== undefined) privateUpdates.mediaPreferences = data.mediaPreferences;
  if (data.privateAccount !== undefined) privateUpdates.privateAccount = data.privateAccount;
  if (data.showOnlineStatus !== undefined) privateUpdates.showOnlineStatus = data.showOnlineStatus;
  if (data.allowReshare !== undefined) privateUpdates.allowReshare = data.allowReshare;
  if (data.themePreference !== undefined) privateUpdates.themePreference = data.themePreference;
  if (data.allowMessagesFrom !== undefined) privateUpdates.allowMessagesFrom = data.allowMessagesFrom;
  privateUpdates.updatedAt = serverTimestamp();

  const batch = writeBatch(db);
  if (Object.keys(publicUpdates).length > 1) {
    batch.update(userDocRef, publicUpdates);
  }
  if (Object.keys(privateUpdates).length > 1) {
    const privateRef = doc(db, USERS_COLLECTION, uid, 'private', 'settings');
    batch.set(privateRef, privateUpdates, { merge: true });
  }
  if (Object.keys(publicUpdates).length > 1 || Object.keys(privateUpdates).length > 1) {
    await batch.commit();
  }

  const cached = getCachedUsers();
  const idx = cached.findIndex((u) => u.id === uid);
  if (idx >= 0) {
    cached[idx] = { ...cached[idx], ...data };
    saveCachedUsers(cached);
  }
}

/**
 * Enrich user object with follow relationships relative to current user
 */
function enrichUserRelationships(user: User, currentUserProfile?: User | null): User {
  if (!currentUserProfile || user.id === currentUserProfile.id) {
    return user;
  }

  const currentFollowing = currentUserProfile.following || [];
  const currentFollowers = currentUserProfile.followers || [];
  const userFollowing = user.following || [];
  const userFollowers = user.followers || [];

  // Does current user follow this user?
  const isFollowing = currentFollowing.includes(user.id) || userFollowers.includes(currentUserProfile.id);

  // Does this user follow current user?
  const isFollower = currentFollowers.includes(user.id) || userFollowing.includes(currentUserProfile.id);

  const isMutual = Boolean(isFollowing && isFollower);

  return {
    ...user,
    isFollowing,
    isFollower,
    isMutual,
  };
}

/**
 * Real-time subscription to community users in Firestore
 */
export function subscribeToCommunityUsers(
  currentUid: string,
  onUpdate: (users: User[]) => void
): Unsubscribe {
  if (!currentUid || currentUid === 'guest_user') return () => {};

  try {
    const usersRef = collection(db, USERS_COLLECTION);
    return onSnapshot(
      usersRef,
      (snapshot) => {
        const users: User[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as User;
          const id = docSnap.id;
          const lowerId = id.toLowerCase();
          if (
            lowerId.startsWith('test_') ||
            lowerId.startsWith('mock_') ||
            lowerId.startsWith('demo_') ||
            lowerId.startsWith('creator_')
          ) {
            return;
          }
          if (id !== currentUid) {
            const rawAvatar = data.avatar;
            const cleanAvatar = isMockOrEmptyAvatar(rawAvatar) ? MODERN_EMPTY_AVATAR_DATA_URI : rawAvatar;
            users.push({
              ...data,
              id,
              avatar: cleanAvatar,
              bannerUrl: data.bannerUrl || '',
              followers: data.followers || [],
              following: data.following || [],
              followersCount: typeof data.followersCount === 'number' ? Math.max(0, data.followersCount) : (data.followers?.length || 0),
              followingCount: typeof data.followingCount === 'number' ? Math.max(0, data.followingCount) : (data.following?.length || 0),
            });
          }
        });
        saveCachedUsers(users);
        onUpdate(users);
      },
      (err) => console.warn('Community live sync note:', err)
    );
  } catch (err) {
    console.warn('Error subscribing to community users:', err);
    return () => {};
  }
}

/**
 * Get all registered community users (for search and initiating chats)
 */
export async function getAllUsers(excludeUid?: string, currentUid?: string): Promise<User[]> {
  let currentProfile: User | null = null;
  if (currentUid) {
    currentProfile = await getUserProfile(currentUid);
  }

  const mergedMap = new Map<string, User>();
  // Include existing cached real users
  getCachedUsers().forEach((u) => {
    if (!excludeUid || u.id !== excludeUid) {
      const cleanAvatar = isMockOrEmptyAvatar(u.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : u.avatar;
      mergedMap.set(u.id, { ...u, avatar: cleanAvatar });
    }
  });

  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);

    snap.forEach((docSnap) => {
      const data = docSnap.data() as User;
      const id = docSnap.id;

      // Purge any mock/test users
      const lowerId = id.toLowerCase();
      if (
        lowerId.startsWith('test_') ||
        lowerId.startsWith('mock_') ||
        lowerId.startsWith('demo_') ||
        lowerId.startsWith('creator_')
      ) {
        return;
      }

      if (!excludeUid || id !== excludeUid) {
        const rawAvatar = data.avatar;
        const cleanAvatar = isMockOrEmptyAvatar(rawAvatar) ? MODERN_EMPTY_AVATAR_DATA_URI : rawAvatar;
        const parsedUser: User = {
          ...data,
          id,
          avatar: cleanAvatar,
          bannerUrl: data.bannerUrl || '',
          followers: data.followers || [],
          following: data.following || [],
          followersCount: typeof data.followersCount === 'number' ? Math.max(0, data.followersCount) : (data.followers?.length || 0),
          followingCount: typeof data.followingCount === 'number' ? Math.max(0, data.followingCount) : (data.following?.length || 0),
        };
        mergedMap.set(id, parsedUser);
      }
    });

    const userList = Array.from(mergedMap.values());
    saveCachedUsers(userList);
    return userList.map((u) => enrichUserRelationships(u, currentProfile));
  } catch (error) {
    console.warn('Error getting all users from Firestore (using local cached members):', error);
    return Array.from(mergedMap.values()).map((u) => enrichUserRelationships(u, currentProfile));
  }
}

/**
 * Intelligent & Real Suggested Users to Follow
 * Prioritizes:
 * 1. Users who already follow current user ('isFollower', to follow back!)
 * 2. Active members with high follower or post activity
 * 3. Other community members
 */
export async function getSuggestedUsers(currentUid: string, limitCount = 6): Promise<User[]> {
  if (!currentUid) return [];
  try {
    const currentProfile = await getUserProfile(currentUid);
    if (!currentProfile) return [];

    const allUsers = await getAllUsers(currentUid, currentUid);

    // Filter out users that current user is already following
    const notFollowing = allUsers.filter((u) => !u.isFollowing);

    // Sort: Follow-back candidates first (users who follow current user), then by follower count
    notFollowing.sort((a, b) => {
      if (a.isFollower && !b.isFollower) return -1;
      if (!a.isFollower && b.isFollower) return 1;
      return (b.followersCount || 0) - (a.followersCount || 0);
    });

    // If fewer than limitCount not following, append others for discovery
    if (notFollowing.length < limitCount) {
      const alreadyFollowing = allUsers.filter((u) => u.isFollowing);
      return [...notFollowing, ...alreadyFollowing].slice(0, limitCount);
    }

    return notFollowing.slice(0, limitCount);
  } catch (err) {
    console.warn('Error getting suggested users:', err);
    return [];
  }
}

/**
 * Real Follow or Unfollow another user in Firestore
 * Updates both documents atomically with arrayUnion/arrayRemove and increment/decrement.
 */
export async function toggleFollowUser(
  currentUid: string,
  targetUid: string,
  currentlyFollowing: boolean,
  currentUser?: User
): Promise<{ isFollowing: boolean; newFollowersCount: number }> {
  if (!currentUid || !targetUid || currentUid === targetUid) {
    return { isFollowing: currentlyFollowing, newFollowersCount: 0 };
  }
  const currentUserRef = doc(db, USERS_COLLECTION, currentUid);
  const targetUserRef = doc(db, USERS_COLLECTION, targetUid);
  const result = await runTransaction(db, async (transaction) => {
    const currentSnapshot = await transaction.get(currentUserRef);
    const targetSnapshot = await transaction.get(targetUserRef);
    if (!currentSnapshot.exists() || !targetSnapshot.exists()) {
      throw new Error('The selected account could not be found. Refresh and try again.');
    }
    const currentData = currentSnapshot.data();
    const targetData = targetSnapshot.data();
    const following: string[] = Array.isArray(currentData.following) ? currentData.following : [];
    const followers: string[] = Array.isArray(targetData.followers) ? targetData.followers : [];
    const isFollowing = following.includes(targetUid);
    const targetHasFollower = followers.includes(currentUid);
    const desiredFollowing = !currentlyFollowing;
    if (isFollowing === desiredFollowing && targetHasFollower === desiredFollowing) {
      return { isFollowing, newFollowersCount: Number(targetData.followersCount || followers.length) };
    }
    // Repair a stale one-sided relationship rather than incrementing the counter twice.
    const shouldFollow = desiredFollowing;
    const nextFollowing = shouldFollow
      ? Array.from(new Set([...following, targetUid]))
      : following.filter((id) => id !== targetUid);
    const nextFollowers = shouldFollow
      ? Array.from(new Set([...followers, currentUid]))
      : followers.filter((id) => id !== currentUid);
    transaction.update(currentUserRef, {
      following: nextFollowing,
      followingCount: nextFollowing.length,
      updatedAt: serverTimestamp(),
    });
    transaction.update(targetUserRef, {
      followers: nextFollowers,
      followersCount: nextFollowers.length,
      updatedAt: serverTimestamp(),
    });
    return { isFollowing: shouldFollow, newFollowersCount: nextFollowers.length };
  });

  if (result.isFollowing && currentUser) {
    await createNotification(
      targetUid, currentUser, 'follow', 'started following your channel', targetUid, 'profile'
    ).catch((error) => console.warn('Follow was saved, but its notification could not be delivered:', error));
  }
  return result;
}

/**
 * Get list of followers for a user with follow relationships to viewer
 */
export async function getFollowersList(userId: string, currentUid?: string): Promise<User[]> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return [];

    const followerIds: string[] = snap.data().followers || [];
    if (followerIds.length === 0) return [];

    let currentProfile: User | null = null;
    if (currentUid) {
      currentProfile = await getUserProfile(currentUid);
    }

    const users: User[] = [];
    for (const fid of followerIds) {
      const u = await getUserProfile(fid);
      if (u) {
        users.push(enrichUserRelationships(u, currentProfile));
      }
    }
    return users;
  } catch (err) {
    console.warn('Error getting followers:', err);
    return [];
  }
}

/**
 * Get list of accounts followed by a user with follow relationships to viewer
 */
export async function getFollowingList(userId: string, currentUid?: string): Promise<User[]> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) return [];

    const followingIds: string[] = snap.data().following || [];
    if (followingIds.length === 0) return [];

    let currentProfile: User | null = null;
    if (currentUid) {
      currentProfile = await getUserProfile(currentUid);
    }

    const users: User[] = [];
    for (const fid of followingIds) {
      const u = await getUserProfile(fid);
      if (u) {
        users.push(enrichUserRelationships(u, currentProfile));
      }
    }
    return users;
  } catch (err) {
    console.warn('Error getting following list:', err);
    return [];
  }
}

/**
 * Block or Unblock a user
 */
export async function toggleBlockUser(
  currentUid: string,
  targetUid: string,
  currentlyBlocked: boolean
): Promise<void> {
  if (!currentUid || !targetUid || currentUid === targetUid) return;
  const privateRef = doc(db, USERS_COLLECTION, currentUid, 'private', 'settings');

  try {
    if (currentlyBlocked) {
      await setDoc(
        privateRef,
        {
          blockedUsers: arrayRemove(targetUid),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // Block: Add to the owner's private block list and remove the owner's outgoing follow edge.
      await setDoc(
        privateRef,
        {
          blockedUsers: arrayUnion(targetUid),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // Remove only the acting user's outgoing follow. The other account's own
      // following list cannot be edited by this client; the block privacy rule
      // prevents the blocked member from interacting with the blocker. 
      await toggleFollowUser(currentUid, targetUid, true);
    }
  } catch (err) {
    console.error('Block/unblock could not be saved:', err);
    throw err;
  }
}
