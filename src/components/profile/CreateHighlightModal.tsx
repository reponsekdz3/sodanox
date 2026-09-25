import React, { useState } from 'react';
import { X, Sparkles, Upload, Check, Image as ImageIcon } from 'lucide-react';
import { StoryItem, User } from '../../types';
import { createStoryHighlight } from '../../services/storyService';

interface CreateHighlightModalProps {
  currentUser: User;
  onClose: () => void;
  onCreated: () => void;
  availableStories?: StoryItem[];
}

const MODERN_HIGHLIGHT_COVERS = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%238FA89B"/><stop offset="100%" stop-color="%235C7567"/></linearGradient></defs><rect width="200" height="200" fill="url(%23g1)"/><circle cx="100" cy="100" r="32" fill="white" fill-opacity="0.2"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%232D3732"/><stop offset="100%" stop-color="%2319201C"/></linearGradient></defs><rect width="200" height="200" fill="url(%23g2)"/><circle cx="100" cy="100" r="32" fill="white" fill-opacity="0.2"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23C27D60"/><stop offset="100%" stop-color="%238C4E35"/></linearGradient></defs><rect width="200" height="200" fill="url(%23g3)"/><circle cx="100" cy="100" r="32" fill="white" fill-opacity="0.2"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23EFECE6"/><stop offset="100%" stop-color="%23DDD7CD"/></linearGradient></defs><rect width="200" height="200" fill="url(%23g4)"/><circle cx="100" cy="100" r="32" fill="%232D3732" fill-opacity="0.15"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23888DA7"/><stop offset="100%" stop-color="%23575C75"/></linearGradient></defs><rect width="200" height="200" fill="url(%23g5)"/><circle cx="100" cy="100" r="32" fill="white" fill-opacity="0.2"/></svg>',
];

export const CreateHighlightModal: React.FC<CreateHighlightModalProps> = ({
  currentUser,
  onClose,
  onCreated,
  availableStories = [],
}) => {
  const [title, setTitle] = useState('');
  const [selectedCover, setSelectedCover] = useState(
    availableStories[0]?.mediaUrl || MODERN_HIGHLIGHT_COVERS[0]
  );
  const [customCoverUrl, setCustomCoverUrl] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>(
    availableStories.length > 0 ? [availableStories[0].id] : []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCustomCoverUrl(dataUrl);
      setSelectedCover(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      if (!customCoverUrl && next.length > 0) {
        const firstSelected = availableStories.find((s) => s.id === next[0]);
        if (firstSelected?.mediaUrl) {
          setSelectedCover(firstSelected.mediaUrl);
        }
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please provide a title for your highlight collection.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const coverUrl = customCoverUrl || selectedCover;
      // Filter chosen stories or create an initial item
      const chosenItems: StoryItem[] = availableStories.filter((s) =>
        selectedItems.includes(s.id)
      );

      const itemsToSave: StoryItem[] =
        chosenItems.length > 0
          ? chosenItems
          : [
              {
                id: `hl_item_${Date.now()}`,
                mediaUrl: coverUrl,
                type: 'image',
                timestamp: 'Curated highlight',
                caption: title.trim(),
              },
            ];

      await createStoryHighlight(currentUser.id, title.trim(), coverUrl, itemsToSave);
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creating story highlight:', err);
      setErrorMsg(err.message || 'Could not save highlight. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="relative w-full max-w-md bg-[#FAFAF9] rounded-3xl border border-[#E6EDE9] shadow-soft overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6EDE9]">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#8FA89B]" />
            <h3 className="font-serif font-medium text-base text-[#2D3732]">
              New Story Highlight
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-black/5"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-red-50 text-red-700 text-xs border border-red-200">
              {errorMsg}
            </div>
          )}

          {/* Highlight Cover Preview */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#8FA89B] to-[#5C7567] shadow-soft">
              <img
                src={customCoverUrl || selectedCover}
                alt="Highlight cover"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F1F5F2] hover:bg-[#E6EDE9] text-[#2D3732] text-xs font-medium rounded-xl cursor-pointer border border-[#E6EDE9]">
              <Upload size={13} />
              <span>Upload Custom Cover</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Preset covers palette */}
          <div>
            <label className="block text-xs font-medium text-[#7A8A82] mb-1.5">
              Or Choose Curated Palette Cover
            </label>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {MODERN_HIGHLIGHT_COVERS.map((cov, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSelectedCover(cov);
                    setCustomCoverUrl('');
                  }}
                  className={`relative w-12 h-12 rounded-full overflow-hidden shrink-0 border-2 transition-transform cursor-pointer ${
                    selectedCover === cov && !customCoverUrl
                      ? 'border-[#8FA89B] scale-105'
                      : 'border-transparent hover:scale-105'
                  }`}
                >
                  <img src={cov} alt="Palette cover" className="w-full h-full object-cover" />
                  {selectedCover === cov && !customCoverUrl && (
                    <div className="absolute inset-0 bg-[#8FA89B]/40 flex items-center justify-center text-white">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-medium text-[#7A8A82] mb-1">
              Highlight Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Kyoto 2026, Ceramic Notes, Moments"
              maxLength={30}
              className="w-full px-4 py-2.5 rounded-2xl bg-white border border-[#E6EDE9] text-xs text-[#2D3732] placeholder-[#7A8A82]/60 focus:outline-none focus:border-[#8FA89B]"
            />
          </div>

          {/* Story Selection if available */}
          {availableStories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#7A8A82] mb-1.5">
                Include Stories ({selectedItems.length} selected)
              </label>
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1">
                {availableStories.map((item) => {
                  const isChecked = selectedItems.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleSelectItem(item.id)}
                      className={`relative aspect-[9/16] rounded-xl overflow-hidden border-2 cursor-pointer ${
                        isChecked ? 'border-[#8FA89B]' : 'border-transparent opacity-70'
                      }`}
                    >
                      <img
                        src={item.mediaUrl}
                        alt="Story item"
                        className="w-full h-full object-cover"
                      />
                      {isChecked && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-[#8FA89B] rounded-full flex items-center justify-center text-white">
                          <Check size={10} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6EDE9]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#7A8A82] hover:bg-black/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-5 py-2 rounded-xl bg-[#8FA89B] hover:bg-[#7e9689] disabled:opacity-50 text-white text-xs font-medium shadow-soft cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Highlight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
