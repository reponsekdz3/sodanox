import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  BarChart2,
  Hash,
  Plus,
  Trash2,
  MapPin,
  Globe,
  Users,
  MessageSquareOff,
  Upload,
  Check,
} from 'lucide-react';
import { User, Post, Poll } from '../../types';

interface CreatePostModalProps {
  currentUser: User;
  onClose: () => void;
  onCreatePost: (newPost: Partial<Post>) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  currentUser,
  onClose,
  onCreatePost,
}) => {
  const [content, setContent] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [audience, setAudience] = useState<'public' | 'followers'>('public');
  const [commentsDisabled, setCommentsDisabled] = useState(false);

  // Poll
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Tags
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(['design', 'craft']);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (mediaUrls.length >= 4) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setMediaUrls((prev) => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    const cleaned = tagInput.trim().replace(/^#/, '');
    if (cleaned && !tags.includes(cleaned)) {
      setTags([...tags, cleaned]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const handleRemovePollOption = (idx: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== idx));
    }
  };

  const handlePollOptionChange = (idx: number, val: string) => {
    const updated = [...pollOptions];
    updated[idx] = val;
    setPollOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && mediaUrls.length === 0) return;

    let pollData: Poll | undefined = undefined;
    if (showPollBuilder && pollQuestion.trim()) {
      const validOptions = pollOptions.filter((opt) => opt.trim().length > 0);
      if (validOptions.length >= 2) {
        pollData = {
          id: `poll_${Date.now()}`,
          question: pollQuestion.trim(),
          options: validOptions.map((text, i) => ({
            id: `opt_${i + 1}`,
            text: text.trim(),
            votes: 0,
          })),
          totalVotes: 0,
        };
      }
    }

    onCreatePost({
      content: content.trim(),
      mediaUrl: mediaUrls.length > 0 ? mediaUrls[0] : undefined,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      mediaType: mediaUrls.length > 0 ? 'image' : undefined,
      location: location.trim() || undefined,
      audience,
      commentsDisabled,
      tags,
      poll: pollData,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl bg-[#FAFAF9] rounded-3xl shadow-2xl overflow-hidden border border-[#F1F5F2] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F2] bg-[#F1F5F2]/50">
          <h2 className="text-base font-serif font-medium text-[#2D3732]">
            Create Studio Post
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Author info & Audience Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover ring-1 ring-[#8FA89B]"
              />
              <div>
                <p className="text-sm font-semibold text-[#2D3732]">
                  {currentUser.name}
                </p>
                <p className="text-xs text-[#7A8A82] font-mono">
                  @{currentUser.username}
                </p>
              </div>
            </div>

            {/* Audience picker */}
            <div className="flex items-center gap-1 bg-[#F1F5F2] p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setAudience('public')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  audience === 'public'
                    ? 'bg-white text-[#2D3732] font-semibold shadow-xs'
                    : 'text-[#7A8A82] hover:text-[#2D3732]'
                }`}
              >
                <Globe size={13} />
                <span>Public</span>
              </button>
              <button
                type="button"
                onClick={() => setAudience('followers')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                  audience === 'followers'
                    ? 'bg-white text-[#2D3732] font-semibold shadow-xs'
                    : 'text-[#7A8A82] hover:text-[#2D3732]'
                }`}
              >
                <Users size={13} />
                <span>Followers</span>
              </button>
            </div>
          </div>

          {/* Text input */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share a reflection, studio progress, or design insight..."
            rows={4}
            className="w-full bg-[#F1F5F2]/40 border border-transparent focus:border-[#8FA89B] focus:bg-white rounded-2xl p-4 text-sm text-[#2D3732] placeholder-[#7A8A82] transition-all focus:outline-none resize-none leading-relaxed"
          />

          {/* Media Attachments Preview (Grid up to 4) */}
          {mediaUrls.length > 0 && (
            <div
              className={`grid gap-2 rounded-2xl overflow-hidden ${
                mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
              }`}
            >
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="relative group aspect-video sm:aspect-square bg-neutral-900 rounded-xl overflow-hidden">
                  <img src={url} alt={`attachment-${idx}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(idx)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white cursor-pointer shadow-md transition-opacity"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Location field */}
          {showLocationInput && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F1F5F2] border border-[#2D3732]/10 animate-fade-in">
              <MapPin size={16} className="text-[#8FA89B] shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add studio location (e.g. Kyoto, Japan)..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-[#2D3732] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setLocation('');
                  setShowLocationInput(false);
                }}
                className="text-[#7A8A82] hover:text-[#2D3732]"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Media & Tool bar */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F1F5F2]/80 border border-[#2D3732]/10">
            <span className="text-xs text-[#7A8A82] font-medium">Attach to post:</span>
            <div className="flex items-center gap-2">
              {/* Photo Upload trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaUrls.length >= 4}
                className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-[#2D3732] border border-[#2D3732]/10 shadow-xs flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-40"
              >
                <ImageIcon size={15} className="text-[#8FA89B]" />
                <span>Photos ({mediaUrls.length}/4)</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Location Toggle */}
              <button
                type="button"
                onClick={() => setShowLocationInput(!showLocationInput)}
                className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 cursor-pointer ${
                  showLocationInput || location
                    ? 'bg-[#8FA89B] text-white border-[#8FA89B]'
                    : 'bg-white text-[#2D3732] border-[#2D3732]/10 hover:bg-neutral-100'
                }`}
              >
                <MapPin size={15} />
                <span>Location</span>
              </button>

              {/* Poll Toggle */}
              <button
                type="button"
                onClick={() => setShowPollBuilder(!showPollBuilder)}
                className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 cursor-pointer ${
                  showPollBuilder
                    ? 'bg-[#8FA89B] text-white border-[#8FA89B]'
                    : 'bg-white text-[#2D3732] border-[#2D3732]/10 hover:bg-neutral-100'
                }`}
              >
                <BarChart2 size={15} />
                <span>Poll</span>
              </button>
            </div>
          </div>

          {/* Poll Builder Accordion */}
          {showPollBuilder && (
            <div className="p-4 bg-[#F1F5F2] rounded-2xl space-y-3 border border-[#2D3732]/10 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D3732]">Community Poll</span>
                <button
                  type="button"
                  onClick={() => setShowPollBuilder(false)}
                  className="text-xs text-[#7A8A82] hover:text-red-500"
                >
                  Remove Poll
                </button>
              </div>

              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Poll Question (e.g. Which glaze finish feels calmer?)"
                className="w-full bg-white border border-[#2D3732]/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
              />

              <div className="space-y-2">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 bg-white border border-[#2D3732]/15 rounded-xl px-3.5 py-2 text-xs text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePollOption(idx)}
                        className="p-1.5 text-[#7A8A82] hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {pollOptions.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddPollOption}
                  className="flex items-center gap-1 text-xs text-[#8FA89B] hover:underline pt-1 cursor-pointer font-medium"
                >
                  <Plus size={14} />
                  <span>Add option</span>
                </button>
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-[#7A8A82] mb-1.5">
              Topic Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs text-[#2D3732] bg-[#E6EDE9] px-2.5 py-1 rounded-full font-medium"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-[#7A8A82] hover:text-[#2D3732] cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A8A82]" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add hashtag & press Enter"
                  className="w-full bg-[#F1F5F2] rounded-xl pl-9 pr-3 py-2 text-xs text-[#2D3732] focus:outline-none focus:border-[#8FA89B]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3.5 py-2 text-xs font-medium bg-[#E6EDE9] text-[#2D3732] rounded-xl hover:bg-[#8FA89B] hover:text-white transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Comments Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-[#F1F5F2]">
            <div className="flex items-center gap-2 text-xs text-[#2D3732]">
              <MessageSquareOff size={15} className="text-[#7A8A82]" />
              <span>Disable comments for this post</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={commentsDisabled}
                onChange={(e) => setCommentsDisabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#8FA89B]"></div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F2]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-[#7A8A82] hover:text-[#2D3732] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim() && mediaUrls.length === 0}
              className="px-6 py-2.5 rounded-2xl bg-[#2D3732] text-white text-xs sm:text-sm font-medium hover:bg-[#3d4a43] disabled:opacity-40 transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
            >
              <span>Publish Post</span>
              <Check size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
