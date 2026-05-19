import React, { useState, useEffect } from 'react';
import { Store, ShoppingCart, LayoutDashboard, Settings, Package, History, LogOut, Menu, X, Tag, Truck, FileText, IndianRupee, User, MapPin, Phone, Hash, Check, Lock, Edit2, Sparkles, CreditCard, Smartphone, Globe, RefreshCw, AlertCircle } from 'lucide-react';
import Login from './Login';
import BillingPOS from './BillingPOS';
import DailyRates from './DailyRates';
import StockInward from './StockInward';
import SupplierPayments from './SupplierPayments';
import Reports from './Reports';
import DailyLogs from './DailyLogs';
import DeveloperCRM from './DeveloperCRM';
import { ClipboardList } from 'lucide-react';
import { initialProducts, shopDetails } from './data';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard';
  });
  const [products, setProducts] = useState(initialProducts);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [shopInfo, setShopInfo] = useState(() => {
    const saved = localStorage.getItem('shopInfo');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.customerUniqueId === 'MC-89324') {
          parsed.customerUniqueId = 'CV-00001';
          localStorage.setItem('shopInfo', JSON.stringify(parsed));
        }
        return parsed;
      } catch (err) {
        console.error("Error parsing shopInfo:", err);
      }
    }
    return {
      customerUniqueId: 'CV-00001',
      shopName: shopDetails.name,
      proprietorName: 'Mohammad Farooq Momin',
      address: shopDetails.address,
      phone: shopDetails.phone,
      gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
    };
  });

  const [shopStatus, setShopStatus] = useState(() => {
    const savedInfo = localStorage.getItem('shopInfo');
    let shopId = 'CV-00001';
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        shopId = parsed.customerUniqueId === 'MC-89324' ? 'CV-00001' : parsed.customerUniqueId;
      } catch (err) {
        console.error("Error parsing savedInfo for shopStatus:", err);
      }
    }
    const savedShops = localStorage.getItem('crm_shops');
    if (savedShops) {
      try {
        const shopsList = JSON.parse(savedShops);
        const activeShop = shopsList.find(s => s.customerUniqueId === shopId);
        if (activeShop) {
          if (activeShop.customerUniqueId === 'CV-00001' && activeShop.status !== 'Active') {
            activeShop.status = 'Active';
            activeShop.deactivatedAt = '';
            const updated = shopsList.map(s => s.customerUniqueId === 'CV-00001' ? { ...s, status: 'Active', deactivatedAt: '' } : s);
            localStorage.setItem('crm_shops', JSON.stringify(updated));
          }
          return activeShop;
        }
      } catch (e) {
        console.error("Error healing shopStatus from crm_shops:", e);
      }
    }
    return {
      customerUniqueId: 'CV-00001',
      status: 'Active',
      kycStatus: 'Verified',
      registeredAt: '2026-05-15'
    };
  });

  const getTrialDetails = () => {
    if (!shopStatus || shopStatus.status !== 'Trial') return null;
    const regDate = new Date(shopStatus.registeredAt || '2026-05-15');
    const today = new Date();
    const elapsedMs = today - regDate;
    const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(0, 30 - elapsedDays);
    const isExpired = remainingDays <= 0;
    return { remainingDays, isExpired };
  };

  const trialDetails = getTrialDetails();
  const isSuspended = shopStatus && (shopStatus.status === 'Suspended' || shopStatus.status === 'Deactive');

  const [dashboardStats, setDashboardStats] = useState({
    stockAvailable: '0.00',
    averageRate: '0.00',
    totalBirds: 0,
    totalValue: 0,
    recentInwards: []
  });
  const [todaySales, setTodaySales] = useState(0);

  useEffect(() => {
    if (!user) return;

    let stockList = [];
    let salesList = [];
    let mortalityList = [];

    const computeStats = () => {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

      // 1. Stock Inward calculations
      let totalStockInward = 0;
      let totalValueInward = 0;
      let totalBirdsInward = 0;
      let recentInwards = [];

      stockList.forEach(data => {
        const weight = data.weight || 0;
        const rate = data.rate || 0;
        const birds = data.numberOfBirds || 0;

        totalStockInward += weight;
        totalValueInward += weight * rate;
        totalBirdsInward += birds;

        let itemDate = null;
        if (data.timestamp) {
          if (typeof data.timestamp.toDate === 'function') {
            itemDate = data.timestamp.toDate();
          } else if (data.timestamp instanceof Date) {
            itemDate = data.timestamp;
          } else {
            itemDate = new Date(data.timestamp);
          }
        }

        if (itemDate && itemDate >= todayMidnight) {
          recentInwards.push({
            id: data.id,
            supplier: data.supplierName || 'Unknown',
            rate: rate,
            weight: weight,
            numberOfBirds: birds,
            chickenType: data.chickenType || 'BR',
            vehicleNo: data.vehicleNo || 'N/A',
            time: data.timestamp
          });
        }
      });

      // 2. Sales calculations
      let totalWeightSold = 0;
      let salesSumToday = 0;

      salesList.forEach(data => {
        // All-time sales weight
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(item => {
            if (!item.productName.toLowerCase().includes('tray') && !item.productName.toLowerCase().includes('masala')) {
              totalWeightSold += (item.quantity || 0);
            }
          });
        }

        // Today's sales sum
        let saleDate = null;
        if (data.timestamp) {
          if (typeof data.timestamp.toDate === 'function') {
            saleDate = data.timestamp.toDate();
          } else if (data.timestamp instanceof Date) {
            saleDate = data.timestamp;
          } else {
            saleDate = new Date(data.timestamp);
          }
        }

        if (saleDate && saleDate >= todayMidnight) {
          salesSumToday += (data.total || 0);
        }
      });

      // 3. Mortality calculations
      let totalWeightLoss = 0;
      mortalityList.forEach(data => {
        totalWeightLoss += (data.weightLoss || 0);
      });

      const avgRate = totalStockInward > 0 ? (totalValueInward / totalStockInward) : 0;
      const actualStockAvailable = Math.max(0, totalStockInward - totalWeightSold - totalWeightLoss);

      setDashboardStats({
        stockAvailable: actualStockAvailable.toFixed(2),
        averageRate: avgRate.toFixed(2),
        totalBirds: totalBirdsInward,
        totalValue: totalValueInward,
        recentInwards: recentInwards
      });
      setTodaySales(salesSumToday);
    };

    const unsubStock = onSnapshot(collection(db, "stock_inwards"), (snapshot) => {
      stockList = [];
      snapshot.forEach(doc => stockList.push({ id: doc.id, ...doc.data() }));
      computeStats();
    });

    const unsubSales = onSnapshot(collection(db, "sales"), (snapshot) => {
      salesList = [];
      snapshot.forEach(doc => salesList.push({ id: doc.id, ...doc.data() }));
      computeStats();
    });

    const unsubMortality = onSnapshot(collection(db, "mortality"), (snapshot) => {
      mortalityList = [];
      snapshot.forEach(doc => mortalityList.push({ id: doc.id, ...doc.data() }));
      computeStats();
    });

    return () => {
      unsubStock();
      unsubSales();
      unsubMortality();
    };
  }, [user]);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'Retailer' && user.username) {
      const mobileInput = user.username.trim().replace(/\D/g, '');
      const savedShops = localStorage.getItem('crm_shops');
      if (savedShops) {
        try {
          const shopsList = JSON.parse(savedShops);
          const matchedShop = shopsList.find(s => {
            const cleanShopPhone = s.phone.replace(/\D/g, '');
            return cleanShopPhone.endsWith(mobileInput) || mobileInput.endsWith(cleanShopPhone);
          });
          if (matchedShop) {
            setShopStatus(matchedShop);
            const newShopDetails = {
              customerUniqueId: matchedShop.customerUniqueId,
              shopName: matchedShop.shopName,
              proprietorName: matchedShop.proprietorName,
              address: matchedShop.address,
              phone: matchedShop.phone,
              gstin: matchedShop.gstin || '27AAAAA1111A1Z1'
            };
            setShopInfo(newShopDetails);
            localStorage.setItem('shopInfo', JSON.stringify(newShopDetails));
          }
        } catch (e) {
          console.error("Error setting dynamic shop context by phone:", e);
        }
      }
    }
  }, [user]);

  if (!user) {
    return <Login onLogin={(userData) => setUser(userData)} />;
  }

  if (user && user.role === 'developer_admin') {
    return <DeveloperCRM user={user} onLogout={() => setUser(null)} />;
  }

  if (user && user.role !== 'developer_admin' && isSuspended) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-md rounded-3xl p-8 border border-red-500/20 text-center shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="h-16 w-16 bg-red-500/10 text-red-550 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20 shadow-lg shadow-red-500/10">
            <Lock className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Portal Deactivated</h2>
          <p className="text-slate-400 mt-3 text-sm leading-relaxed">
            Your Chicken Vypar store profile has been <span className="text-red-400 font-bold">suspended or deactivated</span>. All portal activity is currently disabled.
          </p>
          <div className="mt-8 p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-xs font-mono text-slate-500 text-left space-y-1">
            <div>Customer ID: {shopStatus.customerUniqueId}</div>
            <div>Store Name: {shopInfo.shopName}</div>
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <a href="mailto:support@featherwhitesolution.com" className="w-full py-3.5 bg-gradient-to-r from-red-650 to-rose-650 hover:from-red-700 hover:to-rose-705 text-white font-bold text-center rounded-2xl shadow-lg shadow-red-500/10 transition-all text-sm block">
              Contact Admin Support
            </a>
            <button onClick={() => setUser(null)} className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-all text-xs cursor-pointer">
              Exit to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && user.role !== 'developer_admin' && trialDetails && trialDetails.isExpired) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-md rounded-3xl p-8 border border-amber-500/20 text-center shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="h-16 w-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">Trial Period Expired</h2>
          <p className="text-slate-400 mt-3 text-sm leading-relaxed">
            Your 30-day free trial period for Chicken Vypar is <span className="text-amber-400 font-bold">over</span>. Please subscribe to get started and unlock your shop dashboard.
          </p>
          <div className="mt-8 p-4 bg-slate-950/50 rounded-2xl border border-slate-800 text-xs font-mono text-slate-500 text-left space-y-1">
            <div>Customer ID: {shopStatus.customerUniqueId}</div>
            <div>Registered On: {shopStatus.registeredAt}</div>
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <a href="https://chickenvypar.netlify.app/subscribe" className="w-full py-3.5 bg-gradient-to-r from-amber-550 to-orange-650 hover:from-amber-600 hover:to-orange-700 text-white text-center font-bold rounded-2xl shadow-lg shadow-amber-500/10 transition-all text-sm block">
              Subscribe to Get Started
            </a>
            <button onClick={() => setUser(null)} className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-2xl transition-all text-xs cursor-pointer">
              Exit to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300 print:bg-white print:text-black">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden shadow-md shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover bg-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-gradient">Chicken Vypar</h1>
        </div>
        <button onClick={toggleMobileMenu} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-20 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 glass-panel border-r border-slate-200 dark:border-slate-800 z-30 flex flex-col transition-transform duration-300 ease-in-out print:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg shadow-primary-500/30 shrink-0 border-2 border-white/50">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover bg-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gradient">Chicken Vypar</h1>

          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Tag />} label="Daily Rates" active={activeTab === 'rates'} onClick={() => { setActiveTab('rates'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<ShoppingCart />} label="Billing POS" active={activeTab === 'pos'} onClick={() => { setActiveTab('pos'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Package />} label="Stock Inward" active={activeTab === 'stock'} onClick={() => { setActiveTab('stock'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<IndianRupee />} label="Payments" active={activeTab === 'payments'} onClick={() => { setActiveTab('payments'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<FileText />} label="Reports" active={activeTab === 'reports'} onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<ClipboardList />} label="Day Summary" active={activeTab === 'workers'} onClick={() => { setActiveTab('workers'); setIsMobileMenuOpen(false); }} />
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <NavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<LogOut />} label="Logout" active={false} onClick={() => setUser(null)} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-8 print:m-0 print:p-0">
        {trialDetails && !trialDetails.isExpired && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden animate-pulse">
            <div className="flex items-center gap-3 text-left">
              <div className="h-9 w-9 bg-amber-500/10 text-amber-650 dark:text-amber-400 rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                ⚡
              </div>
              <div>
                <span className="block text-sm font-extrabold text-slate-800 dark:text-white">Active Trial Period (30 Days)</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">Your trial is active. You have <strong className="text-amber-600 dark:text-amber-400">{trialDetails.remainingDays} days remaining</strong> out of your 30-day free trial.</span>
              </div>
            </div>
            <a href="https://chickenvypar.netlify.app/subscribe" className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-md shrink-0 transition-all transform hover:scale-105 active:scale-95 text-center self-start sm:self-auto block">
              Subscribe to Reactivate
            </a>
          </div>
        )}

        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4 print:hidden">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back, {shopInfo.shopName}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Here's what's happening at your shop today.</p>
          </div>
          <div className="flex items-center gap-4 self-start md:self-auto">
            <div className="bg-white dark:bg-slate-800 rounded-full px-4 py-2 shadow-sm border border-slate-200 dark:border-slate-700 text-sm font-medium">
              15 May, 2026
            </div>
            <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center border border-primary-200 dark:border-primary-800 shrink-0">
              <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <>
            {/* Dashboard Content */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
              <StatCard title="Today's Sales" value={`₹ ${todaySales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} trend="Live" isPositive={true} />
              <StatCard title="Total Birds" value={dashboardStats.totalBirds} trend="Inward" isPositive={true} />
              <StatCard title="Stock Available" value={`${dashboardStats.stockAvailable} kg`} trend="Live" isPositive={true} />
              <StatCard
                title="Avg. Purchase Rate"
                value={`₹ ${dashboardStats.averageRate}`}
                trend="Per kg"
                isPositive={true}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Quick Actions & Live Market Rates Card */}
              <div className="lg:col-span-2 glass-panel rounded-3xl p-6 md:p-8 flex flex-col justify-between min-h-[300px] md:min-h-[400px]">
                <div className="text-left">
                  <h3 className="text-xl font-extrabold mb-2 tracking-tight text-slate-850 dark:text-white">Quick Actions</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Frequently used tools to manage your chicken shop operations.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setActiveTab('pos')}
                      className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 hover:from-blue-500/15 hover:to-indigo-500/15 border border-blue-500/20 text-left transition-all group cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                      <ShoppingCart className="w-6 h-6 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="block font-bold text-slate-800 dark:text-white text-sm">New Billing POS</span>
                      <span className="block text-slate-500 text-[11px] mt-0.5">Start a fresh customer sale</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('stock')}
                      className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/15 hover:to-teal-500/15 border border-emerald-500/20 text-left transition-all group cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                      <Package className="w-6 h-6 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="block font-bold text-slate-800 dark:text-white text-sm">Stock Inward</span>
                      <span className="block text-slate-500 text-[11px] mt-0.5">Log new bird batch delivery</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('rates')}
                      className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15 border border-amber-500/20 text-left transition-all group cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                      <Tag className="w-6 h-6 text-amber-500 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="block font-bold text-slate-800 dark:text-white text-sm">Daily Rates</span>
                      <span className="block text-slate-500 text-[11px] mt-0.5">Update live bird prices</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('reports')}
                      className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/10 hover:from-rose-500/15 hover:to-pink-500/15 border border-rose-500/20 text-left transition-all group cursor-pointer hover:scale-[1.02] active:scale-95"
                    >
                      <FileText className="w-6 h-6 text-rose-500 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="block font-bold text-slate-800 dark:text-white text-sm">View Reports</span>
                      <span className="block text-slate-500 text-[11px] mt-0.5">Check detailed sales sheets</span>
                    </button>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">All Systems Operational</span>
                  </div>
                </div>
              </div>

              {/* Vertical Recent Suppliers List */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col h-[400px]">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 shrink-0">
                  <Truck className="w-5 h-5 text-primary-500" />
                  Recent Deliveries
                </h3>
                <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {dashboardStats.recentInwards.length > 0 ? (
                    dashboardStats.recentInwards.map((inward) => (
                      <div key={inward.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-primary-200 dark:hover:border-primary-900/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate pr-2">{inward.supplier}</span>
                          <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-xs font-bold px-2 py-1 rounded-md shrink-0">{inward.chickenType}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500 block text-xs">Weight</span>
                            <span className="font-medium">{inward.weight} kg</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs">Rate</span>
                            <span className="font-medium text-green-600 dark:text-green-400">₹{inward.rate}/kg</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs">Chickens</span>
                            <span className="font-medium">{inward.numberOfBirds}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-xs">Vehicle</span>
                            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{inward.vehicleNo}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                      No deliveries recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'pos' && (
          <BillingPOS products={products} />
        )}

        {activeTab === 'rates' && (
          <DailyRates products={products} setProducts={setProducts} />
        )}

        {activeTab === 'stock' && (
          <StockInward />
        )}

        {activeTab === 'payments' && (
          <SupplierPayments />
        )}

        {activeTab === 'reports' && (
          <Reports />
        )}

        {activeTab === 'workers' && (
          <DailyLogs />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel shopStatus={shopStatus} setShopStatus={setShopStatus} />
        )}
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-600/15'
        : 'text-slate-600 dark:text-slate-400 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white hover:font-bold hover:shadow-lg hover:shadow-blue-600/15'
        }`}
    >
      {React.cloneElement(icon, { className: 'w-5 h-5 shrink-0' })}
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({ title, value, trend, isPositive, subtext }) {
  return (
    <div className="glass-panel p-6 rounded-2xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between">
      <h4 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-2">{title}</h4>
      <div>
        <div className="flex items-end justify-between">
          <span className="text-2xl md:text-3xl font-bold truncate pr-2">{value}</span>
          {trend && (
            <span className={`text-xs md:text-sm font-medium px-2 py-1 rounded-md shrink-0 ${isPositive
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
              {trend}
            </span>
          )}
        </div>
        {subtext && (
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ shopStatus, setShopStatus }) {
  const [shopInfo, setShopInfo] = useState(() => {
    const saved = localStorage.getItem('shopInfo');
    if (saved) return JSON.parse(saved);
    return {
      customerUniqueId: 'CV-00001',
      shopName: shopDetails.name,
      proprietorName: 'Mohammad Farooq Momin',
      address: shopDetails.address,
      phone: shopDetails.phone,
      gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
    };
  });

  const [originalShopInfo, setOriginalShopInfo] = useState({ ...shopInfo });
  const [isEditing, setIsEditing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Razorpay simulation states
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(shopStatus?.subscriptionPlan || 'Monthly');
  const [paymentStep, setPaymentStep] = useState('plan'); // 'plan', 'method', 'processing', 'success'
  const [selectedMethod, setSelectedMethod] = useState(''); // 'upi', 'card', 'netbanking'
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const plans = [
    { id: 'Monthly', name: 'Monthly Plan', price: 500, period: '1 Month' },
    { id: 'Quarterly', name: 'Quarterly Plan', price: 1500, period: '3 Months' },
    { id: 'Half-Yearly', name: 'Half-Yearly Plan', price: 3000, period: '6 Months' },
    { id: 'Yearly', name: 'Yearly Plan', price: 6000, period: '1 Year' }
  ];

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('shopInfo', JSON.stringify(shopInfo));
    setOriginalShopInfo({ ...shopInfo });
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleCancel = () => {
    setShopInfo({ ...originalShopInfo });
    setIsEditing(false);
  };

  const calculateRenewalDate = (startDateStr, plan) => {
    if (!startDateStr) return 'N/A';
    const start = new Date(startDateStr);
    if (isNaN(start.getTime())) return 'N/A';
    
    const end = new Date(start);
    if (plan === 'Quarterly') {
      end.setMonth(end.getMonth() + 3);
    } else if (plan === 'Half-Yearly') {
      end.setMonth(end.getMonth() + 6);
    } else if (plan === 'Yearly') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    
    const day = String(end.getDate()).padStart(2, '0');
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const year = end.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleProceedToPay = () => {
    setPaymentError('');
    setPaymentStep('method');
  };

  const processSuccessPayment = (planId) => {
    setShowRazorpay(true);
    setPaymentStep('processing');
    setTimeout(() => {
      setPaymentStep('success');
      const todayStr = new Date().toISOString().split('T')[0];

      const updatedStatus = {
        ...shopStatus,
        status: 'Active',
        subscriptionPlan: planId,
        subscriptionStartedAt: todayStr,
        deactivatedAt: ''
      };
      setShopStatus(updatedStatus);

      const savedShops = localStorage.getItem('crm_shops');
      if (savedShops) {
        try {
          const shopsList = JSON.parse(savedShops);
          const updatedShopsList = shopsList.map(s => 
            s.customerUniqueId === shopInfo.customerUniqueId 
              ? { 
                  ...s, 
                  status: 'Active', 
                  subscriptionPlan: planId, 
                  subscriptionStartedAt: todayStr, 
                  deactivatedAt: '' 
                }
              : s
          );
          localStorage.setItem('crm_shops', JSON.stringify(updatedShopsList));
        } catch (e) {
          console.error("Error updating crm_shops after payment:", e);
        }
      }

      setTimeout(() => {
        setShowRazorpay(false);
        setPaymentStep('plan');
      }, 2500);
    }, 1500);
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    if (selectedMethod === 'upi' && !upiId.includes('@')) {
      setPaymentError('Please enter a valid UPI ID (e.g. user@okhdfcbank)');
      return;
    }
    if (selectedMethod === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        setPaymentError('Please enter a valid 16-digit card number');
        return;
      }
      if (!cardExpiry.includes('/')) {
        setPaymentError('Please enter expiry date (MM/YY)');
        return;
      }
      if (cardCvv.length < 3) {
        setPaymentError('Please enter a 3-digit CVV');
        return;
      }
    }
    setPaymentError('');
    processSuccessPayment(selectedPlan);
  };

  const selectedPlanPrice = plans.find(p => p.id === selectedPlan)?.price || 500;
  const hasChanges = shopInfo.phone !== originalShopInfo.phone || shopInfo.address !== originalShopInfo.address;

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-300 text-left pb-16">
      
      {/* Subscription Card */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-2xl relative overflow-hidden bg-white dark:bg-slate-900/50">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                <CreditCard className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Subscription & Billing</h3>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage your Chicken Vypar license, renew your plan, or view next renewal date.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Plan Status</span>
                <span className={`inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full mt-1 ${
                  shopStatus?.status === 'Active'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-900'
                    : shopStatus?.status === 'Trial'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-955/30 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-955/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900'
                }`}>
                  {shopStatus?.status || 'Trial'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Plan</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white block mt-1">
                  {shopStatus?.subscriptionPlan || 'Monthly'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Started On</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white block mt-1">
                  {formatDate(shopStatus?.subscriptionStartedAt || shopStatus?.registeredAt)}
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Next Renewal</span>
                <span className="text-sm font-bold text-slate-800 dark:text-white block mt-1">
                  {calculateRenewalDate(shopStatus?.subscriptionStartedAt || shopStatus?.registeredAt, shopStatus?.subscriptionPlan)}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col justify-center">
            <button
              onClick={() => {
                setShowRazorpay(true);
                setPaymentStep('plan');
              }}
              className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              <IndianRupee className="w-4 h-4" />
              Pay / Renew Subscription
            </button>
            <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-slate-400 font-semibold">
              <Lock className="w-3 h-3" /> Secured by Razorpay Gateway
            </div>
          </div>
        </div>
      </div>

      {/* Shop Profile Card */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-2xl relative overflow-hidden bg-white dark:bg-slate-900/50">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-left flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Shop Profile</h3>
            <p className="text-xs text-slate-500">Edit your contact details and store address.</p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" /> Enable Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSave} className="space-y-6 relative z-10 text-left">
          {/* Customer Unique ID */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black text-slate-900 dark:text-slate-200 tracking-wider">Customer Unique ID</span>
                <span className="block font-mono text-sm font-black text-slate-950 dark:text-white mt-0.5">{shopInfo.customerUniqueId}</span>
              </div>
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-955/30 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-900">Verified Client</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shop Name */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-900 dark:text-slate-200 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-black">
                  <Store className="w-4 h-4 text-blue-500" />
                  Shop Name
                </span>
                <span className="flex items-center gap-1 text-[9px] text-amber-500 bg-amber-50 dark:bg-amber-955/20 px-1.5 py-0.5 rounded font-black tracking-widest border border-amber-200/50 uppercase">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              </label>
              <input
                type="text"
                value={shopInfo.shopName}
                readOnly
                className="w-full p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl outline-none font-bold text-slate-950 dark:text-white cursor-not-allowed"
              />
            </div>

            {/* Proprietor Name */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-900 dark:text-slate-200 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-black">
                  <User className="w-4 h-4 text-indigo-500" />
                  Proprietor Name
                </span>
                <span className="flex items-center gap-1 text-[9px] text-amber-500 bg-amber-50 dark:bg-amber-955/20 px-1.5 py-0.5 rounded font-black tracking-widest border border-amber-200/50 uppercase">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              </label>
              <input
                type="text"
                value={shopInfo.proprietorName}
                readOnly
                className="w-full p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-755 rounded-xl outline-none font-bold text-slate-950 dark:text-white cursor-not-allowed"
              />
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-900 dark:text-slate-200 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-black">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  Contact Number
                </span>
                {!isEditing && (
                  <span className="text-[9px] text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider">ReadOnly</span>
                )}
              </label>
              <input
                type="text"
                value={shopInfo.phone}
                onChange={(e) => setShopInfo({ ...shopInfo, phone: e.target.value })}
                required
                readOnly={!isEditing}
                className={`w-full p-3 border rounded-xl outline-none font-bold transition-all ${isEditing
                    ? 'bg-slate-50 dark:bg-slate-800 border-emerald-500/30 text-slate-955 dark:text-white focus:ring-2 focus:ring-emerald-500'
                    : 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-950 dark:text-white cursor-not-allowed'
                  }`}
              />
            </div>

            {/* GSTIN */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-900 dark:text-slate-200 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-black">
                  <Hash className="w-4 h-4 text-rose-500" />
                  GSTIN Number
                </span>
                <span className="flex items-center gap-1 text-[9px] text-amber-500 bg-amber-50 dark:bg-amber-955/20 px-1.5 py-0.5 rounded font-black tracking-widest border border-amber-200/50 uppercase">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              </label>
              <input
                type="text"
                value={shopInfo.gstin}
                readOnly
                className="w-full p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl outline-none font-bold text-slate-950 dark:text-white cursor-not-allowed uppercase"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-900 dark:text-slate-200 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-black">
                <MapPin className="w-4 h-4 text-amber-500" />
                Shop Address
              </span>
              {!isEditing && (
                <span className="text-[9px] text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider">ReadOnly</span>
              )}
            </label>
            <textarea
              value={shopInfo.address}
              onChange={(e) => setShopInfo({ ...shopInfo, address: e.target.value })}
              required
              rows="2"
              readOnly={!isEditing}
              className={`w-full p-3 border rounded-xl outline-none font-bold transition-all ${isEditing
                  ? 'bg-slate-50 dark:bg-slate-800 border-amber-500/30 text-slate-950 dark:text-white focus:ring-2 focus:ring-amber-500'
                  : 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-950 dark:text-white cursor-not-allowed'
                }`}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80 min-h-[64px]">
            {savedSuccess ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900 animate-bounce">
                <Check className="w-4 h-4" /> Settings Saved! Reloading to sync...
              </div>
            ) : isEditing ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-955/20 px-2.5 py-1.5 rounded-lg border border-amber-200/30 font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Modify Contact or Address to save
              </div>
            ) : (
              <div className="text-xs text-slate-400 font-medium">Click "Enable Edit" in top-right to start making changes.</div>
            )}

            {isEditing && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-755 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all text-xs cursor-pointer"
                >
                  Cancel
                </button>
                {hasChanges && (
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all text-xs flex items-center gap-1.5 cursor-pointer animate-in zoom-in-95 duration-200"
                  >
                    <Check className="w-4 h-4" /> Save Settings
                  </button>
                )}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* RAZORPAY GATEWAY MODAL SIMULATOR */}
      {showRazorpay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 font-sans transition-all duration-500 ${
            paymentStep === 'success' 
              ? 'bg-[#19b889] text-white border-transparent' 
              : paymentStep === 'processing'
              ? 'bg-[#f8f9fa] text-slate-800 border-transparent min-h-[380px]'
              : 'bg-[#0b1a30] text-white border border-blue-900/45'
          }`}>
            
            {/* Razorpay Modal Header */}
            {paymentStep !== 'success' && paymentStep !== 'processing' && (
              <div className="p-5 border-b border-blue-900/30 bg-[#0d213d] flex items-center justify-between text-left">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center font-black text-white tracking-widest text-sm shadow-md">
                    CV
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">Chicken Vypar POS</h4>
                    <p className="text-[10px] text-blue-400 font-semibold tracking-wide">License Renewal</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRazorpay(false)} 
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Content Container */}
            <div className="p-6 flex-1 overflow-y-auto max-h-[75vh] text-left">
              {paymentStep === 'plan' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="text-center">
                    <span className="text-xs font-bold text-blue-400 tracking-wider uppercase block mb-1">Select Subscription Plan</span>
                    <h3 className="text-lg font-bold text-slate-100">Choose your renewal period</h3>
                  </div>

                  <div className="space-y-3">
                    {plans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlan(p.id)}
                        className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between text-left cursor-pointer ${
                          selectedPlan === p.id
                            ? 'bg-blue-600/10 border-blue-500 shadow-md ring-1 ring-blue-500/20'
                            : 'bg-[#0f2445] border-blue-900/50 hover:border-blue-700/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-slate-100 text-sm block">{p.name}</span>
                          <span className="text-xs text-blue-400 font-semibold mt-0.5 block">Validity: {p.period}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-white block">₹{p.price}</span>
                          <span className="text-[9px] text-slate-400 block font-semibold">Inclusive of all taxes</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleProceedToPay}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                  >
                    Proceed to Pay ₹{selectedPlanPrice}
                  </button>
                </div>
              )}

              {paymentStep === 'method' && (
                <div className="space-y-5 animate-in slide-in-from-right duration-250">
                  <div className="flex items-center gap-2 pb-3 border-b border-blue-900/30">
                    <button 
                      onClick={() => setPaymentStep('plan')} 
                      className="text-xs font-semibold text-blue-400 hover:underline cursor-pointer"
                    >
                      ← Back to Plans
                    </button>
                    <span className="text-slate-500">|</span>
                    <span className="text-xs text-slate-300 font-bold">Paying ₹{selectedPlanPrice}</span>
                  </div>

                  <div className="space-y-4">
                    <span className="text-xs font-bold text-slate-400 block text-left">Select Payment Method</span>
                    
                    {/* Method Option: UPI */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => { setSelectedMethod('upi'); setPaymentError(''); }}
                        className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                          selectedMethod === 'upi'
                            ? 'bg-blue-600/10 border-blue-500'
                            : 'bg-[#0f2445] border-blue-900/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-blue-400" />
                        <div className="text-left">
                          <span className="font-bold text-sm text-slate-100 block">UPI (GPay / PhonePe / Paytm)</span>
                          <span className="text-[10px] text-slate-400 block">Pay via Instant UPI ID</span>
                        </div>
                      </button>
                      
                      {selectedMethod === 'upi' && (
                        <div className="p-3 bg-[#0d213d] rounded-xl border border-blue-900/40 space-y-2 animate-in slide-in-from-top duration-200">
                          <input
                            type="text"
                            placeholder="Enter UPI ID (e.g. momin@okhdfcbank)"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <p className="text-[10px] text-slate-400">Use any test UPI ID for demo</p>
                        </div>
                      )}
                    </div>

                    {/* Method Option: Card */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => { setSelectedMethod('card'); setPaymentError(''); }}
                        className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                          selectedMethod === 'card'
                            ? 'bg-blue-600/10 border-blue-500'
                            : 'bg-[#0f2445] border-blue-900/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <CreditCard className="w-5 h-5 text-blue-400" />
                        <div className="text-left">
                          <span className="font-bold text-sm text-slate-100 block">Credit / Debit Cards</span>
                          <span className="text-[10px] text-slate-400 block">Visa, MasterCard, RuPay, Maestro</span>
                        </div>
                      </button>
                      
                      {selectedMethod === 'card' && (
                        <div className="p-4 bg-[#0d213d] rounded-xl border border-blue-900/40 space-y-3 animate-in slide-in-from-top duration-200">
                          <input
                            type="text"
                            maxLength="19"
                            placeholder="Card Number (e.g. 4111 2222 3333 4444)"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                            className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              maxLength="5"
                              placeholder="Expiry (MM/YY)"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                            <input
                              type="password"
                              maxLength="3"
                              placeholder="CVV"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Method Option: Netbanking */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => { setSelectedMethod('netbanking'); setPaymentError(''); }}
                        className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                          selectedMethod === 'netbanking'
                            ? 'bg-blue-600/10 border-blue-500'
                            : 'bg-[#0f2445] border-blue-900/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <Globe className="w-5 h-5 text-blue-400" />
                        <div className="text-left">
                          <span className="font-bold text-sm text-slate-100 block">Netbanking</span>
                          <span className="text-[10px] text-slate-400 block">All major Indian banks supported</span>
                        </div>
                      </button>
                      
                      {selectedMethod === 'netbanking' && (
                        <div className="p-3 bg-[#0d213d] rounded-xl border border-blue-900/40 animate-in slide-in-from-top duration-200">
                          <select className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500">
                            <option value="sbi">State Bank of India</option>
                            <option value="hdfc">HDFC Bank</option>
                            <option value="icici">ICICI Bank</option>
                            <option value="axis">Axis Bank</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>

                  {paymentError && (
                    <div className="flex items-center gap-2 text-rose-400 bg-rose-955/20 p-3 rounded-lg border border-rose-900/30 text-xs font-semibold animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {selectedMethod && (
                    <button
                      onClick={handlePaymentSubmit}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                    >
                      Pay ₹{selectedPlanPrice} Securely
                    </button>
                  )}
                </div>
              )}

              {paymentStep === 'processing' && (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] relative animate-in fade-in duration-300">
                  <div className="relative w-40 h-40 flex items-center justify-center scale-90">
                    {/* Pulsing blue outer ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/10 scale-110 animate-pulse"></div>
                    
                    {/* Rotating Blue Progress Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-slate-200/40 border-t-blue-600 animate-spin"></div>
                    
                    {/* Glossy 3D Shield SVG */}
                    <svg className="w-20 h-24 drop-shadow-xl animate-pulse" viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="shield-grad-glow" x1="10%" y1="10%" x2="90%" y2="90%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="50%" stopColor="#1d4ed8" />
                          <stop offset="100%" stopColor="#1e3a8a" />
                        </linearGradient>
                        <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                      </defs>
                      <path 
                        d="M50 15 
                           C75 15, 85 20, 85 45 
                           C85 75, 70 95, 50 105 
                           C30 95, 15 75, 15 45 
                           C15 20, 25 15, 50 15 Z" 
                        fill="url(#shield-grad-glow)" 
                        filter="url(#glow-filter)"
                      />
                    </svg>
                  </div>
                  
                  {/* Secured by Razorpay Logo Footer */}
                  <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold tracking-wide">Secured by</span>
                    <svg className="h-3 w-5 fill-blue-600 self-center" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 2 L2 18 L7 18 L18 2 Z" />
                    </svg>
                    <span className="font-sans font-black italic text-slate-700 text-xs tracking-tighter">Razorpay</span>
                  </div>
                </div>
              )}

              {paymentStep === 'success' && (
                <div className="py-12 flex flex-col items-center justify-center space-y-5 animate-in zoom-in-95 duration-300">
                  <style>{`
                    @keyframes rzp-stroke {
                      100% { stroke-dashoffset: 0; }
                    }
                    @keyframes rzp-scale {
                      0%, 100% { transform: none; }
                      50% { transform: scale3d(1.15, 1.15, 1); }
                    }
                    @keyframes rzp-fill {
                      100% { box-shadow: inset 0px 0px 0px 40px #ffffff; }
                    }
                    .rzp-circle {
                      stroke-dasharray: 166;
                      stroke-dashoffset: 166;
                      stroke-width: 4;
                      stroke-miterlimit: 10;
                      stroke: #ffffff;
                      fill: none;
                      animation: rzp-stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
                    }
                    .rzp-check-icon {
                      width: 72px;
                      height: 72px;
                      border-radius: 50%;
                      display: block;
                      stroke-width: 4;
                      stroke: #19b889;
                      stroke-miterlimit: 10;
                      box-shadow: inset 0px 0px 0px #ffffff;
                      animation: rzp-fill .4s ease-in-out .4s forwards, rzp-scale .3s ease-in-out .9s both;
                    }
                    .rzp-check-path {
                      transform-origin: 50% 50%;
                      stroke-dasharray: 48;
                      stroke-dashoffset: 48;
                      animation: rzp-stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
                    }
                  `}</style>
                  
                  <div className="flex items-center justify-center">
                    <svg className="rzp-check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                      <circle className="rzp-circle" cx="26" cy="26" r="25" fill="none" />
                      <path className="rzp-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                    </svg>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <h4 className="font-black text-white text-xl tracking-tight">Payment Successful</h4>
                    <p className="text-xs text-emerald-100 font-semibold opacity-90">Your license has been activated and updated.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Razorpay Footer */}
            {paymentStep !== 'success' && (
              <div className="p-4 bg-[#071324] border-t border-blue-900/30 flex items-center justify-between text-[10px] text-slate-400 font-semibold px-6">
                <span className="flex items-center gap-1">
                  🛡️ PCI-DSS Compliant
                </span>
                <span className="flex items-center gap-1 uppercase tracking-wider text-slate-500 font-black">
                  Razorpay Secure
                </span>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
