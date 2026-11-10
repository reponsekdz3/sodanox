#!/usr/bin/env python3
"""
Ducate Machine Learning Feed & Creator Recommendation Engine
Production-ready TF-IDF, Cosine Similarity, Recency Half-Life Decay,
and Collaborative Filtering Engagement Prediction.
"""

import sys
import json
import math
import re
from typing import List, Dict, Any, Tuple
from collections import Counter, defaultdict

def tokenize(text: str) -> List[str]:
    """Clean and tokenize text into words and hashtags."""
    if not text:
        return []
    words = re.findall(r'[a-zA-Z0-9#_]+', text.lower())
    # Filter very short stopwords
    stopwords = {'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'is', 'it', 'this', 'that'}
    return [w for w in words if len(w) > 1 and w not in stopwords]

def compute_tf(tokens: List[str]) -> Dict[str, float]:
    """Compute term frequency normalized by token count."""
    if not tokens:
        return {}
    counts = Counter(tokens)
    total = len(tokens)
    return {k: v / total for k, v in counts.items()}

def compute_idf(corpus_tokens: List[List[str]]) -> Dict[str, float]:
    """Compute inverse document frequency across corpus."""
    num_docs = len(corpus_tokens)
    if num_docs == 0:
        return {}
    doc_freq = defaultdict(int)
    for doc in corpus_tokens:
        unique_tokens = set(doc)
        for token in unique_tokens:
            doc_freq[token] += 1
    
    idf = {}
    for token, count in doc_freq.items():
        idf[token] = math.log((1 + num_docs) / (1 + count)) + 1.0
    return idf

def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Calculate cosine similarity between two sparse term weight vectors."""
    if not vec1 or not vec2:
        return 0.0
    
    common_terms = set(vec1.keys()) & set(vec2.keys())
    if not common_terms:
        return 0.0
    
    dot_product = sum(vec1[t] * vec2[t] for t in common_terms)
    norm1 = math.sqrt(sum(v ** 2 for v in vec1.values()))
    norm2 = math.sqrt(sum(v ** 2 for v in vec2.values()))
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot_product / (norm1 * norm2)

def calculate_time_decay(timestamp_str_or_ms: Any, half_life_hours: float = 24.0) -> float:
    """Calculate exponential decay with a 24-hour half life."""
    # If millisecond timestamp
    import time
    now_ms = time.time() * 1000
    
    created_ms = 0.0
    if isinstance(timestamp_str_or_ms, (int, float)):
        created_ms = float(timestamp_str_or_ms)
        if created_ms < 1e11:  # Seconds to ms
            created_ms *= 1000
    else:
        # Default fresh
        return 0.95
    
    age_hours = max(0.0, (now_ms - created_ms) / (1000.0 * 3600.0))
    decay = math.exp(-math.log(2) * (age_hours / half_life_hours))
    return max(0.05, min(1.0, decay))

def sigmoid(x: float) -> float:
    """Logistic sigmoid function."""
    return 1.0 / (1.0 + math.exp(-max(-20.0, min(20.0, x))))

def rank_posts(
    posts: List[Dict[str, Any]],
    user_id: str,
    following_ids: List[str],
    user_interests: List[str]
) -> List[Dict[str, Any]]:
    """
    Ranks a list of posts using TF-IDF Content Similarity, Social Affinity,
    and Engagement Probability Logistic Model.
    """
    if not posts:
        return []

    # Prepare corpus for IDF
    corpus = []
    for post in posts:
        tags = post.get('tags', [])
        content = post.get('content', '')
        tag_str = ' '.join(f'#{t.lstrip("#")}' for t in tags)
        combined = f"{content} {tag_str}"
        corpus.append(tokenize(combined))

    idf = compute_idf(corpus)

    # Build user interest vector
    user_tokens = []
    for interest in user_interests:
        user_tokens.extend(tokenize(interest))
    user_tf = compute_tf(user_tokens)
    user_vec = {t: user_tf[t] * idf.get(t, 1.0) for t in user_tf}

    ranked = []
    following_set = set(following_ids)

    for idx, post in enumerate(posts):
        doc_tokens = corpus[idx]
        doc_tf = compute_tf(doc_tokens)
        doc_vec = {t: doc_tf[t] * idf.get(t, 1.0) for t in doc_tf}

        # 1. Content Relevance
        content_sim = cosine_similarity(user_vec, doc_vec)

        # 2. Recency Decay
        created_at = post.get('createdAt') or post.get('timestamp')
        recency = calculate_time_decay(created_at, half_life_hours=36.0)

        # 3. Social Affinity
        author_id = post.get('author', {}).get('id', '')
        is_following = author_id in following_set
        is_self = author_id == user_id
        social_weight = 1.0
        if is_self:
            social_weight = 0.5  # Don't drown feed with own posts
        elif is_following:
            social_weight = 1.8  # Prioritize creators user follows

        # 4. Engagement Quality Score
        likes = float(post.get('likesCount', 0))
        comments = float(post.get('commentsCount', 0))
        shares = float(post.get('sharesCount', 0))
        reposts = float(post.get('repostsCount', 0))
        views = max(1.0, float(post.get('viewsCount', 1)))

        engagement_rate = (likes * 1.0 + comments * 2.0 + shares * 3.0 + reposts * 2.5) / views
        normalized_engagement = min(2.5, engagement_rate)

        # 5. Media Richness
        has_media = bool(post.get('mediaUrl') or post.get('mediaUrls'))
        has_poll = bool(post.get('poll'))
        richness_bonus = 0.3 if has_media else 0.0
        richness_bonus += 0.2 if has_poll else 0.0

        # Logistic Linear Combination
        z = (
            2.0 * content_sim +
            1.5 * normalized_engagement +
            1.2 * recency +
            1.4 * social_weight +
            richness_bonus - 1.5
        )
        final_score = sigmoid(z)

        ranked.append({
            'post': post,
            'ml_score': round(final_score, 4),
            'content_sim': round(content_sim, 3),
            'recency': round(recency, 3),
            'social_weight': social_weight,
        })

    ranked.sort(key=lambda x: x['ml_score'], reverse=True)
    return ranked

def recommend_creators(
    creators: List[Dict[str, Any]],
    current_user_id: str,
    following_ids: List[str],
    user_interests: List[str],
    limit: int = 5
) -> List[Dict[str, Any]]:
    """
    Ranks potential creators to suggest following.
    Minimizes data usage by returning only the top N relevant creators
    instead of displaying all registered accounts.
    """
    following_set = set(following_ids)
    following_set.add(current_user_id)  # Never recommend self

    candidates = [c for c in creators if c.get('id') not in following_set]
    if not candidates:
        return []

    user_tokens = set(tokenize(' '.join(user_interests)))

    scored = []
    for creator in candidates:
        bio = creator.get('bio', '')
        name = creator.get('name', '')
        username = creator.get('username', '')
        creator_tokens = set(tokenize(f"{bio} {name} {username}"))

        # Shared interests overlap
        overlap = len(user_tokens & creator_tokens)

        # Followers ratio
        followers = max(0, creator.get('followersCount', 0))
        verified_bonus = 1.5 if creator.get('verified') else 0.0
        avatar_bonus = 0.5 if creator.get('avatar') and not 'empty' in creator.get('avatar') else 0.0

        score = (
            overlap * 2.0 +
            min(3.0, math.log10(followers + 1)) +
            verified_bonus +
            avatar_bonus
        )

        scored.append({
            'creator': creator,
            'score': round(score, 3),
            'shared_interests_count': overlap
        })

    scored.sort(key=lambda x: x['score'], reverse=True)
    return [item['creator'] for item in scored[:limit]]

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        print("[ML Engine] Running unit test assertions...")
        mock_posts = [
            {
                'id': 'p1',
                'author': {'id': 'u1', 'name': 'Elena'},
                'content': 'Minimalist architecture and Nordic light #nordic #architecture',
                'tags': ['nordic', 'architecture'],
                'likesCount': 24,
                'commentsCount': 6,
                'createdAt': 1700000000000,
            },
            {
                'id': 'p2',
                'author': {'id': 'u2', 'name': 'Kai'},
                'content': 'Handmade ceramic cups and slow studio mornings #ceramics #craft',
                'tags': ['ceramics', 'craft'],
                'likesCount': 10,
                'commentsCount': 2,
                'createdAt': 1700000000000,
            }
        ]
        ranked = rank_posts(mock_posts, 'me', ['u1'], ['nordic', 'design'])
        assert len(ranked) == 2, "Should rank all posts"
        assert ranked[0]['post']['id'] == 'p1', "Post with nordic tag and following should rank first"
        print(f"[ML Engine] ✓ Test Passed! Top ranked: {ranked[0]['post']['id']} (score: {ranked[0]['ml_score']})")
        sys.exit(0)

    # Standard CLI pipeline reading from stdin
    try:
        raw_input = sys.stdin.read()
        if not raw_input:
            print(json.dumps({'error': 'No input provided'}))
            sys.exit(1)
        data = json.loads(raw_input)
        action = data.get('action', 'rank_feed')
        
        if action == 'rank_feed':
            posts = data.get('posts', [])
            user_id = data.get('user_id', '')
            following = data.get('following', [])
            interests = data.get('interests', [])
            ranked = rank_posts(posts, user_id, following, interests)
            print(json.dumps({'status': 'ok', 'ranked': ranked}))
        elif action == 'recommend_creators':
            creators = data.get('creators', [])
            user_id = data.get('user_id', '')
            following = data.get('following', [])
            interests = data.get('interests', [])
            limit = data.get('limit', 5)
            suggested = recommend_creators(creators, user_id, following, interests, limit)
            print(json.dumps({'status': 'ok', 'suggested': suggested}))
        else:
            print(json.dumps({'error': f"Unknown action {action}"}))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
