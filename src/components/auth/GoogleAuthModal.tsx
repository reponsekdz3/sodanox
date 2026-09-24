import React, { useState } from 'react';
import { X, Check, ShieldCheck, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { User } from '../../types';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmGoogleAuth: (email: string, name?: string, avatar?: string) => Promise<void>;
  defaultEmail?: string;
  defaultName?: string;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onConfirmGoogleAuth,
  defaultEmail = 'raphanshimyumukiza@gmail.com',
  defaultName = 'Raphaël Nshimyumukiza',
}) => {
  const [customMode, setCustomMode] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelectDefault = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirmGoogleAuth(
        defaultEmail,
        defaultName,
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
      );
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to authenticate with Google account.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = customEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Google account email.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onConfirmGoogleAuth(
        cleanEmail,
        customName.trim() || cleanEmail.split('@')[0],
        `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`
      );
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to authenticate with Google account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D3732]/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#2D3732]/10 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Google Logo */}
        <div className="p-6 border-b border-[#2D3732]/10 bg-[#FAFAF9] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
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
                Google Account Authentication
              </h3>
              <p className="text-[11px] text-[#7A8A82]">
                Sign in to Aura with Google &amp; Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9]/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {!customMode ? (
            <div className="space-y-4">
              <div className="text-xs text-[#7A8A82] leading-relaxed">
                Connect your verified Google Account to synchronize your posts, profile, and community connections into Cloud Firestore.
              </div>

              {/* Verified Account Card */}
              <button
                type="button"
                onClick={handleSelectDefault}
                disabled={loading}
                className="w-full p-4 rounded-2xl bg-[#F1F5F2] hover:bg-[#e4ede7] border border-[#8FA89B]/40 text-left transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
                      alt={defaultName}
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-[#8FA89B]/30"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center border-2 border-white">
                      <Check size={10} strokeWidth={3} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-[#2D3732] group-hover:text-[#5E7C6E] transition-colors">
                        {defaultName}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-mono">
                        Google Verified
                      </span>
                    </div>
                    <span className="text-xs text-[#7A8A82] font-mono">
                      {defaultEmail}
                    </span>
                  </div>
                </div>

                <div className="w-8 h-8 rounded-full bg-white group-hover:bg-[#8FA89B] group-hover:text-white text-[#5E7C6E] flex items-center justify-center transition-all shadow-sm">
                  <ArrowRight size={15} />
                </div>
              </button>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className="text-xs text-[#5E7C6E] hover:underline font-medium"
                >
                  Use a different Google Account
                </button>
                <div className="flex items-center gap-1 text-[11px] text-[#7A8A82]">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  <span>Encrypted via Firestore</span>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div className="text-xs text-[#7A8A82]">
                Enter any Google account to sign in and provision your profile in Firestore.
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D3732] mb-1.5">
                  Google Email Address
                </label>
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="your.name@gmail.com"
                  required
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 text-xs text-[#2D3732] focus:outline-none focus:ring-2 focus:ring-[#8FA89B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2D3732] mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Marie Claire"
                  className="w-full px-4 py-2.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 text-xs text-[#2D3732] focus:outline-none focus:ring-2 focus:ring-[#8FA89B]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setCustomMode(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs text-[#7A8A82] hover:bg-[#F1F5F2]"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-2xl bg-[#2D3732] hover:bg-[#1E2522] text-white text-xs font-medium transition-all shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Authenticate Google Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
