import React, { useState } from 'react';
import { Check, UserPlus, Sparkles } from 'lucide-react';
import { auraAudio } from '../../utils/audioSynthesizer';

interface FollowButtonProps {
  isFollowing: boolean;
  userId: string;
  onToggleFollow: (userId: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isFollower?: boolean;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  isFollowing,
  userId,
  onToggleFollow,
  size = 'md',
  className = '',
  isFollower = false,
}) => {
  const [isCelebrating, setIsCelebrating] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isFollowing) {
      // User is following now! Trigger celebration!
      auraAudio.playChime();
      setIsCelebrating(true);
      onToggleFollow(userId);

      setTimeout(() => {
        setIsCelebrating(false);
      }, 2600);
    } else {
      auraAudio.playClick(440, 0.04);
      onToggleFollow(userId);
    }
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1 text-[11px] rounded-xl',
    md: 'px-3.5 py-1.5 text-xs rounded-xl',
    lg: 'px-5 py-2 text-xs sm:text-sm rounded-2xl',
  };

  if (isCelebrating) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`relative inline-flex items-center gap-1.5 font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 shadow-md animate-bounce active:scale-95 transition-all cursor-pointer overflow-hidden ${sizeClasses[size]} ${className}`}
      >
        {/* Confetti sparkle particles */}
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <Sparkles size={size === 'sm' ? 12 : 14} className="animate-spin text-amber-200" />
        <span className="tracking-wide">🎉 Congratulations! Following</span>
      </button>
    );
  }

  if (isFollowing) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 font-medium transition-all cursor-pointer bg-[#E6EDE9] hover:bg-neutral-200 text-[#2D3732] active:scale-95 ${sizeClasses[size]} ${className}`}
      >
        <Check size={size === 'sm' ? 12 : 14} className="text-[#5C7567]" />
        <span>Following</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 font-medium transition-all shadow-xs cursor-pointer active:scale-95 ${
        isFollower
          ? 'bg-[#2D3732] hover:bg-[#3d4a43] text-white'
          : 'bg-[#8FA89B] hover:bg-[#7e9689] text-white'
      } ${sizeClasses[size]} ${className}`}
    >
      <UserPlus size={size === 'sm' ? 12 : 14} />
      <span>{isFollower ? 'Follow Back' : 'Follow'}</span>
    </button>
  );
};
