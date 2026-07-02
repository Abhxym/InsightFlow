# API Documentation

## Base URL
`http://localhost:5001/api`

## Authentication

All endpoints (except auth endpoints) require a valid JWT passed in the `Authorization` header.
`Authorization: Bearer <your_token>`

## Endpoints

### 1. `POST /auth/login`
Authenticates a user and returns a JWT.

### 2. `POST /surveys`
Creates a new survey with an array of questions.

### 3. `GET /surveys`
Fetches all surveys created by the authenticated user.

### 4. `POST /surveys/:id/responses`
Submits a response to a survey. Includes execution of Python AI service for text insights.
**Body**:
```json
{
  "answers": [
    { "question_id": 1, "answer_data": "Yes" },
    { "question_id": 2, "answer_data": "The price was too high." }
  ]
}
```

### 5. `GET /surveys/:id/analytics`
Fetches the aggregated BI analytics for a survey, including KPIs, Chart data, and AI insights.

### 6. `GET /surveys/:id/analytics/export`
Downloads all raw responses for a survey as a CSV file.
