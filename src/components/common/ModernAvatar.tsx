import React, { useState } from 'react';

/**
 * Ultra-Modern Minimalist Empty Avatar SVG
 * Clean geometric contours, subtle depth, and aesthetic nordic palette.
 */
export const MODERN_EMPTY_AVATAR_SVG = `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="aura-avatar-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#EEF3F0"/>
      <stop offset="100%" stop-color="#DEE7E2"/>
    </linearGradient>
    <linearGradient id="aura-avatar-silhouette" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7B9487"/>
      <stop offset="100%" stop-color="#597365"/>
    </linearGradient>
  </defs>
  <rect width="80" height="80" rx="40" fill="url(#aura-avatar-bg)"/>
  <circle cx="40" cy="40" r="38.75" stroke="#CDDAD1" stroke-width="2.5"/>
  <circle cx="40" cy="30" r="12.5" fill="url(#aura-avatar-silhouette)"/>
  <path d="M19.5 63.5C19.5 50.8 28.8 43 40 43C51.2 43 60.5 50.8 60.5 63.5C60.5 65.5 58.8 67 56 67H24C21.2 67 19.5 65.5 19.5 63.5Z" fill="url(#aura-avatar-silhouette)"/>
</svg>`;

export const MODERN_EMPTY_AVATAR_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(MODERN_EMPTY_AVATAR_SVG)}`;

export interface ModernAvatarProps {
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  ring?: boolean | string;
  status?: 'online' | 'offline' | 'idle' | null;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  title?: string;
}

const sizeConfig: Record<string, { dimension: string; px: number; text: string }> = {
  xs: { dimension: 'w-6 h-6', px: 24, text: 'text-[10px]' },
  sm: { dimension: 'w-8 h-8', px: 32, text: 'text-xs' },
  md: { dimension: 'w-10 h-10', px: 40, text: 'text-sm' },
  lg: { dimension: 'w-12 h-12', px: 48, text: 'text-base' },
  xl: { dimension: 'w-16 h-16', px: 64, text: 'text-xl' },
  '2xl': { dimension: 'w-24 h-24', px: 96, text: 'text-3xl' },
};

/**
 * Checks whether an avatar URL is a mock placeholder or empty
 */
export function isMockOrEmptyAvatar(url?: string | null): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (trimmed === '' || trimmed === 'default' || trimmed === 'none') return true;
  if (trimmed.includes('images.unsplash.com')) return true;
  if (trimmed.includes('placeholder') || trimmed.includes('dummyimage')) return true;
  if (trimmed === MODERN_EMPTY_AVATAR_DATA_URI) return true;
  return false;
}

export const ModernAvatar: React.FC<ModernAvatarProps> = ({
  src,
  alt = 'Avatar',
  size = 'md',
  className = '',
  ring = false,
  status = null,
  onClick,
  title,
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeStyle = typeof size === 'number'
    ? { width: `${size}px`, height: `${size}px` }
    : undefined;

  const sizeClass = typeof size === 'string'
    ? (sizeConfig[size]?.dimension || sizeConfig.md.dimension)
    : '';

  const ringClass = ring === true
    ? 'ring-2 ring-[#8FA89B]'
    : typeof ring === 'string'
    ? ring
    : '';

  const hasValidCustomPhoto = !imgError && !isMockOrEmptyAvatar(src);

  return (
    <div
      onClick={onClick}
      title={title || alt}
      style={sizeStyle}
      className={`relative inline-flex items-center justify-center shrink-0 select-none rounded-full overflow-hidden ${sizeClass} ${ringClass} ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''} ${className}`}
    >
      {hasValidCustomPhoto && src ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <svg
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full rounded-full"
          aria-label={alt}
        >
          <defs>
            <linearGradient id="aura-avatar-bg-inline" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EEF3F0" />
              <stop offset="100%" stopColor="#DFE7E2" />
            </linearGradient>
            <linearGradient id="aura-avatar-sil-inline" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7B9487" />
              <stop offset="100%" stopColor="#556E61" />
            </linearGradient>
          </defs>
          <rect width="80" height="80" rx="40" fill="url(#aura-avatar-bg-inline)" />
          <circle cx="40" cy="40" r="38.75" stroke="#CDDAD1" strokeWidth="2.5" />
          <circle cx="40" cy="29.5" r="12" fill="url(#aura-avatar-sil-inline)" />
          <path
            d="M19 64C19 51 28.5 43.5 40 43.5C51.5 43.5 61 51 61 64C61 66 59.2 67.5 56.5 67.5H23.5C20.8 67.5 19 66 19 64Z"
            fill="url(#aura-avatar-sil-inline)"
          />
        </svg>
      )}

      {/* Online / Active Presence Badge */}
      {status === 'online' && (
        <span
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white"
          title="Online"
        />
      )}
      {status === 'idle' && (
        <span
          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white"
          title="Idle"
        />
      )}
    </div>
  );
};
