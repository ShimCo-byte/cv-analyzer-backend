# Quick Start Guide

Rýchly návod na spustenie CV Analyzer Backend.

## 📦 Inštalácia

### 1. Prejdi do priečinka projektu
```bash
cd cv-analyzer-backend
```

### 2. Nainštaluj závislosti
```bash
npm install
```

### 3. Skontroluj environment variables
```bash
cat .env
```

Súbor `.env` by mal obsahovať:
```
PORT=3000
NODE_ENV=development
```

## 🚀 Spustenie servera

### Development mode (s auto-reload)
```bash
npm run dev
```

### Production mode
```bash
npm start
```

Server by mal bežať na `http://localhost:3000`

Uvidíš výstup:
```
=================================
CV Analyzer Backend Server
=================================
Environment: development
Server running on port 3000
API available at: http://localhost:3000/api
=================================

Available endpoints:
  GET  http://localhost:3000/api/health
  POST http://localhost:3000/api/upload-resume
  POST http://localhost:3000/api/analyze-job-fit
  GET  http://localhost:3000/api/study-programs
=================================
```

## 🧪 Testovanie

### Option 1: Automatický test script (odporúčané)
```bash
# Uisti sa, že server beží v inom termináli
npm run dev

# V novom termináli spusti testy
cd examples
./test-requests.sh
```

### Option 2: Manuálne cURL testy

**1. Health Check**
```bash
curl http://localhost:3000/api/health
```

**2. Upload Resume (text)**
```bash
curl -X POST http://localhost:3000/api/upload-resume \
  -H "Content-Type: application/json" \
  -d '{
    "text": "John Doe\nSoftware Engineer\nSkills: JavaScript, React, Node.js"
  }'
```

**3. Upload Resume (PDF)**
```bash
curl -X POST http://localhost:3000/api/upload-resume \
  -F "file=@path/to/your/resume.pdf"
```

**4. Get Study Programs**
```bash
curl http://localhost:3000/api/study-programs
```

**5. Analyze Job Fit**
```bash
curl -X POST http://localhost:3000/api/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d '{
    "resumeData": {
      "skills": ["JavaScript", "React", "Node.js"],
      "education": [],
      "experience": []
    },
    "studyProgram": "web-development"
  }'
```

### Option 3: Použiť Postman/Insomnia

Import endpoints z `API_DOCUMENTATION.md`

## 📊 Príklad kompletného flow

```bash
# 1. Spusti server
npm run dev

# 2. V novom termináli - upload resume
RESPONSE=$(curl -s -X POST http://localhost:3000/api/upload-resume \
  -H "Content-Type: application/json" \
  -d @examples/test-resume.txt)

echo $RESPONSE | jq .

# 3. Extrahuj resumeData
RESUME_DATA=$(echo $RESPONSE | jq -c '.data')

# 4. Analyzuj job fit
curl -X POST http://localhost:3000/api/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d "{
    \"resumeData\": ${RESUME_DATA},
    \"studyProgram\": \"web-development\"
  }" | jq .
```

## 🎯 Expected Output Examples

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2025-11-23T10:00:00.000Z",
  "uptime": 45.234,
  "service": "cv-analyzer-backend",
  "version": "1.0.0",
  "environment": "development"
}
```

### Upload Resume Response
```json
{
  "success": true,
  "message": "Resume processed successfully",
  "data": {
    "id": "resume_1732356000000_abc123",
    "skills": ["JavaScript", "React", "Node.js", "Python"],
    "education": [...],
    "experience": [...],
    "certifications": [...],
    "keywords": [...],
    "contactInfo": {...}
  }
}
```

### Analyze Job Fit Response
```json
{
  "success": true,
  "message": "Job fit analysis completed",
  "data": {
    "fitScore": 75,
    "explanation": "Good fit! You have 5 relevant skills...",
    "missingSkills": ["CSS", "TypeScript"],
    "matchedSkills": ["JavaScript", "React", "Node.js"],
    "suggestionsToImprove": [...],
    "recommendedResources": [...]
  }
}
```

## 🐛 Troubleshooting

### Port už používaný
```bash
# Zisti, čo beží na porte 3000
lsof -ti:3000

# Zastaví proces
kill -9 $(lsof -ti:3000)

# Alebo zmeň port v .env
PORT=3001
```

### npm install zlyhá
```bash
# Vymaž node_modules a skús znova
rm -rf node_modules package-lock.json
npm install
```

### PDF upload nefunguje
```bash
# Uisti sa, že pdf-parse je nainštalovaný
npm list pdf-parse

# Reinstall ak potrebné
npm install pdf-parse
```

### CORS chyba
```bash
# V src/server.js už je CORS povolený pre všetky origins
# Ak potrebuješ obmedziť, zmeň:
app.use(cors({ origin: 'http://localhost:5173' }))
```

## 📝 Next Steps

1. **Prečítaj si dokumentáciu:**
   - `README.md` - Kompletný prehľad
   - `API_DOCUMENTATION.md` - Detailná API referencia
   - `ARCHITECTURE.md` - Architektúra a design patterns

2. **Customizuj:**
   - Pridaj vlastné study programs v `src/services/jobFitService.js`
   - Rozšír skill keywords v `src/utils/textParser.js`
   - Pridaj vlastné recommended resources

3. **Priprav sa na produkciu:**
   - Pripoj databázu (MongoDB/PostgreSQL)
   - Pridaj autentifikáciu
   - Nasaď na Railway/Render/Vercel

4. **Integruj LLM:**
   - Pridaj OpenAI API kľúč do `.env`
   - Implementuj LLM service layer
   - Enhance analýzu s AI insights

## 🎓 Learning Resources

- Express.js: https://expressjs.com/
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices
- REST API Design: https://restfulapi.net/

---

**Happy coding! 🚀**
