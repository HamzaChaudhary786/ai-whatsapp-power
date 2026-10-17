import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  Sparkles,
  Move,
  Layers,
  Check,
} from 'lucide-react';
import { getProductImageUrl } from '../api/client';

// Category-specific complementary high-resolution detail perspectives
const CATEGORY_ANGLES = {
  'Maxi & Evening Dresses': [
    {
      url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1400&q=85',
      label: 'Silk Weave & Fabric Texture',
      badge: 'Fabric Detail',
    },
    {
      url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1400&q=85',
      label: 'Side Silhouette & Flowing Drape',
      badge: 'Side Profile',
    },
    {
      url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1400&q=85',
      label: 'Runway Atelier Styling',
      badge: 'Runway Look',
    },
  ],
  'Casual Day Dresses': [
    {
      url: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=1400&q=85',
      label: 'Organic Cotton Weave & Texture',
      badge: 'Fabric Detail',
    },
    {
      url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1400&q=85',
      label: 'Breezy Silhouette Cut',
      badge: 'Side Angle',
    },
    {
      url: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1400&q=85',
      label: 'Daytime Casual Styling',
      badge: 'Lifestyle',
    },
  ],
  'Party Wear Gowns': [
    {
      url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=1400&q=85',
      label: 'Crystal Shimmer & Sequin Craft',
      badge: 'Texture Detail',
    },
    {
      url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1400&q=85',
      label: 'Evening Back Silhouette',
      badge: 'Back View',
    },
    {
      url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1400&q=85',
      label: 'Gala Night Glamour Angle',
      badge: 'Runway',
    },
  ],
  'Bridal & Festive Wear': [
    {
      url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1400&q=85',
      label: 'Handcrafted Zardozi & Zari Work',
      badge: 'Embroidery Detail',
    },
    {
      url: 'https://images.unsplash.com/photo-1546804784-896d0dca3805?auto=format&fit=crop&w=1400&q=85',
      label: 'Bridal Border & Tilla Weave',
      badge: 'Craftsmanship',
    },
    {
      url: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1400&q=85',
      label: 'Festive Pishwas Silhouette',
      badge: 'Full Silhouette',
    },
  ],
  'Cardigans & Knitwear': [
    {
      url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1400&q=85',
      label: 'Cable Knit & Wool Yarn Detail',
      badge: 'Knit Macro',
    },
    {
      url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1400&q=85',
      label: 'Ribbed Cuff & Collar Weave',
      badge: 'Close-up',
    },
    {
      url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85',
      label: 'Layered Atelier Silhouette',
      badge: 'Styled Angle',
    },
  ],
  'Formal Workwear & Shirts': [
    {
      url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1400&q=85',
      label: 'Crisp Poplin Weave & Tailoring',
      badge: 'Fabric Detail',
    },
    {
      url: 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=1400&q=85',
      label: 'Tailored Seam & Collar Stitch',
      badge: 'Tailoring Detail',
    },
    {
      url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85',
      label: 'Executive Silhouette',
      badge: 'Office Profile',
    },
  ],
};

const DEFAULT_ANGLES = [
  {
    url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1400&q=85',
    label: 'Atelier Fabric Weave & Texture',
    badge: 'Fabric Detail',
  },
  {
    url: 'https://images.unsplash.com/photo-1520006403909-838d6b92c22e?auto=format&fit=crop&w=1400&q=85',
    label: 'Couture Tailoring & Stitch Line',
    badge: 'Stitching Detail',
  },
  {
    url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1400&q=85',
    label: 'Editorial Silhouette & Flow',
    badge: 'Styled View',
  },
];

// Helper to convert images to Ultra-HD resolution for zoom
function getUltraHdUrl(src) {
  const resolved = getProductImageUrl(src);
  if (!resolved || typeof resolved !== 'string') return resolved;
  if (resolved.includes('images.unsplash.com')) {
    let upgraded = resolved.replace(/w=\d+/, 'w=1800').replace(/q=\d+/, 'q=90');
    if (!upgraded.includes('w=1800')) {
      upgraded += (upgraded.includes('?') ? '&' : '?') + 'auto=format&fit=crop&w=1800&q=90';
    }
    return upgraded;
  }
  // Support Shopify CDN (e.g. limelight.pk/cdn/shop/files/...) with width parameter
  if (resolved.includes('cdn/shop') && resolved.includes('width=')) {
    return resolved.replace(/width=\d+/, 'width=1946');
  }
  return resolved;
}

export default function ProductImageGalleryZoom({ product, selectedColor, onColorChange }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomCoords, setZoomCoords] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageContainerRef = useRef(null);
  const lightboxCanvasRef = useRef(null);

  // Build the list of images for this product
  const images = React.useMemo(() => {
    if (!product) return [];

    let rawList = [];
    if (Array.isArray(product.image_urls) && product.image_urls.length > 0) {
      rawList = product.image_urls;
    } else if (typeof product.image_urls === 'string' && product.image_urls.trim()) {
      rawList = product.image_urls.split(',').map((u) => u.trim()).filter(Boolean);
    } else if (product.image_url) {
      rawList = [product.image_url];
    }

    // Clean and deduplicate
    const uniqueUrls = Array.from(new Set(rawList.filter(Boolean)));

    if (uniqueUrls.length === 0) {
      uniqueUrls.push('https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1000&q=80');
    }

    // If only 1 image exists, provide complementary category angles for high-fashion detail viewing
    if (uniqueUrls.length === 1) {
      const category = product.category || '';
      const pool = CATEGORY_ANGLES[category] || DEFAULT_ANGLES;
      return [
        {
          url: uniqueUrls[0],
          highRes: getUltraHdUrl(uniqueUrls[0]),
          label: 'Primary Look — Full Silhouette',
          badge: 'Main View',
        },
        ...pool.map((item) => ({
          url: item.url,
          highRes: getUltraHdUrl(item.url),
          label: item.label,
          badge: item.badge,
        })),
      ];
    }

    // When product has multiple uploaded images
    const viewLabels = ['Main View', 'Back Angle', 'Detail Shot', 'Side Profile', 'Fabric Texture', 'Lifestyle'];
    return uniqueUrls.map((url, idx) => ({
      url,
      highRes: getUltraHdUrl(url),
      label: `${product.name} — Angle ${idx + 1}`,
      badge: viewLabels[idx % viewLabels.length],
    }));
  }, [product]);

  // Reset active index when product changes
  useEffect(() => {
    setActiveIndex(0);
    setIsZooming(false);
    setIsLightboxOpen(false);
    setLightboxZoom(1);
    setLightboxPan({ x: 0, y: 0 });
  }, [product?.id, product?.slug]);

  // Handle in-place mouse hover zoom
  const handleMouseMove = useCallback((e) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomCoords({ x, y });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsZooming(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsZooming(false);
  }, []);

  // Keyboard navigation inside lightbox
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
        setLightboxZoom(1);
        setLightboxPan({ x: 0, y: 0 });
      } else if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      } else if (e.key === '+' || e.key === '=') {
        setLightboxZoom((z) => Math.min(4.5, z + 0.5));
      } else if (e.key === '-') {
        setLightboxZoom((z) => Math.max(1, z - 0.5));
      } else if (e.key === '0') {
        setLightboxZoom(1);
        setLightboxPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, images.length]);

  // Lightbox Pan & Drag handlers
  const handleLightboxMouseDown = (e) => {
    if (lightboxZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - lightboxPan.x, y: e.clientY - lightboxPan.y });
  };

  const handleLightboxMouseMove = (e) => {
    if (!isDragging || lightboxZoom <= 1) return;
    setLightboxPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleLightboxMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheelZoom = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setLightboxZoom((z) => Math.min(4.5, +(z + 0.25).toFixed(2)));
    } else {
      setLightboxZoom((z) => {
        const next = Math.max(1, +(z - 0.25).toFixed(2));
        if (next === 1) setLightboxPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  const toggleDoubleTapZoom = () => {
    if (lightboxZoom > 1.2) {
      setLightboxZoom(1);
      setLightboxPan({ x: 0, y: 0 });
    } else {
      setLightboxZoom(2.5);
    }
  };

  const activeImage = images[activeIndex] || images[0];

  return (
    <div className="product-gallery-zoom-root">
      {/* Main Image Viewport with In-Place Lens Zoom */}
      <div
        ref={imageContainerRef}
        className={`product-gallery-main-viewport ${isZooming ? 'is-zoomed' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsLightboxOpen(true)}
        title="Click to open Ultra-HD inspection view"
      >
        {/* Base Normal Image */}
        <img
          src={getProductImageUrl(activeImage?.url)}
          alt={activeImage?.label || product?.name}
          className="product-gallery-base-img"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1000&q=80';
          }}
        />

        {/* High-Resolution Zoom Layer (tracks mouse coordinates) */}
        <div
          className="product-gallery-zoom-layer"
          style={{
            opacity: isZooming ? 1 : 0,
            backgroundImage: `url(${activeImage?.highRes || getProductImageUrl(activeImage?.url)})`,
            backgroundPosition: `${zoomCoords.x}% ${zoomCoords.y}%`,
            backgroundSize: '280%',
          }}
        />

        {/* Precision Crosshair / Lens reticle indicator */}
        {isZooming && (
          <div
            className="product-gallery-lens-reticle"
            style={{
              left: `${zoomCoords.x}%`,
              top: `${zoomCoords.y}%`,
            }}
          >
            <div className="reticle-dot" />
            <div className="reticle-crosshair-h" />
            <div className="reticle-crosshair-v" />
            <span className="reticle-zoom-tag">2.8× HD</span>
          </div>
        )}

        {/* Top Floating Badge: Angle / View Description */}
        <div className="product-gallery-view-badge">
          <Sparkles size={13} className="text-gold" />
          <span>{activeImage?.badge || 'Main Look'}</span>
          <span className="badge-divider">•</span>
          <span>{activeIndex + 1} / {images.length}</span>
        </div>

        {/* Fullscreen HD Expand Button */}
        <button
          type="button"
          className="product-gallery-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsLightboxOpen(true);
          }}
          title="Open Ultra-HD Deep Inspection"
        >
          <Maximize2 size={16} />
        </button>

        {/* Previous / Next Arrow Controls */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="product-gallery-nav-arrow arrow-left"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
              }}
              title="Previous Image (←)"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="product-gallery-nav-arrow arrow-right"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
              }}
              title="Next Image (→)"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        {/* Bottom Hint Banner */}
        <div className="product-gallery-hint-bar">
          <span className="hint-pill">
            <ZoomIn size={12} /> Hover to Zoom • Click for Ultra-HD View
          </span>
        </div>
      </div>

      {/* Thumbnails Carousel / Strip */}
      {images.length > 1 && (
        <div className="product-gallery-thumbnails-strip">
          {images.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                className={`product-gallery-thumb-item ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveIndex(idx)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <img
                  src={getProductImageUrl(img.url)}
                  alt={`Thumbnail ${idx + 1}`}
                  className="product-gallery-thumb-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                  }}
                />
                <span className="thumb-badge-label">{img.badge}</span>
                {isActive && (
                  <span className="thumb-active-dot">
                    <Check size={10} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Active Image Caption & Craftsmanship Note */}
      <div className="product-gallery-caption">
        <span className="caption-label">Viewing Angle:</span>
        <span className="caption-text">{activeImage?.label}</span>
      </div>

      {/* ULTRA-HD FULLSCREEN DEEP INSPECTION LIGHTBOX MODAL */}
      {isLightboxOpen && (
        <div
          className="product-lightbox-overlay"
          onClick={() => {
            setIsLightboxOpen(false);
            setLightboxZoom(1);
            setLightboxPan({ x: 0, y: 0 });
          }}
        >
          <div
            className="product-lightbox-container"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header Bar */}
            <div className="product-lightbox-header">
              <div className="lightbox-title-col">
                <h3 className="lightbox-prod-name">{product?.name}</h3>
                <div className="lightbox-prod-meta">
                  <span>{product?.category}</span>
                  <span className="meta-sep">•</span>
                  <span>{activeImage?.label}</span>
                  <span className="meta-sep">•</span>
                  <span className="lightbox-counter">{activeIndex + 1} of {images.length}</span>
                </div>
              </div>

              {/* Zoom & Inspection Controls */}
              <div className="lightbox-controls-group">
                <button
                  type="button"
                  className="lightbox-ctrl-btn"
                  onClick={() => setLightboxZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
                  disabled={lightboxZoom <= 1}
                  title="Zoom Out (-)"
                >
                  <ZoomOut size={16} />
                </button>

                <div className="lightbox-zoom-indicator" title="Current Zoom Scale">
                  {Math.round(lightboxZoom * 100)}%
                </div>

                <button
                  type="button"
                  className="lightbox-ctrl-btn"
                  onClick={() => setLightboxZoom((z) => Math.min(4.5, +(z + 0.5).toFixed(1)))}
                  disabled={lightboxZoom >= 4.5}
                  title="Zoom In (+)"
                >
                  <ZoomIn size={16} />
                </button>

                <button
                  type="button"
                  className="lightbox-ctrl-btn"
                  onClick={() => {
                    setLightboxZoom(1);
                    setLightboxPan({ x: 0, y: 0 });
                  }}
                  title="Reset to 100% Fit (0)"
                >
                  <RotateCcw size={16} />
                </button>

                <div className="lightbox-divider" />

                <button
                  type="button"
                  className="lightbox-close-btn"
                  onClick={() => {
                    setIsLightboxOpen(false);
                    setLightboxZoom(1);
                    setLightboxPan({ x: 0, y: 0 });
                  }}
                  title="Close Ultra-HD View (Esc)"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Lightbox Canvas Area */}
            <div
              ref={lightboxCanvasRef}
              className={`product-lightbox-canvas ${lightboxZoom > 1 ? (isDragging ? 'is-dragging' : 'is-pannable') : ''}`}
              onMouseDown={handleLightboxMouseDown}
              onMouseMove={handleLightboxMouseMove}
              onMouseUp={handleLightboxMouseUp}
              onMouseLeave={handleLightboxMouseUp}
              onWheel={handleWheelZoom}
              onDoubleClick={toggleDoubleTapZoom}
            >
              <img
                src={activeImage?.highRes || getProductImageUrl(activeImage?.url)}
                alt={activeImage?.label || product?.name}
                className="lightbox-zoom-target-img"
                style={{
                  transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxZoom})`,
                  cursor: lightboxZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                }}
                draggable={false}
              />

              {/* Prev / Next Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="lightbox-nav-arrow arrow-left"
                    onClick={() => {
                      setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
                      setLightboxPan({ x: 0, y: 0 });
                    }}
                    title="Previous (←)"
                  >
                    <ChevronLeft size={28} />
                  </button>
                  <button
                    type="button"
                    className="lightbox-nav-arrow arrow-right"
                    onClick={() => {
                      setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
                      setLightboxPan({ x: 0, y: 0 });
                    }}
                    title="Next (→)"
                  >
                    <ChevronRight size={28} />
                  </button>
                </>
              )}

              {/* Drag to pan helper tooltip */}
              {lightboxZoom > 1 && (
                <div className="lightbox-drag-hint">
                  <Move size={14} /> Drag image to inspect fabric & weave details • Double-click to reset
                </div>
              )}
            </div>

            {/* Lightbox Footer Thumbnail Navigation */}
            <div className="product-lightbox-footer">
              <div className="lightbox-thumb-tray">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`lightbox-tray-thumb ${idx === activeIndex ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveIndex(idx);
                      setLightboxPan({ x: 0, y: 0 });
                    }}
                  >
                    <img
                      src={getProductImageUrl(img.url)}
                      alt={`Tray thumb ${idx + 1}`}
                      className="lightbox-tray-img"
                    />
                    <span className="tray-thumb-badge">{img.badge}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
