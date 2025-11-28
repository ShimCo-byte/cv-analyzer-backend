/**
 * Job Matching Service
 * Matches user profiles with suitable job offers
 */

import { getAllJobs } from './jobScraperService.js';

/**
 * Calculate match score between user profile and job
 */
export function calculateJobMatchScore(userProfile, job) {
  let score = 0;
  const reasons = [];
  const issues = [];

  // 0. Job Category Match - HARD FILTER
  // If user wants Frontend Developer, don't show Finance/HR/Support jobs
  const categoryMatch = calculateJobCategoryMatch(userProfile, job);
  if (!categoryMatch.match) {
    return { score: 0, reasons, issues: [categoryMatch.issue], suitable: false };
  }
  score += categoryMatch.score;
  if (categoryMatch.reason) {
    reasons.push(categoryMatch.reason);
  }

  // 1. Location Match (25 points)
  const locationScore = calculateLocationMatch(userProfile, job);
  score += locationScore.score;
  if (locationScore.match) {
    reasons.push(locationScore.reason);
  } else if (locationScore.issue) {
    issues.push(locationScore.issue);
    return { score: 0, reasons, issues, suitable: false }; // Hard filter
  }

  // 2. Remote Preference Match (15 points)
  const remoteScore = calculateRemoteMatch(userProfile, job);
  score += remoteScore.score;
  if (remoteScore.match) {
    reasons.push(remoteScore.reason);
  }

  // 3. Skills Match (25 points)
  const skillsScore = calculateSkillsMatch(userProfile, job);
  score += skillsScore.score;
  if (skillsScore.reasons.length > 0) {
    reasons.push(...skillsScore.reasons);
  }

  // 4. Experience Level Match (10 points)
  const experienceScore = calculateExperienceMatch(userProfile, job);
  score += experienceScore.score;
  if (experienceScore.match) {
    reasons.push(experienceScore.reason);
  }

  // 5. Job Type Match (5 points)
  const jobTypeScore = calculateJobTypeMatch(userProfile, job);
  score += jobTypeScore.score;
  if (jobTypeScore.match) {
    reasons.push(jobTypeScore.reason);
  }

  return {
    score: Math.round(Math.min(100, score)), // Always round to whole number
    reasons,
    issues,
    suitable: score >= 40 // Minimum 40% match
  };
}

/**
 * Job Category Match - Hard filter to exclude completely unrelated jobs
 * If user wants Frontend Developer, don't show Payroll Specialist or HR jobs
 */
function calculateJobCategoryMatch(userProfile, job) {
  const desiredPosition = (userProfile.desiredPosition || '').toLowerCase();
  const jobTypes = (userProfile.jobTypes || []).map(t => t.toLowerCase());
  const jobTitle = job.title.toLowerCase();
  const jobType = job.type.toLowerCase();
  const jobCategory = (job.category || '').toLowerCase();

  // Define job category groups
  const categoryGroups = {
    tech: ['frontend', 'backend', 'full stack', 'fullstack', 'software', 'developer', 'engineer', 'devops', 'mobile', 'ios', 'android', 'react', 'node', 'python', 'java', 'web', 'data scientist', 'data analyst', 'qa', 'quality'],
    design: ['designer', 'ux', 'ui', 'graphic', 'creative', 'illustrator', 'motion'],
    finance: ['accountant', 'finance', 'financial', 'audit', 'payroll', 'tax', 'bookkeeper', 'controller'],
    hr: ['hr', 'human resource', 'recruiter', 'recruitment', 'talent acquisition', 'talent'],
    marketing: ['marketing', 'seo', 'ppc', 'social media', 'content marketing', 'growth'],
    sales: ['sales', 'account manager', 'business development', 'bd'],
    support: ['customer support', 'customer service', 'help desk', 'technical support', 'virtual assistant'],
    management: ['project manager', 'product manager', 'scrum master', 'team lead', 'operations manager', 'business analyst']
  };

  // Determine user's desired category
  let userCategory = null;
  for (const [category, keywords] of Object.entries(categoryGroups)) {
    if (keywords.some(kw => desiredPosition.includes(kw) || jobTypes.some(jt => jt.includes(kw)))) {
      userCategory = category;
      break;
    }
  }

  // Determine job's category
  let jobCategoryGroup = null;
  for (const [category, keywords] of Object.entries(categoryGroups)) {
    if (keywords.some(kw => jobTitle.includes(kw) || jobType.includes(kw) || jobCategory.includes(kw))) {
      jobCategoryGroup = category;
      break;
    }
  }

  // If we can't determine either category, allow the match (be lenient)
  if (!userCategory || !jobCategoryGroup) {
    return { score: 10, match: true, reason: '' };
  }

  // Define compatible categories (what overlaps)
  const compatibleCategories = {
    tech: ['tech', 'design', 'management'], // Tech people might also fit design or PM roles
    design: ['design', 'tech', 'marketing'], // Designers might do marketing or tech
    finance: ['finance'], // Finance is specialized
    hr: ['hr'], // HR is specialized
    marketing: ['marketing', 'design', 'sales'], // Marketing can overlap with design/sales
    sales: ['sales', 'marketing'], // Sales can overlap with marketing
    support: ['support'], // Support is specialized
    management: ['management', 'tech'] // Managers can do tech management
  };

  const compatible = compatibleCategories[userCategory] || [userCategory];

  if (compatible.includes(jobCategoryGroup)) {
    // Same or compatible category
    if (userCategory === jobCategoryGroup) {
      return { score: 20, match: true, reason: `${job.type} position matches your career path` };
    }
    return { score: 10, match: true, reason: `Related field: ${job.type}` };
  }

  // Incompatible category - HARD FILTER
  return {
    score: 0,
    match: false,
    issue: `Job category (${jobCategoryGroup}) doesn't match your desired field (${userCategory})`
  };
}

/**
 * Location matching with commute distance consideration
 */
function calculateLocationMatch(userProfile, job) {
  const jobLocation = job.location.toLowerCase();
  const currentLocation = userProfile.currentLocation?.toLowerCase();
  const preferredLocations = userProfile.preferredLocations?.map(l => l.toLowerCase()) || [];
  const remotePreference = userProfile.remotePreference;

  // Check if job is remote
  const isRemoteJob = jobLocation.includes('remote') ||
                      jobLocation.includes('hybrid') ||
                      job.isRemote === true ||
                      job.description?.toLowerCase().includes('remote');

  // If user prefers only remote and job is not remote
  if (remotePreference === 'remote' && !isRemoteJob) {
    // Check if job location is in preferred locations
    const locationInPreferred = preferredLocations.some(loc => jobLocation.includes(loc));

    if (!locationInPreferred) {
      return {
        score: 0,
        match: false,
        issue: `Job requires on-site presence in ${job.location}, but you prefer remote work`
      };
    }
  }

  // If user prefers on-site and job is remote-only
  if (remotePreference === 'onsite' && isRemoteJob && !jobLocation.includes('hybrid')) {
    // Remote-only job, but user wants on-site
    // This is less of a hard filter, reduce score but don't eliminate
    return {
      score: 10,
      match: false,
      reason: 'Remote position (you prefer on-site)'
    };
  }

  // Remote job and user accepts remote
  if (isRemoteJob && (remotePreference === 'remote' || remotePreference === 'flexible' || remotePreference === 'hybrid')) {
    return {
      score: 25,
      match: true,
      reason: `Remote position matching your ${remotePreference} preference`
    };
  }

  // Check if job location is in preferred locations
  const locationInPreferred = preferredLocations.some(loc => jobLocation.includes(loc));

  if (locationInPreferred) {
    return {
      score: 25,
      match: true,
      reason: `Location ${job.location} is in your preferred areas`
    };
  }

  // Check if job is in current location
  if (currentLocation && jobLocation.includes(currentLocation)) {
    return {
      score: 20,
      match: true,
      reason: `Job is in your current city (${userProfile.currentLocation})`
    };
  }

  // Check if willing to relocate
  if (userProfile.willingToRelocate) {
    return {
      score: 15,
      match: true,
      reason: `⚠️ Outside preferred locations, but you're open to relocation`
    };
  }

  // Location mismatch and not willing to relocate
  return {
    score: 0,
    match: false,
    issue: `Job location ${job.location} doesn't match your preferences (${preferredLocations.join(', ')})`
  };
}

/**
 * Remote work preference matching
 */
function calculateRemoteMatch(userProfile, job) {
  const remotePreference = userProfile.remotePreference;
  const jobLocation = job.location.toLowerCase();
  const jobDescription = job.description?.toLowerCase() || '';

  const isRemoteJob = jobLocation.includes('remote') ||
                      jobLocation.includes('hybrid') ||
                      jobDescription.includes('remote') ||
                      job.isRemote === true;

  const isHybridJob = jobLocation.includes('hybrid') || jobDescription.includes('hybrid');

  if (remotePreference === 'remote' && isRemoteJob) {
    return { score: 20, match: true, reason: '🏠 Fully remote position' };
  }

  if (remotePreference === 'hybrid' && (isHybridJob || isRemoteJob)) {
    return { score: 20, match: true, reason: '🔄 Hybrid/flexible work arrangement' };
  }

  if (remotePreference === 'flexible') {
    return { score: 15, match: true, reason: '✨ Flexible with work arrangement' };
  }

  if (remotePreference === 'onsite' && !isRemoteJob) {
    return { score: 20, match: true, reason: '🏢 On-site position as preferred' };
  }

  return { score: 10, match: false };
}

/**
 * Skills matching
 */
function calculateSkillsMatch(userProfile, job) {
  const userSkills = [
    ...(userProfile.primarySkills || []),
    ...(userProfile.secondarySkills || [])
  ].map(s => s.toLowerCase());

  const jobTitle = job.title.toLowerCase();
  const jobDescription = job.description?.toLowerCase() || '';
  const jobText = `${jobTitle} ${jobDescription}`;

  const matchedSkills = userSkills.filter(skill =>
    jobText.includes(skill.toLowerCase())
  );

  const primaryMatched = (userProfile.primarySkills || []).filter(skill =>
    jobText.includes(skill.toLowerCase())
  );

  const matchPercentage = userSkills.length > 0
    ? (matchedSkills.length / userSkills.length) * 100
    : 0;

  const score = Math.min(25, (matchPercentage / 100) * 25);
  const reasons = [];

  if (primaryMatched.length > 0) {
    reasons.push(`${primaryMatched.length} of your primary skills match: ${primaryMatched.slice(0, 3).join(', ')}`);
  }

  if (matchedSkills.length > primaryMatched.length) {
    const secondaryMatched = matchedSkills.length - primaryMatched.length;
    reasons.push(`${secondaryMatched} additional skills match`);
  }

  return { score, reasons, matchedSkills };
}

/**
 * Experience level matching
 */
function calculateExperienceMatch(userProfile, job) {
  const userLevel = userProfile.experienceLevel;
  const userYears = userProfile.yearsOfExperience || 0;
  const jobLevel = job.experienceLevel;

  // Map job levels to user levels
  const levelMap = {
    'Internship': ['junior'],
    'Junior': ['junior', 'mid'],
    'Mid': ['junior', 'mid', 'senior'],
    'Senior': ['mid', 'senior', 'lead'],
    'Lead': ['senior', 'lead']
  };

  const acceptableLevels = levelMap[jobLevel] || ['mid', 'senior'];

  if (acceptableLevels.includes(userLevel)) {
    return {
      score: 15,
      match: true,
      reason: `Experience level matches (${jobLevel} position, you're ${userLevel})`
    };
  }

  // User is overqualified
  if (userLevel === 'senior' && jobLevel === 'Junior') {
    return {
      score: 5,
      match: false,
      reason: `⚠️ You may be overqualified for this ${jobLevel} position`
    };
  }

  // User is underqualified
  if (userLevel === 'junior' && jobLevel === 'Senior') {
    return {
      score: 5,
      match: false,
      reason: `⚠️ This ${jobLevel} position may require more experience`
    };
  }

  return { score: 10, match: true, reason: '' };
}

/**
 * Job type matching
 */
function calculateJobTypeMatch(userProfile, job) {
  const userJobTypes = (userProfile.jobTypes || []).map(t => t.toLowerCase());
  const jobType = job.type.toLowerCase();

  if (userJobTypes.some(t => jobType.includes(t) || t.includes(jobType))) {
    return {
      score: 10,
      match: true,
      reason: `${job.type} matches your interests`
    };
  }

  // Check if Full Stack user and job is Frontend or Backend
  if (userJobTypes.includes('full stack') &&
      (jobType.includes('frontend') || jobType.includes('backend'))) {
    return {
      score: 8,
      match: true,
      reason: `${job.type} position (you're Full Stack)`
    };
  }

  return { score: 5, match: false };
}

/**
 * Get matched jobs for user profile
 */
export function getMatchedJobs(userProfile, options = {}) {
  const {
    minScore = 40,
    maxResults = 50,
    sortBy = 'score' // 'score' or 'date'
  } = options;

  const allJobs = getAllJobs();

  // Calculate match score for each job
  const jobsWithScores = allJobs.map(job => {
    const match = calculateJobMatchScore(userProfile, job);
    return {
      ...job,
      matchScore: match.score,
      matchReasons: match.reasons,
      matchIssues: match.issues,
      suitable: match.suitable
    };
  });

  // Filter suitable jobs
  let suitableJobs = jobsWithScores.filter(job =>
    job.suitable && job.matchScore >= minScore
  );

  // Sort by score or date
  if (sortBy === 'score') {
    suitableJobs.sort((a, b) => b.matchScore - a.matchScore);
  } else {
    suitableJobs.sort((a, b) =>
      new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime()
    );
  }

  // Limit results
  suitableJobs = suitableJobs.slice(0, maxResults);

  return {
    jobs: suitableJobs,
    totalMatches: suitableJobs.length,
    totalJobs: allJobs.length,
    matchRate: Math.round((suitableJobs.length / allJobs.length) * 100)
  };
}

/**
 * Get match statistics
 */
export function getMatchStatistics(userProfile) {
  const allJobs = getAllJobs();

  const stats = {
    total: allJobs.length,
    excellent: 0,  // 80-100
    good: 0,       // 60-79
    moderate: 0,   // 40-59
    low: 0,        // 0-39
    byType: {},
    byLocation: {},
    avgScore: 0
  };

  let totalScore = 0;

  allJobs.forEach(job => {
    const match = calculateJobMatchScore(userProfile, job);
    totalScore += match.score;

    if (match.score >= 80) stats.excellent++;
    else if (match.score >= 60) stats.good++;
    else if (match.score >= 40) stats.moderate++;
    else stats.low++;

    // By type
    stats.byType[job.type] = (stats.byType[job.type] || 0) + 1;

    // By location
    const location = job.location.split(',')[0]; // Get city
    stats.byLocation[location] = (stats.byLocation[location] || 0) + 1;
  });

  stats.avgScore = Math.round(totalScore / allJobs.length);

  return stats;
}

/**
 * Generate resume text from user profile
 */
export function generateResumeFromProfile(userProfile, language = 'en') {
  const isSlovak = language === 'sk';
  let resume = '';

  // Auto-detect if user is Slovak based on location
  if (!language && userProfile.currentLocation &&
      (userProfile.currentLocation.includes('Slovakia') ||
       userProfile.currentLocation.includes('Slovensko') ||
       userProfile.currentLocation.includes('Bratislava') ||
       userProfile.currentLocation.includes('Košice'))) {
    language = 'sk';
  }

  const isSk = language === 'sk';

  // Header
  resume += `${userProfile.firstName?.toUpperCase()} ${userProfile.lastName?.toUpperCase()}\n\n`;

  // Contact Information
  resume += `${isSk ? 'KONTAKT' : 'CONTACT INFORMATION'}\n`;
  resume += `${isSk ? 'Email:' : 'Email:'} ${userProfile.email}\n`;
  resume += `${isSk ? 'Telefón:' : 'Phone:'} ${userProfile.phone}\n`;
  if (userProfile.linkedin) resume += `LinkedIn: ${userProfile.linkedin}\n`;
  if (userProfile.github) resume += `GitHub: ${userProfile.github}\n`;
  if (userProfile.portfolio) resume += `Portfolio: ${userProfile.portfolio}\n`;
  // Add Slovakia if location doesn't include country
  const locationWithCountry = userProfile.currentLocation && !userProfile.currentLocation.toLowerCase().includes('slovakia') && !userProfile.currentLocation.toLowerCase().includes('slovensko')
    ? `${userProfile.currentLocation}, Slovakia`
    : userProfile.currentLocation;
  resume += `${isSk ? 'Lokalita:' : 'Location:'} ${locationWithCountry}\n`;

  const remotePrefMap = {
    'remote': isSk ? 'Práca na diaľku' : 'Remote work',
    'hybrid': isSk ? 'Hybridná práca' : 'Hybrid work',
    'onsite': isSk ? 'Práca v kancelárii' : 'On-site work',
    'flexible': isSk ? 'Flexibilné' : 'Flexible'
  };
  resume += `${isSk ? 'Preferencia:' : 'Work Preference:'} ${remotePrefMap[userProfile.remotePreference] || userProfile.remotePreference}\n\n`;

  // Professional Summary
  resume += `${isSk ? 'PROFESIONALNY PROFIL' : 'PROFESSIONAL SUMMARY'}\n`;

  const levelMap = {
    'junior': isSk ? 'Junior' : 'Junior',
    'mid': isSk ? 'Stredný' : 'Mid-level',
    'senior': isSk ? 'Senior' : 'Senior',
    'lead': isSk ? 'Vedúci' : 'Lead'
  };

  if (isSk) {
    resume += `${levelMap[userProfile.experienceLevel] || 'Skúsený'} odborník s ${userProfile.yearsOfExperience} rokmi praxe v oblasti IT.\n`;
    if (userProfile.currentPosition) {
      resume += `Momentálne pracujem ako ${userProfile.currentPosition}.\n`;
    }
    resume += `Hľadám pozíciu: ${userProfile.desiredPosition}.\n`;
    if (userProfile.primarySkills && userProfile.primarySkills.length > 0) {
      resume += `Špecializujem sa na: ${userProfile.primarySkills.slice(0, 3).join(', ')}.\n`;
    }
  } else {
    resume += `${levelMap[userProfile.experienceLevel] || 'Experienced'} professional with ${userProfile.yearsOfExperience} years of experience in IT.\n`;
    if (userProfile.currentPosition) {
      resume += `Currently working as ${userProfile.currentPosition}.\n`;
    }
    resume += `Seeking opportunities as: ${userProfile.desiredPosition}.\n`;
    if (userProfile.primarySkills && userProfile.primarySkills.length > 0) {
      resume += `Specialized in: ${userProfile.primarySkills.slice(0, 3).join(', ')}.\n`;
    }
  }
  resume += `\n`;

  // Skills
  resume += `${isSk ? 'TECHNICKE ZRUCNOSTI' : 'TECHNICAL SKILLS'}\n`;
  if (userProfile.primarySkills && userProfile.primarySkills.length > 0) {
    resume += `${isSk ? 'Hlavne:' : 'Primary:'} ${userProfile.primarySkills.join(', ')}\n`;
  }
  if (userProfile.secondarySkills && userProfile.secondarySkills.length > 0) {
    resume += `${isSk ? 'Doplnkove:' : 'Secondary:'} ${userProfile.secondarySkills.join(', ')}\n`;
  }
  resume += `\n`;

  // Work Experience
  if (userProfile.workExperience && userProfile.workExperience.length > 0) {
    resume += `${isSk ? 'PRACOVNE SKUSENOSTI' : 'WORK EXPERIENCE'}\n`;
    userProfile.workExperience.forEach((exp, index) => {
      if (exp.company && exp.position) {
        resume += `\n`;
        resume += `${exp.position}\n`;
        resume += `${exp.company} | ${exp.startDate} - ${exp.endDate}\n`;
        if (exp.location) resume += `${exp.location}${exp.isRemote ? (isSk ? ' (Na diaľku)' : ' (Remote)') : ''}\n`;
        if (exp.description) {
          resume += `\n${exp.description}\n`;
        }
      }
    });
    resume += `\n`;
  }

  // Education
  resume += `\n${isSk ? 'VZDELANIE' : 'EDUCATION'}\n`;

  // University
  if (userProfile.university && userProfile.university.name) {
    resume += `\n${userProfile.university.degree} ${isSk ? 'v odbore' : 'in'} ${userProfile.university.field}\n`;
    resume += `${userProfile.university.name} | ${isSk ? 'Absolvent' : 'Graduated'}: ${userProfile.university.graduationYear}\n`;
  }

  // High School
  if (userProfile.highSchool && userProfile.highSchool.name) {
    resume += `\n${isSk ? 'Maturita' : 'High School Diploma'}`;
    if (userProfile.highSchool.fieldOfStudy) {
      resume += ` - ${userProfile.highSchool.fieldOfStudy}`;
    }
    resume += `\n`;
    resume += `${userProfile.highSchool.name} | ${isSk ? 'Absolvent' : 'Graduated'}: ${userProfile.highSchool.graduationYear}\n`;
  }

  // Other Education
  if (userProfile.education && userProfile.education.length > 0) {
    userProfile.education.forEach(edu => {
      if (edu.institution) {
        resume += `\n${edu.degree} ${isSk ? 'v odbore' : 'in'} ${edu.field}\n`;
        resume += `${edu.institution} | ${isSk ? 'Absolvent' : 'Graduated'}: ${edu.graduationYear}\n`;
      }
    });
  }

  // Certifications
  if (userProfile.certifications && userProfile.certifications.length > 0) {
    resume += `\n${isSk ? 'CERTIFIKATY A KURZY' : 'CERTIFICATIONS & COURSES'}\n`;
    userProfile.certifications.forEach(cert => {
      resume += `• ${cert}\n`;
    });
  }

  // Languages - Auto-add Slovak if detected + any user-specified languages
  const allLanguages = [];

  // Auto-add Slovak if location suggests it
  if (isSk && (!userProfile.languages || !userProfile.languages.some(l => l.language.toLowerCase().includes('slovak')))) {
    allLanguages.push({ language: 'Slovenčina (Slovak)', level: isSk ? 'Rodný jazyk' : 'Native' });
  }

  // Add user-specified languages
  if (userProfile.languages && userProfile.languages.length > 0) {
    allLanguages.push(...userProfile.languages);
  }

  if (allLanguages.length > 0) {
    resume += `\n${isSk ? 'JAZYKOVE ZNALOSTI' : 'LANGUAGES'}\n`;
    allLanguages.forEach(lang => {
      resume += `• ${lang.language}: ${lang.level}\n`;
    });
  }

  // Job Preferences
  resume += `\n${isSk ? 'PRACOVNE PREFERENCIE' : 'JOB PREFERENCES'}\n`;
  resume += `${isSk ? 'Hladana pozicia:' : 'Desired Position:'} ${userProfile.desiredPosition}\n`;
  if (userProfile.jobTypes && userProfile.jobTypes.length > 0) {
    resume += `${isSk ? 'Typ prace:' : 'Job Types:'} ${userProfile.jobTypes.join(', ')}\n`;
  }
  if (userProfile.employmentType && userProfile.employmentType.length > 0) {
    const translatedTypes = isSk
      ? userProfile.employmentType.map(type => {
          const typeMap = { 'full-time': 'Plný úväzok', 'part-time': 'Čiastočný úväzok', 'contract': 'Kontrakt', 'freelance': 'Freelance' };
          return typeMap[type] || type;
        })
      : userProfile.employmentType;
    resume += `${isSk ? 'Typ uvazku:' : 'Employment Type:'} ${translatedTypes.join(', ')}\n`;
  }
  if (userProfile.expectedSalary) {
    resume += `${isSk ? 'Ocakavany plat:' : 'Expected Salary:'} ${userProfile.expectedSalary.min}-${userProfile.expectedSalary.max} ${userProfile.expectedSalary.currency}/${isSk ? 'mesiac' : 'month'}\n`;
  }
  if (userProfile.availability) {
    resume += `${isSk ? 'Dostupnost:' : 'Availability:'} ${userProfile.availability}\n`;
  }
  resume += `${isSk ? 'Ochota prestahovat sa:' : 'Willing to Relocate:'} ${userProfile.willingToRelocate ? (isSk ? 'Áno' : 'Yes') : (isSk ? 'Nie' : 'No')}\n`;

  return resume;
}

/**
 * Generate a personalized resume tailored for a specific job
 * Highlights relevant skills, experience, and uses job-specific keywords
 */
export function generatePersonalizedResumeForJob(userProfile, job, language = 'en') {
  const isSk = language === 'sk';
  let resume = '';

  // Extract job requirements from job description
  const jobTitle = job.title || '';
  const jobDescription = (job.description || '').toLowerCase();
  const jobCompany = job.company || '';
  const jobType = job.type || '';

  // Find matching skills from user profile
  const allUserSkills = [
    ...(userProfile.primarySkills || []),
    ...(userProfile.secondarySkills || [])
  ];

  const matchingSkills = allUserSkills.filter(skill =>
    jobDescription.includes(skill.toLowerCase()) ||
    jobTitle.toLowerCase().includes(skill.toLowerCase())
  );

  const otherSkills = allUserSkills.filter(skill => !matchingSkills.includes(skill));

  // Prioritize matching skills first
  const orderedSkills = [...matchingSkills, ...otherSkills];

  // Extract key requirements from job description
  const keyRequirements = extractKeyRequirements(jobDescription);

  // Header with job-specific title
  resume += `${userProfile.firstName?.toUpperCase()} ${userProfile.lastName?.toUpperCase()}\n\n`;

  // Contact Information
  resume += `${isSk ? 'KONTAKT' : 'CONTACT INFORMATION'}\n`;
  resume += `${isSk ? 'Email:' : 'Email:'} ${userProfile.email}\n`;
  resume += `${isSk ? 'Telefón:' : 'Phone:'} ${userProfile.phone}\n`;
  if (userProfile.linkedin) resume += `LinkedIn: ${userProfile.linkedin}\n`;
  if (userProfile.github) resume += `GitHub: ${userProfile.github}\n`;
  if (userProfile.portfolio) resume += `Portfolio: ${userProfile.portfolio}\n`;
  // Add Slovakia if location doesn't include country
  const locationWithCountryPersonalized = userProfile.currentLocation && !userProfile.currentLocation.toLowerCase().includes('slovakia') && !userProfile.currentLocation.toLowerCase().includes('slovensko')
    ? `${userProfile.currentLocation}, Slovakia`
    : userProfile.currentLocation;
  resume += `${isSk ? 'Lokalita:' : 'Location:'} ${locationWithCountryPersonalized}\n\n`;

  // Personalized Professional Summary
  resume += `${isSk ? 'PROFESIONÁLNY PROFIL' : 'PROFESSIONAL SUMMARY'}\n`;
  resume += generatePersonalizedSummary(userProfile, job, matchingSkills, isSk);
  resume += `\n\n`;

  // Key Qualifications - matched to job requirements
  resume += `${isSk ? 'KĽÚČOVÉ KVALIFIKÁCIE' : 'KEY QUALIFICATIONS'}\n`;
  resume += generateKeyQualifications(userProfile, job, matchingSkills, keyRequirements, isSk);
  resume += `\n`;

  // Technical Skills - prioritized by job relevance
  resume += `${isSk ? 'TECHNICKÉ ZRUČNOSTI' : 'TECHNICAL SKILLS'}\n`;

  if (matchingSkills.length > 0) {
    resume += `- ${matchingSkills.join(', ')}\n`;
  }
  if (otherSkills.length > 0) {
    resume += `- ${otherSkills.join(', ')}\n`;
  }
  resume += `\n`;

  // Work Experience - with relevance highlights
  if (userProfile.workExperience && userProfile.workExperience.length > 0) {
    resume += `${isSk ? 'PRACOVNÉ SKÚSENOSTI' : 'WORK EXPERIENCE'}\n`;

    userProfile.workExperience.forEach((exp, index) => {
      if (exp.company && exp.position) {
        // Check if this experience is relevant to the job
        const expRelevance = calculateExperienceRelevance(exp, job, matchingSkills);

        resume += `\n`;
        resume += `${exp.position}\n`;
        resume += `${exp.company} | ${exp.startDate} - ${exp.endDate}\n`;
        if (exp.location) resume += `${exp.location}${exp.isRemote ? (isSk ? ' (Na diaľku)' : ' (Remote)') : ''}\n`;

        // Enhanced description with job-relevant highlights
        if (exp.description) {
          resume += `${enhanceExperienceDescription(exp.description, matchingSkills, isSk)}\n`;
        }
      }
    });
    resume += `\n`;
  }

  // Education
  resume += `\n${isSk ? 'VZDELANIE' : 'EDUCATION'}\n`;

  if (userProfile.university && userProfile.university.name) {
    resume += `\n${userProfile.university.degree} ${isSk ? 'v odbore' : 'in'} ${userProfile.university.field}\n`;
    resume += `${userProfile.university.name} | ${isSk ? 'Absolvent' : 'Graduated'}: ${userProfile.university.graduationYear}\n`;
  }

  if (userProfile.highSchool && userProfile.highSchool.name) {
    resume += `\n${isSk ? 'Maturita' : 'High School Diploma'}`;
    if (userProfile.highSchool.fieldOfStudy) {
      resume += ` - ${userProfile.highSchool.fieldOfStudy}`;
    }
    resume += `\n`;
    resume += `${userProfile.highSchool.name} | ${isSk ? 'Absolvent' : 'Graduated'}: ${userProfile.highSchool.graduationYear}\n`;
  }

  if (userProfile.education && userProfile.education.length > 0) {
    userProfile.education.forEach(edu => {
      if (edu.institution) {
        resume += `\n${edu.degree} ${isSk ? 'v odbore' : 'in'} ${edu.field}\n`;
        resume += `${edu.institution} | ${isSk ? 'Absolvent' : 'Graduated'}: ${edu.graduationYear}\n`;
      }
    });
  }

  // Certifications - prioritized by relevance
  if (userProfile.certifications && userProfile.certifications.length > 0) {
    resume += `\n${isSk ? 'CERTIFIKATY A KURZY' : 'CERTIFICATIONS & COURSES'}\n`;

    // Sort certifications by relevance to job
    const sortedCerts = sortByJobRelevance(userProfile.certifications, jobDescription);
    sortedCerts.forEach((cert, index) => {
      resume += `• ${cert}\n`;
    });
  }

  // Languages
  const allLanguages = [];
  if (isSk && (!userProfile.languages || !userProfile.languages.some(l => l.language.toLowerCase().includes('slovak')))) {
    allLanguages.push({ language: 'Slovenčina (Slovak)', level: isSk ? 'Rodný jazyk' : 'Native' });
  }
  if (userProfile.languages && userProfile.languages.length > 0) {
    allLanguages.push(...userProfile.languages);
  }

  if (allLanguages.length > 0) {
    resume += `\n${isSk ? 'JAZYKOVE ZNALOSTI' : 'LANGUAGES'}\n`;
    allLanguages.forEach(lang => {
      resume += `• ${lang.language}: ${lang.level}\n`;
    });
  }

  // Why I'm a good fit section
  resume += `\n${isSk ? 'PRECO SOM VHODNY KANDIDAT' : 'WHY I AM A GOOD FIT'}\n`;
  resume += generateWhyGoodFit(userProfile, job, matchingSkills, isSk);

  return resume;
}

/**
 * Extract key requirements from job description
 */
function extractKeyRequirements(description) {
  const requirements = [];

  // Common requirement patterns
  const patterns = [
    /(\d+)\+?\s*years?\s*(of\s*)?(experience|exp)/gi,
    /(bachelor|master|phd|degree)/gi,
    /(fluent|proficient)\s+in\s+(\w+)/gi,
    /(required|must have|essential):\s*([^.]+)/gi
  ];

  // Common tech keywords
  const techKeywords = [
    'react', 'angular', 'vue', 'node', 'python', 'java', 'javascript', 'typescript',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'sql', 'nosql', 'mongodb',
    'agile', 'scrum', 'ci/cd', 'git', 'rest', 'graphql', 'api'
  ];

  techKeywords.forEach(keyword => {
    if (description.includes(keyword)) {
      requirements.push(keyword);
    }
  });

  return requirements;
}

/**
 * Generate personalized summary based on job requirements
 */
function generatePersonalizedSummary(userProfile, job, matchingSkills, isSk) {
  const years = userProfile.yearsOfExperience || 0;
  const level = userProfile.experienceLevel || 'mid';
  const jobTitle = job.title || 'this position';

  const levelMap = {
    'junior': isSk ? 'motivovaný' : 'motivated',
    'mid': isSk ? 'skúsený' : 'experienced',
    'senior': isSk ? 'senior' : 'senior',
    'lead': isSk ? 'vedúci' : 'lead'
  };

  let summary = '';

  if (isSk) {
    summary += `${levelMap[level]?.charAt(0).toUpperCase() + levelMap[level]?.slice(1)} profesionál s ${years} rokmi skúseností, `;
    summary += `ideálne pripravený na pozíciu ${jobTitle}. `;

    if (matchingSkills.length > 0) {
      summary += `Moje kľúčové zručnosti vrátane ${matchingSkills.slice(0, 3).join(', ')} `;
      summary += `priamo zodpovedajú požiadavkám tejto pozície. `;
    }

    if (userProfile.currentPosition) {
      summary += `Aktuálne pracujem ako ${userProfile.currentPosition}, `;
      summary += `kde som získal relevantné skúsenosti pre túto rolu.`;
    }
  } else {
    summary += `${levelMap[level]?.charAt(0).toUpperCase() + levelMap[level]?.slice(1)} professional with ${years} years of experience, `;
    summary += `well-suited for the ${jobTitle} position. `;

    if (matchingSkills.length > 0) {
      summary += `My core competencies including ${matchingSkills.slice(0, 3).join(', ')} `;
      summary += `directly align with this role's requirements. `;
    }

    if (userProfile.currentPosition) {
      summary += `Currently working as ${userProfile.currentPosition}, `;
      summary += `where I have gained relevant experience for this position.`;
    }
  }

  return summary;
}

/**
 * Generate key qualifications matched to job
 */
function generateKeyQualifications(userProfile, job, matchingSkills, keyRequirements, isSk) {
  let qualifications = '';

  // Years of experience
  if (userProfile.yearsOfExperience) {
    qualifications += isSk
      ? `• ${userProfile.yearsOfExperience} rokov skusenosti v odbore\n`
      : `• ${userProfile.yearsOfExperience} years of industry experience\n`;
  }

  // Matching skills
  if (matchingSkills.length > 0) {
    qualifications += isSk
      ? `• Ovladam technologie pozadovane pre tuto poziciu: ${matchingSkills.slice(0, 5).join(', ')}\n`
      : `• Proficient in technologies required for this role: ${matchingSkills.slice(0, 5).join(', ')}\n`;
  }

  // Education if relevant
  if (userProfile.university && userProfile.university.degree) {
    qualifications += isSk
      ? `• Vzdelanie: ${userProfile.university.degree} v odbore ${userProfile.university.field}\n`
      : `• Education: ${userProfile.university.degree} in ${userProfile.university.field}\n`;
  }

  // Remote work experience if job is remote
  const isRemoteJob = (job.location || '').toLowerCase().includes('remote');
  if (isRemoteJob && userProfile.remotePreference === 'remote') {
    qualifications += isSk
      ? `• Skusenosti s pracou na dialku a self-managementom\n`
      : `• Experienced in remote work and self-management\n`;
  }

  // Current position relevance
  if (userProfile.currentPosition) {
    const currentPosLower = userProfile.currentPosition.toLowerCase();
    const jobTitleLower = (job.title || '').toLowerCase();

    if (currentPosLower.includes('developer') || currentPosLower.includes('engineer')) {
      qualifications += isSk
        ? `• Aktualne pracujem ako ${userProfile.currentPosition}\n`
        : `• Currently employed as ${userProfile.currentPosition}\n`;
    }
  }

  // Certifications count
  if (userProfile.certifications && userProfile.certifications.length > 0) {
    qualifications += isSk
      ? `• ${userProfile.certifications.length} profesionalnych certifikatov\n`
      : `• ${userProfile.certifications.length} professional certifications\n`;
  }

  return qualifications;
}

/**
 * Calculate how relevant a work experience is to the job
 */
function calculateExperienceRelevance(experience, job, matchingSkills) {
  const notes = [];
  let isRelevant = false;

  const expText = `${experience.position || ''} ${experience.description || ''}`.toLowerCase();
  const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();

  // Check for matching skills in experience
  matchingSkills.forEach(skill => {
    if (expText.includes(skill.toLowerCase())) {
      notes.push(skill);
      isRelevant = true;
    }
  });

  // Check for similar position
  const positionWords = (experience.position || '').toLowerCase().split(' ');
  const jobTitleWords = (job.title || '').toLowerCase().split(' ');

  const commonWords = positionWords.filter(word =>
    jobTitleWords.includes(word) && word.length > 3
  );

  if (commonWords.length > 0) {
    isRelevant = true;
  }

  return { isRelevant, notes };
}

/**
 * Enhance experience description by highlighting job-relevant skills
 */
function enhanceExperienceDescription(description, matchingSkills, isSk) {
  let enhanced = description;

  // Bold matching skills (using markdown-style for plain text)
  matchingSkills.forEach(skill => {
    const regex = new RegExp(`\\b(${skill})\\b`, 'gi');
    enhanced = enhanced.replace(regex, '**$1**');
  });

  return enhanced;
}

/**
 * Sort items by relevance to job description
 */
function sortByJobRelevance(items, jobDescription) {
  return items.sort((a, b) => {
    const aRelevant = jobDescription.includes(a.toLowerCase()) ? 1 : 0;
    const bRelevant = jobDescription.includes(b.toLowerCase()) ? 1 : 0;
    return bRelevant - aRelevant;
  });
}

/**
 * Generate "Why I'm a good fit" section
 */
function generateWhyGoodFit(userProfile, job, matchingSkills, isSk) {
  let text = '';
  const jobTitle = job.title || 'this position';
  const company = job.company || 'your company';

  if (isSk) {
    text += `Som presvedčený, že som ideálny kandidát na pozíciu ${jobTitle} v spoločnosti ${company}, pretože:\n\n`;

    if (matchingSkills.length > 0) {
      text += `• Mám priame skúsenosti s technológiami, ktoré táto pozícia vyžaduje (${matchingSkills.slice(0, 4).join(', ')})\n`;
    }

    if (userProfile.yearsOfExperience >= 2) {
      text += `• Mám ${userProfile.yearsOfExperience} rokov overených skúseností v odbore\n`;
    }

    if (userProfile.workExperience && userProfile.workExperience.length > 0) {
      text += `• Mám praktické skúsenosti z ${userProfile.workExperience.length} predchádzajúcich pozícií\n`;
    }

    text += `• Som motivovaný prispieť k úspechu tímu a priniesť hodnotu od prvého dňa\n`;

  } else {
    text += `I am confident that I am an excellent fit for the ${jobTitle} position at ${company} because:\n\n`;

    if (matchingSkills.length > 0) {
      text += `• I have direct experience with the technologies this role requires (${matchingSkills.slice(0, 4).join(', ')})\n`;
    }

    if (userProfile.yearsOfExperience >= 2) {
      text += `• I bring ${userProfile.yearsOfExperience} years of proven industry experience\n`;
    }

    if (userProfile.workExperience && userProfile.workExperience.length > 0) {
      text += `• I have practical experience from ${userProfile.workExperience.length} previous positions\n`;
    }

    text += `• I am motivated to contribute to the team's success and deliver value from day one\n`;
  }

  return text;
}
