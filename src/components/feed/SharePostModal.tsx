import React, { useState } from 'react';
import { X, Send, Copy, Check, Share2, MessageSquare, Film, Sparkles } from 'lucide-react';
import { Post, User, SharedPostMeta, Reel, Story, SharedReelMeta, SharedStoryMeta } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import { audioSynth } from '../../utils/audioSynth';

interface ShareModalProps {
  post?: Post;
  reel?: Reel;
  story?: Story;
  users: User[];
  currentUser: User;
  onClose: () => void;
  onSendToChat: (
    recipientId: string,
    messageText: string,
    sharedData?: {
      post?: SharedPostMeta;
      reel?: SharedReelMeta;
      story?: SharedStoryMeta;
    }
  ) => void;
  onIncrementShare?: () => void;
}

export const SharePostModal: React.FC<ShareModalProps> = ({
  post,
  reel,
  story,
  users,
  currentUser,
  onClose,
  onSendToChat,
  onIncrementShare,
}) => {
  const [copied, setCopied] = useState(false);
  const [sentUserIds, setSentUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customNote, setCustomNote] = useState('');

  const filteredUsers = users.filter(
    (u) =>
      u.id !== currentUser.id &&
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getItemType = (): 'post' | 'reel' | 'story' => {
    if (reel) return 'reel';
    if (story) return 'story';
    return 'post';
  };

  const getDeepLink = () => {
    if (reel) return `${window.location.origin}/#/reels?id=${reel.id}`;
    if (story) return `${window.location.origin}/#story=${story.id}`;
    return `${window.location.origin}/#/post/${post?.id || ''}`;
  };

  const handleCopyLink = () => {
    const itemUrl = getDeepLink();
    navigator.clipboard?.writeText(itemUrl);
    setCopied(true);
    audioSynth.playPop();
    onIncrementShare?.();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    const itemUrl = getDeepLink();
    if (navigator.share) {
      try {
        const title = reel
          ? `Reel by ${reel.author.name} on Ducate`
          : story
          ? `Story by ${story.userName} on Ducate`
          : `Post by ${post?.author.name || 'creator'} on Ducate`;

        const text = reel
          ? reel.caption
          : post
          ? post.content.slice(0, 100)
          : 'Check out this moment on Ducate';

        await navigator.share({ title, text, url: itemUrl });
        onIncrementShare?.();
      } catch {
        // Dismissed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleSendDirect = (targetUser: User) => {
    audioSynth.playSentSound();
    const itemType = getItemType();

    if (itemType === 'reel' && reel) {
      const sharedReel: SharedReelMeta = {
        reelId: reel.id,
        authorName: reel.author.name,
        authorUsername: reel.author.username,
        authorAvatar: reel.author.avatar,
        caption: reel.caption,
        videoUrl: reel.videoUrl,
        posterUrl: reel.posterUrl,
        audioTrack: reel.audioTrack ? `${reel.audioTrack.title} — ${reel.audioTrack.artist}` : undefined,
      };
      const text = customNote.trim() || `Shared a video reel from @${reel.author.username}`;
      onSendToChat(targetUser.id, text, { reel: sharedReel });
    } else if (itemType === 'story' && story) {
      const firstItem = story.items[0];
      const sharedStory: SharedStoryMeta = {
        storyId: story.id,
        authorName: story.userName,
        authorUsername: story.userUsername,
        authorAvatar: story.userAvatar,
        mediaUrl: firstItem?.mediaUrl || '',
        mediaType: firstItem?.type,
        caption: firstItem?.caption || '',
      };
      const text = customNote.trim() || `Shared a story from @${story.userUsername}`;
      onSendToChat(targetUser.id, text, { story: sharedStory });
    } else if (post) {
      const sharedMeta: SharedPostMeta = {
        postId: post.id,
        authorName: post.author.name,
        authorUsername: post.author.username,
        authorAvatar: post.author.avatar,
        content: post.content,
        mediaUrl: post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]),
        timestamp: post.timestamp,
      };
      const messageText = customNote.trim() || `Check out this post by @${post.author.username}`;
      onSendToChat(targetUser.id, messageText, { post: sharedMeta });
    }

    setSentUserIds((prev) => [...prev, targetUser.id]);
    onIncrementShare?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-soft-float overflow-hidden border border-[#D1E2D9] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D1E2D9]">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-[#059669]" />
            <h3 className="text-sm font-bold text-[#022C22]">
              Share {reel ? 'Video Reel' : story ? 'Story' : 'Post'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#4B6358] hover:text-[#022C22] hover:bg-[#EDF3F0] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Item Quick Preview */}
        <div className="p-4 mx-4 mt-4 bg-[#EDF3F0] rounded-2xl border border-[#D1E2D9] flex items-start gap-3">
          <ModernAvatar
            src={reel ? reel.author.avatar : story ? story.userAvatar : post?.author.avatar || ''}
            alt={reel ? reel.author.name : story ? story.userName : post?.author.name || ''}
            size="sm"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#022C22]">
              {reel ? reel.author.name : story ? story.userName : post?.author.name}
            </p>
            <p className="text-xs text-[#4B6358] line-clamp-2 mt-0.5">
              {reel ? reel.caption : story ? 'Interactive Story' : post?.content}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 py-4 grid grid-cols-2 gap-3 border-b border-[#D1E2D9]">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#EDF3F0] hover:bg-[#D1E2D9] text-[#022C22] text-xs font-semibold transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={16} className="text-[#059669]" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} className="text-[#4B6358]" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#064E3B] hover:bg-[#022C22] text-white text-xs font-semibold transition-all shadow-soft cursor-pointer"
          >
            <Share2 size={16} />
            <span>Share via...</span>
          </button>
        </div>

        {/* Send via Direct Message */}
        <div className="p-4 flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare size={15} className="text-[#059669]" />
            <h4 className="text-xs font-bold text-[#022C22] uppercase tracking-wider">
              Send in Direct Message
            </h4>
          </div>

          {/* Optional message input */}
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="Add an optional message..."
            className="w-full bg-[#EDF3F0] rounded-2xl px-3.5 py-2 text-xs text-[#022C22] placeholder-[#4B6358] mb-2 focus:outline-none focus:bg-white border border-[#D1E2D9] focus:border-[#059669]"
          />

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search creators..."
            className="w-full bg-[#EDF3F0] rounded-2xl px-3.5 py-2 text-xs text-[#022C22] placeholder-[#4B6358] mb-3 focus:outline-none focus:bg-white border border-[#D1E2D9] focus:border-[#059669]"
          />

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {filteredUsers.length === 0 ? (
              <p className="text-xs text-[#4B6358] text-center py-4">No creators found.</p>
            ) : (
              filteredUsers.map((user) => {
                const isSent = sentUserIds.includes(user.id);
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#EDF3F0] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ModernAvatar
                        src={user.avatar}
                        alt={user.name}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#022C22] truncate">{user.name}</p>
                        <p className="text-[11px] text-[#4B6358] truncate">@{user.username}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendDirect(user)}
                      disabled={isSent}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSent
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-[#064E3B] text-white hover:bg-[#022C22]'
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
