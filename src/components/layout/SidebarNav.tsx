import React, { useState } from 'react';
import {
  Home,
  Compass,
  Film,
  MessageSquare,
  Bell,
  Bookmark,
  TrendingUp,
  User as UserIcon,
  Settings,
  Plus,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { User } from '../../types';
import { AuraLogo } from '../common/AuraLogo';
import { useAuth } from '../../context/AuthContext';
import { auraAudio } from '../../utils/audioSynthesizer';
import {
  FilmIcon as HeroFilmOutline,
  PlusIcon as HeroPlusOutline,
} from '@heroicons/react/24/outline';
import {
  FilmIcon as HeroFilmSolid,
  PlusIcon as HeroPlusSolid,
} from '@heroicons/react/24/solid';

interface SidebarNavProps {
  currentTab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile';
  currentUser: User | null;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  onSelectTab: (tab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile') => void;
  onOpenCreatePost: () => void;
  onOpenNotifications: () => void;
  onOpenSettings: () => void;
  onSelectSavedTab?: () => void;
  onSelectTrendingTab?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  currentTab,
  currentUser,
  unreadMessagesCount,
  unreadNotificationsCount,
  onSelectTab,
  onOpenCreatePost,
  onOpenNotifications,
  onOpenSettings,
  onSelectSavedTab,
  onSelectTrendingTab,
}) => {
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <aside className="w-64 xl:w-72 shrink-0 h-screen sticky top-0 flex flex-col justify-between py-6 px-4 sm:px-6 border-r border-[#E6EDE9] bg-[#FAFAF9]/95 backdrop-blur-md select-none">
      {/* Top Header & Navigation Links */}
      <div className="space-y-6">
        {/* Advanced Functional Brand Wordmark & Aura Icon */}
        <div className="py-1 px-2.5 rounded-2xl hover:bg-[#F1F5F2] transition-colors inline-block">
          <AuraLogo
            size="md"
            showWordmark={true}
            currentUser={currentUser}
            onOpenCreatePost={onOpenCreatePost}
          />
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5 font-medium text-sm">
          {/* Feed / Home */}
          <button
            type="button"
            onClick={() => onSelectTab('feed')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all text-left ${
              currentTab === 'feed'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]'
            }`}
          >
            <Home
              size={20}
              className={currentTab === 'feed' ? 'text-[#5E7C6E]' : 'text-[#7A8A82]'}
            />
            <span className="text-[14px]">Home Feed</span>
          </button>

          {/* Explore / Search */}
          <button
            type="button"
            onClick={() => onSelectTab('explore')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all text-left ${
              currentTab === 'explore'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]'
            }`}
          >
            <Compass
              size={20}
              className={currentTab === 'explore' ? 'text-[#5E7C6E]' : 'text-[#7A8A82]'}
            />
            <span className="text-[14px]">Explore & Search</span>
          </button>

          {/* Reels / Cinema with Hero FilmIcon from @heroicons/react */}
          <button
            type="button"
            onClick={() => onSelectTab('reels')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all text-left ${
              currentTab === 'reels'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]'
            }`}
          >
            {currentTab === 'reels' ? (
              <HeroFilmSolid className="w-5 h-5 text-[#5E7C6E] shrink-0" />
            ) : (
              <HeroFilmOutline className="w-5 h-5 text-[#55635C] shrink-0" />
            )}
            <span className="text-[14px]">Cinema & Reels</span>
          </button>

          {/* Messages with live unread badge */}
          <button
            type="button"
            onClick={() => onSelectTab('messages')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all text-left ${
              currentTab === 'messages'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <MessageSquare
                size={20}
                className={currentTab === 'messages' ? 'text-[#5E7C6E]' : 'text-[#7A8A82]'}
              />
              <span className="text-[14px]">Messages</span>
            </div>
            {unreadMessagesCount > 0 && (
              <span className="px-2 py-0.5 bg-[#8FA89B] text-white text-[11px] font-bold rounded-full tabular-nums">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Activity / Notifications with live badge */}
          <button
            type="button"
            onClick={onOpenNotifications}
            className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all text-left text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]"
          >
            <div className="flex items-center gap-3.5">
              <Bell size={20} className="text-[#7A8A82]" />
              <span className="text-[14px]">Activity</span>
            </div>
            {unreadNotificationsCount > 0 && (
              <span className="px-2 py-0.5 bg-[#8FA89B] text-white text-[11px] font-bold rounded-full tabular-nums">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Trending Hub */}
          <button
            type="button"
            onClick={() => {
              if (onSelectTrendingTab) onSelectTrendingTab();
              else onSelectTab('explore');
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all text-left text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]"
          >
            <TrendingUp size={20} className="text-[#7A8A82]" />
            <span className="text-[14px]">Trending Topics</span>
          </button>

          {/* Bookmarks / Saved */}
          <button
            type="button"
            onClick={() => {
              if (onSelectSavedTab) onSelectSavedTab();
              else onSelectTab('profile');
            }}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all text-left text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]"
          >
            <Bookmark size={20} className="text-[#7A8A82]" />
            <span className="text-[14px]">Bookmarks</span>
          </button>

          {/* Your Profile */}
          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all text-left ${
              currentTab === 'profile'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]'
            }`}
          >
            <UserIcon
              size={20}
              className={currentTab === 'profile' ? 'text-[#5E7C6E]' : 'text-[#7A8A82]'}
            />
            <span className="text-[14px]">Your Profile</span>
          </button>

          {/* Settings & Privacy */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all text-left text-[#55635C] hover:bg-[#F1F5F2] hover:text-[#2D3732]"
          >
            <Settings size={20} className="text-[#7A8A82]" />
            <span className="text-[14px]">Settings & Privacy</span>
          </button>
        </nav>

        {/* Primary Action Button: Create Reflection */}
        <button
          type="button"
          onClick={() => {
            auraAudio.playClick(520, 0.05);
            onOpenCreatePost();
          }}
          className="group w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#2F4438] via-[#4A6757] to-[#719181] hover:brightness-110 text-white text-sm font-semibold shadow-soft hover:shadow-soft-lg transition-all active:scale-98 cursor-pointer ring-1 ring-white/25"
        >
          <HeroPlusSolid className="w-5 h-5 transition-transform duration-200 group-hover:rotate-90 shrink-0" />
          <span>New Reflection</span>
        </button>
      </div>

      {/* Bottom Profile Pill & Footer Credits */}
      <div className="space-y-4 pt-4 border-t border-[#E6EDE9]">
        {currentUser && (
          <div
            onClick={() => onSelectTab('profile')}
            className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#F1F5F2] transition-colors cursor-pointer group"
          >
            <div className="relative shrink-0">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-[#8FA89B]/40 group-hover:ring-[#8FA89B] transition-all"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#FAFAF9]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-[#2D3732] truncate group-hover:underline">
                {currentUser.name}
              </div>
              <div className="text-[11px] text-[#7A8A82] truncate font-mono">
                @{currentUser.username}
              </div>
            </div>

            <button
              type="button"
              disabled={isSigningOut}
              onClick={async (e) => {
                e.stopPropagation();
                setIsSigningOut(true);
                auraAudio.playClick(450, 0.05);
                await signOut();
              }}
              className="p-2 rounded-xl text-[#7A8A82] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
              title="Sign Out of Aura"
            >
              <LogOut size={16} className={isSigningOut ? 'opacity-50 animate-pulse' : ''} />
            </button>
          </div>
        )}

        {/* Mandatory Developer Footer Credit */}
        <div className="px-2 pt-1 text-center">
          <p className="text-[11px] text-[#7A8A82] font-medium tracking-wide">
            app developed by reponsekdz
          </p>
          <p className="text-[10px] text-[#A1B0A8] mt-0.5">
            Aura &copy; {new Date().getFullYear()} · Mindful Social
          </p>
        </div>
      </div>
    </aside>
  );
};
