const API_HOST = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '';
const API_BASE = `${API_HOST}/api/v1`;

export function getProductImageUrl(src) {
  if (!src) return 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
  if (typeof src !== 'string') return src;
  const trimmed = src.trim();
  if (trimmed.startsWith('/static/')) {
    if (API_HOST) {
      return `${API_HOST}${trimmed}`;
    }
    // When accessing via Vite dev server on port 3000, direct hit to port 8000 ensures image loads reliably
    if (typeof window !== 'undefined' && window.location && window.location.port === '3000') {
      return `http://127.0.0.1:8000${trimmed}`;
    }
    return trimmed;
  }
  return trimmed;
}

export function getAuthToken() {
  return localStorage.getItem('token');
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(data) {
  if (data.access_token) {
    localStorage.setItem('token', data.access_token);
  }
  const user = {
    id: data.user_id,
    email: data.email,
    full_name: data.full_name || '',
    phone: data.phone || '',
    address: data.address || '',
    city: data.city || '',
    role: data.role || 'USER',
  };
  localStorage.setItem('user', JSON.stringify(user));
  return user;
}

export function clearAuthSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export async function fetchJson(endpoint, options = {}) {
  const token = getAuthToken();
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(options.headers || {}),
      },
      ...options,
    });
    if (!res.ok) {
      if (res.status === 401 && token) {
        clearAuthSession();
      }
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP Error ${res.status}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // Authentication & Staff Accounts
  login: (credentials) =>
    fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  register: (data) =>
    fetchJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getUsers: () => fetchJson('/users/').catch(() => []),
  createStaff: (data) =>
    fetchJson('/users/staff', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteUser: (id) =>
    fetchJson(`/users/${id}`, {
      method: 'DELETE',
    }),
  toggleUserStatus: (id, isActive) =>
    fetchJson(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }),

  // AI Fashion Stylist (Gemini) & Continuous Recommender
  chatWithStylist: (message, phone = null, history = []) =>
    fetchJson('/ai/stylist-chat', {
      method: 'POST',
      body: JSON.stringify({ message, phone: phone || null, history }),
    }),
  syncStylistChat: (phone = null) =>
    fetchJson(`/ai/stylist-chat/sync${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`),
  switchStylistToAi: (phone = null) =>
    fetchJson('/ai/stylist-chat/switch-to-ai', {
      method: 'POST',
      body: JSON.stringify({ phone: phone || null }),
    }),
  getRelatedProducts: (productId, phone = null) => {
    const q = phone ? `?phone=${encodeURIComponent(phone)}` : '';
    return fetchJson(`/ai/related-products/${productId}${q}`).catch(() => []);
  },
  smartSearch: (query, phone = null) => {
    const q = phone ? `&phone=${encodeURIComponent(phone)}` : '';
    return fetchJson(`/ai/smart-search?q=${encodeURIComponent(query)}${q}`).catch(() => []);
  },
  logInteraction: (data) =>
    fetchJson('/ai/log-interaction', {
      method: 'POST',
      body: JSON.stringify(data),
    }).catch(() => null),
  triggerOnlineTraining: () =>
    fetchJson('/ai/train-online', {
      method: 'POST',
    }).catch(() => null),
  // System Health
  getHealth: () =>
    fetchJson('/health').catch(() =>
      fetch('/health').then((r) => r.json())
    ),

  // Conversations & WhatsApp Live Chat
  getConversations: () => fetchJson('/conversations/'),
  getMessages: (conversationId) => fetchJson(`/conversations/${conversationId}/messages`),
  sendAgentMessage: (conversationId, text, imageUrl = null) =>
    fetchJson(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text, image_url: imageUrl }),
    }),
  assignAgent: (conversationId, userId) =>
    fetchJson(`/conversations/${conversationId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ user_id: userId }),
    }),

  // Categories Taxonomy
  getCategories: (includeInactive = false) =>
    fetchJson(`/categories/?include_inactive=${includeInactive}`).catch(() => []),
  getCategory: (idOrSlug) => fetchJson(`/categories/${idOrSlug}`),
  createCategory: (data) =>
    fetchJson('/categories/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCategory: (idOrSlug, data) =>
    fetchJson(`/categories/${idOrSlug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCategory: (idOrSlug) =>
    fetchJson(`/categories/${idOrSlug}`, {
      method: 'DELETE',
    }),
  bulkImportCategories: (items) =>
    fetchJson('/categories/bulk-import', {
      method: 'POST',
      body: JSON.stringify(items),
    }),
  bulkImportCategoriesCsv: async (file) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/categories/bulk-import-csv`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Categories CSV upload failed');
    }
    return await res.json();
  },
  getExportCategoriesCsvUrl: () => `${API_BASE}/categories/export-csv`,

  // Catalog & Inventory
  getProducts: (category = null) => {
    const q = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
    return fetchJson(`/products/${q}`);
  },
  getProduct: (idOrSlug) => fetchJson(`/products/${idOrSlug}`),
  createProduct: (data) =>
    fetchJson('/products/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createProductWithVariants: (data) =>
    fetchJson('/products/with-variants', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id, data) =>
    fetchJson(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProduct: (id) =>
    fetchJson(`/products/${id}`, {
      method: 'DELETE',
    }),
  createVariant: (productId, data) =>
    fetchJson(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteVariant: (variantId) =>
    fetchJson(`/products/variants/${variantId}`, {
      method: 'DELETE',
    }),
  updateVariantStock: (variantId, quantity) =>
    fetchJson(`/products/variants/${variantId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  bulkImportProducts: (items) =>
    fetchJson('/products/bulk-import', {
      method: 'POST',
      body: JSON.stringify(items),
    }),
  bulkImportCsv: async (file) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/products/bulk-import-csv`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'CSV upload failed');
    }
    return await res.json();
  },
  uploadProductImages: async (files) => {
    const token = getAuthToken();
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    const res = await fetch(`${API_BASE}/products/upload-images`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Image upload failed');
    }
    return await res.json();
  },
  getExportCsvUrl: () => `${API_BASE}/products/export-csv`,

  // Orders
  getOrders: () => fetchJson('/orders/'),
  getOrder: (idOrNumber) => fetchJson(`/orders/${idOrNumber}`),
  getCustomerOrders: (phone) => fetchJson(`/orders/by-phone/${encodeURIComponent(phone)}`),
  createOrder: (data) =>
    fetchJson('/orders/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  cancelCustomerOrder: (orderId, phone, reason) =>
    fetchJson(`/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ phone, reason }),
    }),
  requestOrderReturn: (orderId, phone, reason, details = '') =>
    fetchJson(`/orders/${encodeURIComponent(orderId)}/return-request`, {
      method: 'POST',
      body: JSON.stringify({ phone, reason, details }),
    }),
  reviewOrderReturn: (orderId, approve, note = '') =>
    fetchJson(`/orders/${encodeURIComponent(orderId)}/review-return`, {
      method: 'POST',
      body: JSON.stringify({ approve, note }),
    }),
  updateOrderStatus: (orderId, status, note = '') =>
    fetchJson(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }),
  resendOrderConfirmation: (idOrNumber) =>
    fetchJson(`/orders/${encodeURIComponent(idOrNumber)}/resend-confirmation`, {
      method: 'POST',
    }),

  // Coupons & Promo Vouchers
  validateCoupon: (code, subtotal) =>
    fetchJson('/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal }),
    }),
  getCoupons: () => fetchJson('/coupons/').catch(() => []),
  createCoupon: (data) =>
    fetchJson('/coupons/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCoupon: (id) =>
    fetchJson(`/coupons/${id}`, {
      method: 'DELETE',
    }),

  // Customer Product Reviews & Ratings
  getProductReviews: (productId) =>
    fetchJson(`/reviews/product/${productId}`).catch(() => ({
      average_rating: 5.0,
      total_reviews: 0,
      rating_breakdown: {},
      reviews: [],
    })),
  submitProductReview: (productId, data) =>
    fetchJson(`/reviews/product/${productId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Marketing, Sale Offers & Multi-Channel Broadcasts
  getCampaigns: () => fetchJson('/campaigns/').catch(() => []),
  getActiveCampaign: () => fetchJson('/campaigns/active').catch(() => null),
  createCampaign: (data) =>
    fetchJson('/campaigns/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  broadcastCampaign: (campaignId) =>
    fetchJson(`/campaigns/${campaignId}/broadcast`, {
      method: 'POST',
    }),

  // Customers
  getCustomers: () => fetchJson('/customers/'),

  // Knowledge Base & FAQs
  getFaqs: () => fetchJson('/faqs/'),
  searchFaqs: (query) => fetchJson(`/faqs/search?q=${encodeURIComponent(query)}`),
  createFaq: (data) =>
    fetchJson('/faqs/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ML Model Registry
  getModelVersions: () => fetchJson('/model-versions/'),

  // Audit Logs
  getAuditLogs: () => fetchJson('/audit-logs/').catch(() => []),

  // Courier & Logistics
  getCourierPartners: () => fetchJson('/courier/partners').catch(() => []),
  bookCourierShipment: (data) =>
    fetchJson('/courier/book', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  trackCourier: (identifier) =>
    fetchJson(`/courier/track/${encodeURIComponent(identifier)}`),
  getCourierShippingSlip: (orderId) =>
    fetchJson(`/courier/slip/${encodeURIComponent(orderId)}`),
};
