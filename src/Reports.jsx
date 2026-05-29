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
    customerUniqueId: 'CV-00001',
    shopName: shopDetails.name,
    proprietorName: 'Mohammad Farooq Momin',
    address: shopDetails.address,
    phone: shopDetails.phone,
    gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
  };
  const [reportType, setReportType] = useState('outstanding_balances');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [ledgerCategory, setLedgerCategory] = useState('ALL'); // 'ALL', 'CHICKEN', 'EGGS'
  const [dailyViewMode, setDailyViewMode] = useState('summary'); // 'summary' or 'details'
  
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
      summary[s.id] = { 
        name: s.name, 
        opening: 0, 
        newBills: 0, 
        moneyPaid: 0, 
        netDue: 0,
        chicken: { opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 },
        eggs: { opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 }
      };
    });

    // We must process ALL inward records to find true outstanding
    stockInwards.forEach(item => {
      const sId = item.supplierId;
      if (!summary[sId]) {
        summary[sId] = { 
          name: item.supplierName, 
          opening: 0, 
          newBills: 0, 
          moneyPaid: 0, 
          netDue: 0,
          chicken: { opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 },
          eggs: { opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 }
        };
      }
      
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date();
      const amount = item.totalValue || 0;
      const isEgg = item.chickenType === 'EG';

      if (isDateBefore(itemDate, from)) {
        summary[sId].opening += amount;
        if (isEgg) summary[sId].eggs.opening += amount;
        else summary[sId].chicken.opening += amount;
      } else if (isDateInRange(itemDate, from, to)) {
        summary[sId].newBills += amount;
        if (isEgg) summary[sId].eggs.newBills += amount;
        else summary[sId].chicken.newBills += amount;
      }
      summary[sId].netDue += amount;
      if (isEgg) summary[sId].eggs.netDue += amount;
      else summary[sId].chicken.netDue += amount;
    });

    // Process all payments
    supplierPayments.forEach(item => {
      const sId = item.supplierId;
      if (!summary[sId]) {
        summary[sId] = { 
          name: item.supplierName, 
          opening: 0, 
          newBills: 0, 
          moneyPaid: 0, 
          netDue: 0,
          chicken: { opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 },
          eggs: { opening: 0, newBills: 0, moneyPaid: 0, netDue: 0 }
        };
      }
      
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date(item.paymentDate);
      const amount = item.amount || 0;
      const isEgg = item.purchaseType === 'Eggs';

      if (isDateBefore(itemDate, from)) {
        summary[sId].opening -= amount;
        if (isEgg) summary[sId].eggs.opening -= amount;
        else summary[sId].chicken.opening -= amount;
      } else if (isDateInRange(itemDate, from, to)) {
        summary[sId].moneyPaid += amount;
        if (isEgg) summary[sId].eggs.moneyPaid += amount;
        else summary[sId].chicken.moneyPaid += amount;
      }
      summary[sId].netDue -= amount;
      if (isEgg) summary[sId].eggs.netDue -= amount;
      else summary[sId].chicken.netDue -= amount;
    });

    // Convert to array and filter out true 0s to keep it clean (optional, but good for UX)
    return Object.values(summary).filter(s => 
      Math.abs(s.opening) > 0 || s.newBills > 0 || s.moneyPaid > 0 || Math.abs(s.netDue) > 0 ||
      Math.abs(s.chicken.netDue) > 0 || Math.abs(s.eggs.netDue) > 0
    );
  };

  // -------------------------------------------------------------
  // DATA PROCESSING: SUPPLIER LEDGER (TIMELINE)
  // -------------------------------------------------------------
  const generateSupplierLedger = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    let openingBalance = 0;
    let purchases = [];
    let payments = [];

    let chickenOpening = 0;
    let eggsOpening = 0;
    let chickenPurchaseAmt = 0;
    let eggsPurchaseAmt = 0;
    let chickenPaymentAmt = 0;
    let eggsPaymentAmt = 0;

    // Filter Inwards for this supplier
    stockInwards.filter(i => selectedSupplier === 'ALL' || i.supplierId === parseInt(selectedSupplier)).forEach(item => {
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date();
      const amount = item.totalValue || 0;
      const isEgg = item.chickenType === 'EG';
      
      if (isDateBefore(itemDate, from)) {
        if (isEgg) eggsOpening += amount;
        else chickenOpening += amount;
      } else if (isDateInRange(itemDate, from, to)) {
        if (isEgg) eggsPurchaseAmt += amount;
        else chickenPurchaseAmt += amount;
      }

      // Filter by category
      if (ledgerCategory === 'CHICKEN' && isEgg) return;
      if (ledgerCategory === 'EGGS' && !isEgg) return;

      if (isDateBefore(itemDate, from)) {
        openingBalance += amount;
      } else if (isDateInRange(itemDate, from, to)) {
        purchases.push({
          id: item.id,
          date: itemDate,
          qty: item.numberOfBirds || 0,
          details: item.chickenType || 'Broiler',
          weight: item.weight || 0,
          rate: item.rate || 0,
          amount: amount,
          supplierName: item.supplierName
        });
      }
    });

    // Filter Payments for this supplier
    supplierPayments.filter(i => selectedSupplier === 'ALL' || i.supplierId === parseInt(selectedSupplier)).forEach(item => {
      const itemDate = item.timestamp ? item.timestamp.toDate() : new Date(item.paymentDate);
      const amount = item.amount || 0;
      const isEgg = item.purchaseType === 'Eggs';

      if (isDateBefore(itemDate, from)) {
        if (isEgg) eggsOpening -= amount;
        else chickenOpening -= amount;
      } else if (isDateInRange(itemDate, from, to)) {
        if (isEgg) eggsPaymentAmt += amount;
        else chickenPaymentAmt += amount;
      }

      // Filter by category
      if (ledgerCategory === 'CHICKEN' && isEgg) return;
      if (ledgerCategory === 'EGGS' && !isEgg) return;
      
      if (isDateBefore(itemDate, from)) {
        openingBalance -= amount;
      } else if (isDateInRange(itemDate, from, to)) {
        let particulars = item.paymentMode || 'CASH A/C';
        if (ledgerCategory === 'ALL') {
          particulars += ` (${item.purchaseType || 'Chicken'})`;
        }
        if (item.paymentMode === 'Cheque') particulars += ` (${item.bankName?.split(' ')[0]} #${item.referenceNo})`;
        if (item.paymentMode === 'Bank Transfer') particulars += ` (Ref: ${item.referenceNo})`;
        
        payments.push({
          id: item.id,
          date: itemDate,
          particulars: particulars,
          amount: amount,
          supplierName: item.supplierName
        });
      }
    });

    // Sort chronologically
    purchases.sort((a, b) => a.date - b.date);
    payments.sort((a, b) => a.date - b.date);

    const totalPurchaseQty = purchases.reduce((sum, p) => sum + p.qty, 0);
    const totalPurchaseWeight = purchases.reduce((sum, p) => sum + p.weight, 0);
    const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.amount, 0);
    
    const totalCollectionAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    
    const closingBalance = openingBalance + totalPurchaseAmount - totalCollectionAmount;
    const chickenBalance = chickenOpening + chickenPurchaseAmt - chickenPaymentAmt;
    const eggsBalance = eggsOpening + eggsPurchaseAmt - eggsPaymentAmt;

    return {
      openingBalance,
      purchases,
      payments,
      totalPurchaseQty,
      totalPurchaseWeight,
      totalPurchaseAmount,
      totalCollectionAmount,
      closingBalance,
      chickenBalance,
      eggsBalance
    };
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

  // -------------------------------------------------------------
  // DATA PROCESSING: DAILY TRANSACTION RECONCILIATION
  // -------------------------------------------------------------
  const generateDailyTransactions = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    const dailyData = {};

    const toLocalDateStr = (dateObj) => {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    let curDate = new Date(from);
    while (curDate <= to) {
      const dateStr = toLocalDateStr(curDate);
      dailyData[dateStr] = {
        dateStr,
        billsCount: 0,
        cashSales: 0,
        upiSales: 0,
        totalSales: 0,
        expenses: 0,
        supplierPaymentsCash: 0,
        supplierPaymentsOthers: 0,
        expectedCash: 0,
        salesList: []
      };
      curDate.setDate(curDate.getDate() + 1);
    }

    sales.forEach(sale => {
      const saleDate = sale.timestamp ? sale.timestamp.toDate() : new Date();
      const dateStr = toLocalDateStr(saleDate);
      
      if (isDateInRange(saleDate, from, to)) {
        if (!dailyData[dateStr]) {
          dailyData[dateStr] = {
            dateStr,
            billsCount: 0,
            cashSales: 0,
            upiSales: 0,
            totalSales: 0,
            expenses: 0,
            supplierPaymentsCash: 0,
            supplierPaymentsOthers: 0,
            expectedCash: 0,
            salesList: []
          };
        }
        
        const totalAmt = sale.total || 0;
        dailyData[dateStr].billsCount += 1;
        dailyData[dateStr].totalSales += totalAmt;
        if (sale.paymentMethod === 'cash') {
          dailyData[dateStr].cashSales += totalAmt;
        } else if (sale.paymentMethod === 'upi') {
          dailyData[dateStr].upiSales += totalAmt;
        }
        
        dailyData[dateStr].salesList.push({
          id: sale.id,
          time: saleDate,
          workerName: sale.workerName || 'Unknown',
          shift: sale.shift || 'Morning Shift',
          paymentMethod: sale.paymentMethod || 'cash',
          total: totalAmt,
          itemsSummary: sale.items?.map(i => `${i.productName} (${i.quantity} ${i.unit || 'kg'})`).join(', ') || 'N/A'
        });
      }
    });

    expenses.forEach(exp => {
      const dateStr = exp.date;
      if (dateStr >= fromDate && dateStr <= toDate) {
        if (!dailyData[dateStr]) {
          dailyData[dateStr] = {
            dateStr,
            billsCount: 0,
            cashSales: 0,
            upiSales: 0,
            totalSales: 0,
            expenses: 0,
            supplierPaymentsCash: 0,
            supplierPaymentsOthers: 0,
            expectedCash: 0,
            salesList: []
          };
        }
        dailyData[dateStr].expenses += exp.amount || 0;
      }
    });

    supplierPayments.forEach(pay => {
      const payDate = pay.timestamp ? pay.timestamp.toDate() : new Date(pay.paymentDate);
      const dateStr = toLocalDateStr(payDate);
      
      if (isDateInRange(payDate, from, to)) {
        if (!dailyData[dateStr]) {
          dailyData[dateStr] = {
            dateStr,
            billsCount: 0,
            cashSales: 0,
            upiSales: 0,
            totalSales: 0,
            expenses: 0,
            supplierPaymentsCash: 0,
            supplierPaymentsOthers: 0,
            expectedCash: 0,
            salesList: []
          };
        }
        const amt = pay.amount || 0;
        if (pay.paymentMode?.toLowerCase() === 'cash') {
          dailyData[dateStr].supplierPaymentsCash += amt;
        } else {
          dailyData[dateStr].supplierPaymentsOthers += amt;
        }
      }
    });

    Object.values(dailyData).forEach(day => {
      day.expectedCash = day.cashSales - day.expenses - day.supplierPaymentsCash;
      day.salesList.sort((a, b) => b.time - a.time);
    });

    return Object.values(dailyData).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  };

  // View Computations
  const outstandingData = reportType === 'outstanding_balances' ? generateOutstandingBalances() : [];
  const ledgerData = reportType === 'supplier_ledger' ? generateSupplierLedger() : { purchases: [], payments: [], openingBalance: 0, closingBalance: 0, totalPurchaseQty: 0, totalPurchaseWeight: 0, totalPurchaseAmount: 0, totalCollectionAmount: 0 };
  const rawData = reportType === 'stock_inward' ? generateRawStockInward() : [];
  const dailyTransactionsData = reportType === 'daily_transactions' ? generateDailyTransactions() : [];

  // Totals for Outstanding Balances
  const totalOutstandingDue = outstandingData.reduce((sum, s) => sum + s.netDue, 0);
  
  // Totals for Raw Stock
  const rawTotalWeight = rawData.reduce((sum, item) => sum + (item.weight || 0), 0);
  const rawTotalBirds = rawData.reduce((sum, item) => sum + (item.numberOfBirds || 0), 0);
  const rawTotalValue = rawData.reduce((sum, item) => sum + (item.totalValue || 0), 0);

  // Totals for Daily Transactions Audit
  const totalSalesAudit = dailyTransactionsData.reduce((sum, d) => sum + d.totalSales, 0);
  const totalCashSalesAudit = dailyTransactionsData.reduce((sum, d) => sum + d.cashSales, 0);
  const totalUpiSalesAudit = dailyTransactionsData.reduce((sum, d) => sum + d.upiSales, 0);
  const totalExpensesAudit = dailyTransactionsData.reduce((sum, d) => sum + d.expenses, 0);
  const totalSupplierPaymentsCashAudit = dailyTransactionsData.reduce((sum, d) => sum + d.supplierPaymentsCash, 0);
  const totalExpectedCashAudit = dailyTransactionsData.reduce((sum, d) => sum + d.expectedCash, 0);

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

      const tableColumn = ["Supplier / Category", "Previous Due", "New Bills", "Money Paid", "Net Due Now"];
      const tableRows = [];
      outstandingData.forEach(s => {
        tableRows.push([
          s.name, 
          s.opening.toFixed(0), 
          s.newBills.toFixed(0), 
          s.moneyPaid.toFixed(0), 
          `${s.netDue >= 0 ? '' : 'Adv '}${Math.abs(s.netDue).toFixed(0)}`
        ]);
        if (s.chicken.opening !== 0 || s.chicken.newBills !== 0 || s.chicken.moneyPaid !== 0 || s.chicken.netDue !== 0) {
          tableRows.push([
            "  ↳ 🐔 Chicken Credit", 
            s.chicken.opening.toFixed(0), 
            s.chicken.newBills.toFixed(0), 
            s.chicken.moneyPaid.toFixed(0), 
            `${s.chicken.netDue >= 0 ? '' : 'Adv '}${Math.abs(s.chicken.netDue).toFixed(0)}`
          ]);
        }
        if (s.eggs.opening !== 0 || s.eggs.newBills !== 0 || s.eggs.moneyPaid !== 0 || s.eggs.netDue !== 0) {
          tableRows.push([
            "  ↳ 🥚 Eggs Credit", 
            s.eggs.opening.toFixed(0), 
            s.eggs.newBills.toFixed(0), 
            s.eggs.moneyPaid.toFixed(0), 
            `${s.eggs.netDue >= 0 ? '' : 'Adv '}${Math.abs(s.eggs.netDue).toFixed(0)}`
          ]);
        }
      });
      
      tableRows.push(['TOTAL', '-', '-', '-', `${totalOutstandingDue >= 0 ? '' : 'Adv '}${Math.abs(totalOutstandingDue).toFixed(0)}`]);

      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 53, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [244, 63, 94] }});
    } 
    else if (reportType === 'supplier_ledger') {
      const supplierName = selectedSupplier === 'ALL' ? 'Consolidated (All Suppliers)' : (initialSuppliers.find(s => s.id === parseInt(selectedSupplier))?.name || 'Unknown');
      const categoryLabel = ledgerCategory === 'CHICKEN' ? ' [CHICKEN ONLY]' : ledgerCategory === 'EGGS' ? ' [EGGS ONLY]' : '';
      doc.text(`Party Name: ${supplierName}${categoryLabel}`, 14, 41);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 47);

      // Left Table: Purchase for the Week
      const leftCol = ["Date", "Qty", "Details", "KGs/Pcs", "Rate", "Amount"];
      const leftRows = ledgerData.purchases.map(p => [
        formatDate(p.date), p.qty || '-', p.details, p.weight ? p.weight.toFixed(2) : '-', p.rate || '-', p.amount.toFixed(0)
      ]);
      leftRows.push(['TOTAL', ledgerData.totalPurchaseQty, '', ledgerData.totalPurchaseWeight.toFixed(2), '', ledgerData.totalPurchaseAmount.toFixed(0)]);

      // Right Table: Payments Made
      const rightCol = ["Date", "Particulars", "Amount"];
      const rightRows = ledgerData.payments.map(py => [
        formatDate(py.date), py.particulars, py.amount.toFixed(0)
      ]);
      rightRows.push(['PAYMENT TOTAL', '', ledgerData.totalCollectionAmount.toFixed(0)]);

      // Draw Left Table
      autoTable(doc, { 
        head: [leftCol], 
        body: leftRows, 
        startY: 53, 
        margin: { left: 14 }, 
        tableWidth: 130, 
        theme: 'grid', 
        styles: { fontSize: 8 }, 
        headStyles: { fillColor: [244, 63, 94] }
      });

      // Draw Right Table side-by-side
      autoTable(doc, { 
        head: [rightCol], 
        body: rightRows, 
        startY: 53, 
        margin: { left: 150 }, 
        tableWidth: 130, 
        theme: 'grid', 
        styles: { fontSize: 8 }, 
        headStyles: { fillColor: [16, 185, 129] }
      });

      // Get the lower of the two tables' bottom Y coordinate
      const finalY = Math.max(doc.lastAutoTable.finalY || 100, 100);

      // Add Reconciliation Box below
      const showBreakdown = ledgerCategory === 'ALL';
      doc.setFontSize(10);
      doc.setTextColor(50);
      doc.rect(14, finalY + 10, 100, showBreakdown ? 45 : 35);
      doc.text("ACCOUNT RECONCILIATION", 18, finalY + 15);
      doc.setFontSize(8);
      doc.text(`PREVIOUS BALANCE:`, 18, finalY + 22);
      doc.text(`₹${ledgerData.openingBalance.toFixed(0)}`, 85, finalY + 22, { align: 'right' });
      doc.text(`ADD PURCHASE FOR THE WEEK (+):`, 18, finalY + 27);
      doc.text(`₹${ledgerData.totalPurchaseAmount.toFixed(0)}`, 85, finalY + 27, { align: 'right' });
      doc.text(`LESS PAYMENT MADE (-):`, 18, finalY + 32);
      doc.text(`₹${ledgerData.totalCollectionAmount.toFixed(0)}`, 85, finalY + 32, { align: 'right' });
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`FINAL TOTAL PAYABLE:`, 18, finalY + 40);
      doc.text(`₹${ledgerData.closingBalance.toFixed(0)}`, 85, finalY + 40, { align: 'right' });
      if (showBreakdown) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(`🐔 Chicken Balance:`, 18, finalY + 44);
        doc.text(`₹${ledgerData.chickenBalance.toFixed(0)}`, 85, finalY + 44, { align: 'right' });
        doc.text(`🥚 Eggs Balance:`, 18, finalY + 48);
        doc.text(`₹${ledgerData.eggsBalance.toFixed(0)}`, 85, finalY + 48, { align: 'right' });
      }

      // Note
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("NOTE: BALANCE PAYABLE", 150, finalY + 20);
      
      // Signatures
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Cashier Sign", 150, finalY + 40);
      doc.line(150, finalY + 37, 180, finalY + 37);
      
      doc.text("Party Sign", 210, finalY + 40);
      doc.line(210, finalY + 37, 240, finalY + 37);
    }

    else if (reportType === 'daily_transactions') {
      doc.text('Daily Transactions Audit & Reconciliation', 14, 41);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 47);

      const tableColumn = ["Date", "Bills", "Cash Sales", "UPI Sales", "Total Sales", "Petty Exp", "Supplier Cash", "Expected Cash"];
      const tableRows = dailyTransactionsData.map(d => [
        formatDate(d.dateStr), d.billsCount, d.cashSales.toFixed(0), d.upiSales.toFixed(0), 
        d.totalSales.toFixed(0), d.expenses.toFixed(0), d.supplierPaymentsCash.toFixed(0), 
        d.expectedCash.toFixed(0)
      ]);
      
      tableRows.push([
        'TOTAL', 
        dailyTransactionsData.reduce((sum, d) => sum + d.billsCount, 0),
        totalCashSalesAudit.toFixed(0), 
        totalUpiSalesAudit.toFixed(0), 
        totalSalesAudit.toFixed(0), 
        totalExpensesAudit.toFixed(0), 
        totalSupplierPaymentsCashAudit.toFixed(0), 
        totalExpectedCashAudit.toFixed(0)
      ]);

      autoTable(doc, { head: [tableColumn], body: tableRows, startY: 53, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [244, 63, 94] }});
    }
    else {
      doc.text('Stock Inward Report', 14, 41);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 47);

      const tableColumn = ["Date", "Supplier", "Type", "Vehicle", "Birds/Pcs", "Weight/Qty", "Rate/Unit", "Payment", "Total Value"];
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

    doc.save(`Chicken_Vypar_${reportType}_${fromDate}.pdf`);
  };

  const exportExcel = () => {
    let wsData = [];
    
    if (reportType === 'outstanding_balances') {
      wsData.push(["Supplier / Category", "Previous Due", "New Bills", "Money Paid", "Net Due Now"]);
      outstandingData.forEach(s => {
        wsData.push([s.name, s.opening, s.newBills, s.moneyPaid, s.netDue]);
        if (s.chicken.opening !== 0 || s.chicken.newBills !== 0 || s.chicken.moneyPaid !== 0 || s.chicken.netDue !== 0) {
          wsData.push(["  ↳ Chicken Credit", s.chicken.opening, s.chicken.newBills, s.chicken.moneyPaid, s.chicken.netDue]);
        }
        if (s.eggs.opening !== 0 || s.eggs.newBills !== 0 || s.eggs.moneyPaid !== 0 || s.eggs.netDue !== 0) {
          wsData.push(["  ↳ Eggs Credit", s.eggs.opening, s.eggs.newBills, s.eggs.moneyPaid, s.eggs.netDue]);
        }
      });
      wsData.push(['TOTAL', '', '', '', totalOutstandingDue]);
    } 
    else if (reportType === 'supplier_ledger') {
      wsData.push(["PURCHASE FOR THE WEEK", "", "", "", "", "", "PAYMENTS MADE / GOODS RETURN"]);
      wsData.push(["Date", "Qty", "Details", "KGs.", "Rate", "Amount", "Date", "Particulars", "Amount"]);
      
      const maxLength = Math.max(ledgerData.purchases.length, ledgerData.payments.length);
      for (let i = 0; i < maxLength; i++) {
        const p = ledgerData.purchases[i] || {};
        const py = ledgerData.payments[i] || {};
        
        wsData.push([
          p.date ? formatDate(p.date) : "",
          p.qty || "",
          p.details || "",
          p.weight || "",
          p.rate || "",
          p.amount || "",
          py.date ? formatDate(py.date) : "",
          py.particulars || "",
          py.amount || ""
        ]);
      }
      
      wsData.push([
        "TOTAL", ledgerData.totalPurchaseQty, "", ledgerData.totalPurchaseWeight, "", ledgerData.totalPurchaseAmount,
        "PAYMENT TOTAL", "", ledgerData.totalCollectionAmount
      ]);
      
      wsData.push([]);
      wsData.push(["ACCOUNT RECONCILIATION"]);
      wsData.push(["PREVIOUS BALANCE", ledgerData.openingBalance]);
      wsData.push(["ADD PURCHASE FOR THE WEEK", ledgerData.totalPurchaseAmount]);
      wsData.push(["LESS PAYMENT MADE", ledgerData.totalCollectionAmount]);
      wsData.push(["FINAL TOTAL PAYABLE", ledgerData.closingBalance]);
      if (ledgerCategory === 'ALL') {
        wsData.push(["Chicken Balance", ledgerData.chickenBalance]);
        wsData.push(["Eggs Balance", ledgerData.eggsBalance]);
      }
      wsData.push([]);
      wsData.push(["NOTE : BALANCE PAYABLE"]);
    }

    else if (reportType === 'daily_transactions') {
      wsData.push(["Date", "Bills Raised", "Cash Sales (A)", "UPI Sales (B)", "Total Sales (A+B)", "Petty Expenses (C)", "Supplier Cash Payments (D)", "Expected Cash (A-C-D)"]);
      dailyTransactionsData.forEach(d => {
        wsData.push([
          formatDate(d.dateStr), d.billsCount, d.cashSales, d.upiSales, 
          d.totalSales, d.expenses, d.supplierPaymentsCash, d.expectedCash
        ]);
      });
      wsData.push([
        'TOTAL',
        dailyTransactionsData.reduce((sum, d) => sum + d.billsCount, 0),
        totalCashSalesAudit,
        totalUpiSalesAudit,
        totalSalesAudit,
        totalExpensesAudit,
        totalSupplierPaymentsCashAudit,
        totalExpectedCashAudit
      ]);
    }
    else {
      wsData.push(["Date", "Supplier", "Type", "Vehicle", "Birds/Pcs", "Weight/Qty", "Rate/Unit", "Payment", "Total Value"]);
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
    XLSX.writeFile(wb, `Chicken_Vypar_${reportType}_${fromDate}.xlsx`);
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
                  <option value="daily_transactions">Daily Transactions (Audit & Tally)</option>
                </select>
              </div>

              {reportType === 'supplier_ledger' && (
                <>
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
                  <div className="w-full md:w-48 animate-in fade-in">
                    <label className="block text-sm font-medium text-slate-500 mb-1">Category Filter</label>
                    <select 
                      className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none font-bold text-slate-700 dark:text-slate-250"
                      value={ledgerCategory}
                      onChange={(e) => setLedgerCategory(e.target.value)}
                    >
                      <option value="ALL">All Categories</option>
                      <option value="CHICKEN">🐔 Chicken Only</option>
                      <option value="EGGS">🥚 Eggs Only</option>
                    </select>
                  </div>
                </>
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
             reportType === 'day_summary' ? 'Day Summary Report' : 
             reportType === 'daily_transactions' ? 'Daily Transactions Tally & Audit' : 'Raw Stock Inward Report'}
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
                  <React.Fragment key={s.name}>
                    <tr className="hover:bg-slate-50 font-bold bg-slate-50/10 dark:bg-slate-800/10 border-b border-slate-200 dark:border-slate-800">
                      <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{s.name}</td>
                      <td className="p-4 text-right text-slate-500 dark:text-slate-400">{s.opening.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="p-4 text-right text-red-500 dark:text-red-400">{s.newBills > 0 ? s.newBills.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                      <td className="p-4 text-right text-green-500 dark:text-green-400">{s.moneyPaid > 0 ? s.moneyPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                      <td className={`p-4 text-right font-black text-lg ${s.netDue > 0 ? 'text-red-600 dark:text-red-400' : s.netDue < 0 ? 'text-green-600 dark:text-green-455' : 'text-slate-800 dark:text-slate-200'}`}>
                        {s.netDue > 0 ? `₹${s.netDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 
                         s.netDue < 0 ? `Advance: ₹${Math.abs(s.netDue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Settled'}
                      </td>
                    </tr>
                    {/* Chicken sub-row */}
                    {(s.chicken.opening !== 0 || s.chicken.newBills !== 0 || s.chicken.moneyPaid !== 0 || s.chicken.netDue !== 0) && (
                      <tr className="bg-slate-50/20 text-xs dark:bg-slate-900/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50/40">
                        <td className="pl-8 p-2 font-medium">🐔 Chicken Credit</td>
                        <td className="p-2 text-right">{s.chicken.opening.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="p-2 text-right text-red-500/80">{s.chicken.newBills > 0 ? s.chicken.newBills.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-2 text-right text-green-500/80">{s.chicken.moneyPaid > 0 ? s.chicken.moneyPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className={`p-2 text-right font-bold ${s.chicken.netDue > 0 ? 'text-red-500' : s.chicken.netDue < 0 ? 'text-green-505' : 'text-slate-500'}`}>
                          {s.chicken.netDue > 0 ? `₹${s.chicken.netDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 
                           s.chicken.netDue < 0 ? `Adv: ₹${Math.abs(s.chicken.netDue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Settled'}
                        </td>
                      </tr>
                    )}
                    {/* Eggs sub-row */}
                    {(s.eggs.opening !== 0 || s.eggs.newBills !== 0 || s.eggs.moneyPaid !== 0 || s.eggs.netDue !== 0) && (
                      <tr className="bg-slate-50/20 text-xs dark:bg-slate-900/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50/40">
                        <td className="pl-8 p-2 font-medium">🥚 Eggs Credit</td>
                        <td className="p-2 text-right">{s.eggs.opening.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="p-2 text-right text-red-500/80">{s.eggs.newBills > 0 ? s.eggs.newBills.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className="p-2 text-right text-green-500/80">{s.eggs.moneyPaid > 0 ? s.eggs.moneyPaid.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '-'}</td>
                        <td className={`p-2 text-right font-bold ${s.eggs.netDue > 0 ? 'text-red-500' : s.eggs.netDue < 0 ? 'text-green-505' : 'text-slate-500'}`}>
                          {s.eggs.netDue > 0 ? `₹${s.eggs.netDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 
                           s.eggs.netDue < 0 ? `Adv: ₹${Math.abs(s.eggs.netDue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Settled'}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
            <div className="p-4 sm:p-6 bg-white dark:bg-slate-900">
              
              {/* Header Info (for screen and print) */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-slate-800 pb-4 mb-4 gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Party Name: <span className="text-primary-600 dark:text-primary-400">{
                      selectedSupplier === 'ALL' 
                        ? 'Consolidated (All Suppliers)' 
                        : (initialSuppliers.find(s => s.id === parseInt(selectedSupplier))?.name || 'Unknown')
                    }</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Bill Period: {formatDate(fromDate)} to {formatDate(toDate)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400">
                    Weekly Statement
                  </span>
                </div>
              </div>

              {/* Side-by-Side Tables Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                
                {/* Left Table: PURCHASE FOR THE WEEK */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        Purchase For The Week
                      </h4>
                    </div>
                    <table className="w-full text-[11px] border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-100/50 dark:bg-slate-855 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800">DATE</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">QTY</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800">DETAILS</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">KGs.</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">RATE</th>
                          <th className="p-2 text-right">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80">
                        {ledgerData.purchases?.length > 0 ? (
                          ledgerData.purchases.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-855/30">
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">{formatDate(p.date)}</td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">{p.qty || '-'}</td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 truncate max-w-[80px]" title={p.details}>
                                {selectedSupplier === 'ALL' ? `[${p.supplierName.split(' ')[0]}] ${p.details}` : p.details}
                              </td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">{p.weight ? p.weight.toFixed(2) : '-'}</td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">₹{p.rate || '-'}</td>
                              <td className="p-2 text-right font-bold text-slate-800 dark:text-slate-200">₹{p.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="p-4 text-center text-slate-400">No purchases found in this period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Total Footer */}
                  <div className="bg-slate-100/80 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 p-2.5 text-[11px] font-black grid grid-cols-6 text-slate-700 dark:text-slate-350">
                    <div className="col-span-1">TOTAL</div>
                    <div className="text-right border-r border-slate-200 dark:border-slate-800 pr-2">{ledgerData.totalPurchaseQty || 0}</div>
                    <div className="border-r border-slate-200 dark:border-slate-800"></div>
                    <div className="text-right border-r border-slate-200 dark:border-slate-800 pr-2">{ledgerData.totalPurchaseWeight ? ledgerData.totalPurchaseWeight.toFixed(2) : '0.00'}</div>
                    <div className="border-r border-slate-200 dark:border-slate-800"></div>
                    <div className="text-right text-slate-900 dark:text-white">₹{(ledgerData.totalPurchaseAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                  </div>
                </div>

                {/* Right Table: COLLECTION RECEIVED / GOODS RETURN */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
                      <h4 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        Payments Made / Goods Return
                      </h4>
                    </div>
                    <table className="w-full text-[11px] border-collapse text-left">
                      <thead>
                        <tr className="bg-slate-100/50 dark:bg-slate-855 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800">DATE</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">QTY</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800">PARTICULARS</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">KGs.</th>
                          <th className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">RATE</th>
                          <th className="p-2 text-right">AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-slate-800/80">
                        {ledgerData.payments?.length > 0 ? (
                          ledgerData.payments.map(py => (
                            <tr key={py.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-855/30">
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">{formatDate(py.date)}</td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">-</td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 truncate max-w-[120px]" title={py.particulars}>
                                {selectedSupplier === 'ALL' ? `[${py.supplierName.split(' ')[0]}] ${py.particulars}` : py.particulars}
                              </td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">-</td>
                              <td className="p-2 border-r border-slate-200 dark:border-slate-800 text-right">-</td>
                              <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">₹{py.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" className="p-4 text-center text-slate-400">No payments/collections found in this period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Total Footer */}
                  <div className="bg-slate-100/80 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 p-2.5 text-[11px] font-black flex justify-between items-center text-slate-700 dark:text-slate-350">
                    <div>PAYMENT TOTAL</div>
                    <div className="text-right text-emerald-700 dark:text-emerald-400">₹{(ledgerData.totalCollectionAmount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                  </div>
                </div>

              </div>

              {/* Bottom Summary Reconciliation Details */}
              <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 text-[11px]">
                
                {/* Reconciliation math breakdown */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-w-sm">
                  <div className="bg-slate-50 dark:bg-slate-800 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="font-extrabold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Account Balance Reconciliation</span>
                  </div>
                  <table className="w-full text-left font-semibold">
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2.5 text-slate-500">PREVIOUS BALANCE</td>
                        <td className="p-2.5 text-right text-slate-700 dark:text-slate-300 font-bold">₹{ledgerData.openingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2.5 text-slate-500">ADD PURCHASE FOR THE WEEK (+)</td>
                        <td className="p-2.5 text-right text-rose-600 dark:text-rose-400 font-bold">₹{ledgerData.totalPurchaseAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      <tr className="border-b border-slate-100 dark:border-slate-800/50">
                        <td className="p-2.5 text-slate-500">LESS PAYMENT MADE (-)</td>
                        <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">₹{ledgerData.totalCollectionAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-850 font-black text-slate-900 dark:text-white">
                        <td className="p-2.5 text-xs">FINAL TOTAL PAYABLE</td>
                        <td className="p-2.5 text-right text-xs text-primary-600 dark:text-primary-400">
                          ₹{ledgerData.closingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                      {ledgerCategory === 'ALL' && (
                        <>
                          <tr className="border-t border-slate-100 dark:border-slate-800/30 text-[10px] text-slate-500">
                            <td className="pl-4 p-1.5">🐔 Chicken Balance</td>
                            <td className="p-1.5 text-right font-bold text-slate-700 dark:text-slate-350 font-bold">
                              ₹{ledgerData.chickenBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                          <tr className="border-t border-slate-100 dark:border-slate-800/30 text-[10px] text-slate-500">
                            <td className="pl-4 p-1.5">🥚 Eggs Balance</td>
                            <td className="p-1.5 text-right font-bold text-slate-700 dark:text-slate-350 font-bold">
                              ₹{ledgerData.eggsBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Print Notice & Signatures */}
                <div className="flex flex-col justify-between py-2 text-right">
                  <div className="text-slate-500 dark:text-slate-400 font-black italic pr-2 text-xs">
                    NOTE : BALANCE PAYABLE
                  </div>
                  <div className="pt-10 flex justify-end gap-16 text-slate-400 dark:text-slate-500 font-bold text-[10px]">
                    <div className="text-center w-24 border-t border-slate-200 dark:border-slate-800 pt-1">
                      Cashier Sign
                    </div>
                    <div className="text-center w-24 border-t border-slate-200 dark:border-slate-800 pt-1">
                      Party Sign
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* 3. RAW STOCK INWARD VIEW (Legacy/Detailed) */}
          {reportType === 'stock_inward' && (
             <table className="w-full text-left border-collapse">
             <thead>
               <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 print:bg-slate-100">
                 <th className="p-4 font-semibold text-slate-600">Date</th>
                 <th className="p-4 font-semibold text-slate-600">Supplier</th>
                 <th className="p-4 font-semibold text-slate-600 text-right">Birds / Pcs</th>
                 <th className="p-4 font-semibold text-slate-600 text-right">Weight / Qty</th>
                 <th className="p-4 font-semibold text-slate-600 text-right">Rate / Unit</th>
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
                   <td className="p-4 text-right">{item.weight} {item.chickenType === 'EG' ? 'Pcs' : 'kg'}</td>
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
                 <td className="p-4 text-right font-bold text-primary-600">{rawTotalWeight.toFixed(2)} {rawData.every(r => r.chickenType === 'EG') ? 'Pcs' : 'kg'}</td>
                 <td colSpan="2"></td>
                 <td className="p-4 text-right font-bold text-xl">₹{rawTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
               </tr>
             </tfoot>
           </table>
          )}

          {/* 4. DAILY TRANSACTION AUDIT & RECONCILIATION VIEW */}
          {reportType === 'daily_transactions' && (
            <div className="space-y-6">
              {/* Controls for Detailed vs Summary - Hidden in Print */}
              <div className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-slate-850/40 border-b border-slate-150 print:hidden">
                <span className="text-sm font-semibold text-slate-500">Transaction Filter:</span>
                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl">
                  <button 
                    onClick={() => setDailyViewMode('summary')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dailyViewMode === 'summary' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    📊 Day-by-Day Tally
                  </button>
                  <button 
                    onClick={() => setDailyViewMode('details')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${dailyViewMode === 'details' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    🧾 Detailed Sales Invoices
                  </button>
                </div>
              </div>

              {/* Top reconciliation stat cards - Hidden in Print */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 print:hidden">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-150">
                  <span className="text-[10px] text-slate-450 block font-bold uppercase tracking-wider">Total Sales Income</span>
                  <span className="text-xl font-black text-slate-800 dark:text-slate-100">₹{totalSalesAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-[9px] text-slate-400 block mt-1">Cash ({((totalCashSalesAudit / (totalSalesAudit || 1)) * 100).toFixed(0)}%) | UPI ({((totalUpiSalesAudit / (totalSalesAudit || 1)) * 100).toFixed(0)}%)</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-150">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold uppercase tracking-wider">Cash Collected</span>
                  <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">₹{totalCashSalesAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-[9px] text-emerald-600/70 dark:text-emerald-500/70 block mt-1">Gross cash received</span>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-150">
                  <span className="text-[10px] text-rose-600 dark:text-rose-455 block font-bold uppercase tracking-wider">Cash Deductions</span>
                  <span className="text-xl font-black text-rose-700 dark:text-rose-400">₹{(totalExpensesAudit + totalSupplierPaymentsCashAudit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-[9px] text-rose-600/70 dark:text-rose-500/70 block mt-1">Expenses: ₹{totalExpensesAudit} | Supplier: ₹{totalSupplierPaymentsCashAudit}</span>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-150">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 block font-bold uppercase tracking-wider">Expected Cash Register</span>
                  <span className="text-xl font-black text-indigo-700 dark:text-indigo-400">₹{totalExpectedCashAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-[9px] text-indigo-650/70 dark:text-indigo-500/70 block font-bold mt-1">Verify physical drawer tally!</span>
                </div>
              </div>

              {dailyViewMode === 'summary' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 print:bg-slate-100 text-xs sm:text-sm">
                      <th className="p-4 font-semibold text-slate-600">Date</th>
                      <th className="p-4 font-semibold text-slate-600 text-center">Bills</th>
                      <th className="p-4 font-semibold text-emerald-600 text-right">Cash Sales (A)</th>
                      <th className="p-4 font-semibold text-blue-600 text-right">UPI Sales (B)</th>
                      <th className="p-4 font-semibold text-rose-600 text-right">Petty Expenses (C)</th>
                      <th className="p-4 font-semibold text-amber-700 text-right">Supplier Cash (D)</th>
                      <th className="p-4 font-bold text-slate-800 dark:text-slate-100 text-right">Expected Cash (A-C-D)</th>
                      <th className="p-4 font-bold text-indigo-600 text-right">Total Revenue (A+B)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-300 text-xs sm:text-sm">
                    {dailyTransactionsData.map(d => (
                      <tr key={d.dateStr} className="hover:bg-slate-50/80">
                        <td className="p-4 font-bold text-xs sm:text-sm whitespace-nowrap">{formatDate(d.dateStr)}</td>
                        <td className="p-4 text-center font-medium text-slate-500">{d.billsCount}</td>
                        <td className="p-4 text-right font-medium text-emerald-600">₹{d.cashSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="p-4 text-right font-medium text-blue-600">₹{d.upiSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="p-4 text-right text-rose-500">₹{d.expenses > 0 ? d.expenses.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}</td>
                        <td className="p-4 text-right text-amber-600">₹{d.supplierPaymentsCash > 0 ? d.supplierPaymentsCash.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}</td>
                        <td className={`p-4 text-right font-black ${d.expectedCash >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                          ₹{d.expectedCash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="p-4 text-right font-black text-slate-800 dark:text-slate-150">
                          ₹{d.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/80 border-t-2 border-slate-200 print:bg-slate-100 text-xs sm:text-sm">
                    <tr className="font-bold">
                      <td className="p-4 text-slate-700">GRAND TOTALS:</td>
                      <td className="p-4 text-center text-slate-500">{dailyTransactionsData.reduce((sum, d) => sum + d.billsCount, 0)}</td>
                      <td className="p-4 text-right text-emerald-600">₹{totalCashSalesAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="p-4 text-right text-blue-600">₹{totalUpiSalesAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="p-4 text-right text-rose-500">₹{totalExpensesAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className="p-4 text-right text-amber-600">₹{totalSupplierPaymentsCashAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className={`p-4 text-right text-base sm:text-lg ${totalExpectedCashAudit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                        ₹{totalExpectedCashAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-4 text-right text-lg sm:text-xl text-slate-900 dark:text-white">
                        ₹{totalSalesAudit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="px-6 pb-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 print:bg-slate-100">
                        <th className="p-3 font-semibold text-slate-600 text-xs">Date / Time</th>
                        <th className="p-3 font-semibold text-slate-600 text-xs">Cashier</th>
                        <th className="p-3 font-semibold text-slate-600 text-xs">Shift</th>
                        <th className="p-3 font-semibold text-slate-600 text-xs">Items Details</th>
                        <th className="p-3 font-semibold text-slate-600 text-xs text-center">Mode</th>
                        <th className="p-3 font-bold text-slate-850 dark:text-slate-100 text-xs text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {dailyTransactionsData.flatMap(day => day.salesList).length > 0 ? (
                        dailyTransactionsData.flatMap(day => day.salesList).map(sale => (
                          <tr key={sale.id} className="hover:bg-slate-50">
                            <td className="p-3 whitespace-nowrap text-slate-500">
                              {formatDate(sale.time.toISOString().split('T')[0])} <span className="text-[10px] text-slate-450 block">{sale.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </td>
                            <td className="p-3 font-medium text-slate-700 whitespace-nowrap">{sale.workerName}</td>
                            <td className="p-3 text-slate-500 whitespace-nowrap">{sale.shift}</td>
                            <td className="p-3 text-slate-650 dark:text-slate-300 max-w-xs sm:max-w-md truncate" title={sale.itemsSummary}>{sale.itemsSummary}</td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900' : 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900'}`}>
                                {sale.paymentMethod}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">₹{sale.total.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-500 font-semibold text-sm">No sales invoices found in this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}



        </div>
      </div>
    </div>
  );
}
