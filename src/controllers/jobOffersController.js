/**
 * Job Offers Controller
 * Handles job offers related API endpoints
 */

import {
  getAllJobs,
  getJobsByCategory,
  getScrapingStats,
  filterJobs,
  scrapeJobsFromLinkedIn
} from '../services/jobScraperService.js';

import {
  getMatchedJobs,
  getMatchStatistics,
  generatePersonalizedResumeForJob
} from '../services/jobMatchingService.js';

import { generateProfessionalResume } from '../services/professionalResumeGenerator.js';

/**
 * GET /api/job-offers
 * Get all available job offers
 */
export async function getJobOffers(req, res) {
  try {
    const { type, experienceLevel, company, search, category } = req.query;

    let jobs;

    // Filter by category if specified
    if (category) {
      jobs = getJobsByCategory(category);
    }
    // Filter by other criteria
    else if (type || experienceLevel || company || search) {
      jobs = filterJobs({ type, experienceLevel, company, search });
    }
    // Get all jobs
    else {
      jobs = getAllJobs();
    }

    const stats = getScrapingStats();

    res.json({
      success: true,
      data: {
        jobs,
        stats,
        filters: {
          type,
          experienceLevel,
          company,
          search,
          category
        }
      },
      message: `Found ${jobs.length} job offers`
    });

  } catch (error) {
    console.error('Error fetching job offers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job offers',
      message: error.message
    });
  }
}

/**
 * GET /api/job-offers/stats
 * Get scraping statistics
 */
export async function getJobStats(req, res) {
  try {
    const stats = getScrapingStats();

    res.json({
      success: true,
      data: stats,
      message: 'Job statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching job stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job statistics',
      message: error.message
    });
  }
}

/**
 * POST /api/job-offers/scrape
 * Manually trigger job scraping (for testing/admin purposes)
 */
export async function triggerScraping(req, res) {
  try {
    console.log('🔄 Manual scraping triggered via API...');

    const result = await scrapeJobsFromLinkedIn();

    res.json({
      success: result.success,
      data: {
        jobsCount: result.jobsCount,
        lastUpdate: result.lastUpdate,
        usingMockData: result.usingMockData || false
      },
      message: result.success
        ? `Successfully scraped ${result.jobsCount} jobs`
        : `Scraping failed, using mock data: ${result.jobsCount} jobs`
    });

  } catch (error) {
    console.error('Error triggering scraping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger scraping',
      message: error.message
    });
  }
}

/**
 * GET /api/job-offers/:id
 * Get specific job by ID
 */
export async function getJobById(req, res) {
  try {
    const { id } = req.params;
    const jobs = getAllJobs();
    const job = jobs.find(j => j.id === id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        message: `No job found with ID: ${id}`
      });
    }

    res.json({
      success: true,
      data: job,
      message: 'Job retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching job by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job',
      message: error.message
    });
  }
}

/**
 * POST /api/job-offers/matched
 * Get matched jobs based on user profile
 */
export async function getMatchedJobsForProfile(req, res) {
  try {
    const { userProfile, minScore = 40, maxResults = 50, sortBy = 'score' } = req.body;

    if (!userProfile) {
      return res.status(400).json({
        success: false,
        error: 'User profile is required',
        message: 'Please provide a user profile to match jobs'
      });
    }

    // Get matched jobs
    const result = getMatchedJobs(userProfile, { minScore, maxResults, sortBy });

    // Get statistics
    const stats = getMatchStatistics(userProfile);

    // Auto-detect language based on location
    let language = 'en';
    if (userProfile.currentLocation) {
      const location = userProfile.currentLocation.toLowerCase();
      if (location.includes('slovakia') || location.includes('slovensko') ||
          location.includes('bratislava') || location.includes('košice')) {
        language = 'sk';
      }
    }

    // Generate resume from profile
    const generatedResume = generateProfessionalResume(userProfile, language);

    res.json({
      success: true,
      data: {
        jobs: result.jobs,
        totalMatches: result.totalMatches,
        totalJobs: result.totalJobs,
        matchRate: result.matchRate,
        stats,
        generatedResume
      },
      message: `Found ${result.totalMatches} matching jobs out of ${result.totalJobs}`
    });

  } catch (error) {
    console.error('Error getting matched jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get matched jobs',
      message: error.message
    });
  }
}

/**
 * POST /api/job-offers/personalized-resume
 * Generate a personalized resume tailored for a specific job
 */
export async function getPersonalizedResume(req, res) {
  try {
    const { userProfile, jobId, language = 'en' } = req.body;

    if (!userProfile) {
      return res.status(400).json({
        success: false,
        error: 'User profile is required',
        message: 'Please provide a user profile to generate resume'
      });
    }

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required',
        message: 'Please provide a job ID to personalize the resume'
      });
    }

    // Find the job
    const jobs = getAllJobs();
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }

    // Auto-detect language based on location if not specified
    let lang = language;
    if (!language && userProfile.currentLocation) {
      const location = userProfile.currentLocation.toLowerCase();
      if (location.includes('slovakia') || location.includes('slovensko') ||
          location.includes('bratislava') || location.includes('košice')) {
        lang = 'sk';
      }
    }

    // Generate personalized resume
    const personalizedResume = generatePersonalizedResumeForJob(userProfile, job, lang);

    res.json({
      success: true,
      data: {
        resume: personalizedResume,
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location
        },
        language: lang
      },
      message: `Personalized resume generated for ${job.title} at ${job.company}`
    });

  } catch (error) {
    console.error('Error generating personalized resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate personalized resume',
      message: error.message
    });
  }
}
