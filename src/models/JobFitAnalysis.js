/**
 * Job Fit Analysis Model
 * Reprezentuje výsledok analýzy zhody CV s požiadavkami pozície
 */

export class JobFitAnalysis {
  constructor(data = {}) {
    this.resumeId = data.resumeId || null;
    this.jobDescription = data.jobDescription || '';
    this.selectedSchool = data.selectedSchool || null;
    this.studyProgram = data.studyProgram || null;
    this.fitScore = data.fitScore || 0;
    this.explanation = data.explanation || '';
    this.missingSkills = data.missingSkills || [];
    this.matchedSkills = data.matchedSkills || [];
    this.suggestionsToImprove = data.suggestionsToImprove || [];
    this.recommendedResources = data.recommendedResources || [];
    this.analyzedAt = data.analyzedAt || new Date().toISOString();
  }

  toJSON() {
    return {
      fitScore: this.fitScore,
      explanation: this.explanation,
      missingSkills: this.missingSkills,
      matchedSkills: this.matchedSkills,
      suggestionsToImprove: this.suggestionsToImprove,
      recommendedResources: this.recommendedResources,
      analyzedAt: this.analyzedAt
    };
  }
}

/**
 * Recommended Resource Model
 */
export class RecommendedResource {
  constructor(data = {}) {
    this.type = data.type || 'course'; // course, project, book, certification
    this.title = data.title || '';
    this.provider = data.provider || '';
    this.url = data.url || '';
    this.relevance = data.relevance || '';
    this.difficulty = data.difficulty || 'intermediate'; // beginner, intermediate, advanced
  }
}
