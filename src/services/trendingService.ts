import { Post } from '../types';

export interface TrendingTopic {
  tag: string;
  name: string;
  count: number;
  score: number;
  category: string;
  formattedCount: string;
  isHot: boolean;
  samplePost?: Post;
}

/**
 * Calculates trending hashtags and topics dynamically from real user posts
 * using an engagement & recency weighting velocity algorithm.
 */
export function calculateTrendingTopics(posts: Post[]): TrendingTopic[] {
  const tagMap: Record<
    string,
    {
      count: number;
      score: number;
      samplePost?: Post;
    }
  > = {};

  const now = Date.now();

  posts.forEach((post) => {
    // Extract tags from tags array and from regex in content
    const tagsFound = new Set<string>();

    if (Array.isArray(post.tags)) {
      post.tags.forEach((t) => {
        const clean = t.replace(/^#/, '').trim().toLowerCase();
        if (clean.length >= 2) tagsFound.add(clean);
      });
    }

    const regexMatches = post.content.match(/#([a-zA-Z0-9_\u0080-\uFFFF]+)/g);
    if (regexMatches) {
      regexMatches.forEach((m) => {
        const clean = m.replace(/^#/, '').trim().toLowerCase();
        if (clean.length >= 2) tagsFound.add(clean);
      });
    }

    // Calculate post engagement points
    const engagementPoints =
      (post.likesCount || 0) * 2 +
      (post.commentsCount || 0) * 3 +
      (post.sharesCount || 0) * 4 +
      (post.repostsCount || 0) * 3 +
      5; // base 5 points per post

    // Time decay factor
    let timeMultiplier = 1.0;
    try {
      const postTime = new Date(post.createdAt).getTime();
      if (!isNaN(postTime)) {
        const diffHours = (now - postTime) / (1000 * 60 * 60);
        if (diffHours <= 2) timeMultiplier = 2.5;
        else if (diffHours <= 12) timeMultiplier = 2.0;
        else if (diffHours <= 24) timeMultiplier = 1.6;
        else if (diffHours <= 72) timeMultiplier = 1.2;
      }
    } catch {
      timeMultiplier = 1.0;
    }

    const postScore = engagementPoints * timeMultiplier;

    tagsFound.forEach((tag) => {
      if (!tagMap[tag]) {
        tagMap[tag] = { count: 0, score: 0, samplePost: post };
      }
      tagMap[tag].count += 1;
      tagMap[tag].score += postScore;
      if (!tagMap[tag].samplePost) {
        tagMap[tag].samplePost = post;
      }
    });
  });

  const categories: Record<string, string> = {
    minimalism: 'Aesthetics',
    nordic: 'Architecture',
    design: 'Creative',
    ceramics: 'Craft & Art',
    sound: 'Acoustics',
    sounddesign: 'Music',
    photography: 'Visuals',
    coffee: 'Rituals',
    mindfulness: 'Wellness',
    tech: 'Technology',
    coding: 'Engineering',
    art: 'Fine Art',
    aura: 'Community',
  };

  const trendingList: TrendingTopic[] = Object.keys(tagMap).map((tag) => {
    const item = tagMap[tag];
    const isHot = item.score > 25 || item.count >= 3;
    const category =
      categories[tag] ||
      (tag.length > 8 ? 'Curated' : 'Trending');

    return {
      tag,
      name: `#${tag}`,
      count: item.count,
      score: Math.round(item.score),
      category,
      formattedCount:
        item.count === 1 ? '1 reflection' : `${item.count} reflections`,
      isHot,
      samplePost: item.samplePost,
    };
  });

  // Sort descending by score then by count
  trendingList.sort((a, b) => b.score - a.score || b.count - a.count);

  return trendingList;
}
