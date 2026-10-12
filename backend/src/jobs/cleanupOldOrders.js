const cron = require('node-cron');
const { pool } = require('../database/db');
const { TOKEN_EXPIRY_HOURS } = require('../config/orderConfig');

let cachedIO = null;

const setCleanupSocketIO = (io) => {
  cachedIO = io;
};

/**
 * Auto-expire uncollected token orders older than TOKEN_EXPIRY_HOURS (35 hours).
 * Tokens already DELIVERED must never be marked expired.
 * Expiry applies only to tokens that are not yet delivered (e.g. placed, preparing, ready, out_for_delivery).
 * Emits real-time socket events to student room and kitchen so UI stays in sync.
 *
 * @param {object} [ioInstance] Optional Socket.IO instance
 * @returns {Promise<number>} Number of orders updated to expired
 */
const autoExpireUncollectedOrders = async (ioInstance = null) => {
  try {
    // Find all uncollected tokens created more than TOKEN_EXPIRY_HOURS ago
    // Tokens that are 'out_for_delivery' must NEVER be auto-expired:
    // they remain in the active delivery queue until the admin explicitly marks them delivered.
    // Uses MySQL NOW() and created_at to ensure consistent server timezone handling
    const [expiredRows] = await pool.query(
      `SELECT id, token_number, student_id, order_status, created_at 
       FROM \`Order\` 
       WHERE order_status NOT IN ('delivered', 'cancelled', 'expired', 'out_for_delivery') 
         AND created_at < NOW() - INTERVAL ? HOUR`,
      [TOKEN_EXPIRY_HOURS]
    );

    if (!expiredRows || expiredRows.length === 0) {
      return 0;
    }

    const ids = expiredRows.map((o) => o.id);
    const placeholders = ids.map(() => '?').join(', ');

    const [result] = await pool.query(
      `UPDATE \`Order\` 
       SET order_status = 'expired' 
       WHERE id IN (${placeholders}) 
         AND order_status NOT IN ('delivered', 'cancelled', 'expired', 'out_for_delivery')`,
      ids
    );

    const count = result.affectedRows || 0;
    if (count > 0) {
      console.log(`⏰ [Auto-Expire] Automatically expired ${count} token(s) older than ${TOKEN_EXPIRY_HOURS} hours.`);

      const io = ioInstance || cachedIO;
      if (io) {
        expiredRows.forEach((o) => {
          const payload = {
            orderId: o.id,
            id: o.id,
            token_number: o.token_number,
            order_status: 'expired',
          };

          if (o.student_id) {
            io.to(`student:${o.student_id}`).emit('student:order_updated', payload);
          }
          io.to('kitchen').emit('order:status_updated', payload);
        });
      }
    }
    return count;
  } catch (error) {
    console.error('❌ [Auto-Expire Error]:', error.message);
    return 0;
  }
};

/**
 * Automatically reconcile pending Razorpay orders against the Razorpay API.
 * Catches any orders where payment succeeded in Razorpay (e.g. UPI app switch, dropped webhook, network outage)
 * but the token was not yet generated. Fulfills the order and pushes it to the kitchen screen.
 */
const reconcilePendingPayments = async (ioInstance = null) => {
  try {
    const [pendingRows] = await pool.query(
      `SELECT id, student_id, razorpay_order_id, razorpay_payment_id, created_at 
       FROM \`Order\` 
       WHERE payment_status = 'pending' 
         AND razorpay_order_id IS NOT NULL 
         AND razorpay_order_id NOT LIKE 'order_mock_%'
         AND created_at >= NOW() - INTERVAL 2 HOUR`
    );

    if (!pendingRows || pendingRows.length === 0) {
      return 0;
    }

    const { getCanteenRazorpayCredentials, fulfillPaidOrder } = require('../controllers/orderController');
    const { keyId, keySecret } = getCanteenRazorpayCredentials();

    if (!keyId || !keySecret) {
      return 0;
    }

    const Razorpay = require('razorpay');
    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const io = ioInstance || cachedIO;
    let reconciledCount = 0;

    for (const order of pendingRows) {
      try {
        const payments = await rzp.orders.fetchPayments(order.razorpay_order_id);
        const captured = payments?.items?.find((p) => p.status === 'captured' || p.status === 'authorized');

        if (captured) {
          console.log(`⚡ [Auto-Reconciliation] Discovered captured payment ${captured.id} for pending order #${order.id}. Fulfilling token...`);
          await fulfillPaidOrder({
            orderDbId: order.id,
            razorpayOrderId: order.razorpay_order_id,
            razorpayPaymentId: captured.id,
            studentId: order.student_id,
            io,
          });
          reconciledCount++;
        }
      } catch (err) {
        // Razorpay order check error or uncaptured payment
      }
    }

    if (reconciledCount > 0) {
      console.log(`✅ [Auto-Reconciliation] Successfully recovered and fulfilled ${reconciledCount} paid order(s).`);
    }
    return reconciledCount;
  } catch (error) {
    console.error('❌ [Auto-Reconciliation Error]:', error.message);
    return 0;
  }
};

/**
 * Permanently delete orders older than retention window.
 * DISABLED: Orders are NEVER automatically deleted from the database.
 */
const cleanupOldOrders = async () => {
  return { deletedCount: 0, message: 'Automated deletion disabled; orders persist permanently.' };
};

/**
 * Initialize scheduled cron jobs:
 * 1. Token expiry check every 5 minutes (tokens expire after 35 hours if uncollected).
 * 2. Payment reconciliation check every 2 minutes (reconciles any pending order with Razorpay).
 *
 * @param {object} [io] Socket.IO instance for real-time synchronization
 */
const initOrderCleanupJob = (io = null) => {
  if (io) {
    setCleanupSocketIO(io);
  }

  // Run auto-expiry check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await autoExpireUncollectedOrders(cachedIO);
  });

  // Run payment auto-reconciliation check every 2 minutes
  cron.schedule('*/2 * * * *', async () => {
    await reconcilePendingPayments(cachedIO);
  });

  console.log(`[Order Cleanup & Reconciliation Job] Active: 5-min expiry cron, 2-min Razorpay auto-reconciliation cron.`);
};

module.exports = {
  TOKEN_EXPIRY_HOURS,
  setCleanupSocketIO,
  autoExpireUncollectedOrders,
  reconcilePendingPayments,
  cleanupOldOrders,
  initOrderCleanupJob,
};
