# Architektúra - CV Analyzer Backend

## 🏗️ High-Level Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Frontend)                    │
│              React / Vue / Mobile App                    │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP/REST API
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  Express Server                          │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │           Middleware Layer                     │    │
│  │  • CORS                                        │    │
│  │  • Body Parser                                 │    │
│  │  • Request Logger                              │    │
│  │  • Error Handler                               │    │
│  │  • Multer (File Upload)                        │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │           Routes Layer                         │    │
│  │  • /api/upload-resume                          │    │
│  │  • /api/analyze-job-fit                        │    │
│  │  • /api/study-programs                         │    │
│  │  • /api/health                                 │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         Controller Layer                       │    │
│  │  • resumeController.js                         │    │
│  │  • jobFitController.js                         │    │
│  │  • healthController.js                         │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          Service Layer                         │    │
│  │  • resumeService.js                            │    │
│  │  • jobFitService.js                            │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          Utils Layer                           │    │
│  │  • pdfExtractor.js                             │    │
│  │  • textParser.js                               │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          Models Layer                          │    │
│  │  • Resume.js                                   │    │
│  │  • JobFitAnalysis.js                           │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │        In-Memory Storage                       │    │
│  │         (Ready for DB)                         │    │
│  │  Map<resumeId, Resume>                         │    │
│  └────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## 📁 Folder Structure

```
cv-analyzer-backend/
│
├── src/
│   │
│   ├── controllers/              # HTTP Request Handlers
│   │   ├── resumeController.js      # Upload & process resume
│   │   ├── jobFitController.js      # Analyze job fit
│   │   └── healthController.js      # Health check
│   │
│   ├── services/                 # Business Logic Layer
│   │   ├── resumeService.js         # Resume processing logic
│   │   └── jobFitService.js         # Job fit analysis logic
│   │
│   ├── models/                   # Data Models
│   │   ├── Resume.js                # Resume data structure
│   │   └── JobFitAnalysis.js        # Analysis result structure
│   │
│   ├── utils/                    # Utility Functions
│   │   ├── pdfExtractor.js          # PDF text extraction
│   │   └── textParser.js            # Text parsing & NLP
│   │
│   ├── middleware/               # Express Middleware
│   │   ├── errorHandler.js          # Global error handling
│   │   └── logger.js                # Request logging
│   │
│   ├── routes/                   # API Route Definitions
│   │   └── index.js                 # All routes
│   │
│   └── server.js                 # Main Application Entry Point
│
├── package.json                  # Dependencies & Scripts
├── .env.example                  # Environment Variables Template
├── .gitignore
├── README.md                     # Main Documentation
├── API_DOCUMENTATION.md          # API Reference
└── ARCHITECTURE.md               # This file
```

---

## 🔄 Request Flow

### Example: Upload Resume

```
1. Client Request
   ↓
   POST /api/upload-resume
   Content-Type: multipart/form-data
   Body: { file: resume.pdf }

2. Express Server
   ↓
   • CORS middleware ✓
   • Body parser ✓
   • Request logger ✓
   • Multer (file upload) ✓

3. Router Layer
   ↓
   routes/index.js
   → Matches POST /upload-resume
   → Calls upload.single('file')

4. Controller Layer
   ↓
   resumeController.uploadResume()
   • Validates request
   • Calls service layer

5. Service Layer
   ↓
   resumeService.processResume()
   • Calls pdfExtractor utility
   • Calls textParser utility
   • Creates Resume model
   • Saves to storage

6. Utils Layer
   ↓
   pdfExtractor.extractTextFromBuffer()
   textParser.extractSkills()
   textParser.extractEducation()
   ...

7. Response
   ↓
   {
     "success": true,
     "data": { resumeData }
   }
```

---

## 🧩 Layer Responsibilities

### 1. Controllers Layer
**Zodpovednosť:** HTTP komunikácia

- Prijímajú HTTP requesty
- Validujú vstupné parametre
- Volajú service layer
- Formátujú odpovede
- Spracovávajú HTTP chyby

**Príklad:**
```javascript
export async function uploadResume(req, res) {
  try {
    // Validácia
    if (!req.file && !req.body.text) {
      return res.status(400).json({ error: '...' });
    }

    // Volanie service
    const resume = await processResume(req.file, req.body.text);

    // Odpoveď
    return res.status(200).json({ success: true, data: resume });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

---

### 2. Services Layer
**Zodpovednosť:** Business logika

- Obsahujú hlavnú aplikačnú logiku
- Nezávislé na HTTP (môžu sa použiť aj mimo API)
- Volajú utility funkcie
- Vytvárajú a validujú modely
- Spravujú dáta (storage/DB)

**Príklad:**
```javascript
export async function processResume(file, textInput) {
  // Business logika
  let rawText = file ? await extractTextFromBuffer(file.buffer) : textInput;

  const resumeData = {
    skills: extractSkills(rawText),
    education: extractEducation(rawText),
    // ...
  };

  const resume = new Resume(resumeData);
  resume.validate();

  return saveResume(resume);
}
```

---

### 3. Models Layer
**Zodpovednosť:** Dátové štruktúry

- Definujú schému dát
- Validácia dát
- Data transformation (toJSON, etc.)
- Pripravené na DB migráciu

**Príklad:**
```javascript
export class Resume {
  constructor(data) {
    this.id = data.id || this.generateId();
    this.skills = data.skills || [];
    // ...
  }

  validate() {
    if (!this.rawText && this.skills.length === 0) {
      throw new Error('Invalid resume data');
    }
  }

  toJSON() {
    return { id: this.id, skills: this.skills, ... };
  }
}
```

---

### 4. Utils Layer
**Zodpovednosť:** Pomocné funkcie

- Pure functions (bez side effects)
- Znovu použiteľné
- Špecializované úlohy (PDF parsing, NLP, etc.)

**Príklad:**
```javascript
export function extractSkills(text) {
  // Pure function - rovnaký vstup = rovnaký výstup
  const foundSkills = new Set();
  // Logic...
  return Array.from(foundSkills);
}
```

---

### 5. Middleware Layer
**Zodpovednosť:** Request/Response preprocessing

- CORS handling
- Body parsing
- File upload handling
- Logging
- Error handling

---

## 🎯 Design Patterns

### 1. Layered Architecture (N-Tier)
```
Presentation Layer (Controllers)
    ↓
Business Logic Layer (Services)
    ↓
Data Access Layer (Models + Storage)
    ↓
Utility Layer (Utils)
```

**Výhody:**
- Separation of concerns
- Testovateľnosť
- Reusability
- Maintainability

---

### 2. Repository Pattern (pripravené)
```javascript
// resumeService.js
const resumeStorage = new Map(); // In-memory repository

export function saveResume(resume) {
  resumeStorage.set(resume.id, resume);
  return resume;
}

export function getResume(resumeId) {
  return resumeStorage.get(resumeId);
}
```

**Migrácia na DB:**
```javascript
// resumeRepository.js
import { Resume } from '../models/Resume.js';

export async function saveResume(resume) {
  return await Resume.create(resume); // Prisma/Mongoose
}

export async function getResume(resumeId) {
  return await Resume.findById(resumeId);
}
```

---

### 3. Strategy Pattern (pre analýzu)
```javascript
// jobFitService.js

// Strategy 1: Analyze by study program
if (studyProgram) {
  const program = STUDY_PROGRAMS[studyProgram];
  requiredSkills = program.requiredSkills;
}

// Strategy 2: Analyze by job description
else if (jobDescription) {
  requiredSkills = extractSkills(jobDescription);
}
```

---

## 🔌 Integration Points

### Future LLM Integration
```javascript
// services/llmService.js

import OpenAI from 'openai';

export async function enhanceWithLLM(resumeData, jobDescription) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `
    Analyze this resume against the job description:
    Resume: ${JSON.stringify(resumeData)}
    Job: ${jobDescription}
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });

  return response.choices[0].message.content;
}
```

**Použitie v jobFitService:**
```javascript
// jobFitService.js
import { enhanceWithLLM } from './llmService.js';

export async function analyzeJobFit(resumeData, jobDescription) {
  // Rule-based analysis
  const basicAnalysis = performRuleBasedAnalysis();

  // LLM enhancement
  const llmInsights = await enhanceWithLLM(resumeData, jobDescription);

  return {
    ...basicAnalysis,
    llmInsights
  };
}
```

---

### Database Integration (pripravené)

**Option 1: MongoDB + Mongoose**
```javascript
// models/Resume.js
import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema({
  skills: [String],
  education: [{
    institution: String,
    degree: String,
    field: String
  }],
  createdAt: { type: Date, default: Date.now }
});

export const Resume = mongoose.model('Resume', resumeSchema);
```

**Option 2: PostgreSQL + Prisma**
```prisma
// prisma/schema.prisma

model Resume {
  id            String   @id @default(uuid())
  skills        String[]
  education     Education[]
  createdAt     DateTime @default(now())
}

model Education {
  id          String @id @default(uuid())
  institution String
  degree      String
  resumeId    String
  resume      Resume @relation(fields: [resumeId], references: [id])
}
```

---

## 📊 Data Flow Diagram

### Upload Resume Flow
```
┌─────────┐
│ Client  │
└────┬────┘
     │ POST /upload-resume (PDF)
     ▼
┌─────────────────┐
│ Express Server  │
└────┬────────────┘
     │
     ▼
┌──────────────────┐
│ Multer Middleware│  ─────► Converts to Buffer
└────┬─────────────┘
     │
     ▼
┌─────────────────────┐
│ resumeController    │  ─────► Validates request
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ resumeService       │
└────┬────────────────┘
     │
     ├──────────────────────────┐
     ▼                          ▼
┌──────────────┐    ┌────────────────────┐
│pdfExtractor  │    │   textParser       │
│              │    │                    │
│• Extract text│    │• Extract skills    │
│              │    │• Extract education │
│              │    │• Extract experience│
└──────┬───────┘    └────────┬───────────┘
       │                     │
       └──────────┬──────────┘
                  ▼
          ┌───────────────┐
          │ Resume Model  │  ─────► Validate & Structure
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │ Storage (Map) │  ─────► Save
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │   Response    │  ─────► JSON
          └───────────────┘
```

---

### Analyze Job Fit Flow
```
┌─────────┐
│ Client  │
└────┬────┘
     │ POST /analyze-job-fit
     │ { resumeData, studyProgram }
     ▼
┌─────────────────────┐
│jobFitController     │  ─────► Validate input
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│jobFitService        │
└────┬────────────────┘
     │
     ├─────────────────────────┐
     ▼                         ▼
┌──────────────────┐   ┌──────────────────┐
│ Load Program     │   │ Extract Job      │
│ Requirements     │   │ Requirements     │
└────┬─────────────┘   └──────┬───────────┘
     │                        │
     └───────────┬────────────┘
                 ▼
         ┌───────────────┐
         │ Skill Matching│  ─────► Compare skills
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Score Calc    │  ─────► Calculate fit score
         │ • Skills 70%  │
         │ • Exp 20%     │
         │ • Edu 10%     │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Generate      │  ─────► Suggestions
         │ Recommendations│         & Resources
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │JobFitAnalysis │  ─────► Structure result
         │    Model      │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │   Response    │  ─────► JSON
         └───────────────┘
```

---

## 🚀 Deployment Architecture

### Development
```
localhost:3000
├── Node.js server
└── In-memory storage
```

### Production (návrh)
```
┌─────────────────────────────────────────┐
│             Load Balancer               │
│              (NGINX/ALB)                │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌───────────────┐   ┌───────────────┐
│ Node Server 1 │   │ Node Server 2 │
└───────┬───────┘   └───────┬───────┘
        │                   │
        └─────────┬─────────┘
                  ▼
        ┌──────────────────┐
        │    Database      │
        │  MongoDB/Postgres│
        └──────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │   File Storage   │
        │    (AWS S3)      │
        └──────────────────┘
```

---

## 📈 Scalability Considerations

### Horizontal Scaling
- Stateless API design
- In-memory storage → Database migration
- Session management s Redis

### Caching
```javascript
import Redis from 'ioredis';
const redis = new Redis();

// Cache study programs
export async function getAvailablePrograms() {
  const cached = await redis.get('study-programs');
  if (cached) return JSON.parse(cached);

  const programs = fetchFromDB();
  await redis.set('study-programs', JSON.stringify(programs), 'EX', 3600);
  return programs;
}
```

### Queue System
```javascript
import Bull from 'bull';

const resumeQueue = new Bull('resume-processing');

resumeQueue.process(async (job) => {
  const { file } = job.data;
  return await processResume(file);
});

// V controller:
export async function uploadResume(req, res) {
  const job = await resumeQueue.add({ file: req.file });
  res.json({ jobId: job.id, status: 'processing' });
}
```

---

## 🔒 Security Architecture

### Input Validation
```javascript
// middleware/validator.js
import { body, validationResult } from 'express-validator';

export const validateAnalysisRequest = [
  body('resumeData').isObject(),
  body('resumeData.skills').isArray(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
```

### Rate Limiting
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', limiter);
```

---

## 📝 Testing Strategy

```
Unit Tests (utils, services)
     ↓
Integration Tests (API endpoints)
     ↓
End-to-End Tests (full flow)
```

**Example:**
```javascript
// tests/services/resumeService.test.js
import { processResume } from '../../src/services/resumeService.js';

describe('Resume Service', () => {
  test('should extract skills from text', async () => {
    const text = 'Skills: JavaScript, React, Node.js';
    const resume = await processResume(null, text);
    expect(resume.skills).toContain('JavaScript');
  });
});
```

---

## 🎓 Best Practices Implemented

1. **Separation of Concerns** - Každá vrstva má jasnú zodpovednosť
2. **DRY Principle** - Reusable utility functions
3. **Error Handling** - Centralizované cez middleware
4. **Logging** - Request/response logging
5. **Validation** - Input validation na všetkých endpointoch
6. **Security** - File type validation, size limits
7. **Scalability** - Stateless design, pripravené na DB
8. **Documentation** - Komentáre + README + API docs
