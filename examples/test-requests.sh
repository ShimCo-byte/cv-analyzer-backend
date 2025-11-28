#!/bin/bash

# Test CV Analyzer Backend API
# Uistite sa, že server beží na http://localhost:3000

BASE_URL="http://localhost:3000/api"

echo "=================================="
echo "CV Analyzer Backend - API Tests"
echo "=================================="
echo ""

# 1. Health Check
echo "1. Testing Health Check..."
curl -s ${BASE_URL}/health | jq .
echo -e "\n"

# 2. Get Study Programs
echo "2. Getting Available Study Programs..."
curl -s ${BASE_URL}/study-programs | jq .
echo -e "\n"

# 3. Upload Resume (Text)
echo "3. Uploading Resume (Text)..."
UPLOAD_RESPONSE=$(curl -s -X POST ${BASE_URL}/upload-resume \
  -H "Content-Type: application/json" \
  -d '{
    "text": "John Doe\nSoftware Engineer\n\nSkills:\nJavaScript, React, Node.js, Python, SQL, Git, Docker\n\nExperience:\nSenior Software Engineer at Google\n2021-Present\nDeveloped web applications using React and Node.js\n\nEducation:\nBachelor of Science in Computer Science\nStanford University, 2018\n\nCertifications:\nAWS Certified Developer, 2022"
  }')

echo $UPLOAD_RESPONSE | jq .
echo -e "\n"

# Extract resumeData from response
RESUME_DATA=$(echo $UPLOAD_RESPONSE | jq -c '.data')

# 4. Analyze Job Fit (Web Development)
echo "4. Analyzing Job Fit (Web Development Program)..."
curl -s -X POST ${BASE_URL}/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d "{
    \"resumeData\": ${RESUME_DATA},
    \"studyProgram\": \"web-development\"
  }" | jq .
echo -e "\n"

# 5. Analyze Job Fit (Job Description)
echo "5. Analyzing Job Fit (Custom Job Description)..."
curl -s -X POST ${BASE_URL}/analyze-job-fit \
  -H "Content-Type: application/json" \
  -d "{
    \"resumeData\": ${RESUME_DATA},
    \"jobDescription\": \"We are looking for a Senior Full-Stack Developer with experience in React, Node.js, TypeScript, MongoDB, and AWS. Must have 3+ years of experience and knowledge of microservices architecture.\"
  }" | jq .
echo -e "\n"

echo "=================================="
echo "All tests completed!"
echo "=================================="
