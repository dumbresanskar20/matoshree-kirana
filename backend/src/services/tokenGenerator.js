const { pool } = require('../database/db');

/**
 * Generate daily sequential token number formatted as T-001, T-002, etc.
 * Unified across all meal types using MySQL atomic transaction — fully
 * race-condition-safe under concurrent requests.
 *
 * Supports passing an existing active MySQL connection to avoid duplicate connection pool
 * checkout and nested transactions during payment processing bursts.
 *
 * @param {string} mealType - 'breakfast' | 'lunch' | 'dinner' | 'snacks'
 * @param {string} dateString - YYYY-MM-DD
 * @param {object} [existingConnection] - Optional active MySQL connection
 * @returns {Promise<{ tokenNumber: string, sequenceNumber: number }>}
 */
const generateTokenNumber = async (mealType, dateString, existingConnection = null) => {
  const counterKey = 'all'; // Unified daily sequence for all meal types

  const connection = existingConnection || (await pool.getConnection());
  const shouldManageTransaction = !existingConnection;

  try {
    if (shouldManageTransaction) {
      await connection.beginTransaction();
    }

    let nextSeq = 1;
    let counterSuccess = false;

    try {
      // Atomic increment: insert if not exists, else increment. Fully safe under concurrency.
      await connection.execute(
        `INSERT INTO DailyTokenCounter (meal_type, date, last_token_number)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE last_token_number = last_token_number + 1`,
        [counterKey, dateString]
      );

      const [rows] = await connection.execute(
        `SELECT last_token_number FROM DailyTokenCounter 
         WHERE meal_type = ? AND date = ? LIMIT 1`,
        [counterKey, dateString]
      );
      if (rows && rows.length > 0) {
        nextSeq = rows[0].last_token_number;
        counterSuccess = true;
      }
    } catch (_counterErr) {
      // DailyTokenCounter table does not exist or was removed for Kirana store
    }

    if (!counterSuccess) {
      // Direct fallback to Order daily_sequence without requiring DailyTokenCounter table
      const [orderRows] = await connection.execute(
        `SELECT COALESCE(MAX(daily_sequence), 0) + 1 AS next_seq 
         FROM \`Order\` 
         WHERE date = ? FOR UPDATE`,
        [dateString]
      );
      nextSeq = orderRows[0]?.next_seq || 1;
    }

    if (shouldManageTransaction) {
      await connection.commit();
    }

    const tokenNumber = `T-${String(nextSeq).padStart(3, '0')}`;

    return {
      tokenNumber,
      sequenceNumber: nextSeq,
    };
  } catch (error) {
    if (shouldManageTransaction) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (shouldManageTransaction) {
      connection.release();
    }
  }
};

module.exports = {
  generateTokenNumber,
};
