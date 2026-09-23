import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Type,
  Sparkles,
  Music,
  MapPin,
  AtSign,
  HelpCircle,
  BarChart2,
  Smile,
  Check,
  Palette,
  Sliders,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { User, StoryItem, StoryFilter, StorySticker, StoryTextOverlay } from '../../types';

interface CreateStoryModalProps {
  currentUser: User;
  onClose: () => void;
  onAddStory: (newItem: StoryItem) => void;
}

const CANVAS_BACKGROUNDS = [
  { name: 'Studio Slate', gradient: 'from-[#2D3732] to-[#1C2420]' },
  { name: 'Warm Linen', gradient: 'from-[#EFECE6] to-[#DDD7CD]' },
  { name: 'Nordic Sage', gradient: 'from-[#8FA89B] to-[#5C7567]' },
  { name: 'Terracotta Ash', gradient: 'from-[#C27D60] to-[#8C4E35]' },
  { name: 'Obsidian Noir', gradient: 'from-[#191919] to-[#0A0A0A]' },
  { name: 'Dusk Lavender', gradient: 'from-[#888DA7] to-[#575C75]' },
];

const FILTER_CLASSES: Record<StoryFilter, string> = {
  none: '',
  vintage: 'sepia-[0.35] contrast-[1.15] brightness-[0.95]',
  nordic: 'saturate-[0.65] contrast-[0.95] brightness-[1.05]',
  noir: 'grayscale contrast-[1.25]',
  golden: 'sepia-[0.3] saturate-[1.4] brightness-[1.05]',
  sepia: 'sepia-[0.7] contrast-[0.9]',
  emerald: 'hue-rotate-[25deg] saturate-[1.2]',
};

const AMBIENT_SOUNDTRACKS = [
  { title: 'An Ending (Ascent)', artist: 'Brian Eno' },
  { title: 'Says (Studio Live)', artist: 'Nils Frahm' },
  { title: 'Slow Water & Stone', artist: 'Nordic Soundscapes' },
  { title: 'Morning Light In Kyoto', artist: 'Quiet Archive' },
  { title: 'Felt & Acoustic Wood', artist: 'Studio Ambience' },
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  currentUser,
  onClose,
  onAddStory,
}) => {
  // Media source state
  const [mediaType, setMediaType] = useState<'image' | 'canvas'>('image');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [selectedBgGradient, setSelectedBgGradient] = useState(CANVAS_BACKGROUNDS[0].gradient);

  // Styling state
  const [activeFilter, setActiveFilter] = useState<StoryFilter>('none');
  const [caption, setCaption] = useState('');
  const [moodTag, setMoodTag] = useState('Studio Craft');

  // Text overlay state
  const [showTextTool, setShowTextTool] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [textFont, setTextFont] = useState<'sans' | 'serif' | 'mono' | 'hand' | 'display'>('serif');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textHasBg, setTextHasBg] = useState(true);

  // Interactive stickers state
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [activeStickerModal, setActiveStickerModal] = useState<
    'none' | 'poll' | 'question' | 'music' | 'location' | 'mention' | 'emoji_slider'
  >('none');

  // Poll form state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('Yes');
  const [pollOpt2, setPollOpt2] = useState('No');

  // Question form state
  const [questionPrompt, setQuestionPrompt] = useState('Ask me anything...');

  // Location & Mention state
  const [locationName, setLocationName] = useState('');
  const [mentionName, setMentionName] = useState('');

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize camera if requested
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setIsCameraActive(false);
    }
  };

  const captureCameraSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 720;
    canvas.height = videoRef.current.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      setMediaUrl(dataUrl);
      setMediaType('image');
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setMediaUrl(dataUrl);
        setMediaType('image');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const generateCanvasMedia = (): string => {
    if (mediaType === 'image' && mediaUrl) {
      return mediaUrl;
    }
    // Render solid or gradient canvas as a dataUrl
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
      gradient.addColorStop(0, '#2D3732');
      gradient.addColorStop(1, '#1C2420');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1080, 1920);
      return canvas.toDataURL('image/jpeg', 0.9);
    }
    return '';
  };

  // Sticker creation handlers
  const handleAddPoll = () => {
    if (!pollQuestion.trim()) return;
    const newSticker: StorySticker = {
      id: `sticker_poll_${Date.now()}`,
      type: 'poll',
      data: {
        question: pollQuestion.trim(),
        options: [
          { id: 'opt_1', text: pollOpt1.trim() || 'Option 1', votes: 0 },
          { id: 'opt_2', text: pollOpt2.trim() || 'Option 2', votes: 0 },
        ],
        userVotes: {},
      },
    };
    setStickers((prev) => [...prev, newSticker]);
    setActiveStickerModal('none');
    setPollQuestion('');
  };

  const handleAddQuestion = () => {
    if (!questionPrompt.trim()) return;
    const newSticker: StorySticker = {
      id: `sticker_q_${Date.now()}`,
      type: 'question',
      data: {
        question: questionPrompt.trim(),
        answers: [],
      },
    };
    setStickers((prev) => [...prev, newSticker]);
    setActiveStickerModal('none');
    setQuestionPrompt('');
  };

  const handleAddMusic = (track: { title: string; artist: string }) => {
    const newSticker: StorySticker = {
      id: `sticker_music_${Date.now()}`,
      type: 'music',
      data: {
        trackTitle: track.title,
        artist: track.artist,
      },
    };
    setStickers((prev) => [...prev, newSticker]);
    setActiveStickerModal('none');
  };

  const handleAddLocation = () => {
    if (!locationName.trim()) return;
    const newSticker: StorySticker = {
      id: `sticker_loc_${Date.now()}`,
      type: 'location',
      data: {
        locationName: locationName.trim(),
      },
    };
    setStickers((prev) => [...prev, newSticker]);
    setActiveStickerModal('none');
    setLocationName('');
  };

  const handleAddMention = () => {
    if (!mentionName.trim()) return;
    const cleanMention = mentionName.trim().replace(/^@/, '');
    const newSticker: StorySticker = {
      id: `sticker_men_${Date.now()}`,
      type: 'mention',
      data: {
        username: cleanMention,
      },
    };
    setStickers((prev) => [...prev, newSticker]);
    setActiveStickerModal('none');
    setMentionName('');
  };

  const handleAddEmojiSlider = (emoji: string) => {
    const newSticker: StorySticker = {
      id: `sticker_slider_${Date.now()}`,
      type: 'emoji_slider',
      data: {
        emoji,
        question: 'Rate the vibe',
        sliderValue: 50,
      },
    };
    setStickers((prev) => [...prev, newSticker]);
    setActiveStickerModal('none');
  };

  const handleRemoveSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
  };

  const handlePublishStory = () => {
    const finalMediaUrl = mediaUrl || generateCanvasMedia();
    if (!finalMediaUrl) return;

    let textOverlayObj: StoryTextOverlay | undefined;
    if (overlayText.trim()) {
      textOverlayObj = {
        text: overlayText.trim(),
        font: textFont,
        color: textColor,
        hasBackground: textHasBg,
        align: 'center',
      };
    }

    const newItem: StoryItem = {
      id: `story_item_${Date.now()}`,
      mediaUrl: finalMediaUrl,
      type: 'image',
      timestamp: 'Just now',
      caption: caption.trim() || undefined,
      moodTag,
      filter: activeFilter !== 'none' ? activeFilter : undefined,
      stickers: stickers.length > 0 ? stickers : undefined,
      textOverlay: textOverlayObj,
    };

    onAddStory(newItem);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="relative w-full max-w-lg h-[92vh] max-h-[850px] bg-[#1C2420] text-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10">
        {/* Top Control Bar */}
        <div className="h-14 px-4 flex items-center justify-between z-30 bg-gradient-to-b from-black/60 to-transparent">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={20} />
          </button>

          {/* Tool actions on top */}
          <div className="flex items-center gap-2">
            {/* Text tool toggle */}
            <button
              type="button"
              onClick={() => setShowTextTool(!showTextTool)}
              className={`p-2 rounded-full transition-colors ${
                showTextTool || overlayText ? 'bg-[#8FA89B] text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Add text overlay"
            >
              <Type size={18} />
            </button>

            {/* Stickers modal trigger */}
            <button
              type="button"
              onClick={() => setActiveStickerModal('poll')}
              className={`p-2 rounded-full transition-colors ${
                stickers.length > 0 ? 'bg-[#8FA89B] text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Add interactive stickers"
            >
              <Smile size={18} />
            </button>

            {/* Filter picker toggle */}
            <div className="relative group">
              <button
                type="button"
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                title="Color filters"
              >
                <Sliders size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Story Canvas / Preview Area */}
        <div className="relative flex-1 w-full bg-black overflow-hidden flex items-center justify-center">
          {/* Active Camera Preview */}
          {isCameraActive ? (
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-full bg-white/20 text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={captureCameraSnapshot}
                  className="w-16 h-16 rounded-full border-4 border-white bg-red-500 hover:scale-105 active:scale-95 transition-transform shadow-lg"
                />
              </div>
            </div>
          ) : mediaUrl ? (
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={mediaUrl}
                alt="Story preview"
                className={`w-full h-full object-cover transition-all ${FILTER_CLASSES[activeFilter]}`}
              />
            </div>
          ) : (
            /* Solid / Gradient Canvas fallback */
            <div
              className={`w-full h-full bg-gradient-to-br ${selectedBgGradient} flex flex-col items-center justify-center p-8 text-center`}
            >
              <div className="max-w-xs space-y-4">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-white/10 border border-white/20 flex items-center justify-center text-white/80">
                  <Camera size={32} />
                </div>
                <h3 className="font-serif text-xl font-light text-white">Create Your Story</h3>
                <p className="text-xs text-white/70 leading-relaxed">
                  Upload high-res photography, open your camera, or design a minimalist studio quote slide.
                </p>

                <div className="flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-2xl bg-white text-[#2D3732] text-xs font-medium hover:bg-neutral-100 flex items-center justify-center gap-2 shadow-md"
                  >
                    <Upload size={16} />
                    <span>Upload Photo / Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-3 px-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-medium border border-white/20 flex items-center justify-center gap-2"
                  >
                    <Camera size={16} />
                    <span>Open Camera Snapshot</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileUpload}
          />

          {/* Render Text Overlay on Canvas */}
          {overlayText && (
            <div className="absolute inset-x-6 top-1/3 z-20 flex justify-center pointer-events-none">
              <div
                className={`px-4 py-2.5 rounded-2xl text-center max-w-sm ${
                  textHasBg ? 'bg-black/60 backdrop-blur-md border border-white/15' : 'drop-shadow-lg'
                }`}
                style={{
                  color: textColor,
                  fontFamily:
                    textFont === 'serif'
                      ? 'Playfair Display, serif'
                      : textFont === 'mono'
                      ? 'monospace'
                      : 'sans-serif',
                }}
              >
                <p className="text-base sm:text-xl font-medium tracking-wide leading-relaxed">
                  {overlayText}
                </p>
              </div>
            </div>
          )}

          {/* Render Active Interactive Stickers */}
          <div className="absolute inset-x-4 top-24 bottom-32 z-20 flex flex-col items-center justify-center gap-4 pointer-events-none">
            {stickers.map((s) => (
              <div
                key={s.id}
                className="relative group pointer-events-auto cursor-default animate-fade-in"
              >
                {/* Delete button on hover */}
                <button
                  type="button"
                  onClick={() => handleRemoveSticker(s.id)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md z-30 opacity-80 hover:opacity-100"
                >
                  <X size={12} />
                </button>

                {/* Poll Sticker rendering */}
                {s.type === 'poll' && (
                  <div className="w-64 bg-white/90 backdrop-blur-md text-[#2D3732] rounded-2xl p-4 shadow-xl border border-white/40">
                    <div className="font-serif text-sm font-semibold text-center mb-3">
                      {s.data.question}
                    </div>
                    <div className="space-y-2">
                      {s.data.options?.map((opt) => (
                        <div
                          key={opt.id}
                          className="w-full py-2 px-3 rounded-xl bg-[#F1F5F2] font-medium text-xs text-center border border-[#2D3732]/10"
                        >
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Question Sticker rendering */}
                {s.type === 'question' && (
                  <div className="w-64 bg-gradient-to-br from-[#8FA89B] to-[#6b8577] text-white rounded-2xl p-4 shadow-xl border border-white/20">
                    <div className="text-xs uppercase tracking-wider text-white/80 font-mono text-center mb-1">
                      Aura Question
                    </div>
                    <div className="text-sm font-serif font-medium text-center mb-3">
                      {s.data.question}
                    </div>
                    <div className="py-2 px-3 rounded-xl bg-white/20 text-white/80 text-xs text-center">
                      Type something...
                    </div>
                  </div>
                )}

                {/* Music Sticker rendering */}
                {s.type === 'music' && (
                  <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/20 text-white shadow-xl">
                    <div className="w-7 h-7 rounded-full bg-[#8FA89B] flex items-center justify-center text-white shrink-0">
                      <Music size={14} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{s.data.trackTitle}</div>
                      <div className="text-[10px] text-white/70">{s.data.artist}</div>
                    </div>
                  </div>
                )}

                {/* Location Sticker rendering */}
                {s.type === 'location' && (
                  <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[#2D3732] shadow-xl border border-white/40">
                    <MapPin size={14} className="text-[#8FA89B]" />
                    <span className="text-xs font-semibold">{s.data.locationName}</span>
                  </div>
                )}

                {/* Mention Sticker rendering */}
                {s.type === 'mention' && (
                  <div className="flex items-center gap-1.5 bg-[#8FA89B] text-white px-4 py-2 rounded-full shadow-xl font-mono text-xs font-bold">
                    <span>@{s.data.username}</span>
                  </div>
                )}

                {/* Emoji slider rendering */}
                {s.type === 'emoji_slider' && (
                  <div className="w-60 bg-black/75 backdrop-blur-md text-white rounded-2xl p-3.5 shadow-xl border border-white/20">
                    <div className="text-xs text-center font-medium mb-2">{s.data.question}</div>
                    <div className="relative h-2 bg-white/30 rounded-full flex items-center">
                      <div className="absolute left-1/2 -translate-x-1/2 text-2xl -top-3">
                        {s.data.emoji}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Text Tool Drawer */}
        {showTextTool && (
          <div className="p-4 bg-[#232B26] border-t border-white/10 space-y-3 z-30 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-white/60">
                Text Overlay
              </span>
              <button
                type="button"
                onClick={() => setShowTextTool(false)}
                className="text-xs text-[#8FA89B]"
              >
                Done
              </button>
            </div>
            <input
              type="text"
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              placeholder="Tap to type text overlay..."
              className="w-full px-3.5 py-2 rounded-xl bg-white/10 text-white text-xs sm:text-sm border border-white/20 focus:outline-none focus:border-[#8FA89B]"
            />
            <div className="flex items-center justify-between gap-2">
              {/* Font picker */}
              <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                {(['serif', 'sans', 'mono'] as const).map((font) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => setTextFont(font)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors capitalize ${
                      textFont === font ? 'bg-white text-[#2D3732] font-semibold' : 'text-white/70'
                    }`}
                  >
                    {font}
                  </button>
                ))}
              </div>

              {/* Background badge toggle */}
              <button
                type="button"
                onClick={() => setTextHasBg(!textHasBg)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
                  textHasBg ? 'bg-white/20 border-white text-white' : 'border-white/20 text-white/60'
                }`}
              >
                Highlight
              </button>
            </div>
          </div>
        )}

        {/* Filter Pills row */}
        {mediaUrl && (
          <div className="px-4 py-2 bg-[#1C2420] border-t border-white/10 flex items-center gap-2 overflow-x-auto z-20">
            {(['none', 'vintage', 'nordic', 'noir', 'golden', 'sepia', 'emerald'] as StoryFilter[]).map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all capitalize ${
                    activeFilter === f
                      ? 'bg-white text-[#2D3732] font-semibold shadow-sm'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  }`}
                >
                  {f}
                </button>
              )
            )}
          </div>
        )}

        {/* Bottom Publish & Caption Bar */}
        <div className="p-4 bg-[#232B26] border-t border-white/10 space-y-3 z-30">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add story caption (optional)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 text-white placeholder-white/40 text-xs sm:text-sm border border-white/15 focus:outline-none focus:border-[#8FA89B]"
            />
            <button
              type="button"
              onClick={handlePublishStory}
              disabled={!mediaUrl && mediaType !== 'canvas'}
              className="py-2.5 px-5 rounded-xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs sm:text-sm font-medium transition-all shadow-md flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <span>Share Story</span>
              <Check size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Sticker Configuration Modals */}
      {activeStickerModal !== 'none' && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#FAFAF9] text-[#2D3732] rounded-3xl p-6 shadow-2xl border border-black/10 animate-fade-in">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif text-lg font-medium text-[#2D3732] capitalize">
                {activeStickerModal.replace('_', ' ')} Sticker
              </h4>
              <button
                type="button"
                onClick={() => setActiveStickerModal('none')}
                className="p-1.5 rounded-full hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sticker selector tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 border-b border-black/10">
              {(
                [
                  { id: 'poll', label: 'Poll', icon: BarChart2 },
                  { id: 'question', label: 'Question', icon: HelpCircle },
                  { id: 'music', label: 'Music', icon: Music },
                  { id: 'location', label: 'Location', icon: MapPin },
                  { id: 'mention', label: 'Mention', icon: AtSign },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveStickerModal(tab.id)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0 ${
                      activeStickerModal === tab.id
                        ? 'bg-[#2D3732] text-white'
                        : 'bg-[#F1F5F2] text-[#7A8A82]'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Poll Content */}
            {activeStickerModal === 'poll' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#2D3732] mb-1">Question</label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="E.g., Wood kiln or gas kiln?"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs text-[#2D3732] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#7A8A82] mb-1">Option 1</label>
                    <input
                      type="text"
                      value={pollOpt1}
                      onChange={(e) => setPollOpt1(e.target.value)}
                      placeholder="Option 1"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#7A8A82] mb-1">Option 2</label>
                    <input
                      type="text"
                      value={pollOpt2}
                      onChange={(e) => setPollOpt2(e.target.value)}
                      placeholder="Option 2"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddPoll}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#2D3732] text-white text-xs font-medium"
                >
                  Place Poll Sticker
                </button>
              </div>
            )}

            {/* Question Content */}
            {activeStickerModal === 'question' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#2D3732] mb-1">Question Prompt</label>
                  <input
                    type="text"
                    value={questionPrompt}
                    onChange={(e) => setQuestionPrompt(e.target.value)}
                    placeholder="Ask me anything about my pottery..."
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs text-[#2D3732] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#2D3732] text-white text-xs font-medium"
                >
                  Place Question Sticker
                </button>
              </div>
            )}

            {/* Music Content */}
            {activeStickerModal === 'music' && (
              <div className="space-y-2">
                <div className="text-xs text-[#7A8A82] mb-1">Select studio track soundtrack:</div>
                {AMBIENT_SOUNDTRACKS.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddMusic(t)}
                    className="w-full p-2.5 rounded-xl hover:bg-[#F1F5F2] border border-transparent hover:border-[#2D3732]/10 text-left flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-[#2D3732]">{t.title}</div>
                      <div className="text-[11px] text-[#7A8A82]">{t.artist}</div>
                    </div>
                    <Music size={14} className="text-[#8FA89B]" />
                  </button>
                ))}
              </div>
            )}

            {/* Location Content */}
            {activeStickerModal === 'location' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#2D3732] mb-1">City or Studio Location</label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Kyoto, Japan"
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs text-[#2D3732] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLocation}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#2D3732] text-white text-xs font-medium"
                >
                  Place Location Tag
                </button>
              </div>
            )}

            {/* Mention Content */}
            {activeStickerModal === 'mention' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#2D3732] mb-1">Member Username</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7A8A82]">
                      @
                    </span>
                    <input
                      type="text"
                      value={mentionName}
                      onChange={(e) => setMentionName(e.target.value)}
                      placeholder="clarachen"
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-[#2D3732]/15 text-xs text-[#2D3732] focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddMention}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#2D3732] text-white text-xs font-medium"
                >
                  Place Mention Sticker
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
