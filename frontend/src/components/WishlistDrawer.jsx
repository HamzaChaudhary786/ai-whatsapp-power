import React from 'react';
import { X, Heart, ShoppingBag, Trash2, ArrowRight, Sparkles, Check, AlertCircle } from 'lucide-react';
import { getProductImageUrl } from '../api/client';

export default function WishlistDrawer({
  isOpen,
  onClose,
  wishlist = [],
  onRemoveFromWishlist,
  onClearWishlist,
  onMoveToCart,
  onMoveAllToCart,
}) {
  if (!isOpen) return null;

  const totalWishlistValue = wishlist.reduce((acc, item) => {
    const p = typeof item.min_price === 'number'
      ? item.min_price
      : typeof item.price === 'number'
      ? item.price
      : parseFloat(String(item.price || '').replace(/[^0-9.]/g, '')) || 14000;
    return acc + p;
  }, 0);

  return (
    <div className="cart-drawer-overlay" onClick={onClose} style={{ zIndex: 9998 }}>
      <div
        className="cart-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '440px',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Header */}
        <div className="cart-drawer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Heart size={20} fill="#ef4444" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Saved Wishlist</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {wishlist.length} {wishlist.length === 1 ? 'curated outfit' : 'curated outfits'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {wishlist.length > 0 && onClearWishlist && (
              <button
                type="button"
                onClick={onClearWishlist}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
                title="Remove all items from wishlist"
              >
                Clear All
              </button>
            )}
            <button className="cart-close-btn" onClick={onClose} title="Close wishlist">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Wishlist Items List */}
        <div className="cart-items-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {wishlist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 16px', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#ef4444',
                }}
              >
                <Heart size={32} />
              </div>
              <h4 style={{ margin: '0 0 8px', color: '#f8fafc', fontSize: '1.1rem', fontWeight: 700 }}>
                Your Wishlist is Empty
              </h4>
              <p style={{ fontSize: '0.84rem', margin: '0 auto 20px', lineHeight: 1.5, maxWidth: '280px', color: 'var(--text-muted)' }}>
                Save your favorite luxury pret, lawn, and bridal outfits while browsing so you can easily review or purchase them anytime.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  const el = document.getElementById('catalog-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{ fontSize: '0.82rem', padding: '8px 20px' }}
              >
                <Sparkles size={14} /> Explore Boutique Catalog
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {wishlist.map((item) => {
                const targetId = item.id || item._id;
                const img = getProductImageUrl(item.image_urls?.[0] || item.image_url);
                const rawPrice = typeof item.min_price === 'number'
                  ? item.min_price
                  : typeof item.price === 'number'
                  ? item.price
                  : parseFloat(String(item.price || '').replace(/[^0-9.]/g, '')) || 14000;
                const formattedPrice = `PKR ${rawPrice.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const isOutOfStock = item.total_stock !== undefined && item.total_stock <= 0;

                return (
                  <div
                    key={targetId}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      alignItems: 'center',
                      position: 'relative',
                    }}
                  >
                    <img
                      src={img}
                      alt={item.name}
                      style={{
                        width: '74px',
                        height: '88px',
                        borderRadius: '8px',
                        objectFit: 'cover',
                        background: '#0f172a',
                        border: '1px solid var(--border-glass)',
                        flexShrink: 0,
                      }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=300&q=80';
                      }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: '#818cf8',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {item.category || 'Luxury Pret'}
                      </div>
                      <h4
                        style={{
                          margin: '3px 0 4px',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: '#f8fafc',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </h4>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--primary)' }}>
                          {formattedPrice}
                        </div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: isOutOfStock ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                            color: isOutOfStock ? '#f87171' : '#34d399',
                          }}
                        >
                          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => onMoveToCart(item)}
                          className="btn btn-primary"
                          style={{
                            padding: '5px 12px',
                            fontSize: '0.74rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            opacity: isOutOfStock ? 0.5 : 1,
                            cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <ShoppingBag size={13} />
                          <span>Move to Bag</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onRemoveFromWishlist(targetId)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          title="Delete from Wishlist"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {wishlist.length > 0 && (
          <div className="cart-drawer-footer" style={{ borderTop: '1px solid var(--border-glass)', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Wishlist Total Value</span>
              <strong style={{ color: 'var(--primary)', fontSize: '1.05rem', fontWeight: 800 }}>
                PKR {totalWishlistValue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>

            {onMoveAllToCart && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={onMoveAllToCart}
                style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}
              >
                <ShoppingBag size={16} />
                <span>Move All to Shopping Bag</span>
              </button>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ width: '100%', padding: '8px 16px', fontSize: '0.82rem' }}
            >
              Continue Browsing Collection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
