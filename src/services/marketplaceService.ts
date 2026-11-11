import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';
import { MarketplaceItem, SponsoredAd, User } from '../types';

const MARKETPLACE_COLLECTION = 'marketplace_items';
const SPONSORED_ADS_COLLECTION = 'sponsored_ads';
const MAX_LISTING_RESULTS = 100;

let cachedMarketplaceItems: MarketplaceItem[] = [];
let cachedSponsoredAds: SponsoredAd[] = [];

function requireSeller(seller: User): void {
  if (!seller?.id || !auth.currentUser || auth.currentUser.uid !== seller.id) {
    throw new Error('Sign in with the seller account before publishing a marketplace listing.');
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Fetch real marketplace inventory. An empty Firestore collection is an empty marketplace, not a sample catalog. */
export async function getMarketplaceItems(category?: string): Promise<MarketplaceItem[]> {
  const snapshot = await getDocs(collection(db, MARKETPLACE_COLLECTION));
  const items = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as MarketplaceItem));
  items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  cachedMarketplaceItems = items;
  return category && category !== 'All'
    ? items.filter((item) => item.category === category)
    : items.slice(0, MAX_LISTING_RESULTS);
}

/** Create a listing only after Firebase confirms the authoritative write. */
export async function createMarketplaceItem(
  itemData: Omit<MarketplaceItem, 'id' | 'createdAt' | 'isSold' | 'seller' | 'viewsCount'>,
  seller: User
): Promise<MarketplaceItem> {
  requireSeller(seller);
  const title = itemData.title.trim();
  const images = itemData.images.filter((image) => isHttpUrl(image));
  if (!title || title.length > 120) throw new Error('Enter a product title of 1–120 characters.');
  if (!Number.isSafeInteger(itemData.price) || itemData.price <= 0) throw new Error('Enter a valid price greater than zero.');
  if (images.length === 0 || images.length > 8) throw new Error('Upload at least one valid product photo (up to eight).');
  if (!itemData.location.trim()) throw new Error('Add a location so buyers know where the item is available.');

  const itemRef = doc(collection(db, MARKETPLACE_COLLECTION));
  const listing: MarketplaceItem = {
    ...itemData,
    title,
    images,
    id: itemRef.id,
    seller,
    createdAt: Date.now(),
    isSold: false,
    viewsCount: 0,
  };
  await setDoc(itemRef, listing);
  cachedMarketplaceItems = [listing, ...cachedMarketplaceItems.filter((item) => item.id !== listing.id)];
  return listing;
}

/** Update the seller's listing after Firestore authorizes and persists the sold state. */
export async function markItemAsSold(itemId: string): Promise<void> {
  if (!itemId) throw new Error('A marketplace listing is required.');
  await updateDoc(doc(db, MARKETPLACE_COLLECTION, itemId), { isSold: true, updatedAt: Date.now() });
  cachedMarketplaceItems = cachedMarketplaceItems.map((item) =>
    item.id === itemId ? { ...item, isSold: true } : item
  );
}

/** Only approved and active server records are eligible to appear as sponsored placements. */
export async function getActiveAds(placement: 'feed_post' | 'story_ad'): Promise<SponsoredAd[]> {
  const adsQuery = query(
    collection(db, SPONSORED_ADS_COLLECTION),
    where('type', '==', placement),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(adsQuery);
  const ads = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as SponsoredAd));
  cachedSponsoredAds = [
    ...cachedSponsoredAds.filter((ad) => ad.type !== placement),
    ...ads,
  ];
  return ads;
}

/**
 * Submit an ad campaign into the moderation queue. This does not charge the
 * advertiser and does not activate the placement; billing/approval must happen
 * before an admin can set status='active'.
 */
export async function createSponsoredAd(
  adData: Omit<
    SponsoredAd,
    'id' | 'impressions' | 'clicks' | 'createdAt' | 'status' | 'sellerId' | 'sellerName' | 'sellerAvatar' | 'sellerUsername'
  >,
  user: User
): Promise<SponsoredAd> {
  requireSeller(user);
  const title = adData.title.trim();
  if (!title || title.length > 120) throw new Error('Enter an ad headline of 1–120 characters.');
  if (!isHttpUrl(adData.mediaUrl)) throw new Error('Upload or provide a valid HTTPS media URL for the campaign.');
  if (!Number.isSafeInteger(adData.budget) || adData.budget <= 0) throw new Error('Enter a campaign budget greater than zero.');
  const adRef = doc(collection(db, SPONSORED_ADS_COLLECTION));
  const campaign: SponsoredAd = {
    ...adData,
    title,
    id: adRef.id,
    sellerId: user.id,
    sellerName: user.name,
    sellerAvatar: user.avatar,
    sellerUsername: user.username,
    impressions: 0,
    clicks: 0,
    status: 'pending',
    createdAt: Date.now(),
  };
  await setDoc(adRef, campaign);
  cachedSponsoredAds = [campaign, ...cachedSponsoredAds.filter((ad) => ad.id !== campaign.id)];
  return campaign;
}

async function recordSponsoredAdEvent(
  adId: string,
  eventType: 'impression' | 'click'
): Promise<void> {
  if (!adId) return;
  if (!auth.currentUser) throw new Error('Sign in to record a sponsored placement event.');
  const call = httpsCallable<{ adId: string; eventType: 'impression' | 'click'; eventId: string }, { recorded: boolean; duplicate: boolean; ignored?: boolean }>(
    functions, 'recordSponsoredAdEvent'
  );
  const result = await call({ adId, eventType, eventId: crypto.randomUUID() });
  if (!result.data.recorded) return;
  cachedSponsoredAds = cachedSponsoredAds.map((ad) => {
    if (ad.id !== adId) return ad;
    return eventType === 'impression'
      ? { ...ad, impressions: ad.impressions + 1 }
      : { ...ad, clicks: ad.clicks + 1 };
  });
}

export async function recordAdImpression(adId: string): Promise<void> {
  await recordSponsoredAdEvent(adId, 'impression');
}

export async function recordAdClick(adId: string): Promise<void> {
  await recordSponsoredAdEvent(adId, 'click');
}
