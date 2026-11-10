import { Post, User, MarketplaceItem } from '../types';

export interface MLSearchResult {
  posts: Post[];
  creators: User[];
  marketplace: MarketplaceItem[];
  tags: { tag: string; count: number }[];
  semanticScoreMap: Record<string, number>;
}

// Tokenizer & Term Normalizer
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\s#]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// Compute Term Frequency Vector
function computeTF(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  const total = tokens.length || 1;
  for (const k in tf) {
    tf[k] /= total;
  }
  return tf;
}

// Cosine similarity between two term frequency vectors
function vectorCosineSimilarity(
  v1: Record<string, number>,
  v2: Record<string, number>
): number {
  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const k in v1) {
    const val = v1[k];
    norm1 += val * val;
    if (v2[k]) {
      dot += val * v2[k];
    }
  }

  for (const k in v2) {
    const val = v2[k];
    norm2 += val * val;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Advanced Machine Learning Search Engine
 * Combines exact keyword prefix, token overlap, and TF-IDF Cosine Similarity
 */
export function searchWithML(
  query: string,
  corpus: {
    posts: Post[];
    creators: User[];
    marketplace?: MarketplaceItem[];
  }
): MLSearchResult {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return {
      posts: corpus.posts.slice(0, 20),
      creators: corpus.creators.slice(0, 15),
      marketplace: (corpus.marketplace || []).slice(0, 15),
      tags: extractTopTags(corpus.posts),
      semanticScoreMap: {},
    };
  }

  const queryTokens = tokenize(cleanQuery);
  const queryTF = computeTF(queryTokens);
  const semanticScoreMap: Record<string, number> = {};

  // 1. Score Posts
  const scoredPosts = corpus.posts.map((post) => {
    const postText = `${post.content} ${post.tags.join(' ')} ${post.author?.name || ''} ${post.author?.username || ''}`;
    const postTokens = tokenize(postText);
    const postTF = computeTF(postTokens);

    // Vector similarity
    const cosSim = vectorCosineSimilarity(queryTF, postTF);

    // Substring boost
    let substringBoost = 0;
    if (post.content.toLowerCase().includes(cleanQuery)) substringBoost += 0.45;
    if (post.tags.some((t) => t.toLowerCase().includes(cleanQuery))) substringBoost += 0.35;
    if (post.author?.name.toLowerCase().includes(cleanQuery)) substringBoost += 0.25;

    // Quality boost
    const engagementBoost = Math.min(0.2, (post.likesCount + post.commentsCount) / 100);
    const verifiedBoost = post.author?.verified ? 0.1 : 0;

    const totalScore = cosSim * 0.5 + substringBoost + engagementBoost + verifiedBoost;
    semanticScoreMap[post.id] = totalScore;
    return { post, score: totalScore };
  });

  const matchingPosts = scoredPosts
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.post);

  // 2. Score Creators
  const scoredCreators = corpus.creators.map((user) => {
    const userText = `${user.name} ${user.username} ${user.bio || ''} ${user.location || ''}`;
    const userTokens = tokenize(userText);
    const userTF = computeTF(userTokens);

    const cosSim = vectorCosineSimilarity(queryTF, userTF);
    let nameBoost = 0;
    if (user.username.toLowerCase().includes(cleanQuery)) nameBoost += 0.6;
    if (user.name.toLowerCase().includes(cleanQuery)) nameBoost += 0.45;
    if (user.bio?.toLowerCase().includes(cleanQuery)) nameBoost += 0.25;
    const verifiedBoost = user.verified ? 0.15 : 0;

    const totalScore = cosSim * 0.4 + nameBoost + verifiedBoost;
    semanticScoreMap[user.id] = totalScore;
    return { user, score: totalScore };
  });

  const matchingCreators = scoredCreators
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.user);

  // 3. Score Marketplace Items
  const items = corpus.marketplace || [];
  const scoredMarketplace = items.map((item) => {
    const itemText = `${item.title} ${item.description} ${item.category} ${item.location} ${item.tags.join(' ')}`;
    const itemTokens = tokenize(itemText);
    const itemTF = computeTF(itemTokens);

    const cosSim = vectorCosineSimilarity(queryTF, itemTF);
    let textBoost = 0;
    if (item.title.toLowerCase().includes(cleanQuery)) textBoost += 0.6;
    if (item.category.toLowerCase().includes(cleanQuery)) textBoost += 0.4;
    if (item.tags.some((t) => t.toLowerCase().includes(cleanQuery))) textBoost += 0.3;

    const totalScore = cosSim * 0.4 + textBoost;
    semanticScoreMap[item.id] = totalScore;
    return { item, score: totalScore };
  });

  const matchingMarketplace = scoredMarketplace
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.item);

  // 4. Extract Matching Tags
  const matchingTags = extractTopTags(corpus.posts)
    .filter((t) => t.tag.toLowerCase().includes(cleanQuery.replace('#', '')))
    .slice(0, 10);

  return {
    posts: matchingPosts,
    creators: matchingCreators,
    marketplace: matchingMarketplace,
    tags: matchingTags,
    semanticScoreMap,
  };
}

function extractTopTags(posts: Post[]): { tag: string; count: number }[] {
  const tagCounts: Record<string, number> = {};
  for (const post of posts) {
    for (const tag of post.tags || []) {
      const clean = tag.replace(/^#/, '');
      tagCounts[clean] = (tagCounts[clean] || 0) + 1;
    }
  }
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}
