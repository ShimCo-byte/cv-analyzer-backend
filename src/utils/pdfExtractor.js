/**
 * PDF Text Extraction Utility
 * Extrahuje text z PDF súborov pomocou pdf-parse
 */

import pdfParse from 'pdf-parse';
import fs from 'fs/promises';

/**
 * Extrahuje text z PDF súboru
 * @param {string} filePath - Cesta k PDF súboru
 * @returns {Promise<string>} - Extrahovaný text
 */
export async function extractTextFromPDF(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);

    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Extrahuje text z bufferu (pre upload z frontendu)
 * @param {Buffer} buffer - PDF buffer
 * @returns {Promise<string>} - Extrahovaný text
 */
export async function extractTextFromBuffer(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    throw new Error(`Failed to extract text from buffer: ${error.message}`);
  }
}

/**
 * Vyčistí a normalizuje extrahovaný text
 * @param {string} text - Surový text
 * @returns {string} - Vyčistený text
 */
export function cleanText(text) {
  return text
    .replace(/\s+/g, ' ') // Nahraď viacnásobné medzery jednou
    .replace(/\n+/g, '\n') // Nahraď viacnásobné riadky jedným
    .trim();
}
