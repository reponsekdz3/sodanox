import React, { useState } from 'react';
import {
  X,
  Download,
  Laptop,
  CheckCircle2,
  Bell,
  WifiOff,
  Video,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { auraAudio } from '../../utils/audioSynthesizer';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isPC, platform, install } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    auraAudio.playClick(600, 0.05);
    setInstalling(true);
    const success = await install();
    setInstalling(false);
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    }
  };

  const getPlatformName = () => {
    switch (platform) {
      case 'windows':
        return 'Windows PC';
      case 'mac':
        return 'macOS';
      case 'linux':
        return 'Linux PC';
      case 'chromeos':
        return 'Chromebook';
      case 'ios':
        return 'iOS (iPhone / iPad)';
      case 'android':
        return 'Android Device';
      default:
        return 'PC / Desktop';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1E2A23]/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-lg bg-[#FAFAF9] rounded-3xl border border-[#8FA89B]/40 shadow-soft-float overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with App Branding */}
        <div className="p-6 bg-gradient-to-br from-[#2D3E33] via-[#374C3E] to-[#4A6757] text-white relative">
          <button
            onClick={() => {
              auraAudio.playClick(440, 0.03);
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner overflow-hidden shrink-0">
              <img
                src="/icon.svg"
                alt="Aura Logo"
                className="w-10 h-10 object-contain drop-shadow-md"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight">Install Aura on {getPlatformName()}</h3>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-white/20 text-white/90">
                  PWA
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                Full-featured standalone desktop app with zero distractions
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status Message if already installed */}
          {isInstalled || installSuccess ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">Aura is Installed on this Device!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  You can launch Aura directly from your desktop, taskbar, dock, or start menu anytime.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE9] flex items-start gap-2.5 shadow-2xs">
                  <div className="p-2 rounded-xl bg-[#F1F5F2] text-[#4A6757] shrink-0">
                    <Laptop size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E2A23]">Native PC Window</h4>
                    <p className="text-[11px] text-[#7A8A82] mt-0.5 leading-snug">
                      Runs in its own window without browser tabs or URL bars.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE9] flex items-start gap-2.5 shadow-2xs">
                  <div className="p-2 rounded-xl bg-[#F1F5F2] text-[#4A6757] shrink-0">
                    <Bell size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E2A23]">Desktop Popups</h4>
                    <p className="text-[11px] text-[#7A8A82] mt-0.5 leading-snug">
                      Instant audio & native popups for messages and calls.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE9] flex items-start gap-2.5 shadow-2xs">
                  <div className="p-2 rounded-xl bg-[#F1F5F2] text-[#4A6757] shrink-0">
                    <Video size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E2A23]">HD Video Calling</h4>
                    <p className="text-[11px] text-[#7A8A82] mt-0.5 leading-snug">
                      Hardware-accelerated audio and video calling support.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-[#E6EDE9] flex items-start gap-2.5 shadow-2xs">
                  <div className="p-2 rounded-xl bg-[#F1F5F2] text-[#4A6757] shrink-0">
                    <WifiOff size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#1E2A23]">Offline Caching</h4>
                    <p className="text-[11px] text-[#7A8A82] mt-0.5 leading-snug">
                      Instant cached startup even with unstable connections.
                    </p>
                  </div>
                </div>
              </div>

              {/* Install Action Area */}
              {isInstallable ? (
                <div className="p-4 rounded-2xl bg-[#EBF1ED] border border-[#8FA89B]/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#1E2A23]">1-Click Quick Installation</p>
                      <p className="text-[11px] text-[#62736B]">
                        Click below to install directly to your PC applications:
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Zap size={11} /> Ready
                    </span>
                  </div>

                  <button
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="w-full py-3 px-4 rounded-2xl bg-[#2F4438] hover:bg-[#25372d] text-white font-semibold text-sm shadow-soft flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Download size={18} />
                    <span>{installing ? 'Installing...' : 'Install Aura on Desktop Now'}</span>
                  </button>
                </div>
              ) : (
                /* Manual Step Guide for Desktop Chrome / Edge / Safari */
                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#E2EAE4] space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#4A6757]" />
                    <p className="text-xs font-bold text-[#1E2A23]">
                      How to install in your browser ({getPlatformName()}):
                    </p>
                  </div>

                  {platform === 'ios' ? (
                    <ol className="text-xs text-[#55635C] space-y-2 list-decimal list-inside pl-1">
                      <li>
                        Tap the <strong className="text-[#1E2A23]">Share</strong> button in Safari's toolbar at the bottom.
                      </li>
                      <li>
                        Scroll down and tap <strong className="text-[#1E2A23]">Add to Home Screen</strong>.
                      </li>
                      <li>
                        Tap <strong className="text-[#1E2A23]">Add</strong> to place the Aura icon on your screen.
                      </li>
                    </ol>
                  ) : (
                    <div className="space-y-2.5 text-xs text-[#55635C]">
                      <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-[#E6EDE9]">
                        <span className="w-5 h-5 rounded-full bg-[#EBF1ED] text-[#2F4438] font-bold text-[11px] flex items-center justify-center shrink-0">
                          1
                        </span>
                        <div>
                          <strong className="text-[#1E2A23]">Check your browser's address bar:</strong> Look for the{' '}
                          <strong className="text-[#2F4438]">Install icon (💻 or ➕)</strong> on the right side of the URL bar.
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-[#E6EDE9]">
                        <span className="w-5 h-5 rounded-full bg-[#EBF1ED] text-[#2F4438] font-bold text-[11px] flex items-center justify-center shrink-0">
                          2
                        </span>
                        <div>
                          <strong className="text-[#1E2A23]">Or click browser menu (⋮ or …):</strong> Select{' '}
                          <strong className="text-[#2F4438]">"Install Aura Social"</strong> or{' '}
                          <strong className="text-[#2F4438]">"Apps → Install this site as an app"</strong>.
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white border border-[#E6EDE9]">
                        <span className="w-5 h-5 rounded-full bg-[#EBF1ED] text-[#2F4438] font-bold text-[11px] flex items-center justify-center shrink-0">
                          3
                        </span>
                        <div>
                          Confirm <strong className="text-[#1E2A23]">Install</strong>. Aura will open immediately as an independent desktop application!
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Footer note */}
          <div className="flex items-center justify-between text-[11px] text-[#7A8A82] pt-2 border-t border-[#E6EDE9]">
            <span>PWA v1.0 • Progressive Web App Standard</span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl hover:bg-[#EAEFEA] text-[#2D3732] font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
