import React, { useEffect } from 'react';
import { Sparkles, ExternalLink, MessageSquare, CheckCircle2, ShoppingBag } from 'lucide-react';
import { SponsoredAd, User } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import { recordAdImpression, recordAdClick } from '../../services/marketplaceService';
import { auraAudio } from '../../utils/audioSynthesizer';

interface SponsoredFeedAdCardProps {
  ad: SponsoredAd;
  currentUser: User;
  onOpenDirectChat?: (advertiser: User) => void;
  onNavigateTab?: (tab: string) => void;
}

export const SponsoredFeedAdCard: React.FC<SponsoredFeedAdCardProps> = ({
  ad,
  currentUser,
  onOpenDirectChat,
  onNavigateTab,
}) => {
  // Record impression once when ad mounts
  useEffect(() => {
    recordAdImpression(ad.id).catch(() => {});
  }, [ad.id]);

  const handleCtaClick = () => {
    auraAudio.playClick(650, 0.04);
    recordAdClick(ad.id).catch(() => {});

    if (ad.ctaUrl && ad.ctaUrl.startsWith('http')) {
      window.open(ad.ctaUrl, '_blank', 'noopener,noreferrer');
    } else if (onNavigateTab) {
      onNavigateTab('marketplace');
      window.location.hash = '#/marketplace';
    } else {
      window.location.hash = '#/marketplace';
    }
  };

  const handleMessageAdvertiser = () => {
    auraAudio.playClick(500, 0.03);
    recordAdClick(ad.id).catch(() => {});

    const advertiserUser: User = {
      id: ad.sellerId,
      name: ad.sellerName,
      username: ad.sellerUsername,
      avatar: ad.sellerAvatar,
      bannerUrl: '',
      bio: `Official advertiser for ${ad.title}`,
      pronouns: '',
      location: 'Kigali, Rwanda',
      website: '',
      joinedDate: 'Joined 2026',
      followersCount: 1420,
      followingCount: 88,
      followers: [],
      following: [],
      isFollowing: false,
      isFollower: false,
      isMutual: false,
      verified: true,
      verifiedBadgeType: 'blue',
      privateAccount: false,
    };

    onOpenDirectChat?.(advertiserUser);
  };

  return (
    <article className="bg-white rounded-3xl border border-[#D1E2D9] p-4 sm:p-6 mb-4 shadow-soft hover:shadow-soft-lg transition-all duration-300 relative overflow-hidden group">
      {/* Top Banner Tag */}
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <ModernAvatar
            src={ad.sellerAvatar}
            alt={ad.sellerName}
            size="md"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-sm text-[#022C22] group-hover:text-[#059669] transition-colors">
                {ad.sellerName}
              </h4>
              <CheckCircle2 size={14} fill="#3B82F6" className="text-white inline" />
            </div>
            <p className="text-[11px] text-[#4B6358] font-mono">@{ad.sellerUsername}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[#064E3B] text-[11px] font-bold shadow-2xs">
          <Sparkles size={12} className="text-[#059669]" />
          <span>Sponsored Ad</span>
        </div>
      </div>

      {/* Title & Copy */}
      <div className="space-y-1.5 mb-3.5">
        <h3 className="text-base sm:text-lg font-bold text-[#022C22] leading-snug">
          {ad.title}
        </h3>
        <p className="text-xs sm:text-sm text-[#3D5A4C] leading-relaxed">
          {ad.description}
        </p>
      </div>

      {/* Media Banner */}
      {ad.mediaUrl && (
        <div className="relative rounded-2xl overflow-hidden mb-4 bg-neutral-900 max-h-[460px] border border-[#E2EAE5]">
          {ad.mediaType === 'video' ? (
            <video
              src={ad.mediaUrl}
              controls
              className="w-full h-auto max-h-[460px] object-cover"
            />
          ) : (
            <img
              src={ad.mediaUrl}
              alt={ad.title}
              className="w-full h-auto max-h-[460px] object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            />
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="pt-2 border-t border-[#EDF3F0] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMessageAdvertiser}
            className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#EDF3F0] hover:bg-[#E2EDE7] text-[#022C22] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare size={14} className="text-[#059669]" />
            <span>Chat Advertiser</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleCtaClick}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#064E3B] to-[#059669] hover:from-[#022C22] hover:to-[#047857] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
        >
          <ShoppingBag size={14} />
          <span>{ad.ctaText || 'Shop Collection'}</span>
          <ExternalLink size={13} />
        </button>
      </div>
    </article>
  );
};
