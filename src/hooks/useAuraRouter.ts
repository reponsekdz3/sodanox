import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export type AuraTab = 'feed' | 'reels' | 'messages' | 'explore' | 'marketplace' | 'profile';
export type AuraModalType =
  | 'create-post'
  | 'create-story'
  | 'create-reel'
  | 'edit-profile'
  | 'settings'
  | 'notifications'
  | 'pay-verified'
  | 'super-admin'
  | 'mobile-menu'
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

export function isSuperAdminUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const p = (window.location.pathname || '').toLowerCase();
  const h = (window.location.hash || '').toLowerCase();
  const s = (window.location.search || '').toLowerCase();
  return (
    p === '/.super' ||
    p.startsWith('/.super') ||
    p === '/super' ||
    p.startsWith('/super') ||
    h === '#.super' ||
    h === '#/super' ||
    h.includes('.super') ||
    h.includes('super') ||
    s.includes('super=1') ||
    s.includes('.super')
  );
}

export function useAuraRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const route = useMemo<AuraRouteState>(() => {
    // In HashRouter, location.pathname represents the path inside the hash, e.g. "/feed", "/messages/123", "/post/abc"
    const path = location.pathname.replace(/^\//, '').trim();
    const segments = path.split('/').filter(Boolean);
    const first = segments[0] || 'feed';
    const q = searchParams.get('q') || '';

    let tab: AuraTab = 'feed';
    let postId: string | null = null;
    let username: string | null = null;
    let chatId: string | null = null;
    let storyId: string | null = null;
    let modal: AuraModalType = null;

    if (isSuperAdminUrl() || first === 'super' || first === '.super') {
      modal = 'super-admin';
    }

    if (first === 'feed') tab = 'feed';
    else if (first === 'reels') tab = 'reels';
    else if (first === 'messages') {
      tab = 'messages';
      if (segments[1]) chatId = segments[1];
    } else if (first === 'explore') tab = 'explore';
    else if (first === 'marketplace') tab = 'marketplace';
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
    } else if (first === 'pay-verified' || first === 'verify') {
      modal = 'pay-verified';
    } else if (first === 'mobile-menu' || first === 'menu') {
      modal = 'mobile-menu';
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
  }, [location.pathname, searchParams]);

  const navigateTo = useCallback(
    (targetPath: string) => {
      const clean = targetPath.startsWith('#')
        ? targetPath.replace(/^#\/?/, '/')
        : targetPath.startsWith('/')
        ? targetPath
        : `/${targetPath}`;
      navigate(clean);
    },
    [navigate]
  );

  const navigateToTab = useCallback(
    (tab: AuraTab) => {
      navigate(`/${tab}`);
    },
    [navigate]
  );

  const navigateToPost = useCallback(
    (postId: string) => {
      navigate(`/post/${postId}`);
    },
    [navigate]
  );

  const navigateToProfile = useCallback(
    (username: string) => {
      const clean = username.replace(/^@/, '');
      navigate(`/profile/${clean}`);
    },
    [navigate]
  );

  const navigateToChat = useCallback(
    (chatOrUserId: string) => {
      navigate(`/messages/${chatOrUserId}`);
    },
    [navigate]
  );

  const navigateToStory = useCallback(
    (storyId: string) => {
      navigate(`/story/${storyId}`);
    },
    [navigate]
  );

  const openModal = useCallback(
    (modal: AuraModalType) => {
      if (modal) {
        navigate(`/${modal}`);
      }
    },
    [navigate]
  );

  const closeModal = useCallback(() => {
    if (isSuperAdminUrl()) {
      if (
        window.location.pathname.includes('.super') ||
        window.location.pathname.includes('/super')
      ) {
        window.history.pushState(null, '', '/#/feed');
      }
    }
    navigate(`/${route.tab || 'feed'}`);
  }, [navigate, route.tab]);

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
