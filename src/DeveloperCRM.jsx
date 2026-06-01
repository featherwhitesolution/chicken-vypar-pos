import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Database, LogOut, Menu, X, Plus, 
  Check, Lock, Edit2, Sparkles, AlertTriangle, Download, 
  Upload, Trash2, Power, Landmark, Phone, MapPin, Hash, ShieldAlert,
  CreditCard, Smartphone, Globe, RefreshCw, AlertCircle, IndianRupee,
  Battery, Wifi, WifiOff, Search
} from 'lucide-react';
import { supabase } from './supabase';

const calculateExpiryDate = (startDateStr, plan) => {
  if (!startDateStr) return '';
  const date = new Date(startDateStr);
  if (plan === 'Trial') {
    date.setDate(date.getDate() + 30);
  } else if (plan === 'Monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (plan === 'Quarterly') {
    date.setMonth(date.getMonth() + 3);
  } else if (plan === 'Half-Yearly') {
    date.setMonth(date.getMonth() + 6);
  } else if (plan === 'Yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString().split('T')[0];
};

const formatDateToDDMMYY = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0].substring(2);
    const month = parts[1];
    const day = parts[2];
    return `${day}-${month}-${year}`;
  }
  return dateStr;
};

export default function DeveloperCRM({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('shops');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [fieldStaff, setFieldStaff] = useState([]);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [newStaff, setNewStaff] = useState({
    name: '',
    phone: '',
    passcode: '',
    assignedWholesalerId: '',
    assignedWholesalerName: '',
    status: 'Active',
    subscriptionPlan: 'Monthly'
  });

  useEffect(() => {
    const fetchStaff = async () => {
      const { data, error } = await supabase
        .from('field_staff')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setFieldStaff(data.map(row => ({
          docId: row.id,
          staffId: row.staff_id,
          name: row.name,
          phone: row.phone,
          passcode: row.passcode,
          status: row.status,
          subscriptionPlan: row.subscription_plan,
          registeredAt: row.registered_at,
          subscriptionStartedAt: row.subscription_started_at,
          subscriptionExpiredAt: row.subscription_expired_at,
          assignedWholesalerId: row.assigned_wholesaler_id,
          assignedWholesalerName: row.assigned_wholesaler_name,
          lastLocation: {
            lat: row.last_location_lat,
            lng: row.last_location_lng,
            timestamp: row.last_location_time
          },
          lastActive: row.last_active,
          batteryPercentage: row.battery_percentage,
          batteryCharging: row.battery_charging,
          networkStatus: row.network_status,
          routeHistory: typeof row.route_history === 'string' ? JSON.parse(row.route_history) : (row.route_history || []),
          currentShopId: row.current_shop_id,
          currentShopName: row.current_shop_name,
          minutesSpentAtCurrentShop: row.minutes_spent_at_current_shop
        })));
      }
    };
    fetchStaff();

    const channel = supabase
      .channel('field-staff-crm')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'field_staff' }, fetchStaff)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [shops, setShops] = useState(() => {
    const saved = localStorage.getItem('crm_shops');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0 && parsed[0].customerUniqueId && parsed[0].customerUniqueId.startsWith('MC-')) {
          localStorage.removeItem('crm_shops');
        } else {
          return parsed.map(shop => {
            let status = shop.status;
            if (shop.customerUniqueId === 'CV-00001') {
              status = 'Active';
            }
            return {
              ...shop,
              status,
              registeredAt: shop.registeredAt || new Date().toISOString().split('T')[0],
              subscriptionStartedAt: shop.subscriptionStartedAt || (status === 'Active' ? shop.registeredAt || new Date().toISOString().split('T')[0] : ''),
              deactivatedAt: status === 'Deactive' ? (shop.deactivatedAt || new Date().toISOString().split('T')[0]) : '',
              subscriptionPlan: shop.subscriptionPlan || 'Monthly'
            };
          });
        }
      } catch (err) {
        console.error("Error parsing crm_shops:", err);
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
        registeredAt: '2026-05-15',
        subscriptionStartedAt: '2026-05-15',
        deactivatedAt: '',
        subscriptionPlan: 'Monthly'
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
        registeredAt: '2026-05-16',
        subscriptionStartedAt: '',
        deactivatedAt: '',
        subscriptionPlan: 'Monthly'
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
        status: 'Deactive',
        kycStatus: 'Pending',
        maxWorkers: 3,
        registeredAt: '2026-05-17',
        subscriptionStartedAt: '2026-05-17',
        deactivatedAt: '2026-05-18',
        subscriptionPlan: 'Yearly'
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
    maxWorkers: 5,
    registeredAt: new Date().toISOString().split('T')[0],
    subscriptionStartedAt: '',
    deactivatedAt: '',
    subscriptionPlan: 'Monthly'
  });

  const [backupSuccess, setBackupSuccess] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(null);

  // Razorpay admin payment simulation states
  const [payingShop, setPayingShop] = useState(null);
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('Monthly');
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

  const handleCollectPayment = (shop) => {
    setPayingShop(shop);
    setSelectedPlan(shop.subscriptionPlan || 'Monthly');
    setPaymentStep('plan');
    setSelectedMethod('');
    setUpiId('');
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setPaymentError('');
    setShowRazorpay(true);
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

      setShops(prevShops => prevShops.map(s => {
        if (s.customerUniqueId === payingShop.customerUniqueId) {
          return {
            ...s,
            status: 'Active',
            subscriptionPlan: planId,
            subscriptionStartedAt: todayStr,
            deactivatedAt: ''
          };
        }
        return s;
      }));

      setTimeout(() => {
        setShowRazorpay(false);
        setPaymentStep('plan');
        setPayingShop(null);
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
      registeredAt: newShop.registeredAt || new Date().toISOString().split('T')[0],
      subscriptionStartedAt: newShop.status === 'Active' ? (newShop.subscriptionStartedAt || new Date().toISOString().split('T')[0]) : newShop.subscriptionStartedAt,
      deactivatedAt: newShop.status === 'Deactive' ? (newShop.deactivatedAt || new Date().toISOString().split('T')[0]) : newShop.deactivatedAt,
      subscriptionPlan: newShop.subscriptionPlan || 'Monthly'
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
      maxWorkers: 5,
      registeredAt: new Date().toISOString().split('T')[0],
      subscriptionStartedAt: '',
      deactivatedAt: '',
      subscriptionPlan: 'Monthly'
    });
  };

  const handleUpdateStatus = (shopId, newStatus) => {
    setShops(shops.map(s => {
      if (s.customerUniqueId === shopId) {
        let update = { ...s, status: newStatus };
        if (newStatus === 'Active') {
          update.subscriptionStartedAt = s.subscriptionStartedAt || new Date().toISOString().split('T')[0];
          update.deactivatedAt = '';
        } else if (newStatus === 'Deactive') {
          update.deactivatedAt = s.deactivatedAt || new Date().toISOString().split('T')[0];
        } else {
          update.deactivatedAt = '';
        }
        return update;
      }
      return s;
    }));
  };

  const handleUpdatePlan = (shopId, newPlan) => {
    setShops(shops.map(s => s.customerUniqueId === shopId ? { ...s, subscriptionPlan: newPlan } : s));
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

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.phone || !newStaff.passcode || !newStaff.assignedWholesalerId) {
      alert("Please fill in all fields and assign a wholesaler.");
      return;
    }
    
    setIsSavingStaff(true);
    try {
      const wholesaler = shops.find(s => s.customerUniqueId === newStaff.assignedWholesalerId);
      const wholesalerName = wholesaler ? wholesaler.shopName : 'Momin Chicken';

      const todayStr = new Date().toISOString().split('T')[0];
      const subStart = newStaff.status === 'Active' ? todayStr : null;
      const subExpiry = newStaff.status === 'Active' ? calculateExpiryDate(todayStr, newStaff.subscriptionPlan || 'Monthly') : null;

      const { data, error } = await supabase
        .from('field_staff')
        .insert([{
          name: newStaff.name.trim(),
          phone: newStaff.phone.trim(),
          passcode: newStaff.passcode.trim(),
          assigned_wholesaler_id: newStaff.assignedWholesalerId,
          assigned_wholesaler_name: wholesalerName,
          status: newStaff.status,
          subscription_plan: newStaff.subscriptionPlan || 'Monthly',
          registered_at: todayStr,
          subscription_started_at: subStart,
          subscription_expired_at: subExpiry,
          battery_percentage: 100,
          battery_charging: false,
          network_status: 'online',
          last_location_lat: 19.0413,
          last_location_lng: 72.8431,
          last_location_time: new Date().toISOString(),
          last_active: new Date().toISOString(),
          route_history: [
            {
              lat: 19.0413,
              lng: 72.8431,
              timestamp: new Date().toISOString(),
              battery: 100,
              network: 'online',
              action: 'License Created'
            }
          ]
        }])
        .select();

      if (error) throw error;

      setShowAddStaffModal(false);
      setNewStaff({
        name: '',
        phone: '',
        passcode: '',
        assignedWholesalerId: '',
        assignedWholesalerName: '',
        status: 'Active',
        subscriptionPlan: 'Monthly'
      });
      alert("Field Staff license created successfully.");
    } catch (err) {
      console.error("Error creating staff license:", err);
      alert("Failed to create field staff license. Please try again.");
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleToggleStaffStatus = async (docId, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      const staff = fieldStaff.find(s => s.docId === docId);
      
      const updateData = { status: newStatus };
      if (newStatus === 'Active') {
        const start = staff?.subscriptionStartedAt || new Date().toISOString().split('T')[0];
        updateData.subscription_started_at = start;
        updateData.subscription_expired_at = calculateExpiryDate(start, staff?.subscriptionPlan || 'Monthly');
      }
      const { error } = await supabase
        .from('field_staff')
        .update(updateData)
        .eq('id', docId);
      if (error) throw error;
    } catch (err) {
      console.error("Error updating staff status:", err);
      alert("Failed to update status.");
    }
  };

  const handleUpdateStaffStatus = async (docId, newStatus) => {
    try {
      const staff = fieldStaff.find(s => s.docId === docId);
      
      const updateData = { status: newStatus };
      if (newStatus === 'Active') {
        const start = staff?.subscriptionStartedAt || new Date().toISOString().split('T')[0];
        updateData.subscription_started_at = start;
        updateData.subscription_expired_at = calculateExpiryDate(start, staff?.subscriptionPlan || 'Monthly');
      }
      const { error } = await supabase
        .from('field_staff')
        .update(updateData)
        .eq('id', docId);
      if (error) throw error;
    } catch (err) {
      console.error("Error updating staff status:", err);
      alert("Failed to update status.");
    }
  };

  const handleUpdateStaffPlan = async (docId, newPlan) => {
    try {
      const staff = fieldStaff.find(s => s.docId === docId);
      const start = staff?.subscriptionStartedAt || new Date().toISOString().split('T')[0];
      const expiry = calculateExpiryDate(start, newPlan);

      const { error } = await supabase
        .from('field_staff')
        .update({ 
          subscription_plan: newPlan,
          subscription_expired_at: expiry,
          subscription_started_at: start
        })
        .eq('id', docId);
      if (error) throw error;
    } catch (err) {
      console.error("Error updating staff plan:", err);
      alert("Failed to update staff license plan.");
    }
  };

  const handleDeleteStaff = async (docId) => {
    if (window.confirm("Are you sure you want to delete this field staff license? This will revoke mobile app access immediately.")) {
      try {
        const { error } = await supabase
          .from('field_staff')
          .delete()
          .eq('id', docId);
        if (error) throw error;
      } catch (err) {
        console.error("Error deleting staff:", err);
        alert("Failed to delete staff license.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-300">
      
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full overflow-hidden shadow-md shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover bg-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-gradient">Chicken Vypar</h1>
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
          <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg shadow-primary-500/30 shrink-0 border-2 border-white/50">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover bg-white" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-gradient leading-none">Chicken Vypar</h1>
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
            onClick={() => { setActiveTab('field_staff'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left font-bold ${activeTab === 'field_staff'
              ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-600/15'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <Smartphone className="w-5 h-5 shrink-0" />
            Field Staff Licenses
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
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Sub. Plan</th>
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
                              <div className="text-[10px] text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-1.5 font-medium">
                                <div>📅 Registered: <span className="font-semibold text-slate-700 dark:text-slate-300">{shop.registeredAt || 'N/A'}</span></div>
                                <div>🚀 Sub Start: <span className="font-semibold text-slate-700 dark:text-slate-300">{shop.subscriptionStartedAt || 'Not Started'}</span></div>
                                {shop.status === 'Deactive' && shop.deactivatedAt && (
                                  <div className="text-red-500 font-semibold">🛑 Deactivated: <span>{shop.deactivatedAt}</span></div>
                                )}
                              </div>
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
                            value={shop.subscriptionPlan || 'Monthly'}
                            onChange={(e) => handleUpdatePlan(shop.customerUniqueId, e.target.value)}
                            className="text-xs font-bold px-3 py-1.5 rounded-full outline-none border border-slate-200 dark:border-slate-700 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                          >
                            <option value="Monthly">Monthly</option>
                            <option value="Quarterly">Quarterly</option>
                            <option value="Half-Yearly">Half-Yearly</option>
                            <option value="Yearly">Yearly</option>
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
                            <option value="Trial">Trial Mode (30 Days)</option>
                            <option value="Deactive">Deactive</option>
                          </select>
                        </td>
                        <td className="p-4 text-right flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => handleCollectPayment(shop)}
                            title="Collect / Process Subscription Payment"
                            className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                          >
                            <CreditCard className="w-4.5 h-4.5" />
                          </button>
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

        {activeTab === 'field_staff' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
              <div>
                <h3 className="text-xl font-extrabold">Field Staff Add-on Licenses</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Generate mobile credentials, assign to wholesalers, and monitor active tracking.</p>
              </div>
              <button 
                onClick={() => {
                  const activeShops = shops.filter(s => s.status === 'Active' || s.status === 'Trial');
                  setNewStaff(prev => ({
                    ...prev,
                    assignedWholesalerId: activeShops[0]?.customerUniqueId || ''
                  }));
                  setShowAddStaffModal(true);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 text-xs flex items-center gap-1.5 cursor-pointer transform hover:scale-105 active:scale-95 transition-all self-start"
              >
                <Plus className="w-4 h-4" /> Add Staff License
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="flex items-center bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800 text-left">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff by name, ID, phone, or client..."
                  value={staffSearchQuery}
                  onChange={e => setStaffSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-xs font-semibold text-slate-805 dark:text-white"
                />
              </div>
            </div>
            {/* Field Staff Table */}
            <div className="glass-panel rounded-3xl border border-slate-200/50 dark:border-slate-800 overflow-hidden shadow-xl bg-white dark:bg-slate-900/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800/80">
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Staff Profile</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Assigned Client (Wholesaler)</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Hardware Telemetry</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">Last Active / Visit</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">License Timeline</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">License Plan</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider">License Status</th>
                      <th className="p-4 text-xs font-black uppercase text-slate-400 tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(() => {
                      const filtered = fieldStaff.filter(staff => {
                        const queryText = staffSearchQuery.toLowerCase();
                        return (
                          staff.name.toLowerCase().includes(queryText) ||
                          staff.staffId.toLowerCase().includes(queryText) ||
                          staff.phone.includes(queryText) ||
                          staff.assignedWholesalerName.toLowerCase().includes(queryText)
                        );
                      });

                      if (filtered.length > 0) {
                        return filtered.map((staff) => {
                          const batPct = staff.batteryPercentage ?? 100;
                          const isCharging = staff.batteryCharging ?? false;
                          const netStatus = staff.networkStatus ?? 'online';

                          // Fallbacks for existing staff documents without timeline dates
                          const regDate = staff.registeredAt || '2026-05-30';
                          const actDate = staff.subscriptionStartedAt || (staff.status === 'Active' ? regDate : '');
                          const expDate = staff.subscriptionExpiredAt || (actDate ? calculateExpiryDate(actDate, staff.subscriptionPlan || 'Monthly') : '');

                          return (
                            <tr key={staff.staffId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold shadow-inner">
                                    <Smartphone className="w-5 h-5 text-red-500" />
                                  </div>
                                  <div>
                                    <span className="block font-black text-slate-800 dark:text-white leading-tight">{staff.name}</span>
                                    <span className="block text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{staff.staffId}</span>
                                    <div className="text-[10px] text-slate-500 mt-2 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-1.5 font-medium">
                                      <div>📱 Phone: <span className="font-semibold text-slate-700 dark:text-slate-300">{staff.phone}</span></div>
                                      <div>🔑 Passcode: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{staff.passcode}</span></div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-sm font-semibold text-slate-605 dark:text-slate-300">
                                <div>
                                  <span className="block font-black text-slate-800 dark:text-white leading-tight">{staff.assignedWholesalerName}</span>
                                  <span className="block text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">{staff.assignedWholesalerId}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    <div className="relative w-7 h-4 border-2 border-slate-400 dark:border-slate-500 rounded-sm p-0.5 flex items-center shrink-0">
                                      <div 
                                        className={`h-full rounded-sm ${
                                          batPct > 50 ? 'bg-emerald-500' : batPct > 20 ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'
                                        }`} 
                                        style={{ width: `${batPct}%` }}
                                      ></div>
                                      <div className="absolute -right-1 top-1 w-0.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-r-sm"></div>
                                      {isCharging && (
                                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white shadow-sm">⚡</span>
                                      )}
                                    </div>
                                    <span className="font-bold text-slate-600 dark:text-slate-350">{batPct}%</span>
                                  </div>

                                  <div className="flex items-center gap-1 text-xs font-semibold">
                                    {netStatus === 'online' ? (
                                      <>
                                        <Wifi className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span className="text-emerald-600 dark:text-emerald-455 text-[11px]">Online</span>
                                      </>
                                    ) : (
                                      <>
                                        <WifiOff className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
                                        <span className="text-rose-600 dark:text-rose-455 text-[11px]">Offline</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-xs font-semibold text-slate-605 dark:text-slate-300">
                                <div>
                                  <span>{staff.lastActive ? formatDateToDDMMYY(new Date(staff.lastActive).toISOString().split('T')[0]) : ''}</span>
                                  <span className="block text-slate-400 text-[10px] mt-0.5">
                                    {staff.lastActive ? new Date(staff.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                                  </span>
                                  {staff.currentShopName && (
                                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-2 font-bold truncate max-w-[130px] border-t border-dashed border-slate-100 dark:border-slate-800 pt-1.5" title={`Visiting ${staff.currentShopName}`}>
                                      📍 {staff.currentShopName}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <div className="space-y-1 font-medium">
                                  <div>📅 Reg: <span className="font-semibold text-slate-700 dark:text-slate-200">{formatDateToDDMMYY(regDate)}</span></div>
                                  <div>🚀 Act: <span className="font-semibold text-slate-700 dark:text-slate-200">{actDate ? formatDateToDDMMYY(actDate) : 'Not Active'}</span></div>
                                  <div>⏳ Exp: <span className={`font-bold ${
                                    expDate && new Date(expDate) < new Date()
                                      ? 'text-rose-600 dark:text-rose-455'
                                      : 'text-slate-700 dark:text-slate-200'
                                  }`}>{expDate ? formatDateToDDMMYY(expDate) : 'N/A'}</span></div>
                                </div>
                              </td>
                              <td className="p-4">
                                <select 
                                  value={staff.subscriptionPlan || 'Monthly'}
                                  onChange={(e) => handleUpdateStaffPlan(staff.docId, e.target.value)}
                                  className="text-xs font-bold px-3 py-1.5 rounded-full outline-none border border-slate-200 dark:border-slate-700 bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                                >
                                  <option value="Trial">Trial 30 Days</option>
                                  <option value="Monthly">Monthly</option>
                                  <option value="Quarterly">Quarterly</option>
                                  <option value="Half-Yearly">Half-Yearly</option>
                                  <option value="Yearly">Yearly</option>
                                </select>
                              </td>
                              <td className="p-4">
                                <select 
                                  value={staff.status}
                                  onChange={(e) => handleUpdateStaffStatus(staff.docId, e.target.value)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none border cursor-pointer ${
                                    staff.status === 'Active'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                      : 'bg-slate-50 text-slate-605 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  }`}
                                >
                                  <option value="Active">Active</option>
                                  <option value="Inactive">Inactive</option>
                                </select>
                              </td>
                              <td className="p-4 text-right">
                                <button 
                                  onClick={() => handleDeleteStaff(staff.docId)}
                                  className="p-2 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-955/20 rounded-xl transition-all cursor-pointer inline-flex items-center justify-center"
                                  title="Delete staff license"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      } else {
                        return (
                          <tr>
                            <td colSpan="8" className="text-center py-12 text-slate-400 dark:text-slate-500 font-medium italic border-none bg-white dark:bg-slate-900/10">
                              No matching field staff licenses found.
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
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

            <h3 className="text-xl font-extrabold tracking-tight mb-2 text-slate-950 dark:text-white">Onboard New Merchant</h3>
            <p className="text-sm text-slate-800 dark:text-slate-300 font-semibold mb-6">Create a licensed tenant dashboard with a verified Customer ID.</p>

            <form onSubmit={handleCreateShop} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Shop Name</label>
                  <input
                    type="text"
                    required
                    value={newShop.shopName}
                    onChange={(e) => setNewShop({ ...newShop, shopName: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="e.g. Royal Chicken Centre"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Proprietor Name</label>
                  <input
                    type="text"
                    required
                    value={newShop.proprietorName}
                    onChange={(e) => setNewShop({ ...newShop, proprietorName: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="e.g. Mohammad Ali"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Contact Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.phone}
                    onChange={(e) => setNewShop({ ...newShop, phone: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="e.g. +91 98321 00000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">GSTIN Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.gstin}
                    onChange={(e) => setNewShop({ ...newShop, gstin: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none uppercase text-slate-950 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="e.g. 27AAAAA1111A1Z1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Aadhar Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.aadharNo}
                    onChange={(e) => setNewShop({ ...newShop, aadharNo: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="e.g. 1234 5678 9012"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">PAN Number</label>
                  <input
                    type="text"
                    required
                    value={newShop.panNo}
                    onChange={(e) => setNewShop({ ...newShop, panNo: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none uppercase text-slate-950 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="e.g. ABCDE1234F"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Shop Address</label>
                <textarea
                  required
                  rows="2"
                  value={newShop.address}
                  onChange={(e) => setNewShop({ ...newShop, address: e.target.value })}
                  className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                  placeholder="Street name, City, State..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Registration Date</label>
                  <input
                    type="date"
                    required
                    value={newShop.registeredAt}
                    onChange={(e) => setNewShop({ ...newShop, registeredAt: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Sub. Start Date</label>
                  <input
                    type="date"
                    value={newShop.subscriptionStartedAt}
                    onChange={(e) => setNewShop({ ...newShop, subscriptionStartedAt: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Deactivation Date</label>
                  <input
                    type="date"
                    value={newShop.deactivatedAt}
                    disabled={newShop.status !== 'Deactive'}
                    onChange={(e) => setNewShop({ ...newShop, deactivatedAt: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-850 text-sm outline-none text-slate-950 dark:text-white font-bold disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Initial License Status</label>
                  <select
                    value={newShop.status}
                    onChange={(e) => setNewShop({ ...newShop, status: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">Trial Mode (30 Days)</option>
                    <option value="Deactive">Deactive</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Subscription Plan</label>
                  <select
                    value={newShop.subscriptionPlan}
                    onChange={(e) => setNewShop({ ...newShop, subscriptionPlan: e.target.value })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-bold"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-Yearly">Half-Yearly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Max Workers Allowance</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newShop.maxWorkers}
                    onChange={(e) => setNewShop({ ...newShop, maxWorkers: parseInt(e.target.value) })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-950 dark:text-white font-black"
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

      {/* RAZORPAY GATEWAY MODAL SIMULATOR FOR ADMIN */}
      {showRazorpay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 text-left">
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
                  <div className="h-8 w-8 bg-rose-600 rounded-lg flex items-center justify-center font-black text-white tracking-widest text-sm shadow-md">
                    CV
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">Chicken Vypar POS</h4>
                    <p className="text-[10px] text-rose-400 font-semibold tracking-wide font-mono">Admin Billing Collection</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowRazorpay(false); setPayingShop(null); }} 
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
                    <span className="text-xs font-bold text-rose-400 tracking-wider uppercase block mb-1">Select Subscription Plan</span>
                    <h3 className="text-base font-bold text-slate-100 truncate">Collect for: <span className="text-rose-400 font-black">{payingShop?.shopName}</span></h3>
                  </div>

                  <div className="space-y-3">
                    {plans.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPlan(p.id)}
                        className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between text-left cursor-pointer ${
                          selectedPlan === p.id
                            ? 'bg-rose-600/10 border-rose-500 shadow-md ring-1 ring-rose-500/20'
                            : 'bg-[#0f2445] border-blue-900/50 hover:border-rose-700/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <div>
                          <span className="font-bold text-slate-100 text-sm block">{p.name}</span>
                          <span className="text-xs text-rose-400 font-semibold mt-0.5 block">Validity: {p.period}</span>
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
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                  >
                    Proceed to Pay ₹{plans.find(p => p.id === selectedPlan)?.price || 500}
                  </button>
                </div>
              )}

              {paymentStep === 'method' && (
                <div className="space-y-5 animate-in slide-in-from-bottom duration-200">
                  <div className="text-center">
                    <span className="text-xs font-bold text-rose-400 tracking-wider uppercase block mb-1">Payment Method Simulator</span>
                    <h3 className="text-lg font-bold text-slate-100">Choose a Simulated Method</h3>
                  </div>

                  <div className="space-y-3">
                    {/* Method Option: UPI */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => { setSelectedMethod('upi'); setPaymentError(''); }}
                        className={`w-full p-4 rounded-xl border transition-all flex items-center gap-3 cursor-pointer ${
                          selectedMethod === 'upi'
                            ? 'bg-rose-600/10 border-rose-500'
                            : 'bg-[#0f2445] border-blue-900/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-rose-400" />
                        <div className="text-left">
                          <span className="font-bold text-sm text-slate-100 block">UPI Instant (GPay / PhonePe)</span>
                          <span className="text-[10px] text-slate-400 block">Pay using simulated UPI ID</span>
                        </div>
                      </button>
                      
                      {selectedMethod === 'upi' && (
                        <div className="p-4 bg-[#0d213d] rounded-xl border border-blue-900/40 space-y-2 animate-in slide-in-from-top duration-200">
                          <input
                            type="text"
                            placeholder="Enter UPI ID (e.g. merchant@upi)"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500"
                          />
                          <p className="text-[10px] text-slate-400 font-semibold">Use any test UPI ID for demo</p>
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
                            ? 'bg-rose-600/10 border-rose-500'
                            : 'bg-[#0f2445] border-blue-900/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <CreditCard className="w-5 h-5 text-rose-400" />
                        <div className="text-left">
                          <span className="font-bold text-sm text-slate-100 block">Credit / Debit Cards</span>
                          <span className="text-[10px] text-slate-400 block">Visa, MasterCard, RuPay</span>
                        </div>
                      </button>
                      
                      {selectedMethod === 'card' && (
                        <div className="p-4 bg-[#0d213d] rounded-xl border border-blue-900/40 space-y-3 animate-in slide-in-from-top duration-200">
                          <input
                            type="text"
                            maxLength="19"
                            placeholder="Card Number (e.g. 4111 2222 3333 4444)"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '₹1 ').trim())}
                            className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              maxLength="5"
                              placeholder="Expiry (MM/YY)"
                              value={cardExpiry}
                              onChange={(e) => setCardExpiry(e.target.value)}
                              className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
                            />
                            <input
                              type="password"
                              maxLength="3"
                              placeholder="CVV"
                              value={cardCvv}
                              onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                              className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500 font-mono"
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
                            ? 'bg-rose-600/10 border-rose-500'
                            : 'bg-[#0f2445] border-blue-900/50 hover:bg-[#122b52]'
                        }`}
                      >
                        <Globe className="w-5 h-5 text-rose-400" />
                        <div className="text-left">
                          <span className="font-bold text-sm text-slate-100 block">Netbanking</span>
                          <span className="text-[10px] text-slate-400 block">All major Indian banks supported</span>
                        </div>
                      </button>
                      
                      {selectedMethod === 'netbanking' && (
                        <div className="p-3 bg-[#0d213d] rounded-xl border border-blue-900/40 animate-in slide-in-from-top duration-200">
                          <select className="w-full p-2.5 bg-[#0b1a30] border border-blue-900 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500">
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
                      className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                    >
                      Pay ₹{plans.find(p => p.id === selectedPlan)?.price || 500} Securely
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
                <div className="py-12 flex flex-col items-center justify-center space-y-5 animate-in zoom-in-95 duration-300 text-center">
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
                    <h4 className="font-black text-white text-xl tracking-tight">Merchant License Activated</h4>
                    <p className="text-xs text-emerald-100 font-semibold opacity-90">Payment logged successfully in system database.</p>
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

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 md:p-8 bg-white dark:bg-slate-900 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left">
            <button 
              onClick={() => setShowAddStaffModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>

            <h3 className="text-xl font-extrabold tracking-tight mb-2 text-slate-950 dark:text-white">Create Staff License</h3>
            <p className="text-sm text-slate-805 dark:text-slate-300 font-semibold mb-6">Allocate credentials and link the license to a Wholesaler.</p>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Staff Full Name</label>
                <input
                  type="text"
                  required
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-955 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={newStaff.phone}
                    onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value.replace(/\D/g,'') })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-955 dark:text-white font-bold placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="10-digit number"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-950 dark:text-slate-200 tracking-wider">4-Digit Login PIN</label>
                  <input
                    type="password"
                    required
                    pattern="[0-9]{4}"
                    maxLength="4"
                    value={newStaff.passcode}
                    onChange={(e) => setNewStaff({ ...newStaff, passcode: e.target.value.replace(/\D/g,'') })}
                    className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none text-slate-955 dark:text-white font-bold text-center tracking-widest text-lg placeholder-slate-500 dark:placeholder-slate-400"
                    placeholder="••••"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-955 dark:text-slate-205 tracking-wider">Assign Wholesaler</label>
                <select
                  value={newStaff.assignedWholesalerId}
                  onChange={(e) => setNewStaff({ ...newStaff, assignedWholesalerId: e.target.value })}
                  className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-bold outline-none text-slate-955 dark:text-white cursor-pointer"
                >
                  <option value="" disabled>-- Select Wholesaler --</option>
                  {shops
                    .filter(s => s.status === 'Active' || s.status === 'Trial')
                    .map(s => {
                      const planText = s.status === 'Trial' ? 'Trial 30 Days' : `${s.subscriptionPlan || 'Monthly'} Plan`;
                      return (
                        <option key={s.customerUniqueId} value={s.customerUniqueId}>
                          {s.shopName} ({s.customerUniqueId}) - {planText}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-955 dark:text-slate-205 tracking-wider">Staff License Plan</label>
                <select
                  value={newStaff.subscriptionPlan}
                  onChange={(e) => setNewStaff({ ...newStaff, subscriptionPlan: e.target.value })}
                  className="w-full p-2.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm font-bold outline-none text-slate-955 dark:text-white cursor-pointer"
                >
                  <option value="Trial">Trial 30 Days</option>
                  <option value="Monthly">Monthly Plan</option>
                  <option value="Quarterly">Quarterly Plan</option>
                  <option value="Half-Yearly">Half-Yearly Plan</option>
                  <option value="Yearly">Yearly Plan</option>
                </select>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStaff}
                  className="flex-[2] py-3 bg-gradient-to-r from-red-655 to-rose-655 hover:from-red-700 hover:to-rose-700 text-white rounded-xl font-bold flex justify-center items-center gap-1.5 transition-all text-xs cursor-pointer shadow-md disabled:opacity-60"
                >
                  {isSavingStaff ? 'Saving...' : 'Generate License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
