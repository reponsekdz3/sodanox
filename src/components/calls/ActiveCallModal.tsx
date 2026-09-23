import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Minimize2,
  SwitchCamera,
  CheckCircle2,
} from 'lucide-react';
import { ActiveCall, User } from '../../types';
import { audioSynth } from '../../utils/audioSynth';

interface ActiveCallModalProps {
  call: ActiveCall;
  currentUser: User;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onMinimize: () => void;
  onStatusConnected: () => void;
}

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  call,
  currentUser,
  onEndCall,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onMinimize,
  onStatusConnected,
}) => {
  const [duration, setDuration] = useState(call.durationSeconds);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [userStream, setUserStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  // Handle ringtone and auto-connect simulation
  useEffect(() => {
    if (call.status === 'ringing') {
      audioSynth.startRinging();

      // Automatically transition to connected after 3.2 seconds
      const timeout = setTimeout(() => {
        audioSynth.stopRinging();
        audioSynth.playConnectedChime();
        onStatusConnected();
      }, 3200);

      return () => {
        audioSynth.stopRinging();
        clearTimeout(timeout);
      };
    } else {
      audioSynth.stopRinging();
    }
  }, [call.status, onStatusConnected]);

  // Call duration counter when connected
  useEffect(() => {
    if (call.status !== 'connected') return;

    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [call.status]);

  // Video stream if video call
  useEffect(() => {
    if (call.type === 'video' && !call.isCameraOff) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .then((stream) => {
            setUserStream(stream);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch(() => {
            // graceful fallback to simulated video
          });
      }
    } else {
      if (userStream) {
        userStream.getTracks().forEach((t) => t.stop());
        setUserStream(null);
      }
    }

    return () => {
      if (userStream) {
        userStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [call.type, call.isCameraOff]);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleHangup = () => {
    audioSynth.stopRinging();
    audioSynth.playEndChime();
    if (userStream) {
      userStream.getTracks().forEach((t) => t.stop());
    }
    onEndCall();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="relative w-full max-w-lg h-[92vh] max-h-[760px] bg-[#FAFAF9] rounded-3xl overflow-hidden shadow-soft-float flex flex-col justify-between border border-[#F1F5F2]">
        {/* Top Bar inside call */}
        <div className="relative z-20 flex items-center justify-between p-5 bg-gradient-to-b from-[#2D3732]/10 to-transparent">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                call.status === 'connected' ? 'bg-[#8FA89B] animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-xs font-medium text-[#2D3732]">
              {call.status === 'ringing'
                ? 'Ringing...'
                : `${call.type === 'video' ? 'Video' : 'Voice'} Call · ${formatDuration(duration)}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMinimize}
              className="p-2 rounded-xl bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732] transition-colors"
              title="Minimize call"
            >
              <Minimize2 size={18} />
            </button>
          </div>
        </div>

        {/* Center Canvas / Video Feed */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center overflow-hidden">
          {call.type === 'video' ? (
            /* Video Call Layout */
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-neutral-900 flex items-center justify-center">
              {/* Participant simulated remote video feed */}
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={call.participant.avatar}
                  alt={call.participant.name}
                  className="w-full h-full object-cover filter blur-[2px] opacity-70 scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

                {/* Participant badge in center */}
                <div className="absolute flex flex-col items-center gap-2 text-white">
                  <div className="relative">
                    <img
                      src={call.participant.avatar}
                      alt={call.participant.name}
                      className="w-24 h-24 rounded-full object-cover border-2 border-white/80 shadow-soft-lg"
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#8FA89B] text-white flex items-center justify-center border-2 border-white">
                      <Video size={13} />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold drop-shadow">
                    {call.participant.name}
                  </h3>
                  <p className="text-xs text-white/80 drop-shadow">
                    {call.status === 'ringing' ? 'Connecting video...' : 'HD Spatial Video Active'}
                  </p>
                </div>
              </div>

              {/* Local User Picture-in-Picture Video */}
              <div className="absolute bottom-4 right-4 w-28 h-36 sm:w-32 sm:h-44 rounded-2xl overflow-hidden bg-neutral-800 border-2 border-white shadow-soft-lg z-20">
                {call.isCameraOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-white/70 bg-neutral-800">
                    <VideoOff size={20} className="mb-1 text-white/50" />
                    <span className="text-[10px]">Camera Off</span>
                  </div>
                ) : userStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                  />
                ) : (
                  <div className="relative w-full h-full">
                    <img
                      src={currentUser.avatar}
                      alt="Your camera"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 right-1 text-center">
                      <span className="text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded-full">
                        You
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Audio Call Layout */
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-6">
                {/* Soft pulse glow rings */}
                <div
                  className={`absolute -inset-4 rounded-full bg-[#E6EDE9] opacity-75 ${
                    call.status === 'connected' ? 'animate-pulse' : 'animate-ping'
                  }`}
                />
                <div className="relative w-32 h-32 rounded-full p-1 bg-[#8FA89B] shadow-soft-float">
                  <img
                    src={call.participant.avatar}
                    alt={call.participant.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>

              <h2 className="text-xl font-semibold text-[#2D3732] mb-1">
                {call.participant.name}
              </h2>
              <p className="text-xs text-[#7A8A82] mb-4">
                @{call.participant.username}
              </p>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F1F5F2] border border-[#E6EDE9] text-xs font-mono text-[#2D3732] tabular-nums">
                <span className="w-2 h-2 rounded-full bg-[#8FA89B]" />
                {call.status === 'ringing' ? 'Calling...' : formatDuration(duration)}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Rail */}
        <div className="p-6 bg-[#F1F5F2] border-t border-[#E6EDE9] rounded-b-3xl">
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            {/* Mute Mic */}
            <button
              onClick={onToggleMute}
              className={`p-4 rounded-full transition-all ${
                call.isMuted
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732]'
              } shadow-soft`}
              title={call.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {call.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Toggle Camera (for video calls or switch to video) */}
            <button
              onClick={onToggleCamera}
              className={`p-4 rounded-full transition-all ${
                call.isCameraOff
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732]'
              } shadow-soft`}
              title={call.isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {call.isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            {/* Switch Camera */}
            {call.type === 'video' && (
              <button
                onClick={() => setIsFrontCamera((prev) => !prev)}
                className="p-4 rounded-full bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732] shadow-soft transition-all"
                title="Switch Camera"
              >
                <SwitchCamera size={22} />
              </button>
            )}

            {/* Speakerphone */}
            <button
              onClick={onToggleSpeaker}
              className={`p-4 rounded-full transition-all ${
                call.isSpeakerOn
                  ? 'bg-[#E6EDE9] text-[#8FA89B]'
                  : 'bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732]'
              } shadow-soft`}
              title={call.isSpeakerOn ? 'Speaker ON' : 'Speaker OFF'}
            >
              {call.isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>

            {/* End Call (Red) */}
            <button
              onClick={handleHangup}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-soft-lg transition-transform active:scale-95"
              title="End call"
            >
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
