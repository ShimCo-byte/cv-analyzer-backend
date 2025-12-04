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
  const requirements = {
    technologies: [],
    softSkills: [],
    yearsRequired: null,
    educationRequired: null,
    responsibilities: [],
    benefits: []
  };

  const descLower = description.toLowerCase();

  // Extract years of experience requirement
  const yearsMatch = descLower.match(/(\d+)\+?\s*(?:years?|rokov?|let)\s*(?:of\s*)?(?:experience|skúseností|zkušeností|exp)/i);
  if (yearsMatch) {
    requirements.yearsRequired = parseInt(yearsMatch[1]);
  }

  // Extract education requirement
  if (descLower.includes('bachelor') || descLower.includes('bakalár')) {
    requirements.educationRequired = 'bachelor';
  } else if (descLower.includes('master') || descLower.includes('magister') || descLower.includes('inžinier')) {
    requirements.educationRequired = 'master';
  } else if (descLower.includes('phd') || descLower.includes('doktor')) {
    requirements.educationRequired = 'phd';
  }

  // Extended tech keywords - more comprehensive
  const techKeywords = [
    // Frontend
    'react', 'react.js', 'reactjs', 'angular', 'vue', 'vue.js', 'vuejs', 'svelte', 'next.js', 'nextjs', 'nuxt',
    'javascript', 'typescript', 'html', 'css', 'sass', 'scss', 'less', 'tailwind', 'bootstrap', 'material-ui',
    'redux', 'mobx', 'zustand', 'webpack', 'vite', 'babel', 'eslint', 'prettier',
    // Backend
    'node', 'node.js', 'nodejs', 'express', 'nestjs', 'fastify', 'python', 'django', 'flask', 'fastapi',
    'java', 'spring', 'spring boot', 'kotlin', 'scala', 'ruby', 'rails', 'php', 'laravel', 'symfony',
    'golang', 'go', 'rust', 'c#', '.net', 'asp.net',
    // Database
    'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'nosql', 'redis', 'elasticsearch', 'dynamodb',
    'oracle', 'sqlite', 'mariadb', 'cassandra', 'neo4j', 'graphql', 'prisma', 'typeorm', 'sequelize',
    // DevOps & Cloud
    'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s',
    'terraform', 'ansible', 'jenkins', 'gitlab', 'github actions', 'ci/cd', 'devops',
    'linux', 'nginx', 'apache', 'serverless', 'lambda', 'microservices',
    // Mobile
    'react native', 'flutter', 'swift', 'kotlin', 'ios', 'android', 'mobile',
    // Testing
    'jest', 'mocha', 'cypress', 'selenium', 'playwright', 'testing', 'tdd', 'bdd', 'unit testing',
    // Other
    'agile', 'scrum', 'kanban', 'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
    'rest', 'restful', 'api', 'websocket', 'grpc', 'soap',
    'machine learning', 'ml', 'ai', 'data science', 'deep learning', 'tensorflow', 'pytorch',
    'figma', 'sketch', 'adobe xd', 'ui/ux', 'design system'
  ];

  // Soft skills keywords
  const softSkillKeywords = [
    { keywords: ['team', 'collaborate', 'collaboration', 'teamwork', 'tím', 'spolupráca'], skill: 'Teamwork' },
    { keywords: ['communicate', 'communication', 'komunikácia', 'prezentácia'], skill: 'Communication' },
    { keywords: ['problem solving', 'riešenie problémov', 'analytical', 'analytické'], skill: 'Problem Solving' },
    { keywords: ['leadership', 'lead', 'mentor', 'vedenie', 'líder'], skill: 'Leadership' },
    { keywords: ['deadline', 'time management', 'termín', 'časový manažment'], skill: 'Time Management' },
    { keywords: ['creative', 'innovation', 'kreativita', 'inovácia'], skill: 'Creativity' },
    { keywords: ['adaptable', 'flexible', 'adaptability', 'flexibilita'], skill: 'Adaptability' },
    { keywords: ['detail', 'attention to detail', 'dôkladnosť', 'presnosť'], skill: 'Attention to Detail' },
    { keywords: ['self-motivated', 'independent', 'samostatný', 'iniciatíva'], skill: 'Self-Motivation' },
    { keywords: ['customer', 'client', 'zákazník', 'klient'], skill: 'Customer Focus' }
  ];

  // Extract technologies
  techKeywords.forEach(keyword => {
    if (descLower.includes(keyword.toLowerCase())) {
      // Capitalize properly
      const formatted = keyword.split(' ').map(w => {
        if (w === 'js' || w === 'css' || w === 'html' || w === 'sql' || w === 'api' || w === 'ci/cd') return w.toUpperCase();
        if (w === 'aws' || w === 'gcp' || w === 'k8s' || w === 'ml' || w === 'ai' || w === 'tdd' || w === 'bdd') return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');

      if (!requirements.technologies.includes(formatted)) {
        requirements.technologies.push(formatted);
      }
    }
  });

  // Extract soft skills
  softSkillKeywords.forEach(({ keywords, skill }) => {
    if (keywords.some(kw => descLower.includes(kw))) {
      if (!requirements.softSkills.includes(skill)) {
        requirements.softSkills.push(skill);
      }
    }
  });

  // Extract key responsibilities (look for common patterns)
  const responsibilityPatterns = [
    /(?:you will|you'll|responsibilities include|your role|key responsibilities|čo budeš robiť|náplň práce)[:\s]*([^.]+)/gi,
    /(?:develop|build|create|design|implement|maintain|manage|lead|collaborate)[^.]+/gi
  ];

  // Extract benefits mentioned
  const benefitKeywords = ['remote', 'flexible', 'home office', 'bonus', 'equity', 'stock', 'vacation', 'benefits', 'vzdialene', 'flexibilný'];
  benefitKeywords.forEach(keyword => {
    if (descLower.includes(keyword)) {
      requirements.benefits.push(keyword);
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
  const company = job.company || '';
  const jobDescription = (job.description || '').toLowerCase();

  // Extract job type/focus
  const jobType = job.type || '';
  const isRemote = (job.location || '').toLowerCase().includes('remote');

  const levelMap = {
    'junior': isSk ? 'motivovaný a rýchlo sa učiaci' : 'motivated and quick-learning',
    'mid': isSk ? 'skúsený' : 'results-driven',
    'senior': isSk ? 'senior' : 'seasoned',
    'lead': isSk ? 'skúsený vedúci' : 'accomplished lead'
  };

  let summary = '';

  if (isSk) {
    // Opening statement with job title mention
    summary += `${levelMap[level]?.charAt(0).toUpperCase() + levelMap[level]?.slice(1)} ${jobType || 'softvérový'} profesionál `;
    summary += `s ${years}+ rokmi hands-on skúseností, `;
    summary += `nadšený z príležitosti prispieť k tímu ${company ? `v ${company}` : ''} ako ${jobTitle}. `;

    // Skill alignment
    if (matchingSkills.length > 0) {
      summary += `\n\nMoje expertízy v ${matchingSkills.slice(0, 4).join(', ')} `;
      summary += `sa presne zhodujú s technickými požiadavkami tejto pozície. `;
    }

    // Specific achievements/experience
    if (userProfile.workExperience && userProfile.workExperience.length > 0) {
      const recentExp = userProfile.workExperience[0];
      if (recentExp.company) {
        summary += `Moje nedávne skúsenosti v ${recentExp.company} mi poskytli silný základ `;
        summary += `pre okamžitý prínos v tejto role. `;
      }
    }

    // Remote work mention if applicable
    if (isRemote && userProfile.remotePreference === 'remote') {
      summary += `Mám overené skúsenosti s efektívnou prácou na diaľku. `;
    }

    // Value proposition
    summary += `\n\nSom pripravený priniesť svoj technický talent, proaktívny prístup a `;
    summary += `schopnosť dodávať kvalitné riešenia do vášho tímu.`;

  } else {
    // Opening statement with job title mention
    summary += `${levelMap[level]?.charAt(0).toUpperCase() + levelMap[level]?.slice(1)} ${jobType || 'software'} professional `;
    summary += `with ${years}+ years of hands-on experience, `;
    summary += `eager to contribute to ${company ? `the team at ${company}` : 'your team'} as ${jobTitle}. `;

    // Skill alignment - be specific about matching
    if (matchingSkills.length > 0) {
      summary += `\n\nMy expertise in ${matchingSkills.slice(0, 4).join(', ')} `;
      summary += `directly aligns with the technical requirements of this role. `;
    }

    // Specific achievements/experience
    if (userProfile.workExperience && userProfile.workExperience.length > 0) {
      const recentExp = userProfile.workExperience[0];
      if (recentExp.company) {
        summary += `My recent experience at ${recentExp.company} has provided me with a strong foundation `;
        summary += `to make an immediate impact in this position. `;
      }
    }

    // Remote work mention if applicable
    if (isRemote && userProfile.remotePreference === 'remote') {
      summary += `I have a proven track record of working effectively in remote environments. `;
    }

    // Value proposition
    summary += `\n\nI am ready to bring my technical expertise, proactive approach, and `;
    summary += `commitment to delivering high-quality solutions to your team.`;
  }

  return summary;
}

/**
 * Generate key qualifications matched to job
 */
function generateKeyQualifications(userProfile, job, matchingSkills, keyRequirements, isSk) {
  let qualifications = '';
  const jobDescription = (job.description || '').toLowerCase();
  const jobTitle = (job.title || '').toLowerCase();

  // Check if job requires specific years
  const requiredYears = keyRequirements.yearsRequired;
  const userYears = userProfile.yearsOfExperience || 0;

  // Years of experience - highlight if meeting/exceeding requirement
  if (userYears) {
    if (requiredYears && userYears >= requiredYears) {
      qualifications += isSk
        ? `• ${userYears} rokov skúseností (spĺňa požiadavku ${requiredYears}+ rokov)\n`
        : `• ${userYears} years of experience (exceeds ${requiredYears}+ years requirement)\n`;
    } else {
      qualifications += isSk
        ? `• ${userYears} rokov praktických skúseností v softvérovom vývoji\n`
        : `• ${userYears} years of hands-on software development experience\n`;
    }
  }

  // Matching skills - categorized by relevance
  if (matchingSkills.length > 0) {
    // Identify which matching skills appear most prominently in job description
    const prioritySkills = matchingSkills.filter(skill => {
      const skillLower = skill.toLowerCase();
      return jobTitle.includes(skillLower) ||
             jobDescription.split(skillLower).length > 2; // appears multiple times
    });

    const otherMatchingSkills = matchingSkills.filter(s => !prioritySkills.includes(s));

    if (prioritySkills.length > 0) {
      qualifications += isSk
        ? `• Silné odborné znalosti v ${prioritySkills.slice(0, 3).join(', ')} - hlavné technológie pre túto pozíciu\n`
        : `• Strong expertise in ${prioritySkills.slice(0, 3).join(', ')} - core technologies for this role\n`;
    }

    if (otherMatchingSkills.length > 0) {
      qualifications += isSk
        ? `• Ďalšie relevantné zručnosti: ${otherMatchingSkills.slice(0, 4).join(', ')}\n`
        : `• Additional relevant skills: ${otherMatchingSkills.slice(0, 4).join(', ')}\n`;
    }
  }

  // Education - check if matches job requirements
  if (userProfile.university && userProfile.university.degree) {
    const userDegree = (userProfile.university.degree || '').toLowerCase();
    const meetsDegree = !keyRequirements.educationRequired ||
                        (keyRequirements.educationRequired === 'bachelor' && (userDegree.includes('bachelor') || userDegree.includes('master') || userDegree.includes('phd'))) ||
                        (keyRequirements.educationRequired === 'master' && (userDegree.includes('master') || userDegree.includes('phd')));

    qualifications += isSk
      ? `• ${userProfile.university.degree} v odbore ${userProfile.university.field}${meetsDegree ? ' (spĺňa požiadavky)' : ''}\n`
      : `• ${userProfile.university.degree} in ${userProfile.university.field}${meetsDegree ? ' (meets requirements)' : ''}\n`;
  }

  // Remote work experience if job is remote
  const isRemoteJob = (job.location || '').toLowerCase().includes('remote');
  if (isRemoteJob) {
    if (userProfile.remotePreference === 'remote' || userProfile.remotePreference === 'hybrid') {
      qualifications += isSk
        ? `• Overené skúsenosti s remote/hybridnou prácou a samostatným riadením času\n`
        : `• Proven experience in remote/hybrid work environments with strong self-management\n`;
    }
  }

  // Job type specific qualifications
  if (jobTitle.includes('senior') || jobTitle.includes('lead')) {
    if (userProfile.workExperience && userProfile.workExperience.length >= 2) {
      qualifications += isSk
        ? `• Skúsenosti z ${userProfile.workExperience.length} rôznych pozícií poskytujú široký rozhľad\n`
        : `• Experience across ${userProfile.workExperience.length} different roles provides broad perspective\n`;
    }
  }

  // Soft skills that match job requirements
  if (keyRequirements.softSkills && keyRequirements.softSkills.length > 0) {
    const userSoftSkills = userProfile.softSkills || [];
    const matchingSoftSkills = keyRequirements.softSkills.filter(skill =>
      userSoftSkills.some(us => us.toLowerCase().includes(skill.toLowerCase()))
    );

    if (matchingSoftSkills.length > 0) {
      qualifications += isSk
        ? `• Silné mäkké zručnosti: ${matchingSoftSkills.slice(0, 3).join(', ')}\n`
        : `• Strong soft skills: ${matchingSoftSkills.slice(0, 3).join(', ')}\n`;
    }
  }

  // Certifications - prioritize relevant ones
  if (userProfile.certifications && userProfile.certifications.length > 0) {
    const relevantCerts = userProfile.certifications.filter(cert => {
      const certLower = cert.toLowerCase();
      return matchingSkills.some(skill => certLower.includes(skill.toLowerCase())) ||
             keyRequirements.technologies?.some(tech => certLower.includes(tech.toLowerCase()));
    });

    if (relevantCerts.length > 0) {
      qualifications += isSk
        ? `• Relevantné certifikáty: ${relevantCerts.slice(0, 2).join(', ')}\n`
        : `• Relevant certifications: ${relevantCerts.slice(0, 2).join(', ')}\n`;
    } else {
      qualifications += isSk
        ? `• ${userProfile.certifications.length} profesionálnych certifikátov\n`
        : `• ${userProfile.certifications.length} professional certifications\n`;
    }
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
 * Enhance experience description by highlighting job-relevant skills and adding impact statements
 */
function enhanceExperienceDescription(description, matchingSkills, isSk) {
  let enhanced = description;

  // Bold matching skills (using markdown-style for plain text)
  matchingSkills.forEach(skill => {
    const regex = new RegExp(`\\b(${skill})\\b`, 'gi');
    enhanced = enhanced.replace(regex, '**$1**');
  });

  // Add relevance indicator for descriptions with multiple matching skills
  const matchCount = matchingSkills.filter(skill =>
    description.toLowerCase().includes(skill.toLowerCase())
  ).length;

  if (matchCount >= 3) {
    enhanced = `[Highly relevant to this role] ${enhanced}`;
  } else if (matchCount >= 2) {
    enhanced = `[Relevant experience] ${enhanced}`;
  }

  return enhanced;
}

/**
 * Generate job-specific bullet points for work experience
 */
function generateJobSpecificBullets(experience, job, matchingSkills, isSk) {
  const bullets = [];
  const jobDescription = (job.description || '').toLowerCase();
  const expDescription = (experience.description || '').toLowerCase();

  // Check for specific achievements that align with job requirements
  const achievementPatterns = [
    { pattern: /(\d+)%?\s*(improv|increas|reduc|optimi)/i, type: 'quantified' },
    { pattern: /led\s+(?:a\s+)?team|managed\s+\d+/i, type: 'leadership' },
    { pattern: /implement|develop|built|created|designed/i, type: 'building' },
    { pattern: /migrat|upgrad|modern/i, type: 'modernization' }
  ];

  // If job mentions specific focuses, highlight matching experience
  if (jobDescription.includes('scalab') && expDescription.includes('scal')) {
    bullets.push(isSk
      ? 'Skúsenosti so škálovaním aplikácií relevantné pre požiadavky tejto pozície'
      : 'Experience scaling applications directly relevant to this role\'s requirements');
  }

  if (jobDescription.includes('agile') && (expDescription.includes('agile') || expDescription.includes('scrum') || expDescription.includes('sprint'))) {
    bullets.push(isSk
      ? 'Praktické skúsenosti s agilnými metodológiami požadovanými pre túto pozíciu'
      : 'Hands-on agile methodology experience required for this position');
  }

  // Check for technology matches
  const techMatches = matchingSkills.filter(skill =>
    expDescription.includes(skill.toLowerCase())
  );

  if (techMatches.length > 0) {
    bullets.push(isSk
      ? `Priame skúsenosti s ${techMatches.slice(0, 3).join(', ')} z tejto pozície`
      : `Direct experience with ${techMatches.slice(0, 3).join(', ')} from this role`);
  }

  return bullets;
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
  const jobDescription = (job.description || '').toLowerCase();
  const isRemote = (job.location || '').toLowerCase().includes('remote');
  const jobType = job.type || '';

  // Analyze job for specific focuses
  const focusAreas = [];
  if (jobDescription.includes('scalab') || jobDescription.includes('performan')) focusAreas.push('performance');
  if (jobDescription.includes('user experience') || jobDescription.includes('ux') || jobDescription.includes('ui')) focusAreas.push('ux');
  if (jobDescription.includes('agile') || jobDescription.includes('scrum')) focusAreas.push('agile');
  if (jobDescription.includes('startup') || jobDescription.includes('fast-paced')) focusAreas.push('startup');
  if (jobDescription.includes('mentor') || jobDescription.includes('lead') || jobDescription.includes('team')) focusAreas.push('leadership');

  if (isSk) {
    text += `Som presvedčený, že som silný kandidát na pozíciu ${jobTitle} v spoločnosti ${company}:\n\n`;

    // Technical alignment
    if (matchingSkills.length > 0) {
      const topSkills = matchingSkills.slice(0, 4).join(', ');
      text += `• Technická zhoda: Moje ${matchingSkills.length}+ rokov práce s ${topSkills} ma pripravili na okamžitý prínos v tejto role\n`;
    }

    // Experience depth
    if (userProfile.yearsOfExperience >= 2 && userProfile.workExperience && userProfile.workExperience.length > 0) {
      const recentJob = userProfile.workExperience[0];
      text += `• Overené výsledky: ${userProfile.yearsOfExperience} rokov skúseností vrátane pozície ${recentJob.position || 'developer'} v ${recentJob.company || 'poprednej spoločnosti'}\n`;
    }

    // Specific job focus alignments
    if (focusAreas.includes('performance')) {
      text += `• Zameranie na výkon: Skúsenosti s optimalizáciou a škálovateľnými riešeniami\n`;
    }
    if (focusAreas.includes('agile')) {
      text += `• Agilné metodológie: Praktické skúsenosti s agilným vývojom a iteratívnym dodávaním\n`;
    }
    if (focusAreas.includes('leadership') && (userProfile.experienceLevel === 'senior' || userProfile.experienceLevel === 'lead')) {
      text += `• Vedenie: Skúsenosti s mentorovaním juniorov a vedením technických iniciatív\n`;
    }

    // Remote work
    if (isRemote && userProfile.remotePreference === 'remote') {
      text += `• Remote práca: Overené skúsenosti s efektívnou prácou na diaľku a autonómnym riadením projektov\n`;
    }

    // Cultural fit
    text += `• Kultúrna zhoda: Som proaktívny, komunikatívny a zameraný na dodávanie hodnoty pre tím a zákazníkov\n`;

  } else {
    text += `I am confident that I am a strong candidate for the ${jobTitle} position at ${company}:\n\n`;

    // Technical alignment
    if (matchingSkills.length > 0) {
      const topSkills = matchingSkills.slice(0, 4).join(', ');
      text += `• Technical Alignment: My ${matchingSkills.length}+ years working with ${topSkills} have prepared me to make an immediate impact in this role\n`;
    }

    // Experience depth
    if (userProfile.yearsOfExperience >= 2 && userProfile.workExperience && userProfile.workExperience.length > 0) {
      const recentJob = userProfile.workExperience[0];
      text += `• Proven Track Record: ${userProfile.yearsOfExperience} years of experience including ${recentJob.position || 'developer'} role at ${recentJob.company || 'a leading company'}\n`;
    }

    // Specific job focus alignments
    if (focusAreas.includes('performance')) {
      text += `• Performance Focus: Experience with optimization and building scalable solutions\n`;
    }
    if (focusAreas.includes('agile')) {
      text += `• Agile Methodology: Hands-on experience with agile development and iterative delivery\n`;
    }
    if (focusAreas.includes('leadership') && (userProfile.experienceLevel === 'senior' || userProfile.experienceLevel === 'lead')) {
      text += `• Leadership: Experience mentoring junior developers and leading technical initiatives\n`;
    }

    // Remote work
    if (isRemote && userProfile.remotePreference === 'remote') {
      text += `• Remote Work: Proven ability to work effectively in distributed teams with autonomous project management\n`;
    }

    // Cultural fit
    text += `• Cultural Fit: I am proactive, communicative, and focused on delivering value to the team and customers\n`;
  }

  return text;
}
