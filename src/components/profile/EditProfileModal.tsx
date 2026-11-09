import React, { useState, useRef } from 'react';
import { X, Camera, Upload, Check, Shield, Sparkles } from 'lucide-react';
import { User } from '../../types';
import { checkUsernameAvailable } from '../../services/userService';
import { ModernAvatar, MODERN_EMPTY_AVATAR_DATA_URI } from '../common/ModernAvatar';
import { compressImage, uploadMediaToFirebase } from '../../services/mediaCompressionService';
import { UploadProgressBar } from '../common/UploadProgressBar';

interface EditProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onSave: (updatedUser: Partial<User>) => Promise<void> | void;
}

const PRESET_BANNERS = [
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><defs><linearGradient id="b1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23064E3B"/><stop offset="50%" stop-color="%23059669"/><stop offset="100%" stop-color="%23022C22"/></linearGradient></defs><rect width="1200" height="400" fill="url(%23b1)"/><circle cx="1050" cy="80" r="140" fill="%2334D399" fill-opacity="0.15"/><circle cx="150" cy="350" r="180" fill="%236EE7B7" fill-opacity="0.1"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><defs><linearGradient id="b2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23065F46"/><stop offset="50%" stop-color="%23047857"/><stop offset="100%" stop-color="%2310B981"/></linearGradient></defs><rect width="1200" height="400" fill="url(%23b2)"/><circle cx="850" cy="200" r="160" fill="white" fill-opacity="0.12"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><defs><linearGradient id="b3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23022C22"/><stop offset="60%" stop-color="%23064E3B"/><stop offset="100%" stop-color="%2334D399"/></linearGradient></defs><rect width="1200" height="400" fill="url(%23b3)"/><circle cx="600" cy="200" r="220" fill="%23059669" fill-opacity="0.2"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><defs><linearGradient id="b4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23134E4A"/><stop offset="50%" stop-color="%23047857"/><stop offset="100%" stop-color="%23A7F3D0"/></linearGradient></defs><rect width="1200" height="400" fill="url(%23b4)"/></svg>',
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400"><defs><linearGradient id="b5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23111827"/><stop offset="100%" stop-color="%23064E3B"/></linearGradient></defs><rect width="1200" height="400" fill="url(%23b5)"/><circle cx="1000" cy="150" r="120" fill="%2310B981" fill-opacity="0.2"/></svg>',
];

const PRESET_AVATARS = [
  { name: 'Default', url: MODERN_EMPTY_AVATAR_DATA_URI },
  {
    name: 'Emerald Core',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="a1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23064E3B"/><stop offset="100%" stop-color="%23059669"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(%23a1)"/><circle cx="100" cy="85" r="34" fill="%23D1FAE5"/><path d="M45 165 C55 125, 145 125, 155 165" fill="%2334D399" opacity="0.85"/></svg>',
  },
  {
    name: 'Forest Jade',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="a2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23022C22"/><stop offset="100%" stop-color="%2310B981"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(%23a2)"/><circle cx="100" cy="100" r="44" stroke="%236EE7B7" stroke-width="4" fill="none"/><circle cx="100" cy="100" r="18" fill="%23D1FAE5"/></svg>',
  },
  {
    name: 'Mint Star',
    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="a3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23065F46"/><stop offset="100%" stop-color="%2334D399"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(%23a3)"/><polygon points="100,45 115,80 155,85 125,115 132,155 100,135 68,155 75,115 45,85 85,80" fill="%23FFFFFF" opacity="0.9"/></svg>',
  },
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
  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar || MODERN_EMPTY_AVATAR_DATA_URI);
  const [bannerUrl, setBannerUrl] = useState(
    currentUser.bannerUrl || PRESET_BANNERS[0]
  );
  const [privateAccount, setPrivateAccount] = useState(currentUser.privateAccount || false);

  // Live progress states
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUploadPercent, setAvatarUploadPercent] = useState(0);
  const [avatarUploadStatus, setAvatarUploadStatus] = useState('Optimizing avatar...');
  const [avatarBytes, setAvatarBytes] = useState<{ trans?: number; tot?: number; savings?: number }>({});

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploadingAvatar(true);
    setAvatarUploadPercent(10);
    setAvatarUploadStatus('Reading avatar file...');

    try {
      const compressed = await compressImage(file, {
        maxDimension: 512,
        quality: 0.88,
        aspectRatio: '1:1',
        preferWebp: true,
        onProgress: (pct, status) => {
          setAvatarUploadPercent(Math.min(50, Math.round(pct * 0.5)));
          setAvatarUploadStatus(status);
        },
      });

      setAvatarUploadPercent(55);
      setAvatarUploadStatus('Storing compressed avatar...');

      const res = await uploadMediaToFirebase(
        compressed.blob,
        `users/${currentUser.id}/avatar_${Date.now()}.webp`,
        (pct, trans, tot) => {
          setAvatarUploadPercent(Math.min(99, Math.round(55 + pct * 0.44)));
          setAvatarBytes({ trans, tot, savings: compressed.savingsPercent });
        }
      );

      setAvatarUploadPercent(100);
      setAvatarUploadStatus('Avatar updated successfully!');
      setAvatarUrl(res.url);
      setAvatarBytes({ savings: compressed.savingsPercent });
    } catch {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setTimeout(() => {
        setIsUploadingAvatar(false);
      }, 700);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      const compressed = await compressImage(file, {
        maxDimension: 1600,
        quality: 0.86,
        aspectRatio: '16:9',
        preferWebp: true,
      });
      const res = await uploadMediaToFirebase(
        compressed.blob,
        `users/${currentUser.id}/banner_${Date.now()}.webp`
      );
      setBannerUrl(res.url);
    } catch {
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
    <div className="fixed inset-0 z-50 bg-[#022C22]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#D1E2D9] flex flex-col max-h-[92vh] animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D1E2D9] bg-[#EDF3F0]">
          <div>
            <h2 className="text-base font-serif font-bold text-[#064E3B]">
              Customize Aura Profile
            </h2>
            <p className="text-[11px] text-[#3D5A4C]">
              Update your photo, cover, display name, handle, and bio
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#3D5A4C] hover:text-[#064E3B] hover:bg-white transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto scrollbar-thin">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Banner & Avatar Combined Hero Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#064E3B] uppercase tracking-wider">
                Cover Banner & Avatar
              </label>
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                className="text-xs text-[#059669] hover:text-[#047857] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Upload size={13} />
                <span>Upload Custom Banner</span>
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerChange}
                className="hidden"
              />
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-[#D1E2D9] shadow-soft group">
              <img
                src={bannerUrl}
                alt="Banner preview"
                className="w-full h-28 sm:h-36 object-cover"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl bg-white/95 text-xs font-semibold text-[#064E3B] shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera size={14} />
                  <span>Change Banner</span>
                </button>
              </div>

              {/* Avatar anchored onto banner */}
              <div className="absolute bottom-2.5 left-4">
                <div
                  className="relative group/avatar cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to change avatar photo"
                >
                  <ModernAvatar
                    src={avatarUrl}
                    size="xl"
                    ring
                    className="border-3 border-white shadow-lg"
                  />
                  <div className="absolute inset-0 bg-black/45 rounded-full opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera size={20} />
                  </div>
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

            {/* Live Upload Progress Bar for Avatar */}
            {isUploadingAvatar && (
              <UploadProgressBar
                progress={avatarUploadPercent}
                statusText={avatarUploadStatus}
                bytesTransferred={avatarBytes.trans}
                totalBytes={avatarBytes.tot}
                savingsPercent={avatarBytes.savings}
                isComplete={avatarUploadPercent === 100}
              />
            )}

            {/* Avatar Preset Badges */}
            <div className="p-3 bg-[#EDF3F0] rounded-2xl border border-[#D1E2D9] space-y-2">
              <span className="text-xs font-semibold text-[#064E3B] block">
                Choose an Avatar Badge or Upload Your Own Photo:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {PRESET_AVATARS.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setAvatarUrl(av.url)}
                    className={`flex items-center gap-2 p-1.5 px-2.5 rounded-xl border text-xs font-medium shrink-0 cursor-pointer transition-all ${
                      avatarUrl === av.url
                        ? 'bg-white border-[#064E3B] shadow-xs text-[#064E3B] font-bold'
                        : 'bg-white/70 border-transparent hover:bg-white text-[#3D5A4C]'
                    }`}
                  >
                    <img src={av.url} alt={av.name} className="w-5 h-5 rounded-full object-cover" />
                    <span>{av.name}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 px-3 rounded-xl bg-[#064E3B] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 hover:bg-[#065F46] cursor-pointer"
                >
                  <Upload size={12} />
                  <span>Upload File</span>
                </button>
              </div>
            </div>

            {/* Banner Presets */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto pb-1">
              <span className="text-[11px] font-medium text-[#3D5A4C] shrink-0">Banner Presets:</span>
              {PRESET_BANNERS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setBannerUrl(preset)}
                  className={`w-12 h-7 rounded-lg overflow-hidden border-2 shrink-0 transition-transform cursor-pointer ${
                    bannerUrl === preset ? 'border-[#064E3B] scale-105 shadow-sm' : 'border-transparent opacity-75 hover:opacity-100'
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
              <label className="block text-xs font-bold text-[#064E3B] mb-1">
                Display Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-[#EDF3F0] border border-[#D1E2D9] focus:border-[#064E3B] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#022C22] focus:outline-none transition-colors font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#064E3B] mb-1">
                Pronouns
              </label>
              <input
                type="text"
                value={pronouns}
                onChange={(e) => setPronouns(e.target.value)}
                placeholder="she/her, they/them"
                className="w-full bg-[#EDF3F0] border border-[#D1E2D9] focus:border-[#064E3B] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#022C22] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold text-[#064E3B] mb-1">
              Username Handle *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[#3D5A4C]">
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-8 pr-3.5 py-2.5 bg-[#EDF3F0] border border-[#D1E2D9] focus:border-[#064E3B] focus:bg-white rounded-xl text-xs sm:text-sm text-[#022C22] font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-xs font-bold text-[#064E3B] mb-1">
              Bio & Reflections
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell other creators what crafts or ideas you are exploring..."
              className="w-full bg-[#EDF3F0] border border-[#D1E2D9] focus:border-[#064E3B] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#022C22] focus:outline-none resize-none transition-colors"
            />
          </div>

          {/* Location & Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#064E3B] mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Copenhagen, Denmark"
                className="w-full bg-[#EDF3F0] border border-[#D1E2D9] focus:border-[#064E3B] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#022C22] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#064E3B] mb-1">
                Personal Link / Portfolio
              </label>
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourportfolio.com"
                className="w-full bg-[#EDF3F0] border border-[#D1E2D9] focus:border-[#064E3B] focus:bg-white rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#022C22] focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Privacy Switch */}
          <div className="flex items-center justify-between p-3.5 bg-[#EDF3F0] rounded-2xl border border-[#D1E2D9]">
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-[#059669]" />
              <div>
                <span className="text-xs font-bold text-[#064E3B] block">Private Account</span>
                <span className="text-[11px] text-[#3D5A4C]">
                  Only accepted followers can view your stories and posts
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={privateAccount}
              onChange={(e) => setPrivateAccount(e.target.checked)}
              className="w-4 h-4 text-[#064E3B] rounded focus:ring-[#059669]"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#D1E2D9]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="py-2.5 px-5 rounded-2xl text-xs font-semibold text-[#3D5A4C] hover:text-[#064E3B] hover:bg-[#EDF3F0] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isUploadingAvatar}
              className="py-2.5 px-6 rounded-2xl bg-[#064E3B] hover:bg-[#065F46] text-white text-xs font-bold transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Sparkles size={14} className="animate-spin text-[#34D399]" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
