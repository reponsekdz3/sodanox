import React from 'react';

interface HeroAddIconProps {
  className?: string;
  size?: number;
}

export const HeroAddIcon: React.FC<HeroAddIconProps> = ({
  className = '',
  size = 18,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-all duration-300 group-hover:rotate-90 group-hover:scale-110 shrink-0 ${className}`}
    >
      <defs>
        <linearGradient
          id="heroAddGradCore"
          x1="3"
          y1="3"
          x2="21"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFFF" />
          <stop offset="0.7" stopColor="#F0F6F2" />
          <stop offset="1" stopColor="#D9E7DF" />
        </linearGradient>

        <filter id="heroAddSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="0.8" floodColor="#000000" floodOpacity="0.18" />
        </filter>
      </defs>

      {/* Horizontal Bar with Rounded Architectural Capsule Edges */}
      <rect
        x="4"
        y="10.5"
        width="16"
        height="3"
        rx="1.5"
        fill="url(#heroAddGradCore)"
        filter="url(#heroAddSoftGlow)"
      />

      {/* Vertical Bar with Rounded Architectural Capsule Edges */}
      <rect
        x="10.5"
        y="4"
        width="3"
        height="16"
        rx="1.5"
        fill="url(#heroAddGradCore)"
        filter="url(#heroAddSoftGlow)"
      />

      {/* Diamond Precision Core Highlight */}
      <rect
        x="10.5"
        y="10.5"
        width="3"
        height="3"
        transform="rotate(45 12 12)"
        fill="#4A6557"
        opacity="0.3"
      />
    </svg>
  );
};
