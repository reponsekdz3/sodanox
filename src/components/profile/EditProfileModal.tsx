import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Check, Image as ImageIcon, Shield, Sparkles } from 'lucide-react';
import { User } from '../../types';
import { checkUsernameAvailable } from '../../services/userService';

interface EditProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onSave: (updatedUser: Partial<User>) => Promise<void> | void;
}

const PRESET_BANNERS = [
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80',
];

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  currentUser,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(currentUser.name || '');
  const [username, setUsername] = useState(currentUser.username || '');
  const [pronouns, setPronouns] = useState(currentUser.pronouns || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [location, setLocation] = useState(currentUser.location || '');
  const [website, setWebsite] = useState(currentUser.website || '');
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar || '');
  const [bannerUrl, setBannerUrl] = useState(
    currentUser.bannerUrl || PRESET_BANNERS[0]
  );
  const [privateAccount, setPrivateAccount] = useState(currentUser.privateAccount || false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        setError('Please choose an avatar under 3MB');
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        setError('Please choose a header under 4MB');
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setBannerUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (cleanUsername !== currentUser.username) {
        const isAvailable = await checkUsernameAvailable(cleanUsername, currentUser.id);
        if (!isAvailable) {
          setError('This username is already taken by another creator');
          setIsSaving(false);
          return;
        }
      }

      await onSave({
        name: name.trim(),
        username: cleanUsername,
        pronouns: pronouns.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        avatar: avatarUrl,
        bannerUrl,
        privateAccount,
      });
      onClose();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to save profile changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#FAFAF9] rounded-3xl shadow-2xl overflow-hidden border border-[#2D3732]/10 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D3732]/10 bg-[#F1F5F2]">
          <div>
            <h2 className="text-base font-serif font-semibold text-[#2D3732]">
              Customize Profile & Studio
            </h2>
            <p className="text-[11px] text-[#7A8A82]">
              Personalize your aesthetic banner, avatar, and creator bio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Banner & Avatar Combined Hero Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#2D3732] uppercase tracking-wider">
                Header Banner & Studio Cover
              </label>
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="text-xs text-[#8FA89B] hover:text-[#7a9486] font-medium flex items-center gap-1"
              >
                <Upload size={13} />
                <span>Upload Banner</span>
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerChange}
                className="hidden"
              />
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-[#2D3732]/15 shadow-sm group">
              <img
                src={bannerUrl}
                alt="Banner preview"
                className="w-full h-28 sm:h-32 object-cover"
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white/90 text-xs font-medium text-[#2D3732] shadow-sm flex items-center gap-1.5"
                >
                  <Camera size={14} />
                  <span>Change Banner</span>
                </button>
              </div>

              {/* Avatar anchored onto banner */}
              <div className="absolute bottom-2 left-4">
                <div className="relative group/avatar">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md ring-2 ring-[#8FA89B]"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white"
                  >
                    <Camera size={16} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Banner Presets */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
              <span className="text-[11px] text-[#7A8A82] shrink-0">Studio Presets:</span>
              {PRESET_BANNERS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setBannerUrl(preset)}
                  className={`w-12 h-7 rounded-lg overflow-hidden border-2 shrink-0 transition-transform ${
                    bannerUrl === preset ? 'border-[#8FA89B] scale-105 shadow-sm' : 'border-transparent opacity-75 hover:opacity-100'
                  }`}
                >
                  <img src={preset} alt="preset" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Name & Pronouns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#2D3732] mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2D3732] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2D3732] mb-1">
                Pronouns
              </label>
              <input
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="she/her, they/them"
                className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2D3732] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-medium text-[#2D3732] mb-1">
              Handle / Username *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#7A8A82]">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                required
                className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-white rounded-xl pl-8 pr-3.5 py-2.5 text-xs sm:text-sm text-[#2D3732] focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Short Bio */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-[#2D3732]">
                Bio & Focus Statement
              </label>
              <span className="text-[10px] text-[#7A8A82] tabular-nums">
                {bio.length}/200
              </span>
            </div>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="Ceramicist, architectural photographer, slow design explorer..."
              className="w-full bg-[#F1F5F2] border border-transparent focus:border-[#8FA89B] focus:bg-white rounded-xl p-3 text-xs sm:text-sm text-[#2D3732] focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Location & Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#2D3732] mb-1">
                Studio Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Kyoto, Japan"
                className="w-full bg-[#F1F5F2] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B] focus:bg-white border border-transparent transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#2D3732] mb-1">
                Studio Website / Portfolio
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://elenarostova.design"
                className="w-full bg-[#F1F5F2] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#2D3732] focus:outline-none focus:border-[#8FA89B] focus:bg-white border border-transparent transition-colors"
              />
            </div>
          </div>

          {/* Privacy Toggle */}
          <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-[#8FA89B]" />
              <div>
                <div className="text-xs font-semibold text-[#2D3732]">Private Account</div>
                <div className="text-[11px] text-[#7A8A82]">
                  Only approved followers will see your private posts and reels
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={privateAccount}
                onChange={(e) => setPrivateAccount(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
            </label>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2D3732]/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#7A8A82] hover:text-[#2D3732]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#2D3732] text-[#FAFAF9] text-xs font-medium hover:bg-[#8FA89B] shadow-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <Check size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
