/**
 * Order Configuration Constants
 */

// Token validity window: Tokens remain active until admin marks delivered.
// Fallback auto-expiry for uncollected non-delivery tokens is set to 7 days (168 hours).
// Tokens marked 'out_for_delivery' NEVER auto-expire.
const TOKEN_EXPIRY_HOURS = parseInt(process.env.TOKEN_EXPIRY_HOURS, 10) || 168;

module.exports = {
  TOKEN_EXPIRY_HOURS,
};
