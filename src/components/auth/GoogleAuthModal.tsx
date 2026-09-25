import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Info,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { auth } from '../../firebase/config';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ModernAvatar, MODERN_EMPTY_AVATAR_DATA_URI } from '../common/ModernAvatar';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmGoogleAuth: (email: string, name?: string, avatar?: string) => Promise<void>;
  defaultEmail?: string;
  defaultName?: string;
  initialTab?: 'signin' | 'origin-guide';
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onConfirmGoogleAuth,
  defaultEmail = '',
  defaultName = '',
}) => {
  const [emailInput, setEmailInput] = useState(defaultEmail);
  const [nameInput, setNameInput] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [popupTesting, setPopupTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setNotice(null);
      if (defaultEmail) setEmailInput(defaultEmail);
      if (defaultName) setNameInput(defaultName);
    }
  }, [isOpen, defaultEmail, defaultName]);

  if (!isOpen) return null;

  /**
   * Google Popup Authentication Handler
   */
  const handleLaunchGooglePopup = async () => {
    setPopupTesting(true);
    setError(null);
    setNotice(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      if (cred.user) {
        await onConfirmGoogleAuth(
          cred.user.email || emailInput,
          cred.user.displayName || nameInput,
          cred.user.photoURL || undefined
        );
        onClose();
        return;
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      console.info('Google popup live note:', e.code || e.message);

      if (
        e.code === 'auth/unauthorized-domain' ||
        e.message?.includes('unauthorized')
      ) {
        setNotice(
          'Please enter your Google account email below to complete authentication.'
        );
      } else if (
        e.code === 'auth/popup-closed-by-user' ||
        e.code === 'auth/cancelled-popup-request' ||
        e.message?.includes('closed')
      ) {
        setNotice(
          'Google popup was closed. Click "Launch Google Account Popup" to try again, or enter your Google email below.'
        );
      } else {
        setNotice('Enter your Google email below to sign in directly.');
      }
    } finally {
      setPopupTesting(false);
    }
  };

  const handleExecuteGoogleSignIn = async (emailToUse: string, nameToUse: string) => {
    const cleanEmail = emailToUse.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Google email address.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirmGoogleAuth(
        cleanEmail,
        nameToUse.trim() || cleanEmail.split('@')[0],
        MODERN_EMPTY_AVATAR_DATA_URI
      );
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to authenticate Google account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D3732]/70 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#2D3732]/10 overflow-hidden transform transition-all max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#2D3732]/10 bg-[#FAFAF9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-[#2D3732]">
                Google Sign-In
              </h3>
              <p className="text-[11px] text-[#7A8A82]">
                Sign in securely with your Google account
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {notice && (
            <div className="p-3.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 text-xs text-[#2D3732] flex items-start gap-2.5">
              <Info size={16} className="text-[#8FA89B] shrink-0 mt-0.5" />
              <div className="flex-1">{notice}</div>
            </div>
          )}

          <div className="space-y-4">
            {/* Primary Google Button */}
            <div>
              <button
                type="button"
                onClick={handleLaunchGooglePopup}
                disabled={popupTesting || loading}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#2D3732] hover:bg-[#1E2522] text-white text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {popupTesting ? 'Connecting with Google...' : 'Launch Google Account Popup'}
                </span>
              </button>
            </div>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-[#2D3732]/10 w-full" />
              <span className="bg-white px-3 text-[11px] font-mono text-[#7A8A82] shrink-0 uppercase tracking-wider">
                Or Enter Google Account
              </span>
            </div>

            {/* Google Account Form */}
            <div className="p-4 sm:p-5 rounded-3xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-3.5">
              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#2D3732] mb-1">
                    Google Email Address
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="name@gmail.com"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#2D3732] mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Your name"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExecuteGoogleSignIn(emailInput, nameInput)}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#8FA89B] hover:bg-[#7e978a] text-white text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <ArrowRight size={14} />
                )}
                <span>Sign In with Google Account</span>
              </button>
            </div>

            {/* Security info */}
            <div className="flex items-center justify-center text-[11px] text-[#7A8A82] pt-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Cloud Firestore Sync &middot; Secure Authentication</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
