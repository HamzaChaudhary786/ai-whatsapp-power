import React from 'react';
import { X, Printer, Sparkles, CheckCircle2, ShieldCheck, Truck } from 'lucide-react';
import RealBarcode from './RealBarcode';

export default function PrintableInvoiceModal({ order, isOpen, onClose }) {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const address = order.address_snapshot || {};
  const items = order.items || [];
  const createdDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-PK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'N/A';

  const orderNum = order.order_number || order.id || 'ORD-LUXE';
  const consignmentNo = order.tracking_number || `TRX-${orderNum.replace(/[^0-9]/g, '').slice(-8) || '98214300'}`;

  return (
    <div className="product-modal-overlay invoice-modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="product-modal-dialog invoice-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '850px',
          width: '95%',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Screen Action Bar (Hidden in Print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6366f1' }}>
              OFFICIAL TAX & ORDER INVOICE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '8px',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <Printer size={16} /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="printable-invoice-content" style={{ fontFamily: 'Inter, sans-serif' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '20px', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '2px', color: '#0f172a' }}>
                  LUXE ATELIER
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>
                Haute Couture & Luxury Designer Fashion Boutique
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                Gulberg III, M.M. Alam Road, Lahore, Pakistan | Tel: +92 (300) 123-4567
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                support@luxeatelier.pk | NTN: 8923412-4
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#4f46e5' }}>
                INVOICE
              </h2>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                #{orderNum}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Date: {createdDate}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700, marginTop: '4px' }}>
                Payment: Cash on Delivery (COD)
              </div>
            </div>
          </div>

          {/* Barcode & Courier Dispatch Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px 20px',
              marginBottom: '24px',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Courier Logistics Consignment
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                {order.courier_partner || 'Trax Logistics'} — #{consignmentNo}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                Service: Next-Day Express Delivery | Status: {order.status}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <RealBarcode value={consignmentNo} width={1.4} height={40} fontSize={11} />
            </div>
          </div>

          {/* Bill To & Ship To Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Customer & Shipping Details
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                {address.full_name || 'Valued Customer'}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '4px' }}>
                📞 {address.phone || 'N/A'}
              </div>
              {address.email && (
                <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                  ✉️ {address.email}
                </div>
              )}
              <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '4px', lineHeight: 1.4 }}>
                📍 {address.street_address || ''}, {address.city || 'Pakistan'}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Order Summary & Verification
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Order Status:</span>
                <strong style={{ color: '#4f46e5' }}>{order.status}</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Total Items Ordered:</span>
                <strong>{items.reduce((acc, i) => acc + (i.quantity || 1), 0)} Pieces</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Voucher Code:</span>
                <strong>{order.coupon_code ? order.coupon_code : 'None'}</strong>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', justifyContent: 'space-between' }}>
                <span>Country:</span>
                <strong>Pakistan</strong>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', borderRadius: '6px 0 0 6px' }}>ITEM & ATELIER DETAILS</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>COLOR / SIZE</th>
                <th style={{ padding: '10px 14px', textAlign: 'right' }}>PRICE (PKR)</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>QTY</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', borderRadius: '0 6px 6px 0' }}>TOTAL (PKR)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
                    {item.sku && <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SKU: {item.sku}</div>}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', color: '#475569' }}>
                    {item.color || 'Default'} / {item.size || 'Standard'}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: '#334155' }}>
                    PKR {Number(item.unit_price).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                    {item.quantity || 1}
                  </td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                    PKR {Number(item.total_price || item.unit_price * (item.quantity || 1)).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Breakdown */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '28px' }}>
            <div style={{ width: '320px', background: '#f8fafc', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', marginBottom: '6px' }}>
                <span>Subtotal:</span>
                <span>PKR {Number(order.subtotal).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
              </div>
              {order.discount_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#16a34a', fontWeight: 700, marginBottom: '6px' }}>
                  <span>Voucher Discount ({order.coupon_code}):</span>
                  <span>- PKR {Number(order.discount_amount).toLocaleString('en-PK', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', marginBottom: '8px' }}>
                <span>Express Courier Shipping:</span>
                <span>{order.delivery_fee === 0 ? 'FREE' : `PKR ${Number(order.delivery_fee).toLocaleString('en-PK', { minimumFractionDigits: 2 })}`}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  color: '#0f172a',
                  borderTop: '2px solid #cbd5e1',
                  paddingTop: '8px',
                }}
              >
                <span>Grand Total (COD):</span>
                <span style={{ color: '#4f46e5' }}>
                  PKR {Number(order.total).toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Terms */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              LUXE ATELIER POLICIES & DISPATCH TERMS:
            </div>
            <div>
              1. <strong>7-Day Return / Exchange:</strong> Unworn items with original designer tags intact can be returned or exchanged within 7 days of delivery.
            </div>
            <div>
              2. <strong>Inspection:</strong> Please inspect the sealed package upon delivery before signing the courier consignment receipt.
            </div>
            <div>
              3. For queries or assistance, message our AI Fashion Stylist on WhatsApp at +92 300 1234567 or email support@luxeatelier.pk.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
