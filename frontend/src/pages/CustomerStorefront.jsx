import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Sparkles,
  Search,
  Send,
  Package,
  CheckCircle,
  Truck,
  Clock,
  ArrowRight,
  ShieldCheck,
  MessageCircle,
  RefreshCw,
  X,
  HelpCircle,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  MapPin,
  Phone,
  User,
  Mail,
  Eye,
  Flame,
  Zap,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sun,
  Tag,
  Percent,
  Check,
  Heart,
  Star,
  Share2,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Ruler,
  Award,
  Info,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { api, getProductImageUrl } from '../api/client';
import { ThemeToggle } from '../context/ThemeContext';
import ProductImageGalleryZoom from '../components/ProductImageGalleryZoom';
import SizeGuideModal from '../components/SizeGuideModal';
import PrintableInvoiceModal from '../components/PrintableInvoiceModal';
import WishlistDrawer from '../components/WishlistDrawer';
import PolicyModal from '../components/PolicyModal';

export const STOREFRONT_BASE_URL = 'https://ai-whatsapp-power-git-main-hamzachaudhary786s-projects.vercel.app';

export const extractProductIdFromUrl = () => {
  if (typeof window === 'undefined') return null;

  // 1. Check query parameters (?product=xyz or ?id=xyz)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('product') || urlParams.get('id');
    if (queryParam && queryParam.trim()) return queryParam.trim();
  } catch {}

  // 2. Check hash routing (#/product/xyz or #/xyz or #xyz)
  if (window.location.hash) {
    const cleanHash = window.location.hash.replace(/^#\/?/, '');
    const hashParts = cleanHash.split('/').filter(Boolean);
    if (hashParts.length > 0) {
      const candidate = hashParts[hashParts.length - 1];
      if (candidate && !['login', 'admin', 'console', 'storefront', 'cart'].includes(candidate.toLowerCase())) {
        return candidate.trim();
      }
    }
  }

  // 3. Check pathname (/<productId> or /product/<productId>)
  const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (cleanPath) {
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[parts.length - 1];
      if (
        candidate &&
        !['login', 'admin', 'console', 'storefront', 'cart', 'index.html', 'favicon.ico'].includes(candidate.toLowerCase()) &&
        !candidate.includes('.')
      ) {
        return candidate.trim();
      }
    }
  }

  return null;
};

export default function CustomerStorefront({ onStaffLoginClick, user, onLogout }) {
  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Continuous Online Recommendations & Smart Search State
  const [smartRecommendations, setSmartRecommendations] = useState([]);
  const [isSmartSearching, setIsSmartSearching] = useState(false);

  // Product Quick View & Complete The Look Modal State
  const [selectedProductModal, setSelectedProductModal] = useState(null);
  const [modalRelatedProducts, setModalRelatedProducts] = useState([]);
  const [modalLoadingRelated, setModalLoadingRelated] = useState(false);
  const [modalSelectedColor, setModalSelectedColor] = useState('');
  const [modalSelectedSize, setModalSelectedSize] = useState('');

  // Cart & Checkout State
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  // Customer "My Orders & Purchases" Hub State
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [myOrdersList, setMyOrdersList] = useState([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [myOrdersError, setMyOrdersError] = useState('');
  const [myOrdersPhone, setMyOrdersPhone] = useState(
    () => localStorage.getItem('luxe_customer_phone') || user?.phone || '+923001234567'
  );

  // Promotional Campaign State
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [dismissPromoBanner, setDismissPromoBanner] = useState(false);

  // Wishlist & Saved Outfits State
  const [wishlist, setWishlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('luxe_customer_wishlist') || '[]');
    } catch {
      return [];
    }
  });
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAccountMenuOpen]);

  const handleRemoveFromWishlist = (productOrId) => {
    const targetId = typeof productOrId === 'object' ? (productOrId.id || productOrId._id) : productOrId;
    setWishlist((prev) => {
      const updated = prev.filter((item) => (item.id || item._id) !== targetId);
      try {
        localStorage.setItem('luxe_customer_wishlist', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearWishlist = () => {
    setWishlist([]);
    try {
      localStorage.removeItem('luxe_customer_wishlist');
    } catch {}
  };

  const handleMoveAllWishlistToCart = () => {
    wishlist.forEach((item) => {
      addToCart(item);
    });
    handleClearWishlist();
    setIsWishlistOpen(false);
    setIsCartOpen(true);
  };

  const toggleWishlist = (product) => {
    if (!product) return;
    const targetId = typeof product === 'object' ? (product.id || product._id) : product;
    setWishlist((prev) => {
      const exists = prev.some((item) => (item.id || item._id) === targetId);
      let updated;
      if (exists) {
        updated = prev.filter((item) => (item.id || item._id) !== targetId);
      } else {
        updated = [...prev, product];
      }
      try {
        localStorage.setItem('luxe_customer_wishlist', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const isInWishlist = (productIdOrProduct) => {
    if (!productIdOrProduct) return false;
    const targetId = typeof productIdOrProduct === 'object'
      ? (productIdOrProduct.id || productIdOrProduct._id)
      : productIdOrProduct;
    return wishlist.some((item) => (item.id || item._id) === targetId);
  };

  // Modals: Size Guide, Tax Invoice & Policy Modals
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [activePolicyModal, setActivePolicyModal] = useState(null);

  // Catalog Sorting & Advanced Filtering
  const [sortBy, setSortBy] = useState('DEFAULT');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceFilterMax, setPriceFilterMax] = useState(50000);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Recently Viewed Outfits
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('luxe_recently_viewed') || '[]');
    } catch {
      return [];
    }
  });

  const trackProductView = (product) => {
    if (!product || !product.id) return;
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((p) => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('luxe_recently_viewed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Product Reviews & Ratings (in Quick View modal)
  const [productReviews, setProductReviews] = useState({
    average_rating: 5.0,
    total_reviews: 0,
    rating_breakdown: {},
    reviews: [],
  });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [newReviewForm, setNewReviewForm] = useState({
    name: user?.full_name || '',
    rating: 5,
    comment: '',
    city: user?.city || 'Lahore',
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState('');

  // Promo Code Voucher & Pakistan Delivery Pricing Engine
  const FREE_SHIPPING_THRESHOLD = 2999;
  const STANDARD_SHIPPING_FEE = 250;
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Self-Service Order Cancellation & 7-Day Return / Exchange
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('Size change / Ordered by mistake');
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const [orderToReturn, setOrderToReturn] = useState(null);
  const [returnReason, setReturnReason] = useState('Size does not fit properly');
  const [returnDetails, setReturnDetails] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

  // Checkout Form State (Dynamic per authenticated customer)
  const [checkoutForm, setCheckoutForm] = useState({
    fullName: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    streetAddress: user?.address || '',
    city: user?.city || 'Lahore',
    paymentMethod: 'COD',
  });

  // Automatically sync saved profile when authenticated customer logs in or switches accounts
  useEffect(() => {
    if (user) {
      setCheckoutForm({
        fullName: user.full_name || '',
        phone: user.phone || '',
        email: user.email || '',
        streetAddress: user.address || '',
        city: user.city || 'Lahore',
        paymentMethod: 'COD',
      });
    } else {
      let savedPhone = '';
      if (typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search);
          const p = params.get('phone');
          if (p && p.trim()) savedPhone = p.trim();
        } catch {
          // ignore
        }
        if (!savedPhone) {
          savedPhone = localStorage.getItem('luxe_customer_phone') || '';
        }
      }
      setCheckoutForm({
        fullName: '',
        phone: savedPhone,
        email: '',
        streetAddress: '',
        city: 'Lahore',
        paymentMethod: 'COD',
      });
    }
  }, [user?.id, user?.email, user?.phone, user?.full_name]);

  // AI Stylist Chat & Isolated Conversation State (Per-Customer Isolated Storage)
  const getChatStorageKey = (currentUser) => {
    if (currentUser?.id) return `luxe_aria_chat_user_${currentUser.id}`;
    if (currentUser?.email) return `luxe_aria_chat_email_${currentUser.email}`;
    return 'luxe_aria_chat_guest';
  };

  const defaultGreeting = {
    sender: 'stylist',
    text: "👋 Hello! I am Aria, your AI Fashion Stylist. I can recommend outfits, check sizes, or track your orders in English or Urdu! How can I style you today? ✨",
  };

  const loadInitialChat = (u) => {
    try {
      const key = getChatStorageKey(u);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved chat history:', e);
    }
    return [defaultGreeting];
  };

  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState(() => loadInitialChat(user));

  // Human Staff Live Assignment State (By default NULL -> AI Stylist Aria is assigned)
  const [assignedStaff, setAssignedStaff] = useState(null);

  // When customer signs up, logs in, or switches accounts:
  // 1. Isolate and switch chat history strictly to this customer
  // 2. Ensure default AI Stylist (Aria) is assigned (not live human agent)
  useEffect(() => {
    setChatHistory(loadInitialChat(user));
    setAssignedStaff(null);
  }, [user?.id, user?.email]);

  // Save conversation history to customer's specific storage key across page refreshes
  useEffect(() => {
    try {
      const key = getChatStorageKey(user);
      localStorage.setItem(key, JSON.stringify(chatHistory));
    } catch (e) {
      console.warn('Failed to save chat history to localStorage:', e);
    }
  }, [chatHistory, user?.id, user?.email]);

  const handleClearChatHistory = () => {
    try {
      const key = getChatStorageKey(user);
      localStorage.removeItem(key);
    } catch {}
    setChatHistory([defaultGreeting]);
    setAssignedStaff(null);
    setChatOrderForm((prev) => ({ ...prev, isOpen: false }));
  };

  const cleanChatMessageText = (text) => {
    if (!text) return '';
    let cleaned = String(text).replace(/\*\*/g, '');
    // Strip out any raw photo lines or direct image URLs from chat text
    cleaned = cleaned.replace(/📸\s*\*?Product Photo:\*?\s*https?:\/\/[^\s]+/gi, '');
    cleaned = cleaned.replace(/https?:\/\/[^\s]+(?:\.(?:png|jpe?g|webp|gif|svg)|unsplash\.com[^\s]*)/gi, '');
    return cleaned.trim();
  };

  // Live Sync Chat with Staff Live Inbox (Auto-syncs ONLY for valid customer phone)
  useEffect(() => {
    let isMounted = true;
    const phoneToSync = user?.phone || checkoutForm?.phone;

    // DO NOT poll any demo phone if customer is a guest or has not provided a phone number yet
    if (!phoneToSync || !phoneToSync.trim()) {
      setAssignedStaff(null);
      return;
    }

    const syncChat = async () => {
      try {
        const syncData = await api.syncStylistChat(phoneToSync);
        if (!isMounted || !syncData) return;

        if (syncData.is_assigned_to_staff) {
          setAssignedStaff({
            isAssigned: true,
            staffName: syncData.staff_name || 'Senior Boutique Stylist',
          });
        } else {
          setAssignedStaff(null);
        }

        if (syncData.messages && syncData.messages.length > 0) {
          setChatHistory((prev) => {
            const staffBackendMsgs = syncData.messages.filter((m) => m.sender === 'staff');
            if (staffBackendMsgs.length === 0) return prev;

            const existingTexts = new Set(prev.map((m) => m.text));
            const newStaffMsgs = staffBackendMsgs.filter((m) => !existingTexts.has(m.text));

            if (newStaffMsgs.length === 0) return prev;

            const appended = newStaffMsgs.map((m) => ({
              sender: 'staff',
              staff_name: m.staff_name || 'Senior Boutique Stylist',
              text: m.text,
            }));

            return [...prev, ...appended];
          });
        }
      } catch {
        // Silently catch background poll error
      }
    };

    syncChat();
    const interval = setInterval(syncChat, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user?.phone, checkoutForm?.phone]);

  const handleSwitchToAi = async () => {
    try {
      const phoneToUse = user?.phone || checkoutForm?.phone;
      if (phoneToUse) {
        await api.switchStylistToAi(phoneToUse);
      }
      setAssignedStaff(null);
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'stylist',
          text: "✨ You are now reconnected with Aria, your AI Fashion Stylist! How can I style you today?",
        },
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRequestHumanStaff = async () => {
    handleSendChatMessage("I would like to speak with a human senior stylist, please connect me.");
  };

  // Embedded In-Chat Interactive Order Form State
  const [chatOrderForm, setChatOrderForm] = useState({
    isOpen: false,
    productId: null,
    productName: '',
    price: 0,
    imageUrl: '',
    availableColors: [],
    availableSizes: [],
    variants: [],
    color: '',
    size: '',
    quantity: 1,
    fullName: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    address: user?.address || '',
    city: user?.city || 'Lahore',
    submitting: false,
    error: '',
  });

  const getProductPricing = (p) => {
    if (!p) {
      return {
        isOnSale: false,
        effectivePrice: 79.99,
        originalPrice: 79.99,
        discountPercent: 0,
        saleTag: null,
        promoCode: null,
        season: null,
        isTrending: false,
      };
    }
    let regularPrice = 79.99;
    if (p.variants && p.variants.length > 0) {
      regularPrice = Math.min(...p.variants.map((v) => v.price));
    } else if (typeof p.price === 'number') {
      regularPrice = p.price;
    } else if (p.min_price) {
      regularPrice = p.min_price;
    } else if (typeof p.price === 'string') {
      regularPrice = parseFloat(p.price.replace(/[^0-9.]/g, '')) || 79.99;
    }

    const discPercent = Number(p.discount_percent) || 0;
    const salePriceVal = Number(p.sale_price) || 0;

    let isOnSale = false;
    let effectivePrice = regularPrice;
    let originalPrice = regularPrice;
    let finalDiscPercent = 0;

    if (discPercent > 0) {
      isOnSale = true;
      finalDiscPercent = discPercent;
      effectivePrice = Number((regularPrice * (1 - discPercent / 100)).toFixed(2));
      originalPrice = regularPrice;
    } else if (salePriceVal > 0 && salePriceVal < regularPrice) {
      isOnSale = true;
      effectivePrice = salePriceVal;
      originalPrice = regularPrice;
      finalDiscPercent = Math.round(((regularPrice - salePriceVal) / regularPrice) * 100);
    } else {
      // If discount is 0 or no sale: product price is exact regular price
      isOnSale = false;
      effectivePrice = regularPrice;
      originalPrice = regularPrice;
      finalDiscPercent = 0;
    }

    return {
      isOnSale,
      effectivePrice,
      originalPrice,
      discountPercent: finalDiscPercent,
      saleTag: isOnSale ? (p.sale_tag || `${finalDiscPercent}% OFF`) : null,
      promoCode: p.promo_code || null,
      season: p.season || null,
      isTrending: Boolean(p.is_trending),
    };
  };

  const openChatOrderForm = (productInfo = {}, initialSize = null, initialColor = null) => {
    // 1. Match full product from catalog to ensure full variant & color/size accuracy
    const matched = products.find(
      (p) =>
        (productInfo.id && p.id === productInfo.id) ||
        (productInfo._id && p.id === productInfo._id) ||
        (productInfo.product_id && p.id === productInfo.product_id) ||
        (productInfo.name && p.name.toLowerCase() === productInfo.name.toLowerCase()) ||
        (productInfo.name && (p.name.toLowerCase().includes(productInfo.name.toLowerCase()) || productInfo.name.toLowerCase().includes(p.name.toLowerCase())))
    );

    const mergedProduct = { ...(matched || {}), ...(productInfo || {}) };
    if ((!mergedProduct.variants || mergedProduct.variants.length === 0) && matched?.variants?.length > 0) {
      mergedProduct.variants = matched.variants;
    }

    const pName = mergedProduct.name || productInfo.name || 'Boutique Designer Piece';
    const pricing = getProductPricing(mergedProduct);
    const pPrice = pricing.effectivePrice || (typeof mergedProduct.price === 'number' ? mergedProduct.price : (parseFloat(String(mergedProduct.price || '').replace(/[^0-9.]/g, '')) || 79.99));
    const pImg =
      getProductImageUrl(mergedProduct.image_urls?.[0] || mergedProduct.image_url) ||
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80';

    // 2. Extract Available Colors strictly according to the product
    let rawColors = [];
    if (mergedProduct.variants && mergedProduct.variants.length > 0) {
      rawColors = mergedProduct.variants.map((v) => v.color).filter(Boolean);
    }
    if (rawColors.length === 0 && mergedProduct.colors) {
      if (Array.isArray(mergedProduct.colors)) {
        rawColors = mergedProduct.colors;
      } else if (typeof mergedProduct.colors === 'string') {
        rawColors = mergedProduct.colors.split(',').map((c) => c.trim()).filter(Boolean);
      }
    }
    if (rawColors.length === 0 && mergedProduct.color) {
      rawColors = [mergedProduct.color];
    }
    const colors = Array.from(new Set(rawColors.map((c) => c.trim()).filter(Boolean)));

    // 3. Extract Available Sizes strictly according to the product
    let rawSizes = [];
    if (mergedProduct.variants && mergedProduct.variants.length > 0) {
      rawSizes = mergedProduct.variants.map((v) => v.size).filter(Boolean);
    }
    if (rawSizes.length === 0 && mergedProduct.sizes) {
      if (Array.isArray(mergedProduct.sizes)) {
        rawSizes = mergedProduct.sizes;
      } else if (typeof mergedProduct.sizes === 'string') {
        rawSizes = mergedProduct.sizes.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      }
    }
    if (rawSizes.length === 0 && mergedProduct.size) {
      rawSizes = [mergedProduct.size];
    }
    const sizes = Array.from(new Set(rawSizes.map((s) => s.trim().toUpperCase()).filter(Boolean)));

    const availableColors = colors.length > 0 ? colors : ['Standard'];
    const availableSizes = sizes.length > 0 ? sizes : ['Standard'];

    // Select color: priority to passed initialColor -> product color -> first available
    let chosenColor = availableColors[0];
    if (initialColor && availableColors.some((c) => c.toLowerCase() === initialColor.toLowerCase())) {
      chosenColor = availableColors.find((c) => c.toLowerCase() === initialColor.toLowerCase());
    } else if (mergedProduct.color && availableColors.some((c) => c.toLowerCase() === mergedProduct.color.toLowerCase())) {
      chosenColor = availableColors.find((c) => c.toLowerCase() === mergedProduct.color.toLowerCase());
    }

    // Filter sizes for chosenColor if variants exist
    const sizesForColor = mergedProduct.variants && mergedProduct.variants.length > 0
      ? Array.from(new Set(mergedProduct.variants.filter((v) => !chosenColor || chosenColor === 'Standard' || !v.color || v.color.toLowerCase() === chosenColor.toLowerCase()).map((v) => v.size).filter(Boolean)))
      : availableSizes;
    const effectiveSizes = sizesForColor.length > 0 ? sizesForColor : availableSizes;

    // Select size: priority to passed initialSize -> M if present -> first available
    let chosenSize = effectiveSizes[0];
    if (initialSize && effectiveSizes.some((s) => s.toUpperCase() === initialSize.toUpperCase())) {
      chosenSize = effectiveSizes.find((s) => s.toUpperCase() === initialSize.toUpperCase());
    } else if (effectiveSizes.includes('M')) {
      chosenSize = 'M';
    }

    // Find price of chosen variant if available
    const matchingVariant = mergedProduct.variants?.find(
      (v) =>
        (!chosenColor || chosenColor === 'Standard' || !v.color || v.color.toLowerCase() === chosenColor.toLowerCase()) &&
        (!chosenSize || chosenSize === 'Standard' || !v.size || v.size.toUpperCase() === chosenSize.toUpperCase())
    );
    const finalPrice = matchingVariant?.price || pPrice;

    setChatOrderForm({
      isOpen: true,
      productId: mergedProduct.id || mergedProduct._id || null,
      productName: pName,
      price: finalPrice,
      imageUrl: pImg,
      variants: mergedProduct.variants || [],
      availableColors: availableColors,
      availableSizes: availableSizes,
      color: chosenColor,
      size: chosenSize,
      quantity: 1,
      fullName: checkoutForm.fullName || user?.full_name || '',
      phone: checkoutForm.phone || user?.phone || '',
      email: checkoutForm.email || user?.email || '',
      address: checkoutForm.streetAddress || user?.address || '',
      city: checkoutForm.city || user?.city || 'Lahore',
      submitting: false,
      error: '',
    });

    setTimeout(() => {
      const formEl = document.querySelector('.in-chat-order-form');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
  };

  const handleConfirmInChatOrder = async (e) => {
    if (e) e.preventDefault();
    if (!chatOrderForm.fullName?.trim()) {
      setChatOrderForm((prev) => ({ ...prev, error: 'Baraye meharbani apna Full Name darj karein.' }));
      return;
    }
    if (!chatOrderForm.phone?.trim()) {
      setChatOrderForm((prev) => ({ ...prev, error: 'Baraye meharbani Phone Number darj karein.' }));
      return;
    }
    if (!chatOrderForm.address?.trim()) {
      setChatOrderForm((prev) => ({ ...prev, error: 'Baraye meharbani Delivery Address darj karein.' }));
      return;
    }
    if (!chatOrderForm.city?.trim()) {
      setChatOrderForm((prev) => ({ ...prev, error: 'Baraye meharbani apna Shehar (City) darj karein.' }));
      return;
    }

    setChatOrderForm((prev) => ({ ...prev, submitting: true, error: '' }));

    try {
      const subtotal = chatOrderForm.price * chatOrderForm.quantity;
      const matchingVariant = chatOrderForm.variants?.find(
        (v) =>
          (!chatOrderForm.color || chatOrderForm.color === 'Standard' || !v.color || v.color.toLowerCase() === chatOrderForm.color.toLowerCase()) &&
          (!chatOrderForm.size || chatOrderForm.size === 'Standard' || !v.size || v.size.toUpperCase() === chatOrderForm.size.toUpperCase())
      );

      const orderPayload = {
        customer_id: user?.id || 'guest',
        items: [
          {
            product_id: chatOrderForm.productId || 'atelier-piece',
            variant_id: matchingVariant?.id || null,
            name: chatOrderForm.productName,
            sku: matchingVariant?.sku || 'LUXE-CHAT-COD',
            unit_price: chatOrderForm.price,
            quantity: chatOrderForm.quantity,
            total_price: subtotal,
            image_url: chatOrderForm.imageUrl,
            color: chatOrderForm.color,
            size: chatOrderForm.size,
          },
        ],
        subtotal: subtotal,
        delivery_fee: 0.0,
        total: subtotal,
        currency: 'PKR',
        address_snapshot: {
          full_name: chatOrderForm.fullName.trim(),
          phone: chatOrderForm.phone.trim(),
          email: chatOrderForm.email?.trim() || null,
          street_address: chatOrderForm.address.trim(),
          city: chatOrderForm.city.trim(),
          country: 'Pakistan',
        },
      };

      const res = await api.createOrder(orderPayload);
      loadStorefrontData();

      const confirmBubble = {
        sender: 'stylist',
        text: `🎉 Mubarak ${chatOrderForm.fullName.trim()}! Aapka order successfully place ho gaya hai! ✨\n\n` +
              `📦 Order Number: #${res.order_number}\n` +
              `👗 Item: ${chatOrderForm.productName}\n` +
              `🎨 Color: ${chatOrderForm.color} | 📏 Size: ${chatOrderForm.size} | 🔢 Quantity: ${chatOrderForm.quantity}\n` +
              `🏷️ Total Amount: PKR ${subtotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Complimentary Free Express Delivery 🚚)\n` +
              `📍 Delivery Destination: ${chatOrderForm.address.trim()}, ${chatOrderForm.city.trim()}\n` +
              `💵 Payment Method: Cash on Delivery (COD)\n\n` +
              `Hamari boutique team aapka package courier ke liye prepare kar rahi hai! Aapka order track karne ke liye status neechay active hai. 📦👗`,
        order_created: true,
        order: res,
      };

      setChatHistory((prev) => [...prev, confirmBubble]);
      setTrackQuery(res.order_number);
      setTrackingResult(res);
      setCheckoutForm((prev) => ({
        ...prev,
        fullName: chatOrderForm.fullName.trim(),
        phone: chatOrderForm.phone.trim(),
        email: chatOrderForm.email?.trim() || prev.email,
        streetAddress: chatOrderForm.address.trim(),
        city: chatOrderForm.city.trim(),
      }));

      if (chatOrderForm.phone) {
        const ph = chatOrderForm.phone.trim();
        localStorage.setItem('luxe_customer_phone', ph);
        setMyOrdersPhone(ph);
        api.getCustomerOrders(ph).then((ords) => { if (Array.isArray(ords)) setMyOrdersList(ords); }).catch(() => {});
      }

      setChatOrderForm((prev) => ({ ...prev, isOpen: false, submitting: false }));
    } catch (err) {
      setChatOrderForm((prev) => ({
        ...prev,
        submitting: false,
        error: err.message || 'Order place karne mein masla aya. Baraye meharbani dobara try karein.',
      }));
    }
  };

  // Order Tracking State
  const [trackQuery, setTrackQuery] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  // Customer "My Orders & Purchases" Open & Fetch Handler
  const handleOpenMyOrders = async (overridePhone = null) => {
    const targetPhone = (overridePhone || myOrdersPhone || checkoutForm.phone || user?.phone || '').trim();
    setIsMyOrdersOpen(true);
    setMyOrdersError('');
    if (!targetPhone || targetPhone.length < 7) {
      return;
    }
    setMyOrdersLoading(true);
    try {
      const orders = await api.getCustomerOrders(targetPhone);
      setMyOrdersList(orders || []);
      localStorage.setItem('luxe_customer_phone', targetPhone);
      setMyOrdersPhone(targetPhone);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      setMyOrdersError('Could not retrieve orders for this number. Please check phone format.');
    } finally {
      setMyOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadStorefrontData();
    const savedPhone = localStorage.getItem('luxe_customer_phone') || user?.phone;
    if (savedPhone && savedPhone.length >= 7) {
      api.getCustomerOrders(savedPhone)
        .then((ords) => {
          if (Array.isArray(ords)) setMyOrdersList(ords);
        })
        .catch(() => {});
    }
  }, []);

  // Auto deep-link: if customer accessed URL with product ID (e.g. /prod_xxx or ?product=xxx), auto-open product modal
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    const targetId = extractProductIdFromUrl();
    if (!targetId || hasAutoOpenedRef.current) return;

    if (products && products.length > 0) {
      const match = products.find(
        (p) => String(p.id) === targetId || String(p._id) === targetId || p.slug === targetId
      );
      if (match) {
        hasAutoOpenedRef.current = true;
        handleOpenProductDetails(match);
        return;
      }
    }

    if (!loading) {
      api.getProduct(targetId)
        .then((directProd) => {
          if (directProd && (directProd.id || directProd._id)) {
            hasAutoOpenedRef.current = true;
            handleOpenProductDetails(directProd);
          }
        })
        .catch((err) => {
          console.warn('Could not auto-load product by URL identifier:', targetId, err);
        });
    }
  }, [products, loading]);

  // Continuous Online Recommender: Live Semantic Search on Query Change
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSmartRecommendations([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSmartSearching(true);
      try {
        const recs = await api.smartSearch(searchQuery.trim(), checkoutForm.phone);
        setSmartRecommendations(recs || []);
      } catch (err) {
        console.error('Smart search failed:', err);
      } finally {
        setIsSmartSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, checkoutForm.phone]);

  const loadStorefrontData = async () => {
    setLoading(true);
    try {
      const [prods, cats, faqData, promo] = await Promise.all([
        api.getProducts().catch(() => []),
        api.getCategories().catch(() => []),
        api.getFaqs().catch(() => []),
        api.getActiveCampaign().catch(() => null),
      ]);
      setProducts(prods);
      setDbCategories(cats);
      setFaqs(faqData);
      setActiveCampaign(promo);
    } catch (e) {
      console.error('Failed to load storefront data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Open Product Quick View & fetch complementary styles
  const handleOpenProductDetails = async (product) => {
    if (!product) return;
    setSelectedProductModal(product);
    trackProductView(product);

    // Sync direct product URL in address bar without full page reload
    if (typeof window !== 'undefined' && product.id) {
      const targetPath = `/${product.id}`;
      if (window.location.pathname !== targetPath) {
        window.history.replaceState(null, '', targetPath);
      }
    }

    const colors = product.variants ? Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))) : [];
    const sizes = product.variants ? Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean))) : [];
    setModalSelectedColor(colors[0] || '');
    setModalSelectedSize(sizes[0] || '');
    setModalLoadingRelated(true);
    setModalRelatedProducts([]);

    // Fetch live product reviews
    setLoadingReviews(true);
    setIsWriteReviewOpen(false);
    setReviewSuccess('');
    api.getProductReviews(product.id)
      .then((data) => setProductReviews(data))
      .catch(() => setProductReviews({ average_rating: 5.0, total_reviews: 0, rating_breakdown: {}, reviews: [] }))
      .finally(() => setLoadingReviews(false));

    try {
      // 1. Online Learning: Track product view
      api.logInteraction({
        event_type: 'view_details',
        product_id: product.id,
        phone: checkoutForm.phone,
      });

      // 2. Fetch complementary cross-sells
      const related = await api.getRelatedProducts(product.id, checkoutForm.phone);
      setModalRelatedProducts(related || []);
    } catch (e) {
      console.error('Failed to load related outfits:', e);
    } finally {
      setModalLoadingRelated(false);
    }
  };

  const handleCloseProductDetails = () => {
    setSelectedProductModal(null);
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }
  };

  const getWhatsAppShareUrl = (product) => {
    if (!product) return '#';
    const priceText = product.sale_price ? `PKR ${product.sale_price}` : `PKR ${product.min_price || product.price || 14000}`;
    const productUrl = `${STOREFRONT_BASE_URL}/${product.id}`;
    const text = `Hey! Check out this gorgeous outfit from Luxe Atelier:\n✨ *${product.name}*\n🏷️ Price: ${priceText}\n👗 Category: ${product.category}\n🌐 Discover online: ${productUrl}`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedProductModal || !newReviewForm.comment.trim()) return;
    setReviewSubmitting(true);
    setReviewSuccess('');
    try {
      await api.submitProductReview(selectedProductModal.id, {
        customer_name: newReviewForm.name.trim() || user?.full_name || 'Verified Shopper',
        rating: Number(newReviewForm.rating) || 5,
        comment: newReviewForm.comment.trim(),
        city: newReviewForm.city?.trim() || user?.city || 'Lahore',
        verified_purchase: true,
      });
      const updated = await api.getProductReviews(selectedProductModal.id);
      setProductReviews(updated);
      setReviewSuccess('Shukriya! Your verified review has been published.');
      setIsWriteReviewOpen(false);
      setNewReviewForm((prev) => ({ ...prev, comment: '' }));
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleMoveWishlistToCart = (product) => {
    addToCart(product);
    toggleWishlist(product);
  };

  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const res = await api.validateCoupon(couponInput.trim(), cartSubtotal);
      if (res.valid) {
        setAppliedCoupon(res);
      } else {
        setCouponError(res.message || 'Invalid coupon code');
        setAppliedCoupon(null);
      }
    } catch (err) {
      setCouponError(err.message || 'Failed to validate voucher code');
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleCancelOrderSubmit = async (e) => {
    e.preventDefault();
    if (!orderToCancel) return;
    setCancellingOrder(true);
    setCancelError('');
    try {
      const res = await api.cancelCustomerOrder(
        orderToCancel.order_number || orderToCancel.id,
        myOrdersPhone,
        cancelReason
      );
      setMyOrdersList((prev) =>
        prev.map((o) => (o.id === res.id || o.order_number === res.order_number ? res : o))
      );
      setOrderToCancel(null);
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel order.');
    } finally {
      setCancellingOrder(false);
    }
  };

  const handleReturnOrderSubmit = async (e) => {
    e.preventDefault();
    if (!orderToReturn) return;
    setSubmittingReturn(true);
    setReturnError('');
    try {
      const res = await api.requestOrderReturn(
        orderToReturn.order_number || orderToReturn.id,
        myOrdersPhone,
        returnReason,
        returnDetails
      );
      setMyOrdersList((prev) =>
        prev.map((o) => (o.id === res.id || o.order_number === res.order_number ? res : o))
      );
      setOrderToReturn(null);
      setReturnDetails('');
    } catch (err) {
      setReturnError(err.message || 'Failed to submit return request.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Cart Operations
  const addToCart = (product, customVariant = null) => {
    const pricing = getProductPricing(product);
    let price = pricing.effectivePrice;
    let variantId =
      customVariant?.id ||
      (product.variants && product.variants.length > 0
        ? product.variants[0].id
        : null);
    let sku =
      customVariant?.sku ||
      (product.variants && product.variants.length > 0
        ? product.variants[0].sku
        : 'LUXE-DEFAULT');
    if (customVariant?.price) {
      price = customVariant.price;
    }

    // Continuous Online Learning: Track cart conversion signal
    api.logInteraction({
      event_type: 'add_to_cart',
      product_id: product.id,
      phone: checkoutForm.phone,
    });

    setCart((prev) => {
      const matchKey = (item) => item.product.id === product.id && item.variantId === variantId;
      const existing = prev.find(matchKey);
      if (existing) {
        return prev.map((item) =>
          matchKey(item)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product,
          variantId,
          sku,
          price,
          quantity: 1,
          selectedColor: customVariant?.color || modalSelectedColor,
          selectedSize: customVariant?.size || modalSelectedSize,
        },
      ];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            const maxStock = item.available_quantity || 15;
            if (delta > 0 && newQty > maxStock) return item;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const couponDiscount = appliedCoupon ? Math.min(appliedCoupon.discount_amount, cartSubtotal) : 0;
  const discountedSubtotal = Math.max(0, cartSubtotal - couponDiscount);
  const deliveryFee = cartSubtotal === 0 || cartSubtotal >= FREE_SHIPPING_THRESHOLD ? 0.0 : STANDARD_SHIPPING_FEE;
  const cartTotal = discountedSubtotal + deliveryFee;
  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Handle Instant Checkout Submission
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const orderPayload = {
        customer_id: user?.id || user?._id || 'guest',
        items: cart.map((item) => ({
          product_id: item.product.id || item.product._id,
          variant_id: item.variantId || null,
          name: item.product.name,
          sku: item.sku || 'STORE-SKU',
          unit_price: item.price,
          quantity: item.quantity,
          total_price: item.price * item.quantity,
          color: item.selectedColor || item.color || 'Standard',
          size: item.selectedSize || item.size || 'Standard',
        })),
        subtotal: cartSubtotal,
        coupon_code: appliedCoupon?.code || null,
        discount_amount: couponDiscount,
        delivery_fee: deliveryFee,
        total: cartTotal,
        currency: 'PKR',
        address_snapshot: {
          full_name: (checkoutForm.fullName || '').trim(),
          phone: (checkoutForm.phone || '').trim(),
          email: checkoutForm.email?.trim() || null,
          street_address: (checkoutForm.streetAddress || '').trim(),
          city: (checkoutForm.city || 'Lahore').trim(),
          country: 'Pakistan',
        },
      };

      const res = await api.createOrder(orderPayload);
      loadStorefrontData();
      setConfirmedOrder(res);
      setCart([]);
      setAppliedCoupon(null);
      setCouponInput('');
      setIsCheckoutOpen(false);
      setIsCartOpen(false);

      if (checkoutForm.phone) {
        const ph = checkoutForm.phone.trim();
        localStorage.setItem('luxe_customer_phone', ph);
        setMyOrdersPhone(ph);
        api.getCustomerOrders(ph).then((ords) => { if (Array.isArray(ords)) setMyOrdersList(ords); }).catch(() => {});
      }

      // Add order confirmation message directly to AI Stylist chat history
      const itemsSummary = orderPayload.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
      const emailNote = checkoutForm.email?.trim() ? `\n📧 Confirmation Email: Sent to ${checkoutForm.email.trim()}` : '';
      const confirmBubble = {
        sender: 'stylist',
        text: `🎉 Mubarak ${checkoutForm.fullName.trim()}! Your order has been placed successfully! ✨\n\n` +
              `📦 Order Number / ID: #${res.order_number}\n` +
              `👗 Items: ${itemsSummary}\n` +
              `🏷️ Total Amount: PKR ${cartTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Complimentary Free Express Delivery 🚚)\n` +
              `📍 Delivery Destination: ${checkoutForm.streetAddress.trim()}, ${checkoutForm.city.trim()}\n` +
              `💵 Payment Method: Cash on Delivery (COD)${emailNote}\n\n` +
              `Hamari boutique atelier team aapka package courier ke liye prepare kar rahi hai! Aap apna order kabhi bhi track kar sakti hain with Order ID #${res.order_number}. 📦👗`,
        order_created: true,
        order: res,
      };
      setChatHistory((prev) => [...prev, confirmBubble]);

      // Auto populate and show order tracker with the new order ID
      setTrackQuery(res.order_number);
      setTrackingResult(res);
    } catch (err) {
      setCheckoutError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSendChatMessage = async (msgText = chatInput) => {
    const textToSend = msgText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const userMsg = { sender: 'user', text: textToSend };
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const historyPayload = updatedHistory.slice(-15).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const customerPhone = user?.phone || checkoutForm.phone || null;
      const res = await api.chatWithStylist(
        textToSend,
        customerPhone,
        historyPayload
      );

      if (res.is_assigned_to_staff) {
        setAssignedStaff({
          isAssigned: true,
          staffName: res.staff_name || 'Senior Boutique Stylist',
        });
      } else {
        setAssignedStaff(null);
      }

      setChatHistory((prev) => [
        ...prev,
        {
          sender: res.is_assigned_to_staff ? 'staff' : 'stylist',
          staff_name: res.staff_name || 'Senior Boutique Stylist',
          text:
            res.stylist_response ||
            'Thank you for reaching out! How else can I assist your styling today?',
          order_created: res.order_created,
          order: res.order,
          product_action: res.product_action,
          image_url: res.image_url || res.product_action?.image_url,
          relevant_products: res.relevant_products || [],
          conversion_nudge: res.conversion_nudge || null,
        },
      ]);

      // If an order was autonomously created by Aria, sync live order tracker immediately
      if (res.order_created && res.order) {
        setTrackQuery(res.order.order_number);
        setTrackingResult(res.order);
      } else if (res.product_action && res.stylist_response && res.stylist_response.includes('BOUTIQUE ORDER DETAILS')) {
        // Automatically open the in-chat order form for convenience
        openChatOrderForm(res.product_action);
      }
    } catch {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: 'stylist',
          text:
            'I am styling your wardrobe! You can also reach our boutique desk anytime.',
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleTrackOrder = async (e, overrideId = null) => {
    if (e) e.preventDefault();
    const query = overrideId || trackQuery;
    if (!query || !query.trim()) return;

    setTrackLoading(true);
    setTrackError('');
    setTrackingResult(null);

    try {
      // 1. Check live multi-carrier courier tracking first
      const courierRes = await api.trackCourier(query.trim()).catch(() => null);
      if (courierRes) {
        setTrackingResult({
          ...courierRes,
          status: courierRes.current_status,
          total: courierRes.cod_amount,
          currency: courierRes.currency || 'PKR',
          address_snapshot: {
            city: courierRes.recipient?.city,
            country: 'Pakistan',
            street_address: courierRes.recipient?.address,
          },
        });
        setTrackQuery(query.trim());
        return;
      }

      // 2. Fallback to order details
      const res = await api.getOrder(query.trim());
      setTrackingResult(res);
      setTrackQuery(query.trim());
    } catch {
      setTrackError(`Could not find order or tracking #${query}. Please verify your Order # or Consignment Number.`);
    } finally {
      setTrackLoading(false);
    }
  };

  const categories = [
    'ALL',
    ...new Set([
      ...dbCategories.map((c) => c.name),
      ...products.map((p) => p.category),
    ].filter(Boolean)),
  ];

  const filteredProducts = products
    .filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;
      const matchSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const pPrice = Number(p.sale_price || p.min_price || p.price || 0);
      const matchPrice = pPrice <= priceFilterMax;
      const matchStock = !inStockOnly || (p.total_stock && p.total_stock > 0);
      return matchCat && matchSearch && matchPrice && matchStock;
    })
    .sort((a, b) => {
      const priceA = Number(a.sale_price || a.min_price || a.price || 0);
      const priceB = Number(b.sale_price || b.min_price || b.price || 0);
      if (sortBy === 'PRICE_LOW_HIGH') return priceA - priceB;
      if (sortBy === 'PRICE_HIGH_LOW') return priceB - priceA;
      if (sortBy === 'NEWEST') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      if (sortBy === 'DISCOUNT') return (b.discount_percent || 0) - (a.discount_percent || 0);
      if (sortBy === 'TRENDING') {
        const aSales = Number(a.sales_count || 0);
        const bSales = Number(b.sales_count || 0);
        if (bSales !== aSales) return bSales - aSales;
        const aOrders = Number(a.order_count || 0);
        const bOrders = Number(b.order_count || 0);
        if (bOrders !== aOrders) return bOrders - aOrders;
        const aScore = Number(a.trending_score || (a.is_trending ? 10 : 0));
        const bScore = Number(b.trending_score || (b.is_trending ? 10 : 0));
        return bScore - aScore;
      }
      return 0;
    });

  const searchSuggestions = searchQuery.trim().length >= 2
    ? products
        .filter((p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  // Curated Collections: Sale, Summer Edition, and Trending
  const saleProducts = products.filter(
    (p) => p.is_on_sale || (p.discount_percent && p.discount_percent > 0) || (p.sale_price && p.sale_price > 0)
  );

  const summerProducts = products.filter((p) => {
    const season = (p.season || '').toLowerCase();
    if (season === 'summer') return true;
    const text = `${p.name} ${p.description || ''} ${p.category || ''}`.toLowerCase();
    return /summer|linen|cotton|chiffon|lawn|breezy|sundress|floral|kurti|camisole|sleeveless/i.test(text);
  });

  // Data-Driven Trending / Bestseller Ranking (ML & Sales Order Velocity):
  // 1. Highest sales_count first (e.g. 10 sales, 6 sales, 3 sales...)
  // 2. Highest order_count next
  // 3. Highest ML trending_score next
  // 4. Products marked is_trending: true
  const trendingProducts = [...products]
    .sort((a, b) => {
      const aSales = Number(a.sales_count || 0);
      const bSales = Number(b.sales_count || 0);
      if (bSales !== aSales) return bSales - aSales;

      const aOrders = Number(a.order_count || 0);
      const bOrders = Number(b.order_count || 0);
      if (bOrders !== aOrders) return bOrders - aOrders;

      const aScore = Number(a.trending_score || (a.is_trending ? 10 : 0));
      const bScore = Number(b.trending_score || (b.is_trending ? 10 : 0));
      if (bScore !== aScore) return bScore - aScore;

      return (b.is_trending ? 1 : 0) - (a.is_trending ? 1 : 0);
    })
    .filter((p) => (p.sales_count > 0 || p.order_count > 0 || p.is_trending || (p.total_stock && p.total_stock > 0)))
    .slice(0, 12);

  const renderCuratedShelf = (title, subtitle, icon, badgeText, badgeColor, items, shelfId) => {
    if (!items || items.length === 0) return null;
    return (
      <section id={shelfId} className="curated-shelf-section">
        <div className="curated-shelf-header">
          <div className="shelf-header-left">
            <div className="shelf-icon-wrap" style={{ color: badgeColor }}>
              {icon}
            </div>
            <div>
              <div className="shelf-title-row">
                <h3 className="shelf-title">{title}</h3>
                {badgeText && (
                  <span className="shelf-badge-pill" style={{ borderColor: badgeColor, color: badgeColor }}>
                    {badgeText}
                  </span>
                )}
              </div>
              <p className="shelf-subtitle">{subtitle}</p>
            </div>
          </div>
          <div className="shelf-controls">
            <button
              type="button"
              className="shelf-arrow-btn"
              onClick={() => {
                const rail = document.getElementById(`rail-${shelfId}`);
                if (rail) rail.scrollBy({ left: -320, behavior: 'smooth' });
              }}
              title="Previous outfits"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="shelf-arrow-btn"
              onClick={() => {
                const rail = document.getElementById(`rail-${shelfId}`);
                if (rail) rail.scrollBy({ left: 320, behavior: 'smooth' });
              }}
              title="Next outfits"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div id={`rail-${shelfId}`} className="curated-shelf-rail">
          {items.map((p) => {
            const pricing = getProductPricing(p);
            return (
              <div key={p.id} className="curated-shelf-card">
                <div
                  className="shelf-card-media"
                  onClick={() => handleOpenProductDetails(p)}
                >
                  <img
                    src={getProductImageUrl(p.image_urls?.[0])}
                    alt={p.name}
                    className="shelf-card-img"
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src =
                        'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="shelf-card-badges-top">
                    {pricing.isOnSale && (
                      <span className="shelf-badge-sale">
                        <Flame size={11} /> {pricing.discountPercent ? `-${pricing.discountPercent}%` : 'SALE'}
                      </span>
                    )}
                    {pricing.season && (
                      <span className="shelf-badge-season">
                        <Sun size={11} /> {pricing.season}
                      </span>
                    )}
                    {p.sales_count > 0 ? (
                      <span className="shelf-badge-trending" title={`${p.sales_count} units ordered & sold`}>
                        <Sparkles size={11} /> {p.sales_count} Sold
                      </span>
                    ) : p.order_count > 0 ? (
                      <span className="shelf-badge-trending" title={`${p.order_count} boutique orders`}>
                        <Sparkles size={11} /> {p.order_count} Orders
                      </span>
                    ) : pricing.isTrending ? (
                      <span className="shelf-badge-trending">
                        <Sparkles size={11} /> Hot
                      </span>
                    ) : null}
                  </div>

                  <div className="shelf-card-cat-badge">{p.category}</div>
                  <span className="shelf-card-zoom-hint">
                    <Eye size={12} /> Inspect
                  </span>
                </div>

                <div className="shelf-card-body">
                  <div
                    className="shelf-card-title"
                    onClick={() => handleOpenProductDetails(p)}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                  <p className="shelf-card-desc">{p.description}</p>

                  {pricing.promoCode && (
                    <div className="shelf-promo-code-tag">
                      <Tag size={11} /> Code: <strong>{pricing.promoCode}</strong>
                    </div>
                  )}

                  <div className="shelf-card-footer">
                    <div className="shelf-price-box">
                      <span className="shelf-price-current">
                        PKR {pricing.effectivePrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      {pricing.isOnSale && pricing.originalPrice > pricing.effectivePrice && (
                        <span className="shelf-price-original">
                          PKR {pricing.originalPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>

                    <div className="shelf-card-actions">
                      <button
                        type="button"
                        className="btn-shelf-action btn-shelf-view"
                        onClick={() => handleOpenProductDetails(p)}
                        title="Quick View & Coordinated Look"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-shelf-action btn-shelf-add"
                        onClick={() => addToCart(p)}
                        title="Add to Shopping Bag"
                      >
                        <Plus size={14} />
                        <span>Bag</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="storefront-page">
      {/* Active Promotional Offer / Sale Banner */}
      {activeCampaign && !dismissPromoBanner && (
        <div
          style={{
            background: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
            color: '#ffffff',
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '0.88rem',
            fontWeight: 600,
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <Sparkles size={18} />
          <span>
            🔥 <b>{activeCampaign.title}:</b> {activeCampaign.description}
          </span>
          <span
            style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px dashed #ffffff',
              letterSpacing: '1px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            onClick={() => {
              if (activeCampaign.promo_code) {
                setCouponInput(activeCampaign.promo_code);
                navigator.clipboard?.writeText(activeCampaign.promo_code);
                alert(`Promo code '${activeCampaign.promo_code}' copied!`);
              }
            }}
            title="Click to copy voucher code"
          >
            USE CODE: {activeCampaign.promo_code} ({activeCampaign.discount_percent}% OFF)
          </span>
          {activeCampaign.valid_until && (
            <span
              style={{
                fontSize: '0.75rem',
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              ⏳ Ends {new Date(activeCampaign.valid_until).toLocaleDateString([], { day: 'numeric', month: 'short' })}
            </span>
          )}
          <button
            onClick={() => setDismissPromoBanner(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              marginLeft: 'auto',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              opacity: 0.8,
            }}
            title="Dismiss banner"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Top Customer Navigation Bar */}
      <header className="storefront-header">
        <div className="storefront-header-main">
          {/* 1. Left: Brand & Boutique Identity */}
          <div
            className="storefront-brand"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ cursor: 'pointer' }}
            title="Luxe Atelier - Haute Couture"
          >
            <div className="brand-logo-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="brand-name">LUXE ATELIER</div>
              <div className="brand-sub">AI-Powered Fashion Boutique</div>
            </div>
          </div>

          {/* 2. Center: Editorial Navigation Links */}
          <nav className="luxury-nav-center" aria-label="Storefront Collections">
            <button
              type="button"
              className="luxury-nav-link"
              onClick={() => {
                const el = document.getElementById('catalog-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <span>Catalog</span>
            </button>

            <button
              type="button"
              className="luxury-nav-link link-flash-sale"
              onClick={() => {
                const el = document.getElementById('sale-showcase-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Flame size={14} className="nav-flame-icon" />
              <span>Flash Sale</span>
              <span className="nav-badge-pill nav-badge-red">HOT</span>
            </button>

            <button
              type="button"
              className="luxury-nav-link link-summer-edit"
              onClick={() => {
                const el = document.getElementById('summer-showcase-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Sun size={14} className="nav-sun-icon" />
              <span>Summer Edit</span>
            </button>

            <button
              type="button"
              className="luxury-nav-link link-ai-stylist"
              onClick={() => {
                const el = document.getElementById('faq-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Sparkles size={14} style={{ color: '#818cf8' }} />
              <span>AI Stylist & FAQs</span>
            </button>

            <button
              type="button"
              className="luxury-nav-link link-track-order"
              onClick={() => {
                const el = document.getElementById('track-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Package size={14} />
              <span>Track Order</span>
            </button>
          </nav>

          {/* 3. Right: Utility Controls & Unified Account Dropdown */}
          <div className="storefront-nav-utilities">
            {/* Wishlist Circle Button */}
            <button
              type="button"
              className="nav-icon-circle-btn"
              onClick={() => setIsWishlistOpen(true)}
              title="Saved Wishlist & Outfits"
              aria-label="Wishlist"
            >
              <Heart
                size={18}
                style={{ color: wishlist.length > 0 ? '#ef4444' : 'currentColor' }}
                fill={wishlist.length > 0 ? '#ef4444' : 'none'}
              />
              {wishlist.length > 0 && (
                <span className="nav-utility-badge badge-red">{wishlist.length}</span>
              )}
            </button>

            {/* Shopping Bag Circle Button */}
            <button
              type="button"
              className="nav-icon-circle-btn"
              onClick={() => setIsCartOpen(true)}
              title="Shopping Bag"
              aria-label="Shopping Bag"
            >
              <ShoppingBag size={18} />
              {totalCartCount > 0 && (
                <span className="nav-utility-badge badge-primary">{totalCartCount}</span>
              )}
            </button>

            {/* Theme Toggle Button */}
            <ThemeToggle className="nav-theme-toggle-btn" />

            {/* Unified Account & Portals Dropdown */}
            <div className="account-dropdown-wrapper" ref={accountDropdownRef}>
              <button
                type="button"
                className={`nav-account-pill ${isAccountMenuOpen ? 'active' : ''} ${
                  user?.role === 'ADMIN' ? 'role-admin-pill' : user?.role === 'STAFF' ? 'role-staff-pill' : ''
                }`}
                onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="true"
              >
                {user && (user.role === 'ADMIN' || user.role === 'STAFF') ? (
                  <>
                    <ShieldCheck
                      size={15}
                      className="account-pill-icon"
                      style={{ color: user.role === 'ADMIN' ? '#fbbf24' : '#60a5fa' }}
                    />
                    <span className="account-pill-label">Console ({user.role})</span>
                  </>
                ) : user && user.role === 'USER' ? (
                  <>
                    <div className="account-user-avatar">
                      {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="account-pill-label">
                      {user.full_name ? user.full_name.split(' ')[0] : user.email.split('@')[0]}
                    </span>
                  </>
                ) : (
                  <>
                    <User size={15} className="account-pill-icon" />
                    <span className="account-pill-label">Account</span>
                  </>
                )}
                <ChevronDown
                  size={13}
                  className={`account-chevron ${isAccountMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Account & Portals Popup Menu */}
              {isAccountMenuOpen && (
                <div className="account-dropdown-menu animate-fade-in" role="menu">
                  {/* Dropdown Header */}
                  <div className="dropdown-account-header">
                    {user ? (
                      <div className="dropdown-user-info">
                        <div className="dropdown-avatar-large">
                          {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="dropdown-user-meta">
                          <div className="dropdown-user-name">
                            {user.full_name || 'Valued Customer'}
                          </div>
                          <div className="dropdown-user-email">{user.email}</div>
                          <div className="dropdown-role-tag">
                            {user.role === 'ADMIN'
                              ? '👑 Store Administrator'
                              : user.role === 'STAFF'
                              ? '🛡️ Boutique Staff'
                              : '✨ VIP Customer'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="dropdown-guest-info">
                        <div className="dropdown-guest-title">Welcome to Luxe Atelier</div>
                        <div className="dropdown-guest-sub">
                          Sign in for order history, saved outfits, or staff management.
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm dropdown-signin-cta"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onStaffLoginClick();
                          }}
                        >
                          <User size={14} />
                          <span>Sign In / Register</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="dropdown-divider" />

                  {/* Customer Services Section */}
                  <div className="dropdown-menu-section">
                    <div className="dropdown-section-title">Customer Services</div>

                    <button
                      type="button"
                      className="dropdown-item-btn"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        handleOpenMyOrders();
                      }}
                    >
                      <ShoppingBag size={15} className="dropdown-item-icon text-indigo" />
                      <div className="dropdown-item-text">
                        <span>My Orders & Purchases</span>
                        <small>Invoices, receipts & status</small>
                      </div>
                      {myOrdersList.length > 0 && (
                        <span className="dropdown-badge-counter">{myOrdersList.length}</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="dropdown-item-btn"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setIsWishlistOpen(true);
                      }}
                    >
                      <Heart size={15} className="dropdown-item-icon text-rose" />
                      <div className="dropdown-item-text">
                        <span>Saved Wishlist</span>
                        <small>{wishlist.length} item{wishlist.length === 1 ? '' : 's'} saved</small>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="dropdown-item-btn"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        const el = document.getElementById('track-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <Truck size={15} className="dropdown-item-icon text-emerald" />
                      <div className="dropdown-item-text">
                        <span>Live Courier Tracking</span>
                        <small>Trax, Leopards, TCS logistics</small>
                      </div>
                    </button>
                  </div>

                  {/* Portals & Management Console Section */}
                  <div className="dropdown-divider" />
                  <div className="dropdown-menu-section">
                    <div className="dropdown-section-title">Store Management & Portals</div>

                    {user && (user.role === 'ADMIN' || user.role === 'STAFF') ? (
                      <button
                        type="button"
                        className="dropdown-item-btn highlight-portal-btn"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          onStaffLoginClick();
                        }}
                      >
                        <ShieldCheck size={16} className="dropdown-item-icon text-amber" />
                        <div className="dropdown-item-text">
                          <span style={{ fontWeight: 700 }}>Open Management Console</span>
                          <small>Inbox, Orders, Stock ({user.role})</small>
                        </div>
                        <ArrowRight size={14} className="dropdown-item-arrow" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          onStaffLoginClick();
                        }}
                      >
                        <ShieldCheck size={15} className="dropdown-item-icon text-muted" />
                        <div className="dropdown-item-text">
                          <span>Staff & Admin Portal</span>
                          <small>Team login & store backoffice</small>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Sign Out (if authenticated) */}
                  {user && (
                    <>
                      <div className="dropdown-divider" />
                      <div className="dropdown-menu-section dropdown-footer-section">
                        <button
                          type="button"
                          className="dropdown-item-btn dropdown-logout-btn"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onLogout();
                          }}
                        >
                          <LogOut size={15} className="dropdown-item-icon text-rose" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Navigation Strip inside Navbar */}
        <div className="storefront-categories-strip">
          <div className="category-strip-label">
            <Sparkles size={13} style={{ color: '#818cf8' }} />
            <span>COLLECTIONS:</span>
          </div>
          <div className="category-strip-scroll">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`nav-category-strip-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  const el = document.getElementById('catalog-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {cat === 'ALL' ? '✨ All Outfits' : cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="storefront-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} />
            <span>Natural Gemini Conversational AI</span>
          </div>
          <h1 className="hero-title">
            Haute Couture Meets <span className="highlight-gradient">Artificial Intelligence</span>
          </h1>
          <p className="hero-desc">
            Discover tailored looks, inquire about fabric and sizing in Roman Urdu or English,
            and order effortlessly via WhatsApp with Aria, our boutique AI stylist.
          </p>

          <div className="hero-cta-group">
            <a href="#catalog-section" className="btn btn-primary btn-lg">
              <ShoppingBag size={18} />
              <span>Explore Collection</span>
            </a>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => {
                const el = document.getElementById('stylist-chat-box');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <MessageCircle size={18} />
              <span>Chat with Aria (AI)</span>
            </button>
          </div>
        </div>
      </section>

      {/* Order Placed Success Banner Modal */}
      {confirmedOrder && (
        <div className="order-confirmed-banner card">
          <div className="confirmed-content">
            <div className="confirmed-icon">
              <CheckCircle size={32} />
            </div>
            <div>
              <h3 className="confirmed-title">
                🎉 Order Placed Successfully! #{confirmedOrder.order_number}
              </h3>
              <p className="confirmed-sub">
                Thank you, {confirmedOrder.address_snapshot?.full_name}! Your order has been recorded
                in our live MongoDB registry. Total: PKR {confirmedOrder.total?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="confirmed-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setTrackQuery(confirmedOrder.order_number);
                  handleTrackOrder();
                  const el = document.getElementById('track-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Package size={15} />
                <span>Track Order Live</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmedOrder(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: AI Stylist Chat & Live Catalog */}
      <div className="storefront-main-grid">
        {/* Left Column: Interactive Gemini AI Stylist */}
        <div id="stylist-chat-box" className="stylist-chat-widget card">
          <div className="chat-widget-header">
            <div
              className="stylist-avatar"
              style={{
                background: assignedStaff?.isAssigned
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : undefined,
              }}
            >
              {assignedStaff?.isAssigned ? <User size={18} /> : <Sparkles size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="stylist-name">
                  {assignedStaff?.isAssigned ? `${assignedStaff.staffName}` : 'Aria — AI Fashion Stylist'}
                </div>
                <span className="chat-memory-badge" title={assignedStaff?.isAssigned ? 'Live Human Assistance' : 'AI remembers your full conversation history'}>
                  {assignedStaff?.isAssigned ? '👤 Staff Live' : '🧠 Memory Active'}
                </span>
              </div>
              <div className="stylist-status">
                <span className="online-dot" /> {assignedStaff?.isAssigned ? 'Live Staff Connected | Assisting you' : 'Online | Ready to style you'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {assignedStaff?.isAssigned ? (
                <button
                  type="button"
                  className="btn-switch-ai-mini"
                  onClick={handleSwitchToAi}
                  title="Switch back to AI Stylist"
                >
                  <Sparkles size={12} /> Switch to AI
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-handshake-human-mini"
                  onClick={handleRequestHumanStaff}
                  title="Connect with Human Stylist"
                >
                  <User size={12} /> Live Staff
                </button>
              )}
              <button
                type="button"
                className="chat-clear-btn"
                onClick={handleClearChatHistory}
                title="Reset conversation and clear chat memory"
              >
                <Trash2 size={13} />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Assigned Staff Live Banner */}
          {assignedStaff?.isAssigned && (
            <div className="staff-assigned-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="staff-live-pulse" />
                <span style={{ fontSize: '0.82rem', color: '#fef08a', fontWeight: 600 }}>
                  👤 Senior Stylist <strong>{assignedStaff.staffName}</strong> is directly on this chat.
                </span>
              </div>
              <button
                type="button"
                onClick={handleSwitchToAi}
                className="btn-banner-switch-ai"
              >
                <Sparkles size={12} /> Switch to AI
              </button>
            </div>
          )}

          {/* Quick Prompts */}
          <div className="quick-prompts-row">
            <button
              className="quick-prompt-chip"
              style={{ borderColor: 'rgba(234, 179, 8, 0.4)', background: 'rgba(234, 179, 8, 0.1)' }}
              onClick={() => {
                const target = products.find((p) => p.name.includes('Dusty Rose')) || products[0] || {
                  name: 'Dusty Rose Silk Crepe Camisole',
                  price: 60.99,
                };
                openChatOrderForm(target);
              }}
            >
              🛍️ Place My Order (Open Form)
            </button>
            <button
              className="quick-prompt-chip"
              onClick={() => handleSendChatMessage('Party wear dress recommend karein')}
            >
              👗 Party Wear
            </button>
            <button
              className="quick-prompt-chip"
              onClick={() => handleSendChatMessage('What is your return policy?')}
            >
              📦 Returns Policy
            </button>
            <button
              className="quick-prompt-chip"
              onClick={handleRequestHumanStaff}
              style={{ color: '#fde047', borderColor: 'rgba(253, 224, 71, 0.3)' }}
            >
              👤 Talk to Staff
            </button>
            <button
              className="quick-prompt-chip"
              onClick={() => handleSendChatMessage('Size guidance batayein')}
            >
              📏 Size Help
            </button>
          </div>

          {/* Chat Messages Log */}
          <div className="chat-messages-scroll">
            {chatHistory.map((msg, idx) => {
              const isStaff = msg.sender === 'staff';
              const isUser = msg.sender === 'user';
              return (
              <div
                key={idx}
                className={`chat-bubble-row ${isUser ? 'user-row' : 'stylist-row'}`}
              >
                <div
                  className={`chat-bubble ${
                    isUser ? 'user-bubble' : isStaff ? 'staff-bubble' : 'stylist-bubble'
                  }`}
                >
                  {isStaff && (
                    <div className="staff-bubble-badge">
                      <User size={12} /> {msg.staff_name || 'Senior Boutique Stylist'} (Live Staff)
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{cleanChatMessageText(msg.text)}</div>

                  {/* Interactive In-Chat Order Form Trigger */}
                  {msg.text && msg.text.includes('BOUTIQUE ORDER DETAILS') && (
                    <div style={{ marginTop: '12px' }}>
                      <button
                        type="button"
                        className="btn-confirm-chat-order"
                        style={{ padding: '9px 16px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => {
                          const prodMatch = msg.text.match(/\*Product Name:\*\s*([^\n]+)/);
                          const rawProdName = prodMatch ? prodMatch[1].trim() : 'Dusty Rose Silk Crepe Camisole';
                          const cleanProdName = rawProdName.replace(/\(\$[0-9.]+\)/, '').trim();
                          const matched = products.find(
                            (p) =>
                              p.name.toLowerCase() === cleanProdName.toLowerCase() ||
                              p.name.toLowerCase().includes(cleanProdName.toLowerCase()) ||
                              cleanProdName.toLowerCase().includes(p.name.toLowerCase())
                          );
                          const colMatch = msg.text.match(/\*Product Color:\*\s*([^\n]+)/);
                          const szMatch = msg.text.match(/\*Product Size:\*\s*([^\n]+)/);
                          const extractedCol = colMatch && !colMatch[1].includes('[') ? colMatch[1].trim() : null;
                          const extractedSz = szMatch && !szMatch[1].includes('[') ? szMatch[1].trim() : null;
                          openChatOrderForm(matched || { name: cleanProdName, price: 60.99 }, extractedSz, extractedCol);
                        }}
                      >
                        <FileText size={15} /> 📝 Open In-Chat Order Form & Confirm Details
                      </button>
                    </div>
                  )}

                  {/* Autonomously Created Order Action Card */}
                  {msg.order_created && msg.order && (
                    <div className="chat-order-card">
                      <div className="chat-order-card-header">
                        <span className="order-pulse-dot" />
                        <span>Order #{msg.order.order_number} Confirmed & Dispatched!</span>
                      </div>
                      <div className="chat-order-meta" style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                        <div
                          className="chat-visual-img-wrap"
                          style={{ width: '70px', height: '70px' }}
                          onClick={() => {
                            const ordItem = msg.order.items?.[0];
                            const matchedDb = products.find((p) => p.id === ordItem?.product_id || p.name === ordItem?.name);
                            if (matchedDb) {
                              handleOpenProductDetails(matchedDb);
                            }
                          }}
                          title="Click to inspect ordered outfit"
                        >
                          <img
                            src={
                              msg.order.items?.[0]?.image_url ||
                              'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80'
                            }
                            alt={msg.order.items?.[0]?.name}
                            className="chat-visual-img"
                            onError={(e) => {
                              e.target.src =
                                'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                            }}
                          />
                          <span className="chat-visual-zoom-badge"><Eye size={10} /> Inspect</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem', marginBottom: '2px' }}>
                            {msg.order.items?.[0]?.name}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 700, marginBottom: '2px' }}>
                            Total: PKR {msg.order.total?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Free Express Delivery 🚚)
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            📍 {msg.order.address_snapshot?.street_address}, {msg.order.address_snapshot?.city}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                            💵 Cash on Delivery (COD)
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-track-order-card"
                        onClick={() => {
                          setTrackQuery(msg.order.order_number);
                          handleTrackOrder(null, msg.order.order_number);
                          const el = document.querySelector('.storefront-sidebar-column');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        <Truck size={14} /> View Live Courier Tracking Details
                      </button>
                    </div>
                  )}

                  {/* Prominent Product Visual Confirmation Card for Orders / Recommendations */}
                  {!msg.order_created && (msg.product_action || msg.image_url) && (() => {
                    const actionProd = msg.product_action;
                    const visualImg = actionProd?.image_url || msg.image_url;
                    const visualName = actionProd?.name || 'Curated Atelier Piece';
                    const visualPrice = actionProd?.price
                      ? (typeof actionProd.price === 'number'
                          ? `PKR ${actionProd.price.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : (String(actionProd.price).startsWith('$') ? actionProd.price.replace('$', 'PKR ') : actionProd.price))
                      : null;
                    const visualSize = actionProd?.size;
                    const visualColor = actionProd?.color;
                    const matchedDb = products.find(
                      (p) => (actionProd?.product_id && p.id === actionProd.product_id) || p.name.toLowerCase() === visualName.toLowerCase()
                    ) || {
                      id: actionProd?.product_id || 'preview',
                      name: visualName,
                      category: 'Exclusive Collection',
                      price: visualPrice || 'PKR 14,000.00',
                      image_urls: [visualImg],
                      description: 'Handcrafted atelier design curated for your stylish wardrobe.',
                    };

                    const prodStorefrontUrl = matchedDb?.id && matchedDb.id !== 'preview'
                      ? `${STOREFRONT_BASE_URL}/${matchedDb.id}`
                      : STOREFRONT_BASE_URL;

                    const waEncodedMsg = encodeURIComponent(
                      `Hi Aria, I would like to confirm my order for: ${visualName}${visualColor ? ` (Color: ${visualColor})` : ''}${visualSize ? ` (Size: ${visualSize})` : ''}\n🌐 View on Website: ${prodStorefrontUrl}`
                    );

                    return (
                      <div className="chat-visual-confirm-card">
                        <div className="chat-visual-header">
                          <div className="chat-visual-tag">
                            <Sparkles size={13} /> Product Visual Confirmation
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                            ✓ 100% Genuine Atelier Outfit
                          </span>
                        </div>

                        <div className="chat-visual-body">
                          <div
                            className="chat-visual-img-wrap"
                            onClick={() => handleOpenProductDetails(matchedDb)}
                            title="Click to zoom and view full outfit photos"
                          >
                            <img
                              src={visualImg || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80'}
                              alt={visualName}
                              className="chat-visual-img"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                              }}
                            />
                            <span className="chat-visual-zoom-badge"><Eye size={10} /> Inspect</span>
                          </div>

                          <div className="chat-visual-info">
                            <div className="chat-visual-title" title={visualName}>
                              {visualName}
                            </div>
                            <div className="chat-visual-badges">
                              {visualColor && <span className="chat-badge-pill">Color: {visualColor}</span>}
                              {visualSize && <span className="chat-badge-pill">Size: {visualSize}</span>}
                              {visualPrice && <span className="chat-badge-pill price">{visualPrice}</span>}
                              <span className="chat-badge-pill">Free Delivery 🚚</span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              Inspect photo or reply with address to confirm COD order!
                            </div>
                          </div>
                        </div>

                        <div className="chat-visual-actions">
                          <button
                            type="button"
                            className="btn-chat-action-primary"
                            onClick={() => openChatOrderForm(matchedDb, visualSize, visualColor)}
                          >
                            <ShoppingBag size={13} /> Fill Details & Order Now
                          </button>

                          <button
                            type="button"
                            className="btn-smart-mini"
                            style={{ padding: '8px 10px', fontSize: '0.76rem', background: 'rgba(255,255,255,0.08)' }}
                            onClick={() => handleOpenProductDetails(matchedDb)}
                            title="Inspect high-res photo and fabric"
                          >
                            <Eye size={13} /> Inspect
                          </button>

                          <a
                            href={`https://wa.me/923001234567?text=${waEncodedMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-chat-action-secondary"
                            title="Confirm and order directly on WhatsApp"
                          >
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Conversion Closing Offer Nudge Badge */}
                  {msg.conversion_nudge && (
                    <div className="chat-conversion-nudge-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: '#f59e0b', fontWeight: 800 }}>
                        <Flame size={14} /> VIP STYLING CONVERSION OFFER
                      </div>
                      <div>{msg.conversion_nudge}</div>
                    </div>
                  )}

                  {/* Frequently Paired / Relevant Cross-Sell Items */}
                  {msg.relevant_products && msg.relevant_products.length > 0 && (
                    <div className="chat-relevant-items-container">
                      <div className="chat-relevant-title">
                        <Sparkles size={13} /> Complete The Look (Frequently Paired)
                      </div>
                      <div className="chat-relevant-cards-list">
                        {msg.relevant_products.map((rp) => (
                          <div key={rp.id} className="chat-relevant-mini-card">
                            <img
                              src={rp.image_url || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80'}
                              alt={rp.name}
                              className="chat-relevant-thumb"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {rp.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--primary)', fontWeight: 800 }}>
                                {rp.price}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="btn-smart-mini btn-smart-view"
                                onClick={() => handleOpenProductDetails(rp)}
                                title="Quick View"
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn-smart-mini btn-smart-add"
                                onClick={() => addToCart(rp)}
                              >
                                <Plus size={12} /> Bag
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

            {/* Embedded In-Chat Interactive Order Form Card */}
            {chatOrderForm.isOpen && (
              <div className="in-chat-order-form">
                <div className="in-chat-form-header">
                  <div className="in-chat-form-title">
                    <Sparkles size={16} style={{ color: '#818cf8' }} />
                    <span>Confirm Atelier Order Details (COD)</span>
                  </div>
                  <button
                    type="button"
                    className="in-chat-close-btn"
                    onClick={() => setChatOrderForm((prev) => ({ ...prev, isOpen: false }))}
                    title="Close form"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Product Summary Mini Card */}
                <div className="in-chat-product-bar">
                  <img
                    src={chatOrderForm.imageUrl}
                    alt={chatOrderForm.productName}
                    className="in-chat-thumb"
                    onError={(e) => {
                      e.target.src = 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=300&q=80';
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="in-chat-prod-title">{chatOrderForm.productName}</div>
                    <div className="in-chat-prod-price">
                      <span>PKR {(chatOrderForm.price * chatOrderForm.quantity).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="in-chat-badge-free">Free Express Delivery 🚚</span>
                    </div>
                  </div>
                </div>

                {chatOrderForm.error && (
                  <div className="in-chat-error-alert">
                    ⚠️ {chatOrderForm.error}
                  </div>
                )}

                {/* Form Fields Grid */}
                <div className="in-chat-form-grid">
                  <div className="in-chat-group">
                    <label className="in-chat-label"><User size={13} /> Your Full Name</label>
                    <input
                      type="text"
                      className="in-chat-input"
                      placeholder="e.g. Sara Ahmed"
                      value={chatOrderForm.fullName}
                      onChange={(e) => setChatOrderForm({ ...chatOrderForm, fullName: e.target.value })}
                    />
                  </div>

                  <div className="in-chat-group">
                    <label className="in-chat-label"><Phone size={13} /> Phone Number</label>
                    <input
                      type="text"
                      className="in-chat-input"
                      placeholder="+923001234567"
                      value={chatOrderForm.phone}
                      onChange={(e) => setChatOrderForm({ ...chatOrderForm, phone: e.target.value })}
                    />
                  </div>

                  <div className="in-chat-group full-width">
                    <label className="in-chat-label"><Mail size={13} /> Email Address (Optional for receipt)</label>
                    <input
                      type="email"
                      className="in-chat-input"
                      placeholder="your.email@example.com (optional)"
                      value={chatOrderForm.email}
                      onChange={(e) => setChatOrderForm({ ...chatOrderForm, email: e.target.value })}
                    />
                  </div>

                  <div className="in-chat-group">
                    <label className="in-chat-label">
                      Select Color {chatOrderForm.availableColors.length === 1 && <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>({chatOrderForm.availableColors[0]} only)</span>}
                    </label>
                    <div className="in-chat-chips">
                      {chatOrderForm.availableColors.map((col) => (
                        <button
                          key={col}
                          type="button"
                          className={`in-chat-chip ${chatOrderForm.color?.toLowerCase() === col.toLowerCase() ? 'active' : ''}`}
                          onClick={() => {
                            const newColor = col;
                            const sizesForCol = chatOrderForm.variants?.length > 0
                              ? Array.from(new Set(chatOrderForm.variants.filter((v) => !v.color || v.color.toLowerCase() === newColor.toLowerCase()).map((v) => v.size).filter(Boolean)))
                              : chatOrderForm.availableSizes;
                            let newSize = chatOrderForm.size;
                            if (sizesForCol.length > 0 && !sizesForCol.some((s) => s.toUpperCase() === newSize.toUpperCase())) {
                              newSize = sizesForCol[0];
                            }
                            const matchedV = chatOrderForm.variants?.find((v) =>
                              (!v.color || v.color.toLowerCase() === newColor.toLowerCase()) &&
                              (!v.size || v.size.toUpperCase() === newSize.toUpperCase())
                            );
                            setChatOrderForm((prev) => ({
                              ...prev,
                              color: newColor,
                              size: newSize,
                              price: matchedV?.price || prev.price,
                            }));
                          }}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="in-chat-group">
                    <label className="in-chat-label">
                      Select Size {chatOrderForm.availableSizes.length === 1 && <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>({chatOrderForm.availableSizes[0]} only)</span>}
                    </label>
                    <div className="in-chat-chips">
                      {(() => {
                        const sizesForActiveColor = chatOrderForm.variants?.length > 0
                          ? Array.from(new Set(chatOrderForm.variants.filter((v) => !chatOrderForm.color || chatOrderForm.color === 'Standard' || !v.color || v.color.toLowerCase() === chatOrderForm.color.toLowerCase()).map((v) => v.size).filter(Boolean)))
                          : chatOrderForm.availableSizes;
                        const displaySizes = sizesForActiveColor.length > 0 ? sizesForActiveColor : chatOrderForm.availableSizes;
                        return displaySizes.map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            className={`in-chat-chip ${chatOrderForm.size?.toUpperCase() === sz.toUpperCase() ? 'active' : ''}`}
                            onClick={() => {
                              const newSize = sz;
                              const matchedV = chatOrderForm.variants?.find((v) =>
                                (!v.color || v.color.toLowerCase() === chatOrderForm.color?.toLowerCase()) &&
                                (!v.size || v.size.toUpperCase() === newSize.toUpperCase())
                              );
                              setChatOrderForm((prev) => ({
                                ...prev,
                                size: newSize,
                                price: matchedV?.price || prev.price,
                              }));
                            }}
                          >
                            {sz}
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  <div className="in-chat-group">
                    <label className="in-chat-label">Quantity</label>
                    <div className="in-chat-qty-box">
                      <button
                        type="button"
                        className="in-chat-qty-btn"
                        onClick={() => setChatOrderForm((prev) => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                      >
                        <Minus size={12} />
                      </button>
                      <span className="in-chat-qty-val">{chatOrderForm.quantity}</span>
                      <button
                        type="button"
                        className="in-chat-qty-btn"
                        onClick={() => setChatOrderForm((prev) => ({ ...prev, quantity: prev.quantity + 1 }))}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="in-chat-group">
                    <label className="in-chat-label"><MapPin size={13} /> Destination City</label>
                    <input
                      type="text"
                      className="in-chat-input"
                      placeholder="e.g. Sahiwal, Lahore"
                      value={chatOrderForm.city}
                      onChange={(e) => setChatOrderForm({ ...chatOrderForm, city: e.target.value })}
                    />
                    <div className="in-chat-city-suggestions">
                      {['Sahiwal', 'Lahore', 'Karachi', 'Islamabad', 'Faisalabad', 'Multan'].map((c) => (
                        <span
                          key={c}
                          className={`in-chat-city-tag ${chatOrderForm.city.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                          onClick={() => setChatOrderForm({ ...chatOrderForm, city: c })}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="in-chat-group full-width">
                    <label className="in-chat-label"><MapPin size={13} /> Delivery Address (House / Street / Mohallah)</label>
                    <input
                      type="text"
                      className="in-chat-input"
                      placeholder="e.g. House 42, Street 7, Jahaz Ground"
                      value={chatOrderForm.address}
                      onChange={(e) => setChatOrderForm({ ...chatOrderForm, address: e.target.value })}
                    />
                  </div>
                </div>

                {/* COD Badge */}
                <div className="in-chat-cod-badge">
                  <CheckCircle size={14} />
                  <span>💵 Cash on Delivery (COD) • Pay at your doorstep with Free Express Delivery!</span>
                </div>

                {/* Submit & Cancel Actions */}
                <div className="in-chat-form-actions">
                  <button
                    type="button"
                    className="btn-cancel-chat-order"
                    onClick={() => setChatOrderForm((prev) => ({ ...prev, isOpen: false }))}
                    disabled={chatOrderForm.submitting}
                  >
                    Cancel
                  </button>
                  {(() => {
                    const matchedChatV = chatOrderForm.variants?.find(
                      (v) =>
                        (!chatOrderForm.color || chatOrderForm.color === 'Standard' || !v.color || v.color.toLowerCase() === chatOrderForm.color.toLowerCase()) &&
                        (!chatOrderForm.size || chatOrderForm.size === 'Standard' || !v.size || v.size.toUpperCase() === chatOrderForm.size.toUpperCase())
                    );
                    const isOutOfStock = matchedChatV && matchedChatV.available_quantity !== undefined && matchedChatV.available_quantity < chatOrderForm.quantity;

                    return (
                      <button
                        type="button"
                        className="btn-confirm-chat-order"
                        onClick={handleConfirmInChatOrder}
                        disabled={chatOrderForm.submitting || isOutOfStock}
                        style={{
                          opacity: isOutOfStock ? 0.6 : 1,
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {chatOrderForm.submitting ? (
                          <>
                            <RefreshCw size={15} className="spin" />
                            <span>Booking Order...</span>
                          </>
                        ) : isOutOfStock ? (
                          <>
                            <X size={16} />
                            <span>Out of Stock ({matchedChatV?.available_quantity || 0} units left)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            <span>Confirm & Book Order Now (PKR {(chatOrderForm.price * chatOrderForm.quantity).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </div>
            )}

            {chatLoading && (
              <div className="chat-bubble-row stylist-row">
                <div className="chat-bubble stylist-bubble typing-bubble">
                  <Sparkles size={14} className="spin" />
                  <span>Aria is tailoring your response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage();
            }}
            className="chat-input-bar"
          >
            <input
              type="text"
              className="chat-input-field"
              placeholder="Ask Aria in English or Roman Urdu... (e.g. 'Dresses dikhayein')"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
            />
            <button
              type="submit"
              className="btn btn-primary chat-send-btn"
              disabled={chatLoading || !chatInput.trim()}
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Right Column: Order Tracker & FAQs Overview */}
        <div className="storefront-sidebar-column">
          {/* Track Order Card */}
          <div id="track-section" className="card order-tracker-card">
            <div className="tracker-header">
              <Package size={22} className="tracker-icon" />
              <div>
                <h3 className="tracker-title">Track Your Order</h3>
                <p className="tracker-sub">Enter order number (e.g. ORD-20261011-1001)</p>
              </div>
            </div>

            <form onSubmit={handleTrackOrder} className="tracker-form">
              <div className="tracker-input-row">
                <input
                  type="text"
                  className="form-input tracker-input"
                  placeholder="ORD-20261011-1001"
                  value={trackQuery}
                  onChange={(e) => setTrackQuery(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={trackLoading || !trackQuery.trim()}
                >
                  {trackLoading ? <RefreshCw size={15} className="spin" /> : 'Track'}
                </button>
              </div>
            </form>

            {trackError && <div className="tracker-error-alert">{trackError}</div>}

            {trackingResult && (
              <div className="tracker-result-box">
                <div className="result-header">
                  <span className="order-no-tag">#{trackingResult.order_number}</span>
                  <span className={`status-pill status-${trackingResult.status?.toLowerCase()}`}>
                    {trackingResult.status_label || trackingResult.status}
                  </span>
                </div>

                {/* Courier Partner & Consignment Badge */}
                {trackingResult.tracking_number && trackingResult.tracking_number !== 'NOT_ASSIGNED_YET' && (
                  <div style={{ margin: '10px 0', padding: '10px 12px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#38bdf8', textTransform: 'uppercase', fontWeight: 700 }}>
                        🚚 Carrier: {trackingResult.courier_partner || 'Express Logistics'}
                      </div>
                      <div style={{ fontSize: '0.92rem', fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>
                        CN #{trackingResult.tracking_number}
                      </div>
                    </div>
                    {trackingResult.estimated_delivery && (
                      <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#38bdf8' }}>
                        Est. Arrival: <b>{trackingResult.estimated_delivery}</b>
                      </div>
                    )}
                  </div>
                )}

                <div className="result-details">
                  <div className="detail-line">
                    <span>Total Amount:</span>
                    <strong>
                      PKR {Number(trackingResult.total || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (COD)
                    </strong>
                  </div>
                  <div className="detail-line">
                    <span>Items Count:</span>
                    <span>{trackingResult.items?.length || 0} items</span>
                  </div>
                  {trackingResult.address_snapshot?.street_address && (
                    <div className="detail-line">
                      <span>Destination:</span>
                      <span>
                        {trackingResult.address_snapshot.city},{' '}
                        {trackingResult.address_snapshot.country}
                      </span>
                    </div>
                  )}

                  {/* Visual Checkpoints Stepper if available */}
                  {trackingResult.checkpoints && trackingResult.checkpoints.length > 0 && (
                    <div style={{ marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '10px', fontWeight: 700 }}>
                        Shipment Progress:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {trackingResult.checkpoints.map((cp, cIdx) => (
                          <div key={cIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8rem' }}>
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: cp.is_current ? '#38bdf8' : cp.is_completed ? '#10b981' : 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '10px',
                                flexShrink: 0,
                                marginTop: '2px',
                              }}
                            >
                              {cp.is_completed ? '✓' : cIdx + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: cp.is_current ? 700 : 600, color: cp.is_current ? '#38bdf8' : cp.is_completed ? '#f1f5f9' : 'var(--text-dim)' }}>
                                {cp.title}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {cp.description}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {trackingResult.items && trackingResult.items.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 700 }}>
                        Purchased Items:
                      </div>
                      {trackingResult.items.map((it, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <img
                            src={
                              it.image_url ||
                              'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80'
                            }
                            alt={it.name}
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '6px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-glass)',
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              e.target.src =
                                'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0, fontSize: '0.82rem' }}>
                            <div style={{ fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {it.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                              Qty: {it.quantity} • {it.sku || 'Std'}
                            </div>
                          </div>
                          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.82rem' }}>
                            PKR {Number(it.total_price || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Store Knowledge & FAQs Preview */}
          <div className="card faq-preview-card">
            <div className="faq-preview-header">
              <HelpCircle size={18} />
              <h4>Boutique Policies</h4>
            </div>
            <div className="faq-pills-list">
              <div className="faq-preview-item">
                <strong>🚚 Complimentary Delivery:</strong> Free express delivery on all orders across Pakistan.
              </div>
              <div className="faq-preview-item">
                <strong>🔄 14-Day Returns:</strong> Hassle-free exchanges with complimentary doorstep pickup.
              </div>
              <div className="faq-preview-item">
                <strong>💳 Payment Modes:</strong> Cash on Delivery (COD), Visa, Mastercard, and Bank Transfer.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Curated Product Rows */}
      {renderCuratedShelf(
        'Flash Sale & Exclusive Discounts',
        'Save up to 40% OFF with active seasonal promo codes on signature boutique outfits',
        <Flame size={20} />,
        '🔥 FLASH SALE',
        '#ef4444',
        saleProducts,
        'sale-showcase-section'
      )}

      {renderCuratedShelf(
        'Summer Atelier Collection & Bestsellers',
        'Lightweight luxury lawns, breathable linens, and radiant summer silhouettes',
        <Sun size={20} />,
        '☀️ SUMMER EDIT',
        '#f59e0b',
        summerProducts,
        'summer-showcase-section'
      )}

      {renderCuratedShelf(
        'Trending Now & Bestseller Outfits',
        'Top-ordered luxury styles ranked by customer sales volume & demand velocity',
        <Sparkles size={20} />,
        '🔥 TOP SALES & ORDERS',
        '#ec4899',
        trendingProducts,
        'trending-showcase-section'
      )}

      {/* Catalog Showcase Section */}
      <section id="catalog-section" className="storefront-catalog-section">
        <div className="catalog-header-bar">
          <div>
            <h2 className="section-title">Trending Boutique Catalog</h2>
            <p className="section-subtitle">Real-time inventory directly synced from MongoDB</p>
          </div>

          {/* Search Wrap with Live Suggestions Dropdown */}
          <div className="catalog-controls">
            <div className="catalog-search-wrap" style={{ position: 'relative' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search collection (e.g. Silk, Chiffon, Linen)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                className="catalog-search-input"
              />
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '6px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
                    zIndex: 100,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 14px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    Quick Suggestions ({searchSuggestions.length})
                  </div>
                  {searchSuggestions.map((sug) => (
                    <div
                      key={sug.id}
                      onMouseDown={() => handleOpenProductDetails(sug)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <img
                        src={getProductImageUrl(sug.image_urls?.[0])}
                        alt={sug.name}
                        style={{ width: '36px', height: '42px', borderRadius: '6px', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sug.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                          <span>{sug.category}</span> • <strong style={{ color: 'var(--primary)' }}>PKR {Number(sug.sale_price || sug.min_price || sug.price || 12000).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div className="category-pills-row">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-pill-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Advanced Catalog Filters & Sorting Toolbar */}
        <div
          className="catalog-filters-toolbar"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            margin: '14px 0 18px',
            padding: '10px 16px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <ArrowUpDown size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 600 }}>Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="DEFAULT">Recommended / Curated</option>
                <option value="TRENDING">🔥 Most Sold & Ordered</option>
                <option value="PRICE_LOW_HIGH">Price: Low to High</option>
                <option value="PRICE_HIGH_LOW">Price: High to Low</option>
                <option value="NEWEST">Newest Arrivals</option>
                <option value="DISCOUNT">Biggest Discount %</option>
              </select>
            </div>

            {/* In Stock Only Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#cbd5e1', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                style={{ accentColor: '#10b981', cursor: 'pointer' }}
              />
              <span>In-Stock Only</span>
            </label>

            {/* Price Range Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Max Price:</span>
              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>PKR {priceFilterMax.toLocaleString()}</span>
              <input
                type="range"
                min={5000}
                max={50000}
                step={2500}
                value={priceFilterMax}
                onChange={(e) => setPriceFilterMax(Number(e.target.value))}
                style={{ width: '90px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Size Guide Trigger */}
            <button
              type="button"
              onClick={() => setIsSizeGuideOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '8px',
                background: 'rgba(212, 175, 55, 0.12)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
                color: 'var(--primary)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Ruler size={13} /> Size Guide
            </button>

            {(selectedCategory !== 'ALL' || searchQuery || sortBy !== 'DEFAULT' || inStockOnly || priceFilterMax < 50000) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSearchQuery('');
                  setSortBy('DEFAULT');
                  setInStockOnly(false);
                  setPriceFilterMax(50000);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#f87171',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Continuous Online Recommender: Smart Search & Relevant Styles Rail */}
        {searchQuery.trim().length >= 2 && (
          <div className="smart-recs-container">
            <div className="smart-recs-header">
              <div className="smart-recs-title">
                <Sparkles size={18} />
                <span>AI Recommended Styles for "{searchQuery}"</span>
              </div>
              <div className="smart-learning-badge">
                <Flame size={12} /> Live ML Recommender & Online Feedback
              </div>
            </div>

            {isSmartSearching ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
                <RefreshCw size={14} className="spin" /> Tailoring recommendations with continuous ML...
              </div>
            ) : smartRecommendations.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem', padding: '6px 0' }}>
                No specific semantic matches found. Showing general catalog results below.
              </div>
            ) : (
              <div className="smart-recs-grid">
                {smartRecommendations.map((sr) => (
                  <div key={sr.id} className="smart-rec-card">
                    <img
                      src={sr.image_url || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80'}
                      alt={sr.name}
                      className="smart-rec-img"
                      onClick={() => handleOpenProductDetails(sr)}
                      style={{ cursor: 'pointer' }}
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                      }}
                    />
                    <div className="smart-rec-info">
                      <div>
                        <div
                          className="smart-rec-name"
                          title={sr.name}
                          onClick={() => handleOpenProductDetails(sr)}
                          style={{ cursor: 'pointer' }}
                        >
                          {sr.name}
                        </div>
                        <div className="smart-rec-price">{sr.price}</div>
                        {sr.demand_badge && (
                          <div style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700, marginBottom: '6px' }}>
                            {sr.demand_badge}
                          </div>
                        )}
                      </div>
                      <div className="smart-rec-actions">
                        <button
                          type="button"
                          className="btn-smart-mini btn-smart-view"
                          onClick={() => handleOpenProductDetails(sr)}
                          title="Quick View & Relevant Pairs"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          type="button"
                          className="btn-smart-mini btn-smart-add"
                          onClick={() => addToCart(sr)}
                        >
                          <Plus size={12} /> Bag
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Products Grid */}
        {loading ? (
          <div className="empty-catalog">Loading latest luxury collection...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-catalog">No items found matching your filters.</div>
        ) : (
          <div className="storefront-products-grid">
            {filteredProducts.map((p) => {
              const pricing = getProductPricing(p);

              return (
                <div
                  key={p.id}
                  className="store-product-card card"
                  style={{
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 0,
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-lg)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '280px',
                      overflow: 'hidden',
                      background: '#1e293b',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleOpenProductDetails(p)}
                  >
                    <img
                      src={getProductImageUrl(p.image_urls?.[0])}
                      alt={p.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transition: 'transform 0.4s ease',
                      }}
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        zIndex: 2,
                      }}
                    >
                      <span
                        style={{
                          background: 'rgba(15, 23, 42, 0.85)',
                          backdropFilter: 'blur(8px)',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: 'var(--accent-indigo)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          width: 'fit-content',
                        }}
                      >
                        {p.category}
                      </span>
                      {pricing.isOnSale && (
                        <span className="shelf-badge-sale" style={{ width: 'fit-content' }}>
                          <Flame size={11} /> {pricing.discountPercent ? `-${pricing.discountPercent}%` : 'SALE'}
                        </span>
                      )}
                      {p.sales_count > 0 ? (
                        <span className="shelf-badge-trending" style={{ width: 'fit-content' }} title={`${p.sales_count} units sold`}>
                          <Sparkles size={11} /> {p.sales_count} Sold
                        </span>
                      ) : p.order_count > 0 ? (
                        <span className="shelf-badge-trending" style={{ width: 'fit-content' }} title={`${p.order_count} client orders`}>
                          <Sparkles size={11} /> {p.order_count} Orders
                        </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '6px',
                        zIndex: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(p);
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isInWishlist(p.id) ? 'rgba(239, 68, 68, 0.9)' : 'rgba(15, 23, 42, 0.75)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: isInWishlist(p.id) ? '#ffffff' : '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          title={isInWishlist(p.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                        >
                          <Heart size={15} fill={isInWishlist(p.id) ? '#ffffff' : 'none'} />
                        </button>
                        <div
                          style={{
                            background: 'rgba(16, 185, 129, 0.85)',
                            backdropFilter: 'blur(8px)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            color: '#fff',
                          }}
                        >
                          In Stock
                        </div>
                      </div>
                      {pricing.season && (
                        <span className="shelf-badge-season">
                          <Sun size={11} /> {pricing.season}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3
                        className="store-product-title"
                        style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '2px', cursor: 'pointer', flex: 1 }}
                        onClick={() => handleOpenProductDetails(p)}
                      >
                        {p.name}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0 6px', color: '#fbbf24', fontSize: '0.74rem' }}>
                      <Star size={12} fill="#fbbf24" />
                      <span style={{ fontWeight: 700, color: '#f8fafc' }}>4.8</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>(Verified)</span>
                    </div>
                    <p
                      className="store-product-desc"
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.82rem',
                        lineHeight: 1.5,
                        flex: 1,
                        marginBottom: '10px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {p.description}
                    </p>

                    {pricing.promoCode && (
                      <div className="shelf-promo-code-tag">
                        <Tag size={11} /> Code: <strong>{pricing.promoCode}</strong>
                      </div>
                    )}

                    <div className="product-card-footer">
                      <div className="product-price-tag">
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                          PKR {pricing.effectivePrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {pricing.isOnSale && pricing.originalPrice > pricing.effectivePrice && (
                          <span style={{ textDecoration: 'line-through', opacity: 0.5, fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                            PKR {pricing.originalPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                        {pricing.isOnSale && pricing.discountPercent ? (
                          <span style={{ fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                            SAVE {pricing.discountPercent}%
                          </span>
                        ) : null}
                      </div>
                      <div className="product-card-actions-row">
                        <button
                          type="button"
                          className="btn btn-secondary store-order-wa-btn"
                          onClick={() => handleOpenProductDetails(p)}
                          title="Quick View & Paired Outfits"
                          style={{ padding: '8px 11px', flexShrink: 0 }}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary store-order-wa-btn"
                          style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
                          onClick={() => {
                            handleSendChatMessage(`Tell me more about ${p.name}`);
                            const el = document.getElementById('stylist-chat-box');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                        >
                          <Sparkles size={14} />
                          <span>Style Advice</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary store-order-wa-btn"
                          style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}
                          onClick={() => addToCart(p)}
                        >
                          <Plus size={14} />
                          <span>Add to Bag</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recently Viewed Outfits Shelf */}
      {recentlyViewed.length > 0 && (
        <section className="recently-viewed-section" style={{ maxWidth: '1280px', margin: '40px auto 20px', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                Recently Viewed Pieces (حالیہ دیکھے گئے ملبوسات)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setRecentlyViewed([]);
                try { localStorage.removeItem('luxe_recently_viewed'); } catch {}
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '0.78rem', cursor: 'pointer' }}
            >
              Clear History
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {recentlyViewed.map((rv) => {
              const pricing = getProductPricing(rv);
              return (
                <div
                  key={rv.id}
                  className="glass-card"
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                  }}
                  onClick={() => handleOpenProductDetails(rv)}
                >
                  <div style={{ position: 'relative', width: '100%', height: '170px', overflow: 'hidden' }}>
                    <img
                      src={getProductImageUrl(rv.image_urls?.[0] || rv.image_url)}
                      alt={rv.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                      }}
                    />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rv.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--primary)' }}>
                        PKR {pricing.effectivePrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(rv);
                        }}
                        style={{
                          background: 'rgba(212, 175, 55, 0.15)',
                          border: '1px solid var(--primary)',
                          color: '#fef08a',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Plus size={11} /> Bag
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Cart Drawer Slide-over Modal */}
      {isCartOpen && (
        <div className="cart-drawer-overlay" onClick={() => setIsCartOpen(false)}>
          <div className="cart-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="cart-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShoppingBag size={20} className="header-icon" />
                <h3>Your Shopping Bag ({totalCartCount})</h3>
              </div>
              <button className="cart-close-btn" onClick={() => setIsCartOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="cart-items-scroll">
              {cart.length === 0 ? (
                <div className="cart-empty-message">
                  <ShoppingBag size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                  <p>Your shopping bag is currently empty.</p>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '16px' }}
                    onClick={() => setIsCartOpen(false)}
                  >
                    Browse Collection
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="cart-item-row" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', marginBottom: '8px', border: '1px solid var(--border-glass)' }}>
                    <img
                      src={getProductImageUrl(item.product.image_urls?.[0])}
                      alt={item.product.name}
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        border: '1px solid var(--border-glass)',
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                      }}
                    />
                    <div className="cart-item-details" style={{ flex: 1, minWidth: 0 }}>
                      <div className="cart-item-name" style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.product.name}
                      </div>
                      <div className="cart-item-price" style={{ color: 'var(--primary)', fontSize: '0.84rem', marginTop: '3px', fontWeight: 700 }}>
                        PKR {item.price.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} each
                      </div>
                    </div>
                    <div className="cart-item-actions">
                      <div className="qty-control-box">
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.product.id, -1)}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="qty-val">{item.quantity}</span>
                        <button
                          className="qty-btn"
                          onClick={() => updateQuantity(item.product.id, 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        className="remove-item-btn"
                        onClick={() => removeFromCart(item.product.id)}
                        title="Remove item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="cart-drawer-footer">
                {/* Free Delivery Goal Progress Bar */}
                <div style={{ marginBottom: '14px', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: cartSubtotal >= FREE_SHIPPING_THRESHOLD ? '#10b981' : 'var(--text-muted)' }}>
                      <Truck size={14} />
                      {cartSubtotal >= FREE_SHIPPING_THRESHOLD ? (
                        <strong>🎉 Mubarak! You unlocked FREE Express Delivery!</strong>
                      ) : (
                        <span>
                          Add <strong>PKR {(FREE_SHIPPING_THRESHOLD - cartSubtotal).toLocaleString('en-PK')}</strong> more for <strong>FREE Delivery</strong>
                        </span>
                      )}
                    </span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>PKR {FREE_SHIPPING_THRESHOLD.toLocaleString()}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.round((cartSubtotal / FREE_SHIPPING_THRESHOLD) * 100))}%`,
                        height: '100%',
                        background: cartSubtotal >= FREE_SHIPPING_THRESHOLD ? '#10b981' : 'linear-gradient(90deg, var(--primary), #fbbf24)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>

                {/* Promo Code Voucher Input */}
                <div style={{ marginBottom: '12px' }}>
                  {appliedCoupon ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Tag size={13} />
                        <span>Voucher <strong>{appliedCoupon.code}</strong> applied (-PKR {appliedCoupon.discount_amount.toLocaleString()})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAppliedCoupon(null)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="Voucher code (e.g. GALA30, FLASH25)"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          style={{ flex: 1, padding: '7px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', textTransform: 'uppercase' }}
                        />
                        <button
                          type="submit"
                          disabled={couponLoading || !couponInput.trim()}
                          className="btn btn-secondary"
                          style={{ padding: '6px 14px', fontSize: '0.78rem' }}
                        >
                          {couponLoading ? <RefreshCw size={13} className="spin" /> : 'Apply'}
                        </button>
                      </form>

                      {/* Quick-Apply Promo Voucher Chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', marginTop: '7px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginRight: '2px' }}>Quick Apply:</span>
                        {[
                          { code: 'GALA30', label: '30% Gala' },
                          { code: 'FLASH25', label: '25% Flash' },
                          { code: 'WELCOME10', label: '10% Welcome' },
                          { code: 'LUXE500', label: 'PKR 500' },
                        ].map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            disabled={couponLoading}
                            onClick={async () => {
                              setCouponInput(c.code);
                              setCouponLoading(true);
                              setCouponError('');
                              try {
                                const res = await api.validateCoupon(c.code, cartSubtotal);
                                if (res.valid) {
                                  setAppliedCoupon(res);
                                  setCouponError('');
                                } else {
                                  setCouponError(res.message || 'Invalid coupon');
                                  setAppliedCoupon(null);
                                }
                              } catch (err) {
                                setCouponError(err.message || 'Validation error');
                                setAppliedCoupon(null);
                              } finally {
                                setCouponLoading(false);
                              }
                            }}
                            style={{
                              padding: '2px 7px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: '1px solid rgba(99, 102, 241, 0.35)',
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#a5b4fc',
                              cursor: 'pointer',
                            }}
                          >
                            🏷️ {c.code} ({c.label})
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {couponError && (
                    <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '6px' }}>
                      ⚠️ {couponError}
                    </div>
                  )}
                </div>

                <div className="cart-summary-line">
                  <span>Subtotal</span>
                  <strong>PKR {cartSubtotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
                {appliedCoupon && (
                  <div className="cart-summary-line" style={{ color: '#10b981' }}>
                    <span>Voucher Discount ({appliedCoupon.code})</span>
                    <strong>-PKR {couponDiscount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                )}
                <div className="cart-summary-line">
                  <span>Delivery Fee</span>
                  <span>{deliveryFee === 0 ? 'FREE' : `PKR ${deliveryFee.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                </div>
                <div className="cart-summary-line total-line">
                  <span>Total Payable</span>
                  <strong>PKR {cartTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>

                <button
                  className="btn btn-primary btn-checkout-action"
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                >
                  <span>Proceed to Instant Checkout</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instant Checkout Modal */}
      {isCheckoutOpen && (
        <div
          className="modal-backdrop modal-overlay"
          onClick={() => setIsCheckoutOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(4, 7, 14, 0.82)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            padding: '20px',
          }}
        >
          <div
            className="modal-dialog checkout-modal glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              zIndex: 10001,
              width: '100%',
              maxWidth: '640px',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Truck size={22} style={{ color: 'var(--primary)' }} />
                <h3>Instant Checkout & Delivery</h3>
              </div>
              <button
                type="button"
                className="cart-close-btn"
                onClick={() => setIsCheckoutOpen(false)}
                title="Close checkout dialog"
              >
                <X size={18} />
              </button>
            </div>

            {checkoutError && <div className="tracker-error-alert">{checkoutError}</div>}

            <form onSubmit={handlePlaceOrder} className="checkout-form">
              <div className="checkout-grid">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={checkoutForm.fullName}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, fullName: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">WhatsApp Contact Number</label>
                  <div className="input-with-icon">
                    <Phone size={16} className="input-icon" />
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={checkoutForm.phone}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, phone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Delivery Street Address</label>
                  <div className="input-with-icon">
                    <MapPin size={16} className="input-icon" />
                    <input
                      type="text"
                      required
                      className="form-input"
                      value={checkoutForm.streetAddress}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, streetAddress: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={checkoutForm.city}
                    onChange={(e) =>
                      setCheckoutForm({ ...checkoutForm, city: e.target.value })
                    }
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">
                    Email Address <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(Optional - for receipts & order tracking)</span>
                  </label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="email"
                      className="form-input"
                      placeholder="customer@example.com (optional)"
                      value={checkoutForm.email || ''}
                      onChange={(e) =>
                        setCheckoutForm({ ...checkoutForm, email: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-input"
                    value={checkoutForm.paymentMethod}
                    onChange={(e) =>
                      setCheckoutForm({ ...checkoutForm, paymentMethod: e.target.value })
                    }
                  >
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Order Summary Mini Box */}
              <div className="checkout-items-preview">
                <div className="preview-heading">Order Items ({cart.length}):</div>
                {cart.map((c) => (
                  <div key={c.product.id} className="preview-row" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <img
                      src={getProductImageUrl(c.product.image_urls?.[0])}
                      alt={c.product.name}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '6px',
                        objectFit: 'cover',
                        border: '1px solid var(--border-glass)',
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=150&q=80';
                      }}
                    />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>
                      {c.quantity}x {c.product.name}
                    </span>
                    <strong style={{ color: 'var(--primary)', fontSize: '0.88rem' }}>PKR {(c.price * c.quantity).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                ))}
                {appliedCoupon && (
                  <div className="preview-row" style={{ color: '#10b981', display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem' }}>
                    <span>Voucher Discount ({appliedCoupon.code})</span>
                    <strong>-PKR {couponDiscount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                )}
                <div className="preview-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>Delivery Charges</span>
                  <span>{deliveryFee === 0 ? 'FREE Express Delivery' : `PKR ${deliveryFee.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                </div>
                <div className="preview-row total-highlight">
                  <span>Grand Total</span>
                  <strong>PKR {cartTotal.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    setIsCartOpen(true);
                  }}
                >
                  Back to Cart
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? (
                    <RefreshCw size={16} className="spin" />
                  ) : (
                    <>
                      <span>Confirm & Place Order</span>
                      <CheckCircle size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Placement Confirmation Success Modal */}
      {confirmedOrder && (
        <div className="cart-drawer-overlay" onClick={() => setConfirmedOrder(null)}>
          <div
            className="cart-drawer-content"
            style={{ maxWidth: '520px', margin: 'auto', borderRadius: 'var(--radius-lg)', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  marginBottom: '12px',
                }}
              >
                <CheckCircle size={36} />
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px' }}>Order Placed Successfully!</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                Thank you for shopping with Luxe Atelier. Your order has been placed!
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Order Number / ID:</span>
                <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>#{confirmedOrder.order_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Total Amount:</span>
                <strong>PKR {Number(confirmedOrder.total || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Complimentary Free Express Delivery)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Payment Method:</span>
                <span>Cash on Delivery (COD)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Delivery To:</span>
                <span style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                  {confirmedOrder.address_snapshot?.full_name} ({confirmedOrder.address_snapshot?.city})
                </span>
              </div>
              {confirmedOrder.address_snapshot?.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Email Receipt:</span>
                  <span style={{ color: '#818cf8', fontSize: '0.85rem' }}>{confirmedOrder.address_snapshot?.email}</span>
                </div>
              )}

              {/* Display Purchased Outfits Inside Confirmation Card */}
              {confirmedOrder.items && confirmedOrder.items.length > 0 && (
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                    Purchased Outfits ({confirmedOrder.items.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
                    {confirmedOrder.items.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                        }}
                      >
                        <img
                          src={it.image_url || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80'}
                          alt={it.name}
                          style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0, fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {it.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {it.color && it.color !== 'Standard' ? `Color: ${it.color} • ` : ''}
                            {it.size && it.size !== 'Standard' ? `Size: ${it.size} • ` : ''}
                            Qty: {it.quantity}
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.82rem' }}>
                          PKR {Number(it.total_price || (it.unit_price * it.quantity) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  setConfirmedOrder(null);
                  const el = document.getElementById('stylist-chat-box');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Sparkles size={16} /> Chat with Aria
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setConfirmedOrder(null);
                  const el = document.getElementById('track-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Package size={16} /> Track Order Status
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{
                width: '100%',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(99, 102, 241, 0.15)',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                color: '#c7d2fe',
                padding: '10px 16px',
                fontWeight: 600,
              }}
              onClick={() => {
                const targetPh = confirmedOrder.address_snapshot?.phone;
                setConfirmedOrder(null);
                handleOpenMyOrders(targetPh);
              }}
            >
              <ShoppingBag size={16} style={{ color: '#818cf8' }} />
              <span>View in My Orders (آپ کے تمام آرڈرز)</span>
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Customer "My Orders & Purchases" Hub Modal */}
      {isMyOrdersOpen && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setIsMyOrdersOpen(false)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderRadius: '16px',
              background: '#0b1120',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '16px',
                marginBottom: '18px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818cf8',
                  }}
                >
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                    My Orders & Purchases (آپ کے خریدے گئے آرڈرز)
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    View all your purchased outfits, live dispatch status, and parcel delivery progress.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMyOrdersOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Phone Lookup Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleOpenMyOrders(myOrdersPhone);
              }}
              style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '18px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.07)',
                alignItems: 'center',
              }}
            >
              <Phone size={15} style={{ color: 'var(--primary)' }} />
              <input
                type="text"
                className="form-input"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '6px 8px',
                  color: '#f8fafc',
                  fontSize: '0.88rem',
                }}
                placeholder="Enter WhatsApp or Phone # (e.g. +923001234567)"
                value={myOrdersPhone}
                onChange={(e) => setMyOrdersPhone(e.target.value)}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                disabled={myOrdersLoading}
              >
                {myOrdersLoading ? <RefreshCw size={14} className="spin" /> : 'Find Orders'}
              </button>
            </form>

            {myOrdersError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  marginBottom: '16px',
                }}
              >
                ⚠️ {myOrdersError}
              </div>
            )}

            {/* Orders Content */}
            {myOrdersLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin" style={{ color: 'var(--primary)', marginBottom: '10px' }} />
                <div style={{ fontSize: '0.9rem' }}>Retrieving your purchases...</div>
              </div>
            ) : myOrdersList.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                }}
              >
                <ShoppingBag size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px', opacity: 0.5 }} />
                <h4 style={{ fontSize: '1.05rem', margin: '0 0 6px', color: '#f8fafc' }}>No Purchases Found Yet</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto 16px' }}>
                  Aapke is phone number par abhi koi order record nahi mila. Agar aapne kisi doosre number se order kiya tha toh upar number tabdeel karein!
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setIsMyOrdersOpen(false);
                    const el = document.getElementById('catalog-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  style={{ fontSize: '0.85rem' }}
                >
                  <Sparkles size={14} /> Explore Atelier Catalog
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--text-dim)',
                    padding: '0 4px',
                  }}
                >
                  <span>
                    Found <strong style={{ color: '#f8fafc' }}>{myOrdersList.length}</strong> orders on record
                  </span>
                  <span>Currency: PKR (Cash on Delivery)</span>
                </div>

                {myOrdersList.map((ord) => {
                  const statusColors = {
                    DELIVERED: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', text: '#10b981' },
                    OUT_FOR_DELIVERY: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.35)', text: '#fb923c' },
                    SHIPPED: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)', text: '#60a5fa' },
                    IN_TRANSIT: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.35)', text: '#60a5fa' },
                    CONFIRMED: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' },
                    PROCESSING: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' },
                    PENDING: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.35)', text: '#a5b4fc' },
                    CANCELLED: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.35)', text: '#ef4444' },
                    RETURNED: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.35)', text: '#facc15' },
                  };
                  const stStyle = statusColors[ord.status] || statusColors.PENDING;

                  return (
                    <div
                      key={ord.id || ord.order_number}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '16px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Order Card Top Bar */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          paddingBottom: '12px',
                          marginBottom: '12px',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary)', letterSpacing: '0.5px' }}>
                              #{ord.order_number}
                            </span>
                            <span
                              style={{
                                padding: '3px 10px',
                                borderRadius: 'var(--radius-full)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background: stStyle.bg,
                                border: `1px solid ${stStyle.border}`,
                                color: stStyle.text,
                              }}
                            >
                              {ord.status?.replace('_', ' ')}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '3px' }}>
                            Placed on {new Date(ord.created_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                            PKR {Number(ord.total || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Cash on Delivery (Free Delivery 🚚)
                          </div>
                        </div>
                      </div>

                      {/* Courier Dispatch Banner (if booked) */}
                      {ord.tracking_number && (
                        <div
                          style={{
                            margin: '8px 0 12px',
                            padding: '8px 12px',
                            background: 'rgba(56, 189, 248, 0.1)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                            fontSize: '0.78rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
                            <Truck size={14} />
                            <span>Courier Partner: <strong>{ord.courier_partner || 'Trax Logistics'}</strong></span>
                            <span>•</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{ord.tracking_number}</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.72rem', padding: '3px 8px', borderColor: '#38bdf8', color: '#38bdf8' }}
                            onClick={() => {
                              setIsMyOrdersOpen(false);
                              handleTrackOrder(null, ord.tracking_number);
                              const el = document.getElementById('track-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                          >
                            Track Courier
                          </button>
                        </div>
                      )}

                      {/* Purchased Outfits List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {ord.items?.map((it, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '8px 10px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              borderRadius: '8px',
                              border: '1px solid rgba(255, 255, 255, 0.04)',
                            }}
                          >
                            <img
                              src={it.image_url || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80'}
                              alt={it.name}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                border: '1px solid var(--border-glass)',
                                flexShrink: 0,
                              }}
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {it.name}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '3px', fontSize: '0.72rem' }}>
                                {it.color && it.color !== 'Standard' && (
                                  <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' }}>
                                    Color: <b>{it.color}</b>
                                  </span>
                                )}
                                {it.size && it.size !== 'Standard' && (
                                  <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' }}>
                                    Size: <b>{it.size}</b>
                                  </span>
                                )}
                                <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.12)', color: '#c7d2fe' }}>
                                  Qty: <b>{it.quantity}</b>
                                </span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem' }}>
                                PKR {Number(it.total_price || (it.unit_price * it.quantity) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {it.quantity > 1 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                  PKR {Number(it.unit_price || 0).toLocaleString('en-PK')} each
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Cancellation & Return Status Notices */}
                      {ord.cancellation_reason && (
                        <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: '0.74rem' }}>
                          Reason for cancellation: {ord.cancellation_reason}
                        </div>
                      )}
                      {ord.return_status && (
                        <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#fde047', fontSize: '0.74rem', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Return / Exchange Status: <strong>{ord.return_status}</strong></span>
                          <span>Reason: {ord.return_reason}</span>
                        </div>
                      )}

                      {/* Card Footer: Delivery destination & Fast Actions */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginTop: '12px',
                          paddingTop: '10px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                          fontSize: '0.76rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={13} style={{ color: 'var(--primary)' }} />
                          <span>
                            {ord.address_snapshot?.street_address
                              ? `${ord.address_snapshot.street_address}, ${ord.address_snapshot.city}`
                              : ord.address_snapshot?.city || 'Pakistan'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {/* Printable Tax Invoice Button */}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '4px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setInvoiceOrder(ord)}
                            title="Print Official Tax Receipt"
                          >
                            <Printer size={12} />
                            <span>Invoice</span>
                          </button>

                          {/* Self-Service Order Cancellation (If Pending) */}
                          {ord.status === 'PENDING' && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: '0.74rem', padding: '4px 9px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                              onClick={() => setOrderToCancel(ord)}
                            >
                              <X size={12} />
                              <span>Cancel Order</span>
                            </button>
                          )}

                          {/* 7-Day Return / Exchange (If Delivered and not already requested) */}
                          {ord.status === 'DELIVERED' && !ord.return_status && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ fontSize: '0.74rem', padding: '4px 9px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(234, 179, 8, 0.4)', color: '#facc15' }}
                              onClick={() => setOrderToReturn(ord)}
                            >
                              <RotateCcw size={12} />
                              <span>Return / Exchange</span>
                            </button>
                          )}

                          {/* Track Status */}
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ fontSize: '0.74rem', padding: '4px 9px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => {
                              setIsMyOrdersOpen(false);
                              handleTrackOrder(null, ord.order_number);
                              const el = document.getElementById('track-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                          >
                            <Search size={12} />
                            <span>Track</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Quick View & Complete The Look Modal */}
      {selectedProductModal && (
        <div className="product-modal-overlay" onClick={handleCloseProductDetails}>
          <div className="product-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="product-modal-close" onClick={handleCloseProductDetails}>
              <X size={18} />
            </button>

            <div className="product-modal-body">
              <div className="product-modal-image-col">
                <ProductImageGalleryZoom
                  product={selectedProductModal}
                  selectedColor={modalSelectedColor}
                  onColorChange={setModalSelectedColor}
                />
              </div>

              <div className="product-modal-info-col">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {selectedProductModal.category}
                  </span>
                  {selectedProductModal.demand_badge && (
                    <span className="product-modal-demand-tag">
                      <Flame size={12} /> {selectedProductModal.demand_badge}
                    </span>
                  )}
                </div>

                <h2 className="product-modal-title">{selectedProductModal.name}</h2>

                {/* Price & Stock Display */}
                {(() => {
                  const matchedVariant = selectedProductModal.variants?.find(
                    (v) =>
                      (!modalSelectedColor || v.color === modalSelectedColor) &&
                      (!modalSelectedSize || v.size === modalSelectedSize)
                  );
                  const displayPrice = matchedVariant?.price
                    ? `PKR ${Number(matchedVariant.price).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : typeof selectedProductModal.price === 'string' && selectedProductModal.price.startsWith('PKR')
                    ? selectedProductModal.price
                    : typeof selectedProductModal.price === 'string' && selectedProductModal.price.startsWith('$')
                    ? selectedProductModal.price.replace('$', 'PKR ')
                    : `PKR ${Number(selectedProductModal.min_price || selectedProductModal.price || 14000).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const stockQty = matchedVariant?.available_quantity ?? selectedProductModal.total_stock ?? 15;

                  return (
                    <div className="product-modal-price-row">
                      <div className="product-modal-price">{displayPrice}</div>
                      <div style={{ color: stockQty > 0 ? '#10b981' : '#f87171', fontSize: '0.82rem', fontWeight: 700 }}>
                        {stockQty > 0
                          ? `✓ In Stock (${stockQty} units available)`
                          : '✕ Currently Out of Stock'}
                      </div>
                    </div>
                  );
                })()}

                <p className="product-modal-desc">{selectedProductModal.description}</p>

                {/* Interactive Variant Selectors: Colors & Sizes */}
                {selectedProductModal.variants && selectedProductModal.variants.length > 0 ? (
                  <div style={{ marginBottom: '20px' }}>
                    {/* Color Options */}
                    {(() => {
                      const availColors = Array.from(
                        new Set(selectedProductModal.variants.map((v) => v.color).filter(Boolean))
                      );
                      if (availColors.length === 0) return null;
                      const activeColor = modalSelectedColor || availColors[0];
                      return (
                        <div style={{ marginBottom: '14px' }}>
                          <div className="meta-item-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Available Colorway</span>
                            <span style={{ color: 'var(--primary)', textTransform: 'none', fontWeight: 700 }}>
                              {activeColor}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {availColors.map((col) => {
                              const isSel = activeColor === col;
                              return (
                                <button
                                  key={col}
                                  type="button"
                                  onClick={() => setModalSelectedColor(col)}
                                  style={{
                                    padding: '6px 14px',
                                    borderRadius: '20px',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    border: isSel ? '1.5px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.15)',
                                    background: isSel ? 'rgba(212, 175, 55, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                                    color: isSel ? '#fef08a' : '#cbd5e1',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                  }}
                                >
                                  {isSel && <Check size={12} style={{ color: 'var(--primary)' }} />}
                                  {col}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Size Options */}
                    {(() => {
                      const availSizes = Array.from(
                        new Set(selectedProductModal.variants.map((v) => v.size).filter(Boolean))
                      );
                      if (availSizes.length === 0) return null;
                      const activeSize = modalSelectedSize || availSizes[0];
                      return (
                        <div>
                          <div className="meta-item-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>Atelier Tailored Size</span>
                              <button
                                type="button"
                                onClick={() => setIsSizeGuideOpen(true)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--primary)',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  textDecoration: 'underline',
                                }}
                              >
                                <Ruler size={12} /> Size Guide & Measurements
                              </button>
                            </div>
                            <span style={{ color: 'var(--primary)', textTransform: 'none', fontWeight: 700 }}>
                              {activeSize}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {availSizes.map((sz) => {
                              const isSel = activeSize === sz;
                              return (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() => setModalSelectedSize(sz)}
                                  style={{
                                    minWidth: '42px',
                                    height: '36px',
                                    padding: '0 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    border: isSel ? '1.5px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.15)',
                                    background: isSel ? 'rgba(212, 175, 55, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                                    color: isSel ? '#fff' : '#94a3b8',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  {sz}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="product-modal-meta-grid">
                    <div>
                      <div className="meta-item-label">Available Colors</div>
                      <div className="meta-item-val">{selectedProductModal.colors || 'Standard Palette'}</div>
                    </div>
                    <div>
                      <div className="meta-item-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Sizes</span>
                        <button
                          type="button"
                          onClick={() => setIsSizeGuideOpen(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            textDecoration: 'underline',
                          }}
                        >
                          <Ruler size={11} /> Size Guide
                        </button>
                      </div>
                      <div className="meta-item-val">{selectedProductModal.sizes || 'XS, S, M, L, XL'}</div>
                    </div>
                  </div>
                )}

                {(() => {
                  const matchedVariant = selectedProductModal.variants?.find(
                    (v) =>
                      (!modalSelectedColor || v.color === modalSelectedColor) &&
                      (!modalSelectedSize || v.size === modalSelectedSize)
                  );
                  const stockQty = matchedVariant?.available_quantity ?? selectedProductModal.total_stock ?? 15;
                  const isOutOfStock = stockQty <= 0;

                  return (
                    <div className="product-modal-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button
                        className="btn btn-primary"
                        disabled={isOutOfStock}
                        style={{
                          flex: '2 1 180px',
                          padding: '12px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          opacity: isOutOfStock ? 0.5 : 1,
                          cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          background: isOutOfStock ? '#475569' : undefined,
                        }}
                        onClick={() => {
                          if (isOutOfStock) return;
                          addToCart(selectedProductModal, matchedVariant);
                          handleCloseProductDetails();
                        }}
                      >
                        {isOutOfStock ? (
                          <>
                            <X size={16} /> Currently Out of Stock
                          </>
                        ) : (
                          <>
                            <Plus size={16} /> Add to Shopping Bag
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => toggleWishlist(selectedProductModal)}
                        style={{
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isInWishlist(selectedProductModal.id) ? '#f43f5e' : 'var(--text-muted)',
                        }}
                        title={isInWishlist(selectedProductModal.id) ? 'Remove from Wishlist' : 'Save to Wishlist'}
                      >
                        <Heart size={16} fill={isInWishlist(selectedProductModal.id) ? '#f43f5e' : 'none'} />
                      </button>

                      <a
                        href={getWhatsAppShareUrl(selectedProductModal)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#25D366' }}
                        title="Share Outfit on WhatsApp"
                      >
                        <Share2 size={16} />
                        <span>Share</span>
                      </a>

                      <button
                        className="btn btn-secondary"
                        style={{ flex: '1 1 140px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        onClick={() => {
                          const name = selectedProductModal.name;
                          handleCloseProductDetails();
                          handleSendChatMessage(`Tell me more about ${name}`);
                          const el = document.getElementById('stylist-chat-box');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        <Sparkles size={16} /> Style Advice
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Complete The Look — Relevant & Frequently Paired Outfits */}
            <div className="modal-paired-section">
              <div className="modal-paired-heading">
                <Sparkles size={16} />
                <span>Complete The Look — Frequently Paired Outfits</span>
              </div>

              {modalLoadingRelated ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={14} className="spin" /> Finding matching pieces with AI Recommender...
                </div>
              ) : modalRelatedProducts.length === 0 ? (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.82rem' }}>
                  No complementary pieces currently registered for this item.
                </div>
              ) : (
                <div className="modal-paired-grid">
                  {modalRelatedProducts.map((rp) => (
                    <div key={rp.id} className="modal-paired-card">
                      <img
                        src={rp.image_url || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80'}
                        alt={rp.name}
                        className="modal-paired-thumb"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                        }}
                      />
                      <div className="modal-paired-info">
                        <div className="modal-paired-name" title={rp.name}>{rp.name}</div>
                        <div className="modal-paired-price">{rp.price}</div>
                        <button
                          type="button"
                          className="btn-smart-mini btn-smart-add"
                          onClick={() => addToCart(rp)}
                        >
                          <Plus size={12} /> Add Pair
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Verified Customer Reviews & Ratings */}
            <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 4px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={16} fill="var(--primary)" color="var(--primary)" />
                    Verified Customer Reviews ({productReviews.total_reviews})
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Average Rating: <strong style={{ color: '#fef08a' }}>{productReviews.average_rating || 5.0} / 5.0</strong> ★
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '6px 12px' }}
                  onClick={() => setIsWriteReviewOpen(!isWriteReviewOpen)}
                >
                  {isWriteReviewOpen ? 'Close Review Form' : 'Write a Review'}
                </button>
              </div>

              {reviewSuccess && (
                <div style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontSize: '0.8rem', marginBottom: '12px' }}>
                  ✓ {reviewSuccess}
                </div>
              )}

              {/* Write Review Form */}
              {isWriteReviewOpen && (
                <form onSubmit={handleSubmitReview} style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Your Name</label>
                      <input
                        type="text"
                        required
                        className="form-input"
                        placeholder="e.g. Ayesha Khan"
                        value={newReviewForm.name}
                        onChange={(e) => setNewReviewForm({ ...newReviewForm, name: e.target.value })}
                        style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Rating</label>
                      <select
                        className="form-input"
                        value={newReviewForm.rating}
                        onChange={(e) => setNewReviewForm({ ...newReviewForm, rating: Number(e.target.value) })}
                        style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                      >
                        <option value={5}>★★★★★ (5/5 Excellent)</option>
                        <option value={4}>★★★★☆ (4/5 Very Good)</option>
                        <option value={3}>★★★☆☆ (3/5 Average)</option>
                        <option value={2}>★★☆☆☆ (2/5 Below Average)</option>
                        <option value={1}>★☆☆☆☆ (1/5 Poor)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Your Feedback & Fit Review</label>
                    <textarea
                      required
                      className="form-input"
                      rows={2}
                      placeholder="Fabric quality, stitching details, and fit feedback..."
                      value={newReviewForm.comment}
                      onChange={(e) => setNewReviewForm({ ...newReviewForm, comment: e.target.value })}
                      style={{ fontSize: '0.8rem', padding: '6px 10px', resize: 'vertical' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="btn btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 16px' }}
                  >
                    {reviewSubmitting ? <RefreshCw size={13} className="spin" /> : 'Post Verified Review'}
                  </button>
                </form>
              )}

              {/* Reviews List */}
              {loadingReviews ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '10px 0' }}>
                  <RefreshCw size={14} className="spin" /> Loading customer reviews...
                </div>
              ) : productReviews.reviews && productReviews.reviews.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                  {productReviews.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#f1f5f9' }}>{rev.customer_name}</span>
                          {rev.verified_purchase && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 600 }}>
                              ✓ Verified Buyer
                            </span>
                          )}
                          {rev.city && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>• {rev.city}</span>
                          )}
                        </div>
                        <div style={{ color: '#fef08a', fontSize: '0.78rem' }}>
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </div>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                        "{rev.comment}"
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                  Be the first to leave a verified review for this design!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Self-Service Order Cancellation Confirmation Dialog */}
      {orderToCancel && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setOrderToCancel(null)}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', padding: '24px', borderRadius: '16px', background: '#0b1120' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#ef4444', margin: '0 0 10px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={20} /> Cancel Order #{orderToCancel.order_number}?
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.5 }}>
              Are you sure you want to cancel this order? It will be released from our atelier queue immediately.
            </p>
            {cancelError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>⚠️ {cancelError}</div>}
            <form onSubmit={handleCancelOrderSubmit}>
              <label style={{ fontSize: '0.76rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>Reason for Cancellation</label>
              <select
                className="form-input"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ width: '100%', marginBottom: '18px', fontSize: '0.84rem' }}
              >
                <option value="Ordered by mistake / Change of mind">Ordered by mistake / Change of mind</option>
                <option value="Want to change size or color">Want to change size or color</option>
                <option value="Delivery time is too long">Delivery time is too long</option>
                <option value="Found a different design">Found a different design</option>
                <option value="Other / Personal reason">Other / Personal reason</option>
              </select>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setOrderToCancel(null)}>Keep Order</button>
                <button type="submit" disabled={cancellingOrder} className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}>
                  {cancellingOrder ? <RefreshCw size={14} className="spin" /> : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7-Day Return / Exchange Request Dialog */}
      {orderToReturn && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setOrderToReturn(null)}>
          <div className="glass-card" style={{ maxWidth: '480px', width: '100%', padding: '24px', borderRadius: '16px', background: '#0b1120' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#facc15', margin: '0 0 10px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RotateCcw size={20} /> Request Return or Size Exchange
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Luxe Atelier 7-Day Hassle-Free Policy: We offer complimentary return and size exchange across Pakistan.
            </p>
            {returnError && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>⚠️ {returnError}</div>}
            <form onSubmit={handleReturnOrderSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Return / Exchange Reason</label>
                <select
                  className="form-input"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  style={{ width: '100%', fontSize: '0.84rem' }}
                >
                  <option value="Size does not fit properly (Exchange needed)">Size does not fit properly (Exchange needed)</option>
                  <option value="Fabric / Color different than expected">Fabric / Color different than expected</option>
                  <option value="Defective stitching or damaged in transit">Defective stitching or damaged in transit</option>
                  <option value="Wrong article received">Wrong article received</option>
                  <option value="Full Refund requested">Full Refund requested</option>
                </select>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '0.76rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>Additional Details / Desired Size</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Please exchange size M for size L, or pickup address details..."
                  value={returnDetails}
                  onChange={(e) => setReturnDetails(e.target.value)}
                  style={{ width: '100%', fontSize: '0.82rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setOrderToReturn(null)}>Close</button>
                <button type="submit" disabled={submittingReturn} className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b', color: '#000', fontWeight: 700 }}>
                  {submittingReturn ? <RefreshCw size={14} className="spin" /> : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Interactive Size Guide Modal */}
      <SizeGuideModal isOpen={isSizeGuideOpen} onClose={() => setIsSizeGuideOpen(false)} />

      {/* Official Tax Invoice & AWB Receipt Modal */}
      <PrintableInvoiceModal order={invoiceOrder} isOpen={!!invoiceOrder} onClose={() => setInvoiceOrder(null)} />

      {/* Wishlist Drawer Hub */}
      <WishlistDrawer
        isOpen={isWishlistOpen}
        onClose={() => setIsWishlistOpen(false)}
        wishlist={wishlist}
        onRemoveFromWishlist={handleRemoveFromWishlist}
        onClearWishlist={handleClearWishlist}
        onMoveToCart={handleMoveWishlistToCart}
        onMoveAllToCart={handleMoveAllWishlistToCart}
      />

      {/* Luxury Policy Modals */}
      <PolicyModal type={activePolicyModal} isOpen={!!activePolicyModal} onClose={() => setActivePolicyModal(null)} />

      {/* Luxury Haute Couture Storefront Footer */}
      <footer className="storefront-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#070a13', padding: '48px 24px 28px', marginTop: '60px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '32px', marginBottom: '36px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles size={20} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '2px', color: '#f8fafc' }}>LUXE ATELIER</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', lineHeight: 1.6, margin: '0 0 16px' }}>
              Pakistan's premier Haute Couture & Luxury Pret fashion house. Integrated with Aria, your 24/7 AI Stylist for bespoke recommendations and instant WhatsApp concierge service.
            </p>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
              Karachi Atelier • Lahore Design Studio • Islamabad Concierge
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
              Curated Collections
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              <li style={{ cursor: 'pointer' }} onClick={() => setSelectedCategory('ALL')}>All Ready-To-Wear Pret</li>
              <li style={{ cursor: 'pointer' }} onClick={() => setSelectedCategory('LUXURY FORMAL')}>Luxury Festive & Formals</li>
              <li style={{ cursor: 'pointer' }} onClick={() => setSelectedCategory('LAWN')}>Artisanal Embroidered Lawn</li>
              <li style={{ cursor: 'pointer' }} onClick={() => setSelectedCategory('BRIDAL')}>Bridal & Couture Trousseau</li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
              Boutique Services & Policies
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem', color: 'var(--text-muted)' }}>
              <li>
                <button type="button" onClick={() => setIsSizeGuideOpen(true)} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}>
                  📏 Atelier Size Guide & Fitting Chart
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActivePolicyModal('SHIPPING')} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}>
                  🚚 Express Nationwide Delivery & Trax Tracking
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActivePolicyModal('RETURNS')} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}>
                  🔄 7-Day Hassle-Free Returns & Exchanges
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActivePolicyModal('PRIVACY')} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}>
                  🔒 Data Privacy & WhatsApp Encryption
                </button>
              </li>
              <li>
                <button type="button" onClick={() => setActivePolicyModal('ABOUT')} style={{ background: 'none', border: 'none', color: 'inherit', padding: 0, cursor: 'pointer', fontSize: 'inherit' }}>
                  ✨ Brand Heritage & Artisanal Craft
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
              VIP Helpline & Studio
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 10px', lineHeight: 1.5 }}>
              Dedicated styling consultations and urgent order inquiries:
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#25D366', fontWeight: 700, fontSize: '0.92rem', marginBottom: '8px' }}>
              <MessageCircle size={16} /> +92 300 1234567 (WhatsApp)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '14px' }}>
              Operating Hours: Monday – Saturday (10:00 AM – 10:00 PM PKT)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                Cash on Delivery (Pakistan)
              </span>
              <span style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                100% Authentic Fabric
              </span>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
          <div>© 2026 Luxe Atelier Pakistan. All Rights Reserved.</div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>FastAPI Backend</span> • <span>MongoDB Atlas</span> • <span>Gemini AI Recommender</span> • <span>Trax Logistics AWB</span>
          </div>
        </div>
      </footer>
      {/* Floating Theme Switcher Widget */}
      <ThemeToggle variant="floating" />
    </div>
  );
}
