/**
 * Job Fit Analysis Service
 * Analyzuje zhodu CV s požiadavkami pozície alebo študijného programu
 */

import { JobFitAnalysis, RecommendedResource } from '../models/JobFitAnalysis.js';
import { extractSkills, extractKeywords } from '../utils/textParser.js';

/**
 * Databáza študijných programov a ich požiadaviek
 * V produkcii by to bola samostatná databáza alebo API
 */
const STUDY_PROGRAMS = {
  'computer-science': {
    name: 'Computer Science',
    requiredSkills: ['JavaScript', 'Python', 'Java', 'C++', 'SQL', 'Git', 'algorithms', 'data structures'],
    recommendedSkills: ['React', 'Node.js', 'Docker', 'Linux', 'AWS'],
    difficulty: 'advanced'
  },
  'web-development': {
    name: 'Web Development',
    requiredSkills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'Git'],
    recommendedSkills: ['TypeScript', 'Next.js', 'MongoDB', 'REST API', 'responsive design'],
    difficulty: 'intermediate'
  },
  'data-science': {
    name: 'Data Science',
    requiredSkills: ['Python', 'R', 'SQL', 'statistics', 'machine learning', 'pandas', 'numpy'],
    recommendedSkills: ['TensorFlow', 'PyTorch', 'Jupyter', 'scikit-learn', 'data visualization'],
    difficulty: 'advanced'
  },
  'cybersecurity': {
    name: 'Cybersecurity',
    requiredSkills: ['networking', 'Linux', 'security', 'cryptography', 'penetration testing'],
    recommendedSkills: ['Python', 'Wireshark', 'Metasploit', 'OWASP', 'cloud security'],
    difficulty: 'advanced'
  }
};

/**
 * Analyzuje zhodu CV s požiadavkami
 * @param {Object} resumeData - Dáta z CV
 * @param {string} jobDescription - Popis pracovnej pozície (voliteľné)
 * @param {string} studyProgram - ID študijného programu (voliteľné)
 * @returns {JobFitAnalysis} - Výsledok analýzy
 */
export function analyzeJobFit(resumeData, jobDescription = null, studyProgram = null) {
  try {
    let requiredSkills = [];
    let recommendedSkills = [];
    let context = '';

    // Analýza podľa študijného programu
    if (studyProgram && STUDY_PROGRAMS[studyProgram]) {
      const program = STUDY_PROGRAMS[studyProgram];
      requiredSkills = program.requiredSkills;
      recommendedSkills = program.recommendedSkills;
      context = program.name;
    }
    // Analýza podľa job description
    else if (jobDescription) {
      requiredSkills = extractSkills(jobDescription);
      recommendedSkills = extractKeywords(jobDescription);
      context = 'Job Position';
    }
    else {
      throw new Error('Either jobDescription or studyProgram must be provided');
    }

    // Normalizuj zručnosti kandidáta
    const candidateSkills = resumeData.skills.map(s => s.toLowerCase());
    const normalizedRequired = requiredSkills.map(s => s.toLowerCase());
    const normalizedRecommended = recommendedSkills.map(s => s.toLowerCase());

    // Nájdi matched a missing skills
    const matchedSkills = normalizedRequired.filter(skill =>
      candidateSkills.some(cs => cs.includes(skill) || skill.includes(cs))
    );

    const missingSkills = normalizedRequired.filter(skill =>
      !candidateSkills.some(cs => cs.includes(skill) || skill.includes(cs))
    );

    // Vypočítaj fit score (0-100) - vylepšená verzia
    const requiredScore = normalizedRequired.length > 0
      ? (matchedSkills.length / normalizedRequired.length) * 60  // Skills = 60%
      : 0;

    const experienceScore = calculateExperienceScore(resumeData.experience) * 25;  // Experience = 25%
    const educationScore = calculateEducationScore(resumeData.education) * 10;  // Education = 10%
    const bonusScore = calculateBonusScore(resumeData, normalizedRecommended) * 5;  // Bonus = 5%

    let fitScore = Math.round(requiredScore + experienceScore + educationScore + bonusScore);

    // Pridaj base score - aj prázdne CV má aspoň 15-20 bodov
    if (fitScore < 20 && candidateSkills.length > 0) {
      fitScore = Math.max(fitScore, 15);
    }

    fitScore = Math.min(fitScore, 100);

    // Generuj detailnú analýzu
    const detailedAnalysis = generateDetailedAnalysis(resumeData, matchedSkills, missingSkills, normalizedRequired);

    // Generuj vysvetlenie
    const explanation = generateExplanation(fitScore, matchedSkills, missingSkills, context, detailedAnalysis);

    // Generuj konkrétne odporúčania na úpravu CV
    const suggestionsToImprove = generateDetailedSuggestions(missingSkills, resumeData, detailedAnalysis);

    // Generuj odporúčané zdroje
    const recommendedResources = generateRecommendedResources(missingSkills, studyProgram);

    // Vytvor JobFitAnalysis objekt
    const analysis = new JobFitAnalysis({
      resumeId: resumeData.id,
      jobDescription,
      studyProgram,
      fitScore,
      explanation,
      missingSkills,
      matchedSkills,
      suggestionsToImprove,
      recommendedResources
    });

    return analysis;

  } catch (error) {
    throw new Error(`Failed to analyze job fit: ${error.message}`);
  }
}

/**
 * Vypočíta bonus skóre za odporúčané skills a certifikácie
 */
function calculateBonusScore(resumeData, recommendedSkills) {
  let bonus = 0;

  // Bonus za odporúčané skills
  const candidateSkills = resumeData.skills.map(s => s.toLowerCase());
  const matchedRecommended = recommendedSkills.filter(skill =>
    candidateSkills.some(cs => cs.includes(skill) || skill.includes(cs))
  );
  bonus += matchedRecommended.length > 0 ? 0.3 : 0;

  // Bonus za certifikácie
  if (resumeData.certifications && resumeData.certifications.length > 0) {
    bonus += Math.min(resumeData.certifications.length * 0.2, 0.5);
  }

  // Bonus za kontaktné informácie (profesionálne CV)
  if (resumeData.contactInfo) {
    let contactBonus = 0;
    if (resumeData.contactInfo.email) contactBonus += 0.05;
    if (resumeData.contactInfo.linkedin) contactBonus += 0.1;
    if (resumeData.contactInfo.github) contactBonus += 0.1;
    bonus += contactBonus;
  }

  return Math.min(bonus, 1);
}

/**
 * Generuje detailnú analýzu CV
 */
function generateDetailedAnalysis(resumeData, matchedSkills, missingSkills, requiredSkills) {
  const analysis = {
    strengths: [],
    weaknesses: [],
    cvIssues: [],
    recommendations: []
  };

  // Analýza silných stránok
  if (matchedSkills.length > 0) {
    analysis.strengths.push(`You have ${matchedSkills.length} out of ${requiredSkills.length} required skills`);
  }

  if (resumeData.experience && resumeData.experience.length > 0) {
    const years = resumeData.experience.reduce((total, exp) => {
      const start = exp.startDate ? parseInt(exp.startDate) : new Date().getFullYear();
      const end = exp.endDate ? parseInt(exp.endDate) : new Date().getFullYear();
      return total + Math.max(0, end - start);
    }, 0);
    if (years > 0) {
      analysis.strengths.push(`${years}+ years of relevant work experience`);
    }
  }

  if (resumeData.certifications && resumeData.certifications.length > 0) {
    analysis.strengths.push(`${resumeData.certifications.length} professional certification(s)`);
  }

  // Analýza slabých stránok
  if (missingSkills.length > 0) {
    analysis.weaknesses.push(`Missing ${missingSkills.length} critical skills: ${missingSkills.slice(0, 3).join(', ')}`);
  }

  if (!resumeData.experience || resumeData.experience.length === 0) {
    analysis.weaknesses.push('No work experience listed');
    analysis.cvIssues.push('Add at least one work experience or internship to strengthen your CV');
  }

  if (!resumeData.education || resumeData.education.length === 0) {
    analysis.weaknesses.push('No education information provided');
    analysis.cvIssues.push('Include your educational background (degree, university, graduation year)');
  }

  // Analýza problémov v CV
  if (!resumeData.contactInfo || !resumeData.contactInfo.email) {
    analysis.cvIssues.push('Add contact email address to your CV');
  }

  if (!resumeData.contactInfo || !resumeData.contactInfo.linkedin) {
    analysis.cvIssues.push('Consider adding LinkedIn profile link for professional networking');
  }

  if (resumeData.skills.length < 5) {
    analysis.cvIssues.push('List more skills in your CV - aim for at least 8-10 relevant technical skills');
  }

  if (resumeData.experience && resumeData.experience.length > 0) {
    const hasDescriptions = resumeData.experience.some(exp => exp.description && exp.description.length > 50);
    if (!hasDescriptions) {
      analysis.cvIssues.push('Add detailed descriptions to your work experience (responsibilities, achievements, technologies used)');
    }
  }

  // Odporúčania na zlepšenie
  if (missingSkills.length > 0) {
    const topMissing = missingSkills.slice(0, 3);
    topMissing.forEach(skill => {
      analysis.recommendations.push(`Learn ${skill} - it's a critical requirement`);
    });
  }

  if (!resumeData.certifications || resumeData.certifications.length === 0) {
    analysis.recommendations.push('Obtain industry-recognized certifications to stand out');
  }

  return analysis;
}

/**
 * Vypočíta skóre na základe pracovných skúseností
 */
function calculateExperienceScore(experience) {
  if (!experience || experience.length === 0) return 0;

  // Viac rokov = vyššie skóre
  const yearsOfExperience = experience.reduce((total, exp) => {
    const start = exp.startDate ? parseInt(exp.startDate) : new Date().getFullYear();
    const end = exp.endDate ? parseInt(exp.endDate) : new Date().getFullYear();
    return total + Math.max(0, end - start);
  }, 0);

  // Normalizuj na 0-1
  return Math.min(yearsOfExperience / 5, 1);
}

/**
 * Vypočíta skóre na základe vzdelania
 */
function calculateEducationScore(education) {
  if (!education || education.length === 0) return 0;

  const degreeWeights = {
    'PhD': 1.0,
    'Master': 0.8,
    'M.S.': 0.8,
    'M.A.': 0.8,
    'M.Sc.': 0.8,
    'Bachelor': 0.6,
    'B.S.': 0.6,
    'B.A.': 0.6,
    'B.Sc.': 0.6
  };

  let maxScore = 0;

  education.forEach(edu => {
    const degree = edu.degree || '';
    for (const [key, weight] of Object.entries(degreeWeights)) {
      if (degree.includes(key)) {
        maxScore = Math.max(maxScore, weight);
      }
    }
  });

  return maxScore;
}

/**
 * Generuje textové vysvetlenie analýzy
 */
function generateExplanation(fitScore, matchedSkills, missingSkills, context, detailedAnalysis) {
  let explanation = `Analysis for ${context}:\n\n`;

  // Hlavné hodnotenie
  if (fitScore >= 80) {
    explanation += `🌟 Excellent fit! You possess ${matchedSkills.length} of the key skills required.`;
  } else if (fitScore >= 60) {
    explanation += `✓ Good fit! You have ${matchedSkills.length} relevant skills, but there are areas for improvement.`;
  } else if (fitScore >= 40) {
    explanation += `⚠ Moderate fit. You have some relevant skills (${matchedSkills.length}), but significant gaps exist.`;
  } else if (fitScore >= 20) {
    explanation += `⚡ Your profile shows potential. You have ${matchedSkills.length} relevant skills, but need to develop more to be competitive.`;
  } else {
    explanation += `📚 Your profile needs significant development. Focus on building foundational skills first.`;
  }

  // Pridaj silné stránky
  if (detailedAnalysis.strengths.length > 0) {
    explanation += `\n\nStrengths:\n${detailedAnalysis.strengths.map(s => `• ${s}`).join('\n')}`;
  }

  // Pridaj slabé stránky
  if (detailedAnalysis.weaknesses.length > 0) {
    explanation += `\n\nAreas for improvement:\n${detailedAnalysis.weaknesses.map(w => `• ${w}`).join('\n')}`;
  }

  // Pridaj matched skills
  if (matchedSkills.length > 0) {
    explanation += `\n\nMatched skills (${matchedSkills.length}): ${matchedSkills.slice(0, 8).join(', ')}`;
    if (matchedSkills.length > 8) {
      explanation += ` and ${matchedSkills.length - 8} more`;
    }
  }

  // Pridaj missing skills
  if (missingSkills.length > 0) {
    explanation += `\n\nMissing critical skills (${missingSkills.length}): ${missingSkills.slice(0, 8).join(', ')}`;
    if (missingSkills.length > 8) {
      explanation += ` and ${missingSkills.length - 8} more`;
    }
  }

  return explanation;
}

/**
 * Generuje detailné návrhy na zlepšenie CV
 */
function generateDetailedSuggestions(missingSkills, resumeData, detailedAnalysis) {
  const suggestions = [];

  // Prioritné: Chýbajúce kritické skills
  if (missingSkills.length > 0) {
    const topMissing = missingSkills.slice(0, 3).join(', ');
    suggestions.push(`🎯 PRIORITY: Learn these critical skills - ${topMissing}`);

    if (missingSkills.length > 3) {
      suggestions.push(`📚 Additional skills to acquire: ${missingSkills.slice(3, 6).join(', ')}`);
    }
  }

  // Konkrétne úpravy CV
  if (detailedAnalysis.cvIssues.length > 0) {
    suggestions.push(`📝 CV Improvements:`);
    detailedAnalysis.cvIssues.forEach(issue => {
      suggestions.push(`   • ${issue}`);
    });
  }

  // Experience related
  if (!resumeData.experience || resumeData.experience.length === 0) {
    suggestions.push(`💼 Add work experience: Include internships, part-time jobs, or volunteer work. Describe your responsibilities and achievements.`);
  } else if (resumeData.experience.length < 2) {
    suggestions.push(`💼 Build more experience: Look for internships, freelance projects, or contribute to open-source projects.`);
  }

  // Education
  if (!resumeData.education || resumeData.education.length === 0) {
    suggestions.push(`🎓 Add education details: List your degree, major, university, and graduation year (or expected date).`);
  }

  // Certifications
  if (!resumeData.certifications || resumeData.certifications.length === 0) {
    suggestions.push(`🏆 Get certified: Obtain industry-recognized certifications (e.g., AWS, Google Cloud, Microsoft) to validate your skills.`);
  }

  // Skills section
  if (resumeData.skills.length < 8) {
    suggestions.push(`🔧 Expand skills section: Add 8-12 relevant technical skills. Include programming languages, frameworks, tools, and soft skills.`);
  }

  // Contact info
  if (!resumeData.contactInfo || !resumeData.contactInfo.linkedin) {
    suggestions.push(`🔗 Add professional links: Include LinkedIn profile and GitHub portfolio to showcase your work.`);
  }

  // Projects (ak nie sú v experience)
  if (resumeData.experience && resumeData.experience.length > 0) {
    const hasProjects = resumeData.experience.some(exp =>
      exp.description && (exp.description.toLowerCase().includes('project') || exp.description.toLowerCase().includes('built'))
    );
    if (!hasProjects) {
      suggestions.push(`🚀 Add projects: Include personal or academic projects that demonstrate your practical skills.`);
    }
  }

  // Quantify achievements
  suggestions.push(`📊 Quantify achievements: Use numbers and metrics (e.g., "Improved performance by 40%", "Managed team of 5", "Processed 10K+ requests daily")`);

  // Action verbs
  suggestions.push(`💪 Use action verbs: Start bullet points with strong verbs like "Developed", "Implemented", "Led", "Optimized", "Designed"`);

  return suggestions;
}

/**
 * Generuje odporúčané vzdelávacie zdroje
 */
function generateRecommendedResources(missingSkills, studyProgram) {
  const resources = [];

  // Resource databáza
  const resourceDatabase = {
    'javascript': [
      new RecommendedResource({
        type: 'course',
        title: 'The Complete JavaScript Course',
        provider: 'Udemy',
        url: 'https://www.udemy.com/course/the-complete-javascript-course/',
        relevance: 'Core JavaScript fundamentals',
        difficulty: 'beginner'
      })
    ],
    'python': [
      new RecommendedResource({
        type: 'course',
        title: 'Python for Everybody',
        provider: 'Coursera',
        url: 'https://www.coursera.org/specializations/python',
        relevance: 'Python basics and data structures',
        difficulty: 'beginner'
      })
    ],
    'react': [
      new RecommendedResource({
        type: 'course',
        title: 'React - The Complete Guide',
        provider: 'Udemy',
        url: 'https://www.udemy.com/course/react-the-complete-guide/',
        relevance: 'Modern React development',
        difficulty: 'intermediate'
      })
    ],
    'node.js': [
      new RecommendedResource({
        type: 'course',
        title: 'Node.js Developer Course',
        provider: 'Udemy',
        url: 'https://www.udemy.com/course/the-complete-nodejs-developer-course-2/',
        relevance: 'Backend development with Node.js',
        difficulty: 'intermediate'
      })
    ],
    'docker': [
      new RecommendedResource({
        type: 'course',
        title: 'Docker Mastery',
        provider: 'Udemy',
        url: 'https://www.udemy.com/course/docker-mastery/',
        relevance: 'Containerization and DevOps',
        difficulty: 'intermediate'
      })
    ],
    'aws': [
      new RecommendedResource({
        type: 'certification',
        title: 'AWS Certified Developer',
        provider: 'Amazon Web Services',
        url: 'https://aws.amazon.com/certification/certified-developer-associate/',
        relevance: 'Cloud computing with AWS',
        difficulty: 'advanced'
      })
    ]
  };

  // Pridaj všeobecné projekty
  resources.push(
    new RecommendedResource({
      type: 'project',
      title: 'Build a Portfolio Website',
      provider: 'Self-guided',
      url: '',
      relevance: 'Showcase your skills and projects',
      difficulty: 'beginner'
    })
  );

  // Pridaj zdroje podľa chýbajúcich skills
  missingSkills.slice(0, 5).forEach(skill => {
    const skillKey = skill.toLowerCase().replace(/\s+/g, '');
    if (resourceDatabase[skillKey]) {
      resources.push(...resourceDatabase[skillKey]);
    }
  });

  // Pridaj knihy
  resources.push(
    new RecommendedResource({
      type: 'book',
      title: 'Clean Code',
      provider: 'Robert C. Martin',
      url: '',
      relevance: 'Software engineering best practices',
      difficulty: 'intermediate'
    })
  );

  return resources.slice(0, 8); // Limit na 8 zdrojov
}

/**
 * Získa zoznam dostupných študijných programov
 */
export function getAvailablePrograms() {
  return Object.entries(STUDY_PROGRAMS).map(([id, program]) => ({
    id,
    name: program.name,
    difficulty: program.difficulty
  }));
}
