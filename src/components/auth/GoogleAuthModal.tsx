import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getCurrentDomainInfo, GoogleAuthErrorInfo } from '../../services/googleAuthService';
import { oAuthClientId } from '../../firebase/config';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialError?: GoogleAuthErrorInfo | Error | null;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialError,
}) => {
  const { signInWithGoogle } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const gsiContainerRef = useRef<HTMLDivElement>(null);

  const domainInfo = getCurrentDomainInfo();
  const errCode = (initialError as GoogleAuthErrorInfo)?.code || '';
  const isUnauthorizedDomain =
    errCode === 'auth/unauthorized-domain' ||
    initialError?.message?.includes('unauthorized-domain') ||
    initialError?.message?.includes('not authorized');

  const isPopupBlocked =
    errCode === 'auth/popup-blocked' ||
    initialError?.message?.includes('popup-blocked') ||
    initialError?.message?.includes('blocked');

  useEffect(() => {
    if (isOpen) {
      setActionError(null);
      setCopied(false);

      // Render official Google Identity Services button if script is available
      if (typeof window !== 'undefined' && window.google?.accounts?.id && gsiContainerRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: oAuthClientId,
            callback: async (response: { credential?: string }) => {
              if (response.credential) {
                setIsRetrying(true);
                setActionError(null);
                try {
                  await signInWithGoogle(response.credential);
                  onSuccess?.();
                  onClose();
                } catch (e: any) {
                  setActionError(e?.message || 'Google authentication failed.');
                } finally {
                  setIsRetrying(false);
                }
              }
            },
          });

          gsiContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(gsiContainerRef.current, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'continue_with',
            shape: 'pill',
            width: 320,
          });
        } catch {
          // Non-fatal if GSI button cannot be rendered
        }
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyDomain = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(domainInfo.hostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleRetryPopup = async () => {
    setIsRetrying(true);
    setActionError(null);
    try {
      await signInWithGoogle();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.warn('Retry Google sign-in note:', err);
      setActionError(err?.message || 'Authentication was not completed.');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleOpenDirectWindow = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D3732]/70 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-[#2D3732]/10 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#2D3732]/10 bg-[#FAFAF9] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white shadow-xs border border-[#2D3732]/10 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-[#2D3732]">
                Google Sign-In & Sign-Up
              </h3>
              <p className="text-[11px] text-[#7A8A82]">
                Firebase Authentication & Verified Cloud Firestore Sync
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {actionError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{actionError}</div>
            </div>
          )}

          {/* Diagnosis 1: Unauthorized Domain */}
          {isUnauthorizedDomain ? (
            <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200/80 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-amber-900">
                    Domain Authorization Required in Firebase
                  </h4>
                  <p className="text-[12px] text-amber-800 mt-1 leading-relaxed">
                    Google OAuth requires adding your app's web domain to the <strong>Authorized domains</strong> list in your Firebase project.
                  </p>
                </div>
              </div>

              {/* Current Domain Box with 1-Click Copy */}
              <div className="p-3.5 rounded-2xl bg-white border border-amber-300/80 flex items-center justify-between gap-3 shadow-xs">
                <div className="truncate">
                  <span className="text-[10px] uppercase font-mono text-[#7A8A82] block tracking-wider">
                    Your Current Domain
                  </span>
                  <code className="text-xs font-mono font-medium text-[#2D3732] select-all">
                    {domainInfo.hostname}
                  </code>
                </div>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="px-3 py-1.5 rounded-xl bg-[#2D3732] hover:bg-[#3d4a43] text-white text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
                >
                  {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* 3 Step Quick Instructions */}
              <div className="space-y-2 text-[11px] sm:text-xs text-amber-900 bg-amber-100/50 p-3.5 rounded-2xl">
                <div className="font-semibold text-amber-950 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-600" />
                  <span>Quick 10-Second Setup:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed text-amber-900/90">
                  <li>Click <strong>Copy</strong> above to copy your current domain.</li>
                  <li>Open the <strong>Firebase Console Settings</strong> using the link below.</li>
                  <li>Scroll to <strong>Authorized domains</strong>, click <strong>Add domain</strong>, paste it, and save.</li>
                  <li>Return here and click <strong>Retry Google Sign-In</strong>!</li>
                </ol>
              </div>

              {/* Direct Link to Firebase Console */}
              <a
                href={domainInfo.firebaseSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs"
              >
                <span>Open Firebase Console Settings</span>
                <ExternalLink size={14} />
              </a>
            </div>
          ) : isPopupBlocked ? (
            /* Diagnosis 2: Popup blocked */
            <div className="p-5 rounded-3xl bg-blue-50 border border-blue-200 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-blue-900">
                    Popup Blocked by Browser or Iframe
                  </h4>
                  <p className="text-[12px] text-blue-800 mt-1 leading-relaxed">
                    Your browser or iframe preview environment blocked the Google authentication popup window.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleOpenDirectWindow}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <span>Open App in Full Tab</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          ) : (
            /* General guidance */
            <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-2">
              <p className="text-xs text-[#2D3732] leading-relaxed">
                Connect your verified Google account to create your Aura profile or log in with your existing account.
              </p>
            </div>
          )}

          {/* GSI Rendered Button Container (if script loaded) */}
          <div ref={gsiContainerRef} className="flex justify-center empty:hidden" />

          {/* Primary Action Button: Launch Google Sign-In Popup */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleRetryPopup}
              disabled={isRetrying}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#2D3732] hover:bg-[#1E2522] text-white text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
            >
              {isRetrying ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-[#8FA89B]" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  <span>Launch Google Sign-In Popup</span>
                </>
              )}
            </button>

            {/* Direct Window Option for iframes */}
            <button
              type="button"
              onClick={handleOpenDirectWindow}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#F1F5F2] border border-[#2D3732]/15 text-[#2D3732] text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Open in Full Browser Tab (Avoids Iframe Restrictions)</span>
              <ExternalLink size={13} className="text-[#7A8A82]" />
            </button>
          </div>

          {/* Security guarantee footer */}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#7A8A82] pt-2 border-t border-[#2D3732]/10">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Official Google OAuth 2.0 &middot; Zero-Trust Firestore ABAC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
