import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  Search,
  CheckCircle2,
  Flame,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  MessageCircle,
  X,
  Share2,
  PenTool,
} from 'lucide-react';
import { User, Post } from '../../types';
import { FollowButton } from '../common/FollowButton';
import { auraAudio } from '../../utils/audioSynthesizer';
import { ModernAvatar } from '../common/ModernAvatar';

interface RightAsideProps {
  currentUser: User;
  suggestedUsers: User[];
  trendingTopics: Array<{
    tag: string;
    name: string;
    count: number;
    formattedCount: string;
    category: string;
    isHot: boolean;
  }>;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onOpenUserProfile: (user: User) => void;
  onToggleFollowUser: (userId: string) => void;
  onOpenCreatePostWithPrompt?: (prompt: string) => void;
  onSendDirectMessage?: (user: User) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

const MINDFUL_PROMPTS = [
  "What quiet detail or texture in your space brought you peace today?",
  "Share a ceramic piece, sketch, or craft you have been shaping recently.",
  "Which architecture or natural landscape has influenced your mindset lately?",
  "How are you embracing slow living and mindful technology this week?",
  "What music, fragrance, or atmosphere helps you enter a deep state of focus?",
];

type AmbientSoundMode = 'off' | 'rain' | 'vinyl' | 'binaural' | 'forest';

export const RightAside: React.FC<RightAsideProps> = ({
  currentUser,
  suggestedUsers,
  trendingTopics,
  selectedTag,
  onSelectTag,
  onOpenUserProfile,
  onToggleFollowUser,
  onOpenCreatePostWithPrompt,
  onSendDirectMessage,
  searchQuery,
  onSearchQueryChange,
}) => {
  const [ambientMode, setAmbientMode] = useState<AmbientSoundMode>('off');
  const [dailyPromptIndex, setDailyPromptIndex] = useState(0);

  // Pick prompt based on day
  useEffect(() => {
    const day = new Date().getDay();
    setDailyPromptIndex(day % MINDFUL_PROMPTS.length);
  }, []);

  const handleToggleAmbient = (mode: AmbientSoundMode) => {
    const nextMode = ambientMode === mode ? 'off' : mode;
    setAmbientMode(nextMode);
    auraAudio.setAmbient(nextMode);
    auraAudio.playClick();
  };

  const handlePromptShare = () => {
    const prompt = MINDFUL_PROMPTS[dailyPromptIndex];
    if (onOpenCreatePostWithPrompt) {
      onOpenCreatePostWithPrompt(`Reflection: ${prompt}\n\n`);
    }
  };

  // Filter suggested users based on search
  const displayedSuggested = suggestedUsers
    .filter((u) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.bio && u.bio.toLowerCase().includes(q))
      );
    })
    .slice(0, 5);

  return (
    <aside className="space-y-4 pb-12 select-none">
      {/* 1. Interactive Search & Discovery Bar */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4B6358]"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search creators, thoughts, craft..."
          className="w-full bg-white hover:bg-[#EDF3F0] focus:bg-white text-[#022C22] placeholder-[#4B6358] text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-2xl border border-[#D1E2D9] focus:border-[#059669] transition-all focus:outline-none shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchQueryChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4B6358] hover:text-[#022C22] p-1 cursor-pointer"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 2. Mindful Ambient Soundscape Synthesizer */}
      <div className="bg-white rounded-3xl p-4 border border-[#D1E2D9] shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Radio size={15} className="text-[#059669] animate-pulse" />
            <h3 className="text-xs font-semibold text-[#022C22] uppercase tracking-wider">
              AuraChats Soundscape
            </h3>
          </div>
          {ambientMode !== 'off' ? (
            <div className="flex items-center gap-1">
              {/* Equalizer animation */}
              <span className="w-1 h-3 bg-[#059669] rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-4 bg-[#059669] rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-2.5 bg-[#059669] rounded-full animate-bounce" />
            </div>
          ) : (
            <VolumeX size={14} className="text-[#4B6358]" />
          )}
        </div>

        <p className="text-[11px] text-[#4B6358] mb-3 leading-relaxed">
          Native acoustic frequencies designed to accompany slow reading and deep focus.
        </p>

        {/* Ambient Sound Mode Buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'rain', label: '🌧️ Nordic Rain' },
            { id: 'vinyl', label: '📻 Warm Vinyl' },
            { id: 'binaural', label: '✨ 432Hz Calm' },
            { id: 'forest', label: '🌲 Forest Wind' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleToggleAmbient(mode.id as AmbientSoundMode)}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-medium transition-all text-left flex items-center justify-between cursor-pointer ${
                ambientMode === mode.id
                  ? 'bg-[#064E3B] text-white shadow-xs font-semibold'
                  : 'bg-[#EDF3F0] hover:bg-[#D1E2D9] text-[#022C22] border border-[#D1E2D9]'
              }`}
            >
              <span>{mode.label}</span>
              {ambientMode === mode.id && <Volume2 size={13} className="text-white shrink-0" />}
            </button>
          ))}
        </div>

        {ambientMode !== 'off' && (
          <button
            type="button"
            onClick={() => handleToggleAmbient('off')}
            className="w-full mt-2.5 py-1.5 text-center text-[10px] text-[#4B6358] hover:text-[#022C22] transition-colors font-medium cursor-pointer"
          >
            Turn off soundscape
          </button>
        )}
      </div>

      {/* 3. Daily Slow Reflection Interactive Card */}
      <div className="bg-gradient-to-br from-[#064E3B]/10 via-white to-[#EDF3F0] rounded-3xl p-4 sm:p-5 border border-[#D1E2D9] shadow-soft relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-[#059669]" />
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#064E3B] font-bold">
            Daily Slow Reflection
          </span>
        </div>
        <p className="font-serif italic text-xs sm:text-sm text-[#022C22] leading-relaxed mb-3">
          "{MINDFUL_PROMPTS[dailyPromptIndex]}"
        </p>
        <button
          type="button"
          onClick={handlePromptShare}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs font-semibold transition-all shadow-xs active:scale-95 cursor-pointer"
        >
          <PenTool size={12} />
          <span>Reflect & Post</span>
        </button>
      </div>

      {/* 4. Active Creators Live Ticker */}
      {/* 4. Active Creators Live Ticker */}
      <div className="bg-white rounded-3xl p-4 border border-[#D1E2D9] shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-xs font-semibold text-[#022C22] uppercase tracking-wider">
              Community Status
            </h3>
          </div>
          <span className="text-[10px] text-[#4B6358] font-mono">Live</span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          <div
            onClick={() => onOpenUserProfile(currentUser)}
            className="relative shrink-0 cursor-pointer group"
            title={`${currentUser.name} (@${currentUser.username}) - You`}
          >
            <ModernAvatar
              src={currentUser.avatar}
              alt={currentUser.name}
              size="md"
              status="online"
              ring
            />
          </div>
          {suggestedUsers.slice(0, 5).map((u) => (
            <div
              key={u.id}
              onClick={() => onOpenUserProfile(u)}
              className="relative shrink-0 cursor-pointer group"
              title={`${u.name} (@${u.username})`}
            >
              <ModernAvatar
                src={u.avatar}
                alt={u.name}
                size="md"
                status="online"
                className="transition-transform group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 5. Suggested Creators with Rich Interactivity */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#D1E2D9] shadow-soft">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-xs font-semibold text-[#022C22] uppercase tracking-wider flex items-center gap-1.5">
            <Users size={14} className="text-[#059669]" />
            <span>Suggested Creators</span>
          </h3>
          <span className="text-[10px] text-[#4B6358] font-mono">
            {suggestedUsers.length} available
          </span>
        </div>

        <div className="space-y-3">
          {displayedSuggested.length === 0 ? (
            <p className="text-xs text-[#4B6358] italic py-2 text-center">
              No new creators to suggest. As new members join, they will appear here.
            </p>
          ) : (
            displayedSuggested.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-2.5">
                <div
                  className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1"
                  onClick={() => onOpenUserProfile(user)}
                >
                  <ModernAvatar
                    src={user.avatar}
                    alt={user.name}
                    size="sm"
                    className="shrink-0 group-hover:ring-1 group-hover:ring-[#059669]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-[#022C22] truncate group-hover:underline">
                        {user.name}
                      </span>
                      {user.verified && (
                        <CheckCircle2 size={12} className="text-[#059669] shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-[#4B6358] block truncate font-mono">
                      @{user.username}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {onSendDirectMessage && (
                    <button
                      type="button"
                      onClick={() => onSendDirectMessage(user)}
                      className="p-1.5 rounded-xl bg-white hover:bg-[#EDF3F0] text-[#4B6358] hover:text-[#022C22] transition-colors border border-[#D1E2D9] cursor-pointer"
                      title={`Message ${user.name}`}
                    >
                      <MessageCircle size={14} />
                    </button>
                  )}
                  <FollowButton
                    isFollowing={!!user.isFollowing}
                    isFollower={!!user.isFollower}
                    userId={user.id}
                    onToggleFollow={onToggleFollowUser}
                    size="sm"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 6. Trending Topics on AuraChats */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-[#D1E2D9] shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-[#022C22] uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={14} className="text-[#059669]" />
            <span>Trending on AuraChats</span>
          </h3>
          {selectedTag && (
            <button
              type="button"
              onClick={() => onSelectTag(null)}
              className="text-[10px] text-[#059669] hover:underline font-semibold"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="space-y-2">
          {trendingTopics.slice(0, 6).map((item) => (
            <div
              key={item.tag}
              onClick={() => onSelectTag(selectedTag === item.tag ? null : item.tag)}
              className={`flex items-center justify-between text-xs py-2 px-2.5 rounded-xl transition-all cursor-pointer group ${
                selectedTag === item.tag
                  ? 'bg-[#064E3B] text-white shadow-xs font-semibold'
                  : 'hover:bg-[#EDF3F0] text-[#022C22]'
              }`}
            >
              <div className="min-w-0 flex items-center gap-1.5">
                {item.isHot && (
                  <Flame
                    size={13}
                    className={selectedTag === item.tag ? 'text-amber-300' : 'text-amber-500'}
                  />
                )}
                <div className="truncate">
                  <span className="font-semibold">#{item.tag}</span>
                  <span
                    className={`block text-[10px] ${
                      selectedTag === item.tag ? 'text-white/80' : 'text-[#4B6358]'
                    }`}
                  >
                    {item.category}
                  </span>
                </div>
              </div>
              <span
                className={`text-[11px] tabular-nums shrink-0 font-mono ${
                  selectedTag === item.tag ? 'text-white/90' : 'text-[#4B6358]'
                }`}
              >
                {item.formattedCount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Current User Quick Summary Card */}
      <div className="bg-white rounded-3xl p-4 border border-[#D1E2D9] shadow-soft">
        <div className="flex items-center gap-3 mb-3">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-[#059669]/40 cursor-pointer"
            onClick={() => onOpenUserProfile(currentUser)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span
                onClick={() => onOpenUserProfile(currentUser)}
                className="text-xs font-semibold text-[#022C22] truncate cursor-pointer hover:underline"
              >
                {currentUser.name}
              </span>
              {currentUser.verified && (
                <CheckCircle2 size={12} className="text-[#059669] shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-[#4B6358] truncate font-mono">
              @{currentUser.username}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center py-2 px-3 bg-[#EDF3F0] rounded-2xl border border-[#D1E2D9] mb-2.5 text-xs">
          <div>
            <span className="block font-semibold text-[#022C22] tabular-nums">
              {currentUser.followersCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#4B6358]">Followers</span>
          </div>
          <div>
            <span className="block font-semibold text-[#022C22] tabular-nums">
              {currentUser.followingCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#4B6358]">Following</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenUserProfile(currentUser)}
          className="w-full py-1.5 rounded-xl bg-[#EDF3F0] hover:bg-[#064E3B] hover:text-white text-[#022C22] transition-colors text-xs font-semibold text-center cursor-pointer"
        >
          View Your Profile
        </button>
      </div>

      {/* 8. Mandatory Developer Attribution */}
      <div className="py-2 text-center">
        <p className="text-[11px] text-[#4B6358] font-medium tracking-wide hover:text-[#022C22] transition-colors">
          app developed by reponsekdz · AuraChats
        </p>
      </div>
    </aside>
  );
};
