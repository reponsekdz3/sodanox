import React, { useState } from 'react';
import { Laptop, Download, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';
import { auraAudio } from '../../utils/audioSynthesizer';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'sidebar' | 'header' | 'menu';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { isInstallable, isInstalled, isPC } = usePWAInstall();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = () => {
    auraAudio.playClick(580, 0.04);
    setModalOpen(true);
  };

  if (variant === 'menu') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className={`w-full px-4 py-2.5 text-left text-xs font-semibold text-[#022C22] hover:bg-[#EDF3F0] flex items-center justify-between cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <Laptop size={15} className="text-[#059669]" />
            <span>{isInstalled ? 'AuraChats Desktop App' : 'Install AuraChats on PC (PWA)'}</span>
          </div>
          {isInstallable && (
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
              Ready
            </span>
          )}
        </button>
        <PWAInstallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (isInstalled && variant === 'header') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer ${className}`}
          title="AuraChats is installed on this PC"
        >
          <Check size={13} className="text-emerald-600 stroke-[3]" />
          <span className="hidden sm:inline">Desktop App Active</span>
        </button>
        <PWAInstallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        <div
          onClick={handleClick}
          className={`p-3 rounded-2xl bg-gradient-to-br from-[#EDF3F0] to-[#E2EAE5] border border-[#D1E2D9] hover:border-[#059669] transition-all cursor-pointer group shadow-2xs ${className}`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#064E3B] text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-xs">
              <Laptop size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#022C22] truncate">
                  {isInstalled ? 'Desktop App' : 'Install AuraChats on PC'}
                </p>
                {isInstallable && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <p className="text-[10px] text-[#4B6358] truncate">
                {isInstalled ? 'Standalone window ready' : 'Standalone window & popups'}
              </p>
            </div>
          </div>
        </div>
        <PWAInstallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  if (variant === 'header') {
    return (
      <>
        <button
          onClick={handleClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EDF3F0] hover:bg-[#D1E2D9] text-[#064E3B] text-xs font-semibold transition-all border border-[#D1E2D9] shadow-2xs cursor-pointer ${className}`}
          title="Install AuraChats on your computer"
        >
          <Laptop size={14} className="text-[#064E3B]" />
          <span className="hidden sm:inline">Install on PC</span>
          {isInstallable && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping ml-0.5" />
          )}
        </button>
        <PWAInstallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // Compact variant
  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#064E3B] hover:bg-[#EDF3F0] transition-colors cursor-pointer ${className}`}
      >
        <Download size={13} />
        <span>Install App</span>
      </button>
      <PWAInstallModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
