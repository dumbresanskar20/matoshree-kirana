const { pool } = require('../database/db');

/**
 * Validates and sanitizes address input fields.
 * Returns { valid: boolean, error?: string, sanitized?: object }
 */
const validateAddressInput = (data) => {
  let { society_name, wing_name, flat_number, landmark, pincode, mobile_number } = data || {};

  society_name = typeof society_name === 'string' ? society_name.trim() : '';
  wing_name = typeof wing_name === 'string' ? wing_name.trim() : '';
  flat_number = typeof flat_number === 'string' ? flat_number.trim() : '';
  landmark = typeof landmark === 'string' ? landmark.trim() : null;
  pincode = typeof pincode === 'string' ? pincode.trim() : String(pincode || '').trim();
  mobile_number = typeof mobile_number === 'string' ? mobile_number.trim() : String(mobile_number || '').trim();

  // Clean mobile: strip +91, dashes, spaces
  mobile_number = mobile_number.replace(/^(\+91|0)/, '').replace(/[\s-]/g, '');

  if (!society_name) {
    return { valid: false, error: 'Society Name is required.' };
  }
  if (society_name.length > 150) {
    return { valid: false, error: 'Society Name cannot exceed 150 characters.' };
  }

  if (!wing_name) {
    return { valid: false, error: 'Wing Name is required.' };
  }
  if (wing_name.length > 50) {
    return { valid: false, error: 'Wing Name cannot exceed 50 characters.' };
  }

  if (!flat_number) {
    return { valid: false, error: 'Flat Number is required.' };
  }
  if (flat_number.length > 30) {
    return { valid: false, error: 'Flat Number cannot exceed 30 characters.' };
  }

  if (landmark && landmark.length > 200) {
    return { valid: false, error: 'Landmark cannot exceed 200 characters.' };
  }

  if (!pincode) {
    return { valid: false, error: 'Pincode is required.' };
  }
  if (!/^\d{6}$/.test(pincode)) {
    return { valid: false, error: 'Pincode must be exactly 6 digits.' };
  }

  if (!mobile_number) {
    return { valid: false, error: 'Mobile number is required.' };
  }
  if (!/^[6-9]\d{9}$/.test(mobile_number)) {
    return { valid: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  return {
    valid: true,
    sanitized: {
      society_name,
      wing_name,
      flat_number,
      landmark: landmark || null,
      pincode,
      mobile_number,
    },
  };
};

// GET /api/addresses - List all saved addresses for logged-in user
const getAddresses = async (req, res) => {
  try {
    const userId = req.studentId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. User authentication required.' });
    }

    const [rows] = await pool.execute(
      `SELECT id, user_id, society_name, wing_name, flat_number, landmark, pincode, mobile_number, created_at, updated_at
       FROM user_addresses
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      addresses: rows,
    });
  } catch (error) {
    console.error('[Address Controller] Error fetching addresses:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch delivery addresses.' });
  }
};

// POST /api/addresses - Add a new address for logged-in user
const createAddress = async (req, res) => {
  try {
    const userId = req.studentId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized. User authentication required.' });
    }

    const { valid, error, sanitized } = validateAddressInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: error });
    }

    const [result] = await pool.execute(
      `INSERT INTO user_addresses (user_id, society_name, wing_name, flat_number, landmark, pincode, mobile_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        sanitized.society_name,
        sanitized.wing_name,
        sanitized.flat_number,
        sanitized.landmark,
        sanitized.pincode,
        sanitized.mobile_number,
      ]
    );

    const [createdRows] = await pool.execute(
      `SELECT id, user_id, society_name, wing_name, flat_number, landmark, pincode, mobile_number, created_at, updated_at
       FROM user_addresses
       WHERE id = ?`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      message: 'Address saved successfully.',
      address: createdRows[0],
    });
  } catch (error) {
    console.error('[Address Controller] Error creating address:', error);
    return res.status(500).json({ success: false, message: 'Failed to save delivery address.' });
  }
};

// PUT /api/addresses/:id - Update an existing address (enforce ownership)
const updateAddress = async (req, res) => {
  try {
    const userId = req.studentId || req.user?.id;
    const addressId = parseInt(req.params.id, 10);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    if (isNaN(addressId)) {
      return res.status(400).json({ success: false, message: 'Invalid address ID.' });
    }

    // Verify ownership
    const [existing] = await pool.execute(
      'SELECT id FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1',
      [addressId, userId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Address not found or does not belong to you.' });
    }

    const { valid, error, sanitized } = validateAddressInput(req.body);
    if (!valid) {
      return res.status(400).json({ success: false, message: error });
    }

    await pool.execute(
      `UPDATE user_addresses
       SET society_name = ?, wing_name = ?, flat_number = ?, landmark = ?, pincode = ?, mobile_number = ?
       WHERE id = ? AND user_id = ?`,
      [
        sanitized.society_name,
        sanitized.wing_name,
        sanitized.flat_number,
        sanitized.landmark,
        sanitized.pincode,
        sanitized.mobile_number,
        addressId,
        userId,
      ]
    );

    const [updatedRows] = await pool.execute(
      `SELECT id, user_id, society_name, wing_name, flat_number, landmark, pincode, mobile_number, created_at, updated_at
       FROM user_addresses
       WHERE id = ?`,
      [addressId]
    );

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully.',
      address: updatedRows[0],
    });
  } catch (error) {
    console.error('[Address Controller] Error updating address:', error);
    return res.status(500).json({ success: false, message: 'Failed to update delivery address.' });
  }
};

// DELETE /api/addresses/:id - Delete an address (enforce ownership)
const deleteAddress = async (req, res) => {
  try {
    const userId = req.studentId || req.user?.id;
    const addressId = parseInt(req.params.id, 10);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    if (isNaN(addressId)) {
      return res.status(400).json({ success: false, message: 'Invalid address ID.' });
    }

    // Verify ownership
    const [existing] = await pool.execute(
      'SELECT id FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1',
      [addressId, userId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Address not found or does not belong to you.' });
    }

    await pool.execute('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [addressId, userId]);

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully.',
      deleted_id: addressId,
    });
  } catch (error) {
    console.error('[Address Controller] Error deleting address:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete delivery address.' });
  }
};

module.exports = {
  validateAddressInput,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
};
