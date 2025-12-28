import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import CaseList from './pages/CaseList';
import CaseEditor from './pages/CaseEditor';
import Migration from './pages/Migration';
import TestResultView from './pages/TestResultView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cases" replace />} />
        <Route path="/cases" element={<CaseList />} />
        <Route path="/cases/:id" element={<CaseEditor />} />
        <Route path="/edit/:id" element={<CaseEditor />} />
        <Route path="/new" element={<CaseEditor />} />
        <Route path="/migration" element={<Migration />} />
        <Route path="/test-result" element={<TestResultView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
