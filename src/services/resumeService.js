/**
 * Resume Service
 * Business logika pre spracovanie a analýzu CV
 */

import { Resume } from '../models/Resume.js';
import { extractTextFromBuffer, cleanText } from '../utils/pdfExtractor.js';
import {
  extractSkills,
  extractEducation,
  extractExperience,
  extractCertifications,
  extractKeywords,
  extractContactInfo
} from '../utils/textParser.js';

/**
 * Spracuje uploadnutý súbor a extrahuje štruktúrované dáta
 * @param {Object} file - Multer file object
 * @param {string} textInput - Voliteľný textový vstup (ak nie je PDF)
 * @returns {Promise<Resume>} - Spracované CV
 */
export async function processResume(file, textInput = null) {
  try {
    let rawText = '';

    // Ak je poskytnutý file (PDF)
    if (file) {
      rawText = await extractTextFromBuffer(file.buffer);
    }
    // Ak je poskytnutý textový vstup
    else if (textInput) {
      rawText = textInput;
    }
    else {
      throw new Error('No file or text input provided');
    }

    // Vyčisti text
    const cleanedText = cleanText(rawText);

    // Extrahuj štruktúrované dáta
    const resumeData = {
      rawText: cleanedText,
      skills: extractSkills(cleanedText),
      education: extractEducation(cleanedText),
      experience: extractExperience(cleanedText),
      certifications: extractCertifications(cleanedText),
      keywords: extractKeywords(cleanedText),
      contactInfo: extractContactInfo(cleanedText)
    };

    // Vytvor Resume objekt
    const resume = new Resume(resumeData);
    resume.validate();

    return resume;

  } catch (error) {
    throw new Error(`Failed to process resume: ${error.message}`);
  }
}

/**
 * Uloží CV do in-memory storage (pripravené pre DB)
 * Pre produkcию by sa to nahradilo databázovým uložením
 */
const resumeStorage = new Map();

export function saveResume(resume) {
  resumeStorage.set(resume.id, resume);
  return resume;
}

export function getResume(resumeId) {
  return resumeStorage.get(resumeId);
}

export function getAllResumes() {
  return Array.from(resumeStorage.values());
}
