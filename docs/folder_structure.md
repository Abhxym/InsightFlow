# Folder Structure

```
InsightFlow/
├── backend/                  # Node.js + Express backend
│   ├── config/               # Configuration files (DB, etc.)
│   ├── controllers/          # Route handlers
│   ├── middlewares/          # Express middlewares (auth, error handling)
│   ├── models/               # Database models/queries
│   ├── routes/               # API route definitions
│   ├── .env                  # Environment variables
│   └── server.js             # Entry point
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── assets/           # Images, fonts, etc.
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components (Login, Register, Dashboard)
│   │   ├── services/         # API calls (Axios)
│   │   ├── styles/           # Vanilla CSS styles
│   │   ├── App.jsx           # Main App component with routing
│   │   └── main.jsx          # Entry point
│   └── index.html
├── docs/                     # Documentation
│   ├── architecture.md
│   └── folder_structure.md
├── README.md
└── .gitignore
```
