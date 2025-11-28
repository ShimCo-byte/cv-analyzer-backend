/**
 * Profile Extractor Service
 * Konvertuje extrahované CV dáta na UserProfile objekt
 */

/**
 * Konvertuje Resume objekt na UserProfile
 * @param {Resume} resume - Spracované CV
 * @param {string} resumeText - Surový text CV
 * @returns {Object} - UserProfile objekt
 */
export function convertResumeToProfile(resume, resumeText = '') {
  const contactInfo = resume.contactInfo || {};
  const skills = resume.skills || [];
  const experience = resume.experience || [];
  const education = resume.education || [];
  const certifications = resume.certifications || [];

  // Odhadni skúsenosti v rokoch
  const yearsOfExperience = estimateYearsOfExperience(experience);

  // Urči level na základe rokov skúseností
  const experienceLevel = determineExperienceLevel(yearsOfExperience);

  // Extrahuj jazyky z textu
  const languages = extractLanguagesFromText(resumeText);

  // Rozdeľ skills na primary a secondary
  const primarySkills = skills.slice(0, Math.min(10, skills.length));
  const secondarySkills = skills.slice(10);

  // Získaj aktuálnu pozíciu a firmu
  const currentExperience = experience.length > 0 ? experience[0] : null;

  // Transformuj vzdelanie
  const transformedEducation = education.map(edu => ({
    institution: edu.institution || '',
    degree: edu.degree || '',
    field: edu.field || '',
    graduationYear: edu.endDate || ''
  }));

  // Zisti high school a university
  const highSchool = findHighSchool(transformedEducation, resumeText);
  const university = findUniversity(transformedEducation);

  // Transformuj work experience
  const workExperience = experience.map(exp => ({
    company: exp.company || '',
    position: exp.position || '',
    startDate: exp.startDate || '',
    endDate: exp.endDate || 'Present',
    location: exp.location || '',
    description: exp.description || '',
    isRemote: (exp.description || '').toLowerCase().includes('remote')
  }));

  // Detekuj lokáciu
  const currentLocation = detectLocation(contactInfo, resumeText);

  // Vytvor UserProfile
  const userProfile = {
    // Personal Info
    firstName: contactInfo.firstName || '',
    lastName: contactInfo.lastName || '',
    email: contactInfo.email || '',
    phone: contactInfo.phone || '',
    linkedin: contactInfo.linkedin || '',
    github: contactInfo.github || '',
    portfolio: contactInfo.portfolio || '',

    // Location & Work Preferences
    currentLocation: currentLocation,
    preferredLocations: [currentLocation].filter(Boolean),
    remotePreference: detectRemotePreference(resumeText),
    willingToRelocate: detectWillingToRelocate(resumeText),
    maxCommuteDistance: null,

    // Experience
    yearsOfExperience: yearsOfExperience,
    currentPosition: currentExperience?.position || '',
    desiredPosition: guessDesiredPosition(primarySkills, currentExperience),
    experienceLevel: experienceLevel,

    // Skills
    primarySkills: primarySkills,
    secondarySkills: secondarySkills,
    languages: languages,

    // Work Experience
    workExperience: workExperience,

    // Education
    highSchool: highSchool,
    university: university,
    education: transformedEducation,

    // Additional
    certifications: certifications,

    // Job Preferences
    jobTypes: guessJobTypes(primarySkills),
    employmentType: ['full-time'],
    expectedSalary: {
      min: estimateSalary(yearsOfExperience, experienceLevel).min,
      max: estimateSalary(yearsOfExperience, experienceLevel).max,
      currency: 'EUR'
    },
    availability: 'immediate'
  };

  return userProfile;
}

/**
 * Odhadne počet rokov skúseností
 */
function estimateYearsOfExperience(experience) {
  if (!experience || experience.length === 0) return 0;

  let totalMonths = 0;

  experience.forEach(exp => {
    const start = parseDate(exp.startDate);
    const end = exp.endDate?.toLowerCase().includes('present') ? new Date() : parseDate(exp.endDate);

    if (start && end) {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      totalMonths += Math.max(0, months);
    }
  });

  return Math.floor(totalMonths / 12);
}

/**
 * Parsuje dátum z rôznych formátov
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // Try parsing "YYYY-MM" format
  const match = dateStr.match(/(\d{4})-?(\d{2})?/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2] || '1') - 1);
  }

  return null;
}

/**
 * Určí experience level
 */
function determineExperienceLevel(years) {
  if (years === 0) return 'junior';
  if (years <= 2) return 'junior';
  if (years <= 5) return 'mid';
  if (years <= 8) return 'senior';
  return 'lead';
}

/**
 * Extrahuje jazyky z textu
 */
function extractLanguagesFromText(text) {
  const languages = [];
  const lowerText = text.toLowerCase();

  const languagePatterns = [
    { regex: /slovak|slovenčina|slovensky/i, name: 'Slovenčina (Slovak)', level: 'Native' },
    { regex: /\benglish\b|anglick[ýáéí]/i, name: 'English', level: 'Intermediate' },
    { regex: /\bgerman\b|nemčina|nemeck[ýáéí]/i, name: 'German', level: 'Intermediate' },
    { regex: /\bczech\b|čeština|česk[ýáéí]/i, name: 'Czech', level: 'Intermediate' },
    { regex: /\bspanish\b|španielčina|španielsky/i, name: 'Spanish', level: 'Basic' },
    { regex: /\bfrench\b|francúzština|francúzsky/i, name: 'French', level: 'Basic' }
  ];

  languagePatterns.forEach(({ regex, name, level }) => {
    if (regex.test(text)) {
      // Try to find proficiency level
      const proficiencyMatch = text.match(new RegExp(`${name}.*?(native|fluent|advanced|intermediate|basic|beginner|elementary|proficient|expert|mother tongue|rodný jazyk|plynule|pokročil[ýáéí]|začiatočník)`, 'i'));

      let detectedLevel = level;
      if (proficiencyMatch) {
        const levelStr = proficiencyMatch[1].toLowerCase();
        if (levelStr.includes('native') || levelStr.includes('mother') || levelStr.includes('rodný')) {
          detectedLevel = 'Native';
        } else if (levelStr.includes('fluent') || levelStr.includes('plynule') || levelStr.includes('expert') || levelStr.includes('proficient')) {
          detectedLevel = 'Fluent';
        } else if (levelStr.includes('advanced') || levelStr.includes('pokročil')) {
          detectedLevel = 'Advanced';
        } else if (levelStr.includes('intermediate')) {
          detectedLevel = 'Intermediate';
        } else if (levelStr.includes('basic') || levelStr.includes('beginner') || levelStr.includes('elementary') || levelStr.includes('začiatočník')) {
          detectedLevel = 'Basic';
        }
      }

      languages.push({ language: name, level: detectedLevel });
    }
  });

  // If no languages found, add English as default
  if (languages.length === 0) {
    languages.push({ language: 'English', level: 'Intermediate' });
  }

  return languages;
}

/**
 * Nájde high school vo vzdelaní
 */
function findHighSchool(education, resumeText) {
  const highSchoolKeywords = ['high school', 'stredná škola', 'gymnázium', 'gymnasium', 'maturita'];

  for (const edu of education) {
    const institutionLower = (edu.institution || '').toLowerCase();
    if (highSchoolKeywords.some(keyword => institutionLower.includes(keyword))) {
      return {
        name: edu.institution,
        graduationYear: edu.graduationYear || '',
        fieldOfStudy: edu.field || ''
      };
    }
  }

  // Skús nájsť v texte
  const hsMatch = resumeText.match(/(?:high school|stredná škola|gymnázium)[:\s]+([^\n,]+)/i);
  if (hsMatch) {
    return {
      name: hsMatch[1].trim(),
      graduationYear: '',
      fieldOfStudy: ''
    };
  }

  return null;
}

/**
 * Nájde university vo vzdelaní
 */
function findUniversity(education) {
  const universityKeywords = ['university', 'univerzita', 'college', 'institute', 'faculty', 'fakulta'];

  for (const edu of education) {
    const institutionLower = (edu.institution || '').toLowerCase();
    if (universityKeywords.some(keyword => institutionLower.includes(keyword))) {
      return {
        name: edu.institution,
        degree: edu.degree || '',
        field: edu.field || '',
        graduationYear: edu.graduationYear || ''
      };
    }
  }

  return null;
}

/**
 * Detekuje lokáciu z kontaktných informácií
 */
function detectLocation(contactInfo, text) {
  if (contactInfo.location) return contactInfo.location;

  // Slovak cities
  const cities = ['Bratislava', 'Košice', 'Prešov', 'Žilina', 'Banská Bystrica', 'Nitra', 'Trnava', 'Martin', 'Trenčín', 'Poprad'];

  for (const city of cities) {
    if (text.includes(city)) {
      return city + ', Slovakia';
    }
  }

  return 'Bratislava, Slovakia'; // Default
}

/**
 * Detekuje remote preference
 */
function detectRemotePreference(text) {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('remote only') || lowerText.includes('fully remote')) return 'remote';
  if (lowerText.includes('hybrid')) return 'hybrid';
  if (lowerText.includes('on-site') || lowerText.includes('onsite')) return 'onsite';
  return 'flexible';
}

/**
 * Detekuje ochotu presťahovať sa
 */
function detectWillingToRelocate(text) {
  const lowerText = text.toLowerCase();
  return lowerText.includes('willing to relocate') || lowerText.includes('open to relocation');
}

/**
 * Odhadne desired position
 */
function guessDesiredPosition(skills, currentExperience) {
  if (currentExperience?.position) {
    // Ak má senior/lead, ponechaj, inak upgradni
    const position = currentExperience.position;
    if (position.toLowerCase().includes('senior') || position.toLowerCase().includes('lead')) {
      return position;
    }
    return 'Senior ' + position;
  }

  // Guess based on skills
  const hasReact = skills.some(s => s.toLowerCase().includes('react'));
  const hasAngular = skills.some(s => s.toLowerCase().includes('angular'));
  const hasVue = skills.some(s => s.toLowerCase().includes('vue'));
  const hasNode = skills.some(s => s.toLowerCase().includes('node'));
  const hasPython = skills.some(s => s.toLowerCase().includes('python'));
  const hasJava = skills.some(s => s.toLowerCase().includes('java'));

  if (hasReact || hasAngular || hasVue) {
    if (hasNode) return 'Full Stack Developer';
    return 'Frontend Developer';
  }

  if (hasNode || hasPython || hasJava) {
    return 'Backend Developer';
  }

  return 'Software Developer';
}

/**
 * Odhadne job types na základe skills
 */
function guessJobTypes(skills) {
  const jobTypes = [];
  const skillsLower = skills.map(s => s.toLowerCase());

  if (skillsLower.some(s => ['react', 'angular', 'vue', 'html', 'css'].includes(s))) {
    jobTypes.push('Frontend');
  }

  if (skillsLower.some(s => ['node', 'express', 'django', 'flask', 'spring', 'laravel'].includes(s))) {
    jobTypes.push('Backend');
  }

  if (jobTypes.includes('Frontend') && jobTypes.includes('Backend')) {
    jobTypes.push('Full Stack');
  }

  if (skillsLower.some(s => ['docker', 'kubernetes', 'aws', 'azure', 'terraform', 'jenkins'].includes(s))) {
    jobTypes.push('DevOps');
  }

  if (skillsLower.some(s => ['react native', 'flutter', 'swift', 'kotlin', 'android', 'ios'].includes(s))) {
    jobTypes.push('Mobile');
  }

  if (skillsLower.some(s => ['pandas', 'numpy', 'tensorflow', 'pytorch', 'machine learning', 'data science'].includes(s))) {
    jobTypes.push('Data');
  }

  // Default if none found
  if (jobTypes.length === 0) {
    jobTypes.push('Full Stack');
  }

  return jobTypes;
}

/**
 * Odhadne očakávaný plat na základe skúseností
 */
function estimateSalary(years, level) {
  const baseSalaries = {
    junior: { min: 1500, max: 2500 },
    mid: { min: 2500, max: 4000 },
    senior: { min: 4000, max: 6000 },
    lead: { min: 5500, max: 8000 }
  };

  return baseSalaries[level] || baseSalaries.mid;
}
