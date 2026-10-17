import React, { useEffect, useState } from 'react';
import {
  Users,
  ShoppingBag,
  ShoppingCart,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';

export default function Dashboard({ setActiveTab }) {
  const [stats, setStats] = useState({
    customers: 0,
    products: 0,
    orders: 0,
    conversations: 0,
    revenue: 0,
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [cust, prods, ords, convs] = await Promise.all([
          api.getCustomers().catch(() => []),
          api.getProducts().catch(() => []),
          api.getOrders().catch(() => []),
          api.getConversations().catch(() => []),
        ]);

        const totalRevenue = ords.reduce((sum, o) => sum + (o.total || 0), 0);

        setStats({
          customers: cust.length,
          products: prods.length,
          orders: ords.length,
          conversations: convs.length,
          revenue: totalRevenue,
        });
        setRecentOrders(ords.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div>
      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="glass-card stat-card">
          <div className="stat-info">
            <div className="stat-label">WhatsApp Customers</div>
            <div className="stat-value">{loading ? '...' : stats.customers}</div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Users size={24} />
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-info">
            <div className="stat-label">Active Chats</div>
            <div className="stat-value">{loading ? '...' : stats.conversations}</div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
            <MessageSquare size={24} />
          </div>
        </div>

        <div
          className="glass-card stat-card"
          onClick={() => setActiveTab('products')}
          style={{ cursor: 'pointer' }}
          title="Click to view Products Catalog"
        >
          <div className="stat-info">
            <div className="stat-label">Catalog Products</div>
            <div className="stat-value">{loading ? '...' : stats.products}</div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
            <ShoppingBag size={24} />
          </div>
        </div>

        <div
          className="glass-card stat-card"
          onClick={() => setActiveTab('analytics')}
          style={{ cursor: 'pointer' }}
          title="Click to view Sales & Performance Analytics"
        >
          <div className="stat-info">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">{loading ? '...' : `PKR ${stats.revenue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      {/* Hero Action Card */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)' }}>
            <Sparkles size={18} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Autonomous WhatsApp Stylist
            </span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>
            AI Assistant is active on Meta Cloud API
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Automatically resolving sizing inquiries, catalog recommendations, and order status via MongoDB & NLP.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setActiveTab('inbox')}>
          <span>Open Live Inbox</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Recent Orders Overview */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Recent Customer Orders</h3>
          <button className="btn btn-secondary" onClick={() => setActiveTab('orders')} style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
            View All Orders
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
            No orders placed yet. Orders created via WhatsApp will appear here automatically.
          </div>
        ) : (
          <table className="custom-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Customer ID</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((ord) => (
                <tr key={ord.id}>
                  <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{ord.order_number}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{ord.customer_id.slice(-6)}...</td>
                  <td>{ord.items?.length || 0} item(s)</td>
                  <td style={{ fontWeight: 700 }}>PKR {ord.total?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: ord.status === 'DELIVERED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: ord.status === 'DELIVERED' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {ord.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-dim)' }}>{new Date(ord.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
