import React, { useState, useMemo } from 'react';
import { Search, Hash, TrendingUp, Play, Heart, MessageCircle, Flame, Users, CheckCircle2, UserPlus, UserCheck } from 'lucide-react';
import { Post, Reel, User } from '../../types';
import { calculateTrendingTopics } from '../../services/trendingService';
import { FollowButton } from '../common/FollowButton';

interface ExploreViewProps {
  posts: Post[];
  reels: Reel[];
  suggestedUsers?: User[];
  onToggleFollowUser?: (userId: string) => void;
  onSelectPost: (post: Post) => void;
  onSelectReel: (reel: Reel) => void;
  onOpenUserProfile: (user: User) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  posts,
  reels,
  suggestedUsers = [],
  onToggleFollowUser,
  onSelectPost,
  onSelectReel,
  onOpenUserProfile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const dynamicTrending = useMemo(() => calculateTrendingTopics(posts), [posts]);

  const filteredPosts = posts.filter((post) => {
    const query = (selectedTag || searchQuery).toLowerCase();
    if (!query) return true;
    return (
      post.content.toLowerCase().includes(query) ||
      post.author.name.toLowerCase().includes(query) ||
      post.author.username.toLowerCase().includes(query) ||
      post.tags.some((t) => t.toLowerCase().includes(query))
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Search Header */}
      <div className="max-w-2xl mx-auto space-y-3">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7A8A82]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedTag(null);
            }}
            placeholder="Search creators, hashtags, projects on Aura..."
            className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-[#FAFAF9] rounded-2xl pl-11 pr-4 py-3 text-sm text-[#2D3732] placeholder-[#7A8A82] shadow-soft focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#7A8A82] hover:text-[#2D3732] cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dynamic Trending Quick Tag Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              !selectedTag && !searchQuery
                ? 'bg-[#2D3732] text-white'
                : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            All Discoveries
          </button>
          {dynamicTrending.map((ch) => (
            <button
              key={ch.tag}
              onClick={() => setSelectedTag(ch.tag)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
                selectedTag === ch.tag
                  ? 'bg-[#8FA89B] text-white shadow-soft'
                  : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9]'
              }`}
            >
              {ch.isHot && <Flame size={12} className={selectedTag === ch.tag ? 'text-amber-200' : 'text-amber-500'} />}
              <span>#{ch.tag}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Suggested Creators to Follow Section */}
      {suggestedUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2D3732] flex items-center gap-2">
              <Users size={16} className="text-[#8FA89B]" />
              <span>Suggested Creators to Follow</span>
            </h2>
            <span className="text-[11px] text-[#7A8A82]">
              Active members on Aura
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {suggestedUsers.slice(0, 4).map((user) => (
              <div
                key={user.id}
                className="bg-[#F1F5F2] rounded-3xl p-4 border border-[#E6EDE9] shadow-soft flex flex-col justify-between hover:border-[#8FA89B]/40 transition-all"
              >
                <div
                  className="flex items-start gap-3 cursor-pointer mb-3"
                  onClick={() => onOpenUserProfile(user)}
                >
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#8FA89B]/30 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-[#2D3732] truncate hover:underline">
                        {user.name}
                      </span>
                      {user.verified && (
                        <CheckCircle2 size={12} className="text-[#8FA89B] shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-[#7A8A82] block truncate font-mono">
                      @{user.username}
                    </span>
                    {user.isFollower && !user.isFollowing && (
                      <span className="inline-block mt-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-[#E6EDE9] text-[#55635C] font-semibold">
                        Follows you
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-[#55635C] line-clamp-2 leading-relaxed mb-3">
                  {user.bio || 'Exploring ideas and craft on Aura.'}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[#E6EDE9]/60">
                  <span className="text-[10px] text-[#7A8A82]">
                    {user.followersCount} followers
                  </span>

                  {onToggleFollowUser && (
                    <FollowButton
                      isFollowing={!!user.isFollowing}
                      isFollower={!!user.isFollower}
                      userId={user.id}
                      onToggleFollow={onToggleFollowUser}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Featured Reels Strip */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#2D3732] flex items-center gap-2">
            <Play size={15} className="text-[#8FA89B] fill-[#8FA89B]" />
            <span>Trending Reels</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {reels.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-[#7A8A82]">
              No reels created yet. Tap + to upload the first reel.
            </div>
          ) : (
            reels.map((reel) => (
              <div
                key={reel.id}
                onClick={() => onSelectReel(reel)}
                className="group relative aspect-[9/16] rounded-2xl overflow-hidden bg-neutral-900 cursor-pointer shadow-soft hover:shadow-soft-lg transition-all"
              >
                <img
                  src={reel.posterUrl}
                  alt={reel.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                <div className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/40 backdrop-blur-md text-white">
                  <Play size={12} className="fill-white" />
                </div>

                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-xs font-medium line-clamp-1 mb-1">
                    {reel.caption}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-white/80">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenUserProfile(reel.author);
                      }}
                      className="truncate hover:underline cursor-pointer"
                    >
                      @{reel.author.username}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart size={10} className="fill-white" />
                      {reel.likesCount}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Discover Posts Masonry / Grid */}
      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-semibold text-[#2D3732] flex items-center gap-2">
          <TrendingUp size={15} className="text-[#8FA89B]" />
          <span>Curated Moments</span>
        </h2>

        {filteredPosts.length === 0 ? (
          <div className="py-16 text-center text-xs sm:text-sm text-[#7A8A82] bg-[#F1F5F2]/50 rounded-3xl border border-dashed border-[#2D3732]/10">
            No community posts match your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const displayCover =
                post.mediaUrls && post.mediaUrls.length > 0 ? post.mediaUrls[0] : post.mediaUrl;

              return (
                <div
                  key={post.id}
                  onClick={() => onSelectPost(post)}
                  className="bg-[#F1F5F2] rounded-3xl overflow-hidden border border-[#E6EDE9] shadow-soft hover:shadow-soft-lg transition-all cursor-pointer flex flex-col justify-between group"
                >
                  {displayCover && (
                    <div className="relative aspect-[4/3] bg-neutral-100 overflow-hidden">
                      <img
                        src={displayCover}
                        alt="Post"
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                      />
                    </div>
                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div
                        className="flex items-center gap-2 mb-2 w-fit cursor-pointer hover:opacity-80"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenUserProfile(post.author);
                        }}
                      >
                        <img
                          src={post.author.avatar}
                          alt={post.author.name}
                          className="w-6 h-6 rounded-full object-cover hover:ring-2 hover:ring-[#8FA89B] transition-all"
                        />
                        <span className="text-xs font-medium text-[#2D3732] hover:underline">
                          {post.author.name}
                        </span>
                      </div>
                      <p className="text-xs text-[#2D3732] line-clamp-3 leading-relaxed mb-3">
                        {post.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#E6EDE9] text-[11px] text-[#7A8A82]">
                      <span className="tabular-nums">{post.likesCount} likes</span>
                      <span className="tabular-nums">{post.commentsCount} comments</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Mandatory Developer Footer */}
      <div className="py-6 text-center border-t border-[#E6EDE9]">
        <p className="text-xs text-[#7A8A82] font-medium tracking-wide hover:text-[#2D3732] transition-colors">
          app developed by reponsekdz · Aura Social
        </p>
      </div>
    </div>
  );
};
