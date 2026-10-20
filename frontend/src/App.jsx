import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  Layers,
  ShoppingCart,
  Menu,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import LiveInbox from './pages/LiveInbox';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Analytics from './pages/Analytics';
import Catalog from './pages/Catalog';
import Orders from './pages/Orders';
import KnowledgeBase from './pages/KnowledgeBase';
import ModelRegistry from './pages/ModelRegistry';
import Login from './pages/Login';
import CustomerStorefront from './pages/CustomerStorefront';
import Campaigns from './pages/Campaigns';
import TeamManagement from './pages/TeamManagement';
import { getCurrentUser, clearAuthSession } from './api/client';

const tabTitles = {
  dashboard: 'Executive Overview',
  inbox: 'Live WhatsApp Customer Conversations',
  products: 'Fashion Products & Multi-Variant Inventory',
  categories: 'Boutique Categories & Taxonomy Architecture',
  orders: 'Order Processing & Tracking',
  analytics: 'Sales Performance & Revenue Analytics',
  campaigns: 'Promotions, Sale Offers & Multi-Channel Broadcasts',
  team: 'Staff & Team Management',
  knowledge: 'AI Knowledge Base (FAQs & Policies)',
  ml: 'Machine Learning Model Registry',
  catalog: 'Fashion Products & Multi-Variant Inventory',
};

export default function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [viewMode, setViewMode] = useState(() => {
    // If the visitor followed a direct product link or storefront query, prioritize STOREFRONT view
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const search = window.location.search;
      const hasProductIntent = Boolean(
        (path && path !== 'console' && path !== 'admin' && path !== 'login') ||
        search.includes('product=') ||
        search.includes('id=')
      );
      if (hasProductIntent) {
        return 'STOREFRONT';
      }
    }

    const current = getCurrentUser();
    if (current && (current.role === 'ADMIN' || current.role === 'STAFF')) {
      return 'CONSOLE';
    }
    return 'STOREFRONT';
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileInboxChatActive, setIsMobileInboxChatActive] = useState(false);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setIsMobileInboxChatActive(false);
  };

  const handleLoginSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    if (authenticatedUser.role === 'ADMIN' || authenticatedUser.role === 'STAFF') {
      setViewMode('CONSOLE');
    } else {
      setViewMode('STOREFRONT');
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setViewMode('LOGIN');
  };

  // View: Login Page
  if (viewMode === 'LOGIN') {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onBrowseAsCustomer={() => setViewMode('STOREFRONT')}
      />
    );
  }

  // View: Customer Storefront
  if (viewMode === 'STOREFRONT') {
    return (
      <CustomerStorefront
        user={user}
        onLogout={handleLogout}
        onStaffLoginClick={() => {
          if (user && (user.role === 'ADMIN' || user.role === 'STAFF')) {
            setViewMode('CONSOLE');
          } else {
            setViewMode('LOGIN');
          }
        }}
      />
    );
  }

  // View: Admin & Staff Management Console
  const renderConsoleContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={handleTabChange} user={user} />;
      case 'inbox':
        return (
          <LiveInbox
            user={user}
            onActiveConvChange={(isActive) => setIsMobileInboxChatActive(Boolean(isActive))}
          />
        );
      case 'products':
        return <Products user={user} onNavigateToCategories={() => handleTabChange('categories')} />;
      case 'categories':
        return <Categories user={user} onNavigateToProducts={() => handleTabChange('products')} />;
      case 'orders':
        return <Orders user={user} />;
      case 'analytics':
        return <Analytics user={user} />;
      case 'catalog':
        return <Products user={user} onNavigateToCategories={() => handleTabChange('categories')} />;
      case 'campaigns':
        return <Campaigns user={user} />;
      case 'team':
        return user?.role === 'ADMIN' ? (
          <TeamManagement currentUser={user} />
        ) : (
          <div className="glass-card" style={{ padding: '36px', textAlign: 'center' }}>
            <h3>Access Restricted</h3>
            <p style={{ color: 'var(--text-muted)' }}>Staff management is restricted to Store Administrators.</p>
          </div>
        );
      case 'knowledge':
        return <KnowledgeBase user={user} />;
      case 'ml':
        return user?.role === 'ADMIN' ? (
          <ModelRegistry user={user} />
        ) : (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
            <h3>Access Restricted</h3>
            <p style={{ color: 'var(--text-muted)' }}>
              Machine Learning Model retraining is restricted to ADMIN users.
            </p>
          </div>
        );
      default:
        return <Dashboard setActiveTab={setActiveTab} user={user} />;
    }
  };

  return (
    <div
      className={`app-container ${
        activeTab === 'inbox' && isMobileInboxChatActive ? 'inbox-chat-active-mode' : ''
      }`}
    >
      {isMobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        user={user}
        onLogout={handleLogout}
        onSwitchToStorefront={() => setViewMode('STOREFRONT')}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />
      <div className="main-content">
        <Navbar
          activeTitle={tabTitles[activeTab] || 'Management Portal'}
          user={user}
          onLogout={handleLogout}
          onSwitchToStorefront={() => setViewMode('STOREFRONT')}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />
        <main
          className={`content-body ${activeTab === 'inbox' ? 'content-body-inbox' : ''} ${
            activeTab === 'inbox' && isMobileInboxChatActive ? 'content-body-inbox-fullscreen' : ''
          }`}
        >
          {renderConsoleContent()}
        </main>
      </div>

      {/* Console Mobile Bottom Navigation Bar */}
      <nav
        className={`console-mobile-bottom-nav ${
          activeTab === 'inbox' && isMobileInboxChatActive ? 'console-nav-hidden' : ''
        }`}
      >
        <button
          type="button"
          className={`console-mobile-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`console-mobile-nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
          onClick={() => handleTabChange('inbox')}
        >
          <div className="console-nav-badge-wrap">
            <MessageSquare size={18} />
            <span className="console-live-dot" />
          </div>
          <span>Inbox</span>
        </button>

        <button
          type="button"
          className={`console-mobile-nav-item ${
            activeTab === 'products' || activeTab === 'catalog' ? 'active' : ''
          }`}
          onClick={() => handleTabChange('products')}
        >
          <ShoppingBag size={18} />
          <span>Products</span>
        </button>

        <button
          type="button"
          className={`console-mobile-nav-item ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => handleTabChange('categories')}
        >
          <Layers size={18} />
          <span>Categories</span>
        </button>

        <button
          type="button"
          className={`console-mobile-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => handleTabChange('orders')}
        >
          <ShoppingCart size={18} />
          <span>Orders</span>
        </button>

        <button
          type="button"
          className="console-mobile-nav-item console-nav-more"
          onClick={() => setIsMobileSidebarOpen(true)}
          title="Open complete navigation drawer"
        >
          <Menu size={18} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
