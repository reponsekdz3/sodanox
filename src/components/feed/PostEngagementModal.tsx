import React, { useState, useEffect } from 'react';
import {
  X,
  Heart,
  Eye,
  Repeat2,
  Share2,
  CheckCircle2,
  Copy,
  Check,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { Post, User } from '../../types';
import { FollowButton } from '../common/FollowButton';
import { getUserProfile } from '../../services/userService';
import { auraAudio } from '../../utils/audioSynthesizer';
import { ModernAvatar } from '../common/ModernAvatar';

interface PostEngagementModalProps {
  post: Post;
  currentUser: User;
  onClose: () => void;
  onOpenUserProfile?: (user: User) => void;
  onToggleFollowUser?: (userId: string) => void;
}

export const PostEngagementModal: React.FC<PostEngagementModalProps> = ({
  post,
  currentUser,
  onClose,
  onOpenUserProfile,
  onToggleFollowUser,
}) => {
  const [activeTab, setActiveTab] = useState<'likes' | 'shares' | 'views'>('likes');
  const [likedUsers, setLikedUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchLikedUsers = async () => {
      if (!post.likedBy || post.likedBy.length === 0) {
        setLikedUsers([]);
        return;
      }
      setLoadingUsers(true);
      try {
        const users: User[] = [];
        for (const uid of post.likedBy.slice(0, 30)) {
          if (uid === currentUser.id) {
            users.push(currentUser);
          } else {
            const u = await getUserProfile(uid);
            if (u) {
              users.push({
                ...u,
                isFollowing: currentUser.following?.includes(u.id) || false,
                isFollower: currentUser.followers?.includes(u.id) || false,
              });
            }
          }
        }
        if (isMounted) {
          setLikedUsers(users);
        }
      } catch (err) {
        console.warn('Error fetching liked users:', err);
      } finally {
        if (isMounted) setLoadingUsers(false);
      }
    };

    fetchLikedUsers();
    return () => {
      isMounted = false;
    };
  }, [post.likedBy, currentUser]);

  const handleCopyLink = () => {
    auraAudio.playClick(720, 0.04);
    const url = `${window.location.origin}/?post=${post.id}`;
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2D3732]/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FAFAF9] rounded-3xl shadow-2xl border border-[#2D3732]/10 overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#2D3732]/10 flex items-center justify-between bg-white/60">
          <div>
            <h3 className="text-base font-semibold text-[#2D3732] font-serif flex items-center gap-2">
              <TrendingUp size={18} className="text-[#5E7C6E]" />
              <span>Reflection Engagement</span>
            </h3>
            <p className="text-xs text-[#7A8A82]">
              Real-time views, reactions, and reach analytics
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top 3 KPI metrics cards */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-[#F1F5F2]/70 border-b border-[#2D3732]/10">
          <button
            type="button"
            onClick={() => setActiveTab('views')}
            className={`p-3 rounded-2xl text-center transition-all cursor-pointer ${
              activeTab === 'views'
                ? 'bg-white shadow-xs border border-[#5E7C6E]/30 scale-102'
                : 'hover:bg-white/50'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-[#5E7C6E] mb-1">
              <Eye size={15} />
              <span className="text-[11px] font-semibold">Views</span>
            </div>
            <span className="text-base font-bold text-[#2D3732] tabular-nums block">
              {(post.viewsCount ?? 0).toLocaleString()}
            </span>
            <span className="text-[10px] text-[#7A8A82]">Impressions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('likes')}
            className={`p-3 rounded-2xl text-center transition-all cursor-pointer ${
              activeTab === 'likes'
                ? 'bg-white shadow-xs border border-rose-300 scale-102'
                : 'hover:bg-white/50'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-rose-500 mb-1">
              <Heart size={15} className="fill-rose-500" />
              <span className="text-[11px] font-semibold">Likes</span>
            </div>
            <span className="text-base font-bold text-[#2D3732] tabular-nums block">
              {post.likesCount.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#7A8A82]">Reactions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shares')}
            className={`p-3 rounded-2xl text-center transition-all cursor-pointer ${
              activeTab === 'shares'
                ? 'bg-white shadow-xs border border-[#8FA89B] scale-102'
                : 'hover:bg-white/50'
            }`}
          >
            <div className="flex items-center justify-center gap-1 text-[#5E7C6E] mb-1">
              <Share2 size={15} />
              <span className="text-[11px] font-semibold">Shares</span>
            </div>
            <span className="text-base font-bold text-[#2D3732] tabular-nums block">
              {(post.sharesCount + (post.repostsCount || 0)).toLocaleString()}
            </span>
            <span className="text-[10px] text-[#7A8A82]">Re-shares</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'likes' && (
            <div>
              <div className="text-xs font-semibold text-[#2D3732] mb-3 flex items-center justify-between">
                <span>Creators who liked this post</span>
                <span className="text-[11px] font-normal text-[#7A8A82]">
                  {post.likesCount} {post.likesCount === 1 ? 'member' : 'members'}
                </span>
              </div>

              {loadingUsers ? (
                <div className="space-y-3 py-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-neutral-200" />
                      <div className="flex-1 space-y-1">
                        <div className="h-3 bg-neutral-200 rounded w-1/3" />
                        <div className="h-2 bg-neutral-200 rounded w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : likedUsers.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#7A8A82] space-y-2">
                  <Heart size={28} className="mx-auto text-neutral-300 stroke-1" />
                  <p className="font-medium text-[#2D3732]">No likes yet</p>
                  <p>Be the first member to like this reflection!</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {likedUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl hover:bg-[#F1F5F2] transition-colors"
                    >
                      <div
                        className="flex items-center gap-3 min-w-0 cursor-pointer group"
                        onClick={() => {
                          onOpenUserProfile?.(u);
                          onClose();
                        }}
                      >
                        <ModernAvatar
                          src={u.avatar}
                          alt={u.name}
                          size="md"
                          className="group-hover:ring-1 group-hover:ring-[#5E7C6E] transition-all"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-[#2D3732] truncate group-hover:underline">
                              {u.name}
                            </span>
                            {u.verified && (
                              <CheckCircle2 size={13} className="text-[#5E7C6E] shrink-0" />
                            )}
                          </div>
                          <span className="text-[11px] text-[#7A8A82] truncate block font-mono">
                            @{u.username}
                          </span>
                        </div>
                      </div>

                      {u.id !== currentUser.id && onToggleFollowUser && (
                        <FollowButton
                          isFollowing={!!u.isFollowing}
                          isFollower={!!u.isFollower}
                          userId={u.id}
                          onToggleFollow={onToggleFollowUser}
                          size="sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'views' && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#2D3732]">
                  <Sparkles size={15} className="text-[#5E7C6E]" />
                  <span>Reach & Impression Details</span>
                </div>
                <p className="text-xs text-[#7A8A82] leading-relaxed">
                  This reflection has been rendered and observed{' '}
                  <strong className="text-[#2D3732] font-semibold tabular-nums">
                    {(post.viewsCount ?? 0).toLocaleString()}
                  </strong>{' '}
                  times across members' feeds, explore, and creator profiles.
                </p>
                <div className="pt-2 border-t border-[#2D3732]/10 flex items-center justify-between text-[11px] text-[#7A8A82]">
                  <span>Unique Viewer Accounts</span>
                  <span className="font-semibold text-[#2D3732] tabular-nums">
                    {(post.viewedBy?.length ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shares' && (
            <div className="space-y-3 py-2">
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-2">
                <div className="text-xs font-semibold text-[#2D3732] flex items-center gap-2">
                  <Repeat2 size={15} className="text-[#5E7C6E]" />
                  <span>Reposts & External Shares</span>
                </div>
                <p className="text-xs text-[#7A8A82]">
                  Shared{' '}
                  <strong className="text-[#2D3732] font-semibold tabular-nums">
                    {post.sharesCount}
                  </strong>{' '}
                  times directly and quoted or reposted{' '}
                  <strong className="text-[#2D3732] font-semibold tabular-nums">
                    {post.repostsCount || 0}
                  </strong>{' '}
                  times on community feeds.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white border border-[#2D3732]/10 hover:bg-[#F1F5F2] text-xs font-medium text-[#2D3732] transition-colors shadow-xs cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span>Direct link copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="text-[#7A8A82]" />
                      <span>Copy reflection link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F1F5F2]/50 border-t border-[#2D3732]/10 text-center">
          <p className="text-[10px] text-[#7A8A82] font-medium tracking-wide">
            app developed by reponsekdz · Aura Live Analytics
          </p>
        </div>
      </div>
    </div>
  );
};
