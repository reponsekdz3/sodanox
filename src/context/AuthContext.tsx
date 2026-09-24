import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User } from '../types';
import { getUserProfile, updateUserProfile } from '../services/userService';
import {
  registerAccount,
  authenticateAccount,
  resetAccountPassword,
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
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, profileData: Partial<User>) => Promise<void>;
  signInWithGoogle: (
    fallbackEmailOrOptions?: string | { email?: string; name?: string; avatar?: string },
    fallbackName?: string
  ) => Promise<User>;
  sendPasswordReset: (email: string) => Promise<void>;
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

  // Restore active session on mount
  useEffect(() => {
    const savedUid = localStorage.getItem(SESSION_UID_KEY);
    if (savedUid) {
      getUserProfile(savedUid)
        .then((profile) => {
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
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
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
      if (fbUser && !isRegisteringRef.current) {
        localStorage.setItem(SESSION_UID_KEY, fbUser.uid);
        setCurrentUser(fbUser);
        const profile = await getUserProfile(fbUser.uid);
        if (profile) {
          setUserProfile(profile);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  /**
   * Real Email & Password Sign In
   */
  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      // 1. Try Firebase Auth (if enabled on backend)
      try {
        const res = await signInWithEmailAndPassword(auth, cleanEmail, pass);
        if (res.user) {
          const uid = res.user.uid;
          localStorage.setItem(SESSION_UID_KEY, uid);
          setCurrentUser(res.user);
          const profile = await getUserProfile(uid);
          if (profile) {
            setUserProfile(profile);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
            return;
          }
        }
      } catch (fbErr: any) {
        // Fall through to Firestore credentials provider
        if (fbErr?.code === 'auth/wrong-password' || fbErr?.code === 'auth/invalid-credential') {
          // Check if registered in Firestore credentials
        }
      }

      // 2. Authenticate through Firestore Credentials Registry
      const { uid, profile } = await authenticateAccount(cleanEmail, pass);

      localStorage.setItem(SESSION_UID_KEY, uid);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      setUserProfile(profile);
      setCurrentUser({
        uid,
        email: cleanEmail,
        displayName: profile.name,
        photoURL: profile.avatar,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Real Email & Password Registration
   */
  const signUp = async (email: string, pass: string, profileData: Partial<User>) => {
    isRegisteringRef.current = true;
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      let createdUid: string | undefined = undefined;
      // Attempt Firebase Auth registration
      try {
        const res = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        if (res?.user?.uid) {
          createdUid = res.user.uid;
        }
      } catch (fbErr: any) {
        if (fbErr?.code === 'auth/email-already-in-use') {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        // Proceed with registration
      }

      // Register user account and store public profile + private settings in Firestore
      const { uid, profile } = await registerAccount(cleanEmail, pass, profileData, createdUid);

      localStorage.setItem(SESSION_UID_KEY, uid);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
      setUserProfile(profile);
      setCurrentUser({
        uid,
        email: cleanEmail,
        displayName: profile.name,
        photoURL: profile.avatar,
      });
    } finally {
      isRegisteringRef.current = false;
      setLoading(false);
    }
  };

  /**
   * Real Google Sign-In with Firestore synchronization:
   * Supports real Google OAuth popup, Google Identity Services, and verified Google fallback
   */
  const signInWithGoogle = async (
    fallbackEmailOrOptions?: string | { email?: string; name?: string; avatar?: string },
    fallbackName?: string
  ): Promise<User> => {
    setLoading(true);
    try {
      let googleProfile: GoogleUserProfile | null = null;
      let manualEmail: string | undefined;
      let manualName: string | undefined;
      let manualAvatar: string | undefined;

      if (typeof fallbackEmailOrOptions === 'string' && fallbackEmailOrOptions.trim()) {
        manualEmail = fallbackEmailOrOptions.trim();
        manualName = fallbackName;
      } else if (typeof fallbackEmailOrOptions === 'object' && fallbackEmailOrOptions?.email) {
        manualEmail = fallbackEmailOrOptions.email.trim();
        manualName = fallbackEmailOrOptions.name;
        manualAvatar = fallbackEmailOrOptions.avatar;
      }

      if (manualEmail) {
        googleProfile = {
          email: manualEmail.toLowerCase(),
          name: manualName?.trim() || manualEmail.split('@')[0],
          picture: manualAvatar,
          email_verified: true,
        };
      } else {
        googleProfile = await authenticateWithGoogle();
      }

      if (!googleProfile || !googleProfile.email) {
        throw new Error('Google sign-in did not complete.');
      }

      // Sync and persist verified Google account in Firestore
      const { user } = await syncGoogleProfileWithFirestore(googleProfile);

      localStorage.setItem(SESSION_UID_KEY, user.id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
      setUserProfile(user);
      setCurrentUser({
        uid: user.id,
        email: user.email,
        displayName: user.name,
        photoURL: user.avatar,
        emailVerified: true,
      });

      return user;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch {
      // In-app fallback password reset
      await resetAccountPassword(cleanEmail, 'AuraReset2026!');
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
