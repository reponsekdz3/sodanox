import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Send,
  Pause,
  Play,
  Trash2,
  Tag,
  Eye,
  Bookmark,
  Music,
  MapPin,
  CheckCircle2,
  BarChart2,
  MessageCircle,
  Heart,
  Share2,
  Copy,
} from 'lucide-react';
import { Story, StoryItem, User, StoryFilter, StorySticker } from '../../types';
import { voteStoryPoll, answerStoryQuestion, createStoryHighlight } from '../../services/storyService';
import { getUserProfile } from '../../services/userService';
import { auraAudio } from '../../utils/audioSynthesizer';

interface StoryViewerModalProps {
  stories: Story[];
  initialStoryIndex: number;
  currentUser: User;
  onClose: () => void;
  onSendStoryReply: (userId: string, replyText: string) => void;
  onRecordStoryView?: (storyId: string) => void;
  onLikeStory?: (storyId: string, itemIndex: number) => void;
  onDeleteStory?: (storyId: string) => void;
  onOpenUserProfile?: (user: User) => void;
}

const EMOJI_REACTIONS = ['❤️', '🔥', '✨', '👏', '🌿', '☕'];

const FILTER_CLASSES: Record<StoryFilter, string> = {
  none: '',
  vintage: 'sepia-[0.35] contrast-[1.15] brightness-[0.95]',
  nordic: 'saturate-[0.65] contrast-[0.95] brightness-[1.05]',
  noir: 'grayscale contrast-[1.25]',
  golden: 'sepia-[0.3] saturate-[1.4] brightness-[1.05]',
  sepia: 'sepia-[0.7] contrast-[0.9]',
  emerald: 'hue-rotate-[25deg] saturate-[1.2]',
};

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  initialStoryIndex,
  currentUser,
  onClose,
  onSendStoryReply,
  onRecordStoryView,
  onLikeStory,
  onDeleteStory,
  onOpenUserProfile,
}) => {
  const [currentStoryIdx, setCurrentStoryIdx] = useState(initialStoryIndex);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [burstEmoji, setBurstEmoji] = useState('❤️');
  const [replySentNotice, setReplySentNotice] = useState(false);
  const [shareNotice, setShareNotice] = useState(false);
  const [localLikes, setLocalLikes] = useState<Record<string, boolean>>({});

  // Viewers list modal state (for story owner)
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [viewersProfiles, setViewersProfiles] = useState<User[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Question answer input state
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [questionAnswerText, setQuestionAnswerText] = useState('');

  // Add to Highlight modal
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [highlightTitle, setHighlightTitle] = useState('');
  const [isSavingHighlight, setIsSavingHighlight] = useState(false);
  const [highlightSavedNotice, setHighlightSavedNotice] = useState(false);

  const currentStory = stories[currentStoryIdx];
  const currentItem = currentStory?.items[currentItemIdx];
  const STORY_DURATION = 6000; // 6 seconds

  const currentItemKey = `${currentStory?.id}_${currentItemIdx}`;
  const isItemLiked = Boolean(
    localLikes[currentItemKey] ??
    currentItem?.likedBy?.includes(currentUser.id)
  );

  const handleToggleStoryLike = () => {
    if (!currentStory) return;
    const nextLiked = !isItemLiked;
    setLocalLikes((prev) => ({ ...prev, [currentItemKey]: nextLiked }));
    if (nextLiked) {
      setBurstEmoji('❤️');
      setShowHeartBurst(true);
      auraAudio.playChime();
      setTimeout(() => setShowHeartBurst(false), 900);
    }
    onLikeStory?.(currentStory.id, currentItemIdx);
  };

  const handleShareStory = () => {
    try {
      const shareUrl = `${window.location.origin}/?story=${currentStory?.id}`;
      navigator.clipboard?.writeText(shareUrl);
      setShareNotice(true);
      auraAudio.playClick();
      setTimeout(() => setShareNotice(false), 2500);
    } catch {
      // fallback
    }
  };

  // Record view
  useEffect(() => {
    if (currentStory && currentUser) {
      onRecordStoryView?.(currentStory.id);
    }
  }, [currentStory, currentUser, onRecordStoryView]);

  const nextItem = useCallback(() => {
    if (!currentStory) return;
    if (currentItemIdx < currentStory.items.length - 1) {
      setCurrentItemIdx((prev) => prev + 1);
      setProgress(0);
    } else if (currentStoryIdx < stories.length - 1) {
      setCurrentStoryIdx((prev) => prev + 1);
      setCurrentItemIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentStory, currentItemIdx, currentStoryIdx, stories.length, onClose]);

  const prevItem = useCallback(() => {
    if (currentItemIdx > 0) {
      setCurrentItemIdx((prev) => prev - 1);
      setProgress(0);
    } else if (currentStoryIdx > 0) {
      setCurrentStoryIdx((prev) => prev - 1);
      const prevStory = stories[currentStoryIdx - 1];
      setCurrentItemIdx((prevStory?.items.length || 1) - 1);
      setProgress(0);
    }
  }, [currentItemIdx, currentStoryIdx, stories]);

  // Story Timer
  useEffect(() => {
    if (isPaused || !currentItem || showViewersModal || showHighlightModal) return;

    const intervalTime = 50;
    const increment = (intervalTime / STORY_DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextItem();
          return 0;
        }
        return prev + increment;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, currentItem, nextItem, showViewersModal, showHighlightModal]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') nextItem();
      if (e.key === 'ArrowLeft') prevItem();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, nextItem, prevItem]);

  // Load viewers profiles
  const handleOpenViewers = async () => {
    if (!currentStory) return;
    setIsPaused(true);
    setShowViewersModal(true);
    setLoadingViewers(true);

    try {
      const knownProfiles: User[] = (currentStory.viewersList || []).map((v) => ({
        id: v.userId,
        name: v.userName,
        username: v.userName.toLowerCase().replace(/\s+/g, '_'),
        avatar: v.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        bio: '',
        joinedDate: '',
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
      }));

      const allViewerUids = Array.from(new Set(currentStory.viewers || []));
      const remainingUids = allViewerUids.filter((uid) => !knownProfiles.some((p) => p.id === uid));

      const fetchedProfiles: User[] = [];
      for (const uid of remainingUids) {
        const u = await getUserProfile(uid);
        if (u) fetchedProfiles.push(u);
      }

      const merged = [...knownProfiles, ...fetchedProfiles];
      // Deduplicate by id
      const unique = Array.from(new Map(merged.map((m) => [m.id, m])).values());
      setViewersProfiles(unique);
    } catch (err) {
      console.warn('Error fetching viewers profiles:', err);
    } finally {
      setLoadingViewers(false);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentStory) return;
    onSendStoryReply(currentStory.userId, `Replied to story: "${replyText.trim()}"`);
    setReplyText('');
    setReplySentNotice(true);
    setTimeout(() => setReplySentNotice(false), 2500);
  };

  const handleEmojiReaction = (emoji: string) => {
    setBurstEmoji(emoji);
    setShowHeartBurst(true);
    if (currentStory) {
      onSendStoryReply(currentStory.userId, `${emoji} Reacted to your story`);
    }
    setTimeout(() => setShowHeartBurst(false), 1000);
  };

  const handlePollVote = async (optionId: string) => {
    if (!currentStory) return;
    await voteStoryPoll(currentStory.id, currentItemIdx, optionId, currentUser.id);
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionAnswerText.trim() || !currentStory) return;
    await answerStoryQuestion(currentStory.id, currentItemIdx, questionAnswerText.trim(), currentUser);
    onSendStoryReply(currentStory.userId, `Answered your question: "${questionAnswerText.trim()}"`);
    setQuestionAnswerText('');
    setAnsweringQuestionId(null);
    setReplySentNotice(true);
    setTimeout(() => setReplySentNotice(false), 2000);
  };

  const handleSaveToHighlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!highlightTitle.trim() || !currentItem) return;
    setIsSavingHighlight(true);

    try {
      await createStoryHighlight(
        currentUser.id,
        highlightTitle.trim(),
        currentItem.mediaUrl,
        [currentItem]
      );
      setShowHighlightModal(false);
      setHighlightSavedNotice(true);
      setTimeout(() => setHighlightSavedNotice(false), 2500);
    } catch (err) {
      console.warn('Error saving highlight:', err);
    } finally {
      setIsSavingHighlight(false);
    }
  };

  if (!currentStory || !currentItem) return null;

  const isMyStory = currentStory.userId === currentUser.id;

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/95 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 select-none">
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/75 transition-colors focus-visible:outline-none"
        aria-label="Close story"
      >
        <X size={22} />
      </button>

      {/* Main Story Container */}
      <div className="relative w-full h-full sm:h-[88vh] sm:max-w-md sm:rounded-3xl overflow-hidden bg-black flex flex-col shadow-2xl">
        {/* Progress Bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {currentStory.items.map((item, idx) => {
            let fillWidth = '0%';
            if (idx < currentItemIdx) fillWidth = '100%';
            else if (idx === currentItemIdx) fillWidth = `${progress}%`;

            return (
              <div
                key={item.id || idx}
                className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white transition-all ease-linear"
                  style={{ width: fillWidth }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Header */}
        <div className="absolute top-7 left-4 right-4 z-30 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => {
              if (onOpenUserProfile) {
                onOpenUserProfile({
                  id: currentStory.userId,
                  name: currentStory.userName,
                  username: currentStory.userUsername,
                  avatar: currentStory.userAvatar,
                  bio: '',
                  joinedDate: '',
                  followersCount: 0,
                  followingCount: 0,
                  isFollowing: false,
                });
                onClose();
              }
            }}
          >
            <img
              src={currentStory.userAvatar}
              alt={currentStory.userName}
              className="w-9 h-9 rounded-full object-cover border border-white/50 group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white text-sm font-medium drop-shadow-sm group-hover:underline">
                  {currentStory.userName}
                </span>
                <span className="text-white/70 text-xs font-normal">
                  · {currentItem.timestamp}
                </span>
              </div>
              <span className="text-white/60 text-xs">@{currentStory.userUsername}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Highlight story action */}
            {isMyStory && (
              <button
                type="button"
                onClick={() => {
                  setIsPaused(true);
                  setShowHighlightModal(true);
                }}
                className="p-1.5 rounded-full bg-black/40 text-white/90 hover:text-white hover:bg-black/60 transition-colors"
                title="Add to Highlights"
              >
                <Bookmark size={16} />
              </button>
            )}

            {isMyStory && onDeleteStory && (
              <button
                type="button"
                onClick={() => {
                  onDeleteStory(currentStory.id);
                  onClose();
                }}
                className="p-1.5 rounded-full bg-black/40 text-red-400 hover:text-red-300 hover:bg-black/60 transition-colors"
                title="Delete story"
              >
                <Trash2 size={16} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsPaused((p) => !p)}
              className="p-1.5 rounded-full bg-black/40 text-white/90 hover:text-white"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>
        </div>

        {/* Media display */}
        <div
          className="relative flex-1 w-full h-full bg-neutral-950 flex items-center justify-center overflow-hidden"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <img
            src={currentItem.mediaUrl}
            alt="Story content"
            className={`w-full h-full object-cover ${
              currentItem.filter ? FILTER_CLASSES[currentItem.filter] : ''
            }`}
          />

          {/* Mood tag badge if present */}
          {currentItem.moodTag && (
            <div className="absolute top-20 left-4 z-20">
              <span className="text-[11px] font-medium text-white/90 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                <Tag size={11} className="text-[#8FA89B]" />
                <span>#{currentItem.moodTag}</span>
              </span>
            </div>
          )}

          {/* Text Overlay if present */}
          {currentItem.textOverlay && (
            <div className="absolute inset-x-6 top-1/3 z-20 flex justify-center pointer-events-none">
              <div
                className={`px-4 py-2.5 rounded-2xl text-center max-w-sm ${
                  currentItem.textOverlay.hasBackground
                    ? 'bg-black/65 backdrop-blur-md border border-white/20'
                    : 'drop-shadow-lg'
                }`}
                style={{
                  color: currentItem.textOverlay.color || '#FFFFFF',
                  fontFamily:
                    currentItem.textOverlay.font === 'serif'
                      ? 'Playfair Display, serif'
                      : currentItem.textOverlay.font === 'mono'
                      ? 'monospace'
                      : 'sans-serif',
                }}
              >
                <p className="text-base sm:text-xl font-medium tracking-wide leading-relaxed">
                  {currentItem.textOverlay.text}
                </p>
              </div>
            </div>
          )}

          {/* Render interactive stickers on story */}
          {currentItem.stickers && currentItem.stickers.length > 0 && (
            <div className="absolute inset-x-4 top-28 bottom-32 z-25 flex flex-col items-center justify-center gap-4">
              {currentItem.stickers.map((s) => {
                // Poll sticker with live voting
                if (s.type === 'poll') {
                  const userVoted = s.data.userVotes?.[currentUser.id];
                  const totalVotes =
                    s.data.options?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0;

                  return (
                    <div
                      key={s.id}
                      className="w-68 bg-white/95 backdrop-blur-md text-[#2D3732] rounded-3xl p-4 shadow-2xl border border-white/50 pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="font-serif text-sm font-semibold text-center mb-3">
                        {s.data.question}
                      </div>
                      <div className="space-y-2">
                        {s.data.options?.map((opt) => {
                          const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                          const isSelected = userVoted === opt.id;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handlePollVote(opt.id)}
                              className={`relative w-full py-2.5 px-3 rounded-2xl font-medium text-xs text-left overflow-hidden transition-all border ${
                                isSelected
                                  ? 'border-[#8FA89B] text-[#2D3732]'
                                  : 'border-[#2D3732]/10 bg-[#F1F5F2] hover:bg-[#E5EAE7]'
                              }`}
                            >
                              {userVoted && (
                                <div
                                  className="absolute inset-0 bg-[#8FA89B]/25 transition-all duration-500"
                                  style={{ width: `${percent}%` }}
                                />
                              )}
                              <div className="relative z-10 flex items-center justify-between">
                                <span>{opt.text}</span>
                                {userVoted && (
                                  <span className="font-mono font-bold">{percent}%</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Question sticker
                if (s.type === 'question') {
                  return (
                    <div
                      key={s.id}
                      className="w-68 bg-gradient-to-br from-[#8FA89B] to-[#5C7567] text-white rounded-3xl p-4 shadow-2xl border border-white/30 pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-[11px] uppercase tracking-wider text-white/80 font-mono text-center mb-1">
                        Aura Question
                      </div>
                      <div className="font-serif text-sm font-medium text-center mb-3">
                        {s.data.question}
                      </div>
                      {answeringQuestionId === s.id ? (
                        <form onSubmit={handleQuestionSubmit} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={questionAnswerText}
                            onChange={(e) => setQuestionAnswerText(e.target.value)}
                            placeholder="Type your answer..."
                            className="flex-1 bg-white/25 text-white placeholder-white/70 text-xs px-3 py-2 rounded-xl focus:outline-none border border-white/30"
                          />
                          <button
                            type="submit"
                            className="p-2 rounded-xl bg-white text-[#2D3732] shrink-0"
                          >
                            <Send size={13} />
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsPaused(true);
                            setAnsweringQuestionId(s.id);
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs text-center border border-white/20 font-medium"
                        >
                          Tap to reply...
                        </button>
                      )}
                    </div>
                  );
                }

                // Music sticker
                if (s.type === 'music') {
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/25 text-white shadow-xl pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#8FA89B] flex items-center justify-center text-white shrink-0 animate-pulse">
                        <Music size={14} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{s.data.trackTitle}</div>
                        <div className="text-[10px] text-white/70">{s.data.artist}</div>
                      </div>
                    </div>
                  );
                }

                // Location sticker
                if (s.type === 'location') {
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[#2D3732] shadow-xl border border-white/40 pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin size={14} className="text-[#8FA89B]" />
                      <span className="text-xs font-semibold">{s.data.locationName}</span>
                    </div>
                  );
                }

                // Mention sticker
                if (s.type === 'mention') {
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-1.5 bg-[#8FA89B] text-white px-4 py-2 rounded-full shadow-xl font-mono text-xs font-bold pointer-events-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>@{s.data.username}</span>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* Heart burst animation */}
          {showHeartBurst && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping text-6xl z-40">
              {burstEmoji}
            </div>
          )}

          {/* Caption */}
          {currentItem.caption && (
            <div className="absolute bottom-28 left-4 right-4 z-20 pointer-events-auto">
              <p className="text-white text-xs sm:text-sm font-normal bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15 leading-relaxed">
                {currentItem.caption}
              </p>
            </div>
          )}

          {/* Navigation zones */}
          <div
            className="absolute top-16 bottom-28 left-0 w-1/3 z-10 cursor-pointer"
            onClick={prevItem}
            title="Previous slide"
          />
          <div
            className="absolute top-16 bottom-28 right-0 w-1/3 z-10 cursor-pointer"
            onClick={nextItem}
            title="Next slide"
          />
        </div>

        {/* Bottom Reaction & Reply bar (or Viewers count if own story) */}
        <div className="absolute bottom-3 left-3 right-3 z-30 space-y-2">
          {shareNotice && (
            <div className="bg-[#2D3732] text-white text-xs font-medium py-2 px-3 rounded-2xl text-center shadow-lg border border-white/20 animate-fade-in flex items-center justify-center gap-1.5">
              <CheckCircle2 size={14} className="text-[#8FA89B]" />
              <span>Story link copied to clipboard</span>
            </div>
          )}

          {isMyStory ? (
            /* Story Owner: View count pill, likes, share and highlight */
            <div className="flex items-center justify-between bg-black/60 backdrop-blur-md p-2.5 rounded-2xl border border-white/15">
              <button
                type="button"
                onClick={handleOpenViewers}
                className="flex items-center gap-2 text-white/90 hover:text-white text-xs font-medium px-2 py-1 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Eye size={16} className="text-[#8FA89B]" />
                <span>
                  {currentStory.viewersList?.length || currentStory.viewers?.length || 1}{' '}
                  {(currentStory.viewersList?.length || currentStory.viewers?.length || 1) === 1 ? 'view' : 'views'}
                </span>
              </button>

              <div className="flex items-center gap-1.5">
                {/* Total likes count */}
                <div className="flex items-center gap-1 text-xs text-white/90 px-2.5 py-1 bg-white/10 rounded-xl">
                  <Heart size={13} className="text-red-400 fill-red-400" />
                  <span>{currentItem.likesCount || currentItem.likedBy?.length || 0}</span>
                </div>

                {/* Share story */}
                <button
                  type="button"
                  onClick={handleShareStory}
                  className="p-1.5 rounded-xl text-white/80 hover:text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                  title="Share story"
                >
                  <Share2 size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPaused(true);
                    setShowHighlightModal(true);
                  }}
                  className="text-xs text-[#8FA89B] hover:text-[#a5bdaf] font-medium flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 cursor-pointer"
                >
                  <Bookmark size={13} />
                  <span>Highlight</span>
                </button>
              </div>
            </div>
          ) : (
            /* Visitor: Emoji reactions + DM Reply input + Like + Share */
            <>
              <div className="flex items-center justify-around bg-black/40 backdrop-blur-md py-1.5 px-3 rounded-2xl border border-white/10">
                {EMOJI_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiReaction(emoji)}
                    className="text-lg hover:scale-125 transition-transform active:scale-95 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {replySentNotice ? (
                <div className="bg-[#8FA89B] text-white text-xs font-medium py-2.5 px-4 rounded-2xl text-center shadow-lg flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>Reply sent to {currentStory.userName}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <form onSubmit={handleSendReply} className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onFocus={() => setIsPaused(true)}
                      onBlur={() => setIsPaused(false)}
                      placeholder={`Reply to ${currentStory.userName.split(' ')[0]}...`}
                      className="flex-1 bg-white/20 backdrop-blur-md text-white placeholder-white/70 text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-white/20 focus:outline-none focus:border-white"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="p-2.5 rounded-2xl bg-[#8FA89B] text-white disabled:opacity-40 hover:bg-[#7e9689] transition-colors shrink-0 cursor-pointer"
                    >
                      <Send size={16} />
                    </button>
                  </form>

                  {/* Heart Like Button */}
                  <button
                    type="button"
                    onClick={handleToggleStoryLike}
                    className={`p-2.5 rounded-2xl backdrop-blur-md transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                      isItemLiked ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                    title={isItemLiked ? 'Liked' : 'Like story'}
                  >
                    <Heart size={16} className={isItemLiked ? 'fill-current' : ''} />
                  </button>

                  {/* Share Button */}
                  <button
                    type="button"
                    onClick={handleShareStory}
                    className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all cursor-pointer flex items-center justify-center shrink-0"
                    title="Share story"
                  >
                    <Share2 size={16} />
                  </button>
                </div>
              )}
            </>
          )}

          {highlightSavedNotice && (
            <div className="bg-emerald-600 text-white text-xs font-medium py-2 px-3 rounded-xl text-center animate-fade-in shadow-md">
              Saved to profile Highlights!
            </div>
          )}
        </div>

        {/* Outer navigation arrows */}
        {currentStoryIdx > 0 && (
          <button
            type="button"
            onClick={prevItem}
            className="hidden sm:flex absolute -left-14 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {currentStoryIdx < stories.length - 1 && (
          <button
            type="button"
            onClick={nextItem}
            className="hidden sm:flex absolute -right-14 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Viewers List Modal */}
      {showViewersModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#FAFAF9] rounded-3xl p-6 shadow-2xl border border-[#2D3732]/10 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#2D3732]/10 mb-3">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-[#8FA89B]" />
                <h4 className="font-serif text-base font-semibold text-[#2D3732]">
                  Story Viewers ({currentStory.viewers?.length || 0})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowViewersModal(false);
                  setIsPaused(false);
                }}
                className="p-1 rounded-full hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingViewers ? (
                <div className="py-8 text-center text-xs text-[#7A8A82]">Loading viewers...</div>
              ) : viewersProfiles.length > 0 ? (
                viewersProfiles.map((viewer) => (
                  <div key={viewer.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={viewer.avatar}
                        alt={viewer.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#2D3732]/10"
                      />
                      <div>
                        <div className="text-xs font-semibold text-[#2D3732]">{viewer.name}</div>
                        <div className="text-[11px] text-[#7A8A82]">@{viewer.username}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-[#7A8A82]">
                  Only you have viewed this story so far.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save to Highlight Modal */}
      {showHighlightModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#FAFAF9] rounded-3xl p-6 shadow-2xl border border-[#2D3732]/10">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif text-lg font-medium text-[#2D3732]">Add to Highlights</h4>
              <button
                type="button"
                onClick={() => {
                  setShowHighlightModal(false);
                  setIsPaused(false);
                }}
                className="p-1 rounded-full hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveToHighlight} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#2D3732] mb-1">
                  Highlight Collection Title
                </label>
                <input
                  type="text"
                  required
                  value={highlightTitle}
                  onChange={(e) => setHighlightTitle(e.target.value)}
                  placeholder="E.g., Nordic Light, Craft & Design, Quiet Spaces"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#2D3732]/15 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                />
              </div>

              <div className="p-3 rounded-2xl bg-[#F1F5F2] flex items-center gap-3">
                <img
                  src={currentItem.mediaUrl}
                  alt="Cover"
                  className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
                <span className="text-xs text-[#7A8A82]">
                  This story will be used as the collection cover photo.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowHighlightModal(false);
                    setIsPaused(false);
                  }}
                  className="py-2.5 px-4 rounded-xl text-xs text-[#7A8A82] hover:text-[#2D3732]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHighlight || !highlightTitle.trim()}
                  className="py-2.5 px-5 rounded-xl bg-[#2D3732] text-white text-xs font-medium hover:bg-[#3d4a43] disabled:opacity-50"
                >
                  {isSavingHighlight ? 'Saving...' : 'Create Highlight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
