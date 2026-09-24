import React, { useState } from 'react';
import {
  X,
  Heart,
  MessageCircle,
  UserPlus,
  Phone,
  Check,
  Repeat2,
  Sparkles,
  Trash2,
  BellRing,
  Share2,
  CheckCircle2,
  Film,
  Compass,
} from 'lucide-react';
import { NotificationItem, User } from '../../types';
import { FollowButton } from '../common/FollowButton';
import { auraAudio } from '../../utils/audioSynthesizer';
import { ModernAvatar } from '../common/ModernAvatar';

interface NotificationsDrawerProps {
  notifications: NotificationItem[];
  currentUser?: User;
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onClearAllNotifications?: () => void;
  onOpenUserProfile: (user: User) => void;
  onDeleteNotification?: (notificationId: string) => void;
  onToggleFollowUser?: (userId: string) => void;
  onSelectPost?: (postId: string) => void;
}

type FilterCategory = 'all' | 'likes' | 'comments' | 'shares' | 'follows';

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  notifications,
  currentUser,
  onClose,
  onMarkAllAsRead,
  onClearAllNotifications,
  onOpenUserProfile,
  onDeleteNotification,
  onToggleFollowUser,
  onSelectPost,
}) => {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  const requestBrowserAlerts = async () => {
    auraAudio.playClick(600, 0.04);
    if (typeof Notification !== 'undefined') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        setBrowserAlertsEnabled(true);
        new Notification('Aura Notifications Active', {
          body: 'You will now receive desktop alerts for reflections, calls, and replies.',
          icon: '/favicon.ico',
        });
      }
    }
  };

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'like':
      case 'story_like':
      case 'reel_like':
        return <Heart size={14} className="text-rose-500 fill-rose-500" />;
      case 'comment':
        return <MessageCircle size={14} className="text-[#5E7C6E]" />;
      case 'share':
        return <Share2 size={14} className="text-[#5E7C6E]" />;
      case 'repost':
        return <Repeat2 size={14} className="text-[#5E7C6E]" />;
      case 'follow':
        return <UserPlus size={14} className="text-[#5E7C6E]" />;
      case 'call':
        return <Phone size={14} className="text-amber-500" />;
      case 'story_reply':
        return <Sparkles size={14} className="text-amber-500" />;
      default:
        return <Heart size={14} className="text-[#5E7C6E]" />;
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'all') return true;
    if (filter === 'likes') {
      return notif.type === 'like' || notif.type === 'story_like' || notif.type === 'reel_like';
    }
    if (filter === 'comments') {
      return notif.type === 'comment' || notif.type === 'story_reply' || notif.type === 'mention';
    }
    if (filter === 'shares') {
      return notif.type === 'share' || notif.type === 'repost';
    }
    if (filter === 'follows') {
      return notif.type === 'follow';
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2D3732]/40 backdrop-blur-xs flex justify-end animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm sm:max-w-md h-full bg-[#FAFAF9] shadow-soft-float border-l border-[#2D3732]/10 flex flex-col animate-slideLeft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#2D3732]/10 flex items-center justify-between bg-white/70">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-[#2D3732] font-serif">
                Activity & Notifications
              </h2>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#5E7C6E] text-white tabular-nums">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#7A8A82]">
              Real-time updates across your Aura network
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  auraAudio.playClick(650, 0.04);
                  onMarkAllAsRead();
                }}
                className="text-xs font-medium text-[#5E7C6E] hover:text-[#2D3732] transition-colors cursor-pointer"
                title="Mark all as read"
              >
                Mark all read
              </button>
            )}
            {notifications.length > 0 && onClearAllNotifications && (
              <button
                type="button"
                onClick={() => {
                  auraAudio.playClick(400, 0.05);
                  onClearAllNotifications();
                }}
                className="text-xs font-medium text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Clear all activity history"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Browser Alert Banner (if not yet granted) */}
        {!browserAlertsEnabled && typeof Notification !== 'undefined' && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-[#E6EDE9]/60 border border-[#8FA89B]/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-[#2D3732]">
              <BellRing size={16} className="text-[#5E7C6E] shrink-0" />
              <span>Enable desktop alerts for calls & replies</span>
            </div>
            <button
              type="button"
              onClick={requestBrowserAlerts}
              className="px-2.5 py-1 bg-[#5E7C6E] text-white text-[11px] font-semibold rounded-xl hover:bg-[#4d665b] shrink-0 transition-colors cursor-pointer"
            >
              Enable
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-[#2D3732]/10 overflow-x-auto scrollbar-none bg-white/40">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'likes', label: 'Likes' },
              { id: 'comments', label: 'Comments' },
              { id: 'shares', label: 'Shares' },
              { id: 'follows', label: 'Followers' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                auraAudio.playClick(700, 0.03);
                setFilter(t.id);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                filter === t.id
                  ? 'bg-[#2D3732] text-white shadow-xs'
                  : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#2D3732]/5">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-20 px-4 text-xs text-[#7A8A82] space-y-2">
              <Sparkles size={28} className="mx-auto text-[#5E7C6E]/40" />
              <p className="font-medium text-[#2D3732]">No activity here yet</p>
              <p>
                When members follow, like, share, or comment on your reflections, real-time alerts
                will appear here.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isFollowingActor =
                currentUser?.following?.includes(notif.user.id) || !!notif.user.isFollowing;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (notif.targetId && onSelectPost) {
                      onSelectPost(notif.targetId);
                      onClose();
                    }
                  }}
                  className={`p-4 flex items-start gap-3 transition-colors group relative cursor-pointer ${
                    !notif.read ? 'bg-[#E6EDE9]/40' : 'hover:bg-[#F1F5F2]/50'
                  }`}
                >
                  {/* User Avatar with Type Badge */}
                  <div
                    className="relative shrink-0 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenUserProfile(notif.user);
                      onClose();
                    }}
                  >
                    <ModernAvatar
                      src={notif.user.avatar}
                      alt={notif.user.name}
                      size="md"
                      className="hover:ring-2 hover:ring-[#5E7C6E] transition-all"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FAFAF9] border border-[#2D3732]/10 flex items-center justify-center shadow-xs">
                      {getIcon(notif.type)}
                    </div>
                  </div>

                  {/* Body message */}
                  <div className="flex-1 min-w-0 pr-8">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="font-semibold text-xs text-[#2D3732] hover:underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenUserProfile(notif.user);
                          onClose();
                        }}
                      >
                        {notif.user.name}
                      </span>
                      {notif.user.verified && (
                        <CheckCircle2 size={13} className="text-[#5E7C6E] shrink-0" />
                      )}
                      <span className="text-[11px] text-[#7A8A82] font-mono">
                        @{notif.user.username}
                      </span>
                    </div>

                    <p className="text-xs text-[#2D3732] leading-snug mt-0.5">
                      {notif.type === 'like' && 'liked your reflection.'}
                      {notif.type === 'story_like' && 'liked your story.'}
                      {notif.type === 'reel_like' && 'liked your cinema reel.'}
                      {notif.type === 'comment' && 'reflected on your post.'}
                      {notif.type === 'share' && 'shared your reflection with their circle.'}
                      {notif.type === 'repost' && 'reposted your reflection to their followers.'}
                      {notif.type === 'follow' && 'started following your channel.'}
                      {notif.type === 'call' && 'initiated an encrypted call.'}
                      {notif.type === 'story_reply' && 'replied to your story.'}
                      {notif.type === 'mention' && 'mentioned you in a reflection.'}
                    </p>

                    {notif.targetTitle && (
                      <p className="text-[11px] text-[#7A8A82] truncate mt-1 bg-black/5 px-2 py-1 rounded-lg italic">
                        "{notif.targetTitle}"
                      </p>
                    )}

                    {/* Quick follow back button for follow notifications */}
                    {notif.type === 'follow' &&
                      currentUser &&
                      notif.user.id !== currentUser.id &&
                      onToggleFollowUser && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <FollowButton
                            isFollowing={isFollowingActor}
                            isFollower={true}
                            userId={notif.user.id}
                            onToggleFollow={onToggleFollowUser}
                            size="sm"
                          />
                        </div>
                      )}

                    <span className="text-[10px] text-[#7A8A82] block mt-1.5">
                      {notif.timestamp}
                    </span>
                  </div>

                  {/* Right side controls: delete notification & unread dot */}
                  <div className="flex items-center gap-1.5 absolute top-3 right-3">
                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-[#5E7C6E] shrink-0" />
                    )}

                    {onDeleteNotification && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          auraAudio.playClick(400, 0.04);
                          onDeleteNotification(notif.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[#7A8A82] hover:text-red-500 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                        title="Dismiss notification"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Developer Footer */}
        <div className="p-3 border-t border-[#2D3732]/10 bg-[#FAFAF9] text-center">
          <p className="text-[11px] text-[#7A8A82] font-medium tracking-wide">
            app developed by reponsekdz · Aura Realtime
          </p>
        </div>
      </div>
    </div>
  );
};
