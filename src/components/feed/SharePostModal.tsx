import React, { useState } from 'react';
import { X, Send, Copy, Check, Share2, MessageSquare } from 'lucide-react';
import { Post, User } from '../../types';

interface SharePostModalProps {
  post: Post;
  users: User[];
  currentUser: User;
  onClose: () => void;
  onSendToChat: (recipientId: string, messageText: string) => void;
  onIncrementShare: () => void;
}

export const SharePostModal: React.FC<SharePostModalProps> = ({
  post,
  users,
  currentUser,
  onClose,
  onSendToChat,
  onIncrementShare,
}) => {
  const [copied, setCopied] = useState(false);
  const [sentUserIds, setSentUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = users.filter(
    (u) =>
      u.id !== currentUser.id &&
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}#post-${post.id}`;
    navigator.clipboard?.writeText(postUrl);
    setCopied(true);
    onIncrementShare();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.author.name} on Aura`,
          text: post.content.slice(0, 100),
          url: `${window.location.origin}#post-${post.id}`,
        });
        onIncrementShare();
      } catch {
        // Ignored if user dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSendDirect = (targetUser: User) => {
    const shareMessage = `Shared post from @${post.author.username}:\n"${post.content.slice(0, 120)}..."`;
    onSendToChat(targetUser.id, shareMessage);
    setSentUserIds((prev) => [...prev, targetUser.id]);
    onIncrementShare();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#FAFAF9] rounded-3xl shadow-soft-float overflow-hidden border border-[#F1F5F2] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F2]">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-[#8FA89B]" />
            <h3 className="text-sm font-semibold text-[#2D3732]">Share Post</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Post Quick Preview */}
        <div className="p-4 mx-4 mt-4 bg-[#F1F5F2]/70 rounded-2xl border border-[#E6EDE9]/60 flex items-start gap-3">
          <img
            src={post.author.avatar}
            alt={post.author.name}
            className="w-9 h-9 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#2D3732]">{post.author.name}</p>
            <p className="text-xs text-[#7A8A82] line-clamp-2 mt-0.5">{post.content}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-[#F1F5F2]">
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732] text-xs font-medium transition-all"
          >
            {copied ? (
              <>
                <Check size={16} className="text-[#8FA89B]" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} className="text-[#7A8A82]" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs font-medium transition-all shadow-soft"
          >
            <Share2 size={16} />
            <span>Share via...</span>
          </button>
        </div>

        {/* Send via Direct Message */}
        <div className="p-4 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={15} className="text-[#7A8A82]" />
            <h4 className="text-xs font-medium text-[#7A8A82] uppercase tracking-wider">
              Send in Direct Message
            </h4>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connections..."
            className="w-full bg-[#F1F5F2] rounded-2xl px-3.5 py-2 text-xs text-[#2D3732] placeholder-[#7A8A82] mb-3 focus:outline-none focus:bg-white border border-transparent focus:border-[#8FA89B]"
          />

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-[#7A8A82] text-center py-4">No creators found.</p>
            ) : (
              filteredUsers.map((user) => {
                const isSent = sentUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#F1F5F2]/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#2D3732] truncate">{user.name}</p>
                        <p className="text-[11px] text-[#7A8A82] truncate">@{user.username}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSendDirect(user)}
                      disabled={isSent}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                        isSent
                          ? 'bg-[#E6EDE9] text-[#8FA89B]'
                          : 'bg-[#8FA89B] text-white hover:bg-[#7e9689]'
                      }`}
                    >
                      {isSent ? (
                        <>
                          <Check size={13} />
                          <span>Sent</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
