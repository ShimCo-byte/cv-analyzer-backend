/**
 * Resume Data Model
 * Definuje štruktúru dát pre životopis
 * Pripravené pre budúcu migráciu na databázu (MongoDB/PostgreSQL)
 */

export class Resume {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.rawText = data.rawText || '';
    this.skills = data.skills || [];
    this.education = data.education || [];
    this.experience = data.experience || [];
    this.certifications = data.certifications || [];
    this.keywords = data.keywords || [];
    this.contactInfo = data.contactInfo || {};
    this.createdAt = data.createdAt || new Date().toISOString();
  }

  generateId() {
    return `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      skills: this.skills,
      education: this.education,
      experience: this.experience,
      certifications: this.certifications,
      keywords: this.keywords,
      contactInfo: this.contactInfo,
      createdAt: this.createdAt
    };
  }

  /**
   * Validácia dát pred uložením
   */
  validate() {
    if (!this.rawText && this.skills.length === 0) {
      throw new Error('Resume must contain either raw text or extracted data');
    }
    return true;
  }
}

/**
 * Education Entry Model
 */
export class Education {
  constructor(data = {}) {
    this.institution = data.institution || '';
    this.degree = data.degree || '';
    this.field = data.field || '';
    this.startDate = data.startDate || null;
    this.endDate = data.endDate || null;
    this.gpa = data.gpa || null;
  }
}

/**
 * Experience Entry Model
 */
export class Experience {
  constructor(data = {}) {
    this.company = data.company || '';
    this.position = data.position || '';
    this.description = data.description || '';
    this.startDate = data.startDate || null;
    this.endDate = data.endDate || null;
    this.technologies = data.technologies || [];
  }
}

/**
 * Certification Model
 */
export class Certification {
  constructor(data = {}) {
    this.name = data.name || '';
    this.issuer = data.issuer || '';
    this.date = data.date || null;
    this.expiryDate = data.expiryDate || null;
  }
}
