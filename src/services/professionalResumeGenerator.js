/**
 * Professional Resume Generator
 * Generates a clean, professional CV format based on standard industry template
 * Format: [Name] | [Contact] | [Location] | [Email] | [LinkedIn/Portfolio]
 */

/**
 * Generate a professional CV from user profile
 * @param {Object} userProfile - User profile object
 * @param {string} language - 'en' or 'sk'
 * @returns {string} - Formatted professional CV
 */
export function generateProfessionalResume(userProfile, language = 'en') {
  let cv = '';
  const isSk = language === 'sk';

  // ========================================
  // HEADER - Name and Contact (Single Line)
  // ========================================
  const fullName = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim();
  cv += `${fullName}\n`;

  // Contact Information (single line)
  const contactParts = [];
  if (userProfile.currentLocation) contactParts.push(userProfile.currentLocation);
  if (userProfile.phone) contactParts.push(userProfile.phone);
  if (userProfile.email) contactParts.push(userProfile.email);
  if (userProfile.linkedin) contactParts.push(userProfile.linkedin);
  if (userProfile.portfolio) contactParts.push(userProfile.portfolio);
  cv += contactParts.join(' | ') + '\n\n';

  // ========================================
  // PROFESSIONAL SUMMARY
  // ========================================
  cv += `${isSk ? 'PROFESIONÁLNY SÚHRN' : 'PROFESSIONAL SUMMARY'}\n`;

  const levelMap = {
    'junior': isSk ? 'junior' : 'junior',
    'mid': isSk ? 'stredne skúsený' : 'mid-level',
    'senior': isSk ? 'senior' : 'senior',
    'lead': isSk ? 'vedúci' : 'lead'
  };

  const level = levelMap[userProfile.experienceLevel] || '';
  const years = userProfile.yearsOfExperience || 0;

  // Generate concise 3-5 line summary
  if (isSk) {
    cv += `${level.charAt(0).toUpperCase() + level.slice(1)} profesionál s ${years} ${years === 1 ? 'rokom' : 'rokmi'} skúseností`;
    if (userProfile.currentPosition) {
      cv += ` v oblasti ${userProfile.currentPosition}`;
    }
    cv += `.`;

    if (userProfile.primarySkills && userProfile.primarySkills.length > 0) {
      cv += ` Špecializujem sa na ${userProfile.primarySkills.slice(0, 3).join(', ')}`;
    }
    cv += ` a mám preukázateľné úspechy v doručovaní kvalitných riešení.`;
  } else {
    cv += `${level.charAt(0).toUpperCase() + level.slice(1)} professional with ${years} ${years === 1 ? 'year' : 'years'} of experience`;
    if (userProfile.currentPosition) {
      cv += ` in ${userProfile.currentPosition}`;
    }
    cv += `.`;

    if (userProfile.primarySkills && userProfile.primarySkills.length > 0) {
      cv += ` Specialized in ${userProfile.primarySkills.slice(0, 3).join(', ')}`;
    }
    cv += ` with proven track record of delivering quality solutions.`;
  }
  cv += '\n\n';

  // ========================================
  // KEY SKILLS (Technical/Hard Skills)
  // ========================================
  const allSkills = [];
  if (userProfile.primarySkills) allSkills.push(...userProfile.primarySkills);
  if (userProfile.secondarySkills) allSkills.push(...userProfile.secondarySkills);

  if (allSkills.length > 0) {
    cv += `${isSk ? 'KĽÚČOVÉ ZRUČNOSTI' : 'KEY SKILLS'}\n`;
    allSkills.forEach(skill => {
      cv += `• ${skill}\n`;
    });
    cv += '\n';
  }

  // ========================================
  // SOFT SKILLS
  // ========================================
  // Generate relevant soft skills based on experience level and position
  const softSkills = [];

  if (userProfile.experienceLevel === 'senior' || userProfile.experienceLevel === 'lead') {
    softSkills.push(
      isSk ? 'Vedenie tímu' : 'Team Leadership',
      isSk ? 'Mentoring' : 'Mentoring',
      isSk ? 'Strategické plánovanie' : 'Strategic Planning'
    );
  }

  // Common soft skills for all levels
  softSkills.push(
    isSk ? 'Riešenie problémov' : 'Problem Solving',
    isSk ? 'Komunikácia' : 'Communication',
    isSk ? 'Tímová spolupráca' : 'Teamwork',
    isSk ? 'Analytické myslenie' : 'Analytical Thinking',
    isSk ? 'Časový manažment' : 'Time Management'
  );

  if (userProfile.softSkills && userProfile.softSkills.length > 0) {
    // Replace with user-provided soft skills if available
    softSkills.length = 0;
    softSkills.push(...userProfile.softSkills);
  }

  if (softSkills.length > 0) {
    cv += `${isSk ? 'MÄKKÉ ZRUČNOSTI' : 'SOFT SKILLS'}\n`;
    softSkills.forEach(skill => {
      cv += `• ${skill}\n`;
    });
    cv += '\n';
  }

  // ========================================
  // PROFESSIONAL EXPERIENCE
  // ========================================
  if (userProfile.workExperience && userProfile.workExperience.length > 0) {
    cv += `${isSk ? 'PRACOVNÉ SKÚSENOSTI' : 'PROFESSIONAL EXPERIENCE'}\n`;

    userProfile.workExperience.forEach((exp, index) => {
      if (exp.company && exp.position) {
        // Company Name — Job Title
        cv += `${exp.company} — ${exp.position}\n`;

        // City, Country — Date Range
        const location = exp.location || userProfile.currentLocation || '';
        cv += `${location}`;
        if (exp.startDate || exp.endDate) {
          cv += ` — ${exp.startDate || ''} ${isSk ? 'až' : 'to'} ${exp.endDate || isSk ? 'súčasnosť' : 'Present'}`;
        }
        cv += '\n';

        // Description/Achievements (bullet points)
        if (exp.description) {
          const lines = exp.description.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            if (!line.trim().startsWith('•')) {
              cv += `• ${line.trim()}\n`;
            } else {
              cv += `${line}\n`;
            }
          });
        }

        if (index < userProfile.workExperience.length - 1) {
          cv += '\n';
        }
      }
    });
    cv += '\n';
  }

  // ========================================
  // EDUCATION
  // ========================================
  const hasEducation = (userProfile.university && userProfile.university.name) ||
                        (userProfile.highSchool && userProfile.highSchool.name) ||
                        (userProfile.education && userProfile.education.length > 0);

  if (hasEducation) {
    cv += `${isSk ? 'VZDELANIE' : 'EDUCATION'}\n`;

    // University
    if (userProfile.university && userProfile.university.name) {
      // Degree, Major
      cv += `${userProfile.university.degree || ''}`;
      if (userProfile.university.field) {
        cv += `, ${userProfile.university.field}`;
      }
      cv += `\n`;

      // University Name — City, Country — Graduation Date
      cv += `${userProfile.university.name}`;
      if (userProfile.university.location) {
        cv += ` — ${userProfile.university.location}`;
      }
      if (userProfile.university.graduationYear) {
        cv += ` — ${userProfile.university.graduationYear}`;
      }
      cv += `\n\n`;
    }

    // Other Education
    if (userProfile.education && userProfile.education.length > 0) {
      userProfile.education.forEach(edu => {
        if (edu.institution) {
          cv += `${edu.degree || ''}`;
          if (edu.field) {
            cv += `, ${edu.field}`;
          }
          cv += `\n`;
          cv += `${edu.institution}`;
          if (edu.graduationYear) {
            cv += ` — ${edu.graduationYear}`;
          }
          cv += `\n\n`;
        }
      });
    }

    // High School
    if (userProfile.highSchool && userProfile.highSchool.name) {
      cv += `${isSk ? 'Stredoškolské vzdelanie' : 'High School Diploma'}`;
      if (userProfile.highSchool.fieldOfStudy) {
        cv += `, ${userProfile.highSchool.fieldOfStudy}`;
      }
      cv += `\n`;
      cv += `${userProfile.highSchool.name}`;
      if (userProfile.highSchool.graduationYear) {
        cv += ` — ${userProfile.highSchool.graduationYear}`;
      }
      cv += `\n\n`;
    }
  }

  // ========================================
  // CERTIFICATIONS & ADDITIONAL TRAINING
  // ========================================
  if (userProfile.certifications && userProfile.certifications.length > 0) {
    cv += `${isSk ? 'CERTIFIKÁTY A ĎALŠIE VZDELÁVANIE' : 'CERTIFICATIONS & ADDITIONAL TRAINING'}\n`;
    userProfile.certifications.forEach(cert => {
      cv += `• ${cert}\n`;
    });
    cv += `\n`;
  }

  // ========================================
  // ADDITIONAL INFORMATION
  // ========================================
  const hasAdditionalInfo = (userProfile.languages && userProfile.languages.length > 0) ||
                             (userProfile.primarySkills && userProfile.primarySkills.length > 0);

  if (hasAdditionalInfo) {
    cv += `${isSk ? 'DOPLŇUJÚCE INFORMÁCIE' : 'ADDITIONAL INFORMATION'}\n`;

    // Languages
    const allLanguages = [];

    // Auto-add Slovak if detected
    if (isSk && userProfile.currentLocation) {
      const location = userProfile.currentLocation.toLowerCase();
      if (location.includes('slovakia') || location.includes('slovensko') ||
          location.includes('bratislava') || location.includes('košice')) {
        const hasSlovak = userProfile.languages?.some(l =>
          l.language.toLowerCase().includes('slovak') ||
          l.language.toLowerCase().includes('slovenč')
        );
        if (!hasSlovak) {
          allLanguages.push({ language: 'Slovenčina', level: isSk ? 'Rodný jazyk' : 'Native' });
        }
      }
    }

    if (userProfile.languages && userProfile.languages.length > 0) {
      allLanguages.push(...userProfile.languages);
    }

    if (allLanguages.length > 0) {
      const langStr = allLanguages.map(l => `${l.language} (${l.level})`).join(' • ');
      cv += `${isSk ? 'Jazyky' : 'Languages'} • ${langStr}\n`;
    }
  }

  return cv;
}
