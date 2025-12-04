/**
 * Job Scraper Service
 * Scrapes job offers from LinkedIn for specific country/region
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Configuration
 */
const SCRAPING_CONFIG = {
  country: 'Slovakia',
  locations: [
    // Slovakia & Central Europe
    'Slovakia',
    'Czech Republic',
    'Austria',
    'Germany',
    'Netherlands',
    'Poland',
    'Hungary',
    'Switzerland',

    // Remote - Europe
    'Europe Remote',
    'Remote Europe',
    'Remote EU',
    'EU Remote',

    // Remote - Worldwide
    'Remote Worldwide',
    'Worldwide Remote',
    'Remote Global',
    'Work from Anywhere',
    'Remote',

    // Major tech hubs (remote-friendly)
    'United States Remote',
    'United Kingdom Remote',
    'Canada Remote',
    'Australia Remote',

    // Freelance platforms locations
    'Freelance Remote',
    'Contract Remote'
  ],
  keywords: [
    // IT & Development (najväčšia časť)
    'software developer', 'web developer', 'frontend developer', 'backend developer', 'full stack developer',
    'mobile developer', 'data analyst', 'devops engineer', 'QA engineer',

    // Freelance & Remote specific
    'freelance developer', 'remote developer', 'contract developer',
    'freelance designer', 'remote designer', 'freelance writer',
    'freelance consultant', 'independent contractor',

    // Finance & Accounting
    'accountant', 'financial analyst', 'auditor', 'payroll specialist',
    'remote accountant', 'freelance bookkeeper',

    // HR & Recruitment
    'hr specialist', 'recruiter', 'talent acquisition', 'hr manager',

    // Marketing & Sales
    'marketing specialist', 'digital marketing', 'sales representative', 'account manager',
    'freelance marketer', 'remote marketing', 'content marketing freelance',
    'social media freelance', 'seo specialist remote',

    // Business & Management
    'project manager', 'business analyst', 'product manager', 'operations manager',
    'remote project manager', 'freelance consultant',

    // Customer Support
    'customer support', 'customer service representative', 'help desk',
    'remote customer support', 'virtual assistant',

    // Design & Creative
    'graphic designer', 'ux designer', 'ui designer', 'content creator',
    'freelance graphic designer', 'remote ux designer', 'freelance illustrator',
    'video editor freelance', 'motion graphics freelance',

    // Writing & Content
    'freelance writer', 'content writer remote', 'copywriter freelance',
    'technical writer remote', 'blog writer freelance'
  ],
  maxJobsPerKeyword: 10,
  maxJobsPerLocation: 5, // Limit per location to avoid too many results
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/**
 * In-memory storage for scraped jobs
 */
class JobStore {
  constructor() {
    this.jobs = new Map(); // jobId -> job object
    this.lastUpdate = null;
    this.seenUrls = new Set(); // For deduplication
    this.lastExpirationCheck = null;
  }

  addJob(job) {
    // Check for duplicate URL
    if (this.seenUrls.has(job.url)) {
      console.log(`⚠️  Skipping duplicate job: ${job.title} at ${job.company}`);
      return false;
    }

    // Check for duplicate by title + company
    const jobKey = `${job.title.toLowerCase()}_${job.company.toLowerCase()}`;
    const existingJob = Array.from(this.jobs.values()).find(j =>
      `${j.title.toLowerCase()}_${j.company.toLowerCase()}` === jobKey
    );

    if (existingJob) {
      console.log(`⚠️  Skipping duplicate job: ${job.title} at ${job.company}`);
      return false;
    }

    this.jobs.set(job.id, job);
    this.seenUrls.add(job.url);
    return true;
  }

  getAllJobs() {
    return Array.from(this.jobs.values()).sort((a, b) =>
      new Date(b.scrapedAt) - new Date(a.scrapedAt)
    );
  }

  getJobsByCategory(category) {
    return this.getAllJobs().filter(job =>
      job.category.toLowerCase().includes(category.toLowerCase())
    );
  }

  clearJobs() {
    this.jobs.clear();
    this.seenUrls.clear();
  }

  /**
   * Remove expired jobs (jobs older than 30 days or past application deadline)
   * Returns the number of removed jobs
   */
  removeExpiredJobs() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      let shouldRemove = false;

      // Check if job is older than 30 days
      const postedDate = new Date(job.postedDate);
      if (postedDate < thirtyDaysAgo) {
        shouldRemove = true;
      }

      // Check if application deadline has passed
      if (job.applicationDeadline) {
        const deadline = new Date(job.applicationDeadline);
        if (deadline < now) {
          shouldRemove = true;
        }
      }

      if (shouldRemove) {
        this.jobs.delete(jobId);
        if (job.url) {
          this.seenUrls.delete(job.url);
        }
        removedCount++;
      }
    }

    this.lastExpirationCheck = now.toISOString();
    return removedCount;
  }

  getStats() {
    const jobs = this.getAllJobs();
    return {
      totalJobs: jobs.length,
      lastUpdate: this.lastUpdate,
      lastExpirationCheck: this.lastExpirationCheck,
      categories: [...new Set(jobs.map(j => j.category))],
      companies: [...new Set(jobs.map(j => j.company))].length
    };
  }
}

export const jobStore = new JobStore();

/**
 * LinkedIn Job Scraper
 * Note: LinkedIn has anti-scraping measures. This is a simplified implementation.
 * For production, consider using LinkedIn API or authorized job boards.
 */
class LinkedInJobScraper {
  constructor() {
    this.baseUrl = 'https://www.linkedin.com/jobs/search';
  }

  /**
   * Build LinkedIn job search URL
   */
  buildSearchUrl(keyword, location) {
    const params = new URLSearchParams({
      keywords: keyword,
      location: location,
      position: '1',
      pageNum: '0'
    });
    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Scrape jobs for a specific keyword
   * Note: This is a simplified scraper. LinkedIn requires authentication for full access.
   */
  async scrapeJobsForKeyword(keyword, location) {
    try {
      console.log(`🔍 Scraping jobs for: ${keyword} in ${location}`);

      const url = this.buildSearchUrl(keyword, location);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': SCRAPING_CONFIG.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const jobs = [];

      // LinkedIn job cards selector (may change over time)
      $('.base-card').each((index, element) => {
        if (index >= SCRAPING_CONFIG.maxJobsPerKeyword) return false;

        const $card = $(element);

        const title = $card.find('.base-search-card__title').text().trim();
        const company = $card.find('.base-search-card__subtitle').text().trim();
        const location = $card.find('.job-search-card__location').text().trim();
        const jobUrl = $card.find('a').attr('href');
        const postedDate = $card.find('time').attr('datetime');

        if (title && company) {
          jobs.push({
            id: `linkedin_${Date.now()}_${index}`,
            title,
            company,
            location: location || SCRAPING_CONFIG.location,
            url: jobUrl || url,
            source: 'LinkedIn',
            category: keyword,
            postedDate: postedDate || new Date().toISOString(),
            scrapedAt: new Date().toISOString(),
            description: `${title} position at ${company}`,
            type: this.detectJobType(title),
            experienceLevel: this.detectExperienceLevel(title)
          });
        }
      });

      console.log(`✅ Found ${jobs.length} jobs for ${keyword}`);
      return jobs;

    } catch (error) {
      console.error(`❌ Error scraping ${keyword}:`, error.message);
      return [];
    }
  }

  /**
   * Detect job type from title
   */
  detectJobType(title) {
    const lowerTitle = title.toLowerCase();

    // IT & Development
    if (lowerTitle.includes('frontend') || lowerTitle.includes('front-end')) return 'Frontend';
    if (lowerTitle.includes('backend') || lowerTitle.includes('back-end')) return 'Backend';
    if (lowerTitle.includes('full stack') || lowerTitle.includes('fullstack')) return 'Full Stack';
    if (lowerTitle.includes('mobile') || lowerTitle.includes('ios') || lowerTitle.includes('android')) return 'Mobile';
    if (lowerTitle.includes('devops')) return 'DevOps';
    if (lowerTitle.includes('data')) return 'Data';
    if (lowerTitle.includes('qa') || lowerTitle.includes('quality')) return 'QA';

    // Finance & Accounting
    if (lowerTitle.includes('account') || lowerTitle.includes('finance') || lowerTitle.includes('audit')) return 'Finance';

    // HR & Recruitment
    if (lowerTitle.includes('hr') || lowerTitle.includes('recruit') || lowerTitle.includes('talent')) return 'HR';

    // Marketing & Sales
    if (lowerTitle.includes('marketing')) return 'Marketing';
    if (lowerTitle.includes('sales')) return 'Sales';

    // Business & Management
    if (lowerTitle.includes('project manager') || lowerTitle.includes('product manager') || lowerTitle.includes('business analyst')) return 'Management';

    // Customer Support
    if (lowerTitle.includes('support') || lowerTitle.includes('customer service')) return 'Support';

    // Design & Creative
    if (lowerTitle.includes('design') || lowerTitle.includes('ux') || lowerTitle.includes('ui')) return 'Design';

    return 'General';
  }

  /**
   * Detect experience level from title
   */
  detectExperienceLevel(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('senior') || lowerTitle.includes('lead')) return 'Senior';
    if (lowerTitle.includes('junior') || lowerTitle.includes('entry')) return 'Junior';
    if (lowerTitle.includes('mid') || lowerTitle.includes('intermediate')) return 'Mid';
    if (lowerTitle.includes('intern')) return 'Internship';
    return 'Mid'; // Default
  }
}

/**
 * Mock Job Generator (Fallback when scraping fails)
 * Generates realistic-looking job postings for demo purposes
 */
export class MockJobGenerator {
  constructor() {
    // Companies with their actual locations
    this.companyLocations = {
      // Slovakia - Bratislava
      'Eset': ['Bratislava, Slovakia'],
      'Sygic': ['Bratislava, Slovakia'],
      'Innovatrics': ['Bratislava, Slovakia'],
      'Vacuumlabs': ['Bratislava, Slovakia', 'Košice, Slovakia'],
      'Slido': ['Bratislava, Slovakia'],
      'GlobalLogic Slovakia': ['Bratislava, Slovakia', 'Košice, Slovakia'],
      'Accenture Slovakia': ['Bratislava, Slovakia'],
      'IBM Slovakia': ['Bratislava, Slovakia'],
      'Dell Technologies Slovakia': ['Bratislava, Slovakia'],
      'Lenovo Slovakia': ['Bratislava, Slovakia'],
      'AT&T Slovakia': ['Bratislava, Slovakia'],
      'Swiss Re Slovakia': ['Bratislava, Slovakia'],
      'PosAm': ['Bratislava, Slovakia'],
      'Gratex International': ['Bratislava, Slovakia'],
      'Soitron': ['Bratislava, Slovakia'],
      'Tempest': ['Bratislava, Slovakia'],
      'Asseco Central Europe': ['Bratislava, Slovakia'],
      'Tatra Banka': ['Bratislava, Slovakia'],
      'VÚB Banka': ['Bratislava, Slovakia'],
      'Slovenská Sporiteľňa': ['Bratislava, Slovakia'],
      'ČSOB Slovakia': ['Bratislava, Slovakia'],
      'Deloitte Slovakia': ['Bratislava, Slovakia'],
      'PwC Slovakia': ['Bratislava, Slovakia'],
      'KPMG Slovakia': ['Bratislava, Slovakia'],
      'EY Slovakia': ['Bratislava, Slovakia'],
      'Orange Slovensko': ['Bratislava, Slovakia'],
      'Slovak Telekom': ['Bratislava, Slovakia'],
      'O2 Slovakia': ['Bratislava, Slovakia'],
      'Volkswagen Slovakia': ['Bratislava, Slovakia'],
      'Slovnaft': ['Bratislava, Slovakia'],

      // Slovakia - Košice
      'Ness KE': ['Košice, Slovakia'],
      'U.S. Steel Košice': ['Košice, Slovakia'],
      'T-Systems Slovakia': ['Košice, Slovakia'],

      // Slovakia - Other cities
      'Kia Slovakia': ['Žilina, Slovakia'],
      'Continental Slovakia': ['Zvolen, Slovakia'],

      // Czech Republic - Prague
      'Avast': ['Prague, Czech Republic'],
      'JetBrains': ['Prague, Czech Republic'],
      'Kiwi.com': ['Brno, Czech Republic'],
      'Y Soft': ['Brno, Czech Republic'],
      'Kentico': ['Brno, Czech Republic'],
      'GoodData': ['Prague, Czech Republic'],
      'Socialbakers': ['Prague, Czech Republic'],
      'Productboard': ['Prague, Czech Republic'],
      'Mews': ['Prague, Czech Republic'],
      'Pure Storage Czech': ['Prague, Czech Republic'],
      'Red Hat Czech': ['Brno, Czech Republic'],
      'Oracle Czech': ['Prague, Czech Republic'],
      'Microsoft Czech': ['Prague, Czech Republic'],
      'Rohlik Group': ['Prague, Czech Republic'],
      'Mall Group': ['Prague, Czech Republic'],
      'Seznam.cz': ['Prague, Czech Republic'],
      'Česká Spořitelna': ['Prague, Czech Republic'],
      'ČSOB': ['Prague, Czech Republic'],
      'Komerční Banka': ['Prague, Czech Republic'],

      // Austria - Vienna
      'Dynatrace': ['Linz, Austria', 'Vienna, Austria'],
      'Runtastic': ['Linz, Austria'],
      'Bitpanda': ['Vienna, Austria'],
      'GoStudent': ['Vienna, Austria'],
      'Tricentis': ['Vienna, Austria'],
      'TTTech': ['Vienna, Austria'],
      'Frequentis': ['Vienna, Austria'],
      'A1 Telekom Austria': ['Vienna, Austria'],
      'Erste Bank Austria': ['Vienna, Austria'],
      'Raiffeisen Bank International': ['Vienna, Austria'],
      'Bank Austria': ['Vienna, Austria'],
      'OMV': ['Vienna, Austria'],
      'Voestalpine': ['Linz, Austria'],
      'Red Bull': ['Salzburg, Austria'],

      // Germany
      'SAP': ['Walldorf, Germany', 'Berlin, Germany', 'Munich, Germany'],
      'Siemens': ['Munich, Germany', 'Berlin, Germany'],
      'Bosch': ['Stuttgart, Germany', 'Munich, Germany'],
      'Zalando': ['Berlin, Germany'],
      'Delivery Hero': ['Berlin, Germany'],
      'N26': ['Berlin, Germany'],
      'Trade Republic': ['Berlin, Germany'],
      'Personio': ['Munich, Germany'],
      'Celonis': ['Munich, Germany'],
      'FlixBus': ['Munich, Germany'],
      'HelloFresh': ['Berlin, Germany'],
      'TeamViewer': ['Stuttgart, Germany'],

      // Hungary
      'Prezi': ['Budapest, Hungary'],
      'LogMeIn': ['Budapest, Hungary'],
      'NNG': ['Budapest, Hungary'],
      'Ericsson Hungary': ['Budapest, Hungary'],
      'Morgan Stanley Budapest': ['Budapest, Hungary'],
      'EPAM Hungary': ['Budapest, Hungary'],

      // Poland
      'CD Projekt RED': ['Warsaw, Poland'],
      'Allegro': ['Warsaw, Poland', 'Krakow, Poland'],
      'DocPlanner': ['Warsaw, Poland'],
      'Brainly': ['Krakow, Poland'],
      'Netguru': ['Poznań, Poland'],
      'STX Next': ['Wrocław, Poland'],

      // Switzerland
      'Google Zurich': ['Zurich, Switzerland'],
      'UBS': ['Zurich, Switzerland'],
      'Credit Suisse': ['Zurich, Switzerland'],
      'Swisscom': ['Bern, Switzerland'],
      'Roche': ['Basel, Switzerland'],
      'Novartis': ['Basel, Switzerland'],

      // Netherlands
      'Booking.com': ['Amsterdam, Netherlands'],
      'Adyen': ['Amsterdam, Netherlands'],
      'TomTom': ['Amsterdam, Netherlands'],
      'Philips': ['Eindhoven, Netherlands'],
      'ASML': ['Eindhoven, Netherlands'],
      'ING Tech': ['Amsterdam, Netherlands'],

      // Remote-First Companies (these get remote locations)
      'Automattic': ['Remote (Worldwide)'],
      'GitLab': ['Remote (Worldwide)'],
      'Toptal': ['Remote (Worldwide)'],
      'Zapier': ['Remote (Worldwide)'],
      'Buffer': ['Remote (Worldwide)'],
      'Doist': ['Remote (Worldwide)'],
      'Notion': ['Remote (US/EU Timezone)'],
      'Figma': ['Remote (US/EU Timezone)'],
      'Canva': ['Remote (Worldwide)'],
      'Stripe': ['Remote (Europe)', 'Dublin, Ireland'],
      'Shopify': ['Remote (Worldwide)'],
      'Twilio': ['Remote (Europe)'],
      'HashiCorp': ['Remote (Worldwide)'],
      'Cloudflare': ['Remote (Europe)', 'London, UK'],
      'DigitalOcean': ['Remote (Worldwide)'],
      'Hotjar': ['Remote (Europe)'],
      'Deel': ['Remote (Worldwide)'],
      'Revolut': ['Remote (Europe)', 'London, UK'],
      'Wise': ['Remote (Europe)', 'London, UK', 'Tallinn, Estonia'],
      'Klarna': ['Remote (Europe)', 'Stockholm, Sweden'],

      // Freelance Platforms
      'Upwork': ['Remote (Worldwide)'],
      'Fiverr': ['Remote (Worldwide)'],
      'Toptal Freelance': ['Remote (Worldwide)'],
      'Arc.dev': ['Remote (Worldwide)'],

      // Big Tech Remote
      'Google': ['Remote (Europe)', 'Dublin, Ireland', 'Zurich, Switzerland'],
      'Microsoft': ['Remote (Europe)', 'Dublin, Ireland', 'Prague, Czech Republic'],
      'Amazon': ['Remote (Europe)', 'Luxembourg', 'Berlin, Germany'],
      'Meta': ['Remote (Europe)', 'London, UK', 'Dublin, Ireland'],
      'Apple': ['Remote (Europe)', 'Cork, Ireland', 'Munich, Germany'],
      'Salesforce': ['Remote (Europe)', 'Dublin, Ireland'],
      'Adobe': ['Remote (Europe)', 'Munich, Germany'],
      'Atlassian': ['Remote (Worldwide)', 'Amsterdam, Netherlands'],

      // Additional Tech Giants
      'Spotify': ['Remote (Europe)', 'Stockholm, Sweden'],
      'Netflix': ['Remote (Europe)', 'Amsterdam, Netherlands'],
      'Airbnb': ['Remote (Europe)', 'Dublin, Ireland'],
      'Uber': ['Remote (Europe)', 'Amsterdam, Netherlands'],
      'LinkedIn': ['Remote (Europe)', 'Dublin, Ireland'],
      'Twitter/X': ['Remote (Worldwide)'],
      'Snap Inc': ['Remote (Europe)', 'London, UK'],
      'Pinterest': ['Remote (Europe)', 'Dublin, Ireland'],
      'Slack': ['Remote (Europe)', 'Dublin, Ireland'],
      'Zoom': ['Remote (Worldwide)'],

      // Data & Cloud Companies
      'Datadog': ['Remote (Europe)', 'Paris, France'],
      'MongoDB': ['Remote (Europe)', 'Dublin, Ireland'],
      'Elastic': ['Remote (Europe)', 'Amsterdam, Netherlands'],
      'Snowflake': ['Remote (Europe)', 'London, UK'],
      'Databricks': ['Remote (Europe)', 'Amsterdam, Netherlands'],
      'Palantir': ['Remote (Europe)', 'London, UK'],

      // Crypto & Fintech
      'Coinbase': ['Remote (Europe)', 'Dublin, Ireland'],
      'Kraken': ['Remote (Europe)'],
      'Binance': ['Remote (Worldwide)'],
      'Circle': ['Remote (Europe)', 'Dublin, Ireland'],
      'Plaid': ['Remote (Europe)', 'London, UK'],
      'Square': ['Remote (Europe)', 'Dublin, Ireland'],
      'Robinhood': ['Remote (US/EU Timezone)'],
      'Lemonade': ['Remote (Europe)', 'Amsterdam, Netherlands'],

      // European Tech Unicorns
      'Wolt': ['Remote (Europe)', 'Helsinki, Finland'],
      'Bolt': ['Remote (Europe)', 'Tallinn, Estonia'],
      'Glovo': ['Remote (Europe)', 'Barcelona, Spain'],
      'TransferGo': ['Remote (Europe)', 'London, UK'],
      'Paysera': ['Remote (Europe)', 'Vilnius, Lithuania'],
      'Vinted': ['Remote (Europe)', 'Vilnius, Lithuania'],
      'Omnisend': ['Remote (Europe)', 'Vilnius, Lithuania'],
      'Nord Security': ['Remote (Europe)', 'Vilnius, Lithuania'],
      'Pipedrive': ['Remote (Europe)', 'Tallinn, Estonia'],
      'Veriff': ['Remote (Europe)', 'Tallinn, Estonia'],
      'Printful': ['Remote (Europe)', 'Riga, Latvia'],
      'Infobip': ['Remote (Europe)', 'Zagreb, Croatia'],
      'Rimac': ['Zagreb, Croatia'],
      'Photomath': ['Remote (Europe)', 'Zagreb, Croatia'],

      // NEW: Additional EU & Remote Companies
      'Contentful': ['Remote (Europe)', 'Berlin, Germany'],
      'MessageBird': ['Remote (Europe)', 'Amsterdam, Netherlands'],
      'Mollie': ['Remote (Europe)', 'Amsterdam, Netherlands'],
      'SumUp': ['Remote (Europe)', 'Berlin, Germany', 'London, UK'],
      'Taxfix': ['Remote (Europe)', 'Berlin, Germany'],
      'Gorillas': ['Berlin, Germany'],
      'Flink': ['Berlin, Germany'],
      'GetYourGuide': ['Remote (Europe)', 'Berlin, Germany'],
      'Omio': ['Remote (Europe)', 'Berlin, Germany'],
      'Auto1 Group': ['Berlin, Germany'],
      'Scalable Capital': ['Remote (Europe)', 'Munich, Germany'],
      'Mambu': ['Remote (Europe)', 'Berlin, Germany', 'Amsterdam, Netherlands'],
      'Solarisbank': ['Remote (Europe)', 'Berlin, Germany'],
      'Taxdoo': ['Remote (Europe)', 'Hamburg, Germany'],
      'Billie': ['Remote (Europe)', 'Berlin, Germany'],
      'Pleo': ['Remote (Europe)', 'Copenhagen, Denmark'],
      'Factorial': ['Remote (Europe)', 'Barcelona, Spain'],
      'Typeform': ['Remote (Europe)', 'Barcelona, Spain'],
      'Travelperk': ['Remote (Europe)', 'Barcelona, Spain'],
      'Preply': ['Remote (Worldwide)', 'Barcelona, Spain'],
      'Grammarly': ['Remote (Worldwide)'],
      'Loom': ['Remote (Worldwide)'],
      'Calendly': ['Remote (Worldwide)'],
      'Miro': ['Remote (Worldwide)', 'Amsterdam, Netherlands'],
      'ClickUp': ['Remote (Worldwide)'],
      'Monday.com': ['Remote (Worldwide)', 'Tel Aviv, Israel'],
      'Airtable': ['Remote (Worldwide)'],
      'Webflow': ['Remote (Worldwide)'],
      'Vercel': ['Remote (Worldwide)'],
      'Supabase': ['Remote (Worldwide)'],
      'PlanetScale': ['Remote (Worldwide)'],
      'Linear': ['Remote (Worldwide)'],
      'Retool': ['Remote (Worldwide)'],
      'PostHog': ['Remote (Worldwide)'],
      'Sentry': ['Remote (Worldwide)'],
      'LaunchDarkly': ['Remote (Worldwide)'],
      'CircleCI': ['Remote (Worldwide)'],
      'GitPod': ['Remote (Worldwide)'],
      'Railway': ['Remote (Worldwide)'],
      'Render': ['Remote (Worldwide)'],
      'Fly.io': ['Remote (Worldwide)'],

      // Freelance Platforms
      'Turing': ['Remote (Worldwide)'],
      'RemoteOK': ['Remote (Worldwide)'],
      'WeWorkRemotely': ['Remote (Worldwide)'],
      'FlexJobs': ['Remote (Worldwide)'],

      // Job Portals
      'Profesia.sk': ['Slovakia'],
      'Kariéra.sk': ['Slovakia'],
      'Jobs.cz': ['Czech Republic'],
      'StartupJobs': ['Czech Republic'],
      'Cocuma': ['Czech Republic']
    };

    this.companies = Object.keys(this.companyLocations);

    this.jobTitles = [
      // IT & Development (väčšina)
      'Senior Full Stack Developer',
      'Frontend Developer (React)',
      'Backend Developer (Node.js)',
      'Junior Web Developer',
      'Software Engineer',
      'DevOps Engineer',
      'Full Stack Engineer',
      'Lead Frontend Developer',
      'Mid-level Backend Developer',
      'Software Developer (Python)',
      'Mobile Developer (iOS/Android)',
      'Data Analyst',
      'QA Engineer',
      'Senior Data Scientist',

      // Freelance IT Positions
      'Freelance Web Developer',
      'Freelance React Developer',
      'Freelance Full Stack Developer',
      'Contract Software Engineer',
      'Freelance Mobile App Developer',
      'Freelance Python Developer',
      'Contract DevOps Engineer',
      'Freelance WordPress Developer',
      'Contract Frontend Developer',
      'Freelance Backend Developer',

      // Finance & Accounting
      'Accountant',
      'Senior Financial Analyst',
      'Junior Accountant',
      'Financial Controller',
      'Auditor',
      'Payroll Specialist',
      'Tax Specialist',
      'Freelance Bookkeeper',
      'Remote Financial Consultant',

      // HR & Recruitment
      'HR Specialist',
      'Recruiter',
      'Talent Acquisition Specialist',
      'HR Manager',
      'HR Business Partner',

      // Marketing & Sales
      'Marketing Specialist',
      'Digital Marketing Manager',
      'Sales Representative',
      'Account Manager',
      'Marketing Coordinator',
      'Sales Manager',
      'Content Marketing Specialist',
      'Freelance Social Media Manager',
      'Freelance SEO Specialist',
      'Freelance Content Strategist',
      'Freelance PPC Specialist',
      'Remote Growth Hacker',

      // Business & Management
      'Project Manager',
      'Business Analyst',
      'Product Manager',
      'Operations Manager',
      'Scrum Master',
      'Team Leader',
      'Freelance Project Manager',
      'Remote Business Consultant',

      // Customer Support
      'Customer Support Specialist',
      'Customer Service Representative',
      'Technical Support Engineer',
      'Help Desk Specialist',
      'Remote Virtual Assistant',
      'Freelance Customer Success Manager',

      // Design & Creative
      'Graphic Designer',
      'UX/UI Designer',
      'Senior UX Designer',
      'Content Creator',
      'Video Editor',
      'Freelance Graphic Designer',
      'Freelance UI/UX Designer',
      'Freelance Logo Designer',
      'Freelance Illustrator',
      'Freelance Motion Graphics Designer',
      'Freelance Video Editor',
      'Freelance Brand Designer',

      // Writing & Content
      'Freelance Copywriter',
      'Freelance Content Writer',
      'Freelance Technical Writer',
      'Remote Blog Writer',
      'Freelance Editor',
      'Freelance Translator'
    ];

    // Tech job titles that should be offered by tech companies
    this.techJobTitles = [
      'Senior Full Stack Developer', 'Frontend Developer (React)', 'Backend Developer (Node.js)',
      'Junior Web Developer', 'Software Engineer', 'DevOps Engineer', 'Full Stack Engineer',
      'Lead Frontend Developer', 'Mid-level Backend Developer', 'Software Developer (Python)',
      'Mobile Developer (iOS/Android)', 'Data Analyst', 'QA Engineer', 'Senior Data Scientist',
      'Freelance Web Developer', 'Freelance React Developer', 'Freelance Full Stack Developer',
      'Contract Software Engineer', 'Freelance Mobile App Developer', 'Freelance Python Developer',
      'Contract DevOps Engineer', 'Contract Frontend Developer', 'Freelance Backend Developer',
      'UX/UI Designer', 'Senior UX Designer', 'Freelance UI/UX Designer', 'Graphic Designer',
      'Product Manager', 'Scrum Master', 'Project Manager'
    ];
  }

  getLocationForCompany(company) {
    const locations = this.companyLocations[company];
    if (locations && locations.length > 0) {
      return locations[Math.floor(Math.random() * locations.length)];
    }
    // Fallback for unknown companies
    return 'Remote (Europe)';
  }

  generateMockJobs(count = 100) {
    console.log(`🎭 Generating ${count} mock jobs for demo...`);
    const jobs = [];

    for (let i = 0; i < count; i++) {
      const company = this.companies[Math.floor(Math.random() * this.companies.length)];
      // Get location based on company's actual locations
      const location = this.getLocationForCompany(company);

      // Tech companies should mostly offer tech jobs
      const isTechCompany = this.isTechCompany(company);
      const title = isTechCompany
        ? this.techJobTitles[Math.floor(Math.random() * this.techJobTitles.length)]
        : this.jobTitles[Math.floor(Math.random() * this.jobTitles.length)];

      // Random date within last 14 days
      const daysAgo = Math.floor(Math.random() * 14);
      const postedDate = new Date();
      postedDate.setDate(postedDate.getDate() - daysAgo);

      const jobType = this.detectJobType(title);
      const experienceLevel = this.detectExperienceLevel(title);

      jobs.push({
        id: `mock_${Date.now()}_${i}`,
        title,
        company,
        location,
        url: this.getDirectJobUrl(company, title, `mock_${Date.now()}_${i}`),
        source: 'Company Career Page',
        category: this.getCategoryFromTitle(title),
        postedDate: postedDate.toISOString(),
        scrapedAt: new Date().toISOString(),
        description: this.generateDescription(title, company, location),
        fullDescription: this.generateFullDescription(title, company, location, jobType, experienceLevel),
        type: jobType,
        experienceLevel,
        salary: this.generateSalary(title),
        employmentType: this.getEmploymentType(title),
        benefits: this.generateBenefits(company, location),
        requirements: this.generateRequirements(title, experienceLevel),
        responsibilities: this.generateResponsibilities(title),
        skills: this.generateSkills(title, jobType),
        companyInfo: this.generateCompanyInfo(company),
        applicationDeadline: this.generateDeadline(daysAgo),
        numberOfApplicants: Math.floor(Math.random() * 150) + 5
      });
    }

    console.log(`✅ Generated ${jobs.length} mock jobs`);
    return jobs;
  }

  // Generate direct job application URL for specific position
  getDirectJobUrl(company, title, jobId) {
    // URL templates with search parameters for direct job listings
    const jobUrlTemplates = {
      // Companies with job search functionality - SLOVAKIA
      'Eset': (t) => `https://eset.com/int/about/careers/`,
      'Sygic': (t) => `https://www.sygic.com/company/careers`,
      'Innovatrics': (t) => `https://www.linkedin.com/company/innovatrics/jobs/`,
      'Vacuumlabs': (t) => `https://vacuumlabs.com/jobs`,
      'Slido': (t) => `https://www.cisco.com/c/en/us/about/careers.html`,
      'GlobalLogic Slovakia': (t) => `https://www.globallogic.com/career/job-search/`,
      'Accenture Slovakia': (t) => `https://www.accenture.com/sk-en/careers/jobsearch?jk=${encodeURIComponent(t)}&sb=1`,
      'IBM Slovakia': (t) => `https://www.ibm.com/careers/search?field_keyword_08=${encodeURIComponent(t)}`,
      'Dell Technologies Slovakia': (t) => `https://jobs.dell.com/search-jobs?k=${encodeURIComponent(t)}`,
      'Lenovo Slovakia': (t) => `https://jobs.lenovo.com/en_US/careers/SearchJobs`,

      // Slovakia - more companies
      'Swiss Re Slovakia': (t) => `https://careers.swissre.com/search/?q=${encodeURIComponent(t)}`,
      'PosAm': (t) => `https://www.posam.sk/kariera`,
      'Gratex International': (t) => `https://www.gratex.com/kariera/`,
      'Soitron': (t) => `https://www.soitron.com/sk/kariera/`,
      'Tempest': (t) => `https://www.tempest.sk/kariera/`,
      'Asseco Central Europe': (t) => `https://www.asseco-ce.com/sk/kariera/`,
      'AT&T Slovakia': (t) => `https://www.att.jobs/search-jobs`,
      'Ness KE': (t) => `https://www.ness.com/careers/`,
      'U.S. Steel Košice': (t) => `https://www.usske.sk/en/career`,
      'T-Systems Slovakia': (t) => `https://www.t-systems.com/sk/en/careers`,
      'Kia Slovakia': (t) => `https://www.kia.com/sk/main/footer/pracovne-prilezitosti.html`,
      'Continental Slovakia': (t) => `https://www.continental.com/en/career/`,
      'Orange Slovensko': (t) => `https://www.orange.sk/e-shop/about-us/kariera`,
      'Slovak Telekom': (t) => `https://www.telekom.sk/kariera`,
      'O2 Slovakia': (t) => `https://www.o2.sk/o-o2/kariera`,
      'Volkswagen Slovakia': (t) => `https://www.volkswagen.sk/sk/svet-volkswagen/kariera.html`,
      'Slovnaft': (t) => `https://slovnaft.sk/sk/kariera/`,

      // Job Portals - Slovakia & Czech
      'Profesia.sk': (t) => `https://www.profesia.sk/praca/${encodeURIComponent(t)}/`,
      'Kariéra.sk': (t) => `https://www.kariera.sk/ponuky/?q=${encodeURIComponent(t)}`,
      'Jobs.cz': (t) => `https://www.jobs.cz/prace/?q%5B%5D=${encodeURIComponent(t)}`,
      'StartupJobs': (t) => `https://www.startupjobs.cz/nabidky?q=${encodeURIComponent(t)}`,
      'Cocuma': (t) => `https://www.cocuma.cz/jobs?q=${encodeURIComponent(t)}`,

      // Banks
      'Tatra Banka': (t) => `https://www.tatrabanka.sk/kariera`,
      'VÚB Banka': (t) => `https://www.vub.sk/ludia/kariera/`,
      'Slovenská Sporiteľňa': (t) => `https://www.slsp.sk/kariera`,
      'ČSOB Slovakia': (t) => `https://www.csob.sk/kariera`,
      'Deloitte Slovakia': (t) => `https://www2.deloitte.com/sk/sk/careers.html`,
      'PwC Slovakia': (t) => `https://www.pwc.com/sk/en/careers.html`,
      'KPMG Slovakia': (t) => `https://kpmg.com/sk/en/home/careers.html`,
      'EY Slovakia': (t) => `https://www.ey.com/en_sk/careers`,

      // Czech Republic
      'Avast': (t) => `https://www.gendigital.com/us/en/careers`,
      'JetBrains': (t) => `https://www.jetbrains.com/careers/jobs/`,
      'Kiwi.com': (t) => `https://jobs.kiwi.com/jobs/`,
      'Productboard': (t) => `https://www.productboard.com/careers/`,
      'Red Hat Czech': (t) => `https://www.redhat.com/en/jobs`,
      'Y Soft': (t) => `https://www.ysoft.com/en/careers`,
      'Kentico': (t) => `https://www.kentico.com/company/careers`,
      'GoodData': (t) => `https://www.gooddata.com/company/careers/`,
      'Socialbakers': (t) => `https://www.emplifi.io/careers`,
      'Mews': (t) => `https://www.mews.com/en/careers`,
      'Pure Storage Czech': (t) => `https://www.purestorage.com/company/careers.html`,
      'Oracle Czech': (t) => `https://www.oracle.com/careers/`,
      'Microsoft Czech': (t) => `https://careers.microsoft.com/v2/global/en/home.html`,
      'Rohlik Group': (t) => `https://kariera.rohlik.cz/`,
      'Mall Group': (t) => `https://www.mallgroup.com/en/career`,
      'Seznam.cz': (t) => `https://o.seznam.cz/kariera/`,
      'Česká Spořitelna': (t) => `https://www.csas.cz/cs/kariera`,
      'ČSOB': (t) => `https://www.csob.cz/portal/csob/kariera`,
      'Komerční Banka': (t) => `https://www.kb.cz/cs/o-bance/kariera`,

      // Austria
      'Dynatrace': (t) => `https://careers.dynatrace.com/jobs/`,
      'Bitpanda': (t) => `https://www.bitpanda.com/en/careers`,
      'GoStudent': (t) => `https://www.gostudent.org/en/careers`,
      'Runtastic': (t) => `https://www.adidas-group.com/en/careers/`,
      'Tricentis': (t) => `https://www.tricentis.com/company/careers`,
      'TTTech': (t) => `https://www.tttech.com/careers/`,
      'Frequentis': (t) => `https://www.frequentis.com/en/careers`,
      'A1 Telekom Austria': (t) => `https://www.a1.group/en/career`,
      'Erste Bank Austria': (t) => `https://www.erstegroup.com/en/career`,
      'Raiffeisen Bank International': (t) => `https://www.rbinternational.com/en/careers.html`,
      'Bank Austria': (t) => `https://www.bankaustria.at/karriere.html`,
      'OMV': (t) => `https://www.omv.com/en/careers`,
      'Voestalpine': (t) => `https://www.voestalpine.com/group/en/career/`,
      'Red Bull': (t) => `https://jobs.redbull.com/int-en`,

      // Germany
      'SAP': (t) => `https://jobs.sap.com/search/`,
      'Siemens': (t) => `https://jobs.siemens.com/careers`,
      'Bosch': (t) => `https://www.bosch.com/careers/`,
      'Zalando': (t) => `https://jobs.zalando.com/en/jobs/`,
      'Delivery Hero': (t) => `https://careers.deliveryhero.com/global/en/home`,
      'N26': (t) => `https://n26.com/en/careers`,
      'Trade Republic': (t) => `https://www.traderepublic.com/careers`,
      'Personio': (t) => `https://www.personio.com/about-personio/careers/`,
      'Celonis': (t) => `https://www.celonis.com/careers/`,
      'FlixBus': (t) => `https://www.flixbus.com/company/career`,
      'HelloFresh': (t) => `https://www.hellofreshgroup.com/en/careers/`,
      'TeamViewer': (t) => `https://www.teamviewer.com/en/careers/`,

      // Switzerland
      'Google Zurich': (t) => `https://www.google.com/about/careers/applications/jobs/results/`,
      'UBS': (t) => `https://jobs.ubs.com/`,
      'Credit Suisse': (t) => `https://jobs.ubs.com/`,
      'Swisscom': (t) => `https://www.swisscom.ch/en/about/jobs-careers.html`,
      'Roche': (t) => `https://careers.roche.com/global/en/home`,
      'Novartis': (t) => `https://www.novartis.com/careers`,

      // Netherlands
      'Booking.com': (t) => `https://careers.booking.com/`,
      'Adyen': (t) => `https://careers.adyen.com/vacancies`,
      'TomTom': (t) => `https://www.tomtom.com/careers/`,
      'Philips': (t) => `https://www.careers.philips.com/`,
      'ASML': (t) => `https://www.asml.com/en/careers`,
      'ING Tech': (t) => `https://www.ing.jobs/`,

      // Hungary
      'Prezi': (t) => `https://prezi.com/jobs/`,
      'LogMeIn': (t) => `https://www.goto.com/company/careers`,
      'NNG': (t) => `https://nng.com/career/`,
      'Ericsson Hungary': (t) => `https://www.ericsson.com/en/careers`,
      'Morgan Stanley Budapest': (t) => `https://www.morganstanley.com/careers`,
      'EPAM Hungary': (t) => `https://www.epam.com/careers`,

      // Poland
      'CD Projekt RED': (t) => `https://www.cdprojektred.com/en/careers`,
      'Allegro': (t) => `https://kariera.allegro.pl/`,
      'DocPlanner': (t) => `https://www.docplanner.com/career`,
      'Brainly': (t) => `https://careers.brainly.com/`,
      'Netguru': (t) => `https://www.netguru.com/career`,
      'STX Next': (t) => `https://www.stxnext.com/careers`,

      // Remote-First Companies
      'Automattic': (t) => `https://automattic.com/work-with-us/`,
      'GitLab': (t) => `https://about.gitlab.com/jobs/all-jobs/`,
      'Toptal': (t) => `https://www.toptal.com/careers`,
      'Zapier': (t) => `https://zapier.com/jobs`,
      'Buffer': (t) => `https://buffer.com/journey`,
      'Doist': (t) => `https://doist.com/careers`,
      'Notion': (t) => `https://www.notion.so/careers`,
      'Figma': (t) => `https://www.figma.com/careers/`,
      'Canva': (t) => `https://www.lifeatcanva.com/en/jobs/`,
      'Stripe': (t) => `https://stripe.com/jobs/search`,
      'Shopify': (t) => `https://www.shopify.com/careers/search`,
      'Twilio': (t) => `https://www.twilio.com/en-us/company/jobs`,
      'HashiCorp': (t) => `https://www.hashicorp.com/careers`,
      'Cloudflare': (t) => `https://www.cloudflare.com/careers/jobs/`,
      'DigitalOcean': (t) => `https://www.digitalocean.com/careers`,
      'Hotjar': (t) => `https://careers.hotjar.com/`,
      'Deel': (t) => `https://www.deel.com/careers`,
      'Revolut': (t) => `https://www.revolut.com/careers/`,
      'Wise': (t) => `https://wise.jobs/`,
      'Klarna': (t) => `https://www.klarna.com/careers/`,

      // Big Tech
      'Google': (t) => `https://www.google.com/about/careers/applications/jobs/results/`,
      'Microsoft': (t) => `https://careers.microsoft.com/v2/global/en/home.html`,
      'Amazon': (t) => `https://www.amazon.jobs/en/`,
      'Meta': (t) => `https://www.metacareers.com/jobs`,
      'Apple': (t) => `https://jobs.apple.com/en-us/search`,
      'Salesforce': (t) => `https://careers.salesforce.com/en/jobs/`,
      'Adobe': (t) => `https://careers.adobe.com/us/en/`,
      'Atlassian': (t) => `https://www.atlassian.com/company/careers/all-jobs`,

      // Freelance Platforms - direct to gig search
      'Upwork': (t) => `https://www.upwork.com/nx/search/jobs/`,
      'Fiverr': (t) => `https://www.fiverr.com/search/gigs`,
      'Toptal Freelance': (t) => `https://www.toptal.com/freelance-jobs`,
      'Arc.dev': (t) => `https://arc.dev/remote-jobs`,
      'Turing': (t) => `https://www.turing.com/jobs`,
      'RemoteOK': (t) => `https://remoteok.com/`,
      'WeWorkRemotely': (t) => `https://weworkremotely.com/`,
      'FlexJobs': (t) => `https://www.flexjobs.com/search`,

      // Additional companies
      'Spotify': (t) => `https://www.lifeatspotify.com/jobs`,
      'Netflix': (t) => `https://jobs.netflix.com/`,
      'Airbnb': (t) => `https://careers.airbnb.com/`,
      'Uber': (t) => `https://www.uber.com/us/en/careers/`,
      'LinkedIn': (t) => `https://careers.linkedin.com/`,
      'Twitter/X': (t) => `https://twitter.com/careers`,
      'Snap Inc': (t) => `https://careers.snap.com/`,
      'Pinterest': (t) => `https://www.pinterestcareers.com/`,
      'Slack': (t) => `https://slack.com/careers`,
      'Zoom': (t) => `https://careers.zoom.us/`,
      'Datadog': (t) => `https://careers.datadoghq.com/`,
      'MongoDB': (t) => `https://www.mongodb.com/careers`,
      'Elastic': (t) => `https://www.elastic.co/careers/`,
      'Snowflake': (t) => `https://careers.snowflake.com/us/en/`,
      'Databricks': (t) => `https://www.databricks.com/company/careers`,
      'Palantir': (t) => `https://www.palantir.com/careers/`,
      'Coinbase': (t) => `https://www.coinbase.com/careers`,
      'Kraken': (t) => `https://www.kraken.com/careers`,
      'Binance': (t) => `https://www.binance.com/en/careers`,
      'Circle': (t) => `https://www.circle.com/en/careers`,
      'Plaid': (t) => `https://plaid.com/careers/`,
      'Square': (t) => `https://careers.squareup.com/us/en/`,
      'Robinhood': (t) => `https://careers.robinhood.com/`,
      'Lemonade': (t) => `https://www.lemonade.com/careers`,
      'Wolt': (t) => `https://careers.wolt.com/en/jobs`,
      'Bolt': (t) => `https://bolt.eu/en/careers/`,
      'Glovo': (t) => `https://careers.glovoapp.com/`,
      'TransferGo': (t) => `https://www.transfergo.com/careers`,
      'Paysera': (t) => `https://www.paysera.com/v2/en/career`,
      'Vinted': (t) => `https://careers.vinted.com/`,
      'Omnisend': (t) => `https://www.omnisend.com/careers/`,
      'Nord Security': (t) => `https://nordsecurity.com/careers`,
      'Pipedrive': (t) => `https://www.pipedrive.com/en/jobs`,
      'Veriff': (t) => `https://www.veriff.com/careers`,
      'Printful': (t) => `https://www.printful.com/careers`,
      'Infobip': (t) => `https://www.infobip.com/careers`,
      'Rimac': (t) => `https://www.rimac-automobili.com/careers/`,
      'Photomath': (t) => `https://photomath.com/careers`,

      // NEW: Additional EU & Remote Companies
      'Contentful': (t) => `https://www.contentful.com/careers/`,
      'MessageBird': (t) => `https://messagebird.com/careers`,
      'Mollie': (t) => `https://www.mollie.com/careers`,
      'SumUp': (t) => `https://www.sumup.com/careers/`,
      'Taxfix': (t) => `https://taxfix.de/en/careers/`,
      'Gorillas': (t) => `https://www.gorillas.io/en/careers`,
      'Flink': (t) => `https://www.goflink.com/en/careers`,
      'GetYourGuide': (t) => `https://careers.getyourguide.com/`,
      'Omio': (t) => `https://www.omio.com/careers`,
      'Auto1 Group': (t) => `https://www.auto1-group.com/careers/`,
      'Scalable Capital': (t) => `https://de.scalable.capital/careers`,
      'Mambu': (t) => `https://www.mambu.com/careers`,
      'Solarisbank': (t) => `https://www.solarisgroup.com/careers/`,
      'Taxdoo': (t) => `https://www.taxdoo.com/en/careers/`,
      'Billie': (t) => `https://www.billie.io/careers`,
      'Pleo': (t) => `https://www.pleo.io/en/careers`,
      'Factorial': (t) => `https://factorialhr.com/careers`,
      'Typeform': (t) => `https://www.typeform.com/careers/`,
      'Travelperk': (t) => `https://www.travelperk.com/careers/`,
      'Preply': (t) => `https://preply.com/en/careers`,
      'Grammarly': (t) => `https://www.grammarly.com/jobs`,
      'Loom': (t) => `https://www.loom.com/careers`,
      'Calendly': (t) => `https://calendly.com/careers`,
      'Miro': (t) => `https://miro.com/careers/`,
      'ClickUp': (t) => `https://clickup.com/careers`,
      'Monday.com': (t) => `https://monday.com/careers`,
      'Airtable': (t) => `https://www.airtable.com/careers`,
      'Webflow': (t) => `https://webflow.com/careers`,
      'Vercel': (t) => `https://vercel.com/careers`,
      'Supabase': (t) => `https://supabase.com/careers`,
      'PlanetScale': (t) => `https://planetscale.com/careers`,
      'Linear': (t) => `https://linear.app/careers`,
      'Retool': (t) => `https://retool.com/careers`,
      'PostHog': (t) => `https://posthog.com/careers`,
      'Sentry': (t) => `https://sentry.io/careers/`,
      'LaunchDarkly': (t) => `https://launchdarkly.com/careers/`,
      'CircleCI': (t) => `https://circleci.com/careers/`,
      'GitPod': (t) => `https://www.gitpod.io/careers`,
      'Railway': (t) => `https://railway.app/careers`,
      'Render': (t) => `https://render.com/careers`,
      'Fly.io': (t) => `https://fly.io/jobs/`
    };

    // Check if we have a specific URL template for this company
    const urlGenerator = jobUrlTemplates[company];
    if (urlGenerator) {
      return urlGenerator(title);
    }

    // Fallback: Use LinkedIn job search with specific company and title
    const linkedInSearchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}&company=${encodeURIComponent(company)}&f_TPR=r604800`;
    return linkedInSearchUrl;
  }

  // Legacy method for backward compatibility (not used anymore)
  getCareerUrl(company) {
    return this.getDirectJobUrl(company, '', '');
  }

  isTechCompany(company) {
    const techCompanies = [
      'Eset', 'Sygic', 'Innovatrics', 'Vacuumlabs', 'Slido', 'GlobalLogic', 'Accenture', 'IBM',
      'Dell', 'Lenovo', 'AT&T', 'PosAm', 'Gratex', 'Soitron', 'Tempest', 'Asseco', 'Ness',
      'Avast', 'JetBrains', 'Kiwi.com', 'Y Soft', 'Kentico', 'GoodData', 'Socialbakers',
      'Productboard', 'Mews', 'Pure Storage', 'Red Hat', 'Oracle', 'Microsoft', 'Google',
      'Amazon', 'Rohlik', 'Mall Group', 'Seznam', 'Dynatrace', 'Runtastic', 'Bitpanda',
      'GoStudent', 'Tricentis', 'TTTech', 'Frequentis', 'SAP', 'Siemens', 'Bosch',
      'Zalando', 'Delivery Hero', 'N26', 'Trade Republic', 'Personio', 'Celonis',
      'FlixBus', 'HelloFresh', 'TeamViewer', 'Prezi', 'LogMeIn', 'NNG', 'Ericsson',
      'Nokia', 'EPAM', 'CD Projekt', 'Allegro', 'DocPlanner', 'Brainly', 'Netguru',
      'Booking.com', 'Adyen', 'TomTom', 'Philips', 'ASML', 'Automattic', 'GitLab',
      'Toptal', 'Zapier', 'Buffer', 'Doist', 'Notion', 'Figma', 'Canva', 'Stripe',
      'Shopify', 'Twilio', 'HashiCorp', 'Cloudflare', 'DigitalOcean', 'Hotjar', 'Deel',
      'Revolut', 'Wise', 'Klarna', 'Meta', 'Apple', 'Salesforce', 'Adobe', 'Atlassian',
      'Upwork', 'Fiverr', 'Arc.dev'
    ];
    return techCompanies.some(tc => company.toLowerCase().includes(tc.toLowerCase()));
  }

  getCategoryFromTitle(title) {
    const lower = title.toLowerCase();

    // IT & Development
    if (lower.includes('frontend') || lower.includes('front-end')) return 'frontend developer';
    if (lower.includes('backend') || lower.includes('back-end')) return 'backend developer';
    if (lower.includes('full stack') || lower.includes('fullstack')) return 'full stack developer';
    if (lower.includes('mobile') || lower.includes('ios') || lower.includes('android')) return 'mobile developer';
    if (lower.includes('devops')) return 'devops engineer';
    if (lower.includes('data analyst') || lower.includes('data scientist')) return 'data analyst';
    if (lower.includes('qa') || lower.includes('quality assurance')) return 'QA engineer';
    if (lower.includes('software') || lower.includes('developer') || lower.includes('engineer')) return 'software developer';

    // Finance & Accounting
    if (lower.includes('accountant') || lower.includes('accounting')) return 'accountant';
    if (lower.includes('financial') || lower.includes('finance')) return 'financial analyst';
    if (lower.includes('audit')) return 'auditor';
    if (lower.includes('payroll')) return 'payroll specialist';

    // HR & Recruitment
    if (lower.includes('hr') || lower.includes('human resource')) return 'hr specialist';
    if (lower.includes('recruit')) return 'recruiter';
    if (lower.includes('talent acquisition')) return 'talent acquisition';

    // Marketing & Sales
    if (lower.includes('marketing')) return 'marketing specialist';
    if (lower.includes('sales') || lower.includes('account manager')) return 'sales representative';

    // Business & Management
    if (lower.includes('project manager')) return 'project manager';
    if (lower.includes('business analyst')) return 'business analyst';
    if (lower.includes('product manager')) return 'product manager';
    if (lower.includes('operations')) return 'operations manager';

    // Customer Support
    if (lower.includes('customer support') || lower.includes('customer service')) return 'customer support';
    if (lower.includes('help desk') || lower.includes('technical support')) return 'help desk';

    // Design & Creative
    if (lower.includes('designer') || lower.includes('ux') || lower.includes('ui')) return 'graphic designer';
    if (lower.includes('content')) return 'content creator';

    return 'general';
  }

  detectJobType(title) {
    const lowerTitle = title.toLowerCase();

    // IT & Development
    if (lowerTitle.includes('frontend') || lowerTitle.includes('front-end')) return 'Frontend';
    if (lowerTitle.includes('backend') || lowerTitle.includes('back-end')) return 'Backend';
    if (lowerTitle.includes('full stack') || lowerTitle.includes('fullstack')) return 'Full Stack';
    if (lowerTitle.includes('mobile') || lowerTitle.includes('ios') || lowerTitle.includes('android')) return 'Mobile';
    if (lowerTitle.includes('devops')) return 'DevOps';
    if (lowerTitle.includes('data')) return 'Data';
    if (lowerTitle.includes('qa') || lowerTitle.includes('quality')) return 'QA';

    // Finance & Accounting
    if (lowerTitle.includes('account') || lowerTitle.includes('finance') || lowerTitle.includes('audit')) return 'Finance';

    // HR & Recruitment
    if (lowerTitle.includes('hr') || lowerTitle.includes('recruit') || lowerTitle.includes('talent')) return 'HR';

    // Marketing & Sales
    if (lowerTitle.includes('marketing')) return 'Marketing';
    if (lowerTitle.includes('sales')) return 'Sales';

    // Business & Management
    if (lowerTitle.includes('project manager') || lowerTitle.includes('product manager') || lowerTitle.includes('business analyst')) return 'Management';

    // Customer Support
    if (lowerTitle.includes('support') || lowerTitle.includes('customer service')) return 'Support';

    // Design & Creative
    if (lowerTitle.includes('design') || lowerTitle.includes('ux') || lowerTitle.includes('ui')) return 'Design';

    return 'General';
  }

  detectExperienceLevel(title) {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('senior') || lowerTitle.includes('lead')) return 'Senior';
    if (lowerTitle.includes('junior')) return 'Junior';
    if (lowerTitle.includes('mid')) return 'Mid';
    return 'Mid';
  }

  generateDescription(title, company, location) {
    const isRemote = location && (location.includes('Remote') || location.includes('EU'));
    const remoteNote = isRemote ? ' Work remotely from anywhere in the EU.' : '';
    const euNote = ' EU work permit accepted.';
    return `Join ${company} as a ${title}. We're looking for talented professionals to work on exciting projects with modern technologies.${remoteNote}${euNote}`;
  }

  generateSalary(title) {
    const level = this.detectExperienceLevel(title);
    const lower = title.toLowerCase();

    // IT & Development - Higher salaries
    if (lower.includes('software') || lower.includes('developer') || lower.includes('engineer') ||
        lower.includes('devops') || lower.includes('data')) {
      if (level === 'Junior') return '1800 - 2800 EUR/month';
      if (level === 'Mid') return '2800 - 4500 EUR/month';
      if (level === 'Senior') return '4500 - 7000 EUR/month';
      return '2500 - 5000 EUR/month';
    }

    // Finance & Accounting - Medium-high salaries
    if (lower.includes('account') || lower.includes('finance') || lower.includes('audit')) {
      if (level === 'Junior') return '1400 - 2200 EUR/month';
      if (level === 'Mid') return '2200 - 3500 EUR/month';
      if (level === 'Senior') return '3500 - 5500 EUR/month';
      return '2000 - 4000 EUR/month';
    }

    // Marketing & Sales - Medium salaries + commission potential
    if (lower.includes('marketing') || lower.includes('sales')) {
      if (level === 'Junior') return '1300 - 2000 EUR/month';
      if (level === 'Mid') return '2000 - 3200 EUR/month';
      if (level === 'Senior') return '3200 - 5000 EUR/month';
      return '1800 - 3500 EUR/month';
    }

    // HR & Recruitment - Medium salaries
    if (lower.includes('hr') || lower.includes('recruit')) {
      if (level === 'Junior') return '1300 - 2000 EUR/month';
      if (level === 'Mid') return '2000 - 3200 EUR/month';
      if (level === 'Senior') return '3200 - 4800 EUR/month';
      return '1800 - 3500 EUR/month';
    }

    // Management - Higher salaries
    if (lower.includes('manager') || lower.includes('lead')) {
      if (level === 'Junior') return '2000 - 3000 EUR/month';
      if (level === 'Mid') return '3000 - 4500 EUR/month';
      if (level === 'Senior') return '4500 - 6500 EUR/month';
      return '3000 - 5500 EUR/month';
    }

    // Customer Support - Lower-medium salaries
    if (lower.includes('support') || lower.includes('customer service') || lower.includes('help desk')) {
      if (level === 'Junior') return '1100 - 1600 EUR/month';
      if (level === 'Mid') return '1600 - 2400 EUR/month';
      if (level === 'Senior') return '2400 - 3500 EUR/month';
      return '1400 - 2500 EUR/month';
    }

    // Design & Creative - Medium salaries
    if (lower.includes('design') || lower.includes('ux') || lower.includes('ui') || lower.includes('content')) {
      if (level === 'Junior') return '1400 - 2200 EUR/month';
      if (level === 'Mid') return '2200 - 3500 EUR/month';
      if (level === 'Senior') return '3500 - 5500 EUR/month';
      return '2000 - 4000 EUR/month';
    }

    // Default fallback
    if (level === 'Junior') return '1300 - 2000 EUR/month';
    if (level === 'Mid') return '2000 - 3500 EUR/month';
    if (level === 'Senior') return '3500 - 5500 EUR/month';
    return '1800 - 3500 EUR/month';
  }

  getEmploymentType(title) {
    const lower = title.toLowerCase();
    if (lower.includes('freelance') || lower.includes('contract')) return 'Freelance / Contract';
    if (lower.includes('intern')) return 'Internship';
    if (lower.includes('part-time') || lower.includes('part time')) return 'Part-time';
    return 'Full-time';
  }

  generateFullDescription(title, company, location, jobType, experienceLevel) {
    const isRemote = location && (location.toLowerCase().includes('remote') || location.toLowerCase().includes('worldwide'));
    const lower = title.toLowerCase();

    // Technical stack descriptions based on job type
    const techStacks = {
      'Frontend': {
        stack: 'React 18+, TypeScript, Next.js 14, Tailwind CSS, Redux Toolkit',
        tools: 'Jest, React Testing Library, Storybook, Webpack/Vite, Git',
        details: `You will be building responsive, performant user interfaces using React and TypeScript. Your daily work includes:

• Developing new features in our Next.js application with server-side rendering
• Writing reusable React components with proper TypeScript typing
• Implementing pixel-perfect designs from Figma mockups
• Optimizing bundle size and Core Web Vitals (LCP, FID, CLS)
• Writing unit and integration tests with Jest and React Testing Library
• Participating in code reviews and maintaining code quality standards
• Collaborating with UX designers on user experience improvements
• Working with REST APIs and GraphQL endpoints`
      },
      'Backend': {
        stack: 'Node.js 20+, Express/NestJS, PostgreSQL, Redis, Docker',
        tools: 'Jest, Swagger, Postman, Git, CI/CD pipelines',
        details: `You will be designing and implementing scalable backend services. Your daily work includes:

• Building RESTful APIs and microservices using Node.js/NestJS
• Designing database schemas and writing optimized SQL queries
• Implementing authentication/authorization (JWT, OAuth 2.0)
• Setting up caching strategies with Redis for performance
• Writing comprehensive API documentation with Swagger/OpenAPI
• Creating unit and integration tests with high code coverage
• Monitoring application performance and handling production issues
• Working with message queues (RabbitMQ/Kafka) for async processing`
      },
      'Full Stack': {
        stack: 'React, Node.js, TypeScript, PostgreSQL, Docker, AWS',
        tools: 'Git, Jest, Cypress, GitHub Actions, Terraform',
        details: `You will be working across the entire stack, from database to UI. Your daily work includes:

• Developing features end-to-end: database schema, API, and React UI
• Building responsive frontends with React, TypeScript, and Tailwind CSS
• Creating RESTful/GraphQL APIs with Node.js and Express/NestJS
• Managing PostgreSQL databases with migrations and query optimization
• Deploying applications to AWS (EC2, ECS, Lambda, S3, CloudFront)
• Setting up CI/CD pipelines with GitHub Actions
• Writing E2E tests with Cypress and unit tests with Jest
• Participating in architectural decisions and system design`
      },
      'DevOps': {
        stack: 'Kubernetes, Docker, Terraform, AWS/Azure/GCP, Linux',
        tools: 'Prometheus, Grafana, ELK Stack, Jenkins/GitLab CI, Ansible',
        details: `You will be managing infrastructure and deployment pipelines. Your daily work includes:

• Managing Kubernetes clusters and containerized applications
• Writing Infrastructure as Code with Terraform and CloudFormation
• Setting up and maintaining CI/CD pipelines (Jenkins, GitLab CI, GitHub Actions)
• Implementing monitoring and alerting with Prometheus and Grafana
• Managing cloud infrastructure on AWS/Azure/GCP
• Automating deployment processes and rollback procedures
• Troubleshooting production issues and optimizing system performance
• Implementing security best practices and compliance requirements`
      },
      'Mobile': {
        stack: 'React Native / Swift / Kotlin, TypeScript, REST APIs',
        tools: 'Xcode, Android Studio, Firebase, Fastlane, App Store Connect',
        details: `You will be building mobile applications for iOS and Android. Your daily work includes:

• Developing cross-platform mobile apps with React Native or native (Swift/Kotlin)
• Implementing responsive UI following platform-specific guidelines
• Integrating REST APIs and handling offline-first data synchronization
• Setting up push notifications with Firebase Cloud Messaging
• Optimizing app performance and reducing battery consumption
• Managing app store releases with Fastlane automation
• Writing unit and integration tests for mobile components
• Collaborating with backend team on API design and requirements`
      },
      'Data': {
        stack: 'Python, SQL, Pandas, TensorFlow/PyTorch, Spark',
        tools: 'Jupyter, Tableau/Power BI, Airflow, dbt, Snowflake',
        details: `You will be working with data to drive business insights. Your daily work includes:

• Building and maintaining ETL pipelines with Python and Airflow
• Writing complex SQL queries and optimizing data warehouse performance
• Creating dashboards and visualizations in Tableau/Power BI
• Developing machine learning models for prediction and classification
• Performing statistical analysis and A/B test evaluation
• Collaborating with stakeholders to understand data requirements
• Ensuring data quality and implementing data validation checks
• Documenting data models and maintaining data dictionaries`
      },
      'Design': {
        stack: 'Figma, Adobe Creative Suite, Sketch, Principle',
        tools: 'Miro, Notion, Hotjar, Google Analytics, UserTesting',
        details: `You will be creating user-centered designs for digital products. Your daily work includes:

• Conducting user research and usability testing sessions
• Creating wireframes, prototypes, and high-fidelity mockups in Figma
• Developing and maintaining design systems and component libraries
• Collaborating with developers to ensure design implementation accuracy
• Analyzing user behavior data to inform design decisions
• Presenting design concepts to stakeholders and gathering feedback
• Creating responsive designs for web and mobile platforms
• Ensuring accessibility compliance (WCAG 2.1 guidelines)`
      },
      'Marketing': {
        stack: 'Google Analytics 4, HubSpot, Mailchimp, SEMrush',
        tools: 'Canva, Hootsuite, Google Ads, Facebook Ads Manager, Ahrefs',
        details: `You will be driving marketing initiatives and campaigns. Your daily work includes:

• Planning and executing digital marketing campaigns across channels
• Managing paid advertising on Google Ads and social media platforms
• Analyzing campaign performance and optimizing ROI
• Creating and scheduling content for social media channels
• Writing compelling copy for ads, emails, and landing pages
• Setting up marketing automation workflows in HubSpot
• Conducting keyword research and implementing SEO strategies
• Generating reports and presenting insights to stakeholders`
      },
      'Finance': {
        stack: 'SAP, Oracle Financials, Excel (Advanced), Power BI',
        tools: 'Bloomberg Terminal, QuickBooks, Xero, Tableau',
        details: `You will be managing financial operations and analysis. Your daily work includes:

• Preparing monthly, quarterly, and annual financial reports
• Conducting variance analysis and budget vs. actual comparisons
• Managing accounts payable/receivable and cash flow forecasting
• Ensuring compliance with IFRS/GAAP accounting standards
• Supporting audit processes and maintaining documentation
• Building financial models and scenario analyses in Excel
• Reconciling accounts and investigating discrepancies
• Collaborating with business units on budgeting and planning`
      },
      'HR': {
        stack: 'Workday, BambooHR, LinkedIn Recruiter, ATS systems',
        tools: 'Slack, Zoom, Google Workspace, HRIS platforms',
        details: `You will be supporting HR operations and talent management. Your daily work includes:

• Managing full-cycle recruitment from sourcing to offer
• Conducting interviews and coordinating with hiring managers
• Onboarding new employees and managing documentation
• Administering employee benefits and compensation programs
• Handling employee relations and conflict resolution
• Maintaining HRIS data accuracy and generating reports
• Supporting performance review processes
• Ensuring compliance with labor laws and company policies`
      }
    };

    // Get relevant tech info or use general
    const techInfo = techStacks[jobType] || {
      stack: 'Industry-standard tools and technologies',
      tools: 'Microsoft Office, collaboration tools, project management software',
      details: `You will be contributing to team success through your expertise. Your daily work includes:

• Executing tasks and projects according to established procedures
• Collaborating with team members across departments
• Participating in meetings and providing status updates
• Documenting processes and maintaining records
• Identifying opportunities for process improvement
• Supporting team objectives and company goals
• Communicating effectively with internal and external stakeholders
• Meeting deadlines and quality standards consistently`
    };

    // Build the full description
    let description = `${company} is looking for a ${experienceLevel.toLowerCase()}-level ${title} to join our team${isRemote ? ' remotely' : ` in ${location}`}.\n\n`;

    description += `## What You'll Work With\n\n`;
    description += `**Tech Stack:** ${techInfo.stack}\n`;
    description += `**Tools:** ${techInfo.tools}\n\n`;

    description += `## Your Day-to-Day\n\n${techInfo.details}\n\n`;

    // Team structure
    const teamSizes = ['5-8', '8-12', '10-15', '15-20'];
    const teamSize = teamSizes[Math.floor(Math.random() * teamSizes.length)];

    description += `## Team & Environment\n\n`;
    description += `You'll be joining a team of ${teamSize} professionals. `;

    if (isRemote) {
      description += `As a remote position, we use Slack for daily communication, have regular video calls, and meet in person ${Math.random() > 0.5 ? 'quarterly' : 'twice a year'} for team events. Core hours are flexible within EU timezones.\n\n`;
    } else {
      description += `Our office features an open-plan workspace with quiet zones, standing desks, and all the amenities you need. We follow a ${Math.random() > 0.5 ? 'hybrid model (3 days office, 2 days remote)' : 'flexible policy with occasional remote work'}.\n\n`;
    }

    // Development process
    if (jobType === 'Frontend' || jobType === 'Backend' || jobType === 'Full Stack' || jobType === 'DevOps' || jobType === 'Mobile') {
      description += `## How We Work\n\n`;
      description += `• **Methodology:** Agile/Scrum with 2-week sprints\n`;
      description += `• **Code Review:** All PRs require at least one approval\n`;
      description += `• **CI/CD:** Automated testing and deployment pipelines\n`;
      description += `• **Documentation:** Technical docs in Confluence/Notion\n`;
      description += `• **Communication:** Daily standups, weekly team syncs\n\n`;
    }

    // Growth opportunities
    description += `## Growth & Development\n\n`;
    description += `• Annual learning budget of €1,500-2,500 for courses and conferences\n`;
    description += `• Clear career progression path with regular performance reviews\n`;
    description += `• Internal tech talks and knowledge sharing sessions\n`;
    description += `• Mentorship opportunities for ${experienceLevel === 'Senior' ? 'leading junior developers' : 'learning from senior team members'}\n`;

    return description;
  }

  generateBenefits(company, location) {
    const isRemote = location && (location.toLowerCase().includes('remote') || location.toLowerCase().includes('worldwide'));

    const commonBenefits = [
      'Competitive salary',
      'Annual bonus',
      'Professional development budget',
      'Team building events',
      'Mental health support',
      'Pension contributions'
    ];

    const remoteBenefits = [
      'Flexible working hours',
      'Work from anywhere',
      'Home office equipment allowance',
      'Co-working space membership',
      'Virtual team events'
    ];

    const officeBenefits = [
      'Modern office with great location',
      'Free parking',
      'Gym membership',
      'Free lunch/snacks',
      'Company car (for eligible positions)'
    ];

    const techBenefits = [
      'Latest tech equipment (MacBook Pro/ThinkPad)',
      'Software licenses of your choice',
      'Conference attendance budget',
      'Learning & certification support'
    ];

    let benefits = [...commonBenefits];

    if (isRemote) {
      benefits = [...benefits, ...remoteBenefits.slice(0, 3)];
    } else {
      benefits = [...benefits, ...officeBenefits.slice(0, 3)];
    }

    benefits = [...benefits, ...techBenefits.slice(0, 2)];

    // Shuffle and return 6-8 benefits
    return benefits.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 6);
  }

  generateRequirements(title, experienceLevel) {
    const lower = title.toLowerCase();
    const requirements = [];

    // Experience requirement
    if (experienceLevel === 'Junior') {
      requirements.push('0-2 years of relevant experience');
      requirements.push('Strong willingness to learn and grow');
    } else if (experienceLevel === 'Mid') {
      requirements.push('3-5 years of relevant experience');
      requirements.push('Proven track record of delivering results');
    } else {
      requirements.push('5+ years of relevant experience');
      requirements.push('Experience leading teams or projects');
    }

    // Technical requirements based on job type
    if (lower.includes('developer') || lower.includes('engineer') || lower.includes('software')) {
      requirements.push('Strong programming skills');
      requirements.push('Experience with modern development practices');
      requirements.push('Familiarity with Agile/Scrum methodologies');
      requirements.push('Good understanding of software architecture');
      if (lower.includes('frontend')) {
        requirements.push('Expertise in React, Vue, or Angular');
        requirements.push('Strong HTML, CSS, and JavaScript skills');
      } else if (lower.includes('backend')) {
        requirements.push('Experience with Node.js, Python, or Java');
        requirements.push('Database design and optimization skills');
      } else if (lower.includes('full stack')) {
        requirements.push('Frontend and backend development experience');
        requirements.push('Full-cycle development experience');
      }
    } else if (lower.includes('design') || lower.includes('ux') || lower.includes('ui')) {
      requirements.push('Proficiency in Figma, Sketch, or Adobe XD');
      requirements.push('Strong portfolio demonstrating design skills');
      requirements.push('Understanding of user-centered design principles');
      requirements.push('Experience with design systems');
    } else if (lower.includes('marketing')) {
      requirements.push('Experience with digital marketing channels');
      requirements.push('Data-driven approach to marketing');
      requirements.push('Knowledge of marketing automation tools');
      requirements.push('Strong analytical skills');
    } else if (lower.includes('account') || lower.includes('finance')) {
      requirements.push('Accounting degree or equivalent qualification');
      requirements.push('Knowledge of financial regulations');
      requirements.push('Experience with accounting software');
      requirements.push('Strong attention to detail');
    } else {
      requirements.push('Relevant educational background');
      requirements.push('Strong problem-solving skills');
      requirements.push('Excellent organizational abilities');
    }

    // Common requirements
    requirements.push('Excellent communication skills');
    requirements.push('Fluent in English (written and spoken)');
    requirements.push('Team player with positive attitude');

    return requirements.slice(0, Math.floor(Math.random() * 3) + 6);
  }

  generateResponsibilities(title) {
    const lower = title.toLowerCase();
    const responsibilities = [];

    if (lower.includes('developer') || lower.includes('engineer') || lower.includes('software')) {
      responsibilities.push('Design, develop, and maintain high-quality software');
      responsibilities.push('Write clean, testable, and efficient code');
      responsibilities.push('Participate in code reviews and provide constructive feedback');
      responsibilities.push('Collaborate with cross-functional teams');
      responsibilities.push('Troubleshoot and debug applications');
      responsibilities.push('Stay up-to-date with emerging technologies');
      responsibilities.push('Contribute to technical documentation');
      responsibilities.push('Mentor junior team members');
    } else if (lower.includes('design') || lower.includes('ux') || lower.includes('ui')) {
      responsibilities.push('Create user-centered designs and prototypes');
      responsibilities.push('Conduct user research and usability testing');
      responsibilities.push('Develop and maintain design systems');
      responsibilities.push('Collaborate with developers to implement designs');
      responsibilities.push('Present design concepts to stakeholders');
      responsibilities.push('Stay current with design trends and best practices');
    } else if (lower.includes('manager') || lower.includes('lead')) {
      responsibilities.push('Lead and manage team members');
      responsibilities.push('Define project goals and deliverables');
      responsibilities.push('Manage project timelines and budgets');
      responsibilities.push('Communicate with stakeholders');
      responsibilities.push('Identify and mitigate risks');
      responsibilities.push('Drive continuous improvement initiatives');
      responsibilities.push('Report on team/project performance');
    } else if (lower.includes('marketing')) {
      responsibilities.push('Develop and execute marketing campaigns');
      responsibilities.push('Analyze campaign performance and ROI');
      responsibilities.push('Manage social media presence');
      responsibilities.push('Create compelling marketing content');
      responsibilities.push('Collaborate with sales and product teams');
      responsibilities.push('Stay updated on market trends');
    } else if (lower.includes('account') || lower.includes('finance')) {
      responsibilities.push('Prepare financial statements and reports');
      responsibilities.push('Manage accounts payable and receivable');
      responsibilities.push('Ensure compliance with regulations');
      responsibilities.push('Assist with budget planning and forecasting');
      responsibilities.push('Reconcile accounts and resolve discrepancies');
      responsibilities.push('Support audit processes');
    } else {
      responsibilities.push('Execute daily tasks and responsibilities');
      responsibilities.push('Collaborate with team members');
      responsibilities.push('Meet deadlines and quality standards');
      responsibilities.push('Communicate progress and issues');
      responsibilities.push('Contribute to team goals');
      responsibilities.push('Continuously improve processes');
    }

    return responsibilities.slice(0, Math.floor(Math.random() * 2) + 5);
  }

  generateSkills(title, jobType) {
    const lower = title.toLowerCase();
    const skills = [];

    // Technical skills based on job type
    if (jobType === 'Frontend') {
      skills.push('React', 'TypeScript', 'JavaScript', 'HTML5', 'CSS3', 'Tailwind CSS', 'Next.js', 'Redux', 'Webpack', 'Jest');
    } else if (jobType === 'Backend') {
      skills.push('Node.js', 'Python', 'Java', 'PostgreSQL', 'MongoDB', 'REST APIs', 'GraphQL', 'Docker', 'AWS', 'Redis');
    } else if (jobType === 'Full Stack') {
      skills.push('React', 'Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'Git', 'REST APIs', 'CI/CD');
    } else if (jobType === 'DevOps') {
      skills.push('Docker', 'Kubernetes', 'AWS', 'Azure', 'Terraform', 'Jenkins', 'Linux', 'Python', 'Bash', 'Monitoring');
    } else if (jobType === 'Mobile') {
      skills.push('React Native', 'Swift', 'Kotlin', 'Flutter', 'iOS', 'Android', 'Firebase', 'REST APIs', 'Git', 'App Store');
    } else if (jobType === 'Data') {
      skills.push('Python', 'SQL', 'Pandas', 'TensorFlow', 'Tableau', 'Excel', 'Statistics', 'Machine Learning', 'Power BI', 'ETL');
    } else if (jobType === 'Design') {
      skills.push('Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'Prototyping', 'User Research', 'Design Systems', 'UI/UX', 'Wireframing');
    } else if (jobType === 'Marketing') {
      skills.push('Google Analytics', 'SEO', 'SEM', 'Social Media', 'Content Marketing', 'Email Marketing', 'HubSpot', 'Copywriting', 'A/B Testing', 'CRM');
    } else if (jobType === 'Finance') {
      skills.push('Excel', 'SAP', 'Financial Analysis', 'Accounting', 'Budgeting', 'Forecasting', 'IFRS', 'Reporting', 'ERP', 'Audit');
    } else if (jobType === 'HR') {
      skills.push('Recruiting', 'HRIS', 'Employee Relations', 'Onboarding', 'Performance Management', 'Labor Law', 'Training', 'Benefits', 'Payroll', 'Interviewing');
    } else {
      skills.push('Microsoft Office', 'Communication', 'Problem Solving', 'Time Management', 'Teamwork', 'Project Management');
    }

    // Shuffle and return 6-10 skills
    return skills.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 5) + 6);
  }

  generateCompanyInfo(company) {
    const sizes = ['50-200 employees', '200-500 employees', '500-1000 employees', '1000-5000 employees', '5000+ employees'];
    const industries = ['Technology', 'Finance', 'Healthcare', 'E-commerce', 'Consulting', 'Telecommunications', 'Automotive', 'Media', 'Manufacturing'];
    const foundedYears = [1990, 1995, 2000, 2005, 2010, 2015, 2018, 2020];

    return {
      name: company,
      size: sizes[Math.floor(Math.random() * sizes.length)],
      industry: industries[Math.floor(Math.random() * industries.length)],
      founded: foundedYears[Math.floor(Math.random() * foundedYears.length)],
      website: `https://www.${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      description: `${company} is a leading company delivering innovative solutions to customers worldwide.`
    };
  }

  generateDeadline(daysAgo) {
    // Application deadline is 14-30 days from posting
    const deadline = new Date();
    deadline.setDate(deadline.getDate() - daysAgo + Math.floor(Math.random() * 17) + 14);
    return deadline.toISOString();
  }
}

/**
 * Main scraping function
 */
export async function scrapeJobsFromLinkedIn() {
  try {
    console.log('\n🚀 Starting job scraping...');
    console.log(`📍 Locations: ${SCRAPING_CONFIG.locations.join(', ')}`);
    console.log(`🔑 Keywords: ${SCRAPING_CONFIG.keywords.slice(0, 5).join(', ')}... (${SCRAPING_CONFIG.keywords.length} total)\n`);

    const scraper = new LinkedInJobScraper();
    const allJobs = [];

    // Scrape for Slovakia first (more results per keyword)
    console.log('🇸🇰 Scraping jobs in Slovakia...');
    for (const keyword of SCRAPING_CONFIG.keywords) {
      const jobs = await scraper.scrapeJobsForKeyword(keyword, 'Slovakia');
      allJobs.push(...jobs);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Scrape remote jobs (fewer results per keyword to avoid overwhelming)
    console.log('\n🌍 Scraping remote jobs from international companies...');
    const remoteKeywords = SCRAPING_CONFIG.keywords.filter(k =>
      k.includes('developer') || k.includes('designer') || k.includes('analyst') ||
      k.includes('manager') || k.includes('specialist')
    );

    for (const keyword of remoteKeywords) {
      for (const location of SCRAPING_CONFIG.locations.slice(1)) { // Skip Slovakia, already done
        const jobs = await scraper.scrapeJobsForKeyword(keyword, location);
        // Take only first few results per location
        allJobs.push(...jobs.slice(0, SCRAPING_CONFIG.maxJobsPerLocation));
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // If scraping didn't yield enough results, use mock data
    if (allJobs.length < 10) {
      console.log('⚠️  Scraping yielded few results, using mock data for demo...');
      const mockGenerator = new MockJobGenerator();
      const mockJobs = mockGenerator.generateMockJobs(300);
      allJobs.push(...mockJobs);
    }

    // Clear old jobs and add new ones
    jobStore.clearJobs();
    allJobs.forEach(job => jobStore.addJob(job));
    jobStore.lastUpdate = new Date().toISOString();

    console.log(`\n✅ Scraping complete! Total jobs: ${allJobs.length}`);
    console.log(`📊 Stats:`, jobStore.getStats());

    return {
      success: true,
      jobsCount: allJobs.length,
      lastUpdate: jobStore.lastUpdate
    };

  } catch (error) {
    console.error('❌ Scraping failed:', error);

    // Fallback to mock data
    console.log('🎭 Using mock data as fallback...');
    const mockGenerator = new MockJobGenerator();
    const mockJobs = mockGenerator.generateMockJobs(300);

    jobStore.clearJobs();
    mockJobs.forEach(job => jobStore.addJob(job));
    jobStore.lastUpdate = new Date().toISOString();

    return {
      success: false,
      error: error.message,
      jobsCount: mockJobs.length,
      lastUpdate: jobStore.lastUpdate,
      usingMockData: true
    };
  }
}

/**
 * Get all stored jobs
 */
export function getAllJobs() {
  return jobStore.getAllJobs();
}

/**
 * Get jobs by category
 */
export function getJobsByCategory(category) {
  return jobStore.getJobsByCategory(category);
}

/**
 * Get scraping statistics
 */
export function getScrapingStats() {
  return jobStore.getStats();
}

/**
 * Filter jobs based on criteria
 */
export function filterJobs(filters = {}) {
  let jobs = jobStore.getAllJobs();

  if (filters.type) {
    jobs = jobs.filter(job => job.type === filters.type);
  }

  if (filters.experienceLevel) {
    jobs = jobs.filter(job => job.experienceLevel === filters.experienceLevel);
  }

  if (filters.location) {
    const locationFilter = filters.location.toLowerCase();
    jobs = jobs.filter(job => {
      const jobLocation = job.location.toLowerCase();
      const jobTitle = job.title.toLowerCase();
      const jobCompany = job.company.toLowerCase();

      switch(locationFilter) {
        case 'remote':
          return jobLocation.includes('remote') ||
                 jobLocation.includes('worldwide') ||
                 jobLocation.includes('global') ||
                 jobLocation.includes('work from anywhere') ||
                 jobCompany.includes('(remote)');
        case 'freelance':
          return jobTitle.includes('freelance') ||
                 jobTitle.includes('contract') ||
                 jobLocation.includes('freelance');
        case 'europe':
          return jobLocation.includes('europe') ||
                 jobLocation.includes('eu') ||
                 jobLocation.includes('germany') ||
                 jobLocation.includes('netherlands') ||
                 jobLocation.includes('france') ||
                 jobLocation.includes('spain') ||
                 jobLocation.includes('italy') ||
                 jobLocation.includes('poland') ||
                 jobLocation.includes('austria') ||
                 jobLocation.includes('switzerland');
        case 'slovakia':
          return jobLocation.includes('slovakia') ||
                 jobLocation.includes('bratislava') ||
                 jobLocation.includes('košice');
        case 'germany':
          return jobLocation.includes('germany') ||
                 jobLocation.includes('berlin') ||
                 jobLocation.includes('munich');
        case 'usa':
          return jobLocation.includes('us') ||
                 jobLocation.includes('united states') ||
                 jobLocation.includes('america') ||
                 jobLocation.includes('san francisco') ||
                 jobLocation.includes('new york');
        case 'uk':
          return jobLocation.includes('uk') ||
                 jobLocation.includes('united kingdom') ||
                 jobLocation.includes('london') ||
                 jobLocation.includes('britain');
        default:
          return jobLocation.includes(locationFilter);
      }
    });
  }

  if (filters.company) {
    jobs = jobs.filter(job =>
      job.company.toLowerCase().includes(filters.company.toLowerCase())
    );
  }

  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    jobs = jobs.filter(job =>
      job.title.toLowerCase().includes(searchLower) ||
      job.company.toLowerCase().includes(searchLower) ||
      job.description.toLowerCase().includes(searchLower)
    );
  }

  return jobs;
}
