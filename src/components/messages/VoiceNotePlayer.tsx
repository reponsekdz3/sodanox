import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { VoiceNoteMeta } from '../../types';
import { audioSynth } from '../../utils/audioSynth';

interface VoiceNotePlayerProps {
  voiceMeta: VoiceNoteMeta;
  isSelf: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ voiceMeta, isSelf }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const stopSynthRef = useRef<(() => void) | null>(null);

  const durationSec = voiceMeta.duration || 3;

  useEffect(() => {
    // If real audio is available, initialize Audio instance
    if (voiceMeta.audioUrl) {
      const audio = new Audio(voiceMeta.audioUrl);
      audioElementRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };

      audio.ontimeupdate = () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setProgress(audio.currentTime / audio.duration);
        }
      };
    }

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (stopSynthRef.current) {
        stopSynthRef.current();
        stopSynthRef.current = null;
      }
    };
  }, [voiceMeta.audioUrl]);

  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlayback = () => {
    if (isPlaying) {
      // Pause
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (stopSynthRef.current) {
        stopSynthRef.current();
        stopSynthRef.current = null;
      }
      setIsPlaying(false);
    } else {
      // Play
      setIsPlaying(true);
      if (audioElementRef.current) {
        audioElementRef.current.playbackRate = speed;
        audioElementRef.current.play().catch((err) => {
          console.warn('Real audio playback error, falling back to synth:', err);
          fallbackToSynth();
        });
      } else {
        fallbackToSynth();
      }
    }
  };

  const fallbackToSynth = () => {
    const effectiveDuration = durationSec / speed;
    stopSynthRef.current = audioSynth.playVoiceWaveform(
      effectiveDuration,
      (p) => setProgress(p),
      () => {
        setIsPlaying(false);
        setProgress(0);
        stopSynthRef.current = null;
      }
    );
  };

  const cycleSpeed = () => {
    if (speed === 1) setSpeed(1.5);
    else if (speed === 1.5) setSpeed(2);
    else setSpeed(1);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentSeconds = Math.floor(progress * durationSec);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl w-full max-w-xs sm:max-w-sm ${
        isSelf ? 'bg-[#8FA89B] text-white' : 'bg-[#FAFAF9] text-[#2D3732] border border-[#E6EDE9]'
      }`}
    >
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlayback}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer ${
          isSelf
            ? 'bg-white text-[#2D3732] hover:bg-white/90'
            : 'bg-[#8FA89B] text-white hover:bg-[#7e9689]'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>

      {/* Waveform Bars with clickable scrubbing */}
      <div
        className="flex-1 flex flex-col justify-center gap-1 min-w-0 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const newRatio = Math.max(0, Math.min(1, clickX / rect.width));
          setProgress(newRatio);
          if (audioElementRef.current && audioElementRef.current.duration) {
            audioElementRef.current.currentTime = newRatio * audioElementRef.current.duration;
          }
        }}
      >
        <div className="flex items-center gap-[3px] h-7 w-full overflow-hidden py-1">
          {(voiceMeta.waveform || [30, 45, 60, 50, 40, 65, 80]).map((barHeight, idx, arr) => {
            const barProgress = idx / arr.length;
            const isPlayed = barProgress <= progress;

            return (
              <div
                key={idx}
                className="flex-1 rounded-full transition-all"
                style={{
                  height: `${Math.max(15, barHeight)}%`,
                  backgroundColor: isSelf
                    ? isPlayed
                      ? '#FFFFFF'
                      : 'rgba(255, 255, 255, 0.4)'
                    : isPlayed
                    ? '#8FA89B'
                    : '#D6E2DC',
                }}
              />
            );
          })}
        </div>

        {/* Timestamps */}
        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums leading-none">
          <span className={isSelf ? 'text-white/90' : 'text-[#7A8A82]'}>
            {isPlaying ? formatTime(currentSeconds) : formatTime(durationSec)}
          </span>
          <span className={isSelf ? 'text-white/70' : 'text-[#7A8A82]'}>
            {formatTime(durationSec)}
          </span>
        </div>
      </div>

      {/* Playback speed multiplier */}
      <button
        type="button"
        onClick={cycleSpeed}
        className={`text-[10px] font-medium px-2 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
          isSelf
            ? 'bg-white/20 text-white hover:bg-white/30'
            : 'bg-[#F1F5F2] text-[#2D3732] hover:bg-[#E6EDE9]'
        }`}
        title="Change playback speed"
      >
        {speed}x
      </button>
    </div>
  );
};
