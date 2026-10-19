import React, { useEffect, useState } from 'react';
import { BookOpen, Search, Plus, Sparkles } from 'lucide-react';
import { api } from '../api/client';

export default function KnowledgeBase() {
  const [faqs, setFaqs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFaq, setNewFaq] = useState({ title: '', topic: 'shipping', approved_content: '', language: 'en' });

  const loadFaqs = async () => {
    try {
      const data = await api.getFaqs();
      setFaqs(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadFaqs();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const results = await api.searchFaqs(searchQuery.trim());
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFaq = async (e) => {
    e.preventDefault();
    try {
      await api.createFaq(newFaq);
      setShowAddModal(false);
      setNewFaq({ title: '', topic: 'shipping', approved_content: '', language: 'en' });
      await loadFaqs();
    } catch (err) {
      alert(`Error creating FAQ: ${err.message}`);
    }
  };

  const displayList = searchResults !== null ? searchResults : faqs;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>AI Knowledge Base & FAQs</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Approved policy answers retrieved by the assistant when customers ask policy & shipping questions
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} />
          <span>Add FAQ Entry</span>
        </button>
      </div>

      {/* RAG Search Tester Sandbox */}
      <div className="glass-card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.08) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-indigo)' }}>
          <Sparkles size={16} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Live RAG Query Sandbox</span>
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="chat-input"
            style={{ borderRadius: 'var(--radius-md)' }}
            placeholder="Type customer question to test full-text RAG matching (e.g. Can I return unworn dresses?)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            <Search size={16} />
            <span>Search</span>
          </button>
          {searchResults !== null && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearchQuery('');
                setSearchResults(null);
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* FAQ Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {displayList.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
            <BookOpen size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <h3>No FAQ Documents Found</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Add FAQs so the AI assistant can answer policy questions.</p>
          </div>
        ) : (
          displayList.map((f) => (
            <div key={f.id} className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#a5b4fc',
                  }}
                >
                  {f.topic}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{f.language?.toUpperCase()}</span>
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>{f.title}</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.approved_content}</p>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '520px', maxWidth: '90vw' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px' }}>Add FAQ Knowledge Base Entry</h3>
            <form onSubmit={handleCreateFaq}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Question / Title</label>
                <input
                  type="text"
                  required
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  placeholder="e.g. What is your dress return policy?"
                  value={newFaq.title}
                  onChange={(e) => setNewFaq({ ...newFaq, title: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Topic Category</label>
                  <select
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)', background: '#1e293b' }}
                    value={newFaq.topic}
                    onChange={(e) => setNewFaq({ ...newFaq, topic: e.target.value })}
                  >
                    <option value="returns">Returns & Refunds</option>
                    <option value="shipping">Shipping & Delivery</option>
                    <option value="sizes">Sizes & Sizing Guide</option>
                    <option value="payment">Payment Methods</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Language</label>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={newFaq.language}
                    onChange={(e) => setNewFaq({ ...newFaq, language: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Approved Answer Content</label>
                <textarea
                  required
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '90px', resize: 'none' }}
                  placeholder="Official answer that the AI assistant will deliver to customers..."
                  value={newFaq.approved_content}
                  onChange={(e) => setNewFaq({ ...newFaq, approved_content: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save FAQ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
