import React, { useState, useEffect } from 'react';
import { Calendar, Download, Printer, FileSpreadsheet, FileText, Filter, Factory } from 'lucide-react';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { shopDetails } from './data';

const initialSuppliers = [
  { id: 1, name: 'Suguna Foods (Pune)' },
  { id: 2, name: "Venky's (Pune)" },
  { id: 3, name: 'Baramati Agro' },
  { id: 4, name: 'Premium Chick Feeds (Jalgaon)' },
  { id: 5, name: 'Godrej Agrovet' },
  { id: 6, name: 'Sneha Farms' }
];

const formatDate = (dateInput) => {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function Reports() {
  const savedShop = localStorage.getItem('shopInfo');
  const activeShop = savedShop ? JSON.parse(savedShop) : {
    customerUniqueId: 'MC-89324',
    shopName: shopDetails.name,
    proprietorName: 'Mohammad Farooq Momin',
    address: shopDetails.address,
    phone: shopDetails.phone,
    gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
  };
  const [reportType, setReportType] = useState('outstanding_balances');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  
  // Date filters
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  
  // Data State
  const [stockInwards, setStockInwards] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [mortality, setMortality] = useState([]);

  // Fetch all required data once
  useEffect(() => {
    // 1. Fetch Stock Inwards
    const qInwards = query(collection(db, 'stock_inwards'), orderBy('timestamp', 'desc'));
    const unSubInwards = onSnapshot(qInwards, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setStockInwards(data);
    });

    // 2. Fetch Supplier Payments
    const qPayments = query(collection(db, 'supplier_payments'), orderBy('timestamp', 'desc'));
    const unSubPayments = onSnapshot(qPayments, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setSupplierPayments(data);
    });

    // 3. Fetch Sales
    const qSales = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    const unSubSales = onSnapshot(qSales, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setSales(data);
    });

    // 4. Fetch Expenses
    const qExpenses = query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
    const unSubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setExpenses(data);
    });

    // 5. Fetch Mortality
    const qMortality = query(collection(db, 'mortality'), orderBy('timestamp', 'desc'));
    const unSubMortality = onSnapshot(qMortality, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setMortality(data);
    });

    return () => {
      unSubInwards();
      unSubPayments();
      unSubSales();
      unSubExpenses();
      unSubMortality();
    };
  }, []);

  // Filter Helper
  const isDateInRange = (dateObj, from, to) => {
    if (!dateObj) return true;
    return dateObj >= from && dateObj <= to;
  };
  
  const isDateBefore = (dateObj, date) => {
    if (!dateObj) return false;
    return dateObj < date;
  };

  // -------------------------------------------------------------
  // DATA PROCESSING: OUTSTANDING BALANCES
  // -------------------------------------------------------------
  const generateOutstandingBalances = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    let summary = {};
    initialSuppliers.forEach(s => {
      summary[s.id] = { name: s.name, opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 };
    });

    // We must process ALL inward records to find true outstanding
    stockInwards.forEach(item => {
      const sId = item.supplierId;
      if (!summary[sId]) summary[sId] = { name: item.supplierName, opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 };
      
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date();
      const amount = item.totalValue || 0;

      if (isDateBefore(itemDate, from)) {
        summary[sId].opening += amount;
      } else if (isDateInRange(itemDate, from, to)) {
        summary[sId].newBills += amount;
      }
      summary[sId].netDue += amount;
    });

    // Process all payments
    supplierPayments.forEach(item => {
      const sId = item.supplierId;
      if (!summary[sId]) summary[sId] = { name: item.supplierName, opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 };
      
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date(item.paymentDate);
      const amount = item.amount || 0;

      if (isDateBefore(itemDate, from)) {
        summary[sId].opening -= amount;
      } else if (isDateInRange(itemDate, from, to)) {
        summary[sId].moneyPaid += amount;
      }
      summary[sId].netDue -= amount;
    });

    // Convert to array and filter out true 0s to keep it clean (optional, but good for UX)
    return Object.values(summary).filter(s => Math.abs(s.opening) > 0 || s.newBills > 0 || s.moneyPaid > 0 || Math.abs(s.netDue) > 0);
  };

  // -------------------------------------------------------------
  // DATA PROCESSING: SUPPLIER LEDGER (TIMELINE)
  // -------------------------------------------------------------
  const generateSupplierLedger = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    let openingBalance = 0;
    let timeline = [];

    // Filter Inwards for this supplier
    stockInwards.filter(i => selectedSupplier === 'ALL' || i.supplierId === parseInt(selectedSupplier)).forEach(item => {
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date();
      const amount = item.totalValue || 0;
      
      if (isDateBefore(itemDate, from)) {
        openingBalance += amount;
      } else if (isDateInRange(itemDate, from, to)) {
        const descPrefix = selectedSupplier === 'ALL' ? `[${item.supplierName}] ` : '';
        timeline.push({
          id: item.id,
          date: itemDate,
          type: 'bill',
          description: `🚚 ${descPrefix}Delivery: ${item.numberOfBirds} ${item.chickenType} (${item.weight}kg @ ₹${item.rate})`,
          billAmount: amount,
          paymentAmount: 0
        });
      }
    });

    // Filter Payments for this supplier
    supplierPayments.filter(i => selectedSupplier === 'ALL' || i.supplierId === parseInt(selectedSupplier)).forEach(item => {
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date(item.paymentDate);
      const amount = item.amount || 0;
      
      if (isDateBefore(itemDate, from)) {
        openingBalance -= amount;
      } else if (isDateInRange(itemDate, from, to)) {
        const descPrefix = selectedSupplier === 'ALL' ? `[${item.supplierName}] ` : '';
        let paymentDesc = `💵 ${descPrefix}Payment: ${item.paymentMode}`;
        if (item.paymentMode === 'Cheque') paymentDesc += ` (${item.bankName?.split(' ')[0]} #${item.referenceNo})`;
        if (item.paymentMode === 'Bank Transfer') paymentDesc += ` (Ref: ${item.referenceNo})`;

        timeline.push({
          id: item.id,
          date: itemDate,
          type: 'payment',
          description: paymentDesc,
          billAmount: 0,
          paymentAmount: amount
        });
      }
    });

    // Sort Chronologically
    timeline.sort((a, b) => a.date - b.date);

    // Calculate Running Balance
    let runningBalance = openingBalance;
    const finalLedger = timeline.map(t => {
      runningBalance = runningBalance + t.billAmount - t.paymentAmount;
      return { ...t, balance: runningBalance };
    });

    return { openingBalance, timeline: finalLedger, closingBalance: runningBalance };
  };



  // -------------------------------------------------------------
  // DATA PROCESSING: RAW STOCK INWARD
  // -------------------------------------------------------------
  const generateRawStockInward = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);
    
    return stockInwards.filter(item => {
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date();
      return isDateInRange(itemDate, from, to);
    });
  };

  // View Computations
  const outstandingData = reportType === 'outstanding_balances' ? generateOutstandingBalances() : [];
  const ledgerData = reportType === 'supplier_ledger' ? generateSupplierLedger() : { timeline: [] };
  const rawData = reportType === 'stock_inward' ? generateRawStockInward() : [];

  // Totals for Outstanding Balances
  const totalOutstandingDue = outstandingData.reduce((sum, s) => sum + s.netDue, 0);
  
  // Totals for Raw Stock
  const rawTotalWeight = rawData.reduce((sum, item) => sum + (item.weight || 0), 0);
  const rawTotalBirds = rawData.reduce((sum, item) => sum + (item.numberOfBirds || 0), 0);
  const rawTotalValue = rawData.reduce((sum, item) => sum + (item.totalValue || 0), 0);

  // --- EXPORT FUNCTIONS ---
  const handlePrint = () => window.print();

  const exportPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Header
    doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
    doc.setFontSize(9); doc.setTextColor(80); doc.text(`Proprietor: ${activeShop.proprietorName}`, 14, 25);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`${activeShop.address} | Phone: ${activeShop.phone}`, 14, 30);
    doc.text(`GSTIN: ${activeShop.gstin}`, 14, 35);
    
    doc.setFontSize(14); doc.setTextColor(40);
    
    if (reportType === 'outstanding_balances') {
      doc.text('Outstanding Balances (Summary)', 14, 41);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`As on Date: ${formatDate(toDate)}`, 14, 47);

      const tableColumn = ["Supplier", "Previous Due", "New Bills", "Money Paid", "Net Due Now"];
      const tableRows = outstandingData.map(s => [
        s.name, s.opening.toFixed(2), s.newBills.toFixed(2), s.moneyPaid.toFixed(2), 
        `${s.netDue >= 0 ? '' : 'Adv '}${Math.abs(s.netDue).toFixed(2)}`
      ]);
      
      tableRows.push(['TOTAL', '-', '-', '-', `${totalOutstandingDue >= 0 ? '' : 'Adv '}${Math.abs(totalOutstandingDue).toFixed(2)}`]);

      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 53, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [244, 63, 94] }});
    } 
    else if (reportType === 'supplier_ledger') {
      const supplierName = selectedSupplier === 'ALL' ? 'Consolidated (All Suppliers)' : (initialSuppliers.find(s => s.id === parseInt(selectedSupplier))?.name || 'Unknown');
      doc.text(`Supplier Ledger: ${supplierName}`, 14, 41);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 47);

      const tableColumn = ["Date", "Description", "Bill Amount", "Payment Made", "Net Balance"];
      const tableRows = [
        ['', 'OPENING BALANCE', '-', '-', `${ledgerData.openingBalance >= 0 ? '' : 'Adv '}${Math.abs(ledgerData.openingBalance).toFixed(2)}`]
      ];
      
      ledgerData.timeline.forEach(t => {
        tableRows.push([
          formatDate(t.date), t.description, 
          t.billAmount ? t.billAmount.toFixed(2) : '-', 
          t.paymentAmount ? t.paymentAmount.toFixed(2) : '-',
          `${t.balance >= 0 ? '' : 'Adv '}${Math.abs(t.balance).toFixed(2)}`
        ]);
      });

      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 53, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [244, 63, 94] }});
    }

    else {
      doc.text('Stock Inward Report', 14, 41);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 47);

      const tableColumn = ["Date", "Supplier", "Type", "Vehicle", "Birds", "Weight (kg)", "Rate/kg", "Payment", "Total Value"];
      const tableRows = rawData.map(item => [
        item.timestamp ? formatDate(item.timestamp.toDate()) : 'N/A',
        item.supplierName || 'N/A', item.chickenType || 'N/A', item.vehicleNo || 'N/A',
        item.numberOfBirds || 0, item.weight || 0, item.rate || 0,
        item.paymentMode === 'Cheque' ? `Cheque (${item.bankName?.split(' ')[0] || ''})` : (item.paymentMode || 'Credit'),
        (item.totalValue || 0).toFixed(2)
      ]);
      
      tableRows.push(['TOTAL', '-', '-', '-', rawTotalBirds, rawTotalWeight.toFixed(2), '-', '-', rawTotalValue.toLocaleString()]);
      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 53, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [244, 63, 94] }});
    }

    doc.save(`Chicken_Vypyar_${reportType}_${fromDate}.pdf`);
  };

  const exportExcel = () => {
    let wsData = [];
    
    if (reportType === 'outstanding_balances') {
      wsData.push(["Supplier", "Previous Due", "New Bills", "Money Paid", "Net Due Now"]);
      outstandingData.forEach(s => {
        wsData.push([s.name, s.opening, s.newBills, s.moneyPaid, s.netDue]);
      });
      wsData.push(['TOTAL', '', '', '', totalOutstandingDue]);
    } 
    else if (reportType === 'supplier_ledger') {
      wsData.push(["Date", "Description", "Bill Amount", "Payment Made", "Net Balance"]);
      wsData.push(['', 'OPENING BALANCE', '', '', ledgerData.openingBalance]);
      ledgerData.timeline.forEach(t => {
        wsData.push([
          formatDate(t.date), t.description, 
          t.billAmount || '', t.paymentAmount || '', t.balance
        ]);
      });
    }

    else {
      wsData.push(["Date", "Supplier", "Type", "Vehicle", "Birds", "Weight (kg)", "Rate/kg", "Payment", "Total Value"]);
      rawData.forEach(item => {
        wsData.push([
          item.timestamp ? formatDate(item.timestamp.toDate()) : 'N/A',
          item.supplierName || 'N/A', item.chickenType || 'N/A', item.vehicleNo || 'N/A',
          item.numberOfBirds || 0, item.weight || 0, item.rate || 0,
          item.paymentMode === 'Cheque' ? `Cheque (${item.bankName?.split(' ')[0] || ''})` : (item.paymentMode || 'Credit'),
          item.totalValue || 0
        ]);
      });
      wsData.push(['TOTAL', '', '', '', rawTotalBirds, rawTotalWeight, '', '', rawTotalValue]);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `Chicken_Vypyar_${reportType}_${fromDate}.xlsx`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* Header & Controls - Hidden when printing */}
      <div className="print:hidden">
        <h2 className="text-2xl font-bold mb-6">Accounting & Reports</h2>
        
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end">
            <div className="flex flex-wrap gap-4 items-end w-full md:w-auto">
              
              <div className="w-full md:w-56">
                <label className="block text-sm font-medium text-slate-500 mb-1">Select Report</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-medium"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  <option value="outstanding_balances">Outstanding Balances (Master)</option>
                  <option value="supplier_ledger">Supplier Ledger (Detailed)</option>
                  <option value="stock_inward">Raw Stock Inward Data</option>
                </select>
              </div>

              {reportType === 'supplier_ledger' && (
                <div className="w-full md:w-48 animate-in fade-in">
                  <label className="block text-sm font-medium text-slate-500 mb-1">Select Supplier</label>
                  <select 
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                  >
                    <option value="ALL" className="font-bold">-- Consolidated (All Suppliers) --</option>
                    {initialSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">From Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="pl-10 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">To Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="pl-10 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="flex flex-nowrap gap-2 w-full md:w-auto mt-4 md:mt-0 overflow-x-auto pb-1 md:pb-0">
              <button onClick={exportExcel} className="flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-medium transition-colors border border-emerald-200">
                <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Excel</span>
              </button>
              <button onClick={exportPDF} className="flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl font-medium transition-colors border border-rose-200">
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline">PDF</span>
              </button>
              <button onClick={handlePrint} className="flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-medium transition-colors border border-slate-200">
                <Printer className="w-4 h-4" /> <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Printable Report Display Area */}
      <div className="glass-panel rounded-2xl overflow-hidden print:shadow-none print:border-0 print:bg-white print:text-black">
        
        {/* Print Header */}
        <div className="hidden print:block p-8 border-b border-slate-200 text-center">
          <h1 className="text-3xl font-bold mb-1">{shopDetails.name}</h1>
          <p className="text-sm text-slate-500 mb-1">{shopDetails.address} | Phone: {shopDetails.phone}</p>
          <p className="text-sm font-medium text-slate-600 mb-6">GSTIN: {shopDetails.gstin}</p>
          <h2 className="text-xl font-bold text-slate-800 mb-1">
            {reportType === 'outstanding_balances' ? 'Outstanding Balances Dashboard' : 
             reportType === 'supplier_ledger' ? 'Detailed Supplier Ledger' : 
             reportType === 'day_summary' ? 'Day Summary Report' : 'Raw Stock Inward Report'}
          </h2>
          <p className="text-sm text-slate-500">
            {reportType === 'day_summary' ? `Date: ${formatDate(fromDate)}` : `Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`}
          </p>
        </div>

        <div className={`overflow-x-auto ${reportType === 'day_summary' ? 'p-4 sm:p-8 bg-slate-50/50 dark:bg-slate-950/20' : ''}`}>
          
          {/* 1. OUTSTANDING BALANCES VIEW */}
          {reportType === 'outstanding_balances' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 print:bg-slate-100">
                  <th className="p-4 font-semibold text-slate-600">Supplier / Customer</th>
                  <th className="p-4 font-semibold text-slate-600 text-right">Previous Due</th>
                  <th className="p-4 font-semibold text-slate-600 text-right">New Bills</th>
                  <th className="p-4 font-semibold text-slate-600 text-right">Money Paid</th>
                  <th className="p-4 font-bold text-slate-800 text-right">Net Due Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {outstandingData.map(s => (
                  <tr key={s.name} className="hover:bg-slate-50">
                    <td className="p-4 font-medium">{s.name}</td>
                    <td className="p-4 text-right text-slate-500">{s.opening.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td className="p-4 text-right text-red-500">{s.newBills > 0 ? s.newBills.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                    <td className="p-4 text-right text-green-500">{s.moneyPaid > 0 ? s.moneyPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                    <td className={`p-4 text-right font-bold text-lg ${s.netDue > 0 ? 'text-red-600' : s.netDue < 0 ? 'text-green-600' : 'text-slate-800'}`}>
                      {s.netDue > 0 ? `₹${s.netDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 
                       s.netDue < 0 ? `Advance: ₹${Math.abs(s.netDue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Settled'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 print:bg-slate-100">
                <tr>
                  <td className="p-4 font-bold text-slate-700">TOTAL OUTSTANDING</td>
                  <td colSpan="3"></td>
                  <td className={`p-4 text-right font-bold text-2xl ${totalOutstandingDue > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    ₹{totalOutstandingDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* 2. SUPPLIER LEDGER VIEW */}
          {reportType === 'supplier_ledger' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 print:bg-slate-100">
                  <th className="p-4 font-semibold text-slate-600">Date</th>
                  <th className="p-4 font-semibold text-slate-600">Description</th>
                  <th className="p-4 font-semibold text-red-600 text-right">Bill Amount (🔴)</th>
                  <th className="p-4 font-semibold text-green-600 text-right">Payment Made (🟢)</th>
                  <th className="p-4 font-bold text-slate-800 text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                {/* Opening Balance Row */}
                <tr className="bg-slate-50/50">
                  <td className="p-4 text-sm text-slate-500">Before {formatDate(fromDate)}</td>
                  <td className="p-4 font-bold text-slate-700">OPENING BALANCE</td>
                  <td className="p-4"></td>
                  <td className="p-4"></td>
                  <td className={`p-4 text-right font-bold ${ledgerData.openingBalance > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    ₹{ledgerData.openingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
                {/* Transactions */}
                {ledgerData.timeline.length > 0 ? ledgerData.timeline.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-4 text-sm font-medium whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="p-4 text-slate-700 whitespace-nowrap">{t.description}</td>
                    <td className="p-4 text-right font-medium text-red-500 whitespace-nowrap">{t.billAmount > 0 ? t.billAmount.toLocaleString('en-IN') : '-'}</td>
                    <td className="p-4 text-right font-medium text-green-500 whitespace-nowrap">{t.paymentAmount > 0 ? t.paymentAmount.toLocaleString('en-IN') : '-'}</td>
                    <td className={`p-4 text-right font-bold whitespace-nowrap ${t.balance > 0 ? 'text-red-600' : t.balance < 0 ? 'text-green-600' : 'text-slate-800'}`}>
                      ₹{Math.abs(t.balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })} {t.balance < 0 && '(Adv)'}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" className="p-8 text-center text-slate-500">No transactions in this period.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 print:bg-slate-100">
                <tr>
                  <td colSpan="4" className="p-4 text-right font-bold text-slate-700">CLOSING BALANCE:</td>
                  <td className={`p-4 text-right font-bold text-xl ${ledgerData.closingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{Math.abs(ledgerData.closingBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} {ledgerData.closingBalance < 0 && '(Advance)'}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* 3. RAW STOCK INWARD VIEW (Legacy/Detailed) */}
          {reportType === 'stock_inward' && (
             <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 print:bg-slate-100">
                 <th className="p-4 font-semibold text-slate-600">Date</th>
                 <th className="p-4 font-semibold text-slate-600">Supplier</th>
                 <th className="p-4 font-semibold text-slate-600 text-right">Birds</th>
                 <th className="p-4 font-semibold text-slate-600 text-right">Weight</th>
                 <th className="p-4 font-semibold text-slate-600 text-right">Rate</th>
                 <th className="p-4 font-semibold text-slate-600">Payment</th>
                 <th className="p-4 font-bold text-slate-800 text-right">Bill Value</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100 print:divide-slate-300">
               {rawData.map(item => (
                 <tr key={item.id} className="hover:bg-slate-50">
                   <td className="p-4 text-sm">{item.timestamp ? formatDate(item.timestamp.toDate()) : 'N/A'}</td>
                   <td className="p-4 font-medium">{item.supplierName}</td>
                   <td className="p-4 text-right">{item.numberOfBirds}</td>
                   <td className="p-4 text-right">{item.weight} kg</td>
                   <td className="p-4 text-right">₹{item.rate}</td>
                   <td className="p-4 text-sm font-bold text-slate-600">{item.paymentMode || 'Credit'}</td>
                   <td className="p-4 text-right font-bold text-slate-800">₹{item.totalValue.toLocaleString('en-IN')}</td>
                 </tr>
               ))}
             </tbody>
             <tfoot className="bg-slate-50 border-t-2 border-slate-200 print:bg-slate-100">
               <tr>
                 <td colSpan="2" className="p-4 font-bold">TOTALS:</td>
                 <td className="p-4 text-right font-bold text-primary-600">{rawTotalBirds}</td>
                 <td className="p-4 text-right font-bold text-primary-600">{rawTotalWeight.toFixed(2)} kg</td>
                 <td colSpan="2"></td>
                 <td className="p-4 text-right font-bold text-xl">₹{rawTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
               </tr>
             </tfoot>
           </table>
          )}



        </div>
      </div>
    </div>
  );
}
