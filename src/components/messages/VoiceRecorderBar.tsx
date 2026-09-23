import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Pause, Play } from 'lucide-react';
import { VoiceNoteMeta } from '../../types';

interface VoiceRecorderBarProps {
  onCancel: () => void;
  onSendVoiceNote: (voiceMeta: VoiceNoteMeta) => void;
}

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({
  onCancel,
  onSendVoiceNote,
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [bars, setBars] = useState<number[]>([20, 30, 45, 25, 40, 60, 35, 50, 70, 40, 25, 30, 50, 35]);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    async function initRecorder() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;

        // Try initializing MediaRecorder
        try {
          const recorder = new MediaRecorder(stream, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
              ? 'audio/webm;codecs=opus'
              : undefined,
          });
          mediaRecorderRef.current = recorder;
          audioChunksRef.current = [];

          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.start(100);
        } catch (recErr) {
          console.warn('MediaRecorder init fallback:', recErr);
        }

        // Connect Web Audio API Analyser for real voice reaction
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

            const freqData = new Uint8Array(analyser.frequencyBinCount);
            const updateBars = () => {
              if (!analyserRef.current || !active) return;
              analyserRef.current.getByteFrequencyData(freqData);

              const numBars = 18;
              const step = Math.max(1, Math.floor(freqData.length / numBars));
              const newBars: number[] = [];

              for (let i = 0; i < numBars; i++) {
                const val = freqData[i * step] || 0;
                // Normalize 0 to 100 with minimum floor
                const heightPercent = Math.max(15, Math.min(100, Math.round((val / 255) * 100)));
                newBars.push(heightPercent);
              }

              setBars(newBars);
              animFrameRef.current = requestAnimationFrame(updateBars);
            };

            updateBars();
          }
        } catch {
          // fallback
        }
      } catch (err) {
        console.warn('Microphone permission denied or unavailable:', err);
      }
    }

    initRecorder();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Timer counter
  useEffect(() => {
    if (!isRecording || isPaused) return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording, isPaused]);

  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const handleFinishAndSend = () => {
    setIsRecording(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const duration = Math.max(1, seconds);
    const waveform = bars.length > 0 ? bars : Array.from({ length: 22 }, () => Math.floor(Math.random() * 70) + 25);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (audioChunksRef.current.length > 0) {
          const mime = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mime });
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Audio = reader.result as string;
            onSendVoiceNote({
              duration,
              waveform,
              audioUrl: base64Audio,
            });
          };
          reader.readAsDataURL(audioBlob);
        } else {
          onSendVoiceNote({ duration, waveform });
        }
      };
      recorder.stop();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      onSendVoiceNote({ duration, waveform });
    }
  };

  const handleCancelRecording = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    onCancel();
  };

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-[#FAFAF9] border border-[#8FA89B] p-2.5 rounded-2xl w-full shadow-soft animate-fadeIn">
      {/* Cancel recording button */}
      <button
        type="button"
        onClick={handleCancelRecording}
        className="p-2 rounded-xl text-[#7A8A82] hover:text-red-500 hover:bg-red-50 transition-colors"
        title="Discard voice note"
      >
        <Trash2 size={18} />
      </button>

      {/* Recording status, Timer & Live Reactive Waveform */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'
            }`}
          />
          <span className="text-xs font-mono font-semibold text-[#2D3732] tabular-nums">
            {formatTimer(seconds)}
          </span>
        </div>

        {/* Real Dynamic Audio Reactive Waveform Bars */}
        <div className="flex items-center gap-1 h-7 flex-1 overflow-hidden px-1">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full transition-all duration-75 ${
                isPaused ? 'bg-[#C1CDC5]' : 'bg-[#8FA89B]'
              }`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

      {/* Pause/Resume button */}
      <button
        type="button"
        onClick={handleTogglePause}
        className="p-2 rounded-xl text-[#55635C] hover:bg-[#F1F5F2] transition-colors"
        title={isPaused ? 'Resume recording' : 'Pause recording'}
      >
        {isPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>

      {/* Send voice note button */}
      <button
        type="button"
        onClick={handleFinishAndSend}
        className="p-2.5 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white shadow-soft transition-all active:scale-95 flex items-center justify-center shrink-0 cursor-pointer"
        title="Send voice note"
      >
        <Send size={16} />
      </button>
    </div>
  );
};
