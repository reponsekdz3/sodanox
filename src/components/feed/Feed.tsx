import React, { useState, useMemo } from 'react';
import { Post, User, Story } from '../../types';
import { StoryBar } from '../story/StoryBar';
import { PostCard } from './PostCard';
import { RightAside } from '../layout/RightAside';
import { Sparkles, Hash, X } from 'lucide-react';
import { calculateTrendingTopics } from '../../services/trendingService';

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
  onDeleteComment?: (postId: string, commentId: string, replyId?: string) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  onDeletePost?: (postId: string) => void;
  onEditPost?: (postId: string, newContent: string) => void;
  onToggleFollowUser: (userId: string) => void;
  onOpenUserProfile: (user: User) => void;
  onOpenCreatePost: () => void;
  onOpenCreatePostWithPrompt?: (prompt: string) => void;
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
  onDeleteComment,
  onVotePoll,
  onDeletePost,
  onEditPost,
  onToggleFollowUser,
  onOpenUserProfile,
  onOpenCreatePost,
  onOpenCreatePostWithPrompt,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'following' | 'ceramics' | 'architecture'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const trendingTopics = useMemo(() => calculateTrendingTopics(posts), [posts]);

  const filteredPosts = posts.filter((post) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAuthor =
        post.author.name.toLowerCase().includes(q) ||
        post.author.username.toLowerCase().includes(q);
      const matchContent = post.content.toLowerCase().includes(q);
      const matchTag = post.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchAuthor && !matchContent && !matchTag) return false;
    }
    if (selectedTag) {
      const matchTag = post.tags?.some((t) => t.toLowerCase().includes(selectedTag.toLowerCase()));
      const matchContent = post.content.toLowerCase().includes(`#${selectedTag.toLowerCase()}`);
      return matchTag || matchContent;
    }
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
            {selectedTag && (
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#8FA89B] text-white text-xs font-semibold shadow-soft shrink-0">
                <Hash size={13} />
                <span>{selectedTag}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="p-0.5 hover:bg-white/20 rounded-full ml-1"
                >
                  <X size={12} />
                </button>
              </div>
            )}
            {[
              { id: 'all', label: 'All Feed' },
              { id: 'following', label: 'Following' },
              { id: 'ceramics', label: 'Ceramics & Craft' },
              { id: 'architecture', label: 'Architecture' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedTag(null);
                  setActiveFilter(tab.id as typeof activeFilter);
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-medium whitespace-nowrap transition-all ${
                  !selectedTag && activeFilter === tab.id
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
                onDeleteComment={onDeleteComment}
                onVotePoll={onVotePoll}
                onDeletePost={onDeletePost}
                onEditPost={onEditPost}
                onOpenUserProfile={onOpenUserProfile}
              />
            ))
          )}
        </div>

        {/* Right Aside Column (Desktop): Fixed & Richly Interactive */}
        <div className="hidden lg:block lg:col-span-4 sticky top-4 h-[calc(100vh-2rem)] overflow-y-auto scrollbar-none pr-1">
          <RightAside
            currentUser={currentUser}
            suggestedUsers={suggestedUsers}
            trendingTopics={trendingTopics}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            onOpenUserProfile={onOpenUserProfile}
            onToggleFollowUser={onToggleFollowUser}
            onOpenCreatePostWithPrompt={onOpenCreatePostWithPrompt}
            onSendDirectMessage={
              onSendToChat
                ? (u) => onSendToChat(u.id, `Hello ${u.name}! Connected with you on Aura.`)
                : undefined
            }
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
        </div>
      </div>
    </div>
  );
};
