import React from 'react';

interface AuraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
  variant?: 'sage' | 'dark' | 'white';
}

export const AuraLogo: React.FC<AuraLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
  variant = 'sage',
}) => {
  const sizeMap = {
    sm: { mark: 22, text: 'text-base', gap: 'gap-2' },
    md: { mark: 28, text: 'text-xl', gap: 'gap-2.5' },
    lg: { mark: 36, text: 'text-2xl', gap: 'gap-3' },
    xl: { mark: 48, text: 'text-3xl', gap: 'gap-3.5' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const textColor =
    variant === 'white'
      ? 'text-white'
      : variant === 'dark'
      ? 'text-[#1F2622]'
      : 'text-[#2D3732]';

  return (
    <div className={`inline-flex items-center ${currentSize.gap} select-none ${className}`}>
      {/* Aura Radiant Mark */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={currentSize.mark}
          height={currentSize.mark}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-transform duration-300 hover:scale-105"
        >
          <defs>
            <radialGradient
              id="aura-halo-grad"
              cx="50%"
              cy="50%"
              r="50%"
              fx="40%"
              fy="40%"
            >
              <stop offset="0%" stopColor="#A8C0B2" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#8FA89B" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#6C8879" stopOpacity="0.95" />
            </radialGradient>
            <linearGradient id="aura-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A8C0B2" />
              <stop offset="100%" stopColor="#5E7C6E" />
            </linearGradient>
            <filter id="aura-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Outer soft ambient aura ring */}
          <circle
            cx="20"
            cy="20"
            r="17"
            stroke="url(#aura-halo-grad)"
            strokeWidth="1.75"
            strokeDasharray="4 2"
            opacity="0.5"
            className="animate-spin-slow origin-center"
          />

          {/* Middle radiant aura loop */}
          <circle
            cx="20"
            cy="20"
            r="12.5"
            stroke="url(#aura-ring-grad)"
            strokeWidth="2.25"
            strokeLinecap="round"
            filter="url(#aura-glow)"
          />

          {/* Inner luminous focal sphere */}
          <circle cx="20" cy="20" r="5.5" fill="url(#aura-halo-grad)" />

          {/* Zenith glint */}
          <circle cx="18" cy="18" r="1.5" fill="#FFFFFF" opacity="0.9" />
        </svg>
      </div>

      {/* Aura Brand Wordmark */}
      {showWordmark && (
        <div className="flex flex-col justify-center leading-none">
          <span
            className={`font-serif font-semibold tracking-wide ${currentSize.text} ${textColor}`}
          >
            Aura
          </span>
        </div>
      )}
    </div>
  );
};
