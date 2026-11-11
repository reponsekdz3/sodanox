import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';
import { MarketplaceItem, SponsoredAd, User } from '../types';
import { handleFirestoreError, OperationType } from '../firebase/errorHandler';

const MARKETPLACE_COLLECTION = 'marketplace_items';
const SPONSORED_ADS_COLLECTION = 'sponsored_ads';
const LOCAL_STORAGE_SAVED_KEY = 'aura_marketplace_saved_items';
const MAX_LISTING_RESULTS = 150;

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

/** Real-time subscription to marketplace items with offline / local cache fallback */
export function subscribeToMarketplaceItems(
  onUpdate: (items: MarketplaceItem[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  // Emit in-memory cached items immediately
  if (cachedMarketplaceItems.length > 0) {
    onUpdate(cachedMarketplaceItems);
  }

  const itemsRef = collection(db, MARKETPLACE_COLLECTION);
  return onSnapshot(
    itemsRef,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        ...docSnap.data(),
        id: docSnap.id,
      } as MarketplaceItem));
      items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      cachedMarketplaceItems = items;
      onUpdate(items);
    },
    (err) => {
      console.warn('Marketplace real-time subscription error, using cached data:', err);
      if (cachedMarketplaceItems.length > 0) {
        onUpdate(cachedMarketplaceItems);
      }
      if (onError) onError(err);
    }
  );
}

/** Fetch real marketplace inventory. */
export async function getMarketplaceItems(category?: string): Promise<MarketplaceItem[]> {
  try {
    const snapshot = await getDocs(collection(db, MARKETPLACE_COLLECTION));
    const items = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as MarketplaceItem));
    items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    cachedMarketplaceItems = items;
    return category && category !== 'All'
      ? items.filter((item) => item.category === category)
      : items.slice(0, MAX_LISTING_RESULTS);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, MARKETPLACE_COLLECTION);
    return cachedMarketplaceItems;
  }
}

/** Create a listing after verifying constraints. */
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
    isReserved: false,
    shippingAvailable: itemData.shippingAvailable ?? true,
    negotiable: itemData.negotiable ?? false,
    savedBy: [],
    viewsCount: 0,
    tags: itemData.tags || [itemData.category.toLowerCase(), 'marketplace'],
  };

  try {
    await setDoc(itemRef, listing);
    cachedMarketplaceItems = [listing, ...cachedMarketplaceItems.filter((item) => item.id !== listing.id)];
    return listing;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `${MARKETPLACE_COLLECTION}/${itemRef.id}`);
    throw err;
  }
}

/** Update an existing marketplace listing (by owner or admin) */
export async function updateMarketplaceItem(
  itemId: string,
  updates: Partial<Omit<MarketplaceItem, 'id' | 'seller' | 'createdAt' | 'viewsCount'>>,
  currentUser: User
): Promise<void> {
  if (!itemId) throw new Error('A listing ID is required.');
  const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);

  try {
    const payload = {
      ...updates,
      updatedAt: Date.now(),
    };
    await updateDoc(itemRef, payload);
    cachedMarketplaceItems = cachedMarketplaceItems.map((item) =>
      item.id === itemId ? { ...item, ...payload } : item
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${MARKETPLACE_COLLECTION}/${itemId}`);
    throw err;
  }
}

/** Delete a listing from Firestore */
export async function deleteMarketplaceItem(itemId: string, currentUser: User): Promise<void> {
  if (!itemId) throw new Error('A listing ID is required.');
  const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);

  try {
    await deleteDoc(itemRef);
    cachedMarketplaceItems = cachedMarketplaceItems.filter((item) => item.id !== itemId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${MARKETPLACE_COLLECTION}/${itemId}`);
    throw err;
  }
}

/** Toggle item as saved/wishlisted by the current user */
export async function toggleSaveMarketplaceItem(itemId: string, userId: string): Promise<boolean> {
  if (!itemId || !userId) return false;
  const item = cachedMarketplaceItems.find((i) => i.id === itemId);
  const currentlySaved = item?.savedBy?.includes(userId) ?? false;
  const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);

  try {
    if (currentlySaved) {
      await updateDoc(itemRef, {
        savedBy: arrayRemove(userId),
      });
      cachedMarketplaceItems = cachedMarketplaceItems.map((i) =>
        i.id === itemId ? { ...i, savedBy: (i.savedBy || []).filter((id) => id !== userId) } : i
      );
      return false;
    } else {
      await updateDoc(itemRef, {
        savedBy: arrayUnion(userId),
      });
      cachedMarketplaceItems = cachedMarketplaceItems.map((i) =>
        i.id === itemId ? { ...i, savedBy: [...(i.savedBy || []), userId] } : i
      );
      return true;
    }
  } catch (err) {
    // If permission or network error, fallback to local storage
    console.warn('Could not persist wishlist to Firestore, caching locally:', err);
    try {
      const stored = JSON.parse(localStorage.getItem(LOCAL_STORAGE_SAVED_KEY) || '[]');
      const nextStored = currentlySaved
        ? stored.filter((id: string) => id !== itemId)
        : [...stored, itemId];
      localStorage.setItem(LOCAL_STORAGE_SAVED_KEY, JSON.stringify(nextStored));
      return !currentlySaved;
    } catch {
      return !currentlySaved;
    }
  }
}

/** Toggle reserve status */
export async function toggleItemReservation(itemId: string, isReserved: boolean): Promise<void> {
  if (!itemId) throw new Error('A marketplace listing is required.');
  const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);
  await updateDoc(itemRef, { isReserved, updatedAt: Date.now() });
  cachedMarketplaceItems = cachedMarketplaceItems.map((item) =>
    item.id === itemId ? { ...item, isReserved } : item
  );
}

/** Update the seller's listing after Firestore authorizes and persists the sold state. */
export async function markItemAsSold(itemId: string): Promise<void> {
  if (!itemId) throw new Error('A marketplace listing is required.');
  const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);
  await updateDoc(itemRef, { isSold: true, isReserved: false, updatedAt: Date.now() });
  cachedMarketplaceItems = cachedMarketplaceItems.map((item) =>
    item.id === itemId ? { ...item, isSold: true, isReserved: false } : item
  );
}

/** Record an order placement and invoice receipt */
export interface MarketplaceOrder {
  orderId: string;
  itemId: string;
  itemTitle: string;
  itemPrice: number;
  currency: string;
  sellerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  deliveryOption: 'shipping' | 'pickup';
  shippingAddress?: string;
  paymentMethod: 'momo' | 'card' | 'cash_on_delivery';
  paymentRef: string;
  createdAt: number;
  status: 'confirmed' | 'dispatched' | 'delivered';
}

export async function processMarketplaceCheckout(
  item: MarketplaceItem,
  buyer: User,
  deliveryOption: 'shipping' | 'pickup',
  paymentMethod: 'momo' | 'card' | 'cash_on_delivery',
  shippingAddress?: string
): Promise<MarketplaceOrder> {
  if (item.isSold) throw new Error('This listing has already been sold.');
  const orderId = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  const paymentRef = 'PAY-' + Math.random().toString(36).substring(2, 10).toUpperCase();

  const order: MarketplaceOrder = {
    orderId,
    itemId: item.id,
    itemTitle: item.title,
    itemPrice: item.price,
    currency: item.currency,
    sellerId: item.seller.id,
    sellerName: item.seller.name,
    buyerId: buyer.id,
    buyerName: buyer.name,
    deliveryOption,
    shippingAddress,
    paymentMethod,
    paymentRef,
    createdAt: Date.now(),
    status: 'confirmed',
  };

  // Mark item as sold in Firestore
  try {
    await markItemAsSold(item.id);
  } catch (e) {
    console.warn('Notice marking sold:', e);
  }

  // Store order in local storage ledger
  try {
    const existingOrders = JSON.parse(localStorage.getItem('aura_marketplace_orders') || '[]');
    localStorage.setItem('aura_marketplace_orders', JSON.stringify([order, ...existingOrders]));
  } catch {
    // safe
  }

  return order;
}

/** Only approved and active server records are eligible to appear as sponsored placements. */
export async function getActiveAds(placement: 'feed_post' | 'story_ad'): Promise<SponsoredAd[]> {
  try {
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
  } catch {
    return cachedSponsoredAds.filter((ad) => ad.type === placement && ad.status === 'active');
  }
}

/** Submit an ad campaign into the moderation queue. */
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
  try {
    const result = await call({ adId, eventType, eventId: crypto.randomUUID() });
    if (!result.data.recorded) return;
    cachedSponsoredAds = cachedSponsoredAds.map((ad) => {
      if (ad.id !== adId) return ad;
      return eventType === 'impression'
        ? { ...ad, impressions: ad.impressions + 1 }
        : { ...ad, clicks: ad.clicks + 1 };
    });
  } catch (err) {
    console.warn('Ad event tracking notice:', err);
  }
}

export async function recordAdImpression(adId: string): Promise<void> {
  await recordSponsoredAdEvent(adId, 'impression');
}

export async function recordAdClick(adId: string): Promise<void> {
  await recordSponsoredAdEvent(adId, 'click');
}
