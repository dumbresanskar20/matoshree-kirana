import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, Edit2, Archive, AlertTriangle, 
  User, History, Sparkles, Scale, RefreshCw, Check, X, AlertCircle,
  Utensils, Zap, ShieldCheck, ShieldAlert, Layers
} from 'lucide-react';
import api from '../services/api';
import { createAdminSocketClient } from '../services/socket';

const CATEGORY_ICONS = {
  groceries: '🛒',
  grains_pulses: '🌾',
  dairy_eggs: '🥛',
  dairy_proteins: '🥚',
  cooking_essentials: '🍳',
  oil_spices: '🌶️',
  snacks: '🍟',
  snack_essentials: '🍿',
  beverages: '🥤',
  vegetables: '🥗',
  other: '📦'
};

const getCategoryIcon = (catId) => {
  const clean = (catId || '').toLowerCase().trim();
  return CATEGORY_ICONS[clean] || '🏷️';
};

const formatCategoryTitle = (catId) => {
  if (!catId) return 'General';
  const clean = catId.toLowerCase().trim();
  if (clean === 'grains_pulses' || clean === 'grains & pulses') return 'Grains & Pulses';
  if (clean === 'cooking_essentials' || clean === 'cooking_essential' || clean === 'cooking essentials') return 'Cooking Essentials';
  if (clean === 'dairy_eggs' || clean === 'dairy & eggs') return 'Dairy & Eggs';
  if (clean === 'dairy_proteins') return 'Dairy & Proteins';
  if (clean === 'snack_essentials') return 'Snack Essentials';
  if (clean === 'oil_spices') return 'Oil & Spices';
  return clean.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const PREDEFINED_CATEGORIES = [
  { id: 'groceries', name: 'Groceries & Staples', icon: '🛒' },
  { id: 'grains_pulses', name: 'Grains & Pulses', icon: '🌾' },
  { id: 'dairy_eggs', name: 'Dairy & Eggs', icon: '🥛' },
  { id: 'cooking_essentials', name: 'Cooking Essentials', icon: '🍳' },
  { id: 'snacks', name: 'Snacks & Namkeen', icon: '🍟' },
  { id: 'beverages', name: 'Beverages', icon: '🥤' },
  { id: 'vegetables', name: 'Vegetables', icon: '🥗' },
  { id: 'other', name: 'Other', icon: '📦' }
];

export default function InventoryManagement() {
  // Data States
  const [items, setItems] = useState([]);
  const [storeCategories, setStoreCategories] = useState([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    activeItems: 0,
    outOfStockCount: 0,
    lowStockCount: 0
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);

  // Search & Pagination States
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState('all'); // 'all' | 'active' | 'inactive'
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit] = useState(8);

  // Modal Open/Close States
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  // Modal Form Inputs
  const [editingItem, setEditingItem] = useState(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('piece');
  const [category, setCategory] = useState('groceries');
  const [quantityInStock, setQuantityInStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [collapsedCategories, setCollapsedCategories] = useState({});

  const [restockingItem, setRestockingItem] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState('');

  const [loggingItem, setLoggingItem] = useState(null);
  const [activeLogs, setActiveLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // View Mode: 'raw' (Raw Warehouse Ingredients) vs 'menu_stock' (Prepared Menu Stock Portions)
  const [activeInventoryTab, setActiveInventoryTab] = useState('raw');

  // Prepared Menu Stock States
  const [menuStockItems, setMenuStockItems] = useState([]);
  const [stockTrackingEnabled, setStockTrackingEnabled] = useState(false);
  const [loadingMenuStock, setLoadingMenuStock] = useState(false);
  const [togglingTracking, setTogglingTracking] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuMealTypeFilter, setMenuMealTypeFilter] = useState('all');
  const [menuStockStatusFilter, setMenuStockStatusFilter] = useState('all');
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [editedQuantities, setEditedQuantities] = useState({});
  const [editedLimits, setEditedLimits] = useState({});

  // Get all unique categories in items, preserving store catalog categories first
  const getCategoriesList = () => {
    const list = [];
    const seen = new Set();

    // 1. Add categories loaded from store catalog windows
    storeCategories.forEach(c => {
      const key = (c.id || '').toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: key,
          name: c.name || formatCategoryTitle(key),
          icon: c.icon || getCategoryIcon(key),
        });
      }
    });

    // 2. Add categories present in inventory items
    items.forEach(item => {
      const catId = (item.category || 'other').toLowerCase();
      if (!seen.has(catId)) {
        seen.add(catId);
        list.push({
          id: catId,
          name: formatCategoryTitle(catId),
          icon: getCategoryIcon(catId),
        });
      }
    });

    // 3. Fallback to predefined categories if empty
    if (list.length === 0) {
      PREDEFINED_CATEGORIES.forEach(c => {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          list.push(c);
        }
      });
    }

    return list;
  };

  // Group items by category (exact same section as catalog)
  const getGroupedItems = () => {
    const categoriesList = getCategoriesList();
    const grouped = {};
    categoriesList.forEach(cat => {
      grouped[cat.id] = [];
    });

    items.forEach(item => {
      const cat = (item.category || 'other').toLowerCase();
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(item);
    });

    return grouped;
  };

  // Hooks
  useEffect(() => {
    fetchSummary();
    fetchMenuStock();
    fetchStoreCategories();

    const token = localStorage.getItem('token');
    let socket = null;
    if (token) {
      try {
        socket = createAdminSocketClient(token);
        socket.on('inventory:tracking_toggled', (payload) => {
          if (payload) {
            const isTracking = Boolean(payload.tracking_enabled ?? payload.trackingEnabled);
            setStockTrackingEnabled(isTracking);
          }
        });
        socket.on('menu:stock_updated', () => {
          fetchMenuStock();
          fetchItems();
          fetchSummary();
        });
        socket.on('inventory:stock_updated', () => {
          fetchItems();
          fetchSummary();
          fetchMenuStock();
        });
      } catch (e) {
        console.error('Socket init error in InventoryManagement:', e);
      }
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const fetchStoreCategories = async () => {
    try {
      const res = await api.get('/menu/windows');
      if (res.data?.windows) {
        const cats = res.data.windows
          .map((w) => ({
            id: (w.meal_type || '').toLowerCase(),
            name: w.category_name || formatCategoryTitle(w.meal_type),
            icon: w.icon || getCategoryIcon(w.meal_type),
          }))
          .filter((c) => Boolean(c.id));
        if (cats.length > 0) {
          setStoreCategories(cats);
        }
      }
    } catch (err) {
      console.warn('Failed to load store catalog categories for inventory:', err.message);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [search, filterActive, page]);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // 1. Fetch Dashboard Stats & Summary
  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const res = await api.get('/inventory/summary');
      if (res.data.success) {
        setStats(res.data.stats);
        setLowStockItems(res.data.lowStockItems || []);
        setRecentLogs(res.data.recentLogs || []);
      }
    } catch (err) {
      console.error('Error fetching inventory summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  // 2. Fetch Paginated & Searchable Items (Fetched with limit=1000 for category grouping)
  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      let url = `/inventory?limit=1000`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (filterActive !== 'all') url += `&is_active=${filterActive === 'active'}`;
      
      const res = await api.get(url);
      if (res.data.success) {
        setItems(res.data.items || []);
        setPages(1);
      }
    } catch (err) {
      console.error('Error loading inventory items:', err);
      showToast('Error loading inventory catalog.', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  // 3. Trigger Log Modal & Load Logs
  const openLogsModal = async (item) => {
    setLoggingItem(item);
    setIsLogsOpen(true);
    setLoadingLogs(true);
    try {
      const res = await api.get(`/inventory/${item.id}/logs`);
      if (res.data.success) {
        setActiveLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Error loading logs:', err);
      showToast('Could not fetch activity logs.', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  // 4. Trigger Add Modal
  const openAddModal = () => {
    setEditingItem(null);
    setName('');
    setUnit('piece');
    const availableCats = getCategoriesList();
    setCategory(availableCats.length > 0 ? availableCats[0].id : 'groceries');
    setQuantityInStock('0');
    setLowStockThreshold('1');
    setIsActive(true);
    setIsAddEditOpen(true);
  };

  // 5. Trigger Edit Modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setName(item.name);
    setUnit(item.unit);
    setCategory(item.category || 'other');
    setQuantityInStock(item.quantity_in_stock.toString());
    setLowStockThreshold(item.low_stock_threshold.toString());
    setIsActive(item.is_active);
    setIsAddEditOpen(true);
  };

  // 6. Trigger Restock Modal
  const openRestockModal = (item) => {
    setRestockingItem(item);
    setRestockQuantity('');
    setIsRestockOpen(true);
  };

  // 7. Save Item (Create or Update)
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!name.trim() || quantityInStock === '' || lowStockThreshold === '' || !category) {
      showToast('Please check and fill out all fields.', 'error');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      unit,
      quantity_in_stock: parseFloat(quantityInStock),
      low_stock_threshold: parseFloat(lowStockThreshold),
      is_active: isActive,
      category,
    };

    try {
      if (editingItem) {
        await api.put(`/inventory/${editingItem.id}`, payload);
        showToast(`Item '${name}' updated successfully!`);
      } else {
        await api.post('/inventory', payload);
        showToast(`New item '${name}' registered in inventory!`);
      }
      setIsAddEditOpen(false);
      fetchItems();
      fetchSummary();
      fetchMenuStock();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to save inventory item.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 8. Restock Item (Increment Stock & Sync with Product Catalog)
  const handleRestock = async (e) => {
    e.preventDefault();
    const qty = parseFloat(restockQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Please specify a positive number.', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/inventory/${restockingItem.id}/restock`, { quantity: qty });
      showToast(`Restocked +${qty} ${restockingItem.unit} for '${restockingItem.name}' (Synced with Product Catalog).`);
      setIsRestockOpen(false);
      fetchItems();
      fetchSummary();
      fetchMenuStock();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to restock item.';
      showToast(errMsg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 9. Hard Delete Item from Database
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${item.name}'? This will remove its stock logs and recipe mappings.`)) return;

    try {
      await api.delete(`/inventory/${item.id}`);
      showToast(`Item '${item.name}' deleted successfully.`);
      fetchItems();
      fetchSummary();
    } catch (err) {
      showToast('Error deleting item.', 'error');
    }
  };

  // 10. Fetch Prepared Menu Stock
  const fetchMenuStock = async () => {
    setLoadingMenuStock(true);
    try {
      const res = await api.get('/inventory/menu-stock');
      if (res.data?.success) {
        const isTracking = Boolean(res.data.tracking_enabled ?? res.data.trackingEnabled);
        setStockTrackingEnabled(isTracking);
        const list = res.data.items || [];
        setMenuStockItems(list);
        const qMap = {};
        const lMap = {};
        list.forEach((i) => {
          qMap[i.id] = i.available_quantity;
          lMap[i.id] = i.daily_stock_limit || 100;
        });
        setEditedQuantities(qMap);
        setEditedLimits(lMap);
      }
    } catch (err) {
      console.error('Failed to fetch menu stock:', err);
    } finally {
      setLoadingMenuStock(false);
    }
  };

  // 11. Toggle Master Menu Stock Tracking
  const handleToggleStockTracking = async () => {
    const nextState = !stockTrackingEnabled;
    setTogglingTracking(true);
    try {
      const res = await api.put('/inventory/menu-stock/toggle', { enabled: nextState });
      if (res.data?.success) {
        const isTracking = Boolean(res.data.tracking_enabled ?? res.data.trackingEnabled ?? nextState);
        setStockTrackingEnabled(isTracking);
        showToast(
          isTracking
            ? 'Menu Stock Tracking Activated! Portions will auto-deduct on user orders.'
            : 'Menu Stock Tracking Deactivated. Unlimited ordering restored.'
        );
      }
    } catch (err) {
      showToast('Failed to update tracking setting', 'error');
    } finally {
      setTogglingTracking(false);
    }
  };

  // 12. Update Individual Item Portions & In-Stock Status
  const handleUpdateItemStock = async (item, targetQty, targetAvail, targetLimit) => {
    const qty = targetQty !== undefined 
      ? parseInt(targetQty, 10) 
      : (editedQuantities[item.id] !== undefined ? parseInt(editedQuantities[item.id], 10) : item.available_quantity);
    if (isNaN(qty) || qty < 0) {
      showToast('Please enter a valid portion quantity', 'error');
      return;
    }
    const limit = targetLimit !== undefined 
      ? parseInt(targetLimit, 10) 
      : (editedLimits[item.id] !== undefined ? parseInt(editedLimits[item.id], 10) : (item.daily_stock_limit || 100));
    const avail = targetAvail !== undefined 
      ? (targetAvail ? 1 : 0) 
      : (qty === 0 ? 0 : item.is_available);

    setUpdatingItemId(item.id);
    try {
      const res = await api.put(`/inventory/menu-stock/${item.id}`, {
        available_quantity: qty,
        daily_stock_limit: limit,
        is_available: avail
      });
      if (res.data?.success) {
        showToast(`'${item.name}' updated: ${qty} portions (${avail ? 'In Stock' : 'Out of Stock'})`);
        setMenuStockItems(prev => prev.map(m => m.id === item.id ? { ...m, available_quantity: qty, daily_stock_limit: limit, is_available: avail } : m));
        setEditedQuantities(prev => ({ ...prev, [item.id]: qty }));
        setEditedLimits(prev => ({ ...prev, [item.id]: limit }));
      }
    } catch (err) {
      showToast('Failed to update portion stock', 'error');
    } finally {
      setUpdatingItemId(null);
    }
  };

  // 13. Batch Reset Portions for All Active Items
  const handleBatchStockReset = async (qty = 50) => {
    if (!window.confirm(`Set all ${menuStockItems.length} active menu items to ${qty} portions and In-Stock?`)) return;
    setSaving(true);
    try {
      const payloadItems = menuStockItems.map(m => ({
        id: m.id,
        available_quantity: qty,
        daily_stock_limit: qty,
        is_available: 1
      }));
      const res = await api.post('/inventory/menu-stock/batch', { items: payloadItems });
      if (res.data?.success) {
        showToast(`Successfully reset all active menu items to ${qty} portions!`);
        fetchMenuStock();
      }
    } catch (err) {
      showToast('Failed to batch update portions', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-6">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl border font-bold text-sm flex items-center gap-2.5 animate-in slide-in-from-top-3 ${
            notification.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notification.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-600" /> : <Check className="w-5 h-5 text-emerald-600" />}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Total Inventory</h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Maintain grocery stock, map item weights, and view auto-depletion records
              </p>
            </div>

            <button
              onClick={openAddModal}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm px-6 py-3 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer min-h-[44px]"
            >
              <Plus className="w-5 h-5" />
              <span>Register New Stock Item</span>
            </button>
          </div>

          {/* Stats Summary Cards: Responsive grid 1 col mobile, 2 tablet, 4 desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 text-2xl font-bold">
                📦
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Items</p>
                <h3 className="text-2xl font-black text-slate-900">{stats.totalItems}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl font-bold border border-emerald-100">
                🌱
              </div>
              <div>
                <p className="text-emerald-600/70 text-[10px] font-bold uppercase tracking-wider">Active Stock</p>
                <h3 className="text-2xl font-black text-emerald-800">{stats.activeItems}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${
                stats.outOfStockCount > 0 ? 'bg-red-50 text-red-600 border border-red-100 animate-pulse' : 'bg-slate-100 text-slate-400'
              }`}>
                🚨
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Out of Stock</p>
                <h3 className={`text-2xl font-black ${stats.outOfStockCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.outOfStockCount}</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold ${
                stats.lowStockCount > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-400'
              }`}>
                ⚠️
              </div>
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Low Stock Level</p>
                <h3 className={`text-2xl font-black ${stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{stats.lowStockCount}</h3>
              </div>
            </div>
          </div>

          {/* Grid: Low Stock Alerts & Recent Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Low Stock Alerts (Left 1/3) */}
            <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-auto min-h-[360px]">
              <div className="space-y-4 overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Low Stock Alerts</h3>
                  </div>
                  <span className="bg-amber-100 text-amber-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                    {lowStockItems.length + stats.outOfStockCount} items
                  </span>
                </div>

                {loadingSummary ? (
                  <div className="text-center py-10 text-xs text-slate-400 font-medium">Analyzing stock levels...</div>
                ) : (lowStockItems.length === 0 && stats.outOfStockCount === 0) ? (
                  <div className="text-center py-14">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center mx-auto text-lg mb-3">✓</div>
                    <p className="text-xs font-bold text-slate-700">All stocks are healthy!</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ingredients are well above thresholds</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {items.filter(i => i.is_active && (Number(i.quantity_in_stock) <= Number(i.low_stock_threshold))).map((item) => {
                      const qty = Number(item.quantity_in_stock);
                      const isDepleted = qty <= 0;
                      return (
                        <div 
                          key={item.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 ${
                            isDepleted ? 'bg-red-50/55 border-red-200' : 'bg-amber-50/40 border-amber-200/80'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-slate-800 truncate">{item.name}</p>
                            <p className="text-[9px] font-semibold text-slate-400">
                              Threshold: {item.low_stock_threshold} {item.unit}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2.5 shrink-0">
                            <span className={`text-xs font-black ${isDepleted ? 'text-red-700' : 'text-amber-700'}`}>
                              {qty} {item.unit}
                            </span>
                            <button
                              onClick={() => openRestockModal(item)}
                              className="bg-white hover:bg-slate-50 border text-[10px] font-extrabold px-2.5 py-1 rounded-lg text-slate-700 transition shadow-sm cursor-pointer min-h-[36px]"
                            >
                              Restock
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="pt-2 text-[10px] text-slate-400 font-semibold text-center border-t border-slate-100 mt-3">
                *Depleted items will disable linked user meals
              </div>
            </div>

            {/* Recent Inventory Logs (Right 2/3) */}
            <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm h-auto min-h-[360px] flex flex-col justify-between">
              <div className="space-y-4 overflow-y-auto flex-1">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">Recent Activity Log</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Feeds</span>
                </div>

                {loadingSummary ? (
                  <div className="text-center py-10 text-xs text-slate-400 font-medium">Fetching history...</div>
                ) : recentLogs.length === 0 ? (
                  <div className="text-center py-14 text-xs text-slate-400 font-semibold">
                    No inventory logs found. Restock items to start history.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {recentLogs.map((log) => {
                      const isRestock = log.action_type === 'restock';
                      return (
                        <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition text-xs gap-2">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${isRestock ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <div>
                              <p className="font-bold text-slate-800">
                                {isRestock ? 'Restocked' : 'Deducted'} {log.inventory_item?.name}
                              </p>
                              <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center sm:justify-end gap-2 text-right">
                            <span className={`font-extrabold ${isRestock ? 'text-emerald-700' : 'text-red-700'}`}>
                              {isRestock ? '+' : ''}{log.quantity_changed} {log.inventory_item?.unit}
                            </span>
                            
                            {log.admin_user && (
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                                👤 {log.admin_user.username}
                              </span>
                            )}

                            {log.order && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold px-2 py-0.5 rounded-md">
                                🎫 {log.order.token_number || `Order #${log.order.id}`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Main Stock Table */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            {/* Filters and Search: Wrap cleanly on mobile */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by ingredient name or unique ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium min-h-[44px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const collapsed = {};
                      getCategoriesList().forEach(c => {
                        collapsed[c.id] = true;
                      });
                      setCollapsedCategories(collapsed);
                    }}
                    className="px-3.5 py-1.5 rounded-xl border text-[11px] font-extrabold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm cursor-pointer min-h-[40px]"
                  >
                    Collapse All
                  </button>
                  <button
                    onClick={() => {
                      setCollapsedCategories({});
                    }}
                    className="px-3.5 py-1.5 rounded-xl border text-[11px] font-extrabold text-slate-700 bg-white hover:bg-slate-50 transition shadow-sm cursor-pointer min-h-[40px]"
                  >
                    Expand All
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 font-semibold">
                  {[
                    { id: 'all', label: 'All Items' },
                    { id: 'active', label: 'Active Only' },
                    { id: 'inactive', label: 'Inactive' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setFilterActive(opt.id);
                        setPage(1);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition min-h-[36px] ${
                        filterActive === opt.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Stock Catalog Grouped by Category */}
            {loadingItems ? (
              <div className="text-center py-16 text-slate-400 font-bold">Retrieving inventory items...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 border rounded-xl border-dashed border-slate-200">
                <p className="font-bold text-slate-600">No inventory items found.</p>
                <p className="text-xs text-slate-400 mt-1">Register new raw grocery materials to populate catalog.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const categoriesList = getCategoriesList();
                  const groupedItems = getGroupedItems();
                  const isSearching = search.trim() !== '';

                  return categoriesList.map(cat => {
                    const catItems = groupedItems[cat.id] || [];

                    // Filter items of this category by active/inactive if not 'all'
                    const filteredCatItems = catItems.filter(item => {
                      if (filterActive === 'active') return item.is_active;
                      if (filterActive === 'inactive') return !item.is_active;
                      return true;
                    });

                    if (isSearching && filteredCatItems.length === 0) {
                      return null;
                    }

                    const isCollapsed = isSearching ? false : !!collapsedCategories[cat.id];

                    return (
                      <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200">
                        {/* Category Header */}
                        <button
                          onClick={() => {
                            if (!isSearching) {
                              setCollapsedCategories(prev => ({
                                ...prev,
                                [cat.id]: !prev[cat.id]
                              }));
                            }
                          }}
                          className={`w-full flex items-center justify-between p-4 bg-slate-50/70 border-b border-slate-100 text-left font-black transition min-h-[44px] ${
                            isSearching ? 'cursor-default' : 'hover:bg-slate-100/60 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">
                              {cat.icon || getCategoryIcon(cat.id)}
                            </span>
                            <span className="text-sm font-black text-slate-800 tracking-tight">{cat.name}</span>
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full">
                              {filteredCatItems.length} {filteredCatItems.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          {!isSearching && (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-white px-2 py-1 rounded-lg border border-slate-200">
                              {isCollapsed ? 'Expand' : 'Collapse'}
                            </span>
                          )}
                        </button>

                        {/* Category Body */}
                        {!isCollapsed && (
                          <div className="p-3 sm:p-4 bg-white">
                            {filteredCatItems.length === 0 ? (
                              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                                No active items in this category.
                              </div>
                            ) : (
                              <>
                                {/* Mobile Card List (< md screens) */}
                                <div className="block md:hidden space-y-3">
                                  {filteredCatItems.map((item) => {
                                    const qty = Number(item.quantity_in_stock);
                                    const isLow = qty <= Number(item.low_stock_threshold);
                                    const isOutOfStock = qty <= 0;

                                    return (
                                      <div 
                                        key={item.id} 
                                        className={`p-3.5 rounded-2xl border transition-all ${
                                          isOutOfStock 
                                            ? 'bg-red-50/60 border-red-200' 
                                            : isLow 
                                            ? 'bg-amber-50/50 border-amber-200' 
                                            : 'bg-white border-slate-200'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                                          <div>
                                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                              {item.unique_inventory_id}
                                            </span>
                                            <h4 className="font-black text-sm text-slate-900 mt-1 flex items-center gap-1.5 flex-wrap">
                                              <span>{item.name}</span>
                                              {item.product_id && (
                                                <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-1.5 py-0.5 rounded font-bold">
                                                  Catalog
                                                </span>
                                              )}
                                            </h4>
                                          </div>
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                            item.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'
                                          }`}>
                                            {item.is_active ? 'Active' : 'Inactive'}
                                          </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 py-2.5 text-xs">
                                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Stock Level</span>
                                            <div className="flex items-baseline gap-1 mt-0.5">
                                              <span className={`font-black text-base ${isOutOfStock ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                                                {qty}
                                              </span>
                                              <span className="text-slate-400 text-[10px] font-bold">{item.unit}</span>
                                              {isLow && (
                                                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                  isOutOfStock ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                  {isOutOfStock ? 'Depleted' : 'Low'}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Alert Threshold</span>
                                            <div className="flex items-baseline gap-1 mt-0.5">
                                              <span className="font-bold text-sm text-slate-700">{item.low_stock_threshold}</span>
                                              <span className="text-slate-400 text-[10px] font-bold">{item.unit}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Mobile Action Buttons: Touch targets >= 44x44px */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                                          <button
                                            onClick={() => openRestockModal(item)}
                                            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-xl transition cursor-pointer min-h-[44px]"
                                          >
                                            <Scale className="w-4 h-4" />
                                            <span>Restock</span>
                                          </button>
                                          <button
                                            onClick={() => openEditModal(item)}
                                            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                                            title="Edit Item"
                                            aria-label="Edit Item"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => openLogsModal(item)}
                                            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-emerald-600 rounded-xl border border-slate-200 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                                            title="Activity Logs"
                                            aria-label="Activity Logs"
                                          >
                                            <History className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteItem(item)}
                                            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                                            title="Delete Item"
                                            aria-label="Delete Item"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">
                                        <th className="pb-3 pl-2">ID Code</th>
                                        <th className="pb-3">Name</th>
                                        <th className="pb-3">Stock Level</th>
                                        <th className="pb-3">Unit</th>
                                        <th className="pb-3">Alert Threshold</th>
                                        <th className="pb-3">Status</th>
                                        <th className="pb-3 text-right pr-2">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="text-xs divide-y divide-slate-100 font-medium">
                                      {filteredCatItems.map((item) => {
                                        const qty = Number(item.quantity_in_stock);
                                        const isLow = qty <= Number(item.low_stock_threshold);
                                        const isOutOfStock = qty <= 0;

                                        return (
                                          <tr key={item.id} className="hover:bg-slate-50/50 transition">
                                            <td className="py-3.5 pl-2 font-mono font-bold text-slate-500">
                                              {item.unique_inventory_id}
                                            </td>
                                            <td className="py-3.5 font-bold text-slate-800">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span>{item.name}</span>
                                                {item.product_id && (
                                                  <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-1.5 py-0.5 rounded font-bold">
                                                    Catalog
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-3.5">
                                              <span className={`font-black text-sm ${
                                                isOutOfStock ? 'text-red-600' : isLow ? 'text-amber-500' : 'text-slate-800'
                                              }`}>
                                                {qty}
                                              </span>
                                              {isLow && (
                                                <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                                  isOutOfStock ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                                                }`}>
                                                  {isOutOfStock ? 'Depleted' : 'Low'}
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-3.5 text-slate-500 font-semibold">{item.unit}</td>
                                            <td className="py-3.5 text-slate-500">{item.low_stock_threshold} {item.unit}</td>
                                            <td className="py-3.5">
                                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                item.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-100 text-slate-400'
                                              }`}>
                                                {item.is_active ? 'Active' : 'Inactive'}
                                              </span>
                                            </td>
                                            <td className="py-3.5 text-right pr-2">
                                              <div className="inline-flex gap-1.5 items-center">
                                                <button
                                                  onClick={() => openRestockModal(item)}
                                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border hover:bg-slate-100 text-slate-700 font-extrabold text-[10px] transition shadow-sm cursor-pointer min-h-[36px]"
                                                >
                                                  <Scale className="w-3.5 h-3.5" />
                                                  <span>Restock</span>
                                                </button>
                                                <button
                                                  onClick={() => openEditModal(item)}
                                                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                                                  title="Edit"
                                                >
                                                  <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => openLogsModal(item)}
                                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                                  title="Activity Logs"
                                                >
                                                  <History className="w-4 h-4" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteItem(item)}
                                                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                                  title="Delete"
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}

          </div>


      {/* Add / Edit Inventory Modal: Responsive, clean light modal */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4 border border-slate-200 max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {editingItem ? 'Edit Inventory Item' : 'Register Grocery Item'}
              </h3>
              <button onClick={() => setIsAddEditOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ingredient Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cooking Oil, Besan, Potato"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium min-h-[44px]"
                >
                  {getCategoriesList().map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Measurement Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium min-h-[44px]"
                  >
                    <option value="kg">kg (Kilogram)</option>
                    <option value="g">g (Gram)</option>
                    <option value="litre">litre (Litre)</option>
                    <option value="ml">ml (Millilitre)</option>
                    <option value="piece">piece (Piece)</option>
                    <option value="packet">packet (Packet)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Low Stock Alert at</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    min="0"
                    placeholder="2.00"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Stock Level ({unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  min="0"
                  placeholder="10.00"
                  value={quantityInStock}
                  onChange={(e) => setQuantityInStock(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium min-h-[44px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="invActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="invActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Item is active and usable in recipes
                </label>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                {saving ? 'Saving changes...' : 'Save Item'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {isRestockOpen && restockingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-xs w-full p-6 space-y-4 border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Restock Item Stock</h3>
                <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{restockingItem.name} ({restockingItem.unique_inventory_id})</span>
                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                  ✓ Updates Inventory & Product Catalog automatically
                </span>
              </div>
              <button onClick={() => setIsRestockOpen(false)} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity to Add ({restockingItem.unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  min="0.001"
                  placeholder="e.g. 5.5"
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-600 outline-none font-medium min-h-[44px]"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border text-[11px] text-slate-500 font-semibold space-y-1">
                <div className="flex justify-between">
                  <span>Current Stock:</span>
                  <span>{restockingItem.quantity_in_stock} {restockingItem.unit}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200/60 pt-1 text-slate-900 font-bold">
                  <span>Target Stock:</span>
                  <span>{(parseFloat(restockingItem.quantity_in_stock) + (parseFloat(restockQuantity) || 0)).toFixed(3)} {restockingItem.unit}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                {saving ? 'Logging stock entry...' : 'Confirm Restock'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Logs Modal (History drawer) */}
      {isLogsOpen && loggingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white h-full w-full max-w-md p-6 flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-250">
            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Activity Logs</h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block mt-0.5">
                    {loggingItem.name} ({loggingItem.unique_inventory_id})
                  </span>
                </div>
                <button onClick={() => setIsLogsOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {loadingLogs ? (
                <div className="text-center py-20 text-slate-400 font-bold text-xs">Loading ledger entries...</div>
              ) : activeLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-400 text-xs font-semibold">
                  No stock activity logs found for this item.
                </div>
              ) : (
                <div className="space-y-3 pr-1 max-h-[80vh] overflow-y-auto">
                  {activeLogs.map((log) => {
                    const isRestock = log.action_type === 'restock';
                    return (
                      <div key={log.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs transition">
                        <div>
                          <p className="font-extrabold text-slate-800">
                            {isRestock ? 'Grocery Restocked' : 'Meal Order Deduction'}
                          </p>
                          <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-right flex flex-col items-end gap-1.5">
                          <span className={`font-black text-sm ${isRestock ? 'text-emerald-700' : 'text-red-600'}`}>
                            {isRestock ? '+' : ''}{log.quantity_changed} {loggingItem.unit}
                          </span>
                          {log.admin_user && (
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              👤 {log.admin_user.username}
                            </span>
                          )}
                          {log.order && (
                            <span className="text-[9px] font-black bg-emerald-50 text-emerald-800 border border-emerald-100 px-1.5 py-0.5 rounded">
                              🎫 Token: {log.order.token_number}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold">Ledger capping: latest 50 entries</span>
              <button
                onClick={() => setIsLogsOpen(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer min-h-[44px]"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
