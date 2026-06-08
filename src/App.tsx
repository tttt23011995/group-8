import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import PurchaseOrders from './pages/PurchaseOrders';
import Delivery from './pages/Delivery';
import Scorecard from './pages/Scorecard';
import AIRisk from './pages/AIRisk';
import { seedData } from './lib/data';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    seedData().catch((e) => console.error('seedData failed:', e));
  }, []);

  const navigate = setCurrentPage;

  return (
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
  );
}
