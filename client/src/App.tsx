import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import './App.css';

import Sidebar  from './components/Sidebar';
import Topbar   from './components/Topbar';
import { ToastProvider } from './components/ToastContext';

import Overview     from './pages/Overview';
import FeedbackLoop from './pages/FeedbackLoop';
import TeamRules    from './pages/TeamRules';
import Billing      from './pages/Billing';
import AuditLogs    from './pages/AuditLogs';

import { fetchHealth } from './api/client';

function App() {
  const [health, setHealth]         = useState<{ ok: boolean; database: string; redis: string } | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [spinning, setSpinning]     = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      setHealth({
        ok:       data.status === 'ok',
        database: data.services.database,
        redis:    data.services.redis,
      });
    } catch {
      setHealth({ ok: false, database: 'error', redis: 'error' });
    }
    setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleRefresh = async () => {
    setSpinning(true);
    await checkHealth();
    setTimeout(() => setSpinning(false), 800);
  };

  return (
    <ToastProvider>
      <BrowserRouter>
        <div style={{ minHeight: '100vh', width: '100%' }}>
          <Sidebar onRefresh={handleRefresh} spinning={spinning} />

          <div className="main-content">
            <Topbar health={health} lastUpdated={lastUpdated} />

            <Routes>
              <Route path="/"         element={<Overview />} />
              <Route path="/feedback" element={<FeedbackLoop />} />
              <Route path="/rules"    element={<TeamRules />} />
              <Route path="/billing"  element={<Billing />} />
              <Route path="/audit"    element={<AuditLogs />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
