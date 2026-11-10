import React, { useState, useEffect } from 'react';
import { Plus, Sparkles, X, ShoppingBag, ExternalLink } from 'lucide-react';
import { Story, User, SponsoredAd } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import { getActiveAds, recordAdImpression, recordAdClick } from '../../services/marketplaceService';
import { auraAudio } from '../../utils/audioSynthesizer';

interface StoryBarProps {
  stories: Story[];
  currentUser: User;
  onSelectStory: (storyIndex: number) => void;
  onOpenCreateStory: () => void;
}

export const StoryBar: React.FC<StoryBarProps> = ({
  stories,
  currentUser,
  onSelectStory,
  onOpenCreateStory,
}) => {
  const [storyAds, setStoryAds] = useState<SponsoredAd[]>([]);
  const [viewingAd, setViewingAd] = useState<SponsoredAd | null>(null);

  useEffect(() => {
    getActiveAds('story_ad').then(setStoryAds).catch(() => {});
  }, []);

  const handleOpenAd = (ad: SponsoredAd) => {
    auraAudio.playClick(600, 0.04);
    recordAdImpression(ad.id).catch(() => {});
    setViewingAd(ad);
  };
  const myStoryIndex = stories.findIndex((s) => s.userId === currentUser.id);
  const myStory = myStoryIndex !== -1 ? stories[myStoryIndex] : null;

  return (
    <div className="w-full bg-[#FAFAF9] border-b border-[#F1F5F2] py-4 px-4 sm:px-6">
      <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
        {/* Your Story button */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 group">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (myStory) {
                  onSelectStory(myStoryIndex);
                } else {
                  onOpenCreateStory();
                }
              }}
              className={`w-16 h-16 rounded-full p-[2.5px] transition-all transform group-hover:scale-105 ${
                myStory
                  ? 'bg-gradient-to-tr from-[#8FA89B] via-[#6d8a7c] to-[#E6EDE9]'
                  : 'bg-[#E6EDE9] hover:bg-[#8FA89B]/40'
              }`}
            >
              <div className="w-full h-full rounded-full p-[2px] bg-[#FAFAF9] flex items-center justify-center">
                <ModernAvatar
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  size="lg"
                  className="w-full h-full"
                />
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateStory();
              }}
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#8FA89B] hover:bg-[#7a9486] text-white flex items-center justify-center border-2 border-[#FAFAF9] shadow-soft cursor-pointer transition-transform hover:scale-110"
              title="Create new story"
            >
              <Plus size={12} strokeWidth={3} />
            </button>
          </div>
          <span className="text-xs font-medium text-[#2D3732] truncate max-w-[70px]">
            {myStory ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Stories from others */}
        {stories
          .filter((s) => s.userId !== currentUser.id)
          .map((story) => {
            const actualIndex = stories.findIndex((item) => item.id === story.id);
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => onSelectStory(actualIndex)}
                className="flex flex-col items-center gap-1.5 shrink-0 group focus-visible:outline-none cursor-pointer"
              >
                <div
                  className={`w-16 h-16 rounded-full p-[2.5px] transition-all transform group-hover:scale-105 ${
                    story.hasUnseen
                      ? 'bg-gradient-to-tr from-[#8FA89B] via-[#A7C2B4] to-[#E6EDE9]'
                      : 'bg-[#E6EDE9]'
                  }`}
                >
                  <div className="w-full h-full rounded-full p-[2px] bg-[#FAFAF9] flex items-center justify-center">
                    <ModernAvatar
                      src={story.userAvatar}
                      alt={story.userName}
                      size="lg"
                      className="w-full h-full"
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-[#2D3732] truncate max-w-[72px]">
                  {story.userName.split(' ')[0]}
                </span>
              </button>
            );
          })}

        {/* Sponsored Story Ads */}
        {storyAds.map((ad) => (
          <button
            key={ad.id}
            type="button"
            onClick={() => handleOpenAd(ad)}
            className="flex flex-col items-center gap-1.5 shrink-0 group focus-visible:outline-none cursor-pointer"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#059669] via-[#34D399] to-[#F59E0B] shadow-md transition-all transform group-hover:scale-105">
                <div className="w-full h-full rounded-full p-[2px] bg-[#FAFAF9] flex items-center justify-center">
                  <ModernAvatar
                    src={ad.sellerAvatar}
                    alt={ad.sellerName}
                    size="lg"
                    className="w-full h-full"
                  />
                </div>
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-[#064E3B] text-[9px] font-bold text-emerald-200 border border-emerald-400/50 shadow-xs uppercase">
                Ad
              </span>
            </div>
            <span className="text-xs font-bold text-[#064E3B] truncate max-w-[72px]">
              {ad.sellerName.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Full-Screen Sponsored Story Modal */}
      {viewingAd && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 animate-fade-in">
          <div className="w-full max-w-sm h-[85vh] max-h-[700px] bg-neutral-900 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col border border-white/10">
            {/* Top progress & advertiser bar */}
            <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent">
              <div className="w-full h-1 bg-white/30 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-emerald-400 rounded-full w-full animate-pulse" />
              </div>

              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2.5">
                  <ModernAvatar src={viewingAd.sellerAvatar} alt={viewingAd.sellerName} size="sm" />
                  <div>
                    <p className="text-xs font-bold leading-tight flex items-center gap-1">
                      {viewingAd.sellerName}
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 text-[9px] font-mono">
                        SPONSORED
                      </span>
                    </p>
                    <p className="text-[10px] text-white/70">@{viewingAd.sellerUsername}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingAd(null)}
                  className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Media Content */}
            <div className="flex-1 w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
              {viewingAd.mediaType === 'video' ? (
                <video
                  src={viewingAd.mediaUrl}
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={viewingAd.mediaUrl}
                  alt={viewingAd.title}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Bottom Gradient Overlay */}
              <div className="absolute bottom-0 inset-x-0 p-5 bg-gradient-to-t from-black via-black/70 to-transparent text-white space-y-3 z-20">
                <div className="space-y-1">
                  <h3 className="text-base font-bold leading-tight">{viewingAd.title}</h3>
                  <p className="text-xs text-white/80 line-clamp-2 leading-relaxed">
                    {viewingAd.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    recordAdClick(viewingAd.id).catch(() => {});
                    auraAudio.playClick(650, 0.04);
                    setViewingAd(null);
                    window.location.hash = '#/marketplace';
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-[#10B981] hover:brightness-110 text-[#022C22] text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <ShoppingBag size={14} />
                  <span>{viewingAd.ctaText || 'Shop Collection'}</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
