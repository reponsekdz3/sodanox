import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Music,
  CheckCircle2,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { Reel, User } from '../../types';

interface ReelsFeedProps {
  reels: Reel[];
  currentUser: User;
  onLikeReel: (reelId: string) => void;
  onBookmarkReel: (reelId: string) => void;
  onAddReelComment: (reelId: string, text: string) => void;
  onOpenUserProfile: (user: User) => void;
  onToggleFollowUser: (userId: string) => void;
  onOpenCreateReel?: () => void;
}

export const ReelsFeed: React.FC<ReelsFeedProps> = ({
  reels,
  currentUser,
  onLikeReel,
  onBookmarkReel,
  onAddReelComment,
  onOpenUserProfile,
  onToggleFollowUser,
  onOpenCreateReel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [activeCommentsReel, setActiveCommentsReel] = useState<Reel | null>(null);
  const [commentText, setCommentText] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const currentReel = reels[currentIndex];

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [currentIndex, isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleDoubleTap = () => {
    if (!currentReel) return;
    if (!currentReel.hasLiked) {
      onLikeReel(currentReel.id);
    }
    setShowHeartBurst(true);
    setTimeout(() => setShowHeartBurst(false), 900);
  };

  const handleNextReel = () => {
    if (currentIndex < reels.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevReel = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeCommentsReel) return;
    onAddReelComment(activeCommentsReel.id, commentText.trim());
    setCommentText('');
  };

  if (!currentReel) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[#7A8A82] text-sm">No reels currently available.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto py-2 sm:py-6 px-2 sm:px-4 flex flex-col items-center">
      {/* Reel Card Container */}
      <div className="relative w-full aspect-[9/16] max-h-[82vh] rounded-3xl overflow-hidden bg-black shadow-soft-float flex items-center justify-center select-none">
        {/* Video Element with Fallback Poster */}
        <video
          ref={videoRef}
          src={currentReel.videoUrl}
          poster={currentReel.posterUrl}
          muted={isMuted}
          loop
          playsInline
          autoPlay
          onClick={togglePlay}
          onDoubleClick={handleDoubleTap}
          className="w-full h-full object-cover cursor-pointer"
        />

        {/* Play/Pause center overlay when paused */}
        {!isPlaying && (
          <div
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-auto cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white">
              <Play size={32} className="ml-1 fill-white" />
            </div>
          </div>
        )}

        {/* Double-tap floating heart */}
        {showHeartBurst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-ping">
            <Heart size={90} className="text-red-500 fill-red-500 drop-shadow-xl" />
          </div>
        )}

        {/* Scrim Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/85 pointer-events-none" />

        {/* Top Controls: Sound toggle, Create Reel & Pagination count */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/80 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full">
              Reel {currentIndex + 1} of {reels.length}
            </span>
            {onOpenCreateReel && (
              <button
                onClick={onOpenCreateReel}
                className="px-3 py-1 rounded-full bg-[#8FA89B] text-white text-xs font-medium backdrop-blur-md hover:bg-[#7e9689] transition-all shadow-soft flex items-center gap-1.5"
              >
                <span>+ Create Reel</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setIsMuted((prev) => !prev)}
            className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        {/* Right Vertical Action Rail */}
        <div className="absolute bottom-6 right-3 sm:right-4 z-20 flex flex-col items-center gap-4 text-white">
          {/* Like */}
          <button
            onClick={() => onLikeReel(currentReel.id)}
            className="flex flex-col items-center gap-1 group"
          >
            <div
              className={`p-3 rounded-full backdrop-blur-md transition-all ${
                currentReel.hasLiked
                  ? 'bg-red-500/80 text-white scale-110'
                  : 'bg-black/40 hover:bg-black/60 text-white'
              }`}
            >
              <Heart
                size={22}
                className={currentReel.hasLiked ? 'fill-white' : ''}
              />
            </div>
            <span className="text-[11px] font-medium tabular-nums drop-shadow">
              {currentReel.likesCount}
            </span>
          </button>

          {/* Comments */}
          <button
            onClick={() => setActiveCommentsReel(currentReel)}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all">
              <MessageCircle size={22} />
            </div>
            <span className="text-[11px] font-medium tabular-nums drop-shadow">
              {currentReel.commentsCount}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md transition-all">
              {copiedShare ? (
                <Check size={22} className="text-[#8FA89B]" />
              ) : (
                <Share2 size={22} />
              )}
            </div>
            <span className="text-[11px] font-medium tabular-nums drop-shadow">
              {copiedShare ? 'Copied' : currentReel.sharesCount}
            </span>
          </button>

          {/* Bookmark */}
          <button
            onClick={() => onBookmarkReel(currentReel.id)}
            className="flex flex-col items-center gap-1 group"
          >
            <div
              className={`p-3 rounded-full backdrop-blur-md transition-all ${
                currentReel.isSaved
                  ? 'bg-[#8FA89B] text-white'
                  : 'bg-black/40 hover:bg-black/60 text-white'
              }`}
            >
              <Bookmark
                size={22}
                className={currentReel.isSaved ? 'fill-white' : ''}
              />
            </div>
            <span className="text-[11px] font-medium drop-shadow">
              {currentReel.isSaved ? 'Saved' : 'Save'}
            </span>
          </button>

          {/* Spinning Audio Disk */}
          <div className="relative mt-2">
            <div className="w-10 h-10 rounded-full border-2 border-white/40 overflow-hidden animate-spin-slow bg-neutral-900 flex items-center justify-center shadow-lg">
              <img
                src={currentReel.posterUrl}
                alt="Audio art"
                className="w-full h-full object-cover rounded-full opacity-80"
              />
            </div>
          </div>
        </div>

        {/* Bottom Left Reel Information */}
        <div className="absolute bottom-6 left-4 right-20 z-20 text-white space-y-2.5">
          {/* Author info & Follow button */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => onOpenUserProfile(currentReel.author)}
            >
              <img
                src={currentReel.author.avatar}
                alt={currentReel.author.name}
                className="w-9 h-9 rounded-full object-cover border border-white/40"
              />
              <span className="text-sm font-medium drop-shadow-sm group-hover:underline">
                @{currentReel.author.username}
              </span>
              {currentReel.author.verified && (
                <CheckCircle2 size={13} className="text-[#8FA89B] fill-white" />
              )}
            </div>

            {currentReel.author.id !== currentUser.id && (
              <button
                onClick={() => onToggleFollowUser(currentReel.author.id)}
                className={`px-3 py-1 rounded-xl text-xs font-medium backdrop-blur-md transition-all ${
                  currentReel.author.isFollowing
                    ? 'bg-white/20 text-white hover:bg-white/30'
                    : 'bg-[#8FA89B] text-white hover:bg-[#7e9689]'
                }`}
              >
                {currentReel.author.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Caption */}
          <p className="text-xs sm:text-sm text-white/90 line-clamp-2 leading-relaxed drop-shadow-sm">
            {currentReel.caption}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
            {currentReel.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>

          {/* Audio track info */}
          <div className="flex items-center gap-2 text-xs text-white/80 bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-full w-fit max-w-[85%] truncate">
            <Music size={13} className="shrink-0 animate-pulse text-[#8FA89B]" />
            <span className="truncate">
              {currentReel.audioTrack.title} · {currentReel.audioTrack.artist}
            </span>
          </div>
        </div>

        {/* Up / Down navigation buttons */}
        <div className="hidden sm:flex flex-col gap-2 absolute -right-14 top-1/2 -translate-y-1/2 z-20">
          <button
            onClick={handlePrevReel}
            disabled={currentIndex === 0}
            className="p-2.5 rounded-full bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732] disabled:opacity-30 transition-all shadow-soft"
            title="Previous reel"
          >
            <ChevronUp size={20} />
          </button>
          <button
            onClick={handleNextReel}
            disabled={currentIndex === reels.length - 1}
            className="p-2.5 rounded-full bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732] disabled:opacity-30 transition-all shadow-soft"
            title="Next reel"
          >
            <ChevronDown size={20} />
          </button>
        </div>
      </div>

      {/* Reel Comments Drawer */}
      {activeCommentsReel && (
        <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-[#FAFAF9] rounded-t-3xl sm:rounded-3xl shadow-soft-float overflow-hidden flex flex-col max-h-[75vh] border border-[#F1F5F2]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F2]">
              <h3 className="text-sm font-semibold text-[#2D3732]">
                Comments ({activeCommentsReel.commentsCount})
              </h3>
              <button
                onClick={() => setActiveCommentsReel(null)}
                className="p-1 rounded-full text-[#7A8A82] hover:text-[#2D3732]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeCommentsReel.comments.length === 0 ? (
                <p className="text-xs text-[#7A8A82] text-center py-6">
                  No comments yet. Share your thoughts!
                </p>
              ) : (
                activeCommentsReel.comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <img
                      src={c.author.avatar}
                      alt={c.author.name}
                      onClick={() => {
                        setActiveCommentsReel(null);
                        onOpenUserProfile(c.author);
                      }}
                      className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 cursor-pointer hover:ring-2 hover:ring-[#8FA89B] transition-all"
                      title={`View ${c.author.name}'s profile`}
                    />
                    <div className="flex-1 min-w-0 bg-[#F1F5F2] p-2.5 rounded-2xl">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          onClick={() => {
                            setActiveCommentsReel(null);
                            onOpenUserProfile(c.author);
                          }}
                          className="text-xs font-medium text-[#2D3732] cursor-pointer hover:underline"
                        >
                          {c.author.name}
                        </span>
                        <span className="text-[10px] text-[#7A8A82]">
                          {c.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-[#2D3732]">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={handleCommentSubmit}
              className="p-3 border-t border-[#F1F5F2] flex items-center gap-2 bg-[#FAFAF9]"
            >
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-[#F1F5F2] rounded-2xl px-3.5 py-2 text-xs text-[#2D3732] placeholder-[#7A8A82] focus:outline-none focus:bg-white border border-transparent focus:border-[#8FA89B]"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="p-2 rounded-2xl bg-[#8FA89B] text-white hover:bg-[#7e9689] disabled:opacity-40 shrink-0"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
