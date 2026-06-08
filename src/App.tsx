import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import PurchaseOrders from './pages/PurchaseOrders';
import Delivery from './pages/Delivery';
import Scorecard from './pages/Scorecard';
import AIRisk from './pages/AIRisk';
import { seedData } from './lib/data';

const pages: Record<string, React.FC> = {
  dashboard: Dashboard,
  vendors: Vendors,
  'purchase-orders': PurchaseOrders,
  delivery: Delivery,
  scorecard: Scorecard,
  'ai-risk': AIRisk,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    try {
      seedData();
    } catch (e) {
      console.error('seedData failed:', e);
    }
  }, []);

  const Page = pages[currentPage] || Dashboard;

  return (
    <div className="min-h-screen bg-navy-900">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="pt-12 md:pt-0 md:ml-[220px] transition-[margin] duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Page />
        </div>
      </main>
    </div>
  );
}
