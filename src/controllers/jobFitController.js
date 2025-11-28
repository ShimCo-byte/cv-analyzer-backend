/**
 * Job Fit Analysis Controller
 * Spracováva HTTP requesty pre analýzu zhody CV s pozíciou
 */

import { analyzeJobFit, getAvailablePrograms } from '../services/jobFitService.js';

/**
 * POST /analyze-job-fit
 * Analyzuje zhodu CV s požiadavkami pozície alebo študijného programu
 */
export async function analyzeJobFitHandler(req, res) {
  try {
    const { resumeData, jobDescription, studyProgram, selectedSchool } = req.body;

    // Validácia
    if (!resumeData) {
      return res.status(400).json({
        success: false,
        error: 'Missing resumeData',
        message: 'Resume data is required for analysis'
      });
    }

    if (!jobDescription && !studyProgram) {
      return res.status(400).json({
        success: false,
        error: 'Missing job requirements',
        message: 'Either jobDescription or studyProgram must be provided'
      });
    }

    // Validácia resumeData štruktúry
    if (!resumeData.skills || !Array.isArray(resumeData.skills)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid resumeData format',
        message: 'resumeData must contain a skills array'
      });
    }

    // Vykonaj analýzu
    const analysis = analyzeJobFit(resumeData, jobDescription, studyProgram);

    // Vráť výsledok
    return res.status(200).json({
      success: true,
      message: 'Job fit analysis completed',
      data: analysis.toJSON()
    });

  } catch (error) {
    console.error('Error in analyzeJobFit:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to analyze job fit',
      message: error.message
    });
  }
}

/**
 * GET /study-programs
 * Vráti dostupné študijné programy
 */
export async function getStudyPrograms(req, res) {
  try {
    const programs = getAvailablePrograms();

    return res.status(200).json({
      success: true,
      data: programs
    });

  } catch (error) {
    console.error('Error in getStudyPrograms:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch study programs',
      message: error.message
    });
  }
}
