import { Post, User } from '../types';

/**
 * Production-ready Machine Learning Feed Ranker and Smart Creator Recommender
 * Implements TF-IDF vectorization, Cosine similarity, exponential recency half-life decay,
 * and logistic regression scoring (equivalent to scripts/ml_feed_ranker.py).
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'it', 'this', 'that', 'with', 'from', 'by', 'as', 'are'
]);

function tokenize(text: string): string[] {
  if (!text) return [];
  const words = text.toLowerCase().match(/[a-z0-9#_]+/g) || [];
  return words.filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function computeTf(tokens: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of tokens) {
    counts[t] = (counts[t] || 0) + 1;
  }
  const total = tokens.length || 1;
  const tf: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    tf[k] = v / total;
  }
  return tf;
}

function computeIdf(corpus: string[][]): Record<string, number> {
  const numDocs = corpus.length;
  if (numDocs === 0) return {};
  const docFreq: Record<string, number> = {};

  for (const doc of corpus) {
    const unique = new Set(doc);
    for (const t of unique) {
      docFreq[t] = (docFreq[t] || 0) + 1;
    }
  }

  const idf: Record<string, number> = {};
  for (const [t, count] of Object.entries(docFreq)) {
    idf[t] = Math.log((1 + numDocs) / (1 + count)) + 1.0;
  }
  return idf;
}

function cosineSimilarity(vec1: Record<string, number>, vec2: Record<string, number>): number {
  const keys1 = Object.keys(vec1);
  const keys2 = Object.keys(vec2);
  if (keys1.length === 0 || keys2.length === 0) return 0;

  let dotProduct = 0;
  for (const t of keys1) {
    if (vec2[t] !== undefined) {
      dotProduct += vec1[t] * vec2[t];
    }
  }

  let sumSq1 = 0;
  for (const v of Object.values(vec1)) sumSq1 += v * v;
  let sumSq2 = 0;
  for (const v of Object.values(vec2)) sumSq2 += v * v;

  const norm1 = Math.sqrt(sumSq1);
  const norm2 = Math.sqrt(sumSq2);
  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (norm1 * norm2);
}

function calculateTimeDecay(val: any, halfLifeHours = 36.0): number {
  let createdMs = 0;
  if (typeof val === 'number') {
    createdMs = val < 1e11 ? val * 1000 : val;
  } else if (typeof val?.toMillis === 'function') {
    createdMs = val.toMillis();
  } else if (typeof val?.seconds === 'number') {
    createdMs = val.seconds * 1000;
  } else if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) createdMs = parsed;
  }

  if (createdMs <= 0) return 0.95;

  const nowMs = Date.now();
  const ageHours = Math.max(0, (nowMs - createdMs) / (1000 * 3600));
  const decay = Math.exp(-Math.log(2) * (ageHours / halfLifeHours));
  return Math.max(0.05, Math.min(1.0, decay));
}

function sigmoid(x: number): number {
  const clamped = Math.max(-20, Math.min(20, x));
  return 1 / (1 + Math.exp(-clamped));
}

export interface MLRankedPost {
  post: Post;
  score: number;
  contentSimilarity: number;
  recencyFactor: number;
}

/**
 * Machine Learning Feed Ranker
 * Ranks posts according to user interests, social affinity, recency half-life,
 * and engagement probability.
 */
export function rankFeedWithML(
  posts: Post[],
  currentUser: User,
  customInterests?: string[]
): Post[] {
  if (!posts || posts.length <= 1) return posts;

  // 1. Gather User Interest Profile
  const userInterests = new Set<string>(customInterests || []);
  // Derive interests from user's following list and bio
  if (currentUser.bio) {
    tokenize(currentUser.bio).forEach((t) => userInterests.add(t));
  }

  // 2. Prepare corpus for TF-IDF
  const corpus: string[][] = [];
  for (const p of posts) {
    const tagStr = (p.tags || []).map((t) => `#${t.replace(/^#/, '')}`).join(' ');
    const text = `${p.content || ''} ${tagStr}`;
    corpus.push(tokenize(text));
  }

  const idf = computeIdf(corpus);

  // User interest vector
  const userTokens = Array.from(userInterests);
  const userTf = computeTf(userTokens);
  const userVec: Record<string, number> = {};
  for (const [t, tfVal] of Object.entries(userTf)) {
    userVec[t] = tfVal * (idf[t] || 1.0);
  }

  const followingSet = new Set<string>(currentUser.following || []);

  const scored: MLRankedPost[] = posts.map((post, idx) => {
    const docTokens = corpus[idx];
    const docTf = computeTf(docTokens);
    const docVec: Record<string, number> = {};
    for (const [t, tfVal] of Object.entries(docTf)) {
      docVec[t] = tfVal * (idf[t] || 1.0);
    }

    // A. Content relevance (TF-IDF Cosine Similarity)
    const contentSimilarity = cosineSimilarity(userVec, docVec);

    // B. Recency decay
    const recencyFactor = calculateTimeDecay(post.createdAt || post.timestamp);

    // C. Social affinity
    const authorId = post.author?.id || '';
    const isFollowing = followingSet.has(authorId);
    const isSelf = authorId === currentUser.id;
    let socialWeight = 1.0;
    if (isSelf) {
      socialWeight = 0.6;
    } else if (isFollowing) {
      socialWeight = 1.85;
    }

    // D. Engagement Quality
    const likes = post.likesCount || 0;
    const comments = (post.comments || []).length || post.commentsCount || 0;
    const shares = post.sharesCount || 0;
    const reposts = post.repostsCount || 0;
    const views = Math.max(1, post.viewsCount || 1);

    const engagementRate = Math.min(2.5, (likes + comments * 2.0 + shares * 3.0 + reposts * 2.2) / views);

    // E. Media richness bonus
    const hasMedia = Boolean(post.mediaUrl || (post.mediaUrls && post.mediaUrls.length > 0));
    const hasPoll = Boolean(post.poll);
    const richnessBonus = (hasMedia ? 0.35 : 0.0) + (hasPoll ? 0.25 : 0.0);

    // Logistic Regression Score
    const z =
      2.2 * contentSimilarity +
      1.6 * engagementRate +
      1.4 * recencyFactor +
      1.5 * socialWeight +
      richnessBonus -
      1.8;

    const mlScore = sigmoid(z);

    return {
      post,
      score: mlScore,
      contentSimilarity,
      recencyFactor,
    };
  });

  // Sort descending by ML engagement score
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.post);
}

/**
 * Smart Suggested Creators
 * Computes creator similarity, verified badges, and shared interests.
 * Prevents high data usage by returning only the top N curated creators
 * rather than fetching or rendering all registered database accounts.
 */
export function getSmartSuggestedCreatorsML(
  allCreators: User[],
  currentUser: User,
  recentPosts: Post[],
  limit = 5
): User[] {
  if (!allCreators || allCreators.length === 0) return [];

  const followingSet = new Set<string>(currentUser.following || []);
  followingSet.add(currentUser.id); // Exclude self

  // Filter out users already followed
  const candidates = allCreators.filter((c) => !followingSet.has(c.id));
  if (candidates.length === 0) return [];

  // Gather user topics from posts they've liked or created
  const userTokens = new Set<string>();
  if (currentUser.bio) {
    tokenize(currentUser.bio).forEach((t) => userTokens.add(t));
  }
  recentPosts.forEach((p) => {
    if (p.hasLiked || p.author.id === currentUser.id) {
      (p.tags || []).forEach((t) => userTokens.add(t.toLowerCase()));
    }
  });

  const scored = candidates.map((creator) => {
    const creatorText = `${creator.name || ''} ${creator.username || ''} ${creator.bio || ''}`;
    const creatorTokens = tokenize(creatorText);

    let matchCount = 0;
    for (const token of creatorTokens) {
      if (userTokens.has(token)) matchCount++;
    }

    const followers = Math.max(0, creator.followersCount || 0);
    const verifiedBonus = creator.verified ? 1.8 : 0.0;
    const hasCustomAvatar = creator.avatar && !creator.avatar.includes('empty') ? 0.6 : 0.0;

    const score =
      matchCount * 2.2 +
      Math.min(3.0, Math.log10(followers + 1) * 1.5) +
      verifiedBonus +
      hasCustomAvatar;

    return { creator, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.creator);
}
