import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile as updateFirebaseProfile,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User } from '../types';
import { createUserProfile, getUserProfile, updateUserProfile } from '../services/userService';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, profileData: Partial<User>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Listen to Firebase Auth state
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setCurrentUser(fbUser);

      if (fbUser) {
        // Fetch or create user profile in Firestore
        let profile = await getUserProfile(fbUser.uid);
        if (!profile) {
          const rawName = fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'Aura Member');
          const cleanUsername = (fbUser.email ? fbUser.email.split('@')[0] : `user_${fbUser.uid.slice(0, 5)}`)
            .toLowerCase()
            .replace(/[^a-z0-9_.]/g, '');

          profile = await createUserProfile(fbUser.uid, {
            name: rawName,
            username: cleanUsername,
            avatar:
              fbUser.photoURL ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            bio: 'Creator & design explorer on Aura.',
            email: fbUser.email || '',
            location: '',
            website: '',
          });
        }
        setUserProfile(profile);

        // Real-time listener on current user profile document
        const userDocRef = doc(db, 'users', fbUser.uid);
        unsubscribeProfile = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data() as User);
          }
        });
      } else {
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, pass: string, profileData: Partial<User>) => {
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateFirebaseProfile(res.user, {
        displayName: profileData.name || 'Member',
        photoURL: profileData.avatar || '',
      });

      const profile = await createUserProfile(res.user.uid, {
        ...profileData,
        email,
      });
      setUserProfile(profile);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      provider.addScope('profile');
      provider.addScope('email');
      
      const res = await signInWithPopup(auth, provider);
      const fbUser = res.user;
      let profile = await getUserProfile(fbUser.uid);
      if (!profile) {
        const highResPhoto = fbUser.photoURL
          ? fbUser.photoURL.replace('s96-c', 's400-c')
          : '';
        const baseUsername = fbUser.email
          ? fbUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '')
          : `aura_${fbUser.uid.slice(0, 5)}`;

        profile = await createUserProfile(fbUser.uid, {
          name: fbUser.displayName || 'Aura Member',
          username: baseUsername,
          avatar:
            highResPhoto ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          bio: 'Exploring design, craft, and quiet conversations on aura.ai.studio.',
          email: fbUser.email || '',
        });
      } else if (fbUser.photoURL && (!profile.avatar || profile.avatar.includes('unsplash.com'))) {
        const highResPhoto = fbUser.photoURL.replace('s96-c', 's400-c');
        await updateUserProfile(fbUser.uid, { avatar: highResPhoto });
        profile.avatar = highResPhoto;
      }
      setUserProfile(profile);
    } catch (err: unknown) {
      console.error('Google Sign In Error:', err);
      const authErr = err as { code?: string; message?: string };
      if (authErr.code === 'auth/popup-blocked') {
        throw new Error('Google Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (authErr.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Sign-in was cancelled before completion.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const signOutUser = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (!currentUser || !userProfile) return;
    await updateUserProfile(currentUser.uid, data);
    setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAuthenticated: !!currentUser,
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
