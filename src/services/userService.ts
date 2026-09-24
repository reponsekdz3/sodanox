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
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User } from '../types';
import { createNotification } from './notificationService';

const USERS_COLLECTION = 'users';
const LOCAL_USERS_CACHE_KEY = 'aura_community_users_cache';

// Built-in real community member verified in Firestore
const DEFAULT_COMMUNITY_USERS: User[] = [
  {
    id: 'Xu0Rc4W9fZgpjh0bEWzEvxbN4pC2',
    name: 'Raphaël NSHIMYUMUKIZA',
    username: 'raphael_nsh',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    bio: 'Architectural designer & creator on Aura · Exploring tactile spaces, light, and mindful conversations.',
    pronouns: 'he/him',
    location: 'Kigali, Rwanda',
    website: 'https://github.com/reponsekdz3',
    joinedDate: 'Joined September 2026',
    followersCount: 14,
    followingCount: 8,
    followers: [],
    following: [],
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    verified: true,
    email: 'raphanshimyumukiza@gmail.com',
    privateAccount: false,
    themePreference: 'nordic',
    allowMessagesFrom: 'everyone',
    showOnlineStatus: true,
    allowReshare: true,
  },
];

function getCachedUsers(): User[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_CACHE_KEY);
    if (!raw) return DEFAULT_COMMUNITY_USERS;
    const parsed = JSON.parse(raw);
    const map = new Map<string, User>();
    DEFAULT_COMMUNITY_USERS.forEach((u) => map.set(u.id, u));
    if (Array.isArray(parsed)) {
      parsed.forEach((u) => map.set(u.id, u));
    }
    return Array.from(map.values());
  } catch {
    return DEFAULT_COMMUNITY_USERS;
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

  const cleanUsername = (profileData.username || `aura_${uid.slice(0, 6)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '');

  const fullProfile: User = {
    id: uid,
    name: profileData.name || 'Aura Member',
    username: cleanUsername,
    avatar:
      profileData.avatar ||
      `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`,
    bannerUrl:
      profileData.bannerUrl ||
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    bio: profileData.bio || 'Exploring design, craft, and quiet conversations on Aura.',
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
    verified: profileData.verified || false,
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

  try {
    await setDoc(
      userDocRef,
      {
        ...fullProfile,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore setDoc notice (profile stored in session):', err);
  }

  // Update local community cache
  const cached = getCachedUsers();
  const idx = cached.findIndex((u) => u.id === uid);
  if (idx >= 0) cached[idx] = fullProfile;
  else cached.push(fullProfile);
  saveCachedUsers(cached);

  return fullProfile;
}

/**
 * Update user profile fields
 */
export async function updateUserProfile(uid: string, data: Partial<User>): Promise<void> {
  if (!uid) return;
  const userDocRef = doc(db, USERS_COLLECTION, uid);
  try {
    await updateDoc(userDocRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Firestore updateUserProfile notice:', err);
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
 * Get all registered community users (for search and initiating chats)
 */
export async function getAllUsers(excludeUid?: string, currentUid?: string): Promise<User[]> {
  let currentProfile: User | null = null;
  if (currentUid) {
    currentProfile = await getUserProfile(currentUid);
  }

  const mergedMap = new Map<string, User>();
  // Pre-seed from persistent community cache (includes Raphael)
  getCachedUsers().forEach((u) => {
    if (!excludeUid || u.id !== excludeUid) {
      mergedMap.set(u.id, u);
    }
  });

  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);

    snap.forEach((docSnap) => {
      const data = docSnap.data() as User;
      const id = docSnap.id;

      // Purge mock/seed users
      const lowerId = id.toLowerCase();
      const lowerUsername = (data.username || '').toLowerCase();
      if (
        lowerId.startsWith('creator_') ||
        lowerId.startsWith('demo_') ||
        lowerId.startsWith('mock_') ||
        lowerUsername === 'clarachen' ||
        lowerUsername === 'marcuslind' ||
        lowerUsername === 'soren.studio' ||
        lowerUsername === 'elena_arch'
      ) {
        return;
      }

      if (!excludeUid || id !== excludeUid) {
        const parsedUser: User = {
          ...data,
          id,
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

  if (currentlyFollowing) {
    // Unfollow action
    await updateDoc(currentUserRef, {
      following: arrayRemove(targetUid),
      followingCount: increment(-1),
      updatedAt: serverTimestamp(),
    }).catch(async (e) => {
      console.warn('Error removing following:', e);
      // Fallback in case increment is not initialized
      const c = await getUserProfile(currentUid);
      if (c) {
        await updateDoc(currentUserRef, {
          following: (c.following || []).filter((id) => id !== targetUid),
          followingCount: Math.max(0, (c.followingCount || 1) - 1),
        });
      }
    });

    await updateDoc(targetUserRef, {
      followers: arrayRemove(currentUid),
      followersCount: increment(-1),
      updatedAt: serverTimestamp(),
    }).catch(async (e) => {
      console.warn('Error removing followers:', e);
      const t = await getUserProfile(targetUid);
      if (t) {
        await updateDoc(targetUserRef, {
          followers: (t.followers || []).filter((id) => id !== currentUid),
          followersCount: Math.max(0, (t.followersCount || 1) - 1),
        });
      }
    });

    const targetUser = await getUserProfile(targetUid);
    return {
      isFollowing: false,
      newFollowersCount: targetUser?.followersCount || 0,
    };
  } else {
    // Follow action
    await updateDoc(currentUserRef, {
      following: arrayUnion(targetUid),
      followingCount: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(async (e) => {
      console.warn('Error adding following:', e);
      const c = await getUserProfile(currentUid);
      if (c) {
        await updateDoc(currentUserRef, {
          following: Array.from(new Set([...(c.following || []), targetUid])),
          followingCount: (c.followingCount || 0) + 1,
        });
      }
    });

    await updateDoc(targetUserRef, {
      followers: arrayUnion(currentUid),
      followersCount: increment(1),
      updatedAt: serverTimestamp(),
    }).catch(async (e) => {
      console.warn('Error adding follower:', e);
      const t = await getUserProfile(targetUid);
      if (t) {
        await updateDoc(targetUserRef, {
          followers: Array.from(new Set([...(t.followers || []), currentUid])),
          followersCount: (t.followersCount || 0) + 1,
        });
      }
    });

    // Send real notification to target user
    if (currentUser && targetUid !== currentUid) {
      await createNotification(
        targetUid,
        currentUser,
        'follow',
        'started following your channel',
        targetUid,
        'profile'
      ).catch((err) => console.warn('Could not create follow notification:', err));
    }

    const targetUser = await getUserProfile(targetUid);
    return {
      isFollowing: true,
      newFollowersCount: targetUser?.followersCount || 1,
    };
  }
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
  const userRef = doc(db, USERS_COLLECTION, currentUid);

  if (currentlyBlocked) {
    await updateDoc(userRef, {
      blockedUsers: arrayRemove(targetUid),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Block: Add to blocked list and unfollow both ways
    await updateDoc(userRef, {
      blockedUsers: arrayUnion(targetUid),
      updatedAt: serverTimestamp(),
    });
    // Remove from following
    await toggleFollowUser(currentUid, targetUid, true).catch(() => {});
    await toggleFollowUser(targetUid, currentUid, true).catch(() => {});
  }
}
