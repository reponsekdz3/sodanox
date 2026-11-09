import { useState, useEffect, useCallback } from 'react';

export type AuraTab = 'feed' | 'reels' | 'messages' | 'explore' | 'profile';
export type AuraModalType =
  | 'create-post'
  | 'create-story'
  | 'create-reel'
  | 'edit-profile'
  | 'settings'
  | 'notifications'
  | null;

export interface AuraRouteState {
  tab: AuraTab;
  postId: string | null;
  username: string | null;
  chatId: string | null;
  storyId: string | null;
  modal: AuraModalType;
  searchQuery: string;
}

function parseHash(hash: string): AuraRouteState {
  const cleanHash = hash.replace(/^#\/?/, '').trim();
  const [pathAndQuery] = cleanHash.split('?');
  const queryPart = cleanHash.includes('?') ? cleanHash.split('?')[1] : '';
  const searchParams = new URLSearchParams(queryPart);
  const q = searchParams.get('q') || '';

  const segments = pathAndQuery.split('/').filter(Boolean);
  const first = segments[0] || 'feed';

  let tab: AuraTab = 'feed';
  let postId: string | null = null;
  let username: string | null = null;
  let chatId: string | null = null;
  let storyId: string | null = null;
  let modal: AuraModalType = null;

  if (first === 'feed') tab = 'feed';
  else if (first === 'reels') tab = 'reels';
  else if (first === 'messages') {
    tab = 'messages';
    if (segments[1]) chatId = segments[1];
  } else if (first === 'explore') tab = 'explore';
  else if (first === 'profile') {
    tab = 'profile';
    if (segments[1]) username = segments[1];
  } else if (first === 'post' && segments[1]) {
    tab = 'feed';
    postId = segments[1];
  } else if (first === 'story' && segments[1]) {
    storyId = segments[1];
  } else if (first === 'create-post') {
    modal = 'create-post';
  } else if (first === 'create-story') {
    modal = 'create-story';
  } else if (first === 'create-reel') {
    modal = 'create-reel';
  } else if (first === 'edit-profile') {
    modal = 'edit-profile';
  } else if (first === 'settings') {
    modal = 'settings';
  } else if (first === 'notifications') {
    modal = 'notifications';
  }

  return {
    tab,
    postId,
    username,
    chatId,
    storyId,
    modal,
    searchQuery: q,
  };
}

export function useAuraRouter() {
  const [route, setRoute] = useState<AuraRouteState>(() => {
    if (typeof window !== 'undefined') {
      return parseHash(window.location.hash || '#/feed');
    }
    return {
      tab: 'feed',
      postId: null,
      username: null,
      chatId: null,
      storyId: null,
      modal: null,
      searchQuery: '',
    };
  });

  // Sync state on hash change
  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHash(window.location.hash || '#/feed'));
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);

    // Initial check
    if (!window.location.hash) {
      window.location.hash = '#/feed';
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const navigateTo = useCallback((hashPath: string) => {
    const formatted = hashPath.startsWith('#') ? hashPath : `#/${hashPath.replace(/^\//, '')}`;
    if (window.location.hash !== formatted) {
      window.history.pushState(null, '', formatted);
      setRoute(parseHash(formatted));
    }
  }, []);

  const navigateToTab = useCallback(
    (tab: AuraTab) => {
      navigateTo(`#/${tab}`);
    },
    [navigateTo]
  );

  const navigateToPost = useCallback(
    (postId: string) => {
      navigateTo(`#/post/${postId}`);
    },
    [navigateTo]
  );

  const navigateToProfile = useCallback(
    (username: string) => {
      const clean = username.replace(/^@/, '');
      navigateTo(`#/profile/${clean}`);
    },
    [navigateTo]
  );

  const navigateToChat = useCallback(
    (chatOrUserId: string) => {
      navigateTo(`#/messages/${chatOrUserId}`);
    },
    [navigateTo]
  );

  const navigateToStory = useCallback(
    (storyId: string) => {
      navigateTo(`#/story/${storyId}`);
    },
    [navigateTo]
  );

  const openModal = useCallback(
    (modal: AuraModalType) => {
      if (modal) {
        navigateTo(`#/${modal}`);
      }
    },
    [navigateTo]
  );

  const closeModal = useCallback(() => {
    // Go back to the active tab without the modal hash
    navigateTo(`#/${route.tab}`);
  }, [navigateTo, route.tab]);

  return {
    route,
    tab: route.tab,
    postId: route.postId,
    username: route.username,
    chatId: route.chatId,
    storyId: route.storyId,
    modal: route.modal,
    searchQuery: route.searchQuery,
    navigateTo,
    navigateToTab,
    navigateToPost,
    navigateToProfile,
    navigateToChat,
    navigateToStory,
    openModal,
    closeModal,
  };
}
