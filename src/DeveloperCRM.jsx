import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Database, LogOut, Menu, X, Plus, 
  Check, Lock, Edit2, Sparkles, AlertTriangle, Download, 
  Upload, Trash2, Power, Landmark, Phone, MapPin, Hash, ShieldAlert
} from 'lucide-react';

export default function DeveloperCRM({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('shops');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [shops, setShops] = useState(() => {
    const saved = localStorage.getItem('crm_shops');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0 && parsed[0].customerUniqueId && parsed[0].customerUniqueId.startsWith('MC-')) {
        localStorage.removeItem('crm_shops');
      } else {
        return parsed;
      }
    }
    return [
      {
        customerUniqueId: 'CV-00001',
        shopName: 'Momin Chicken',
        proprietorName: 'Mohammad Farooq Momin',
        address: '123, Main Bazar road, Pune, Maharashtra',
        phone: '+91 98765 43210',
        gstin: '27AAAAA1111A1Z1',
        aadharNo: '1234 5678 9012',
        panNo: 'ABCDE1234F',
        status: 'Active',
        kycStatus: 'Verified',
        maxWorkers: 5,
        registeredAt: '2026-05-15'
      },
      {
        customerUniqueId: 'CV-00002',
        shopName: 'Al-Habib Poultry Farm',
        proprietorName: 'Habibullah Khan',
        address: 'Gate 4, Agri Market yard, Satara, Maharashtra',
        phone: '+91 88888 77777',
        gstin: '27BBBBB2222B2Z2',
        aadharNo: '9876 5432 1098',
        panNo: 'FGHIJ5678K',
        status: 'Trial',
        kycStatus: 'Verified',
        maxWorkers: 10,
        registeredAt: '2026-05-16'
      },
      {
        customerUniqueId: 'CV-00003',
        shopName: 'Star Chicken Retailer',
        proprietorName: 'Salim Qureshi',
        address: 'Shop 12, Fish Market complex, Solapur, Maharashtra',
        phone: '+91 99999 88888',
        gstin: '27CCCCC3333C3Z3',
        aadharNo: '5555 6666 7777',
        panNo: 'LMNOP9012Q',
        status: 'Suspended',
        kycStatus: 'Pending',
        maxWorkers: 3,
        registeredAt: '2026-05-17'
      }
    ];
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingShop, setEditingShop] = useState(null);
  const [newShop, setNewShop] = useState({
    shopName: '',
    proprietorName: '',
    address: '',
    phone: '',
    gstin: '',
    aadharNo: '',
    panNo: '',
    status: 'Active',
    kycStatus: 'Verified',
    maxWorkers: 5
  });

  const [backupSuccess, setBackupSuccess] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(null);

  useEffect(() => {
    localStorage.setItem('crm_shops', JSON.stringify(shops));
  }, [shops]);

  const handleCreateShop = (e) => {
    e.preventDefault();
    
    // Auto-generate sequential CV-00001 ID
    let nextNum = 1;
    if (shops.length > 0) {
      const cvIds = shops
        .map(s => s.customerUniqueId)
        .filter(id => id && id.startsWith('CV-'));
      
      if (cvIds.length > 0) {
        const numbers = cvIds.map(id => {
          const part = id.split('-')[1];
          return parseInt(part, 10) || 0;
        });
        const maxNum = Math.max(...numbers);
        nextNum = maxNum + 1;
      }
    }
    const sequentialId = `CV-${String(nextNum).padStart(5, '0')}`;

    const shopToSave = {
      ...newShop,
      customerUniqueId: sequentialId,
      registeredAt: new Date().toISOString().split('T')[0]
    };
    setShops([...shops, shopToSave]);
    setShowAddModal(false);
    setNewShop({
      shopName: '',
      proprietorName: '',
      address: '',
      phone: '',
      gstin: '',
      aadharNo: '',
      panNo: '',
      status: 'Active',
      kycStatus: 'Verified',
      maxWorkers: 5
    });
  };

  const handleUpdateStatus = (shopId, newStatus) => {
    setShops(shops.map(s => s.customerUniqueId === shopId ? { ...s, status: newStatus } : s));
  };

  const handleUpdateKyc = (shopId, newKyc) => {
    setShops(shops.map(s => s.customerUniqueId === shopId ? { ...s, kycStatus: newKyc } : s));
  };

  const handleDeleteShop = (shopId) => {
    if (window.confirm("Are you absolutely sure you want to delete this merchant's SaaS portal profile? This cannot be undone!")) {
      setShops(shops.filter(s => s.customerUniqueId !== shopId));
    }
  };

  const handleExportBackup = () => {
    const backupObj = {
      backup_metadata: {
        exported_by: user.username,
        exported_at: new Date().toISOString(),
        version: '1.3.0',
        total_tenants: shops.length
      },
      tenants: shops,
      system_database_dump: {
        rates_templates: [
          { item: 'Boiler Chicken', defaultRate: 140 },
          { item: 'Parent Chicken', defaultRate: 90 },
          { item: 'Tandoori Chicken', defaultRate: 160 }
        ]
      }
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chicken_vypar_system_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setBackupSuccess(true);
    setTimeout(() => setBackupSuccess(false), 3000);
  };

  const handleImportBackup = (e) => {
    const fileReader = new FileReader();
    fileReader.readAsText(e.target.files[0], "UTF-8");
    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.tenants && Array.isArray(parsed.tenants)) {
          setShops(parsed.tenants);
          setRestoreSuccess(`Success! Restored system profile with ${parsed.tenants.length} tenants safely.`);
          setTimeout(() => setRestoreSuccess(null), 4000);
        } else {
          setRestoreSuccess("Error: Invalid system backup schema layout.");
          setTimeout(() => setRestoreSuccess(null), 4000);
        }
      } catch (err) {
        setRestoreSuccess("Error parsing JSON file. Please ensure it is a valid backup.");
        setTimeout(() => setRestoreSuccess(null), 4000);
      }
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <Shield className="w-5 h-5 animate-pulse" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-gradient">Vypar Dev CRM</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-20 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full w-64 glass-panel border-r border-slate-200 dark:border-slate-800 z-30 flex flex-col transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="h-10 w-10 bg-gradient-to-r from-red-600 to-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-red-600 dark:text-rose-400 uppercase leading-none">Vypar Dev</h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 block">SaaS Control</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden ml-auto p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => { setActiveTab('shops'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-bold ${activeTab === 'shops'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/15'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Users className="w-5 h-5 shrink-0" />
            Shops Directory
          </button>
          
          <button
            onClick={() => { setActiveTab('backups'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-bold ${activeTab === 'backups'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/15'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Database className="w-5 h-5 shrink-0" />
            System Backup
          </button>

          <button
            onClick={() => { setActiveTab('restores'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-bold ${activeTab === 'restores'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/15'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Upload className="w-5 h-5 shrink-0" />
            Data Restore Hub
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Developer Exit
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="md:ml-64 p-4 md:p-8">
        
        {/* Welcome Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
          <div className="text-left">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <Shield className="w-8 h-8 text-red-500 animate-pulse shrink-0" />
              SaaS Control Center
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Hello, {user.username}. You have master developer credentials.</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider border border-red-100 dark:border-red-900 shrink-0 self-start md:self-auto flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            Live Core Server
          </div>
        </header>

        {/* Global Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="glass-panel p-6 rounded-2xl flex items-center justify-between bg-white dark:bg-slate-900/50">
            <div className="text-left">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Onboarded Shops</span>
              <span className="block text-3xl font-black mt-1 text-slate-800 dark:text-white">{shops.length} Stores</span>
            </div>
            <div className="h-12 w-12 bg-red-100 dark:bg-red-950/30 rounded-2xl flex items-center justify-center text-red-600 dark:text-rose-400">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl flex items-center justify-between bg-white dark:bg-slate-900/50">
            <div className="text-left">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">KYC Compliance</span>
              <span className="block text-3xl font-black mt-1 text-slate-800 dark:text-white">
                {Math.round((shops.filter(s => s.kycStatus === 'Verified').length / shops.length) * 100)}%
              </span>
            </div>
            <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Check className="w-6 h-6" />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl flex items-center justify-between bg-white dark:bg-slate-900/50">
            <div className="text-left">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active System Status</span>
              <span className="block text-xl font-bold mt-2 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                100% Online
              </span>
            </div>
            <div className="h-12 w-12 bg-blue-100 dark:bg-blue-950/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Power className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Dynamic CRM Tab Rendering */}
        
        {activeTab === 'shops' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="text-left">
                <h3 className="text-xl font-extrabold">Shop Directory</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage client licenses, verify shop KYC and configure limitations.</p>
              </div>
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 text-xs flex items-center gap-1.5 cursor-pointer transform hover:scale-105 active:scale-95 transition-all self-start"
              >
                <Plus className="w-4 h-4" /> Add New Merchant
              </button>
            </div>

            {/* Merchant List Table */}
            <div className="glass-panel rounded-3xl border border-slate-200/50 dark:border-slate-800 overflow-hidden shadow-xl bg-white dark:bg-slate-900/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800/80">
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Client Profile</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Proprietor / Contact</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Tax & KYC Identifiers</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider text-center">Workers</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">KYC Status</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">License Status</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {shops.map((shop) => (
                      <tr key={shop.customerUniqueId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shadow-inner">
                              <Landmark className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                              <span className="block font-black text-slate-800 dark:text-white leading-tight">{shop.shopName}</span>
                              <span className="block text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{shop.customerUniqueId}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          <div>
                            <span>{shop.proprietorName}</span>
                            <span className="block text-slate-400 text-xs font-normal mt-0.5">{shop.phone}</span>
                          </div>
                        </td>
                        <td className="p-4 text-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                              <span className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold px-1 rounded uppercase tracking-wider shrink-0 text-slate-400">GST</span>
                              <span className="font-bold">{shop.gstin || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                              <span className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold px-1 rounded uppercase tracking-wider shrink-0 text-slate-400">AADHAR</span>
                              <span>{shop.aadharNo || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                              <span className="bg-slate-100 dark:bg-slate-800 text-[9px] font-bold px-1 rounded uppercase tracking-wider shrink-0 text-slate-400">PAN</span>
                              <span className="uppercase">{shop.panNo || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center font-bold text-slate-600 dark:text-slate-300">{shop.maxWorkers} Profiles</td>
                        <td className="p-4">
                          <select 
                            value={shop.kycStatus}
                            onChange={(e) => handleUpdateKyc(shop.customerUniqueId, e.target.value)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none border cursor-pointer ${
                              shop.kycStatus === 'Verified'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                : 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                            }`}
                          >
                            <option value="Verified">Verified</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <select 
                            value={shop.status}
                            onChange={(e) => handleUpdateStatus(shop.customerUniqueId, e.target.value)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none border cursor-pointer ${
                              shop.status === 'Active'
                                ? 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
                                : shop.status === 'Trial'
                                ? 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30'
                                : 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30'
                            }`}
                          >
                            <option value="Active">Active</option>
                            <option value="Trial">Trial Mode</option>
                            <option value="Suspended">Suspended</option>
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleDeleteShop(shop.customerUniqueId)}
                            className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="max-w-2xl mx-auto text-left space-y-6 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xl font-extrabold">Data Protection & System Backup</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Download complete JSON records of all tenants registered under Chicken Vypar.</p>
            </div>

            <div className="glass-panel p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="flex items-start gap-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200/30 rounded-2xl text-slate-700 dark:text-slate-300">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="block font-bold text-red-650 dark:text-red-400">Merchant Data Responsibility</span>
                  <span className="block mt-1 text-slate-500 dark:text-slate-400 leading-relaxed text-xs">Taking weekly backups is recommended. This downloads a perfect snapshot of all registered stores, active proprietor limits, and security structures.</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-semibold border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span>Data Format</span>
                  <span className="font-mono text-slate-400 text-xs">Structured SaaS Schema (.json)</span>
                </div>
                <div className="flex justify-between items-center text-sm font-semibold border-b border-slate-100 dark:border-slate-800 pb-3">
                  <span>Included Stores</span>
                  <span className="text-slate-500">{shops.length} profiles</span>
                </div>
              </div>

              {backupSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center justify-center gap-1.5 text-sm animate-bounce">
                  <Check className="w-4 h-4" /> Full System Backup Generated & Saved!
                </div>
              )}

              <button 
                onClick={handleExportBackup}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-98"
              >
                <Download className="w-5 h-5 animate-bounce" /> 
                Download SaaS Snapshot (.JSON)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'restores' && (
          <div className="max-w-2xl mx-auto text-left space-y-6 animate-in fade-in duration-200">
            <div>
              <h3 className="text-xl font-extrabold">System Restoration Hub</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Recover all merchant profiles instantly from a previously saved JSON snapshot.</p>
            </div>

            <div className="glass-panel p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 space-y-6">
              
              <div className="flex items-start gap-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/30 rounded-2xl text-slate-700 dark:text-slate-300">
                <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <span className="block font-bold text-amber-650 dark:text-amber-400">Overwrite Warning!</span>
                  <span className="block mt-1 text-slate-500 dark:text-slate-400 leading-relaxed text-xs">Uploading a backup will completely replace all currently registered shop profiles. Only proceed in case of cloud data corruptions or migration operations.</span>
                </div>
              </div>

              {restoreSuccess && (
                <div className={`p-3 font-bold rounded-xl border flex items-center justify-center gap-1.5 text-sm animate-pulse ${
                  restoreSuccess.startsWith("Success")
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900'
                    : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900'
                }`}>
                  {restoreSuccess}
                </div>
              )}

              {/* Upload Drop Zone */}
              <label className="border-2 border-dashed border-slate-200 dark:border-slate-750 hover:border-red-500 dark:hover:border-rose-500 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-50/50 dark:hover:bg-slate-800/10 min-h-[200px]">
                <Upload className="w-10 h-10 text-slate-400 mb-3" />
                <span className="block text-sm font-extrabold text-slate-800 dark:text-white">Choose Backup File</span>
                <span className="block text-[11px] text-slate-400 mt-1">Select a valid `chicken_vypar_system_backup_xxx.json`</span>
                
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden" 
                />
              </label>
            </div>
          </div>
        )}

      </main>

      {/* Add Shop Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 md:p-8 bg-white dark:bg-slate-900 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>

            <h3 className="text-xl font-extrabold tracking-tight mb-2">Onboard New Merchant</h3>
            <p className="text-sm text-slate-400 mb-6">Create a licensed tenant dashboard with a verified Customer ID.</p>

            <form onSubmit={handleCreateShop} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Shop Name</label>
                  <input
                    type="text"
                    required
                    value={newShop.shopName}
                    onChange={(e) => setNewShop({ ...newShop, shopName: e.target.value })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none"
                    placeholder="e.g. Royal Chicken Centre"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Proprietor Name</label>
                  <input
                    type="text"
                    required
                    value={newShop.proprietorName}
                    onChange={(e) => setNewShop({ ...newShop, proprietorName: e.target.value })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none"
                    placeholder="e.g. Mohammad Ali"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Contact Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.phone}
                    onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none"
                    placeholder="e.g. +91 98321 00000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">GSTIN Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.gstin}
                    onChange={(e) => setNewShop({ ...newShop, gstin: e.target.value })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none uppercase"
                    placeholder="e.g. 27AAAAA1111A1Z1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Aadhar Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.aadharNo}
                    onChange={(e) => setNewShop({ ...newShop, aadharNo: e.target.value })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none"
                    placeholder="e.g. 1234 5678 9012"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">PAN Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.panNo}
                    onChange={(e) => setNewShop({ ...newShop, panNo: e.target.value })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none uppercase"
                    placeholder="e.g. ABCDE1234F"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Shop Address</label>
                <textarea
                  required
                  rows="2"
                  value={newShop.address}
                  onChange={(e) => setNewShop({ ...newShop, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none"
                  placeholder="Street name, City, State..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Initial License Status</label>
                  <select
                    value={newShop.status}
                    onChange={(e) => setNewShop({ ...newShop, status: e.target.value })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">Trial Mode</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Max Workers Allowance</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newShop.maxWorkers}
                    onChange={(e) => setNewShop({ ...newShop, maxWorkers: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-250 dark:border-slate-750 rounded-xl bg-white/70 dark:bg-slate-800/80 text-sm outline-none font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/10 transition-all transform active:scale-95"
                >
                  <Check className="w-4 h-4" /> Create Store Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
