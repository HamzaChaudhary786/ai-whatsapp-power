import React, { useEffect, useState } from 'react';
import { RefreshCw, Shield, UserCheck, ExternalLink, LogOut, Menu } from 'lucide-react';
import { api } from '../api/client';
import { ThemeToggle } from '../context/ThemeContext';

export default function Navbar({
  activeTitle,
  user,
  onLogout,
  onSwitchToStorefront,
  onToggleMobileSidebar,
}) {
  const [health, setHealth] = useState({ status: 'connecting', database: 'MongoDB' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = async () => {
    setIsRefreshing(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth({ status: 'offline', database: 'MongoDB' });
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="top-navbar">
      <div className="nav-left">
        {onToggleMobileSidebar && (
          <button
            type="button"
            className="mobile-sidebar-toggle-btn"
            onClick={onToggleMobileSidebar}
            aria-label="Toggle navigation menu"
            title="Open Menu"
          >
            <Menu size={20} />
          </button>
        )}
        <h1 className="nav-title">{activeTitle}</h1>
      </div>

      <div className="nav-right">
        <div className="status-badge">
          <div
            className="pulse-dot"
            style={{
              background: health.status === 'healthy' ? '#10b981' : '#f43f5e',
            }}
          />
          <span>
            API: {health.status === 'healthy' ? 'Online' : 'Offline'} ({health.database})
          </span>
        </div>

        <button
          onClick={checkHealth}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          title="Refresh Backend Status"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          <span>Sync</span>
        </button>

        {user && (
          <div className="nav-user-chip">
            <span className="nav-user-email">{user.email}</span>
            <span className={`role-badge role-${user.role.toLowerCase()}`}>
              {user.role}
            </span>
          </div>
        )}

        <ThemeToggle />

        <button
          onClick={onSwitchToStorefront}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '0.8rem' }}
          title="Switch to Customer Storefront View"
        >
          <ExternalLink size={14} />
          <span>Customer View</span>
        </button>

        {user && (
          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#f43f5e' }}
            title="Log out"
          >
            <LogOut size={14} />
          </button>
        )}
      </div>
    </header>
  );
}
