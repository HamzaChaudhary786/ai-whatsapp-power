import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  UserCheck,
  Trash2,
  CheckCircle,
  AlertCircle,
  Lock,
  Mail,
  Phone,
  User,
  X,
  RefreshCw,
  Search,
} from 'lucide-react';
import { api } from '../api/client';

export default function TeamManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [userToDelete, setUserToDelete] = useState(null);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'STAFF',
    password: '',
  });

  const loadTeam = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!form.fullName.trim() || !form.email.trim() || !form.password.trim()) {
      setErrorMsg('Full Name, Email Address, and Password are required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createStaff({
        email: form.email.trim(),
        full_name: form.fullName.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        password: form.password,
      });

      setSuccessMsg(`Staff account for ${res.full_name} (${res.role}) created successfully!`);
      await loadTeam();
      setTimeout(() => {
        setIsAddModalOpen(false);
        setSuccessMsg('');
        setForm({
          fullName: '',
          email: '',
          phone: '',
          role: 'STAFF',
          password: '',
        });
      }, 1500);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!userId) return;
    try {
      setErrorMsg('');
      await api.deleteUser(userId);
      setSuccessMsg(`Account ${email} deleted successfully.`);
      setUserToDelete(null);
      await loadTeam();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(`Delete failed: ${err.message}`);
      setUserToDelete(null);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      await api.toggleUserStatus(userId, !currentStatus);
      await loadTeam();
    } catch (err) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  // Filter staff vs customer
  const staffAndAdmins = users.filter((u) => u.role === 'ADMIN' || u.role === 'STAFF');
  const filteredTeam = users.filter((u) => {
    const matchRole =
      filterRole === 'ALL'
        ? true
        : filterRole === 'STAFF_ONLY'
        ? u.role === 'STAFF' || u.role === 'ADMIN'
        : u.role === filterRole;

    const matchSearch =
      !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchRole && matchSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={22} style={{ color: 'var(--primary)' }} />
            Staff & Team Management
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Store administrators can onboard new staff agents, assign roles, and manage permissions.
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
          onClick={() => setIsAddModalOpen(true)}
        >
          <UserPlus size={16} />
          <span>Add New Staff Member</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Store Admins</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {users.filter((u) => u.role === 'ADMIN').length}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
            <UserCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Staff Agents</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {users.filter((u) => u.role === 'STAFF').length}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Registered Customers</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {users.filter((u) => u.role === 'USER').length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '340px' }}>
          <div className="input-with-icon" style={{ width: '100%' }}>
            <Search size={16} className="input-icon" />
            <input
              type="text"
              className="form-input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {[
            { id: 'ALL', label: 'All Accounts' },
            { id: 'STAFF_ONLY', label: 'Staff & Admins' },
            { id: 'USER', label: 'Customers Only' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterRole(tab.id)}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                background: filterRole === tab.id ? 'var(--primary)' : 'transparent',
                color: filterRole === tab.id ? '#fff' : 'var(--text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add Staff Member Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Add New Team Member</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Create an authorized Staff or Co-Admin account. Public users cannot self-register as staff.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {errorMsg && (
              <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#6ee7b7', fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
                <div className="input-with-icon">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Ayesha Khan"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                <div className="input-with-icon">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="ayesha@fashionai.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">WhatsApp Contact Number</label>
                <div className="input-with-icon">
                  <Phone size={16} className="input-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="+92 300 9876543"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Assign Role <span style={{ color: '#ef4444' }}>*</span></label>
                <select
                  className="form-input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="STAFF">STAFF Agent (Live WhatsApp Inbox & Orders)</option>
                  <option value="ADMIN">ADMIN (Full Boutique & Console Control)</option>
                </select>
              </div>

              <div>
                <label className="form-label">Assigned Password <span style={{ color: '#ef4444' }}>*</span></label>
                <div className="input-with-icon">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    required
                    className="form-input"
                    placeholder="Set secure password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creating Staff Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Member Details</th>
              <th>Assigned Role</th>
              <th>WhatsApp Phone</th>
              <th>Status</th>
              <th>Joined Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeam.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No accounts found matching your filter criteria.
                </td>
              </tr>
            ) : (
              filteredTeam.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                      {u.full_name || u.email.split('@')[0]}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background:
                          u.role === 'ADMIN'
                            ? 'rgba(99, 102, 241, 0.2)'
                            : u.role === 'STAFF'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(236, 72, 153, 0.2)',
                        color:
                          u.role === 'ADMIN'
                            ? '#a5b4fc'
                            : u.role === 'STAFF'
                            ? '#6ee7b7'
                            : '#f472b6',
                        border:
                          u.role === 'ADMIN'
                            ? '1px solid rgba(99, 102, 241, 0.3)'
                            : u.role === 'STAFF'
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(236, 72, 153, 0.3)',
                      }}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: u.phone ? '#cbd5e1' : 'var(--text-dim)' }}>
                      {u.phone || 'Not provided'}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        background: u.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: u.is_active ? '#10b981' : '#f87171',
                      }}
                    >
                      {u.is_active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => handleToggleStatus(u.id, u.is_active)}
                        title={u.is_active ? 'Suspend account' : 'Activate account'}
                      >
                        {u.is_active ? 'Suspend' : 'Activate'}
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                        onClick={() => setUserToDelete(u)}
                        title="Delete user account"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Delete Account Confirmation Modal */}
      {userToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content-card" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>Delete Account</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>This action cannot be undone.</p>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to permanently delete account <strong style={{ color: '#fff' }}>"{userToDelete.email}"</strong> ({userToDelete.full_name || userToDelete.role})?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUserToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleDeleteUser(userToDelete.id || userToDelete._id, userToDelete.email)}
              >
                <Trash2 size={14} />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
