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
  Layers,
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
} from 'lucide-react';
import { api, getProductImageUrl } from '../api/client';
import ProductImageGalleryZoom from '../components/ProductImageGalleryZoom';

const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'];
const SUGGESTED_COLORS = ['Emerald Green', 'Sage Green', 'Midnight Blue', 'Champagne Gold', 'Blush Pink', 'Ruby Red', 'Crisp White', 'Jet Black'];

export default function Catalog() {
  // Navigation: 'PRODUCTS' | 'CATEGORIES'
  const [activeTab, setActiveTab] = useState('PRODUCTS');

  // Products State
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showAddVariantModal, setShowAddVariantModal] = useState(false);
  const [previewGalleryProduct, setPreviewGalleryProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);

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

  // Category Form State
  const [categoryForm, setCategoryForm] = useState({
    id: '',
    name: '',
    description: '',
    image_url: '',
    icon: 'Sparkles',
    display_order: 1,
  });

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

  // Bulk Import CSV State (Categories)
  const [showCategoryBulkImportModal, setShowCategoryBulkImportModal] = useState(false);
  const [categoryCsvFile, setCategoryCsvFile] = useState(null);
  const [categoryCsvPreviewRows, setCategoryCsvPreviewRows] = useState([]);
  const [categoryCsvImporting, setCategoryCsvImporting] = useState(false);

  const showNotification = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodsData, catsData] = await Promise.all([
        api.getProducts(),
        api.getCategories(true),
      ]);
      setProducts(prodsData);
      setCategories(catsData);

      if (prodsData.length > 0) {
        // If current selected product exists, refresh it; otherwise pick first
        if (selectedProduct) {
          const updated = await api.getProduct(selectedProduct.slug).catch(() => prodsData[0]);
          setSelectedProduct(updated);
        } else {
          const full = await api.getProduct(prodsData[0].slug).catch(() => prodsData[0]);
          setSelectedProduct(full);
        }
      }
    } catch (err) {
      console.error('Failed to load catalog data:', err);
      showNotification('Failed to load catalog data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectProduct = async (slug) => {
    try {
      const full = await api.getProduct(slug);
      setSelectedProduct(full);
    } catch (err) {
      console.error(err);
    }
  };

  // -------------------------------------------------------------
  // MULTI-VARIANT MATRIX GENERATOR
  // -------------------------------------------------------------
  const generateVariantMatrix = () => {
    const { name, selectedColors, selectedSizes, basePrice, baseQuantity } = productForm;
    if (!name.trim()) {
      showNotification('Please enter a product name first to generate SKUs', 'error');
      return;
    }
    if (selectedColors.length === 0 || selectedSizes.length === 0) {
      showNotification('Select at least one color and one size', 'error');
      return;
    }

    const cleanPrefix = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase() || 'LUXE';
    const matrix = [];

    selectedColors.forEach((color) => {
      selectedSizes.forEach((size) => {
        const colorCode = color.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
        const sizeCode = size.slice(0, 2).toUpperCase();
        const randomSalt = Math.floor(100 + Math.random() * 900);
        const sku = `${cleanPrefix}-${colorCode}-${sizeCode}-${randomSalt}`;

        matrix.push({
          color: color.trim(),
          size: size.trim(),
          sku,
          price: parseFloat(basePrice) || 49.99,
          available_quantity: parseInt(baseQuantity, 10) || 10,
        });
      });
    });

    setProductForm((prev) => ({
      ...prev,
      generatedVariants: matrix,
    }));
    showNotification(`Generated ${matrix.length} size × color variant combinations!`);
  };

  const handleColorToggle = (color) => {
    setProductForm((prev) => {
      const exists = prev.selectedColors.includes(color);
      const nextColors = exists
        ? prev.selectedColors.filter((c) => c !== color)
        : [...prev.selectedColors, color];
      return { ...prev, selectedColors: nextColors };
    });
  };

  const handleAddCustomColor = (e) => {
    e.preventDefault();
    const val = productForm.newColorInput.trim();
    if (!val) return;
    if (!productForm.selectedColors.includes(val)) {
      setProductForm((prev) => ({
        ...prev,
        selectedColors: [...prev.selectedColors, val],
        newColorInput: '',
      }));
    }
  };

  const handleSizeToggle = (size) => {
    setProductForm((prev) => {
      const exists = prev.selectedSizes.includes(size);
      const nextSizes = exists
        ? prev.selectedSizes.filter((s) => s !== size)
        : [...prev.selectedSizes, size];
      return { ...prev, selectedSizes: nextSizes };
    });
  };

  const handleUpdateMatrixRow = (index, field, val) => {
    setProductForm((prev) => {
      const updated = [...prev.generatedVariants];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, generatedVariants: updated };
    });
  };

  const handleRemoveMatrixRow = (index) => {
    setProductForm((prev) => {
      const updated = prev.generatedVariants.filter((_, i) => i !== index);
      return { ...prev, generatedVariants: updated };
    });
  };

  // -------------------------------------------------------------
  // CREATE PRODUCT WITH VARIANTS
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // MULTIPLE IMAGE FILE UPLOAD HANDLER
  // -------------------------------------------------------------
  const handleImageFileUpload = async (e, formType = 'create') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImages(true);
    showNotification(`Processing ${files.length} product image(s)...`, 'info');

    try {
      const res = await api.uploadProductImages(files);
      const newUrls = res.urls || [];
      if (formType === 'create') {
        setProductForm((prev) => {
          const existing = prev.image_urls
            ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
            : [];
          return { ...prev, image_urls: [...existing, ...newUrls].join(', ') };
        });
      } else {
        setEditProductForm((prev) => {
          const existing = prev.image_urls
            ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
            : [];
          return { ...prev, image_urls: [...existing, ...newUrls].join(', ') };
        });
      }
      showNotification(`✓ ${files.length} image(s) uploaded successfully!`);
    } catch {
      // Fallback: convert directly to base64 Data URLs so images preview and work immediately
      try {
        const promises = files.map((file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (evt) => resolve(evt.target.result);
            reader.readAsDataURL(file);
          });
        });
        const dataUrls = await Promise.all(promises);
        if (formType === 'create') {
          setProductForm((prev) => {
            const existing = prev.image_urls
              ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
              : [];
            return { ...prev, image_urls: [...existing, ...dataUrls].join(', ') };
          });
        } else {
          setEditProductForm((prev) => {
            const existing = prev.image_urls
              ? prev.image_urls.split(',').map((u) => u.trim()).filter(Boolean)
              : [];
            return { ...prev, image_urls: [...existing, ...dataUrls].join(', ') };
          });
        }
        showNotification(`✓ ${files.length} image(s) attached directly!`);
      } catch (innerErr) {
        showNotification(`Image processing failed: ${innerErr.message}`, 'error');
      }
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove, formType = 'create') => {
    if (formType === 'create') {
      const current = productForm.image_urls.split(',').map((u) => u.trim()).filter(Boolean);
      const updated = current.filter((_, i) => i !== indexToRemove);
      setProductForm((prev) => ({ ...prev, image_urls: updated.join(', ') }));
    } else {
      const current = editProductForm.image_urls.split(',').map((u) => u.trim()).filter(Boolean);
      const updated = current.filter((_, i) => i !== indexToRemove);
      setEditProductForm((prev) => ({ ...prev, image_urls: updated.join(', ') }));
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

      // If matrix wasn't explicitly generated, make a default variant
      const variantsToSubmit = generatedVariants.length > 0 ? generatedVariants : [
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
      await handleSelectProduct(created.slug);
    } catch (err) {
      showNotification(`Error creating product: ${err.message}`, 'error');
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
      showNotification(`Product "${prodName || 'Item'}" removed from catalog.`);
      if (selectedProduct && (selectedProduct.id === prodId || selectedProduct.slug === prodId)) {
        setSelectedProduct(null);
      }
      setProductToDelete(null);
      await loadData();
    } catch (err) {
      showNotification(`Failed to delete: ${err.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // STOCK ADJUSTMENT & VARIANT OPERATIONS
  // -------------------------------------------------------------
  const handleUpdateStock = async (variantId, currentQty) => {
    const input = prompt('Enter new stock quantity for this variant:', currentQty);
    if (input === null) return;
    const qty = parseInt(input, 10);
    if (isNaN(qty) || qty < 0) return showNotification('Invalid quantity', 'error');

    try {
      await api.updateVariantStock(variantId, qty);
      showNotification('Stock updated successfully!');
      if (selectedProduct) {
        handleSelectProduct(selectedProduct.slug);
      }
      await loadData();
    } catch (err) {
      showNotification(`Error updating stock: ${err.message}`, 'error');
    }
  };

  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm('Delete this size/color variant?')) return;
    try {
      await api.deleteVariant(variantId);
      showNotification('Variant deleted.');
      if (selectedProduct) {
        handleSelectProduct(selectedProduct.slug);
      }
      await loadData();
    } catch (err) {
      showNotification(`Failed to delete variant: ${err.message}`, 'error');
    }
  };

  const handleAddSingleVariant = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      const cleanPrefix = selectedProduct.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
      const sku = singleVariantForm.sku || `${cleanPrefix}-${singleVariantForm.color.slice(0, 3).toUpperCase()}-${singleVariantForm.size}-${Date.now().toString().slice(-4)}`;

      await api.createVariant(selectedProduct.id, {
        product_id: selectedProduct.id,
        sku,
        size: singleVariantForm.size,
        color: singleVariantForm.color,
        price: parseFloat(singleVariantForm.price),
        available_quantity: parseInt(singleVariantForm.quantity, 10),
      });

      showNotification('Variant added to product!');
      setShowAddVariantModal(false);
      handleSelectProduct(selectedProduct.slug);
      await loadData();
    } catch (err) {
      showNotification(`Error adding variant: ${err.message}`, 'error');
    }
  };

  // -------------------------------------------------------------
  // CATEGORIES CRUD
  // -------------------------------------------------------------
  const handleCreateCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      const created = await api.createCategory({
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        image_url: categoryForm.image_url.trim() || 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
        display_order: parseInt(categoryForm.display_order, 10) || 1,
        is_active: true,
      });
      showNotification(`Category "${created.name}" created!`);
      setShowAddCategoryModal(false);
      setCategoryForm({ id: '', name: '', description: '', image_url: '', icon: 'Sparkles', display_order: 1 });
      await loadData();
    } catch (err) {
      showNotification(`Failed to add category: ${err.message}`, 'error');
    }
  };

  const openEditCategoryModal = (cat) => {
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      description: cat.description || '',
      image_url: cat.image_url || '',
      icon: cat.icon || 'Sparkles',
      display_order: cat.display_order || 1,
    });
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategorySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.updateCategory(categoryForm.id, {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        image_url: categoryForm.image_url.trim(),
        display_order: parseInt(categoryForm.display_order, 10) || 1,
      });
      showNotification('Category updated successfully!');
      setShowEditCategoryModal(false);
      await loadData();
    } catch (err) {
      showNotification(`Update failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteCategory = async (catId, catName) => {
    if (!catId) return;
    try {
      await api.deleteCategory(catId);
      showNotification(`Category "${catName || 'Category'}" deleted.`);
      setCategoryToDelete(null);
      await loadData();
    } catch (err) {
      showNotification(`Cannot delete: ${err.message}`, 'error');
    }
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

    // Parse CSV preview respecting quotes and comma-separated multiple image URLs
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
  // BULK CSV IMPORT & EXPORT (CATEGORIES TAXONOMY)
  // -------------------------------------------------------------
  const handleDownloadCategorySampleCsv = () => {
    const csvContent =
      'Category Name,Description,Image URL,Icon,Display Order,Is Active\n' +
      'Dresses,"Luxury evening gowns, cocktail midi dresses, and casual linen frocks.","https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80",Sparkles,1,Yes\n' +
      'Tops & Shirts,"Crisp linen button-downs, silk blouses, and everyday tailored shirts.","https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80",Shirt,2,Yes\n' +
      'Outerwear & Jackets,"Cashmere blend coats, structured tailored blazers, and trench coats.","https://images.unsplash.com/photo-1539533018447-63fcce667883?auto=format&fit=crop&w=600&q=80",Layers,3,Yes\n' +
      'Pants & Bottoms,"Tailored trousers, linen wide-leg pants, and chic denim skirts.","https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80",Tag,4,Yes\n' +
      'Accessories & Bags,"Structured leather totes, statement belts, and boutique silk scarves.","https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",ShoppingBag,5,Yes\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fashion_categories_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCategoryCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCategoryCsvFile(file);

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
      setCategoryCsvPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const handleCategoryBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!categoryCsvFile) return showNotification('Please select a Category CSV file to upload', 'error');

    try {
      setCategoryCsvImporting(true);
      const res = await api.bulkImportCategoriesCsv(categoryCsvFile);
      showNotification(
        `Category Import Successful! Imported ${res.imported_categories} new, updated ${res.updated_categories} categories.`
      );
      setShowCategoryBulkImportModal(false);
      setCategoryCsvFile(null);
      setCategoryCsvPreviewRows([]);
      await loadData();
    } catch (err) {
      showNotification(`Category import failed: ${err.message}`, 'error');
    } finally {
      setCategoryCsvImporting(false);
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategoryFilter === 'All' || p.category.toLowerCase() === selectedCategoryFilter.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLowStock = !filterLowStockOnly || (p.total_stock || 0) < 5;
    return matchesCategory && matchesSearch && matchesLowStock;
  });

  // Calculate totals
  const totalStockAcrossAll = products.reduce((acc, p) => acc + (p.total_stock || 0), 0);
  const lowStockCount = products.filter((p) => (p.total_stock || 0) < 5).length;

  return (
    <div>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header with Navigation Tabs & Action Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Fashion Atelier Catalog
            </h2>
            <div
              style={{
                display: 'inline-flex',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-full)',
                padding: '3px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('PRODUCTS')}
                style={{
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'PRODUCTS' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'PRODUCTS' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                Products ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('CATEGORIES')}
                style={{
                  padding: '4px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'CATEGORIES' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'CATEGORIES' ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                Categories ({categories.length})
              </button>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Live sync with WhatsApp AI Assistant, real-time inventory, multi-variant sizing & bulk import
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {activeTab === 'CATEGORIES' ? (
            <>
              <a
                href={api.getExportCategoriesCsvUrl()}
                download="boutique_categories_export.csv"
                className="btn btn-secondary"
                title="Download all categories as CSV"
                style={{ textDecoration: 'none' }}
              >
                <Download size={16} />
                <span>Export Categories CSV</span>
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCategoryBulkImportModal(true)}
                title="Upload CSV with taxonomy categories"
              >
                <FileSpreadsheet size={16} />
                <span>Bulk Import Categories</span>
              </button>
              <button className="btn btn-primary" onClick={() => setShowAddCategoryModal(true)}>
                <Plus size={16} />
                <span>Add Category</span>
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginBottom: '20px',
        }}
      >
        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shirt size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Active Catalog</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{products.length} Items</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total In-Stock Units</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{totalStockAcrossAll} Units</div>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Taxonomy Categories</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{categories.length} Categories</div>
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
            if (!filterLowStockOnly) setSelectedCategoryFilter('All');
          }}
          title="Click to toggle filtering products with stock < 5"
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: lowStockCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: lowStockCount > 0 ? '#f87171' : '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Low Stock Alert</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
              {lowStockCount} Items &lt; 5 {filterLowStockOnly && '(Filtering)'}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PRODUCTS VIEW                                     */}
      {/* ======================================================== */}
      {activeTab === 'PRODUCTS' && (
        <div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setSelectedCategoryFilter('All')}
                className={`filter-pill ${selectedCategoryFilter === 'All' ? 'active' : ''}`}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-glass)',
                  background: selectedCategoryFilter === 'All' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                  color: selectedCategoryFilter === 'All' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                All Products ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(c.name)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--border-glass)',
                    background: selectedCategoryFilter === c.name ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                    color: selectedCategoryFilter === c.name ? '#fff' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {c.name} ({c.product_count || 0})
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                type="text"
                placeholder="Search products or fabrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="chat-input"
                style={{
                  width: '100%',
                  paddingLeft: '36px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Main 2-Column Catalog & Detail Pane */}
          <div style={{ display: 'grid', gridTemplateColumns: selectedProduct ? 'minmax(0, 1fr) 420px' : '1fr', gap: '24px' }}>
            {/* Products Grid */}
            <div className="products-grid" style={{ gridTemplateColumns: selectedProduct ? 'repeat(auto-fill, minmax(320px, 1fr))' : 'repeat(auto-fill, minmax(360px, 1fr))' }}>
              {filteredProducts.length === 0 ? (
                <div className="glass-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px 24px' }}>
                  <Package size={52} style={{ color: 'var(--text-dim)', marginBottom: '14px' }} />
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>No Products Found</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
                    {searchQuery
                      ? `No catalog items matched "${searchQuery}". Try a different keyword.`
                      : 'No items in this category yet. Click below to add a new luxury dress or top.'}
                  </p>
                  <button className="btn btn-primary" onClick={() => setShowAddProductModal(true)}>
                    <Plus size={16} />
                    <span>Create Multi-Variant Product</span>
                  </button>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = selectedProduct?.id === p.id;
                  const priceDisplay =
                    p.min_price === p.max_price
                      ? `PKR ${(p.min_price || 14000).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `PKR ${p.min_price?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - PKR ${p.max_price?.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                  return (
                    <div
                      key={p.id}
                      className={`glass-card product-card ${isSelected ? 'active' : ''}`}
                      style={{
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                        transition: 'transform 0.2s, border-color 0.2s',
                        position: 'relative',
                      }}
                      onClick={() => handleSelectProduct(p.slug)}
                    >
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
                        style={{ height: '220px', objectFit: 'cover' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
                      <div className="product-body" style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
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
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
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

                        <h3 className="product-title" style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
                          {p.name}
                        </h3>

                        <p
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '0.8rem',
                            lineHeight: 1.4,
                            marginBottom: '12px',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {p.description || 'Boutique handcrafted luxury garment.'}
                        </p>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            paddingTop: '10px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-dim)' }}>
                            {p.variant_count || 0} variant(s)
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: (p.total_stock || 0) > 0 ? 'var(--primary)' : '#f87171',
                            }}
                          >
                            {(p.total_stock || 0) > 0 ? `${p.total_stock} in stock` : 'Out of Stock'}
                          </span>
                        </div>

                        {/* Quick Card Action Buttons */}
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginTop: '10px',
                            paddingTop: '8px',
                            borderTop: '1px dashed rgba(255,255,255,0.08)',
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ flex: 1, minWidth: '90px', padding: '6px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditProductModal(p);
                            }}
                            title="Edit Product Details"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setProductToDelete(p);
                            }}
                            title="Delete Product"
                          >
                            <Trash2 size={13} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected Product & Multi-Variants Drawer */}
            <div className="glass-card" style={{ height: 'fit-content', position: 'sticky', top: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  borderBottom: '1px solid var(--border-glass)',
                  paddingBottom: '12px',
                }}
              >
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SlidersHorizontal size={18} style={{ color: 'var(--primary)' }} />
                  <span>Variant Matrix & Stock</span>
                </h3>
                {selectedProduct && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px', fontSize: '0.75rem' }}
                      title="Edit Product"
                      onClick={() => openEditProductModal(selectedProduct)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px', fontSize: '0.75rem', color: '#f87171' }}
                      title="Delete Product"
                      onClick={() => setProductToDelete(selectedProduct)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {selectedProduct ? (
                <div>
                  {/* Product Header */}
                  <div style={{ display: 'flex', gap: '14px', marginBottom: '16px', alignItems: 'center' }}>
                    <div
                      style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => setPreviewGalleryProduct(selectedProduct)}
                      title="Click to inspect imagery & zoom"
                    >
                      <img
                        src={getProductImageUrl(selectedProduct.image_urls?.[0])}
                        alt={selectedProduct.name}
                        style={{ width: '68px', height: '68px', borderRadius: '8px', objectFit: 'cover', border: '1.5px solid rgba(212, 175, 55, 0.4)' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80';
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '3px',
                          right: '3px',
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(212, 175, 55, 0.5)',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary)',
                        }}
                      >
                        <ZoomIn size={11} />
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
                        {selectedProduct.name}
                      </h4>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Category: <b style={{ color: 'var(--accent-indigo)' }}>{selectedProduct.category}</b>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <button
                          type="button"
                          style={{
                            background: 'rgba(212, 175, 55, 0.15)',
                            border: '1px solid rgba(212, 175, 55, 0.35)',
                            color: '#fef08a',
                            fontSize: '0.72rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontWeight: 600,
                          }}
                          onClick={() => setPreviewGalleryProduct(selectedProduct)}
                        >
                          <ZoomIn size={12} /> View Gallery & Zoom ({selectedProduct.image_urls?.length || 1})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Variants Header & Add Variant Button */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Available Variants ({selectedProduct.variants?.length || 0})
                    </div>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      onClick={() => setShowAddVariantModal(true)}
                    >
                      <Plus size={12} />
                      <span>Add Variant</span>
                    </button>
                  </div>

                  {/* Variants List */}
                  {!selectedProduct.variants || selectedProduct.variants.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'center',
                        fontSize: '0.85rem',
                        color: 'var(--text-dim)',
                      }}
                    >
                      No size or color variants found. Click "Add Variant" to create one.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                      {selectedProduct.variants.map((v) => {
                        const isOutOfStock = v.available_quantity <= 0;
                        return (
                          <div
                            key={v.id}
                            style={{
                              padding: '10px 12px',
                              background: 'rgba(255, 255, 255, 0.03)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-glass)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    background: 'rgba(255,255,255,0.1)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 700,
                                    color: '#fff',
                                  }}
                                >
                                  {v.size || 'M'}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                                  {v.color || 'Default'}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                SKU: <code>{v.sku}</code> • ${v.price?.toFixed(2)}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <button
                                className="btn btn-secondary"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '4px 8px',
                                  borderColor: isOutOfStock ? '#ef4444' : undefined,
                                }}
                                onClick={() => handleUpdateStock(v.id, v.available_quantity)}
                                title="Click to edit inventory count"
                              >
                                Stock: <b style={{ color: isOutOfStock ? '#ef4444' : 'var(--primary)', marginLeft: '4px' }}>{v.available_quantity}</b>
                              </button>
                              <button
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--text-dim)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                title="Delete variant"
                                onClick={() => handleDeleteVariant(v.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px 16px' }}>
                  Select any product from the catalog on the left to view its size and color variants.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CATEGORIES TAXONOMY VIEW                          */}
      {/* ======================================================== */}
      {activeTab === 'CATEGORIES' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
            }}
          >
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="glass-card"
                style={{
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid var(--border-glass)',
                }}
              >
                <div style={{ position: 'relative', height: '140px' }}>
                  <img
                    src={cat.image_url || 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80'}
                    alt={cat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(15, 23, 42, 0.9), transparent)',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(4px)',
                      color: 'var(--primary)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    Order #{cat.display_order || 1}
                  </span>
                </div>

                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>{cat.name}</h3>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontWeight: 700,
                      }}
                    >
                      {cat.product_count || 0} Products
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: 1, marginBottom: '14px' }}>
                    {cat.description || 'Fashion collection for personalized recommendations.'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      paddingTop: '12px',
                    }}
                  >
                    <code style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>slug: {cat.slug}</code>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                        onClick={() => openEditCategoryModal(cat)}
                      >
                        <Edit3 size={13} />
                        <span>Edit</span>
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#f87171' }}
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD MULTI-VARIANT PRODUCT                       */}
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
          <div
            className="glass-card"
            style={{
              width: '800px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Create Multi-Variant Fashion Product</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Configure product details, select multiple colors and sizes, and auto-generate SKU matrix.
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    placeholder="e.g. Royal Emerald Velvet Anarkali"
                    value={productForm.name}
                    onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                    Category *
                  </label>
                  <select
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)', background: '#1e293b' }}
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description & Image URLs */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Description & Styling Notes
                </label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '70px', resize: 'none' }}
                  placeholder="Fabric composition, occasion styling advice, and fit description..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                />
              </div>

              {/* Product Images: File Upload & URL input */}
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
                    <Upload size={14} style={{ color: 'var(--primary)' }} /> Product Images (Multiple Local Files & URLs)
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
                  placeholder="Or paste external image URLs separated by commas..."
                  value={productForm.image_urls}
                  onChange={(e) => setProductForm({ ...productForm, image_urls: e.target.value })}
                />

                {/* Live Attached Image Thumbnails */}
                {productForm.image_urls && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                    {productForm.image_urls
                      .split(',')
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((imgUrl, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            width: '74px',
                            height: '74px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                            background: '#0f172a',
                          }}
                        >
                          <img
                            src={getProductImageUrl(imgUrl)}
                            alt={`Preview ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                            }}
                          />
                          {idx === 0 && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'rgba(16, 185, 129, 0.9)',
                                color: '#fff',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                textAlign: 'center',
                                padding: '1px 0',
                              }}
                            >
                              COVER
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx, 'create')}
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

                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Seasonal Collection:
                  </label>
                  <select
                    className="chat-input"
                    style={{ borderRadius: 'var(--radius-md)', padding: '5px 12px', fontSize: '0.8rem', background: '#1e293b' }}
                    value={productForm.season}
                    onChange={(e) => setProductForm({ ...productForm, season: e.target.value })}
                  >
                    <option value="Summer">☀️ Summer Collection</option>
                    <option value="Spring">🌸 Spring Collection</option>
                    <option value="Autumn">🍂 Autumn / Fall</option>
                    <option value="Winter">❄️ Winter Collection</option>
                    <option value="All-Season">✨ All-Season Classics</option>
                  </select>
                </div>
              </div>

              {/* SECTION: MULTI-VARIANT BUILDER */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '18px',
                  marginBottom: '20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                    <span>Variant Matrix Generator (Multiple Colors & Sizes)</span>
                  </h4>
                </div>

                {/* 1. Colors Selector */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Select Colors for this dress/product:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    {SUGGESTED_COLORS.map((col) => {
                      const isChecked = productForm.selectedColors.includes(col);
                      return (
                        <button
                          key={col}
                          type="button"
                          onClick={() => handleColorToggle(col)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                            background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                            color: isChecked ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {isChecked && <Check size={12} />}
                          <span>{col}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Color */}
                  <div style={{ display: 'flex', gap: '8px', maxWidth: '320px' }}>
                    <input
                      type="text"
                      placeholder="Add custom color (e.g. Lavender)..."
                      className="chat-input"
                      style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}
                      value={productForm.newColorInput}
                      onChange={(e) => setProductForm({ ...productForm, newColorInput: e.target.value })}
                    />
                    <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleAddCustomColor}>
                      Add
                    </button>
                  </div>
                </div>

                {/* 2. Sizes Selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                    Select Sizes:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {COMMON_SIZES.map((sz) => {
                      const isChecked = productForm.selectedSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => handleSizeToggle(sz)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: isChecked ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                            background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                            color: isChecked ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {isChecked && <Check size={12} />}
                          <span>{sz}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Base Price & Stock */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Default Unit Price ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="chat-input"
                      style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                      value={productForm.basePrice}
                      onChange={(e) => setProductForm({ ...productForm, basePrice: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
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
                    className="btn btn-primary"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={generateVariantMatrix}
                  >
                    <RefreshCw size={14} />
                    <span>Generate Variant Matrix</span>
                  </button>
                </div>

                {/* 4. Generated Matrix Table */}
                {productForm.generatedVariants.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
                      Generated {productForm.generatedVariants.length} Combinations:
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px' }}>Color</th>
                            <th style={{ padding: '8px' }}>Size</th>
                            <th style={{ padding: '8px' }}>SKU</th>
                            <th style={{ padding: '8px' }}>Price ($)</th>
                            <th style={{ padding: '8px' }}>Stock</th>
                            <th style={{ padding: '8px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {productForm.generatedVariants.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.color}</td>
                              <td style={{ padding: '6px 8px' }}>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {row.size}
                                </span>
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  type="text"
                                  className="chat-input"
                                  style={{ padding: '3px 6px', fontSize: '0.75rem', width: '130px', borderRadius: '4px' }}
                                  value={row.sku}
                                  onChange={(e) => handleUpdateMatrixRow(idx, 'sku', e.target.value)}
                                />
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="chat-input"
                                  style={{ padding: '3px 6px', fontSize: '0.75rem', width: '70px', borderRadius: '4px' }}
                                  value={row.price}
                                  onChange={(e) => handleUpdateMatrixRow(idx, 'price', parseFloat(e.target.value))}
                                />
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <input
                                  type="number"
                                  className="chat-input"
                                  style={{ padding: '3px 6px', fontSize: '0.75rem', width: '60px', borderRadius: '4px' }}
                                  value={row.available_quantity}
                                  onChange={(e) => handleUpdateMatrixRow(idx, 'available_quantity', parseInt(e.target.value, 10))}
                                />
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMatrixRow(idx)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                                >
                                  <Trash2 size={13} />
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

              {/* Form Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 700 }}>
                  <Check size={16} />
                  <span>Save Product &amp; Variants</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT PRODUCT DETAILS                            */}
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
          <div className="glass-card" style={{ width: '560px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Edit Product Details</h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowEditProductModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateProductSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Product Name</label>
                <input
                  type="text"
                  required
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={editProductForm.name}
                  onChange={(e) => setEditProductForm({ ...editProductForm, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category</label>
                <select
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', background: '#1e293b' }}
                  value={editProductForm.category}
                  onChange={(e) => setEditProductForm({ ...editProductForm, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '70px', resize: 'none' }}
                  value={editProductForm.description}
                  onChange={(e) => setEditProductForm({ ...editProductForm, description: e.target.value })}
                />
              </div>

              {/* Product Images: File Upload & URL input */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={13} style={{ color: 'var(--primary)' }} /> Product Images (Upload Files & URLs)
                  </label>
                  <label
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={12} />
                    <span>Upload Local</span>
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
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}
                  placeholder="Or paste external image URLs separated by commas..."
                  value={editProductForm.image_urls}
                  onChange={(e) => setEditProductForm({ ...editProductForm, image_urls: e.target.value })}
                />

                {/* Live Attached Image Thumbnails */}
                {editProductForm.image_urls && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                    {editProductForm.image_urls
                      .split(',')
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((imgUrl, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            width: '64px',
                            height: '64px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                            background: '#0f172a',
                          }}
                        >
                          <img
                            src={getProductImageUrl(imgUrl)}
                            alt={`Preview ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=200&q=80';
                            }}
                          />
                          {idx === 0 && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'rgba(16, 185, 129, 0.9)',
                                color: '#fff',
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                textAlign: 'center',
                                padding: '1px 0',
                              }}
                            >
                              COVER
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx, 'edit')}
                            style={{
                              position: 'absolute',
                              top: '2px',
                              right: '2px',
                              background: 'rgba(0,0,0,0.7)',
                              border: 'none',
                              color: '#fff',
                              borderRadius: '50%',
                              width: '16px',
                              height: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            title="Remove image"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* SECTION: SALE, PROMO CODE & SEASON SHOWCASE */}
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

                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Season Collection:
                  </label>
                  <select
                    className="chat-input"
                    style={{ borderRadius: 'var(--radius-md)', padding: '4px 10px', fontSize: '0.78rem', background: '#1e293b' }}
                    value={editProductForm.season}
                    onChange={(e) => setEditProductForm({ ...editProductForm, season: e.target.value })}
                  >
                    <option value="Summer">☀️ Summer Collection</option>
                    <option value="Spring">🌸 Spring Collection</option>
                    <option value="Autumn">🍂 Autumn / Fall</option>
                    <option value="Winter">❄️ Winter Collection</option>
                    <option value="All-Season">✨ All-Season Classics</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditProductModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ADD SINGLE VARIANT TO SELECTED PRODUCT          */}
      {/* ======================================================== */}
      {showAddVariantModal && (
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
          <div className="glass-card" style={{ width: '480px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add Variant to {selectedProduct?.name}</h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowAddVariantModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSingleVariant}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Size</label>
                  <input
                    type="text"
                    required
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    placeholder="M"
                    value={singleVariantForm.size}
                    onChange={(e) => setSingleVariantForm({ ...singleVariantForm, size: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Color</label>
                  <input
                    type="text"
                    required
                    className="chat-input"
                    style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                    placeholder="Emerald Green"
                    value={singleVariantForm.color}
                    onChange={(e) => setSingleVariantForm({ ...singleVariantForm, color: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Price ($)</label>
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
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Available Stock</label>
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
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Custom SKU (Optional)</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  placeholder="Auto-generated if empty"
                  value={singleVariantForm.sku}
                  onChange={(e) => setSingleVariantForm({ ...singleVariantForm, sku: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddVariantModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Variant</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: ADD / EDIT CATEGORY                             */}
      {/* ======================================================== */}
      {(showAddCategoryModal || showEditCategoryModal) && (
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
          <div className="glass-card" style={{ width: '500px', maxWidth: '90vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {showEditCategoryModal ? 'Edit Fashion Category' : 'Create New Category'}
              </h3>
              <button
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => {
                  setShowAddCategoryModal(false);
                  setShowEditCategoryModal(false);
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={showEditCategoryModal ? handleUpdateCategorySubmit : handleCreateCategorySubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Category Name *</label>
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

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)', height: '60px', resize: 'none' }}
                  placeholder="Brief guidance for customers and AI stylist..."
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Cover Image URL</label>
                <input
                  type="text"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  placeholder="https://images.unsplash.com/..."
                  value={categoryForm.image_url}
                  onChange={(e) => setCategoryForm({ ...categoryForm, image_url: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Display Order</label>
                <input
                  type="number"
                  className="chat-input"
                  style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
                  value={categoryForm.display_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, display_order: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddCategoryModal(false);
                    setShowEditCategoryModal(false);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {showEditCategoryModal ? 'Save Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: BULK CSV IMPORT MODAL                           */}
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
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Bulk CSV Catalog Ingestion</h3>
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
                marginBottom: '20px',
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
                marginBottom: '14px',
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
                  "https://img1.jpg, https://img2.jpg, https://img3.jpg"
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
                CSV me <code style={{ color: '#818cf8', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Size</code> column me multiple sizes (e.g. <code>"S,M,L,XL"</code>) aur <code style={{ color: '#818cf8', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Stock Quantity</code> column me matching quantities (e.g. <code>"10,11,23,19"</code>) de sakte hain! System automatically har size ka variant uski corresponding quantity ke saath create kar dega.
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
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-muted)' }}>
                    Preview (First 5 Rows):
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <tr>
                          <th style={{ padding: '8px 6px', color: '#94a3b8' }}>Product</th>
                          <th style={{ padding: '8px 6px', color: '#94a3b8' }}>Category</th>
                          <th style={{ padding: '8px 6px', color: '#94a3b8' }}>Images Detected</th>
                          <th style={{ padding: '8px 6px', color: '#94a3b8' }}>Variant</th>
                          <th style={{ padding: '8px 6px', color: '#94a3b8' }}>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreviewRows.map((r, i) => {
                          const rawImgs = r[3] || '';
                          const imgCount = rawImgs ? rawImgs.split(',').filter((u) => u.trim()).length : 0;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '6px', fontWeight: 600 }}>{r[0]}</td>
                              <td style={{ padding: '6px', color: 'var(--accent-indigo)' }}>{r[1]}</td>
                              <td style={{ padding: '6px' }}>
                                <span style={{
                                  background: imgCount > 1 ? 'rgba(212, 175, 55, 0.18)' : 'rgba(255,255,255,0.06)',
                                  color: imgCount > 1 ? '#fef08a' : '#cbd5e1',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                }}>
                                  {imgCount > 1 ? `✓ ${imgCount} Images` : imgCount === 1 ? '1 Image' : 'Default'}
                                </span>
                              </td>
                              <td style={{ padding: '6px', color: 'var(--text-muted)' }}>
                                {r[5] || 'Color'} / {r[6] || 'Size'}
                              </td>
                              <td style={{ padding: '6px', color: 'var(--primary)', fontWeight: 700 }}>
                                ${r[7] || '49.99'}
                              </td>
                            </tr>
                          );
                        })}
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

      {/* ======================================================== */}
      {/* MODAL 6: CATEGORY BULK CSV IMPORT MODAL                   */}
      {/* ======================================================== */}
      {showCategoryBulkImportModal && (
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
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Bulk Category Taxonomy Ingestion</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  Upload a CSV spreadsheet with taxonomy categories, icons, and descriptions.
                </p>
              </div>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowCategoryBulkImportModal(false)}>
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
                marginBottom: '20px',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#818cf8', marginBottom: '2px' }}>
                  Need the Category CSV format?
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Download pre-formatted sample CSV with columns for Category Name, Description, Image URL, Icon, Display Order &amp; Is Active.
                </div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={handleDownloadCategorySampleCsv}>
                <Download size={14} />
                <span>Sample Categories CSV</span>
              </button>
            </div>

            {/* Category Fields Explanation Banner */}
            <div
              style={{
                background: 'rgba(212, 175, 55, 0.08)',
                border: '1px solid rgba(212, 175, 55, 0.28)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <Sparkles size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '0.8rem', lineHeight: '1.5', color: '#cbd5e1' }}>
                <span style={{ fontWeight: 700, color: '#fef08a' }}>Category-Only Data:</span>{' '}
                Category import me sirf categories ka relevant data add hota hai (<code style={{ color: 'var(--primary)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Category Name</code>, <code style={{ color: 'var(--primary)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Description</code>, <code style={{ color: 'var(--primary)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Image URL</code>, <code style={{ color: 'var(--primary)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Icon</code>, <code style={{ color: 'var(--primary)', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px' }}>Display Order</code>). Isme products, size ya colors shamil nahi hote.
              </div>
            </div>

            {/* File Upload Drop Zone */}
            <form onSubmit={handleCategoryBulkImportSubmit}>
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
                onClick={() => document.getElementById('categoryCsvFileInput').click()}
              >
                <Upload size={36} style={{ color: 'var(--primary)', marginBottom: '10px' }} />
                <h4 style={{ fontSize: '1rem', marginBottom: '4px' }}>
                  {categoryCsvFile ? categoryCsvFile.name : 'Click to select Category CSV File or drag & drop'}
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Supports .csv files with Category Taxonomy headers
                </p>
                <input
                  id="categoryCsvFileInput"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleCategoryCsvFileChange}
                />
              </div>

              {/* Preview Table */}
              {categoryCsvPreviewRows.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h5 style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-muted)' }}>
                    CSV Data Preview (First 5 Rows):
                  </h5>
                  <div style={{ overflowX: 'auto', maxHeight: '160px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <tbody>
                        {categoryCsvPreviewRows.map((r, rIdx) => (
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryBulkImportModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={categoryCsvImporting || !categoryCsvFile}
                  style={{ minWidth: '140px' }}
                >
                  {categoryCsvImporting ? (
                    <>
                      <RefreshCw size={14} className="spin-animation" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Import Categories</span>
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
                    <Sparkles size={14} /> Professional Zoom & Gallery Live Verification
                  </div>
                  Customers experience in-place precision lens zoom (2.8× HD) with cursor coordinates tracking, and can click any photo to open the Ultra-HD Fullscreen deep inspection lightbox with drag-to-pan and multi-angle thumbnails.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      {productToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content-card" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>Delete Product</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>This action cannot be undone.</p>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to permanently delete <strong style={{ color: '#fff' }}>"{productToDelete.name}"</strong>? This will remove all of its sizes, colors, and inventory variants.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setProductToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleDeleteProduct(productToDelete.id || productToDelete.slug, productToDelete.name)}
              >
                <Trash2 size={14} />
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content-card" style={{ maxWidth: '440px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#fff' }}>Delete Category</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>This action cannot be undone.</p>
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '20px' }}>
              Are you sure you want to delete category <strong style={{ color: '#fff' }}>"{categoryToDelete.name}"</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCategoryToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => handleDeleteCategory(categoryToDelete.id || categoryToDelete.slug, categoryToDelete.name)}
              >
                <Trash2 size={14} />
                <span>Delete Category</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
