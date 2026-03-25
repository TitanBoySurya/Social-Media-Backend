const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minutes
  max: 300, // Per IP max 300 requests
  message: { success: false, message: "Too many requests, slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter };