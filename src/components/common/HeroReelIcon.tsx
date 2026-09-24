import React from 'react';

interface HeroReelIconProps {
  className?: string;
  size?: number;
  active?: boolean;
}

export const HeroReelIcon: React.FC<HeroReelIconProps> = ({
  className = '',
  size = 22,
  active = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-300 ${
        active ? 'scale-105 filter drop-shadow-sm' : 'hover:scale-105'
      } ${className}`}
    >
      <defs>
        <linearGradient
          id="heroReelBorderGrad"
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={active ? '#4A6557' : '#334038'} />
          <stop offset="0.5" stopColor={active ? '#6D8E7D' : '#5E7066'} />
          <stop offset="1" stopColor={active ? '#8FA89B' : '#7A8C82'} />
        </linearGradient>

        <linearGradient
          id="heroReelPlayGrad"
          x1="9"
          y1="10"
          x2="17"
          y2="17"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={active ? '#3D5548' : '#2D3732'} />
          <stop offset="1" stopColor={active ? '#7A9A8B' : '#5C6E64'} />
        </linearGradient>

        <linearGradient
          id="heroReelGlowGrad"
          x1="0"
          y1="0"
          x2="24"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8FA89B" stopOpacity="0.25" />
          <stop offset="1" stopColor="#5E7C6E" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Ambient Backing Glow on Active */}
      {active && (
        <rect
          x="1.5"
          y="1.5"
          width="21"
          height="21"
          rx="6"
          fill="url(#heroReelGlowGrad)"
        />
      )}

      {/* Cinema Frame Exterior Chassis with Precision Rounded Squircle */}
      <rect
        x="2.25"
        y="2.25"
        width="19.5"
        height="19.5"
        rx="5.5"
        stroke="url(#heroReelBorderGrad)"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={active ? '#EAF1ED' : 'transparent'}
        className="transition-colors duration-200"
      />

      {/* Top Cinema Clapperboard Divider */}
      <line
        x1="2.25"
        y1="7.75"
        x2="21.75"
        y2="7.75"
        stroke="url(#heroReelBorderGrad)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Signature Diagonal Clapper Speed Stripes */}
      <line
        x1="6.5"
        y1="2.25"
        x2="9.5"
        y2="7.75"
        stroke="url(#heroReelBorderGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="11.5"
        y1="2.25"
        x2="14.5"
        y2="7.75"
        stroke="url(#heroReelBorderGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="16.5"
        y1="2.25"
        x2="19.5"
        y2="7.75"
        stroke="url(#heroReelBorderGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Center Cinematic Playhead Triangle */}
      <path
        d="M10.2 10.8C10.2 10.35 10.7 10.05 11.1 10.28L15.9 13.08C16.3 13.31 16.3 13.89 15.9 14.12L11.1 16.92C10.7 17.15 10.2 16.85 10.2 16.4V10.8Z"
        fill="url(#heroReelPlayGrad)"
        stroke="url(#heroReelBorderGrad)"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />

      {/* Reel Spool Micro Perforations at Lower corners */}
      <circle
        cx="5"
        cy="18.5"
        r="1"
        fill={active ? '#5E7C6E' : '#7A8C82'}
        opacity="0.8"
      />
      <circle
        cx="19"
        cy="18.5"
        r="1"
        fill={active ? '#5E7C6E' : '#7A8C82'}
        opacity="0.8"
      />

      {/* Active Live Broadcast Emerald Beacon */}
      {active && (
        <circle
          cx="19"
          cy="5"
          r="1.3"
          className="fill-emerald-500 animate-pulse"
        />
      )}
    </svg>
  );
};
