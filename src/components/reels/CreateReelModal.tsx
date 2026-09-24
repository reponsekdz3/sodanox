import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Video,
  Music,
  Tag,
  Sparkles,
  Upload,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  CheckCircle2,
  Film,
  AlertCircle,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { User } from '../../types';
import { auraAudio } from '../../utils/audioSynthesizer';

interface CreateReelModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmitReel: (data: {
    videoUrl: string;
    posterUrl: string;
    caption: string;
    tags: string[];
    audioTitle: string;
    audioArtist: string;
  }) => Promise<void> | void;
}

const PRESET_REELS = [
  {
    title: 'Clay on Wheel',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-potter-molding-clay-on-a-potters-wheel-42220-large.mp4',
    posterUrl: '/src/assets/images/post_ceramic_art_1790174946314.jpg',
    defaultTag: 'Ceramics',
    audioTitle: 'Quiet Wheel Ambience',
    audioArtist: 'Craft Archive',
  },
  {
    title: 'Pourover Bloom',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-making-drip-coffee-in-a-glass-pot-41907-large.mp4',
    posterUrl: '/src/assets/images/reel_coffee_craft_1790174957454.jpg',
    defaultTag: 'SlowRitual',
    audioTitle: 'Morning Coffee Acoustic',
    audioArtist: 'Sound Lab',
  },
  {
    title: 'Coastline Waves',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-top-aerial-shot-of-seashore-with-rocks-and-waves-42171-large.mp4',
    posterUrl: '/src/assets/images/post_scenic_nordic_1790174933983.jpg',
    defaultTag: 'NordicNature',
    audioTitle: 'Nordic Ocean Reverberation',
    audioArtist: 'Field Series',
  },
];

const AMBIENT_AUDIO_PRESETS = [
  { title: 'Quiet Wheel Ambience', artist: 'Craft Archive' },
  { title: 'Morning Coffee Acoustic', artist: 'Sound Lab' },
  { title: 'Nordic Ocean Reverberation', artist: 'Field Series' },
  { title: 'Analog Tape Drift', artist: 'Aura Soundscapes' },
  { title: 'Felt & Acoustic Wood', artist: 'Quiet Resonance' },
];

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  currentUser,
  onClose,
  onSubmitReel,
}) => {
  // Video source state
  const [selectedPreset, setSelectedPreset] = useState<typeof PRESET_REELS[0] | null>(null);
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  
  // Player state in modal
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  
  // Content details
  const [caption, setCaption] = useState('');
  const [customTags, setCustomTags] = useState('SlowLiving, CraftProcess');
  const [audioSourceType, setAudioSourceType] = useState<'video' | 'ambient' | 'custom'>('video');
  const [audioTitle, setAudioTitle] = useState('Original Video Sound');
  const [audioArtist, setAudioArtist] = useState(currentUser.name);

  // Status & loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize with the first preset as fallback preview
  useEffect(() => {
    setSelectedPreset(PRESET_REELS[0]);
    setVideoUrl(PRESET_REELS[0].videoUrl);
    setPosterUrl(PRESET_REELS[0].posterUrl);
    setAudioTitle(PRESET_REELS[0].audioTitle);
    setAudioArtist(PRESET_REELS[0].audioArtist);
  }, []);

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // Handle local video upload from user's storage
  const handleLocalVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (allow up to 80MB)
    if (file.size > 80 * 1024 * 1024) {
      setError('Video file exceeds 80MB limit. Please choose a smaller video.');
      return;
    }

    setError(null);
    setLocalVideoFile(file);
    setSelectedPreset(null);
    setCustomVideoUrl('');

    const objectUrl = URL.createObjectURL(file);
    setVideoUrl(objectUrl);
    setAudioTitle(file.name.replace(/\.[^/.]+$/, ''));
    setAudioArtist(currentUser.name);
    setIsGeneratingPoster(true);

    // Auto extract poster from video after loading
    const tempVideo = document.createElement('video');
    tempVideo.src = objectUrl;
    tempVideo.crossOrigin = 'anonymous';
    tempVideo.muted = true;
    tempVideo.currentTime = 0.5;

    tempVideo.onloadeddata = () => {
      tempVideo.currentTime = Math.min(1.0, (tempVideo.duration || 2) / 2);
    };

    tempVideo.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 720;
        canvas.height = tempVideo.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPosterUrl(dataUrl);
        }
      } catch (err) {
        console.warn('Could not auto-generate video poster frame:', err);
      } finally {
        setIsGeneratingPoster(false);
      }
    };

    tempVideo.onerror = () => {
      setIsGeneratingPoster(false);
    };
  };

  // Handle custom poster upload from local storage
  const handleCustomPosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Cover image exceeds 8MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPosterUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleVideoLoadedMetadata = () => {
    if (previewVideoRef.current) {
      setVideoDuration(previewVideoRef.current.duration);
    }
  };

  const toggleModalPlayback = () => {
    if (!previewVideoRef.current) return;
    if (previewVideoRef.current.paused) {
      previewVideoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      previewVideoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) {
      setError('Please select or upload a video file for the reel.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tagsArray = customTags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      let finalPoster = posterUrl;
      // If no poster was generated, extract from video element
      if (!finalPoster && previewVideoRef.current) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = previewVideoRef.current.videoWidth || 720;
          canvas.height = previewVideoRef.current.videoHeight || 1280;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(previewVideoRef.current, 0, 0, canvas.width, canvas.height);
            finalPoster = canvas.toDataURL('image/jpeg', 0.85);
          }
        } catch {
          finalPoster = '/src/assets/images/post_ceramic_art_1790174946314.jpg';
        }
      }

      await onSubmitReel({
        videoUrl,
        posterUrl: finalPoster || '/src/assets/images/post_ceramic_art_1790174946314.jpg',
        caption: caption.trim() || 'A quiet moment shared on Aura.',
        tags: tagsArray.length > 0 ? tagsArray : ['AuraSeries', 'Makers'],
        audioTitle: audioTitle.trim() || 'Original Sound',
        audioArtist: audioArtist.trim() || currentUser.name,
      });

      auraAudio.playChime();
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to publish reel. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="w-full max-w-4xl bg-[#FAFAF9] rounded-3xl shadow-2xl overflow-hidden border border-[#2D3732]/10 flex flex-col max-h-[92vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3732]/10 bg-[#F1F5F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#8FA89B]/20 flex items-center justify-center text-[#5E7C6E]">
              <Film size={18} />
            </div>
            <div>
              <h2 className="text-base font-serif font-semibold text-[#2D3732]">
                Create & Publish Reel
              </h2>
              <p className="text-[11px] text-[#7A8A82]">
                Share high-definition motion, visual craft, or ambient rhythm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Live Reel Video Preview Player (Aspect 9:16) */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-[9/16] rounded-3xl overflow-hidden bg-black shadow-xl border border-neutral-800 flex items-center justify-center group select-none">
                {videoUrl ? (
                  <>
                    <video
                      ref={previewVideoRef}
                      src={videoUrl}
                      poster={posterUrl}
                      muted={isMuted}
                      loop
                      playsInline
                      onLoadedMetadata={handleVideoLoadedMetadata}
                      onClick={toggleModalPlayback}
                      className="w-full h-full object-cover cursor-pointer"
                    />

                    {/* Play/Pause Overlay */}
                    {!isPlaying && (
                      <div
                        onClick={toggleModalPlayback}
                        className="absolute inset-0 bg-black/30 flex items-center justify-center cursor-pointer transition-opacity"
                      >
                        <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white">
                          <Play size={24} className="ml-0.5 fill-white" />
                        </div>
                      </div>
                    )}

                    {/* Bottom overlay pills */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/90 z-20 pointer-events-none">
                      <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md flex items-center gap-1.5 font-mono">
                        <Clock size={11} className="text-[#8FA89B]" />
                        <span>{videoDuration ? formatDuration(videoDuration) : '0:15'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMuted(!isMuted);
                        }}
                        className="p-2 rounded-full bg-black/50 backdrop-blur-md pointer-events-auto hover:bg-black/70 cursor-pointer"
                      >
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                    <Video size={36} className="mb-2 text-[#8FA89B]/60 animate-pulse" />
                    <p className="text-xs">No video chosen</p>
                  </div>
                )}

                {isGeneratingPoster && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white text-xs gap-2">
                    <RotateCcw size={16} className="animate-spin text-[#8FA89B]" />
                    <span>Extracting thumbnail...</span>
                  </div>
                )}
              </div>

              {/* Cover thumbnail upload helper */}
              <div className="w-full max-w-[280px] mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => posterInputRef.current?.click()}
                  className="w-full text-center py-2 px-3 rounded-xl bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732] text-xs font-medium border border-[#2D3732]/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ImageIcon size={13} className="text-[#8FA89B]" />
                  <span>Customize Cover Poster</span>
                </button>
                <input
                  ref={posterInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCustomPosterUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Right Column: Upload Source & Parameters */}
            <div className="lg:col-span-7 space-y-5">
              {/* Primary Video File Upload Button from Local Storage */}
              <div className="p-4 rounded-3xl bg-white border-2 border-dashed border-[#8FA89B]/40 hover:border-[#8FA89B] transition-all text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-[#8FA89B]/15 flex items-center justify-center text-[#5E7C6E]">
                    <Upload size={22} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-[#2D3732]">
                      Upload Reel from Local Storage
                    </p>
                    <p className="text-[11px] text-[#7A8A82] mt-0.5">
                      Select MP4, WebM, or MOV video files from your device
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="mt-2 px-5 py-2.5 rounded-2xl bg-[#2D3732] hover:bg-[#3d4a43] text-white text-xs font-medium transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-2"
                  >
                    <Video size={14} />
                    <span>Browse Files from Device</span>
                  </button>

                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/ogg"
                    onChange={handleLocalVideoUpload}
                    className="hidden"
                  />

                  {localVideoFile && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                      <CheckCircle2 size={13} />
                      <span className="truncate max-w-[240px] font-mono">{localVideoFile.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Or Choose a Motion Scene Preset */}
              <div>
                <label className="block text-xs font-semibold text-[#2D3732] uppercase tracking-wider mb-2">
                  Or Pick a Curated Scene
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {PRESET_REELS.map((preset) => (
                    <button
                      type="button"
                      key={preset.title}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setLocalVideoFile(null);
                        setVideoUrl(preset.videoUrl);
                        setPosterUrl(preset.posterUrl);
                        setAudioTitle(preset.audioTitle);
                        setAudioArtist(preset.audioArtist);
                        setCustomVideoUrl('');
                      }}
                      className={`p-2 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPreset?.title === preset.title && !localVideoFile
                          ? 'border-[#8FA89B] bg-[#E6EDE9]/60 ring-2 ring-[#8FA89B]/40'
                          : 'border-[#2D3732]/10 bg-white hover:bg-[#F1F5F2]'
                      }`}
                    >
                      <div className="aspect-[9/12] rounded-xl overflow-hidden mb-1.5 bg-neutral-900">
                        <img
                          src={preset.posterUrl}
                          alt={preset.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-[11px] font-semibold text-[#2D3732] truncate">
                        {preset.title}
                      </p>
                      <p className="text-[9px] text-[#7A8A82]">#{preset.defaultTag}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Caption */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#2D3732]">
                    Caption & Reflections
                  </label>
                  <span className="text-[11px] text-[#7A8A82] font-mono">
                    {caption.length}/300
                  </span>
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Describe the rhythm, process, or atmosphere of this moment..."
                  rows={2}
                  maxLength={300}
                  className="w-full bg-white border border-[#2D3732]/15 focus:border-[#8FA89B] rounded-2xl p-3.5 text-xs sm:text-sm text-[#2D3732] placeholder-[#7A8A82] transition-all focus:outline-none resize-none shadow-xs"
                />
              </div>

              {/* Soundtrack & Audio Attribution */}
              <div className="p-3.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#2D3732] flex items-center gap-1.5">
                    <Music size={13} className="text-[#8FA89B]" />
                    <span>Soundtrack Selection</span>
                  </label>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('video')}
                      className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                        audioSourceType === 'video'
                          ? 'bg-[#2D3732] text-white font-medium'
                          : 'text-[#7A8A82] hover:text-[#2D3732]'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioSourceType('ambient')}
                      className={`px-2 py-0.5 rounded-lg cursor-pointer ${
                        audioSourceType === 'ambient'
                          ? 'bg-[#2D3732] text-white font-medium'
                          : 'text-[#7A8A82] hover:text-[#2D3732]'
                      }`}
                    >
                      Presets
                    </button>
                  </div>
                </div>

                {audioSourceType === 'ambient' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {AMBIENT_AUDIO_PRESETS.map((t) => (
                      <button
                        key={t.title}
                        type="button"
                        onClick={() => {
                          setAudioTitle(t.title);
                          setAudioArtist(t.artist);
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] whitespace-nowrap border transition-colors cursor-pointer ${
                          audioTitle === t.title
                            ? 'bg-[#8FA89B] text-white border-transparent'
                            : 'bg-white text-[#55635C] border-[#2D3732]/10 hover:border-[#8FA89B]'
                        }`}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <input
                      type="text"
                      value={audioTitle}
                      onChange={(e) => setAudioTitle(e.target.value)}
                      placeholder="Audio title"
                      className="w-full bg-white rounded-xl px-3 py-2 text-xs text-[#2D3732] border border-[#2D3732]/15 focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={audioArtist}
                      onChange={(e) => setAudioArtist(e.target.value)}
                      placeholder="Audio artist"
                      className="w-full bg-white rounded-xl px-3 py-2 text-xs text-[#2D3732] border border-[#2D3732]/15 focus:outline-none focus:border-[#8FA89B]"
                    />
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-[#2D3732] mb-1.5 flex items-center gap-1.5">
                  <Tag size={12} className="text-[#8FA89B]" />
                  <span>Discovery Tags</span>
                </label>
                <input
                  type="text"
                  value={customTags}
                  onChange={(e) => setCustomTags(e.target.value)}
                  placeholder="CraftProcess, NordicForm, SlowLiving, Ceramics"
                  className="w-full bg-white rounded-2xl px-4 py-2.5 text-xs text-[#2D3732] border border-[#2D3732]/15 focus:outline-none focus:border-[#8FA89B] shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2D3732]/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#7A8A82] hover:text-[#2D3732] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs font-medium transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={14} />
              <span>{isSubmitting ? 'Uploading & Publishing...' : 'Publish Reel'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
