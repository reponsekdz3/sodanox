import React, { useState, useRef, useEffect } from 'react';
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
  Check,
  Sparkles,
  Zap,
  Type,
  Music,
  Sliders,
  Play,
  Square,
  Maximize2,
  Crop,
  Layers,
} from 'lucide-react';
import { User, Post, Poll, StoryFilter } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import { compressImage, uploadMediaToFirebase, formatBytes } from '../../services/mediaCompressionService';
import { auraAudio } from '../../utils/audioSynthesizer';
import { UploadProgressBar } from '../common/UploadProgressBar';

interface CreatePostModalProps {
  currentUser: User;
  onClose: () => void;
  onCreatePost: (newPost: Partial<Post>) => void;
  initialContent?: string;
}

const FILTER_CLASSES: Record<StoryFilter, string> = {
  none: '',
  vintage: 'sepia-[0.35] contrast-[1.15] brightness-[0.95]',
  nordic: 'saturate-[0.65] contrast-[0.95] brightness-[1.05]',
  noir: 'grayscale contrast-[1.25]',
  golden: 'sepia-[0.3] saturate-[1.4] brightness-[1.05]',
  sepia: 'sepia-[0.7] contrast-[0.9]',
  emerald: 'hue-rotate-[25deg] saturate-[1.2]',
};

const SOUNDTRACK_PRESETS = [
  { title: 'Morning Light In Kyoto', artist: 'Quiet Archive', mode: 'binaural' as const },
  { title: 'Nordic Rain On Cedar', artist: 'Field Recordings', mode: 'rain' as const },
  { title: 'Analog Tape & Vinyl Drift', artist: 'Slow Studio', mode: 'vinyl' as const },
  { title: 'Forest Reverberation', artist: 'Minimalist Series', mode: 'forest' as const },
  { title: 'Felt & Acoustic Wood', artist: 'Aura Soundscapes', mode: 'binaural' as const },
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  currentUser,
  onClose,
  onCreatePost,
  initialContent = '',
}) => {
  const [content, setContent] = useState(initialContent);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [audience, setAudience] = useState<'public' | 'followers'>('public');
  const [commentsDisabled, setCommentsDisabled] = useState(false);

  // Creative Studio Features
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif' | 'mono' | 'nordic'>('serif');
  const [activeFilter, setActiveFilter] = useState<StoryFilter>('none');
  const [selectedTrack, setSelectedTrack] = useState<{ title: string; artist: string; mode: 'rain' | 'vinyl' | 'binaural' | 'forest' } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Resolution & Aspect Ratio Controls
  const [resolution, setResolution] = useState<'4k' | '1080p' | '720p' | 'original'>('1080p');
  const [aspectRatio, setAspectRatio] = useState<'original' | '1:1' | '4:5' | '16:9' | '9:16'>('original');

  // Active sub-tool drawer
  const [activeStudioTool, setActiveStudioTool] = useState<
    'none' | 'typography' | 'filters' | 'resolution' | 'music' | 'poll'
  >('none');

  // Poll
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // Tags
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Detailed Progress Bar States
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('Compressing & uploading media...');
  const [bytesTransferred, setBytesTransferred] = useState<number | undefined>(undefined);
  const [totalBytes, setTotalBytes] = useState<number | undefined>(undefined);
  const [compressionSavings, setCompressionSavings] = useState<{
    original: number;
    compressed: number;
    savingsPercent: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      auraAudio.setAmbient('off');
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files).slice(0, Math.max(0, 4 - mediaUrls.length));
    if (fileList.length === 0) {
      setUploadError('You can attach up to four images to a post.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setIsCompressing(true);
    setUploadPercent(1);
    setUploadError(null);
    setBytesTransferred(undefined);
    setTotalBytes(undefined);
    setUploadStatusText('Preparing ' + fileList.length + ' image(s)...');
    let totalOriginal = 0;
    let totalCompressed = 0;
    const maxDimension = resolution === '4k' ? 3840 : resolution === '1080p' ? 1920 : resolution === '720p' ? 1280 : 6000;
    const quality = resolution === '4k' ? 0.92 : resolution === '1080p' ? 0.85 : resolution === '720p' ? 0.78 : 0.95;
    const perFileProgress = 100 / fileList.length;
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        totalOriginal += file.size;
        const fileStart = i * perFileProgress;
        setUploadPercent(Math.max(1, Math.round(fileStart + 1)));
        setUploadStatusText('Optimizing image ' + (i + 1) + ' of ' + fileList.length + '...');
        const compressed = await compressImage(file, {
          maxDimension, quality, preferWebp: true, aspectRatio,
          onProgress: (pct, status) => {
            const progress = fileStart + (pct / 100) * perFileProgress * 0.45;
            setUploadPercent(Math.max(1, Math.min(99, Math.round(progress))));
            setUploadStatusText('Image ' + (i + 1) + '/' + fileList.length + ': ' + status);
          },
        });
        totalCompressed += compressed.compressedSize;
        setUploadStatusText('Uploading image ' + (i + 1) + ' of ' + fileList.length + ' to Firebase Storage...');
        const extension = compressed.mimeType === 'image/webp' ? 'webp' : compressed.mimeType === 'image/png' ? 'png' : 'jpg';
        const storagePath = 'posts/' + currentUser.id + '/' + Date.now() + '_' + i + '.' + extension;
        const uploadRes = await uploadMediaToFirebase(compressed.blob, storagePath, (pct, transferred, total) => {
          const progress = fileStart + perFileProgress * (0.45 + (pct / 100) * 0.54);
          setUploadPercent(Math.max(1, Math.min(99, Math.round(progress))));
          setBytesTransferred(transferred);
          setTotalBytes(total);
        });
        setMediaUrls((prev) => [...prev, uploadRes.url]);
      }
      setUploadPercent(100);
      setUploadStatusText('All images are optimized and stored securely.');
      if (totalOriginal > 0) {
        const savingsPercent = Math.max(0, Math.round(((totalOriginal - totalCompressed) / totalOriginal) * 100));
        setCompressionSavings({ original: totalOriginal, compressed: totalCompressed, savingsPercent });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Media upload failed. Please try again.';
      setUploadError(message);
      setUploadStatusText('Upload failed. Your post has not been published.');
    } finally {
      window.setTimeout(() => setIsCompressing(false), 450);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const handleRemoveMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleSoundPreview = (preset: typeof SOUNDTRACK_PRESETS[0]) => {
    if (selectedTrack?.title === preset.title && isPlayingPreview) {
      auraAudio.setAmbient('off');
      setIsPlayingPreview(false);
    } else {
      setSelectedTrack(preset);
      auraAudio.setAmbient(preset.mode);
      setIsPlayingPreview(true);
    }
  };

  const handleSelectSoundtrack = (preset: typeof SOUNDTRACK_PRESETS[0]) => {
    if (selectedTrack?.title === preset.title) {
      setSelectedTrack(null);
      auraAudio.setAmbient('off');
      setIsPlayingPreview(false);
    } else {
      setSelectedTrack(preset);
    }
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

    auraAudio.setAmbient('off');

    let pollData: Poll | undefined = undefined;
    if (activeStudioTool === 'poll' && pollQuestion.trim()) {
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
      fontStyle,
      filter: activeFilter !== 'none' ? activeFilter : undefined,
      audioTrack: selectedTrack ? { title: selectedTrack.title, artist: selectedTrack.artist } : undefined,
      resolution,
      aspectRatio,
    });

    onClose();
  };

  const getContentFontStyle = () => {
    switch (fontStyle) {
      case 'serif':
        return 'font-serif text-base sm:text-lg italic leading-relaxed';
      case 'mono':
        return 'font-mono text-xs sm:text-sm tracking-tight leading-relaxed';
      case 'nordic':
        return 'font-sans text-xs sm:text-sm tracking-widest uppercase leading-loose';
      default:
        return 'font-sans text-sm sm:text-base leading-relaxed';
    }
  };

  const getMediaAspectRatioClass = () => {
    switch (aspectRatio) {
      case '1:1':
        return 'aspect-square';
      case '4:5':
        return 'aspect-[4/5]';
      case '16:9':
        return 'aspect-video';
      default:
        return 'aspect-auto max-h-[460px]';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none animate-fade-in">
      <div className="w-full max-w-xl bg-[#FAFAF9] rounded-3xl shadow-2xl overflow-hidden border border-[#2D3732]/10 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3732]/10 bg-[#F1F5F2]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8FA89B] animate-pulse" />
            <h2 className="text-base font-serif font-medium text-[#2D3732]">
              Aura Studio · Create Post
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              auraAudio.setAmbient('off');
              onClose();
            }}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#E6EDE9] transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {/* Author info & Audience Selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ModernAvatar
                src={currentUser.avatar}
                alt={currentUser.name}
                size="md"
                ring
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
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
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
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
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

          {/* Text input with dynamic font styling */}
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Reflect, compose, share an insight or creative moment..."
              rows={4}
              className={`w-full bg-[#F1F5F2]/45 border border-[#2D3732]/10 focus:border-[#8FA89B] focus:bg-white rounded-2xl p-4 text-[#2D3732] placeholder-[#7A8A82] transition-all focus:outline-none resize-none ${getContentFontStyle()}`}
            />
          </div>

          {/* Attached Audio Track Indicator */}
          {selectedTrack && (
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#E6EDE9] border border-[#8FA89B]/40 text-xs">
              <div className="flex items-center gap-2 text-[#2D3732]">
                <div className="w-6 h-6 rounded-full bg-[#8FA89B] text-white flex items-center justify-center">
                  <Music size={13} />
                </div>
                <div>
                  <div className="font-semibold">{selectedTrack.title}</div>
                  <div className="text-[11px] text-[#7A8A82]">{selectedTrack.artist}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedTrack(null);
                  auraAudio.setAmbient('off');
                  setIsPlayingPreview(false);
                }}
                className="text-[#7A8A82] hover:text-red-500 text-xs cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}

          {/* Line & Percent Progress Bar when compressing/uploading */}
          {isCompressing && (
            <UploadProgressBar
              progress={uploadPercent}
              statusText={uploadStatusText}
              bytesTransferred={bytesTransferred}
              totalBytes={totalBytes}
              savingsPercent={compressionSavings?.savingsPercent}
              isComplete={uploadPercent === 100}
              errorText={uploadError || undefined}
            />
          )}
          {uploadError && !isCompressing && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {uploadError}
            </div>
          )}

          {/* Media Attachments Preview (Grid up to 4 with Filter & Aspect Ratio applied) */}
          {mediaUrls.length > 0 && (
            <div className="space-y-2">
              <div
                className={`grid gap-2 rounded-2xl overflow-hidden ${
                  mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                }`}
              >
                {mediaUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className={`relative group bg-neutral-900 rounded-xl overflow-hidden ${getMediaAspectRatioClass()}`}
                  >
                    <img
                      src={url}
                      alt={`attachment-${idx}`}
                      className={`w-full h-full object-cover transition-all ${FILTER_CLASSES[activeFilter]}`}
                    />
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

              {/* Compression Badge */}
              {compressionSavings && !isCompressing && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-[11px] text-emerald-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Zap size={13} className="text-emerald-600" />
                    <span>Firebase Storage Optimized · {resolution.toUpperCase()}</span>
                  </div>
                  <span className="font-mono text-emerald-700">
                    {formatBytes(compressionSavings.original)} → {formatBytes(compressionSavings.compressed)} (-{compressionSavings.savingsPercent}% saved)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Studio Toolbar (Typography, Aesthetic Filters, Resolution, Ambient Soundtrack, Poll, Photos) */}
          <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 overflow-x-auto gap-2">
            <div className="flex items-center gap-1.5">
              {/* Typography */}
              <button
                type="button"
                onClick={() => setActiveStudioTool(activeStudioTool === 'typography' ? 'none' : 'typography')}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeStudioTool === 'typography' || fontStyle !== 'serif'
                    ? 'bg-[#2D3732] text-white shadow-xs'
                    : 'bg-white text-[#2D3732] hover:bg-white/80'
                }`}
                title="Typography Style"
              >
                <Type size={14} className="text-[#8FA89B]" />
                <span className="capitalize">{fontStyle}</span>
              </button>

              {/* Aesthetic Filter */}
              <button
                type="button"
                onClick={() => setActiveStudioTool(activeStudioTool === 'filters' ? 'none' : 'filters')}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeStudioTool === 'filters' || activeFilter !== 'none'
                    ? 'bg-[#2D3732] text-white shadow-xs'
                    : 'bg-white text-[#2D3732] hover:bg-white/80'
                }`}
                title="Visual Filters"
              >
                <Sliders size={14} className="text-[#8FA89B]" />
                <span className="capitalize">{activeFilter === 'none' ? 'Filter' : activeFilter}</span>
              </button>

              {/* Resolution & Ratio */}
              <button
                type="button"
                onClick={() => setActiveStudioTool(activeStudioTool === 'resolution' ? 'none' : 'resolution')}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeStudioTool === 'resolution' || resolution !== '1080p' || aspectRatio !== 'original'
                    ? 'bg-[#2D3732] text-white shadow-xs'
                    : 'bg-white text-[#2D3732] hover:bg-white/80'
                }`}
                title="Resolution & Aspect Ratio"
              >
                <Maximize2 size={14} className="text-[#8FA89B]" />
                <span>{resolution.toUpperCase()}</span>
              </button>

              {/* Soundtrack */}
              <button
                type="button"
                onClick={() => setActiveStudioTool(activeStudioTool === 'music' ? 'none' : 'music')}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeStudioTool === 'music' || selectedTrack
                    ? 'bg-[#2D3732] text-white shadow-xs'
                    : 'bg-white text-[#2D3732] hover:bg-white/80'
                }`}
                title="Ambient Soundtrack"
              >
                <Music size={14} className="text-[#8FA89B]" />
                <span>Music</span>
              </button>

              {/* Poll */}
              <button
                type="button"
                onClick={() => setActiveStudioTool(activeStudioTool === 'poll' ? 'none' : 'poll')}
                className={`py-1.5 px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  activeStudioTool === 'poll' || pollQuestion.trim()
                    ? 'bg-[#2D3732] text-white shadow-xs'
                    : 'bg-white text-[#2D3732] hover:bg-white/80'
                }`}
                title="Community Poll"
              >
                <BarChart2 size={14} className="text-[#8FA89B]" />
                <span>Poll</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Photo Upload trigger */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={mediaUrls.length >= 4 || isCompressing}
                className="py-1.5 px-2.5 rounded-xl bg-white hover:bg-neutral-100 text-[#2D3732] border border-[#2D3732]/10 shadow-xs flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-40"
              >
                <ImageIcon size={14} className="text-[#8FA89B]" />
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
                className={`p-2 rounded-xl text-xs font-medium border flex items-center cursor-pointer ${
                  showLocationInput || location
                    ? 'bg-[#8FA89B] text-white border-[#8FA89B]'
                    : 'bg-white text-[#2D3732] border-[#2D3732]/10 hover:bg-neutral-100'
                }`}
                title="Location"
              >
                <MapPin size={14} />
              </button>
            </div>
          </div>

          {/* Studio Tool Drawer 1: Typography Style */}
          {activeStudioTool === 'typography' && (
            <div className="p-3.5 bg-[#F1F5F2] rounded-2xl border border-[#2D3732]/10 space-y-2 animate-fade-in">
              <span className="text-xs font-semibold text-[#2D3732]">Typography Preset</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'serif', name: 'Editorial Serif', desc: 'Classic literary' },
                    { id: 'sans', name: 'Modern Sans', desc: 'Clean & direct' },
                    { id: 'mono', name: 'Minimal Mono', desc: 'Technical prose' },
                    { id: 'nordic', name: 'Nordic Spaced', desc: 'Poetic wide' },
                  ] as const
                ).map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => setFontStyle(font.id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      fontStyle === font.id
                        ? 'bg-white border-[#8FA89B] shadow-xs'
                        : 'bg-white/60 border-transparent hover:bg-white text-[#7A8A82]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-[#2D3732]">{font.name}</div>
                    <div className="text-[10px] text-[#7A8A82]">{font.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Studio Tool Drawer 2: Aesthetic Filters */}
          {activeStudioTool === 'filters' && (
            <div className="p-3.5 bg-[#F1F5F2] rounded-2xl border border-[#2D3732]/10 space-y-2 animate-fade-in">
              <span className="text-xs font-semibold text-[#2D3732]">Visual Aesthetic Tone</span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {(['none', 'vintage', 'nordic', 'noir', 'golden', 'sepia', 'emerald'] as StoryFilter[]).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs shrink-0 transition-all capitalize cursor-pointer border ${
                        activeFilter === f
                          ? 'bg-[#2D3732] text-white border-[#2D3732] shadow-xs'
                          : 'bg-white text-[#2D3732] border-[#2D3732]/10 hover:border-[#8FA89B]'
                      }`}
                    >
                      {f}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Studio Tool Drawer 3: Resolution & Aspect Ratio */}
          {activeStudioTool === 'resolution' && (
            <div className="p-4 bg-[#EDF3F0] rounded-2xl border border-[#D1E2D9] space-y-4 animate-fade-in">
              <div>
                <span className="block text-xs font-bold text-[#064E3B] mb-2">
                  Resolution & Output Quality
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: '4k', name: '4K UHD Ultra', desc: '3840px · Archival' },
                      { id: '1080p', name: '1080p Full HD', desc: '1920px · Optimal' },
                      { id: '720p', name: '720p HD', desc: '1280px · Fast' },
                      { id: 'original', name: 'Lossless Original', desc: 'Native camera' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResolution(r.id)}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        resolution === r.id
                          ? 'bg-white border-[#064E3B] ring-2 ring-[#059669]/30 shadow-xs'
                          : 'bg-white/70 border-[#D1E2D9]/80 hover:bg-white text-[#3D5A4C]'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#064E3B]">{r.name}</div>
                      <div className="text-[10px] text-[#3D5A4C]">{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-[#064E3B] mb-2">
                  Frame Framing & Aspect Ratio
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { id: 'original', label: 'Original' },
                      { id: '1:1', label: '1:1 Square' },
                      { id: '4:5', label: '4:5 Portrait' },
                      { id: '16:9', label: '16:9 Wide' },
                      { id: '9:16', label: '9:16 Reel' },
                    ] as const
                  ).map((ar) => (
                    <button
                      key={ar.id}
                      type="button"
                      onClick={() => setAspectRatio(ar.id)}
                      className={`py-2 px-2 text-center text-xs rounded-xl border transition-all cursor-pointer ${
                        aspectRatio === ar.id
                          ? 'bg-[#064E3B] text-white border-[#064E3B] font-bold shadow-xs'
                          : 'bg-white border-[#D1E2D9] hover:bg-white text-[#3D5A4C]'
                      }`}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Studio Tool Drawer 4: Ambient Soundtracks */}
          {activeStudioTool === 'music' && (
            <div className="p-3.5 bg-[#F1F5F2] rounded-2xl border border-[#2D3732]/10 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D3732]">Ambient Soundscapes & Music</span>
                <span className="text-[11px] text-[#7A8A82]">Select to attach</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {SOUNDTRACK_PRESETS.map((preset) => {
                  const isSelected = selectedTrack?.title === preset.title;
                  const isPlayingThis = isSelected && isPlayingPreview;
                  return (
                    <div
                      key={preset.title}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-white border-[#8FA89B] shadow-xs'
                          : 'bg-white/70 border-transparent hover:bg-white'
                      }`}
                    >
                      <div
                        onClick={() => handleSelectSoundtrack(preset)}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="text-xs font-medium text-[#2D3732]">{preset.title}</div>
                        <div className="text-[10px] text-[#7A8A82]">{preset.artist}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Audio preview button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSoundPreview(preset)}
                          className="p-1.5 rounded-lg bg-[#E6EDE9] text-[#2D3732] hover:bg-[#8FA89B] hover:text-white transition-colors cursor-pointer"
                          title={isPlayingThis ? 'Stop preview' : 'Listen preview'}
                        >
                          {isPlayingThis ? <Square size={13} /> : <Play size={13} className="ml-0.5 fill-current" />}
                        </button>

                        {/* Select badge */}
                        <button
                          type="button"
                          onClick={() => handleSelectSoundtrack(preset)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                            isSelected
                              ? 'bg-[#8FA89B] text-white'
                              : 'bg-white text-[#7A8A82] border border-[#2D3732]/10'
                          }`}
                        >
                          {isSelected ? 'Attached' : 'Select'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Studio Tool Drawer 5: Poll Builder */}
          {activeStudioTool === 'poll' && (
            <div className="p-4 bg-[#F1F5F2] rounded-2xl space-y-3 border border-[#2D3732]/10 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#2D3732]">Community Poll</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveStudioTool('none');
                    setPollQuestion('');
                  }}
                  className="text-xs text-[#7A8A82] hover:text-red-500 cursor-pointer"
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

          {/* Location field */}
          {showLocationInput && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F1F5F2] border border-[#2D3732]/10 animate-fade-in">
              <MapPin size={16} className="text-[#8FA89B] shrink-0" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location (e.g. Kyoto, Japan)..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-[#2D3732] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setLocation('');
                  setShowLocationInput(false);
                }}
                className="text-[#7A8A82] hover:text-[#2D3732] cursor-pointer"
              >
                <X size={16} />
              </button>
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
              onClick={() => {
                auraAudio.setAmbient('off');
                onClose();
              }}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-[#7A8A82] hover:text-[#2D3732] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={(!content.trim() && mediaUrls.length === 0) || isCompressing}
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
