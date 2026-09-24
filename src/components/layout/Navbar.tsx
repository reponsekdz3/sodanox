import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Compass,
  Home,
  UserCheck,
  ChevronDown,
  Settings,
  LogOut,
  Search,
  Sparkles,
  Wifi,
  Radio,
} from 'lucide-react';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AuraLogo } from '../common/AuraLogo';
import { ModernReelIcon } from '../common/ModernReelIcon';
import { ModernCreateIcon } from '../common/ModernCreateIcon';
import { auraAudio } from '../../utils/audioSynthesizer';

interface NavbarProps {
  currentTab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile';
  currentUser: User;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  onSelectTab: (tab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile') => void;
  onOpenCreatePost: () => void;
  onOpenNotifications: () => void;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  currentUser,
  unreadMessagesCount,
  unreadNotificationsCount,
  onSelectTab,
  onOpenCreatePost,
  onOpenNotifications,
  onOpenAuth,
  onOpenSettings,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTabClick = (tab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile') => {
    auraAudio.playClick(440, 0.04);
    onSelectTab(tab);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (navSearchQuery.trim()) {
      onSelectTab('explore');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAFAF9]/90 backdrop-blur-xl border-b border-[#E6EDE9]/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Modern Brand & Real-time Live Status */}
        <div className="flex items-center gap-3 shrink-0">
          <AuraLogo
            size="md"
            showWordmark={true}
            currentUser={currentUser}
            onOpenCreatePost={onOpenCreatePost}
          />

          {/* Discreet Live Sync Indicator */}
          <div
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E6EDE9]/60 border border-[#8FA89B]/20 text-[10px] font-mono text-[#5E7C6E] tracking-tight"
            title="Real-time synchronized across community"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 -ml-3" />
            <span>Live Sync</span>
          </div>
        </div>

        {/* Zone 2: Spotlight Quick Search (Desktop) */}
        <div className="hidden lg:flex flex-1 max-w-xs mx-2">
          <form
            onSubmit={handleSearchSubmit}
            className={`w-full relative flex items-center transition-all duration-200 ${
              searchFocused
                ? 'ring-2 ring-[#8FA89B]/50 shadow-sm'
                : 'hover:bg-white/80'
            } bg-[#F1F5F2]/80 rounded-2xl border border-[#2D3732]/10`}
          >
            <Search size={15} className="absolute left-3 text-[#7A8A82]" />
            <input
              type="text"
              value={navSearchQuery}
              onChange={(e) => setNavSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search reflections, creators..."
              className="w-full pl-9 pr-3 py-2 bg-transparent text-xs text-[#2D3732] placeholder-[#7A8A82]/70 focus:outline-none"
            />
            {navSearchQuery && (
              <button
                type="button"
                onClick={() => setNavSearchQuery('')}
                className="pr-3 text-[10px] text-[#7A8A82] hover:text-[#2D3732]"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* Zone 3: Interactive Main Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          {/* Feed Tab */}
          <button
            type="button"
            onClick={() => handleTabClick('feed')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              currentTab === 'feed'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/60'
            }`}
          >
            <Home size={16} className={currentTab === 'feed' ? 'text-[#5E7C6E]' : 'text-[#7A8A82]'} />
            <span>Feed</span>
          </button>

          {/* Reels Cinema Tab with Custom ModernReelIcon SVG */}
          <button
            type="button"
            onClick={() => handleTabClick('reels')}
            className={`group flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              currentTab === 'reels'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs ring-1 ring-[#8FA89B]/30'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/60'
            }`}
          >
            <ModernReelIcon size={18} active={currentTab === 'reels'} />
            <span>Reels</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#8FA89B]/15 text-[#5E7C6E] font-mono">
              HD
            </span>
          </button>

          {/* Messages Tab with Live Unread Counter */}
          <button
            type="button"
            onClick={() => handleTabClick('messages')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              currentTab === 'messages'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/60'
            }`}
          >
            <MessageSquare size={16} className={currentTab === 'messages' ? 'text-[#5E7C6E]' : 'text-[#7A8A82]'} />
            <span>Messages</span>
            {unreadMessagesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#5E7C6E] text-white text-[10px] font-semibold rounded-full tabular-nums shadow-xs">
                {unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Explore Tab */}
          <button
            type="button"
            onClick={() => handleTabClick('explore')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              currentTab === 'explore'
                ? 'bg-[#E6EDE9] text-[#2D3732] font-semibold shadow-xs'
                : 'text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/60'
            }`}
          >
            <Compass size={16} className={currentTab === 'explore' ? 'text-[#5E7C6E]' : 'text-[#7A8A82]'} />
            <span>Explore</span>
          </button>

          {/* Activity / Notifications Trigger */}
          <button
            type="button"
            onClick={() => {
              auraAudio.playClick(500, 0.04);
              onOpenNotifications();
            }}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-medium text-[#7A8A82] hover:text-[#2D3732] hover:bg-white/60 transition-all cursor-pointer"
            title="Notifications & Community Activity"
          >
            <div className="relative">
              <Bell size={16} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <span>Activity</span>
          </button>
        </nav>

        {/* Zone 4: Primary Actions & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Mobile Cinema Reels shortcut with ModernReelIcon */}
          <button
            type="button"
            onClick={() => handleTabClick('reels')}
            className={`md:hidden p-2 rounded-2xl transition-colors cursor-pointer ${
              currentTab === 'reels' ? 'bg-[#E6EDE9] text-[#2D3732]' : 'text-[#7A8A82] hover:text-[#2D3732]'
            }`}
            title="Reels Cinema"
          >
            <ModernReelIcon size={20} active={currentTab === 'reels'} />
          </button>

          {/* Mobile Notifications Trigger */}
          <button
            type="button"
            onClick={() => {
              auraAudio.playClick(500, 0.04);
              onOpenNotifications();
            }}
            className="md:hidden p-2 rounded-2xl text-[#7A8A82] hover:text-[#2D3732] relative cursor-pointer"
            title="Activity"
          >
            <Bell size={20} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Powerful Modern Create Post Button with Custom ModernCreateIcon SVG */}
          <button
            type="button"
            onClick={() => {
              auraAudio.playClick(520, 0.05);
              onOpenCreatePost();
            }}
            className="group relative flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-2xl bg-gradient-to-r from-[#5E7C6E] via-[#6B8B7C] to-[#8FA89B] text-white text-xs sm:text-sm font-medium transition-all shadow-md hover:shadow-lg hover:brightness-105 active:scale-95 whitespace-nowrap cursor-pointer ring-1 ring-white/20"
          >
            <ModernCreateIcon size={16} />
            <span className="hidden sm:inline font-semibold tracking-wide">Create</span>
          </button>

          {/* Account Profile Pill Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                auraAudio.playClick(440, 0.04);
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="flex items-center gap-2 p-1 rounded-2xl hover:bg-[#F1F5F2] transition-colors focus-visible:outline-none cursor-pointer"
              title="Account & Settings"
            >
              <div
                className={`w-9 h-9 rounded-2xl overflow-hidden p-0.5 transition-all ${
                  currentTab === 'profile'
                    ? 'ring-2 ring-[#5E7C6E]'
                    : 'hover:ring-2 hover:ring-[#8FA89B]/50'
                }`}
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              </div>
              <ChevronDown size={14} className="text-[#7A8A82] hidden sm:block transition-transform duration-200" />
            </button>

            {isDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-[#FAFAF9]/95 backdrop-blur-xl rounded-3xl border border-[#2D3732]/10 shadow-2xl py-2.5 z-50 animate-fade-in divide-y divide-[#2D3732]/5"
                onClick={() => setIsDropdownOpen(false)}
              >
                {/* Creator Header Card */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-[#8FA89B]/30"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#2D3732] truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[11px] text-[#7A8A82] truncate font-mono">
                        @{currentUser.username}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick Navigation Items */}
                <div className="py-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectTab('profile')}
                    className="w-full px-4 py-2.5 text-left text-xs font-medium text-[#2D3732] hover:bg-[#F1F5F2] flex items-center gap-2.5 cursor-pointer"
                  >
                    <UserCheck size={15} className="text-[#5E7C6E]" />
                    <span>Your Profile & Highlights</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-medium text-[#2D3732] hover:bg-[#F1F5F2] flex items-center gap-2.5 cursor-pointer"
                  >
                    <Settings size={15} className="text-[#5E7C6E]" />
                    <span>Settings & Privacy</span>
                  </button>
                </div>

                {/* Real Logout Item */}
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      auraAudio.playClick(400, 0.05);
                      await signOut();
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <LogOut size={15} />
                    <span>Sign Out of Aura</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
