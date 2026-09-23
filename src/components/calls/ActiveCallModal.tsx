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
  MonitorUp,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { ActiveCall, User } from '../../types';
import { audioSynth } from '../../utils/audioSynth';
import { AuraLogo } from '../common/AuraLogo';

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

type VideoFilter = 'natural' | 'warm' | 'frost' | 'noir';

const FILTER_STYLES: Record<VideoFilter, string> = {
  natural: '',
  warm: 'sepia(0.25) saturate(1.25) contrast(1.05)',
  frost: 'hue-rotate(185deg) saturate(0.8) brightness(1.05)',
  noir: 'grayscale(1) contrast(1.25)',
};

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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [videoFilter, setVideoFilter] = useState<VideoFilter>('natural');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 volume meter
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Handle ringtone and transition to connected
  useEffect(() => {
    if (call.status === 'ringing') {
      audioSynth.startRinging();

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

  // Initialize WebRTC MediaStream & Web Audio API volume analyzer
  useEffect(() => {
    let streamActive = true;

    async function initMedia() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: call.type === 'video' ? { facingMode: isFrontCamera ? 'user' : 'environment' } : false,
          audio: true,
        });

        if (!streamActive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setUserStream(stream);

        // Attach to local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Setup real-time audio volume analyzer
        try {
          const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const updateVolume = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(updateVolume);
            };
            updateVolume();
          }
        } catch {
          // AudioContext fallback
        }
      } catch (err) {
        console.warn('Media access error or permissions restricted:', err);
      }
    }

    initMedia();

    return () => {
      streamActive = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (userStream) {
        userStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [call.type, isFrontCamera]);

  // Sync mute state with real audio tracks
  useEffect(() => {
    if (userStream) {
      userStream.getAudioTracks().forEach((track) => {
        track.enabled = !call.isMuted;
      });
    }
  }, [call.isMuted, userStream]);

  // Sync camera toggle with real video tracks
  useEffect(() => {
    if (userStream) {
      userStream.getVideoTracks().forEach((track) => {
        track.enabled = !call.isCameraOff;
      });
    }
  }, [call.isCameraOff, userStream]);

  // Toggle Screen Share
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      // Revert back to camera
      if (userStream) {
        userStream.getTracks().forEach((t) => t.stop());
      }
      setIsScreenSharing(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: isFrontCamera ? 'user' : 'environment' },
          audio: true,
        });
        setUserStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch {
        // ignore
      }
    } else {
      // Request screen share
      if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          setIsScreenSharing(true);
          setUserStream(screenStream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = screenStream;
          }
          screenStream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
          };
        } catch (err) {
          console.warn('Screen share cancelled or unsupported:', err);
        }
      }
    }
  };

  // Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleHangup = () => {
    audioSynth.stopRinging();
    audioSynth.playEndChime();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (userStream) {
      userStream.getTracks().forEach((t) => t.stop());
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    onEndCall();
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#1A211D]/90 backdrop-blur-lg flex items-center justify-center p-2 sm:p-4 select-none animate-fadeIn"
    >
      <div className="relative w-full max-w-2xl h-[92vh] max-h-[820px] bg-[#222A25] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between border border-white/10 text-white">
        {/* Top Floating Control Bar */}
        <div className="relative z-30 flex items-center justify-between p-4 sm:p-5 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <AuraLogo size="sm" showWordmark={true} variant="white" />
            <span className="hidden sm:inline-block text-white/30">|</span>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs border border-white/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  call.status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="font-mono tabular-nums text-[11px]">
                {call.status === 'ringing'
                  ? 'Connecting spatial stream...'
                  : `${call.type === 'video' ? 'Video' : 'Voice'} · ${formatDuration(duration)}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* End-to-end encryption tag */}
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-white/70 bg-black/40 px-2.5 py-1 rounded-full border border-white/10">
              <ShieldCheck size={13} className="text-[#8FA89B]" />
              <span>Encrypted</span>
            </div>

            {/* Fullscreen toggle */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              <Maximize2 size={16} />
            </button>

            {/* Minimize */}
            <button
              type="button"
              onClick={onMinimize}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Minimize call"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Center Calling Area */}
        <div className="relative flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
          {call.type === 'video' ? (
            /* ================= VIDEO CALL VIEW ================= */
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-neutral-950 flex items-center justify-center shadow-inner">
              {/* Remote Participant Simulated HD Feed */}
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={call.participant.avatar}
                  alt={call.participant.name}
                  className="w-full h-full object-cover filter blur-[1px] brightness-75 scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

                {/* Participant Identity Badge Overlay */}
                <div className="absolute flex flex-col items-center gap-2 z-10">
                  <div className="relative">
                    <img
                      src={call.participant.avatar}
                      alt={call.participant.name}
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover ring-4 ring-white/30 shadow-2xl"
                    />
                    <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#8FA89B] text-white ring-2 ring-[#222A25]">
                      <Video size={14} />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg sm:text-xl font-serif font-semibold text-white drop-shadow">
                      {call.participant.name}
                    </h3>
                    <p className="text-xs text-white/80 font-mono drop-shadow">
                      @{call.participant.username}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md text-[11px] text-[#A8C0B2] border border-white/10">
                      <Wifi size={12} />
                      <span>HD 60fps · 18ms latency</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Local Video Picture-in-Picture (Pip) */}
              <div className="absolute bottom-4 right-4 w-32 h-44 sm:w-40 sm:h-52 rounded-2xl overflow-hidden bg-neutral-900 border-2 border-white/40 shadow-2xl z-20 group">
                {call.isCameraOff ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-white/70 bg-neutral-800">
                    <VideoOff size={22} className="mb-1 text-white/40" />
                    <span className="text-[10px] text-white/60">Camera Off</span>
                  </div>
                ) : (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ filter: FILTER_STYLES[videoFilter] }}
                    className="w-full h-full object-cover -scale-x-100"
                  />
                )}

                {/* You badge */}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium">
                  {isScreenSharing ? 'Screen' : 'You'}
                </div>

                {/* Live Mic Volume Dot inside Pip */}
                {!call.isMuted && audioLevel > 5 && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/80 backdrop-blur-xs text-[9px] text-white">
                    <Mic size={9} />
                    <span>Live</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= AUDIO CALL VIEW ================= */
            <div className="flex flex-col items-center justify-center">
              {/* Dynamic Aura Halo reacting to microphone volume */}
              <div className="relative mb-6">
                <div
                  className="absolute -inset-6 rounded-full bg-[#8FA89B] opacity-30 transition-transform duration-100 ease-out"
                  style={{
                    transform: `scale(${1 + (audioLevel / 100) * 0.45})`,
                  }}
                />
                <div
                  className={`absolute -inset-3 rounded-full bg-[#8FA89B] opacity-50 ${
                    call.status === 'connected' ? 'animate-pulse' : 'animate-ping'
                  }`}
                />
                <div className="relative w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-[#8FA89B] to-[#5A7B6D] shadow-2xl">
                  <img
                    src={call.participant.avatar}
                    alt={call.participant.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              </div>

              <h2 className="font-serif text-2xl font-semibold text-white mb-1">
                {call.participant.name}
              </h2>
              <p className="text-xs text-white/70 mb-4 font-mono">
                @{call.participant.username}
              </p>

              {/* Dynamic Web Audio Reactive Waveform Bars */}
              <div className="flex items-center gap-1.5 h-10 px-4 py-1.5 bg-black/40 rounded-full border border-white/10 mb-4">
                {[15, 30, 60, 80, 50, 90, 70, 40, 20].map((h, i) => {
                  const dynamicHeight = Math.max(
                    6,
                    Math.round(h * (call.isMuted ? 0.2 : 0.3 + (audioLevel / 100) * 0.7))
                  );
                  return (
                    <span
                      key={i}
                      className="w-1 rounded-full bg-[#8FA89B] transition-all duration-75"
                      style={{ height: `${dynamicHeight}px` }}
                    />
                  );
                })}
              </div>

              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-mono text-white/90 tabular-nums">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  {call.status === 'ringing' ? 'Calling...' : `Spatial Voice · ${formatDuration(duration)}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Video Filter Selector Row (when in video mode) */}
        {call.type === 'video' && !call.isCameraOff && (
          <div className="px-6 py-2 flex items-center justify-center gap-2 bg-black/40 border-t border-white/5">
            <span className="text-[11px] text-white/60 mr-2 flex items-center gap-1">
              <Sparkles size={12} className="text-[#8FA89B]" /> Studio Tone:
            </span>
            {(['natural', 'warm', 'frost', 'noir'] as VideoFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setVideoFilter(f)}
                className={`px-3 py-1 rounded-full text-xs capitalize transition-all ${
                  videoFilter === f
                    ? 'bg-[#8FA89B] text-white font-medium'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Bottom Call Controls Rail */}
        <div className="p-5 sm:p-6 bg-black/60 backdrop-blur-md border-t border-white/10 rounded-b-3xl">
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            {/* Mute Mic */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`p-4 rounded-full transition-all ${
                call.isMuted
                  ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-400/40'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={call.isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {call.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            {/* Toggle Camera */}
            <button
              type="button"
              onClick={onToggleCamera}
              className={`p-4 rounded-full transition-all ${
                call.isCameraOff
                  ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-400/40'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={call.isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            >
              {call.isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </button>

            {/* Screen Share (video calls) */}
            {call.type === 'video' && (
              <button
                type="button"
                onClick={handleToggleScreenShare}
                className={`p-4 rounded-full transition-all ${
                  isScreenSharing
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
                title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
              >
                <MonitorUp size={22} />
              </button>
            )}

            {/* Switch Camera */}
            {call.type === 'video' && (
              <button
                type="button"
                onClick={() => setIsFrontCamera((prev) => !prev)}
                className="p-4 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all"
                title="Switch Camera (Front/Back)"
              >
                <SwitchCamera size={22} />
              </button>
            )}

            {/* Speakerphone */}
            <button
              type="button"
              onClick={onToggleSpeaker}
              className={`p-4 rounded-full transition-all ${
                call.isSpeakerOn
                  ? 'bg-[#8FA89B] text-white shadow-lg'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title={call.isSpeakerOn ? 'Speaker ON' : 'Speaker OFF'}
            >
              {call.isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
            </button>

            {/* End Call Button */}
            <button
              type="button"
              onClick={handleHangup}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-2xl transition-transform active:scale-95 ring-2 ring-red-500/40"
              title="End Call"
            >
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
