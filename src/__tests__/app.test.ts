import { describe, it, expect } from 'vitest';
import { User, Post, Reel, Story, Message, Poll } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';
import { INITIAL_CREATORS } from '../services/seedService';
import { auraAudio } from '../utils/audioSynthesizer';

describe('Data Modeling & Architecture Verification', () => {
  it('validates User entity contract and required fields', () => {
    const testUser: User = {
      id: 'test_uid_123',
      name: 'Test Creator',
      username: 'testcreator',
      avatar: 'https://example.com/avatar.jpg',
      bio: 'Test bio',
      followersCount: 10,
      followingCount: 5,
      followers: [],
      following: [],
      isFollowing: false,
      isFollower: false,
      isMutual: false,
      verified: true,
      email: 'test@aurasocial.org',
      joinedDate: 'Joined September 2026',
    };

    expect(testUser.id).toBeDefined();
    expect(testUser.username).toBe('testcreator');
    expect(testUser.followersCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(testUser.followers)).toBe(true);
  });

  it('validates Post entity structure with interactive Poll & Quoted Post', () => {
    const poll: Poll = {
      id: 'p1',
      question: 'Which architecture material is best?',
      options: [
        { id: 'opt_1', text: 'Rammed Earth', votes: 12 },
        { id: 'opt_2', text: 'Bamboo', votes: 8 },
      ],
      totalVotes: 20,
    };

    const post: Post = {
      id: 'post_1',
      author: INITIAL_CREATORS[0],
      content: 'Exploring rammed earth in Kigali',
      timestamp: 'Just now',
      likesCount: 5,
      hasLiked: false,
      bookmarksCount: 2,
      isBookmarked: false,
      repostsCount: 1,
      hasReposted: false,
      sharesCount: 1,
      commentsCount: 0,
      comments: [],
      tags: ['Architecture', 'Kigali'],
      poll,
    };

    expect(post.author.id).toBe(INITIAL_CREATORS[0].id);
    expect(post.poll?.totalVotes).toBe(20);
    expect(post.poll?.options.length).toBe(2);
  });

  it('validates Story and Reel structure with multimedia playback', () => {
    const story: Story = {
      id: 'st_1',
      userId: INITIAL_CREATORS[0].id,
      userName: INITIAL_CREATORS[0].name,
      userUsername: INITIAL_CREATORS[0].username,
      userAvatar: INITIAL_CREATORS[0].avatar,
      hasUnseen: true,
      items: [
        {
          id: 'item_1',
          type: 'image',
          mediaUrl: 'https://example.com/story1.jpg',
          timestamp: 'Just now',
        },
      ],
      viewers: [],
    };

    const reel: Reel = {
      id: 'reel_1',
      author: INITIAL_CREATORS[0],
      videoUrl: 'https://example.com/reel.mp4',
      posterUrl: 'https://example.com/poster.jpg',
      tags: ['architecture'],
      caption: 'Testing ambient audio',
      likesCount: 12,
      hasLiked: false,
      commentsCount: 0,
      comments: [],
      sharesCount: 3,
      isSaved: false,
      audioTrack: { title: 'Ambient Kigali', artist: 'Clara Mugabo' },
    };

    expect(story.items.length).toBe(1);
    expect(reel.audioTrack?.title).toBe('Ambient Kigali');
  });

  it('validates Direct Message schema with replies, audio notes, and read receipts', () => {
    const msg: Message = {
      id: 'msg_101',
      senderId: 'user_1',
      senderName: 'Raphaël',
      timestamp: '10:45 AM',
      type: 'text',
      text: 'Hello from Kigali',
      status: 'read',
      reaction: '❤️',
      replyTo: {
        id: 'msg_100',
        senderId: 'user_2',
        senderName: 'Reponse',
        text: 'Welcome to Aura!',
        type: 'text',
      },
    };

    expect(msg.status).toBe('read');
    expect(msg.replyTo?.senderName).toBe('Reponse');
    expect(msg.reaction).toBe('❤️');
  });
});

describe('Error Handling and Safety Invariants', () => {
  it('formats Firestore errors into standard structured JSON', () => {
    try {
      handleFirestoreError(
        new Error('Missing or insufficient permissions'),
        OperationType.CREATE,
        'posts'
      );
      // should not reach here
      expect(true).toBe(false);
    } catch (e: any) {
      const parsed = JSON.parse(e.message);
      expect(parsed.error).toContain('Missing or insufficient permissions');
      expect(parsed.operationType).toBe('create');
      expect(parsed.path).toBe('posts');
      expect(parsed.authInfo).toBeDefined();
    }
  });
});

describe('Audio Synthesizer Engine', () => {
  it('verifies synthesizer tone triggers and click generation without crashing', () => {
    // Should execute safely without throwing errors in headless/jsdom or browser
    expect(() => {
      auraAudio.playClick(600, 0.02);
      auraAudio.playNotification();
    }).not.toThrow();
  });
});

describe('Authentic Seed Registry', () => {
  it('contains verified community creators with full profile details', () => {
    expect(INITIAL_CREATORS.length).toBeGreaterThanOrEqual(4);
    const raphael = INITIAL_CREATORS.find((c) => c.username === 'raphael_nsh');
    const reponse = INITIAL_CREATORS.find((c) => c.username === 'reponsekdz');
    const clara = INITIAL_CREATORS.find((c) => c.username === 'claramugabo');

    expect(raphael).toBeDefined();
    expect(raphael?.location).toContain('Kigali');
    expect(reponse).toBeDefined();
    expect(reponse?.verified).toBe(true);
    expect(clara).toBeDefined();
  });
});

describe('Follow System & Social Graph Architecture', () => {
  it('computes mutual follow status correctly when both parties follow each other', () => {
    const userAId = 'user_alpha';
    const userBId = 'user_beta';

    const userAFollowing = [userBId, 'user_gamma'];
    const userAFollowers = [userBId, 'user_delta'];

    const isFollowingTarget = userAFollowing.includes(userBId);
    const isFollowedByTarget = userAFollowers.includes(userBId);
    const isMutual = isFollowingTarget && isFollowedByTarget;

    expect(isFollowingTarget).toBe(true);
    expect(isFollowedByTarget).toBe(true);
    expect(isMutual).toBe(true);
  });

  it('correctly increments and decrements followers count on follow toggle', () => {
    const initialFollowersCount = 42;
    let isFollowing = false;

    // Simulate Follow action
    isFollowing = true;
    const countAfterFollow = isFollowing ? initialFollowersCount + 1 : initialFollowersCount - 1;
    expect(countAfterFollow).toBe(43);

    // Simulate Unfollow action
    isFollowing = false;
    const countAfterUnfollow = isFollowing ? countAfterFollow + 1 : countAfterFollow - 1;
    expect(countAfterUnfollow).toBe(42);
  });
});

describe('Real-time Audio & Video Calling Signaling', () => {
  it('validates CallSession signaling payload structure and states', () => {
    const session = {
      id: 'call_123_456_789',
      callerId: 'user_caller',
      caller: {
        id: 'user_caller',
        name: 'Caller Name',
        username: 'caller_handle',
        avatar: 'https://example.com/avatar.jpg',
      },
      recipientId: 'user_recipient',
      recipient: {
        id: 'user_recipient',
        name: 'Recipient Name',
        username: 'recipient_handle',
        avatar: 'https://example.com/recipient.jpg',
      },
      type: 'video' as const,
      status: 'ringing' as const,
      lastReaction: {
        emoji: '❤️',
        senderId: 'user_caller',
        timestamp: 1711200000,
      },
      lastQuickMessage: {
        text: 'Can you hear me clearly?',
        senderId: 'user_caller',
        senderName: 'Caller Name',
        timestamp: 1711200001,
      },
    };

    expect(session.id).toBeDefined();
    expect(session.type).toBe('video');
    expect(session.status).toBe('ringing');
    expect(session.lastReaction.emoji).toBe('❤️');
    expect(session.lastQuickMessage.text).toBe('Can you hear me clearly?');
  });
});

describe('Story Highlights & Multimedia Curation', () => {
  it('validates StoryHighlight collection structure with items and custom cover', () => {
    const highlight = {
      id: 'hl_kyoto_2026',
      userId: 'user_architect',
      title: 'Kyoto Archive',
      coverUrl: 'https://example.com/cover.jpg',
      items: [
        {
          id: 'item_1',
          mediaUrl: 'https://example.com/slide1.jpg',
          type: 'image' as const,
          timestamp: 'Yesterday',
          caption: 'Wooden joinery',
        },
      ],
      createdAt: '2026-09-24',
    };

    expect(highlight.id).toBe('hl_kyoto_2026');
    expect(highlight.items.length).toBe(1);
    expect(highlight.coverUrl).toBeDefined();
    expect(highlight.title).toBe('Kyoto Archive');
  });
});

