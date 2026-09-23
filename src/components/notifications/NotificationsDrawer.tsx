import React from 'react';
import { X, Heart, MessageCircle, UserPlus, Phone, Check, Repeat2, Sparkles } from 'lucide-react';
import { NotificationItem, User } from '../../types';

interface NotificationsDrawerProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAllAsRead: () => void;
  onOpenUserProfile: (user: User) => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  notifications,
  onClose,
  onMarkAllAsRead,
  onOpenUserProfile,
}) => {
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

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/40 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-sm sm:max-w-md h-full bg-[#FAFAF9] shadow-soft-float border-l border-[#F1F5F2] flex flex-col animate-slideLeft">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#F1F5F2] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#2D3732]">
              Activity & Notifications
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllAsRead}
              className="text-xs font-medium text-[#8FA89B] hover:text-[#2D3732] transition-colors"
            >
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F2]">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#7A8A82]">
              No activity yet.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 flex items-start gap-3 transition-colors ${
                  !notif.read ? 'bg-[#F1F5F2]/60' : 'hover:bg-[#F1F5F2]/30'
                }`}
              >
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
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FAFAF9] border border-[#E6EDE9] flex items-center justify-center shadow-soft">
                    {getIcon(notif.type)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
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
                    {notif.type === 'comment' && 'commented on your project.'}
                    {notif.type === 'repost' && 'reposted your project.'}
                    {notif.type === 'follow' && 'started following your channel.'}
                    {notif.type === 'call' && 'initiated a voice call.'}
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

                {!notif.read && (
                  <span className="w-2 h-2 rounded-full bg-[#8FA89B] shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
