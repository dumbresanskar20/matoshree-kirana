import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  Check,
  UtensilsCrossed,
  ShoppingBag,
  Package,
  Search,
  Printer,
  Grid,
  List,
  Plus,
  Truck,
  MapPin,
  X,
  ShieldCheck,
} from 'lucide-react';
import api from '../services/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useOrderAlerts } from '../context/OrderAlertContext';
import { createAdminSocketClient } from '../services/socket';
import SubscriptionWidget from './SubscriptionWidget';
import SubscriptionModal from './SubscriptionModal';
import ManualOrderModal from './ManualOrderModal';
import AlertControls from './AlertControls';
import TokenDetailModal from './TokenDetailModal';
import RecoverPaymentModal from './RecoverPaymentModal';

export default function KitchenScreen({ isStaffFullscreen = false }) {
  const { triggerOrderAlert } = useOrderAlerts();
  const {
    admin,
    token,
    isSuperAdmin,
    subscription,
    fetchSubscriptionStatus,
    setSubscription,
    setSubscriptionExpired,
  } = useAdminAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState('all'); // 'all' | 'breakfast' | 'lunch' | 'snacks' | 'dinner'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [todayIncome, setTodayIncome] = useState(null);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [manualOrderModalOpen, setManualOrderModalOpen] = useState(false);
  const [recoverPaymentModalOpen, setRecoverPaymentModalOpen] = useState(false);

  const isStaff = isStaffFullscreen || admin?.role === 'staff';
  const isAdminOrSuperAdmin = !isStaff;

  const handleManualOrderCreated = (newOrder) => {
    // Add new order to top of list immediately
    setOrders((prev) => [newOrder, ...prev.filter((o) => (o._id || o.id) !== (newOrder._id || newOrder.id))]);
    // Trigger real-time sound chime and on-screen alert banner
    triggerOrderAlert(newOrder);
    // Refresh summary counts
    fetchKitchenData();
  };

  const handleOrderRecovered = (recoveredOrder) => {
    fetchKitchenData();
    triggerOrderAlert(recoveredOrder);
  };

  // Summary counts state
  const [orderCounts, setOrderCounts] = useState({
    breakfast: { total_orders_today: 0, active_tokens: 0 },
    lunch: { total_orders_today: 0, active_tokens: 0 },
    snacks: { total_orders_today: 0, active_tokens: 0 },
    dinner: { total_orders_today: 0, active_tokens: 0 },
    combined: { total_orders_today: 0, active_tokens: 0 },
    todays_menu_summary: [],
  });

  // Selected Token for Detail Modal
  const [selectedTokenOrder, setSelectedTokenOrder] = useState(null);
  const adminSocketRef = useRef(null);

  // Fetch today's orders & summary counts
  const fetchKitchenData = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      let ordersUrl = `/orders/kitchen-orders?date=${todayStr}`;
      if (selectedMeal && selectedMeal !== 'all') {
        ordersUrl += `&meal_type=${selectedMeal}`;
      }

      const [ordersRes, countsRes] = await Promise.all([
        api.get(ordersUrl),
        api.get(`/orders/kitchen-order-counts?date=${todayStr}`),
      ]);

      if (ordersRes.data.success) {
        setOrders(ordersRes.data.orders || []);
      }

      if (countsRes.data.success && countsRes.data.orderCounts) {
        setOrderCounts(countsRes.data.orderCounts);
      }

      if (isAdminOrSuperAdmin) {
        try {
          const incRes = await api.get('/orders/income/today');
          if (incRes.data.success) {
            setTodayIncome(incRes.data);
          }
        } catch (e) {
          console.warn('Income fetch error:', e);
        }
      }
    } catch (err) {
      console.error('Kitchen data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Mark Out for Delivery status update
  const handleMarkOutForDelivery = async (orderId) => {
    const idStr = String(orderId);
    const ord = orders.find((o) => String(o._id || o.id) === idStr);
    const tokenNumber = ord?.token_number;
    const studentId = ord?.student_id?.id || ord?.student_id?._id || ord?.student_id;

    const previousOrders = [...orders];
    const previousCounts = { ...orderCounts };

    // 1. Optimistically update local state & selected modal order
    setOrders((prev) =>
      prev.map((o) =>
        String(o._id || o.id) === idStr ? { ...o, order_status: 'out_for_delivery' } : o
      )
    );
    setSelectedTokenOrder((prev) =>
      prev && String(prev._id || prev.id) === idStr ? { ...prev, order_status: 'out_for_delivery' } : prev
    );

    const outPayload = {
      orderId: idStr,
      token_number: tokenNumber,
      studentId: studentId,
      order_status: 'out_for_delivery',
    };

    if (adminSocketRef.current) {
      adminSocketRef.current.emit('order:status_updated', outPayload);
    }

    try {
      const res = await api.patch(`/orders/status/${idStr}`, {
        order_status: 'out_for_delivery',
      });

      if (res.data?.success && res.data?.orderCounts) {
        setOrderCounts(res.data.orderCounts);
      }
    } catch (err) {
      console.error('Failed to mark order out for delivery:', err);
      setOrders(previousOrders);
      setOrderCounts(previousCounts);
      setSelectedTokenOrder((prev) =>
        prev && String(prev._id || prev.id) === idStr ? ord : prev
      );
      alert(err.response?.data?.message || 'Failed to update status. Please try again.');
    }
  };

  // Handle Mark Delivered status update
  const handleMarkDelivered = async (orderId) => {
    const idStr = String(orderId);
    const ord = orders.find((o) => String(o._id || o.id) === idStr);
    const tokenNumber = ord?.token_number;
    const studentId = ord?.student_id?.id || ord?.student_id?._id || ord?.student_id;

    const previousOrders = [...orders];
    const previousCounts = { ...orderCounts };

    setOrders((prev) =>
      prev.map((o) =>
        String(o._id || o.id) === idStr ? { ...o, order_status: 'delivered' } : o
      )
    );
    setSelectedTokenOrder((prev) =>
      prev && String(prev._id || prev.id) === idStr ? { ...prev, order_status: 'delivered' } : prev
    );

    const deliveredPayload = {
      orderId: idStr,
      token_number: tokenNumber,
      studentId: studentId,
      order_status: 'delivered',
    };

    if (adminSocketRef.current) {
      adminSocketRef.current.emit('order:status_updated', deliveredPayload);
    }

    try {
      const res = await api.patch(`/orders/status/${idStr}`, {
        order_status: 'delivered',
      });

      if (res.data?.success && res.data?.orderCounts) {
        setOrderCounts(res.data.orderCounts);
      }
    } catch (err) {
      console.error('Failed to mark order as delivered:', err);
      setOrders(previousOrders);
      setOrderCounts(previousCounts);
      setSelectedTokenOrder((prev) =>
        prev && String(prev._id || prev.id) === idStr ? ord : prev
      );
      alert(err.response?.data?.message || 'Failed to update status. Please try again.');
    }
  };

  // Socket.IO Real-time setup + 15s polling fallback
  useEffect(() => {
    fetchKitchenData();

    const socket = createAdminSocketClient(token);
    adminSocketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join:kitchen');
    });
    socket.emit('join:kitchen');

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Real-time new order listener
    socket.on('order:new', (newOrder) => {
      if (newOrder) {
        setOrders((prev) => {
          const exists = prev.some((o) => (o._id || o.id) === (newOrder._id || newOrder.id));
          if (exists) return prev;
          return [newOrder, ...prev];
        });
        // Trigger synchronized sound and on-screen alert banner
        triggerOrderAlert(newOrder);
        if (isAdminOrSuperAdmin) {
          api.get('/orders/income/today')
            .then((res) => { if (res.data?.success) setTodayIncome(res.data); })
            .catch(() => {});
        }
      }
    });

    // Real-time income update listener
    socket.on('income:updated', () => {
      if (isAdminOrSuperAdmin) {
        api.get('/orders/income/today')
          .then((res) => { if (res.data?.success) setTodayIncome(res.data); })
          .catch(() => {});
      }
    });

    // Real-time status update listener
    socket.on('order:status_updated', (updatedData) => {
      const updatedId = updatedData.orderId || updatedData.id;
      setOrders((prev) =>
        prev.map((o) =>
          (o._id || o.id) === updatedId
            ? { ...o, order_status: updatedData.order_status }
            : o
        )
      );
      setSelectedTokenOrder((prev) =>
        prev && (prev._id || prev.id) === updatedId
          ? { ...prev, order_status: updatedData.order_status }
          : prev
      );
    });

    // Real-time aggregate count listener
    socket.on('order-counts-updated', (data) => {
      if (data && data.orderCounts) {
        setOrderCounts(data.orderCounts);
      }
    });

    // Polling fallback every 15s
    const pollInterval = setInterval(() => {
      fetchKitchenData();
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      adminSocketRef.current = null;
      socket.disconnect();
    };
  }, [token, selectedMeal]);

  // Print Token Invoice / Thermal Receipt with Discount & QR Code
  const printReceipt = (order) => {
    const customerOrStudentName = order.customer_name || order.student_id?.name || order.student_name || 'Customer';
    const rollNo = order.student_id?.roll_no || order.student?.roll_no || '';
    const isWalkIn = Boolean(order.customer_name);
    const mealType = (order.meal_type || '').toUpperCase();
    const tokenNumber = order.token_number || 'T-00';
    const dateStr = new Date(order.created_at || Date.now()).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const qrPayload = JSON.stringify({
      order_id: order._id || order.id || '',
      token_number: tokenNumber,
      meal_type: order.meal_type || '',
      customer_name: customerOrStudentName,
      payment_status: order.payment_status || 'paid',
      date: order.date || '',
    });

    const itemsHtml = (order.items || [])
      .map(
        (it) => `
      <tr style="border-bottom: 1px dashed #ccc;">
        <td style="padding: 6px 0; font-family: monospace; font-size: 13px;">${it.item_name || it.name}</td>
        <td style="padding: 6px 0; text-align: center; font-family: monospace; font-size: 13px;">${it.quantity}</td>
        <td style="padding: 6px 0; text-align: right; font-family: monospace; font-size: 13px;">₹${Number(it.price || 0) * it.quantity}</td>
      </tr>
    `
      )
      .join('');

    const hasDiscount = Number(order.discount_amount || 0) > 0;
    const subtotal = Number(order.subtotal_amount || order.total_amount || 0);
    const discountAmount = Number(order.discount_amount || 0);
    const discountPercentage = Number(order.discount_percentage || 0);
    const paymentMethodDisplay = (order.payment_method || 'Cash').toUpperCase();

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) {
      alert('Pop-up blocker is preventing print view! Please allow popups for this site.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token Receipt - ${tokenNumber}</title>
          <style>
            @media print {
              body { margin: 0; padding: 10px; }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              padding: 15px;
              color: #000;
              width: 280px;
              margin: 0 auto;
              background: #fff;
            }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
            .title { font-size: 16px; font-weight: bold; margin: 2px 0; letter-spacing: 1px; }
            .subtitle { font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }
            .token-box {
              font-size: 32px;
              font-weight: 900;
              margin: 6px 0;
              border: 2px solid #000;
              display: inline-block;
              padding: 4px 16px;
              letter-spacing: 2px;
            }
            .details { font-size: 11px; margin-bottom: 8px; line-height: 1.4; border-bottom: 1px dashed #000; padding-bottom: 6px; }
            .table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 10px; }
            .qr-container { text-align: center; margin: 10px 0; padding: 6px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
            .footer { text-align: center; border-top: 2px dashed #000; padding-top: 8px; margin-top: 10px; font-size: 10px; line-height: 1.3; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">MATOSHREE KIRANA</div>
            <div class="subtitle">Your Daily Needs, Our Priority</div>
            <div class="token-box">${tokenNumber}</div>
          </div>
          <div class="details">
            <div><strong>Date:</strong> ${dateStr}</div>
            <div><strong>${isWalkIn ? 'Customer' : 'User'}:</strong> ${customerOrStudentName} ${rollNo ? `(${rollNo})` : ''}</div>
            <div><strong>Meal Window:</strong> ${mealType}</div>
            <div><strong>Delivery Address:</strong> ${order.delivery_address ? `${order.delivery_address.flat_number || ''}, ${order.delivery_address.wing_name || ''} - ${order.delivery_address.society_name || ''}` : 'Counter Pickup'}</div>
            <div><strong>Payment:</strong> ${paymentMethodDisplay} (PAID)</div>
          </div>
          <table class="table">
            <thead>
              <tr style="border-bottom: 1px solid #000; font-size: 11px;">
                <th style="text-align: left; padding: 4px 0;">Item</th>
                <th style="text-align: center; padding: 4px 0;">Qty</th>
                <th style="text-align: right; padding: 4px 0;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              ${
                hasDiscount
                  ? `
                <tr style="border-top: 1px dashed #000; font-size: 11px;">
                  <td style="padding: 4px 0;" colspan="2">Subtotal</td>
                  <td style="padding: 4px 0; text-align: right;">₹${subtotal}</td>
                </tr>
                <tr style="font-size: 11px; color: #000;">
                  <td style="padding: 4px 0;" colspan="2">Early Discount (${discountPercentage}%)</td>
                  <td style="padding: 4px 0; text-align: right;">-₹${discountAmount}</td>
                </tr>
              `
                  : ''
              }
              <tr style="border-top: 1px solid #000; font-weight: bold; font-size: 13px;">
                <td style="padding: 6px 0;" colspan="2">TOTAL PAID</td>
                <td style="padding: 6px 0; text-align: right;">₹${Number(order.total_amount || 0)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Scannable Order QR Code -->
          <div class="qr-container">
            <div style="font-size: 9px; text-transform: uppercase; margin-bottom: 4px; font-weight: bold;">Counter Pickup QR</div>
            <img 
              src="https://api.qrserver.com/v1/create-qr-code/?size=115x115&margin=0&data=${encodeURIComponent(qrPayload)}" 
              alt="Order QR Code" 
              style="width: 115px; height: 115px; display: inline-block;"
            />
          </div>

          <div class="footer">
            Thank you for shopping with us!<br/>
            Please present this token slip or QR at the counter.
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter active tokens (exclude delivered / cancelled / expired)
  const activeTokenList = orders.filter(
    (ord) => ord.order_status !== 'delivered' && ord.order_status !== 'cancelled' && ord.order_status !== 'expired'
  );

  const filteredTokenList = activeTokenList
    .filter((ord) => {
      const studentName = (ord.customer_name || ord.student_id?.name || ord.student_name || '').toLowerCase();
      const tokenNum = (ord.token_number || '').toLowerCase();
      const cleanQuery = searchQuery.toLowerCase().trim();
      const matchesSearch = studentName.includes(cleanQuery) || tokenNum.includes(cleanQuery);
      if (!matchesSearch) return false;

      // Meal Filter Tab
      if (selectedMeal && selectedMeal !== 'all') {
        if ((ord.meal_type || '').toLowerCase() !== selectedMeal.toLowerCase()) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));



  // Derive menu ordered summary with remaining units to deliver in real-time
  const menuSummaryWithPending = useMemo(() => {
    const map = {};

    // 1. Calculate from orders state (instant real-time updates on status changes and new orders)
    (orders || []).forEach((ord) => {
      if (ord.order_status === 'cancelled' || ord.order_status === 'expired') return;

      const isDelivered = ord.order_status === 'delivered';
      (ord.items || []).forEach((it) => {
        const name = it.item_name || it.name;
        if (!name) return;
        const qty = Number(it.quantity) || 1;
        if (!map[name]) {
          map[name] = { item_name: name, total_quantity: 0, pending_quantity: 0, delivered_quantity: 0 };
        }
        map[name].total_quantity += qty;
        if (isDelivered) {
          map[name].delivered_quantity += qty;
        } else {
          map[name].pending_quantity += qty;
        }
      });
    });

    // 2. Incorporate / merge with orderCounts.todays_menu_summary if available
    (orderCounts.todays_menu_summary || []).forEach((it) => {
      if (!map[it.item_name]) {
        map[it.item_name] = {
          item_name: it.item_name,
          total_quantity: it.total_quantity || 0,
          pending_quantity: it.pending_quantity != null ? it.pending_quantity : (it.total_quantity || 0),
          delivered_quantity: it.delivered_quantity || 0,
        };
      } else {
        if (it.total_quantity > map[it.item_name].total_quantity) {
          map[it.item_name].total_quantity = it.total_quantity;
          if (it.pending_quantity != null) {
            map[it.item_name].pending_quantity = it.pending_quantity;
            map[it.item_name].delivered_quantity = it.delivered_quantity || 0;
          }
        }
      }
    });

    return Object.values(map).sort((a, b) => b.pending_quantity - a.pending_quantity || b.total_quantity - a.total_quantity);
  }, [orders, orderCounts.todays_menu_summary]);

  const totalPendingUnits = useMemo(() => {
    return menuSummaryWithPending.reduce((sum, it) => sum + (it.pending_quantity || 0), 0);
  }, [menuSummaryWithPending]);

  const MEAL_TYPES = useMemo(() => {
    const base = [
      { id: 'all', label: 'All Orders' },
    ];
    const legacyDefaults = new Set(['breakfast', 'lunch', 'snacks', 'dinner']);

    // Extract dynamic store categories from orderCounts and loaded orders
    const dynamicTypes = new Set();
    if (orderCounts) {
      Object.keys(orderCounts).forEach((k) => {
        const clean = k.toLowerCase().trim();
        if (clean !== 'combined' && clean !== 'todays_menu_summary' && !legacyDefaults.has(clean)) {
          dynamicTypes.add(clean);
        }
      });
    }
    if (Array.isArray(orders)) {
      orders.forEach((o) => {
        if (o.meal_type) {
          const clean = o.meal_type.toLowerCase().trim();
          if (clean && !legacyDefaults.has(clean)) {
            dynamicTypes.add(clean);
          }
        }
      });
    }

    dynamicTypes.forEach((type) => {
      const prettyLabel = type
        .split(/[\s_-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      base.push({ id: type, label: prettyLabel });
    });

    return base;
  }, [orderCounts, orders]);

  // Helper to format placed date and time for active tokens (e.g. "Today at 08:30 PM", "Yesterday at 08:30 PM", "3d ago at 08:30 PM")
  const formatTokenTime = (dateVal) => {
    if (!dateVal) return '';
    const dt = new Date(dateVal);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) {
      return `Today at ${timeStr}`;
    }

    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const diffDays = Math.round((startOfNow - startOfDt) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      return `Yesterday at ${timeStr}`;
    }
    if (diffDays > 1) {
      return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} (${diffDays}d ago) at ${timeStr}`;
    }
    return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  const getTokenAgeBadge = (dateVal) => {
    if (!dateVal) return null;
    const dt = new Date(dateVal);
    const now = new Date();
    if (dt.toDateString() === now.toDateString()) return null;

    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const diffDays = Math.round((startOfNow - startOfDt) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      return 'Yesterday';
    }
    return `${diffDays}d ago`;
  };

  return (
    <div className={`p-4 sm:p-6 space-y-6 ${isStaff ? 'w-full max-w-full' : 'max-w-screen-2xl mx-auto'}`}>
      
      {/* TOP BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl">
              {isStaff ? '🏪' : '🛒'}
            </span>
            <span>{isStaff ? 'Store Counter Screen' : 'Order Fulfillment Screen'}</span>
          </h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            {isStaff ? "Live Active Token Queue & Today's Orders • " : "Live Active Token Queue & Daily Order Analytics • "}
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Actions, Status Indicators & Refresh */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap">
          {/* New Manual Order CTA (Visible to Admin, Super Admin & Staff) */}
          <button
            onClick={() => setManualOrderModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-black shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
            title="Create Manual Walk-in Order"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Manual Order</span>
          </button>

          {/* Verify & Recover Razorpay Payment */}
          <button
            onClick={() => setRecoverPaymentModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white text-xs font-black shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95"
            title="Verify & Recover Razorpay Payment"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            <span>Verify Payment</span>
          </button>

          <button
            onClick={fetchKitchenData}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Sound & Notification Alert Controls */}
          <AlertControls isDarkHeader={false} />

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-extrabold border ${
              connected
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-amber-50 border-amber-300 text-amber-800 animate-pulse'
            }`}
          >
            {connected ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-600" />
            )}
            <span>{connected ? 'Live Socket Connected' : 'Reconnecting...'}</span>
          </div>
        </div>
      </div>

      {/* 1. SYSTEM SUBSCRIPTION STATUS WIDGET (ADMIN & SUPER ADMIN) */}
      {isAdminOrSuperAdmin && (
        <SubscriptionWidget
          subscription={subscription}
          onOpenRenewModal={() => setRenewModalOpen(true)}
          onRefresh={fetchSubscriptionStatus}
        />
      )}

      {/* 2. TODAY'S REVENUE / DAILY INCOME SUMMARY WIDGET (ADMIN & SUPER ADMIN) */}
      {isAdminOrSuperAdmin && todayIncome && (
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              Super Admin Analytics • Today's Revenue
            </span>
            <span className="text-2xl font-black text-white">
              ₹{(todayIncome.total_income || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Razorpay (Online)</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.razorpay?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.razorpay?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Counter Cash</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.counter_cash?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.counter_cash?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Counter UPI</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.counter_upi?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.counter_upi?.count || 0} orders)</span>
            </div>

            <div className="bg-slate-800/90 p-3 rounded-2xl border border-slate-700/80">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Other</span>
              <span className="text-base font-black text-white">₹{(todayIncome.breakdown?.other?.amount || 0).toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block font-semibold">({todayIncome.breakdown?.other?.count || 0} orders)</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. TODAY'S ORDER SUMMARY */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-3 px-1">
            TODAY'S ORDER SUMMARY
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            
            {/* Combined Total Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">
                COMBINED ALL ORDERS
              </span>
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-none">
                    {orderCounts.combined?.total_orders_today || 0}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-400 mt-1">Total Orders Today</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black text-brand-orange leading-none">
                    {orderCounts.combined?.active_tokens || 0}
                  </span>
                  <span className="block text-[10px] font-bold text-brand-orange uppercase mt-1">ACTIVE TOKENS</span>
                </div>
              </div>
            </div>

            {/* Store Category Specific Cards (Dynamic Only) */}
            {Object.keys(orderCounts || {})
              .filter(
                (k) =>
                  k !== 'combined' &&
                  k !== 'todays_menu_summary' &&
                  !['breakfast', 'lunch', 'snacks', 'dinner'].includes(k.toLowerCase())
              )
              .map((catKey) => {
                const data = orderCounts[catKey] || { total_orders_today: 0, active_tokens: 0 };
                const label = catKey
                  .split(/[\s_-]+/)
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');

                return (
                  <div
                    key={catKey}
                    className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-2"
                  >
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">
                      {label}
                    </span>
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <span className="text-xl sm:text-2xl font-black text-slate-900 leading-none">
                          {data.total_orders_today}
                        </span>
                        <span className="block text-[9px] font-semibold text-slate-400 mt-0.5">Total Orders</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl sm:text-2xl font-black text-brand-orange leading-none">
                          {data.active_tokens}
                        </span>
                        <span className="block text-[9px] font-bold text-brand-orange uppercase mt-0.5">ACTIVE</span>
                      </div>
                    </div>
                  </div>
                );
              })}

          </div>
        </div>

        {/* 4. TODAY'S PRODUCTS ORDERED ("FAST-MOVING ITEMS TODAY") */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>Today's Products Ordered ("Fast-Moving Items Today")</span>
              </h3>
              {totalPendingUnits > 0 ? (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[11px] px-2.5 py-0.5 rounded-full shadow-2xs">
                  ⚡ {totalPendingUnits} to deliver
                </span>
              ) : menuSummaryWithPending.length > 0 ? (
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] px-2.5 py-0.5 rounded-full">
                  ✓ All Delivered
                </span>
              ) : null}
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase">
              {menuSummaryWithPending.length} UNIQUE ITEMS
            </span>
          </div>

          {menuSummaryWithPending.length === 0 ? (
            <div className="text-xs text-slate-400 font-medium py-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No grocery products ordered yet today.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {menuSummaryWithPending.map((item, idx) => {
                const hasPending = item.pending_quantity > 0;

                return (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between space-y-2.5 shadow-2xs ${
                      hasPending
                        ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/60 border-amber-300 shadow-xs'
                        : 'bg-stone-50/80 border-stone-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-extrabold text-slate-900 line-clamp-1" title={item.item_name}>
                        {item.item_name}
                      </span>
                      {hasPending ? (
                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-200/90 text-amber-900 shrink-0">
                          Pending
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                          Done
                        </span>
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-amber-200/60 space-y-1.5">
                      {/* Units to Deliver vs Total Sold */}
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span
                            className={`text-2xl font-black leading-none ${
                              hasPending ? 'text-brand-orange' : 'text-slate-400'
                            }`}
                          >
                            {item.pending_quantity}
                          </span>
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mt-0.5">
                            To Deliver
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-bold text-slate-700 leading-none">
                            {item.total_quantity}
                          </span>
                          <span className="block text-[9px] font-semibold text-slate-400 mt-0.5">
                            Total Sold
                          </span>
                        </div>
                      </div>

                      {/* Delivered Progress Indicator */}
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/50">
                        <span>Delivered:</span>
                        <span className={`font-bold ${item.delivered_quantity > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {item.delivered_quantity} / {item.total_quantity}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 5. ACTIVE TOKEN QUEUE SECTION - VISIBLE TO ADMIN, SUPER ADMIN & KITCHEN STAFF */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          
          {/* Controls & Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Active Token Queue</h3>
              <span className="bg-amber-100 text-amber-900 font-black text-xs px-3 py-1 rounded-full">
                {activeTokenList.length} Undelivered
              </span>
              <span className="bg-blue-100 text-blue-900 font-black text-[11px] px-2.5 py-0.5 rounded-full border border-blue-200">
                🚚 {activeTokenList.filter((o) => o.order_status === 'out_for_delivery').length} Out for Delivery
              </span>
              {activeTokenList.some((o) => getTokenAgeBadge(o.created_at)) && (
                <span className="bg-orange-100 text-orange-950 font-black text-[11px] px-2.5 py-0.5 rounded-full border border-orange-300">
                  ⏳ {activeTokenList.filter((o) => getTokenAgeBadge(o.created_at)).length} Carried Over
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* View Mode Switch */}
              <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Live Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search token number or user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-amber-500 outline-none font-semibold text-slate-700 bg-slate-50"
                />
              </div>

              {/* Meal Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
                {MEAL_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedMeal(type.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedMeal === type.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIVE TOKENS DISPLAY AREA */}
          <div className="p-4 sm:p-6">
            {loading ? (
              <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
                Loading active tokens...
              </div>
            ) : filteredTokenList.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto">
                  {searchQuery.trim() ? '🔍' : '✨'}
                </div>
                <h4 className="text-slate-700 font-bold text-lg">
                  {searchQuery.trim() ? 'No matching tokens found' : 'No active tokens in queue!'}
                </h4>
                <p className="text-slate-400 text-xs max-w-sm mx-auto">
                  {searchQuery.trim()
                    ? 'Try adjusting your search term or selecting another category tab.'
                    : `All placed orders for ${selectedMeal === 'all' ? 'today' : selectedMeal} have been delivered.`}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              /* RESPONSIVE MULTI-COLUMN GRID FORMAT */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
                {filteredTokenList.map((ord) => {
                  const ordId = ord._id || ord.id;
                  const isWalkIn = Boolean(ord.customer_name);
                  const studentName = ord.customer_name || ord.student_id?.name || ord.student_name || 'Customer';
                  const rollNo = ord.student_id?.roll_no || ord.student?.roll_no || '';
                  const isTokenOnly = ord.payment_status === 'token_only';
                  const isOutForDelivery = ord.order_status === 'out_for_delivery';
                  const isDelivered = ord.order_status === 'delivered';
                  const addr = ord.delivery_address;

                  return (
                    <div
                      key={ordId}
                      onClick={() => setSelectedTokenOrder(ord)}
                      className={`bg-white rounded-3xl border-2 ${
                        isDelivered
                          ? 'border-emerald-400 ring-2 ring-emerald-100/70 shadow-emerald-50'
                          : isOutForDelivery
                          ? 'border-blue-400 ring-2 ring-blue-100/70 shadow-blue-50'
                          : 'border-slate-200/90 hover:border-amber-400'
                      } p-5 shadow-sm flex flex-col justify-between space-y-4 transition-all duration-150 hover:shadow-md relative cursor-pointer`}
                    >
                      {/* Card Top: Big Token & Badges */}
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className={`px-3 py-2 rounded-2xl ${isDelivered ? 'bg-emerald-600' : isOutForDelivery ? 'bg-blue-600' : 'bg-amber-500'} text-white font-black text-lg sm:text-xl flex items-center justify-center tracking-tight shadow-md shrink-0 whitespace-nowrap min-w-[4.2rem]`}>
                            {ord.token_number || 'T-00'}
                          </div>

                          <div className="text-right space-y-1.5">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {isDelivered ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-600 text-white shadow-xs tracking-wide">
                                  ✓ DELIVERED
                                </span>
                              ) : isOutForDelivery ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black uppercase px-2.5 py-1 rounded-xl bg-blue-600 text-white shadow-xs tracking-wide">
                                  <Truck className="w-3.5 h-3.5 stroke-[2.5]" /> OUT FOR DELIVERY
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 tracking-wide">
                                  PLACED
                                </span>
                              )}
                              <span className="inline-block text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-900 text-white tracking-wider">
                                {ord.meal_type}
                              </span>
                            </div>
                            <div>
                              <span
                                className={`inline-block text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                  isTokenOnly ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isTokenOnly ? 'Token Only' : isWalkIn ? `Paid (${ord.payment_method || 'Cash'})` : 'Paid'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Student & Time Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-base text-slate-900 truncate" title={studentName}>
                              {studentName}
                            </h4>
                            {isWalkIn && (
                              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                                Walk-in
                              </span>
                            )}
                            {rollNo && (
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {rollNo}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Placed: {formatTokenTime(ord.created_at)}</span>
                            {getTokenAgeBadge(ord.created_at) && (
                              <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                {getTokenAgeBadge(ord.created_at)}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Delivery Address Snippet */}
                        <div className="mt-2.5">
                          {addr ? (
                            <div className="flex items-start gap-1.5 text-xs text-slate-700 bg-orange-50/70 p-2.5 rounded-2xl border border-orange-200/80">
                              <MapPin className="w-3.5 h-3.5 text-orange-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-bold truncate text-slate-900">
                                  Flat {addr.flat_number}, {addr.wing_name}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {addr.society_name} {addr.landmark ? `• ${addr.landmark}` : ''}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="italic">No address (Counter pickup)</span>
                            </div>
                          )}
                        </div>

                        {/* Items List Pills */}
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Ordered Products:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(ord.items || []).map((it, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-xl border border-slate-200"
                              >
                                <strong className="text-amber-700 mr-1">{it.quantity}x</strong>
                                {it.item_name || it.name}
                                {it.variant_name && !(it.item_name || it.name || '').includes(it.variant_name) && (
                                  <span className="ml-1.5 text-amber-800 font-black text-[11px] bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                                    {it.variant_name}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Card Actions: Out for Delivery & Delivered Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!isOutForDelivery && !isDelivered && (
                          <button
                            onClick={() => handleMarkOutForDelivery(ordId)}
                            className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>OUT FOR DELIVERY</span>
                          </button>
                        )}

                        {!isDelivered && (
                          <button
                            onClick={() => handleMarkDelivered(ordId)}
                            className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>DELIVERED</span>
                          </button>
                        )}

                        {isDelivered && (
                          <div className="w-full py-2.5 px-3 bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5">
                            <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                            <span>COMPLETED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* COMPACT LIST / TABLE FORMAT */
              <div className="divide-y divide-slate-100">
                {filteredTokenList.map((ord) => {
                  const ordId = ord._id || ord.id;
                  const isWalkIn = Boolean(ord.customer_name);
                  const studentName = ord.customer_name || ord.student_id?.name || ord.student_name || 'Customer';
                  const rollNo = ord.student_id?.roll_no || ord.student?.roll_no || '';
                  const isTokenOnly = ord.payment_status === 'token_only';
                  const isOutForDelivery = ord.order_status === 'out_for_delivery';
                  const isDelivered = ord.order_status === 'delivered';
                  const addr = ord.delivery_address;

                  return (
                    <div
                      key={ordId}
                      onClick={() => setSelectedTokenOrder(ord)}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors cursor-pointer ${
                        isDelivered
                          ? 'bg-emerald-50/50 hover:bg-emerald-50/80'
                          : isOutForDelivery
                          ? 'bg-blue-50/50 hover:bg-blue-50/80'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Left: Token Number & Student Info */}
                      <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                        <div className={`px-3.5 py-2 rounded-2xl ${isDelivered ? 'bg-emerald-600' : isOutForDelivery ? 'bg-blue-600' : 'bg-amber-500'} text-white font-black text-base sm:text-lg flex items-center justify-center tracking-tight shadow-md shrink-0 whitespace-nowrap min-w-[4.2rem]`}>
                          {ord.token_number || 'T-00'}
                        </div>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
                              {studentName}
                            </span>
                            {isWalkIn && (
                              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                                Walk-in ({ord.payment_method || 'Cash'})
                              </span>
                            )}
                            {rollNo && (
                              <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                                {rollNo}
                              </span>
                            )}
                            {isDelivered ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-600 text-white shadow-xs tracking-wide">
                                ✓ DELIVERED
                              </span>
                            ) : isOutForDelivery ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-1 rounded-xl bg-blue-600 text-white shadow-xs tracking-wide">
                                <Truck className="w-3.5 h-3.5 stroke-[2.5]" /> OUT FOR DELIVERY
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 tracking-wide">
                                PLACED
                              </span>
                            )}
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                              {ord.meal_type}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                                isTokenOnly ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isTokenOnly ? 'Token Only' : 'Paid'}
                            </span>
                          </div>

                          {/* Address snippet in List View */}
                          {addr && (
                            <p className="text-xs text-slate-600 flex items-center gap-1 font-semibold truncate max-w-md">
                              <MapPin className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                              <span>Flat {addr.flat_number}, {addr.wing_name} - {addr.society_name}</span>
                            </p>
                          )}

                          {/* Items Summary Pills */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {(ord.items || []).map((it, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200"
                              >
                                {it.quantity}x {it.item_name || it.name}
                              </span>
                            ))}
                          </div>

                          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium pt-0.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Placed: {formatTokenTime(ord.created_at)}</span>
                            {getTokenAgeBadge(ord.created_at) && (
                              <span className="ml-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                {getTokenAgeBadge(ord.created_at)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right Action: Out for Delivery & Delivered Buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {!isOutForDelivery && !isDelivered && (
                          <button
                            onClick={() => handleMarkOutForDelivery(ordId)}
                            className="flex-1 sm:flex-initial px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 text-white font-black text-xs rounded-2xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>OUT FOR DELIVERY</span>
                          </button>
                        )}

                        {!isDelivered && (
                          <button
                            onClick={() => handleMarkDelivered(ordId)}
                            className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white font-black text-xs rounded-2xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>DELIVERED</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      {/* SUPER ADMIN RENEWAL MODAL */}
      <SubscriptionModal
        isOpen={renewModalOpen}
        onClose={() => setRenewModalOpen(false)}
        onSuccess={(updatedSub) => {
          setSubscription(updatedSub);
          setSubscriptionExpired(false);
          fetchSubscriptionStatus();
        }}
      />

      {/* NEW MANUAL WALK-IN ORDER MODAL (FEATURE 1) */}
      <ManualOrderModal
        isOpen={manualOrderModalOpen}
        onClose={() => setManualOrderModalOpen(false)}
        onOrderCreated={handleManualOrderCreated}
        printReceipt={printReceipt}
      />

      {/* TOKEN DETAILS POPUP MODAL (TASK 3 & 4) */}
      <TokenDetailModal
        order={selectedTokenOrder}
        isOpen={Boolean(selectedTokenOrder)}
        onClose={() => setSelectedTokenOrder(null)}
        onMarkOutForDelivery={handleMarkOutForDelivery}
        onMarkDelivered={handleMarkDelivered}
      />

      {/* VERIFY & RECOVER PAYMENT MODAL */}
      <RecoverPaymentModal
        isOpen={recoverPaymentModalOpen}
        onClose={() => setRecoverPaymentModalOpen(false)}
        onOrderRecovered={handleOrderRecovered}
        printReceipt={printReceipt}
      />
    </div>
  );
}
