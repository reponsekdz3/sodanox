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
  quickDemoLogin: (role: 'marcus' | 'clara' | 'soren' | 'guest') => Promise<void>;
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
      const res = await signInWithPopup(auth, provider);
      const fbUser = res.user;
      let profile = await getUserProfile(fbUser.uid);
      if (!profile) {
        profile = await createUserProfile(fbUser.uid, {
          name: fbUser.displayName || 'Aura Member',
          username: fbUser.email ? fbUser.email.split('@')[0] : `aura_${fbUser.uid.slice(0, 5)}`,
          avatar:
            fbUser.photoURL ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          bio: 'Exploring architecture, craft, and slow reflections on Aura.',
          email: fbUser.email || '',
        });
      }
      setUserProfile(profile);
    } catch (err) {
      console.error('Google Sign In Error:', err);
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

  const quickDemoLogin = async (role: 'marcus' | 'clara' | 'soren' | 'guest') => {
    setLoading(true);
    try {
      // Use test email credentials or anonymous auth
      const demoAccounts = {
        marcus: {
          email: 'marcus.lind@aurasocial.internal',
          pass: 'DemoAuraPass2026!',
          name: 'Marcus Lind',
          username: 'marcuslind',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          bio: 'Product designer & spatial acoustic engineer. Curious about tactile materials and ambient soundscapes.',
          location: 'Stockholm, Sweden',
          website: 'https://marcuslind.se',
        },
        clara: {
          email: 'clara.chen@aurasocial.internal',
          pass: 'DemoAuraPass2026!',
          name: 'Clara Chen',
          username: 'clarachen',
          avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
          bio: 'Ceramicist & studio maker. Shaping stoneware, unglazed clay, and slow functional objects for daily rituals.',
          location: 'Kyoto, Japan',
          website: 'https://studiochen.co',
        },
        soren: {
          email: 'soren.moller@aurasocial.internal',
          pass: 'DemoAuraPass2026!',
          name: 'Søren Møller',
          username: 'soren.studio',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
          bio: 'Slow coffee roaster & editorial sound archivist. Warm brew, quiet vinyl, tactile paper.',
          location: 'Aarhus, Denmark',
          website: 'https://soerenstudio.dk',
        },
        guest: {
          email: 'elena.rostova@aurasocial.internal',
          pass: 'DemoAuraPass2026!',
          name: 'Elena Rostova',
          username: 'elenarostova',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
          bio: 'Architectural photographer & design director. Exploring quiet geometry, tactile spaces, and Nordic daylight.',
          location: 'Copenhagen, Denmark',
          website: 'https://elenarostova.design',
        },
      };

      const account = demoAccounts[role];
      try {
        await signInWithEmailAndPassword(auth, account.email, account.pass);
      } catch (err: unknown) {
        // If account doesn't exist yet, create it
        const error = err as { code?: string };
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          try {
            const created = await createUserWithEmailAndPassword(auth, account.email, account.pass);
            await createUserProfile(created.user.uid, {
              ...account,
              joinedDate: 'Joined January 2026',
              followersCount: 120,
              followingCount: 35,
              verified: true,
            });
          } catch {
            // Fallback to anonymous sign-in if needed
            const anon = await signInAnonymously(auth);
            await createUserProfile(anon.user.uid, {
              ...account,
              joinedDate: 'Joined January 2026',
              followersCount: 120,
              followingCount: 35,
              verified: true,
            });
          }
        } else {
          // Fallback to anonymous
          const anon = await signInAnonymously(auth);
          await createUserProfile(anon.user.uid, {
            ...account,
            joinedDate: 'Joined January 2026',
            followersCount: 120,
            followingCount: 35,
            verified: true,
          });
        }
      }
    } finally {
      setLoading(false);
    }
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
        quickDemoLogin,
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
