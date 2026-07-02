# Deployment Guide

This guide covers deploying the InsightFlow multi-service architecture.

## Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- MySQL Server

## 1. Database Setup
Ensure MySQL is running on port `3306`.
Create the `insightflow` database. Run the migration script to scaffold tables:
```bash
cd backend
node migrate.js
```

## 2. Python AI Service
Start the AI Natural Language Processing microservice.
```bash
cd ai_service
pip install -r requirements.txt
python app.py
```
*Runs on http://localhost:5000*

## 3. Node.js Backend
Start the core orchestration API.
```bash
cd backend
npm install
npm run dev
```
*Runs on http://localhost:5001*

## 4. React Frontend
Start the client application.
```bash
cd frontend
npm install
npm run dev
```
*Runs on http://localhost:5173*
