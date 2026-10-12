import React, { useState } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Printer,
  RefreshCw,
  Receipt,
  Check,
  ShieldCheck,
} from 'lucide-react';
import api from '../services/api';

export default function RecoverPaymentModal({ isOpen, onClose, onOrderRecovered, printReceipt }) {
  const [paymentId, setPaymentId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [recoveredOrder, setRecoveredOrder] = useState(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setPaymentId('');
    setOrderId('');
    setErrorMessage('');
    setRecoveredOrder(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleVerifyPayment = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setRecoveredOrder(null);

    const cleanPaymentId = paymentId.trim();
    const cleanOrderId = orderId.trim();

    if (!cleanPaymentId && !cleanOrderId) {
      setErrorMessage('Please enter either a Razorpay Payment ID (e.g. pay_...) or Order ID (e.g. order_...).');
      return;
    }

    setLoading(true);

    try {
      const res = await api.post('/orders/recover-payment', {
        razorpay_payment_id: cleanPaymentId || undefined,
        razorpay_order_id: cleanOrderId || undefined,
      });

      if (res.data?.success && res.data?.token_number) {
        setRecoveredOrder({
          ...res.data.order,
          token_number: res.data.token_number,
          alreadyPaid: res.data.alreadyPaid,
          message: res.data.message,
        });

        if (onOrderRecovered) {
          onOrderRecovered(res.data.order || { token_number: res.data.token_number });
        }
      } else {
        setErrorMessage(res.data?.message || 'Payment not found or not yet captured on Razorpay.');
      }
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || err.message || 'Failed to verify payment with Razorpay. Please check credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-brand-orange flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Verify & Recover Razorpay Payment</h3>
              <p className="text-xs text-slate-500 font-medium">Verify captured payment & generate missing token</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-700 font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {!recoveredOrder ? (
            <form onSubmit={handleVerifyPayment} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                If a student paid via UPI (Google Pay, PhonePe, Paytm) but their phone screen refreshed or closed before receiving the token, enter their Razorpay transaction ID from their UPI receipt below.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Razorpay Payment ID <span className="text-slate-400 font-normal">(starts with pay_)</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. pay_Q3vXYZ1234567"
                    value={paymentId}
                    onChange={(e) => setPaymentId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-brand-orange text-xs font-mono font-medium"
                    autoFocus
                  />
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-slate-400 text-[11px] font-bold uppercase tracking-wider">OR</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Razorpay Order ID <span className="text-slate-400 font-normal">(starts with order_)</span>
                </label>
                <div className="relative">
                  <Receipt className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="e.g. order_Q3vXYZ1234567"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-brand-orange text-xs font-mono font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (!paymentId.trim() && !orderId.trim())}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-xl text-xs font-extrabold shadow-sm hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying with Razorpay...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 stroke-[2.5]" />
                      <span>Verify & Issue Token</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Success View with Generated Token */
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-black text-emerald-900">
                  {recoveredOrder.alreadyPaid ? 'Order Already Confirmed' : 'Payment Successfully Verified!'}
                </h4>
                <p className="text-xs text-emerald-700 font-medium">
                  Token generated and order pushed to active kitchen screen.
                </p>

                {/* Big Token Number */}
                <div className="py-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tight font-mono bg-white px-6 py-2 rounded-2xl border border-emerald-300 shadow-sm inline-block">
                    {recoveredOrder.token_number}
                  </span>
                </div>
              </div>

              {/* Order Info Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span className="font-semibold">Customer / Student:</span>
                  <span className="font-bold text-slate-900">
                    {recoveredOrder.student_name || recoveredOrder.student?.name || 'Walk-in / Student'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-semibold">Meal Type:</span>
                  <span className="font-bold text-slate-900 capitalize">
                    {recoveredOrder.meal_type || 'Lunch'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="font-bold text-slate-900">
                    ₹{Number(recoveredOrder.total_amount || 0).toFixed(2)}
                  </span>
                </div>
                {recoveredOrder.items && recoveredOrder.items.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-700 block mb-1">Items:</span>
                    <ul className="space-y-1 text-slate-600">
                      {recoveredOrder.items.map((it, idx) => (
                        <li key={idx} className="flex justify-between">
                          <span>{it.quantity}x {it.item_name}</span>
                          <span className="font-semibold">₹{(Number(it.price) * Number(it.quantity)).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Verify Another
                </button>

                <div className="flex items-center gap-2">
                  {printReceipt && (
                    <button
                      type="button"
                      onClick={() => printReceipt(recoveredOrder)}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Receipt</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors cursor-pointer"
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
