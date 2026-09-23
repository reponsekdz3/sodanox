import React, { useState } from 'react';
import { Post, User, Story } from '../../types';
import { StoryBar } from '../story/StoryBar';
import { PostCard } from './PostCard';
import { Sparkles, TrendingUp, Users, CheckCircle2 } from 'lucide-react';

interface FeedProps {
  posts: Post[];
  stories: Story[];
  currentUser: User;
  suggestedUsers: User[];
  onSelectStory: (index: number) => void;
  onOpenCreateStory: () => void;
  onLikePost: (postId: string) => void;
  onBookmarkPost: (postId: string) => void;
  onRepostPost: (postId: string, quoteComment?: string) => void;
  onIncrementShare?: (postId: string) => void;
  onSendToChat?: (recipientId: string, messageText: string) => void;
  onAddComment: (postId: string, text: string, replyToCommentId?: string) => void;
  onLikeComment: (postId: string, commentId: string) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  onDeletePost?: (postId: string) => void;
  onEditPost?: (postId: string, newContent: string) => void;
  onToggleFollowUser: (userId: string) => void;
  onOpenUserProfile: (user: User) => void;
  onOpenCreatePost: () => void;
}

export const Feed: React.FC<FeedProps> = ({
  posts,
  stories,
  currentUser,
  suggestedUsers,
  onSelectStory,
  onOpenCreateStory,
  onLikePost,
  onBookmarkPost,
  onRepostPost,
  onIncrementShare,
  onSendToChat,
  onAddComment,
  onLikeComment,
  onVotePoll,
  onDeletePost,
  onEditPost,
  onToggleFollowUser,
  onOpenUserProfile,
  onOpenCreatePost,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'following' | 'ceramics' | 'architecture'>('all');

  const filteredPosts = posts.filter((post) => {
    if (activeFilter === 'following') {
      return post.author.isFollowing || post.author.id === currentUser.id;
    }
    if (activeFilter === 'ceramics') {
      return post.tags.some((t) => t.toLowerCase().includes('ceramic') || t.toLowerCase().includes('craft'));
    }
    if (activeFilter === 'architecture') {
      return post.tags.some((t) => t.toLowerCase().includes('arch') || t.toLowerCase().includes('nordic'));
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4">
      {/* Stories Bar at Top */}
      <div className="mb-6 rounded-3xl overflow-hidden bg-[#FAFAF9] border border-[#F1F5F2] shadow-soft">
        <StoryBar
          stories={stories}
          currentUser={currentUser}
          onSelectStory={onSelectStory}
          onOpenCreateStory={onOpenCreateStory}
        />
      </div>

      {/* Main Grid: Feed column + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Main Feed Column */}
        <div className="lg:col-span-8">
          {/* Create Post Prompt Card */}
          <div className="bg-[#F1F5F2] rounded-3xl p-4 sm:p-5 mb-6 shadow-soft flex items-center gap-3 border border-[#E6EDE9]">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-10 h-10 rounded-full object-cover shrink-0 cursor-pointer"
              onClick={() => onOpenUserProfile(currentUser)}
            />
            <button
              onClick={onOpenCreatePost}
              className="flex-1 text-left bg-[#FAFAF9] hover:bg-[#FAFAF9]/90 border border-[#E6EDE9] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#7A8A82] hover:text-[#2D3732] transition-colors shadow-soft"
            >
              Share what you are creating or thinking today...
            </button>
            <button
              onClick={onOpenCreatePost}
              className="hidden sm:inline-flex items-center px-4 py-2.5 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs font-medium transition-all shadow-soft active:scale-[0.98]"
            >
              Post
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'All Feed' },
              { id: 'following', label: 'Following' },
              { id: 'ceramics', label: 'Ceramics & Craft' },
              { id: 'architecture', label: 'Architecture' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
                className={`px-4 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all ${
                  activeFilter === tab.id
                    ? 'bg-[#2D3732] text-white shadow-soft'
                    : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Posts list */}
          {filteredPosts.length === 0 ? (
            <div className="bg-[#F1F5F2] rounded-3xl p-12 text-center border border-[#E6EDE9]">
              <p className="text-sm font-medium text-[#2D3732] mb-1">
                No posts found in this stream
              </p>
              <p className="text-xs text-[#7A8A82] mb-4">
                Be the first to share an update or switch filters.
              </p>
              <button
                onClick={() => setActiveFilter('all')}
                className="px-4 py-2 rounded-2xl bg-[#8FA89B] text-white text-xs font-medium"
              >
                View All Posts
              </button>
            </div>
          ) : (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                suggestedUsers={suggestedUsers}
                onLikePost={onLikePost}
                onBookmarkPost={onBookmarkPost}
                onRepostPost={onRepostPost}
                onIncrementShare={onIncrementShare}
                onSendToChat={onSendToChat}
                onAddComment={onAddComment}
                onLikeComment={onLikeComment}
                onVotePoll={onVotePoll}
                onDeletePost={onDeletePost}
                onEditPost={onEditPost}
                onOpenUserProfile={onOpenUserProfile}
              />
            ))
          )}
        </div>

        {/* Sidebar Column (Desktop) */}
        <aside className="hidden lg:block lg:col-span-4 space-y-6 sticky top-20">
          {/* Current User Summary Card */}
          <div className="bg-[#F1F5F2] rounded-3xl p-5 border border-[#E6EDE9] shadow-soft">
            <div className="flex items-center gap-3.5 mb-4">
              <div
                className="relative cursor-pointer"
                onClick={() => onOpenUserProfile(currentUser)}
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-[#8FA89B]/40"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-sm font-semibold text-[#2D3732] truncate cursor-pointer hover:underline"
                    onClick={() => onOpenUserProfile(currentUser)}
                  >
                    {currentUser.name}
                  </span>
                  {currentUser.verified && (
                    <CheckCircle2 size={13} className="text-[#8FA89B] fill-[#E6EDE9] shrink-0" />
                  )}
                </div>
                <p className="text-xs text-[#7A8A82] truncate">
                  @{currentUser.username}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center py-2.5 px-3 bg-[#FAFAF9] rounded-2xl border border-[#E6EDE9]/60 mb-3">
              <div>
                <span className="block text-sm font-semibold text-[#2D3732] tabular-nums">
                  {currentUser.followersCount.toLocaleString()}
                </span>
                <span className="text-[11px] text-[#7A8A82]">Followers</span>
              </div>
              <div>
                <span className="block text-sm font-semibold text-[#2D3732] tabular-nums">
                  {currentUser.followingCount.toLocaleString()}
                </span>
                <span className="text-[11px] text-[#7A8A82]">Following</span>
              </div>
            </div>

            <button
              onClick={() => onOpenUserProfile(currentUser)}
              className="w-full py-2 rounded-2xl bg-[#E6EDE9] text-[#2D3732] hover:bg-[#8FA89B] hover:text-white transition-colors text-xs font-medium text-center"
            >
              View Full Profile
            </button>
          </div>

          {/* Suggested Creators */}
          <div className="bg-[#F1F5F2] rounded-3xl p-5 border border-[#E6EDE9] shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#2D3732] flex items-center gap-1.5">
                <Users size={15} className="text-[#8FA89B]" />
                <span>Suggested Creators</span>
              </h3>
            </div>

            <div className="space-y-3.5">
              {suggestedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                    onClick={() => onOpenUserProfile(user)}
                  >
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-[#2D3732] truncate group-hover:underline">
                          {user.name}
                        </span>
                        {user.verified && (
                          <CheckCircle2 size={12} className="text-[#8FA89B] shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-[#7A8A82] block truncate">
                        @{user.username}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleFollowUser(user.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                      user.isFollowing
                        ? 'bg-[#E6EDE9] text-[#2D3732] hover:bg-neutral-200'
                        : 'bg-[#8FA89B] text-white hover:bg-[#7e9689]'
                    }`}
                  >
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Topics & Hashtags */}
          <div className="bg-[#F1F5F2] rounded-3xl p-5 border border-[#E6EDE9] shadow-soft">
            <h3 className="text-sm font-semibold text-[#2D3732] flex items-center gap-1.5 mb-3">
              <TrendingUp size={15} className="text-[#8FA89B]" />
              <span>Trending Discussions</span>
            </h3>

            <div className="space-y-2.5">
              {[
                { tag: 'nordicminimalism', posts: '1.4k posts' },
                { tag: 'tactilecraft', posts: '980 posts' },
                { tag: 'ambientaudio', posts: '620 posts' },
                { tag: 'stoneware', posts: '540 posts' },
              ].map((item) => (
                <div
                  key={item.tag}
                  className="flex items-center justify-between text-xs py-1 hover:text-[#2D3732] cursor-pointer group"
                >
                  <span className="font-medium text-[#2D3732] group-hover:text-[#8FA89B] transition-colors">
                    #{item.tag}
                  </span>
                  <span className="text-[#7A8A82] tabular-nums">
                    {item.posts}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
