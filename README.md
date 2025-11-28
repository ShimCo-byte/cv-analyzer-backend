# CV Analyzer Backend

Plne funkčný backend pre analýzu CV a vyhodnocovanie zhody s pracovnými pozíciami alebo študijnými programami.

## 🚀 Technológie

- **Node.js** + **Express** - Backend framework
- **pdf-parse** - Extrakcia textu z PDF súborov
- **multer** - File upload handling
- **Rule-based AI** - Klasifikácia a scoring logika
- **LLM-ready** - Pripravené na integráciu s OpenAI/Anthropic API

## 📋 Funkcionalita

### API Endpoints

#### 1. `POST /api/upload-resume`
Uploadne a spracuje CV (PDF alebo text).

**Request:**
```bash
# S PDF súborom
curl -X POST http://localhost:3000/api/upload-resume \
  -F "file=@resume.pdf"

# Alebo s textovým vstupom
curl -X POST http://localhost:3000/api/upload-resume \
  -H "Content-Type: application/json" \
  -d '{"text": "John Doe\nSoftware Engineer\nSkills: JavaScript, React, Node.js..."}'
```

**Response:**
```json
{
  "success": true,
  "message": "Resume processed successfully",
  "data": {
    "id": "resume_1234567890_abc123",
    "skills": ["JavaScript", "React", "Node.js", "Python", "SQL"],
    "education": [
      {
        "institution": "Stanford University",
        "degree": "Bachelor",
        "field": "Computer Science",
        "startDate": null,
        "endDate": "2020"
      }
    ],
    "experience": [
      {
        "company": "Google",
        "position": "Software Engineer",
        "description": "Developed web applications...",
        "startDate": "2020",
        "endDate": "2023",
        "technologies": []
      }
    ],
    "certifications": [
      {
        "name": "AWS Certified Developer",
        "issuer": "AWS",
        "date": "2022",
        "expiryDate": null
      }
    ],
    "keywords": ["engineer", "developer", "software", "web", "applications"],
    "contactInfo": {
      "email": "john.doe@example.com",
      "phone": "+1-234-567-8900",
      "linkedin": "linkedin.com/in/johndoe",
      "github": "github.com/johndoe"
    },
    "createdAt": "2025-11-23T10:30:00.000Z"
  }
}
```

#### 2. `POST /api/analyze-job-fit`
Analyzuje zhodu CV s požiadavkami pozície alebo študijného programu.

**Request:**
```bash
curl -X POST http://localhost:3000/api/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": {
      "id": "resume_123",
      "skills": ["JavaScript", "React", "Node.js"],
      "education": [...],
      "experience": [...]
    },
    "studyProgram": "web-development"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Job fit analysis completed",
  "data": {
    "fitScore": 75,
    "explanation": "Analysis for Web Development:\n\nGood fit! You have 5 relevant skills, but there are areas for improvement.\n\nMatched skills: JavaScript, React, Node.js, Git, HTML\n\nMissing skills: CSS, TypeScript, MongoDB",
    "missingSkills": ["css", "typescript", "mongodb", "rest api", "responsive design"],
    "matchedSkills": ["javascript", "react", "node.js", "git"],
    "suggestionsToImprove": [
      "Focus on acquiring these critical skills: css, typescript, mongodb",
      "Expand your technical skill set to be more competitive"
    ],
    "recommendedResources": [
      {
        "type": "course",
        "title": "The Complete JavaScript Course",
        "provider": "Udemy",
        "url": "https://www.udemy.com/course/the-complete-javascript-course/",
        "relevance": "Core JavaScript fundamentals",
        "difficulty": "beginner"
      },
      {
        "type": "project",
        "title": "Build a Portfolio Website",
        "provider": "Self-guided",
        "url": "",
        "relevance": "Showcase your skills and projects",
        "difficulty": "beginner"
      }
    ],
    "analyzedAt": "2025-11-23T10:35:00.000Z"
  }
}
```

#### 3. `GET /api/study-programs`
Vráti zoznam dostupných študijných programov.

**Request:**
```bash
curl http://localhost:3000/api/study-programs
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "computer-science",
      "name": "Computer Science",
      "difficulty": "advanced"
    },
    {
      "id": "web-development",
      "name": "Web Development",
      "difficulty": "intermediate"
    },
    {
      "id": "data-science",
      "name": "Data Science",
      "difficulty": "advanced"
    },
    {
      "id": "cybersecurity",
      "name": "Cybersecurity",
      "difficulty": "advanced"
    }
  ]
}
```

#### 4. `GET /api/health`
Health check endpoint.

**Request:**
```bash
curl http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-23T10:00:00.000Z",
  "uptime": 3600,
  "service": "cv-analyzer-backend",
  "version": "1.0.0",
  "environment": "development"
}
```

## 🏗️ Architektúra

```
cv-analyzer-backend/
├── src/
│   ├── controllers/          # HTTP request handlers
│   │   ├── resumeController.js
│   │   ├── jobFitController.js
│   │   └── healthController.js
│   ├── services/             # Business logic
│   │   ├── resumeService.js
│   │   └── jobFitService.js
│   ├── models/               # Data models
│   │   ├── Resume.js
│   │   └── JobFitAnalysis.js
│   ├── utils/                # Utility functions
│   │   ├── pdfExtractor.js
│   │   └── textParser.js
│   ├── middleware/           # Express middleware
│   │   ├── errorHandler.js
│   │   └── logger.js
│   ├── routes/               # API routes
│   │   └── index.js
│   └── server.js             # Main entry point
├── package.json
├── .env.example
└── README.md
```

### Čistá architektúra (Clean Architecture)

**Controllers** → **Services** → **Models** → **Utils**

- **Controllers**: Spracovávajú HTTP requesty, validáciu vstupu a návratové hodnoty
- **Services**: Obsahujú business logiku, volajú utility funkcie
- **Models**: Definujú dátové štruktúry a validáciu
- **Utils**: Pomocné funkcie pre PDF parsing, text extraction, atď.

## 🔧 Inštalácia a spustenie

### 1. Nainštaluj závislosti
```bash
cd cv-analyzer-backend
npm install
```

### 2. Vytvor .env súbor
```bash
cp .env.example .env
```

### 3. Spusti server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server bude dostupný na `http://localhost:3000`

## 📊 Dátový model

### Resume Model
```javascript
{
  id: string,
  skills: string[],
  education: Education[],
  experience: Experience[],
  certifications: Certification[],
  keywords: string[],
  contactInfo: {
    email?: string,
    phone?: string,
    linkedin?: string,
    github?: string
  },
  createdAt: string (ISO 8601)
}
```

### JobFitAnalysis Model
```javascript
{
  fitScore: number (0-100),
  explanation: string,
  missingSkills: string[],
  matchedSkills: string[],
  suggestionsToImprove: string[],
  recommendedResources: RecommendedResource[],
  analyzedAt: string (ISO 8601)
}
```

### RecommendedResource Model
```javascript
{
  type: 'course' | 'project' | 'book' | 'certification',
  title: string,
  provider: string,
  url: string,
  relevance: string,
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}
```

## 🎯 Scoring algoritmus

### Fit Score (0-100)
```
fitScore = (requiredSkillsMatch × 70) + (experienceScore × 20) + (educationScore × 10)
```

**Required Skills Match** (70%):
- Počet matchnutých required skills / celkový počet required skills

**Experience Score** (20%):
- Počet rokov pracovných skúseností
- Normalizované na 0-1 (max 5+ rokov = 1.0)

**Education Score** (10%):
- PhD = 1.0
- Master = 0.8
- Bachelor = 0.6

## 🚀 Príprava na databázu

Aktuálne používa **in-memory storage** (Map), ale modely sú pripravené na migráciu.

### Pre MongoDB:
```javascript
// Resume.js
import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema({
  skills: [String],
  education: [educationSchema],
  // ...
});

export const Resume = mongoose.model('Resume', resumeSchema);
```

### Pre PostgreSQL:
```javascript
// Resume.js s Prisma
model Resume {
  id            String   @id @default(uuid())
  skills        String[]
  education     Education[]
  // ...
}
```

## 🔮 LLM Integrácia (pripravené)

Backend je pripravený na integráciu s LLM API:

```javascript
// V jobFitService.js - pridaj:
import OpenAI from 'openai';

async function enhanceAnalysisWithLLM(resumeData, analysis) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are a career advisor analyzing resume fit..."
    }]
  });

  return response.choices[0].message.content;
}
```

## 📝 Príklady použitia

### Testovanie s curl

```bash
# 1. Health check
curl http://localhost:3000/api/health

# 2. Upload PDF resume
curl -X POST http://localhost:3000/api/upload-resume \
  -F "file=@path/to/resume.pdf"

# 3. Analyze job fit
curl -X POST http://localhost:3000/api/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d @analysis-request.json

# 4. Get study programs
curl http://localhost:3000/api/study-programs
```

### Testovanie s JavaScript (fetch)

```javascript
// Upload resume
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const uploadResponse = await fetch('http://localhost:3000/api/upload-resume', {
  method: 'POST',
  body: formData
});

const { data: resumeData } = await uploadResponse.json();

// Analyze job fit
const analysisResponse = await fetch('http://localhost:3000/api/analyze-job-fit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    resumeData,
    studyProgram: 'web-development'
  })
});

const { data: analysis } = await analysisResponse.json();
console.log(`Fit Score: ${analysis.fitScore}`);
```

## 🛡️ Error Handling

Všetky endpointy vracajú konzistentný error formát:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

## 🔒 Bezpečnosť

- File size limit: 10MB
- Allowed file types: PDF, text
- CORS enabled (konfiguruj v produkcii)
- Input validation na všetkých endpointoch
- Error messages sanitizované v produkcii

## 📈 Budúce vylepšenia

- [ ] Pripojenie na databázu (MongoDB/PostgreSQL)
- [ ] OpenAI/Anthropic LLM integrácia
- [ ] Autentifikácia a autorizácia (JWT)
- [ ] Rate limiting
- [ ] Caching (Redis)
- [ ] File storage (AWS S3)
- [ ] Webhooks pre asynchrónne spracovanie
- [ ] GraphQL API ako alternatíva k REST
- [ ] Unit a integration testy
- [ ] Docker containerizácia
- [ ] CI/CD pipeline

## 📄 Licencia

MIT

---

**Vytvorené s Node.js + Express | Ready for production deployment**
