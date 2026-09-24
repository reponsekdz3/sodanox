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
