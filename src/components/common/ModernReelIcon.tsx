import React from 'react';

interface ModernReelIconProps {
  className?: string;
  size?: number;
  active?: boolean;
}

export const ModernReelIcon: React.FC<ModernReelIconProps> = ({
  className = '',
  size = 20,
  active = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-300 ${active ? 'scale-105' : 'hover:scale-105'} ${className}`}
    >
      <defs>
        <linearGradient id="reelGradPrimary" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor={active ? '#5E7C6E' : '#2D3732'} />
          <stop offset="1" stopColor={active ? '#8FA89B' : '#7A8A82'} />
        </linearGradient>
        <linearGradient id="reelGradAccent" x1="7" y1="7" x2="17" y2="17" gradientUnits="userSpaceOnUse">
          <stop stopColor={active ? '#8FA89B' : '#A1B0A8'} />
          <stop offset="1" stopColor={active ? '#5E7C6E' : '#7A8A82'} />
        </linearGradient>
      </defs>

      {/* Outer Cinema Film Canister Ring */}
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.5"
        stroke="url(#reelGradPrimary)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-colors"
      />

      {/* Top Film Strip Perforations */}
      <path
        d="M2.5 7.5H21.5"
        stroke="url(#reelGradPrimary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line x1="7" y1="2.5" x2="7" y2="7.5" stroke="url(#reelGradPrimary)" strokeWidth="1.5" />
      <line x1="12" y1="2.5" x2="12" y2="7.5" stroke="url(#reelGradPrimary)" strokeWidth="1.5" />
      <line x1="17" y1="2.5" x2="17" y2="7.5" stroke="url(#reelGradPrimary)" strokeWidth="1.5" />

      {/* Center Cinematic Playhead Aperture */}
      <path
        d="M10 10.5L16 14.5L10 18.5V10.5Z"
        fill={active ? 'url(#reelGradPrimary)' : 'currentColor'}
        stroke="url(#reelGradPrimary)"
        strokeWidth="1.25"
        strokeLinejoin="round"
        className="transition-transform origin-center"
      />

      {/* Micro Lens Perforation Glow Accent */}
      {active && (
        <circle
          cx="19"
          cy="5"
          r="1.2"
          className="fill-emerald-500 animate-pulse"
        />
      )}
    </svg>
  );
};
