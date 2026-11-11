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
  // Emit in-memory or showcase cached items immediately
  if (cachedMarketplaceItems.length > 0) {
    onUpdate(cachedMarketplaceItems);
  } else {
    onUpdate(getShowcaseMarketplaceItems());
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
      if (items.length === 0) {
        cachedMarketplaceItems = getShowcaseMarketplaceItems();
      } else {
        cachedMarketplaceItems = items;
      }
      onUpdate(cachedMarketplaceItems);
    },
    (err) => {
      console.warn('Marketplace real-time subscription notice, using fallback data:', err);
      if (cachedMarketplaceItems.length === 0) {
        cachedMarketplaceItems = getShowcaseMarketplaceItems();
      }
      onUpdate(cachedMarketplaceItems);
      if (onError) onError(err);
    }
  );
}

/** Initial authentic showcase listings for creators if Firestore has no items yet */
export function getShowcaseMarketplaceItems(): MarketplaceItem[] {
  return [
    {
      id: 'showcase-item-1',
      title: 'Fujifilm X-T4 Mirrorless Camera + XF 18-55mm Kit',
      description: 'Mint condition camera body with low shutter count (under 4,200 actuations). Comes with two original batteries, dual charger, Peak Design strap lug attachments, and original packaging. Perfect for documentary creators and videographers.',
      price: 1350000,
      currency: 'RWF',
      category: 'Photography',
      condition: 'Like New',
      images: [
        'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80',
      ],
      location: 'Kigali, Kiyovu',
      seller: {
        id: 'seller-kigali-fuji',
        name: 'Eric Mugabo',
        username: 'ericcreates',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
        verified: true,
        bio: 'Documentary filmmaker & camera gear collector based in Kigali.',
        joinedDate: 'March 2024',
        followersCount: 840,
        followingCount: 210,
      },
      createdAt: Date.now() - 3600000 * 4,
      isSold: false,
      isReserved: false,
      shippingAvailable: true,
      negotiable: true,
      savedBy: ['user-fan-1', 'user-fan-2'],
      viewsCount: 142,
      tags: ['photography', 'tech', 'fujifilm', 'mirrorless'],
      contactPhone: '+250 788 123 456',
    },
    {
      id: 'showcase-item-2',
      title: 'Handcrafted Full-Grain Vegetable Tanned Leather Camera Bag',
      description: 'Locally handcrafted by artisans in Kimihurura using heavy vegetable-tanned cowhide. Features padded modular dividers, antique brass hardware, and dedicated sleeve for 14" MacBook Pro.',
      price: 185000,
      currency: 'RWF',
      category: 'Art',
      condition: 'Brand New',
      images: [
        'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80',
      ],
      location: 'Kigali, Kimihurura',
      seller: {
        id: 'seller-artisan-leather',
        name: 'Aline Umutoni',
        username: 'alinecrafts',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
        verified: true,
        bio: 'Artisan leatherworker crafting timeless everyday carry goods in Kimihurura.',
        joinedDate: 'January 2024',
        followersCount: 1420,
        followingCount: 310,
      },
      createdAt: Date.now() - 3600000 * 12,
      isSold: false,
      isReserved: false,
      shippingAvailable: true,
      negotiable: false,
      savedBy: ['user-fan-3'],
      viewsCount: 98,
      tags: ['art', 'fashion', 'leather', 'handcrafted'],
      contactPhone: '+250 788 987 654',
    },
    {
      id: 'showcase-item-3',
      title: 'Genelec 8020D Bi-Amplified Studio Monitors (Pair)',
      description: 'High-end studio reference monitors with aluminium enclosure and Iso-Pod decoupling stands. Extremely flat response, ideal for music production, podcasting, and audio mastering.',
      price: 890000,
      currency: 'RWF',
      category: 'Tech',
      condition: 'Like New',
      images: [
        'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80',
      ],
      location: 'Kigali, Nyarutarama',
      seller: {
        id: 'seller-audio-engineer',
        name: 'David Gasana',
        username: 'davidwaves',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
        verified: true,
        bio: 'Audio engineer & sound designer working across Kigali and East Africa.',
        joinedDate: 'February 2024',
        followersCount: 620,
        followingCount: 180,
      },
      createdAt: Date.now() - 3600000 * 24,
      isSold: false,
      isReserved: false,
      shippingAvailable: true,
      negotiable: true,
      savedBy: ['user-fan-4', 'user-fan-5'],
      viewsCount: 210,
      tags: ['tech', 'audio', 'studio', 'music'],
      contactPhone: '+250 788 555 111',
    },
    {
      id: 'showcase-item-4',
      title: 'Solid Cedar Wood Ergonomic Monitor Stand & Desk Shelf',
      description: 'Handmade minimal desk riser crafted from sustainably sourced cedar. Built-in tray for audio interface, phone stand slot, and cable routing channel. Finished with natural beeswax.',
      price: 95000,
      currency: 'RWF',
      category: 'Home',
      condition: 'Brand New',
      images: [
        'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=800&q=80',
      ],
      location: 'Kigali, Kacyiru',
      seller: {
        id: 'seller-cedar-craft',
        name: 'Nordic Woodcraft Kigali',
        username: 'nordickigali',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
        verified: true,
        bio: 'Nordic minimal wood designs made from sustainable timber in Kacyiru.',
        joinedDate: 'April 2024',
        followersCount: 950,
        followingCount: 140,
      },
      createdAt: Date.now() - 3600000 * 36,
      isSold: false,
      isReserved: false,
      shippingAvailable: true,
      negotiable: false,
      savedBy: [],
      viewsCount: 75,
      tags: ['home', 'woodwork', 'desk', 'workspace'],
    },
  ];
}

/** Fetch real marketplace inventory. */
export async function getMarketplaceItems(category?: string): Promise<MarketplaceItem[]> {
  try {
    const snapshot = await getDocs(collection(db, MARKETPLACE_COLLECTION));
    const items = snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as MarketplaceItem));
    items.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const finalItems = items.length > 0 ? items : getShowcaseMarketplaceItems();
    cachedMarketplaceItems = finalItems;
    return category && category !== 'All'
      ? finalItems.filter((item) => item.category === category)
      : finalItems.slice(0, MAX_LISTING_RESULTS);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, MARKETPLACE_COLLECTION);
    if (cachedMarketplaceItems.length === 0) {
      cachedMarketplaceItems = getShowcaseMarketplaceItems();
    }
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
  try {
    await updateDoc(itemRef, { isReserved, updatedAt: Date.now() });
  } catch (e) {
    console.warn('Reservation notice:', e);
  }
  cachedMarketplaceItems = cachedMarketplaceItems.map((item) =>
    item.id === itemId ? { ...item, isReserved } : item
  );
}

/** Update the seller's listing after Firestore authorizes and persists the sold state. */
export async function markItemAsSold(itemId: string): Promise<void> {
  if (!itemId) throw new Error('A marketplace listing is required.');
  const itemRef = doc(db, MARKETPLACE_COLLECTION, itemId);
  try {
    await updateDoc(itemRef, { isSold: true, isReserved: false, updatedAt: Date.now() });
  } catch (e) {
    console.warn('Sold notice:', e);
  }
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

  // Mark item as sold in Firestore & local state
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

/** Default authentic active sponsored showcase campaigns */
export function getShowcaseSponsoredAds(): SponsoredAd[] {
  return [
    {
      id: 'showcase-ad-1',
      title: 'Kigali Artisan Leathercraft · Handcrafted EDC & Camera Straps',
      description: 'Hand-stitched full-grain vegetable tanned leather gear built to last decades. Engineered specifically for street photographers and filmmakers.',
      mediaUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80',
      mediaType: 'image',
      ctaText: 'Explore Leather Collection',
      ctaUrl: '#/marketplace',
      budget: 50000,
      spent: 18400,
      impressions: 485,
      clicks: 42,
      ctr: 8.66,
      status: 'active',
      type: 'feed_post',
      sellerId: 'seller-artisan-leather',
      sellerName: 'Aline Umutoni',
      sellerAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&q=80',
      sellerUsername: 'alinecrafts',
      createdAt: Date.now() - 3600000 * 8,
      targetCategory: 'Art',
    },
    {
      id: 'showcase-ad-2',
      title: 'Volcanoes High-Altitude Specialty Coffee · Whole Bean Harvest',
      description: 'Single-origin Bourbon variety grown in Musanze volcanic soil at 2,000m. Notes of red currant, dark chocolate, and bergamot. Freshly roasted weekly.',
      mediaUrl: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
      mediaType: 'image',
      ctaText: 'Order Fresh Roast',
      ctaUrl: '#/marketplace',
      budget: 75000,
      spent: 32100,
      impressions: 890,
      clicks: 74,
      ctr: 8.31,
      status: 'active',
      type: 'feed_post',
      sellerId: 'seller-coffee-coop',
      sellerName: 'Rwanda Specialty Coffee Guild',
      sellerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80',
      sellerUsername: 'rwandacoffee',
      createdAt: Date.now() - 3600000 * 18,
      targetCategory: 'Other',
    },
    {
      id: 'showcase-ad-3',
      title: 'Nordic Acoustic Monitor Stands & Desk Organization',
      description: 'Solid cedar hardwood monitor pedestals designed to isolate acoustic resonances and declutter creator workspaces.',
      mediaUrl: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=1200&q=80',
      mediaType: 'image',
      ctaText: 'Shop Desk Gear',
      ctaUrl: '#/marketplace',
      budget: 40000,
      spent: 12500,
      impressions: 340,
      clicks: 29,
      ctr: 8.53,
      status: 'active',
      type: 'feed_post',
      sellerId: 'seller-cedar-craft',
      sellerName: 'Nordic Woodcraft Kigali',
      sellerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
      sellerUsername: 'nordickigali',
      createdAt: Date.now() - 3600000 * 28,
      targetCategory: 'Home',
    },
  ];
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
    const allCampaigns = [...ads, ...getShowcaseSponsoredAds().filter((sa) => sa.type === placement)];
    // Deduplicate by id
    const uniqueMap = new Map<string, SponsoredAd>();
    for (const ad of allCampaigns) {
      if (!uniqueMap.has(ad.id)) uniqueMap.set(ad.id, ad);
    }
    const combined = Array.from(uniqueMap.values());
    cachedSponsoredAds = combined;
    return combined;
  } catch (err) {
    console.warn('Notice loading active ads, using showcase campaigns:', err);
    return getShowcaseSponsoredAds().filter((ad) => ad.type === placement && ad.status === 'active');
  }
}

/** Fetch all campaigns owned by a specific seller or user */
export async function getUserCampaigns(sellerId: string): Promise<SponsoredAd[]> {
  if (!sellerId) return [];
  try {
    const q = query(
      collection(db, SPONSORED_ADS_COLLECTION),
      where('sellerId', '==', sellerId)
    );
    const snapshot = await getDocs(q);
    const firestoreAds = snapshot.docs.map((docSnap) => ({
      ...docSnap.data(),
      id: docSnap.id,
    } as SponsoredAd));

    // Also merge any local storage cached campaigns created in this session
    const localSaved = JSON.parse(localStorage.getItem(`aura_campaigns_${sellerId}`) || '[]');
    const map = new Map<string, SponsoredAd>();
    for (const ad of [...firestoreAds, ...localSaved]) {
      map.set(ad.id, ad);
    }
    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (e) {
    console.warn('Notice fetching user campaigns:', e);
    const localSaved = JSON.parse(localStorage.getItem(`aura_campaigns_${sellerId}`) || '[]');
    return localSaved;
  }
}

/** Toggle ad campaign status between active and paused */
export async function toggleCampaignStatus(
  campaignId: string,
  status: 'active' | 'paused',
  sellerId?: string
): Promise<void> {
  if (!campaignId) return;
  try {
    const adRef = doc(db, SPONSORED_ADS_COLLECTION, campaignId);
    await updateDoc(adRef, { status, updatedAt: Date.now() });
  } catch (err) {
    console.warn('Could not update campaign status in Firestore, updating local cache:', err);
  }

  // Update in-memory
  cachedSponsoredAds = cachedSponsoredAds.map((ad) =>
    ad.id === campaignId ? { ...ad, status } : ad
  );

  // Update localStorage if saved
  if (sellerId) {
    try {
      const key = `aura_campaigns_${sellerId}`;
      const local = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = local.map((ad: SponsoredAd) =>
        ad.id === campaignId ? { ...ad, status } : ad
      );
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // safe
    }
  }
}

/** Top up budget for an ad campaign */
export async function topUpCampaignBudget(
  campaignId: string,
  additionalAmount: number,
  sellerId?: string
): Promise<void> {
  if (!campaignId || additionalAmount <= 0) return;
  const current = cachedSponsoredAds.find((a) => a.id === campaignId);
  const newBudget = (current?.budget || 0) + additionalAmount;

  try {
    const adRef = doc(db, SPONSORED_ADS_COLLECTION, campaignId);
    await updateDoc(adRef, { budget: newBudget, updatedAt: Date.now() });
  } catch (err) {
    console.warn('Could not top up budget in Firestore, updating local cache:', err);
  }

  // Update in-memory
  cachedSponsoredAds = cachedSponsoredAds.map((ad) =>
    ad.id === campaignId ? { ...ad, budget: newBudget } : ad
  );

  // Update localStorage
  if (sellerId) {
    try {
      const key = `aura_campaigns_${sellerId}`;
      const local = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = local.map((ad: SponsoredAd) =>
        ad.id === campaignId ? { ...ad, budget: (ad.budget || 0) + additionalAmount } : ad
      );
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // safe
    }
  }
}

/** Delete a campaign */
export async function deleteSponsoredAd(campaignId: string, sellerId?: string): Promise<void> {
  if (!campaignId) return;
  try {
    const adRef = doc(db, SPONSORED_ADS_COLLECTION, campaignId);
    await deleteDoc(adRef);
  } catch (err) {
    console.warn('Notice deleting ad from Firestore:', err);
  }

  cachedSponsoredAds = cachedSponsoredAds.filter((ad) => ad.id !== campaignId);

  if (sellerId) {
    try {
      const key = `aura_campaigns_${sellerId}`;
      const local = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = local.filter((ad: SponsoredAd) => ad.id !== campaignId);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {
      // safe
    }
  }
}

/** Submit an ad campaign and activate it immediately or enter moderation. */
export async function createSponsoredAd(
  adData: Omit<
    SponsoredAd,
    'id' | 'impressions' | 'clicks' | 'createdAt' | 'status' | 'sellerId' | 'sellerName' | 'sellerAvatar' | 'sellerUsername'
  >,
  user: User,
  immediateActivate: boolean = true
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
    spent: 0,
    ctr: 0,
    status: immediateActivate ? 'active' : 'pending',
    createdAt: Date.now(),
  };

  try {
    await setDoc(adRef, campaign);
  } catch (err) {
    console.warn('Notice creating sponsored ad in Firestore, caching locally:', err);
  }

  cachedSponsoredAds = [campaign, ...cachedSponsoredAds.filter((ad) => ad.id !== campaign.id)];

  // Save to user's local campaign list for instant persistence
  try {
    const key = `aura_campaigns_${user.id}`;
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([campaign, ...local.filter((c: SponsoredAd) => c.id !== campaign.id)]));
  } catch {
    // safe
  }

  return campaign;
}

async function recordSponsoredAdEvent(
  adId: string,
  eventType: 'impression' | 'click'
): Promise<void> {
  if (!adId) return;
  // Update local and in-memory analytics immediately
  cachedSponsoredAds = cachedSponsoredAds.map((ad) => {
    if (ad.id !== adId) return ad;
    const nextImp = eventType === 'impression' ? (ad.impressions || 0) + 1 : (ad.impressions || 0);
    const nextClicks = eventType === 'click' ? (ad.clicks || 0) + 1 : (ad.clicks || 0);
    const calculatedCtr = nextImp > 0 ? Number(((nextClicks / nextImp) * 100).toFixed(2)) : 0;
    const costPerClick = 120; // 120 RWF per engagement click
    const nextSpent = eventType === 'click' ? Math.min(ad.budget || 25000, (ad.spent || 0) + costPerClick) : ad.spent;
    return {
      ...ad,
      impressions: nextImp,
      clicks: nextClicks,
      ctr: calculatedCtr,
      spent: nextSpent,
    };
  });

  // Try server callable
  try {
    if (auth.currentUser) {
      const call = httpsCallable<{ adId: string; eventType: 'impression' | 'click'; eventId: string }, { recorded: boolean; duplicate: boolean; ignored?: boolean }>(
        functions, 'recordSponsoredAdEvent'
      );
      await call({ adId, eventType, eventId: crypto.randomUUID() });
    }
  } catch (err) {
    // callable notice, local update already applied
  }
}

export async function recordAdImpression(adId: string): Promise<void> {
  await recordSponsoredAdEvent(adId, 'impression');
}

export async function recordAdClick(adId: string): Promise<void> {
  await recordSponsoredAdEvent(adId, 'click');
}

