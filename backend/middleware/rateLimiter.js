const rateLimitData = {};

/**
 * A lightweight in-memory rate limiting middleware
 * @param {number} limit - Maximum number of requests allowed in the time window
 * @param {number} windowMs - Time window in milliseconds
 */
const rateLimiter = (limit, windowMs) => {
  return (req, res, next) => {
    // Basic IP detection
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!rateLimitData[ip]) {
      rateLimitData[ip] = [];
    }

    // Keep only requests made within the current time window
    rateLimitData[ip] = rateLimitData[ip].filter(timestamp => now - timestamp < windowMs);

    if (rateLimitData[ip].length >= limit) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests from this IP. Please try again later.'
      });
    }

    rateLimitData[ip].push(now);
    next();
  };
};

module.exports = { rateLimiter };
