import {
  collection,
  doc,
  getDocs,
  setDoc,
  addDoc,
  serverTimestamp,
  query,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { User, Post, Reel, Story } from '../types';

export const INITIAL_CREATORS: User[] = [
  {
    id: 'Xu0Rc4W9fZgpjh0bEWzEvxbN4pC2',
    name: 'Raphaël NSHIMYUMUKIZA',
    username: 'raphael_nsh',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    bio: 'Architectural designer & spatial researcher · Rammed earth, light, and contemplative structures in Kigali.',
    pronouns: 'he/him',
    location: 'Kigali, Rwanda',
    website: 'https://github.com/reponsekdz3',
    joinedDate: 'Joined September 2026',
    followersCount: 142,
    followingCount: 38,
    followers: [],
    following: [],
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    verified: true,
    email: 'raphanshimyumukiza@gmail.com',
    privateAccount: false,
    themePreference: 'nordic',
    allowMessagesFrom: 'everyone',
    showOnlineStatus: true,
    allowReshare: true,
  },
  {
    id: 'user_reponsekdz01',
    name: 'Reponse KDZ',
    username: 'reponsekdz',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    bio: 'Lead Engineer & Founder · Building calm, tactile social technology on Aura.',
    pronouns: 'he/him',
    location: 'Kigali, Rwanda',
    website: 'https://github.com/reponsekdz3',
    joinedDate: 'Joined September 2026',
    followersCount: 284,
    followingCount: 64,
    followers: [],
    following: [],
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    verified: true,
    email: 'reponsekdz01@gmail.com',
    privateAccount: false,
    themePreference: 'nordic',
    allowMessagesFrom: 'everyone',
    showOnlineStatus: true,
    allowReshare: true,
  },
  {
    id: 'user_clara_mugabo',
    name: 'Clara Mugabo',
    username: 'claramugabo',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1200&q=80',
    bio: 'Acoustic artist & field recordist · Capturing organic soundscapes across the Great Lakes region.',
    pronouns: 'she/her',
    location: 'Lake Kivu & Kigali, Rwanda',
    website: 'https://claramugabo.sound',
    joinedDate: 'Joined September 2026',
    followersCount: 198,
    followingCount: 42,
    followers: [],
    following: [],
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    verified: true,
    email: 'clara@aurasocial.org',
    privateAccount: false,
    themePreference: 'nordic',
    allowMessagesFrom: 'everyone',
    showOnlineStatus: true,
    allowReshare: true,
  },
  {
    id: 'user_marcus_v',
    name: 'Marcus Vianna',
    username: 'marcus_v',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bannerUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    bio: 'Ceramicist & industrial form designer · Nordic stoneware & organic glazes.',
    pronouns: 'he/him',
    location: 'Oslo / Kigali',
    website: 'https://marcusvianna.studio',
    joinedDate: 'Joined September 2026',
    followersCount: 165,
    followingCount: 51,
    followers: [],
    following: [],
    isFollowing: false,
    isFollower: false,
    isMutual: false,
    verified: true,
    email: 'marcus@aurasocial.org',
    privateAccount: false,
    themePreference: 'nordic',
    allowMessagesFrom: 'everyone',
    showOnlineStatus: true,
    allowReshare: true,
  },
];

let isSeeding = false;

/**
 * Initializes Firestore with realistic community users, posts, stories, and reels
 * if the database is currently unpopulated.
 */
export async function seedCommunityDataIfEmpty(currentUser?: User): Promise<void> {
  if (isSeeding) return;
  isSeeding = true;

  try {
    // 1. Seed Users if not present
    for (const creator of INITIAL_CREATORS) {
      const userRef = doc(db, 'users', creator.id);
      await setDoc(userRef, creator, { merge: true });
    }

    // 2. Check if posts collection is populated
    const postsSnap = await getDocs(query(collection(db, 'posts'), limit(2)));
    if (postsSnap.empty) {
      console.log('Seeding initial authentic community posts into Firestore...');

      const post1 = {
        author: {
          id: INITIAL_CREATORS[0].id,
          name: INITIAL_CREATORS[0].name,
          username: INITIAL_CREATORS[0].username,
          avatar: INITIAL_CREATORS[0].avatar,
          verified: true,
        },
        content:
          'Finished acoustic tests on the open rammed-earth pavilion here in Kigali. The combination of compressed volcanic clay and local bamboo reduces high flutter echo by 65% naturally without synthetic insulation.\n\nWhich sustainable material best balances thermal mass and acoustic quiet in your projects?',
        mediaUrl:
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        mediaUrls: [
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
        ],
        mediaType: 'image',
        tags: ['Architecture', 'Kigali', 'Design', 'Sustainability', 'Acoustics'],
        location: 'Kigali Innovation City, Rwanda',
        audience: 'public',
        likesCount: 38,
        likedBy: [INITIAL_CREATORS[1].id, INITIAL_CREATORS[2].id],
        bookmarksCount: 14,
        bookmarkedBy: [INITIAL_CREATORS[1].id],
        repostsCount: 6,
        repostedBy: [],
        sharesCount: 11,
        commentsCount: 2,
        comments: [
          {
            id: 'c_arch_1',
            author: INITIAL_CREATORS[2],
            content:
              'The natural low-frequency decay in those curved corners must sound pristine. Would love to run an impulse response test with binaural mics next Tuesday!',
            timestamp: '2h ago',
            likesCount: 5,
            hasLiked: false,
          },
          {
            id: 'c_arch_2',
            author: INITIAL_CREATORS[3],
            content:
              'The tactile texture of the compressed earth reminds me of Finnish clay plaster. Incredible warmth, Raphaël.',
            timestamp: '1h ago',
            likesCount: 3,
            hasLiked: false,
          },
        ],
        poll: {
          id: 'poll_materials_1',
          question: 'Which material best balances thermal mass and acoustic quiet in your space?',
          options: [
            { id: 'opt_1', text: 'Rammed earth & volcanic clay', votes: 42 },
            { id: 'opt_2', text: 'Treated local timber & bamboo', votes: 26 },
            { id: 'opt_3', text: 'Perforated clay brick screen', votes: 14 },
          ],
          totalVotes: 82,
          voters: {},
        },
        timestamp: '3 hours ago',
        createdAt: serverTimestamp(),
      };

      const post2 = {
        author: {
          id: INITIAL_CREATORS[2].id,
          name: INITIAL_CREATORS[2].name,
          username: INITIAL_CREATORS[2].username,
          avatar: INITIAL_CREATORS[2].avatar,
          verified: true,
        },
        content:
          'Dawn soundwalk along the northern shore of Lake Kivu. Recorded the gentle rhythm of water against black basalt rocks filtered through morning fog. Mindful listening changes how we notice space.',
        mediaUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        mediaUrls: [
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        ],
        mediaType: 'image',
        tags: ['FieldRecording', 'LakeKivu', 'SoundArt', 'Mindfulness', 'Rwanda'],
        location: 'Lake Kivu, Rubavu',
        audience: 'public',
        likesCount: 52,
        likedBy: [INITIAL_CREATORS[0].id, INITIAL_CREATORS[1].id],
        bookmarksCount: 21,
        bookmarkedBy: [INITIAL_CREATORS[0].id],
        repostsCount: 9,
        repostedBy: [],
        sharesCount: 18,
        commentsCount: 1,
        comments: [
          {
            id: 'c_kivu_1',
            author: INITIAL_CREATORS[1],
            content:
              'The spatial depth here is unbelievable. Exactly the kind of calm texture Aura was designed to highlight.',
            timestamp: '45m ago',
            likesCount: 8,
            hasLiked: false,
          },
        ],
        timestamp: '5 hours ago',
        createdAt: serverTimestamp(),
      };

      const post3 = {
        author: {
          id: INITIAL_CREATORS[1].id,
          name: INITIAL_CREATORS[1].name,
          username: INITIAL_CREATORS[1].username,
          avatar: INITIAL_CREATORS[1].avatar,
          verified: true,
        },
        content:
          'Welcome to Aura Social. We built this platform as an antidote to frantic feeds, algorithmic toxicity, and loud ads. Tactile typography, high-fidelity audio notes, and authentic human conversations. What brought you here today?',
        mediaUrl:
          'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
        mediaUrls: [
          'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
        ],
        mediaType: 'image',
        tags: ['AuraSocial', 'Engineering', 'MindfulTech', 'Community'],
        location: 'Kigali, Rwanda',
        audience: 'public',
        likesCount: 76,
        likedBy: [INITIAL_CREATORS[0].id, INITIAL_CREATORS[2].id, INITIAL_CREATORS[3].id],
        bookmarksCount: 34,
        bookmarkedBy: [],
        repostsCount: 18,
        repostedBy: [],
        sharesCount: 29,
        commentsCount: 2,
        comments: [
          {
            id: 'c_aura_1',
            author: INITIAL_CREATORS[0],
            content:
              'Proud of what the community is creating here. The attention to micro-interactions and audio feedback is world-class.',
            timestamp: '1h ago',
            likesCount: 12,
            hasLiked: true,
          },
        ],
        timestamp: '1 day ago',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'posts'), post1);
      await addDoc(collection(db, 'posts'), post2);
      await addDoc(collection(db, 'posts'), post3);
    }

    // 3. Check if Reels collection is populated
    const reelsSnap = await getDocs(query(collection(db, 'reels'), limit(2)));
    if (reelsSnap.empty) {
      console.log('Seeding initial community reels into Firestore...');
      const reel1 = {
        author: {
          id: INITIAL_CREATORS[0].id,
          name: INITIAL_CREATORS[0].name,
          username: INITIAL_CREATORS[0].username,
          avatar: INITIAL_CREATORS[0].avatar,
          verified: true,
        },
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        posterUrl:
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
        caption: 'Morning light study across the curved brick facade in Kigali. Notice the gradual shadow gradient.',
        tags: ['Architecture', 'LightStudy', 'Kigali'],
        audioTrack: { title: 'Kigali Morning Mist', artist: 'Clara Mugabo' },
        likesCount: 64,
        likedBy: [INITIAL_CREATORS[1].id],
        commentsCount: 8,
        comments: [
          {
            id: 'cr1',
            author: INITIAL_CREATORS[1],
            content: 'The shadow interplay on that mortar joint is sublime.',
            timestamp: '2h ago',
            likesCount: 4,
          },
        ],
        sharesCount: 14,
        createdAt: serverTimestamp(),
      };

      const reel2 = {
        author: {
          id: INITIAL_CREATORS[2].id,
          name: INITIAL_CREATORS[2].name,
          username: INITIAL_CREATORS[2].username,
          avatar: INITIAL_CREATORS[2].avatar,
          verified: true,
        },
        videoUrl:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        posterUrl:
          'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        caption: 'Field microphone placement on the volcanic shore of Lake Kivu. Catching hydro-acoustics.',
        tags: ['FieldAcoustics', 'LakeKivu', 'SoundDesign'],
        audioTrack: { title: 'Basalt Resonance', artist: 'Clara Mugabo' },
        likesCount: 92,
        likedBy: [INITIAL_CREATORS[0].id, INITIAL_CREATORS[3].id],
        commentsCount: 12,
        comments: [],
        sharesCount: 22,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'reels'), reel1);
      await addDoc(collection(db, 'reels'), reel2);
    }

    // 4. Check if Stories collection is populated
    const storiesSnap = await getDocs(query(collection(db, 'stories'), limit(2)));
    if (storiesSnap.empty) {
      console.log('Seeding initial stories into Firestore...');
      const story1 = {
        userId: INITIAL_CREATORS[0].id,
        userName: INITIAL_CREATORS[0].name,
        userUsername: INITIAL_CREATORS[0].username,
        userAvatar: INITIAL_CREATORS[0].avatar,
        viewers: [],
        items: [
          {
            id: 'st_item_1',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1080&q=80',
            duration: 6,
            caption: 'Material swatches for the library pavilion',
            timestamp: '1h ago',
          },
          {
            id: 'st_item_2',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1080&q=80',
            duration: 5,
            caption: 'Midday sunlight angle test',
            timestamp: '45m ago',
          },
        ],
        createdAt: serverTimestamp(),
      };

      const story2 = {
        userId: INITIAL_CREATORS[2].id,
        userName: INITIAL_CREATORS[2].name,
        userUsername: INITIAL_CREATORS[2].username,
        userAvatar: INITIAL_CREATORS[2].avatar,
        viewers: [],
        items: [
          {
            id: 'st_item_3',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1080&q=80',
            duration: 5,
            caption: 'Lake Kivu sunrise acoustic session',
            timestamp: '2h ago',
          },
        ],
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'stories'), story1);
      await addDoc(collection(db, 'stories'), story2);
    }

    // 5. Seed initial conversation with Raphaël if currentUser exists
    if (currentUser && currentUser.id !== INITIAL_CREATORS[0].id) {
      const raphael = INITIAL_CREATORS[0];
      const sortedIds = [currentUser.id, raphael.id].sort();
      const convId = `conv_${sortedIds[0]}_${sortedIds[1]}`;

      // Check local storage first
      const storedConvsRaw = localStorage.getItem('aura_chat_conversations');
      const storedConvs: any[] = storedConvsRaw ? JSON.parse(storedConvsRaw) : [];
      const exists = storedConvs.some((c) => c.id === convId);

      if (!exists) {
        const welcomeMessage = {
          id: `msg_welcome_${Date.now()}`,
          conversationId: convId,
          senderId: raphael.id,
          senderName: raphael.name,
          senderAvatar: raphael.avatar,
          timestamp: '10:30 AM',
          type: 'text',
          text: 'Welcome to Aura! Delighted to connect with you. This is a calm space for tactile craft, architectural thoughts, and slow conversations. Feel free to send a reflection or voice note here.',
          status: 'delivered',
          createdAt: Date.now() - 3600000,
        };

        const newConv = {
          id: convId,
          participant: {
            id: raphael.id,
            name: raphael.name,
            username: raphael.username,
            avatar: raphael.avatar,
            verified: true,
            isOnline: true,
          },
          lastMessage: {
            id: welcomeMessage.id,
            senderId: raphael.id,
            timestamp: '10:30 AM',
            type: 'text',
            text: welcomeMessage.text,
            status: 'delivered',
          },
          unreadCount: 1,
          isOnline: true,
          isTyping: false,
        };

        storedConvs.unshift(newConv);
        localStorage.setItem('aura_chat_conversations', JSON.stringify(storedConvs));
        localStorage.setItem(`aura_chat_msgs_${convId}`, JSON.stringify([welcomeMessage]));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('aura_chat_convs_updated'));
          window.dispatchEvent(
            new CustomEvent('aura_chat_msgs_updated', { detail: { conversationId: convId } })
          );
        }

        // Also sync to Firestore in background
        try {
          const convRef = doc(db, 'conversations', convId);
          await setDoc(
            convRef,
            {
              id: convId,
              participantIds: [currentUser.id, raphael.id],
              participants: {
                [currentUser.id]: {
                  id: currentUser.id,
                  name: currentUser.name,
                  username: currentUser.username,
                  avatar: currentUser.avatar,
                  verified: currentUser.verified || false,
                },
                [raphael.id]: {
                  id: raphael.id,
                  name: raphael.name,
                  username: raphael.username,
                  avatar: raphael.avatar,
                  verified: true,
                },
              },
              lastMessage: newConv.lastMessage,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const msgRef = doc(db, 'conversations', convId, 'messages', welcomeMessage.id);
          await setDoc(msgRef, welcomeMessage);
        } catch {
          // Firestore sync silently handled
        }
      }
    }
  } catch (err) {
    console.warn('Seeding check/complete notice:', err);
  } finally {
    isSeeding = false;
  }
}
