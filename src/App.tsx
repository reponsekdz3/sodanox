import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './context/AuthContext';
import {
  User,
  Post,
  Reel,
  Story,
  StoryItem,
  ChatConversation,
  ActiveCall,
  NotificationItem,
  StoryHighlight,
} from './types';

import { Navbar } from './components/layout/Navbar';
import { SidebarNav } from './components/layout/SidebarNav';
import { BottomNav } from './components/layout/BottomNav';
import { Feed } from './components/feed/Feed';
import { ReelsFeed } from './components/reels/ReelsFeed';
import { MessagesView } from './components/messages/MessagesView';
import { ExploreView } from './components/explore/ExploreView';
import { ProfileView } from './components/profile/ProfileView';
import { StoryViewerModal } from './components/story/StoryViewerModal';
import { CreateStoryModal } from './components/story/CreateStoryModal';
import { CreatePostModal } from './components/feed/CreatePostModal';
import { CreateReelModal } from './components/reels/CreateReelModal';
import { EditProfileModal } from './components/profile/EditProfileModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { ActiveCallModal } from './components/calls/ActiveCallModal';
import { FloatingCallPill } from './components/calls/FloatingCallPill';
import { IncomingCallModal } from './components/calls/IncomingCallModal';
import { NotificationsDrawer } from './components/notifications/NotificationsDrawer';
import { AuthPage } from './components/auth/AuthPage';
import {
  initiateCallSession,
  subscribeToIncomingCalls,
  acceptCallSession,
  declineCallSession,
  endCallSession,
  CallSession,
} from './services/callService';

import {
  subscribeToPosts,
  createNewPost,
  toggleLikePost,
  toggleBookmarkPost,
  toggleRepostPost,
  incrementPostShareCount,
  addCommentToPost,
  toggleLikeComment,
  deleteCommentFromPost,
  voteInPoll,
  deletePostFromFirestore,
  updatePostContent,
} from './services/postService';
import {
  subscribeToStories,
  createStoryInFirestore,
  recordStoryView,
  deleteStory,
  toggleLikeStory,
} from './services/storyService';
import {
  subscribeToReels,
  createNewReel,
  toggleLikeReel,
  toggleBookmarkReel,
  addCommentToReel,
  incrementReelShareCount,
} from './services/reelService';
import {
  subscribeToNotifications,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from './services/notificationService';
import {
  subscribeToUserConversations,
  getOrCreateConversation,
  sendChatMessage,
} from './services/chatService';
import {
  toggleFollowUser,
  getAllUsers,
  getSuggestedUsers,
} from './services/userService';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from './components/common/ModernAvatar';

export default function App() {
  const { currentUser: fbAuthUser, userProfile, isAuthenticated, loading, updateUser } = useAuth();

  // Navigation & View state
  const [currentTab, setCurrentTab] = useState<'feed' | 'reels' | 'messages' | 'explore' | 'profile'>('feed');
  const [targetChatUser, setTargetChatUser] = useState<User | null>(null);
  const [isMobileChatActive, setIsMobileChatActive] = useState(false);

  // Firestore Real-time Data state
  const [posts, setPosts] = useState<Post[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [communityUsers, setCommunityUsers] = useState<User[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);

  // Calling state
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);

  // Modals state
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [viewerStories, setViewerStories] = useState<Story[]>([]);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [createPostInitialPrompt, setCreatePostInitialPrompt] = useState<string>('');
  const [isCreateReelOpen, setIsCreateReelOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

  // Current active user (guaranteed non-null when authenticated)
  const currentUser: User | null = useMemo(() => {
    if (userProfile) {
      return {
        ...userProfile,
        avatar: isMockOrEmptyAvatar(userProfile.avatar) ? MODERN_EMPTY_AVATAR_DATA_URI : userProfile.avatar,
      };
    }
    if (fbAuthUser) {
      const rawName = fbAuthUser.displayName || (fbAuthUser.email ? fbAuthUser.email.split('@')[0] : 'Aura Creator');
      const cleanUsername = (fbAuthUser.email ? fbAuthUser.email.split('@')[0] : `aura_${fbAuthUser.uid.slice(0, 5)}`)
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, '');
      const rawAvatar = fbAuthUser.photoURL;
      const avatar = isMockOrEmptyAvatar(rawAvatar) ? MODERN_EMPTY_AVATAR_DATA_URI : rawAvatar!;
      return {
        id: fbAuthUser.uid,
        name: rawName,
        username: cleanUsername,
        avatar,
        bannerUrl: '',
        bio: 'Exploring craft, mindfulness, and slow reflections on Aura.',
        pronouns: '',
        location: '',
        website: '',
        joinedDate: `Joined ${new Date().toLocaleString('default', { month: 'long' })} ${new Date().getFullYear()}`,
        followersCount: 0,
        followingCount: 0,
        followers: [],
        following: [],
        isFollowing: false,
        isFollower: false,
        isMutual: false,
        verified: true,
        email: fbAuthUser.email || '',
        privateAccount: false,
        showOnlineStatus: true,
        allowReshare: true,
        themePreference: 'nordic',
      };
    }
    return null;
  }, [userProfile, fbAuthUser]);

  // Profile currently being viewed
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  // Sync viewing user on mount or when user updates own profile
  useEffect(() => {
    if (userProfile && (!viewingUser || viewingUser.id === userProfile.id)) {
      setViewingUser(userProfile);
    }
  }, [userProfile]);

  const refreshCommunity = async (uid: string) => {
    try {
      const [all, suggested] = await Promise.all([
        getAllUsers(uid, uid),
        getSuggestedUsers(uid, 12),
      ]);
      setCommunityUsers(all);
      setSuggestedUsers(suggested);
    } catch (err) {
      console.error('Error fetching community users:', err);
    }
  };

  // Load registered community creators from Firestore
  useEffect(() => {
    if (!currentUser) return;
    refreshCommunity(currentUser.id);
  }, [currentUser?.id]);

  // Real-time subscription to Posts in Firestore
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubPosts = subscribeToPosts(
      currentUser.id,
      (fetchedPosts) => {
        setPosts(fetchedPosts);
      },
      (err) => console.warn('Posts sync error:', err)
    );
    return () => unsubPosts();
  }, [currentUser?.id]);

  // Real-time subscription to Stories in Firestore
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubStories = subscribeToStories(
      currentUser.id,
      (fetchedStories) => {
        setStories(fetchedStories);
      },
      (err) => console.warn('Stories sync error:', err)
    );
    return () => unsubStories();
  }, [currentUser?.id]);

  // Real-time subscription to Reels in Firestore
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsubReels = subscribeToReels(
      currentUser.id,
      (fetchedReels) => {
        setReels(fetchedReels);
      },
      (err) => console.warn('Reels sync error:', err)
    );
    return () => unsubReels();
  }, [currentUser?.id]);

  // Real-time subscription to Notifications in Firestore
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;
    const unsubNotifs = subscribeToNotifications(
      currentUser.id,
      (fetchedNotifs) => {
        setNotifications(fetchedNotifs);
      },
      (err) => console.warn('Notifications sync error:', err)
    );
    return () => unsubNotifs();
  }, [isAuthenticated, currentUser?.id]);

  // Real-time subscription to Conversations in Firestore
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;
    const unsubConvs = subscribeToUserConversations(
      currentUser.id,
      (convs) => {
        setConversations(convs);
      },
      (err) => console.warn('Convs sync error:', err)
    );
    return () => unsubConvs();
  }, [isAuthenticated, currentUser?.id]);

  // Derived counts
  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const totalUnreadNotifications = notifications.filter((n) => !n.read).length;

  // ---------------- Handlers for Navigation ----------------
  const handleOpenUserProfile = (user: User) => {
    setViewingUser(user);
    setCurrentTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDirectChat = (user: User) => {
    setTargetChatUser(user);
    setCurrentTab('messages');
  };

  // ---------------- Handlers for Stories ----------------
  const handleSelectStory = (index: number) => {
    setViewerStories(stories);
    setActiveStoryIndex(index);
    setIsStoryViewerOpen(true);
  };

  const handleSelectHighlight = (hl: StoryHighlight) => {
    if (!viewingUser) return;
    const hlStory: Story = {
      id: hl.id,
      userId: hl.userId,
      userName: `${viewingUser.name} · ${hl.title}`,
      userUsername: viewingUser.username,
      userAvatar: hl.coverUrl,
      items: hl.items,
      hasUnseen: false,
      createdAt: hl.createdAt,
    };
    setViewerStories([hlStory]);
    setActiveStoryIndex(0);
    setIsStoryViewerOpen(true);
  };

  const handleAddStory = async (newItem: StoryItem) => {
    if (!currentUser) return;
    await createStoryInFirestore(currentUser, newItem);
  };

  const handleRecordStoryView = async (storyId: string) => {
    if (!currentUser) return;
    try {
      await recordStoryView(storyId, currentUser.id, currentUser);
    } catch (err) {
      console.error('Error recording story view:', err);
    }
  };

  const handleLikeStory = async (storyId: string, itemIndex: number) => {
    if (!currentUser) return;
    try {
      await toggleLikeStory(storyId, itemIndex, currentUser.id, currentUser);
    } catch (err) {
      console.error('Error toggling story like:', err);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    try {
      await deleteStory(storyId);
    } catch (err) {
      console.error('Error deleting story:', err);
    }
  };

  const handleSendStoryReply = async (storyOwnerId: string, text: string) => {
    if (!currentUser) return;
    try {
      const targetUser = communityUsers.find((u) => u.id === storyOwnerId) || {
        id: storyOwnerId,
        name: 'Story Author',
        username: 'creator',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        bio: '',
        joinedDate: '',
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
      };
      const convId = await getOrCreateConversation(currentUser, targetUser);
      await sendChatMessage(
        convId,
        { text: `Replying to story: ${text}`, type: 'text' },
        currentUser,
        storyOwnerId
      );
    } catch (err) {
      console.error('Error sending story reply:', err);
    }
  };

  // ---------------- Handlers for Posts ----------------
  const handleLikePost = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    try {
      await toggleLikePost(
        postId,
        currentUser.id,
        post.hasLiked,
        post.author.id,
        currentUser
      );
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const handleBookmarkPost = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    try {
      await toggleBookmarkPost(postId, currentUser.id, post.isBookmarked);
    } catch (err) {
      console.error('Error bookmarking post:', err);
    }
  };

  const handleRepostPost = async (postId: string, quoteComment?: string) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    try {
      await toggleRepostPost(
        postId,
        currentUser,
        post.hasReposted,
        quoteComment,
        post.author.id
      );
    } catch (err) {
      console.error('Error reposting:', err);
    }
  };

  const handleIncrementShare = async (postId: string) => {
    try {
      const targetPost = posts.find((p) => p.id === postId);
      await incrementPostShareCount(postId, currentUser, targetPost?.author.id);
    } catch (err) {
      console.error('Error incrementing share count:', err);
    }
  };

  const handleSendPostToChat = async (recipientId: string, messageText: string) => {
    if (!currentUser) return;
    try {
      const targetUser: User = communityUsers.find((u) => u.id === recipientId) || {
        id: recipientId,
        name: 'Community Member',
        username: 'member',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        bio: '',
        joinedDate: '',
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
      };
      const convId = await getOrCreateConversation(currentUser, targetUser);
      await sendChatMessage(
        convId,
        { text: messageText, type: 'text' },
        currentUser,
        recipientId
      );
    } catch (err) {
      console.error('Error sending post in chat:', err);
    }
  };

  const handleAddComment = async (
    postId: string,
    text: string,
    replyToCommentId?: string
  ) => {
    if (!currentUser) return;
    const post = posts.find((p) => p.id === postId);
    try {
      await addCommentToPost(
        postId,
        currentUser,
        text,
        replyToCommentId,
        post?.author.id
      );
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const handleLikeComment = async (postId: string, commentId: string) => {
    if (!currentUser) return;
    try {
      await toggleLikeComment(postId, commentId, currentUser.id);
    } catch (err) {
      console.error('Error liking comment:', err);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string, replyId?: string) => {
    try {
      await deleteCommentFromPost(postId, commentId, replyId);
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const handleVotePoll = async (postId: string, optionId: string) => {
    if (!currentUser) return;
    try {
      await voteInPoll(postId, optionId, currentUser.id);
    } catch (err) {
      console.error('Error voting in poll:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePostFromFirestore(postId);
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const handleEditPost = async (postId: string, newContent: string) => {
    try {
      await updatePostContent(postId, newContent);
    } catch (err) {
      console.error('Error editing post:', err);
    }
  };

  const handleCreatePost = async (newPostData: Partial<Post>) => {
    if (!currentUser) return;
    try {
      await createNewPost(
        currentUser,
        newPostData.content || '',
        newPostData.mediaUrl,
        newPostData.mediaType || 'image',
        newPostData.tags || [],
        newPostData.poll,
        newPostData.quotedPost,
        {
          mediaUrls: newPostData.mediaUrls,
          location: newPostData.location,
          audience: newPostData.audience,
          commentsDisabled: newPostData.commentsDisabled,
        }
      );
    } catch (err) {
      console.error('Error creating post in Firestore:', err);
    }
  };

  // ---------------- Handlers for Reels ----------------
  const handleLikeReel = async (reelId: string) => {
    if (!currentUser) return;
    const reel = reels.find((r) => r.id === reelId);
    if (!reel) return;
    try {
      await toggleLikeReel(
        reelId,
        currentUser.id,
        reel.hasLiked,
        reel.author.id,
        currentUser
      );
    } catch (err) {
      console.error('Error liking reel:', err);
    }
  };

  const handleBookmarkReel = async (reelId: string) => {
    if (!currentUser) return;
    const reel = reels.find((r) => r.id === reelId);
    if (!reel) return;
    try {
      await toggleBookmarkReel(reelId, currentUser.id, reel.isSaved);
    } catch (err) {
      console.error('Error bookmarking reel:', err);
    }
  };

  const handleAddReelComment = async (reelId: string, text: string) => {
    if (!currentUser) return;
    const reel = reels.find((r) => r.id === reelId);
    try {
      await addCommentToReel(reelId, currentUser, text, reel?.author.id);
    } catch (err) {
      console.error('Error adding reel comment:', err);
    }
  };

  const handleIncrementReelShare = async (reelId: string) => {
    try {
      await incrementReelShareCount(reelId);
    } catch (err) {
      console.error('Error sharing reel:', err);
    }
  };

  const handleCreateReel = async (data: {
    videoUrl: string;
    posterUrl: string;
    caption: string;
    tags: string[];
    audioTitle: string;
    audioArtist: string;
  }) => {
    if (!currentUser) return;
    try {
      await createNewReel(currentUser, data);
    } catch (err) {
      console.error('Error creating reel in Firestore:', err);
    }
  };

  // ---------------- Handlers for Following & Profile ----------------
  const handleToggleFollow = async (userId: string) => {
    if (!currentUser || userId === currentUser.id) return;

    // Accurately determine whether current user follows this target across all state sources
    const inCommunity = communityUsers.find((u) => u.id === userId);
    const inSuggested = suggestedUsers.find((u) => u.id === userId);
    const inViewing = viewingUser?.id === userId ? viewingUser : null;
    const isTargetFollowing = Boolean(
      inCommunity?.isFollowing ??
      inSuggested?.isFollowing ??
      inViewing?.isFollowing ??
      (currentUser.following || []).includes(userId)
    );

    const nextFollowing = !isTargetFollowing;

    // Optimistically update community users
    setCommunityUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            isFollowing: nextFollowing,
            followersCount: nextFollowing
              ? u.followersCount + 1
              : Math.max(0, u.followersCount - 1),
            isMutual: Boolean(nextFollowing && u.isFollower),
          };
        }
        return u;
      })
    );

    // Optimistically update suggested users
    setSuggestedUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            isFollowing: nextFollowing,
            followersCount: nextFollowing
              ? u.followersCount + 1
              : Math.max(0, u.followersCount - 1),
            isMutual: Boolean(nextFollowing && u.isFollower),
          };
        }
        return u;
      })
    );

    // Optimistically update viewingUser if currently looking at this user's profile
    if (viewingUser && viewingUser.id === userId) {
      setViewingUser({
        ...viewingUser,
        isFollowing: nextFollowing,
        followersCount: nextFollowing
          ? viewingUser.followersCount + 1
          : Math.max(0, viewingUser.followersCount - 1),
        isMutual: Boolean(nextFollowing && viewingUser.isFollower),
      });
    }

    // Optimistically update posts author status
    setPosts((prev) =>
      prev.map((p) => {
        if (p.author.id === userId) {
          return {
            ...p,
            author: {
              ...p.author,
              isFollowing: nextFollowing,
            },
          };
        }
        return p;
      })
    );

    try {
      await toggleFollowUser(currentUser.id, userId, isTargetFollowing, currentUser);
      // Background reload to sync exact counts
      refreshCommunity(currentUser.id);
    } catch (err) {
      console.error('Error toggling follow:', err);
      refreshCommunity(currentUser.id);
    }
  };

  const handleSaveProfile = async (updatedUser: Partial<User>) => {
    try {
      await updateUser(updatedUser);
      if (viewingUser && currentUser && viewingUser.id === currentUser.id) {
        setViewingUser((prev) => (prev ? { ...prev, ...updatedUser } : null));
      }
    } catch (err) {
      console.error('Error saving profile to Firestore:', err);
      throw err;
    }
  };

  // ---------------- Handlers for Notifications ----------------
  const handleMarkAllNotificationsRead = async () => {
    if (!currentUser) return;
    try {
      await markAllNotificationsAsRead(currentUser.id);
    } catch (err) {
      console.error('Error marking notifications read:', err);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleClearAllNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      await clearAllNotifications(currentUser.id);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  // ---------------- Handlers for Calling ----------------
  // Real-time listener for incoming ringing calls
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = subscribeToIncomingCalls(currentUser.id, (incoming) => {
      if (incoming && (!activeCall || activeCall.status !== 'connected')) {
        setIncomingCall(incoming);
      } else if (!incoming) {
        setIncomingCall(null);
      }
    });
    return () => unsub();
  }, [currentUser?.id, activeCall]);

  const handleStartCall = async (participant: User, type: 'audio' | 'video') => {
    if (!currentUser) return;
    try {
      const signalingId = await initiateCallSession(currentUser, participant, type);
      setActiveCall({
        id: signalingId,
        callSignalingId: signalingId,
        participant,
        type,
        status: 'ringing',
        direction: 'outgoing',
        durationSeconds: 0,
        isMuted: false,
        isCameraOff: false,
        isSpeakerOn: true,
        isMinimized: false,
      });
    } catch (err) {
      console.warn('Call signaling fallback to direct session:', err);
      setActiveCall({
        id: `call_${Date.now()}`,
        participant,
        type,
        status: 'ringing',
        direction: 'outgoing',
        durationSeconds: 0,
        isMuted: false,
        isCameraOff: false,
        isSpeakerOn: true,
        isMinimized: false,
      });
    }
  };

  const handleAcceptIncomingCall = async (session: CallSession) => {
    setIncomingCall(null);
    await acceptCallSession(session.id).catch(() => {});
    setActiveCall({
      id: session.id,
      callSignalingId: session.id,
      participant: {
        id: session.caller.id,
        name: session.caller.name,
        username: session.caller.username,
        avatar: session.caller.avatar,
        bio: '',
        joinedDate: '',
        followersCount: 0,
        followingCount: 0,
      },
      type: session.type,
      status: 'connected',
      direction: 'incoming',
      durationSeconds: 0,
      isMuted: false,
      isCameraOff: false,
      isSpeakerOn: true,
      isMinimized: false,
    });
  };

  const handleDeclineIncomingCall = async (session: CallSession) => {
    setIncomingCall(null);
    await declineCallSession(session.id).catch(() => {});
  };

  const handleEndCall = () => {
    if (activeCall?.callSignalingId) {
      endCallSession(activeCall.callSignalingId).catch(() => {});
    }
    setActiveCall(null);
  };

  const handleToggleMute = () => {
    if (!activeCall) return;
    setActiveCall({ ...activeCall, isMuted: !activeCall.isMuted });
  };

  const handleToggleCamera = () => {
    if (!activeCall) return;
    setActiveCall({ ...activeCall, isCameraOff: !activeCall.isCameraOff });
  };

  const handleToggleSpeaker = () => {
    if (!activeCall) return;
    setActiveCall({ ...activeCall, isSpeakerOn: !activeCall.isSpeakerOn });
  };

  const handleMinimizeCall = () => {
    if (!activeCall) return;
    setActiveCall({ ...activeCall, isMinimized: true });
  };

  const handleMaximizeCall = () => {
    if (!activeCall) return;
    setActiveCall({ ...activeCall, isMinimized: false });
  };

  // 1. Initial Auth Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF9] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-[#8FA89B] border-t-transparent animate-spin" />
          <div className="text-center">
            <h1 className="font-serif text-2xl font-medium text-[#2D3732] tracking-wide">Aura</h1>
            <p className="text-xs text-[#7A8A82] mt-1 font-mono">Entering Aura space...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Auth Gating: Unauthenticated users MUST see only Login / Register page
  if (!isAuthenticated || !currentUser) {
    return <AuthPage onSuccess={() => setCurrentTab('feed')} />;
  }

  // 3. Authenticated App Experience
  const viewingUserPosts = posts.filter(
    (p) => p.author.id === (viewingUser?.id || currentUser.id)
  );

  return (
    <div
      className={`bg-[#FAFAF9] text-[#2D3732] flex flex-col md:flex-row font-sans antialiased ${
        currentTab === 'messages' ? 'h-screen md:h-screen overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* Left Aside Navigation: Powerful Desktop & Tablet View */}
      <div className="hidden md:block shrink-0 h-full">
        <SidebarNav
          currentTab={currentTab}
          currentUser={currentUser}
          unreadMessagesCount={totalUnreadMessages}
          unreadNotificationsCount={totalUnreadNotifications}
          onSelectTab={(tab) => {
            if (tab === 'profile') {
              setViewingUser(currentUser);
            }
            setCurrentTab(tab);
          }}
          onOpenCreatePost={() => setIsCreatePostOpen(true)}
          onOpenNotifications={() => setIsNotificationsDrawerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSelectSavedTab={() => {
            setViewingUser(currentUser);
            setCurrentTab('profile');
          }}
          onSelectTrendingTab={() => {
            setCurrentTab('explore');
          }}
        />
      </div>

      {/* Main Content Wrapper */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          currentTab === 'messages'
            ? 'h-full overflow-hidden'
            : 'pb-16 md:pb-6'
        }`}
      >
        {/* Mobile & Tablet Top Navbar */}
        <div className={`md:hidden shrink-0 ${currentTab === 'messages' ? 'hidden' : ''}`}>
          <Navbar
            currentTab={currentTab}
            currentUser={currentUser}
            unreadMessagesCount={totalUnreadMessages}
            unreadNotificationsCount={totalUnreadNotifications}
            onSelectTab={(tab) => {
              if (tab === 'profile') {
                setViewingUser(currentUser);
              }
              setCurrentTab(tab);
            }}
            onOpenCreatePost={() => setIsCreatePostOpen(true)}
            onOpenNotifications={() => setIsNotificationsDrawerOpen(true)}
            onOpenAuth={() => setIsSettingsOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        </div>

        {/* Main Content Area based on Tab */}
        <main
          className={`w-full flex-1 ${
            currentTab === 'messages' ? 'h-full min-h-0 overflow-hidden' : ''
          }`}
        >
        {currentTab === 'feed' && (
          <Feed
            posts={posts}
            stories={stories}
            currentUser={currentUser}
            suggestedUsers={suggestedUsers.length > 0 ? suggestedUsers : communityUsers.filter((c) => c.id !== currentUser.id && !c.isFollowing)}
            onSelectStory={handleSelectStory}
            onOpenCreateStory={() => setIsCreateStoryOpen(true)}
            onLikePost={handleLikePost}
            onBookmarkPost={handleBookmarkPost}
            onRepostPost={handleRepostPost}
            onIncrementShare={handleIncrementShare}
            onSendToChat={handleSendPostToChat}
            onAddComment={handleAddComment}
            onLikeComment={handleLikeComment}
            onDeleteComment={handleDeleteComment}
            onVotePoll={handleVotePoll}
            onDeletePost={handleDeletePost}
            onEditPost={handleEditPost}
            onToggleFollowUser={handleToggleFollow}
            onOpenUserProfile={handleOpenUserProfile}
            onOpenDirectChat={handleOpenDirectChat}
            onOpenCreatePost={() => {
              setCreatePostInitialPrompt('');
              setIsCreatePostOpen(true);
            }}
            onOpenCreatePostWithPrompt={(prompt) => {
              setCreatePostInitialPrompt(prompt);
              setIsCreatePostOpen(true);
            }}
          />
        )}

        {currentTab === 'reels' && (
          <ReelsFeed
            reels={reels}
            currentUser={currentUser}
            onLikeReel={handleLikeReel}
            onBookmarkReel={handleBookmarkReel}
            onAddReelComment={handleAddReelComment}
            onIncrementShare={handleIncrementReelShare}
            onOpenUserProfile={handleOpenUserProfile}
            onToggleFollowUser={handleToggleFollow}
            onOpenCreateReel={() => setIsCreateReelOpen(true)}
          />
        )}

        {currentTab === 'messages' && (
          <MessagesView
            currentUser={currentUser}
            onStartCall={handleStartCall}
            onOpenUserProfile={handleOpenUserProfile}
            initialTargetUser={targetChatUser}
            onOpenAuth={() => setIsSettingsOpen(true)}
            onMobileChatActiveChange={setIsMobileChatActive}
            onNavigateTab={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'explore' && (
          <ExploreView
            posts={posts}
            reels={reels}
            suggestedUsers={suggestedUsers.length > 0 ? suggestedUsers : communityUsers.filter((c) => c.id !== currentUser.id && !c.isFollowing)}
            onToggleFollowUser={handleToggleFollow}
            onSelectPost={() => setCurrentTab('feed')}
            onSelectReel={() => setCurrentTab('reels')}
            onOpenUserProfile={handleOpenUserProfile}
          />
        )}

        {currentTab === 'profile' && viewingUser && (
          <ProfileView
            user={viewingUser}
            currentUser={currentUser}
            userPosts={viewingUserPosts}
            userReels={reels.filter((r) => r.author.id === viewingUser.id)}
            savedPosts={posts.filter((p) => p.isBookmarked)}
            suggestedUsers={suggestedUsers.length > 0 ? suggestedUsers : communityUsers.filter((c) => c.id !== currentUser.id)}
            onToggleFollow={handleToggleFollow}
            onOpenEditProfile={() => setIsEditProfileOpen(true)}
            onStartCall={handleStartCall}
            onOpenDirectChat={handleOpenDirectChat}
            onLikePost={handleLikePost}
            onBookmarkPost={handleBookmarkPost}
            onRepostPost={handleRepostPost}
            onIncrementShare={handleIncrementShare}
            onSendToChat={handleSendPostToChat}
            onDeletePost={handleDeletePost}
            onEditPost={handleEditPost}
            onAddComment={handleAddComment}
            onLikeComment={handleLikeComment}
            onDeleteComment={handleDeleteComment}
            onSelectReel={() => setCurrentTab('reels')}
            onSelectHighlight={handleSelectHighlight}
            onNavigateToUser={handleOpenUserProfile}
          />
        )}
      </main>
      </div>

      {/* Mobile Bottom Navigation - hidden when chatting actively to let input attach to screen bottom */}
      {!(currentTab === 'messages' && isMobileChatActive) && (
        <BottomNav
          currentTab={currentTab}
          unreadMessagesCount={totalUnreadMessages}
          onSelectTab={(tab) => {
            if (tab === 'profile') {
              setViewingUser(currentUser);
            }
            setCurrentTab(tab);
          }}
          onOpenCreatePost={() => setIsCreatePostOpen(true)}
        />
      )}

      {/* Modals & Overlays */}
      {isStoryViewerOpen && (
        <StoryViewerModal
          stories={viewerStories}
          initialStoryIndex={activeStoryIndex}
          currentUser={currentUser}
          onClose={() => setIsStoryViewerOpen(false)}
          onSendStoryReply={handleSendStoryReply}
          onRecordStoryView={handleRecordStoryView}
          onLikeStory={handleLikeStory}
          onDeleteStory={handleDeleteStory}
          onOpenUserProfile={handleOpenUserProfile}
        />
      )}

      {isCreateStoryOpen && (
        <CreateStoryModal
          currentUser={currentUser}
          onClose={() => setIsCreateStoryOpen(false)}
          onAddStory={handleAddStory}
        />
      )}

      {isCreatePostOpen && (
        <CreatePostModal
          currentUser={currentUser}
          initialContent={createPostInitialPrompt}
          onClose={() => {
            setIsCreatePostOpen(false);
            setCreatePostInitialPrompt('');
          }}
          onCreatePost={handleCreatePost}
        />
      )}

      {isCreateReelOpen && (
        <CreateReelModal
          currentUser={currentUser}
          onClose={() => setIsCreateReelOpen(false)}
          onSubmitReel={handleCreateReel}
        />
      )}

      {isEditProfileOpen && (
        <EditProfileModal
          currentUser={currentUser}
          onClose={() => setIsEditProfileOpen(false)}
          onSave={handleSaveProfile}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setIsSettingsOpen(false)}
          onOpenEditProfile={() => {
            setIsSettingsOpen(false);
            setIsEditProfileOpen(true);
          }}
        />
      )}

      {isNotificationsDrawerOpen && (
        <NotificationsDrawer
          notifications={notifications}
          currentUser={currentUser}
          onClose={() => setIsNotificationsDrawerOpen(false)}
          onMarkAllAsRead={handleMarkAllNotificationsRead}
          onClearAllNotifications={handleClearAllNotifications}
          onDeleteNotification={handleDeleteNotification}
          onToggleFollowUser={handleToggleFollow}
          onOpenUserProfile={handleOpenUserProfile}
          onSelectPost={() => {
            setIsNotificationsDrawerOpen(false);
            setCurrentTab('feed');
          }}
        />
      )}

      {/* Incoming Call Notification Modal */}
      {incomingCall && (
        <IncomingCallModal
          incomingCall={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={handleDeclineIncomingCall}
        />
      )}

      {/* Active Call Floating Pill (when minimized) */}
      {activeCall && activeCall.isMinimized && (
        <FloatingCallPill
          call={activeCall}
          onMaximize={handleMaximizeCall}
          onEndCall={handleEndCall}
        />
      )}

      {/* Active Call Modal (when maximized) */}
      {activeCall && !activeCall.isMinimized && (
        <ActiveCallModal
          call={activeCall}
          currentUser={currentUser}
          onEndCall={handleEndCall}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onToggleSpeaker={handleToggleSpeaker}
          onMinimize={handleMinimizeCall}
          onStatusConnected={() =>
            setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null))
          }
        />
      )}
    </div>
  );
}
