import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc, getDoc, addDoc } from 'firebase/firestore';
import { DollarSign, Archive, UserCheck, TrendingUp, FileText, Compass, AlertTriangle, Sparkles, Map, IndianRupee, Save, RotateCcw, Loader2, Tag, Skull, Activity, PieChart as PieChartIcon } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

export default function WholesaleDashboard({ products = [] }) {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [dispatches, setDispatches] = useState([]);

  // Wholesale rates state
  const todayStr = new Date().toISOString().split('T')[0];
  const [rates, setRates] = useState({ chickenRate: '', eggsRate: '' });
  const [rateSaved, setRateSaved] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Mortality state
  const [showMortalityModal, setShowMortalityModal] = useState(false);
  const [mortalityForm, setMortalityForm] = useState({ date: todayStr, weightKg: '', count: '', notes: '' });
  const [isSavingMortality, setIsSavingMortality] = useState(false);

  // Fetch customers
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'wholesale_customers'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setCustomers(list);
    });
    return unsubscribe;
  }, []);

  // Fetch recent invoices
  useEffect(() => {
    const q = query(collection(db, 'wholesale_invoices'), orderBy('timestamp', 'desc'), limit(15));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setInvoices(list);
    });
    return unsubscribe;
  }, []);

  // Fetch today's truck dispatches for carry-over banner
  useEffect(() => {
    const q = query(collection(db, 'truck_dispatches'), orderBy('dispatchDate', 'desc'), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setDispatches(list);
    });
    return unsub;
  }, []);

  // Load today's wholesale rates from Firestore
  useEffect(() => {
    getDoc(doc(db, 'wholesale_rates', todayStr)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setRates({ chickenRate: data.chickenRate || '', eggsRate: data.eggsRate || '' });
      }
    });
  }, []);

  const handleSaveRates = async () => {
    if (!rates.chickenRate) { alert('Please enter chicken rate.'); return; }
    setIsSavingRate(true);
    try {
      await setDoc(doc(db, 'wholesale_rates', todayStr), {
        date: todayStr,
        chickenRate: parseFloat(rates.chickenRate) || 0,
        eggsRate: parseFloat(rates.eggsRate) || 0,
        updatedAt: new Date().toISOString(),
      });
      setRateSaved(true);
      setTimeout(() => setRateSaved(false), 3000);
    } catch (e) {
      console.error(e);
      alert('Failed to save rates.');
    } finally {
      setIsSavingRate(false);
    }
  };

  const handleSaveMortality = async (e) => {
    e.preventDefault();
    if (!mortalityForm.weightKg || !mortalityForm.count) {
      alert("Please enter both weight and count.");
      return;
    }
    setIsSavingMortality(true);
    try {
      await addDoc(collection(db, 'wholesale_mortality'), {
        date: mortalityForm.date,
        weightKg: parseFloat(mortalityForm.weightKg),
        count: parseInt(mortalityForm.count),
        notes: mortalityForm.notes.trim(),
        source: 'shop_floor',
        timestamp: new Date().toISOString()
      });
      setShowMortalityModal(false);
      setMortalityForm({ date: todayStr, weightKg: '', count: '', notes: '' });
    } catch (err) {
      console.error(err);
      alert("Failed to log mortality.");
    } finally {
      setIsSavingMortality(false);
    }
  };

  // Compute stats
  const totalClients = customers.length;
  const totalOutstandingCredit = customers.reduce((acc, curr) => acc + (curr.outstandingBalance || 0), 0);
  const circulatingCrates = customers.reduce((acc, curr) => acc + (curr.outstandingCrates || 0), 0);

  // Calculate Today's wholesale sales
  const todaySales = invoices
    .filter(inv => inv.invoiceDate === todayStr)
    .reduce((acc, curr) => acc + curr.totalValue, 0);

  // Filter customers that have pinned GPS locations
  const mappedCustomers = customers.filter(c => c.location && c.location.lat && c.location.lng);

  // Calculate bounds for normalized plotting on SVG Grid
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  if (mappedCustomers.length > 0) {
    mappedCustomers.forEach(c => {
      if (c.location.lat < minLat) minLat = c.location.lat;
      if (c.location.lat > maxLat) maxLat = c.location.lat;
      if (c.location.lng < minLng) minLng = c.location.lng;
      if (c.location.lng > maxLng) maxLng = c.location.lng;
    });
  }

  // Margin buffer to prevent pins on the edges
  const latDiff = maxLat - minLat || 0.01;
  const lngDiff = maxLng - minLng || 0.01;

  // Normalized coordinates helper
  const getSvgCoordinates = (lat, lng) => {
    const width = 500;
    const height = 260;
    const padding = 40;

    // Normalizing values (0 to 1)
    const normX = (lng - minLng) / lngDiff;
    // SVG y-axis is inverted
    const normY = 1 - ((lat - minLat) / latDiff);

    return {
      x: padding + normX * (width - padding * 2),
      y: padding + normY * (height - padding * 2)
    };
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  // --- CHART DATA COMPUTATION ---
  
  // 1. Sales Trend (Last 7 Days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const salesTrendData = last7Days.map(dateStr => {
    const dayInvoices = invoices.filter(inv => inv.invoiceDate === dateStr);
    const revenue = dayInvoices.reduce((acc, inv) => acc + (inv.totalValue || 0), 0);
    const volume = dayInvoices.reduce((acc, inv) => {
      let invVol = 0;
      if (inv.items) {
        invVol = inv.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
      }
      return acc + invVol;
    }, 0);
    
    // Short date for x-axis
    const [y, m, d] = dateStr.split('-');
    return { date: `${d}/${m}`, revenue, volume, fullDate: dateStr };
  });

  // 2. Top Debtors (Top 5 + Others)
  const debtorsSorted = [...customers]
    .filter(c => (c.outstandingBalance || 0) > 0)
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
    
  let debtorsData = [];
  if (debtorsSorted.length > 0) {
    const top5 = debtorsSorted.slice(0, 5);
    const others = debtorsSorted.slice(5).reduce((acc, c) => acc + c.outstandingBalance, 0);
    
    debtorsData = top5.map(c => ({ name: c.shopName.substring(0, 15), value: c.outstandingBalance }));
    if (others > 0) {
      debtorsData.push({ name: 'Others', value: others });
    }
  }

  const COLORS = ['#f43f5e', '#f97316', '#eab308', '#84cc16', '#14b8a6', '#64748b'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 text-xs text-left">
          <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="font-medium">
              {entry.name}: {entry.name === 'Revenue' || entry.name === 'value' ? '₹' : ''}
              {Number(entry.value).toLocaleString('en-IN', { maximumFractionDigits: entry.name === 'Volume' ? 1 : 0 })} 
              {entry.name === 'Volume' ? ' kg' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Wholesale Dashboard</h2>
        </div>
        <button
          onClick={() => setShowMortalityModal(true)}
          className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 px-4 py-2 rounded-xl font-bold transition-colors text-sm"
        >
          <Skull className="w-4 h-4" />
          Log Floor Mortality
        </button>
      </div>

      {/* Carry-Over Banner */}
      {dispatches.filter(d => d.status === 'carryover' && d.dispatchDate === todayStr).length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
          <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-blue-700 dark:text-blue-300 text-sm">
              Carry-Over Stock Today
            </p>
            {dispatches.filter(d => d.status === 'carryover' && d.dispatchDate === todayStr).map(co => (
              <p key={co.id} className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                🚛 {co.truckNumber} — {co.remainingWeightKg} kg from {co.carryOverDate} at locked ₹{co.ratePerKg}/kg
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Wholesale Rate Setting */}
      <div className="glass-panel p-5 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Tag className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Today's Wholesale Rates</h3>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-mono">{todayStr}</span>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">🐔 Live Chicken</span>
              <span className="text-xs text-slate-400">₹</span>
              <input
                type="number"
                step="0.5"
                value={rates.chickenRate}
                onChange={e => setRates({ ...rates, chickenRate: e.target.value })}
                className="w-20 bg-transparent outline-none text-sm font-black text-emerald-600 dark:text-emerald-400"
                placeholder="0"
              />
              <span className="text-[10px] text-slate-400">/kg</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">🥚 Eggs</span>
              <span className="text-xs text-slate-400">₹</span>
              <input
                type="number"
                step="0.5"
                value={rates.eggsRate}
                onChange={e => setRates({ ...rates, eggsRate: e.target.value })}
                className="w-20 bg-transparent outline-none text-sm font-black text-emerald-600 dark:text-emerald-400"
                placeholder="0"
              />
              <span className="text-[10px] text-slate-400">/pc</span>
            </div>

            <button
              onClick={handleSaveRates}
              disabled={isSavingRate}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 shadow-md"
            >
              {isSavingRate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {rateSaved ? 'Saved ✓' : 'Set Rates'}
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        
        {/* Today's Sales */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Today's Sales (B2B)</h4>
          <div>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                ₹{todaySales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 uppercase">Live</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Sum of all wholesale bills issued today</p>
          </div>
        </div>

        {/* Total Credit Dues */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Outstanding Credit Book</h4>
          <div>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400">
                ₹{totalOutstandingCredit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-955/20 dark:text-rose-400 uppercase">Ledger</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Pending week-end dues from B2B merchants</p>
          </div>
        </div>

        {/* Circulating Crates */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Circulating Cages</h4>
          <div>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-black text-amber-500">
                {circulatingCrates} pcs
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400 uppercase">Held</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Plastic chicken crates currently out at shops</p>
          </div>
        </div>

        {/* Active Merchant Profiles */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 relative overflow-hidden flex flex-col justify-between hover:-translate-y-1 transition-transform">
          <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Active B2B Merchants</h4>
          <div>
            <div className="flex items-end justify-between">
              <span className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white">
                {totalClients} Clients
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-650 dark:bg-slate-800 dark:text-slate-350 uppercase">Active</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">Registered business accounts under directory</p>
          </div>
        </div>

      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 flex flex-col justify-between animate-in fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Activity className="w-5 h-5 text-emerald-500" /> 7-Day Revenue & Volume Trend
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10}
                />
                <YAxis 
                  yAxisId="left" 
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  axisLine={false} 
                  tickLine={false} 
                  dx={-10}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  tickFormatter={(val) => `${val}kg`} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  axisLine={false} 
                  tickLine={false} 
                  dx={10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Revenue" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                />
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="volume" 
                  name="Volume" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                  activeDot={{ r: 6, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Debtors Pie Chart */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 flex flex-col h-full animate-in fade-in">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <PieChartIcon className="w-5 h-5 text-rose-500" /> Credit Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-4 text-left">Top 5 merchants by outstanding balance</p>
          
          <div className="flex-1 min-h-[250px] relative">
            {debtorsData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={debtorsData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {debtorsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center text for donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: '-10%' }}>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</span>
                  <span className="text-sm font-black text-rose-500">
                    ₹{(totalOutstandingCredit / 1000).toFixed(1)}k
                  </span>
                </div>

                {/* Custom slim legend */}
                <div className="flex flex-col gap-1.5 mt-2 max-h-[80px] overflow-y-auto custom-scrollbar">
                  {debtorsData.map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                        <span className="text-slate-600 dark:text-slate-300 font-medium truncate">{entry.name}</span>
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        ₹{entry.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-slate-400">
                <Archive className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-medium">No outstanding credit</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Interactive SVG Maps Locator Node */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Map className="w-5 h-5 text-emerald-500" /> B2B Logistics Map Hub
            </h3>
            <span className="text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold uppercase">GPS coordinates plot</span>
          </div>

          {/* SVG Map Panel */}
          <div className="relative border border-slate-100 dark:border-slate-800 bg-[#f7fafc] dark:bg-slate-950 rounded-2xl overflow-hidden aspect-[500/260] w-full flex items-center justify-center">
            {mappedCustomers.length > 0 ? (
              <svg viewBox="0 0 500 260" className="w-full h-full">
                {/* SVG Grid ticks */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(16, 185, 129, 0.05)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Path Lines linking merchants in the same route */}
                {Object.entries(
                  mappedCustomers.reduce((acc, curr) => {
                    if (!acc[curr.route]) acc[curr.route] = [];
                    acc[curr.route].push(curr);
                    return acc;
                  }, {})
                ).map(([route, list], rIdx) => {
                  if (list.length < 2) return null;
                  // Sort list to draw a sequential line path
                  const sorted = [...list].sort((a,b) => a.location.lng - b.location.lng);
                  const pathD = sorted.map((c, idx) => {
                    const coords = getSvgCoordinates(c.location.lat, c.location.lng);
                    return `${idx === 0 ? 'M' : 'L'} ${coords.x} ${coords.y}`;
                  }).join(' ');

                  return (
                    <path
                      key={rIdx}
                      d={pathD}
                      fill="none"
                      stroke="rgba(16, 185, 129, 0.25)"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  );
                })}

                {/* Plot Pins */}
                {mappedCustomers.map(cust => {
                  const coords = getSvgCoordinates(cust.location.lat, cust.location.lng);
                  const hasDue = (cust.outstandingBalance || 0) > 0;
                  
                  return (
                    <g
                      key={cust.id}
                      onClick={() => setSelectedPin(cust)}
                      className="cursor-pointer group"
                    >
                      {/* Pulsing ring if there are dues */}
                      {hasDue && (
                        <circle
                          cx={coords.x}
                          cy={coords.y}
                          r="9"
                          className="fill-rose-500/20 stroke-rose-500/40 animate-ping"
                          style={{ transformOrigin: `${coords.x}px ${coords.y}px` }}
                        />
                      )}
                      
                      {/* Pin Outer Ring */}
                      <circle
                        cx={coords.x}
                        cy={coords.y}
                        r="6"
                        className={`stroke-2 transition-all ${
                          hasDue 
                            ? 'fill-rose-500 stroke-white group-hover:scale-125' 
                            : 'fill-emerald-500 stroke-white group-hover:scale-125'
                        }`}
                        style={{ transformOrigin: `${coords.x}px ${coords.y}px` }}
                      />
                      
                      {/* Hover text label */}
                      <text
                        x={coords.x}
                        y={coords.y - 10}
                        textAnchor="middle"
                        className="fill-slate-600 dark:fill-slate-400 font-bold text-[8px] opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 pointer-events-none"
                      >
                        {cust.shopName}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 text-xs p-6 gap-2 text-center">
                <Compass className="w-8 h-8 text-slate-350 animate-spin" />
                <span>Waiting for pinned client coordinates...</span>
                <span className="text-[10px] text-slate-500">Go to Customers Directory and Pin coordinates to generate live logistics nodes.</span>
              </div>
            )}

            {/* Clicked node detail drawer */}
            {selectedPin && (
              <div className="absolute bottom-3 left-3 right-3 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg flex justify-between items-center text-xs animate-in slide-in-from-bottom-3 duration-250">
                <div className="text-left">
                  <span className="font-extrabold text-slate-850 dark:text-white block">{selectedPin.shopName}</span>
                  <span className="text-[10px] text-slate-400 block font-medium mt-0.5">Route: {selectedPin.route} | Phone: {selectedPin.phone}</span>
                </div>
                <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-800 pl-4 text-right">
                  <div>
                    <span className="text-[9px] text-slate-450 block font-bold">Outstanding Dues</span>
                    <span className={`font-black ${selectedPin.outstandingBalance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      ₹{(selectedPin.outstandingBalance || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedPin(null)}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full font-bold"
                  >
                    &times;
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent wholesale Invoices log */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 flex flex-col h-full">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-500" /> Recent Invoices
          </h3>

          <div className="overflow-y-auto max-h-[260px] space-y-3 pr-2 custom-scrollbar flex-1">
            {invoices.length > 0 ? (
              invoices.map(inv => (
                <div key={inv.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-850/10 flex flex-col gap-1 text-xs text-left">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-800 dark:text-white truncate max-w-[140px]">{inv.customerName}</span>
                    <span className="text-slate-400 text-[10px] font-mono">{inv.invoiceId}</span>
                  </div>
                  
                  <div className="flex justify-between text-slate-450 mt-1 border-t border-slate-100 dark:border-slate-800/50 pt-1.5 text-[10px]">
                    <span>{formatDate(inv.invoiceDate)}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-350">
                      {inv.items.map(item => `${item.quantity.toFixed(0)} ${item.unit}`).join(', ')}
                    </span>
                    <span className="text-emerald-600 font-extrabold">₹{inv.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-12 italic text-xs">No invoices issued recently.</div>
            )}
          </div>
        </div>

      </div>

      {/* Mortality Modal */}
      {showMortalityModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 text-left">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2 mb-4">
              <Skull className="w-5 h-5 text-red-500" /> Log Floor Mortality
            </h3>
            
            <form onSubmit={handleSaveMortality} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Date</label>
                <input
                  type="date" required
                  value={mortalityForm.date}
                  onChange={e => setMortalityForm({ ...mortalityForm, date: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Wt (kg)</label>
                  <input
                    type="number" step="0.01" required
                    value={mortalityForm.weightKg}
                    onChange={e => setMortalityForm({ ...mortalityForm, weightKg: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-lg font-black text-red-600 dark:text-red-400"
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Bird Count</label>
                  <input
                    type="number" required
                    value={mortalityForm.count}
                    onChange={e => setMortalityForm({ ...mortalityForm, count: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-lg font-black text-red-600 dark:text-red-400"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason / Notes</label>
                <input
                  type="text"
                  value={mortalityForm.notes}
                  onChange={e => setMortalityForm({ ...mortalityForm, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm"
                  placeholder="e.g. Found dead in morning"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowMortalityModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingMortality}
                  className="flex-[2] py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isSavingMortality ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
