import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User } from '../types';
import { getUserProfile, updateUserProfile, createUserProfile } from '../services/userService';
import { MODERN_EMPTY_AVATAR_DATA_URI } from '../components/common/ModernAvatar';
import {
  registerAccount,
  authenticateAccount,
  resetAccountPassword,
  normalizeAuthIdentifier,
} from '../services/authStorageService';
import {
  authenticateWithGoogle,
  syncGoogleProfileWithFirestore,
  GoogleUserProfile,
} from '../services/googleAuthService';

export type AuraAuthUser = FirebaseUser | {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
};

interface AuthContextType {
  currentUser: AuraAuthUser | null;
  userProfile: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (identifier: string, pass: string) => Promise<void>;
  signUp: (identifier: string, pass: string, profileData: Partial<User>) => Promise<void>;
  signInWithGoogle: (googleIdToken?: string) => Promise<User>;
  sendPasswordReset: (identifier: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'aura_cached_user_profile';
const SESSION_UID_KEY = 'aura_active_session_uid';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuraAuthUser | null>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const p = JSON.parse(cached);
        return {
          uid: p.id,
          email: p.email,
          displayName: p.name,
          photoURL: p.avatar,
        };
      }
      return null;
    } catch {
      return null;
    }
  });

  const [userProfile, setUserProfile] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(LOCAL_STORAGE_KEY) && !localStorage.getItem(SESSION_UID_KEY);
    } catch {
      return false;
    }
  });

  const isRegisteringRef = useRef(false);

  // Restore active session on mount with max safety timeout
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 1200);

    const savedUid = localStorage.getItem(SESSION_UID_KEY);
    if (savedUid) {
      getUserProfile(savedUid)
        .then(async (profile) => {
          if (profile?.isSuspended) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            localStorage.removeItem(SESSION_UID_KEY);
            setUserProfile(null);
            setCurrentUser(null);
            return;
          }
          if (profile) {
            setUserProfile(profile);
            setCurrentUser({
              uid: profile.id,
              email: profile.email,
              displayName: profile.name,
              photoURL: profile.avatar,
            });
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
          }
        })
        .catch((e) => console.warn('Saved session restore note:', e))
        .finally(() => {
          clearTimeout(safetyTimeout);
          setLoading(false);
        });
    } else {
      clearTimeout(safetyTimeout);
      setLoading(false);
    }

    return () => clearTimeout(safetyTimeout);
  }, []);

  // Listen for realtime updates to current user profile doc
  useEffect(() => {
    const uid = currentUser?.uid || userProfile?.id;
    if (!uid) return;

    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const updated = { ...snap.data(), id: snap.id } as User;
          if (updated.isSuspended) {
            setUserProfile(null);
            setCurrentUser(null);
            try {
              localStorage.removeItem(LOCAL_STORAGE_KEY);
              localStorage.removeItem(SESSION_UID_KEY);
            } catch {
              // Browser storage may be unavailable in private mode.
            }
            if (auth.currentUser) void fbSignOut(auth).catch(() => {});
            return;
          }
          setUserProfile(updated);
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // Storage quota safe
          }
        }
      },
      (err) => {
        console.warn('Realtime profile sync note:', err?.message);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, userProfile?.id]);

  // Optional Firebase Auth state listener (if auth service is enabled in environment)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      // If user is anonymous (session helper for firestore rules), NEVER overwrite the real user profile!
      if (!fbUser || fbUser.isAnonymous || isRegisteringRef.current) {
        return;
      }

      localStorage.setItem(SESSION_UID_KEY, fbUser.uid);
      setCurrentUser(fbUser);
      let profile = await getUserProfile(fbUser.uid);
      if (!profile) {
        try {
          const synced = await syncGoogleProfileWithFirestore({
            uid: fbUser.uid,
            email: fbUser.email || '',
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google Creator',
            picture: fbUser.photoURL || undefined,
            email_verified: fbUser.emailVerified,
          });
          profile = synced.user;
        } catch (e) {
          console.warn('Profile auto-creation on auth state change note:', e);
        }
      }
      if (profile) {
        setUserProfile(profile);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      }
    });

    return () => unsubscribeAuth();
  }, []);

  /**
   * Real Phone Number or Email Sign In
   */
  const signIn = async (identifier: string, pass: string) => {
    setLoading(true);
    const norm = normalizeAuthIdentifier(identifier);
    try {
      // 1. Try Firebase Auth (with normalized firebase email)
      let authUser: FirebaseUser | null = null;
      try {
        const res = await signInWithEmailAndPassword(auth, norm.firebaseEmail, pass);
        if (res.user) {
          authUser = res.user;
        }
      } catch (fbErr: any) {
        // Fall through to Firestore credentials registry seamlessly
      }

      if (authUser) {
        const uid = authUser.uid;
        localStorage.setItem(SESSION_UID_KEY, uid);
        setCurrentUser(authUser);
        let profile = await getUserProfile(uid);
        if (profile?.isSuspended) {
          await fbSignOut(auth).catch(() => {});
          setCurrentUser(null); setUserProfile(null);
          throw new Error('This account has been suspended. Contact platform support if you believe this is a mistake.');
        }
        if (!profile) {
          const now = new Date();
          const cleanUser = norm.type === 'email' ? norm.cleanValue.split('@')[0] : `user_${norm.cleanValue.replace(/\D/g, '').slice(-6)}`;
          profile = {
            id: uid,
            name: authUser.displayName || (norm.type === 'email' ? norm.cleanValue.split('@')[0] : `Member ${norm.cleanValue.slice(-4)}`),
            username: cleanUser.toLowerCase().replace(/[^a-z0-9_.]/g, ''),
            avatar: authUser.photoURL || MODERN_EMPTY_AVATAR_DATA_URI,
            bannerUrl: '',
            bio: 'Mindful creator on Aura.',
            pronouns: '',
            location: '',
            website: '',
            joinedDate: `Joined ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`,
            followersCount: 0,
            followingCount: 0,
            followers: [],
            following: [],
            isFollowing: false,
            isFollower: false,
            isMutual: false,
            verified: false,
            email: norm.type === 'email' ? norm.cleanValue : norm.firebaseEmail,
            phone: norm.type === 'phone' ? norm.cleanValue : undefined,
            privateAccount: false,
            showOnlineStatus: true,
            allowReshare: true,
            themePreference: 'nordic',
          };
          await createUserProfile(uid, profile).catch(() => {});
        }
        setUserProfile(profile);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
        return;
      }

      // 2. Authenticate through local/Firestore credentials registry
      const { uid, profile } = await authenticateAccount(identifier, pass);
      if (profile.isSuspended) throw new Error('This account has been suspended. Contact platform support if you believe this is a mistake.');

      // Ensure Firebase Auth session exists so firestore.rules (isSignedIn()) allow writes
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch {
          // Non-fatal if offline
        }
      }

      localStorage.setItem(SESSION_UID_KEY, uid);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      setUserProfile(profile);
      setCurrentUser({
        uid,
        email: profile.email || norm.firebaseEmail,
        displayName: profile.name,
        photoURL: profile.avatar,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Real Phone Number or Email Registration
   */
  const signUp = async (identifier: string, pass: string, profileData: Partial<User>) => {
    isRegisteringRef.current = true;
    setLoading(true);
    const norm = normalizeAuthIdentifier(identifier);
    try {
      let createdUid: string | undefined = undefined;
      // Attempt Firebase Auth registration
      try {
        const res = await createUserWithEmailAndPassword(auth, norm.firebaseEmail, pass);
        if (res?.user?.uid) {
          createdUid = res.user.uid;
        }
      } catch (fbErr: any) {
        if (fbErr?.code === 'auth/email-already-in-use') {
          try {
            const signInRes = await signInWithEmailAndPassword(auth, norm.firebaseEmail, pass);
            if (signInRes?.user?.uid) {
              createdUid = signInRes.user.uid;
            }
          } catch {
            throw new Error(`This ${norm.type === 'phone' ? 'phone number' : 'email'} is already registered. Please sign in instead.`);
          }
        } else {
          // If email provider is restricted, create anonymous auth session so rules pass
          try {
            if (!auth.currentUser) {
              const anonRes = await signInAnonymously(auth);
              createdUid = anonRes.user.uid;
            } else {
              createdUid = auth.currentUser.uid;
            }
          } catch {
            // Local fallback
          }
        }
      }

      // Register user account and store public profile in Firestore
      const { uid, profile } = await registerAccount(identifier, pass, profileData, createdUid);

      localStorage.setItem(SESSION_UID_KEY, uid);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      setUserProfile(profile);
      setCurrentUser({
        uid,
        email: profile.email || norm.firebaseEmail,
        displayName: profile.name,
        photoURL: profile.avatar,
      });
    } finally {
      isRegisteringRef.current = false;
      setLoading(false);
    }
  };

  /**
   * Real Google Sign-In & Sign-Up with Firebase Auth & Firestore synchronization:
   * Supports both interactive popup and Google Identity Services credential token
   */
  const signInWithGoogle = async (googleIdToken?: string): Promise<User> => {
    setLoading(true);
    try {
      const googleProfile = await authenticateWithGoogle(googleIdToken);

      if (!googleProfile || !googleProfile.email) {
        throw new Error('Google sign-in did not complete.');
      }

      // Sync and persist verified Google account in Firestore
      const { user } = await syncGoogleProfileWithFirestore(googleProfile);
      if (user.isSuspended) {
        await fbSignOut(auth).catch(() => {});
        throw new Error('This account has been suspended. Contact platform support if you believe this is a mistake.');
      }

      localStorage.setItem(SESSION_UID_KEY, user.id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
      setUserProfile(user);
      if (auth.currentUser) {
        setCurrentUser(auth.currentUser);
      } else {
        setCurrentUser({
          uid: user.id,
          email: user.email,
          displayName: user.name,
          photoURL: user.avatar,
          emailVerified: true,
        });
      }

      return user;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (identifier: string) => {
    const norm = normalizeAuthIdentifier(identifier);
    try {
      if (norm.type === 'email') {
        await sendPasswordResetEmail(auth, norm.cleanValue);
      } else {
        await resetAccountPassword(norm.cleanValue, 'AuraReset2026!');
      }
    } catch {
      // In-app fallback password reset
      await resetAccountPassword(norm.cleanValue, 'AuraReset2026!');
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Signout note:', e);
    }
    localStorage.removeItem(SESSION_UID_KEY);
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setCurrentUser(null);
    setUserProfile(null);
    setLoading(false);
  };

  const updateUser = async (data: Partial<User>) => {
    const uid = currentUser?.uid || userProfile?.id;
    if (!uid) return;
    await updateUserProfile(uid, data);
    setUserProfile((prev) => {
      const updated = prev ? { ...prev, ...data } : null;
      if (updated) {
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Safe
        }
      }
      return updated;
    });
  };

  const isAuthenticated = Boolean(currentUser || userProfile);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAuthenticated,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        sendPasswordReset,
        signOutUser,
        signOut: signOutUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
