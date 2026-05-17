import React, { useState, useEffect } from 'react';
import { Store, ShoppingCart, LayoutDashboard, Settings, Package, History, LogOut, Menu, X, Tag, Truck, FileText, IndianRupee, User, MapPin, Phone, Hash, Check, Lock, Edit2, Sparkles } from 'lucide-react';
import Login from './Login';
import BillingPOS from './BillingPOS';
import DailyRates from './DailyRates';
import StockInward from './StockInward';
import SupplierPayments from './SupplierPayments';
import Reports from './Reports';
import DailyLogs from './DailyLogs';
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
    if (saved) return JSON.parse(saved);
    return {
      customerUniqueId: 'MC-89324',
      shopName: shopDetails.name,
      proprietorName: 'Mohammad Farooq Momin',
      address: shopDetails.address,
      phone: shopDetails.phone,
      gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
    };
  });

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

  if (!user) {
    return <Login onLogin={(userData) => setUser(userData)} />;
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
          <h1 className="text-lg font-bold tracking-tight text-gradient">Chicken Vypyar</h1>
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
          <h1 className="text-xl font-bold tracking-tight text-gradient">Chicken Vypyar</h1>

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
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4 print:hidden">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back, {shopInfo.shopName}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Here's what's happening at your shop today.</p>
          </div>
          <div className="flex items-center gap-4 self-start md:self-auto">
            <div className="bg-white dark:bg-slate-800 rounded-full px-4 py-2 shadow-sm border border-slate-200 dark:border-slate-700 text-sm font-medium">
              15 May, 2026
            </div>
            <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold border border-primary-200 dark:border-primary-800 shrink-0">
              {user.username.charAt(0).toUpperCase()}
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
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Momin Chicken POS v1.3</span>
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
          <SettingsPanel />
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

function SettingsPanel() {
  const [shopInfo, setShopInfo] = useState(() => {
    const saved = localStorage.getItem('shopInfo');
    if (saved) return JSON.parse(saved);
    return {
      customerUniqueId: 'MC-89324',
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

  const handleSave = (e) => {
    e.preventDefault();
    localStorage.setItem('shopInfo', JSON.stringify(shopInfo));
    setOriginalShopInfo({ ...shopInfo });
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    // Reload window after 1.5 seconds to sync settings globally
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleCancel = () => {
    setShopInfo({ ...originalShopInfo });
    setIsEditing(false);
  };

  // Determine if there are actual changes made to the editable fields
  const hasChanges = shopInfo.phone !== originalShopInfo.phone || shopInfo.address !== originalShopInfo.address;

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-300 text-left">
      <div className="text-left flex justify-between items-end">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Shop Settings</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage shop profile, proprietor name, contact number, and GSTIN.</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer transform hover:scale-105 active:scale-95"
          >
            <Edit2 className="w-3.5 h-3.5" /> Enable Edit
          </button>
        )}
      </div>

      <div className="glass-panel p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-2xl relative overflow-hidden bg-white dark:bg-slate-900/50">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <form onSubmit={handleSave} className="space-y-6 relative z-10 text-left">
          
          {/* Customer Unique ID - Sleek Non-editable Card Header */}
          <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
                <Hash className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer Unique ID</span>
                <span className="block font-mono text-sm font-black text-slate-850 dark:text-white mt-0.5">{shopInfo.customerUniqueId}</span>
              </div>
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-900">Verified Client</span>
          </div>

          <div className="space-y-6">
            
            {/* Shop Name */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-blue-500" />
                  Shop Name
                </span>
                <span className="flex items-center gap-1 text-[9px] text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded font-black tracking-widest border border-amber-200/50 uppercase">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              </label>
              <input
                type="text"
                value={shopInfo.shopName}
                readOnly
                className="w-full p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl outline-none font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            {/* Proprietor Name */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-500" />
                  Proprietor Name
                </span>
                <span className="flex items-center gap-1 text-[9px] text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded font-black tracking-widest border border-amber-200/50 uppercase">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              </label>
              <input
                type="text"
                value={shopInfo.proprietorName}
                readOnly
                className="w-full p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl outline-none font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed"
              />
            </div>

            {/* Contact Number */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-emerald-500" />
                  Contact Number
                </span>
                {!isEditing && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">ReadOnly</span>
                )}
              </label>
              <input
                type="text"
                value={shopInfo.phone}
                onChange={(e) => setShopInfo({ ...shopInfo, phone: e.target.value })}
                required
                readOnly={!isEditing}
                className={`w-full p-3 border rounded-xl outline-none font-semibold transition-all ${
                  isEditing 
                    ? 'bg-slate-50 dark:bg-slate-800 border-emerald-500/30 text-slate-800 dark:text-white focus:ring-2 focus:ring-emerald-500' 
                    : 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                }`}
              />
            </div>

            {/* GSTIN */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-rose-500" />
                  GSTIN Number
                </span>
                <span className="flex items-center gap-1 text-[9px] text-amber-500 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded font-black tracking-widest border border-amber-200/50 uppercase">
                  <Lock className="w-2.5 h-2.5" /> Locked
                </span>
              </label>
              <input
                type="text"
                value={shopInfo.gstin}
                readOnly
                className="w-full p-3 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-750 rounded-xl outline-none font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed uppercase"
              />
            </div>

          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-500" />
                Shop Address
              </span>
              {!isEditing && (
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">ReadOnly</span>
              )}
            </label>
            <textarea
              value={shopInfo.address}
              onChange={(e) => setShopInfo({ ...shopInfo, address: e.target.value })}
              required
              rows="3"
              readOnly={!isEditing}
              className={`w-full p-3 border rounded-xl outline-none font-semibold transition-all ${
                isEditing 
                  ? 'bg-slate-50 dark:bg-slate-800 border-amber-500/30 text-slate-800 dark:text-white focus:ring-2 focus:ring-amber-500' 
                  : 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
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
              <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-200/30 font-semibold">
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
    </div>
  );
}

export default App;
