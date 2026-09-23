import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Bell,
  MessageSquare,
  Compass,
  Play,
  Home,
  UserCheck,
  LogIn,
  ChevronDown,
  Settings,
  LogOut,
} from 'lucide-react';
import { User } from '../../types';
import { useAuth } from '../../context/AuthContext';

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

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAFAF9]/90 backdrop-blur-md border-b border-[#F1F5F2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => onSelectTab('feed')}
          className="text-xl font-serif font-semibold tracking-tight text-[#2D3732] hover:opacity-80 transition-opacity focus-visible:outline-none flex items-center gap-2.5 cursor-pointer"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-[#8FA89B] shadow-xs" />
          <span className="tracking-wide">Aura</span>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => onSelectTab('feed')}
            className={`transition-colors relative py-1 cursor-pointer ${
              currentTab === 'feed'
                ? 'text-[#2D3732] font-semibold'
                : 'text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            Feed
            {currentTab === 'feed' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8FA89B] rounded-full" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('reels')}
            className={`transition-colors relative py-1 cursor-pointer ${
              currentTab === 'reels'
                ? 'text-[#2D3732] font-semibold'
                : 'text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            Reels
            {currentTab === 'reels' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8FA89B] rounded-full" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('messages')}
            className={`transition-colors relative py-1 flex items-center gap-1.5 cursor-pointer ${
              currentTab === 'messages'
                ? 'text-[#2D3732] font-semibold'
                : 'text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            <span>Messages</span>
            {unreadMessagesCount > 0 && (
              <span className="px-1.5 py-0.2 bg-[#8FA89B] text-white text-[10px] font-semibold rounded-full tabular-nums">
                {unreadMessagesCount}
              </span>
            )}
            {currentTab === 'messages' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8FA89B] rounded-full" />
            )}
          </button>

          <button
            onClick={() => onSelectTab('explore')}
            className={`transition-colors relative py-1 cursor-pointer ${
              currentTab === 'explore'
                ? 'text-[#2D3732] font-semibold'
                : 'text-[#7A8A82] hover:text-[#2D3732]'
            }`}
          >
            Explore
            {currentTab === 'explore' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8FA89B] rounded-full" />
            )}
          </button>

          <button
            onClick={onOpenNotifications}
            className="transition-colors relative py-1 text-[#7A8A82] hover:text-[#2D3732] flex items-center gap-1.5 cursor-pointer"
          >
            <span>Activity</span>
            {unreadNotificationsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#8FA89B]" />
            )}
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-3">
          {/* Notification bell on mobile */}
          <button
            onClick={onOpenNotifications}
            className="md:hidden p-2 rounded-full text-[#7A8A82] hover:text-[#2D3732] relative cursor-pointer"
            title="Activity"
          >
            <Bell size={20} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#8FA89B]" />
            )}
          </button>

          {/* Create Post Button */}
          <button
            onClick={onOpenCreatePost}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-2xl bg-[#8FA89B] hover:bg-[#7e9689] text-white text-xs sm:text-sm font-medium transition-all shadow-soft active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Create</span>
          </button>

          {/* Account / User Menu Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1 rounded-2xl hover:bg-[#F1F5F2] transition-colors focus-visible:outline-none cursor-pointer"
              title="Account & Settings"
            >
              <div
                className={`w-9 h-9 rounded-2xl overflow-hidden p-0.5 transition-all ${
                  currentTab === 'profile'
                    ? 'ring-2 ring-[#8FA89B]'
                    : 'hover:ring-2 hover:ring-[#E6EDE9]'
                }`}
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full rounded-xl object-cover"
                />
              </div>
              <ChevronDown size={14} className="text-[#7A8A82] hidden sm:block" />
            </button>

            {isDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-60 bg-[#FAFAF9] rounded-2xl border border-[#2D3732]/10 shadow-xl py-2 z-50 animate-fade-in"
                onClick={() => setIsDropdownOpen(false)}
              >
                <div className="px-4 py-2.5 border-b border-[#2D3732]/5">
                  <p className="text-xs font-semibold text-[#2D3732] truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-[#7A8A82] truncate font-mono">
                    @{currentUser.username}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectTab('profile')}
                  className="w-full px-4 py-2 text-left text-xs text-[#2D3732] hover:bg-[#F1F5F2] flex items-center gap-2.5 cursor-pointer"
                >
                  <UserCheck size={15} className="text-[#8FA89B]" />
                  <span>Your Studio Profile</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="w-full px-4 py-2 text-left text-xs text-[#2D3732] hover:bg-[#F1F5F2] flex items-center gap-2.5 cursor-pointer"
                >
                  <Settings size={15} className="text-[#8FA89B]" />
                  <span>Settings & Privacy</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full px-4 py-2 text-left text-xs text-[#2D3732] hover:bg-[#F1F5F2] flex items-center gap-2.5 cursor-pointer border-t border-[#2D3732]/5 mt-1 pt-2"
                >
                  <LogIn size={15} className="text-[#8FA89B]" />
                  <span>Switch Account / Persona</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
