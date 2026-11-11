import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Tag,
  MapPin,
  Phone,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Share2,
  CheckCircle2,
  X,
  Upload,
  Sliders,
  DollarSign,
  TrendingUp,
  Heart,
  Truck,
  RotateCcw,
  Package,
  Layers,
  ArrowUpDown,
  Grid,
  List,
  ChevronRight,
  ShieldCheck,
  Clock,
  Send,
  Pencil,
  Trash2,
  FileText,
  BadgePercent,
  Check,
} from 'lucide-react';
import { MarketplaceItem, SponsoredAd, User } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import {
  subscribeToMarketplaceItems,
  createMarketplaceItem,
  updateMarketplaceItem,
  deleteMarketplaceItem,
  markItemAsSold,
  toggleItemReservation,
  toggleSaveMarketplaceItem,
  processMarketplaceCheckout,
  MarketplaceOrder,
  createSponsoredAd,
} from '../../services/marketplaceService';
import { compressImage, uploadMediaToFirebase } from '../../services/mediaCompressionService';
import { auraAudio } from '../../utils/audioSynthesizer';
import { searchWithML, rankMarketplaceItemsWithML, subscribeToServerMarketplaceModel } from '../../services/mlSearchService';

interface MarketplaceViewProps {
  currentUser: User;
  onOpenDirectChat: (seller: User, initialMessage?: string) => void;
  onOpenPayVerified: () => void;
  onOpenUserProfile?: (user: User) => void;
}

const CATEGORIES = [
  'All',
  'Tech',
  'Fashion',
  'Home',
  'Art',
  'Photography',
  'Vehicles',
  'Books',
  'Services',
  'Other',
] as const;

type SortOption = 'recommended' | 'price_low' | 'price_high' | 'newest' | 'popular';
type ActiveTab = 'browse' | 'my_listings' | 'wishlist' | 'orders';

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  currentUser,
  onOpenDirectChat,
  onOpenPayVerified,
  onOpenUserProfile,
}) => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('browse');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('recommended');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [showSoldItems, setShowSoldItems] = useState(false);
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

  // Selected Detail Modal
  const [selectedItemDetail, setSelectedItemDetail] = useState<MarketplaceItem | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Buy Now / Checkout Modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [deliveryOption, setDeliveryOption] = useState<'shipping' | 'pickup'>('shipping');
  const [shippingAddress, setShippingAddress] = useState(currentUser.location || 'Kigali, Rwanda');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'card' | 'cash_on_delivery'>('momo');
  const [momoNumber, setMomoNumber] = useState('078');
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<MarketplaceOrder | null>(null);

  // Make an Offer Modal
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [offerSuccessNotice, setOfferSuccessNotice] = useState(false);

  // Sell Item Modal State
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellTitle, setSellTitle] = useState('');
  const [sellDesc, setSellDesc] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellCurrency, setSellCurrency] = useState<'RWF' | 'USD' | 'EUR'>('RWF');
  const [sellCategory, setSellCategory] = useState<MarketplaceItem['category']>('Tech');
  const [sellCondition, setSellCondition] = useState<MarketplaceItem['condition']>('Like New');
  const [sellLocation, setSellLocation] = useState(currentUser.location || 'Kigali, Rwanda');
  const [sellPhone, setSellPhone] = useState('');
  const [sellShipping, setSellShipping] = useState(true);
  const [sellNegotiable, setSellNegotiable] = useState(false);
  const [sellImages, setSellImages] = useState<string[]>([]);
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isUploadingSellImage, setIsUploadingSellImage] = useState(false);
  const [sellUploadProgress, setSellUploadProgress] = useState(0);
  const [sellError, setSellError] = useState<string | null>(null);

  // Edit Listing Modal State
  const [editingItem, setEditingItem] = useState<MarketplaceItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Sponsored Ad Modal State
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [adTitle, setAdTitle] = useState('');
  const [adDesc, setAdDesc] = useState('');
  const [adMediaUrl, setAdMediaUrl] = useState('');
  const [adCtaText, setAdCtaText] = useState('Shop Collection');
  const [adPlacement, setAdPlacement] = useState<'feed_post' | 'story_ad'>('feed_post');
  const [adBudget, setAdBudget] = useState('25000');
  const [isSubmittingAd, setIsSubmittingAd] = useState(false);
  const [adSuccessNotice, setAdSuccessNotice] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  // Local Wishlist set & Orders
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('aura_marketplace_saved_items') || '[]');
      return new Set(stored);
    } catch {
      return new Set();
    }
  });

  const [orders, setOrders] = useState<MarketplaceOrder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('aura_marketplace_orders') || '[]');
    } catch {
      return [];
    }
  });

  const [marketplaceModelRevision, setMarketplaceModelRevision] = useState(0);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Real-time Firestore sync
  useEffect(() => {
    const unsub = subscribeToMarketplaceItems(
      (listings) => {
        setItems(listings);
      },
      (err) => console.warn('Marketplace load notice:', err)
    );
    const unsubML = subscribeToServerMarketplaceModel(() =>
      setMarketplaceModelRevision((v) => v + 1)
    );
    return () => {
      unsub();
      unsubML();
    };
  }, []);

  // Filter & ML search calculation
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Tab filter
    if (activeTab === 'my_listings') {
      result = result.filter((i) => i.seller.id === currentUser.id);
    } else if (activeTab === 'wishlist') {
      result = result.filter(
        (i) => wishlistIds.has(i.id) || (i.savedBy && i.savedBy.includes(currentUser.id))
      );
    } else {
      // Browse tab: unless checked, hide sold items
      if (!showSoldItems) {
        result = result.filter((i) => !i.isSold);
      }
    }

    // Category filter
    if (selectedCategory !== 'All') {
      result = result.filter((i) => i.category === selectedCategory);
    }

    // Condition filter
    if (selectedCondition !== 'all') {
      result = result.filter((i) => i.condition === selectedCondition);
    }

    // Price range filters
    if (minPriceFilter) {
      const min = Number(minPriceFilter);
      if (!isNaN(min) && min > 0) result = result.filter((i) => i.price >= min);
    }
    if (maxPriceFilter) {
      const max = Number(maxPriceFilter);
      if (!isNaN(max) && max > 0) result = result.filter((i) => i.price <= max);
    }

    // Search query with ML semantic matching
    if (searchQuery.trim()) {
      const mlRes = searchWithML(searchQuery, { posts: [], creators: [], marketplace: result });
      result = rankMarketplaceItemsWithML(mlRes.marketplace);
    }

    // Sorting
    if (sortOption === 'price_low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'price_high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortOption === 'newest') {
      result.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    } else if (sortOption === 'popular') {
      result.sort((a, b) => (b.savedBy?.length || 0) - (a.savedBy?.length || 0));
    } else {
      // Recommended ML
      result = rankMarketplaceItemsWithML(result);
    }

    return result;
  }, [
    items,
    activeTab,
    selectedCategory,
    selectedCondition,
    showSoldItems,
    minPriceFilter,
    maxPriceFilter,
    searchQuery,
    sortOption,
    wishlistIds,
    currentUser.id,
    marketplaceModelRevision,
  ]);

  // Wishlist toggle handler
  const handleToggleWishlist = async (itemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    auraAudio.playClick(700, 0.04);
    const nextSaved = await toggleSaveMarketplaceItem(itemId, currentUser.id);
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (nextSaved) next.add(itemId);
      else next.delete(itemId);
      try {
        localStorage.setItem('aura_marketplace_saved_items', JSON.stringify(Array.from(next)));
      } catch {
        // safe
      }
      return next;
    });
  };

  // Image Upload handler (up to 8 images)
  const handleSellImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setSellError(null);

    const availableSlots = 8 - sellImages.length;
    if (availableSlots <= 0) {
      setSellError('Maximum 8 images allowed per product listing.');
      event.target.value = '';
      return;
    }

    setIsUploadingSellImage(true);
    setSellUploadProgress(5);

    try {
      const newUrls: string[] = [];
      const filesToUpload = Array.from(files).slice(0, availableSlots);

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        if (!file.type.startsWith('image/')) continue;

        const compressed = await compressImage(file, {
          maxDimension: 1600,
          quality: 0.85,
          preferWebp: true,
          onProgress: (percent) => {
            const step = Math.round((i / filesToUpload.length) * 50 + (percent / filesToUpload.length) * 0.5);
            setSellUploadProgress(Math.max(5, Math.min(60, step)));
          },
        });

        const extension = compressed.mimeType === 'image/webp' ? 'webp' : 'jpg';
        const path = `marketplace/${currentUser.id}/${crypto.randomUUID()}.${extension}`;
        const uploaded = await uploadMediaToFirebase(compressed.blob, path, (percent) => {
          const step = Math.round(60 + (i / filesToUpload.length) * 40 + (percent / filesToUpload.length) * 0.4);
          setSellUploadProgress(Math.min(99, step));
        });

        newUrls.push(uploaded.url);
      }

      setSellImages((prev) => [...prev, ...newUrls]);
      setSellUploadProgress(100);
    } catch (error) {
      setSellError(error instanceof Error ? error.message : 'Photo upload failed. Please try again.');
    } finally {
      setIsUploadingSellImage(false);
      event.target.value = '';
    }
  };

  // Create Listing Form Submit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellTitle.trim() || !sellPrice.trim() || sellImages.length === 0 || !sellLocation.trim()) {
      setSellError('Provide a title, valid price, location, and upload at least one photo.');
      return;
    }
    const parsedPrice = Number(sellPrice);
    if (!Number.isSafeInteger(parsedPrice) || parsedPrice <= 0) {
      setSellError('Enter a valid price greater than zero.');
      return;
    }
    setIsSubmittingItem(true);
    setSellError(null);
    auraAudio.playClick(600, 0.05);

    try {
      const newItem = await createMarketplaceItem(
        {
          title: sellTitle.trim(),
          description: sellDesc.trim(),
          price: parsedPrice,
          currency: sellCurrency,
          category: sellCategory,
          condition: sellCondition,
          images: sellImages,
          location: sellLocation.trim(),
          tags: [sellCategory.toLowerCase(), 'marketplace', sellCondition.toLowerCase().replace(/\s+/g, '_')],
          contactPhone: sellPhone.trim() || undefined,
          shippingAvailable: sellShipping,
          negotiable: sellNegotiable,
        },
        currentUser
      );

      setItems((prev) => [newItem, ...prev.filter((i) => i.id !== newItem.id)]);
      setIsSellModalOpen(false);
      // Reset form
      setSellTitle('');
      setSellDesc('');
      setSellPrice('');
      setSellImages([]);
      setSellUploadProgress(0);
      auraAudio.playChime();
    } catch (error) {
      setSellError(error instanceof Error ? error.message : 'The listing could not be published.');
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Edit Listing Submit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const priceNum = Number(editPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    setIsSavingEdit(true);
    try {
      await updateMarketplaceItem(
        editingItem.id,
        {
          price: priceNum,
          description: editDesc.trim(),
          location: editLocation.trim(),
        },
        currentUser
      );
      setEditingItem(null);
      auraAudio.playChime();
    } catch (err) {
      console.warn('Edit error:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Listing
  const handleDeleteListing = async (itemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this listing?')) return;
    try {
      await deleteMarketplaceItem(itemId, currentUser);
      if (selectedItemDetail?.id === itemId) setSelectedItemDetail(null);
      auraAudio.playClick(400, 0.05);
    } catch (err) {
      console.warn('Delete error:', err);
    }
  };

  // Mark as Sold / Reserved
  const handleMarkSold = async (itemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await markItemAsSold(itemId);
      auraAudio.playChime();
    } catch (err) {
      console.warn('Sold error:', err);
    }
  };

  const handleToggleReserve = async (item: MarketplaceItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await toggleItemReservation(item.id, !item.isReserved);
      auraAudio.playClick(500, 0.04);
    } catch (err) {
      console.warn('Reserve error:', err);
    }
  };

  // Direct Contact Seller
  const handleContactSeller = (item: MarketplaceItem) => {
    auraAudio.playClick(500, 0.04);
    const initialText = `Hi ${item.seller.name}! I am interested in your listing "${item.title}" listed for ${item.price.toLocaleString()} ${item.currency}. Is it still available?`;
    onOpenDirectChat(item.seller, initialText);
  };

  // Make an Offer
  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemDetail || !offerPrice.trim()) return;
    const num = Number(offerPrice);
    if (isNaN(num) || num <= 0) return;

    setIsSubmittingOffer(true);
    auraAudio.playClick(600, 0.04);

    try {
      const discountPct = Math.round(((selectedItemDetail.price - num) / selectedItemDetail.price) * 100);
      const discountLabel = discountPct > 0 ? ` (${discountPct}% off asking price)` : '';
      const text = `🤝 Formal Offer: I'd like to offer ${num.toLocaleString()} ${selectedItemDetail.currency}${discountLabel} for "${selectedItemDetail.title}". ${offerMessage.trim() ? `\n\nNote: "${offerMessage.trim()}"` : ''}`;

      onOpenDirectChat(selectedItemDetail.seller, text);
      setOfferSuccessNotice(true);
      setTimeout(() => {
        setOfferSuccessNotice(false);
        setIsOfferModalOpen(false);
        setOfferPrice('');
        setOfferMessage('');
      }, 1500);
      auraAudio.playChime();
    } catch {
      // safe
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  // Instant Buy / Checkout Submit
  const handleCompleteCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemDetail) return;
    setIsProcessingOrder(true);
    auraAudio.playClick(650, 0.04);

    try {
      const order = await processMarketplaceCheckout(
        selectedItemDetail,
        currentUser,
        deliveryOption,
        paymentMethod,
        shippingAddress
      );

      setOrders((prev) => [order, ...prev]);
      setCompletedOrder(order);
      auraAudio.playChime();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Checkout could not be processed.');
    } finally {
      setIsProcessingOrder(false);
    }
  };

  // Share Listing link
  const handleShareListing = (item: MarketplaceItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const url = `${window.location.origin}/#/marketplace?item=${item.id}`;
      navigator.clipboard?.writeText(url);
      setShareNotice(`Link to "${item.title}" copied!`);
      auraAudio.playClick(600, 0.03);
      setTimeout(() => setShareNotice(null), 2500);
    } catch {
      // safe
    }
  };

  // Create Sponsored Campaign
  const handleCreateSponsoredAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle.trim() || !adMediaUrl.trim()) {
      setAdError('Add an ad headline and a media URL.');
      return;
    }
    const campaignBudget = Number(adBudget);
    if (!Number.isSafeInteger(campaignBudget) || campaignBudget <= 0) {
      setAdError('Enter a valid proposed budget.');
      return;
    }
    setAdError(null);
    setIsSubmittingAd(true);
    auraAudio.playClick(600, 0.05);

    try {
      await createSponsoredAd(
        {
          type: adPlacement,
          title: adTitle.trim(),
          description: adDesc.trim(),
          mediaUrl: adMediaUrl.trim(),
          mediaType: 'image',
          ctaText: adCtaText.trim() || 'Learn More',
          budget: campaignBudget,
          targetCategory: 'Tech',
        },
        currentUser
      );

      setAdSuccessNotice(true);
      setTimeout(() => {
        setAdSuccessNotice(false);
        setIsAdModalOpen(false);
      }, 1500);
      auraAudio.playChime();
    } catch (err) {
      setAdError(err instanceof Error ? err.message : 'Could not submit ad campaign.');
    } finally {
      setIsSubmittingAd(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Toast Notice */}
      {shareNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#064E3B] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-fade-in border border-emerald-400/30">
          <CheckCircle2 size={16} className="text-emerald-300" />
          <span>{shareNotice}</span>
        </div>
      )}

      {/* Top Emerald Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-[#063B2D] via-[#054E3B] to-[#022C22] text-white p-5 sm:p-8 shadow-xl overflow-hidden border border-emerald-800/40">
        <div className="relative z-10 max-w-2xl space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-xs font-mono font-medium">
            <ShoppingBag size={13} />
            <span>Sodanox Commerce & Creator Market</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
            Curated Creator Gear, Nordic Crafts & Direct Trading
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/85 leading-relaxed">
            Buy, sell, and trade directly with verified creators. Real escrow-ready listings, authentic buyer offers, and instant communication.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                auraAudio.playClick(600, 0.04);
                setIsSellModalOpen(true);
              }}
              className="py-2.5 px-4 rounded-2xl bg-white text-[#064E3B] text-xs font-bold hover:bg-emerald-50 transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>List an Item</span>
            </button>

            <button
              type="button"
              onClick={() => {
                auraAudio.playClick(600, 0.04);
                setIsAdModalOpen(true);
              }}
              className="py-2.5 px-4 rounded-2xl bg-emerald-800/80 hover:bg-emerald-800 border border-emerald-500/40 text-white text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
            >
              <TrendingUp size={15} />
              <span>Promote Listing</span>
            </button>

            {!currentUser.verified && (
              <button
                type="button"
                onClick={onOpenPayVerified}
                className="py-2.5 px-4 rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <CheckCircle2 size={14} className="text-blue-400" />
                <span>Get Verified Seller Badge</span>
              </button>
            )}
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center justify-between border-b border-[#D1E2D9] pb-2">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none">
          {(
            [
              { id: 'browse', label: 'Explore Market', icon: ShoppingBag, count: items.filter((i) => !i.isSold).length },
              { id: 'my_listings', label: 'My Listings', icon: Package, count: items.filter((i) => i.seller.id === currentUser.id).length },
              { id: 'wishlist', label: 'Saved Wishlist', icon: Heart, count: wishlistIds.size },
              { id: 'orders', label: 'Order History', icon: FileText, count: orders.length },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  auraAudio.playClick(500, 0.03);
                  setActiveTab(tab.id);
                }}
                className={`py-2 px-3 sm:px-4 rounded-2xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#064E3B] text-white shadow-xs'
                    : 'bg-white border border-[#D1E2D9] text-[#55635C] hover:bg-[#EDF3F0]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    isActive ? 'bg-emerald-400/30 text-emerald-100' : 'bg-[#EDF3F0] text-[#55635C]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Layout Switcher (Grid vs List) */}
        <div className="hidden sm:flex items-center gap-1 bg-white border border-[#D1E2D9] p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setViewLayout('grid')}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              viewLayout === 'grid' ? 'bg-[#064E3B] text-white' : 'text-[#55635C] hover:bg-black/5'
            }`}
            title="Grid view"
          >
            <Grid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewLayout('list')}
            className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
              viewLayout === 'list' ? 'bg-[#064E3B] text-white' : 'text-[#55635C] hover:bg-black/5'
            }`}
            title="List view"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Search, Filter & Category Bar */}
      {activeTab === 'browse' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3 text-[#55635C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search marketplace with AI semantic ranking (e.g. fuji camera, cedar desk, pottery)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669] shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-3 text-[#55635C] hover:text-[#064E3B]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Sort Dropdown */}
            <div className="flex items-center gap-2">
              <div className="relative shrink-0">
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="px-3.5 py-2.5 rounded-2xl bg-white border border-[#D1E2D9] text-xs font-semibold text-[#064E3B] focus:outline-none focus:border-[#059669] shadow-xs cursor-pointer"
                >
                  <option value="recommended">Recommended (ML)</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="newest">Newest Arrivals</option>
                  <option value="popular">Most Popular</option>
                </select>
              </div>

              {/* Advanced Filter Drawer Trigger */}
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
                className={`py-2.5 px-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isFilterDrawerOpen || selectedCondition !== 'all' || minPriceFilter || maxPriceFilter || showSoldItems
                    ? 'bg-[#064E3B] text-white border-[#064E3B]'
                    : 'bg-white border-[#D1E2D9] text-[#55635C] hover:bg-[#EDF3F0]'
                }`}
              >
                <Sliders size={14} />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Advanced Filter Drawer */}
          {isFilterDrawerOpen && (
            <div className="bg-white rounded-3xl border border-[#D1E2D9] p-4 sm:p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#EDF3F0] pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#064E3B]">Advanced Filter Controls</h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCondition('all');
                    setMinPriceFilter('');
                    setMaxPriceFilter('');
                    setShowSoldItems(false);
                  }}
                  className="text-xs text-[#059669] hover:underline cursor-pointer"
                >
                  Reset all
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Condition filter */}
                <div>
                  <label className="block font-semibold text-[#064E3B] mb-1.5">Condition</label>
                  <select
                    value={selectedCondition}
                    onChange={(e) => setSelectedCondition(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs text-[#064E3B] focus:outline-none"
                  >
                    <option value="all">All Conditions</option>
                    <option value="Brand New">Brand New</option>
                    <option value="Like New">Like New</option>
                    <option value="Gently Used">Gently Used</option>
                    <option value="Refurbished">Refurbished</option>
                  </select>
                </div>

                {/* Price range */}
                <div>
                  <label className="block font-semibold text-[#064E3B] mb-1.5">Price Range (RWF)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minPriceFilter}
                      onChange={(e) => setMinPriceFilter(e.target.value)}
                      className="w-1/2 px-3 py-2 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs text-[#064E3B] focus:outline-none"
                    />
                    <span className="text-[#55635C]">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxPriceFilter}
                      onChange={(e) => setMaxPriceFilter(e.target.value)}
                      className="w-1/2 px-3 py-2 rounded-xl bg-[#F8FAF9] border border-[#D1E2D9] text-xs text-[#064E3B] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <label className="block font-semibold text-[#064E3B] mb-1.5">Availability</label>
                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSoldItems}
                      onChange={(e) => setShowSoldItems(e.target.checked)}
                      className="rounded accent-[#064E3B]"
                    />
                    <span className="text-xs text-[#55635C]">Include sold items</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  auraAudio.playClick(440, 0.03);
                  setSelectedCategory(cat);
                }}
                className={`px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#064E3B] text-white shadow-xs'
                    : 'bg-white border border-[#D1E2D9] text-[#55635C] hover:bg-[#EDF3F0]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Orders Tab View */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-[#D1E2D9] p-5">
            <h3 className="font-bold text-sm sm:text-base text-[#064E3B] flex items-center gap-2 mb-1">
              <FileText size={18} className="text-[#059669]" />
              <span>Purchases & Orders Ledger</span>
            </h3>
            <p className="text-xs text-[#55635C]">
              Authoritative transaction receipts generated by Sodanox marketplace checkout.
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-[#D1E2D9] p-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-[#064E3B]">
                <Package size={24} />
              </div>
              <p className="text-sm font-bold text-[#064E3B]">No orders placed yet</p>
              <p className="text-xs text-[#55635C]">
                Explore marketplace listings and tap "Instant Buy" to checkout with automated receipts.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((ord) => (
                <div
                  key={ord.orderId}
                  className="bg-white rounded-3xl border border-[#D1E2D9] p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#064E3B]">{ord.orderId}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#064E3B] font-mono text-[10px] font-bold uppercase">
                        {ord.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-[#064E3B]">{ord.itemTitle}</h4>
                    <p className="text-xs text-[#55635C]">
                      Seller: {ord.sellerName} · Delivery: {ord.deliveryOption === 'shipping' ? `Shipped to ${ord.shippingAddress}` : 'Local Pickup'}
                    </p>
                    <p className="text-[11px] text-[#55635C] font-mono">
                      Paid via {ord.paymentMethod.toUpperCase()} · Ref {ord.paymentRef} · {new Date(ord.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="text-right sm:self-center">
                    <p className="text-lg font-bold text-[#059669]">
                      {ord.itemPrice.toLocaleString()} <span className="text-xs font-normal text-[#55635C]">{ord.currency}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product Grid / List (Browse, My Listings, Wishlist) */}
      {activeTab !== 'orders' && (
        <>
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-[#D1E2D9] p-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-[#064E3B]">
                <ShoppingBag size={24} />
              </div>
              <p className="text-sm font-bold text-[#064E3B]">
                {activeTab === 'wishlist'
                  ? 'Your wishlist is empty'
                  : activeTab === 'my_listings'
                  ? 'You have not listed any items yet'
                  : 'No marketplace listings found'}
              </p>
              <p className="text-xs text-[#55635C]">
                {activeTab === 'wishlist'
                  ? 'Tap the heart icon on any listing to save it to your wishlist.'
                  : activeTab === 'my_listings'
                  ? 'Publish your first listing to start selling to creators.'
                  : 'Try adjusting your search keywords or category filters.'}
              </p>
            </div>
          ) : viewLayout === 'grid' ? (
            /* 3-Column Card Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredItems.map((item) => {
                const isSaved = wishlistIds.has(item.id) || (item.savedBy && item.savedBy.includes(currentUser.id));
                const isMyListing = item.seller.id === currentUser.id;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-3xl border border-[#D1E2D9] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group relative"
                  >
                    {/* Product Photo */}
                    <div
                      className="relative aspect-4/3 bg-black/5 overflow-hidden cursor-pointer"
                      onClick={() => {
                        setSelectedItemDetail(item);
                        setActiveImageIdx(0);
                      }}
                    >
                      <img
                        src={item.images[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80'}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />

                      {/* Category Tag */}
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold">
                        {item.category}
                      </span>

                      {/* Condition Tag */}
                      <span className="absolute top-3 right-12 px-2.5 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md text-emerald-200 text-[10px] font-mono font-bold">
                        {item.condition}
                      </span>

                      {/* Heart Save Button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleWishlist(item.id, e)}
                        className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md transition-transform active:scale-90 cursor-pointer ${
                          isSaved ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'
                        }`}
                        title={isSaved ? 'Remove from wishlist' : 'Save to wishlist'}
                      >
                        <Heart size={14} className={isSaved ? 'fill-current' : ''} />
                      </button>

                      {/* Multi-photo indicator */}
                      {item.images.length > 1 && (
                        <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1">
                          <Layers size={10} />
                          <span>{item.images.length}</span>
                        </span>
                      )}

                      {/* Reserved / Sold Badge */}
                      {item.isSold ? (
                        <div className="absolute inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center">
                          <span className="px-4 py-1.5 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg">
                            SOLD
                          </span>
                        </div>
                      ) : item.isReserved ? (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center">
                          <span className="px-4 py-1.5 rounded-2xl bg-amber-500 text-white font-bold text-xs uppercase tracking-widest shadow-lg">
                            RESERVED
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Product Info */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3
                            onClick={() => {
                              setSelectedItemDetail(item);
                              setActiveImageIdx(0);
                            }}
                            className="text-sm sm:text-base font-bold text-[#064E3B] line-clamp-1 group-hover:text-[#059669] transition-colors cursor-pointer"
                          >
                            {item.title}
                          </h3>
                        </div>

                        <div className="flex items-baseline gap-2">
                          <p className="text-base sm:text-lg font-bold text-[#059669]">
                            {item.price.toLocaleString()} <span className="text-xs font-normal text-[#55635C]">{item.currency}</span>
                          </p>
                          {item.negotiable && (
                            <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                              Negotiable
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-[#55635C] line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-[#EDF3F0] space-y-3">
                        {/* Seller & Location */}
                        <div className="flex items-center justify-between text-xs">
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => onOpenUserProfile && onOpenUserProfile(item.seller)}
                          >
                            <ModernAvatar src={item.seller.avatar} alt={item.seller.name} size="xs" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[#064E3B] truncate flex items-center gap-1">
                                {item.seller.name}
                                {item.seller.verified && (
                                  <CheckCircle2 size={12} fill="#3B82F6" className="text-white shrink-0" />
                                )}
                              </p>
                              <p className="text-[10px] text-[#55635C] flex items-center gap-0.5">
                                <MapPin size={10} />
                                <span className="truncate">{item.location}</span>
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {!isMyListing ? (
                            <>
                              <button
                                type="button"
                                disabled={item.isSold}
                                onClick={() => handleContactSeller(item)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                <MessageSquare size={13} />
                                <span>Message</span>
                              </button>

                              <button
                                type="button"
                                disabled={item.isSold}
                                onClick={() => {
                                  setSelectedItemDetail(item);
                                  setIsCheckoutOpen(true);
                                }}
                                className="py-2 px-3 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-[#064E3B] text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                              >
                                Buy Now
                              </button>
                            </>
                          ) : (
                            /* Seller's own listing actions */
                            <div className="flex items-center justify-between w-full gap-2">
                              {!item.isSold && (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkSold(item.id, e)}
                                  className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-[#064E3B] text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  Mark Sold
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleToggleReserve(item, e)}
                                className="py-1.5 px-2.5 rounded-xl border border-[#D1E2D9] text-xs font-medium text-[#55635C] hover:bg-black/5 cursor-pointer"
                              >
                                {item.isReserved ? 'Unreserve' : 'Reserve'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditPrice(String(item.price));
                                  setEditDesc(item.description);
                                  setEditLocation(item.location);
                                }}
                                className="p-2 rounded-xl text-[#55635C] hover:bg-black/5 cursor-pointer"
                                title="Edit listing"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteListing(item.id, e)}
                                className="p-2 rounded-xl text-red-600 hover:bg-red-50 cursor-pointer"
                                title="Delete listing"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List Layout */
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItemDetail(item);
                    setActiveImageIdx(0);
                  }}
                  className="bg-white rounded-3xl border border-[#D1E2D9] p-3 sm:p-4 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <img
                      src={item.images[0] || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=400&q=80'}
                      alt={item.title}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                          {item.category}
                        </span>
                        <span className="text-xs text-[#55635C]">{item.condition}</span>
                        {item.isSold && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                            SOLD
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm sm:text-base text-[#064E3B] truncate group-hover:text-[#059669]">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[#55635C] flex items-center gap-2">
                        <span>By {item.seller.name}</span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin size={10} />
                          {item.location}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <p className="text-base sm:text-lg font-bold text-[#059669]">
                      {item.price.toLocaleString()} <span className="text-xs font-normal text-[#55635C]">{item.currency}</span>
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleContactSeller(item);
                      }}
                      className="py-2 px-3 rounded-xl bg-[#064E3B] text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <MessageSquare size={13} />
                      <span>Message</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Listing Detail Modal */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-[#D1E2D9] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#D1E2D9] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#064E3B] border border-emerald-200 text-xs font-semibold">
                  {selectedItemDetail.category}
                </span>
                <span className="text-xs text-[#55635C]">{selectedItemDetail.condition}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleWishlist(selectedItemDetail.id)}
                  className={`p-2 rounded-full cursor-pointer transition-colors ${
                    wishlistIds.has(selectedItemDetail.id) ? 'bg-red-50 text-red-600' : 'hover:bg-black/5 text-[#55635C]'
                  }`}
                  title="Wishlist"
                >
                  <Heart size={18} className={wishlistIds.has(selectedItemDetail.id) ? 'fill-current' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => handleShareListing(selectedItemDetail)}
                  className="p-2 rounded-full hover:bg-black/5 text-[#55635C] cursor-pointer"
                  title="Share"
                >
                  <Share2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedItemDetail(null)}
                  className="p-2 rounded-full hover:bg-black/5 text-[#55635C] cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Image Gallery */}
              <div className="space-y-2">
                <div className="relative aspect-16/10 rounded-2xl overflow-hidden bg-black/5">
                  <img
                    src={selectedItemDetail.images[activeImageIdx] || selectedItemDetail.images[0]}
                    alt={selectedItemDetail.title}
                    className="w-full h-full object-cover"
                  />
                  {selectedItemDetail.isSold && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                      <span className="px-5 py-2 rounded-2xl bg-red-600 text-white font-bold text-sm tracking-widest">
                        SOLD
                      </span>
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {selectedItemDetail.images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {selectedItemDetail.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIdx(idx)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                          activeImageIdx === idx ? 'border-[#064E3B] scale-105' : 'border-transparent opacity-70'
                        }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Price */}
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg sm:text-xl font-bold text-[#064E3B]">{selectedItemDetail.title}</h2>
                  <p className="text-xl sm:text-2xl font-bold text-[#059669] shrink-0">
                    {selectedItemDetail.price.toLocaleString()} <span className="text-xs font-normal text-[#55635C]">{selectedItemDetail.currency}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#55635C] pt-1">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-[#059669]" />
                    {selectedItemDetail.location}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Truck size={12} className="text-[#059669]" />
                    {selectedItemDetail.shippingAvailable ? 'Shipping available' : 'Local pickup only'}
                  </span>
                  {selectedItemDetail.negotiable && (
                    <>
                      <span>·</span>
                      <span className="text-emerald-700 font-semibold">Open to price offers</span>
                    </>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#064E3B]">Description & Notes</h4>
                <p className="text-xs sm:text-sm text-[#2D3732] leading-relaxed whitespace-pre-wrap bg-[#F8FAF9] p-3.5 rounded-2xl border border-[#D1E2D9]">
                  {selectedItemDetail.description || 'No detailed description provided by seller.'}
                </p>
              </div>

              {/* Seller Profile Card */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => onOpenUserProfile && onOpenUserProfile(selectedItemDetail.seller)}
                >
                  <ModernAvatar src={selectedItemDetail.seller.avatar} alt={selectedItemDetail.seller.name} size="md" />
                  <div>
                    <h5 className="font-bold text-xs sm:text-sm text-[#064E3B] flex items-center gap-1">
                      {selectedItemDetail.seller.name}
                      {selectedItemDetail.seller.verified && (
                        <CheckCircle2 size={13} fill="#3B82F6" className="text-white" />
                      )}
                    </h5>
                    <p className="text-[11px] text-[#55635C]">@{selectedItemDetail.seller.username}</p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-[#55635C]">
                  <span className="text-emerald-800 font-medium flex items-center gap-1">
                    <Clock size={11} />
                    Replies in ~15 mins
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="p-4 border-t border-[#D1E2D9] bg-[#F8FAF9] flex items-center gap-2.5">
              {selectedItemDetail.seller.id !== currentUser.id ? (
                <>
                  <button
                    type="button"
                    disabled={selectedItemDetail.isSold}
                    onClick={() => handleContactSeller(selectedItemDetail)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-white border border-[#D1E2D9] hover:bg-[#EDF3F0] text-[#064E3B] text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <MessageSquare size={16} />
                    <span>Message Seller</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedItemDetail.isSold}
                    onClick={() => setIsOfferModalOpen(true)}
                    className="py-3 px-4 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-[#064E3B] text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    Make an Offer
                  </button>

                  <button
                    type="button"
                    disabled={selectedItemDetail.isSold}
                    onClick={() => setIsCheckoutOpen(true)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ShoppingBag size={16} />
                    <span>Instant Buy</span>
                  </button>
                </>
              ) : (
                <div className="w-full flex items-center justify-between gap-3">
                  {!selectedItemDetail.isSold && (
                    <button
                      type="button"
                      onClick={() => handleMarkSold(selectedItemDetail.id)}
                      className="flex-1 py-3 rounded-2xl bg-[#064E3B] text-white text-xs font-bold"
                    >
                      Mark as Sold
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteListing(selectedItemDetail.id)}
                    className="py-3 px-4 rounded-2xl bg-red-100 text-red-700 text-xs font-bold"
                  >
                    Delete Listing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Make an Offer Modal */}
      {isOfferModalOpen && selectedItemDetail && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#D1E2D9] shadow-2xl p-5 sm:p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#D1E2D9] pb-3">
              <h3 className="font-bold text-sm sm:text-base text-[#064E3B] flex items-center gap-2">
                <BadgePercent size={18} className="text-[#059669]" />
                <span>Make an Offer</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(false)}
                className="p-1 rounded-full hover:bg-black/5 text-[#55635C]"
              >
                <X size={18} />
              </button>
            </div>

            {offerSuccessNotice ? (
              <div className="text-center py-6 space-y-2">
                <CheckCircle2 size={36} className="text-emerald-600 mx-auto" />
                <p className="font-bold text-[#064E3B]">Offer sent to seller</p>
                <p className="text-xs text-[#55635C]">
                  Check your direct message conversation with {selectedItemDetail.seller.name}.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendOffer} className="space-y-4">
                <div className="p-3 rounded-2xl bg-[#F8FAF9] flex items-center justify-between text-xs">
                  <span className="text-[#55635C]">Listing asking price:</span>
                  <span className="font-bold text-[#064E3B]">
                    {selectedItemDetail.price.toLocaleString()} {selectedItemDetail.currency}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">Your Proposed Price ({selectedItemDetail.currency}) *</label>
                  <input
                    type="number"
                    required
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder={`e.g. ${Math.round(selectedItemDetail.price * 0.9)}`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                  />
                  {offerPrice && Number(offerPrice) < selectedItemDetail.price && (
                    <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                      {Math.round(((selectedItemDetail.price - Number(offerPrice)) / selectedItemDetail.price) * 100)}% discount proposed
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">Optional note to seller</label>
                  <textarea
                    rows={2}
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    placeholder="E.g. Ready for cash pickup this afternoon in Kigali..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B] focus:outline-none focus:border-[#059669]"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOfferModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl text-xs text-[#55635C] hover:bg-black/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOffer || !offerPrice.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs font-bold disabled:opacity-50"
                  >
                    {isSubmittingOffer ? 'Sending offer...' : 'Submit Offer to Seller'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Instant Buy / Checkout Modal */}
      {isCheckoutOpen && selectedItemDetail && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-[#D1E2D9] shadow-2xl p-5 sm:p-6 space-y-4 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#D1E2D9] pb-3">
              <h3 className="font-bold text-sm sm:text-base text-[#064E3B] flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#059669]" />
                <span>Instant Checkout & Order Confirmation</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCheckoutOpen(false);
                  setCompletedOrder(null);
                }}
                className="p-1 rounded-full hover:bg-black/5 text-[#55635C]"
              >
                <X size={18} />
              </button>
            </div>

            {completedOrder ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-[#064E3B]">
                  <Check size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-lg text-[#064E3B]">Order Confirmed!</h4>
                  <p className="text-xs text-[#55635C]">
                    Invoice #{completedOrder.orderId} has been logged to your account.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#F8FAF9] border border-[#D1E2D9] text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#55635C]">Item:</span>
                    <span className="font-bold text-[#064E3B]">{completedOrder.itemTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#55635C]">Total Paid:</span>
                    <span className="font-bold text-[#059669]">
                      {completedOrder.itemPrice.toLocaleString()} {completedOrder.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#55635C]">Delivery:</span>
                    <span>{completedOrder.deliveryOption === 'shipping' ? `Ship to: ${completedOrder.shippingAddress}` : 'Local Pickup'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#55635C]">Payment Method:</span>
                    <span className="font-mono">{completedOrder.paymentMethod.toUpperCase()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    setSelectedItemDetail(null);
                    setCompletedOrder(null);
                    setActiveTab('orders');
                  }}
                  className="w-full py-3 rounded-2xl bg-[#064E3B] text-white text-xs font-bold"
                >
                  View in Order History
                </button>
              </div>
            ) : (
              <form onSubmit={handleCompleteCheckout} className="space-y-4">
                {/* Order Summary */}
                <div className="p-3.5 rounded-2xl bg-[#F8FAF9] border border-[#D1E2D9] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedItemDetail.images[0]}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover"
                    />
                    <div>
                      <h4 className="font-bold text-xs text-[#064E3B]">{selectedItemDetail.title}</h4>
                      <p className="text-[11px] text-[#55635C]">Sold by {selectedItemDetail.seller.name}</p>
                    </div>
                  </div>
                  <p className="font-bold text-sm text-[#059669]">
                    {selectedItemDetail.price.toLocaleString()} {selectedItemDetail.currency}
                  </p>
                </div>

                {/* Delivery Options */}
                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-2">Delivery Method</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setDeliveryOption('shipping')}
                      className={`p-3 rounded-2xl border text-left font-medium transition-colors cursor-pointer ${
                        deliveryOption === 'shipping'
                          ? 'border-[#064E3B] bg-emerald-50 text-[#064E3B]'
                          : 'border-[#D1E2D9] bg-white text-[#55635C]'
                      }`}
                    >
                      <Truck size={14} className="mb-1" />
                      <div>Courier Shipping</div>
                      <div className="text-[10px] text-[#55635C]">Direct to your doorstep</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryOption('pickup')}
                      className={`p-3 rounded-2xl border text-left font-medium transition-colors cursor-pointer ${
                        deliveryOption === 'pickup'
                          ? 'border-[#064E3B] bg-emerald-50 text-[#064E3B]'
                          : 'border-[#D1E2D9] bg-white text-[#55635C]'
                      }`}
                    >
                      <MapPin size={14} className="mb-1" />
                      <div>Local Pickup</div>
                      <div className="text-[10px] text-[#55635C]">Meet seller at location</div>
                    </button>
                  </div>
                </div>

                {deliveryOption === 'shipping' && (
                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">Shipping Address *</label>
                    <input
                      type="text"
                      required
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      placeholder="Street, City, Country"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-2">Payment Method</label>
                  <div className="space-y-2 text-xs">
                    {[
                      { id: 'momo', label: 'MTN Mobile Money Rwanda', note: 'Instant MoMo push prompt' },
                      { id: 'card', label: 'Card / Flutterwave Checkout', note: 'Visa, Mastercard, Bank' },
                      { id: 'cash_on_delivery', label: 'Cash On Delivery / Inspection', note: 'Pay after inspecting item' },
                    ].map((pm) => (
                      <label
                        key={pm.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer ${
                          paymentMethod === pm.id
                            ? 'border-[#064E3B] bg-emerald-50/50'
                            : 'border-[#D1E2D9] bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="payment"
                            checked={paymentMethod === pm.id}
                            onChange={() => setPaymentMethod(pm.id as any)}
                            className="accent-[#064E3B]"
                          />
                          <div>
                            <div className="font-bold text-[#064E3B]">{pm.label}</div>
                            <div className="text-[10px] text-[#55635C]">{pm.note}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'momo' && (
                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">MTN Phone Number</label>
                    <input
                      type="tel"
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value)}
                      placeholder="078xxxxxxx"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isProcessingOrder}
                    className="w-full py-3.5 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingOrder ? 'Confirming order...' : `Confirm Purchase · ${selectedItemDetail.price.toLocaleString()} ${selectedItemDetail.currency}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Sell Product Modal */}
      {isSellModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[#F8FAF9] rounded-3xl border border-[#D1E2D9] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b border-[#D1E2D9] bg-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-[#064E3B] flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#059669]" />
                <span>List a Product on Marketplace</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSellModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 text-[#55635C]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={sellTitle}
                  onChange={(e) => setSellTitle(e.target.value)}
                  placeholder="E.g. Sony A7 IV Camera Body with 28-70mm Lens"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">Price *</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      required
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                      placeholder="450000"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                    <select
                      value={sellCurrency}
                      onChange={(e) => setSellCurrency(e.target.value as any)}
                      className="px-2 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs font-semibold text-[#064E3B]"
                    >
                      <option value="RWF">RWF</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">Category *</label>
                  <select
                    value={sellCategory}
                    onChange={(e) => setSellCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">Condition</label>
                  <select
                    value={sellCondition}
                    onChange={(e) => setSellCondition(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                  >
                    <option value="Brand New">Brand New</option>
                    <option value="Like New">Like New</option>
                    <option value="Gently Used">Gently Used</option>
                    <option value="Refurbished">Refurbished</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">Location *</label>
                  <input
                    type="text"
                    required
                    value={sellLocation}
                    onChange={(e) => setSellLocation(e.target.value)}
                    placeholder="Kigali, Nyarutarama"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              {/* Photos Uploader */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#064E3B]">Product Photos ({sellImages.length}/8) *</label>
                  <span className="text-[11px] text-[#55635C]">PNG, JPG, WEBP</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {sellImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-black/5 group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setSellImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-600 text-white opacity-80 hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  {sellImages.length < 8 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-[#D1E2D9] hover:border-[#059669] flex flex-col items-center justify-center text-[#55635C] hover:text-[#064E3B] cursor-pointer bg-white transition-colors">
                      <Upload size={16} />
                      <span className="text-[10px] mt-1 font-semibold">Upload</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp"
                        disabled={isUploadingSellImage}
                        onChange={handleSellImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {isUploadingSellImage && (
                  <div className="space-y-1 pt-1">
                    <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                        style={{ width: `${sellUploadProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#55635C]">Optimizing and uploading photos · {sellUploadProgress}%</p>
                  </div>
                )}
              </div>

              {/* Options: Negotiable & Shipping */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#D1E2D9] bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sellNegotiable}
                    onChange={(e) => setSellNegotiable(e.target.checked)}
                    className="accent-[#064E3B]"
                  />
                  <span className="text-xs text-[#064E3B] font-medium">Price is Negotiable</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-[#D1E2D9] bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sellShipping}
                    onChange={(e) => setSellShipping(e.target.checked)}
                    className="accent-[#064E3B]"
                  />
                  <span className="text-xs text-[#064E3B] font-medium">Shipping Available</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-1">Contact Phone / WhatsApp</label>
                <input
                  type="tel"
                  value={sellPhone}
                  onChange={(e) => setSellPhone(e.target.value)}
                  placeholder="+250 78x xxx xxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B] focus:outline-none focus:border-[#059669]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-1">Description & Specs</label>
                <textarea
                  rows={3}
                  value={sellDesc}
                  onChange={(e) => setSellDesc(e.target.value)}
                  placeholder="Describe condition, specifications, warranty, what accessories are included..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                />
              </div>

              {sellError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                  {sellError}
                </p>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingItem || isUploadingSellImage}
                  className="w-full py-3 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingItem ? 'Publishing listing...' : 'Publish Product to Marketplace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-[#D1E2D9] shadow-2xl p-5 sm:p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-[#D1E2D9] pb-3">
              <h3 className="font-bold text-sm sm:text-base text-[#064E3B]">Edit Product Listing</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-full hover:bg-black/5 text-[#55635C]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-1">Price ({editingItem.currency})</label>
                <input
                  type="number"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-1">Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="py-2 px-4 rounded-xl text-xs text-[#55635C]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="py-2 px-5 rounded-xl bg-[#064E3B] text-white text-xs font-bold"
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Sponsored Ad Modal */}
      {isAdModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[#F8FAF9] rounded-3xl border border-[#D1E2D9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-[#D1E2D9] bg-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-[#064E3B] flex items-center gap-2">
                <TrendingUp size={18} className="text-[#059669]" />
                <span>Create Sponsored Feed or Story Campaign</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAdModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 text-[#55635C]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSponsoredAd} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {adSuccessNotice ? (
                <div className="text-center py-8 space-y-2">
                  <CheckCircle2 size={40} className="text-emerald-600 mx-auto" />
                  <p className="font-bold text-[#064E3B]">Campaign submitted for review</p>
                  <p className="text-xs text-[#55635C]">
                    This campaign has entered the platform moderation queue. An administrator will review and activate it.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">Ad Campaign Headline *</label>
                    <input
                      type="text"
                      required
                      value={adTitle}
                      onChange={(e) => setAdTitle(e.target.value)}
                      placeholder="E.g. Handcrafted Nordic Woodware Studio"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#064E3B] mb-1">Ad Placement</label>
                      <select
                        value={adPlacement}
                        onChange={(e) => setAdPlacement(e.target.value as any)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                      >
                        <option value="feed_post">In-Feed Sponsored Post</option>
                        <option value="story_ad">Full-Screen Story Ad</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#064E3B] mb-1">Proposed Budget (RWF)</label>
                      <input
                        type="number"
                        value={adBudget}
                        onChange={(e) => setAdBudget(e.target.value)}
                        placeholder="25000"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">Media Image URL *</label>
                    <input
                      type="url"
                      required
                      value={adMediaUrl}
                      onChange={(e) => setAdMediaUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">Call to Action Label</label>
                    <input
                      type="text"
                      value={adCtaText}
                      onChange={(e) => setAdCtaText(e.target.value)}
                      placeholder="Shop Collection, Contact Studio, Inquire"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">Ad Copy</label>
                    <textarea
                      rows={3}
                      value={adDesc}
                      onChange={(e) => setAdDesc(e.target.value)}
                      placeholder="Highlight what makes your products and craftsmanship unique..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  {adError && (
                    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                      {adError}
                    </p>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingAd}
                      className="w-full py-3 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingAd ? 'Submitting...' : 'Submit Campaign for Review'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
