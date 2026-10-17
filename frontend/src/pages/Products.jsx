import React, { useEffect, useState } from 'react';
import {
  Plus,
  Tag,
  Check,
  Package,
  Sparkles,
  Upload,
  Download,
  Trash2,
  Edit3,
  Search,
  Filter,
  Shirt,
  ShoppingBag,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Eye,
  SlidersHorizontal,
  ZoomIn,
  TrendingUp,
  DollarSign,
  Layers,
} from 'lucide-react';
import { api, getProductImageUrl } from '../api/client';
import ProductImageGalleryZoom from '../components/ProductImageGalleryZoom';

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
const SUGGESTED_COLORS = [
  'Emerald Green',
  'Sage Green',
  'Midnight Blue',
  'Champagne Gold',
  'Blush Pink',
  'Ruby Red',
  'Crisp White',
  'Jet Black',
];

export default function Products({ user, onNavigateToCategories }) {
  // Products & Categories State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [filterSaleOnly, setFilterSaleOnly] = useState(false);

  // Modals State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showAddVariantModal, setShowAddVariantModal] = useState(false);
  const [previewGalleryProduct, setPreviewGalleryProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);

  // Notifications / Toast
  const [toast, setToast] = useState(null);

  // Multi-Variant Product Builder State
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Dresses',
    description: '',
    image_urls: '',
    is_on_sale: false,
    sale_price: '',
    discount_percent: 20,
    promo_code: 'SUMMER20',
    sale_tag: 'Summer Flash Sale',
    season: 'Summer',
    is_trending: false,
    selectedColors: ['Sage Green'],
    newColorInput: '',
    selectedSizes: ['S', 'M', 'L'],
    basePrice: 54.99,
    baseQuantity: 15,
    generatedVariants: [],
  });

  // Edit Product State
  const [editProductForm, setEditProductForm] = useState({
    id: '',
    name: '',
    category: '',
    description: '',
    image_urls: '',
    is_active: true,
    is_on_sale: false,
    sale_price: '',
    discount_percent: '',
    promo_code: '',
    sale_tag: '',
    season: 'Summer',
    is_trending: false,
  });

  const [uploadingImages, setUploadingImages] = useState(false);

  // Single Variant Add Form
  const [singleVariantForm, setSingleVariantForm] = useState({
    size: 'M',
    color: 'Sage Green',
    price: 49.99,
    quantity: 10,
    sku: '',
  });

  // Bulk Import CSV State (Products)
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState([]);
  const [csvImporting, setCsvImporting] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        api.getProducts().catch(() => []),
        api.getCategories(true).catch(() => []),
      ]);
      setProducts(prods);
      setCategories(cats);

      // Refresh currently selected product if open
      if (selectedProduct) {
        const refreshed = prods.find((p) => p.id === selectedProduct.id || p.slug === selectedProduct.slug);
        if (refreshed) {
          const detail = await api.getProduct(refreshed.slug || refreshed.id).catch(() => refreshed);
          setSelectedProduct(detail);
        }
      }
    } catch (err) {
      showNotification(`Failed to load products: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // -------------------------------------------------------------
  // VARIANT MATRIX GENERATOR
  // -------------------------------------------------------------
  const toggleColor = (color) => {
    setProductForm((prev) => {
      const exists = prev.selectedColors.includes(color);
      const nextColors = exists
        ? prev.selectedColors.filter((c) => c !== color)
        : [...prev.selectedColors, color];
      return { ...prev, selectedColors: nextColors };
    });
  };

  const addCustomColor = () => {
    const trimmed = productForm.newColorInput.trim();
    if (!trimmed) return;
    if (!productForm.selectedColors.includes(trimmed)) {
      setProductForm((prev) => ({
        ...prev,
        selectedColors: [...prev.selectedColors, trimmed],
        newColorInput: '',
      }));
    } else {
      setProductForm((prev) => ({ ...prev, newColorInput: '' }));
    }
  };

  const toggleSize = (size) => {
    setProductForm((prev) => {
      const exists = prev.selectedSizes.includes(size);
      const nextSizes = exists
        ? prev.selectedSizes.filter((s) => s !== size)
        : [...prev.selectedSizes, size];
      return { ...prev, selectedSizes: nextSizes };
    });
  };

  const handleGenerateMatrix = () => {
    const { name, selectedColors, selectedSizes, basePrice, baseQuantity } = productForm;
    if (selectedColors.length === 0 || selectedSizes.length === 0) {
      showNotification('Please select at least 1 color and 1 size to generate variants', 'error');
      return;
    }

    const cleanPrefix = (name || 'PROD')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4) || 'ITEM';

    const matrix = [];
    let counter = 1;
    selectedColors.forEach((color) => {
      selectedSizes.forEach((size) => {
        const colorCode = color.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
        const sizeCode = size.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase();
        matrix.push({
          color,
          size,
          price: parseFloat(basePrice) || 49.99,
          available_quantity: parseInt(baseQuantity, 10) || 10,
          sku: `${cleanPrefix}-${colorCode}-${sizeCode}-${counter}`,
        });
        counter++;
      });
    });

    setProductForm((prev) => ({ ...prev, generatedVariants: matrix }));
    showNotification(`Generated ${matrix.length} variants! Check table below to customize prices or stock.`);
  };

  const updateMatrixVariant = (idx, field, value) => {
    setProductForm((prev) => {
      const updated = [...prev.generatedVariants];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, generatedVariants: updated };
    });
  };

  const removeMatrixVariant = (idx) => {
    setProductForm((prev) => ({
      ...prev,
      generatedVariants: prev.generatedVariants.filter((_, i) => i !== idx),
    }));
  };

  // -------------------------------------------------------------
  // DYNAMIC DISCOUNT AUTO-CALCULATORS
  // -------------------------------------------------------------
  const handleProductFormDiscountChange = (newDiscountStr) => {
    const disc = parseFloat(newDiscountStr);
    const baseP = parseFloat(productForm.basePrice) || 0;
    if (!isNaN(disc) && disc > 0 && baseP > 0) {
      const calcSalePrice = (baseP * (1 - disc / 100)).toFixed(2);
      setProductForm((prev) => ({
        ...prev,
        discount_percent: newDiscountStr,
        sale_price: calcSalePrice,
        is_on_sale: true,
      }));
    } else {
      setProductForm((prev) => ({
        ...prev,
        discount_percent: newDiscountStr,
        sale_price: '',
        is_on_sale: false,
      }));
    }
  };

  const handleProductFormSalePriceChange = (newSalePriceStr) => {
    const saleP = parseFloat(newSalePriceStr);
    const baseP = parseFloat(productForm.basePrice) || 0;
    if (!isNaN(saleP) && saleP > 0 && baseP > saleP) {
      const calcDisc = Math.round(((baseP - saleP) / baseP) * 100);
      setProductForm((prev) => ({
        ...prev,
        sale_price: newSalePriceStr,
        discount_percent: calcDisc,
        is_on_sale: true,
      }));
    } else {
      setProductForm((prev) => ({
        ...prev,
        sale_price: newSalePriceStr,
        discount_percent: '',
        is_on_sale: false,
      }));
    }
  };

  const handleEditProductDiscountChange = (newDiscountStr) => {
    const disc = parseFloat(newDiscountStr);
    const prod = products.find((p) => p.id === editProductForm.id);
    const baseP = prod?.min_price || parseFloat(editProductForm.sale_price) || 49.99;
    if (!isNaN(disc) && disc > 0 && baseP > 0) {
      const calcSalePrice = (baseP * (1 - disc / 100)).toFixed(2);
      setEditProductForm((prev) => ({
        ...prev,
        discount_percent: newDiscountStr,
        sale_price: calcSalePrice,
        is_on_sale: true,
      }));
    } else {
      setEditProductForm((prev) => ({
        ...prev,
        discount_percent: newDiscountStr,
        sale_price: '',
        is_on_sale: false,
      }));
    }
  };

  const handleEditProductSalePriceChange = (newSalePriceStr) => {
    const saleP = parseFloat(newSalePriceStr);
    const prod = products.find((p) => p.id === editProductForm.id);
    const baseP = prod?.min_price || 49.99;
    if (!isNaN(saleP) && saleP > 0 && baseP > saleP) {
      const calcDisc = Math.round(((baseP - saleP) / baseP) * 100);
      setEditProductForm((prev) => ({
        ...prev,
        sale_price: newSalePriceStr,
        discount_percent: calcDisc,
        is_on_sale: true,
      }));
    } else {
      setEditProductForm((prev) => ({
        ...prev,
        sale_price: newSalePriceStr,
        discount_percent: '',
        is_on_sale: false,
      }));
    }
  };

  // -------------------------------------------------------------
  // MULTI-IMAGE UPLOAD (COMPUTER FILES)
  // -------------------------------------------------------------
  const handleImageFileUpload = async (e, formType = 'create') => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    try {
      setUploadingImages(true);
      showNotification(`Uploading ${files.length} image(s)...`, 'info');
      const res = await api.uploadProductImages(files);
      const newUrls = res.image_urls || [];

      if (formType === 'create') {
        setProductForm((prev) => {
          const current = prev.image_urls
            ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
            : [];
          const merged = [...current, ...newUrls];
          return { ...prev, image_urls: merged.join(', ') };
        });
      } else {
        setEditProductForm((prev) => {
          const current = prev.image_urls
            ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
            : [];
          const merged = [...current, ...newUrls];
          return { ...prev, image_urls: merged.join(', ') };
        });
      }

      showNotification(`Successfully uploaded ${newUrls.length} image(s)!`);
    } catch (err) {
      showNotification(`Image upload failed: ${err.message}`, 'error');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const removeUploadedImage = (urlToRemove, formType = 'create') => {
    if (formType === 'create') {
      setProductForm((prev) => {
        const current = prev.image_urls
          ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
          : [];
        const next = current.filter((u) => u !== urlToRemove);
        return { ...prev, image_urls: next.join(', ') };
      });
    } else {
      setEditProductForm((prev) => {
        const current = prev.image_urls
          ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
          : [];
        const next = current.filter((u) => u !== urlToRemove);
        return { ...prev, image_urls: next.join(', ') };
      });
    }
  };

  // -------------------------------------------------------------
  // CREATE PRODUCT WITH VARIANTS
  // -------------------------------------------------------------
  const handleCreateProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const {
        name,
        category,
        description,
        image_urls,
        is_on_sale,
        sale_price,
        discount_percent,
        promo_code,
        sale_tag,
        season,
        is_trending,
        generatedVariants,
        basePrice,
        baseQuantity,
      } = productForm;

      if (!name.trim()) return showNotification('Product name is required', 'error');

      const imgList = image_urls
        ? image_urls.split(',').map((u) => u.trim()).filter(Boolean)
        : ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80'];

      const variantsToSubmit =
        generatedVariants.length > 0
          ? generatedVariants
          : [
              {
                size: 'M',
                color: 'Default',
                price: parseFloat(basePrice) || 49.99,
                available_quantity: parseInt(baseQuantity, 10) || 10,
              },
            ];

      const created = await api.createProductWithVariants({
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        image_urls: imgList,
        is_active: true,
        is_on_sale: Boolean(is_on_sale),
        sale_price: is_on_sale && sale_price ? parseFloat(sale_price) : null,
        discount_percent: is_on_sale && discount_percent ? parseInt(discount_percent, 10) : null,
        promo_code: is_on_sale && promo_code ? promo_code.trim() : null,
        sale_tag: is_on_sale && sale_tag ? sale_tag.trim() : null,
        season: season || 'Summer',
        is_trending: Boolean(is_trending),
        variants: variantsToSubmit,
      });

      showNotification(`Product "${created.name}" created with ${created.variants?.length || 0} variants!`);
      setShowAddProductModal(false);
      // Reset form
      setProductForm({
        name: '',
        category: categories[0]?.name || 'Dresses',
        description: '',
        image_urls: '',
        is_on_sale: false,
        sale_price: '',
        discount_percent: 20,
        promo_code: 'SUMMER20',
        sale_tag: 'Summer Flash Sale',
        season: 'Summer',
        is_trending: false,
        selectedColors: ['Sage Green'],
        newColorInput: '',
        selectedSizes: ['S', 'M', 'L'],
        basePrice: 54.99,
        baseQuantity: 15,
        generatedVariants: [],
      });
      await loadData();
    } catch (err) {
      showNotification(`Failed to create product: ${err.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // SELECT PRODUCT & MANAGE VARIANTS
  // -------------------------------------------------------------
  const handleSelectProduct = async (prodSlugOrId) => {
    try {
      const fullProd = await api.getProduct(prodSlugOrId);
      setSelectedProduct(fullProd);
    } catch (err) {
      showNotification(`Cannot load product details: ${err.message}`, 'error');
    }
  };

  const handleQuickStockUpdate = async (variantId, newQuantity) => {
    const qty = parseInt(newQuantity, 10);
    if (isNaN(qty) || qty < 0) return;
    try {
      await api.updateVariantStock(variantId, qty);
      showNotification('Inventory stock updated!');
      if (selectedProduct) {
        const refreshed = await api.getProduct(selectedProduct.slug || selectedProduct.id);
        setSelectedProduct(refreshed);
      }
      await loadData();
    } catch (err) {
      showNotification(`Failed to update stock: ${err.message}`, 'error');
    }
  };

  const handleDeleteVariant = async (variantId) => {
    try {
      await api.deleteVariant(variantId);
      showNotification('Variant removed.');
      if (selectedProduct) {
        const refreshed = await api.getProduct(selectedProduct.slug || selectedProduct.id);
        setSelectedProduct(refreshed);
      }
      await loadData();
    } catch (err) {
      showNotification(`Cannot delete variant: ${err.message}`, 'error');
    }
  };

  const handleAddSingleVariant = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await api.createVariant(selectedProduct.id, {
        size: singleVariantForm.size.trim(),
        color: singleVariantForm.color.trim(),
        price: parseFloat(singleVariantForm.price) || 49.99,
        available_quantity: parseInt(singleVariantForm.quantity, 10) || 10,
        sku: singleVariantForm.sku.trim() || undefined,
      });
      showNotification('New variant added to product!');
      setShowAddVariantModal(false);
      const refreshed = await api.getProduct(selectedProduct.slug || selectedProduct.id);
      setSelectedProduct(refreshed);
      await loadData();
    } catch (err) {
      showNotification(`Failed to add variant: ${err.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // EDIT PRODUCT DETAILS
  // -------------------------------------------------------------
  const openEditProductModal = (prod) => {
    setEditProductForm({
      id: prod.id,
      name: prod.name,
      category: prod.category,
      description: prod.description || '',
      image_urls: (prod.image_urls || []).join(', '),
      is_active: prod.is_active,
      is_on_sale: Boolean(prod.is_on_sale),
      sale_price: prod.sale_price || '',
      discount_percent: prod.discount_percent || '',
      promo_code: prod.promo_code || '',
      sale_tag: prod.sale_tag || '',
      season: prod.season || 'Summer',
      is_trending: Boolean(prod.is_trending),
    });
    setShowEditProductModal(true);
  };

  const handleUpdateProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const imgList = editProductForm.image_urls
        ? editProductForm.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
        : [];

      const updated = await api.updateProduct(editProductForm.id, {
        name: editProductForm.name,
        category: editProductForm.category,
        description: editProductForm.description,
        image_urls: imgList,
        is_active: editProductForm.is_active,
        is_on_sale: Boolean(editProductForm.is_on_sale),
        sale_price: editProductForm.is_on_sale && editProductForm.sale_price ? parseFloat(editProductForm.sale_price) : null,
        discount_percent: editProductForm.is_on_sale && editProductForm.discount_percent ? parseInt(editProductForm.discount_percent, 10) : null,
        promo_code: editProductForm.is_on_sale && editProductForm.promo_code ? editProductForm.promo_code.trim() : null,
        sale_tag: editProductForm.is_on_sale && editProductForm.sale_tag ? editProductForm.sale_tag.trim() : null,
        season: editProductForm.season || 'Summer',
        is_trending: Boolean(editProductForm.is_trending),
      });

      showNotification(`Product "${updated.name}" updated successfully!`);
      setShowEditProductModal(false);
      await loadData();
      await handleSelectProduct(updated.slug);
    } catch (err) {
      showNotification(`Failed to update product: ${err.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // DELETE PRODUCT
  // -------------------------------------------------------------
  const handleDeleteProduct = async (prodId, prodName) => {
    if (!prodId) return;
    try {
      await api.deleteProduct(prodId);
      showNotification(`Product "${prodName || 'Product'}" and all variants deleted.`);
      if (selectedProduct && selectedProduct.id === prodId) {
        setSelectedProduct(null);
      }
      setProductToDelete(null);
      await loadData();
    } catch (err) {
      showNotification(`Cannot delete: ${err.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // BULK CSV IMPORT & EXPORT (PRODUCTS)
  // -------------------------------------------------------------
  const handleDownloadSampleCsv = () => {
    const csvContent =
      'Product Name,Category,Description,Image URLs,SKU,Color,Size,Price,Stock Quantity,Is On Sale,Sale Price,Discount %,Promo Code,Sale Tag,Season\n' +
      'Silk Floral Maxi Dress,Dresses,Pure mulberry silk elegant evening gown,"https://images.unsplash.com/photo-1572804013309-59a88b7e92f1, https://images.unsplash.com/photo-1515372039744-b8f02a3ae446, https://images.unsplash.com/photo-1558769132-cb1aea458c5e",DRS-EMR-S,Emerald Green,"S,M,L,XL",89.99,"10,11,23,19",Yes,67.49,25,SUMMER25,Summer Flash Sale,Summer\n' +
      'Crisp Linen Relaxed Shirt,Tops & Shirts,Breathable 100% natural European linen,"https://images.unsplash.com/photo-1598033129183-c4f50c736f10, https://images.unsplash.com/photo-1523381294911-8d3cead13475",SHR-SGE-L,Sage Green,"S,M,L",54.99,"15,20,12",Yes,43.99,20,LINEN20,Special Summer Deal,Summer\n' +
      'Tailored Wool Trench Coat,Outerwear & Jackets,Hand-stitched cashmere-wool autumn jacket,"https://images.unsplash.com/photo-1539533018447-63fcce667883, https://images.unsplash.com/photo-1520006403909-838d6b92c22e",COT-CAM-M,Camel,M,149.99,10,No,,,NoPromo,,All-Season\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fashion_catalog_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      const parseCsvLine = (line) => {
        const res = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' || ch === "'") {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            res.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        res.push(cur.trim());
        return res;
      };
      const rows = lines.slice(1, 6).map(parseCsvLine);
      setCsvPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!csvFile) return showNotification('Please select a CSV file to upload', 'error');

    try {
      setCsvImporting(true);
      const res = await api.bulkImportCsv(csvFile);
      showNotification(
        `Bulk Import Successful! Added ${res.imported_products} products, ${res.imported_variants} variants, ${res.created_categories?.length || 0} categories.`
      );
      setShowBulkImportModal(false);
      setCsvFile(null);
      setCsvPreviewRows([]);
      await loadData();
    } catch (err) {
      showNotification(`Import failed: ${err.message}`, 'error');
    } finally {
      setCsvImporting(false);
    }
  };

  // -------------------------------------------------------------
  // FILTERING & DERIVED ANALYTICS
  // -------------------------------------------------------------
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategoryFilter === 'All' || p.category?.toLowerCase() === selectedCategoryFilter.toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      p.name?.toLowerCase().includes(query) ||
      p.category?.toLowerCase().includes(query) ||
      (p.variants && p.variants.some((v) => v.sku?.toLowerCase().includes(query)));
    const matchesLowStock = !filterLowStockOnly || (p.total_stock !== undefined && p.total_stock < 5);
    const matchesSale = !filterSaleOnly || Boolean(p.is_on_sale);

    return matchesCategory && matchesSearch && matchesLowStock && matchesSale;
  });

  const totalVariantStock = products.reduce((acc, p) => acc + (p.total_stock || 0), 0);
  const lowStockCount = products.filter((p) => (p.total_stock || 0) < 5).length;
  const onSaleCount = products.filter((p) => Boolean(p.is_on_sale)).length;
  const totalCatalogValue = products.reduce(
    (acc, p) => acc + (p.min_price || 0) * (p.total_stock || 0),
    0
  );

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '22px' }}>
        <div>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingBag size={26} style={{ color: 'var(--primary)' }} />
            <span>Product Catalog</span>
            <span style={{ fontSize: '0.8rem', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', padding: '3px 10px', borderRadius: 'var(--radius-full)' }}>
              {products.length} Products
            </span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Manage multi-color &amp; multi-size clothing collections, inventory stock, images and pricing
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href={api.getExportCsvUrl()}
            download="boutique_catalog_export.csv"
            className="btn btn-secondary"
            title="Download complete catalog as CSV"
            style={{ textDecoration: 'none' }}
          >
            <Download size={16} />
            <span>Export CSV</span>
          </a>
          <button
            className="btn btn-secondary"
            onClick={() => setShowBulkImportModal(true)}
            title="Upload CSV with multiple products and variants"
          >
            <FileSpreadsheet size={16} />
            <span>Bulk CSV Import</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              setProductForm((prev) => ({
                ...prev,
                category: categories[0]?.name || 'Dresses',
              }));
              setShowAddProductModal(true);
            }}
          >
            <Plus size={16} />
            <span>New Multi-Variant Product</span>
          </button>
        </div>
      </div>

      {/* Upper Analytics Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
          marginBottom: '24px',
        }}
      >
        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShoppingBag size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Products</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{products.length} Styles</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Inventory Units</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>{totalVariantStock.toLocaleString()} Units</div>
          </div>
        </div>

        <div
          className="glass-card"
          style={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            border: filterLowStockOnly ? '2px solid #ef4444' : '1px solid var(--border-glass)',
            background: filterLowStockOnly ? 'rgba(239, 68, 68, 0.12)' : undefined,
            transition: 'all 0.2s ease',
          }}
          onClick={() => {
            setFilterLowStockOnly(!filterLowStockOnly);
          }}
          title="Click to toggle filtering products with stock < 5"
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: lowStockCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: lowStockCount > 0 ? '#f87171' : '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Low Stock Alert</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: lowStockCount > 0 ? '#f87171' : 'inherit' }}>
              {lowStockCount} Items &lt; 5 {filterLowStockOnly && '(Active)'}
            </div>
          </div>
        </div>

        <div
          className="glass-card"
          style={{
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            border: filterSaleOnly ? '2px solid #f59e0b' : '1px solid var(--border-glass)',
            background: filterSaleOnly ? 'rgba(245, 158, 11, 0.12)' : undefined,
            transition: 'all 0.2s ease',
          }}
          onClick={() => setFilterSaleOnly(!filterSaleOnly)}
          title="Click to toggle filtering active on sale products"
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active On Sale</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>
              {onSaleCount} Products {filterSaleOnly && '(Active)'}
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Est. Inventory Value</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>${totalCatalogValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '18px',
        }}
      >
        {/* Category Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn ${selectedCategoryFilter === 'All' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: 'var(--radius-full)' }}
            onClick={() => setSelectedCategoryFilter('All')}
          >
            All Categories ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id || c.name}
              type="button"
              className={`btn ${selectedCategoryFilter.toLowerCase() === c.name.toLowerCase() ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem', padding: '5px 12px', borderRadius: 'var(--radius-full)' }}
              onClick={() => setSelectedCategoryFilter(c.name)}
            >
              {c.name} ({products.filter((p) => p.category?.toLowerCase() === c.name.toLowerCase()).length})
            </button>
          ))}
          {onNavigateToCategories && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 'var(--radius-full)', color: 'var(--accent-indigo)' }}
              onClick={onNavigateToCategories}
              title="Manage taxonomy categories"
            >
              <Layers size={13} />
              <span>Manage Categories &rarr;</span>
            </button>
          )}
        </div>

        {/* Search Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search product name, SKU..."
              className="chat-input"
              style={{ paddingLeft: '32px', width: '100%', fontSize: '0.82rem', height: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Products Grid & Variant Management Layout */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin-animation" style={{ margin: '0 auto 12px' }} />
          <p>Loading catalog products and multi-variants...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Package size={42} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Products Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            {searchQuery || selectedCategoryFilter !== 'All'
              ? 'Try adjusting your search query or category filters.'
              : 'Your boutique catalog has no products yet. Add your first multi-variant product or import via CSV!'}
          </p>
          <button className="btn btn-primary" onClick={() => setShowAddProductModal(true)}>
            <Plus size={16} />
            <span>Create New Product</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selectedProduct ? '1fr 440px' : '1fr', gap: '20px', alignItems: 'start' }}>
          {/* Products Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: selectedProduct ? 'repeat(auto-fill, minmax(240px, 1fr))' : 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '18px',
            }}
          >
            {filteredProducts.map((p) => {
              const isSelected = selectedProduct?.id === p.id;
              const hasMultipleImages = p.image_urls && p.image_urls.length > 1;
              const priceDisplay =
                p.min_price === p.max_price
                  ? `$${(p.min_price || 0).toFixed(2)}`
                  : `$${(p.min_price || 0).toFixed(2)} - $${(p.max_price || 0).toFixed(2)}`;

              return (
                <div
                  key={p.id}
                  className={`glass-card product-card ${isSelected ? 'active-product-card' : ''}`}
                  style={{
                    padding: '0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {/* Image & Badges */}
                  <div style={{ position: 'relative', overflow: 'hidden', background: '#090d16' }}>
                    {p.is_on_sale && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '12px',
                          left: '12px',
                          background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                          color: '#fff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          zIndex: 2,
                        }}
                      >
                        🔥 SALE {p.discount_percent ? `-${p.discount_percent}%` : ''}
                      </span>
                    )}

                    {p.promo_code && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          background: 'rgba(0,0,0,0.7)',
                          backdropFilter: 'blur(4px)',
                          border: '1px dashed #f59e0b',
                          color: '#f59e0b',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          zIndex: 2,
                        }}
                      >
                        {p.promo_code}
                      </span>
                    )}

                    <img
                      src={getProductImageUrl(p.image_urls?.[0])}
                      alt={p.name}
                      className="product-image"
                      style={{ height: '220px', objectFit: 'cover', width: '100%', display: 'block' }}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
                      }}
                    />

                    {/* Image inspection hover button */}
                    <button
                      type="button"
                      style={{
                        position: 'absolute',
                        bottom: '10px',
                        right: '10px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        fontSize: '0.72rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                      onClick={() => setPreviewGalleryProduct(p)}
                      title="Inspect full image gallery with deep zoom"
                    >
                      <ZoomIn size={13} style={{ color: 'var(--primary)' }} />
                      <span>{hasMultipleImages ? `${p.image_urls.length} Photos` : 'Zoom Lens'}</span>
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="product-body" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          fontWeight: 700,
                          color: 'var(--accent-indigo)',
                          background: 'rgba(99, 102, 241, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {p.category}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        {p.is_on_sale && p.sale_price ? (
                          <div>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginRight: '5px' }}>
                              {priceDisplay}
                            </span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f59e0b' }}>
                              ${p.sale_price.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)' }}>
                            {priceDisplay}
                          </span>
                        )}
                      </div>
                    </div>

                    <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', lineHeight: '1.3' }}>
                      {p.name}
                    </h4>

                    <p
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        lineHeight: '1.4',
                        marginBottom: '12px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        flex: 1,
                      }}
                    >
                      {p.description || 'No description provided.'}
                    </p>

                    {/* Stock & Variant Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', fontSize: '0.75rem' }}>
                      <span style={{ color: (p.total_stock || 0) < 5 ? '#f87171' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {(p.total_stock || 0) < 5 ? <AlertCircle size={13} /> : <Package size={13} />}
                        <b>{p.total_stock || 0}</b> total in stock
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        <b>{p.variant_count || p.variants?.length || 0}</b> variants
                      </span>
                    </div>

                    {/* Available Sizes/Colors pills */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {(p.sizes || []).slice(0, 4).map((sz) => (
                        <span key={sz} style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px' }}>
                          {sz}
                        </span>
                      ))}
                      {(p.colors || []).slice(0, 2).map((col) => (
                        <span key={col} style={{ fontSize: '0.68rem', background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '4px' }}>
                          {col}
                        </span>
                      ))}
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                      <button
                        type="button"
                        className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ flex: 1, fontSize: '0.78rem', padding: '6px 10px', justifyContent: 'center' }}
                        onClick={() => handleSelectProduct(p.slug || p.id)}
                      >
                        <SlidersHorizontal size={14} />
                        <span>{isSelected ? 'Managing' : 'Variants'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px' }}
                        onClick={() => openEditProductModal(p)}
                        title="Edit product info"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '6px 8px', color: '#f87171' }}
                        onClick={() => setProductToDelete(p)}
                        title="Delete product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side Drawer: Variant Management */}
          {selectedProduct && (
            <div
              className="glass-card"
              style={{
                padding: '20px',
                position: 'sticky',
                top: '20px',
                maxHeight: 'calc(100vh - 40px)',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-indigo)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Active Product
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '2px' }}>
                    {selectedProduct.name}
                  </h3>
                </div>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setSelectedProduct(null)}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Actions & Add Variant */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px', justifyContent: 'center' }}
                  onClick={() => setShowAddVariantModal(true)}
                >
                  <Plus size={14} />
                  <span>Add Color/Size Variant</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '8px 10px' }}
                  onClick={() => setPreviewGalleryProduct(selectedProduct)}
                  title="Zoom preview"
                >
                  <ZoomIn size={14} />
                </button>
              </div>

              {/* Variant List Table */}
              <div style={{ fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', padding: '0 4px' }}>
                  <span>Variant (Color / Size)</span>
                  <span>Stock &amp; Price</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(selectedProduct.variants || []).map((v) => (
                    <div
                      key={v.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{v.color || 'Default'}</span>
                          <span style={{ margin: '0 6px', color: 'var(--text-muted)' }}>&bull;</span>
                          <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                            {v.size || 'Standard'}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--primary)' }}>
                          ${(v.price || 49.99).toFixed(2)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <code style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{v.sku}</code>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Qty:</span>
                          <input
                            type="number"
                            min="0"
                            style={{
                              width: '52px',
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: '4px',
                              color: '#fff',
                              padding: '2px 4px',
                              fontSize: '0.75rem',
                              textAlign: 'center',
                            }}
                            defaultValue={v.available_quantity ?? 10}
                            onBlur={(e) => handleQuickStockUpdate(v.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleQuickStockUpdate(v.id, e.target.value);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteVariant(v.id)}
                            style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: '2px' }}
                            title="Delete this variant"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE MULTI-VARIANT PRODUCT                     */}
      {/* ======================================================== */}
      {showAddProductModal && (
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
          <div className="glass-card" style={{ width: '820px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>New Multi-Variant Product Builder</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Create clothing style with color palette, sizing matrix, inventory and discounts
                </p>
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowAddProductModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateProductSubmit}>
              {/* Product Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Silk Floral Maxi Dress"
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                    Category Taxonomy *
                  </label>
                  <select
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Description &amp; Styling Notes
                </label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '70px', resize: 'none' }}
                  placeholder="Fabric composition, occasion styling advice, and fit description..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              {/* Product Images: Upload & URLs */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', color: '#f1f5f9', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={14} style={{ color: 'var(--primary)' }} /> Product Images (Multiple Local Files &amp; URLs)
                  </label>
                  <label
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.78rem',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Plus size={13} />
                    <span>Upload from Computer</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageFileUpload(e, 'create')}
                      disabled={uploadingImages}
                    />
                  </label>
                </div>

                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: '10px' }}
                  placeholder="Paste comma-separated URLs or upload via button above..."
                  value={productForm.image_urls}
                  onChange={(e) => setProductForm({ ...productForm, image_urls: e.target.value })}
                />

                {/* Thumbnails list */}
                {productForm.image_urls && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {productForm.image_urls
                      .split(',')
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((url, i) => (
                        <div key={i} style={{ position: 'relative', width: '64px', height: '64px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                          <img src={getProductImageUrl(url)} alt={`Upload ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            type="button"
                            onClick={() => removeUploadedImage(url, 'create')}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              background: 'rgba(0,0,0,0.7)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            title="Remove image"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* SECTION: SALE, PROMO CODE & SEASON SHOWCASE */}
              <div
                style={{
                  background: productForm.is_on_sale
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: productForm.is_on_sale ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '20px',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: productForm.is_on_sale ? '14px' : '0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={productForm.is_on_sale}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          const baseP = parseFloat(productForm.basePrice) || 49.99;
                          const disc = parseFloat(productForm.discount_percent) || 20;
                          const calcSale = (baseP * (1 - disc / 100)).toFixed(2);
                          setProductForm({
                            ...productForm,
                            is_on_sale: true,
                            discount_percent: disc,
                            sale_price: calcSale,
                          });
                        } else {
                          setProductForm({
                            ...productForm,
                            is_on_sale: false,
                            discount_percent: '',
                            sale_price: '',
                          });
                        }
                      }}
                      style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    <span>🔥 Put this Product on Sale / Promotional Discount</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    <input
                      type="checkbox"
                      checked={productForm.is_trending}
                      onChange={(e) => setProductForm({ ...productForm, is_trending: e.target.checked })}
                      style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span>★ Mark as Trending / Best Seller</span>
                  </label>
                </div>

                {productForm.is_on_sale && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                        Discounted Sale Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 39.99"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={productForm.sale_price}
                        onChange={(e) => handleProductFormSalePriceChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                        Discount %
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 25"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={productForm.discount_percent}
                        onChange={(e) => handleProductFormDiscountChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                        Promo Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SUMMER25"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={productForm.promo_code}
                        onChange={(e) => setProductForm({ ...productForm, promo_code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                        Sale Badge / Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Summer Flash Sale"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={productForm.sale_tag}
                        onChange={(e) => setProductForm({ ...productForm, sale_tag: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* VARIANT GENERATOR MATRIX BUILDER */}
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.05)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                    Multi-Color &amp; Sizing Variant Matrix
                  </h4>
                </div>

                {/* Sizing Pills */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Select Available Sizes:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {COMMON_SIZES.map((sz) => {
                      const sel = productForm.selectedSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => toggleSize(sz)}
                          className={`btn ${sel ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          {sel && <Check size={12} />}
                          <span>{sz}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Colors Pills */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Select Boutique Colors:
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {SUGGESTED_COLORS.map((col) => {
                      const sel = productForm.selectedColors.includes(col);
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => toggleColor(col)}
                          className={`btn ${sel ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          {sel && <Check size={12} />}
                          <span>{col}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', width: '300px' }}>
                    <input
                      type="text"
                      placeholder="Add custom color..."
                      className="chat-input"
                      style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: '4px', flex: 1 }}
                      value={productForm.newColorInput}
                      onChange={(e) => setProductForm({ ...productForm, newColorInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomColor();
                        }
                      }}
                    />
                    <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 10px' }} onClick={addCustomColor}>
                      Add
                    </button>
                  </div>
                </div>

                {/* Base Price & Default Stock */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      Base Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="chat-input"
                      style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                      value={productForm.basePrice}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductForm((prev) => ({ ...prev, basePrice: val }));
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                      Default Stock Per Variant
                    </label>
                    <input
                      type="number"
                      className="chat-input"
                      style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                      value={productForm.baseQuantity}
                      onChange={(e) => setProductForm({ ...productForm, baseQuantity: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleGenerateMatrix}
                    style={{ background: 'var(--primary)', color: '#fff', border: 'none', height: '40px' }}
                  >
                    <Sparkles size={14} />
                    <span>Generate Variants Matrix</span>
                  </button>
                </div>

                {/* Generated Matrix Table */}
                {productForm.generatedVariants.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px', color: '#a5b4fc' }}>
                      Generated {productForm.generatedVariants.length} Variants Preview:
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', borderRadius: '6px', border: '1px solid var(--border-glass)' }}>
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                          <tr>
                            <th style={{ padding: '8px' }}>SKU</th>
                            <th style={{ padding: '8px' }}>Color</th>
                            <th style={{ padding: '8px' }}>Size</th>
                            <th style={{ padding: '8px' }}>Price ($)</th>
                            <th style={{ padding: '8px' }}>Stock</th>
                            <th style={{ padding: '8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {productForm.generatedVariants.map((v, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  type="text"
                                  value={v.sku}
                                  onChange={(e) => updateMatrixVariant(idx, 'sku', e.target.value)}
                                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.72rem', width: '120px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 8px' }}>{v.color}</td>
                              <td style={{ padding: '6px 8px' }}>{v.size}</td>
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={v.price}
                                  onChange={(e) => updateMatrixVariant(idx, 'price', parseFloat(e.target.value) || 0)}
                                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: '#fff', width: '65px', padding: '2px 4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  type="number"
                                  value={v.available_quantity}
                                  onChange={(e) => updateMatrixVariant(idx, 'available_quantity', parseInt(e.target.value, 10) || 0)}
                                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-glass)', borderRadius: '4px', color: '#fff', width: '55px', padding: '2px 4px' }}
                                />
                              </td>
                              <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => removeMatrixVariant(idx)}
                                  style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                                >
                                  <X size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ minWidth: '150px' }}>
                  <Plus size={16} />
                  <span>Publish Product</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT PRODUCT DETAILS                             */}
      {/* ======================================================== */}
      {showEditProductModal && (
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
          <div className="glass-card" style={{ width: '640px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Edit Product Details</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Modify core product styling, photography and sale attributes</p>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowEditProductModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateProductSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={editProductForm.name}
                  onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Category
                </label>
                <select
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={editProductForm.category}
                  onChange={(e) => setEditProductForm({ ...editProductForm, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Description
                </label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '70px', resize: 'none' }}
                  value={editProductForm.description}
                  onChange={(e) => setEditProductForm({ ...editProductForm, description: e.target.value })}
                />
              </div>

              {/* Edit Image URLs */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Image URLs (Comma separated)
                  </label>
                  <label
                    className="btn btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '3px 8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Upload size={12} />
                    <span>Upload More</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageFileUpload(e, 'edit')}
                      disabled={uploadingImages}
                    />
                  </label>
                </div>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={editProductForm.image_urls}
                  onChange={(e) => setEditProductForm({ ...editProductForm, image_urls: e.target.value })}
                />
              </div>

              {/* Sale & Promo Configuration */}
              <div
                style={{
                  background: editProductForm.is_on_sale
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(236, 72, 153, 0.08) 100%)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: editProductForm.is_on_sale ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  marginBottom: '18px',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editProductForm.is_on_sale ? '12px' : '0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.84rem', color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={editProductForm.is_on_sale}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          const prod = products.find((p) => p.id === editProductForm.id);
                          const baseP = prod?.min_price || 49.99;
                          const disc = parseFloat(editProductForm.discount_percent) || 20;
                          const calcSale = (baseP * (1 - disc / 100)).toFixed(2);
                          setEditProductForm({
                            ...editProductForm,
                            is_on_sale: true,
                            discount_percent: disc,
                            sale_price: calcSale,
                          });
                        } else {
                          setEditProductForm({
                            ...editProductForm,
                            is_on_sale: false,
                            discount_percent: '',
                            sale_price: '',
                          });
                        }
                      }}
                      style={{ width: '15px', height: '15px', accentColor: '#f59e0b', cursor: 'pointer' }}
                    />
                    <span>🔥 Active Sale / Promotional Discount</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', color: '#cbd5e1' }}>
                    <input
                      type="checkbox"
                      checked={editProductForm.is_trending}
                      onChange={(e) => setEditProductForm({ ...editProductForm, is_trending: e.target.checked })}
                      style={{ width: '14px', height: '14px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <span>★ Trending Item</span>
                  </label>
                </div>

                {editProductForm.is_on_sale && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                        Discounted Sale Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 39.99"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={editProductForm.sale_price}
                        onChange={(e) => handleEditProductSalePriceChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                        Discount %
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 25"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={editProductForm.discount_percent}
                        onChange={(e) => handleEditProductDiscountChange(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                        Promo Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SUMMER25"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={editProductForm.promo_code}
                        onChange={(e) => setEditProductForm({ ...editProductForm, promo_code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                        Sale Badge / Tag
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Summer Flash Sale"
                        className="chat-input"
                        style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                        value={editProductForm.sale_tag}
                        onChange={(e) => setEditProductForm({ ...editProductForm, sale_tag: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ADD SINGLE VARIANT MODAL                        */}
      {/* ======================================================== */}
      {showAddVariantModal && selectedProduct && (
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
          <div className="glass-card" style={{ width: '480px', maxWidth: '95vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Add Variant</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>For {selectedProduct.name}</p>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowAddVariantModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSingleVariant}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Size *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. XL"
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={singleVariantForm.size}
                    onChange={(e) => setSingleVariantForm({ ...singleVariantForm, size: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Color *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sage Green"
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={singleVariantForm.color}
                    onChange={(e) => setSingleVariantForm({ ...singleVariantForm, color: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={singleVariantForm.price}
                    onChange={(e) => setSingleVariantForm({ ...singleVariantForm, price: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Initial Stock *</label>
                  <input
                    type="number"
                    required
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    value={singleVariantForm.quantity}
                    onChange={(e) => setSingleVariantForm({ ...singleVariantForm, quantity: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>
                  Custom SKU (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-generated if blank"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={singleVariantForm.sku}
                  onChange={(e) => setSingleVariantForm({ ...singleVariantForm, sku: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddVariantModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Variant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: DELETE PRODUCT CONFIRMATION                      */}
      {/* ======================================================== */}
      {productToDelete && (
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
          <div className="glass-card" style={{ width: '420px', maxWidth: '95vw', padding: '24px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Delete Product?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '20px' }}>
              Are you sure you want to delete <b>&ldquo;{productToDelete.name}&rdquo;</b> and all its multi-color/size variants? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setProductToDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                onClick={() => handleDeleteProduct(productToDelete.id, productToDelete.name)}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: BULK CSV CATALOG INGESTION                      */}
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
          <div className="glass-card" style={{ width: '680px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Bulk CSV Product Catalog Ingestion</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Upload spreadsheets with 50+ fashion products, multi-variants &amp; categories at once.
                </p>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowBulkImportModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Template Download Prompt */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#818cf8', marginBottom: '2px' }}>
                  Need the standard format?
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Download pre-formatted sample CSV with columns for Name, Category, Multi-Image URLs, Sizes &amp; Colors.
                </div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={handleDownloadSampleCsv}>
                <Download size={14} />
                <span>Sample CSV (Multi-Image)</span>
              </button>
            </div>

            {/* Multiple Images Support Banner */}
            <div
              style={{
                background: 'rgba(212, 175, 55, 0.08)',
                border: '1px solid rgba(212, 175, 55, 0.28)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <Sparkles size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.8rem', lineHeight: '1.5', color: '#cbd5e1' }}>
                <span style={{ fontWeight: 700, color: '#fef08a' }}>Multiple Images Support:</span>{' '}
                CSV me <code style={{ color: 'var(--primary)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Image URLs</code> column ke andar aap multiple images comma (<code>,</code>) se separate karke quotes me de sakte hain (e.g.{' '}
                <code style={{ fontSize: '0.74rem', color: '#818cf8', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>
                  &quot;https://img1.jpg, https://img2.jpg, https://img3.jpg&quot;
                </code>
                ). Tamam images gallery aur zoom viewer me automatically show hongi!
              </div>
            </div>

            {/* Multiple Sizes & Multi-Stock Support Banner */}
            <div
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.28)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <Sparkles size={18} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.8rem', lineHeight: '1.5', color: '#cbd5e1' }}>
                <span style={{ fontWeight: 700, color: '#818cf8' }}>Multi-Size &amp; Stock Support:</span>{' '}
                CSV me <code style={{ color: '#818cf8', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Size</code> column me multiple sizes (e.g. <code>&quot;S,M,L,XL&quot;</code>) aur <code style={{ color: '#818cf8', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Stock Quantity</code> column me matching quantities (e.g. <code>&quot;10,11,23,19&quot;</code>) de sakte hain! System automatically har size ka variant uski corresponding quantity ke saath create kar dega.
              </div>
            </div>

            {/* File Upload Drop Zone */}
            <form onSubmit={handleBulkImportSubmit}>
              <div
                style={{
                  border: '2px dashed var(--border-glass)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  marginBottom: '20px',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('csvFileInput').click()}
              >
                <Upload size={36} style={{ color: 'var(--primary)', marginBottom: '10px' }} />
                <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>
                  {csvFile ? csvFile.name : 'Click to select CSV File or drag & drop'}
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Supports .csv files with multiple comma-separated image URLs
                </p>
                <input
                  id="csvFileInput"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleCsvFileChange}
                />
              </div>

              {/* Preview Table */}
              {csvPreviewRows.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h5 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>
                    CSV Data Preview (First 5 Rows):
                  </h5>
                  <div style={{ overflowX: 'auto', maxHeight: '180px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <tbody>
                        {csvPreviewRows.map((r, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {r.map((cell, cIdx) => (
                              <td key={cIdx} style={{ padding: '6px 10px', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkImportModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={csvImporting || !csvFile}
                  style={{ minWidth: '130px' }}
                >
                  {csvImporting ? (
                    <>
                      <RefreshCw size={14} className="spin-animation" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Start Import</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Catalog Image Gallery & Zoom Inspection Modal */}
      {previewGalleryProduct && (
        <div className="product-modal-overlay" onClick={() => setPreviewGalleryProduct(null)}>
          <div className="product-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button className="product-modal-close" onClick={() => setPreviewGalleryProduct(null)}>
              <X size={18} />
            </button>
            <div className="product-modal-body">
              <div className="product-modal-image-col">
                <ProductImageGalleryZoom product={previewGalleryProduct} />
              </div>
              <div className="product-modal-info-col">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-indigo)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {previewGalleryProduct.category}
                </span>
                <h2 className="product-modal-title" style={{ marginTop: '4px' }}>{previewGalleryProduct.name}</h2>
                <div className="product-modal-price-row">
                  <div className="product-modal-price">
                    ${Number(previewGalleryProduct.min_price || previewGalleryProduct.price || 79.99).toFixed(2)}
                  </div>
                  <div style={{ color: '#10b981', fontSize: '0.82rem', fontWeight: 700 }}>
                    ✓ Catalog Inspection Mode
                  </div>
                </div>
                <p className="product-modal-desc">{previewGalleryProduct.description}</p>
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(255, 255, 255, 0.035)', borderRadius: '10px', border: '1px solid rgba(212, 175, 55, 0.2)', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                  <div style={{ color: '#fef08a', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Professional Zoom &amp; Gallery Live Verification
                  </div>
                  Customers experience in-place precision lens zoom (2.8&times; HD) with cursor coordinates tracking, and can click any photo to open the Ultra-HD Fullscreen deep inspection lightbox with drag-to-pan and multi-angle thumbnails.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
