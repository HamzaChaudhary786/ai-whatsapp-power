import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  ShoppingCart,
  BookOpen,
  Cpu,
  Sparkles,
  LogOut,
  ExternalLink,
  Shield,
  User,
  Megaphone,
  Users,
  Layers,
  TrendingUp,
  X,
} from 'lucide-react';
import { ThemeToggle } from '../context/ThemeContext';

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onSwitchToStorefront,
  isMobileOpen,
  onCloseMobile,
}) {
  const isAdmin = user?.role === 'ADMIN';
  const isStaff = user?.role === 'STAFF';

  const menuItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'inbox', label: 'Live WhatsApp Inbox', icon: MessageSquare, badge: 'Live' },
    { id: 'products', label: 'Products', icon: ShoppingBag },
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'orders', label: 'Orders & Fulfillment', icon: ShoppingCart },
    { id: 'analytics', label: 'Sales & Analytics', icon: TrendingUp },
    { id: 'campaigns', label: 'Sale Broadcasts', icon: Megaphone },
    { id: 'knowledge', label: 'Knowledge Base (FAQs)', icon: BookOpen },
    // ADMIN only tools
    ...(isAdmin ? [{ id: 'team', label: 'Staff & Team', icon: Users }] : []),
    ...(isAdmin ? [{ id: 'ml', label: 'ML Model Registry', icon: Cpu }] : []),
  ];

  return (
    <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Brand Section */}
      <div className="brand-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <div className="brand-logo-icon">
            <Sparkles size={22} />
          </div>
          <div>
            <div className="brand-name">FASHION AI</div>
            <div className="brand-sub">Admin & Staff Console</div>
          </div>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            className="sidebar-mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <ul className="nav-links">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'products' && activeTab === 'catalog');
          return (
            <li key={item.id}>
              <div
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
              >
                <Icon size={18} className="nav-icon" />
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: 'var(--primary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 700,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sidebar Footer with Role Info & Storefront Toggle */}
      <div className="sidebar-footer-box">
        <button
          type="button"
          className="btn btn-secondary switch-storefront-btn"
          onClick={onSwitchToStorefront}
          title="Preview public boutique storefront"
        >
          <ExternalLink size={14} />
          <span>View Customer Store</span>
        </button>

        <div style={{ margin: '8px 0' }}>
          <ThemeToggle className="sidebar-theme-toggle" />
        </div>

        {user && (
          <div className="user-profile-widget">
            <div className="user-avatar-badge">
              {isAdmin ? <Shield size={16} /> : <User size={16} />}
            </div>
            <div className="user-details-text">
              <div className="user-email-truncate">{user.email}</div>
              <div className="user-role-pill">{user.role}</div>
            </div>
            <button
              onClick={onLogout}
              className="logout-icon-btn"
              title="Sign out of portal"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
