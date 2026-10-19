import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Sparkles,
  ShieldCheck,
  UserCheck,
  ShoppingBag,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Phone,
  MapPin,
  Building,
  Info,
} from 'lucide-react';
import { api, setAuthSession } from '../api/client';
import { ThemeToggle } from '../context/ThemeContext';

export default function Login({ onLoginSuccess, onBrowseAsCustomer }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;
      if (isRegister) {
        if (!fullName.trim() || !phone.trim() || !streetAddress.trim() || !city.trim() || !email.trim()) {
          throw new Error('Please fill all required profile fields (Full Name, WhatsApp Number, Delivery Address, City, and Email).');
        }
        // Public registration is strictly locked to USER (Customer)
        res = await api.register({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: streetAddress.trim(),
          city: city.trim(),
          role: 'USER',
        });
      } else {
        res = await api.login({ email: email.trim(), password });
      }

      if (isRegister) {
        // Clear any previous customer's chat cache so the new customer gets a fresh AI Stylist conversation
        try {
          localStorage.removeItem('luxe_aria_chat_history_v2');
          localStorage.removeItem('luxe_aria_chat_guest');
          if (res.user_id) {
            localStorage.removeItem(`luxe_aria_chat_user_${res.user_id}`);
          }
        } catch {}

        // Ensure newly registered customer starts connected to AI Stylist (Aria), not live agent
        if (res.phone) {
          api.switchStylistToAi(res.phone).catch(() => {});
        }
      }

      const authenticatedUser = setAuthSession(res);
      if (onLoginSuccess) {
        onLoginSuccess(authenticatedUser);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-top-bar">
        <ThemeToggle />
      </div>
      <div className="login-card-container">
        {/* Header / Brand */}
        <div className="login-header">
          <div className="login-logo-circle">
            <Sparkles size={28} />
          </div>
          <h2 className="login-title">LUXE ATELIER</h2>
          <p className="login-subtitle">
            {isRegister
              ? 'Create Your Customer Shopping Account'
              : 'Unified Portal — Customers, Staff & Administrators'}
          </p>
        </div>

        {/* Quick Demo Credentials Bar (Only in Login mode) */}
        {!isRegister && (
          <div className="demo-credentials-box">
            <div className="demo-header-label">Quick Demo 1-Click Fill:</div>
            <div className="demo-buttons-row">
              <button
                type="button"
                className="btn btn-secondary demo-pill"
                onClick={() => handleQuickLogin('admin@fashionai.com', 'admin123')}
                title="Full management control"
              >
                <ShieldCheck size={14} style={{ color: '#6366f1' }} />
                <span>Admin</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary demo-pill"
                onClick={() => handleQuickLogin('staff@fashionai.com', 'staff123')}
                title="Orders & Live Inbox Agent"
              >
                <UserCheck size={14} style={{ color: '#10b981' }} />
                <span>Staff Agent</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary demo-pill"
                onClick={() => handleQuickLogin('shopper@fashionai.com', 'customer123')}
                title="Storefront customer shopper"
              >
                <ShoppingBag size={14} style={{ color: '#ec4899' }} />
                <span>Customer</span>
              </button>
            </div>
          </div>
        )}

        {/* Staff Notice in Registration Mode */}
        {isRegister && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              color: '#c7d2fe',
              fontSize: '0.8rem',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Info size={16} style={{ flexShrink: 0 }} />
            <span>Staff accounts are created directly by administrators from the Staff Desk console.</span>
          </div>
        )}

        {error && (
          <div className="login-error-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Unified Auth Form */}
        <form onSubmit={handleAuth} className="login-form">
          {isRegister && (
            <>
              <div className="form-group">
                <label className="form-label">
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Sara Ahmed"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  WhatsApp Contact Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="input-with-icon">
                  <Phone size={16} className="input-icon" />
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="+92 300 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Complete Street Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="input-with-icon">
                  <MapPin size={16} className="input-icon" />
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="House 12, Street 4, Sector F-7"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  City <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="input-with-icon">
                  <Building size={16} className="input-icon" />
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Islamabad, Lahore, Karachi"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                required
                className="form-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>{isRegister ? 'Register Customer Account' : 'Sign In to Portal'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Actions */}
        <div className="login-footer">
          <button
            type="button"
            className="text-toggle-btn"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
          >
            {isRegister
              ? 'Already registered? Sign In here'
              : 'New customer? Create an account'}
          </button>

          <div className="customer-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary browse-store-btn"
            onClick={onBrowseAsCustomer}
          >
            <ShoppingBag size={16} />
            <span>Continue Browsing Storefront as Guest</span>
          </button>
        </div>
      </div>
    </div>
  );
}
