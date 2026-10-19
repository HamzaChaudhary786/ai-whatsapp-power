import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShoppingBag,
  RefreshCw,
  X,
  Check,
  FileSpreadsheet,
  Eye,
  EyeOff,
  FolderPlus,
  HelpCircle,
  ArrowUpDown,
} from 'lucide-react';
import { api } from '../api/client';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE' | 'EMPTY' | 'POPULATED'
  const [sortBy, setSortBy] = useState('order'); // 'order' | 'name' | 'products_desc' | 'products_asc'

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  // Forms
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    name: '',
    slug: '',
    description: '',
    image_url: '',
    icon: 'Sparkles',
    display_order: 1,
    is_active: true,
  });

  // Bulk CSV Upload State
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState([]);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  const showNotification = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await api.getCategories(true); // include inactive categories for admin management
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      showNotification(`Failed to load categories: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // -----------------------------------------------------------------
  // KPI ANALYTICS CALCS
  // -----------------------------------------------------------------
  const totalCategories = categories.length;
  const activeCategoriesCount = categories.filter((c) => c.is_active !== false).length;
  const totalAssignedProducts = categories.reduce((sum, c) => sum + (c.product_count || 0), 0);
  const avgProductsPerCategory = totalCategories > 0 ? (totalAssignedProducts / totalCategories).toFixed(1) : 0;
  const emptyCategoriesCount = categories.filter((c) => !c.product_count || c.product_count === 0).length;
  const topCategory = [...categories].sort((a, b) => (b.product_count || 0) - (a.product_count || 0))[0];

  // -----------------------------------------------------------------
  // FILTERING & SORTING
  // -----------------------------------------------------------------
  const filteredCategories = categories.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.slug && c.slug.toLowerCase().includes(q)) || (c.description && c.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') return c.is_active !== false;
    if (statusFilter === 'INACTIVE') return c.is_active === false;
    if (statusFilter === 'EMPTY') return !c.product_count || c.product_count === 0;
    if (statusFilter === 'POPULATED') return (c.product_count || 0) > 0;
    return true;
  });

  filteredCategories.sort((a, b) => {
    if (sortBy === 'order') return (a.display_order || 0) - (b.display_order || 0);
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'products_desc') return (b.product_count || 0) - (a.product_count || 0);
    if (sortBy === 'products_asc') return (a.product_count || 0) - (b.product_count || 0);
    return 0;
  });

  // -----------------------------------------------------------------
  // CREATE / EDIT / DELETE ACTIONS
  // -----------------------------------------------------------------
  const handleOpenAddModal = () => {
    setCategoryForm({
      id: '',
      name: '',
      slug: '',
      description: '',
      image_url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80',
      icon: 'Sparkles',
      display_order: categories.length + 1,
      is_active: true,
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (cat) => {
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      slug: cat.slug || '',
      description: cat.description || '',
      image_url: cat.image_url || '',
      icon: cat.icon || 'Sparkles',
      display_order: cat.display_order ?? 1,
      is_active: cat.is_active !== false,
    });
    setShowEditModal(true);
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      showNotification('Category name is required', 'error');
      return;
    }
    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        image_url: categoryForm.image_url.trim() || 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
        icon: categoryForm.icon || 'Sparkles',
        display_order: parseInt(categoryForm.display_order, 10) || 1,
        is_active: categoryForm.is_active,
      };
      if (categoryForm.slug.trim()) {
        payload.slug = categoryForm.slug.trim();
      }
      const created = await api.createCategory(payload);
      showNotification(`Category "${created.name}" created successfully!`);
      setShowAddModal(false);
      await loadCategories();
    } catch (err) {
      showNotification(`Failed to create category: ${err.message}`, 'error');
    }
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.id) return;
    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        image_url: categoryForm.image_url.trim(),
        icon: categoryForm.icon || 'Sparkles',
        display_order: parseInt(categoryForm.display_order, 10) || 1,
        is_active: categoryForm.is_active,
      };
      await api.updateCategory(categoryForm.id, payload);
      showNotification(`Category updated! Any associated products were synchronized.`);
      setShowEditModal(false);
      await loadCategories();
    } catch (err) {
      showNotification(`Failed to update category: ${err.message}`, 'error');
    }
  };

  const handleToggleCategoryActive = async (cat) => {
    try {
      const updatedStatus = !cat.is_active;
      await api.updateCategory(cat.id, { is_active: updatedStatus });
      showNotification(`Category "${cat.name}" is now ${updatedStatus ? 'Active' : 'Hidden / Inactive'}`);
      await loadCategories();
    } catch (err) {
      showNotification(`Failed to toggle status: ${err.message}`, 'error');
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      await api.deleteCategory(categoryToDelete.id);
      showNotification(`Category "${categoryToDelete.name}" was permanently removed.`);
      setCategoryToDelete(null);
      await loadCategories();
    } catch (err) {
      showNotification(`Cannot delete: ${err.message}`, 'error');
    }
  };

  // -----------------------------------------------------------------
  // BULK CSV HANDLERS
  // -----------------------------------------------------------------
  const downloadSampleTemplate = () => {
    const csvContent =
      'Category Name,Slug,Description,Image URL,Icon,Display Order,Is Active\n' +
      'Dresses,dresses,Pure mulberry silk elegant evening gown,https://images.unsplash.com/photo-1572804013309-59a88b7e92f1,Sparkles,1,True\n' +
      'Evening Wear,evening-wear,Couture formal evening dresses and gowns,https://images.unsplash.com/photo-1566174053879-31528523f8ae,Sparkles,2,True\n' +
      'Linen Collection,linen-collection,Breathable pure organic European linen sets,https://images.unsplash.com/photo-1594633312681-425c7b97ccd1,Sparkles,3,True\n' +
      'Resort Wear,resort-wear,Lightweight bohemian vacation luxury wear,https://images.unsplash.com/photo-1515372039744-b8f02a3ae446,Sparkles,4,True\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fashion_categories_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvRow = (text) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const handleCsvFileSelection = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const cleanText = (evt.target.result || '').replace(/^\ufeff/, '');
      const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 1) {
        const preview = lines.slice(1, 6).map((line, idx) => {
          const cols = parseCsvRow(line);
          return {
            id: idx,
            name: cols[0]?.trim() || 'Untitled',
            slug: cols[1]?.trim() || '',
            description: cols[2]?.trim() || '',
            order: cols[5]?.trim() || '1',
          };
        });
        setCsvPreviewRows(preview);
      }
    };
    reader.readAsText(file);
  };

  const executeBulkCsvImport = async () => {
    if (!csvFile) {
      showNotification('Please select a valid CSV file first', 'error');
      return;
    }
    setIsUploadingCsv(true);
    try {
      const res = await api.bulkImportCategoriesCsv(csvFile);
      const added = res.imported_count ?? res.imported_categories ?? 0;
      const updated = res.updated_categories ?? 0;
      if (added === 0 && updated === 0) {
        showNotification(
          res.errors?.length ? `Import error: ${res.errors.join(', ')}` : 'No category rows could be imported from CSV.',
          'error'
        );
      } else {
        showNotification(`Bulk import complete! Added ${added} new categories, updated ${updated} existing.`);
      }
      setShowBulkImportModal(false);
      setCsvFile(null);
      setCsvPreviewRows([]);
      await loadCategories();
    } catch (err) {
      showNotification(`Bulk import failed: ${err.message}`, 'error');
    } finally {
      setIsUploadingCsv(false);
    }
  };

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderRadius: 'var(--radius-lg)',
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
            animation: 'slideIn 0.3s ease-out',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TOP HEADER & BREADCRUMB                               */}
      {/* ======================================================== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
            <Layers size={15} />
            <span>Catalog Taxonomy Architecture</span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
            Categories Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
            Structure your boutique collections, manage AI recommendation taxonomies, and bulk import/export fashion lines.
          </p>
        </div>

        {/* Global Action Bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px' }}
            onClick={() => window.open(api.getExportCategoriesCsvUrl(), '_blank')}
            title="Download complete taxonomy as CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px' }}
            onClick={() => setShowBulkImportModal(true)}
            title="Ingest bulk categories via spreadsheet"
          >
            <FileSpreadsheet size={15} />
            <span>Bulk CSV Import</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 700 }}
            onClick={handleOpenAddModal}
          >
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. CATEGORIES ANALYTICS KPIS                             */}
      {/* ======================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {/* KPI 1: Total Categories */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Categories
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <Layers size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#fff' }}>{totalCategories}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Taxonomy classification groups
          </div>
        </div>

        {/* KPI 2: Active Categories */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active In Storefront
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary)' }}>{activeCategoriesCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {totalCategories > 0 ? `${Math.round((activeCategoriesCount / totalCategories) * 100)}% published to boutique` : '0%'}
          </div>
        </div>

        {/* KPI 3: Total Products Assigned */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Assigned Products
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <ShoppingBag size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#38bdf8' }}>{totalAssignedProducts}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            Avg {avgProductsPerCategory} items per category
          </div>
        </div>

        {/* KPI 4: Top Leading Category */}
        <div
          className="glass-card"
          style={{
            padding: '18px 20px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Top Collection
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
              <Sparkles size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {topCategory?.name || 'N/A'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#d4af37', marginTop: '4px', fontWeight: 600 }}>
            {topCategory ? `${topCategory.product_count || 0} Products Cataloged` : 'No products'}
          </div>
        </div>

        {/* KPI 5: Empty Categories Alert */}
        <div
          className="glass-card"
          onClick={() => setStatusFilter(statusFilter === 'EMPTY' ? 'ALL' : 'EMPTY')}
          style={{
            padding: '18px 20px',
            background: emptyCategoriesCount > 0 ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: emptyCategoriesCount > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(255,255,255,0.08)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
          title="Click to toggle filter for empty categories"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: emptyCategoriesCount > 0 ? '#fbbf24' : 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Empty Categories
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: emptyCategoriesCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: emptyCategoriesCount > 0 ? '#fbbf24' : 'var(--text-dim)' }}>
              <AlertCircle size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.9rem', fontWeight: 800, color: emptyCategoriesCount > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
            {emptyCategoriesCount}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            {emptyCategoriesCount > 0 ? 'Click to inspect empty slots' : 'All categories have products'}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. FILTER, SEARCH & SORT CONTROLS                        */}
      {/* ======================================================== */}
      <div
        className="glass-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '14px 20px',
          marginBottom: '24px',
        }}
      >
        {/* Left: Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '280px', flex: 1 }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search category name, slug, description..."
              className="chat-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '38px', borderRadius: 'var(--radius-md)' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Center: Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${categories.length})` },
            { id: 'ACTIVE', label: `Active (${activeCategoriesCount})` },
            { id: 'INACTIVE', label: `Hidden (${totalCategories - activeCategoriesCount})` },
            { id: 'POPULATED', label: `With Products (${totalCategories - emptyCategoriesCount})` },
            { id: 'EMPTY', label: `Empty (${emptyCategoriesCount})` },
          ].map((pill) => {
            const active = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  border: active ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                  background: active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                  color: active ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Right: Sort & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <ArrowUpDown size={14} />
            <select
              className="chat-input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: 'var(--radius-md)', background: '#1e293b' }}
            >
              <option value="order">Display Order (Asc)</option>
              <option value="name">Name (A-Z)</option>
              <option value="products_desc">Products Count (High → Low)</option>
              <option value="products_asc">Products Count (Low → High)</option>
            </select>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadCategories}
            title="Refresh Categories"
            style={{ padding: '8px 10px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. CATEGORIES GRID CARDS                                 */}
      {/* ======================================================== */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ marginRight: '10px' }} />
          <span>Loading catalog taxonomy...</span>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', marginBottom: '16px' }}>
            <Layers size={28} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
            No Categories Found
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '420px', marginBottom: '20px' }}>
            {searchQuery
              ? `No category matches your search "${searchQuery}". Clear query or try different terms.`
              : 'Start organizing your fashion lines by creating categories or importing bulk spreadsheets.'}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            {searchQuery && (
              <button type="button" className="btn btn-secondary" onClick={() => setSearchQuery('')}>
                Clear Search
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={handleOpenAddModal}>
              <Plus size={16} />
              <span>Create Category</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredCategories.map((cat) => {
            const isActive = cat.is_active !== false;
            const productCount = cat.product_count || 0;

            return (
              <div
                key={cat.id || cat.slug}
                className="glass-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  padding: 0,
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(239, 68, 68, 0.25)',
                  opacity: isActive ? 1 : 0.75,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                {/* Card Header Image Banner */}
                <div style={{ position: 'relative', width: '100%', height: '150px', background: '#0f172a' }}>
                  <img
                    src={cat.image_url || 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80'}
                    alt={cat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.2) 60%, rgba(0,0,0,0.4) 100%)',
                    }}
                  />

                  {/* Top Badges */}
                  <div style={{ position: 'absolute', top: '10px', left: '12px', display: 'flex', gap: '6px' }}>
                    <span
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(6px)',
                        color: 'var(--primary)',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid rgba(212, 175, 55, 0.3)',
                      }}
                    >
                      Order #{cat.display_order ?? 1}
                    </span>
                  </div>

                  <div style={{ position: 'absolute', top: '10px', right: '12px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleCategoryActive(cat)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: isActive ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.3)',
                        backdropFilter: 'blur(6px)',
                        color: isActive ? '#34d399' : '#f87171',
                        border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        cursor: 'pointer',
                      }}
                      title={isActive ? 'Click to hide category from storefront' : 'Click to make category active'}
                    >
                      {isActive ? <Eye size={11} /> : <EyeOff size={11} />}
                      <span>{isActive ? 'Active' : 'Hidden'}</span>
                    </button>
                  </div>

                  {/* Title & Product Count Overlay */}
                  <div style={{ position: 'absolute', bottom: '12px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                        {cat.name}
                      </h3>
                      <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>
                        slug: /{cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        background: productCount > 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                        backdropFilter: 'blur(6px)',
                        color: productCount > 0 ? '#38bdf8' : '#fbbf24',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700,
                        border: productCount > 0 ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      {productCount} {productCount === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <p
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                      lineHeight: 1.45,
                      marginBottom: '16px',
                      flex: 1,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {cat.description || 'Boutique handcrafted category for curated collections and AI stylist recommendations.'}
                  </p>

                  {/* Card Actions Footer */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      paddingTop: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        Icon: <code>{cat.icon || 'Sparkles'}</code>
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => handleOpenEditModal(cat)}
                        title="Edit Category Properties"
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                        onClick={() => setCategoryToDelete(cat)}
                        title="Delete Category"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD CATEGORY                                    */}
      {/* ======================================================== */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 900,
            padding: '20px',
          }}
        >
          <div className="glass-card" style={{ width: '520px', maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(212, 175, 55, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4af37' }}>
                  <FolderPlus size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Create New Category</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                    Add a fashion category to organize catalog products
                  </p>
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  placeholder="e.g. Formal Gowns & Sarees"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Custom Slug (Optional)
                  </label>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    placeholder="auto-generated from name"
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Display Order (1 = Top)
                  </label>
                  <input
                    type="number"
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={categoryForm.display_order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, display_order: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Description (Stylist & SEO Guidance)
                </label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '70px', resize: 'none' }}
                  placeholder="Describe this collection's fabric, silhouette, or occasion..."
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Cover Image URL
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  placeholder="https://images.unsplash.com/..."
                  value={categoryForm.image_url}
                  onChange={(e) => setCategoryForm({ ...categoryForm, image_url: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                <input
                  type="checkbox"
                  id="addCatActive"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="addCatActive" style={{ fontSize: '0.84rem', color: '#fff', cursor: 'pointer', userSelect: 'none' }}>
                  Publish &amp; make visible in Customer Boutique Storefront immediately
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '9px 20px', fontWeight: 700 }}>
                  <Check size={16} />
                  <span>Create Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT CATEGORY                                   */}
      {/* ======================================================== */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 900,
            padding: '20px',
          }}
        >
          <div className="glass-card" style={{ width: '520px', maxWidth: '92vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Edit Category</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: 0 }}>
                    Updates will automatically cascade to associated products in MongoDB
                  </p>
                </div>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowEditModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateCategory}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Slug (Read-Only)
                  </label>
                  <input
                    type="text"
                    disabled
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)', opacity: 0.6, cursor: 'not-allowed' }}
                    value={categoryForm.slug}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Display Order
                  </label>
                  <input
                    type="number"
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={categoryForm.display_order}
                    onChange={(e) => setCategoryForm({ ...categoryForm, display_order: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '70px', resize: 'none' }}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Cover Image URL
                </label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={categoryForm.image_url}
                  onChange={(e) => setCategoryForm({ ...categoryForm, image_url: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)' }}>
                <input
                  type="checkbox"
                  id="editCatActive"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <label htmlFor="editCatActive" style={{ fontSize: '0.84rem', color: '#fff', cursor: 'pointer', userSelect: 'none' }}>
                  Category is Active &amp; Visible in Storefront
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '9px 20px', fontWeight: 700 }}>
                  <Check size={16} />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: BULK IMPORT CATEGORIES (CSV)                    */}
      {/* ======================================================== */}
      {showBulkImportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 900,
            padding: '20px',
          }}
        >
          <div className="glass-card" style={{ width: '640px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Bulk Categories CSV Import</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0 0' }}>
                  Upload a spreadsheet containing multiple fashion categories and taxonomies at once.
                </p>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => {
                  setShowBulkImportModal(false);
                  setCsvFile(null);
                  setCsvPreviewRows([]);
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Download Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '18px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileSpreadsheet size={16} />
                  <span>Category-Only CSV Format</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Clean columns: Category Name, Slug, Description, Image URL, Icon, Display Order, Is Active
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                onClick={downloadSampleTemplate}
              >
                <Download size={13} style={{ marginRight: '6px' }} />
                <span>Sample CSV</span>
              </button>
            </div>

            {/* File Dropzone */}
            <div
              style={{
                border: '2px dashed var(--border-glass)',
                borderRadius: 'var(--radius-lg)',
                padding: '30px 20px',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.02)',
                marginBottom: '20px',
                position: 'relative',
              }}
            >
              <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '10px' }} />
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                {csvFile ? csvFile.name : 'Select or drop your Categories CSV file'}
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Supports standard comma-separated .csv files
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileSelection}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%',
                }}
              />
              <button type="button" className="btn btn-secondary" style={{ pointerEvents: 'none', padding: '6px 16px' }}>
                Browse Files
              </button>
            </div>

            {/* CSV Preview */}
            {csvPreviewRows.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                  File Preview (First {csvPreviewRows.length} Rows):
                </div>
                <div style={{ border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Name</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Slug</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center' }}>Order</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreviewRows.map((r) => (
                        <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#fff' }}>{r.name}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{r.slug || '-'}</td>
                          <td style={{ padding: '8px 10px', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || '-'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--primary)', fontWeight: 700 }}>{r.order}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowBulkImportModal(false);
                  setCsvFile(null);
                  setCsvPreviewRows([]);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!csvFile || isUploadingCsv}
                onClick={executeBulkCsvImport}
                style={{ padding: '9px 20px', fontWeight: 700 }}
              >
                {isUploadingCsv ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Upload &amp; Ingest Categories</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: DELETE CONFIRMATION                             */}
      {/* ======================================================== */}
      {categoryToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 950,
            padding: '20px',
          }}
        >
          <div className="glass-card" style={{ width: '460px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                <Trash2 size={20} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#fff' }}>
                Delete Category?
              </h3>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '16px' }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>"{categoryToDelete.name}"</strong>?
            </p>

            {(categoryToDelete.product_count || 0) > 0 && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#fca5a5',
                  fontSize: '0.82rem',
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Safety Block:</strong> This category contains <strong>{categoryToDelete.product_count}</strong> active products. The backend will reject deletion until products are re-assigned.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCategoryToDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={confirmDeleteCategory}
                style={{ padding: '8px 18px', fontWeight: 700 }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
