import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import PurchaseOrders from './pages/PurchaseOrders';
import Delivery from './pages/Delivery';
import Scorecard from './pages/Scorecard';
import AIRisk from './pages/AIRisk';
import { seedData } from './lib/data';
import { RefreshContext } from './lib/RefreshContext';
import { ThemeContext } from './lib/ThemeContext';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    seedData().catch((e) => console.error('seedData failed:', e));
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const navigate = setCurrentPage;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <RefreshContext.Provider value={{ refreshKey, triggerRefresh }}>
        <div className="min-h-screen bg-navy-900">
          <Sidebar currentPage={currentPage} onNavigate={navigate} />
          <main className="main-content md:ml-[220px] transition-[margin] duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
              {currentPage === 'dashboard' && <Dashboard />}
              {currentPage === 'vendors' && <Vendors />}
              {currentPage === 'purchase-orders' && <PurchaseOrders />}
              {currentPage === 'delivery' && <Delivery onNavigate={navigate} />}
              {currentPage === 'scorecard' && <Scorecard />}
              {currentPage === 'ai-risk' && <AIRisk />}
            </div>
          </main>
        </div>
      </RefreshContext.Provider>
    </ThemeContext.Provider>
  );
}
