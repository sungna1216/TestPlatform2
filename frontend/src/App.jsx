import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CaseList from './pages/CaseList';
import CaseEditor from './pages/CaseEditor';
import Migration from './pages/Migration';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cases" replace />} />
        <Route path="/cases" element={<CaseList />} />
        <Route path="/edit/:id" element={<CaseEditor />} />
        <Route path="/new" element={<CaseEditor />} />
        <Route path="/migration" element={<Migration />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
