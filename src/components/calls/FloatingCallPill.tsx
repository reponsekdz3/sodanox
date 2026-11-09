import React from 'react';
import { Maximize2, PhoneOff, Video, MicOff } from 'lucide-react';
import { ActiveCall } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';

interface FloatingCallPillProps {
  call: ActiveCall;
  onMaximize: () => void;
  onEndCall: () => void;
}

export const FloatingCallPill: React.FC<FloatingCallPillProps> = ({
  call,
  onMaximize,
  onEndCall,
}) => {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 bg-white border border-[#D1E2D9] rounded-2xl shadow-soft-float p-2.5 flex items-center gap-3 animate-fadeIn">
      {/* Participant avatar with pulsing online indicator */}
      <div className="cursor-pointer" onClick={onMaximize}>
        <ModernAvatar
          src={call.participant.avatar}
          alt={call.participant.name}
          size="md"
          status="online"
          ring
        />
      </div>

      {/* Info & Duration */}
      <div className="cursor-pointer min-w-0" onClick={onMaximize}>
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-[#022C22] truncate max-w-[100px]">
            {call.participant.name}
          </p>
          {call.isMuted && <MicOff size={11} className="text-amber-600" />}
          {call.type === 'video' && <Video size={11} className="text-[#059669]" />}
        </div>
        <p className="text-[11px] font-mono text-[#4B6358] tabular-nums">
          {formatTime(call.durationSeconds)}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onMaximize}
          className="p-2 rounded-xl bg-[#EDF3F0] hover:bg-[#D1E2D9] text-[#022C22] transition-colors cursor-pointer"
          title="Expand Call"
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={onEndCall}
          className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
          title="End Call"
        >
          <PhoneOff size={14} />
        </button>
      </div>
    </div>
  );
};
