import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Link as LinkIcon,
  Calendar,
  Grid,
  Play,
  Bookmark,
  CheckCircle2,
  Phone,
  Video,
  MessageCircle,
  Edit3,
  Plus,
  Lock,
  Users,
  X,
  Sparkles,
  UserPlus,
  Share2,
  Check,
  UserCheck,
  Search,
  Trash2,
} from 'lucide-react';
import { User, Post, Reel, StoryHighlight } from '../../types';
import { PostCard } from '../feed/PostCard';
import { FollowButton } from '../common/FollowButton';
import { ModernAvatar } from '../common/ModernAvatar';
import {
  subscribeToUserHighlights,
  deleteStoryHighlight,
} from '../../services/storyService';
import { getFollowersList, getFollowingList, toggleFollowUser } from '../../services/userService';
import { CreateHighlightModal } from './CreateHighlightModal';

interface ProfileViewProps {
  user: User;
  currentUser: User;
  userPosts: Post[];
  userReels: Reel[];
  savedPosts: Post[];
  suggestedUsers?: User[];
  onToggleFollow: (userId: string) => void;
  onOpenEditProfile: () => void;
  onOpenCreatePost?: () => void;
  onStartCall: (participant: User, type: 'audio' | 'video') => void;
  onOpenDirectChat: (participant: User) => void;
  onLikePost: (postId: string) => void;
  onBookmarkPost: (postId: string) => void;
  onRepostPost: (postId: string, quoteComment?: string) => void;
  onIncrementShare?: (postId: string) => void;
  onSendToChat?: (recipientId: string, messageText: string) => void;
  onDeletePost?: (postId: string) => void;
  onEditPost?: (postId: string, newContent: string) => void;
  onAddComment: (postId: string, text: string, replyToCommentId?: string) => void;
  onLikeComment: (postId: string, commentId: string) => void;
  onDeleteComment?: (postId: string, commentId: string, replyId?: string) => void;
  onSelectReel: (reel: Reel) => void;
  onSelectHighlight?: (highlight: StoryHighlight) => void;
  onNavigateToUser?: (user: User) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  currentUser,
  userPosts,
  userReels,
  savedPosts,
  suggestedUsers = [],
  onToggleFollow,
  onOpenEditProfile,
  onOpenCreatePost,
  onStartCall,
  onOpenDirectChat,
  onLikePost,
  onBookmarkPost,
  onRepostPost,
  onIncrementShare,
  onSendToChat,
  onDeletePost,
  onEditPost,
  onAddComment,
  onLikeComment,
  onDeleteComment,
  onSelectReel,
  onSelectHighlight,
  onNavigateToUser,
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [highlights, setHighlights] = useState<StoryHighlight[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const isSelf = user.id === currentUser.id;

  // Followers & Following modal state
  const [connectionModalType, setConnectionModalType] = useState<'followers' | 'following' | null>(null);
  const [connectionList, setConnectionList] = useState<User[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [connectionSearchQuery, setConnectionSearchQuery] = useState('');
  const [isCreateHighlightOpen, setIsCreateHighlightOpen] = useState(false);

  // Subscribe to real user highlights
  useEffect(() => {
    if (!user.id) return;
    const unsub = subscribeToUserHighlights(user.id, (hls) => {
      setHighlights(hls);
    });
    return () => unsub();
  }, [user.id]);

  const handleOpenFollowers = async () => {
    setConnectionModalType('followers');
    setLoadingConnections(true);
    const list = await getFollowersList(user.id, currentUser.id);
    setConnectionList(list);
    setLoadingConnections(false);
  };

  const handleOpenFollowing = async () => {
    setConnectionModalType('following');
    setLoadingConnections(true);
    const list = await getFollowingList(user.id, currentUser.id);
    setConnectionList(list);
    setLoadingConnections(false);
  };

  const handleCopyProfileUrl = () => {
    const domain =
      typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost')
        ? window.location.origin
        : 'https://sodanox.ai.studio';
    const url = `${domain}/@${user.username}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleToggleModalUserFollow = async (targetUser: User) => {
    const currentlyFollowing = targetUser.isFollowing || false;
    onToggleFollow(targetUser.id);
    setConnectionList((prev) =>
      prev.map((item) => {
        if (item.id === targetUser.id) {
          const nextFollowing = !currentlyFollowing;
          return {
            ...item,
            isFollowing: nextFollowing,
            followersCount: nextFollowing
              ? item.followersCount + 1
              : Math.max(0, item.followersCount - 1),
          };
        }
        return item;
      })
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Profile Header with Banner & Aura */}
      <div className="bg-[#F1F5F2] rounded-3xl overflow-hidden border border-[#E6EDE9] shadow-soft">
        {/* Banner Cover Photo */}
        <div className="relative h-36 sm:h-52 w-full bg-[#2D3732] overflow-hidden">
          {user.bannerUrl ? (
            <img
              src={user.bannerUrl}
              alt="Profile cover banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#2D3732] via-[#3a4740] to-[#5C7567]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          
          {/* Domain Pill */}
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-[11px] font-mono text-white/90 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FA89B] animate-pulse" />
            <span>
              {typeof window !== 'undefined' && window.location.hostname && !window.location.hostname.includes('localhost')
                ? window.location.hostname
                : 'sodanox.ai.studio'}
              /@{user.username}
            </span>
          </div>
        </div>

        {/* Profile Card Body */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-14 sm:-mt-16 gap-4 sm:gap-6 mb-4">
            {/* Avatar anchored onto banner */}
            <div className="relative">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-[#FAFAF9] shadow-lg flex items-center justify-center">
                <ModernAvatar
                  src={user.avatar}
                  alt={user.name}
                  size="2xl"
                  ring
                  className="w-full h-full"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              {/* Share profile button */}
              <button
                type="button"
                onClick={handleCopyProfileUrl}
                className="p-2.5 rounded-2xl bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732] border border-[#E6EDE9] shadow-soft transition-colors cursor-pointer"
                title="Copy Profile URL"
              >
                {copiedLink ? <Check size={18} className="text-emerald-600" /> : <Share2 size={18} />}
              </button>

              {isSelf ? (
                <button
                  type="button"
                  onClick={onOpenEditProfile}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-[#FAFAF9] hover:bg-[#E6EDE9] border border-[#E6EDE9] text-[#2D3732] text-xs sm:text-sm font-medium transition-colors shadow-soft cursor-pointer"
                >
                  <Edit3 size={15} />
                  <span>Customize Profile</span>
                </button>
              ) : (
                <>
                  <FollowButton
                    isFollowing={!!user.isFollowing}
                    isFollower={!!user.isFollower}
                    userId={user.id}
                    onToggleFollow={onToggleFollow}
                    size="lg"
                  />

                  <button
                    type="button"
                    onClick={() => onOpenDirectChat(user)}
                    className="p-2.5 rounded-2xl bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732] border border-[#E6EDE9] shadow-soft transition-colors cursor-pointer"
                    title="Direct Message"
                  >
                    <MessageCircle size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartCall(user, 'audio')}
                    className="p-2.5 rounded-2xl bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732] border border-[#E6EDE9] shadow-soft transition-colors cursor-pointer"
                    title="Audio Call"
                  >
                    <Phone size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStartCall(user, 'video')}
                    className="p-2.5 rounded-2xl bg-[#FAFAF9] hover:bg-[#E6EDE9] text-[#2D3732] border border-[#E6EDE9] shadow-soft transition-colors cursor-pointer"
                    title="Video Call"
                  >
                    <Video size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 text-center sm:text-left">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-serif font-medium text-[#2D3732]">
                  {user.name}
                </h1>
                {user.verified && (
                  <CheckCircle2 size={18} className="text-[#8FA89B] fill-[#E6EDE9]" />
                )}
                {user.pronouns && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E6EDE9] text-[#7A8A82]">
                    {user.pronouns}
                  </span>
                )}
                {user.privateAccount && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Lock size={11} />
                    <span>Private</span>
                  </span>
                )}
                {/* Follows You or Mutual Badge */}
                {!isSelf && user.isMutual && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#8FA89B]/15 text-[#5E7C6E] font-medium border border-[#8FA89B]/30 flex items-center gap-1">
                    <Sparkles size={11} />
                    <span>Mutual</span>
                  </span>
                )}
                {!isSelf && !user.isMutual && user.isFollower && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#F1F5F2] text-[#7A8A82] font-medium border border-[#E6EDE9]">
                    Follows you
                  </span>
                )}
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-0.5">
                <p className="text-xs sm:text-sm text-[#7A8A82] font-mono">@{user.username}</p>
                {copiedLink && (
                  <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full animate-fade-in">
                    Link copied!
                  </span>
                )}
              </div>
            </div>

            {/* Bio */}
            {user.bio && (
              <p className="text-xs sm:text-sm text-[#2D3732] leading-relaxed max-w-2xl">
                {user.bio}
              </p>
            )}

            {/* Metadata info */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-[#7A8A82]">
              {user.location && (
                <div className="flex items-center gap-1">
                  <MapPin size={13} className="text-[#8FA89B]" />
                  <span>{user.location}</span>
                </div>
              )}
              {user.website && (
                <a
                  href={user.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[#8FA89B] hover:underline"
                >
                  <LinkIcon size={13} />
                  <span>{user.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              <div className="flex items-center gap-1">
                <Calendar size={13} />
                <span>{user.joinedDate}</span>
              </div>
            </div>

            {/* Stats row with interactive modals for followers/following */}
            <div className="flex items-center justify-center sm:justify-start gap-6 pt-3 border-t border-[#E6EDE9] text-xs sm:text-sm">
              <div>
                <span className="font-semibold text-[#2D3732] tabular-nums">
                  {userPosts.length}
                </span>{' '}
                <span className="text-[#7A8A82]">posts</span>
              </div>

              <button
                type="button"
                onClick={handleOpenFollowers}
                className="hover:underline cursor-pointer group flex items-center gap-1"
              >
                <span className="font-semibold text-[#2D3732] tabular-nums group-hover:text-[#8FA89B]">
                  {user.followersCount.toLocaleString()}
                </span>{' '}
                <span className="text-[#7A8A82]">followers</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFollowing}
                className="hover:underline cursor-pointer group flex items-center gap-1"
              >
                <span className="font-semibold text-[#2D3732] tabular-nums group-hover:text-[#8FA89B]">
                  {user.followingCount.toLocaleString()}
                </span>{' '}
                <span className="text-[#7A8A82]">following</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Story Highlights Bar */}
      <div className="bg-[#FAFAF9] rounded-3xl p-4 sm:p-5 border border-[#E6EDE9]">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs uppercase font-mono tracking-wider text-[#7A8A82]">
            Story Highlights
          </span>
          {highlights.length > 0 && (
            <span className="text-[11px] text-[#7A8A82]">
              {highlights.length} {highlights.length === 1 ? 'collection' : 'collections'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
          {/* Add New Highlight Button for Profile Owner */}
          {isSelf && (
            <button
              type="button"
              onClick={() => setIsCreateHighlightOpen(true)}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
            >
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#8FA89B] hover:border-[#5C7567] bg-white hover:bg-[#F1F5F2] flex items-center justify-center text-[#8FA89B] group-hover:text-[#5C7567] group-hover:scale-105 transition-all shadow-sm">
                <Plus size={24} />
              </div>
              <span className="text-xs font-medium text-[#2D3732] max-w-[70px] truncate text-center">
                New
              </span>
            </button>
          )}

          {highlights.map((hl) => (
            <div key={hl.id} className="relative group shrink-0">
              <button
                type="button"
                onClick={() => onSelectHighlight?.(hl)}
                className="flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
              >
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#8FA89B] to-[#E6EDE9] group-hover:scale-105 transition-transform shadow-sm">
                  <div className="w-full h-full rounded-full p-[2px] bg-white">
                    <img
                      src={hl.coverUrl}
                      alt={hl.title}
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-[#2D3732] max-w-[70px] truncate text-center">
                  {hl.title}
                </span>
              </button>

              {/* Delete Highlight for Profile Owner */}
              {isSelf && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete highlight "${hl.title}"?`)) {
                      await deleteStoryHighlight(hl.id);
                    }
                  }}
                  className="absolute -top-1 -right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-700"
                  title="Delete Highlight"
                >
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}

          {highlights.length === 0 && !isSelf && (
            <div className="py-2 px-1 text-xs text-[#7A8A82] italic">
              No story highlights curated yet.
            </div>
          )}
        </div>
      </div>

      {/* Profile Content Tabs */}
      <div className="flex items-center justify-center border-b border-[#F1F5F2] gap-8">
        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'posts'
              ? 'border-[#2D3732] text-[#2D3732]'
              : 'border-transparent text-[#7A8A82] hover:text-[#2D3732]'
          }`}
        >
          <Grid size={16} />
          <span>Posts ({userPosts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reels')}
          className={`flex items-center gap-2 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'reels'
              ? 'border-[#2D3732] text-[#2D3732]'
              : 'border-transparent text-[#7A8A82] hover:text-[#2D3732]'
          }`}
        >
          <Play size={16} />
          <span>Reels ({userReels.length})</span>
        </button>

        {isSelf && (
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`flex items-center gap-2 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'saved'
                ? 'border-[#2D3732] text-[#2D3732]'
                : 'border-transparent text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            <Bookmark size={16} />
            <span>Saved ({savedPosts.length})</span>
          </button>
        )}
      </div>

      {/* Tab Panes */}
      <div>
        {activeTab === 'posts' && (
          <div className="space-y-6">
            {/* Quick Create Post for Profile Owner */}
            {isSelf && onOpenCreatePost && (
              <div className="bg-[#F1F5F2] rounded-3xl p-4 sm:p-5 border border-[#E6EDE9] shadow-soft flex items-center gap-3">
                <ModernAvatar src={currentUser.avatar} alt={currentUser.name} size="md" className="shrink-0" />
                <button
                  type="button"
                  onClick={onOpenCreatePost}
                  className="flex-1 text-left bg-[#FAFAF9] hover:bg-white border border-[#E6EDE9] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#7A8A82] hover:text-[#2D3732] transition-colors shadow-soft cursor-pointer"
                >
                  Share what you are creating or thinking today...
                </button>
                <button
                  type="button"
                  onClick={onOpenCreatePost}
                  className="inline-flex items-center px-4 py-2.5 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs font-semibold transition-all shadow-soft active:scale-[0.98] cursor-pointer"
                >
                  <Plus size={14} className="mr-1" />
                  Post
                </button>
              </div>
            )}

            {userPosts.length === 0 ? (
              <div className="text-center py-16 text-xs sm:text-sm text-[#7A8A82] bg-[#F1F5F2]/40 rounded-3xl border border-dashed border-[#2D3732]/10">
                <p>No community posts shared yet.</p>
              </div>
            ) : (
              userPosts.map((post) => (
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
                  onDeletePost={onDeletePost}
                  onEditPost={onEditPost}
                  onAddComment={onAddComment}
                  onLikeComment={onLikeComment}
                  onDeleteComment={onDeleteComment}
                  onOpenUserProfile={onNavigateToUser}
                  onToggleFollowUser={onToggleFollow}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'reels' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {userReels.length === 0 ? (
              <div className="col-span-full text-center py-16 text-xs sm:text-sm text-[#7A8A82] bg-[#F1F5F2]/40 rounded-3xl border border-dashed border-[#2D3732]/10">
                No video reels uploaded yet.
              </div>
            ) : (
              userReels.map((reel) => (
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
                  <div className="absolute bottom-3 left-3 right-3 text-white text-xs font-medium line-clamp-1">
                    {reel.caption}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="space-y-6">
            {savedPosts.length === 0 ? (
              <div className="text-center py-16 text-xs sm:text-sm text-[#7A8A82] bg-[#F1F5F2]/40 rounded-3xl border border-dashed border-[#2D3732]/10">
                You haven't bookmarked any posts yet.
              </div>
            ) : (
              savedPosts.map((post) => (
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
                  onDeletePost={onDeletePost}
                  onEditPost={onEditPost}
                  onAddComment={onAddComment}
                  onLikeComment={onLikeComment}
                  onDeleteComment={onDeleteComment}
                  onOpenUserProfile={onNavigateToUser}
                  onToggleFollowUser={onToggleFollow}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Followers / Following Modal with Real Live Follow/Unfollow/Follow Back Buttons */}
      {connectionModalType && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#FAFAF9] rounded-3xl p-6 shadow-2xl border border-[#2D3732]/10 max-h-[80vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D3732]/10 mb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#8FA89B]" />
                <h4 className="font-serif text-base font-semibold text-[#2D3732] capitalize">
                  {connectionModalType} ({connectionList.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConnectionModalType(null);
                  setConnectionSearchQuery('');
                }}
                className="p-1 rounded-full hover:bg-black/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter / Search input */}
            <div className="relative mb-3">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8A82]"
              />
              <input
                type="text"
                value={connectionSearchQuery}
                onChange={(e) => setConnectionSearchQuery(e.target.value)}
                placeholder={`Search ${connectionModalType}...`}
                className="w-full pl-9 pr-3 py-2 bg-[#F1F5F2] border border-[#E6EDE9] rounded-xl text-xs text-[#2D3732] placeholder-[#7A8A82] focus:outline-none focus:border-[#8FA89B]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingConnections ? (
                <div className="py-8 text-center text-xs text-[#7A8A82]">Loading members...</div>
              ) : connectionList.filter(
                  (m) =>
                    !connectionSearchQuery.trim() ||
                    m.name.toLowerCase().includes(connectionSearchQuery.toLowerCase()) ||
                    m.username.toLowerCase().includes(connectionSearchQuery.toLowerCase())
                ).length > 0 ? (
                connectionList
                  .filter(
                    (m) =>
                      !connectionSearchQuery.trim() ||
                      m.name.toLowerCase().includes(connectionSearchQuery.toLowerCase()) ||
                      m.username.toLowerCase().includes(connectionSearchQuery.toLowerCase())
                  )
                  .map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#F1F5F2] transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer min-w-0 flex-1 mr-3"
                      onClick={() => {
                        setConnectionModalType(null);
                        onNavigateToUser?.(member);
                      }}
                    >
                      <ModernAvatar
                        src={member.avatar}
                        alt={member.name}
                        size="md"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-[#2D3732] hover:underline truncate">
                            {member.name}
                          </span>
                          {member.verified && (
                            <CheckCircle2 size={12} className="text-[#8FA89B] shrink-0" />
                          )}
                          {member.isMutual && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#8FA89B]/15 text-[#5E7C6E] shrink-0">
                              Mutual
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#7A8A82] truncate font-mono">
                            @{member.username}
                          </span>
                          {member.isFollower && !member.isMutual && (
                            <span className="text-[10px] text-[#7A8A82] bg-white px-1.5 py-0.2 rounded-full border border-[#2D3732]/10 shrink-0">
                              Follows you
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Member action button */}
                    {member.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() => handleToggleModalUserFollow(member)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                          member.isFollowing
                            ? 'bg-[#E6EDE9] text-[#2D3732] hover:bg-neutral-200'
                            : member.isFollower
                            ? 'bg-[#2D3732] text-white hover:bg-[#3d4a43]'
                            : 'bg-[#8FA89B] text-white hover:bg-[#7e9689]'
                        }`}
                      >
                        {member.isFollowing
                          ? 'Following'
                          : member.isFollower
                          ? 'Follow Back'
                          : 'Follow'}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#7A8A82]">
                  No {connectionModalType} to display yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Highlight Modal */}
      {isCreateHighlightOpen && (
        <CreateHighlightModal
          currentUser={currentUser}
          onClose={() => setIsCreateHighlightOpen(false)}
          onCreated={() => {}}
        />
      )}

      {/* Mandatory Developer Footer */}
      <div className="py-6 text-center border-t border-[#E6EDE9]">
        <p className="text-xs text-[#7A8A82] font-medium tracking-wide hover:text-[#2D3732] transition-colors">
          developed by reponsekdz · Aura Social
        </p>
      </div>
    </div>
  );
};

