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

/**
 * Fetch a single user profile by UID
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  if (!uid) return null;
  try {
    const userDocRef = doc(db, USERS_COLLECTION, uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        ...data,
        id: snap.id,
        followers: data.followers || [],
        following: data.following || [],
        followersCount: typeof data.followersCount === 'number' ? Math.max(0, data.followersCount) : (data.followers?.length || 0),
        followingCount: typeof data.followingCount === 'number' ? Math.max(0, data.followingCount) : (data.following?.length || 0),
      } as User;
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

  await setDoc(
    userDocRef,
    {
      ...fullProfile,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return fullProfile;
}

/**
 * Update user profile fields
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
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);

    let currentProfile: User | null = null;
    if (currentUid) {
      currentProfile = await getUserProfile(currentUid);
    }

    const users: User[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as User;
      const id = docSnap.id;
      if (!excludeUid || id !== excludeUid) {
        const parsedUser: User = {
          ...data,
          id,
          followers: data.followers || [],
          following: data.following || [],
          followersCount: typeof data.followersCount === 'number' ? Math.max(0, data.followersCount) : (data.followers?.length || 0),
          followingCount: typeof data.followingCount === 'number' ? Math.max(0, data.followingCount) : (data.following?.length || 0),
        };
        users.push(enrichUserRelationships(parsedUser, currentProfile));
      }
    });

    return users;
  } catch (error) {
    console.warn('Error getting all users:', error);
    return [];
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
        'started following your studio'
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
