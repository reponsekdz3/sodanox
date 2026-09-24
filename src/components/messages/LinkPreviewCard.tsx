import React, { useState } from 'react';
import { ExternalLink, Copy, Check, Globe } from 'lucide-react';
import { auraAudio } from '../../utils/audioSynthesizer';

interface LinkPreviewCardProps {
  url: string;
  isSelf?: boolean;
}

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex);
  return matches ? Array.from(new Set(matches)) : [];
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ url, isSelf = false }) => {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  let hostname = '';
  let pathname = '';
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.replace(/^www\./, '');
    pathname = parsed.pathname;
  } catch {
    hostname = url.replace(/^https?:\/\//, '').split('/')[0];
  }

  // Derive human friendly title from URL
  const formatTitle = () => {
    if (!pathname || pathname === '/') {
      return hostname.charAt(0).toUpperCase() + hostname.slice(1);
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const last = segments[segments.length - 1];
      const cleaned = decodeURIComponent(last).replace(/[-_]/g, ' ');
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return hostname;
  };

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    auraAudio.playClick(700, 0.03);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
      className={`mt-2 rounded-2xl p-2.5 sm:p-3 border transition-all cursor-pointer group flex items-start gap-3 select-none ${
        isSelf
          ? 'bg-white/10 hover:bg-white/15 border-white/20 text-white'
          : 'bg-[#F4F7F5] hover:bg-[#EAEFEA] border-[#DCE4DF] text-[#1E2A23]'
      }`}
      title={`Open ${url}`}
    >
      {/* Site Icon / Favicon */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-2xs ${
          isSelf ? 'bg-white/20' : 'bg-white border border-[#E6EDE9]'
        }`}
      >
        {!imgError ? (
          <img
            src={faviconUrl}
            alt={hostname}
            onError={() => setImgError(true)}
            className="w-5 h-5 object-contain"
          />
        ) : (
          <Globe size={18} className={isSelf ? 'text-white' : 'text-[#4A6757]'} />
        )}
      </div>

      {/* Link Information */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider truncate ${
              isSelf ? 'text-white/80' : 'text-[#4A6757]'
            }`}
          >
            {hostname}
          </span>
          <ExternalLink
            size={11}
            className={`transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
              isSelf ? 'text-white/70' : 'text-[#7A8A82]'
            }`}
          />
        </div>

        <p className="text-xs font-semibold truncate leading-tight">{formatTitle()}</p>
        <p
          className={`text-[11px] truncate mt-0.5 ${
            isSelf ? 'text-white/70' : 'text-[#7A8A82]'
          }`}
        >
          {url}
        </p>
      </div>

      {/* Copy link button */}
      <button
        type="button"
        onClick={handleCopy}
        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
          isSelf
            ? 'hover:bg-white/20 text-white/80'
            : 'hover:bg-[#DEE7E1] text-[#7A8A82] hover:text-[#2D3732]'
        }`}
        title="Copy Link URL"
      >
        {copied ? (
          <Check size={13} className="text-emerald-300 stroke-[3]" />
        ) : (
          <Copy size={13} />
        )}
      </button>
    </div>
  );
};
