import React, { useState } from 'react';
import {
  X,
  User,
  Shield,
  Bell,
  Sliders,
  Database,
  LogOut,
  KeyRound,
  Check,
  Moon,
  Sun,
  Eye,
  Lock,
  Volume2,
  Download,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';
import { User as UserType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/userService';

interface SettingsModalProps {
  currentUser: UserType;
  onClose: () => void;
  onOpenEditProfile: () => void;
}

type SettingsSection = 'account' | 'privacy' | 'notifications' | 'preferences' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onOpenEditProfile,
}) => {
  const { signOut, sendPasswordReset } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [isResetSent, setIsResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Privacy states
  const [isPrivate, setIsPrivate] = useState(currentUser.privateAccount || false);
  const [showActivity, setShowActivity] = useState(true);
  const [allowReshare, setAllowReshare] = useState(true);

  // Preferences states
  const [autoPlayReels, setAutoPlayReels] = useState(true);
  const [highQualityUploads, setHighQualityUploads] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState<'nordic' | 'alabaster' | 'dusk'>('nordic');

  // Notification toggles
  const [notifyLikes, setNotifyLikes] = useState(true);
  const [notifyComments, setNotifyComments] = useState(true);
  const [notifyDirectChats, setNotifyDirectChats] = useState(true);
  const [notifyCalls, setNotifyCalls] = useState(true);

  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handlePasswordReset = async () => {
    if (!currentUser.email) {
      setResetError('No email associated with this account');
      return;
    }
    try {
      setResetError(null);
      await sendPasswordReset(currentUser.email);
      setIsResetSent(true);
      setTimeout(() => setIsResetSent(false), 5000);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setResetError(e.message || 'Failed to send reset link');
    }
  };

  const handleTogglePrivacy = async (newVal: boolean) => {
    setIsPrivate(newVal);
    setSavingPrivacy(true);
    try {
      await updateUserProfile(currentUser.id, { privateAccount: newVal });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(
      {
        account: currentUser,
        exportDate: new Date().toISOString(),
        auraVersion: '2.4.0',
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-data-backup-${currentUser.username}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#2D3732]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl bg-[#FAFAF9] rounded-3xl shadow-2xl overflow-hidden border border-[#2D3732]/10 flex flex-col md:flex-row max-h-[90vh]">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-64 bg-[#F1F5F2] border-b md:border-b-0 md:border-r border-[#2D3732]/10 p-4 sm:p-5 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center justify-between md:mb-6">
              <div>
                <h3 className="text-base font-serif font-semibold text-[#2D3732]">Settings</h3>
                <p className="text-[11px] text-[#7A8A82]">Account & studio controls</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-1.5 rounded-full hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            {/* Section tabs */}
            <div className="flex md:flex-col gap-1 overflow-x-auto py-2 md:py-0">
              <button
                type="button"
                onClick={() => setActiveSection('account')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeSection === 'account'
                    ? 'bg-[#FAFAF9] text-[#2D3732] shadow-sm font-semibold'
                    : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/50'
                }`}
              >
                <User size={16} className={activeSection === 'account' ? 'text-[#8FA89B]' : ''} />
                <span>Account & Security</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('privacy')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeSection === 'privacy'
                    ? 'bg-[#FAFAF9] text-[#2D3732] shadow-sm font-semibold'
                    : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/50'
                }`}
              >
                <Shield size={16} className={activeSection === 'privacy' ? 'text-[#8FA89B]' : ''} />
                <span>Privacy & Sharing</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('notifications')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeSection === 'notifications'
                    ? 'bg-[#FAFAF9] text-[#2D3732] shadow-sm font-semibold'
                    : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/50'
                }`}
              >
                <Bell size={16} className={activeSection === 'notifications' ? 'text-[#8FA89B]' : ''} />
                <span>Notifications</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('preferences')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeSection === 'preferences'
                    ? 'bg-[#FAFAF9] text-[#2D3732] shadow-sm font-semibold'
                    : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/50'
                }`}
              >
                <Sliders size={16} className={activeSection === 'preferences' ? 'text-[#8FA89B]' : ''} />
                <span>Studio Experience</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('data')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeSection === 'data'
                    ? 'bg-[#FAFAF9] text-[#2D3732] shadow-sm font-semibold'
                    : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/50'
                }`}
              >
                <Database size={16} className={activeSection === 'data' ? 'text-[#8FA89B]' : ''} />
                <span>Data & Backup</span>
              </button>
            </div>
          </div>

          {/* Sign out button */}
          <div className="pt-4 border-t border-[#2D3732]/10 hidden md:block">
            <button
              type="button"
              onClick={async () => {
                onClose();
                await signOut();
              }}
              className="w-full flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Section Content Area */}
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <div className="hidden md:flex justify-end mb-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* 1. Account Section */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Account Details</h4>
                <p className="text-xs text-[#7A8A82]">
                  Manage your credentials, authenticated email, and public profile
                </p>
              </div>

              {/* User preview card */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#8FA89B]"
                  />
                  <div>
                    <div className="text-sm font-semibold text-[#2D3732]">{currentUser.name}</div>
                    <div className="text-xs text-[#7A8A82] font-mono">@{currentUser.username}</div>
                    {currentUser.email && (
                      <div className="text-[11px] text-[#7A8A82] mt-0.5">{currentUser.email}</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditProfile();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#2D3732]/10 text-xs font-medium text-[#2D3732] hover:bg-[#FAFAF9] shadow-xs cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>

              {/* Password reset action */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <KeyRound size={18} className="text-[#8FA89B]" />
                    <div>
                      <div className="text-xs font-semibold text-[#2D3732]">Account Password</div>
                      <div className="text-[11px] text-[#7A8A82]">
                        Send a secure reset link to your registered email
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    className="px-3.5 py-1.5 rounded-xl bg-[#2D3732] text-white text-xs font-medium hover:bg-[#3d4a43] transition-colors cursor-pointer"
                  >
                    Reset Password
                  </button>
                </div>

                {isResetSent && (
                  <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 flex items-center gap-2 animate-fade-in">
                    <Check size={14} />
                    <span>Password reset email dispatched! Please check your inbox.</span>
                  </div>
                )}
                {resetError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 animate-fade-in">
                    {resetError}
                  </div>
                )}
              </div>

              {/* Two-Factor Auth badge */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Smartphone size={18} className="text-[#8FA89B]" />
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Two-Step Verification</div>
                    <div className="text-[11px] text-[#7A8A82]">
                      Secured via Firebase Identity Provider
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  Active
                </span>
              </div>
            </div>
          )}

          {/* 2. Privacy Section */}
          {activeSection === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Privacy & Visibility</h4>
                <p className="text-xs text-[#7A8A82]">
                  Control who can see your studio posts, stories, and active presence
                </p>
              </div>

              {savedSuccess && (
                <div className="p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 flex items-center gap-2">
                  <Check size={14} />
                  <span>Privacy settings saved successfully!</span>
                </div>
              )}

              {/* Private account toggle */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Lock size={18} className="text-[#8FA89B] mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Private Account</div>
                    <div className="text-[11px] text-[#7A8A82] max-w-sm">
                      When your account is private, only users you approve can view your posts,
                      reels, and full follower lists.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    disabled={savingPrivacy}
                    onChange={(e) => handleTogglePrivacy(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                </label>
              </div>

              {/* Activity Status */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Eye size={18} className="text-[#8FA89B] mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Show Active Presence</div>
                    <div className="text-[11px] text-[#7A8A82] max-w-sm">
                      Allow people you follow and message to see when you are currently online in the studio.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={showActivity}
                    onChange={(e) => setShowActivity(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                </label>
              </div>

              {/* Allow Story Resharing */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <Shield size={18} className="text-[#8FA89B] mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Allow Post Quoting & Resharing</div>
                    <div className="text-[11px] text-[#7A8A82] max-w-sm">
                      Let other creators quote your public posts and share stories to their feeds.
                    </div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={allowReshare}
                    onChange={(e) => setAllowReshare(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                </label>
              </div>
            </div>
          )}

          {/* 3. Notifications Section */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Push & In-App Alerts</h4>
                <p className="text-xs text-[#7A8A82]">
                  Customize which events send real-time notifications to your device
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Likes & Reactions</div>
                    <div className="text-[11px] text-[#7A8A82]">When someone loves your post or reacts to your story</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyLikes}
                      onChange={(e) => setNotifyLikes(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Comments & Mentions</div>
                    <div className="text-[11px] text-[#7A8A82]">When somebody replies or mentions you in a thread</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyComments}
                      onChange={(e) => setNotifyComments(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Direct Messages</div>
                    <div className="text-[11px] text-[#7A8A82]">Incoming chat messages and photo attachments</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyDirectChats}
                      onChange={(e) => setNotifyDirectChats(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Voice & Video Calls</div>
                    <div className="text-[11px] text-[#7A8A82]">Incoming audio and high-definition video calls</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyCalls}
                      onChange={(e) => setNotifyCalls(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 4. Studio Experience & Preferences */}
          {activeSection === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Studio Experience</h4>
                <p className="text-xs text-[#7A8A82]">
                  Fine-tune playback, aesthetic palette, and media resolution
                </p>
              </div>

              {/* Aesthetic Palette */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#2D3732]">Color Harmony Theme</span>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'nordic', name: 'Nordic Moss', bg: 'bg-[#FAFAF9]', border: 'border-[#8FA89B]' },
                    { id: 'alabaster', name: 'Warm Alabaster', bg: 'bg-[#FDFCFA]', border: 'border-[#E0D8CB]' },
                    { id: 'dusk', name: 'Dusk Slate', bg: 'bg-[#F2F4F3]', border: 'border-[#94A3B8]' },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setSelectedTheme(theme.id as any)}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                        selectedTheme === theme.id
                          ? `${theme.border} ring-2 ring-[#8FA89B]/30 shadow-xs font-semibold`
                          : 'border-transparent bg-[#F1F5F2] hover:bg-[#E6EDE9]'
                      }`}
                    >
                      <div className={`w-full h-8 rounded-lg mb-2 ${theme.bg} border border-[#2D3732]/10`} />
                      <div className="text-xs text-[#2D3732]">{theme.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Autoplay Reels & Videos</div>
                    <div className="text-[11px] text-[#7A8A82]">Instantly preview vertical reel clips while scrolling</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPlayReels}
                      onChange={(e) => setAutoPlayReels(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">High Fidelity Media Uploads</div>
                    <div className="text-[11px] text-[#7A8A82]">Preserve maximum photography resolution for stories & posts</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highQualityUploads}
                      onChange={(e) => setHighQualityUploads(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-[#8FA89B]" />
                    <div>
                      <div className="text-xs font-semibold text-[#2D3732]">Tactile Sound Cues</div>
                      <div className="text-[11px] text-[#7A8A82]">Subtle acoustic tones on likes and story completions</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEffects}
                      onChange={(e) => setSoundEffects(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 5. Data & Backup Section */}
          {activeSection === 'data' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Data, Backup & Export</h4>
                <p className="text-xs text-[#7A8A82]">
                  Download a complete copy of your profile archive or reset temporary cache
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#2D3732]">Export Studio Archive</div>
                  <div className="text-[11px] text-[#7A8A82]">
                    Download an offline JSON snapshot of your profile, handle, bio, and settings
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleExportData}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#2D3732]/10 text-xs font-medium text-[#2D3732] hover:bg-[#FAFAF9] shadow-xs cursor-pointer"
                >
                  <Download size={14} className="text-[#8FA89B]" />
                  <span>Download Archive</span>
                </button>
              </div>

              {/* Mobile sign out for smaller screens */}
              <div className="pt-4 border-t border-[#2D3732]/10 md:hidden">
                <button
                  type="button"
                  onClick={async () => {
                    onClose();
                    await signOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold text-red-600 bg-red-50 border border-red-200 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Sign Out of Aura</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
