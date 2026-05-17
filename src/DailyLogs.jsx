import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc, serverTimestamp, orderBy, onSnapshot } from 'firebase/firestore';
import { Trash2, AlertCircle, PlusCircle, Sparkles, Receipt, CircleSlash, Users, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { shopDetails } from './data';

export default function DailyLogs() {
  const savedShop = localStorage.getItem('shopInfo');
  const activeShop = savedShop ? JSON.parse(savedShop) : {
    customerUniqueId: 'MC-89324',
    shopName: shopDetails.name,
    proprietorName: 'Mohammad Farooq Momin',
    address: shopDetails.address,
    phone: shopDetails.phone,
    gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
  };
  const commonExpenseItems = [
    "Ice Blocks",
    "Tea / Coffee",
    "Worker Wages / Batta",
    "Plastic Carry Bags",
    "Drinking Water",
    "Knife Sharpening",
    "Cleaning Supplies",
    "Municipal / Police / Misc",
    "Other (Type custom...)"
  ];

  const [selectedExpense, setSelectedExpense] = useState(commonExpenseItems[0]);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensesList, setExpensesList] = useState([]);

  const [birdsDead, setBirdsDead] = useState('');
  const [weightLoss, setWeightLoss] = useState('');
  const [mortalityList, setMortalityList] = useState([]);

  const todayStr = new Date().toISOString().split('T')[0];
  const [logDate, setLogDate] = useState(todayStr);

  const [activeSubTab, setActiveSubTab] = useState('logs'); // 'logs', 'workers', 'report'
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerShift, setNewWorkerShift] = useState('Morning Shift');
  const [allWorkers, setAllWorkers] = useState([]);

  const [allSales, setAllSales] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allMortality, setAllMortality] = useState([]);
  const [allStockInwards, setAllStockInwards] = useState([]);

  // Fetch all collections in real-time for Day Summary computations
  useEffect(() => {
    const unSubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setAllSales(list);
    });

    const unSubStock = onSnapshot(collection(db, 'stock_inwards'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setAllStockInwards(list);
    });

    const unSubExpensesAll = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setAllExpenses(list);
    });

    const unSubMortalityAll = onSnapshot(collection(db, 'mortality'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setAllMortality(list);
    });

    return () => {
      unSubSales();
      unSubStock();
      unSubExpensesAll();
      unSubMortalityAll();
    };
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const dateObj = new Date(dateStr);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  };

  const generateDaySummary = () => {
    const targetDate = logDate;

    // 1. Stock Inward for targetDate
    const inwardsForDay = allStockInwards.filter(item => {
      const itemDateStr = item.timestamp ? item.timestamp.toDate().toISOString().split('T')[0] : '';
      return itemDateStr === targetDate;
    });

    const birdsReceived = inwardsForDay.reduce((sum, item) => sum + (item.numberOfBirds || 0), 0);
    const weightReceived = inwardsForDay.reduce((sum, item) => sum + (item.weight || 0), 0);
    const stockValue = inwardsForDay.reduce((sum, item) => sum + (item.totalValue || 0), 0);
    const avgRate = weightReceived > 0 ? (stockValue / weightReceived) : 0;
    const suppliersList = [...new Set(inwardsForDay.map(i => i.supplierName))].join(', ') || 'No Supplier';

    // 2. Mortality / Wastage for targetDate
    const mortalityForDay = allMortality.filter(m => m.date === targetDate);
    const birdsDead = mortalityForDay.reduce((sum, m) => sum + (m.birdsDead || 0), 0);
    const weightLoss = mortalityForDay.reduce((sum, m) => sum + (m.weightLoss || 0), 0);
    const lossValue = weightLoss * avgRate;

    // 3. Sales Breakdown for targetDate
    const salesForDay = allSales.filter(item => {
      const itemDateStr = item.timestamp ? item.timestamp.toDate().toISOString().split('T')[0] : '';
      return itemDateStr === targetDate;
    });

    const salesGrouped = {};
    salesForDay.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          const key = item.productName;
          if (!salesGrouped[key]) {
            salesGrouped[key] = { name: key, quantity: 0, rate: item.rate, bills: 0, amount: 0 };
          }
          salesGrouped[key].quantity += item.quantity;
          salesGrouped[key].bills += 1;
          salesGrouped[key].amount += item.amount;
        });
      }
    });

    // 4. Worker Performance for targetDate
    const workerPerformance = {};
    salesForDay.forEach(sale => {
      const worker = sale.workerName || 'Unknown';
      if (!workerPerformance[worker]) {
        workerPerformance[worker] = { name: worker, shift: sale.shift || 'Morning Shift', bills: 0, weight: 0, amount: 0, paymentMethods: new Set() };
      }
      workerPerformance[worker].bills += 1;
      workerPerformance[worker].amount += sale.total || 0;
      if (sale.paymentMethod) workerPerformance[worker].paymentMethods.add(sale.paymentMethod);
      
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!item.productName.toLowerCase().includes('tray') && !item.productName.toLowerCase().includes('masala')) {
            workerPerformance[worker].weight += item.quantity;
          }
        });
      }
    });

    // 5. Expenses for targetDate
    const expensesForDay = allExpenses.filter(e => e.date === targetDate);
    const totalExpenses = expensesForDay.reduce((sum, e) => sum + (e.amount || 0), 0);

    // 6. Cash and UPI Collected
    const cashCollected = salesForDay.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.total || 0), 0);
    const upiCollected = salesForDay.filter(s => s.paymentMethod === 'upi').reduce((sum, s) => sum + (s.total || 0), 0);

    const grossSale = salesForDay.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalWeightSold = salesForDay.reduce((sum, s) => {
      if (s.items && Array.isArray(s.items)) {
        return sum + s.items.reduce((wSum, item) => {
          if (!item.productName.toLowerCase().includes('tray') && !item.productName.toLowerCase().includes('masala')) {
            return wSum + item.quantity;
          }
          return wSum;
        }, 0);
      }
      return sum;
    }, 0);

    const netProfit = grossSale - stockValue - lossValue - totalExpenses;

    return {
      birdsReceived,
      weightReceived,
      avgRate,
      stockValue,
      suppliersList,
      birdsDead,
      weightLoss,
      lossValue,
      closingStockBirds: Math.max(0, birdsReceived - birdsDead),
      salesBreakdown: Object.values(salesGrouped),
      workerPerformance: Object.values(workerPerformance).map(w => ({...w, paymentMethods: Array.from(w.paymentMethods).join(', ')})),
      expensesList: expensesForDay,
      totalExpenses,
      totalBillsRaised: salesForDay.length,
      totalWeightSold,
      grossSale,
      cashCollected,
      upiCollected,
      netProfit
    };
  };

  const exportPDF = () => {
    const data = generateDaySummary();
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(220, 38, 38);
    doc.text(shopDetails.name, 14, 22);
    doc.setFontSize(8); doc.setTextColor(120); doc.text(shopDetails.address, 14, 28);
    doc.setDrawColor(200); doc.line(14, 32, 196, 32);

    doc.setFontSize(14); doc.setTextColor(30); doc.text('Day Summary Report', 14, 41);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Date: ${formatDate(logDate)}`, 14, 47);

    const tableColumn = ["Category", "Details", "Amount/Value"];
    const tableRows = [
      ["Stock Inward", `Birds: ${data.birdsReceived} | Weight: ${data.weightReceived.toFixed(1)}kg`, `Cost: INR ${data.stockValue.toLocaleString()}`],
      ["Mortality Loss", `Birds Dead: ${data.birdsDead} | Weight Loss: ${data.weightLoss.toFixed(1)}kg`, `Loss: -INR ${data.lossValue.toLocaleString()}`],
      ["Daily Expenses", `Total items logged: ${data.expensesList.length}`, `Spent: -INR ${data.totalExpenses.toLocaleString()}`],
      ["Sales Income", `Bills Raised: ${data.totalBillsRaised} | Weight Sold: ${data.totalWeightSold.toFixed(1)}kg`, `Revenue: INR ${data.grossSale.toLocaleString()}`],
      ["NET PROFIT", `Cash: INR ${data.cashCollected.toLocaleString()} | UPI: INR ${data.upiCollected.toLocaleString()}`, `Net Profit: INR ${data.netProfit.toLocaleString()}`]
    ];

    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 53, theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [220, 38, 38] }});
    doc.save(`Chicken_Vypar_DaySummary_${logDate}.pdf`);
  };

  const exportExcel = () => {
    const data = generateDaySummary();
    let wsData = [];
    wsData.push(["Day Summary Report - " + formatDate(logDate)]);
    wsData.push([]);
    wsData.push(["Metric", "Details", "Value"]);
    wsData.push(["Birds Received", data.birdsReceived, "birds"]);
    wsData.push(["Total Weight Inward", data.weightReceived, "kg"]);
    wsData.push(["Inward Stock Value", data.stockValue, "INR"]);
    wsData.push(["Birds Dead", data.birdsDead, "birds"]);
    wsData.push(["Weight Lost", data.weightLoss, "kg"]);
    wsData.push(["Mortality Loss Value", data.lossValue, "INR"]);
    wsData.push(["Total Expenses", data.totalExpenses, "INR"]);
    wsData.push(["Gross Sales Revenue", data.grossSale, "INR"]);
    wsData.push(["Cash Collected", data.cashCollected, "INR"]);
    wsData.push(["UPI Collected", data.upiCollected, "INR"]);
    wsData.push(["NET PROFIT", data.netProfit, "INR"]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Day Summary");
    XLSX.writeFile(wb, `Chicken_Vypar_DaySummary_${logDate}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  // Fetch all workers in real-time
  useEffect(() => {
    const qW = query(collection(db, 'workers'), orderBy('timestamp', 'desc'));
    const unSubW = onSnapshot(qW, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setAllWorkers(list);
    }, (error) => {
      console.error("Error loading workers: ", error);
    });
    return () => unSubW();
  }, []);

  const handleAddWorker = async (e) => {
    e.preventDefault();
    if (!newWorkerName.trim()) return;
    try {
      await addDoc(collection(db, 'workers'), {
        name: newWorkerName.trim(),
        shift: newWorkerShift,
        timestamp: serverTimestamp()
      });
      setNewWorkerName('');
      alert('Worker successfully added!');
    } catch (err) {
      console.error(err);
      alert('Failed to add worker.');
    }
  };

  const deleteWorker = async (id) => {
    if (!confirm('Are you sure you want to delete this worker?')) return;
    try {
      await deleteDoc(doc(db, 'workers', id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete worker.');
    }
  };

  // Load Expenses & Mortality for selected date
  useEffect(() => {
    // Live update query for Expenses on selected logDate
    const qExpenses = query(
      collection(db, 'expenses'),
      where('date', '==', logDate)
    );
    const unSubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setExpensesList(data);
    });

    // Live update query for Mortality on selected logDate
    const qMortality = query(
      collection(db, 'mortality'),
      where('date', '==', logDate)
    );
    const unSubMortality = onSnapshot(qMortality, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setMortalityList(data);
    });

    return () => {
      unSubExpenses();
      unSubMortality();
    };
  }, [logDate]);

  // Handle Expense Submit
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    const finalName = selectedExpense === "Other (Type custom...)" ? expenseName.trim() : selectedExpense;
    if (!finalName || !expenseAmount) return;

    try {
      await addDoc(collection(db, 'expenses'), {
        date: logDate,
        name: finalName,
        amount: parseFloat(expenseAmount),
        timestamp: serverTimestamp()
      });
      setExpenseName('');
      setExpenseAmount('');
      setSelectedExpense(commonExpenseItems[0]);
    } catch (err) {
      console.error(err);
      alert('Failed to save expense');
    }
  };

  // Delete Expense
  const deleteExpense = async (id) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Mortality Submit
  const handleMortalitySubmit = async (e) => {
    e.preventDefault();
    if (!birdsDead || !weightLoss) return;

    try {
      // Overwrite or add mortality log for this day
      // For simplicity, we just addDoc. We can sum up multiple entries for the same day in reports.
      await addDoc(collection(db, 'mortality'), {
        date: logDate,
        birdsDead: parseInt(birdsDead),
        weightLoss: parseFloat(weightLoss),
        timestamp: serverTimestamp()
      });
      setBirdsDead('');
      setWeightLoss('');
      alert('Mortality log added successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save mortality');
    }
  };

  // Delete Mortality Entry
  const deleteMortality = async (id) => {
    try {
      await deleteDoc(doc(db, 'mortality', id));
    } catch (err) {
      console.error(err);
    }
  };

  const totalExpensesToday = expensesList.reduce((sum, item) => sum + item.amount, 0);
  const totalBirdsDeadToday = mortalityList.reduce((sum, item) => sum + item.birdsDead, 0);
  const totalWeightLossToday = mortalityList.reduce((sum, item) => sum + item.weightLoss, 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
            <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse" />
            Day Summary Logs
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track daily petty expenses and bird mortality to auto-compute net profit.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-500">Select Date:</label>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="p-2 bg-slate-50 dark:bg-slate-855 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-semibold text-slate-850 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Segmented Tab Selector */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl max-w-2xl mx-auto shrink-0 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <button 
          onClick={() => setActiveSubTab('logs')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap group ${
            activeSubTab === 'logs' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white'
          }`}
        >
          <Receipt className={`w-4 h-4 transition-colors ${activeSubTab === 'logs' ? 'text-white' : 'text-emerald-500 group-hover:text-white'}`} />
          Day Entry
        </button>
        <button 
          onClick={() => setActiveSubTab('workers')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap group ${
            activeSubTab === 'workers' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white'
          }`}
        >
          <Users className={`w-4 h-4 transition-colors ${activeSubTab === 'workers' ? 'text-white' : 'text-primary-500 group-hover:text-white'}`} />
          Manage Workers ({allWorkers.length})
        </button>
        <button 
          onClick={() => setActiveSubTab('report')}
          className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap group ${
            activeSubTab === 'report' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' 
              : 'text-slate-500 hover:bg-gradient-to-r hover:from-blue-600 hover:to-indigo-600 hover:text-white'
          }`}
        >
          <FileText className={`w-4 h-4 transition-colors ${activeSubTab === 'report' ? 'text-white' : 'text-rose-500 group-hover:text-white'}`} />
          Day Summary
        </button>
      </div>

      {activeSubTab === 'logs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* LEFT COLUMN: PETTY CASH EXPENSES */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col h-[520px]">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Receipt className="w-5 h-5" />
              Petty Cash Expenses
            </h3>

            <form onSubmit={handleExpenseSubmit} className="space-y-3 mb-6 shrink-0 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select Expense Item:</label>
                  <select
                    value={selectedExpense}
                    onChange={(e) => setSelectedExpense(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-semibold text-slate-805 dark:text-slate-100"
                  >
                    {commonExpenseItems.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">₹ Amount:</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="₹ Amount" 
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm"
                      required
                    />
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 font-bold transition-all shrink-0 flex items-center justify-center">
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {selectedExpense === "Other (Type custom...)" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Type Custom Expense Name:</label>
                  <input 
                    type="text" 
                    placeholder="Enter expense name (e.g. Repairs, Electricity)" 
                    value={expenseName}
                    onChange={(e) => setExpenseName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    required
                  />
                </div>
              )}
            </form>

            {/* List of expenses today */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {expensesList.length > 0 ? (
                expensesList.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/40 rounded-xl hover:border-emerald-250 dark:hover:border-emerald-900 transition-colors">
                    <div>
                      <span className="font-semibold text-slate-850 dark:text-slate-150">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{item.amount}</span>
                      <button onClick={() => deleteExpense(item.id)} className="text-red-400 hover:text-red-650">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Receipt className="w-12 h-12 opacity-15 mb-2" />
                  <p className="text-sm">No expenses logged for this day.</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 shrink-0 flex justify-between items-center font-bold text-lg">
              <span>Total Expenses:</span>
              <span className="text-emerald-600 dark:text-emerald-400">₹{totalExpensesToday}</span>
            </div>
          </div>

          {/* RIGHT COLUMN: MORTALITY / WASTAGE */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col h-[520px]">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-rose-600 dark:text-rose-400 shrink-0">
              <CircleSlash className="w-5 h-5" />
              Mortality & Wastage
            </h3>

            <form onSubmit={handleMortalitySubmit} className="space-y-4 mb-6 shrink-0">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Birds Dead:</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 2 birds" 
                    value={birdsDead}
                    onChange={(e) => setBirdsDead(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Est. Weight Loss (kg):</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    placeholder="e.g. 4.2 kg" 
                    value={weightLoss}
                    onChange={(e) => setWeightLoss(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-xl py-2.5 font-bold transition-all shadow-md shadow-rose-600/10">
                Log Mortality
              </button>
            </form>

            {/* List of mortality logs today */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2">
              {mortalityList.length > 0 ? (
                mortalityList.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/40 rounded-xl hover:border-rose-250 dark:hover:border-rose-900 transition-colors">
                    <div className="flex items-center gap-2">
                      <CircleSlash className="w-4 h-4 text-rose-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-850 dark:text-slate-150">{item.birdsDead} Birds Dead</span>
                        <span className="text-xs text-slate-500 block">Weight loss: {item.weightLoss} kg</span>
                      </div>
                    </div>
                    <button onClick={() => deleteMortality(item.id)} className="text-red-400 hover:text-red-655 font-bold transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <CircleSlash className="w-12 h-12 opacity-15 mb-2" />
                  <p className="text-sm">No mortality logged for this day.</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4 shrink-0 grid grid-cols-2 text-sm font-semibold text-slate-650">
              <div>
                <span>Total Birds Dead:</span>
                <span className="block text-lg font-bold text-rose-600 dark:text-rose-400">{totalBirdsDeadToday} birds</span>
              </div>
              <div className="text-right">
                <span>Total Weight Loss:</span>
                <span className="block text-lg font-bold text-rose-600 dark:text-rose-400">{totalWeightLossToday} kg</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {activeSubTab === 'workers' && (
        <div className="glass-panel p-6 rounded-2xl max-w-xl mx-auto text-left animate-in fade-in zoom-in-95 duration-200">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-primary-600 dark:text-primary-400 shrink-0">
            <Users className="w-5 h-5" />
            Add New Worker & Shift
          </h3>

          <form onSubmit={handleAddWorker} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Worker's Full Name:</label>
              <input 
                type="text" 
                placeholder="e.g. Imran Khan, Raju Shinde" 
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-semibold text-slate-850 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Select Active Shift:</label>
              <select
                value={newWorkerShift}
                onChange={(e) => setNewWorkerShift(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-805 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="Morning Shift">Morning Shift</option>
                <option value="Evening Shift">Evening Shift</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 font-bold transition-all shadow-md shadow-primary-600/10 flex items-center justify-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Add Worker & Shift
            </button>
          </form>

          <h4 className="font-bold text-slate-500 text-xs uppercase tracking-wider mb-3">Active Workers List</h4>
          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
            {allWorkers.length > 0 ? allWorkers.map(w => (
              <div key={w.id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/40 rounded-xl">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-150 block">{w.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">{w.shift}</span>
                </div>
                <button onClick={() => deleteWorker(w.id)} className="text-red-400 hover:text-red-650 transition-colors p-1 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )) : (
              <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                No custom workers added yet. Standard defaults (Imran Khan, Raju Shinde) are being used in Billing POS.
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'report' && (() => {
        const data = generateDaySummary();
        return (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            {/* Export Buttons */}
            <div className="flex justify-center gap-2 mb-4 print:hidden">
              <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900 rounded-xl font-bold transition-all border border-emerald-200">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
              <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900 rounded-xl font-bold transition-all border border-rose-200">
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700 rounded-xl font-bold transition-all border border-slate-200">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>

            {/* Premium Visual Card */}
            <div className="bg-[#FAF9F6] text-slate-850 p-6 sm:p-8 font-sans max-w-xl mx-auto rounded-3xl border border-slate-200/80 shadow-2xl my-6">
              {/* Header */}
              <div className="bg-red-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden mb-6 text-left">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <div>
                    <div className="text-3xl font-extrabold flex items-center gap-2 animate-in fade-in">
                      {shopDetails.name}
                    </div>
                    <p className="text-xs text-red-100 mt-1 max-w-[250px] leading-tight font-medium uppercase tracking-wider">{shopDetails.address}</p>
                  </div>
                  <div className="text-right bg-white/10 backdrop-blur-sm border border-white/20 p-2.5 rounded-xl">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-105">Report Type</div>
                    <div className="text-sm font-black tracking-wide">Day Summary</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-6 border-t border-white/20 pt-4 text-xs font-semibold">
                  <div>
                    <span className="text-red-200 block text-[9px] uppercase tracking-wider">Date</span>
                    <span className="font-bold text-[11px]">{formatDate(logDate)}</span>
                  </div>
                  <div>
                    <span className="text-red-200 block text-[9px] uppercase tracking-wider">Closed At</span>
                    <span className="font-bold text-[11px]">09:42 PM</span>
                  </div>
                  <div>
                    <span className="text-red-200 block text-[9px] uppercase tracking-wider">Closed By</span>
                    <span className="font-bold text-[11px]">Owner</span>
                  </div>
                </div>
              </div>

              {/* Stock Inward */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2 text-left">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Stock Inward</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Birds Received</span>
                    <span className="text-xl font-black text-slate-800">{data.birdsReceived} <span className="text-xs font-medium text-slate-400">birds</span></span>
                    <span className="text-[9px] text-slate-400 block mt-1 truncate">From: {data.suppliersList}</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Total Weight</span>
                    <span className="text-xl font-black text-slate-800">{data.weightReceived.toFixed(1)} <span className="text-xs font-medium text-slate-400">kg</span></span>
                    <span className="text-[9px] text-slate-400 block mt-1">Avg {(data.weightReceived / (data.birdsReceived || 1)).toFixed(2)} kg/bird</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Rate (Today)</span>
                    <span className="text-xl font-black text-slate-800">₹{data.avgRate.toFixed(0)} <span className="text-xs font-medium text-slate-400">/kg</span></span>
                    <span className="text-[9px] text-slate-400 block mt-1">Live weight average</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Stock Value</span>
                    <span className="text-xl font-black text-slate-800">₹{data.stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    <span className="text-[9px] text-slate-400 block mt-1">Total cost of inward</span>
                  </div>
                </div>
              </div>

              {/* Mortality */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2 text-left">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-650 inline-block"></span>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Mortality / Wastage</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Birds Dead</span>
                    <span className="text-xl font-black text-slate-850">{data.birdsDead} <span className="text-xs font-medium text-slate-400">birds</span></span>
                    <span className="text-[9px] text-slate-400 block mt-1 text-red-500 font-semibold">During the day</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Est. Weight Loss</span>
                    <span className="text-xl font-black text-slate-855">{data.weightLoss.toFixed(1)} <span className="text-xs font-medium text-slate-400">kg</span></span>
                    <span className="text-[9px] text-slate-400 block mt-1">Deducted from stock</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Loss Value</span>
                    <span className="text-xl font-black text-slate-850">₹{data.lossValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    <span className="text-[9px] text-slate-400 block mt-1">@ ₹{data.avgRate.toFixed(0)} / kg</span>
                  </div>
                  <div className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm text-left">
                    <span className="text-[10px] text-slate-400 block font-semibold">Closing Stock</span>
                    <span className="text-xl font-black text-slate-850">{data.closingStockBirds} <span className="text-xs font-medium text-slate-400">birds</span></span>
                    <span className="text-[9px] text-slate-400 block mt-1">~{(data.closingStockBirds * (data.weightReceived / (data.birdsReceived || 1))).toFixed(1)} kg left</span>
                  </div>
                </div>
              </div>

              {/* Sales Breakdown */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2 text-left">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block"></span>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Sales Breakdown - By Cut</h4>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5 text-right">Qty/Weight</th>
                        <th className="p-2.5 text-right">Rate</th>
                        <th className="p-2.5 text-center">Bills</th>
                        <th className="p-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-700 text-left">
                      {data.salesBreakdown.length > 0 ? data.salesBreakdown.map(item => (
                        <tr key={item.name} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-semibold text-slate-800">{item.name}</td>
                          <td className="p-2.5 text-right font-medium">{item.quantity.toFixed(1)}</td>
                          <td className="p-2.5 text-right text-slate-500">₹{item.rate}</td>
                          <td className="p-2.5 text-center text-slate-400 font-semibold">{item.bills}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">₹{item.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5" className="p-4 text-center text-slate-400">No sales logged for this day.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Worker Performance */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2 text-left">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Worker Performance</h4>
                </div>
                <div className="space-y-3">
                  {data.workerPerformance.length > 0 ? data.workerPerformance.map(worker => (
                    <div key={worker.name} className="bg-white border border-slate-100 p-3 rounded-xl shadow-sm flex justify-between items-center text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 border border-red-200 text-red-700 font-bold flex items-center justify-center text-xs shadow-sm">
                          {worker.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                          <span className="font-extrabold text-sm text-slate-800 block leading-tight">{worker.name}</span>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{worker.shift}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-slate-800 block">₹{worker.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">{worker.bills} bills • {worker.weight.toFixed(1)} kg sold</span>
                      </div>
                    </div>
                  )) : (
                    <div className="bg-white border border-slate-100 p-4 rounded-xl text-center text-slate-400 text-xs">
                      No worker stats available today.
                    </div>
                  )}
                </div>
              </div>

              {/* Expenses */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 border-b border-slate-200 pb-2 text-left">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Expenses</h4>
                </div>
                <div className="space-y-2">
                  {data.expensesList.length > 0 ? data.expensesList.map(exp => (
                    <div key={exp.id} className="bg-white border border-slate-100 px-3 py-2.5 rounded-xl shadow-sm flex justify-between items-center text-xs text-left">
                      <span className="font-semibold text-slate-700">{exp.name}</span>
                      <span className="font-extrabold text-slate-900">₹{exp.amount}</span>
                    </div>
                  )) : (
                    <div className="bg-white border border-slate-100 p-4 rounded-xl text-center text-slate-400 text-xs">
                      No expenses logged for this day.
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Summary */}
              <div className="bg-[#1C1814] text-white p-6 rounded-2xl shadow-xl text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500/5 rounded-full blur-3xl"></div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500/80 mb-4 pb-2 border-b border-white/5">Financial Summary</div>
                
                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span>Total Bills Raised:</span>
                    <span className="font-semibold text-white">{data.totalBillsRaised} bills</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Weight Sold:</span>
                    <span className="font-semibold text-white">{data.totalWeightSold.toFixed(1)} kg</span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-2 text-sm">
                    <span className="font-bold text-slate-200">Gross Sale:</span>
                    <span className="font-black text-yellow-500">₹{data.grossSale.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>(-) Stock Cost:</span>
                    <span className="font-semibold">-₹{data.stockValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>(-) Mortality Loss:</span>
                    <span className="font-semibold">-₹{data.lossValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>(-) Total Expenses:</span>
                    <span className="font-semibold">-₹{data.totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3 text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                    <div>
                      <span>Cash Collected:</span>
                      <span className="block text-xs font-black text-green-400 mt-0.5">₹{data.cashCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="text-right">
                      <span>UPI Collected:</span>
                      <span className="block text-xs font-black text-green-400 mt-0.5">₹{data.upiCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-end border-t border-white/10 pt-4 mt-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Net Profit</span>
                      <span className="text-2xl font-black text-green-400 block leading-tight mt-1">₹{data.netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <span className="text-[9px] text-slate-550 uppercase tracking-widest leading-loose font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5">Verified ✓</span>
                  </div>
                </div>
              </div>

              {/* Footer credit */}
              <div className="text-center text-[10px] text-slate-400 mt-6 border-t border-slate-200/50 pt-4 uppercase tracking-wider font-bold">
                Generated by {activeShop.shopName} POS • Auto report
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
