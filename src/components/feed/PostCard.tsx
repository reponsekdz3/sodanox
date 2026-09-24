import React, { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  CheckCircle2,
  Send,
  MoreHorizontal,
  Repeat2,
  Trash2,
  Edit2,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  MessageSquareOff,
  Eye,
} from 'lucide-react';
import { Post, User } from '../../types';
import { SharePostModal } from './SharePostModal';
import { QuotePostModal } from './QuotePostModal';
import { PostEngagementModal } from './PostEngagementModal';
import { recordPostView } from '../../services/postService';

const PostMediaCarousel: React.FC<{ mediaUrls: string[] }> = ({ mediaUrls }) => {
  const [curr, setCurr] = useState(0);
  if (!mediaUrls || mediaUrls.length === 0) return null;
  if (mediaUrls.length === 1) {
    return (
      <div className="relative rounded-2xl overflow-hidden mb-4 bg-neutral-100 max-h-[520px]">
        <img
          src={mediaUrls[0]}
          alt="Post media"
          className="w-full h-auto max-h-[520px] object-cover"
        />
      </div>
    );
  }
  return (
    <div className="relative rounded-2xl overflow-hidden mb-4 bg-black group select-none">
      <img
        src={mediaUrls[curr]}
        alt={`Post media ${curr + 1}`}
        className="w-full h-auto max-h-[520px] object-cover"
      />
      {curr > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurr((c) => c - 1);
          }}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-md transition-opacity"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {curr < mediaUrls.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurr((c) => c + 1);
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white shadow-md transition-opacity"
        >
          <ChevronRight size={18} />
        </button>
      )}
      <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5 z-10 pointer-events-none">
        {mediaUrls.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === curr ? 'bg-white scale-125' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

interface PostCardProps {
  post: Post;
  currentUser: User;
  suggestedUsers?: User[];
  onLikePost: (postId: string) => void;
  onBookmarkPost: (postId: string) => void;
  onRepostPost: (postId: string, quoteComment?: string) => void;
  onIncrementShare?: (postId: string) => void;
  onSendToChat?: (recipientId: string, messageText: string) => void;
  onAddComment: (postId: string, text: string, replyToCommentId?: string) => void;
  onLikeComment: (postId: string, commentId: string) => void;
  onDeleteComment?: (postId: string, commentId: string, replyId?: string) => void;
  onVotePoll?: (postId: string, optionId: string) => void;
  onDeletePost?: (postId: string) => void;
  onEditPost?: (postId: string, newContent: string) => void;
  onOpenUserProfile?: (user: User) => void;
  onToggleFollowUser?: (userId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  suggestedUsers = [],
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
  onOpenUserProfile,
  onToggleFollowUser,
}) => {
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);
  const [isLikingAnimation, setIsLikingAnimation] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [isEngagementModalOpen, setIsEngagementModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  // Automatically record impressions/views in Firestore
  useEffect(() => {
    if (currentUser?.id && post?.id) {
      recordPostView(post.id, currentUser.id);
    }
  }, [post.id, currentUser?.id]);

  const isAuthor = post.author.id === currentUser.id;

  const handleLike = () => {
    setIsLikingAnimation(true);
    onLikePost(post.id);
    setTimeout(() => setIsLikingAnimation(false), 500);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    onAddComment(post.id, newCommentText.trim(), replyingTo?.id);
    setNewCommentText('');
    setReplyingTo(null);
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    onEditPost?.(post.id, editContent.trim());
    setIsEditing(false);
  };

  return (
    <article className="w-full bg-[#FAFAF9] sm:bg-[#F1F5F2] sm:border border-[#F1F5F2] rounded-3xl p-4 sm:p-6 mb-6 shadow-soft transition-all relative">
      {/* Repost Header notification if this is a reposted item */}
      {post.repostAuthor && (
        <div className="flex items-center gap-2 mb-3 text-xs text-[#7A8A82] font-medium pb-2 border-b border-[#E6EDE9]/60">
          <Repeat2 size={14} className="text-[#8FA89B]" />
          <span>Reposted by @{post.repostAuthor.username}</span>
        </div>
      )}

      {/* Author Header */}
      <div className="flex items-center justify-between mb-4">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onOpenUserProfile?.(post.author)}
        >
          <div className="relative">
            <img
              src={post.author.avatar}
              alt={post.author.name}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-full object-cover ring-2 ring-[#E6EDE9] group-hover:ring-[#8FA89B] transition-all"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[#2D3732] group-hover:underline">
                {post.author.name}
              </span>
              {post.author.verified && (
                <CheckCircle2 size={14} className="text-[#8FA89B] fill-[#E6EDE9]" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-[#7A8A82]">
              <span>@{post.author.username}</span>
              <span aria-hidden="true">·</span>
              <span>{post.timestamp}</span>
              {post.location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-[#8FA89B]">
                    <MapPin size={11} />
                    <span>{post.location}</span>
                  </span>
                </>
              )}
              {post.audience === 'followers' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex items-center gap-1 text-xs text-[#7A8A82] bg-[#E6EDE9] px-2 py-0.5 rounded-full">
                    <Users size={10} />
                    <span>Followers only</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* More actions menu */}
        <div className="relative">
          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            className="p-2 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9]/60 transition-colors"
            title="Options"
          >
            <MoreHorizontal size={18} />
          </button>

          {showMoreMenu && (
            <div className="absolute right-0 top-10 w-44 bg-[#FAFAF9] rounded-2xl shadow-soft-float border border-[#E6EDE9] p-1.5 z-30">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  setIsShareModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#2D3732] hover:bg-[#F1F5F2] rounded-xl transition-colors text-left"
              >
                <Share2 size={14} className="text-[#7A8A82]" />
                <span>Share Post</span>
              </button>

              {isAuthor && (
                <>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      setIsEditing(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#2D3732] hover:bg-[#F1F5F2] rounded-xl transition-colors text-left"
                  >
                    <Edit2 size={14} className="text-[#7A8A82]" />
                    <span>Edit Post</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onDeletePost?.(post.id);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left"
                  >
                    <Trash2 size={14} />
                    <span>Delete Post</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text Content or Edit Input */}
      {isEditing ? (
        <div className="mb-4 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="w-full bg-[#FAFAF9] border border-[#8FA89B] rounded-2xl p-3 text-sm text-[#2D3732] focus:outline-none resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 text-xs text-[#7A8A82] hover:text-[#2D3732]"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-3.5 py-1.5 rounded-xl bg-[#8FA89B] text-white text-xs font-medium"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm sm:text-[15px] text-[#2D3732] leading-relaxed mb-4 whitespace-pre-line">
          {post.content}
        </div>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-[#7A8A82]">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-[#8FA89B] hover:text-[#2D3732] cursor-pointer transition-colors"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Interactive Poll */}
      {post.poll && (
        <div className="my-4 p-4 rounded-2xl bg-[#FAFAF9] border border-[#E6EDE9] space-y-3">
          <p className="text-sm font-medium text-[#2D3732]">
            {post.poll.question}
          </p>
          <div className="space-y-2">
            {post.poll.options.map((opt) => {
              const total = post.poll?.totalVotes || 1;
              const percentage = Math.round((opt.votes / total) * 100);
              const isSelected = post.poll?.userVotedId === opt.id;

              return (
                <button
                  key={opt.id}
                  onClick={() => onVotePoll?.(post.id, opt.id)}
                  className={`relative w-full text-left p-3 rounded-xl border text-xs sm:text-sm font-medium overflow-hidden transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-[#8FA89B] text-[#2D3732] bg-[#E6EDE9]/30'
                      : 'border-[#F1F5F2] hover:border-[#8FA89B]/50 text-[#2D3732] bg-[#F1F5F2]/50'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-[#E6EDE9] transition-all duration-500 ease-out"
                    style={{ width: `${percentage}%`, opacity: 0.7 }}
                  />
                  <span className="relative z-10 truncate pr-2 flex items-center gap-2">
                    {opt.text}
                    {isSelected && (
                      <span className="text-[10px] text-[#8FA89B] font-semibold">
                        (Your vote)
                      </span>
                    )}
                  </span>
                  <span className="relative z-10 shrink-0 tabular-nums text-xs text-[#7A8A82]">
                    {percentage}%
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-[#7A8A82]">
            {post.poll.totalVotes} total votes
          </div>
        </div>
      )}

      {/* Quoted Post Attachment */}
      {post.quotedPost && (
        <div className="my-4 p-4 rounded-2xl bg-[#FAFAF9] border border-[#E6EDE9] space-y-2">
          <div
            className="flex items-center gap-2 cursor-pointer group w-fit"
            onClick={(e) => {
              e.stopPropagation();
              onOpenUserProfile?.(post.quotedPost!.author);
            }}
          >
            <img
              src={post.quotedPost.author.avatar}
              alt={post.quotedPost.author.name}
              className="w-6 h-6 rounded-full object-cover group-hover:ring-2 group-hover:ring-[#8FA89B] transition-all"
            />
            <span className="text-xs font-semibold text-[#2D3732] group-hover:underline">
              {post.quotedPost.author.name}
            </span>
            <span className="text-[11px] text-[#7A8A82]">
              @{post.quotedPost.author.username}
            </span>
          </div>
          <p className="text-xs text-[#2D3732] leading-relaxed line-clamp-3">
            {post.quotedPost.content}
          </p>
          {post.quotedPost.mediaUrl && (
            <div className="rounded-xl overflow-hidden max-h-48 bg-neutral-100 mt-2">
              <img
                src={post.quotedPost.mediaUrl}
                alt="Quoted attachment"
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}

      {/* Post Image Media */}
      {post.mediaUrls && post.mediaUrls.length > 0 ? (
        <PostMediaCarousel mediaUrls={post.mediaUrls} />
      ) : post.mediaUrl ? (
        <div className="relative rounded-2xl overflow-hidden mb-4 bg-neutral-100 max-h-[500px]">
          <img
            src={post.mediaUrl}
            alt="Post attachment"
            referrerPolicy="no-referrer"
            className="w-full h-auto max-h-[500px] object-cover"
          />
        </div>
      ) : null}

      {/* Action Bar: Like, Repost, Comment, Share, Bookmark */}
      <div className="flex items-center justify-between pt-2 border-t border-[#F1F5F2] text-[#7A8A82]">
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl transition-all ${
              post.hasLiked
                ? 'text-[#8FA89B] bg-[#E6EDE9]'
                : 'hover:text-[#2D3732] hover:bg-[#E6EDE9]/50'
            }`}
            title="Like"
          >
            <Heart
              size={18}
              className={`transition-transform duration-200 ${
                post.hasLiked ? 'fill-[#8FA89B]' : ''
              } ${isLikingAnimation ? 'scale-125' : ''}`}
            />
            <span className="text-xs font-medium tabular-nums">
              {post.likesCount}
            </span>
          </button>

          {/* Repost & Quote */}
          <div className="relative">
            <button
              onClick={() => setShowRepostMenu((prev) => !prev)}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl transition-all ${
                post.hasReposted
                  ? 'text-teal-700 bg-teal-50'
                  : 'hover:text-[#2D3732] hover:bg-[#E6EDE9]/50'
              }`}
              title="Repost or Quote"
            >
              <Repeat2
                size={18}
                className={post.hasReposted ? 'text-[#8FA89B]' : ''}
              />
              <span className="text-xs font-medium tabular-nums">
                {post.repostsCount || 0}
              </span>
            </button>

            {showRepostMenu && (
              <div className="absolute left-0 bottom-10 w-40 bg-[#FAFAF9] rounded-2xl shadow-soft-float border border-[#E6EDE9] p-1.5 z-30">
                <button
                  onClick={() => {
                    setShowRepostMenu(false);
                    onRepostPost(post.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#2D3732] hover:bg-[#F1F5F2] rounded-xl transition-colors text-left"
                >
                  <Repeat2 size={14} className="text-[#8FA89B]" />
                  <span>{post.hasReposted ? 'Undo Repost' : 'Repost'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowRepostMenu(false);
                    setIsQuoteModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#2D3732] hover:bg-[#F1F5F2] rounded-xl transition-colors text-left"
                >
                  <Edit2 size={14} className="text-[#8FA89B]" />
                  <span>Quote Post</span>
                </button>
              </div>
            )}
          </div>

          {/* Comments toggle */}
          {post.commentsDisabled ? (
            <div
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl text-neutral-400 cursor-not-allowed opacity-60"
              title="Author turned off commenting"
            >
              <MessageSquareOff size={16} />
              <span className="text-xs font-medium">Off</span>
            </div>
          ) : (
            <button
              onClick={() => setShowComments((prev) => !prev)}
              className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl hover:text-[#2D3732] hover:bg-[#E6EDE9]/50 transition-colors"
              title="Comments"
            >
              <MessageCircle size={18} />
              <span className="text-xs font-medium tabular-nums">
                {post.commentsCount}
              </span>
            </button>
          )}

          {/* Share */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl hover:text-[#2D3732] hover:bg-[#E6EDE9]/50 transition-colors"
            title="Share"
          >
            <Share2 size={18} />
            <span className="text-xs font-medium tabular-nums">
              {post.sharesCount}
            </span>
          </button>

          {/* Views / Impressions with Live Engagement Modal */}
          <button
            type="button"
            onClick={() => setIsEngagementModalOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl hover:text-[#2D3732] hover:bg-[#E6EDE9]/50 transition-colors group/view"
            title="Views & Impressions · Click for Engagement Details"
          >
            <Eye size={17} className="group-hover/view:text-[#5E7C6E] transition-colors" />
            <span className="text-xs font-medium tabular-nums">
              {(post.viewsCount ?? 0).toLocaleString()}
            </span>
          </button>
        </div>

        {/* Bookmark */}
        <button
          onClick={() => onBookmarkPost(post.id)}
          className={`p-2 rounded-xl transition-colors ${
            post.isBookmarked
              ? 'text-[#8FA89B] bg-[#E6EDE9]'
              : 'hover:text-[#2D3732] hover:bg-[#E6EDE9]/50'
          }`}
          title={post.isBookmarked ? 'Saved' : 'Save post'}
        >
          <Bookmark
            size={18}
            className={post.isBookmarked ? 'fill-[#8FA89B]' : ''}
          />
        </button>
      </div>

      {/* Nested Comments Drawer */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-[#F1F5F2] space-y-4">
          {/* Add Comment input */}
          <form onSubmit={handleCommentSubmit} className="space-y-2">
            {replyingTo && (
              <div className="flex items-center justify-between text-xs text-[#7A8A82] bg-[#E6EDE9]/50 px-3 py-1.5 rounded-xl">
                <span>
                  Replying to <span className="font-medium text-[#2D3732]">@{replyingTo.authorName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="hover:text-[#2D3732]"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                onClick={() => onOpenUserProfile?.(currentUser)}
                className="w-8 h-8 rounded-full object-cover shrink-0 cursor-pointer hover:ring-2 hover:ring-[#8FA89B] transition-all"
                title="View your profile"
              />
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={
                  replyingTo
                    ? `Reply to ${replyingTo.authorName}...`
                    : 'Write a mindful comment...'
                }
                className="flex-1 bg-[#FAFAF9] border border-[#E6EDE9] focus:border-[#8FA89B] rounded-2xl px-3.5 py-2 text-xs sm:text-sm text-[#2D3732] placeholder-[#7A8A82] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="p-2 rounded-xl bg-[#8FA89B] text-white hover:bg-[#7e9689] disabled:opacity-40 transition-colors shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </form>

          {/* List of comments */}
          <div className="space-y-3">
            {post.comments.length === 0 ? (
              <p className="text-xs text-[#7A8A82] py-2 text-center">
                No comments yet. Start the conversation.
              </p>
            ) : (
              post.comments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className="flex items-start gap-2.5 bg-[#FAFAF9] p-3 rounded-2xl border border-[#E6EDE9]/50">
                    <img
                      src={comment.author.avatar}
                      alt={comment.author.name}
                      onClick={() => onOpenUserProfile?.(comment.author)}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-[#8FA89B] transition-all"
                      title={`View ${comment.author.name}'s profile`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          onClick={() => onOpenUserProfile?.(comment.author)}
                          className="text-xs font-medium text-[#2D3732] cursor-pointer hover:underline"
                        >
                          {comment.author.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-[#7A8A82]">
                            {comment.timestamp}
                          </span>
                          {comment.author.id === currentUser.id && onDeleteComment && (
                            <button
                              type="button"
                              onClick={() => onDeleteComment(post.id, comment.id)}
                              className="text-[#7A8A82] hover:text-red-600 transition-colors p-0.5"
                              title="Delete comment"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-[#2D3732] leading-relaxed break-words">
                        {comment.content}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <button
                          onClick={() => onLikeComment(post.id, comment.id)}
                          className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                            comment.hasLiked
                              ? 'text-[#8FA89B]'
                              : 'text-[#7A8A82] hover:text-[#2D3732]'
                          }`}
                        >
                          <Heart
                            size={12}
                            className={comment.hasLiked ? 'fill-[#8FA89B]' : ''}
                          />
                          <span className="tabular-nums">{comment.likesCount}</span>
                        </button>
                        <button
                          onClick={() =>
                            setReplyingTo({
                              id: comment.id,
                              authorName: comment.author.name,
                            })
                          }
                          className="text-[11px] text-[#7A8A82] hover:text-[#2D3732] font-medium"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Nested replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="pl-6 space-y-2">
                      {comment.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="flex items-start gap-2.5 bg-[#FAFAF9]/80 p-2.5 rounded-2xl border border-[#E6EDE9]/40"
                        >
                          <img
                            src={reply.author.avatar}
                            alt={reply.author.name}
                            onClick={() => onOpenUserProfile?.(reply.author)}
                            className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-[#8FA89B] transition-all"
                            title={`View ${reply.author.name}'s profile`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span
                                onClick={() => onOpenUserProfile?.(reply.author)}
                                className="text-xs font-medium text-[#2D3732] cursor-pointer hover:underline"
                              >
                                {reply.author.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#7A8A82]">
                                  {reply.timestamp}
                                </span>
                                {reply.author.id === currentUser.id && onDeleteComment && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteComment(post.id, comment.id, reply.id)}
                                    className="text-[#7A8A82] hover:text-red-600 transition-colors p-0.5"
                                    title="Delete reply"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-[#2D3732] leading-relaxed break-words">
                              {reply.content}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <button
                                onClick={() => onLikeComment(post.id, reply.id)}
                                className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
                                  reply.hasLiked
                                    ? 'text-[#8FA89B]'
                                    : 'text-[#7A8A82] hover:text-[#2D3732]'
                                }`}
                              >
                                <Heart
                                  size={12}
                                  className={reply.hasLiked ? 'fill-[#8FA89B]' : ''}
                                />
                                <span className="tabular-nums">{reply.likesCount}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setReplyingTo({
                                    id: comment.id,
                                    authorName: reply.author.name,
                                  });
                                  setNewCommentText(`@${reply.author.username} `);
                                }}
                                className="text-[11px] text-[#7A8A82] hover:text-[#2D3732] font-medium"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Share Post Modal */}
      {isShareModalOpen && (
        <SharePostModal
          post={post}
          users={suggestedUsers}
          currentUser={currentUser}
          onClose={() => setIsShareModalOpen(false)}
          onSendToChat={(recipientId, text) => {
            onSendToChat?.(recipientId, text);
          }}
          onIncrementShare={() => onIncrementShare?.(post.id)}
        />
      )}

      {/* Quote Post Modal */}
      {isQuoteModalOpen && (
        <QuotePostModal
          post={post}
          currentUser={currentUser}
          onClose={() => setIsQuoteModalOpen(false)}
          onSubmitQuote={(quoteComment) => onRepostPost(post.id, quoteComment)}
        />
      )}

      {/* Post Engagement Modal (Views, Likes, Reach) */}
      {isEngagementModalOpen && (
        <PostEngagementModal
          post={post}
          currentUser={currentUser}
          onClose={() => setIsEngagementModalOpen(false)}
          onOpenUserProfile={onOpenUserProfile}
          onToggleFollowUser={onToggleFollowUser}
        />
      )}
    </article>
  );
};
