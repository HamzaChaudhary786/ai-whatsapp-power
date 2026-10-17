import React, { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Package,
  Calendar,
  Filter,
  Download,
  Printer,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Clock,
  Truck,
  RotateCcw,
  XCircle,
  Tag,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Layers,
  Search,
  Eye,
  FileSpreadsheet,
  Activity,
  Sliders,
} from 'lucide-react';
import { api, getProductImageUrl } from '../api/client';

// Luxury Boutique Color Palette
const COLORS = {
  emerald: '#10b981',
  cyan: '#38bdf8',
  indigo: '#818cf8',
  gold: '#d4af37',
  rose: '#ec4899',
  amber: '#f59e0b',
  crimson: '#f87171',
  purple: '#c084fc',
};

const PIE_COLORS = ['#10b981', '#38bdf8', '#818cf8', '#d4af37', '#ec4899', '#f97316', '#a855f7'];

// =====================================================================
// COMPONENT: INTERACTIVE SVG REVENUE & VOLUME CHART
// =====================================================================
function InteractiveRevenueChart({ data, mode, setMode }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No data available</div>;
  }

  const width = 800;
  const height = 280;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 45;

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 100);
  const maxOrders = Math.max(...data.map((d) => d.ordersCount), 5);

  const points = data.map((d, i) => {
    const x = padLeft + (i / Math.max(data.length - 1, 1)) * innerW;
    const yRev = padTop + innerH - (d.revenue / maxRevenue) * innerH;
    const yOrd = padTop + innerH - (d.ordersCount / maxOrders) * innerH;
    return { ...d, x, yRev, yOrd };
  });

  // Smooth Bezier Curve generator
  const createSmoothPath = (pts, key) => {
    if (pts.length < 2) return `M ${pts[0]?.x || 0} ${pts[0]?.[key] || 0}`;
    let d = `M ${pts[0].x} ${pts[0][key]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0[key];
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1[key];
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1[key]}`;
    }
    return d;
  };

  const linePathRev = createSmoothPath(points, 'yRev');
  const linePathOrd = createSmoothPath(points, 'yOrd');
  const areaPathRev = `${linePathRev} L ${points[points.length - 1].x} ${padTop + innerH} L ${points[0].x} ${padTop + innerH} Z`;

  // Grid steps (4 horizontal lines)
  const gridSteps = [0, 0.33, 0.66, 1];

  return (
    <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block', minWidth: '600px' }}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.emerald} stopOpacity="0.45" />
            <stop offset="90%" stopColor={COLORS.emerald} stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="ordAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.cyan} stopOpacity="0.25" />
            <stop offset="90%" stopColor={COLORS.cyan} stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.emerald} stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgba(16, 185, 129, 0.4)" />
          </linearGradient>
        </defs>

        {/* Horizontal Grid lines & Left Y-Axis labels */}
        {gridSteps.map((step, idx) => {
          const y = padTop + innerH - step * innerH;
          const val = Math.round(step * maxRevenue);
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
              <text x={padLeft - 10} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10.5" fontFamily="monospace">
                PKR {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
              </text>
            </g>
          );
        })}

        {/* X-Axis bottom base line */}
        <line x1={padLeft} y1={padTop + innerH} x2={width - padRight} y2={padTop + innerH} stroke="rgba(255,255,255,0.12)" />

        {/* MODE: AREA CHART */}
        {mode === 'AREA' && (
          <>
            <path d={areaPathRev} fill="url(#revAreaGrad)" />
            <path d={linePathRev} fill="none" stroke={COLORS.emerald} strokeWidth="3" strokeLinecap="round" />
            <path d={linePathOrd} fill="none" stroke={COLORS.cyan} strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />
          </>
        )}

        {/* MODE: BARS CHART */}
        {mode === 'BAR' && (
          <>
            {points.map((pt, i) => {
              const barW = Math.min(32, innerW / (points.length * 1.8));
              const barH = padTop + innerH - pt.yRev;
              const isHovered = hoveredIndex === i;
              return (
                <rect
                  key={i}
                  x={pt.x - barW / 2}
                  y={pt.yRev}
                  width={barW}
                  height={Math.max(barH, 2)}
                  rx="4"
                  ry="4"
                  fill="url(#barGrad)"
                  stroke={isHovered ? '#fff' : 'none'}
                  strokeWidth={isHovered ? 1.5 : 0}
                  opacity={hoveredIndex === null || isHovered ? 1 : 0.4}
                  style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredIndex(i)}
                />
              );
            })}
          </>
        )}

        {/* MODE: LINE CHART */}
        {mode === 'LINE' && (
          <>
            <path d={linePathRev} fill="none" stroke={COLORS.emerald} strokeWidth="3.5" strokeLinecap="round" />
            <path d={linePathOrd} fill="none" stroke={COLORS.gold} strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" />
          </>
        )}

        {/* Data points & X-Axis Labels */}
        {points.map((pt, i) => {
          const isHovered = hoveredIndex === i;
          return (
            <g key={i}>
              {/* Vertical guideline on hover */}
              {isHovered && (
                <line x1={pt.x} y1={padTop} x2={pt.x} y2={padTop + innerH} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
              )}

              {/* Revenue dot */}
              <circle
                cx={pt.x}
                cy={pt.yRev}
                r={isHovered ? 7 : 4.5}
                fill={COLORS.emerald}
                stroke="#0f172a"
                strokeWidth={isHovered ? 3 : 2}
                style={{ transition: 'all 0.2s ease' }}
              />

              {/* Order volume dot */}
              {(mode === 'AREA' || mode === 'LINE') && (
                <circle
                  cx={pt.x}
                  cy={pt.yOrd}
                  r={isHovered ? 5.5 : 3.5}
                  fill={mode === 'LINE' ? COLORS.gold : COLORS.cyan}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
              )}

              {/* X-Axis month label */}
              <text
                x={pt.x}
                y={padTop + innerH + 20}
                textAnchor="middle"
                fill={isHovered ? '#fff' : 'rgba(255,255,255,0.6)'}
                fontSize="11"
                fontWeight={isHovered ? 700 : 500}
              >
                {pt.label}
              </text>

              {/* Invisible wide hover detector column */}
              <rect
                x={pt.x - innerW / (points.length * 2)}
                y={padTop}
                width={innerW / points.length}
                height={innerH}
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredIndex(i)}
              />
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip Card */}
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: `${Math.min(Math.max((points[hoveredIndex].x / width) * 100, 15), 85)}%`,
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '10px',
            padding: '10px 16px',
            boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: '180px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
            <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.86rem' }}>{points[hoveredIndex].label}</span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                background: points[hoveredIndex].growthPct >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: points[hoveredIndex].growthPct >= 0 ? '#34d399' : '#f87171',
              }}
            >
              {points[hoveredIndex].growthPct >= 0 ? `+${points[hoveredIndex].growthPct}%` : `${points[hoveredIndex].growthPct}%`}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Revenue:</span>
            <strong style={{ color: COLORS.emerald }}>PKR {points[hoveredIndex].revenue.toLocaleString('en-PK')}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Orders Volume:</span>
            <strong style={{ color: COLORS.cyan }}>{points[hoveredIndex].ordersCount} orders</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Garments Sold:</span>
            <strong style={{ color: '#fff' }}>{points[hoveredIndex].itemsCount} items</strong>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// COMPONENT: INTERACTIVE SVG CATEGORY DONUT CHART
// =====================================================================
function CategoryDonutChart({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data || data.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.84rem' }}>No category data available</div>;
  }

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const size = 200;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', alignItems: 'center', gap: '20px' }}>
      {/* Donut Graphic */}
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, margin: '0 auto' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Base background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />

          {data.map((cat, idx) => {
            const pct = totalRevenue > 0 ? cat.revenue / totalRevenue : 0;
            const strokeDasharray = `${pct * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += pct;
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={cat.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={cat.fill || PIE_COLORS[idx % PIE_COLORS.length]}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{
                  transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                  cursor: 'pointer',
                  opacity: hoveredIdx === null || isHovered ? 1 : 0.45,
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center Metric Text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '10px',
          }}
        >
          <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.04em' }}>
            {hoveredIdx !== null ? data[hoveredIdx]?.name : 'Total Share'}
          </span>
          <span style={{ fontSize: '1rem', fontWeight: 800, color: hoveredIdx !== null ? (data[hoveredIdx]?.fill || COLORS.emerald) : '#fff' }}>
            {hoveredIdx !== null
              ? `PKR ${(data[hoveredIdx]?.revenue / 1000).toFixed(1)}k`
              : `PKR ${(totalRevenue / 1000).toFixed(0)}k`}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>
            {hoveredIdx !== null ? `${data[hoveredIdx]?.sharePct}% share` : `${data.length} Collections`}
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '210px', overflowY: 'auto' }}>
        {data.map((cat, idx) => {
          const isHovered = hoveredIdx === idx;
          const color = cat.fill || PIE_COLORS[idx % PIE_COLORS.length];

          return (
            <div
              key={cat.name}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                padding: '4px 8px',
                borderRadius: '6px',
                background: isHovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ color: '#fff', fontWeight: isHovered ? 700 : 500 }}>{cat.name}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color, fontWeight: 700 }}>{cat.sharePct}%</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginLeft: '6px' }}>
                  ({cat.units} sold)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =====================================================================
// COMPONENT: PIPELINE FULFILLMENT BAR GRAPH
// =====================================================================
function PipelineBarGraph({ data }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '6px' }}>
      {data.map((item, idx) => {
        const isHovered = hoveredIdx === idx;
        const widthPct = Math.max(Math.round((item.count / maxCount) * 100), item.count > 0 ? 6 : 0);

        return (
          <div
            key={item.status}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginBottom: '5px' }}>
              <span style={{ fontWeight: isHovered ? 700 : 600, color: isHovered ? '#fff' : 'var(--text-muted)' }}>
                {item.status}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 800, color: item.color }}>{item.count} orders</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', width: '32px', textAlign: 'right' }}>
                  {item.pct}%
                </span>
              </div>
            </div>

            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${widthPct}%`,
                  height: '100%',
                  background: item.color,
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.5s ease',
                  boxShadow: isHovered ? `0 0 12px ${item.color}` : 'none',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =====================================================================
// MAIN ANALYTICS VIEW
// =====================================================================
export default function Analytics() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('ALL'); // '7D' | '30D' | '90D' | 'YTD' | 'ALL'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [productSearch, setProductSearch] = useState('');
  const [mainChartType, setMainChartType] = useState('AREA'); // 'AREA' | 'BAR' | 'LINE'

  const loadData = async () => {
    try {
      setLoading(true);
      const [ords, prods, cats] = await Promise.all([
        api.getOrders().catch(() => []),
        api.getProducts().catch(() => []),
        api.getCategories(true).catch(() => []),
      ]);
      setOrders(Array.isArray(ords) ? ords : []);
      setProducts(Array.isArray(prods) ? prods : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (err) {
      console.error('Error loading analytics data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // -------------------------------------------------------------
  // TIME RANGE FILTERING
  // -------------------------------------------------------------
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];
    const now = new Date();

    return orders.filter((order) => {
      if (timeRange === 'ALL') return true;
      const orderDate = new Date(order.created_at || order.createdAt);
      if (isNaN(orderDate.getTime())) return true;

      const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);

      if (timeRange === '7D') return diffDays <= 7;
      if (timeRange === '30D') return diffDays <= 30;
      if (timeRange === '90D') return diffDays <= 90;
      if (timeRange === 'YTD') {
        return orderDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [orders, timeRange]);

  // -------------------------------------------------------------
  // EXECUTIVE METRICS & KPIS
  // -------------------------------------------------------------
  const kpis = useMemo(() => {
    let grossSales = 0;
    let netSales = 0;
    let totalDiscount = 0;
    let totalDeliveryFee = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let returnedOrders = 0;

    filteredOrders.forEach((o) => {
      const total = Number(o.total || 0);
      const discount = Number(o.discount_amount || 0);
      const delivery = Number(o.delivery_fee || 0);
      const subtotal = Number(o.subtotal || total + discount - delivery);

      grossSales += subtotal;
      totalDiscount += discount;
      totalDeliveryFee += delivery;

      const status = (o.status || '').toUpperCase();
      if (status === 'DELIVERED') {
        completedOrders += 1;
        netSales += total;
      } else if (status === 'CANCELLED') {
        cancelledOrders += 1;
      } else if (status === 'RETURNED') {
        returnedOrders += 1;
      } else {
        netSales += total;
      }
    });

    const totalOrdersCount = filteredOrders.length;
    const aov = totalOrdersCount > 0 ? grossSales / totalOrdersCount : 0;
    const fulfillmentRate =
      totalOrdersCount > 0
        ? Math.round(((totalOrdersCount - cancelledOrders - returnedOrders) / totalOrdersCount) * 100)
        : 100;

    return {
      grossSales,
      netSales,
      totalDiscount,
      totalDeliveryFee,
      totalOrdersCount,
      completedOrders,
      cancelledOrders,
      returnedOrders,
      aov,
      fulfillmentRate,
    };
  }, [filteredOrders]);

  // -------------------------------------------------------------
  // MONTHLY TRAJECTORY FOR CHARTS
  // -------------------------------------------------------------
  const monthlyTrajectory = useMemo(() => {
    const monthMap = {};

    orders.forEach((o) => {
      const d = new Date(o.created_at || o.createdAt || Date.now());
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      if (!monthMap[key]) {
        monthMap[key] = {
          key,
          label: monthLabel,
          year: d.getFullYear(),
          monthIndex: d.getMonth(),
          revenue: 0,
          ordersCount: 0,
          itemsCount: 0,
        };
      }

      const total = Number(o.total || 0);
      monthMap[key].revenue += total;
      monthMap[key].ordersCount += 1;

      if (Array.isArray(o.items)) {
        monthMap[key].itemsCount += o.items.reduce((s, it) => s + (it.quantity || 1), 0);
      }
    });

    let sortedMonths = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));

    // Calculate Month-over-Month Growth
    sortedMonths = sortedMonths.map((m, idx, arr) => {
      let growthPct = 0;
      if (idx > 0 && arr[idx - 1].revenue > 0) {
        growthPct = (((m.revenue - arr[idx - 1].revenue) / arr[idx - 1].revenue) * 100).toFixed(1);
      }
      return {
        ...m,
        growthPct: Number(growthPct),
      };
    });

    // If less than 4 months exist, smoothly pad past months so graph renders a complete trajectory
    if (sortedMonths.length < 4) {
      const current = new Date();
      const padded = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const existing = sortedMonths.find((m) => m.key === key);
        if (existing) {
          padded.push(existing);
        } else {
          padded.push({
            key,
            label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
            revenue: 0,
            ordersCount: 0,
            itemsCount: 0,
            growthPct: 0,
          });
        }
      }
      return padded;
    }

    return sortedMonths;
  }, [orders]);

  // -------------------------------------------------------------
  // PRODUCT PERFORMANCE MATRIX
  // -------------------------------------------------------------
  const productPerformance = useMemo(() => {
    const prodMap = {};

    products.forEach((p) => {
      prodMap[p.id] = {
        id: p.id,
        name: p.name,
        slug: p.slug,
        category: p.category || 'Uncategorized',
        price: p.min_price || p.regular_price || 0,
        currentStock: p.total_stock || 0,
        imageUrl: p.image_urls?.[0] || null,
        unitsSold: 0,
        grossRevenue: 0,
        ordersCount: 0,
      };
    });

    filteredOrders.forEach((o) => {
      if (!Array.isArray(o.items)) return;
      o.items.forEach((it) => {
        const pId = it.product_id;
        const qty = Number(it.quantity || 1);
        const itemRev = Number(it.total_price || it.unit_price * qty || 0);

        if (!prodMap[pId]) {
          prodMap[pId] = {
            id: pId,
            name: it.name || 'Unknown Product',
            slug: '',
            category: 'Other',
            price: it.unit_price || 0,
            currentStock: 0,
            imageUrl: it.image_url || null,
            unitsSold: 0,
            grossRevenue: 0,
            ordersCount: 0,
          };
        }

        prodMap[pId].unitsSold += qty;
        prodMap[pId].grossRevenue += itemRev;
        prodMap[pId].ordersCount += 1;
      });
    });

    let list = Object.values(prodMap);

    if (selectedCategory !== 'ALL') {
      list = list.filter((p) => p.category.toLowerCase() === selectedCategory.toLowerCase());
    }

    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }

    list.sort((a, b) => b.grossRevenue - a.grossRevenue || b.unitsSold - a.unitsSold);
    return list;
  }, [products, filteredOrders, selectedCategory, productSearch]);

  const topGrossingProducts = useMemo(() => {
    return productPerformance.slice(0, 6);
  }, [productPerformance]);

  // -------------------------------------------------------------
  // CATEGORY REVENUE CONTRIBUTION
  // -------------------------------------------------------------
  const categoryContribution = useMemo(() => {
    const catMap = {};
    let totalRev = 0;

    productPerformance.forEach((p) => {
      const cat = p.category || 'Uncategorized';
      if (!catMap[cat]) {
        catMap[cat] = { name: cat, revenue: 0, units: 0, productsCount: 0 };
      }
      catMap[cat].revenue += p.grossRevenue;
      catMap[cat].units += p.unitsSold;
      catMap[cat].productsCount += 1;
      totalRev += p.grossRevenue;
    });

    const entries = Object.values(catMap).map((c, idx) => ({
      ...c,
      sharePct: totalRev > 0 ? Math.round((c.revenue / totalRev) * 100) : 0,
      fill: PIE_COLORS[idx % PIE_COLORS.length],
    }));

    entries.sort((a, b) => b.revenue - a.revenue);
    return entries;
  }, [productPerformance]);

  // -------------------------------------------------------------
  // ORDER STATUS PIPELINE
  // -------------------------------------------------------------
  const statusPipeline = useMemo(() => {
    const counts = {
      DELIVERED: 0,
      SHIPPED: 0,
      PROCESSING: 0,
      PENDING: 0,
      CANCELLED: 0,
      RETURNED: 0,
    };

    filteredOrders.forEach((o) => {
      const st = (o.status || 'PENDING').toUpperCase();
      if (counts[st] !== undefined) {
        counts[st] += 1;
      } else if (st === 'IN_TRANSIT' || st === 'OUT_FOR_DELIVERY') {
        counts.SHIPPED += 1;
      } else if (st === 'CONFIRMED') {
        counts.PROCESSING += 1;
      } else {
        counts.PENDING += 1;
      }
    });

    const total = filteredOrders.length || 1;

    return [
      { status: 'Delivered', count: counts.DELIVERED, color: COLORS.emerald, pct: Math.round((counts.DELIVERED / total) * 100) },
      { status: 'Shipped / In Transit', count: counts.SHIPPED, color: COLORS.cyan, pct: Math.round((counts.SHIPPED / total) * 100) },
      { status: 'Processing', count: counts.PROCESSING, color: COLORS.indigo, pct: Math.round((counts.PROCESSING / total) * 100) },
      { status: 'Pending Approval', count: counts.PENDING, color: COLORS.amber, pct: Math.round((counts.PENDING / total) * 100) },
      { status: 'Cancelled', count: counts.CANCELLED, color: COLORS.crimson, pct: Math.round((counts.CANCELLED / total) * 100) },
      { status: 'Returns & Exchanges', count: counts.RETURNED, color: COLORS.purple, pct: Math.round((counts.RETURNED / total) * 100) },
    ];
  }, [filteredOrders]);

  // -------------------------------------------------------------
  // PROMO CODE & CAMPAIGN IMPACT
  // -------------------------------------------------------------
  const promoImpact = useMemo(() => {
    const promoMap = {};

    filteredOrders.forEach((o) => {
      if (!o.coupon_code) return;
      const code = o.coupon_code.toUpperCase().trim();
      if (!promoMap[code]) {
        promoMap[code] = { code, timesUsed: 0, totalDiscount: 0, totalSales: 0 };
      }
      promoMap[code].timesUsed += 1;
      promoMap[code].totalDiscount += Number(o.discount_amount || 0);
      promoMap[code].totalSales += Number(o.total || 0);
    });

    return Object.values(promoMap).sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredOrders]);

  // -------------------------------------------------------------
  // EXPORT SALES REPORT (CSV)
  // -------------------------------------------------------------
  const exportSalesReportCsv = () => {
    if (filteredOrders.length === 0) {
      alert('No sales data available to export for this time range.');
      return;
    }

    const headers = [
      'Order Number',
      'Date',
      'Customer ID',
      'Status',
      'Items Count',
      'Subtotal',
      'Discount Applied',
      'Coupon Code',
      'Delivery Fee',
      'Final Total',
      'Currency',
    ];

    const rows = filteredOrders.map((o) => [
      `"${o.order_number || o.id}"`,
      `"${new Date(o.created_at || o.createdAt).toLocaleDateString()}"`,
      `"${o.customer_id || 'Walk-in'}"`,
      `"${o.status || 'PENDING'}"`,
      o.items?.length || 0,
      (o.subtotal || o.total || 0).toFixed(2),
      (o.discount_amount || 0).toFixed(2),
      `"${o.coupon_code || 'NONE'}"`,
      (o.delivery_fee || 0).toFixed(2),
      (o.total || 0).toFixed(2),
      `"${o.currency || 'PKR'}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `boutique_sales_performance_report_${timeRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* ======================================================== */}
      {/* 1. TOP HEADER & DATE RANGE SELECTOR                      */}
      {/* ======================================================== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            <Activity size={16} />
            <span>Executive Business Intelligence &amp; Data Studio</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
            Sales &amp; Performance Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Real-time interactive revenue curves, monthly trajectory benchmarks, category revenue donuts, and stock velocity analytics.
          </p>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Time Range Pills */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)' }}>
            {[
              { id: '7D', label: '7 Days' },
              { id: '30D', label: '30 Days' },
              { id: '90D', label: '90 Days' },
              { id: 'YTD', label: 'YTD' },
              { id: 'ALL', label: 'All Time' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeRange(t.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.78rem',
                  fontWeight: timeRange === t.id ? 700 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: timeRange === t.id ? 'var(--primary)' : 'transparent',
                  color: timeRange === t.id ? '#0f172a' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Export Report */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportSalesReportCsv}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontSize: '0.82rem' }}
            title="Export filtered sales audit log as CSV"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {/* Print Summary */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.82rem' }}
            title="Print Executive Performance Report"
          >
            <Printer size={14} />
          </button>

          {/* Refresh */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadData}
            title="Refresh Real-Time Data"
            style={{ padding: '8px 10px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. TOP EXECUTIVE PERFORMANCE KPIS                        */}
      {/* ======================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* KPI 1: Gross Revenue */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Gross Sales Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <TrendingUp size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>
            PKR {kpis.grossSales.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ArrowUpRight size={13} style={{ color: 'var(--primary)' }} />
            <span>Recorded across {kpis.totalOrdersCount} orders</span>
          </div>
        </div>

        {/* KPI 2: Net Revenue */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Net Realized Revenue
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <DollarSign size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>
            PKR {kpis.netSales.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Excluding cancellations &amp; returns
          </div>
        </div>

        {/* KPI 3: Total Orders */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Orders Placed
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
              <ShoppingCart size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>
            {kpis.totalOrdersCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d4af37', marginTop: '4px', fontWeight: 600 }}>
            {kpis.completedOrders} orders fulfilled &amp; delivered
          </div>
        </div>

        {/* KPI 4: Average Order Value (AOV) */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(129, 140, 248, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Average Order Value (AOV)
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(129, 140, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <BarChart3 size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818cf8' }}>
            PKR {kpis.aov.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Basket spend per customer checkout
          </div>
        </div>

        {/* KPI 5: Order Fulfillment Rate */}
        <div
          className="glass-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(236, 72, 153, 0.2)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Fulfillment Health
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ec4899' }}>
            {kpis.fulfillmentRate}%
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {kpis.cancelledOrders} cancelled • {kpis.returnedOrders} returns
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. PRIMARY INTERACTIVE REVENUE & VOLUME GRAPH            */}
      {/* ======================================================== */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <TrendingUp size={16} />
              <span>Revenue &amp; Volume Trajectory</span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: '4px 0 0 0' }}>
              Monthly Sales Performance Chart
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
              Interactive visual curve comparing realized sales revenue (PKR) and total order volume over time.
            </p>
          </div>

          {/* Chart Type Selector & Legend Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS.emerald }} />
                <span style={{ fontWeight: 600, color: '#fff' }}>Revenue (PKR)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS.cyan }} />
                <span style={{ fontWeight: 600, color: '#fff' }}>Orders Volume</span>
              </div>
            </div>

            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)' }}>
              <button
                type="button"
                onClick={() => setMainChartType('AREA')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  fontSize: '0.76rem',
                  fontWeight: mainChartType === 'AREA' ? 700 : 500,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: mainChartType === 'AREA' ? 'var(--primary)' : 'transparent',
                  color: mainChartType === 'AREA' ? '#0f172a' : 'var(--text-muted)',
                }}
              >
                <Activity size={13} />
                <span>Area Curve</span>
              </button>

              <button
                type="button"
                onClick={() => setMainChartType('BAR')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  fontSize: '0.76rem',
                  fontWeight: mainChartType === 'BAR' ? 700 : 500,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: mainChartType === 'BAR' ? 'var(--primary)' : 'transparent',
                  color: mainChartType === 'BAR' ? '#0f172a' : 'var(--text-muted)',
                }}
              >
                <BarChart3 size={13} />
                <span>Volume Bars</span>
              </button>

              <button
                type="button"
                onClick={() => setMainChartType('LINE')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  fontSize: '0.76rem',
                  fontWeight: mainChartType === 'LINE' ? 700 : 500,
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  background: mainChartType === 'LINE' ? 'var(--primary)' : 'transparent',
                  color: mainChartType === 'LINE' ? '#0f172a' : 'var(--text-muted)',
                }}
              >
                <LineChartIcon size={13} />
                <span>Dual Lines</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Chart Canvas */}
        <InteractiveRevenueChart data={monthlyTrajectory} mode={mainChartType} setMode={setMainChartType} />
      </div>

      {/* ======================================================== */}
      {/* 4. TWO-COLUMN: CATEGORY DONUT & ORDER PIPELINE BAR       */}
      {/* ======================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Chart A: Category Revenue Donut Chart */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#818cf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            <PieChartIcon size={16} />
            <span>Revenue Share Breakdown</span>
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 4px 0' }}>
            Category Contribution Donut
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 16px 0' }}>
            Percentage of total revenue driven by each collection. Hover over slices for details.
          </p>

          <CategoryDonutChart data={categoryContribution} />
        </div>

        {/* Chart B: Order Fulfillment Pipeline Bar Chart */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            <Truck size={16} />
            <span>Operational Fulfillment</span>
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: '0 0 4px 0' }}>
            Order Pipeline Status Graph
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 16px 0' }}>
            Volume distribution of orders across lifecycle fulfillment stages.
          </p>

          <PipelineBarGraph data={statusPipeline} />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. TOP BEST-SELLING PRODUCTS REVENUE RANKING GRAPH       */}
      {/* ======================================================== */}
      {topGrossingProducts.length > 0 && (
        <div className="glass-card" style={{ padding: '24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d4af37', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            <Sparkles size={16} />
            <span>Product Revenue Leaderboard</span>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: '0 0 4px 0' }}>
            Top Grossing Products Comparison Chart
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0 0 18px 0' }}>
            Visual benchmark of highest revenue generating fashion garments in the selected date range.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topGrossingProducts.map((p, idx) => {
              const maxRev = topGrossingProducts[0]?.grossRevenue || 1;
              const barPct = Math.max(Math.round((p.grossRevenue / maxRev) * 100), p.grossRevenue > 0 ? 5 : 0);
              const barColor = idx === 0 ? COLORS.emerald : idx === 1 ? COLORS.cyan : COLORS.gold;

              return (
                <div key={p.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: barColor, width: '20px' }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700, color: '#fff' }}>{p.name}</span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 'var(--radius-full)', color: 'var(--text-dim)' }}>
                        {p.category}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.unitsSold} sold</span>
                      <span style={{ fontWeight: 800, color: barColor }}>PKR {p.grossRevenue.toLocaleString('en-PK')}</span>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${barPct}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MARKETING & PROMO CODE PERFORMANCE                    */}
      {/* ======================================================== */}
      {promoImpact.length > 0 && (
        <div className="glass-card" style={{ padding: '22px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
            <Tag size={16} />
            <span>Marketing Impact</span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', margin: '0 0 16px 0' }}>
            Promotional Voucher Performance
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {promoImpact.map((pr) => (
              <div
                key={pr.code}
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <code style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fbbf24' }}>{pr.code}</code>
                  <span style={{ fontSize: '0.74rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 700 }}>
                    {pr.timesUsed} uses
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Sales Driven:</span>
                  <span style={{ fontWeight: 700, color: '#fff' }}>PKR {pr.totalSales.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>Savings Granted:</span>
                  <span style={{ fontWeight: 600, color: '#f87171' }}>-PKR {pr.totalDiscount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. PRODUCT SALES BREAKDOWN TABLE                         */}
      {/* ======================================================== */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>
              <Package size={16} />
              <span>SKU &amp; Product Velocity</span>
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '4px 0 0 0' }}>
              Product Sales &amp; Stock Velocity Breakdown
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '2px 0 0 0' }}>
              Analyze performance by product, units sold, gross revenue generated, and remaining inventory safety.
            </p>
          </div>

          {/* Table Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Search product..."
                className="chat-input"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.8rem', borderRadius: 'var(--radius-md)' }}
              />
            </div>

            {/* Category Filter */}
            <select
              className="chat-input"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ fontSize: '0.8rem', borderRadius: 'var(--radius-md)', background: '#1e293b' }}
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px' }}>Product</th>
                <th style={{ padding: '12px 16px' }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Units Sold</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Gross Revenue</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Remaining Stock</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Sales Velocity</th>
              </tr>
            </thead>
            <tbody>
              {productPerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No products matching search criteria.
                  </td>
                </tr>
              ) : (
                productPerformance.map((p) => {
                  let velocity = 'Steady ⚡';
                  let velocityColor = '#38bdf8';
                  let velocityBg = 'rgba(56, 189, 248, 0.15)';

                  if (p.unitsSold >= 5) {
                    velocity = 'High Velocity 🔥';
                    velocityColor = '#f59e0b';
                    velocityBg = 'rgba(245, 158, 11, 0.15)';
                  } else if (p.currentStock <= 5 && p.unitsSold > 0) {
                    velocity = 'Low Stock ⚠️';
                    velocityColor = '#ef4444';
                    velocityBg = 'rgba(239, 68, 68, 0.15)';
                  } else if (p.unitsSold === 0) {
                    velocity = 'Zero Sales 💤';
                    velocityColor = 'var(--text-dim)';
                    velocityBg = 'rgba(255,255,255,0.05)';
                  }

                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img
                            src={getProductImageUrl(p.imageUrl)}
                            alt={p.name}
                            style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: '#fff' }}>{p.name}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                              Base Price: PKR {p.price.toLocaleString('en-PK')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {p.category}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#fff' }}>
                        {p.unitsSold}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)' }}>
                        PKR {p.grossRevenue.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: p.currentStock > 0 ? (p.currentStock <= 5 ? '#f59e0b' : '#fff') : '#ef4444' }}>
                          {p.currentStock} units
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: velocityBg,
                            color: velocityColor,
                          }}
                        >
                          {velocity}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
