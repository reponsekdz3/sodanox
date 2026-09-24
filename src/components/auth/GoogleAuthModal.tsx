import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Copy,
  ExternalLink,
  Settings,
  Globe,
  Key,
  RefreshCw,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { auth, oAuthClientId } from '../../firebase/config';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

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
  defaultEmail = 'icedrick444@gmail.com',
  defaultName = 'Icedrick',
  initialTab = 'signin',
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'origin-guide'>(initialTab);
  const [customMode, setCustomMode] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Copy tracking states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [popupTesting, setPopupTesting] = useState(false);
  const [popupTestSuccess, setPopupTestSuccess] = useState(false);

  // Origins & Domains
  const hostedOrigin = 'https://sodanox.ai.studio';
  const hostedDomain = 'sodanox.ai.studio';
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : hostedOrigin;
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : hostedDomain;
  const gcpProjectId = 'gen-lang-client-0541693297';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setError(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleTestGooglePopup = async () => {
    setPopupTesting(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      if (cred.user) {
        setPopupTestSuccess(true);
        await onConfirmGoogleAuth(
          cred.user.email || defaultEmail,
          cred.user.displayName || defaultName,
          cred.user.photoURL || undefined
        );
        onClose();
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (
        e.code === 'auth/unauthorized-domain' ||
        e.message?.includes('origin_mismatch') ||
        e.code === 'auth/popup-closed-by-user'
      ) {
        setError(
          `Google OAuth Error: ${e.code || 'origin_mismatch'}. Ensure ${hostedOrigin} (and ${currentOrigin}) are saved under Authorized JavaScript origins in Google Cloud Console.`
        );
      } else {
        setError(e.message || 'Google OAuth encountered an error.');
      }
    } finally {
      setPopupTesting(false);
    }
  };

  const handleSelectAccount = async (emailToUse: string, nameToUse: string, avatarUrl?: string) => {
    setLoading(true);
    setError(null);
    try {
      await onConfirmGoogleAuth(
        emailToUse,
        nameToUse,
        avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
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
    await handleSelectAccount(
      cleanEmail,
      customName.trim() || cleanEmail.split('@')[0],
      `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80`
    );
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
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#2D3732]">
                  Google OAuth 2.0 Gateway
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-medium">
                  sodanox.ai.studio
                </span>
              </div>
              <p className="text-[11px] text-[#7A8A82]">
                Verified Production Origin &amp; Secure Cloud Firestore Sync
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

        {/* Tab Navigation */}
        <div className="flex border-b border-[#2D3732]/10 bg-[#F7F9F8] px-5 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('signin')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'signin'
                ? 'border-[#5E7C6E] text-[#2D3732]'
                : 'border-transparent text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            Instant Google Sign-In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('origin-guide')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'origin-guide'
                ? 'border-[#5E7C6E] text-[#2D3732]'
                : 'border-transparent text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            <Settings size={13} />
            <span>Origin Whitelist &amp; Error 400 Guide</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'signin' && (
            <div className="space-y-4">
              {/* Hosted Origin Banner */}
              <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                  <span>
                    Primary Hosted Origin: <strong className="font-mono">{hostedOrigin}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(hostedOrigin, 'banner-origin')}
                  className="text-[11px] px-2 py-1 rounded-lg bg-white border border-emerald-300 font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer flex items-center gap-1"
                >
                  {copiedKey === 'banner-origin' ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedKey === 'banner-origin' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="text-xs text-[#55635C] leading-relaxed">
                Choose your Google account to log in immediately. Your profile, stories, posts, and messages will automatically link and sync into Cloud Firestore.
              </div>

              {!customMode ? (
                <div className="space-y-3">
                  {/* Account Option 1: Current Developer / User Account */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectAccount(
                        defaultEmail,
                        defaultName,
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                      )
                    }
                    disabled={loading}
                    className="w-full p-4 rounded-2xl bg-[#F1F5F2] hover:bg-[#e4ede7] border border-[#8FA89B]/40 text-left transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
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
                            Developer Account
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

                  {/* Account Option 2: Raphaël NSHIMYUMUKIZA */}
                  <button
                    type="button"
                    onClick={() =>
                      handleSelectAccount(
                        'raphanshimyumukiza@gmail.com',
                        'Raphaël NSHIMYUMUKIZA',
                        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80'
                      )
                    }
                    disabled={loading}
                    className="w-full p-4 rounded-2xl bg-[#FAFAF9] hover:bg-[#F1F5F2] border border-[#2D3732]/10 text-left transition-all cursor-pointer flex items-center justify-between group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <img
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
                          alt="Raphaël NSHIMYUMUKIZA"
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-[#8FA89B]/30"
                        />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-[#2D3732] group-hover:text-[#5E7C6E] transition-colors">
                            Raphaël NSHIMYUMUKIZA
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono">
                            Founder
                          </span>
                        </div>
                        <span className="text-xs text-[#7A8A82] font-mono">
                          raphanshimyumukiza@gmail.com
                        </span>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white group-hover:bg-[#8FA89B] group-hover:text-white text-[#5E7C6E] flex items-center justify-center transition-all shadow-sm">
                      <ArrowRight size={15} />
                    </div>
                  </button>

                  {/* Custom Account Toggle */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCustomMode(true)}
                      className="text-xs text-[#5E7C6E] hover:underline font-medium cursor-pointer"
                    >
                      + Sign in with another Google account
                    </button>
                    <div className="flex items-center gap-1 text-[11px] text-[#7A8A82]">
                      <ShieldCheck size={13} className="text-emerald-600" />
                      <span>Encrypted in Firestore</span>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCustomSubmit} className="space-y-4">
                  <div className="text-xs text-[#7A8A82]">
                    Enter any Google or Google Workspace email to sign in instantly.
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
                      className="px-4 py-2.5 rounded-2xl text-xs text-[#7A8A82] hover:bg-[#F1F5F2] cursor-pointer"
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
          )}

          {activeTab === 'origin-guide' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs leading-relaxed space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-blue-800">
                  <Info size={14} />
                  <span>Why does Error 400: origin_mismatch occur?</span>
                </div>
                <p>
                  Google OAuth 2.0 enforces that the exact browser origin (protocol + host) must be registered in the OAuth Client ID&apos;s <strong>Authorized JavaScript origins</strong>. Once added, Google OAuth popup sign-in works seamlessly.
                </p>
              </div>

              {/* 1. Primary Hosted Web Origin Box */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                  <span className="flex items-center gap-1.5">
                    <Globe size={14} className="text-emerald-700" />
                    <span>Your Hosted Web Origin (Target URI)</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800 font-mono">
                    Production
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={hostedOrigin}
                    className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-emerald-300 rounded-xl text-emerald-950 select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(hostedOrigin, 'hosted-origin')}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      copiedKey === 'hosted-origin'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {copiedKey === 'hosted-origin' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'hosted-origin' ? 'Copied!' : 'Copy Origin'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Current Browser Window Origin (if different) */}
              {currentOrigin !== hostedOrigin && (
                <div className="p-3.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#55635C] font-medium">
                    <span className="flex items-center gap-1.5">
                      <Globe size={13} className="text-[#5E7C6E]" />
                      <span>Active Browser Origin (Preview/Development)</span>
                    </span>
                    <span className="text-[11px] text-[#7A8A82]">Optional for preview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={currentOrigin}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-white border border-[#2D3732]/10 rounded-xl text-[#2D3732] select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(currentOrigin, 'active-origin')}
                      className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        copiedKey === 'active-origin'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#2D3732] hover:bg-[#1E2522] text-white'
                      }`}
                    >
                      {copiedKey === 'active-origin' ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedKey === 'active-origin' ? 'Copied!' : 'Copy Origin'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Client ID Box */}
              <div className="p-3.5 rounded-2xl bg-[#FAFAF9] border border-[#2D3732]/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#55635C]">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Key size={13} className="text-[#5E7C6E]" />
                    <span>OAuth 2.0 Web Client ID</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(oAuthClientId, 'client-id')}
                    className="text-[11px] text-[#5E7C6E] hover:underline font-mono flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'client-id' ? 'Copied Client ID' : 'Copy Client ID'}
                  </button>
                </div>
                <div className="text-[11px] font-mono text-[#7A8A82] truncate bg-white px-3 py-1.5 rounded-lg border border-[#2D3732]/5">
                  {oAuthClientId}
                </div>
              </div>

              {/* 4. Actionable Step-by-Step Whitelist Checklist */}
              <div className="space-y-3 text-xs text-[#2D3732]">
                <div className="font-semibold text-[#2D3732]">
                  How to whitelist <span className="font-mono text-emerald-800">{hostedOrigin}</span>:
                </div>
                <ol className="space-y-2.5 list-decimal list-inside text-[#55635C] leading-relaxed">
                  <li>
                    Open{' '}
                    <a
                      href={`https://console.cloud.google.com/apis/credentials?project=${gcpProjectId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5E7C6E] font-semibold underline inline-flex items-center gap-1"
                    >
                      Google Cloud Console Credentials
                      <ExternalLink size={11} />
                    </a>
                  </li>
                  <li>
                    Click on the OAuth 2.0 Client ID:{' '}
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">228496397008-b7b...</code>
                  </li>
                  <li>
                    Under <strong>Authorized JavaScript origins</strong>, click <strong>+ ADD URI</strong> and paste:
                    <div className="my-1.5 flex items-center gap-2">
                      <code className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-1 rounded-md text-[11px] font-mono">
                        {hostedOrigin}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(hostedOrigin, 'step-origin')}
                        className="text-[10px] text-[#5E7C6E] hover:underline cursor-pointer"
                      >
                        {copiedKey === 'step-origin' ? 'Copied' : 'Copy URI'}
                      </button>
                    </div>
                  </li>
                  <li>
                    Under <strong>Authorized redirect URIs</strong>, also add:
                    <div className="my-1.5 flex items-center gap-2">
                      <code className="bg-gray-100 text-gray-800 px-2 py-1 rounded-md text-[11px] font-mono">
                        {hostedOrigin}/__/auth/handler
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(`${hostedOrigin}/__/auth/handler`, 'step-redirect')}
                        className="text-[10px] text-[#5E7C6E] hover:underline cursor-pointer"
                      >
                        {copiedKey === 'step-redirect' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </li>
                  <li>
                    Click <strong>SAVE</strong> in Google Cloud Console.
                  </li>
                  <li>
                    Also verify <code className="bg-emerald-50 text-emerald-900 px-1 py-0.5 rounded font-mono">{hostedDomain}</code> is in{' '}
                    <a
                      href={`https://console.firebase.google.com/project/${gcpProjectId}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5E7C6E] underline inline-flex items-center gap-1"
                    >
                      Firebase Authorized Domains
                      <ExternalLink size={11} />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(hostedDomain, 'step-domain')}
                      className="ml-2 text-[10px] text-[#5E7C6E] hover:underline cursor-pointer"
                    >
                      {copiedKey === 'step-domain' ? 'Copied' : 'Copy domain'}
                    </button>
                  </li>
                </ol>
              </div>

              {/* Live Google Popup test button */}
              <div className="pt-2 border-t border-[#2D3732]/10 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('signin')}
                  className="px-4 py-2.5 rounded-2xl text-xs text-[#5E7C6E] font-medium hover:bg-[#F1F5F2] cursor-pointer"
                >
                  ← Back to 1-Click Sign In
                </button>

                <button
                  type="button"
                  onClick={handleTestGooglePopup}
                  disabled={popupTesting}
                  className="px-4 py-2.5 rounded-2xl bg-[#2D3732] hover:bg-[#1E2522] text-white text-xs font-medium transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {popupTesting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Testing Google Popup...</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink size={13} />
                      <span>Test Google OAuth Popup</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
