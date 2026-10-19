import React, { useEffect, useState, useRef } from 'react';
import {
  Send,
  UserCheck,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Sparkles,
  Users,
  Shield,
  User,
  AlertCircle,
  Phone,
  MessageSquare,
  Filter,
  ShoppingBag,
  ShoppingCart,
  FileText,
  Link as LinkIcon,
  MapPin,
  X,
  Search,
  CheckCircle,
  ChevronLeft,
} from 'lucide-react';
import { api } from '../api/client';

export default function LiveInbox({ user }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState('');
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'WAITING' | 'MY_ASSIGNED' | 'AI'
  
  // Modals state for Live Agent Commerce
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState('');
  const [orderError, setOrderError] = useState('');
  const [orderForm, setOrderForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    streetAddress: '',
    city: 'Lahore',
    productId: '',
    quantity: 1,
    deliveryFee: 0.0,
  });

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeConvRef = useRef(null);

  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  // Load staff & admin team members
  const loadStaffUsers = async () => {
    try {
      const usersList = await api.getUsers();
      setStaffUsers(usersList.filter((u) => u.role === 'ADMIN' || u.role === 'STAFF'));
    } catch (err) {
      console.error('Failed to load team users:', err);
    }
  };

  // Poll conversations frequently for live incoming customer chats
  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      const list = data || [];
      setConversations(list);

      const current = activeConvRef.current;
      if (!current) {
        // Initial load: prefer waiting conversation or first one
        if (list.length > 0) {
          const waitingOne = list.find((c) => c.status === 'WAITING_HUMAN');
          const initial = waitingOne || list[0];
          setActiveConv(initial);
          activeConvRef.current = initial;
        }
      } else {
        // Refresh currently active conversation without overriding user selection
        const updated = list.find((c) => c.id === current.id);
        if (updated) {
          setActiveConv(updated);
          activeConvRef.current = updated;
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll messages for active conversation
  const loadMessages = async (convId) => {
    if (!convId) return;
    try {
      const msgs = await api.getMessages(convId);
      setMessages(msgs || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  const handleSelectConversation = (conv) => {
    if (!conv) return;
    setActiveConv(conv);
    activeConvRef.current = conv;
    setInputMessage('');
    loadMessages(conv.id);
  };

  const loadProducts = async () => {
    try {
      const prods = await api.getProducts();
      setProducts(prods || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  useEffect(() => {
    loadStaffUsers();
    loadConversations();
    loadProducts();
    const interval = setInterval(loadConversations, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeConv?.id) {
      loadMessages(activeConv.id);
      const msgInterval = setInterval(() => loadMessages(activeConv.id), 2500);
      return () => clearInterval(msgInterval);
    }
  }, [activeConv?.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConv || sending) return;

    setSending(true);
    try {
      await api.sendAgentMessage(activeConv.id, inputMessage.trim());
      setInputMessage('');
      await loadMessages(activeConv.id);
      await loadConversations();
    } catch (err) {
      alert(`Failed to send message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // Live Agent Quick Commerce Handlers
  const handleRequestDeliveryAddress = async () => {
    if (!activeConv || sending) return;
    const prodName = activeConv.active_product_name || 'selected dress';
    const template = 
`📋 *Order Details & Delivery Address Form* ✨

Hamari atelier team aapka order (${prodName}) book karne ke liye tayar hai! Baraye meharbani niche di gayi details reply karein:

• *Full Name:* [Aapka Naam]
• *Delivery Address:* [Ghar / Street / Area ka mukammal pata]
• *City:* [Shehar ka naam]
• *Size & Color:* [e.g. Medium / Rose Pink]
• *Payment Method:* Cash on Delivery (COD) 🚚

Aap bas yeh details reply kar dein, hum foran aapka parcel confirm aur dispatch schedule kar denge! 🌸🤝`;

    setSending(true);
    try {
      await api.sendAgentMessage(activeConv.id, template);
      await loadMessages(activeConv.id);
      await loadConversations();
    } catch (err) {
      alert(`Failed to send address request: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const STOREFRONT_BASE_URL = 'https://ai-whatsapp-power-git-main-hamzachaudhary786s-projects.vercel.app';

  const handleSendProductCard = async (prod) => {
    if (!activeConv || !prod || sending) return;
    const price = prod.variants?.[0]?.price || 14000.0;
    const sizes = prod.variants ? [...new Set(prod.variants.map((v) => v.size).filter(Boolean))].join(', ') : 'S, M, L, XL';
    const colors = prod.variants ? [...new Set(prod.variants.map((v) => v.color).filter(Boolean))].join(', ') : 'Standard';
    const prodUrl = `${STOREFRONT_BASE_URL}/${prod.id}`;

    const caption = 
`✨ *${prod.name}* (${prod.category || 'Fashion'}) 👗
• Price: PKR ${Number(price).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Free Express Delivery 🚚)
• Available Sizes: ${sizes || 'S, M, L'}
• Available Colors: ${colors || 'Standard'}
• Details: ${prod.description || 'Premium boutique design crafted for all-day comfort.'}

🌐 *View Product on Website:*
${prodUrl}

🛍️ *Order Kaise Karein:*
Agar aap yeh outfit mangwana chahte hain, toh bas apna Name, Delivery Address aur City reply karein! Hamara live desk foran aapka Cash on Delivery order book kar dega. 🌸`;

    setSending(true);
    try {
      await api.sendAgentMessage(activeConv.id, caption, null);
      setIsShareModalOpen(false);
      await loadMessages(activeConv.id);
      await loadConversations();
    } catch (err) {
      alert(`Failed to send product card: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendCheckoutLink = async () => {
    if (!activeConv || sending) return;
    const activeProdId = activeConv.active_product_id;
    const link = activeProdId ? `${STOREFRONT_BASE_URL}/${activeProdId}` : STOREFRONT_BASE_URL;
    const text = 
`🔗 *Official Boutique Website Link* ✨

Aap hamari official boutique website se direct collection dekh saktay hain aur apna order Cash on Delivery par book kar sakte hain:
👉 ${link}

🚚 Free Express Delivery | 14-Day Hassle-Free Exchange | Cash on Delivery (COD) 🌸`;

    setSending(true);
    try {
      await api.sendAgentMessage(activeConv.id, text, null);
      await loadMessages(activeConv.id);
      await loadConversations();
    } catch (err) {
      alert(`Failed to send checkout link: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleOpenOrderModal = () => {
    if (!activeConv) return;
    setOrderError('');
    setOrderSuccess('');

    let initialProdId = products[0]?.id || '';
    if (activeConv.active_product_id) {
      const matched = products.find((p) => p.id === activeConv.active_product_id);
      if (matched) initialProdId = matched.id;
    } else if (activeConv.active_product_name) {
      const matched = products.find((p) => p.name.toLowerCase() === activeConv.active_product_name.toLowerCase());
      if (matched) initialProdId = matched.id;
    }

    const curProd = products.find((p) => p.id === initialProdId) || products[0];
    const availColors = curProd?.variants?.length > 0
      ? Array.from(new Set(curProd.variants.map((v) => v.color).filter(Boolean)))
      : (curProd?.colors ? (Array.isArray(curProd.colors) ? curProd.colors : curProd.colors.split(',').map(c => c.trim())) : []);
    const availSizes = curProd?.variants?.length > 0
      ? Array.from(new Set(curProd.variants.map((v) => v.size).filter(Boolean)))
      : (curProd?.sizes ? (Array.isArray(curProd.sizes) ? curProd.sizes : curProd.sizes.split(',').map(s => s.trim())) : []);

    setOrderForm({
      fullName: activeConv.customer_name && activeConv.customer_name !== 'Valued Shopper' ? activeConv.customer_name : '',
      phone: activeConv.customer_phone || '',
      email: activeConv.customer_email || '',
      streetAddress: activeConv.customer_address || '',
      city: activeConv.customer_city || 'Lahore',
      productId: initialProdId,
      color: availColors[0] || 'Standard',
      size: availSizes[0] || 'Standard',
      quantity: 1,
      deliveryFee: 0.0,
    });
    setIsOrderModalOpen(true);
  };

  const handlePlaceStaffOrder = async (e) => {
    e.preventDefault();
    if (!orderForm.fullName.trim() || !orderForm.phone.trim() || !orderForm.streetAddress.trim() || !orderForm.city.trim()) {
      setOrderError('Full Name, Phone Number, Delivery Address, and City are required.');
      return;
    }

    const selectedProd = products.find((p) => p.id === orderForm.productId) || products[0];
    if (!selectedProd) {
      setOrderError('Please select a product from catalog.');
      return;
    }

    const matchingVariant = selectedProd.variants?.find(
      (v) =>
        (!orderForm.color || orderForm.color === 'Standard' || !v.color || v.color.toLowerCase() === orderForm.color.toLowerCase()) &&
        (!orderForm.size || orderForm.size === 'Standard' || !v.size || v.size.toUpperCase() === orderForm.size.toUpperCase())
    ) || selectedProd.variants?.[0];

    const price = matchingVariant?.price || selectedProd.variants?.[0]?.price || 79.99;
    const subtotal = price * Number(orderForm.quantity);
    const total = subtotal + Number(orderForm.deliveryFee || 0);

    setOrderSubmitting(true);
    setOrderError('');
    try {
      const payload = {
        customer_id: activeConv.customer_id || 'guest',
        items: [
          {
            product_id: selectedProd.id,
            variant_id: matchingVariant?.id || null,
            name: selectedProd.name,
            sku: matchingVariant?.sku || 'STAFF-ORD',
            unit_price: price,
            quantity: Number(orderForm.quantity),
            total_price: subtotal,
            image_url: selectedProd.image_urls?.[0] || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=400&q=80',
            color: orderForm.color,
            size: orderForm.size,
          },
        ],
        subtotal: subtotal,
        delivery_fee: Number(orderForm.deliveryFee || 0),
        total: total,
        currency: 'PKR',
        address_snapshot: {
          full_name: orderForm.fullName.trim(),
          phone: orderForm.phone.trim(),
          email: orderForm.email.trim() || null,
          street_address: orderForm.streetAddress.trim(),
          city: orderForm.city.trim(),
          country: 'Pakistan',
        },
      };

      const res = await api.createOrder(payload);
      setOrderSuccess(`Order #${res.order_number} booked successfully! Automated WhatsApp confirmation receipt dispatched.`);
      await loadMessages(activeConv.id);
      await loadConversations();
      setTimeout(() => {
        setIsOrderModalOpen(false);
        setOrderSuccess('');
      }, 2000);
    } catch (err) {
      setOrderError(err.message || 'Failed to create order.');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleAssignAgent = async (targetUserId) => {
    if (!activeConv || assigning) return;
    setAssigning(true);
    setAssignmentFeedback('');

    try {
      const isAi = !targetUserId || targetUserId === 'AI_BOT';
      const res = await api.assignAgent(activeConv.id, isAi ? 'AI_BOT' : targetUserId);
      setActiveConv(res);
      activeConvRef.current = res;
      await loadConversations();

      const assignedLabel = isAi
        ? 'AI Stylist (Aria)'
        : staffUsers.find((u) => u.id === targetUserId)?.email || targetUserId;

      setAssignmentFeedback(
        isAi
          ? '✓ Query Resolved! Handed back to AI Stylist (Aria).'
          : `✓ Successfully assigned to ${assignedLabel}.`
      );
      setTimeout(() => setAssignmentFeedback(''), 4000);
    } catch (err) {
      alert(`Reassignment failed: ${err.message}`);
    } finally {
      setAssigning(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'read') return <CheckCheck size={14} color="#38bdf8" />;
    if (status === 'delivered') return <CheckCheck size={14} color="#94a3b8" />;
    if (status === 'sent') return <Check size={14} color="#94a3b8" />;
    return <Clock size={12} color="#64748b" />;
  };

  const waitingCount = conversations.filter((c) => c.status === 'WAITING_HUMAN').length;
  const myAssignedCount = conversations.filter((c) => c.assigned_user_id === user?.id).length;

  const filteredConversations = conversations.filter((c) => {
    if (filterTab === 'WAITING') return c.status === 'WAITING_HUMAN';
    if (filterTab === 'MY_ASSIGNED') return c.assigned_user_id === user?.id;
    if (filterTab === 'AI') return !c.assigned_user_id && c.status !== 'WAITING_HUMAN';
    return true;
  });

  return (
    <div className={`chat-container ${activeConv ? 'has-active' : ''}`}>
      {/* Left Conversations Sidebar */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Customer Live Box</h3>
            {waitingCount > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  animation: 'pulse 2s infinite',
                }}
              >
                {waitingCount} WAITING
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            WhatsApp & Web AI Stylist Real-Time Handoff
          </p>
        </div>

        {/* Filter Navigation Tabs */}
        <div
          className="chat-filter-tabs-scroll"
          style={{
            display: 'flex',
            gap: '4px',
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setFilterTab('ALL')}
            style={{
              padding: '4px 8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: 'none',
              background: filterTab === 'ALL' ? 'var(--primary)' : 'transparent',
              color: filterTab === 'ALL' ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            All ({conversations.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('WAITING')}
            style={{
              padding: '4px 8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterTab === 'WAITING' ? '1px solid #f59e0b' : 'none',
              background: filterTab === 'WAITING' ? 'rgba(245, 158, 11, 0.25)' : waitingCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: waitingCount > 0 ? '#fbbf24' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🚨 Human Needed ({waitingCount})
          </button>
          {user && (
            <button
              type="button"
              onClick={() => setFilterTab('MY_ASSIGNED')}
              style={{
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: filterTab === 'MY_ASSIGNED' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                color: filterTab === 'MY_ASSIGNED' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              My Chats ({myAssignedCount})
            </button>
          )}
        </div>

        <div className="chat-thread-list">
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Loading customer conversations...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-dim)',
                fontSize: '0.85rem',
              }}
            >
              {filterTab === 'WAITING'
                ? 'No customers waiting for human staff right now. All handled smoothly!'
                : 'No conversations found in this filter tab.'}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isWaiting = conv.status === 'WAITING_HUMAN';
              const assignedTo = staffUsers.find((u) => u.id === conv.assigned_user_id);
              const displayName =
                conv.customer_name ||
                (conv.customer_phone ? conv.customer_phone : `Customer #${conv.customer_id.slice(-6)}`);
              const initials = (conv.customer_name ? conv.customer_name.slice(0, 2) : conv.customer_id.slice(-2)).toUpperCase();

              return (
                <div
                  key={conv.id}
                  className={`chat-thread-item ${activeConv?.id === conv.id ? 'active' : ''}`}
                  onClick={() => handleSelectConversation(conv)}
                  style={{
                    borderLeft: isWaiting ? '3px solid #f59e0b' : '3px solid transparent',
                    background: isWaiting && activeConv?.id !== conv.id ? 'rgba(245, 158, 11, 0.05)' : undefined,
                  }}
                >
                  <div
                    className="avatar"
                    style={{
                      background: isWaiting ? 'linear-gradient(135deg, #f59e0b, #d97706)' : undefined,
                      fontWeight: 700,
                    }}
                  >
                    {initials}
                  </div>
                  <div className="thread-details">
                    <div className="thread-top">
                      <span className="thread-name" title={displayName} style={{ fontWeight: isWaiting ? 700 : 600 }}>
                        {displayName}
                      </span>
                      <span className="thread-time">
                        {conv.last_message_at
                          ? new Date(conv.last_message_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    {conv.customer_phone && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '2px' }}>
                        📞 {conv.customer_phone}
                      </div>
                    )}

                    {conv.last_message_text && (
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '200px',
                          marginBottom: '4px',
                        }}
                      >
                        {conv.last_message_text}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: isWaiting ? 'rgba(245, 158, 11, 0.15)' : 'rgba(99, 102, 241, 0.12)',
                          color: isWaiting ? '#fbbf24' : 'var(--primary)',
                          border: isWaiting ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(99, 102, 241, 0.25)',
                        }}
                      >
                        {isWaiting
                          ? `🚨 Human Needed (${assignedTo ? assignedTo.email.split('@')[0] : 'Open'})`
                          : assignedTo
                          ? `Assigned: ${assignedTo.email.split('@')[0]}`
                          : '🤖 AI Handled (Aria)'}
                      </span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        {conv.channel === 'web_chat' ? 'Web' : 'WhatsApp'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Messages Area */}
      <div className="chat-main">
        {activeConv ? (
          <>
            <div className="chat-header">
              <div className="live-chat-header-identity">
                <button
                  type="button"
                  className="chat-mobile-back-btn"
                  onClick={() => setActiveConv(null)}
                  title="Back to conversation list"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={18} />
                  <span>Chats</span>
                </button>
                <div className="live-chat-user-info">
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{activeConv.customer_name || 'Customer'}</span>
                    {activeConv.customer_phone && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        ({activeConv.customer_phone})
                      </span>
                    )}
                    {activeConv.status === 'WAITING_HUMAN' && (
                      <span
                        style={{
                          background: '#f59e0b',
                          color: '#0f172a',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        NEEDS HUMAN REPLY
                      </span>
                    )}
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                    Channel: {activeConv.channel === 'web_chat' ? 'Web AI Stylist' : 'WhatsApp Cloud API'} • ID: {activeConv.id}
                  </span>
                </div>
              </div>

              {/* Staff Reassignment Controls */}
              <div className="live-chat-header-actions">
                {assignmentFeedback && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#10b981',
                      fontWeight: 600,
                      animation: 'fadeIn 0.2s',
                    }}
                  >
                    ✓ {assignmentFeedback}
                  </span>
                )}

                <div className="reassign-dropdown-wrap">
                  <Users size={15} style={{ color: 'var(--text-muted)' }} />
                  <select
                    className="reassign-select"
                    value={activeConv.assigned_user_id || 'AI_BOT'}
                    onChange={(e) => handleAssignAgent(e.target.value)}
                    disabled={assigning}
                  >
                    <option value="AI_BOT">🤖 AI Stylist (Aria)</option>
                    {staffUsers.map((st) => (
                      <option key={st.id} value={st.id}>
                        👤 {st.email} ({st.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quick Resolve & Hand Back to AI Button */}
                {(activeConv.assigned_user_id || activeConv.status === 'WAITING_HUMAN') && (
                  <button
                    type="button"
                    className="btn btn-resolve-ai"
                    onClick={() => handleAssignAgent('AI_BOT')}
                    disabled={assigning}
                    style={{
                      fontSize: '0.8rem',
                      padding: '6px 14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
                      border: '1px solid rgba(168, 85, 247, 0.6)',
                      color: '#d8b4fe',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(168, 85, 247, 0.15)',
                      whiteSpace: 'nowrap',
                    }}
                    title="Customer query resolved! Click to reassign chat back to Aria AI Stylist"
                  >
                    <Sparkles size={14} />
                    <span>Resolve & Back to AI</span>
                  </button>
                )}

                {user && activeConv.assigned_user_id !== user.id && (
                  <button
                    className="btn btn-secondary btn-assign-me"
                    onClick={() => handleAssignAgent(user.id)}
                    disabled={assigning}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    title="Quickly take over and assign to your account"
                  >
                    <UserCheck size={14} />
                    <span>Assign to Me</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Commerce Actions Toolbar for Live Agent */}
            <div className="live-commerce-toolbar">
              <div className="commerce-toolbar-buttons-grid">
                <button
                  type="button"
                  className="btn btn-commerce-action"
                  onClick={handleRequestDeliveryAddress}
                  disabled={sending}
                  style={{
                    fontSize: '0.74rem',
                    padding: '6px 12px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Send structured delivery address request to customer on WhatsApp"
                >
                  <FileText size={13} />
                  <span>Request Address</span>
                </button>

                <button
                  type="button"
                  className="btn btn-commerce-action"
                  onClick={() => setIsShareModalOpen(true)}
                  disabled={sending}
                  style={{
                    fontSize: '0.74rem',
                    padding: '6px 12px',
                    background: 'rgba(168, 85, 247, 0.15)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Pick product from catalog and send card with photo to WhatsApp"
                >
                  <ShoppingBag size={13} />
                  <span>Share Product</span>
                </button>

                <button
                  type="button"
                  className="btn btn-commerce-action"
                  onClick={handleOpenOrderModal}
                  style={{
                    fontSize: '0.74rem',
                    padding: '6px 12px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                  }}
                  title="Book order for customer with auto-filled phone & receipt dispatched to WhatsApp"
                >
                  <ShoppingCart size={13} />
                  <span>Book Order</span>
                </button>

                <button
                  type="button"
                  className="btn btn-commerce-action"
                  onClick={handleSendCheckoutLink}
                  disabled={sending}
                  style={{
                    fontSize: '0.74rem',
                    padding: '6px 12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                  title="Send direct self-checkout link to customer on WhatsApp"
                >
                  <LinkIcon size={13} />
                  <span>Checkout Link</span>
                </button>
              </div>

              {activeConv.customer_city && (
                <div className="commerce-city-tag" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <MapPin size={12} style={{ color: '#10b981' }} />
                  <span>Saved: {activeConv.customer_city}</span>
                </div>
              )}
            </div>

            {/* Waiting for Human Alert Banner */}
            {activeConv.status === 'WAITING_HUMAN' && (
              <div
                style={{
                  background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.12) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '10px 16px',
                  margin: '12px 16px 0',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.82rem', fontWeight: 600 }}>
                  <AlertCircle size={16} />
                  <span>
                    <b>Customer requested human staff:</b> Aria has handed off this chat. Type below to reply directly!
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleAssignAgent('AI_BOT')}
                    style={{ fontSize: '0.74rem', padding: '5px 12px', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.4)', background: 'rgba(147, 51, 234, 0.12)' }}
                    title="Resolve and reassign to AI Stylist"
                  >
                    <Sparkles size={13} />
                    <span>Back to AI</span>
                  </button>
                  {user && activeConv.assigned_user_id !== user.id && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleAssignAgent(user.id)}
                      style={{ fontSize: '0.74rem', padding: '5px 12px', background: '#d97706', borderColor: '#b45309', whiteSpace: 'nowrap' }}
                    >
                      Take Over Chat
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="chat-messages">
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-dim)' }}>
                  <Bot size={36} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p>No messages yet in this conversation.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isInbound = m.direction === 'inbound';
                  return (
                    <div
                      key={m.id}
                      className={`message-bubble ${
                        isInbound ? 'message-inbound' : 'message-outbound'
                      }`}
                    >
                      {m.image_url && (
                        <div style={{ marginBottom: '8px' }}>
                          <img
                            src={m.image_url}
                            alt="Product Visual"
                            style={{
                              maxWidth: '260px',
                              maxHeight: '220px',
                              borderRadius: '8px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-glass)',
                              display: 'block',
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                      <div className="message-meta">
                        {m.intent && (
                          <span className="intent-tag">
                            Intent: {m.intent} ({Math.round((m.confidence || 0) * 100)}%)
                          </span>
                        )}
                        <span>
                          {new Date(m.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {!isInbound && getStatusIcon(m.delivery_status)}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Live Assignment Status & Agent Prompt Bar */}
            <div className="chat-live-assignment-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="online-dot" />
                <span>
                  {activeConv.assigned_user_id === user?.id
                    ? 'Connected live: You are directly chatting with this customer via WhatsApp Cloud API.'
                    : activeConv.assigned_user_id === 'AI_BOT' || !activeConv.assigned_user_id
                    ? 'AI Bot handled: You can send a direct WhatsApp message anytime to take over.'
                    : `Assigned to ${staffUsers.find((u) => u.id === activeConv.assigned_user_id)?.email || 'Staff'}.`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {(activeConv.assigned_user_id || activeConv.status === 'WAITING_HUMAN') && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleAssignAgent('AI_BOT')}
                    style={{ fontSize: '0.72rem', padding: '3px 10px', color: '#c084fc', borderColor: 'rgba(192, 132, 252, 0.4)' }}
                    title="Hand back to AI Stylist (Aria)"
                  >
                    🤖 Back to AI
                  </button>
                )}
                {user && activeConv.assigned_user_id !== user.id && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleAssignAgent(user.id)}
                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  >
                    Take Over
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSend} className="chat-input-area">
              <input
                type="text"
                className="chat-input"
                placeholder="Type reply to customer via WhatsApp..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || !inputMessage.trim()}
                style={{ borderRadius: 'var(--radius-full)', padding: '12px 18px' }}
                title="Send Message"
              >
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-dim)',
            }}
          >
            Select a conversation from the left to start chatting
          </div>
        )}
      </div>

      {/* MODAL 1: Share Product to WhatsApp */}
      {isShareModalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="glass-card modal-dialog"
            style={{
              width: '100%',
              maxWidth: '650px',
              padding: '24px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={20} style={{ color: 'var(--primary)' }} />
                  <span>Share Product Card to WhatsApp</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Select an outfit to send its official photo, price, available sizes, and ordering prompt directly to customer's WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Product Search Filter */}
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                placeholder="Search products by name or category (e.g. Chiffon, Maxi, Kurti)..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ paddingLeft: '38px', fontSize: '0.85rem' }}
                autoFocus
              />
            </div>

            {/* Products List */}
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', paddingRight: '4px' }}>
              {products
                .filter(
                  (p) =>
                    !productSearch ||
                    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                    (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
                )
                .map((p) => {
                  const price = p.variants?.[0]?.price || 79.99;
                  const img = p.image_urls?.[0] || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                  const sizes = p.variants ? [...new Set(p.variants.map((v) => v.size).filter(Boolean))].join(', ') : 'S, M, L';
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '10px',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <img
                          src={img}
                          alt={p.name}
                          style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }}
                          onError={(e) => {
                            e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                          }}
                        />
                        <div style={{ minWidth: 0 }}>
                          <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </h4>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {p.category} • Sizes: {sizes}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)' }}>
                          ${Number(price).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => handleSendProductCard(p)}
                          disabled={sending}
                          style={{ fontSize: '0.75rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                        >
                          Send to WhatsApp
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsShareModalOpen(false)}
                style={{ fontSize: '0.8rem', padding: '6px 16px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Book Customer Order (Staff Desk) */}
      {isOrderModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsOrderModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
        >
          <div
            className="glass-card modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '26px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingCart size={20} style={{ color: '#10b981' }} />
                  <span>Book Customer Order (Staff Desk)</span>
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Customer phone is pre-filled. Placed order will automatically dispatch an official WhatsApp receipt with Order ID to the customer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {orderError && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{orderError}</span>
              </div>
            )}

            {orderSuccess && (
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                <span>{orderSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePlaceStaffOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    Customer Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Sara Ahmed"
                    value={orderForm.fullName}
                    onChange={(e) => setOrderForm({ ...orderForm, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    WhatsApp Phone Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="+92 300 1234567"
                    value={orderForm.phone}
                    onChange={(e) => setOrderForm({ ...orderForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Complete Delivery Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="House #, Street #, Phase / Area"
                  value={orderForm.streetAddress}
                  onChange={(e) => setOrderForm({ ...orderForm, streetAddress: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  City <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Lahore, Karachi, Islamabad"
                  value={orderForm.city}
                  onChange={(e) => setOrderForm({ ...orderForm, city: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Select Product Outfit</label>
                  <select
                    className="form-input"
                    value={orderForm.productId}
                    onChange={(e) => {
                      const newPid = e.target.value;
                      const newProd = products.find((p) => p.id === newPid);
                      const pColors = newProd?.variants?.length > 0
                        ? Array.from(new Set(newProd.variants.map((v) => v.color).filter(Boolean)))
                        : (newProd?.colors ? (Array.isArray(newProd.colors) ? newProd.colors : newProd.colors.split(',').map((c) => c.trim())) : []);
                      const pSizes = newProd?.variants?.length > 0
                        ? Array.from(new Set(newProd.variants.map((v) => v.size).filter(Boolean)))
                        : (newProd?.sizes ? (Array.isArray(newProd.sizes) ? newProd.sizes : newProd.sizes.split(',').map((s) => s.trim())) : []);
                      setOrderForm((prev) => ({
                        ...prev,
                        productId: newPid,
                        color: pColors[0] || 'Standard',
                        size: pSizes[0] || 'Standard',
                      }));
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${Number(p.variants?.[0]?.price || 79.99).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
                  />
                </div>
              </div>

              {/* Product Color & Size Variant Selectors */}
              {(() => {
                const curProd = products.find((p) => p.id === orderForm.productId) || products[0];
                const availColors = curProd?.variants?.length > 0
                  ? Array.from(new Set(curProd.variants.map((v) => v.color).filter(Boolean)))
                  : (curProd?.colors ? (Array.isArray(curProd.colors) ? curProd.colors : curProd.colors.split(',').map((c) => c.trim())) : []);
                const availSizes = curProd?.variants?.length > 0
                  ? Array.from(new Set(curProd.variants.map((v) => v.size).filter(Boolean)))
                  : (curProd?.sizes ? (Array.isArray(curProd.sizes) ? curProd.sizes : curProd.sizes.split(',').map((s) => s.trim())) : []);

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Color {availColors.length === 1 && <span style={{ color: '#10b981', fontSize: '0.72rem' }}>({availColors[0]} only)</span>}
                      </label>
                      <select
                        className="form-input"
                        value={orderForm.color || availColors[0] || 'Standard'}
                        onChange={(e) => setOrderForm({ ...orderForm, color: e.target.value })}
                      >
                        {availColors.length > 0 ? (
                          availColors.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))
                        ) : (
                          <option value="Standard">Standard</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        Size {availSizes.length === 1 && <span style={{ color: '#10b981', fontSize: '0.72rem' }}>({availSizes[0]} only)</span>}
                      </label>
                      <select
                        className="form-input"
                        value={orderForm.size || availSizes[0] || 'Standard'}
                        onChange={(e) => setOrderForm({ ...orderForm, size: e.target.value })}
                      >
                        {availSizes.length > 0 ? (
                          availSizes.map((sz) => (
                            <option key={sz} value={sz}>{sz}</option>
                          ))
                        ) : (
                          <option value="Standard">Standard</option>
                        )}
                      </select>
                    </div>
                  </div>
                );
              })()}

              {/* Order Pricing Summary */}
              {(() => {
                const curProd = products.find((p) => p.id === orderForm.productId) || products[0];
                const matchingVariant = curProd?.variants?.find(
                  (v) =>
                    (!orderForm.color || orderForm.color === 'Standard' || !v.color || v.color.toLowerCase() === orderForm.color.toLowerCase()) &&
                    (!orderForm.size || orderForm.size === 'Standard' || !v.size || v.size.toUpperCase() === orderForm.size.toUpperCase())
                ) || curProd?.variants?.[0];
                const unitPr = Number(matchingVariant?.price || curProd?.variants?.[0]?.price || 79.99);
                const sub = unitPr * Number(orderForm.quantity);
                const tot = sub + Number(orderForm.deliveryFee || 0);
                return (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Color: <b style={{ color: '#fef08a' }}>{orderForm.color || 'Standard'}</b> • Size: <b style={{ color: '#fef08a' }}>{orderForm.size || 'Standard'}</b> • Payment: <b style={{ color: '#10b981' }}>COD</b>
                    </span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                      Total: PKR {tot.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsOrderModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={orderSubmitting}
                  style={{ background: '#10b981', borderColor: '#059669', color: '#fff' }}
                >
                  {orderSubmitting ? 'Placing & Dispatching Receipt...' : 'Confirm & Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
