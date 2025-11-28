/**
 * Health Check Controller
 * Jednoduchý status endpoint pre monitoring
 */

/**
 * GET /health
 * Vráti stav servera
 */
export async function healthCheck(req, res) {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'cv-analyzer-backend',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    return res.status(200).json(healthStatus);

  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
}
