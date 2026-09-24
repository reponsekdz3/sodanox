import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, ShieldCheck } from 'lucide-react';
import { CallSession } from '../../services/callService';
import { audioSynth } from '../../utils/audioSynth';
import { AuraLogo } from '../common/AuraLogo';
import { ModernAvatar } from '../common/ModernAvatar';

interface IncomingCallModalProps {
  incomingCall: CallSession;
  onAccept: (session: CallSession) => void;
  onDecline: (session: CallSession) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onDecline,
}) => {
  // Ringtone playback
  useEffect(() => {
    audioSynth.startRinging();
    return () => {
      audioSynth.stopRinging();
    };
  }, []);

  const handleAccept = () => {
    audioSynth.stopRinging();
    audioSynth.playConnectedChime();
    onAccept(incomingCall);
  };

  const handleDecline = () => {
    audioSynth.stopRinging();
    audioSynth.playEndChime();
    onDecline(incomingCall);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#141A16]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn select-none">
      <div className="relative w-full max-w-sm bg-[#1E2722] border border-white/10 rounded-3xl p-6 sm:p-7 shadow-2xl text-white flex flex-col items-center text-center">
        {/* Top Header */}
        <div className="flex items-center justify-between w-full mb-6 text-xs text-white/60">
          <AuraLogo size="sm" showWordmark={true} variant="white" />
          <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full text-[10px]">
            <ShieldCheck size={12} className="text-[#8FA89B]" />
            <span>Encrypted</span>
          </div>
        </div>

        {/* Animated Caller Avatar Ring */}
        <div className="relative my-2">
          <div className="absolute -inset-4 rounded-full bg-[#8FA89B]/30 animate-ping" />
          <div className="absolute -inset-2 rounded-full bg-[#8FA89B]/40 animate-pulse" />
          <div className="relative w-28 h-28 rounded-full p-1 bg-gradient-to-tr from-[#8FA89B] to-[#5C7567] shadow-2xl flex items-center justify-center">
            <ModernAvatar
              src={incomingCall.caller.avatar}
              alt={incomingCall.caller.name}
              size="2xl"
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="font-serif text-2xl font-semibold text-white mt-4 mb-1">
          {incomingCall.caller.name}
        </h3>
        <p className="text-xs text-white/70 font-mono mb-2">
          @{incomingCall.caller.username}
        </p>

        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-xs text-[#A3BEAF] mb-8 font-medium">
          {incomingCall.type === 'video' ? (
            <>
              <Video size={14} className="text-emerald-400" />
              <span>Incoming Video Call...</span>
            </>
          ) : (
            <>
              <Phone size={14} className="text-emerald-400" />
              <span>Incoming Spatial Voice Call...</span>
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-8 w-full">
          {/* Decline */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleDecline}
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ring-4 ring-red-500/20"
              title="Decline Call"
            >
              <PhoneOff size={24} />
            </button>
            <span className="text-xs text-white/60">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleAccept}
              className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer ring-4 ring-emerald-500/30 animate-bounce"
              title="Accept Call"
            >
              {incomingCall.type === 'video' ? (
                <Video size={26} />
              ) : (
                <Phone size={24} />
              )}
            </button>
            <span className="text-xs text-emerald-300 font-medium">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};
