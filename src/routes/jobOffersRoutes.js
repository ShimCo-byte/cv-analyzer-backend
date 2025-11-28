/**
 * Job Offers Routes
 */

import express from 'express';
import {
  getJobOffers,
  getJobStats,
  triggerScraping,
  getJobById,
  getMatchedJobsForProfile,
  getPersonalizedResume
} from '../controllers/jobOffersController.js';

const router = express.Router();

/**
 * GET /api/job-offers
 * Get all job offers with optional filters
 * Query params: type, experienceLevel, company, search, category
 */
router.get('/', getJobOffers);

/**
 * GET /api/job-offers/stats
 * Get job scraping statistics
 */
router.get('/stats', getJobStats);

/**
 * POST /api/job-offers/scrape
 * Manually trigger job scraping
 */
router.post('/scrape', triggerScraping);

/**
 * POST /api/job-offers/matched
 * Get matched jobs based on user profile
 */
router.post('/matched', getMatchedJobsForProfile);

/**
 * POST /api/job-offers/personalized-resume
 * Generate a personalized resume tailored for a specific job
 */
router.post('/personalized-resume', getPersonalizedResume);

/**
 * GET /api/job-offers/:id
 * Get specific job by ID
 */
router.get('/:id', getJobById);

export default router;
