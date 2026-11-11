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
  phone?: string;
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
  authProvider?: 'google' | 'password' | 'email';
  emailVerified?: boolean;
  privateAccount?: boolean;
  themePreference?: 'light' | 'dark' | 'cream' | 'nordic' | 'alabaster' | 'dusk';
  allowMessagesFrom?: 'everyone' | 'followers';
  showOnlineStatus?: boolean;
  allowReshare?: boolean;
  notificationPreferences?: NotificationPreferences;
  mediaPreferences?: MediaPreferences;
  blockedUsers?: string[];
  verifiedBadgeType?: 'blue' | 'gold' | 'none';
  verifiedSince?: number;
  isAdmin?: boolean;
  isSuspended?: boolean;
  subscription?: { planId: string; planName: string; status: 'active' | 'expired' | 'cancelled' | 'none'; startedAt: number; expiresAt: number; transactionRef?: string; billingMode?: 'manual_renewal' };
  detectedLocation?: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    enabledAt: number;
  };
}

export type StoryFilter = 'none' | 'vintage' | 'nordic' | 'noir' | 'golden' | 'sepia' | 'emerald' | 'cyber' | 'sunset' | 'grain';

export interface StorySticker {
  id: string;
  type: 'poll' | 'question' | 'music' | 'location' | 'mention' | 'emoji_slider' | 'link' | 'countdown';
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
    linkUrl?: string;
    linkLabel?: string;
    countdownTitle?: string;
    countdownTargetMs?: number;
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
  createdAtMs?: number;
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
  bookmarkedBy?: string[];
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
  audioTrack?: { title: string; artist: string };
  filter?: StoryFilter;
  fontStyle?: 'sans' | 'serif' | 'mono' | 'nordic';
  resolution?: '4k' | '1080p' | '720p' | 'original';
  aspectRatio?: 'original' | '1:1' | '4:5' | '16:9' | '9:16';
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
  likedBy?: string[];
  savedBy?: string[];
  createdAt?: any;
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
  audioBlob?: Blob;
}

export interface MessageReplyInfo {
  id: string;
  senderId: string;
  senderName?: string;
  text?: string;
  type?: 'text' | 'file' | 'voice' | 'image' | 'video' | 'call' | 'post' | 'reel' | 'story';
}

export interface CallMeta {
  callType: 'audio' | 'video';
  status: 'completed' | 'missed' | 'declined';
  durationSeconds?: number;
}

export interface SharedPostMeta {
  postId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  mediaUrl?: string;
  timestamp?: string;
}

export interface SharedReelMeta {
  reelId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  caption: string;
  videoUrl: string;
  posterUrl: string;
  timestamp?: string;
  audioTrack?: string;
}

export interface SharedStoryMeta {
  storyId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  mediaUrl: string;
  caption?: string;
  timestamp?: string;
  mediaType?: 'image' | 'video';
}

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  timestamp: string;
  type: 'text' | 'file' | 'voice' | 'image' | 'video' | 'call' | 'post' | 'reel' | 'story';
  text?: string;
  file?: FileAttachment;
  voice?: VoiceNoteMeta;
  callMeta?: CallMeta;
  sharedPost?: SharedPostMeta;
  sharedReel?: SharedReelMeta;
  sharedStory?: SharedStoryMeta;
  status: 'sent' | 'delivered' | 'read';
  reaction?: string;
  replyTo?: MessageReplyInfo;
  readAt?: any;
  createdAt?: any;
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
  direction?: 'incoming' | 'outgoing';
  durationSeconds: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  isMinimized: boolean;
  callSignalingId?: string;
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

export interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: 'RWF' | 'USD' | 'EUR';
  category: 'Tech' | 'Fashion' | 'Home' | 'Art' | 'Photography' | 'Vehicles' | 'Services' | 'Books' | 'Digital' | 'Other';
  condition: 'Brand New' | 'Like New' | 'Gently Used' | 'Refurbished';
  images: string[];
  seller: User;
  location: string;
  createdAt: number;
  isSold: boolean;
  isReserved?: boolean;
  shippingAvailable?: boolean;
  negotiable?: boolean;
  savedBy?: string[];
  updatedAt?: number;
  tags: string[];
  contactPhone?: string;
  contactEmail?: string;
  viewsCount?: number;
  isPromoted?: boolean;
  imageUrl?: string;
  sellerName?: string;
}

export interface SponsoredAd {
  id: string;
  type: 'feed_post' | 'story_ad';
  title: string;
  description: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  ctaText: string;
  ctaUrl?: string;
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  sellerUsername: string;
  budget: number;
  impressions: number;
  clicks: number;
  status: 'active' | 'pending' | 'paused' | 'ended';
  createdAt: number;
  targetCategory?: string;
  spent?: number;
  ctr?: number;
}

export interface VerificationPayment {
  id: string;
  userId: string;
  username: string;
  userEmail: string;
  provider: 'flutterwave' | 'stripe' | 'mtn_momo';
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  transactionRef: string;
  phoneNumber?: string;
  createdAt: number;
}
