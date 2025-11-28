/**
 * Request Logging Middleware
 * Zaznamenáva všetky HTTP requesty
 */

/**
 * Simple request logger
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Log po dokončení requestu
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    console.log(JSON.stringify(log));
  });

  next();
}
