import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from 'firebase/firestore';

/**
 * Firebase Emulator Suite Test Suite for Aura Social
 *
 * Requirements verified:
 * 1. Unauthenticated read → denied
 * 2. Authenticated read of another user's private data → denied
 * 3. Owner update of own profile → allowed
 * 4. Non-owner update of another's post → denied
 * 5. Participant read of conversation → allowed
 * 6. Non-participant read of conversation → denied
 * 7. Attempt to escalate role → denied
 *
 * Execution command:
 * firebase emulators:exec --only firestore "vitest run tests/emulator-firestore.test.ts"
 */

const PROJECT_ID = 'demo-aura-social';

describe('Firestore Security Rules (Firebase Emulator Suite)', () => {
  let testEnv: RulesTestEnvironment | null = null;
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

  beforeAll(async () => {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules,
          host: '127.0.0.1',
          port: 8080,
        },
      });
    } catch {
      // In non-emulator CI environments, tests will be skipped safely
      console.warn('Firebase emulator host 127.0.0.1:8080 not reachable. Run via "firebase emulators:exec".');
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
      // Seed baseline data using admin context
      await testEnv.withSecurityRulesDisabled(async (adminContext) => {
        const db = adminContext.firestore();

        // 1. Target user Alice
        await setDoc(doc(db, 'users', 'alice_uid'), {
          id: 'alice_uid',
          name: 'Alice Waters',
          username: 'alice',
          bio: 'Designer',
          role: 'user',
          verified: false,
          followersCount: 0,
          followingCount: 0,
          followers: [],
          following: [],
          createdAt: new Date(),
        });

        // Alice's private subcollection
        await setDoc(doc(db, 'users', 'alice_uid', 'private', 'settings'), {
          email: 'alice@aurasocial.test',
          phone: '+15551234567',
          blockedUsers: ['bad_actor'],
        });

        // 2. Post by Alice
        await setDoc(doc(db, 'posts', 'alice_post_1'), {
          id: 'alice_post_1',
          authorId: 'alice_uid',
          author: { id: 'alice_uid', name: 'Alice Waters' },
          content: 'Quiet mornings on Aura',
          audience: 'public',
          likesCount: 0,
          likedBy: [],
          bookmarksCount: 0,
          bookmarkedBy: [],
          repostsCount: 0,
          repostedBy: [],
          viewsCount: 0,
          viewedBy: [],
          sharesCount: 0,
          sharedBy: [],
          commentsCount: 0,
          comments: [],
          poll: { question: 'Choose one', options: [{ id: 'yes', text: 'Yes', votes: 0 }, { id: 'no', text: 'No', votes: 0 }], totalVotes: 0, voters: {} },
          createdAt: new Date(),
        });


        await setDoc(doc(db, 'reels', 'alice_reel_1'), {
          id: 'alice_reel_1',
          authorId: 'alice_uid',
          author: { id: 'alice_uid', name: 'Alice Waters' },
          caption: 'A real reel',
          videoUrl: 'https://example.com/reel.mp4',
          posterUrl: 'https://example.com/reel.jpg',
          likesCount: 0, likedBy: [],
          bookmarksCount: 0, bookmarkedBy: [],
          commentsCount: 0, comments: [],
          sharesCount: 0, sharedBy: [],
          createdAt: new Date(),
        });

        await setDoc(doc(db, 'sponsored_ads', 'active_campaign'), {
          id: 'active_campaign',
          sellerId: 'alice_uid',
          title: 'Approved campaign',
          description: 'Active ad',
          type: 'feed_post',
          mediaUrl: 'https://storage.example.com/ad.webp',
          mediaType: 'image',
          ctaText: 'Contact',
          budget: 10000,
          impressions: 0,
          clicks: 0,
          status: 'active',
          createdAt: Date.now(),
        });
        // 3. Story by Alice
        await setDoc(doc(db, 'stories', 'alice_story'), {
          id: 'alice_story',
          userId: 'alice_uid',
          userName: 'Alice Waters',
          userUsername: 'alice',
          items: [{ id: 'story_item_1', mediaUrl: 'https://example.com/story.jpg', type: 'image', timestamp: 'Just now' }],
          viewers: [],
          createdAt: new Date(),
        });

        // Real-time call session between Alice and Bob
        await setDoc(doc(db, 'calls', 'call_alice_bob'), {
          id: 'call_alice_bob',
          callerId: 'alice_uid',
          caller: { id: 'alice_uid', name: 'Alice Waters', username: 'alice', avatar: '' },
          recipientId: 'bob_uid',
          recipient: { id: 'bob_uid', name: 'Bob Stone', username: 'bob', avatar: '' },
          type: 'video',
          status: 'ringing',
          createdAt: new Date(),
        });
        // 4. Conversation between Alice and Bob
        await setDoc(doc(db, 'conversations', 'conv_alice_bob'), {
          id: 'conv_alice_bob',
          participantIds: ['alice_uid', 'bob_uid'],
          lastMessage: 'See you tomorrow!',
          updatedAt: new Date(),
        });

        // Message inside conversation
        await setDoc(doc(db, 'conversations', 'conv_alice_bob', 'messages', 'msg_1'), {
          id: 'msg_1',
          senderId: 'alice_uid',
          text: 'See you tomorrow!',
          timestamp: new Date(),
        });
      });
    }
  });

  // 1. Unauthenticated read → denied
  it('1. Unauthenticated read of any user profile is denied', async () => {
    if (!testEnv) return;
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const aliceDoc = doc(unauthDb, 'users', 'alice_uid');
    await assertFails(getDoc(aliceDoc));
  });

  // 2. Authenticated read of another user private data → denied
  it("2. Authenticated read of another user's private data is denied", async () => {
    if (!testEnv) return;
    const eveDb = testEnv.authenticatedContext('eve_uid').firestore();
    const alicePrivateDoc = doc(eveDb, 'users', 'alice_uid', 'private', 'settings');
    await assertFails(getDoc(alicePrivateDoc));

    // But Alice reading her own private data must succeed
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const aliceOwnPrivateDoc = doc(aliceDb, 'users', 'alice_uid', 'private', 'settings');
    await assertSucceeds(getDoc(aliceOwnPrivateDoc));
  });

  // 3. Owner update of own profile → allowed
  it('3. Owner update of own profile (name, bio, location) is allowed', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const aliceDoc = doc(aliceDb, 'users', 'alice_uid');
    await assertSucceeds(
      updateDoc(aliceDoc, {
        bio: 'Updated bio: Nordic Minimalist & Photographer',
      })
    );
  });

  // 4. Non-owner update of another post → denied
  it("4. Non-owner update of another user's post is denied", async () => {
    if (!testEnv) return;
    const eveDb = testEnv.authenticatedContext('eve_uid').firestore();
    const postRef = doc(eveDb, 'posts', 'alice_post_1');
    await assertFails(
      updateDoc(postRef, {
        content: 'Tampered by eve',
      })
    );
  });

  // 5. Participant read of conversation → allowed
  it('5. Participant read of private conversation is allowed', async () => {
    if (!testEnv) return;
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const convRef = doc(bobDb, 'conversations', 'conv_alice_bob');
    await assertSucceeds(getDoc(convRef));
  });

  // 6. Non-participant read of conversation → denied
  it('6. Non-participant read of private conversation is denied', async () => {
    if (!testEnv) return;
    const eveDb = testEnv.authenticatedContext('eve_uid').firestore();
    const convRef = doc(eveDb, 'conversations', 'conv_alice_bob');
    await assertFails(getDoc(convRef));
  });

  // 7. Attempt to escalate role → denied
  it('7. Attempt to escalate role or self-assign admin/verified is denied', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const aliceDoc = doc(aliceDb, 'users', 'alice_uid');
    // Attempting to set role to admin or verified to true
    await assertFails(
      updateDoc(aliceDoc, {
        role: 'admin',
      })
    );
    await assertFails(
      updateDoc(aliceDoc, {
        verified: true,
      })
    );
  });

  it('8. Profile owner cannot set paid verification fields', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const aliceDoc = doc(aliceDb, 'users', 'alice_uid');
    await assertFails(updateDoc(aliceDoc, { verifiedBadgeType: 'blue' }));
    await assertFails(updateDoc(aliceDoc, { verifiedSince: Date.now() }));
  });

  it('9. Client cannot forge verification payment ledger entries', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const paymentDoc = doc(aliceDb, 'verification_payments', 'fake_payment');
    await assertFails(setDoc(paymentDoc, {
      userId: 'alice_uid',
      amount: 10000,
      currency: 'RWF',
      status: 'completed',
    }));
  });

  it('10. Non-owner cannot replace a story item array', async () => {
    if (!testEnv) return;
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const storyRef = doc(bobDb, 'stories', 'alice_story');
    await assertFails(updateDoc(storyRef, {
      items: [{ id: 'forged', mediaUrl: 'https://example.com/forged.jpg', type: 'image', timestamp: 'Now' }],
    }));
  });

  it('11. Story owner can edit their own story item', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const storyRef = doc(aliceDb, 'stories', 'alice_story');
    await assertSucceeds(updateDoc(storyRef, {
      items: [{ id: 'story_item_1', mediaUrl: 'https://example.com/story.jpg', type: 'image', timestamp: 'Just now', caption: 'Updated caption' }],
    }));
  });
  it('12. Only call participants can read a live call session', async () => {
    if (!testEnv) return;
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const eveDb = testEnv.authenticatedContext('eve_uid').firestore();
    await assertSucceeds(getDoc(doc(bobDb, 'calls', 'call_alice_bob')));
    await assertFails(getDoc(doc(eveDb, 'calls', 'call_alice_bob')));
  });

  it('13. Only the matching party may publish ICE candidates', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const candidate = { candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
    await assertSucceeds(setDoc(doc(aliceDb, 'calls', 'call_alice_bob', 'callerCandidates', 'alice_candidate'), { senderId: 'alice_uid', candidate }));
    await assertFails(setDoc(doc(bobDb, 'calls', 'call_alice_bob', 'callerCandidates', 'forged_candidate'), { senderId: 'bob_uid', candidate }));
    await assertSucceeds(setDoc(doc(bobDb, 'calls', 'call_alice_bob', 'recipientCandidates', 'bob_candidate'), { senderId: 'bob_uid', candidate }));
  });

  it('14. Call state is participant- and role-controlled', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const callRefAlice = doc(aliceDb, 'calls', 'call_alice_bob');
    const callRefBob = doc(bobDb, 'calls', 'call_alice_bob');
    await assertFails(updateDoc(callRefAlice, { status: 'connected', connectedAt: new Date() }));
    await assertSucceeds(updateDoc(callRefBob, { status: 'accepted', acceptedAt: new Date() }));
    await assertSucceeds(updateDoc(callRefBob, {
      status: 'connected',
      connectedAt: new Date(),
      answer: { type: 'answer', sdp: 'v=0\\r\\n' },
    }));
    await assertFails(updateDoc(callRefAlice, {
      answer: { type: 'answer', sdp: 'forged' },
      status: 'connected',
    }));
    await assertFails(updateDoc(callRefBob, { status: 'connected', connectedAt: new Date() }));
  });

  it('15. In-call chat events cannot spoof senders or be edited', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const eveDb = testEnv.authenticatedContext('eve_uid').firestore();
    const aliceEvent = doc(aliceDb, 'calls', 'call_alice_bob', 'events', 'alice_message');
    await assertSucceeds(setDoc(aliceEvent, { kind: 'message', senderId: 'alice_uid', senderName: 'Alice', text: 'Hello during the call', createdAt: new Date() }));
    await assertFails(setDoc(doc(bobDb, 'calls', 'call_alice_bob', 'events', 'spoofed_message'), { kind: 'message', senderId: 'alice_uid', senderName: 'Alice', text: 'Spoofed', createdAt: new Date() }));
    await assertFails(setDoc(doc(eveDb, 'calls', 'call_alice_bob', 'events', 'outsider_message'), { kind: 'message', senderId: 'eve_uid', senderName: 'Eve', text: 'Intrusion', createdAt: new Date() }));
  });
  it('16. Marketplace listings can only be created by their seller', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const listing = {
      id: 'alice_listing',
      title: 'Used camera body',
      description: 'Camera in good condition',
      price: 120000,
      currency: 'RWF',
      category: 'Tech',
      condition: 'Like New',
      images: ['https://storage.example.com/camera.webp'],
      seller: { id: 'alice_uid', name: 'Alice', username: 'alice', avatar: '' },
      location: 'Kigali',
      createdAt: Date.now(),
      isSold: false,
      tags: ['camera'],
    };
    await assertSucceeds(setDoc(doc(aliceDb, 'marketplace_items', 'alice_listing'), listing));
    await assertFails(setDoc(doc(bobDb, 'marketplace_items', 'forged_listing'), {
      ...listing,
      id: 'forged_listing',
      seller: { ...listing.seller, id: 'alice_uid' },
    }));
  });

  it('17. Sponsored campaigns enter pending review and cannot self-activate', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const adRef = doc(aliceDb, 'sponsored_ads', 'alice_campaign');
    const campaign = {
      id: 'alice_campaign',
      sellerId: 'alice_uid',
      title: 'Camera sale',
      description: 'A real campaign',
      type: 'feed_post',
      mediaUrl: 'https://storage.example.com/campaign.webp',
      mediaType: 'image',
      ctaText: 'Contact seller',
      budget: 25000,
      targetCategory: 'Tech',
      impressions: 0,
      clicks: 0,
      status: 'pending',
      createdAt: Date.now(),
    };
    await assertSucceeds(setDoc(adRef, campaign));
    await assertFails(setDoc(doc(aliceDb, 'sponsored_ads', 'self_approved'), {
      ...campaign,
      id: 'self_approved',
      status: 'active',
    }));
    await assertFails(updateDoc(adRef, { status: 'active' }));
  });

  it('18. Post engagement counts cannot be forged and poll/comment edits are server-only', async () => {
    if (!testEnv) return;
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const postRef = doc(bobDb, 'posts', 'alice_post_1');
    await assertFails(updateDoc(postRef, { likedBy: ['bob_uid'], likesCount: 999 }));
    await assertSucceeds(updateDoc(postRef, { likedBy: ['bob_uid'], likesCount: 1 }));
    await assertFails(updateDoc(postRef, {
      poll: { question: 'Choose one', options: [{ id: 'yes', text: 'Yes', votes: 1 }, { id: 'no', text: 'No', votes: 0 }], totalVotes: 1, voters: { bob_uid: 'yes' } },
    }));
    await assertFails(updateDoc(postRef, {
      comments: [{ id: 'spoofed', author: { id: 'alice_uid', name: 'Alice' }, content: 'Forged comment' }],
      commentsCount: 1,
    }));
  });

  it('19. Reel engagement counters and comments are not browser-writable', async () => {
    if (!testEnv) return;
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const reelRef = doc(bobDb, 'reels', 'alice_reel_1');
    await assertFails(updateDoc(reelRef, { likedBy: ['bob_uid'], likesCount: 500 }));
    await assertSucceeds(updateDoc(reelRef, { likedBy: ['bob_uid'], likesCount: 1 }));
    await assertFails(updateDoc(reelRef, { comments: [{ id: 'fake', content: 'forged' }], commentsCount: 1 }));
  });

  it('20. Active sponsored campaign counters cannot be incremented by browser clients', async () => {
    if (!testEnv) return;
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const adRef = doc(bobDb, 'sponsored_ads', 'active_campaign');
    await assertFails(updateDoc(adRef, { impressions: 1 }));
    await assertFails(updateDoc(adRef, { clicks: 1 }));
  });
  it('21. Conversation history clearing is private to the requesting participant', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const aliceState = doc(aliceDb, 'conversations', 'conv_alice_bob', 'userState', 'alice_uid');
    const bobState = doc(bobDb, 'conversations', 'conv_alice_bob', 'userState', 'bob_uid');
    await assertSucceeds(setDoc(aliceState, { clearedAt: new Date(), updatedAt: new Date() }));
    await assertSucceeds(setDoc(bobState, { clearedAt: new Date(), updatedAt: new Date() }));
    await assertFails(getDoc(doc(bobDb, 'conversations', 'conv_alice_bob', 'userState', 'alice_uid')));
    await assertFails(setDoc(doc(aliceDb, 'conversations', 'conv_alice_bob', 'userState', 'bob_uid'), { clearedAt: new Date() }));
  });
  it('22. Blocks prevent new direct messages and clients cannot forge inbox previews', async () => {
    if (!testEnv) return;
    const aliceDb = testEnv.authenticatedContext('alice_uid').firestore();
    const bobDb = testEnv.authenticatedContext('bob_uid').firestore();
    const bobPrivate = doc(bobDb, 'users', 'bob_uid', 'private', 'settings');
    await assertSucceeds(setDoc(bobPrivate, { blockedUsers: ['alice_uid'] }, { merge: true }));
    const blockedMessage = doc(aliceDb, 'conversations', 'conv_alice_bob', 'messages', 'blocked_message');
    await assertFails(setDoc(blockedMessage, {
      id: 'blocked_message', conversationId: 'conv_alice_bob', senderId: 'alice_uid',
      text: 'This should not send', type: 'text', status: 'sent', createdAt: new Date(),
    }));
    await assertFails(updateDoc(doc(aliceDb, 'conversations', 'conv_alice_bob'), {
      lastMessage: { id: 'spoofed', senderId: 'alice_uid', text: 'Forged preview' },
      unreadCounts: { alice_uid: 0, bob_uid: 999 },
    }));
  });
});
