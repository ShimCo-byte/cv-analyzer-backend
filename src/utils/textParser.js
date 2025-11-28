/**
 * Text Parsing Utility
 * Analyzuje a extrahuje štruktúrované dáta z textu CV
 */

/**
 * Slovník technických zručností pre detekciu
 */
const SKILL_KEYWORDS = {
  programming: [
    'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Go', 'Rust', 'Swift',
    'Kotlin', 'TypeScript', 'SQL', 'R', 'MATLAB', 'Scala', 'Perl', 'Shell', 'Bash'
  ],
  frameworks: [
    'React', 'Angular', 'Vue.js', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI',
    'Spring', 'ASP.NET', 'Laravel', 'Rails', 'Next.js', 'Nuxt.js', 'Svelte', 'Nest.js'
  ],
  databases: [
    'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Cassandra', 'Oracle', 'SQL Server',
    'SQLite', 'DynamoDB', 'Elasticsearch', 'MariaDB', 'Neo4j', 'Firebase'
  ],
  cloud: [
    'AWS', 'Azure', 'Google Cloud', 'GCP', 'Docker', 'Kubernetes', 'Terraform',
    'Jenkins', 'GitLab CI', 'GitHub Actions', 'CircleCI', 'Heroku', 'Vercel'
  ],
  tools: [
    'Git', 'SVN', 'Jira', 'Confluence', 'Slack', 'Trello', 'Figma', 'Adobe XD',
    'Postman', 'VS Code', 'IntelliJ', 'Eclipse', 'Vim', 'Linux', 'Unix'
  ],
  softSkills: [
    'leadership', 'communication', 'teamwork', 'problem solving', 'critical thinking',
    'time management', 'adaptability', 'creativity', 'collaboration', 'agile', 'scrum'
  ]
};

/**
 * Extrahuje zručnosti z textu
 * @param {string} text - Text CV
 * @returns {Array<string>} - Zoznam nájdených zručností
 */
export function extractSkills(text) {
  const foundSkills = new Set();
  const lowerText = text.toLowerCase();

  // Prehľadaj všetky kategórie
  Object.values(SKILL_KEYWORDS).forEach(category => {
    category.forEach(skill => {
      // Case-insensitive regex pre celé slová
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(text)) {
        foundSkills.add(skill);
      }
    });
  });

  return Array.from(foundSkills);
}

/**
 * Extrahuje vzdelanie z textu
 * @param {string} text - Text CV
 * @returns {Array<Object>} - Zoznam vzdelaní
 */
export function extractEducation(text) {
  const education = [];
  const educationPatterns = [
    /(?:Bachelor|Master|PhD|B\.S\.|M\.S\.|B\.A\.|M\.A\.|B\.Sc\.|M\.Sc\.).*?(?:in|of)\s+([^\n,]+)/gi,
    /(?:University|College|Institute).*?([^\n]+)/gi
  ];

  educationPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      education.push({
        institution: match[0].trim(),
        degree: extractDegreeType(match[0]),
        field: match[1]?.trim() || '',
        startDate: null,
        endDate: extractYear(match[0])
      });
    }
  });

  return education.slice(0, 5); // Limit na 5 vzdelaní
}

/**
 * Extrahuje pracovné skúsenosti
 * @param {string} text - Text CV
 * @returns {Array<Object>} - Zoznam pracovných skúseností
 */
export function extractExperience(text) {
  const experience = [];

  // Hľadáme sekciu "Experience" alebo "Work History"
  let experienceSection = text.match(/(?:experience|work history|employment|work experience)([\s\S]*?)(?:education|skills|certifications|projects|$)/i);

  // Ak nenájdeme dedikovanú sekciu, skúsime nájsť známe spoločnosti a pozície
  if (!experienceSection) {
    // Známe spoločnosti a pozície
    const jobIndicators = /(?:engineer|developer|analyst|manager|designer|consultant|intern|specialist|lead|senior|junior).*?(?:at|@)\s+([A-Z][a-z]+)/gi;
    const companyPatterns = /(?:Google|Microsoft|Amazon|Apple|Facebook|Meta|Netflix|Tesla|IBM|Oracle|SAP|Intel|Adobe|Salesforce|Uber|Airbnb|Twitter|LinkedIn|Spotify)/gi;

    if (jobIndicators.test(text) || companyPatterns.test(text)) {
      // Máme indikácie work experience v texte
      experienceSection = [null, text]; // Použijeme celý text
    } else {
      return [];
    }
  }

  const lines = experienceSection[1].split('\n').filter(line => line.trim());

  let currentJob = null;

  lines.forEach((line, index) => {
    // Vylepšený pattern pre detekciu pozície a spoločnosti
    const jobPatterns = [
      /^([A-Z][^•\-\n]+?)(?:at|@|\||,)\s*([A-Z][^\n]+)/,  // "Position at Company"
      /(Senior|Junior|Lead|Staff|Principal)?\s*(Software|Web|Backend|Frontend|Full[- ]?Stack|Data)?\s*(Engineer|Developer|Analyst|Designer|Manager).*?(?:at|@)\s+([A-Z]\w+)/i,  // "Senior Software Engineer at Google"
      /^([^(\n]+?)\s*\(?\d{4}/,  // "Company Name (2020-2023)"
    ];

    let match = null;
    let matchedPattern = -1;

    for (let i = 0; i < jobPatterns.length; i++) {
      match = line.match(jobPatterns[i]);
      if (match) {
        matchedPattern = i;
        break;
      }
    }

    if (match && matchedPattern !== -1) {
      if (currentJob) {
        experience.push(currentJob);
      }

      let position = '';
      let company = '';

      if (matchedPattern === 0) {
        position = match[1].trim();
        company = match[2].trim();
      } else if (matchedPattern === 1) {
        position = match[0].split(/at|@/i)[0].trim();
        company = match[4] || match[0].split(/at|@/i)[1]?.trim() || '';
      } else if (matchedPattern === 2) {
        company = match[1].trim();
        position = 'Employee'; // Default ak nemáme position
      }

      currentJob = {
        position: position || 'Position',
        company: company || 'Company',
        description: '',
        startDate: extractYear(line),
        endDate: extractYear(line, true),
        technologies: []
      };
    } else if (currentJob && line.trim()) {
      // Pridaj popis k aktuálnej pozícii
      currentJob.description += line.trim() + ' ';
    }
  });

  if (currentJob) {
    experience.push(currentJob);
  }

  // Fallback: Ak stále nemáme experience, ale text obsahuje work-related keywords
  if (experience.length === 0) {
    const workKeywords = /(worked|developed|built|created|managed|led|designed|implemented|deployed|maintained|improved|optimized)/i;
    const yearPattern = /\b(19|20)\d{2}\b/;

    if (workKeywords.test(text) && yearPattern.test(text)) {
      // Pravdepodobne má work experience, aj keď sme ju nevedeli parsovať
      experience.push({
        position: 'Professional Experience',
        company: 'Various',
        description: 'Work experience mentioned in CV but not in standard format',
        startDate: null,
        endDate: null,
        technologies: []
      });
    }
  }

  return experience.slice(0, 10); // Limit na 10 pozícií
}

/**
 * Extrahuje certifikácie
 * @param {string} text - Text CV
 * @returns {Array<Object>} - Zoznam certifikácií
 */
export function extractCertifications(text) {
  const certifications = [];
  const certPattern = /(?:certified|certification|certificate)[\s\S]*?([A-Z][^\n]+)/gi;

  const matches = text.matchAll(certPattern);

  for (const match of matches) {
    certifications.push({
      name: match[1].trim(),
      issuer: extractIssuer(match[0]),
      date: extractYear(match[0]),
      expiryDate: null
    });
  }

  return certifications.slice(0, 10);
}

/**
 * Extrahuje kľúčové slová z textu
 * @param {string} text - Text CV
 * @returns {Array<string>} - Zoznam kľúčových slov
 */
export function extractKeywords(text) {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);

  // Frekvencia slov
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // Top 20 najčastejších slov
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

/**
 * Extrahuje kontaktné informácie
 * @param {string} text - Text CV
 * @returns {Object} - Kontaktné informácie
 */
export function extractContactInfo(text) {
  const contactInfo = {};

  // Email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }

  // Telefón
  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0];
  }

  // LinkedIn
  const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
  if (linkedinMatch) {
    contactInfo.linkedin = linkedinMatch[0];
  }

  // GitHub
  const githubMatch = text.match(/github\.com\/[\w-]+/i);
  if (githubMatch) {
    contactInfo.github = githubMatch[0];
  }

  return contactInfo;
}

// Helper funkcie

function extractDegreeType(text) {
  const degrees = ['Bachelor', 'Master', 'PhD', 'B.S.', 'M.S.', 'B.A.', 'M.A.', 'B.Sc.', 'M.Sc.'];
  for (const degree of degrees) {
    if (text.includes(degree)) {
      return degree;
    }
  }
  return '';
}

function extractYear(text, findLast = false) {
  const years = text.match(/\b(19|20)\d{2}\b/g);
  if (!years || years.length === 0) return null;
  return findLast ? years[years.length - 1] : years[0];
}

function extractIssuer(text) {
  const issuers = ['AWS', 'Google', 'Microsoft', 'Oracle', 'Cisco', 'CompTIA', 'PMI'];
  for (const issuer of issuers) {
    if (text.includes(issuer)) {
      return issuer;
    }
  }
  return 'Unknown';
}
