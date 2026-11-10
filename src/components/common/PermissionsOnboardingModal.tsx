import React, { useState } from 'react';
import { Bell, MapPin, CheckCircle2, Sparkles, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { audioSynth } from '../../utils/audioSynth';

interface PermissionsOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationGranted?: (coords: { latitude: number; longitude: number }) => void;
}

export const PermissionsOnboardingModal: React.FC<PermissionsOnboardingModalProps> = ({
  isOpen,
  onClose,
  onLocationGranted,
}) => {
  const [notifGranted, setNotifGranted] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );
  const [locationGranted, setLocationGranted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isOpen) return null;

  const handleRequestNotifications = async () => {
    audioSynth.playPop();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotifGranted(true);
          audioSynth.playNotificationSound();
        }
      } catch (err) {
        console.warn('Notification permission request note:', err);
      }
    }
  };

  const handleRequestLocation = () => {
    audioSynth.playPop();
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationGranted(true);
          audioSynth.playPop(880);
          if (onLocationGranted) {
            onLocationGranted({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        },
        (error) => {
          console.warn('Geolocation permission request note:', error?.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const handleEnableAllAndEnter = async () => {
    setIsRequesting(true);
    audioSynth.playConnectedChime();

    // 1. Request notifications
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
      try {
        const res = await Notification.requestPermission();
        if (res === 'granted') setNotifGranted(true);
      } catch (e) {
        // Ignored
      }
    }

    // 2. Request location
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationGranted(true);
          if (onLocationGranted) {
            onLocationGranted({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          }
          setIsRequesting(false);
          onClose();
        },
        () => {
          setIsRequesting(false);
          onClose();
        },
        { timeout: 5000 }
      );
    } else {
      setIsRequesting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#D1E2D9] relative flex flex-col space-y-5">
        <button
          type="button"
          onClick={() => {
            audioSynth.playPop();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full text-[#4B6358] hover:bg-[#EDF3F0] transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header with App Branding */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#064E3B] to-[#059669] flex items-center justify-center text-white shadow-soft">
            <Sparkles size={22} className="text-[#34D399]" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-[#022C22]">Welcome to Ducate</h3>
            <p className="text-xs text-[#4B6358]">Personalize your real-time experience</p>
          </div>
        </div>

        <p className="text-xs text-[#022C22]/80 leading-relaxed">
          Enable browser alerts for instant incoming audio/video calls and direct message notifications, plus location access for accurate local storytelling.
        </p>

        {/* Feature Cards */}
        <div className="space-y-3">
          {/* Notifications Card */}
          <div className="p-3.5 rounded-2xl bg-[#EDF3F0] border border-[#D1E2D9] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white text-[#064E3B] flex items-center justify-center shadow-xs">
                <Bell size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#022C22]">Desktop & Sound Alerts</h4>
                <p className="text-[11px] text-[#4B6358]">Incoming calls, voice notes & replies</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestNotifications}
              disabled={notifGranted}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                notifGranted
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
                  : 'bg-[#064E3B] hover:bg-[#022C22] text-white shadow-xs'
              }`}
            >
              {notifGranted ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={13} /> Enabled
                </span>
              ) : (
                'Enable'
              )}
            </button>
          </div>

          {/* Location Card */}
          <div className="p-3.5 rounded-2xl bg-[#EDF3F0] border border-[#D1E2D9] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white text-[#064E3B] flex items-center justify-center shadow-xs">
                <MapPin size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#022C22]">Location Tagging</h4>
                <p className="text-[11px] text-[#4B6358]">Discover local creators & stories</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRequestLocation}
              disabled={locationGranted}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                locationGranted
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
                  : 'bg-[#064E3B] hover:bg-[#022C22] text-white shadow-xs'
              }`}
            >
              {locationGranted ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={13} /> Enabled
                </span>
              ) : (
                'Enable'
              )}
            </button>
          </div>
        </div>

        {/* Security Assurance */}
        <div className="flex items-center gap-2 text-[11px] text-[#4B6358]">
          <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
          <span>Zero background tracking. You can adjust permissions in browser settings anytime.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              audioSynth.playPop();
              onClose();
            }}
            className="flex-1 py-3 px-4 rounded-xl text-xs font-semibold text-[#4B6358] hover:bg-[#EDF3F0] transition-colors cursor-pointer text-center"
          >
            Maybe Later
          </button>
          <button
            type="button"
            disabled={isRequesting}
            onClick={handleEnableAllAndEnter}
            className="flex-1 py-3 px-4 rounded-xl bg-[#064E3B] hover:bg-[#022C22] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>{isRequesting ? 'Activating...' : 'Enable & Enter'}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
