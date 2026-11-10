import React from 'react';
import {
  X,
  Home,
  Compass,
  ShoppingBag,
  Film,
  MessageSquare,
  Bell,
  TrendingUp,
  Bookmark,
  User as UserIcon,
  ShieldCheck,
  Settings,
  Plus,
  LogOut,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { auraAudio } from '../../utils/audioSynthesizer';
import { ModernAvatar } from '../common/ModernAvatar';
import { AuraLogo } from '../common/AuraLogo';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import {
  FilmIcon as HeroFilmOutline,
  PlusIcon as HeroPlusOutline,
} from '@heroicons/react/24/outline';
import {
  FilmIcon as HeroFilmSolid,
  PlusIcon as HeroPlusSolid,
} from '@heroicons/react/24/solid';

interface MobileNavPageProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  currentTab: 'feed' | 'reels' | 'messages' | 'explore' | 'marketplace' | 'profile';
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  onSelectTab: (tab: 'feed' | 'reels' | 'messages' | 'explore' | 'marketplace' | 'profile') => void;
  onOpenCreatePost: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onSelectSavedTab?: () => void;
  onSelectTrendingTab?: () => void;
  onOpenPayVerified?: () => void;
}

export const MobileNavPage: React.FC<MobileNavPageProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentTab,
  unreadMessagesCount,
  unreadNotificationsCount,
  onSelectTab,
  onOpenCreatePost,
  onOpenNotifications,
  onOpenSettings,
  onSelectSavedTab,
  onSelectTrendingTab,
  onOpenPayVerified,
}) => {
  const { signOut } = useAuth();

  if (!isOpen) return null;

  const handleItemClick = (action: () => void) => {
    auraAudio.playClick(600, 0.03);
    action();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAF9] flex flex-col overflow-y-auto animate-in fade-in duration-200 text-[#022C22] select-none">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 bg-[#F8FAF9]/95 backdrop-blur-md border-b border-[#D1E2D9] px-4 h-16 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <AuraLogo
            size="md"
            showWordmark={true}
            currentUser={currentUser || undefined}
            onOpenCreatePost={onOpenCreatePost}
          />
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-[#064E3B] border border-emerald-300">
            Navigation
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            auraAudio.playClick(400, 0.03);
            onClose();
          }}
          className="p-2 rounded-2xl bg-white border border-[#D1E2D9] text-[#4B6358] hover:text-[#022C22] hover:bg-[#EDF3F0] transition-colors cursor-pointer active:scale-95 shadow-xs"
          title="Close Navigation Menu"
        >
          <X size={20} className="stroke-[2.5]" />
        </button>
      </div>

      <div className="flex-1 p-4 sm:p-6 space-y-5 pb-24 max-w-xl mx-auto w-full">
        {/* Creator Identity Hero Card */}
        {currentUser && (
          <div
            onClick={() => handleItemClick(() => onSelectTab('profile'))}
            className="p-4 rounded-3xl bg-gradient-to-br from-[#064E3B] via-[#059669] to-[#047857] text-white shadow-lg cursor-pointer group transition-all relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center gap-3.5 relative z-10">
              <ModernAvatar
                src={currentUser.avatar}
                alt={currentUser.name}
                size="lg"
                ring
                status="online"
                className="shrink-0 ring-white/60"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base truncate">{currentUser.name}</span>
                  {currentUser.verified && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full bg-blue-500/30 border border-blue-300 text-[10px] font-semibold text-white">
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/80 font-mono truncate">@{currentUser.username}</p>
                <div className="flex items-center gap-3 text-xs text-white/90 mt-1.5 font-medium">
                  <span>{currentUser.followersCount || 0} followers</span>
                  <span>·</span>
                  <span>{currentUser.followingCount || 0} following</span>
                </div>
              </div>

              <ChevronRight size={20} className="text-white/70 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        )}

        {/* 10K Blue Verification Badge Quick Banner if not verified */}
        {!currentUser?.verified && onOpenPayVerified && (
          <button
            type="button"
            onClick={() => handleItemClick(onOpenPayVerified)}
            className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-900 flex items-center justify-between shadow-xs transition-all cursor-pointer active:scale-98"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <ShieldCheck size={22} />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold">Get Official 10K Blue Badge</p>
                <p className="text-[11px] text-blue-700">MTN MoMo, Flutterwave & Stripe (10K RWF)</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-600 text-white shadow-xs">
              Verify
            </span>
          </button>
        )}

        {/* Primary Action Button: Create Post */}
        <button
          type="button"
          onClick={() => handleItemClick(onOpenCreatePost)}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#064E3B] via-[#059669] to-[#10B981] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:brightness-105 active:scale-98 transition-all cursor-pointer ring-1 ring-white/30"
        >
          <HeroPlusSolid className="w-5 h-5 stroke-[2.5]" />
          <span>Create New Reflection / Post</span>
        </button>

        {/* Navigation Sections */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6358] px-1">
            Main Navigation
          </h3>

          <div className="bg-white rounded-3xl border border-[#D1E2D9] divide-y divide-[#D1E2D9]/40 overflow-hidden shadow-xs">
            {/* 1. Home Feed */}
            <button
              type="button"
              onClick={() => handleItemClick(() => onSelectTab('feed'))}
              className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                currentTab === 'feed' ? 'bg-[#EDF3F0]' : 'hover:bg-[#F8FAF9]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-xl ${currentTab === 'feed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-[#059669]'}`}>
                  <Home size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Home Feed</p>
                  <p className="text-[11px] text-[#4B6358]">Community posts, stories and reflections</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#7A8A82]" />
            </button>

            {/* 2. Explore & Search */}
            <button
              type="button"
              onClick={() => handleItemClick(() => onSelectTab('explore'))}
              className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                currentTab === 'explore' ? 'bg-[#EDF3F0]' : 'hover:bg-[#F8FAF9]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-xl ${currentTab === 'explore' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-[#059669]'}`}>
                  <Compass size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Explore & ML Search</p>
                  <p className="text-[11px] text-[#4B6358]">Find creators, semantic tags and reflections</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#7A8A82]" />
            </button>

            {/* 3. Marketplace */}
            <button
              type="button"
              onClick={() => handleItemClick(() => onSelectTab('marketplace'))}
              className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                currentTab === 'marketplace' ? 'bg-[#EDF3F0]' : 'hover:bg-[#F8FAF9]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-xl ${currentTab === 'marketplace' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-[#059669]'}`}>
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Ducate Marketplace</p>
                  <p className="text-[11px] text-[#4B6358]">Buy, sell deals and create sponsored ads</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Deals
              </span>
            </button>

            {/* 4. Cinema & Reels */}
            <button
              type="button"
              onClick={() => handleItemClick(() => onSelectTab('reels'))}
              className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                currentTab === 'reels' ? 'bg-[#EDF3F0]' : 'hover:bg-[#F8FAF9]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-xl ${currentTab === 'reels' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-[#059669]'}`}>
                  <HeroFilmSolid className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Cinema & Reels</p>
                  <p className="text-[11px] text-[#4B6358]">Immersive HD video shorts and reflections</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#059669]/15 text-[#064E3B]">
                HD
              </span>
            </button>

            {/* 5. Messages */}
            <button
              type="button"
              onClick={() => handleItemClick(() => onSelectTab('messages'))}
              className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                currentTab === 'messages' ? 'bg-[#EDF3F0]' : 'hover:bg-[#F8FAF9]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-xl ${currentTab === 'messages' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-[#059669]'}`}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Direct Messages</p>
                  <p className="text-[11px] text-[#4B6358]">Audio/video calls, voice notes & real-time chat</p>
                </div>
              </div>
              {unreadMessagesCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-[#059669] text-white text-[10px] font-bold">
                  {unreadMessagesCount}
                </span>
              ) : (
                <ChevronRight size={16} className="text-[#7A8A82]" />
              )}
            </button>
          </div>
        </div>

        {/* Secondary Navigation Section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#4B6358] px-1">
            Personal & Community Hub
          </h3>

          <div className="bg-white rounded-3xl border border-[#D1E2D9] divide-y divide-[#D1E2D9]/40 overflow-hidden shadow-xs">
            {/* Activity / Notifications */}
            <button
              type="button"
              onClick={() => handleItemClick(onOpenNotifications)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#F8FAF9] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#059669]">
                  <Bell size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Activity & Notifications</p>
                  <p className="text-[11px] text-[#4B6358]">Likes, comments, quotes and call alerts</p>
                </div>
              </div>
              {unreadNotificationsCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                  {unreadNotificationsCount}
                </span>
              ) : (
                <ChevronRight size={16} className="text-[#7A8A82]" />
              )}
            </button>

            {/* Trending Topics */}
            <button
              type="button"
              onClick={() => handleItemClick(onSelectTrendingTab || (() => onSelectTab('explore')))}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#F8FAF9] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#059669]">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Trending Topics</p>
                  <p className="text-[11px] text-[#4B6358]">What the community is talking about</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#7A8A82]" />
            </button>

            {/* Bookmarks */}
            <button
              type="button"
              onClick={() => handleItemClick(onSelectSavedTab || (() => onSelectTab('profile')))}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#F8FAF9] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#059669]">
                  <Bookmark size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Saved Reflections</p>
                  <p className="text-[11px] text-[#4B6358]">Your bookmarked posts and inspirations</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#7A8A82]" />
            </button>

            {/* Your Profile */}
            <button
              type="button"
              onClick={() => handleItemClick(() => onSelectTab('profile'))}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#F8FAF9] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#059669]">
                  <UserIcon size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Profile & Highlights</p>
                  <p className="text-[11px] text-[#4B6358]">Edit bio, customize story highlights</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#7A8A82]" />
            </button>

            {/* Settings & Privacy */}
            <button
              type="button"
              onClick={() => handleItemClick(onOpenSettings)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#F8FAF9] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-[#059669]">
                  <Settings size={18} />
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#022C22]">Settings & Privacy</p>
                  <p className="text-[11px] text-[#4B6358]">Theme, audio effects and security</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#7A8A82]" />
            </button>
          </div>
        </div>

        {/* PWA App Install Banner */}
        <div className="p-3 bg-[#EDF3F0] rounded-2xl border border-[#D1E2D9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-[#059669]" />
            <div>
              <p className="text-xs font-bold text-[#022C22]">Install Ducate App</p>
              <p className="text-[10px] text-[#4B6358]">Fast home screen access & offline sync</p>
            </div>
          </div>
          <PWAInstallButton variant="header" />
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={async () => {
            auraAudio.playClick(400, 0.05);
            onClose();
            await signOut();
          }}
          className="w-full p-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
        >
          <LogOut size={16} />
          <span>Sign Out of AuraChats</span>
        </button>

        {/* Footer info */}
        <div className="text-center pt-3 pb-6 text-[#7A8A82] text-[11px] space-y-1">
          <p className="font-semibold text-[#4B6358]">app developed by reponsekdz · AuraChats</p>
          <p>© {new Date().getFullYear()} Ducate · Modern Mindful Social Platform</p>
        </div>
      </div>
    </div>
  );
};
