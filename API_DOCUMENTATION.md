# API Dokumentácia - CV Analyzer Backend

## Base URL
```
http://localhost:3000/api
```

---

## Endpoints

### 1. Health Check

Skontroluje stav servera.

**Endpoint:** `GET /api/health`

**Request:**
```bash
curl http://localhost:3000/api/health
```

**Response:** `200 OK`
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

**Error Response:** `503 Service Unavailable`
```json
{
  "status": "unhealthy",
  "error": "Error message"
}
```

---

### 2. Upload Resume

Uploadne a spracuje CV (PDF alebo plain text).

**Endpoint:** `POST /api/upload-resume`

**Content-Type:**
- `multipart/form-data` (pre PDF upload)
- `application/json` (pre text input)

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | File (PDF) | No* | PDF súbor s CV |
| text | String | No* | Plain text CV |

*Aspoň jeden parameter musí byť poskytnutý

**Example Request (PDF):**
```bash
curl -X POST http://localhost:3000/api/upload-resume \
  -F "file=@resume.pdf"
```

**Example Request (Text):**
```bash
curl -X POST http://localhost:3000/api/upload-resume \
  -H "Content-Type: application/json" \
  -d '{
    "text": "John Doe\nSoftware Engineer\n\nSkills:\n- JavaScript\n- React\n- Node.js\n\nExperience:\nSoftware Engineer at Google\n2020-2023\n\nEducation:\nBachelor of Science in Computer Science\nStanford University, 2020"
  }'
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Resume processed successfully",
  "data": {
    "id": "resume_1234567890_abc123",
    "skills": [
      "JavaScript",
      "React",
      "Node.js",
      "Python",
      "SQL",
      "Git"
    ],
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
        "description": "Developed web applications using React and Node.js",
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
    "keywords": [
      "software",
      "engineer",
      "developer",
      "web",
      "applications",
      "react",
      "node",
      "javascript",
      "google",
      "stanford"
    ],
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

**Error Responses:**

`400 Bad Request` - Chýbajúce dáta
```json
{
  "success": false,
  "error": "Either PDF file or text input is required",
  "message": "Please provide resume as PDF file or plain text"
}
```

`400 Bad Request` - Neplatný typ súboru
```json
{
  "success": false,
  "error": "Invalid file type",
  "message": "Only PDF and text files are supported"
}
```

`500 Internal Server Error` - Chyba spracovania
```json
{
  "success": false,
  "error": "Failed to process resume",
  "message": "Error details..."
}
```

---

### 3. Analyze Job Fit

Analyzuje zhodu CV s požiadavkami pracovnej pozície alebo študijného programu.

**Endpoint:** `POST /api/analyze-job-fit`

**Content-Type:** `application/json`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| resumeData | Object | Yes | Dáta z `/upload-resume` endpointu |
| jobDescription | String | No* | Popis pracovnej pozície |
| studyProgram | String | No* | ID študijného programu |
| selectedSchool | String | No | Názov školy (voliteľné) |

*Aspoň `jobDescription` alebo `studyProgram` musí byť poskytnutý

**resumeData Object:**
```json
{
  "id": "resume_123",
  "skills": ["JavaScript", "React", "Node.js"],
  "education": [...],
  "experience": [...]
}
```

**Example Request (Study Program):**
```bash
curl -X POST http://localhost:3000/api/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": {
      "id": "resume_123",
      "skills": ["JavaScript", "React", "Node.js", "Git"],
      "education": [
        {
          "institution": "Stanford University",
          "degree": "Bachelor",
          "field": "Computer Science"
        }
      ],
      "experience": [
        {
          "company": "Google",
          "position": "Software Engineer",
          "startDate": "2020",
          "endDate": "2023"
        }
      ],
      "certifications": []
    },
    "studyProgram": "web-development"
  }'
```

**Example Request (Job Description):**
```bash
curl -X POST http://localhost:3000/api/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": {...},
    "jobDescription": "We are looking for a Senior React Developer with 3+ years of experience. Required skills: React, TypeScript, Node.js, GraphQL, AWS. Nice to have: Next.js, Docker, Kubernetes."
  }'
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Job fit analysis completed",
  "data": {
    "fitScore": 75,
    "explanation": "Analysis for Web Development:\n\nGood fit! You have 5 relevant skills, but there are areas for improvement.\n\nMatched skills: javascript, react, node.js, git, html\n\nMissing skills: css, typescript, mongodb",
    "missingSkills": [
      "css",
      "typescript",
      "mongodb",
      "rest api",
      "responsive design"
    ],
    "matchedSkills": [
      "javascript",
      "react",
      "node.js",
      "git"
    ],
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
        "type": "course",
        "title": "React - The Complete Guide",
        "provider": "Udemy",
        "url": "https://www.udemy.com/course/react-the-complete-guide/",
        "relevance": "Modern React development",
        "difficulty": "intermediate"
      },
      {
        "type": "project",
        "title": "Build a Portfolio Website",
        "provider": "Self-guided",
        "url": "",
        "relevance": "Showcase your skills and projects",
        "difficulty": "beginner"
      },
      {
        "type": "book",
        "title": "Clean Code",
        "provider": "Robert C. Martin",
        "url": "",
        "relevance": "Software engineering best practices",
        "difficulty": "intermediate"
      }
    ],
    "analyzedAt": "2025-11-23T10:35:00.000Z"
  }
}
```

**Fit Score Interpretation:**
- `80-100`: Excellent fit
- `60-79`: Good fit
- `40-59`: Moderate fit
- `0-39`: Limited fit

**Error Responses:**

`400 Bad Request` - Chýbajúce resumeData
```json
{
  "success": false,
  "error": "Missing resumeData",
  "message": "Resume data is required for analysis"
}
```

`400 Bad Request` - Chýbajúce job requirements
```json
{
  "success": false,
  "error": "Missing job requirements",
  "message": "Either jobDescription or studyProgram must be provided"
}
```

`400 Bad Request` - Neplatný formát resumeData
```json
{
  "success": false,
  "error": "Invalid resumeData format",
  "message": "resumeData must contain a skills array"
}
```

---

### 4. Get Study Programs

Vráti zoznam dostupných študijných programov.

**Endpoint:** `GET /api/study-programs`

**Request:**
```bash
curl http://localhost:3000/api/study-programs
```

**Response:** `200 OK`
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

---

## Study Programs Detail

### computer-science
- **Required Skills:** JavaScript, Python, Java, C++, SQL, Git, algorithms, data structures
- **Recommended Skills:** React, Node.js, Docker, Linux, AWS
- **Difficulty:** Advanced

### web-development
- **Required Skills:** HTML, CSS, JavaScript, React, Node.js, Git
- **Recommended Skills:** TypeScript, Next.js, MongoDB, REST API, responsive design
- **Difficulty:** Intermediate

### data-science
- **Required Skills:** Python, R, SQL, statistics, machine learning, pandas, numpy
- **Recommended Skills:** TensorFlow, PyTorch, Jupyter, scikit-learn, data visualization
- **Difficulty:** Advanced

### cybersecurity
- **Required Skills:** networking, Linux, security, cryptography, penetration testing
- **Recommended Skills:** Python, Wireshark, Metasploit, OWASP, cloud security
- **Difficulty:** Advanced

---

## Error Handling

Všetky chybové odpovede majú konzistentný formát:

```json
{
  "success": false,
  "error": "Error type or category",
  "message": "Detailed error message explaining what went wrong"
}
```

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Úspešný request |
| 400 | Bad Request | Chýbajúce alebo neplatné parametre |
| 404 | Not Found | Endpoint neexistuje |
| 500 | Internal Server Error | Chyba servera |
| 503 | Service Unavailable | Server nefunguje správne |

---

## Rate Limiting

Momentálne **bez** rate limitingu. V produkcii odporúčam:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minút
  max: 100 // max 100 requestov za okno
});

app.use('/api/', limiter);
```

---

## CORS

CORS je povolený pre všetky origins. V produkcii nastav:

```env
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

---

## Testing Examples

### Postman Collection

```json
{
  "info": {
    "name": "CV Analyzer API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Upload Resume (PDF)",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/api/upload-resume",
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "file",
              "type": "file",
              "src": "/path/to/resume.pdf"
            }
          ]
        }
      }
    },
    {
      "name": "Analyze Job Fit",
      "request": {
        "method": "POST",
        "url": "http://localhost:3000/api/analyze-job-fit",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"resumeData\": {...},\n  \"studyProgram\": \"web-development\"\n}"
        }
      }
    }
  ]
}
```

---

## Changelog

### v1.0.0 (2025-11-23)
- Initial release
- POST /upload-resume endpoint
- POST /analyze-job-fit endpoint
- GET /study-programs endpoint
- GET /health endpoint
- PDF text extraction
- Rule-based skill matching
- Fit score calculation
- Resource recommendations
