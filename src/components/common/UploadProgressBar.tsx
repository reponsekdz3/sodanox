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
  className?: string;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  statusText = 'Compressing & uploading media...',
  bytesTransferred,
  totalBytes,
  savingsPercent,
  isComplete = false,
  className = '',
}) => {
  const safeProgress = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div
      className={`p-3.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-2 select-none animate-fade-in ${className}`}
    >
      {/* Top Labels */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium text-[#2D3732] truncate">
          {isComplete ? (
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          ) : (
            <Sparkles size={15} className="text-[#8FA89B] shrink-0 animate-spin" />
          )}
          <span className="truncate">{statusText}</span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-[#2D3732] shrink-0 ml-2">
          <span>{safeProgress}%</span>
        </div>
      </div>

      {/* Progress Track & Animated Line */}
      <div className="relative w-full h-2.5 bg-neutral-200/80 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#8FA89B] to-[#5C7567] rounded-full transition-all duration-300 ease-out shadow-xs"
          style={{ width: `${safeProgress}%` }}
        />
        {/* Shimmer effect */}
        {safeProgress < 100 && (
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"
            style={{ width: `${safeProgress}%` }}
          />
        )}
      </div>

      {/* Bottom Byte Info / Savings */}
      <div className="flex items-center justify-between text-[11px] text-[#7A8A82]">
        <div>
          {bytesTransferred !== undefined && totalBytes !== undefined && totalBytes > 0 ? (
            <span>
              {formatBytes(bytesTransferred)} / {formatBytes(totalBytes)}
            </span>
          ) : (
            <span>High-efficiency WebP compression</span>
          )}
        </div>

        {savingsPercent !== undefined && savingsPercent > 0 && (
          <div className="flex items-center gap-1 text-emerald-700 font-medium font-mono">
            <Zap size={11} className="text-emerald-600" />
            <span>-{savingsPercent}% saved</span>
          </div>
        )}
      </div>
    </div>
  );
};
