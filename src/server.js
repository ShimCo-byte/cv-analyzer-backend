/**
 * Express Server
 * Hlavný entry point aplikácie
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { scrapeJobsFromLinkedIn, jobStore } from './services/jobScraperService.js';

// Načítaj environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ======================
// Middleware
// ======================

// CORS - povoľ všetky origins (v produkcii obmedziť)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// ======================
// Routes
// ======================

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CV Analyzer Backend API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      uploadResume: 'POST /api/upload-resume',
      analyzeJobFit: 'POST /api/analyze-job-fit',
      studyPrograms: 'GET /api/study-programs',
      jobOffers: 'GET /api/job-offers',
      jobStats: 'GET /api/job-offers/stats',
      triggerScraping: 'POST /api/job-offers/scrape'
    },
    documentation: 'See README.md for detailed API documentation'
  });
});

// ======================
// Error Handling
// ======================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ======================
// Job Scraping & Expiration Scheduler
// ======================

// Run job scraping every day at 8:00 AM
const SCRAPE_SCHEDULE = '0 8 * * *'; // Cron: minute hour day month weekday

// Run job expiration check every day at 6:00 AM (before scraping)
const EXPIRATION_CHECK_SCHEDULE = '0 6 * * *'; // Cron: minute hour day month weekday

console.log('📅 Setting up job schedulers...');
console.log(`   Expiration check: Every day at 6:00 AM (${EXPIRATION_CHECK_SCHEDULE})`);
console.log(`   Job scraping: Every day at 8:00 AM (${SCRAPE_SCHEDULE})`);

// Job expiration check - runs at 6:00 AM every day
cron.schedule(EXPIRATION_CHECK_SCHEDULE, () => {
  console.log('\n🧹 Running daily job expiration check...');
  try {
    const removedCount = jobStore.removeExpiredJobs();
    console.log(`✅ Expiration check completed. Removed ${removedCount} expired jobs.`);
    console.log(`📊 Current job count: ${jobStore.getAllJobs().length}\n`);
  } catch (error) {
    console.error('❌ Job expiration check failed:', error.message);
  }
});

// Job scraping - runs at 8:00 AM every day
cron.schedule(SCRAPE_SCHEDULE, async () => {
  console.log('\n⏰ Scheduled job scraping started...');
  try {
    await scrapeJobsFromLinkedIn();
    console.log('✅ Scheduled scraping completed successfully\n');
  } catch (error) {
    console.error('❌ Scheduled scraping failed:', error.message);
  }
});

// Generate mock jobs immediately on server start (instant availability)
console.log('🎭 Generating mock jobs for instant availability...');

// Import mock generator class
const { MockJobGenerator } = await import('./services/jobScraperService.js');
const mockGenerator = new MockJobGenerator();
const mockJobs = mockGenerator.generateMockJobs(300);
mockJobs.forEach(job => jobStore.addJob(job));
jobStore.lastUpdate = new Date().toISOString();
console.log(`✅ ${mockJobs.length} mock jobs generated and ready!\n`);

// Run real scraping in background (will add more jobs over time)
console.log('🔄 Starting background job scraping from LinkedIn...\n');
scrapeJobsFromLinkedIn().then(() => {
  console.log('✅ Background scraping completed\n');
}).catch(error => {
  console.error('❌ Background scraping failed:', error.message);
});

// ======================
// Server Start
// ======================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('=================================');
  console.log('CV Analyzer Backend Server');
  console.log('=================================');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at: http://localhost:${PORT}/api`);
  console.log('=================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
