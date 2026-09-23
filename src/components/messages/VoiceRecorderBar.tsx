import React, { useState, useEffect, useRef } from 'react';
import { Mic, Trash2, Send } from 'lucide-react';
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
  const [bars, setBars] = useState<number[]>([30, 45, 60, 40, 55, 70, 85, 50, 40, 65, 80, 60, 45, 75, 90]);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Attempt real audio recording via MediaRecorder
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaStreamRef.current = stream;
          try {
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                audioChunksRef.current.push(event.data);
              }
            };

            recorder.start(100);
          } catch (err) {
            console.warn('MediaRecorder error, falling back to simulated audio:', err);
          }
        })
        .catch((err) => {
          console.warn('Microphone access denied or not available:', err);
        });
    }

    return () => {
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

  useEffect(() => {
    if (!isRecording) return;

    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
      // Dynamically animate waveform bars
      setBars((prev) =>
        prev.map(() => Math.floor(Math.random() * 75) + 25)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  const handleFinishAndSend = () => {
    setIsRecording(false);
    const duration = Math.max(1, seconds);
    const waveform = Array.from({ length: 22 }, () =>
      Math.floor(Math.random() * 70) + 25
    );

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
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

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-[#FAFAF9] border border-[#8FA89B] p-2.5 rounded-2xl w-full shadow-soft animate-fade-in">
      {/* Cancel recording button */}
      <button
        type="button"
        onClick={() => {
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
        }}
        className="p-2 rounded-xl text-[#7A8A82] hover:text-red-500 hover:bg-red-50 transition-colors"
        title="Discard voice note"
      >
        <Trash2 size={18} />
      </button>

      {/* Recording status & Live waveform animation */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-mono font-medium text-[#2D3732] tabular-nums">
            {formatTimer(seconds)}
          </span>
        </div>

        {/* Animated sound bars */}
        <div className="flex items-center gap-[3px] h-6 flex-1 overflow-hidden">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-[#8FA89B] rounded-full transition-all duration-300"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>

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
