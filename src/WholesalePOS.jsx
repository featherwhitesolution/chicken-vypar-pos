import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { ShoppingCart, Search, Plus, Trash2, Printer, CreditCard, Banknote, CheckCircle2, User, Loader2, IndianRupee, Scale, Archive, Truck, Tag, AlertCircle } from 'lucide-react';

export default function WholesalePOS({ products = [] }) {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart state
  const [cart, setCart] = useState([]);

  // Daily wholesale rates from Firestore
  const todayStr = new Date().toISOString().split('T')[0];
  const [dailyRates, setDailyRates] = useState({ chickenRate: null, eggsRate: null });
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Active truck dispatches for linking
  const [activeDispatches, setActiveDispatches] = useState([]);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  
  // Chicken Tare Calculation Form
  const [chickenForm, setChickenForm] = useState({
    birdsCount: '',
    grossWeight: '',
    cratesCount: '',
    crateTare: '2.5',
    chickenType: 'BR'
  });
  
  // Eggs Form
  const [eggsForm, setEggsForm] = useState({ quantity: '', crates: '' });

  // Invoice Crates Ledger Flow
  const [cratesIssued, setCratesIssued] = useState(0);
  const [cratesReturned, setCratesReturned] = useState(0);
  const [isCredit, setIsCredit] = useState(true);
  const [paymentType, setPaymentType] = useState('UPI');
  
  const [isSaving, setIsSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Fetch customers
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'wholesale_customers'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setCustomers(list);
    });
    return unsubscribe;
  }, []);

  // Load today's daily wholesale rate
  useEffect(() => {
    getDoc(doc(db, 'wholesale_rates', todayStr)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setDailyRates({ chickenRate: data.chickenRate, eggsRate: data.eggsRate });
      }
      setRatesLoaded(true);
    });
  }, []);

  // Fetch active truck dispatches for linking
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'truck_dispatches'), (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = { id: d.id, ...d.data() };
        if ((data.status === 'active' || data.status === 'carryover') && data.dispatchDate === todayStr) {
          list.push(data);
        }
      });
      setActiveDispatches(list);
    });
    return unsub;
  }, []);

  // Base rates: daily rate first, fallback to product rate
  const baseChickenRate = dailyRates.chickenRate ?? (products.find(p => p.id === 1)?.rate ?? 150);
  const baseEggsRate = dailyRates.eggsRate ?? (products.find(p => p.id === 16)?.rate ?? 6);

  // Calculate dynamic price per client (base + customer offset)
  const getCustomerRate = (isChicken) => {
    const base = isChicken ? baseChickenRate : baseEggsRate;
    if (!selectedCustomer || !isChicken) return base;
    const offset = parseFloat(selectedCustomer.rateOffset) || 0;
    return Math.max(0, base + offset);
  };


  // Live Calculations for Chicken Form
  const gross = parseFloat(chickenForm.grossWeight) || 0;
  const crates = parseInt(chickenForm.cratesCount) || 0;
  const tarePerCrate = parseFloat(chickenForm.crateTare) || 2.5;
  const computedTare = crates * tarePerCrate;
  const computedNet = Math.max(0, gross - computedTare);
  const currentChickenRate = getCustomerRate(true);
  const estimatedChickenTotal = computedNet * currentChickenRate;

  // Add Chicken to Cart
  const handleAddChicken = (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert("Please select a merchant first.");
      return;
    }
    if (computedNet <= 0 || !chickenForm.birdsCount) {
      alert("Please enter gross weight and bird count.");
      return;
    }

    const item = {
      productId: 1,
      name: `Live Chicken (${chickenForm.chickenType})`,
      chickenType: chickenForm.chickenType,
      birdsCount: parseInt(chickenForm.birdsCount),
      grossWeight: gross,
      cratesCount: crates,
      crateTare: tarePerCrate,
      quantity: computedNet, // net weight in kg
      rate: currentChickenRate,
      unit: 'kg',
      amount: estimatedChickenTotal
    };

    setCart([...cart.filter(c => c.productId !== 1), item]);
    // Pre-fill Crates Issued with cages used in Pos weight calculation
    setCratesIssued(prev => prev || crates);
    // Reset Form
    setChickenForm({
      birdsCount: '',
      grossWeight: '',
      cratesCount: '',
      crateTare: '2.5',
      chickenType: 'BR'
    });
  };

  // Add Eggs to Cart
  const handleAddEggs = (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert("Please select a merchant first.");
      return;
    }
    const qty = parseInt(eggsForm.quantity) || 0;
    if (qty <= 0) {
      alert("Please enter a valid egg quantity.");
      return;
    }

    const eggRate = getCustomerRate(false);
    const item = {
      productId: 16,
      name: 'Eggs',
      quantity: qty, // pieces
      rate: eggRate,
      unit: 'pc',
      amount: qty * eggRate
    };

    setCart([...cart.filter(c => c.productId !== 16), item]);
    setEggsForm({ quantity: '', crates: '' });
  };

  const handleRemoveItem = (id) => {
    setCart(cart.filter(c => c.productId !== id));
  };

  const cartTotal = cart.reduce((acc, curr) => acc + curr.amount, 0);

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      alert("Please select a merchant.");
      return;
    }
    if (cart.length === 0) {
      alert("Cart is empty.");
      return;
    }

    setIsSaving(true);
    try {
       
      const invoiceNo = "WINV-" + Math.floor(100000 + Math.random() * 900000);
      const invoiceDate = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();

      const invoicePayload = {
        invoiceId: invoiceNo,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.shopName,
        route: selectedCustomer.route,
        truckDispatchId: selectedTruckId || null,
        truckNumber: selectedTruckId ? (activeDispatches.find(d => d.id === selectedTruckId)?.truckNumber || '') : '',
        invoiceDate,
        items: cart,
        totalValue: cartTotal,
        cratesIssued: parseInt(cratesIssued) || 0,
        cratesReturned: parseInt(cratesReturned) || 0,
        cratesNetOutstanding: (parseInt(cratesIssued) || 0) - (parseInt(cratesReturned) || 0),
        paymentStatus: isCredit ? "Pending (Credit)" : "Paid",
        paymentMethod: isCredit ? "Credit" : paymentType,
        timestamp
      };

      // 1. Add to Invoices collection
      await addDoc(collection(db, 'wholesale_invoices'), invoicePayload);

      // 2. Add Crates Log if cages are moved
      const netCrates = (parseInt(cratesIssued) || 0) - (parseInt(cratesReturned) || 0);
      if (cratesIssued > 0 || cratesReturned > 0) {
        await addDoc(collection(db, 'crates_ledger'), {
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.shopName,
          date: invoiceDate,
          cratesIssued: parseInt(cratesIssued) || 0,
          cratesReturned: parseInt(cratesReturned) || 0,
          netOutstanding: netCrates,
          invoiceId: invoiceNo,
          timestamp
        });
      }

      // 3. Atomically update wholesale_customers balance and cages count
      const customerRef = doc(db, 'wholesale_customers', selectedCustomer.id);
      await updateDoc(customerRef, {
        outstandingCrates: increment(netCrates),
        outstandingBalance: increment(isCredit ? cartTotal : 0)
      });

      setSavedInvoice(invoicePayload);
      setShowPrintModal(true);
      
      // Reset POS Cart
      setCart([]);
      setCratesIssued(0);
      setCratesReturned(0);
      setSelectedCustomer(null);
    } catch (error) {
      console.error("Wholesale POS checkout error:", error);
      alert("Failed to process wholesale transaction.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredCustomers = customers.filter(c =>
    c.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.route.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Wholesale Billing POS</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Weighbridge net weight deductions, contract-based offset rates, and live crate ledger updates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns: Inputs & Cart Builder */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Merchant Selector */}
          <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">1. Select Merchant</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search merchant shop or route..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
              />
            </div>
            
            {searchQuery && !selectedCustomer && (
              <div className="mt-2 max-h-40 overflow-y-auto bg-white dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg divide-y divide-slate-100 dark:divide-slate-800 z-10 relative">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(cust => (
                    <button
                      key={cust.id}
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setSearchQuery('');
                      }}
                      className="w-full p-3 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 text-xs font-semibold flex justify-between items-center"
                    >
                      <div>
                        <span className="block font-bold text-slate-800 dark:text-white">{cust.shopName}</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">{cust.route} | Proprietor: {cust.proprietorName}</span>
                      </div>
                      <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">Offset: ₹{cust.rateOffset}</span>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-400 text-xs">No merchants found.</div>
                )}
              </div>
            )}

            {selectedCustomer && (
              <div className="mt-4 p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block font-extrabold text-slate-800 dark:text-white text-base">{selectedCustomer.shopName}</span>
                    <span className="block text-xs text-slate-400 font-medium">Route: {selectedCustomer.route} | Phone: {selectedCustomer.phone}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider bg-white dark:bg-slate-900/80 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="block text-[9px] text-slate-400">Offset</span>
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">₹{selectedCustomer.rateOffset}/kg</span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-800 pl-4">
                    <span className="block text-[9px] text-slate-400">Merchant Price</span>
                    <span className="font-black text-slate-800 dark:text-white text-sm">₹{getCustomerRate(true)}/kg</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Weighbridge Tare Deductions Form for Live Chicken */}
          <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-500" />
              2. Log Chicken Weighbridge Batch
            </h3>
            
            <form onSubmit={handleAddChicken} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Breed</label>
                  <select
                    value={chickenForm.chickenType}
                    onChange={e => setChickenForm({ ...chickenForm, chickenType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-850 dark:text-white"
                  >
                    <option value="BR">Broiler (BR)</option>
                    <option value="P">Poultry (P)</option>
                    <option value="D">Desi (D)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={chickenForm.grossWeight}
                    onChange={e => setChickenForm({ ...chickenForm, grossWeight: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-850 dark:text-white"
                    placeholder="0.0"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">No. of Cages / Crates</label>
                  <input
                    type="number"
                    value={chickenForm.cratesCount}
                    onChange={e => setChickenForm({ ...chickenForm, cratesCount: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cage Tare Weight (kg)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={chickenForm.crateTare}
                    onChange={e => setChickenForm({ ...chickenForm, crateTare: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                    placeholder="2.5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Bird Count</label>
                  <input
                    type="number"
                    value={chickenForm.birdsCount}
                    onChange={e => setChickenForm({ ...chickenForm, birdsCount: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                    placeholder="0 Birds"
                  />
                </div>
              </div>

              {/* Dynamic weighbridge calculator review */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex flex-wrap justify-between items-center gap-4 text-xs font-semibold">
                <div className="flex gap-4">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Crate Tare Deductions</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{computedTare.toFixed(1)} kg</span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-800 pl-4">
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Calculated Net Weight</span>
                    <span className="text-emerald-600 dark:text-emerald-450 font-black text-sm">{computedNet.toFixed(1)} kg</span>
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all flex items-center gap-1 shadow-md shadow-emerald-500/10 cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add to Invoice (₹{estimatedChickenTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                </button>
              </div>
            </form>
          </div>

          {/* Add Eggs batch */}
          <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
              <Archive className="w-4 h-4 text-emerald-500" />
              3. Log Egg Batch
            </h3>
            
            <form onSubmit={handleAddEggs} className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 space-y-1 text-left w-full">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Crates (30 pcs/crate)</label>
                <input
                  type="number"
                  step="0.1"
                  value={eggsForm.crates}
                  onChange={e => {
                    const val = e.target.value;
                    setEggsForm({ 
                      crates: val, 
                      quantity: val ? String(Math.round(val * 30)) : ''
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  placeholder="e.g. 10"
                />
              </div>

              <div className="flex-1 space-y-1 text-left w-full">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Egg count (pcs)</label>
                <input
                  type="number"
                  value={eggsForm.quantity}
                  onChange={e => {
                    const val = e.target.value;
                    setEggsForm({ 
                      quantity: val, 
                      crates: val ? String(Number((val / 30).toFixed(2))) : ''
                    });
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  placeholder="e.g. 300"
                />
              </div>

              <div className="text-left w-full sm:w-auto self-stretch sm:self-auto flex items-end">
                <div className="mr-4 text-xs font-semibold py-2.5">
                  <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Rate</span>
                  <span className="text-slate-700 dark:text-slate-350">₹{getCustomerRate(false)} / pc</span>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all flex items-center gap-1 shadow-md shadow-emerald-500/10 cursor-pointer text-xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Eggs
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column: Checkout cart */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 flex flex-col h-full text-left">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <ShoppingCart className="w-5 h-5 text-emerald-500" />
              Invoice Cart
            </h3>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 min-h-[160px] custom-scrollbar">
              {cart.length > 0 ? (
                cart.map(item => (
                  <div key={item.productId} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/20 dark:bg-slate-850/10 flex justify-between items-center text-xs">
                    <div>
                      <span className="block font-bold text-slate-850 dark:text-white">{item.name}</span>
                      <span className="block text-[10px] text-slate-450 mt-0.5">
                        {item.quantity.toFixed(0)} {item.unit} @ ₹{item.rate}/{item.unit}
                        {item.birdsCount ? ` (${item.birdsCount} Birds)` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-slate-800 dark:text-white">₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-955/20 text-rose-500 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 italic text-xs">
                  No items added to invoice yet. Select a merchant and add weighbridge logs or eggs.
                </div>
              )}
            </div>

            {/* Crate Exchange Logs */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 space-y-3">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Empty Cages/Crates Movement</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Cages Issued</label>
                  <input
                    type="number"
                    value={cratesIssued}
                    onChange={e => setCratesIssued(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs font-bold text-center"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase">Cages Returned</label>
                  <input
                    type="number"
                    value={cratesReturned}
                    onChange={e => setCratesReturned(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-xs font-bold text-center"
                  />
                </div>
              </div>
            </div>

            {/* Payment & Settlements Option */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 space-y-3">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Weekly Settlement Terms</h4>
              
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setIsCredit(true)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    isCredit
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-450 hover:text-slate-800'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" /> Credit Account
                </button>
                <button
                  onClick={() => setIsCredit(false)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    !isCredit
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-slate-500 dark:text-slate-450 hover:text-slate-800'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" /> Cash / UPI Paid
                </button>
              </div>

              {!isCredit && (
                <div className="flex justify-around gap-2 text-xs font-bold">
                  <button
                    onClick={() => setPaymentType('UPI')}
                    className={`px-3 py-1.5 rounded-lg border flex-1 transition-all ${paymentType === 'UPI' ? 'border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-750 text-slate-500'}`}
                  >
                    UPI Transfer
                  </button>
                  <button
                    onClick={() => setPaymentType('Cash')}
                    className={`px-3 py-1.5 rounded-lg border flex-1 transition-all ${paymentType === 'Cash' ? 'border-emerald-600 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-750 text-slate-500'}`}
                  >
                    Hard Cash
                  </button>
                </div>
              )}
            </div>

            {/* Total Balance Sheet details */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-xs text-slate-450 font-bold uppercase tracking-wider">Total Invoice Due</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450 leading-none">
                  ₹{cartTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isSaving || cart.length === 0}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base shadow-lg cursor-pointer transform active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Loader2 className="w-5 h-5 animate-spin" /> Saving Invoice...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <Printer className="w-5 h-5" /> Save & Print Invoice Slip
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Invoice Slip Print Modal */}
      {showPrintModal && savedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setShowPrintModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-955/20 text-slate-500 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
            >
              &times;
            </button>
            
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-4">Invoice Issued Successfully!</h3>
            
            {/* Embedded Print Challan Layout */}
            <div className="border border-slate-200 dark:border-slate-800 p-4 rounded-2xl bg-white dark:bg-slate-950 font-mono text-[10px] text-slate-850 dark:text-slate-200 space-y-3 leading-relaxed print:p-0 print:border-none">
              <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-2">
                <h4 className="text-xs font-black uppercase">MOMIN WHOLESALE CHICKEN</h4>
                <p className="text-[8px] text-slate-500">Logistics & Poultry Distributors</p>
                <p className="text-[8px] text-slate-500 mt-1">Invoice: {savedInvoice.invoiceId}</p>
                <p className="text-[8px] text-slate-500">Date: {savedInvoice.invoiceDate}</p>
              </div>

              <div>
                <p><span className="font-bold">Client:</span> {savedInvoice.customerName}</p>
                <p><span className="font-bold">Route:</span> {savedInvoice.route}</p>
              </div>

              <div className="border-t border-b border-dashed border-slate-300 dark:border-slate-700 py-1.5">
                <table className="w-full text-left">
                  <thead>
                    <tr className="font-bold">
                      <th>Item</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="truncate max-w-[80px]">
                          {item.name}
                          {item.birdsCount ? ` (${item.birdsCount}B)` : ''}
                        </td>
                        <td className="text-right">{item.quantity.toFixed(1)}</td>
                        <td className="text-right">₹{item.rate}</td>
                        <td className="text-right">₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {savedInvoice.items.some(i => i.productId === 1) && (
                <div className="text-[8px] text-slate-500 space-y-0.5 border-b border-dashed border-slate-300 dark:border-slate-700 pb-1.5">
                  <p className="font-bold">Weighbridge Breakdown:</p>
                  {savedInvoice.items.filter(i => i.productId === 1).map((item, idx) => (
                    <p key={idx}>Gross: {item.grossWeight} kg | Crates: {item.cratesCount} ({item.crateTare}kg tare) | Net: {item.quantity.toFixed(1)} kg</p>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>Grand Total:</span>
                  <span>₹{savedInvoice.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terms:</span>
                  <span className="font-bold">{savedInvoice.paymentMethod}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 text-[8px] space-y-0.5">
                <p className="font-bold">Crate Transaction Summary:</p>
                <p>Cages Sent: {savedInvoice.cratesIssued} | Cages Returned: {savedInvoice.cratesReturned}</p>
                <p>Net Cage Balance: {savedInvoice.cratesNetOutstanding > 0 ? `+${savedInvoice.cratesNetOutstanding}` : savedInvoice.cratesNetOutstanding} cages</p>
              </div>

              <div className="text-center pt-2 text-[8px] text-slate-400">
                Thank you for your business.
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-md shadow-emerald-500/10 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Bill
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
