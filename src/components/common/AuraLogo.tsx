import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
  Flame,
  X,
  Compass,
} from 'lucide-react';
import { auraAudio } from '../../utils/audioSynthesizer';
import { User } from '../../types';

interface AuraLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  className?: string;
  variant?: 'sage' | 'dark' | 'white';
  currentUser?: User | null;
  onOpenCreatePost?: () => void;
  onToggleTheme?: (theme: 'nordic' | 'alabaster' | 'dusk') => void;
  onNavigateHome?: () => void;
  isInteractive?: boolean;
}

export const AuraLogo: React.FC<AuraLogoProps> = ({
  size = 'md',
  showWordmark = true,
  className = '',
  variant = 'sage',
  currentUser,
  onOpenCreatePost,
  onToggleTheme,
  onNavigateHome,
  isInteractive = true,
}) => {
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [activeAmbient, setActiveAmbient] = useState<'off' | 'rain' | 'vinyl' | 'binaural' | 'forest'>('off');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  const sizeMap = {
    sm: { mark: 26, text: 'text-sm', sub: 'text-[9px]', gap: 'gap-2' },
    md: { mark: 34, text: 'text-lg', sub: 'text-[10px]', gap: 'gap-2.5' },
    lg: { mark: 42, text: 'text-2xl', sub: 'text-xs', gap: 'gap-3' },
    xl: { mark: 52, text: 'text-3xl', sub: 'text-xs', gap: 'gap-3.5' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const textColor =
    variant === 'white'
      ? 'text-white'
      : variant === 'dark'
      ? 'text-[#1F2622]'
      : 'text-[#2D3732]';

  // Close dock on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsDockOpen(false);
      }
    };
    if (isDockOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDockOpen]);

  const handleLogoClick = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    e.stopPropagation();
    auraAudio.playClick(720, 0.05);
    setIsDockOpen((prev) => !prev);
  };

  const handleSelectAmbient = (mode: 'off' | 'rain' | 'vinyl' | 'binaural' | 'forest') => {
    auraAudio.playClick(650, 0.04);
    setActiveAmbient(mode);
    auraAudio.setAmbient(mode);
  };

  const handleCopyProfileUrl = () => {
    auraAudio.playClick(800, 0.04);
    const username = currentUser?.username || 'member';
    const domain = typeof window !== 'undefined' ? window.location.origin : 'https://aura.social';
    navigator.clipboard?.writeText(`${domain}/@${username}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleToggleFocus = () => {
    auraAudio.playClick(500, 0.04);
    const next = !isFocusMode;
    setIsFocusMode(next);
    if (next) {
      document.body.classList.add('aura-focus-mode');
    } else {
      document.body.classList.remove('aura-focus-mode');
    }
  };

  return (
    <div className={`relative inline-flex items-center ${currentSize.gap} select-none ${className}`}>
      {/* Clickable Interactive Logo Button */}
      <div
        onClick={handleLogoClick}
        title={isInteractive ? 'Click to open Aura Command Dock' : 'Aura'}
        className={`relative flex items-center justify-center shrink-0 group ${
          isInteractive ? 'cursor-pointer active:scale-95 transition-transform' : ''
        }`}
      >
        <svg
          width={currentSize.mark}
          height={currentSize.mark}
          viewBox="0 0 44 44"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-all duration-500 group-hover:rotate-12"
        >
          <defs>
            <radialGradient id="aura-halo-prime" cx="50%" cy="50%" r="50%" fx="35%" fy="35%">
              <stop offset="0%" stopColor="#C4DBD0" stopOpacity="0.95" />
              <stop offset="45%" stopColor="#8FA89B" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#4A6557" stopOpacity="0.98" />
            </radialGradient>

            <linearGradient id="aura-ring-dynamic" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#B3CFBF" />
              <stop offset="50%" stopColor="#8FA89B" />
              <stop offset="100%" stopColor="#3C5246" />
            </linearGradient>

            <filter id="aura-radiance-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>
          </defs>

          {/* Outer Breathing Kinetic Orbit */}
          <circle
            cx="22"
            cy="22"
            r="19"
            stroke="url(#aura-ring-dynamic)"
            strokeWidth="1.8"
            strokeDasharray="6 3 2 3"
            opacity="0.65"
            className="animate-spin-slow origin-center"
          />

          {/* Middle Radiant Energy Ring */}
          <circle
            cx="22"
            cy="22"
            r="14"
            stroke="url(#aura-ring-dynamic)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#aura-radiance-glow)"
            opacity="0.9"
          />

          {/* Orbital Satellites (Sacred Geometry Nodes) */}
          <circle cx="22" cy="8" r="2.2" fill="#8FA89B" className="animate-pulse" />
          <circle cx="36" cy="22" r="1.8" fill="#5E7C6E" />
          <circle cx="22" cy="36" r="2.2" fill="#8FA89B" className="animate-pulse" />
          <circle cx="8" cy="22" r="1.8" fill="#5E7C6E" />

          {/* Core Luminous Focal Sphere */}
          <circle cx="22" cy="22" r="6.5" fill="url(#aura-halo-prime)" />

          {/* Zenith Star Glint */}
          <circle cx="20" cy="20" r="1.8" fill="#FFFFFF" opacity="0.95" />
          <circle cx="24" cy="24" r="0.9" fill="#FFFFFF" opacity="0.6" />
        </svg>

        {/* Live Audio / Status Pulse Indicator */}
        {activeAmbient !== 'off' && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        )}
      </div>

      {/* Wordmark cleanly styled with real brand identity */}
      {showWordmark && (
        <div
          onClick={(e) => {
            if (onNavigateHome) {
              e.stopPropagation();
              auraAudio.playClick(600, 0.04);
              onNavigateHome();
            } else {
              handleLogoClick(e);
            }
          }}
          className={`flex flex-col justify-center leading-tight select-none ${
            isInteractive || onNavigateHome ? 'cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`font-serif font-bold tracking-tight ${currentSize.text} ${textColor}`}
            >
              Aura
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-[#8FA89B]/20 text-[#3C5246] font-mono text-[9px] font-bold tracking-wider uppercase border border-[#8FA89B]/35 flex items-center gap-1 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Social</span>
            </span>
          </div>
          <span className={`${currentSize.sub} text-[#7A8A82] font-mono tracking-wider mt-0.5 hidden sm:block`}>
            mindful network
          </span>
        </div>
      )}

      {/* Advanced Aura Command Deck Popover */}
      {isDockOpen && (
        <div
          ref={dockRef}
          className="absolute top-full left-0 mt-3 w-80 sm:w-88 bg-[#FAFAF9] rounded-3xl shadow-2xl border border-[#2D3732]/15 p-5 z-50 animate-fade-in backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#2D3732]/10 mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#8FA89B]/20 flex items-center justify-center text-[#5E7C6E]">
                <Radio size={16} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#2D3732]">Aura Command Dock</h4>
                <p className="text-[10px] text-[#7A8A82] font-mono">Real-time aura controls</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsDockOpen(false)}
              className="p-1.5 rounded-full text-[#7A8A82] hover:bg-black/5 cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* 1. Acoustic Soundscapes */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#2D3732]">
              <span className="flex items-center gap-1.5">
                <Volume2 size={13} className="text-[#8FA89B]" />
                <span>Ambient Soundscape</span>
              </span>
              <span className="text-[10px] text-[#7A8A82] font-mono uppercase">
                {activeAmbient === 'off' ? 'Muted' : activeAmbient}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'off', label: 'Mute', icon: VolumeX },
                { id: 'rain', label: 'Nordic Rain', icon: Sparkles },
                { id: 'vinyl', label: 'Warm Vinyl', icon: Sliders },
                { id: 'binaural', label: '432Hz Calm', icon: Radio },
                { id: 'forest', label: 'Forest Wind', icon: Compass },
              ].map((item) => {
                const Icon = item.icon;
                const isSel = activeAmbient === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectAmbient(item.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-medium transition-all flex items-center justify-center gap-1 border cursor-pointer active:scale-95 ${
                      isSel
                        ? 'bg-[#8FA89B] text-white border-[#8FA89B] shadow-xs'
                        : 'bg-[#F1F5F2] text-[#55635C] border-transparent hover:border-[#8FA89B]/40'
                    }`}
                  >
                    <Icon size={11} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Zen Focus & Quick Reflection */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleFocus}
                className={`flex-1 py-2 px-3 rounded-2xl text-xs font-medium border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isFocusMode
                    ? 'bg-[#2D3732] text-white border-[#2D3732]'
                    : 'bg-[#F1F5F2] text-[#2D3732] border-[#2D3732]/10 hover:border-[#8FA89B]'
                }`}
              >
                <Zap size={13} className={isFocusMode ? 'text-amber-400' : 'text-[#8FA89B]'} />
                <span>{isFocusMode ? 'Exit Zen Mode' : 'Zen Focus Mode'}</span>
              </button>

              {onOpenCreatePost && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDockOpen(false);
                    onOpenCreatePost();
                  }}
                  className="flex-1 py-2 px-3 rounded-2xl text-xs font-semibold bg-[#8FA89B] text-white hover:bg-[#7e9689] flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Flame size={13} />
                  <span>Express Post</span>
                </button>
              )}
            </div>
          </div>

          {/* 3. Link & Cloud Engine Status */}
          <div className="p-3 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-2">
            <div className="flex items-center justify-between text-[10px] text-[#7A8A82]">
              <span className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-600" />
                <span>Cloud Firestore Active</span>
              </span>
              <span className="font-mono text-emerald-700">● Live sync</span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#2D3732]/5">
              <span className="text-[11px] font-mono text-[#55635C] truncate">
                aura.social/@{currentUser?.username || 'member'}
              </span>
              <button
                type="button"
                onClick={handleCopyProfileUrl}
                className="p-1 px-2 rounded-lg bg-white border border-[#2D3732]/10 text-[10px] font-medium text-[#2D3732] hover:bg-[#FAFAF9] flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Developer Attribution Footer */}
          <div className="mt-3 pt-2 text-center border-t border-[#2D3732]/5">
            <p className="text-[10px] text-[#7A8A82] font-mono">
              developed by reponsekdz · Aura Social
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
