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
} from 'lucide-react';
import { User, Post, Reel, StoryHighlight } from '../../types';
import { PostCard } from '../feed/PostCard';
import { subscribeToUserHighlights } from '../../services/storyService';
import { getFollowersList, getFollowingList, toggleFollowUser } from '../../services/userService';

interface ProfileViewProps {
  user: User;
  currentUser: User;
  userPosts: Post[];
  userReels: Reel[];
  savedPosts: Post[];
  suggestedUsers?: User[];
  onToggleFollow: (userId: string) => void;
  onOpenEditProfile: () => void;
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
  const isSelf = user.id === currentUser.id;

  // Followers & Following modal state
  const [connectionModalType, setConnectionModalType] = useState<'followers' | 'following' | null>(null);
  const [connectionList, setConnectionList] = useState<User[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

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
    const list = await getFollowersList(user.id);
    setConnectionList(list);
    setLoadingConnections(false);
  };

  const handleOpenFollowing = async () => {
    setConnectionModalType('following');
    setLoadingConnections(true);
    const list = await getFollowingList(user.id);
    setConnectionList(list);
    setLoadingConnections(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Profile Header with Banner & Studio Aura */}
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
        </div>

        {/* Profile Card Body */}
        <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0">
          <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-14 sm:-mt-16 gap-4 sm:gap-6 mb-4">
            {/* Avatar anchored onto banner */}
            <div className="relative">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-[#FAFAF9] shadow-lg">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-full h-full rounded-full object-cover ring-2 ring-[#8FA89B]"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
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
                  <button
                    type="button"
                    onClick={() => onToggleFollow(user.id)}
                    className={`px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-medium transition-all shadow-soft active:scale-95 cursor-pointer ${
                      user.isFollowing
                        ? 'bg-[#E6EDE9] text-[#2D3732] hover:bg-neutral-200'
                        : 'bg-[#8FA89B] text-white hover:bg-[#7e9689]'
                    }`}
                  >
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </button>
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
              </div>
              <p className="text-xs sm:text-sm text-[#7A8A82] font-mono">@{user.username}</p>
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
                className="hover:underline cursor-pointer"
              >
                <span className="font-semibold text-[#2D3732] tabular-nums">
                  {user.followersCount.toLocaleString()}
                </span>{' '}
                <span className="text-[#7A8A82]">followers</span>
              </button>

              <button
                type="button"
                onClick={handleOpenFollowing}
                className="hover:underline cursor-pointer"
              >
                <span className="font-semibold text-[#2D3732] tabular-nums">
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
          {highlights.map((hl) => (
            <button
              key={hl.id}
              type="button"
              onClick={() => onSelectHighlight?.(hl)}
              className="flex flex-col items-center gap-1.5 shrink-0 group cursor-pointer focus:outline-none"
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
          ))}

          {highlights.length === 0 && (
            <div className="py-2 px-1 text-xs text-[#7A8A82] italic">
              {isSelf
                ? 'Save your active stories to Highlights to pin them here permanently.'
                : 'No story highlights curated yet.'}
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
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Followers / Following Modal */}
      {connectionModalType && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#FAFAF9] rounded-3xl p-6 shadow-2xl border border-[#2D3732]/10 max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D3732]/10 mb-3">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-[#8FA89B]" />
                <h4 className="font-serif text-base font-semibold text-[#2D3732] capitalize">
                  {connectionModalType}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setConnectionModalType(null)}
                className="p-1 rounded-full hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingConnections ? (
                <div className="py-8 text-center text-xs text-[#7A8A82]">Loading members...</div>
              ) : connectionList.length > 0 ? (
                connectionList.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#F1F5F2] transition-colors"
                  >
                    <div
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        setConnectionModalType(null);
                        onNavigateToUser?.(member);
                      }}
                    >
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#2D3732]/10"
                      />
                      <div>
                        <div className="text-xs font-semibold text-[#2D3732] hover:underline">
                          {member.name}
                        </div>
                        <div className="text-[11px] text-[#7A8A82]">@{member.username}</div>
                      </div>
                    </div>
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
      {/* Mandatory Developer Footer */}
      <div className="py-6 text-center border-t border-[#E6EDE9]">
        <p className="text-xs text-[#7A8A82] font-medium tracking-wide hover:text-[#2D3732] transition-colors">
          app developed by reponsekdz
        </p>
      </div>
    </div>
  );
};
