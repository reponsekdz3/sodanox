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
  Copy,
  UserX,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { User as UserType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile, toggleBlockUser } from '../../services/userService';

interface SettingsModalProps {
  currentUser: UserType;
  onClose: () => void;
  onOpenEditProfile: () => void;
}

type SettingsSection = 'account' | 'privacy' | 'notifications' | 'preferences' | 'safety' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onOpenEditProfile,
}) => {
  const { signOut, sendPasswordReset, updateUser } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [isResetSent, setIsResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [copiedProfileLink, setCopiedProfileLink] = useState(false);

  // Privacy states
  const [isPrivate, setIsPrivate] = useState(currentUser.privateAccount || false);
  const [showActivity, setShowActivity] = useState(currentUser.showOnlineStatus !== false);
  const [allowReshare, setAllowReshare] = useState(currentUser.allowReshare !== false);

  // Preferences states
  const [autoPlayReels, setAutoPlayReels] = useState(currentUser.mediaPreferences?.autoPlayReels ?? true);
  const [highQualityUploads, setHighQualityUploads] = useState(currentUser.mediaPreferences?.highQualityUploads ?? true);
  const [soundEffects, setSoundEffects] = useState(currentUser.mediaPreferences?.soundEffects ?? true);
  const [selectedTheme, setSelectedTheme] = useState<'nordic' | 'alabaster' | 'dusk'>((currentUser.themePreference as any) || 'nordic');

  // Notification toggles
  const [notifyLikes, setNotifyLikes] = useState(currentUser.notificationPreferences?.likes ?? true);
  const [notifyComments, setNotifyComments] = useState(currentUser.notificationPreferences?.comments ?? true);
  const [notifyDirectChats, setNotifyDirectChats] = useState(currentUser.notificationPreferences?.directChats ?? true);
  const [notifyCalls, setNotifyCalls] = useState(currentUser.notificationPreferences?.calls ?? true);
  const [notifyFollows, setNotifyFollows] = useState(currentUser.notificationPreferences?.follows ?? true);

  // Blocked users
  const [blockedUsers, setBlockedUsers] = useState<string[]>(currentUser.blockedUsers || []);

  const [savingSettings, setSavingSettings] = useState(false);
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

  const handleCopyProfileUrl = () => {
    const url = window.location.origin + '/@' + currentUser.username;
    navigator.clipboard?.writeText(url);
    setCopiedProfileLink(true);
    setTimeout(() => setCopiedProfileLink(false), 2500);
  };

  const saveSettingsToFirestore = async (updates: Partial<UserType>) => {
    setSavingSettings(true);
    try {
      await updateUserProfile(currentUser.id, updates);
      await updateUser(updates);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving settings to Firestore:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTogglePrivacy = async (newVal: boolean) => {
    setIsPrivate(newVal);
    await saveSettingsToFirestore({ privateAccount: newVal });
  };

  const handleToggleActivity = async (newVal: boolean) => {
    setShowActivity(newVal);
    await saveSettingsToFirestore({ showOnlineStatus: newVal });
  };

  const handleToggleReshare = async (newVal: boolean) => {
    setAllowReshare(newVal);
    await saveSettingsToFirestore({ allowReshare: newVal });
  };

  const handleUpdateNotification = async (key: keyof NonNullable<UserType['notificationPreferences']>, value: boolean) => {
    const updated = {
      likes: notifyLikes,
      comments: notifyComments,
      directChats: notifyDirectChats,
      calls: notifyCalls,
      follows: notifyFollows,
      [key]: value,
    };
    if (key === 'likes') setNotifyLikes(value);
    if (key === 'comments') setNotifyComments(value);
    if (key === 'directChats') setNotifyDirectChats(value);
    if (key === 'calls') setNotifyCalls(value);
    if (key === 'follows') setNotifyFollows(value);

    await saveSettingsToFirestore({ notificationPreferences: updated });
  };

  const handleUpdateMediaPref = async (key: keyof NonNullable<UserType['mediaPreferences']>, value: boolean) => {
    const updated = {
      autoPlayReels,
      highQualityUploads,
      soundEffects,
      [key]: value,
    };
    if (key === 'autoPlayReels') setAutoPlayReels(value);
    if (key === 'highQualityUploads') setHighQualityUploads(value);
    if (key === 'soundEffects') setSoundEffects(value);

    await saveSettingsToFirestore({ mediaPreferences: updated });
  };

  const handleSelectTheme = async (theme: 'nordic' | 'alabaster' | 'dusk') => {
    setSelectedTheme(theme);
    await saveSettingsToFirestore({ themePreference: theme });
  };

  const handleUnblockUser = async (targetUid: string) => {
    try {
      await toggleBlockUser(currentUser.id, targetUid, true);
      const nextList = blockedUsers.filter((uid) => uid !== targetUid);
      setBlockedUsers(nextList);
      await updateUser({ blockedUsers: nextList });
    } catch (err) {
      console.error('Error unblocking user:', err);
    }
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(
      {
        account: currentUser,
        exportDate: new Date().toISOString(),
        network: 'Aura',
        authorAttribution: 'reponsekdz',
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-backup-${currentUser.username}.json`;
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
                <p className="text-[11px] text-[#7A8A82]">Account & preferences controls</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-1.5 rounded-full hover:bg-black/5 cursor-pointer"
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
                <User size={15} />
                <span>Account Profile</span>
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
                <Shield size={15} />
                <span>Privacy & Access</span>
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
                <Bell size={15} />
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
                <Sliders size={15} />
                <span>Experience & Media</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('safety')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition-all text-left whitespace-nowrap cursor-pointer ${
                  activeSection === 'safety'
                    ? 'bg-[#FAFAF9] text-[#2D3732] shadow-sm font-semibold'
                    : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/50'
                }`}
              >
                <UserX size={15} />
                <span>Safety & Blocks</span>
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
                <Database size={15} />
                <span>Data & Backup</span>
              </button>
            </div>
          </div>

          {/* Sign out button */}
          <div className="pt-4 border-t border-[#2D3732]/10 hidden md:block space-y-3">
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

            <div className="px-2 text-center">
              <p className="text-[10px] text-[#7A8A82]">
                developed by reponsekdz
              </p>
              <p className="text-[9px] text-[#A1B0A8]">
                Aura
              </p>
            </div>
          </div>
        </div>

        {/* Section Content Area */}
        <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {savingSettings && (
                <span className="text-[11px] text-[#8FA89B] animate-pulse">
                  Syncing to Firestore...
                </span>
              )}
              {savedSuccess && (
                <span className="text-[11px] text-emerald-600 flex items-center gap-1 animate-fade-in">
                  <CheckCircle2 size={12} />
                  <span>Saved to cloud</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[#7A8A82] hover:text-[#2D3732] hover:bg-[#F1F5F2] transition-colors cursor-pointer"
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
                  Manage your credentials, authenticated profile, and public profile link
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

              {/* Official address */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#2D3732] flex items-center gap-1.5">
                    <Sparkles size={14} className="text-[#8FA89B]" />
                    <span>Your Public Profile Link</span>
                  </div>
                  <div className="text-xs font-mono text-[#55635C] truncate mt-0.5">
                    {window.location.origin}/@{currentUser.username}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyProfileUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#2D3732]/10 text-xs font-medium text-[#2D3732] hover:bg-[#FAFAF9] shadow-xs cursor-pointer shrink-0"
                >
                  {copiedProfileLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedProfileLink ? 'Copied' : 'Copy'}</span>
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
                    className="px-3.5 py-1.5 rounded-xl bg-white border border-[#2D3732]/10 text-xs font-medium text-[#2D3732] hover:bg-[#FAFAF9] shadow-xs cursor-pointer"
                  >
                    Send Reset Link
                  </button>
                </div>

                {isResetSent && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <Check size={14} />
                    <span>Password reset instructions sent to your email.</span>
                  </div>
                )}
                {resetError && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                    {resetError}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. Privacy Section */}
          {activeSection === 'privacy' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Privacy & Visibility</h4>
                <p className="text-xs text-[#7A8A82]">
                  Configure who can see your reflections, stories, and activity
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock size={18} className="text-[#8FA89B]" />
                    <div>
                      <div className="text-xs font-semibold text-[#2D3732]">Private Account</div>
                      <div className="text-[11px] text-[#7A8A82]">
                        Only your accepted followers can read your full reflections and stories
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => handleTogglePrivacy(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Eye size={18} className="text-[#8FA89B]" />
                    <div>
                      <div className="text-xs font-semibold text-[#2D3732]">Active Presence & Status</div>
                      <div className="text-[11px] text-[#7A8A82]">
                        Allow mutual followers to see when you are active on Aura
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showActivity}
                      onChange={(e) => handleToggleActivity(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield size={18} className="text-[#8FA89B]" />
                    <div>
                      <div className="text-xs font-semibold text-[#2D3732]">Allow Reflection Reshares</div>
                      <div className="text-[11px] text-[#7A8A82]">
                        Permit other members to repost and quote your reflections to their streams
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowReshare}
                      onChange={(e) => handleToggleReshare(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 3. Notifications Section */}
          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Notification Alerts</h4>
                <p className="text-xs text-[#7A8A82]">
                  Customize which live community interactions ping your activity drawer
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Likes & Appreciations</div>
                    <div className="text-[11px] text-[#7A8A82]">Alerts when members like your posts or reels</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyLikes}
                      onChange={(e) => handleUpdateNotification('likes', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Comments & Replies</div>
                    <div className="text-[11px] text-[#7A8A82]">Alerts when creators reply to your discussions</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyComments}
                      onChange={(e) => handleUpdateNotification('comments', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">New Followers & Follow Backs</div>
                    <div className="text-[11px] text-[#7A8A82]">Alerts when someone follows your profile</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyFollows}
                      onChange={(e) => handleUpdateNotification('follows', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Direct Messages & Voice Notes</div>
                    <div className="text-[11px] text-[#7A8A82]">In-app notification badge on new direct messages</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyDirectChats}
                      onChange={(e) => handleUpdateNotification('directChats', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Incoming Voice & Video Calls</div>
                    <div className="text-[11px] text-[#7A8A82]">Ring and trigger call dialogs for direct peer calls</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyCalls}
                      onChange={(e) => handleUpdateNotification('calls', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 4. Preferences Section */}
          {activeSection === 'preferences' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">App & Media Preferences</h4>
                <p className="text-xs text-[#7A8A82]">Adjust theme aesthetics and rich content playback</p>
              </div>

              {/* Theme Palette Selection */}
              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 space-y-3">
                <div className="text-xs font-semibold text-[#2D3732]">Aura Palette Aesthetic</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'nordic', label: 'Nordic Sage', bg: 'bg-[#FAFAF9]', border: 'border-[#8FA89B]' },
                    { id: 'alabaster', label: 'Alabaster Warm', bg: 'bg-[#FDFCFA]', border: 'border-[#D9DFD5]' },
                    { id: 'dusk', label: 'Quiet Dusk', bg: 'bg-[#2D3732]', text: 'text-white', border: 'border-[#5C7567]' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTheme(t.id as any)}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        selectedTheme === t.id
                          ? 'border-[#2D3732] ring-2 ring-[#8FA89B]'
                          : 'border-transparent hover:border-black/10'
                      } ${t.bg} ${t.text || 'text-[#2D3732]'}`}
                    >
                      <div className="text-xs font-semibold">{t.label}</div>
                      {selectedTheme === t.id && (
                        <Check size={12} className="mx-auto mt-1 text-[#8FA89B]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">Autoplay Reels on Scroll</div>
                    <div className="text-[11px] text-[#7A8A82]">Smoothly begin short cinema reels as you browse</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoPlayReels}
                      onChange={(e) => handleUpdateMediaPref('autoPlayReels', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#2D3732]">High-Fidelity Media Uploads</div>
                    <div className="text-[11px] text-[#7A8A82]">Preserve original resolution and color profiles</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highQualityUploads}
                      onChange={(e) => handleUpdateMediaPref('highQualityUploads', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 size={16} className="text-[#8FA89B]" />
                    <div>
                      <div className="text-xs font-semibold text-[#2D3732]">Tactile Acoustic Tones</div>
                      <div className="text-[11px] text-[#7A8A82]">Subtle synthesized acoustic tones on interactions</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEffects}
                      onChange={(e) => handleUpdateMediaPref('soundEffects', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8FA89B]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 5. Safety & Blocked Accounts Section */}
          {activeSection === 'safety' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Safety & Blocked Accounts</h4>
                <p className="text-xs text-[#7A8A82]">
                  Manage restricted users and community boundaries
                </p>
              </div>

              <div className="space-y-3">
                {blockedUsers.length === 0 ? (
                  <div className="p-8 text-center bg-[#F1F5F2] rounded-2xl border border-[#2D3732]/10 text-xs text-[#7A8A82]">
                    No accounts are currently blocked. You have an open community feed.
                  </div>
                ) : (
                  blockedUsers.map((uid) => (
                    <div
                      key={uid}
                      className="p-3.5 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <UserX size={16} className="text-red-500" />
                        <span className="text-xs font-mono text-[#2D3732]">User ID: {uid.slice(0, 10)}...</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblockUser(uid)}
                        className="px-3 py-1 rounded-xl bg-white border border-[#2D3732]/10 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        Unblock
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. Data & Backup Section */}
          {activeSection === 'data' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-semibold text-[#2D3732]">Data, Backup & Export</h4>
                <p className="text-xs text-[#7A8A82]">
                  Download a complete copy of your profile archive or manage cloud storage
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F1F5F2] border border-[#2D3732]/10 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[#2D3732]">Export Profile Archive</div>
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
              <div className="pt-4 border-t border-[#2D3732]/10 md:hidden space-y-3">
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
                <div className="text-center text-[10px] text-[#7A8A82]">
                  developed by reponsekdz · Aura
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
