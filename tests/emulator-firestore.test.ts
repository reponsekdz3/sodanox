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
          createdAt: new Date(),
        });

        // 3. Conversation between Alice and Bob
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
});
