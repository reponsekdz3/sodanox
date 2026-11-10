import React from 'react';
import { Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '../../services/mediaCompressionService';

interface UploadProgressBarProps {
  progress: number; // 0 to 100
  statusText?: string;
  bytesTransferred?: number;
  totalBytes?: number;
  savingsPercent?: number;
  isComplete?: boolean;
  errorText?: string;
  className?: string;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  statusText = 'Compressing & uploading media...',
  bytesTransferred,
  totalBytes,
  savingsPercent,
  isComplete = false,
  errorText,
  className = '',
}) => {
  const safeProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className={`p-4 rounded-2xl bg-white border border-[#D1E2D9] shadow-soft space-y-2.5 select-none animate-fade-in ${className}`}
    >
      {/* Top Labels */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-[#022C22] truncate">
          {isComplete ? (
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          ) : (
            <Sparkles size={16} className="text-[#059669] shrink-0 animate-spin" />
          )}
          <span className="truncate font-medium">{statusText}</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#064E3B] shrink-0 ml-2 bg-[#D1FAE5] px-2 py-0.5 rounded-lg border border-[#A7F3D0]">
          <span>{safeProgress}%</span>
        </div>
      </div>

      {/* Progress Track & Animated Line */}
      <div className="relative w-full h-2.5 bg-[#EDF3F0] rounded-full overflow-hidden border border-[#D1E2D9]/60">
        <div
          className="h-full bg-gradient-to-r from-[#064E3B] via-[#059669] to-[#34D399] rounded-full transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${safeProgress}%` }}
        />
        {/* Shimmer effect */}
        {safeProgress < 100 && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse"
            style={{ width: `${safeProgress}%` }}
          />
        )}
      </div>

      {errorText && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {errorText}
        </div>
      )}

      {/* Bottom Byte Info / Savings */}
      <div className="flex items-center justify-between text-[11px] text-[#3D5A4C]">
        <div className="font-mono">
          {bytesTransferred !== undefined && totalBytes !== undefined && totalBytes > 0 ? (
            <span>
              {formatBytes(bytesTransferred)} / {formatBytes(totalBytes)}
            </span>
          ) : (
            <span>High-efficiency WebP compression</span>
          )}
        </div>

        {savingsPercent !== undefined && savingsPercent > 0 && (
          <div className="flex items-center gap-1 text-emerald-800 font-semibold font-mono">
            <Zap size={12} className="text-emerald-600" />
            <span>-{savingsPercent}% saved</span>
          </div>
        )}
      </div>
    </div>
  );
};
