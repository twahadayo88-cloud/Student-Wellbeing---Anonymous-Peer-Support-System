/**
 * Safe JSON parsing utility for database fields.
 * Prevents server crashes if field is NULL or malformed string.
 *
 * @param {any} val - Value from database (string, object, or null)
 * @param {any} fallback - Value to return on failure (default: [])
 * @returns {any}
 */
module.exports = function safeParse(val, fallback = []) {
  if (val === null || val === undefined) return fallback;
  
  // Already parsed by driver (some mysql drivers do this for JSON columns)
  if (typeof val === 'object') return val;
  
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (err) {
      return fallback;
    }
  }
  
  return fallback;
};
