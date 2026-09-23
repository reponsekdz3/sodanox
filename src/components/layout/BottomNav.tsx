import React from 'react';
import { Home, Compass, Film, MessageSquare, User as UserIcon, Plus } from 'lucide-react';

interface BottomNavProps {
  currentTab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile';
  unreadMessagesCount: number;
  onSelectTab: (tab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile') => void;
  onOpenCreatePost: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  unreadMessagesCount,
  onSelectTab,
  onOpenCreatePost,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAFAF9]/95 backdrop-blur-md border-t border-[#E6EDE9] px-2 py-1 shadow-soft-lg select-none">
      <div className="grid grid-cols-5 items-center h-14 max-w-lg mx-auto">
        {/* Feed / Home */}
        <button
          type="button"
          onClick={() => onSelectTab('feed')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-all ${
            currentTab === 'feed'
              ? 'text-[#2D3732] font-semibold scale-105'
              : 'text-[#7A8A82] hover:text-[#2D3732]'
          }`}
          title="Home Feed"
        >
          <div className="relative p-1">
            <Home size={20} className={currentTab === 'feed' ? 'stroke-[2.5] text-[#5E7C6E]' : ''} />
            {currentTab === 'feed' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5E7C6E]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        {/* Explore */}
        <button
          type="button"
          onClick={() => onSelectTab('explore')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-all ${
            currentTab === 'explore'
              ? 'text-[#2D3732] font-semibold scale-105'
              : 'text-[#7A8A82] hover:text-[#2D3732]'
          }`}
          title="Explore"
        >
          <div className="relative p-1">
            <Compass size={20} className={currentTab === 'explore' ? 'stroke-[2.5] text-[#5E7C6E]' : ''} />
            {currentTab === 'explore' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5E7C6E]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Explore</span>
        </button>

        {/* Reels */}
        <button
          type="button"
          onClick={() => onSelectTab('reels')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-all ${
            currentTab === 'reels'
              ? 'text-[#2D3732] font-semibold scale-105'
              : 'text-[#7A8A82] hover:text-[#2D3732]'
          }`}
          title="Cinema & Reels"
        >
          <div className="relative p-1">
            <Film size={20} className={currentTab === 'reels' ? 'stroke-[2.5] text-[#5E7C6E]' : ''} />
            {currentTab === 'reels' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5E7C6E]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Reels</span>
        </button>

        {/* Messages */}
        <button
          type="button"
          onClick={() => onSelectTab('messages')}
          className={`min-h-[44px] flex flex-col items-center justify-center relative transition-all ${
            currentTab === 'messages'
              ? 'text-[#2D3732] font-semibold scale-105'
              : 'text-[#7A8A82] hover:text-[#2D3732]'
          }`}
          title="Messages"
        >
          <div className="relative p-1">
            <MessageSquare
              size={20}
              className={currentTab === 'messages' ? 'stroke-[2.5] text-[#5E7C6E]' : ''}
            />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-0.5 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#8FA89B] text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {unreadMessagesCount}
              </span>
            )}
            {currentTab === 'messages' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5E7C6E]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Chat</span>
        </button>

        {/* Profile */}
        <button
          type="button"
          onClick={() => onSelectTab('profile')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-all ${
            currentTab === 'profile'
              ? 'text-[#2D3732] font-semibold scale-105'
              : 'text-[#7A8A82] hover:text-[#2D3732]'
          }`}
          title="Profile"
        >
          <div className="relative p-1">
            <UserIcon
              size={20}
              className={currentTab === 'profile' ? 'stroke-[2.5] text-[#5E7C6E]' : ''}
            />
            {currentTab === 'profile' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5E7C6E]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Profile</span>
        </button>
      </div>
    </nav>
  );
};
