import React, { useEffect, useState } from 'react';
import { X, Bell, MessageSquare, Phone, Heart, Users, Sparkles } from 'lucide-react';
import { InAppToast, subscribeToInAppToasts, dismissInAppToast } from '../../services/browserNotificationService';
import { ModernAvatar } from './ModernAvatar';
import { auraAudio } from '../../utils/audioSynthesizer';

export const InAppNotificationToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<InAppToast[]>([]);

  useEffect(() => {
    return subscribeToInAppToasts((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <aside aria-label="Notifications" className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </aside>
  );
};

const ToastItem: React.FC<{ toast: InAppToast }> = ({ toast }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'message':
        return <MessageSquare size={14} className="text-[#4A6757]" />;
      case 'call':
        return <Phone size={14} className="text-emerald-700 animate-bounce" />;
      case 'like':
        return <Heart size={14} className="text-rose-500 fill-rose-500" />;
      case 'follow':
        return <Users size={14} className="text-[#4A6757]" />;
      default:
        return <Bell size={14} className="text-[#4A6757]" />;
    }
  };

  const handleAction = () => {
    auraAudio.playClick(600, 0.04);
    if (toast.onAction) {
      toast.onAction();
    }
    dismissInAppToast(toast.id);
  };

  return (
    <div
      className="pointer-events-auto bg-white/95 backdrop-blur-md border border-[#8FA89B]/40 rounded-2xl p-3.5 shadow-soft-float transition-all animate-slideDown hover:border-[#4A6757] flex items-start gap-3 relative overflow-hidden group"
      role="alert"
    >
      {/* Sender Avatar or Icon */}
      {toast.avatar ? (
        <ModernAvatar
          src={toast.avatar}
          alt={toast.title}
          size="sm"
          className="shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[#EBF1ED] flex items-center justify-center shrink-0 mt-0.5">
          {getIcon()}
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className="text-xs font-bold text-[#1E2A23] truncate">{toast.title}</p>
          <span className="text-[10px] text-[#7A8A82] shrink-0">Just now</span>
        </div>
        <p className="text-xs text-[#55635C] leading-snug line-clamp-2">{toast.body}</p>

        {/* Action Button */}
        {toast.actionLabel && (
          <button
            onClick={handleAction}
            className="mt-2 text-[11px] font-bold text-[#2F4438] bg-[#EBF1ED] hover:bg-[#DEE7E1] px-2.5 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
          >
            <span>{toast.actionLabel}</span>
            <Sparkles size={11} />
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => dismissInAppToast(toast.id)}
        className="p-1 rounded-lg text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors cursor-pointer shrink-0"
        title="Dismiss notification"
      >
        <X size={14} />
      </button>

      {/* Ambient bottom progress line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8FA89B]/20">
        <div className="h-full bg-[#4A6757] animate-pulse" />
      </div>
    </div>
  );
};
