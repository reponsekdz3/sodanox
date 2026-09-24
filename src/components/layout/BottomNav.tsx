import React from 'react';
import { Home, Compass, Film, MessageSquare, User as UserIcon } from 'lucide-react';
import { auraAudio } from '../../utils/audioSynthesizer';
import { HeroAddIcon } from '../common/HeroAddIcon';

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
  const handleTabClick = (tab: 'feed' | 'reels' | 'messages' | 'explore' | 'profile') => {
    auraAudio.playClick(680, 0.03);
    onSelectTab(tab);
  };

  const handleCreateClick = () => {
    auraAudio.playClick(750, 0.04);
    onOpenCreatePost();
  };

  return (
    <nav className="md:hidden fixed bottom-2.5 left-3 right-3 z-40 bg-[#FAFAF9]/95 backdrop-blur-xl border border-[#2D3732]/10 rounded-3xl px-2 py-1.5 shadow-xl select-none max-w-md mx-auto">
      <div className="grid grid-cols-5 items-center h-13">
        {/* 1. Feed / Home */}
        <button
          type="button"
          onClick={() => handleTabClick('feed')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'feed'
              ? 'text-[#2D3732] font-semibold scale-105'
              : 'text-[#7A8A82] hover:text-[#2D3732]'
          }`}
          title="Home Feed"
        >
          <div className="relative p-1">
            <Home
              size={20}
              className={currentTab === 'feed' ? 'stroke-[2.5] text-[#5E7C6E]' : ''}
            />
            {currentTab === 'feed' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5E7C6E]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Home</span>
        </button>

        {/* 2. Explore & Search */}
        <button
          type="button"
          onClick={() => handleTabClick('explore')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-all cursor-pointer ${
            currentTab === 'explore'
              ? 'text-[#2D3732] font-semibold scale-105'
              : 'text-[#7A8A82] hover:text-[#2D3732]'
          }`}
          title="Explore"
        >
          <div className="relative p-1">
            <Compass
              size={20}
              className={currentTab === 'explore' ? 'stroke-[2.5] text-[#5E7C6E]' : ''}
            />
            {currentTab === 'explore' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#5E7C6E]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight">Explore</span>
        </button>

        {/* 3. Center Elevated Quick Create Button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleCreateClick}
            className="group w-11 h-11 rounded-2xl bg-gradient-to-r from-[#2F4438] via-[#4A6757] to-[#719181] hover:brightness-110 text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer ring-1 ring-white/30 border border-white/20"
            title="Create Post or Reflection"
          >
            <HeroAddIcon size={20} />
          </button>
        </div>

        {/* 4. Messages / Chat */}
        <button
          type="button"
          onClick={() => handleTabClick('messages')}
          className={`min-h-[44px] flex flex-col items-center justify-center relative transition-all cursor-pointer ${
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

        {/* 5. Profile */}
        <button
          type="button"
          onClick={() => handleTabClick('profile')}
          className={`min-h-[44px] flex flex-col items-center justify-center transition-all cursor-pointer ${
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
