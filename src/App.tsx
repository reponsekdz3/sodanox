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
  SharedPostMeta,
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
import { PostDetailModal } from './components/feed/PostDetailModal';
import { MarketplaceView } from './components/marketplace/MarketplaceView';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { PayVerifiedModal } from './components/verification/PayVerifiedModal';
import { useAuraRouter, isSuperAdminUrl } from './hooks/useAuraRouter';
import {
  initiateCallSession,
  subscribeToIncomingCalls,
  acceptCallSession,
  declineCallSession,
  endCallSession,
  recordCallLogToChat,
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
  updateStoryItem as persistStoryItemUpdate,
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
  getUserByUsername,
  updateUserProfile,
} from './services/userService';
import { rankFeedWithML, getSmartSuggestedCreatorsML } from './services/mlFeedService';
import { PermissionsOnboardingModal } from './components/common/PermissionsOnboardingModal';
import { sendBrowserNotification } from './services/browserNotificationService';
import { MODERN_EMPTY_AVATAR_DATA_URI, isMockOrEmptyAvatar } from './components/common/ModernAvatar';
import { useOnlineStatus } from './hooks/usePWAInstall';

export default function App() {
  const { currentUser: fbAuthUser, userProfile, isAuthenticated, loading, updateUser } = useAuth();
  const isOnline = useOnlineStatus();

  // Powerful URL & Hash-based Routing (supports #/feed, #/post/:id, #/profile/:user, #/messages/:id, etc.)
  const {
    tab: currentTab,
    postId: routePostId,
    username: routeUsername,
    chatId: routeChatId,
    modal: routeModal,
    navigateToTab,
    navigateToPost,
    navigateToProfile,
    navigateToChat,
    openModal,
    closeModal,
  } = useAuraRouter();

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
  const activeCallRef = React.useRef<ActiveCall | null>(null);
  activeCallRef.current = activeCall;

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
  const [isPayVerifiedOpen, setIsPayVerifiedOpen] = useState(() => new URLSearchParams(window.location.search).has('verification_ref'));
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState<boolean>(() => isSuperAdminUrl());
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);

  // Message notification tracking
  const prevSeenMsgIdsRef = React.useRef<Set<string>>(new Set());
  const hasInitialConvsLoaded = React.useRef(false);

  // Sync route modal state
  useEffect(() => {
    if (routeModal === 'create-post') setIsCreatePostOpen(true);
    else if (routeModal === 'create-story') setIsCreateStoryOpen(true);
    else if (routeModal === 'create-reel') setIsCreateReelOpen(true);
    else if (routeModal === 'edit-profile') setIsEditProfileOpen(true);
    else if (routeModal === 'settings') setIsSettingsOpen(true);
    else if (routeModal === 'notifications') setIsNotificationsDrawerOpen(true);
    else if (routeModal === 'pay-verified') setIsPayVerifiedOpen(true);
    else if (routeModal === 'super-admin') setIsSuperAdminOpen(true);
  }, [routeModal]);

  // Secret /.super URL listener
  useEffect(() => {
    const checkSuper = () => {
      if (isSuperAdminUrl()) {
        setIsSuperAdminOpen(true);
        // Ensure community users and posts are loaded for Super Admin
        getAllUsers('', '').then(setCommunityUsers).catch(() => {});
        subscribeToPosts('', (pts) => setPosts(pts));
      }
    };
    checkSuper();
    window.addEventListener('hashchange', checkSuper);
    window.addEventListener('popstate', checkSuper);
    return () => {
      window.removeEventListener('hashchange', checkSuper);
      window.removeEventListener('popstate', checkSuper);
    };
  }, []);

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

  // Check permissions onboarding status
  useEffect(() => {
    if (currentUser) {
      const onboarded = localStorage.getItem(`aura_onboarded_${currentUser.id}`);
      if (!onboarded) {
        setIsPermissionsModalOpen(true);
      }
    }
  }, [currentUser?.id]);

  // Profile currently being viewed
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  // Sync viewing user on mount or when user updates own profile
  useEffect(() => {
    if (userProfile && (!viewingUser || viewingUser.id === userProfile.id)) {
      setViewingUser(userProfile);
    }
  }, [userProfile]);

  // Sync route username to viewingUser without blank screen
  useEffect(() => {
    let active = true;
    if (routeUsername) {
      const match = communityUsers.find(
        (u) => u.username.toLowerCase() === routeUsername.toLowerCase()
      );
      if (match) {
        setViewingUser(match);
      } else {
        getUserByUsername(routeUsername).then((user) => {
          if (active && user) {
            setViewingUser(user);
          }
        }).catch((err) => {
          console.warn('Error fetching route user:', err);
        });
      }
    } else if (currentTab === 'profile' && currentUser && !viewingUser) {
      setViewingUser(currentUser);
    }
    return () => {
      active = false;
    };
  }, [routeUsername, communityUsers, currentTab, currentUser, viewingUser]);

  // Sync route chatId to targetChatUser
  useEffect(() => {
    if (routeChatId) {
      const match = communityUsers.find((u) => u.id === routeChatId);
      if (match) {
        setTargetChatUser(match);
      }
    }
  }, [routeChatId, communityUsers]);

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

        // Check for new incoming messages to trigger real-time browser desktop pop-up
        if (!hasInitialConvsLoaded.current) {
          hasInitialConvsLoaded.current = true;
          convs.forEach((c) => {
            if (c.lastMessage?.id) prevSeenMsgIdsRef.current.add(c.lastMessage.id);
          });
        } else {
          convs.forEach((c) => {
            const lastMsg = c.lastMessage;
            if (lastMsg?.id && !prevSeenMsgIdsRef.current.has(lastMsg.id)) {
              prevSeenMsgIdsRef.current.add(lastMsg.id);
              if (lastMsg.senderId !== currentUser.id) {
                const bodyText =
                  lastMsg.type === 'voice'
                    ? '🎙️ Sent a voice note'
                    : lastMsg.type === 'image'
                    ? '📷 Sent a photo'
                    : lastMsg.type === 'file'
                    ? `📎 ${lastMsg.file?.name || 'Sent a file'}`
                    : lastMsg.text || 'Sent you a message';

                sendBrowserNotification(c.participant.name, {
                  body: bodyText,
                  icon: c.participant.avatar,
                  tag: `conv_${c.id}_${lastMsg.id}`,
                  onClick: () => {
                    window.focus();
                    setTargetChatUser(c.participant);
                    navigateToTab('messages');
                  },
                });
              }
            }
          });
        }
      },
      (err) => console.warn('Convs sync error:', err)
    );
    return () => unsubConvs();
  }, [isAuthenticated, currentUser?.id]);

  // Derived counts
  const totalUnreadMessages = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  const totalUnreadNotifications = notifications.filter((n) => !n.read).length;

  // ML-ranked feed & smart creator recommendations (low data usage)
  const rankedPosts = useMemo(() => {
    return rankFeedWithML(posts, currentUser);
  }, [posts, currentUser]);

  const smartSuggestedUsers = useMemo(() => {
    return getSmartSuggestedCreatorsML(communityUsers, currentUser, posts);
  }, [communityUsers, currentUser, posts]);

  // Dynamic Document Title based on unread messages & active route
  useEffect(() => {
    const tabTitles: Record<string, string> = {
      feed: 'Feed',
      reels: 'Reels',
      messages: 'Messages',
      explore: 'Explore',
      marketplace: 'Marketplace',
      profile: viewingUser ? `${viewingUser.name} (@${viewingUser.username})` : 'Profile',
    };
    const activeTitle = tabTitles[currentTab] || 'Home';
    const unreadPrefix = totalUnreadMessages > 0 ? `(${totalUnreadMessages}) ` : '';
    document.title = `${unreadPrefix}Ducate • ${activeTitle}`;
  }, [currentTab, totalUnreadMessages, viewingUser]);

  // ---------------- Handlers for Navigation ----------------
  const handleOpenUserProfile = (user: User) => {
    setViewingUser(user);
    navigateToProfile(user.username);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDirectChat = (user: User) => {
    setTargetChatUser(user);
    navigateToChat(user.id);
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
    if (!currentUser) throw new Error('You must be signed in to publish a story.');
    const itemWithTimestamp: StoryItem = { ...newItem, createdAtMs: newItem.createdAtMs || Date.now() };
    await createStoryInFirestore(currentUser, itemWithTimestamp);
    setStories((prev) => {
      const myStoryIndex = prev.findIndex((s) => s.userId === currentUser.id);
      if (myStoryIndex !== -1) {
        const copy = [...prev];
        copy[myStoryIndex] = { ...copy[myStoryIndex], items: [...copy[myStoryIndex].items, itemWithTimestamp] };
        return copy;
      }
      const newStory: Story = {
        id: 'story_' + currentUser.id,
        userId: currentUser.id,
        userName: currentUser.name,
        userUsername: currentUser.username,
        userAvatar: currentUser.avatar,
        hasUnseen: false,
        items: [itemWithTimestamp],
        viewers: [currentUser.id],
        createdAt: { toMillis: () => Date.now() },
      };
      return [newStory, ...prev];
    });
  };

  const handleUpdateStoryItem = async (
    storyId: string,
    itemIndex: number,
    updates: Partial<Pick<StoryItem, 'caption' | 'moodTag' | 'filter' | 'textOverlay'>>
  ) => {
    if (!currentUser) throw new Error('You must be signed in to edit a story.');
    const updatedItem = await persistStoryItemUpdate(storyId, currentUser.id, itemIndex, updates);
    const applyUpdate = (items: Story[]) => items.map((story) => story.id === storyId
      ? { ...story, items: story.items.map((item, index) => index === itemIndex ? updatedItem : item) }
      : story);
    setStories(applyUpdate);
    setViewerStories(applyUpdate);
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
        post.author.id,
        post
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

  const handleSendPostToChat = async (
    recipientId: string,
    messageText: string,
    sharedPost?: SharedPostMeta
  ) => {
    if (!currentUser) return;
    try {
      const targetUser: User = communityUsers.find((u) => u.id === recipientId) || {
        id: recipientId,
        name: 'Community Member',
        username: 'member',
        avatar: MODERN_EMPTY_AVATAR_DATA_URI,
        bio: '',
        joinedDate: '',
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
      };
      const convId = await getOrCreateConversation(currentUser, targetUser);
      await sendChatMessage(
        convId,
        {
          text: messageText,
          type: sharedPost ? 'post' : 'text',
          sharedPost,
        },
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
    const optimisticPostId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimisticPost: Post = {
      id: optimisticPostId,
      author: currentUser,
      content: newPostData.content || '',
      mediaUrl: newPostData.mediaUrl,
      mediaUrls: newPostData.mediaUrls || (newPostData.mediaUrl ? [newPostData.mediaUrl] : []),
      mediaType: newPostData.mediaType || 'image',
      tags: newPostData.tags || [],
      location: newPostData.location,
      audience: newPostData.audience || 'public',
      commentsDisabled: newPostData.commentsDisabled || false,
      likesCount: 0,
      likedBy: [],
      hasLiked: false,
      bookmarksCount: 0,
      bookmarkedBy: [],
      isBookmarked: false,
      repostsCount: 0,
      repostedBy: [],
      hasReposted: false,
      commentsCount: 0,
      comments: [],
      sharesCount: 0,
      sharedBy: [],
      viewsCount: 0,
      viewedBy: [],
      poll: newPostData.poll,
      quotedPost: newPostData.quotedPost,
      timestamp: 'Just now',
      createdAt: { toMillis: () => Date.now() } as any,
    };

    // Optimistically update posts state so it shows up instantly at feed and profile
    setPosts((prev) => [optimisticPost, ...prev.filter((p) => p.id !== optimisticPostId)]);

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
          explicitPostId: optimisticPostId,
        }
      );
    } catch (err) {
      setPosts((previous) => previous.filter((post) => post.id !== optimisticPostId));
      console.error('Post creation failed; the optimistic post was removed:', err);
      throw err;
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
    if (!currentUser) throw new Error('Sign in before publishing a reel.');
    try {
      const createdReel = await createNewReel(currentUser, data);
      setReels((previous) => [createdReel, ...previous.filter((reel) => reel.id !== createdReel.id)]);
    } catch (error) {
      console.error('Reel creation failed; no local-only reel was retained:', error);
      throw error;
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
    if (!currentUser?.id) return;
    try {
      await deleteNotification(notificationId, currentUser.id);
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
      if (incoming && !activeCallRef.current) {
        setIncomingCall(incoming);
        const callerName = incoming.caller?.name || 'Someone';
        const callerAvatar = incoming.caller?.avatar || '/pwa-192x192.png';
        sendBrowserNotification(`Incoming ${incoming.type === 'video' ? 'Video' : 'Audio'} Call`, {
          body: `${callerName} is calling you on Aura. Tap to answer.`,
          icon: callerAvatar,
          tag: `call_${incoming.id}`,
          requireInteraction: true,
          onClick: () => {
            window.focus();
            setIncomingCall(incoming);
          },
        });
      } else if (!incoming) {
        setIncomingCall(null);
      }
    });
    return () => unsub();
  }, [currentUser?.id]);

  const handleStartCall = async (participant: User, type: 'audio' | 'video') => {
    if (!currentUser) return;
    if (activeCall) {
      window.alert('End your current call before starting another one.');
      return;
    }
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
      console.error('Call could not be created:', err);
      window.alert(err instanceof Error ? err.message : 'The call could not be started. Check your connection and sign-in status.');
    }
  };
  const handleAcceptIncomingCall = async (session: CallSession) => {
    if (activeCall) {
      window.alert('You are already on another call.');
      return;
    }
    try {
      // The session becomes accepted here, but is not considered connected
      // until the WebRTC answer and ICE negotiation succeed.
      await acceptCallSession(session.id);
      setIncomingCall(null);
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
        status: 'ringing',
        direction: 'incoming',
        durationSeconds: 0,
        isMuted: false,
        isCameraOff: false,
        isSpeakerOn: true,
        isMinimized: false,
      });
    } catch (err) {
      console.error('Could not accept the incoming call:', err);
      window.alert(err instanceof Error ? err.message : 'The call could not be accepted. Please try again.');
    }
  };
  const handleDeclineIncomingCall = async (session: CallSession) => {
    try {
      await declineCallSession(session.id);
      setIncomingCall(null);
      if (currentUser) {
        const callerUser: User = {
          id: session.caller.id,
          name: session.caller.name,
          username: session.caller.username,
          avatar: session.caller.avatar,
          bio: '',
          joinedDate: '',
          followersCount: 0,
          followingCount: 0,
        };
        await recordCallLogToChat(callerUser, currentUser, session.type, 'declined', 0);
      }
    } catch (err) {
      console.error('Could not decline the incoming call:', err);
      window.alert(err instanceof Error ? err.message : 'The call could not be declined.');
    }
  };
  const handleEndCall = (overrideStatus?: 'missed' | 'declined' | 'ended') => {
    const finishedCall = activeCall;
    if (finishedCall?.callSignalingId && overrideStatus !== 'declined') {
      void endCallSession(finishedCall.callSignalingId).catch((err) => {
        console.warn('Call end signal could not be delivered:', err);
      });
    }
    if (finishedCall && currentUser) {
      const callerUser = finishedCall.direction === 'incoming' ? finishedCall.participant : currentUser;
      const recipientUser = finishedCall.direction === 'incoming' ? currentUser : finishedCall.participant;
      const finalStatus: 'completed' | 'missed' | 'declined' = overrideStatus === 'declined'
        ? 'declined'
        : overrideStatus === 'missed' || (finishedCall.status === 'ringing' && finishedCall.durationSeconds === 0)
          ? 'missed'
          : 'completed';
      void recordCallLogToChat(
        callerUser, recipientUser, finishedCall.type, finalStatus, finishedCall.durationSeconds
      ).catch((err) => console.warn('Call log could not be saved:', err));
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

  // Super Administrator Portal: Immediate priority entry when visiting /.super, #/super, or ?super=1
  if (isSuperAdminOpen) {
    return (
      <SuperAdminDashboard
        allUsers={communityUsers}
        allPosts={posts}
        currentUser={currentUser}
        onClose={() => {
          setIsSuperAdminOpen(false);
          if (
            window.location.pathname.includes('.super') ||
            window.location.pathname.includes('/super')
          ) {
            window.history.pushState(null, '', '/#/feed');
          } else if (window.location.hash.includes('super')) {
            window.location.hash = '#/feed';
          }
        }}
        onRefreshUsers={() => {
          getAllUsers('', '').then(setCommunityUsers).catch(() => {});
        }}
      />
    );
  }

  // 1. Initial Auth Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full border-2 border-[#059669] border-t-transparent animate-spin" />
          <div className="text-center">
            <h1 className="font-serif text-2xl font-semibold text-[#022C22] tracking-wide">Ducate</h1>
            <p className="text-xs text-[#4B6358] mt-1 font-mono">Entering Ducate space...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Auth Gating: Unauthenticated users MUST see only Login / Register page
  if (!isAuthenticated || !currentUser) {
    return (
      <>
        <AuthPage
          onSuccess={() => {
            navigateToTab('feed');
            window.location.hash = '#/feed';
          }}
        />
        {/* Hidden Super Administrator Portal (triggered via /.super in URL) */}
        {isSuperAdminOpen && (
          <SuperAdminDashboard
            allUsers={communityUsers}
            allPosts={posts}
            currentUser={currentUser}
            onClose={() => {
              setIsSuperAdminOpen(false);
              if (window.location.hash.includes('super')) {
                window.location.hash = '#/feed';
              }
            }}
            onRefreshUsers={() => {
              getAllUsers('', '').then(setCommunityUsers).catch(() => {});
            }}
          />
        )}
      </>
    );
  }

  // 3. Authenticated App Experience
  const viewingUserPosts = useMemo(() => {
    const targetId = viewingUser?.id || currentUser.id;
    const targetUsername = (viewingUser?.username || currentUser.username).toLowerCase();
    return posts.filter((p) => {
      const authorId = p.author?.id || (p as any).authorId;
      const authorUsername = (p.author?.username || '').toLowerCase();
      return (authorId && authorId === targetId) || (authorUsername && authorUsername === targetUsername);
    });
  }, [posts, viewingUser, currentUser]);

  const activeRoutePost = useMemo(() => {
    if (!routePostId) return null;
    return posts.find((p) => p.id === routePostId) || null;
  }, [routePostId, posts]);

  return (
    <div
      className={`bg-[#F8FAF9] text-[#022C22] flex flex-col md:flex-row font-sans antialiased ${
        currentTab === 'messages' ? 'h-screen md:h-screen overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* Left Aside Navigation: Powerful Desktop & Tablet View - Fixed & Independent Scrolling */}
      <div className="hidden md:block shrink-0 sticky top-0 h-screen overflow-y-auto scrollbar-none z-30">
        <SidebarNav
          currentTab={currentTab}
          currentUser={currentUser}
          unreadMessagesCount={totalUnreadMessages}
          unreadNotificationsCount={totalUnreadNotifications}
          onSelectTab={(tab) => {
            if (tab === 'profile') {
              setViewingUser(currentUser);
              navigateToProfile(currentUser.username);
            } else {
              navigateToTab(tab);
            }
          }}
          onOpenCreatePost={() => setIsCreatePostOpen(true)}
          onOpenNotifications={() => setIsNotificationsDrawerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onSelectSavedTab={() => {
            setViewingUser(currentUser);
            navigateToProfile(currentUser.username);
          }}
          onSelectTrendingTab={() => {
            navigateToTab('explore');
          }}
          onOpenPayVerified={() => setIsPayVerifiedOpen(true)}
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
                navigateToProfile(currentUser.username);
              } else {
                navigateToTab(tab);
              }
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
            posts={rankedPosts}
            stories={stories}
            currentUser={currentUser}
            suggestedUsers={smartSuggestedUsers}
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
            onNavigateTab={(tab) => {
              if (tab === 'profile') {
                setViewingUser(currentUser);
                navigateToProfile(currentUser.username);
              } else {
                navigateToTab(tab as any);
              }
            }}
          />
        )}

        {currentTab === 'explore' && (
          <ExploreView
            posts={rankedPosts}
            reels={reels}
            suggestedUsers={smartSuggestedUsers}
            onToggleFollowUser={handleToggleFollow}
            onSelectPost={(post) => navigateToPost(post.id)}
            onSelectReel={() => navigateToTab('reels')}
            onOpenUserProfile={handleOpenUserProfile}
          />
        )}

        {currentTab === 'marketplace' && (
          <MarketplaceView
            currentUser={currentUser}
            onOpenDirectChat={handleOpenDirectChat}
            onOpenPayVerified={() => setIsPayVerifiedOpen(true)}
          />
        )}

        {currentTab === 'profile' && (
          viewingUser ? (
            <ProfileView
              user={viewingUser}
              currentUser={currentUser}
              userPosts={viewingUserPosts}
              userReels={reels.filter((r) => r.author.id === viewingUser.id)}
              savedPosts={posts.filter((p) => p.isBookmarked)}
              userStories={stories.filter((s) => s.userId === viewingUser.id).flatMap((s) => s.items)}
              suggestedUsers={smartSuggestedUsers}
              onToggleFollow={handleToggleFollow}
              onOpenEditProfile={() => setIsEditProfileOpen(true)}
              onOpenCreatePost={() => setIsCreatePostOpen(true)}
              onOpenCreateStory={() => setIsCreateStoryOpen(true)}
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
              onSelectReel={() => navigateToTab('reels')}
              onSelectHighlight={handleSelectHighlight}
              onNavigateToUser={handleOpenUserProfile}
            />
          ) : (
            <div className="w-full max-w-4xl mx-auto py-16 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-2xl">🌱</span>
              </div>
              <p className="text-sm font-bold text-[#064E3B]">Loading profile...</p>
              <p className="text-xs text-[#55635C] mt-1">Connecting to Ducate network</p>
            </div>
          )
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
              navigateToProfile(currentUser.username);
            } else {
              navigateToTab(tab);
            }
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
          onUpdateStoryItem={handleUpdateStoryItem}
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
            navigateToTab('feed');
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

      {/* Keep the WebRTC session mounted while minimized; unmounting releases media tracks. */}
      {activeCall && (
        <ActiveCallModal
          call={activeCall}
          currentUser={currentUser}
          isMinimized={activeCall.isMinimized}
          onEndCall={handleEndCall}
          onDurationChange={(durationSeconds) =>
            setActiveCall((prev) => prev ? { ...prev, durationSeconds } : null)
          }
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onToggleSpeaker={handleToggleSpeaker}
          onMinimize={handleMinimizeCall}
          onStatusConnected={() =>
            setActiveCall((prev) => (prev ? { ...prev, status: 'connected' } : null))
          }
        />
      )}

      {/* Route-driven Deep Link Post Detail Modal */}
      {routePostId && (
        <PostDetailModal
          postId={routePostId}
          initialPost={activeRoutePost}
          currentUser={currentUser}
          suggestedUsers={suggestedUsers}
          onClose={() => navigateToTab(currentTab)}
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
          onOpenUserProfile={handleOpenUserProfile}
          onToggleFollowUser={handleToggleFollow}
        />
      )}

      {/* Pay for 10K Verified Badge Modal */}
      {isPayVerifiedOpen && (
        <PayVerifiedModal
          currentUser={currentUser}
          onClose={() => setIsPayVerifiedOpen(false)}
          onSuccess={(updatedUser) => {
            updateUser(updatedUser);
            refreshCommunity(currentUser.id);
          }}
        />
      )}

      {/* Hidden Super Administrator Portal (triggered via /.super in URL) */}
      {isSuperAdminOpen && (
        <SuperAdminDashboard
          allUsers={communityUsers}
          allPosts={posts}
          currentUser={currentUser}
          onClose={() => {
            setIsSuperAdminOpen(false);
            if (
              window.location.pathname.includes('.super') ||
              window.location.pathname.includes('/super')
            ) {
              window.history.pushState(null, '', '/#/feed');
            } else if (window.location.hash.includes('super')) {
              window.location.hash = '#/feed';
            }
          }}
          onRefreshUsers={() => refreshCommunity(currentUser.id)}
        />
      )}

      {/* Permissions Onboarding Modal (Automatic post-login prompt for notifications & location) */}
      {isPermissionsModalOpen && currentUser && (
        <PermissionsOnboardingModal
          isOpen={isPermissionsModalOpen}
          onClose={() => {
            setIsPermissionsModalOpen(false);
            if (currentUser) {
              localStorage.setItem(`aura_onboarded_${currentUser.id}`, 'true');
            }
          }}
          onLocationGranted={(coords) => {
            if (currentUser) {
              updateUserProfile(currentUser.id, {
                detectedLocation: {
                  lat: coords.latitude,
                  lng: coords.longitude,
                  city: 'Kigali',
                  country: 'Rwanda',
                  enabledAt: Date.now(),
                },
              }).catch(() => {});
            }
          }}
        />
      )}

      {/* PWA Offline Connectivity Indicator */}
      {!isOnline && (
        <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-[#064E3B] border border-[#10B981]/40 px-3.5 py-2 text-xs font-semibold text-white shadow-soft-float animate-bounce">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Offline Mode — Cached data is being used.</span>
        </div>
      )}
    </div>
  );
}
