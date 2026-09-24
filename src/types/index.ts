export interface NotificationPreferences {
  likes: boolean;
  comments: boolean;
  directChats: boolean;
  calls: boolean;
  follows: boolean;
}

export interface MediaPreferences {
  autoPlayReels: boolean;
  highQualityUploads: boolean;
  soundEffects: boolean;
}

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatar: string;
  bannerUrl?: string;
  bio: string;
  pronouns?: string;
  location?: string;
  website?: string;
  joinedDate: string;
  followersCount: number;
  followingCount: number;
  followers?: string[];
  following?: string[];
  isFollowing?: boolean;
  isFollower?: boolean;
  isMutual?: boolean;
  verified?: boolean;
  privateAccount?: boolean;
  themePreference?: 'light' | 'dark' | 'cream' | 'nordic' | 'alabaster' | 'dusk';
  allowMessagesFrom?: 'everyone' | 'followers';
  showOnlineStatus?: boolean;
  allowReshare?: boolean;
  notificationPreferences?: NotificationPreferences;
  mediaPreferences?: MediaPreferences;
  blockedUsers?: string[];
}

export type StoryFilter = 'none' | 'vintage' | 'nordic' | 'noir' | 'golden' | 'sepia' | 'emerald';

export interface StorySticker {
  id: string;
  type: 'poll' | 'question' | 'music' | 'location' | 'mention' | 'emoji_slider';
  data: {
    question?: string;
    options?: { id: string; text: string; votes: number }[];
    userVotes?: Record<string, string>; // userId -> optionId
    answers?: { userId: string; userName: string; userAvatar?: string; answer: string; timestamp: string }[];
    trackTitle?: string;
    artist?: string;
    locationName?: string;
    username?: string;
    emoji?: string;
    sliderValue?: number;
  };
}

export interface StoryTextOverlay {
  text: string;
  font: 'sans' | 'serif' | 'mono' | 'hand' | 'display';
  color: string;
  hasBackground: boolean;
  align: 'left' | 'center' | 'right';
}

export interface StoryViewerInfo {
  userId: string;
  userName: string;
  userAvatar: string;
  viewedAt: string;
}

export interface StoryItem {
  id: string;
  mediaUrl: string;
  type: 'image' | 'video';
  timestamp: string;
  caption?: string;
  moodTag?: string;
  filter?: StoryFilter;
  stickers?: StorySticker[];
  textOverlay?: StoryTextOverlay;
  likedBy?: string[];
  likesCount?: number;
}

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatar: string;
  hasUnseen: boolean;
  items: StoryItem[];
  viewers?: string[];
  viewersList?: StoryViewerInfo[];
  likesCount?: number;
  likedBy?: string[];
  createdAt?: any;
}

export interface StoryHighlight {
  id: string;
  userId: string;
  title: string;
  coverUrl: string;
  items: StoryItem[];
  createdAt?: any;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  timestamp: string;
  likesCount: number;
  hasLiked: boolean;
  replies?: Comment[];
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVotedId?: string;
}

export interface Post {
  id: string;
  author: User;
  timestamp: string;
  content: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video';
  location?: string;
  audience?: 'public' | 'followers';
  commentsDisabled?: boolean;
  likesCount: number;
  hasLiked: boolean;
  likedBy?: string[];
  bookmarksCount: number;
  isBookmarked: boolean;
  commentsCount: number;
  comments: Comment[];
  tags: string[];
  poll?: Poll;
  sharesCount: number;
  sharedBy?: string[];
  viewsCount?: number;
  viewedBy?: string[];
  repostsCount?: number;
  hasReposted?: boolean;
  repostedBy?: string[];
  repostAuthor?: User;
  repostComment?: string;
  quotedPost?: Post;
  createdAt?: any;
}

export interface Reel {
  id: string;
  author: User;
  videoUrl: string;
  posterUrl: string;
  caption: string;
  tags: string[];
  audioTrack: {
    title: string;
    artist: string;
  };
  likesCount: number;
  hasLiked: boolean;
  commentsCount: number;
  comments: Comment[];
  sharesCount: number;
  isSaved: boolean;
}

export interface FileAttachment {
  name: string;
  size: string;
  type: string;
  url: string;
}

export interface VoiceNoteMeta {
  duration: number; // in seconds
  waveform: number[];
  audioUrl?: string;
}

export interface Message {
  id: string;
  senderId: string;
  timestamp: string;
  type: 'text' | 'file' | 'voice' | 'image';
  text?: string;
  file?: FileAttachment;
  voice?: VoiceNoteMeta;
  status: 'sent' | 'delivered' | 'read';
  reaction?: string;
}

export interface ChatConversation {
  id: string;
  participant: User;
  lastMessage: Message;
  unreadCount: number;
  isOnline: boolean;
  lastSeen?: string;
  isTyping?: boolean;
  messages: Message[];
}

export interface ActiveCall {
  id: string;
  participant: User;
  type: 'audio' | 'video';
  status: 'ringing' | 'connected' | 'ended';
  durationSeconds: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isMinimized: boolean;
}

export interface NotificationItem {
  id: string;
  user: User;
  type:
    | 'like'
    | 'comment'
    | 'follow'
    | 'call'
    | 'mention'
    | 'repost'
    | 'share'
    | 'story_reply'
    | 'story_like'
    | 'reel_like';
  targetTitle?: string;
  targetId?: string;
  targetType?: 'post' | 'reel' | 'story' | 'profile';
  actionSnippet?: string;
  timestamp: string;
  read: boolean;
  createdAt?: any;
  recipientId?: string;
}
