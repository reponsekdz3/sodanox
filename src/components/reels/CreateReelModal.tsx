import React, { useState } from 'react';
import { X, Video, Music, Tag, Sparkles } from 'lucide-react';
import { User } from '../../types';

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
  }) => void;
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

export const CreateReelModal: React.FC<CreateReelModalProps> = ({
  currentUser,
  onClose,
  onSubmitReel,
}) => {
  const [selectedPreset, setSelectedPreset] = useState(PRESET_REELS[0]);
  const [caption, setCaption] = useState('');
  const [customTags, setCustomTags] = useState('SlowLiving, CraftProcess');
  const [audioTitle, setAudioTitle] = useState(PRESET_REELS[0].audioTitle);
  const [audioArtist, setAudioArtist] = useState(PRESET_REELS[0].audioArtist);
  const [customVideoUrl, setCustomVideoUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalVideo = customVideoUrl.trim() || selectedPreset.videoUrl;
    const finalPoster = selectedPreset.posterUrl;
    const tagsArray = customTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onSubmitReel({
      videoUrl: finalVideo,
      posterUrl: finalPoster,
      caption: caption.trim() || 'A quiet moment in the studio.',
      tags: tagsArray.length > 0 ? tagsArray : ['AuraSeries', 'Makers'],
      audioTitle: audioTitle.trim() || 'Original Sound',
      audioArtist: audioArtist.trim() || currentUser.name,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#FAFAF9] rounded-3xl shadow-soft-float overflow-hidden border border-[#F1F5F2] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F2]">
          <div className="flex items-center gap-2">
            <Video size={18} className="text-[#8FA89B]" />
            <h2 className="text-base font-semibold text-[#2D3732]">Create Reel</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Preset Video Selector */}
          <div>
            <label className="block text-xs font-medium text-[#7A8A82] mb-2">
              Select Motion Scene
            </label>
            <div className="grid grid-cols-3 gap-3">
              {PRESET_REELS.map((preset) => (
                <button
                  type="button"
                  key={preset.title}
                  onClick={() => {
                    setSelectedPreset(preset);
                    setAudioTitle(preset.audioTitle);
                    setAudioArtist(preset.audioArtist);
                    setCustomVideoUrl('');
                  }}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    selectedPreset.title === preset.title && !customVideoUrl
                      ? 'border-[#8FA89B] bg-[#E6EDE9]/40 ring-2 ring-[#8FA89B]/30'
                      : 'border-[#F1F5F2] hover:bg-[#F1F5F2]'
                  }`}
                >
                  <div className="aspect-[9/12] rounded-xl overflow-hidden mb-2 bg-neutral-900">
                    <img
                      src={preset.posterUrl}
                      alt={preset.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs font-medium text-[#2D3732] truncate">{preset.title}</p>
                  <p className="text-[10px] text-[#7A8A82]">#{preset.defaultTag}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Or custom video URL */}
          <div>
            <label className="block text-xs font-medium text-[#7A8A82] mb-1.5">
              Or Custom MP4 Video URL
            </label>
            <input
              type="url"
              value={customVideoUrl}
              onChange={(e) => setCustomVideoUrl(e.target.value)}
              placeholder="https://example.com/loop.mp4"
              className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-[#FAFAF9] rounded-2xl px-4 py-2.5 text-xs text-[#2D3732] placeholder-[#7A8A82] transition-all focus:outline-none"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-xs font-medium text-[#7A8A82] mb-1.5">
              Reel Caption
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Describe the craft, scene, or rhythm..."
              rows={3}
              maxLength={200}
              className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-[#FAFAF9] rounded-2xl p-3.5 text-xs sm:text-sm text-[#2D3732] placeholder-[#7A8A82] transition-all focus:outline-none resize-none"
            />
          </div>

          {/* Audio Track */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7A8A82] mb-1 flex items-center gap-1">
                <Music size={12} />
                <span>Audio Title</span>
              </label>
              <input
                type="text"
                value={audioTitle}
                onChange={(e) => setAudioTitle(e.target.value)}
                placeholder="Track name"
                className="w-full bg-[#F1F5F2] rounded-xl px-3 py-2 text-xs text-[#2D3732] focus:outline-none border border-transparent focus:border-[#8FA89B]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7A8A82] mb-1 flex items-center gap-1">
                <Sparkles size={12} />
                <span>Audio Artist</span>
              </label>
              <input
                type="text"
                value={audioArtist}
                onChange={(e) => setAudioArtist(e.target.value)}
                placeholder="Artist name"
                className="w-full bg-[#F1F5F2] rounded-xl px-3 py-2 text-xs text-[#2D3732] focus:outline-none border border-transparent focus:border-[#8FA89B]"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-[#7A8A82] mb-1 flex items-center gap-1">
              <Tag size={12} />
              <span>Tags (comma separated)</span>
            </label>
            <input
              type="text"
              value={customTags}
              onChange={(e) => setCustomTags(e.target.value)}
              placeholder="CraftProcess, StudioAcoustics, SlowDesign"
              className="w-full bg-[#F1F5F2] rounded-xl px-3 py-2 text-xs text-[#2D3732] focus:outline-none border border-transparent focus:border-[#8FA89B]"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F1F5F2]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#7A8A82] hover:text-[#2D3732] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs font-medium transition-all shadow-soft active:scale-[0.98]"
            >
              Publish Reel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
