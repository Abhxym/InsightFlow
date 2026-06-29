import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ProtectedRoutes from './components/ProtectedRoutes';

import SurveyBuilder from './pages/SurveyBuilder';
import TakeSurvey from './pages/TakeSurvey';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route element={<ProtectedRoutes />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/surveys/create" element={<SurveyBuilder />} />
          <Route path="/surveys/:id" element={<TakeSurvey />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
