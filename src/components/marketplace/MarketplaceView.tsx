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
} from 'lucide-react';
import { MarketplaceItem, SponsoredAd, User } from '../../types';
import { ModernAvatar } from '../common/ModernAvatar';
import {
  getMarketplaceItems,
  createMarketplaceItem,
  createSponsoredAd,
  markItemAsSold,
} from '../../services/marketplaceService';
import { compressImage, uploadMediaToFirebase } from '../../services/mediaCompressionService';
import { auraAudio } from '../../utils/audioSynthesizer';
import { searchWithML } from '../../services/mlSearchService';

interface MarketplaceViewProps {
  currentUser: User;
  onOpenDirectChat: (seller: User, initialMessage?: string) => void;
  onOpenPayVerified: () => void;
}

const CATEGORIES = ['All', 'Tech', 'Fashion', 'Home', 'Digital', 'Vehicles', 'Services', 'Books', 'Other'] as const;

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  currentUser,
  onOpenDirectChat,
  onOpenPayVerified,
}) => {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemDetail, setSelectedItemDetail] = useState<MarketplaceItem | null>(null);

  // Sell Item Modal State
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [sellTitle, setSellTitle] = useState('');
  const [sellDesc, setSellDesc] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellCategory, setSellCategory] = useState<MarketplaceItem['category']>('Tech');
  const [sellCondition, setSellCondition] = useState<MarketplaceItem['condition']>('Like New');
  const [sellLocation, setSellLocation] = useState(currentUser.location || 'Kigali, Rwanda');
  const [sellPhone, setSellPhone] = useState('');
  const [sellImageUrl, setSellImageUrl] = useState('');
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isUploadingSellImage, setIsUploadingSellImage] = useState(false);
  const [sellUploadProgress, setSellUploadProgress] = useState(0);
  const [sellError, setSellError] = useState<string | null>(null);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);

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

  useEffect(() => {
    let active = true;
    getMarketplaceItems()
      .then((listings) => { if (active) { setItems(listings); setMarketplaceError(null); } })
      .catch((error) => {
        if (active) setMarketplaceError(error instanceof Error ? error.message : 'Marketplace listings could not be loaded.');
      });
    return () => { active = false; };
  }, []);

  // Filter & ML search
  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategory !== 'All') {
      result = result.filter((i) => i.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const mlRes = searchWithML(searchQuery, { posts: [], creators: [], marketplace: result });
      return mlRes.marketplace;
    }
    return result;
  }, [items, selectedCategory, searchQuery]);

  const handleSellImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSellError(null);
    if (!file.type.startsWith('image/')) { setSellError('Choose a supported image file.'); event.target.value = ''; return; }
    if (file.size > 20 * 1024 * 1024) { setSellError('Product photos must be 20 MB or smaller.'); event.target.value = ''; return; }
    setIsUploadingSellImage(true); setSellUploadProgress(1);
    try {
      const compressed = await compressImage(file, {
        maxDimension: 1600, quality: 0.84, preferWebp: true,
        onProgress: (percent) => setSellUploadProgress(Math.max(1, Math.round(percent * 0.35))),
      });
      const extension = compressed.mimeType === 'image/webp' ? 'webp' : 'jpg';
      const path = `marketplace/${currentUser.id}/${crypto.randomUUID()}.${extension}`;
      const uploaded = await uploadMediaToFirebase(compressed.blob, path, (percent) => {
        setSellUploadProgress(Math.min(99, 35 + Math.round(percent * 0.64)));
      });
      setSellImageUrl(uploaded.url); setSellUploadProgress(100);
    } catch (error) {
      setSellError(error instanceof Error ? error.message : 'Product photo upload failed.');
    } finally { setIsUploadingSellImage(false); event.target.value = ''; }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellTitle.trim() || !sellPrice.trim() || !sellImageUrl.trim() || !sellLocation.trim()) {
      setSellError('Add a title, price, location, and upload at least one product photo.'); return;
    }
    const parsedPrice = Number(sellPrice);
    if (!Number.isSafeInteger(parsedPrice) || parsedPrice <= 0) { setSellError('Enter a valid price greater than zero.'); return; }
    setIsSubmittingItem(true); setSellError(null);
    auraAudio.playClick(600, 0.05);
    try {
      const newItem = await createMarketplaceItem({
        title: sellTitle.trim(), description: sellDesc.trim(), price: parsedPrice, currency: 'RWF',
        category: sellCategory, condition: sellCondition, images: [sellImageUrl.trim()],
        location: sellLocation.trim(), tags: [sellCategory.toLowerCase(), 'marketplace'], contactPhone: sellPhone.trim(),
      }, currentUser);
      setItems((previous) => [newItem, ...previous.filter((item) => item.id !== newItem.id)]);
      setIsSellModalOpen(false);
      setSellTitle(''); setSellDesc(''); setSellPrice(''); setSellImageUrl(''); setSellUploadProgress(0);
      auraAudio.playChime();
    } catch (error) {
      setSellError(error instanceof Error ? error.message : 'The listing could not be published.');
    } finally { setIsSubmittingItem(false); }
  };

  const handleMarkItemAsSold = async (item: MarketplaceItem) => {
    try {
      await markItemAsSold(item.id);
      setItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, isSold: true } : entry));
    } catch (error) {
      setMarketplaceError(error instanceof Error ? error.message : 'The listing could not be marked as sold.');
    }
  };
  const handleCreateSponsoredAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle.trim() || !adMediaUrl.trim()) { setAdError('Add an ad headline and a real campaign media URL.'); return; }
    const campaignBudget = Number(adBudget);
    if (!Number.isSafeInteger(campaignBudget) || campaignBudget <= 0) { setAdError('Enter a valid proposed campaign budget greater than zero.'); return; }
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
      setAdError(err instanceof Error ? err.message : 'The campaign could not be submitted for review.');
    } finally {
      setIsSubmittingAd(false);
    }
  };

  const handleContactSeller = (item: MarketplaceItem) => {
    auraAudio.playClick(500, 0.04);
    const initialText = `Hi ${item.seller.name}, I am interested in your listing "${item.title}" for ${item.price.toLocaleString()} ${item.currency}. Is it still available?`;
    onOpenDirectChat(item.seller, initialText);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#064E3B] via-[#047857] to-[#022C22] text-white p-5 sm:p-8 shadow-xl overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-2 sm:space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-xs font-mono font-medium">
            <ShoppingBag size={13} />
            <span>Ducate Verified Marketplace</span>
          </div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight">
            Curated Artisan Goods & Modern Hardware
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
            Trade with verified creators, discover authentic photography gear, handmade furniture, and boost your listings across feeds and stories.
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
              <span>Sell a Product</span>
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
              <span>Create Sponsored Ad</span>
            </button>

            {!currentUser.verified && (
              <button
                type="button"
                onClick={onOpenPayVerified}
                className="py-2.5 px-4 rounded-2xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-200 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <CheckCircle2 size={14} className="text-blue-400" />
                <span>Get 10K Verified Seller Badge</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      </div>

      {/* Search & Category Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-3 text-[#55635C]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products with AI (e.g. fuji camera, oak table, linen)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669] shadow-xs"
            />
          </div>

          <div className="text-xs text-[#55635C] font-mono shrink-0 px-1">
            Showing {filteredItems.length} items
          </div>
        </div>

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

      {marketplaceError && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{marketplaceError}</div>}

      {/* Product Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#D1E2D9] p-6 space-y-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto text-[#064E3B]">
            <ShoppingBag size={24} />
          </div>
          <p className="text-sm font-bold text-[#064E3B]">No listings found</p>
          <p className="text-xs text-[#55635C]">
            Try clearing your search or list your own product to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl border border-[#D1E2D9] overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col group"
            >
              {/* Product Image */}
              <div
                className="relative aspect-4/3 bg-black/5 overflow-hidden cursor-pointer"
                onClick={() => setSelectedItemDetail(item)}
              >
                <img
                  src={item.images[0]}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold">
                  {item.category}
                </span>
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md text-emerald-200 text-[10px] font-mono font-bold">
                  {item.condition}
                </span>
                {item.isSold && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                    <span className="px-4 py-1.5 rounded-2xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest shadow-lg">
                      SOLD
                    </span>
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[#064E3B] line-clamp-1 group-hover:text-[#059669] transition-colors">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-base sm:text-lg font-bold text-[#059669]">
                    {item.price.toLocaleString()} <span className="text-xs font-normal text-[#55635C]">{item.currency}</span>
                  </p>

                  <p className="text-xs text-[#55635C] line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#EDF3F0] space-y-3">
                  {/* Seller & Location */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
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
                    <button
                      type="button"
                      disabled={item.isSold}
                      onClick={() => handleContactSeller(item)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      <MessageSquare size={13} />
                      <span>Message Seller</span>
                    </button>

                    {item.seller.id === currentUser.id && !item.isSold && (
                      <button
                        type="button"
                        onClick={() => { void handleMarkItemAsSold(item); }}
                        className="py-2 px-3 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-[#064E3B] text-xs font-semibold transition-colors cursor-pointer"
                        title="Mark as Sold"
                      >
                        Mark Sold
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sell Product Modal */}
      {isSellModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg bg-[#F8FAF9] rounded-3xl border border-[#D1E2D9] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b border-[#D1E2D9] bg-white flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-[#064E3B] flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#059669]" />
                <span>List a Product on Ducate Marketplace</span>
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
                <label className="block text-xs font-bold text-[#064E3B] mb-1">
                  Product Title *
                </label>
                <input
                  type="text"
                  required
                  value={sellTitle}
                  onChange={(e) => setSellTitle(e.target.value)}
                  placeholder="E.g. Sony A7 IV Camera Body"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">
                    Price (RWF) *
                  </label>
                  <input
                    type="number"
                    required
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    placeholder="e.g. 450000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">
                    Category *
                  </label>
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
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">
                    Condition
                  </label>
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
                  <label className="block text-xs font-bold text-[#064E3B] mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={sellLocation}
                    onChange={(e) => setSellLocation(e.target.value)}
                    placeholder="Kigali, Nyarutarama"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#064E3B] mb-1">Product Photo *</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={isUploadingSellImage || isSubmittingItem}
                  onChange={(event) => { void handleSellImageUpload(event); }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs text-[#064E3B] file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-emerald-800" />
                {isUploadingSellImage && <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${sellUploadProgress}%` }} /></div>
                  <p className="text-[11px] text-[#55635C]">Optimizing and uploading photo · {sellUploadProgress}%</p>
                </div>}
                {sellImageUrl && !isUploadingSellImage && <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-2">
                  <img src={sellImageUrl} alt="Uploaded product" className="h-14 w-14 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1 text-[11px] text-emerald-800">Photo saved to Sodanox media storage</div>
                  <button type="button" onClick={() => setSellImageUrl('')} className="text-[11px] font-semibold text-red-700">Remove</button>
                </div>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#064E3B] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={sellDesc}
                  onChange={(e) => setSellDesc(e.target.value)}
                  placeholder="Detail specifications, accessories included, and condition notes..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                />
              </div>

              {sellError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{sellError}</p>}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingItem || isUploadingSellImage}
                  className="w-full py-3 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingItem ? 'Listing Item...' : 'Publish Product to Marketplace'}
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
                <span>Create Sponsored In-Feed or Story Ad</span>
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
                  <p className="text-xs text-[#55635C]">This campaign is pending moderation and is not live yet. No payment has been collected.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">
                      Ad Campaign Headline *
                    </label>
                    <input
                      type="text"
                      required
                      value={adTitle}
                      onChange={(e) => setAdTitle(e.target.value)}
                      placeholder="E.g. Nordic Architectural Wood Studio"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#064E3B] mb-1">
                        Ad Placement
                      </label>
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
                      <label className="block text-xs font-bold text-[#064E3B] mb-1">
                        Proposed Budget (RWF) · not charged on submission
                      </label>
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
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">
                      Media Image URL
                    </label>
                    <input
                      type="url"
                      value={adMediaUrl}
                      onChange={(e) => setAdMediaUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">
                      Call to Action Button Label
                    </label>
                    <input
                      type="text"
                      value={adCtaText}
                      onChange={(e) => setAdCtaText(e.target.value)}
                      placeholder="Shop Collection, Contact Studio, Inquire"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#064E3B] mb-1">
                      Ad Body Copy
                    </label>
                    <textarea
                      rows={3}
                      value={adDesc}
                      onChange={(e) => setAdDesc(e.target.value)}
                      placeholder="Highlight what makes your offer distinctive..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D1E2D9] text-xs sm:text-sm text-[#064E3B] focus:outline-none focus:border-[#059669]"
                    />
                  </div>

                  {adError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">{adError}</p>}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmittingAd}
                      className="w-full py-3 rounded-2xl bg-[#064E3B] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingAd ? 'Submitting Campaign...' : 'Submit Campaign for Review'}
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
