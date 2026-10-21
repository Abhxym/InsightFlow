# InsightFlow

**A survey analytics platform where non-technical people ask questions about their data in plain English, and get answers they can check.**

Most survey tools stop at charts. The interesting part, what people actually *wrote*, ends up in a CSV that
someone has to read line by line, or in a SQL query that a business user can't write. InsightFlow tries to close
that gap: build a survey, collect answers, and then simply ask *"What are people unhappy about?"*.

It stores everything in MySQL behind a Node.js API, sends every open-ended answer through a Python NLP microservice
(FastAPI + Gemini) that scores sentiment and groups answers into themes, and puts a RAG agent on top
(Gemini embeddings + Pinecone) that answers questions **only** from the responses and **cites the exact ones it used**.

![InsightFlow dashboard: responses, average rating, sentiment and activity across all surveys](docs/img/dashboard.png)
*The home dashboard for a demo account with 40 responses. Every number is computed live from MySQL; the sentiment
donut comes from the NLP service, which scored each open-ended answer as it arrived.*

## Questions it answers

1. Can a business user get a reliable answer about open-ended feedback without reading every response or writing SQL?
2. Can those answers stay **traceable**, so a wrong answer can be spotted instead of trusted blindly?

## Architecture (short version)

```
                         ┌─────────────────────────── Python AI service (FastAPI :5001) ───────────────────────────┐
 React + Vite  ──REST──> │  Node.js / Express API (:5000) ──> /api/analyze        sentiment (-1..1) + topic       │
 (:5173)                 │        │  JWT auth                 /api/analytics/full  themes · NPS/CSAT · anomalies   │
                         │        │                           /api/analytics/ask   RAG: embed → Pinecone → Gemini  │
                         │        ▼                                                                                │
                         │      MySQL (surveys, questions, responses, ai_insight JSON)                              │
                         └──────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **On submit**, the API stores the answers and sends each open-ended answer to `/api/analyze`; the sentiment
   score, topic and keywords are saved next to the answer as JSON.
2. **On the Insights page**, the API collects all answers and calls `/api/analytics/full`, which groups the text
   into themes, computes NPS / CSAT / distribution statistics, flags anomalies (z-score) and writes an executive summary.
3. **On a question**, `/api/analytics/ask` embeds the answers and the question, retrieves the closest answers from
   Pinecone, and asks Gemini to answer using only those, citing them as `[1]`, `[2]` and so on.

## Stack

| Layer        | Tool |
|--------------|------|
| Frontend     | React 19, Vite, React Router, Recharts, lucide icons |
| API          | Node.js, Express 5, JWT auth, bcrypt |
| Database     | MySQL 8 (`mysql2`), JSON columns for AI insights and question logic |
| AI service   | Python, FastAPI, Uvicorn, Pydantic |
| LLM          | Google Gemini (`gemini-flash-lite-latest` by default, configurable) |
| Embeddings   | Gemini `gemini-embedding-001`, 768 dimensions |
| Vector store | Pinecone (serverless, cosine) |

## What it does

- **Survey builder:** 9 question types (short/long text, single/multiple choice, dropdown, rating, number,
  email, date), required fields and number ranges. Ratings are either **0–10** (feeds NPS) or **1–5 stars**.
  **Branch logic** takes any number of conditions per question, combined with *all* or *any*
  (is / is not / contains / more than / less than / is answered). Rules follow their questions when you reorder or
  delete, and a hidden question can't reveal its own follow-ups. A checklist nudges you to add an open question and a
  rating so the AI insights have something to work with.
- **Sentiment on every answer:** Gemini scores each open-ended answer from -1 to 1 and labels it. All open answers of
  one submission are scored in **a single call**. If Gemini is unavailable, a lexicon fallback with negation handling
  takes over ("not good" is negative), so submissions never fail.
- **Themes from real assignments, for every answer:** Gemini names 3–5 themes on the first 300 answers *and assigns
  each one*; any further answers are assigned to the same themes in batches of 300. Counts and percentages are computed
  in code from those assignments, not estimated by the model, and every quote shown is a verbatim answer.
- **Statistics:** mean, median, quartiles, spread, NPS (promoters / passives / detractors), CSAT and the score distribution,
  plus z-score anomaly detection on scores and daily volume. 1–5 answers are normalised to 0–10 for averages and CSAT;
  only 0–10 questions count toward NPS, and "number" questions (like age) are never mixed into ratings.
- **Built for the free tier:** every Gemini call goes through a client-side rate limiter (15 calls/min, 100 embedded
  texts/min) and a 429 is retried once after the delay Google asks for. Embeddings, themes and reports are cached, and each
  survey keeps a **persistent Pinecone namespace** where only new answers are embedded.
- **Ask your data:** a chat where you type a question. The answer cites its sources, the cited answers are listed
  under it, a confidence level comes from retrieval similarity, and if the data can't answer the question it says so.
- **Dashboards:** a cross-survey home page (14-day activity, overall mood, most-answered surveys) and a per-survey
  page with Overview, AI insights and Ask tabs. CSV export.

## Screenshots

| Survey insights | AI insights |
|---|---|
| ![Survey overview: KPIs, response trend, NPS ring, score distribution](docs/img/analytics.png) | ![AI insights: executive summary, sentiment, themes with quotes](docs/img/ai-insights.png) |
| KPIs, responses over time, NPS split into promoters/passives/detractors, score distribution and a per-question breakdown. | The AI-written summary, sentiment split, themes with their share of answers, and the most typical answer in each theme. |

| Ask your data | Survey builder |
|---|---|
| ![Ask your data: a cited answer with its source responses](docs/img/ask.png) | ![Survey builder with question palette and publish checklist](docs/img/builder.png) |
| Questions in plain English. Each answer lists the responses it was built from, so you can check it. | One click per question type, branch logic per question and a publish checklist. |

| Taking a survey | Login | Mobile |
|---|---|---|
| ![Survey form with progress bar and 0-10 rating](docs/img/form.png) | ![Login page](docs/img/login.png) | ![Mobile dashboard](docs/img/mobile.png) |

## Results at a glance

Measured on the demo data (40 responses) with a free-tier Gemini key.

| Question | Result |
|---|---|
| Does sentiment understand negation? | "The delivery was not good at all" → **-0.8, Negative** (the previous keyword matcher called it Positive) |
| Are theme percentages real? | Yes. Every answer is assigned to exactly one theme, and counts come from those assignments; invalid or duplicate ids from the model are dropped and anything unassigned goes to "Other" |
| Does the agent stay grounded? | Asked *"What is our Q3 revenue?"*, it answered that the survey has no revenue data and named what data would be needed |
| Are answers traceable? | Every answer comes with the retrieved responses, numbered to match the `[n]` citations |
| Latency (free tier) | a submission ≈ 2–7 s, full survey analysis ≈ 10–25 s (themes + report, cached afterwards), a cited answer ≈ 5–20 s |
| Free-tier quota | Seeding 40 responses: 1 Gemini call instead of 40. Analysing a survey and asking two questions: no 429s, no fallbacks |
| Does retrieval scale? | Answers are embedded once per survey and kept in Pinecone; a later question only embeds the question itself |
| Mixed rating scales | 2 stars on a 1–5 question reads as 4/10, and a survey with no 0–10 question shows no NPS instead of a misleading −100 |

## Running it

You need Node.js 18+, Python 3.10+, MySQL 8, a [Gemini API key](https://ai.google.dev/) and a
[Pinecone API key](https://www.pinecone.io/) (free tiers work for both).

```bash
# 1. database
mysql -u root -p < backend/schema.sql

# 2. API  (create backend/.env first, see below)
cd backend && npm install && npm start            # http://localhost:5000

# 3. AI service  (create ai_service/.env first, see below)
cd ai_service
python -m venv venv && venv\Scripts\activate      # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python app.py                                     # http://localhost:5001

# 4. frontend
cd frontend && npm install && npm run dev         # http://localhost:5173

# 5. optional: demo account with a survey and 40 responses over the last two weeks
cd backend && npm run seed                        # log in as demo@insightflow.test / demo1234
```

**Tests** (no API keys or database needed; Gemini and Pinecone are mocked). They also run on every push via GitHub Actions.

```bash
cd ai_service && pip install -r requirements-dev.txt && python -m pytest -q   # 33 tests
cd backend && npm test                                                        # rating scales, NPS
cd frontend && npm test                                                       # branch logic
```

**`backend/.env`** (copy `backend/.env.example`)

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=insightflow
JWT_SECRET=a_long_random_string
```

**`ai_service/.env`** (copy `ai_service/.env.example`)

```env
GEMINI_API_KEY=your_gemini_key
PINECONE_API_KEY=your_pinecone_key
# optional
PINECONE_INDEX_NAME=insightflow-rag
GEMINI_CHAT_MODEL=gemini-flash-lite-latest
GEMINI_EMBED_MODEL=models/gemini-embedding-001
GEMINI_RPM=14            # generate calls per minute (raise on a paid tier)
GEMINI_EMBED_TPM=95      # embedded texts per minute
THEME_BATCH_SIZE=300     # answers per theme-assignment call
```

| Service      | URL |
|--------------|-----|
| **App**      | **http://localhost:5173** |
| API          | http://localhost:5000 |
| AI service   | http://localhost:5001 (interactive docs at `/docs`) |

## API

| Method | Endpoint | What it does |
|---|---|---|
| `POST` | `/api/auth/register`, `/api/auth/login` | create an account / get a JWT |
| `GET`  | `/api/surveys` | your surveys, with response and question counts |
| `GET`  | `/api/surveys/overview` | cross-survey totals, 14-day trend and sentiment for the dashboard |
| `POST` | `/api/surveys` | create a survey with its questions |
| `GET` / `DELETE` | `/api/surveys/:id` | one survey with its questions / delete it |
| `POST` | `/api/surveys/:id/responses` | submit answers (text answers are analysed on the way in) |
| `GET`  | `/api/surveys/:id/analytics` | KPIs, charts and the full AI analysis |
| `POST` | `/api/surveys/:id/analytics/ask` | ask a question, get a cited answer |
| `GET`  | `/api/surveys/:id/analytics/export` | CSV export |

AI service: `POST /api/analyze` (one answer), `POST /api/analyze/batch` (all answers of a submission),
`POST /api/analytics/full` (whole survey), `POST /api/analytics/ask` (RAG), `DELETE /api/index/:surveyId` (drop a survey's vectors).

## Project structure

```
backend/      Express API: routes, controllers, MySQL models, schema.sql, scripts/seedDemo.js,
              utils/ratings.js (scales, NPS), tests/
ai_service/   FastAPI app + engine/ + tests/
              ├─ gemini.py      Gemini client: rate limiter, retry on 429, model config
              ├─ semantic.py    batch sentiment, theme assignment, embeddings, per-survey Pinecone index
              ├─ rag.py         "Ask your data": retrieval + grounded, cited answers
              ├─ report.py      executive summary
              ├─ statistics.py  NPS, CSAT, descriptive stats, distribution
              └─ anomaly.py     z-score anomalies on scores and daily volume
frontend/     React app: pages/ (Dashboard, Analytics, SurveyBuilder, TakeSurvey, auth),
              components/ (AppLayout, AskYourData, QuestionCard, ui.jsx design system),
              utils/logic.js (branch logic) + logic.test.js
docs/img/     screenshots
.github/      CI: runs all three test suites and the frontend build
```

## Project status

**Working end to end:** build → collect → analyse → ask, verified against a live Gemini and Pinecone setup.

**Limits, honestly:**
- On the free Gemini tier a large survey is slow the first time (themes for 3,000 answers is ~10 calls, so about a
  minute at 15 calls/min). Results are cached afterwards. If the *daily* quota runs out, sentiment uses the lexicon
  fallback and answers use templates, still with real numbers but less fluent.
- Caches live in the AI service's memory, so they reset when it restarts (the Pinecone index does not).
- Ratings answered before scales existed are treated as 0–10.
- The tests mock Gemini and Pinecone; the live integration was checked by hand, not in CI.
