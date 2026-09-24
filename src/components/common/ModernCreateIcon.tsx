import React from 'react';

interface ModernCreateIconProps {
  className?: string;
  size?: number;
}

export const ModernCreateIcon: React.FC<ModernCreateIconProps> = ({
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
      className={`transition-all duration-300 group-hover:rotate-90 group-hover:scale-105 ${className}`}
    >
      <defs>
        <linearGradient id="createGradCore" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E2EBE5" />
        </linearGradient>
        <filter id="createGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.1" />
        </filter>
      </defs>

      {/* Cross Arms with Rounded Architectural Geometry */}
      {/* Horizontal Bar */}
      <path
        d="M5 12C5 10.8954 5.89543 10 7 10H17C18.1046 10 19 10.8954 19 12C19 13.1046 18.1046 14 17 14H7C5.89543 14 5 13.1046 5 12Z"
        fill="url(#createGradCore)"
        filter="url(#createGlow)"
      />

      {/* Vertical Bar */}
      <path
        d="M12 5C13.1046 5 14 5.89543 14 7V17C14 18.1046 13.1046 19 12 19C10.8954 19 10 18.1046 10 17V7C10 5.89543 10.8954 5 12 5Z"
        fill="url(#createGradCore)"
        filter="url(#createGlow)"
      />

      {/* Center Precision Diamond Accent */}
      <rect
        x="10.5"
        y="10.5"
        width="3"
        height="3"
        transform="rotate(45 12 12)"
        fill="#5E7C6E"
        opacity="0.35"
      />
    </svg>
  );
};
