# InsightFlow 🚀

> **A full-stack, enterprise-grade Survey Analytics Platform and Business Intelligence tool inspired by Qualtrics.**

InsightFlow enables organizations to dynamically build complex surveys with logic branching, distribute them securely, and analyze the resulting data using a powerful real-time Business Intelligence (BI) dashboard enhanced by Artificial Intelligence.

## 🌟 Key Features

- **Dynamic Survey Builder**: Build surveys with 9 different question types (Short text, Long text, Radio, Checkbox, Dropdown, Rating, Number, Email, Date).
- **Advanced Skip/Branch Logic**: Dynamically show or hide questions based on a user's previous answers.
- **Robust Validation Engine**: Enforce minimum/maximum constraints and required fields before submission.
- **AI Text Insights**: A Python microservice analyzes free-text responses to automatically extract Sentiment (Positive/Negative/Neutral), Topics, and Keywords.
- **Business Intelligence Dashboard**: Beautiful, real-time charts (Pie, Bar, Line) and KPIs (NPS, Avg Rating) built with Recharts.
- **Data Export**: One-click CSV export of raw, mapped survey data.
- **Secure Architecture**: JWT-based authentication, protected routes, and database-level duplicate submission prevention.

## 🏗️ Architecture

InsightFlow utilizes a modern three-tier architecture:
1. **Frontend**: React, Vite, React Router, Recharts, Axios, Vanilla CSS (Glassmorphism design).
2. **Backend**: Node.js, Express, json2csv.
3. **Database**: MySQL (using relational constraints and JSON column data stores).
4. **AI Microservice**: Python, Flask (Natural Language Processing).

## 🚧 Status

**Currently under development.**

## 📸 Screenshots

*(Add screenshots of the Survey Builder, Execution Engine, and BI Dashboard here)*

## 🔮 Future Work
- Implement OAuth2 / Single Sign-On (SSO).
- Expand the Python AI service to utilize large language models (LLMs) via OpenAI for deeper semantic topic modeling.
- Add survey distribution tracking via unique email links.
