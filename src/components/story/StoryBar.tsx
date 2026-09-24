import React from 'react';
import { Plus } from 'lucide-react';
import { Story, User } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';

interface StoryBarProps {
  stories: Story[];
  currentUser: User;
  onSelectStory: (storyIndex: number) => void;
  onOpenCreateStory: () => void;
}

export const StoryBar: React.FC<StoryBarProps> = ({
  stories,
  currentUser,
  onSelectStory,
  onOpenCreateStory,
}) => {
  const myStoryIndex = stories.findIndex((s) => s.userId === currentUser.id);
  const myStory = myStoryIndex !== -1 ? stories[myStoryIndex] : null;

  return (
    <div className="w-full bg-[#FAFAF9] border-b border-[#F1F5F2] py-4 px-4 sm:px-6">
      <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none">
        {/* Your Story button */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 group">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (myStory) {
                  onSelectStory(myStoryIndex);
                } else {
                  onOpenCreateStory();
                }
              }}
              className={`w-16 h-16 rounded-full p-[2.5px] transition-all transform group-hover:scale-105 ${
                myStory
                  ? 'bg-gradient-to-tr from-[#8FA89B] via-[#6d8a7c] to-[#E6EDE9]'
                  : 'bg-[#E6EDE9] hover:bg-[#8FA89B]/40'
              }`}
            >
              <div className="w-full h-full rounded-full p-[2px] bg-[#FAFAF9] flex items-center justify-center">
                <ModernAvatar
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  size="lg"
                  className="w-full h-full"
                />
              </div>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateStory();
              }}
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[#8FA89B] hover:bg-[#7a9486] text-white flex items-center justify-center border-2 border-[#FAFAF9] shadow-soft cursor-pointer transition-transform hover:scale-110"
              title="Create new story"
            >
              <Plus size={12} strokeWidth={3} />
            </button>
          </div>
          <span className="text-xs font-medium text-[#2D3732] truncate max-w-[70px]">
            {myStory ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Stories from others */}
        {stories
          .filter((s) => s.userId !== currentUser.id)
          .map((story) => {
            const actualIndex = stories.findIndex((item) => item.id === story.id);
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => onSelectStory(actualIndex)}
                className="flex flex-col items-center gap-1.5 shrink-0 group focus-visible:outline-none cursor-pointer"
              >
                <div
                  className={`w-16 h-16 rounded-full p-[2.5px] transition-all transform group-hover:scale-105 ${
                    story.hasUnseen
                      ? 'bg-gradient-to-tr from-[#8FA89B] via-[#A7C2B4] to-[#E6EDE9]'
                      : 'bg-[#E6EDE9]'
                  }`}
                >
                  <div className="w-full h-full rounded-full p-[2px] bg-[#FAFAF9] flex items-center justify-center">
                    <ModernAvatar
                      src={story.userAvatar}
                      alt={story.userName}
                      size="lg"
                      className="w-full h-full"
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-[#2D3732] truncate max-w-[72px]">
                  {story.userName.split(' ')[0]}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
};
