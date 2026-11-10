import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { MarketplaceItem, SponsoredAd, User } from '../types';

const MARKETPLACE_COLLECTION = 'marketplace_items';
const SPONSORED_ADS_COLLECTION = 'sponsored_ads';

// Initial curated seed marketplace products
const SEED_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'item_fuji_x100',
    title: 'Fujifilm X100V Silver Edition',
    description: 'Pristine condition, shutter count only 2,400. Includes lens hood, two original batteries, and leather case. Perfect for street photography and mindful travel.',
    price: 1450000,
    currency: 'RWF',
    category: 'Tech',
    condition: 'Like New',
    images: [
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=80',
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1000&q=80',
    ],
    seller: {
      id: 'seller_cedric',
      name: 'Cédric Mugabe',
      username: 'cedric_visuals',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bio: 'Documentary visual artist and slow living advocate.',
      joinedDate: 'Joined March 2024',
      followersCount: 1420,
      followingCount: 310,
      verified: true,
      verifiedBadgeType: 'blue',
    },
    location: 'Kigali, Kiyovu',
    createdAt: Date.now() - 3600000 * 24,
    isSold: false,
    tags: ['photography', 'camera', 'fujifilm', 'art'],
    contactPhone: '+250 788 123 456',
    viewsCount: 238,
  },
  {
    id: 'item_nordic_chair',
    title: 'Handcrafted Solid White Oak Armchair',
    description: 'Custom Scandinavian lounge chair made from sustainably sourced white oak and natural Belgian linen upholstery. Ergonomically sculpted for quiet reading nooks.',
    price: 320000,
    currency: 'RWF',
    category: 'Home',
    condition: 'Brand New',
    images: [
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1000&q=80',
    ],
    seller: {
      id: 'seller_elise',
      name: 'Elise Uwase',
      username: 'atelier_elise',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      bio: 'Architectural woodworker and minimalist interior maker.',
      joinedDate: 'Joined January 2024',
      followersCount: 3890,
      followingCount: 420,
      verified: true,
      verifiedBadgeType: 'blue',
    },
    location: 'Kigali, Kimihurura',
    createdAt: Date.now() - 3600000 * 48,
    isSold: false,
    tags: ['furniture', 'woodworking', 'interior', 'craft'],
    contactPhone: '+250 789 987 654',
    viewsCount: 512,
  },
  {
    id: 'item_linen_kimono',
    title: 'Raw French Linen Robe / Haori Coat',
    description: 'Heavyweight organic stone-washed linen coat in Moss Green. Hand-stitched seams, French closures, unisex tailored fit. Breathable and timeless.',
    price: 85000,
    currency: 'RWF',
    category: 'Fashion',
    condition: 'Brand New',
    images: [
      'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1000&q=80',
    ],
    seller: {
      id: 'seller_chloe',
      name: 'Chloé Ishimwe',
      username: 'chloe_slowtextiles',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      bio: 'Textile artisan and sustainable slow fashion designer.',
      joinedDate: 'Joined February 2024',
      followersCount: 2190,
      followingCount: 195,
      verified: true,
      verifiedBadgeType: 'blue',
    },
    location: 'Kigali, Gacuriro',
    createdAt: Date.now() - 3600000 * 12,
    isSold: false,
    tags: ['linen', 'slowfashion', 'apparel', 'natural'],
    contactPhone: '+250 782 555 111',
    viewsCount: 184,
  },
  {
    id: 'item_coffee_roaster',
    title: 'Acaia Lunar Precision Espresso Scale',
    description: 'Industrial-grade espresso scale with flow-rate indicator and Bluetooth telemetry. Minimal usage, calibrated with certificate and original box.',
    price: 210000,
    currency: 'RWF',
    category: 'Tech',
    condition: 'Like New',
    images: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1000&q=80',
    ],
    seller: {
      id: 'seller_cedric',
      name: 'Cédric Mugabe',
      username: 'cedric_visuals',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bio: 'Documentary visual artist and slow living advocate.',
      joinedDate: 'Joined March 2024',
      followersCount: 1420,
      followingCount: 310,
      verified: true,
      verifiedBadgeType: 'blue',
    },
    location: 'Kigali, Kacyiru',
    createdAt: Date.now() - 3600000 * 6,
    isSold: false,
    tags: ['coffee', 'specialtycoffee', 'espresso', 'kitchen'],
    contactPhone: '+250 788 123 456',
    viewsCount: 340,
  },
];

// Initial sponsored ads in feed and story
const SEED_SPONSORED_ADS: SponsoredAd[] = [
  {
    id: 'ad_kyoto_retreat',
    type: 'feed_post',
    title: 'Mindful Sound & Craft Residency 2026',
    description: 'Join an immersive 7-day ceramic and acoustic exploration in the volcanic hills of Musanze. Limited to 12 resident artists.',
    mediaUrl: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    ctaText: 'Reserve Residency',
    ctaUrl: 'https://ducate.app/residency',
    sellerId: 'sponsor_ducate_arts',
    sellerName: 'Ducate Creative Residency',
    sellerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    sellerUsername: 'ducate_residency',
    budget: 80000,
    impressions: 1240,
    clicks: 145,
    status: 'active',
    createdAt: Date.now() - 3600000 * 30,
    targetCategory: 'Services',
  },
  {
    id: 'ad_nordic_audio',
    type: 'story_ad',
    title: 'Handmade Walnut Acoustic Speakers',
    description: 'Studio monitors precision crafted with brass hardware and high-definition ribbon tweeters.',
    mediaUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=1000&q=80',
    mediaType: 'image',
    ctaText: 'Explore Collection',
    ctaUrl: 'https://ducate.app/nordic-audio',
    sellerId: 'seller_elise',
    sellerName: 'Elise Uwase',
    sellerAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    sellerUsername: 'atelier_elise',
    budget: 50000,
    impressions: 890,
    clicks: 98,
    status: 'active',
    createdAt: Date.now() - 3600000 * 18,
    targetCategory: 'Tech',
  },
];

// In-memory cache
let cachedMarketplaceItems: MarketplaceItem[] = [...SEED_MARKETPLACE_ITEMS];
let cachedSponsoredAds: SponsoredAd[] = [...SEED_SPONSORED_ADS];

/**
 * Fetch all marketplace items with optional category filtering
 */
export async function getMarketplaceItems(category?: string): Promise<MarketplaceItem[]> {
  try {
    const collRef = collection(db, MARKETPLACE_COLLECTION);
    const snap = await getDocs(collRef);
    if (!snap.empty) {
      const items: MarketplaceItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as MarketplaceItem));
      items.sort((a, b) => b.createdAt - a.createdAt);
      cachedMarketplaceItems = items;
    }
  } catch (err) {
    console.warn('Marketplace fetch note, using local catalog:', err);
  }

  if (category && category !== 'All') {
    return cachedMarketplaceItems.filter((item) => item.category === category);
  }
  return cachedMarketplaceItems;
}

/**
 * Create a new product listing in the marketplace
 */
export async function createMarketplaceItem(
  itemData: Omit<MarketplaceItem, 'id' | 'createdAt' | 'isSold' | 'seller' | 'viewsCount'>,
  seller: User
): Promise<MarketplaceItem> {
  const itemId = `mkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newItem: MarketplaceItem = {
    ...itemData,
    id: itemId,
    seller,
    createdAt: Date.now(),
    isSold: false,
    viewsCount: 1,
  };

  try {
    const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);
    await setDoc(itemRef, newItem);
  } catch (err) {
    console.warn('Firestore marketplace set note:', err);
  }

  cachedMarketplaceItems = [newItem, ...cachedMarketplaceItems];
  return newItem;
}

/**
 * Mark item as sold
 */
export async function markItemAsSold(itemId: string): Promise<void> {
  cachedMarketplaceItems = cachedMarketplaceItems.map((item) =>
    item.id === itemId ? { ...item, isSold: true } : item
  );
  try {
    const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);
    await updateDoc(itemRef, { isSold: true });
  } catch (err) {
    console.warn('Firestore update sold note:', err);
  }
}

/**
 * Fetch active sponsored ads for feed or stories
 */
export async function getActiveAds(placement: 'feed_post' | 'story_ad'): Promise<SponsoredAd[]> {
  try {
    const collRef = collection(db, SPONSORED_ADS_COLLECTION);
    const q = query(collRef, where('type', '==', placement), where('status', '==', 'active'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const ads: SponsoredAd[] = [];
      snap.forEach((d) => ads.push({ id: d.id, ...d.data() } as SponsoredAd));
      cachedSponsoredAds = ads;
    }
  } catch (err) {
    console.warn('Sponsored ads fetch note, using local ads:', err);
  }

  return cachedSponsoredAds.filter((ad) => ad.type === placement && ad.status === 'active');
}

/**
 * Create a new sponsored advertisement
 */
export async function createSponsoredAd(
  adData: Omit<SponsoredAd, 'id' | 'impressions' | 'clicks' | 'createdAt' | 'status'>,
  user: User
): Promise<SponsoredAd> {
  const adId = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newAd: SponsoredAd = {
    ...adData,
    id: adId,
    sellerId: user.id,
    sellerName: user.name,
    sellerAvatar: user.avatar,
    sellerUsername: user.username,
    impressions: 1,
    clicks: 0,
    status: 'active',
    createdAt: Date.now(),
  };

  try {
    const adRef = doc(db, SPONSORED_ADS_COLLECTION, adId);
    await setDoc(adRef, newAd);
  } catch (err) {
    console.warn('Firestore create ad note:', err);
  }

  cachedSponsoredAds = [newAd, ...cachedSponsoredAds];
  return newAd;
}

/**
 * Record an impression for an ad
 */
export async function recordAdImpression(adId: string): Promise<void> {
  cachedSponsoredAds = cachedSponsoredAds.map((ad) =>
    ad.id === adId ? { ...ad, impressions: ad.impressions + 1 } : ad
  );
  try {
    const adRef = doc(db, SPONSORED_ADS_COLLECTION, adId);
    await updateDoc(adRef, { impressions: increment(1) });
  } catch {}
}

/**
 * Record a click for an ad
 */
export async function recordAdClick(adId: string): Promise<void> {
  cachedSponsoredAds = cachedSponsoredAds.map((ad) =>
    ad.id === adId ? { ...ad, clicks: ad.clicks + 1 } : ad
  );
  try {
    const adRef = doc(db, SPONSORED_ADS_COLLECTION, adId);
    await updateDoc(adRef, { clicks: increment(1) });
  } catch {}
}
