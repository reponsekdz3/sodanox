import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Check, X, Sparkles } from 'lucide-react';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  triggerTestNotification,
  isBrowserNotificationSupported,
} from '../../services/browserNotificationService';
import { auraAudio } from '../../utils/audioSynthesizer';

interface BrowserNotificationBannerProps {
  onDismiss?: () => void;
}

export const BrowserNotificationBanner: React.FC<BrowserNotificationBannerProps> = ({
  onDismiss,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [dismissed, setDismissed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isBrowserNotificationSupported()) return;
    setPermission(getBrowserNotificationPermission());

    const isExplicitlyDismissed = localStorage.getItem('aura_notif_banner_dismissed') === 'true';
    if (isExplicitlyDismissed) {
      setDismissed(true);
    }
  }, []);

  if (dismissed || !isBrowserNotificationSupported()) return null;
  if (permission === 'denied') return null;

  const handleEnable = async () => {
    auraAudio.playClick(600, 0.04);
    setIsProcessing(true);
    const newPerm = await requestBrowserNotificationPermission();
    setPermission(newPerm);
    setIsProcessing(false);
    if (newPerm === 'granted') {
      setTimeout(() => {
        setDismissed(true);
      }, 3000);
    }
  };

  const handleTestNotification = () => {
    auraAudio.playClick(650, 0.04);
    triggerTestNotification();
  };

  const handleDismiss = () => {
    auraAudio.playClick(440, 0.02);
    setDismissed(true);
    localStorage.setItem('aura_notif_banner_dismissed', 'true');
    if (onDismiss) onDismiss();
  };

  return (
    <div className="bg-gradient-to-r from-[#2F4438] via-[#3B5446] to-[#4A6757] text-white p-3 sm:p-3.5 rounded-2xl shadow-soft mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn border border-white/10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
          <BellRing size={18} className="text-white animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold truncate">Enable Instant Browser Notifications</p>
            <span className="hidden sm:inline px-1.5 py-0.2 rounded-md bg-white/20 text-[10px] font-semibold">
              Real-time
            </span>
          </div>
          <p className="text-[11px] text-white/80 leading-snug">
            Receive native desktop alerts with audio for direct messages and HD calls.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        {permission === 'granted' ? (
          <>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-200 bg-white/15 px-2.5 py-1 rounded-xl">
              <Check size={13} /> Active
            </span>
            <button
              onClick={handleTestNotification}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-all cursor-pointer flex items-center gap-1"
            >
              <Sparkles size={12} /> Test Alert
            </button>
          </>
        ) : (
          <button
            onClick={handleEnable}
            disabled={isProcessing}
            className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-white hover:bg-white/90 text-[#2F4438] shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Bell size={13} className="text-[#2F4438]" />
            <span>{isProcessing ? 'Enabling...' : 'Enable Now'}</span>
          </button>
        )}

        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          title="Dismiss banner"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
