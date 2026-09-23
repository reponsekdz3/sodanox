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
  Filter,
} from 'lucide-react';
import { NotificationItem, User } from '../../types';

interface NotificationsDrawerProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onOpenUserProfile: (user: User) => void;
  onDeleteNotification?: (notificationId: string) => void;
}

type FilterCategory = 'all' | 'mentions' | 'reactions' | 'calls';

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  notifications,
  onClose,
  onMarkAllAsRead,
  onOpenUserProfile,
  onDeleteNotification,
}) => {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [browserAlertsEnabled, setBrowserAlertsEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  const requestBrowserAlerts = async () => {
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
        return <Heart size={14} className="text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageCircle size={14} className="text-[#8FA89B]" />;
      case 'repost':
        return <Repeat2 size={14} className="text-[#8FA89B]" />;
      case 'follow':
        return <UserPlus size={14} className="text-[#8FA89B]" />;
      case 'call':
        return <Phone size={14} className="text-amber-500" />;
      case 'story_reply':
        return <Sparkles size={14} className="text-amber-500" />;
      default:
        return <Heart size={14} className="text-[#8FA89B]" />;
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'all') return true;
    if (filter === 'mentions') return notif.type === 'comment' || notif.type === 'story_reply';
    if (filter === 'reactions') return notif.type === 'like' || notif.type === 'repost' || notif.type === 'follow';
    if (filter === 'calls') return notif.type === 'call';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-sm sm:max-w-md h-full bg-[#FAFAF9] shadow-soft-float border-l border-[#F1F5F2] flex flex-col animate-slideLeft">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#F1F5F2] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#2D3732] font-serif">
              Activity & Notifications
            </h2>
            <p className="text-[11px] text-[#7A8A82]">
              Real-time updates across your Aura network
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-xs font-medium text-[#8FA89B] hover:text-[#2D3732] transition-colors"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2]"
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
              className="px-2.5 py-1 bg-[#8FA89B] text-white text-[11px] font-semibold rounded-xl hover:bg-[#7e9689] shrink-0 transition-colors"
            >
              Enable
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-[#F1F5F2] overflow-x-auto scrollbar-none">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'mentions', label: 'Replies' },
              { id: 'reactions', label: 'Reactions' },
              { id: 'calls', label: 'Calls' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                filter === t.id
                  ? 'bg-[#2D3732] text-white'
                  : 'bg-[#F1F5F2] text-[#7A8A82] hover:text-[#2D3732]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F2]">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-16 px-4 text-xs text-[#7A8A82] space-y-1">
              <p className="font-medium text-[#2D3732]">No activity here yet</p>
              <p>When creators interact with your reflections, they will appear here.</p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 flex items-start gap-3 transition-colors group relative ${
                  !notif.read ? 'bg-[#F1F5F2]/70' : 'hover:bg-[#F1F5F2]/30'
                }`}
              >
                {/* User Avatar with Type Badge */}
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={() => {
                    onOpenUserProfile(notif.user);
                    onClose();
                  }}
                >
                  <img
                    src={notif.user.avatar}
                    alt={notif.user.name}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-[#E6EDE9] hover:ring-2 hover:ring-[#8FA89B] transition-all"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FAFAF9] border border-[#E6EDE9] flex items-center justify-center shadow-xs">
                    {getIcon(notif.type)}
                  </div>
                </div>

                {/* Body message */}
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-xs text-[#2D3732] leading-snug">
                    <span
                      className="font-semibold cursor-pointer hover:underline"
                      onClick={() => {
                        onOpenUserProfile(notif.user);
                        onClose();
                      }}
                    >
                      {notif.user.name}
                    </span>{' '}
                    {notif.type === 'like' && 'liked your reflection.'}
                    {notif.type === 'comment' && 'reflected on your post.'}
                    {notif.type === 'repost' && 'reposted your reflection.'}
                    {notif.type === 'follow' && 'started following your channel.'}
                    {notif.type === 'call' && 'initiated an encrypted call.'}
                    {notif.type === 'story_reply' && 'replied to your story.'}
                  </p>

                  {notif.targetTitle && (
                    <p className="text-[11px] text-[#7A8A82] truncate mt-0.5 italic">
                      "{notif.targetTitle}"
                    </p>
                  )}

                  <span className="text-[10px] text-[#7A8A82] block mt-1">
                    {notif.timestamp}
                  </span>
                </div>

                {/* Delete button (hover) */}
                {onDeleteNotification && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotification(notif.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-[#A1B0A8] hover:text-red-500 rounded-lg hover:bg-red-50 transition-all absolute top-3 right-3"
                    title="Dismiss notification"
                  >
                    <Trash2 size={13} />
                  </button>
                )}

                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-[#8FA89B] shrink-0 mt-2 absolute top-2 right-2" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Mandatory Developer Footer */}
        <div className="p-3 border-t border-[#F1F5F2] bg-[#FAFAF9] text-center">
          <p className="text-[11px] text-[#7A8A82] font-medium tracking-wide">
            app developed by reponsekdz
          </p>
        </div>
      </div>
    </div>
  );
};
