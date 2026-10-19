import React, { useState, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Mail,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Users,
  Percent,
  Tag,
  ExternalLink,
  ShieldCheck,
  Eye,
  Clock,
  Plus,
  Trash2,
  Ticket,
  X,
  Calendar,
} from 'lucide-react';
import { api } from '../api/client';

function toDateTimeLocalString(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function formatValidity(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getValidityStatus(validUntilStr) {
  if (!validUntilStr) return { label: 'Ongoing Offer', isExpired: false, color: '#10b981' };
  const d = new Date(validUntilStr);
  if (isNaN(d.getTime())) return { label: 'Active', isExpired: false, color: '#10b981' };
  const now = new Date();
  if (now > d) {
    return { label: `Expired on ${formatValidity(validUntilStr)}`, isExpired: true, color: '#ef4444' };
  }
  const diffHours = Math.round((d - now) / (1000 * 60 * 60));
  if (diffHours < 24) {
    return { label: `Expires in ${diffHours}h (${formatValidity(validUntilStr)})`, isExpired: false, color: '#f59e0b' };
  }
  const diffDays = Math.ceil(diffHours / 24);
  return { label: `Valid until ${formatValidity(validUntilStr)} (${diffDays} days left)`, isExpired: false, color: '#10b981' };
}

export default function Campaigns() {
  const [activeTab, setActiveTab] = useState('BROADCASTS'); // 'BROADCASTS' | 'COUPONS'
  const [campaigns, setCampaigns] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [broadcastingId, setBroadcastingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [previewTab, setPreviewTab] = useState('whatsapp'); // 'whatsapp' | 'email'

  // Default dates: start now, expire in 7 days
  const defaultStart = toDateTimeLocalString(new Date());
  const defaultExpiry = toDateTimeLocalString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  // Coupon Creation Modal State
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [submittingCoupon, setSubmittingCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'PERCENTAGE',
    discount_value: 20,
    min_order_amount: 2000,
    max_discount_amount: 3000,
    description: '',
    is_active: true,
    expiry_date: defaultExpiry,
  });

  // Campaign Form State
  const [form, setForm] = useState({
    title: 'Mid-Season Luxury Gala — 30% OFF',
    promo_code: 'GALA30',
    discount_percent: 30,
    description: 'Elevate your wardrobe with our newest silk evening dresses and relaxed linen wear. Enjoy an exclusive 30% discount on all boutique collections this week!',
    store_url: window.location.origin.includes('vercel.app')
      ? window.location.origin
      : 'https://ai-whatsapp-power-git-main-hamzachaudhary786s-projects.vercel.app',
    channels: ['WHATSAPP', 'EMAIL'],
    is_active_banner: true,
    valid_from: defaultStart,
    valid_until: defaultExpiry,
  });

  const loadData = async () => {
    try {
      const [camps, custs, coups] = await Promise.all([
        api.getCampaigns(),
        api.getCustomers().catch(() => []),
        api.getCoupons().catch(() => []),
      ]);
      setCampaigns(camps);
      setCustomers(custs);
      setCoupons(coups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    if (!newCoupon.code.trim()) return;
    setSubmittingCoupon(true);
    try {
      await api.createCoupon({
        code: newCoupon.code.trim().toUpperCase(),
        discount_type: newCoupon.discount_type,
        discount_value: Number(newCoupon.discount_value),
        min_order_amount: Number(newCoupon.min_order_amount) || 0,
        max_discount_amount: newCoupon.max_discount_amount ? Number(newCoupon.max_discount_amount) : null,
        description: newCoupon.description.trim() || undefined,
        is_active: newCoupon.is_active,
        expiry_date: newCoupon.expiry_date ? new Date(newCoupon.expiry_date).toISOString() : null,
      });
      setIsCouponModalOpen(false);
      setNewCoupon({
        code: '',
        discount_type: 'PERCENTAGE',
        discount_value: 20,
        min_order_amount: 2000,
        max_discount_amount: 3000,
        description: '',
        is_active: true,
        expiry_date: defaultExpiry,
      });
      setStatusMessage({ type: 'success', text: `Voucher '${newCoupon.code.toUpperCase()}' created successfully!` });
      const updatedCoupons = await api.getCoupons();
      setCoupons(updatedCoupons || []);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create voucher.' });
    } finally {
      setSubmittingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (couponId, code) => {
    if (!window.confirm(`Delete discount voucher '${code}'?`)) return;
    try {
      await api.deleteCoupon(couponId);
      setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      setStatusMessage({ type: 'success', text: `Voucher '${code}' deleted.` });
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete voucher.' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleChannelToggle = (channel) => {
    setForm((prev) => {
      const exists = prev.channels.includes(channel);
      const updated = exists
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels: updated.length > 0 ? updated : [channel] };
    });
  };

  const handleCreateAndBroadcast = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!form.title.trim() || !form.description.trim()) {
      setStatusMessage({ type: 'error', text: 'Campaign title and description are required.' });
      return;
    }

    try {
      // 1. Create the campaign
      const newCamp = await api.createCampaign({
        ...form,
        discount_percent: Number(form.discount_percent) || 0,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      });

      // 2. Launch broadcast
      setBroadcastingId(newCamp.id);
      setStatusMessage({
        type: 'info',
        text: `Broadcasting campaign to ${customers.length} customers via ${form.channels.join(' & ')}...`,
      });

      const broadcastRes = await api.broadcastCampaign(newCamp.id);

      setStatusMessage({
        type: 'success',
        text: `Broadcast completed! WhatsApp sent: ${broadcastRes.stats?.whatsapp_sent || 0}, Email sent: ${broadcastRes.stats?.email_sent || 0}.`,
      });

      await loadData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to dispatch broadcast.' });
    } finally {
      setBroadcastingId(null);
    }
  };

  const handleTriggerBroadcastOnly = async (campaignId) => {
    setBroadcastingId(campaignId);
    setStatusMessage({ type: 'info', text: 'Dispatching broadcast...' });
    try {
      const res = await api.broadcastCampaign(campaignId);
      setStatusMessage({
        type: 'success',
        text: `Broadcast sent! WhatsApp: ${res.stats?.whatsapp_sent || 0}, Email: ${res.stats?.email_sent || 0}.`,
      });
      await loadData();
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Broadcast failed.' });
    } finally {
      setBroadcastingId(null);
    }
  };

  // Metrics
  const totalCustomers = customers.length;
  const whatsappAudience = customers.filter((c) => c.phone || c.whatsapp_id).length;
  const emailAudience = customers.filter((c) => c.email).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Navigation Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={22} style={{ color: 'var(--primary)' }} />
            Promotions & Multi-Channel Broadcasts
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Announce flash sales and manage promo voucher discount codes across the boutique
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            type="button"
            className="btn"
            style={{
              padding: '6px 16px',
              fontSize: '0.82rem',
              background: activeTab === 'BROADCASTS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'BROADCASTS' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('BROADCASTS')}
          >
            <Send size={14} />
            <span>Broadcast Campaigns</span>
          </button>
          <button
            type="button"
            className="btn"
            style={{
              padding: '6px 16px',
              fontSize: '0.82rem',
              background: activeTab === 'COUPONS' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'COUPONS' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => setActiveTab('COUPONS')}
          >
            <Ticket size={14} />
            <span>Promo Vouchers & Coupons ({coupons.length})</span>
          </button>
        </div>
      </div>

      {statusMessage.text && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '10px',
            background:
              statusMessage.type === 'error'
                ? 'rgba(239, 68, 68, 0.15)'
                : statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(99, 102, 241, 0.15)',
            border:
              statusMessage.type === 'error'
                ? '1px solid #ef4444'
                : statusMessage.type === 'success'
                ? '1px solid #10b981'
                : '1px solid #6366f1',
            color:
              statusMessage.type === 'error'
                ? '#fca5a5'
                : statusMessage.type === 'success'
                ? '#6ee7b7'
                : '#c7d2fe',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PROMO VOUCHERS & COUPONS MANAGEMENT                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'COUPONS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Coupon KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ticket size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Active Vouchers</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{coupons.filter(c => c.is_active).length} / {coupons.length}</div>
                <div style={{ fontSize: '0.72rem', color: '#10b981' }}>Live on Cart &amp; Checkout</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Percent size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>% Discounts</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{coupons.filter(c => c.discount_type === 'PERCENTAGE').length} Vouchers</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Proportional savings</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tag size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Flat PKR Discounts</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{coupons.filter(c => c.discount_type === 'FIXED_PKR').length} Vouchers</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fixed order reduction</div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Boutique Promotional Discount Vouchers
            </h3>
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 16px' }}
              onClick={() => setIsCouponModalOpen(true)}
            >
              <Plus size={16} />
              <span>Create New Promo Voucher</span>
            </button>
          </div>

          {/* Coupons List / Grid */}
          {coupons.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
              <Ticket size={40} style={{ opacity: 0.4, marginBottom: '12px' }} />
              <h4>No Discount Vouchers Created</h4>
              <p>Create your first voucher to offer percentage or flat PKR discounts to shoppers.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {coupons.map((c) => (
                <div
                  key={c.id}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    border: c.is_active ? '1px solid var(--border-glass)' : '1px dashed rgba(255,255,255,0.08)',
                    opacity: c.is_active ? 1 : 0.6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)', letterSpacing: '1px' }}>
                          {c.code}
                        </span>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            background: c.discount_type === 'PERCENTAGE' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: c.discount_type === 'PERCENTAGE' ? '#818cf8' : '#fbbf24',
                          }}
                        >
                          {c.discount_type === 'PERCENTAGE' ? `${c.discount_value}% OFF` : `Flat PKR ${Number(c.discount_value).toLocaleString()}`}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '6px', lineHeight: 1.4 }}>
                        {c.description || 'Promotional boutique voucher code.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteCoupon(c.id, c.code)}
                      title="Delete voucher"
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div>
                        Min Cart: <b>PKR {Number(c.min_order_amount || 0).toLocaleString()}</b>
                        {c.max_discount_amount && (
                          <span> • Cap: <b>PKR {Number(c.max_discount_amount).toLocaleString()}</b></span>
                        )}
                      </div>
                      {c.expiry_date && (
                        <div style={{ marginTop: '4px', fontSize: '0.74rem', color: new Date() > new Date(c.expiry_date) ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {new Date() > new Date(c.expiry_date) ? `Expired: ${formatValidity(c.expiry_date)}` : `Expires: ${formatValidity(c.expiry_date)}`}
                        </div>
                      )}
                    </div>
                    <span style={{ color: !c.is_active || (c.expiry_date && new Date() > new Date(c.expiry_date)) ? '#f87171' : '#10b981', fontWeight: 700 }}>
                      {!c.is_active ? '○ Inactive' : c.expiry_date && new Date() > new Date(c.expiry_date) ? '🔴 Expired' : '● Active'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Coupon Modal */}
          {isCouponModalOpen && (
            <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div className="glass-card" style={{ width: '100%', maxWidth: '520px', padding: '26px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Ticket size={20} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Create Discount Promo Voucher</h3>
                  </div>
                  <button onClick={() => setIsCouponModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Voucher Code *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. FLASH30, EID2026, LUXE1000"
                      value={newCoupon.code}
                      onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                      className="form-input"
                      style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Discount Type</label>
                      <select
                        className="form-input"
                        value={newCoupon.discount_type}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discount_type: e.target.value })}
                      >
                        <option value="PERCENTAGE">Percentage (% OFF)</option>
                        <option value="FIXED_PKR">Flat PKR Amount</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>
                        {newCoupon.discount_type === 'PERCENTAGE' ? 'Discount % *' : 'Flat PKR Amount *'}
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        max={newCoupon.discount_type === 'PERCENTAGE' ? '90' : '100000'}
                        value={newCoupon.discount_value}
                        onChange={(e) => setNewCoupon({ ...newCoupon, discount_value: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Minimum Cart Subtotal (PKR)</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="e.g. 2500"
                        value={newCoupon.min_order_amount}
                        onChange={(e) => setNewCoupon({ ...newCoupon, min_order_amount: e.target.value })}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Max Discount Cap (PKR, Optional)</label>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        placeholder="e.g. 5000"
                        value={newCoupon.max_discount_amount}
                        onChange={(e) => setNewCoupon({ ...newCoupon, max_discount_amount: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Voucher Expiry Date & Time (Optional)</label>
                    <input
                      type="datetime-local"
                      value={newCoupon.expiry_date || ''}
                      onChange={(e) => setNewCoupon({ ...newCoupon, expiry_date: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Description / Offer Terms</label>
                    <input
                      type="text"
                      placeholder="e.g. 25% OFF Summer Flash Sale voucher"
                      value={newCoupon.description}
                      onChange={(e) => setNewCoupon({ ...newCoupon, description: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsCouponModalOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" disabled={submittingCoupon} className="btn btn-primary">
                      {submittingCoupon ? <RefreshCw size={14} className="spin" /> : 'Create Voucher'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: BROADCAST CAMPAIGNS                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'BROADCASTS' && (
        <>
          {/* Audience Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Audience</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{totalCustomers} Customers</div>
            <div style={{ fontSize: '0.75rem', color: '#10b981' }}>100% Opted-In Compliant</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <MessageSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>WhatsApp Reachable</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{whatsappAudience} Numbers</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Throttled 60ms batching</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
            <Mail size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Email Reachable</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{emailAudience} Verified</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>HTML responsive template</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Spam Protection</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f59e0b' }}>Opt-out & Rate-Limit</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto STOP keyword support</div>
          </div>
        </div>
      </div>

      {statusMessage.text && (
        <div
          style={{
            padding: '14px 20px',
            borderRadius: '10px',
            background:
              statusMessage.type === 'error'
                ? 'rgba(239, 68, 68, 0.15)'
                : statusMessage.type === 'success'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(99, 102, 241, 0.15)',
            border:
              statusMessage.type === 'error'
                ? '1px solid #ef4444'
                : statusMessage.type === 'success'
                ? '1px solid #10b981'
                : '1px solid #6366f1',
            color:
              statusMessage.type === 'error'
                ? '#fca5a5'
                : statusMessage.type === 'success'
                ? '#6ee7b7'
                : '#c7d2fe',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Campaign Composer & Live Previews Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px' }}>
        {/* Left: Compose Form */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '18px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
            Create New Promotional Offer
          </h3>

          <form onSubmit={handleCreateAndBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Campaign Title / Sale Headline</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Mega Spring Gala Sale — 30% OFF"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Promo Voucher Code</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. GALA30"
                    value={form.promo_code}
                    onChange={(e) => setForm({ ...form, promo_code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Discount Percentage (%)</label>
                <input
                  type="number"
                  min="5"
                  max="90"
                  required
                  className="form-input"
                  value={form.discount_percent}
                  onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Promotional Message Copy</label>
              <textarea
                required
                rows={4}
                className="form-input"
                style={{ resize: 'vertical' }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Storefront Website URL</label>
              <input
                type="url"
                required
                className="form-input"
                value={form.store_url}
                onChange={(e) => setForm({ ...form, store_url: e.target.value })}
              />
            </div>

            {/* Channels Selection */}
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Dispatch Channels</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    background: form.channels.includes('WHATSAPP') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: form.channels.includes('WHATSAPP') ? '1px solid #10b981' : '1px solid var(--border-glass)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.channels.includes('WHATSAPP')}
                    onChange={() => handleChannelToggle('WHATSAPP')}
                  />
                  <MessageSquare size={16} style={{ color: '#10b981' }} />
                  <span>WhatsApp Broadcast ({whatsappAudience})</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    background: form.channels.includes('EMAIL') ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: form.channels.includes('EMAIL') ? '1px solid #6366f1' : '1px solid var(--border-glass)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.channels.includes('EMAIL')}
                    onChange={() => handleChannelToggle('EMAIL')}
                  />
                  <Mail size={16} style={{ color: '#6366f1' }} />
                  <span>Email Broadcast ({emailAudience})</span>
                </label>
              </div>
            </div>

            {/* Offer Validity & Expiry Date / Time */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '14px', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} style={{ color: 'var(--primary)' }} />
                  Offer Validity & Expiration (Offer kab tak valid rahe gi)
                </label>
                {form.valid_until && (
                  <span style={{ fontSize: '0.74rem', color: getValidityStatus(form.valid_until).color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} />
                    {getValidityStatus(form.valid_until).label}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Valid From (Start Date & Time)
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={form.valid_from || ''}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                    Valid Until (Expiry Date & Time) *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    className="form-input"
                    value={form.valid_until || ''}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginRight: '4px' }}>Quick Expiry:</span>
                {[
                  { label: '+3 Days', days: 3 },
                  { label: '+7 Days (1 Wk)', days: 7 },
                  { label: '+14 Days (2 Wks)', days: 14 },
                  { label: '+30 Days (1 Mo)', days: 30 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px' }}
                    onClick={() => {
                      const d = new Date(Date.now() + preset.days * 24 * 60 * 60 * 1000);
                      setForm({ ...form, valid_until: toDateTimeLocalString(d) });
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '3px 8px', fontSize: '0.72rem', borderRadius: '6px', color: '#ef4444' }}
                  onClick={() => setForm({ ...form, valid_until: '' })}
                >
                  Clear Expiry
                </button>
              </div>
            </div>

            {/* Storefront Banner Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="activeBannerToggle"
                checked={form.is_active_banner}
                onChange={(e) => setForm({ ...form, is_active_banner: e.target.checked })}
              />
              <label htmlFor="activeBannerToggle" style={{ fontSize: '0.85rem', color: '#f1f5f9', cursor: 'pointer' }}>
                Activate promotional banner on public customer storefront
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={broadcastingId !== null}
              style={{ marginTop: '10px', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.95rem' }}
            >
              {broadcastingId !== null ? (
                <>
                  <RefreshCw size={18} className="spin" />
                  <span>Broadcasting to Customers...</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>Launch Multi-Channel Broadcast Now</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Realistic Previews */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
              Live Message Preview
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setPreviewTab('whatsapp')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  background: previewTab === 'whatsapp' ? '#10b981' : 'transparent',
                  color: previewTab === 'whatsapp' ? '#fff' : 'var(--text-muted)',
                }}
              >
                WhatsApp View
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPreviewTab('email')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  background: previewTab === 'email' ? 'var(--primary)' : 'transparent',
                  color: previewTab === 'email' ? '#fff' : 'var(--text-muted)',
                }}
              >
                Email View
              </button>
            </div>
          </div>

          {previewTab === 'whatsapp' ? (
            /* Simulated WhatsApp Chat Bubble */
            <div
              style={{
                background: '#0b141a',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: '380px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  background: '#005c4b',
                  color: '#e9edef',
                  borderRadius: '12px 12px 2px 12px',
                  padding: '16px',
                  maxWidth: '92%',
                  fontSize: '0.88rem',
                  lineHeight: '1.5',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  alignSelf: 'flex-start',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#53bdeb', marginBottom: '8px' }}>
                  ✨ {form.title} ✨
                </div>
                <div style={{ marginBottom: '8px' }}>
                  Hello Sara Ahmed! 👗
                </div>
                <div style={{ marginBottom: '12px' }}>
                  {form.description}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px' }}>
                  <div>🎟️ <b>Promo Code:</b> <span style={{ color: '#25d366', fontWeight: 800 }}>{form.promo_code}</span></div>
                  <div>🏷️ <b>Discount:</b> <b>{form.discount_percent}% OFF</b></div>
                  <div>🛍️ <b>Shop Online:</b> <a href={form.store_url} target="_blank" rel="noreferrer" style={{ color: '#53bdeb' }}>{form.store_url}</a></div>
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '8px' }}>
                  💡 Fast Order: You can also reply directly to this chat to order with Aria, our AI Stylist! ✨
                </div>
                <div style={{ fontSize: '0.72rem', opacity: 0.6, borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', paddingTop: '6px' }}>
                  Reply STOP to unsubscribe from store promotional updates.
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.68rem', opacity: 0.6, marginTop: '4px' }}>
                  12:45 PM ✓✓
                </div>
              </div>
            </div>
          ) : (
            /* Simulated HTML Email Preview */
            <div
              style={{
                background: '#0f172a',
                borderRadius: '16px',
                padding: '18px',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: '380px',
              }}
            >
              <div
                style={{
                  background: '#1e293b',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', padding: '20px', textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>✨ {form.title} ✨</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Fashion AI Luxury Atelier</div>
                </div>
                <div style={{ padding: '20px', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.6' }}>
                  <p style={{ margin: '0 0 10px' }}>Dear Sara Ahmed,</p>
                  <p style={{ margin: '0 0 14px' }}>{form.description}</p>
                  <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px dashed #818cf8', borderRadius: '10px', padding: '14px', textAlign: 'center', margin: '14px 0' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Exclusive Promo Voucher</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a5b4fc', letterSpacing: '2px' }}>{form.promo_code}</div>
                    <div style={{ fontSize: '0.8rem', color: '#38bdf8' }}>Save {form.discount_percent}% Off Today!</div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <a
                      href={form.store_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-block',
                        background: '#6366f1',
                        color: '#fff',
                        textDecoration: 'none',
                        padding: '10px 24px',
                        borderRadius: '999px',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                      }}
                    >
                      Shop Collection Online &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Campaigns History */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
          Broadcast History & Delivery Analytics
        </h3>

        {campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            No campaigns sent yet. Create and broadcast your first offer above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 18px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                      {camp.title}
                    </span>
                    {camp.is_active_banner && (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8' }}>
                        ★ Live Store Banner
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span>Code: <b style={{ color: '#a5b4fc' }}>{camp.promo_code}</b> ({camp.discount_percent}% OFF)</span>
                    <span>• Created: {new Date(camp.created_at).toLocaleDateString()}</span>
                    {camp.valid_until ? (
                      (() => {
                        const vStatus = getValidityStatus(camp.valid_until);
                        return (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background: vStatus.isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: vStatus.color,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={11} /> {vStatus.label}
                          </span>
                        );
                      })()
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        ⏳ Ongoing (No Expiration)
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {camp.stats && (
                    <div style={{ fontSize: '0.8rem', display: 'flex', gap: '10px' }}>
                      <span style={{ color: '#10b981' }}>
                        WA: <b>{camp.stats.whatsapp_sent || 0}</b> sent
                      </span>
                      <span style={{ color: '#818cf8' }}>
                        Email: <b>{camp.stats.email_sent || 0}</b> sent
                      </span>
                    </div>
                  )}

                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      background: camp.status === 'SENT' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                      color: camp.status === 'SENT' ? '#10b981' : '#a5b4fc',
                    }}
                  >
                    {camp.status}
                  </span>

                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => handleTriggerBroadcastOnly(camp.id)}
                    disabled={broadcastingId === camp.id}
                  >
                    {broadcastingId === camp.id ? (
                      <RefreshCw size={14} className="spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    <span>Re-Send</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}
