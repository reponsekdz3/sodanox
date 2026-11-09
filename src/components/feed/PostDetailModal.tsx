import React, { useEffect, useState } from 'react';
import { X, ArrowLeft, Loader2 } from 'lucide-react';
import { Post, User, SharedPostMeta } from '../../types';
import { PostCard } from './PostCard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from '../common/ModernAvatar';

interface PostDetailModalProps {
  postId: string;
  initialPost?: Post | null;
  currentUser: User;
  suggestedUsers?: User[];
  onClose: () => void;
  onLikePost: (postId: string) => void;
  onBookmarkPost: (postId: string) => void;
  onRepostPost: (postId: string, quoteComment?: string) => void;
  onIncrementShare?: (postId: string) => void;
  onSendToChat?: (recipientId: string, messageText: string, sharedPost?: SharedPostMeta) => void;
  onAddComment: (postId: string, text: string, replyToCommentId?: string) => void;
  onLikeComment: (postId: string, commentId: string) => void;
  onDeleteComment?: (postId: string, commentId: string, replyId?: string) => void;
  onVotePoll: (postId: string, optionId: string) => void;
  onDeletePost?: (postId: string) => void;
  onEditPost?: (postId: string, newContent: string) => void;
  onOpenUserProfile?: (user: User) => void;
  onToggleFollowUser?: (userId: string) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  postId,
  initialPost,
  currentUser,
  suggestedUsers,
  onClose,
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
  const [post, setPost] = useState<Post | null>(initialPost || null);
  const [loading, setLoading] = useState<boolean>(!initialPost);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialPost) {
      setPost(initialPost);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchPost = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, 'posts', postId);
        const snap = await getDoc(docRef);
        if (snap.exists() && isMounted) {
          const d = snap.data();
          const avatar = isMockOrEmptyAvatar(d.author?.avatar)
            ? MODERN_EMPTY_AVATAR_DATA_URI
            : d.author?.avatar;
          const fetched: Post = {
            id: snap.id,
            author: { ...d.author, avatar },
            timestamp: d.timestamp || 'Recent',
            content: d.content || '',
            mediaUrl: d.mediaUrl,
            mediaUrls: d.mediaUrls || (d.mediaUrl ? [d.mediaUrl] : []),
            mediaType: d.mediaType,
            location: d.location,
            audience: d.audience || 'public',
            commentsDisabled: d.commentsDisabled || false,
            likesCount: d.likesCount || 0,
            hasLiked: d.likedBy?.includes(currentUser.id) || false,
            likedBy: d.likedBy || [],
            bookmarksCount: d.bookmarksCount || 0,
            isBookmarked: d.bookmarkedBy?.includes(currentUser.id) || false,
            repostsCount: d.repostsCount || 0,
            hasReposted: d.repostedBy?.includes(currentUser.id) || false,
            repostedBy: d.repostedBy || [],
            viewsCount: d.viewsCount || 0,
            viewedBy: d.viewedBy || [],
            sharedBy: d.sharedBy || [],
            commentsCount: d.commentsCount || (d.comments?.length || 0),
            comments: d.comments || [],
            tags: d.tags || [],
            poll: d.poll,
            sharesCount: d.sharesCount || 0,
            fontStyle: d.fontStyle,
            filter: d.filter,
            createdAt: d.createdAt,
          };
          setPost(fetched);
        } else if (isMounted) {
          setNotFound(true);
        }
      } catch (err) {
        console.warn('Could not fetch routed post:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPost();
    return () => {
      isMounted = false;
    };
  }, [postId, initialPost, currentUser.id]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#022C22]/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#F8FAF9] rounded-3xl shadow-2xl border border-[#D1E2D9] overflow-hidden my-auto animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-3.5 bg-white/90 backdrop-blur-md border-b border-[#D1E2D9]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#3D5A4C] hover:text-[#064E3B] hover:bg-[#EDF3F0] transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="text-sm font-bold text-[#064E3B]">Post Reflection</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#3D5A4C] hover:text-[#064E3B] hover:bg-[#EDF3F0] transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-[#059669]" />
              <p className="text-xs font-medium text-[#3D5A4C]">Loading post reflection...</p>
            </div>
          ) : notFound || !post ? (
            <div className="py-16 text-center space-y-3">
              <h4 className="text-base font-serif font-bold text-[#064E3B]">Post Not Found</h4>
              <p className="text-xs text-[#3D5A4C] max-w-xs mx-auto">
                This post may have been removed or the link is expired.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#064E3B] text-white text-xs font-semibold cursor-pointer"
              >
                Return to Feed
              </button>
            </div>
          ) : (
            <PostCard
              post={post}
              currentUser={currentUser}
              suggestedUsers={suggestedUsers}
              onLikePost={onLikePost}
              onBookmarkPost={onBookmarkPost}
              onRepostPost={onRepostPost}
              onIncrementShare={onIncrementShare}
              onSendToChat={onSendToChat}
              onAddComment={onAddComment}
              onLikeComment={onLikeComment}
              onDeleteComment={onDeleteComment}
              onVotePoll={onVotePoll}
              onDeletePost={onDeletePost}
              onEditPost={onEditPost}
              onOpenUserProfile={onOpenUserProfile}
              onToggleFollowUser={onToggleFollowUser}
            />
          )}
        </div>
      </div>
    </div>
  );
};
