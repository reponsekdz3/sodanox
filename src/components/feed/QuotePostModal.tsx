import React, { useState } from 'react';
import { X, Repeat2, Send } from 'lucide-react';
import { Post, User } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';

interface QuotePostModalProps {
  post: Post;
  currentUser: User;
  onClose: () => void;
  onSubmitQuote: (quoteComment: string) => void;
}

export const QuotePostModal: React.FC<QuotePostModalProps> = ({
  post,
  currentUser,
  onClose,
  onSubmitQuote,
}) => {
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    onSubmitQuote(comment.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#FAFAF9] rounded-3xl shadow-soft-float overflow-hidden border border-[#F1F5F2] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F2]">
          <div className="flex items-center gap-2">
            <Repeat2 size={18} className="text-[#8FA89B]" />
            <h3 className="text-sm font-semibold text-[#2D3732]">Quote Post</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* User's input thoughts */}
          <div className="flex items-start gap-3">
            <ModernAvatar
              src={currentUser.avatar}
              alt={currentUser.name}
              size="md"
              className="shrink-0"
            />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add your thoughts or reflections..."
              rows={3}
              maxLength={280}
              className="flex-1 bg-transparent text-sm text-[#2D3732] placeholder-[#7A8A82] focus:outline-none resize-none"
              autoFocus
            />
          </div>

          {/* Embedded original post card preview */}
          <div className="p-3.5 rounded-2xl bg-[#F1F5F2]/70 border border-[#E6EDE9] space-y-2">
            <div className="flex items-center gap-2">
              <ModernAvatar
                src={post.author.avatar}
                alt={post.author.name}
                size="xs"
              />
              <span className="text-xs font-semibold text-[#2D3732]">{post.author.name}</span>
              <span className="text-[11px] text-[#7A8A82]">@{post.author.username}</span>
            </div>
            <p className="text-xs text-[#2D3732] line-clamp-3 leading-relaxed">{post.content}</p>
            {post.mediaUrl && (
              <div className="h-28 rounded-xl overflow-hidden bg-neutral-100">
                <img
                  src={post.mediaUrl}
                  alt="Attachment"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[#7A8A82]">
              {280 - comment.length} characters remaining
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#7A8A82] hover:text-[#2D3732] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!comment.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs font-medium transition-all disabled:opacity-40 shadow-soft"
              >
                <Send size={13} />
                <span>Publish Quote</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
