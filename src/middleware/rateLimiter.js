import rateLimit from "express-rate-limit";

const rateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // Increased from default (usually 5-10) to 100 requests per minute
  message: {
    error: "Too many requests, please try again later.",
    retryAfter: "1 minute"
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/api/health',
  // Add request info for debugging
  handler: (req, res) => {
    console.log(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: "Too many requests, please try again later.",
      retryAfter: "1 minute"
    });
  }
});

export default rateLimiter;