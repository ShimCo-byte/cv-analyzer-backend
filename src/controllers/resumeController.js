/**
 * Resume Controller
 * Spracováva HTTP requesty pre resume endpoints
 */

import { processResume, saveResume } from '../services/resumeService.js';
import { convertResumeToProfile } from '../services/profileExtractor.js';
import { getMatchedJobs } from '../services/jobMatchingService.js';
import { generateProfessionalResume } from '../services/professionalResumeGenerator.js';

/**
 * POST /upload-resume
 * Uploadne a spracuje CV (PDF alebo text)
 * Automaticky nájde vhodné práce a vygeneruje pekne formátované CV
 */
export async function uploadResume(req, res) {
  try {
    const file = req.file; // Multer file object
    const textInput = req.body.text; // Voliteľný textový vstup

    // Validácia
    if (!file && !textInput) {
      return res.status(400).json({
        success: false,
        error: 'Either PDF file or text input is required',
        message: 'Please provide resume as PDF file or plain text'
      });
    }

    // Validácia typu súboru
    if (file && !file.mimetype.includes('pdf') && !file.mimetype.includes('text')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: 'Only PDF and text files are supported'
      });
    }

    // Spracuj resume
    const resume = await processResume(file, textInput);

    // Ulož do storage
    saveResume(resume);

    // Konvertuj na UserProfile
    const userProfile = convertResumeToProfile(resume, resume.rawText);

    // Auto-detect language based on location
    let language = 'en';
    if (userProfile.currentLocation) {
      const location = userProfile.currentLocation.toLowerCase();
      if (location.includes('slovakia') || location.includes('slovensko') ||
          location.includes('bratislava') || location.includes('košice')) {
        language = 'sk';
      }
    }

    // Nájdi matching jobs
    const matchedJobsResult = getMatchedJobs(userProfile, {
      minScore: 50,
      maxResults: 20,
      sortBy: 'score'
    });

    // Vygeneruj pekne formátované CV (Professional Format)
    const formattedResume = generateProfessionalResume(userProfile, language);

    // Vráť kompletné dáta
    return res.status(200).json({
      success: true,
      message: 'Resume processed successfully',
      data: {
        originalResume: resume.toJSON(),
        extractedProfile: userProfile,
        formattedResume: formattedResume,
        matchedJobs: {
          jobs: matchedJobsResult.jobs,
          totalMatches: matchedJobsResult.totalMatches,
          matchRate: matchedJobsResult.matchRate
        }
      }
    });

  } catch (error) {
    console.error('Error in uploadResume:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to process resume',
      message: error.message
    });
  }
}

/**
 * Pomocná funkcia pre validáciu request body
 */
function validateResumeUpload(req) {
  const errors = [];

  if (!req.file && !req.body.text) {
    errors.push('Either file or text input is required');
  }

  return errors;
}
