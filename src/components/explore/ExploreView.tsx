import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Hash,
  TrendingUp,
  Play,
  Heart,
  MessageCircle,
  Flame,
  Users,
  CheckCircle2,
  Clock,
  X,
  Compass,
  Sparkles,
  SlidersHorizontal,
  Bookmark,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import { Post, Reel, User } from '../../types';
import { calculateTrendingTopics } from '../../services/trendingService';
import { FollowButton } from '../common/FollowButton';
import { ModernAvatar } from '../common/ModernAvatar';

interface ExploreViewProps {
  posts: Post[];
  reels: Reel[];
  suggestedUsers?: User[];
  onToggleFollowUser?: (userId: string) => void;
  onSelectPost: (post: Post) => void;
  onSelectReel: (reel: Reel) => void;
  onOpenUserProfile: (user: User) => void;
}

type SearchTab = 'all' | 'people' | 'posts' | 'reels' | 'tags';
type SortOption = 'trending' | 'latest';

const SEARCH_HISTORY_KEY = 'aura_search_history';

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
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not load search history:', e);
    }
  }, []);

  const saveSearchTerm = (term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    const next = [clean, ...searchHistory.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setSearchHistory(next);
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Could not save search history:', e);
    }
  };

  const handleClearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
      console.warn('Could not clear search history:', e);
    }
  };

  const dynamicTrending = useMemo(() => calculateTrendingTopics(posts), [posts]);

  // Unified effective query (from text search or selected hashtag)
  const effectiveQuery = (selectedTag || searchQuery).trim().toLowerCase();

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    let result = posts.filter((post) => {
      if (!effectiveQuery) return true;
      const cleanTag = effectiveQuery.replace(/^#/, '');
      return (
        post.content.toLowerCase().includes(effectiveQuery) ||
        post.author.name.toLowerCase().includes(effectiveQuery) ||
        post.author.username.toLowerCase().includes(effectiveQuery) ||
        (post.location && post.location.toLowerCase().includes(effectiveQuery)) ||
        post.tags.some(
          (t) =>
            t.toLowerCase().includes(effectiveQuery) ||
            t.toLowerCase().includes(cleanTag)
        )
      );
    });

    if (sortBy === 'trending') {
      result = [...result].sort((a, b) => b.likesCount + (b.comments?.length || 0) * 2 - (a.likesCount + (a.comments?.length || 0) * 2));
    } else {
      result = [...result].sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
    }

    return result;
  }, [posts, effectiveQuery, sortBy]);

  // Filtered Creators
  const filteredUsers = useMemo(() => {
    // Unique list of authors from suggestedUsers + authors from posts
    const usersMap = new Map<string, User>();
    suggestedUsers.forEach((u) => usersMap.set(u.id, u));
    posts.forEach((p) => {
      if (p.author && !usersMap.has(p.author.id)) {
        usersMap.set(p.author.id, p.author);
      }
    });
    const allUsers = Array.from(usersMap.values());

    if (!effectiveQuery) return allUsers;

    const clean = effectiveQuery.replace(/^@/, '');
    return allUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(clean) ||
        u.username.toLowerCase().includes(clean) ||
        (u.bio && u.bio.toLowerCase().includes(clean)) ||
        (u.location && u.location.toLowerCase().includes(clean))
    );
  }, [suggestedUsers, posts, effectiveQuery]);

  // Filtered Reels
  const filteredReels = useMemo(() => {
    return reels.filter((reel) => {
      if (!effectiveQuery) return true;
      return (
        reel.caption.toLowerCase().includes(effectiveQuery) ||
        reel.author.name.toLowerCase().includes(effectiveQuery) ||
        reel.author.username.toLowerCase().includes(effectiveQuery) ||
        (reel.audioTrack && reel.audioTrack.toLowerCase().includes(effectiveQuery))
      );
    });
  }, [reels, effectiveQuery]);

  // Filtered Hashtags
  const matchingTags = useMemo(() => {
    if (!effectiveQuery) return dynamicTrending;
    const clean = effectiveQuery.replace(/^#/, '');
    return dynamicTrending.filter((t) => t.tag.toLowerCase().includes(clean));
  }, [dynamicTrending, effectiveQuery]);

  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      saveSearchTerm(searchQuery);
    }
  };

  const handleSelectHistoryTerm = (term: string) => {
    setSearchQuery(term);
    setSelectedTag(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-7 animate-fade-in">
      {/* Search Header & Query Bar */}
      <div className="max-w-3xl mx-auto space-y-3.5">
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
            onKeyDown={handleKeyDownSearch}
            placeholder="Search creators, hashtags, projects, and stories..."
            className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-[#FAFAF9] rounded-2xl pl-11 pr-20 py-3.5 text-xs sm:text-sm text-[#2D3732] placeholder-[#7A8A82] shadow-xs focus:outline-none transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTag(null);
                }}
                className="p-1 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-black/5 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Recent Search History Chips */}
        {searchHistory.length > 0 && !searchQuery && !selectedTag && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="flex items-center gap-1 text-[11px] text-[#7A8A82] shrink-0 font-medium">
              <Clock size={12} />
              <span>Recent:</span>
            </span>
            {searchHistory.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => handleSelectHistoryTerm(item)}
                className="px-2.5 py-1 rounded-lg bg-[#E6EDE9]/60 hover:bg-[#8FA89B]/20 text-[#2D3732] text-[11px] font-medium transition-colors border border-[#2D3732]/10 shrink-0 cursor-pointer flex items-center gap-1"
              >
                <span>{item}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-[10px] text-[#7A8A82] hover:text-rose-600 hover:underline shrink-0 ml-1 cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* Dynamic Trending Topic Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setSelectedTag(null);
              setSearchQuery('');
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              !selectedTag && !searchQuery
                ? 'bg-[#2D3732] text-white shadow-xs'
                : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9]'
            }`}
          >
            All Discoveries
          </button>
          {dynamicTrending.map((ch) => (
            <button
              key={ch.tag}
              type="button"
              onClick={() => {
                setSelectedTag(ch.tag);
                setSearchQuery('');
                saveSearchTerm(`#${ch.tag}`);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                selectedTag === ch.tag
                  ? 'bg-[#8FA89B] text-white shadow-xs'
                  : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9]'
              }`}
            >
              {ch.isHot && (
                <Flame
                  size={12}
                  className={selectedTag === ch.tag ? 'text-amber-200' : 'text-amber-500'}
                />
              )}
              <span>#{ch.tag}</span>
              <span className="text-[10px] opacity-75 font-mono">({ch.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category Navigation Bar & Sort Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#2D3732]/10 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#2D3732] text-white shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2]'
            }`}
          >
            <span>Top Results</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('people')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'people'
                ? 'bg-[#2D3732] text-white shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2]'
            }`}
          >
            <Users size={14} />
            <span>Creators ({filteredUsers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'posts'
                ? 'bg-[#2D3732] text-white shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2]'
            }`}
          >
            <Compass size={14} />
            <span>Posts ({filteredPosts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reels')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'reels'
                ? 'bg-[#2D3732] text-white shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2]'
            }`}
          >
            <Play size={14} />
            <span>Reels ({filteredReels.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tags')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'tags'
                ? 'bg-[#2D3732] text-white shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2]'
            }`}
          >
            <Hash size={14} />
            <span>Topics ({matchingTags.length})</span>
          </button>
        </div>

        {/* Sort option */}
        <div className="flex items-center gap-2 text-xs self-end sm:self-center">
          <span className="text-[11px] text-[#7A8A82] flex items-center gap-1">
            <SlidersHorizontal size={12} />
            <span>Sort:</span>
          </span>
          <button
            type="button"
            onClick={() => setSortBy('trending')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              sortBy === 'trending'
                ? 'bg-[#8FA89B] text-white'
                : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            Popular
          </button>
          <button
            type="button"
            onClick={() => setSortBy('latest')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
              sortBy === 'latest'
                ? 'bg-[#8FA89B] text-white'
                : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            Latest
          </button>
        </div>
      </div>

      {/* 1. People / Creators View */}
      {(activeTab === 'people' || (activeTab === 'all' && filteredUsers.length > 0)) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2D3732] flex items-center gap-2">
              <Users size={16} className="text-[#8FA89B]" />
              <span>{activeTab === 'all' ? 'Featured Creators' : 'Community Creators'}</span>
            </h2>
            {activeTab === 'all' && (
              <button
                type="button"
                onClick={() => setActiveTab('people')}
                className="text-xs text-[#8FA89B] hover:text-[#7d988b] font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View all ({filteredUsers.length})</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(activeTab === 'all' ? filteredUsers.slice(0, 4) : filteredUsers).map((user) => (
              <div
                key={user.id}
                className="bg-[#F1F5F2] rounded-3xl p-4 sm:p-5 border border-[#E6EDE9] shadow-soft flex flex-col justify-between hover:border-[#8FA89B]/40 transition-all group"
              >
                <div>
                  <div
                    className="flex items-start gap-3 cursor-pointer mb-3"
                    onClick={() => onOpenUserProfile(user)}
                  >
                    <ModernAvatar
                      src={user.avatar}
                      alt={user.name}
                      size="lg"
                      ring
                      className="shrink-0 group-hover:scale-105 transition-transform"
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
                      {user.location && (
                        <span className="flex items-center gap-1 text-[10px] text-[#7A8A82] mt-0.5 truncate">
                          <MapPin size={10} />
                          <span>{user.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#55635C] line-clamp-2 leading-relaxed mb-3">
                    {user.bio || 'Exploring design, craft, and ideas on Aura.'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#2D3732]/5">
                  <span className="text-[10px] text-[#7A8A82]">
                    {user.followersCount || 0} followers
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

      {/* 2. Featured Reels View */}
      {(activeTab === 'reels' || (activeTab === 'all' && filteredReels.length > 0)) && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2D3732] flex items-center gap-2">
              <Play size={15} className="text-[#8FA89B] fill-[#8FA89B]" />
              <span>{activeTab === 'all' ? 'Trending Reels' : 'Matching Video Reels'}</span>
            </h2>
            {activeTab === 'all' && (
              <button
                type="button"
                onClick={() => setActiveTab('reels')}
                className="text-xs text-[#8FA89B] hover:text-[#7d988b] font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View all ({filteredReels.length})</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {(activeTab === 'all' ? filteredReels.slice(0, 5) : filteredReels).map((reel) => (
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
            ))}
          </div>
        </div>
      )}

      {/* 3. Topics & Hashtags View */}
      {activeTab === 'tags' && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#2D3732] flex items-center gap-2">
            <Hash size={16} className="text-[#8FA89B]" />
            <span>Community Topics &amp; Hashtags</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchingTags.map((t) => (
              <div
                key={t.tag}
                onClick={() => {
                  setSelectedTag(t.tag);
                  setSearchQuery('');
                  setActiveTab('posts');
                  saveSearchTerm(`#${t.tag}`);
                }}
                className="bg-[#F1F5F2] rounded-2xl p-4 border border-[#E6EDE9] hover:border-[#8FA89B] shadow-xs cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#8FA89B]/15 text-[#3A5245] flex items-center justify-center font-bold text-sm group-hover:bg-[#8FA89B] group-hover:text-white transition-colors">
                    #
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732] group-hover:text-[#3A5245] flex items-center gap-1.5">
                      <span>#{t.tag}</span>
                      {t.isHot && <Flame size={12} className="text-amber-500" />}
                    </div>
                    <div className="text-[11px] text-[#7A8A82]">
                      {t.count} {t.count === 1 ? 'post' : 'posts'} in discussion
                    </div>
                  </div>
                </div>
                <ArrowUpRight size={16} className="text-[#7A8A82] group-hover:text-[#2D3732] transition-colors" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Posts Grid */}
      {(activeTab === 'posts' || activeTab === 'all') && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#2D3732] flex items-center gap-2">
              <TrendingUp size={15} className="text-[#8FA89B]" />
              <span>
                {effectiveQuery
                  ? `Posts matching "${effectiveQuery}" (${filteredPosts.length})`
                  : 'Curated Moments'}
              </span>
            </h2>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-[#F1F5F2]/60 rounded-3xl border border-dashed border-[#2D3732]/10 p-8">
              <Compass size={32} className="mx-auto text-[#7A8A82] opacity-60" />
              <div className="text-sm font-medium text-[#2D3732]">No posts match your search</div>
              <p className="text-xs text-[#7A8A82] max-w-sm mx-auto">
                Try searching for creators, topics like #nordic, #minimalism, #ceramics, or explore trending tags above.
              </p>
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
                          alt="Post media"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {post.mediaUrls && post.mediaUrls.length > 1 && (
                          <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-mono font-medium">
                            1/{post.mediaUrls.length}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="p-5 flex flex-col justify-between flex-1 space-y-3">
                      <div>
                        {/* Author info */}
                        <div
                          className="flex items-center gap-2.5 mb-2 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenUserProfile(post.author);
                          }}
                        >
                          <ModernAvatar
                            src={post.author.avatar}
                            alt={post.author.name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-[#2D3732] truncate hover:underline flex items-center gap-1">
                              <span>{post.author.name}</span>
                              {post.author.verified && (
                                <CheckCircle2 size={11} className="text-[#8FA89B]" />
                              )}
                            </div>
                            <div className="text-[10px] text-[#7A8A82] font-mono truncate">
                              @{post.author.username}
                            </div>
                          </div>
                        </div>

                        {/* Caption */}
                        <p className="text-xs text-[#2D3732] line-clamp-3 leading-relaxed">
                          {post.content}
                        </p>
                      </div>

                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTag(tag);
                                setSearchQuery('');
                                saveSearchTerm(`#${tag}`);
                              }}
                              className="text-[10px] text-[#8FA89B] hover:text-[#7e988b] font-medium hover:underline cursor-pointer"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Post engagement footer */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#2D3732]/5 text-[11px] text-[#7A8A82]">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 hover:text-[#2D3732]">
                            <Heart
                              size={13}
                              className={post.hasLiked ? 'fill-rose-500 text-rose-500' : ''}
                            />
                            <span>{post.likesCount}</span>
                          </span>
                          <span className="flex items-center gap-1 hover:text-[#2D3732]">
                            <MessageCircle size={13} />
                            <span>{post.comments?.length || 0}</span>
                          </span>
                        </div>

                        <span className="text-[10px] font-mono text-[#7A8A82]">
                          {post.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
