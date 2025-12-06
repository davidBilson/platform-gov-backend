import crypto from 'crypto';

/**
 * Generate a secure random token for vetting confirmation
 * @returns {string} Secure token
 */
export const generateVettingToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a token with expiry date
 * @param {number} expiryDays - Number of days until token expires (default: 30)
 * @returns {Object} Object containing token and expiry date
 */
export const generateTokenWithExpiry = (expiryDays = 30) => {
    const token = generateVettingToken();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    return {
        token,
        expiryDate
    };
};

/**
 * Validate token format
 * @param {string} token - Token to validate
 * @returns {boolean} True if token format is valid
 */
export const isValidTokenFormat = (token) => {
    if (!token || typeof token !== 'string') return false;
    // Token should be 64 character hex string
    return /^[a-f0-9]{64}$/i.test(token);
};



