import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  CheckCircle,
  Truck,
  Package,
  Clock,
  XCircle,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  Building,
  X,
  AlertCircle,
  Search,
  ExternalLink,
  Printer,
  ChevronRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { api } from '../api/client';
import RealBarcode from '../components/RealBarcode';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Return & Exchange Review Action
  const handleReviewReturn = async (orderId, action) => {
    const promptMsg = action === 'APPROVED'
      ? 'Approve this return/exchange request? Stock units will be replenished back into catalog.'
      : 'Reject this return request? Please enter rejection reason:';
    let note = '';
    if (action === 'REJECTED') {
      note = window.prompt(promptMsg);
      if (note === null) return;
    } else {
      if (!window.confirm(promptMsg)) return;
      note = 'Return request approved by staff.';
    }

    try {
      await api.reviewOrderReturn(orderId, action, note);
      await loadOrders();
      alert(`Return request has been ${action.toLowerCase()} successfully.`);
    } catch (err) {
      alert(`Failed to update return: ${err.message}`);
    }
  };

  // Staff Manual Order Placement Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState('');

  // Courier Booking Modal State
  const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
  const [selectedOrderForCourier, setSelectedOrderForCourier] = useState(null);
  const [courierPartner, setCourierPartner] = useState('Trax Logistics');
  const [parcelWeight, setParcelWeight] = useState(0.5);
  const [courierInstructions, setCourierInstructions] = useState('Handle with care. Luxury designer apparel.');
  const [bookingCourier, setBookingCourier] = useState(false);
  const [courierSuccess, setCourierSuccess] = useState('');
  const [courierError, setCourierError] = useState('');
  const [courierPartners, setCourierPartners] = useState([]);

  // Live Tracking Modal State
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  // Shipping Slip (AWB) Modal State
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [slipData, setSlipData] = useState(null);
  const [loadingSlip, setLoadingSlip] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    streetAddress: '',
    city: 'Lahore',
    productId: '',
    color: 'Standard',
    size: 'Standard',
    quantity: 1,
    deliveryFee: 0.0,
  });

  const loadOrders = async () => {
    try {
      const [ordersData, prodsData, partnersData] = await Promise.all([
        api.getOrders(),
        api.getProducts().catch(() => []),
        api.getCourierPartners().catch(() => []),
      ]);
      setOrders(ordersData);
      setProducts(prodsData);
      setCourierPartners(partnersData);
      if (prodsData.length > 0 && !form.productId) {
        const firstP = prodsData[0];
        const pColors = firstP?.variants?.length > 0
          ? Array.from(new Set(firstP.variants.map((v) => v.color).filter(Boolean)))
          : (firstP?.colors ? (Array.isArray(firstP.colors) ? firstP.colors : firstP.colors.split(',').map(c => c.trim())) : []);
        const pSizes = firstP?.variants?.length > 0
          ? Array.from(new Set(firstP.variants.map((v) => v.size).filter(Boolean)))
          : (firstP?.sizes ? (Array.isArray(firstP.sizes) ? firstP.sizes : firstP.sizes.split(',').map(s => s.trim())) : []);
        setForm((prev) => ({
          ...prev,
          productId: firstP.id,
          color: pColors[0] || 'Standard',
          size: pSizes[0] || 'Standard',
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await api.updateOrderStatus(orderId, newStatus, `Updated to ${newStatus} via dashboard`);
      await loadOrders();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleOpenCourierModal = (order) => {
    setSelectedOrderForCourier(order);
    setCourierPartner('Trax Logistics');
    setParcelWeight(0.5);
    setCourierInstructions('Handle with care. Luxury designer apparel.');
    setCourierError('');
    setCourierSuccess('');
    setIsCourierModalOpen(true);
  };

  const handleBookCourierShipment = async (e) => {
    e.preventDefault();
    if (!selectedOrderForCourier) return;

    setBookingCourier(true);
    setCourierError('');
    setCourierSuccess('');

    try {
      const res = await api.bookCourierShipment({
        order_id: selectedOrderForCourier.id || selectedOrderForCourier.order_number,
        courier_partner: courierPartner,
        parcel_weight_kg: Number(parcelWeight) || 0.5,
        instructions: courierInstructions,
      });

      setCourierSuccess(
        `Consignment booked with ${res.courier_partner}! Tracking #${res.tracking_number}. Customer notified via WhatsApp & Email.`
      );
      await loadOrders();
      setTimeout(() => {
        setIsCourierModalOpen(false);
        setCourierSuccess('');
      }, 1800);
    } catch (err) {
      setCourierError(err.message || 'Failed to book courier shipment.');
    } finally {
      setBookingCourier(false);
    }
  };

  const handleOpenTrackingModal = async (identifier) => {
    setIsTrackingModalOpen(true);
    setLoadingTracking(true);
    setTrackingError('');
    setTrackingData(null);

    try {
      const data = await api.trackCourier(identifier);
      setTrackingData(data);
    } catch (err) {
      setTrackingError(err.message || 'Could not fetch live tracking data.');
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleOpenSlipModal = async (orderId) => {
    setIsSlipModalOpen(true);
    setLoadingSlip(true);
    setSlipData(null);

    try {
      const data = await api.getCourierShippingSlip(orderId);
      setSlipData(data);
    } catch (err) {
      alert(`Could not generate shipping slip: ${err.message}`);
      setIsSlipModalOpen(false);
    } finally {
      setLoadingSlip(false);
    }
  };

  const handleCreateStaffOrder = async (e) => {
    e.preventDefault();
    setOrderError('');
    setOrderSuccess('');

    if (!form.fullName.trim() || !form.phone.trim() || !form.streetAddress.trim() || !form.city.trim()) {
      setOrderError('Full Name, WhatsApp Number, Complete Address, and City are required before placing the order.');
      return;
    }

    const selectedProd = products.find((p) => p.id === form.productId) || products[0];
    if (!selectedProd) {
      setOrderError('Please select a product from the catalog.');
      return;
    }

    // Match variant by selected color and size
    let matchingVariant = null;
    if (selectedProd.variants && selectedProd.variants.length > 0) {
      matchingVariant = selectedProd.variants.find(
        (v) => (v.color?.toLowerCase() === form.color?.toLowerCase()) && (v.size?.toLowerCase() === form.size?.toLowerCase())
      );
      if (!matchingVariant && form.color) {
        matchingVariant = selectedProd.variants.find(
          (v) => v.color?.toLowerCase() === form.color?.toLowerCase()
        );
      }
      if (!matchingVariant) {
        matchingVariant = selectedProd.variants[0];
      }
    }

    const price = matchingVariant ? matchingVariant.price : (selectedProd.price || 79.99);
    const variantId = matchingVariant?.id || null;
    const sku = matchingVariant?.sku || selectedProd.sku || 'STAFF-ORD';

    const subtotal = price * Number(form.quantity);
    const deliveryFee = Number(form.deliveryFee) || 0.0;
    const total = subtotal + deliveryFee;

    setSubmittingOrder(true);
    try {
      const payload = {
        customer_id: 'guest',
        items: [
          {
            product_id: selectedProd.id,
            variant_id: variantId,
            name: selectedProd.name,
            sku: sku,
            unit_price: price,
            color: form.color || matchingVariant?.color || 'Standard',
            size: form.size || matchingVariant?.size || 'Standard',
            quantity: Number(form.quantity),
            total_price: subtotal,
            image_url: selectedProd.image_urls?.[0] || 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=400&q=80',
          },
        ],
        subtotal: subtotal,
        delivery_fee: deliveryFee,
        total: total,
        currency: 'PKR',
        address_snapshot: {
          full_name: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          street_address: form.streetAddress.trim(),
          city: form.city.trim(),
          country: 'Pakistan',
        },
      };

      const res = await api.createOrder(payload);
      setOrderSuccess(`Order #${res.order_number} created successfully! Customer profile updated.`);
      await loadOrders();
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setOrderSuccess('');
        const firstP = products[0];
        const pColors = firstP?.variants?.length > 0
          ? Array.from(new Set(firstP.variants.map((v) => v.color).filter(Boolean)))
          : (firstP?.colors ? (Array.isArray(firstP.colors) ? firstP.colors : firstP.colors.split(',').map(c => c.trim())) : []);
        const pSizes = firstP?.variants?.length > 0
          ? Array.from(new Set(firstP.variants.map((v) => v.size).filter(Boolean)))
          : (firstP?.sizes ? (Array.isArray(firstP.sizes) ? firstP.sizes : firstP.sizes.split(',').map(s => s.trim())) : []);
        setForm({
          fullName: '',
          phone: '',
          email: '',
          streetAddress: '',
          city: 'Lahore',
          productId: firstP?.id || '',
          color: pColors[0] || 'Standard',
          size: pSizes[0] || 'Standard',
          quantity: 1,
          deliveryFee: 0.0,
        });
      }, 1500);
    } catch (err) {
      setOrderError(err.message || 'Failed to place order.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const filtered = orders.filter((o) => {
    const matchesStatus =
      filterStatus === 'ALL'
        ? true
        : filterStatus === 'RETURNS'
        ? o.return_status === 'REQUESTED' || o.status === 'RETURNED'
        : o.status === filterStatus;

    if (!matchesStatus) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const orderNum = (o.order_number || '').toLowerCase();
    const custName = (o.address_snapshot?.full_name || '').toLowerCase();
    const custPhone = (o.address_snapshot?.phone || '').toLowerCase();
    const tracking = (o.tracking_number || '').toLowerCase();
    const city = (o.address_snapshot?.city || '').toLowerCase();

    return orderNum.includes(q) || custName.includes(q) || custPhone.includes(q) || tracking.includes(q) || city.includes(q);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Orders, Logistics & Courier Dispatch</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Manage customer checkout orders, book multi-carrier courier shipments (Trax, TCS, Leopards, PostEx) and track live parcels
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Live Search Input */}
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by Order #, Name, Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '36px' }}
            />
          </div>

          {/* Action: Staff Manual Order */}
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 16px' }}
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Plus size={16} />
            <span>Take Customer Order (Staff)</span>
          </button>

          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--radius-md)', flexWrap: 'wrap' }}>
            {['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNS', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className="btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  background: filterStatus === st ? 'var(--primary)' : 'transparent',
                  color: filterStatus === st ? '#fff' : 'var(--text-muted)',
                }}
              >
                {st === 'RETURNS' ? 'Returns & Exchanges' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Staff Manual Order Modal */}
      {isCreateModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsCreateModalOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '580px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Place Customer Order (Staff Desk)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Enter customer profile details. Customer record will be automatically synced.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
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

            <form onSubmit={handleCreateStaffOrder} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>
                    WhatsApp Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="+92 300 1234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Email Address <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(Optional)</span>
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="customer@example.com (optional)"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                  Complete Street Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="House 42, Street 7, Phase 5, DHA"
                  value={form.streetAddress}
                  onChange={(e) => setForm({ ...form, streetAddress: e.target.value })}
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
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Select Product</label>
                  <select
                    className="form-input"
                    value={form.productId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      const newProd = products.find((p) => p.id === newId);
                      const pColors = newProd?.variants?.length > 0
                        ? Array.from(new Set(newProd.variants.map((v) => v.color).filter(Boolean)))
                        : (newProd?.colors ? (Array.isArray(newProd.colors) ? newProd.colors : newProd.colors.split(',').map(c => c.trim())) : []);
                      const pSizes = newProd?.variants?.length > 0
                        ? Array.from(new Set(newProd.variants.map((v) => v.size).filter(Boolean)))
                        : (newProd?.sizes ? (Array.isArray(newProd.sizes) ? newProd.sizes : newProd.sizes.split(',').map(s => s.trim())) : []);
                      setForm({
                        ...form,
                        productId: newId,
                        color: pColors[0] || 'Standard',
                        size: pSizes[0] || 'Standard',
                      });
                    }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
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
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
              </div>

              {/* Dynamic Color & Size Pickers */}
              {(() => {
                const curProd = products.find((p) => p.id === form.productId) || products[0];
                const curColors = curProd?.variants?.length > 0
                  ? Array.from(new Set(curProd.variants.map((v) => v.color).filter(Boolean)))
                  : (curProd?.colors ? (Array.isArray(curProd.colors) ? curProd.colors : curProd.colors.split(',').map(c => c.trim())) : []);
                const curSizes = curProd?.variants?.length > 0
                  ? Array.from(new Set(curProd.variants.map((v) => v.size).filter(Boolean)))
                  : (curProd?.sizes ? (Array.isArray(curProd.sizes) ? curProd.sizes : curProd.sizes.split(',').map(s => s.trim())) : []);

                const matchingVar = curProd?.variants?.find(
                  (v) => (v.color?.toLowerCase() === form.color?.toLowerCase()) && (v.size?.toLowerCase() === form.size?.toLowerCase())
                ) || curProd?.variants?.find(
                  (v) => v.color?.toLowerCase() === form.color?.toLowerCase()
                ) || curProd?.variants?.[0];

                const unitP = matchingVar ? matchingVar.price : (curProd?.price || 79.99);

                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Color (from Product)</label>
                        <select
                          className="form-input"
                          value={form.color}
                          onChange={(e) => setForm({ ...form, color: e.target.value })}
                        >
                          {curColors.length > 0 ? (
                            curColors.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))
                          ) : (
                            <option value="Standard">Standard</option>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Size (from Product)</label>
                        <select
                          className="form-input"
                          value={form.size}
                          onChange={(e) => setForm({ ...form, size: e.target.value })}
                        >
                          {curSizes.length > 0 ? (
                            curSizes.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))
                          ) : (
                            <option value="Standard">Standard</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <div style={{ padding: '10px 14px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Unit Price: <strong style={{ color: '#f8fafc' }}>PKR {unitP.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Total: <strong style={{ color: 'var(--primary)', fontSize: '0.95rem' }}>PKR {(unitP * Number(form.quantity) + Number(form.deliveryFee)).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                  </>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingOrder}
                >
                  {submittingOrder ? 'Placing Order...' : 'Confirm & Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courier Booking Modal */}
      {isCourierModalOpen && selectedOrderForCourier && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '580px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.2)', borderRadius: '8px', color: 'var(--primary)' }}>
                  <Truck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Book Courier Shipment</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Order #{selectedOrderForCourier.order_number} • Consignment Dispatch
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCourierModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {courierError && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{courierError}</span>
              </div>
            )}

            {courierSuccess && (
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                <span>{courierSuccess}</span>
              </div>
            )}

            <form onSubmit={handleBookCourierShipment} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Destination Box */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '10px', padding: '14px', fontSize: '0.85rem' }}>
                <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                  Deliver To: {selectedOrderForCourier.address_snapshot?.full_name || 'Customer'}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  📍 {selectedOrderForCourier.address_snapshot?.street_address}, {selectedOrderForCourier.address_snapshot?.city}
                </div>
                <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                  📱 Phone: {selectedOrderForCourier.address_snapshot?.phone}
                </div>
                <div style={{ color: 'var(--primary)', fontWeight: 700, marginTop: '4px' }}>
                  💵 COD Payable Amount: PKR {selectedOrderForCourier.total?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>

              {/* Courier Partner Selection */}
              <div>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>
                  Select Courier Carrier Partner <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="form-input"
                  value={courierPartner}
                  onChange={(e) => setCourierPartner(e.target.value)}
                >
                  <option value="Trax Logistics">Trax Logistics (2-3 Days • Recommended COD Gateway)</option>
                  <option value="TCS Express">TCS Express (1-2 Days • Priority Overnight)</option>
                  <option value="Leopards Courier">Leopards Courier (2-3 Days • Nationwide Coverage)</option>
                  <option value="PostEx">PostEx (2-3 Days • E-Commerce Fast Remittance)</option>
                  <option value="BlueEx">BlueEx (2-4 Days • Economical)</option>
                  <option value="DHL Express">DHL Express (3-5 Days • International Export)</option>
                </select>
              </div>

              {/* Parcel Weight and Pickup Hub */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Parcel Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="30"
                    className="form-input"
                    value={parcelWeight}
                    onChange={(e) => setParcelWeight(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.82rem' }}>Pickup Fulfillment Hub</label>
                  <input
                    type="text"
                    disabled
                    className="form-input"
                    value="Luxe Atelier Central Hub, Lahore"
                    style={{ opacity: 0.7 }}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.82rem' }}>Rider Handling Instructions</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Fragile designer apparel. Call customer before delivery."
                  value={courierInstructions}
                  onChange={(e) => setCourierInstructions(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCourierModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={bookingCourier}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={15} />
                  <span>{bookingCourier ? 'Generating Consignment...' : 'Book Consignment & Dispatch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Parcel Tracking Modal */}
      {isTrackingModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '640px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: '#10b981' }}>
                  <Truck size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Live Consignment Tracking</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Multi-Stage Real-Time Logistics Stepper
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsTrackingModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingTracking ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Clock size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                <p>Contacting courier logistics server...</p>
              </div>
            ) : trackingError ? (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5' }}>
                <AlertCircle size={20} style={{ marginBottom: '6px' }} />
                <div>{trackingError}</div>
              </div>
            ) : trackingData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Tracking Header Card */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Consignment Tracking No</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                      {trackingData.tracking_number}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Carrier: <b>{trackingData.courier_partner}</b>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Estimated Delivery</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8', marginTop: '2px' }}>
                      {trackingData.estimated_delivery}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                      COD: PKR {trackingData.cod_amount?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Status Bar */}
                <div style={{ padding: '10px 14px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e0e7ff' }}>
                    Status: <span style={{ color: 'var(--primary)' }}>{trackingData.status_label}</span>
                  </div>
                  <a
                    href={trackingData.tracking_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.78rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                  >
                    <span>Carrier Portal</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

                {/* Checkpoint Stepper */}
                <div style={{ padding: '8px 0' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '14px' }}>
                    Shipment Journey
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '28px' }}>
                    {/* Vertical line */}
                    <div style={{ position: 'absolute', left: '11px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(255,255,255,0.1)' }} />

                    {trackingData.checkpoints?.map((cp, idx) => (
                      <div key={idx} style={{ position: 'relative' }}>
                        {/* Dot indicator */}
                        <div
                          style={{
                            position: 'absolute',
                            left: '-28px',
                            top: '2px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: cp.is_current
                              ? '#3b82f6'
                              : cp.is_completed
                              ? '#10b981'
                              : 'rgba(255,255,255,0.1)',
                            border: '3px solid #0f172a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: '11px',
                            boxShadow: cp.is_current ? '0 0 12px rgba(59, 130, 246, 0.8)' : 'none',
                          }}
                        >
                          {cp.is_completed ? '✓' : idx + 1}
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: cp.is_current ? '#60a5fa' : cp.is_completed ? '#f1f5f9' : 'var(--text-dim)' }}>
                              {cp.title}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              {new Date(cp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {cp.description}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                            📍 {cp.location}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Airway Bill (AWB) Consignment Slip Modal */}
      {isSlipModalOpen && slipData && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '620px', padding: '28px', maxHeight: '90vh', overflowY: 'auto', background: '#0b1120', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Official Consignment Note (AWB Slip)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Carrier Shipping Manifest & Dispatch Label
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', padding: '6px 12px' }}
                  onClick={() => window.print()}
                >
                  <Printer size={14} />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setIsSlipModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Slip Paper representation */}
            <div style={{ border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '8px', padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
              {/* Top Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '1px' }}>LUXE ATELIER</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>HAUTE COUTURE DISPATCH CENTER</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 700, marginTop: '4px' }}>
                    CARRIER: {slipData.courier_partner}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '2px' }}>
                    {slipData.awb_number}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    ORDER: {slipData.order_number}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                    DATE: {slipData.booking_date}
                  </div>
                </div>
              </div>

              {/* Real Scannable ISO/IEC 15417 Code 128 Barcode */}
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                <RealBarcode value={slipData.awb_number} height={58} width={2.0} />
              </div>

              {/* Shipper and Consignee grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px', fontSize: '0.82rem' }}>
                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.72rem', marginBottom: '4px' }}>
                    FROM (SHIPPER)
                  </div>
                  <div style={{ fontWeight: 600 }}>{slipData.shipper?.company}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{slipData.shipper?.address}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{slipData.shipper?.city}</div>
                  <div style={{ color: 'var(--text-muted)' }}>Phone: {slipData.shipper?.phone}</div>
                </div>

                <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.72rem', marginBottom: '4px' }}>
                    TO (CONSIGNEE)
                  </div>
                  <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.9rem' }}>{slipData.consignee?.name}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{slipData.consignee?.address}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{slipData.consignee?.city}, {slipData.consignee?.country}</div>
                  <div style={{ fontWeight: 600, color: '#10b981', marginTop: '2px' }}>
                    📱 {slipData.consignee?.phone}
                  </div>
                </div>
              </div>

              {/* Payment & Spec Banner */}
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Service & Payment</div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{slipData.service_type}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>COD Amount to Collect</div>
                  <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#10b981' }}>
                    PKR {slipData.shipment_details?.cod_payable?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Items summary */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  Pieces: {slipData.shipment_details?.pieces} • Weight: {slipData.shipment_details?.weight_kg} kg
                </div>
                <div>Instructions: <i>{slipData.shipment_details?.instructions}</i></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
            <ShoppingCart size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <h3>No Orders Found</h3>
            <p style={{ color: 'var(--text-muted)' }}>Orders placed by customers will be visible here.</p>
          </div>
        ) : (
          filtered.map((ord) => (
            <div key={ord.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginRight: '12px' }}>
                    {ord.order_number}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Customer: {ord.address_snapshot?.full_name || ord.customer_id?.slice(-8)} • Date: {new Date(ord.created_at).toLocaleString()}
                  </span>

                  {/* Courier Partner Badge if booked */}
                  {ord.tracking_number && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '12px', background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#38bdf8' }}>
                      <Truck size={12} />
                      <span>{ord.courier_partner || 'Trax Logistics'}</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{ord.tracking_number}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Status Pill */}
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background:
                        ord.status === 'DELIVERED'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : ord.status === 'RETURNED'
                          ? 'rgba(234, 179, 8, 0.2)'
                          : ord.status === 'CANCELLED'
                          ? 'rgba(239, 68, 68, 0.2)'
                          : ord.status === 'OUT_FOR_DELIVERY'
                          ? 'rgba(249, 115, 22, 0.2)'
                          : ord.status === 'SHIPPED' || ord.status === 'IN_TRANSIT'
                          ? 'rgba(59, 130, 246, 0.2)'
                          : ord.status === 'CONFIRMED'
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'rgba(99, 102, 241, 0.2)',
                      color:
                        ord.status === 'DELIVERED'
                          ? '#10b981'
                          : ord.status === 'RETURNED'
                          ? '#facc15'
                          : ord.status === 'CANCELLED'
                          ? '#ef4444'
                          : ord.status === 'OUT_FOR_DELIVERY'
                          ? '#fb923c'
                          : ord.status === 'SHIPPED' || ord.status === 'IN_TRANSIT'
                          ? '#60a5fa'
                          : ord.status === 'CONFIRMED'
                          ? '#fbbf24'
                          : '#a5b4fc',
                    }}
                  >
                    {ord.status?.replace('_', ' ')}
                  </span>

                  {/* Restocked Indicator */}
                  {ord.inventory_restored && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#34d399',
                      }}
                      title="Stock units were automatically replenished back into catalog"
                    >
                      ✓ Restocked to Inventory
                    </span>
                  )}

                  {/* Tracking Button if tracking exists */}
                  {(ord.tracking_number || ord.status === 'SHIPPED' || ord.status === 'IN_TRANSIT' || ord.status === 'OUT_FOR_DELIVERY' || ord.status === 'DELIVERED') && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleOpenTrackingModal(ord.tracking_number || ord.order_number)}
                    >
                      <Search size={13} />
                      <span>Track Parcel</span>
                    </button>
                  )}

                  {/* Print AWB Slip Button */}
                  {ord.tracking_number && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleOpenSlipModal(ord.order_number)}
                    >
                      <Printer size={13} />
                      <span>AWB Slip</span>
                    </button>
                  )}

                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Resend WhatsApp & Email confirmation message to customer"
                    onClick={async () => {
                      try {
                        const res = await api.resendOrderConfirmation(ord.order_number);
                        alert(`Notification dispatch result for #${ord.order_number}:\n• WhatsApp: ${res.whatsapp}\n• Email: ${res.email}`);
                      } catch (e) {
                        alert(`Failed to resend confirmation: ${e.message}`);
                      }
                    }}
                  >
                    <Send size={12} />
                    <span>Resend Confirm</span>
                  </button>

                  {/* Quick Status Action Buttons */}
                  {ord.status === 'PENDING' && (
                    <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={() => handleUpdateStatus(ord.id, 'CONFIRMED')}>
                      Confirm Order
                    </button>
                  )}

                  {/* Major Courier Dispatch Button */}
                  {(ord.status === 'CONFIRMED' || ord.status === 'PROCESSING') && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px', background: 'linear-gradient(135deg, #4f46e5, #06b6d4)' }}
                      onClick={() => handleOpenCourierModal(ord)}
                    >
                      <Truck size={14} />
                      <span>Book Courier Dispatch</span>
                    </button>
                  )}

                  {(ord.status === 'SHIPPED' || ord.status === 'IN_TRANSIT') && (
                    <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 12px' }} onClick={() => handleUpdateStatus(ord.id, 'OUT_FOR_DELIVERY')}>
                      Out for Delivery
                    </button>
                  )}

                  {ord.status === 'OUT_FOR_DELIVERY' && (
                    <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#10b981' }} onClick={() => handleUpdateStatus(ord.id, 'DELIVERED')}>
                      Mark Delivered
                    </button>
                  )}

                  {ord.status === 'DELIVERED' && (
                    <button
                      className="btn"
                      style={{
                        fontSize: '0.75rem',
                        padding: '6px 12px',
                        background: 'rgba(234, 179, 8, 0.12)',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        color: '#facc15',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        if (window.confirm(`Process product return for Order #${ord.order_number}? This will automatically replenish and restock the items back to inventory.`)) {
                          handleUpdateStatus(ord.id, 'RETURNED');
                        }
                      }}
                    >
                      Process Return & Restock
                    </button>
                  )}

                  {(ord.status === 'PENDING' || ord.status === 'CONFIRMED') && (
                    <button
                      className="btn"
                      style={{
                        fontSize: '0.75rem',
                        padding: '6px 12px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#ef4444',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to cancel order #${ord.order_number}?`)) {
                          handleUpdateStatus(ord.id, 'CANCELLED');
                        }
                      }}
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Return / Exchange Request Notification */}
              {ord.return_status === 'REQUESTED' && (
                <div style={{ background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.35)', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ color: '#facc15', fontWeight: 700, fontSize: '0.85rem' }}>
                      ⚠️ Customer Requested 7-Day Return / Size Exchange
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '2px' }}>
                      Reason: <strong>{ord.return_reason}</strong> {ord.return_details ? `— "${ord.return_details}"` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn"
                      style={{ background: '#10b981', color: '#fff', fontSize: '0.76rem', padding: '6px 14px', fontWeight: 700, borderRadius: '6px' }}
                      onClick={() => handleReviewReturn(ord.id || ord.order_number, 'APPROVED')}
                    >
                      ✓ Approve Return & Restock
                    </button>
                    <button
                      className="btn"
                      style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.76rem', padding: '6px 14px', borderRadius: '6px' }}
                      onClick={() => handleReviewReturn(ord.id || ord.order_number, 'REJECTED')}
                    >
                      ✕ Reject Request
                    </button>
                  </div>
                </div>
              )}

              {/* Cancellation Reason if present */}
              {ord.cancellation_reason && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.76rem', color: '#fca5a5' }}>
                  Cancelled by Customer: {ord.cancellation_reason}
                </div>
              )}

              {/* Order Items & Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Purchased Items
                  </h4>
                  {ord.items?.map((it, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '0.88rem',
                      }}
                    >
                      <img
                        src={
                          it.image_url ||
                          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80'
                        }
                        alt={it.name}
                        style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '8px',
                          objectFit: 'cover',
                          border: '1px solid var(--border-glass)',
                          flexShrink: 0,
                        }}
                        onError={(e) => {
                          e.target.src =
                            'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span>SKU: <code>{it.sku || 'Std'}</code></span>
                          {(it.color && it.color !== 'Standard') && (
                            <span style={{ color: '#38bdf8' }}>Color: <b>{it.color}</b></span>
                          )}
                          {(it.size && it.size !== 'Standard') && (
                            <span style={{ color: '#a78bfa' }}>Size: <b>{it.size}</b></span>
                          )}
                          <span>Qty: <b>{it.quantity}</b></span>
                        </div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--primary)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        PKR {it.total_price?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                  {ord.coupon_code && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#10b981', marginTop: '6px' }}>
                      <span>Voucher Applied ({ord.coupon_code}):</span>
                      <span>-PKR {Number(ord.discount_amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {ord.delivery_fee !== undefined && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      <span>Delivery Fee:</span>
                      <span>{ord.delivery_fee === 0 ? 'FREE Express' : `PKR ${Number(ord.delivery_fee).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total Amount:</span>
                    <span style={{ color: 'var(--primary)' }}>PKR {ord.total?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Customer Delivery Profile
                  </h4>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                    {ord.address_snapshot?.full_name && (
                      <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.95rem' }}>
                        👤 {ord.address_snapshot.full_name}
                      </div>
                    )}
                    <div>📍 {ord.address_snapshot?.street_address || 'No street specified'}</div>
                    <div>🏙️ {ord.address_snapshot?.city || ''}, {ord.address_snapshot?.country || 'Pakistan'}</div>
                    <div>📱 WhatsApp: <b style={{ color: '#10b981' }}>{ord.address_snapshot?.phone || 'Via WhatsApp'}</b></div>
                    {ord.address_snapshot?.email && (
                      <div>✉️ Email: <i>{ord.address_snapshot.email}</i></div>
                    )}
                    {ord.estimated_delivery && (
                      <div style={{ marginTop: '4px', color: '#38bdf8', fontSize: '0.82rem' }}>
                        ⏳ Est. Arrival: <b>{ord.estimated_delivery}</b>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
