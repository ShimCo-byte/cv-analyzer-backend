/**
 * Routes Configuration
 * Definuje všetky API endpoints
 */

import express from 'express';
import multer from 'multer';
import { uploadResume } from '../controllers/resumeController.js';
import { analyzeJobFitHandler, getStudyPrograms } from '../controllers/jobFitController.js';
import { healthCheck } from '../controllers/healthController.js';
import jobOffersRoutes from './jobOffersRoutes.js';
import authRoutes from './authRoutes.js';

const router = express.Router();

// Multer konfigurácia pre file upload
const upload = multer({
  storage: multer.memoryStorage(), // Ukladáme do pamäte (buffer)
  limits: {
    fileSize: 10 * 1024 * 1024, // Max 10MB
  },
  fileFilter: (req, file, cb) => {
    // Povoľ len PDF a text súbory
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('text/')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and text files are allowed'), false);
    }
  }
});

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', healthCheck);

/**
 * @route   POST /upload-resume
 * @desc    Upload a resume (PDF or text) and extract structured data
 * @access  Public
 * @body    { file: PDF, text: string }
 * @returns { success, data: { skills, education, experience, certifications, keywords } }
 */
router.post('/upload-resume', upload.single('file'), uploadResume);

/**
 * @route   POST /analyze-job-fit
 * @desc    Analyze job fit between resume and job requirements
 * @access  Public
 * @body    { resumeData, jobDescription?, studyProgram? }
 * @returns { success, data: { fitScore, explanation, missingSkills, suggestionsToImprove, recommendedResources } }
 */
router.post('/analyze-job-fit', analyzeJobFitHandler);

/**
 * @route   GET /study-programs
 * @desc    Get available study programs
 * @access  Public
 * @returns { success, data: [{ id, name, difficulty }] }
 */
router.get('/study-programs', getStudyPrograms);

/**
 * @route   /job-offers
 * @desc    Job offers endpoints
 * @access  Public
 */
router.use('/job-offers', jobOffersRoutes);

/**
 * @route   /auth
 * @desc    Authentication endpoints
 * @access  Public
 */
router.use('/auth', authRoutes);

export default router;
