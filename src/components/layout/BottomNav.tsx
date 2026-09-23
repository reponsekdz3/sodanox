import React from 'react';
import { Home, Play, MessageSquare, Compass, User as UserIcon, Plus } from 'lucide-react';
import { User } from '../../types';

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
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAFAF9]/95 backdrop-blur-md border-t border-[#F1F5F2] px-2 py-1 shadow-soft">
      <div className="grid grid-cols-5 items-center h-14">
        {/* Feed */}
        <button
          onClick={() => onSelectTab('feed')}
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center transition-colors ${
            currentTab === 'feed' ? 'text-[#2D3732]' : 'text-[#7A8A82]'
          }`}
          title="Feed"
        >
          <Home size={22} className={currentTab === 'feed' ? 'stroke-[2.5]' : ''} />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Feed</span>
        </button>

        {/* Reels */}
        <button
          onClick={() => onSelectTab('reels')}
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center transition-colors ${
            currentTab === 'reels' ? 'text-[#2D3732]' : 'text-[#7A8A82]'
          }`}
          title="Reels"
        >
          <Play size={22} className={currentTab === 'reels' ? 'stroke-[2.5]' : ''} />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Reels</span>
        </button>

        {/* Create Post Center Button */}
        <button
          onClick={onOpenCreatePost}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center -mt-3"
          title="Create Post"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#8FA89B] text-white flex items-center justify-center shadow-soft active:scale-95 transition-transform">
            <Plus size={22} strokeWidth={2.5} />
          </div>
        </button>

        {/* Messages */}
        <button
          onClick={() => onSelectTab('messages')}
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center relative transition-colors ${
            currentTab === 'messages' ? 'text-[#2D3732]' : 'text-[#7A8A82]'
          }`}
          title="Messages"
        >
          <div className="relative">
            <MessageSquare
              size={22}
              className={currentTab === 'messages' ? 'stroke-[2.5]' : ''}
            />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-[#8FA89B] text-white text-[9px] font-bold flex items-center justify-center">
                {unreadMessagesCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Chat</span>
        </button>

        {/* Profile */}
        <button
          onClick={() => onSelectTab('profile')}
          className={`min-h-[44px] min-w-[44px] flex flex-col items-center justify-center transition-colors ${
            currentTab === 'profile' ? 'text-[#2D3732]' : 'text-[#7A8A82]'
          }`}
          title="Profile"
        >
          <UserIcon
            size={22}
            className={currentTab === 'profile' ? 'stroke-[2.5]' : ''}
          />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Profile</span>
        </button>
      </div>
    </div>
  );
};
