import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, User, Filter, AlertCircle, DollarSign, Package, Box, Truck, BarChart2 } from 'lucide-react';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { shopDetails } from './data';

const formatDate = (dateInput) => {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function WholesaleReports() {
  const [activeCategory, setActiveCategory] = useState('financials');
  const [reportType, setReportType] = useState('retailer_ledger');
  const [selectedCustomer, setSelectedCustomer] = useState('ALL');
  
  const today = new Date().toISOString().split('T')[0];
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  
  // Data State
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [collections, setCollections] = useState([]);

  // Fetch Data
  useEffect(() => {
    // Customers
    const unsubCust = onSnapshot(collection(db, 'wholesale_customers'), (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setCustomers(list);
    });

    // Invoices (Sales)
    const qInvoices = query(collection(db, 'wholesale_invoices'), orderBy('timestamp', 'desc'));
    const unsubInv = onSnapshot(qInvoices, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setInvoices(list);
    });

    // Collections (Payments Received)
    const qColl = query(collection(db, 'wholesale_collections'), orderBy('timestamp', 'desc'));
    const unsubColl = onSnapshot(qColl, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setCollections(list);
    });

    return () => {
      unsubCust();
      unsubInv();
      unsubColl();
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
  // DATA PROCESSING: RETAILER LEDGER (T-ACCOUNT)
  // -------------------------------------------------------------
  const generateRetailerLedger = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    let openingBalance = 0;
    let supplies = []; // Debit side (Purchases by retailer)
    let payments = []; // Credit side (Payments from retailer)

    let totalSupplyAmount = 0;
    let totalPaymentAmount = 0;

    if (selectedCustomer === 'ALL') {
      return { supplies, payments, openingBalance: 0, closingBalance: 0, totalSupplyAmount: 0, totalPaymentAmount: 0 };
    }

    // Filter Invoices for this customer
    invoices.filter(i => i.customerId === selectedCustomer).forEach(item => {
      const itemDate = item.timestamp ? new Date(item.timestamp) : new Date(item.invoiceDate);
      const amount = item.totalValue || 0;
      
      if (isDateBefore(itemDate, from)) {
        openingBalance += amount;
      } else if (isDateInRange(itemDate, from, to)) {
        // Expand items to list them row by row in the ledger
        if (item.items && item.items.length > 0) {
          item.items.forEach(lineItem => {
            supplies.push({
              id: `${item.id}-${lineItem.productId}`,
              date: itemDate,
              details: lineItem.name,
              qty: `${lineItem.quantity || lineItem.birdsCount || 0} ${lineItem.unit || ''}`,
              rate: lineItem.rate || 0,
              amount: lineItem.amount || 0
            });
            totalSupplyAmount += (lineItem.amount || 0);
          });
        } else {
          supplies.push({
            id: item.id,
            date: itemDate,
            details: 'Invoice ' + item.invoiceId,
            qty: '-',
            rate: '-',
            amount: amount
          });
          totalSupplyAmount += amount;
        }
      }
    });

    // Filter Collections for this customer
    collections.filter(c => c.customerId === selectedCustomer).forEach(item => {
      const itemDate = item.timestamp ? new Date(item.timestamp) : new Date(item.date);
      const amount = item.amount || 0;

      if (isDateBefore(itemDate, from)) {
        openingBalance -= amount;
      } else if (isDateInRange(itemDate, from, to)) {
        let particulars = item.paymentMethod || 'Cash';
        if (item.referenceNo) particulars += ` (Ref: ${item.referenceNo})`;

        payments.push({
          id: item.id,
          date: itemDate,
          particulars: particulars,
          amount: amount
        });
        totalPaymentAmount += amount;
      }
    });

    // Sort chronologically
    supplies.sort((a, b) => a.date - b.date);
    payments.sort((a, b) => a.date - b.date);
    
    const closingBalance = openingBalance + totalSupplyAmount - totalPaymentAmount;

    return {
      openingBalance,
      supplies,
      payments,
      totalSupplyAmount,
      totalPaymentAmount,
      closingBalance
    };
  };

  const ledgerData = reportType === 'retailer_ledger' ? generateRetailerLedger() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: OUTSTANDING DUES
  // -------------------------------------------------------------
  const generateOutstandingDues = () => {
    let reportData = customers
      .filter(c => (c.outstandingBalance || 0) > 0)
      .map(c => {
        const cPayments = collections.filter(col => col.customerId === c.id).sort((a, b) => {
          const dA = new Date(a.timestamp || a.date);
          const dB = new Date(b.timestamp || b.date);
          return dB - dA;
        });
        const lastPaymentDate = cPayments.length > 0 ? (cPayments[0].timestamp || cPayments[0].date) : null;
        
        return {
          id: c.id,
          shopName: c.shopName,
          phone: c.phone,
          balance: c.outstandingBalance,
          lastPaymentDate: lastPaymentDate
        };
      })
      .sort((a, b) => b.balance - a.balance);

    const totalMarketCredit = reportData.reduce((sum, item) => sum + item.balance, 0);
    return { list: reportData, total: totalMarketCredit };
  };

  const outstandingData = reportType === 'outstanding_dues' ? generateOutstandingDues() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: DAILY CASH FLOW & COLLECTIONS
  // -------------------------------------------------------------
  const generateCashFlow = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);
    
    const filtered = collections.filter(c => {
      const d = new Date(c.timestamp || c.date);
      return d >= from && d <= to;
    }).sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

    let summary = { cash: 0, upi: 0, bank: 0, total: 0 };

    const list = filtered.map(c => {
      const cust = customers.find(x => x.id === c.customerId);
      const amt = parseFloat(c.amount) || 0;
      const mode = (c.paymentMode || 'cash').toLowerCase();
      
      if (mode.includes('upi')) summary.upi += amt;
      else if (mode.includes('bank') || mode.includes('transfer') || mode.includes('neft') || mode.includes('rtgs')) summary.bank += amt;
      else summary.cash += amt;
      
      summary.total += amt;

      return {
        id: c.id,
        date: c.timestamp || c.date,
        shopName: cust ? cust.shopName : 'Unknown',
        amount: amt,
        paymentMode: c.paymentMode || 'Cash',
        refNo: c.referenceNumber || '-'
      };
    });

    return { list, summary };
  };

  const cashFlowData = reportType === 'cash_flow' ? generateCashFlow() : null;

  // --- EXPORT FUNCTIONS ---
  const activeShop = {
    shopName: shopDetails.name,
    proprietorName: 'Mohammad Farooq Momin',
    address: shopDetails.address,
    phone: shopDetails.phone,
    gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
  };

  const exportPDF = () => {
    if (reportType === 'outstanding_dues') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(9); doc.setTextColor(80); doc.text(`Proprietor: ${activeShop.proprietorName}`, 14, 25);
      doc.setFontSize(14); doc.setTextColor(40);
      doc.text(`Outstanding Dues Ledger`, 14, 35);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Date: ${formatDate(new Date().toISOString())}`, 14, 41);

      const tableCol = ["#", "Shop / Retailer", "Contact", "Last Payment", "Outstanding Balance"];
      const tableRows = outstandingData.list.map((c, idx) => [
        idx + 1, c.shopName, c.phone || '-', c.lastPaymentDate ? formatDate(c.lastPaymentDate) : 'No Records', `Rs. ${c.balance.toLocaleString('en-IN')}`
      ]);
      tableRows.push(['', '', '', 'TOTAL MARKET CREDIT', `Rs. ${outstandingData.total.toLocaleString('en-IN')}`]);

      autoTable(doc, { 
        head: [tableCol], 
        body: tableRows, 
        startY: 45, 
        theme: 'grid', 
        styles: { fontSize: 9 }, 
        headStyles: { fillColor: [244, 63, 94] }
      });

      doc.save(`Outstanding_Dues_${new Date().toISOString().split('T')[0]}.pdf`);
      return;
    }

    if (reportType === 'cash_flow') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(9); doc.setTextColor(80); doc.text(`Proprietor: ${activeShop.proprietorName}`, 14, 25);
      doc.setFontSize(14); doc.setTextColor(40);
      doc.text(`Daily Cash Flow & Collections`, 14, 35);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 41);

      // Summary Box
      doc.setFontSize(10); doc.setTextColor(50);
      doc.rect(14, 45, 180, 20);
      doc.text(`Total Collections: Rs. ${cashFlowData.summary.total.toLocaleString('en-IN')}`, 18, 52);
      doc.setFontSize(9);
      doc.text(`Cash: Rs. ${cashFlowData.summary.cash.toLocaleString('en-IN')}  |  UPI: Rs. ${cashFlowData.summary.upi.toLocaleString('en-IN')}  |  Bank: Rs. ${cashFlowData.summary.bank.toLocaleString('en-IN')}`, 18, 60);

      const tableCol = ["Date", "Shop / Retailer", "Mode", "Ref / Note", "Amount"];
      const tableRows = cashFlowData.list.map(c => [
        formatDate(c.date), c.shopName, c.paymentMode, c.refNo, `Rs. ${c.amount.toLocaleString('en-IN')}`
      ]);

      autoTable(doc, { 
        head: [tableCol], 
        body: tableRows, 
        startY: 70, 
        theme: 'grid', 
        styles: { fontSize: 9 }, 
        headStyles: { fillColor: [16, 185, 129] }
      });

      doc.save(`Cash_Flow_${formatDate(fromDate)}.pdf`);
      return;
    }

    if (selectedCustomer === 'ALL') {
      alert("Please select a specific retailer to generate a ledger statement.");
      return;
    }

    const doc = new jsPDF('landscape');
    const customer = customers.find(c => c.id === selectedCustomer);
    const customerName = customer ? customer.shopName : 'Unknown';
    
    // Header
    doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
    doc.setFontSize(9); doc.setTextColor(80); doc.text(`Proprietor: ${activeShop.proprietorName}`, 14, 25);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`${activeShop.address} | Phone: ${activeShop.phone}`, 14, 30);
    doc.text(`GSTIN: ${activeShop.gstin}`, 14, 35);
    
    doc.setFontSize(14); doc.setTextColor(40);
    doc.text(`Retailer Statement of Account: ${customerName}`, 14, 45);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 51);

    // Left Table: Supplies (Debit)
    const leftCol = ["Date", "Supply Details", "Qty/Weight", "Rate", "Amount (Dr)"];
    const leftRows = ledgerData.supplies.map(p => [
      formatDate(p.date), p.details, p.qty, p.rate, p.amount.toLocaleString('en-IN')
    ]);
    leftRows.push(['TOTAL SUPPLY', '', '', '', ledgerData.totalSupplyAmount.toLocaleString('en-IN')]);

    // Right Table: Payments (Credit)
    const rightCol = ["Date", "Payment Received", "Amount (Cr)"];
    const rightRows = ledgerData.payments.map(py => [
      formatDate(py.date), py.particulars, py.amount.toLocaleString('en-IN')
    ]);
    rightRows.push(['TOTAL PAYMENTS', '', ledgerData.totalPaymentAmount.toLocaleString('en-IN')]);

    // Draw Left Table
    autoTable(doc, { 
      head: [leftCol], 
      body: leftRows, 
      startY: 57, 
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
      startY: 57, 
      margin: { left: 150 }, 
      tableWidth: 130, 
      theme: 'grid', 
      styles: { fontSize: 8 }, 
      headStyles: { fillColor: [16, 185, 129] }
    });

    const finalY = Math.max(doc.lastAutoTable.finalY || 100, 100);

    // Add Reconciliation Box below
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.rect(14, finalY + 10, 100, 35);
    doc.text("ACCOUNT RECONCILIATION", 18, finalY + 16);
    
    doc.setFontSize(9);
    doc.text(`OPENING BALANCE:`, 18, finalY + 23);
    doc.text(`Rs. ${ledgerData.openingBalance.toLocaleString('en-IN')}`, 85, finalY + 23, { align: 'right' });
    doc.text(`ADD TOTAL SUPPLY (+):`, 18, finalY + 28);
    doc.text(`Rs. ${ledgerData.totalSupplyAmount.toLocaleString('en-IN')}`, 85, finalY + 28, { align: 'right' });
    doc.text(`LESS PAYMENT MADE (-):`, 18, finalY + 33);
    doc.text(`Rs. ${ledgerData.totalPaymentAmount.toLocaleString('en-IN')}`, 85, finalY + 33, { align: 'right' });
    
    doc.setFont("helvetica", "bold");
    doc.text(`CLOSING BALANCE (To Pay):`, 18, finalY + 41);
    doc.text(`Rs. ${ledgerData.closingBalance.toLocaleString('en-IN')}`, 85, finalY + 41, { align: 'right' });

    // Signatures
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Authorized Sign", 150, finalY + 40);
    doc.line(150, finalY + 37, 180, finalY + 37);
    
    doc.text("Retailer Sign", 210, finalY + 40);
    doc.line(210, finalY + 37, 240, finalY + 37);

    doc.save(`Wholesale_Statement_${customerName.replace(/\s+/g, '_')}_${fromDate}.pdf`);
  };

  const exportExcel = async () => {
    if (reportType === 'outstanding_dues') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Outstanding Dues');

      worksheet.mergeCells('A1:E1');
      worksheet.getCell('A1').value = 'OUTSTANDING DUES LEDGER';
      worksheet.getCell('A1').font = { size: 14, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.getCell('A3').value = 'Total Market Credit:';
      worksheet.getCell('B3').value = outstandingData.total;
      worksheet.getCell('B3').font = { bold: true };

      worksheet.getRow(5).values = ['#', 'Shop / Retailer', 'Contact', 'Last Payment', 'Outstanding Balance'];
      worksheet.getRow(5).font = { bold: true };
      
      outstandingData.list.forEach((c, idx) => {
        worksheet.addRow([
          idx + 1, c.shopName, c.phone || '', c.lastPaymentDate ? formatDate(c.lastPaymentDate) : '', c.balance
        ]);
      });

      worksheet.columns = [{ width: 5 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 20 }];
      
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Outstanding_Dues_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'cash_flow') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Cash Flow');

      worksheet.mergeCells('A1:E1');
      worksheet.getCell('A1').value = 'DAILY CASH FLOW & COLLECTIONS';
      worksheet.getCell('A1').font = { size: 14, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.getCell('A3').value = 'Period:';
      worksheet.getCell('B3').value = `${formatDate(fromDate)} to ${formatDate(toDate)}`;
      worksheet.getCell('B3').font = { bold: true };

      worksheet.getCell('D3').value = 'Total Collected:';
      worksheet.getCell('E3').value = cashFlowData.summary.total;
      worksheet.getCell('E3').font = { bold: true };

      worksheet.getRow(5).values = ['Date', 'Shop / Retailer', 'Payment Mode', 'Ref / Note', 'Amount'];
      worksheet.getRow(5).font = { bold: true };
      
      cashFlowData.list.forEach(c => {
        worksheet.addRow([
          formatDate(c.date), c.shopName, c.paymentMode, c.refNo, c.amount
        ]);
      });

      worksheet.columns = [{ width: 15 }, { width: 30 }, { width: 15 }, { width: 20 }, { width: 15 }];
      
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Cash_Flow_${formatDate(fromDate)}.xlsx`);
      return;
    }

    if (selectedCustomer === 'ALL') {
      alert("Please select a specific retailer.");
      return;
    }

    const customer = customers.find(c => c.id === selectedCustomer);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Statement');

    // Title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'RETAILER WEEKLY STATEMENT OF ACCOUNT';
    worksheet.getCell('A1').font = { size: 14, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.getCell('A3').value = 'Customer:';
    worksheet.getCell('B3').value = customer ? customer.shopName : 'Unknown';
    worksheet.getCell('B3').font = { bold: true };
    
    worksheet.getCell('D3').value = 'Period:';
    worksheet.getCell('E3').value = `${formatDate(fromDate)} to ${formatDate(toDate)}`;
    worksheet.getCell('E3').font = { bold: true };

    // Table Headers
    worksheet.mergeCells('A5:E5');
    worksheet.getCell('A5').value = 'SUPPLY DETAILS (Dr)';
    worksheet.getCell('A5').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('A5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };
    worksheet.getCell('A5').alignment = { horizontal: 'center' };

    worksheet.mergeCells('F5:H5');
    worksheet.getCell('F5').value = 'PAYMENT RECEIVED (Cr)';
    worksheet.getCell('F5').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getCell('F5').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
    worksheet.getCell('F5').alignment = { horizontal: 'center' };

    worksheet.getRow(6).values = [
      'Date', 'Particulars', 'Qty/Weight', 'Rate', 'Amount', 
      'Date', 'Particulars', 'Amount'
    ];
    worksheet.getRow(6).font = { bold: true };
    
    const thinBorder = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    
    // Apply borders to header row
    worksheet.getRow(6).eachCell(cell => cell.border = thinBorder);

    // Data Rows
    const maxLength = Math.max(ledgerData.supplies.length, ledgerData.payments.length);
    let rowNum = 7;
    for (let i = 0; i < maxLength; i++) {
      const p = ledgerData.supplies[i] || {};
      const py = ledgerData.payments[i] || {};
      
      const row = worksheet.addRow([
        p.date ? formatDate(p.date) : '',
        p.details || '',
        p.qty || '',
        p.rate || '',
        p.amount || '',
        py.date ? formatDate(py.date) : '',
        py.particulars || '',
        py.amount || ''
      ]);
      row.eachCell(cell => cell.border = thinBorder);
      rowNum++;
    }

    // Totals Row
    const totalsRow = worksheet.addRow([
      'TOTAL SUPPLY', '', '', '', ledgerData.totalSupplyAmount,
      'TOTAL PAYMENTS', '', ledgerData.totalPaymentAmount
    ]);
    totalsRow.font = { bold: true };
    totalsRow.eachCell(cell => cell.border = thinBorder);
    
    // Account Reconciliation
    rowNum += 3;
    worksheet.mergeCells(`A${rowNum}:C${rowNum}`);
    const recHeader = worksheet.getCell(`A${rowNum}`);
    recHeader.value = 'ACCOUNT RECONCILIATION';
    recHeader.font = { bold: true };
    recHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    
    worksheet.getCell(`A${rowNum}`).border = thinBorder;
    worksheet.getCell(`B${rowNum}`).border = thinBorder;
    worksheet.getCell(`C${rowNum}`).border = thinBorder;
    
    const recLabels = [
      'Opening Balance',
      'Add: Total Supply',
      'Less: Payments Received',
      'Closing Balance (To Pay)'
    ];
    
    const recValues = [
      ledgerData.openingBalance,
      ledgerData.totalSupplyAmount,
      ledgerData.totalPaymentAmount,
      ledgerData.closingBalance
    ];
    
    for (let i = 0; i < 4; i++) {
      const curRow = rowNum + i + 1;
      worksheet.mergeCells(`A${curRow}:B${curRow}`);
      
      const labelCell = worksheet.getCell(`A${curRow}`);
      labelCell.value = recLabels[i];
      
      const valCell = worksheet.getCell(`C${curRow}`);
      valCell.value = recValues[i];
      
      if (i === 3) {
        labelCell.font = { bold: true };
        valCell.font = { bold: true };
      }
      
      // Apply borders to merged area (both A and B) and the value cell (C)
      worksheet.getCell(`A${curRow}`).border = thinBorder;
      worksheet.getCell(`B${curRow}`).border = thinBorder;
      worksheet.getCell(`C${curRow}`).border = thinBorder;
    }

    // Adjust column widths
    worksheet.columns = [
      { width: 12 }, { width: 25 }, { width: 15 }, { width: 10 }, { width: 15 },
      { width: 12 }, { width: 30 }, { width: 15 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Wholesale_Statement_${fromDate}.xlsx`);
  };

  const categories = [
    { id: 'financials', label: 'Financials & Credit', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'stock', label: 'Stock & Mortality', icon: <Package className="w-4 h-4" /> },
    { id: 'crates', label: 'Crate Circulation', icon: <Box className="w-4 h-4" /> },
    { id: 'logistics', label: 'Logistics', icon: <Truck className="w-4 h-4" /> }
  ];

  const reportOptions = {
    financials: [
      { id: 'retailer_ledger', label: 'Retailer Ledger (T-Account)' },
      { id: 'outstanding_dues', label: 'Outstanding Dues Ledger' },
      { id: 'cash_flow', label: 'Daily Cash Flow & Collections' },
      { id: 'revenue_category', label: 'Revenue by Category', disabled: true }
    ],
    stock: [
      { id: 'yield', label: 'Procurement vs Dispatch (Yield)', disabled: true },
      { id: 'carry_over', label: 'Carry-Over Analysis', disabled: true },
      { id: 'mortality', label: 'Daily Mortality Report', disabled: true }
    ],
    crates: [
      { id: 'outstanding_crates', label: 'Outstanding Crates by Merchant', disabled: true },
      { id: 'crate_aging', label: 'Crate Aging Report', disabled: true }
    ],
    logistics: [
      { id: 'truck_settlement', label: 'Truck Daily Settlement', disabled: true },
      { id: 'top_merchants', label: 'Top Merchants / Defaulters', disabled: true }
    ]
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <div className="print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-left">Wholesale Reports</h2>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setReportType(reportOptions[cat.id][0].id);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                  activeCategory === cat.id 
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
                }`}
              >
                {cat.icon}
                {cat.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end text-left">
            <div className="flex flex-wrap gap-4 items-end w-full md:w-auto">
              
              <div className="w-full md:w-56">
                <label className="block text-sm font-medium text-slate-500 mb-1">Select Report</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                >
                  {reportOptions[activeCategory].map(opt => (
                    <option key={opt.id} value={opt.id} disabled={opt.disabled}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-56">
                <label className="block text-sm font-medium text-slate-500 mb-1">Select Retailer</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium disabled:opacity-50"
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  disabled={reportType === 'outstanding_dues' || reportType === 'cash_flow'}
                >
                  <option value="ALL">-- Select a Retailer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.shopName}</option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-40">
                <label className="block text-sm font-medium text-slate-500 mb-1">From Date</label>
                <input 
                  type="date"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div className="w-full md:w-40">
                <label className="block text-sm font-medium text-slate-500 mb-1">To Date</label>
                <input 
                  type="date"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
              <button onClick={exportPDF} disabled={selectedCustomer === 'ALL'} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50">
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportExcel} disabled={selectedCustomer === 'ALL'} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button onClick={() => window.print()} disabled={selectedCustomer === 'ALL'} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview */}
      <div className="mt-8">
        {reportType === 'retailer_ledger' && selectedCustomer === 'ALL' && (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
            <AlertCircle className="w-8 h-8 mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-bold">Select a Retailer</p>
            <p className="text-sm mt-1">Choose a retailer from the dropdown to generate their ledger statement.</p>
          </div>
        )}
        
        {reportType === 'retailer_ledger' && selectedCustomer !== 'ALL' && ledgerData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Retailer Statement of Account</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {customers.find(c => c.id === selectedCustomer)?.shopName} | Period: {formatDate(fromDate)} to {formatDate(toDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-400">Closing Balance</p>
                <p className={`text-2xl font-black ${ledgerData.closingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  ₹{ledgerData.closingBalance.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
              
              {/* Left Side: Supply (Debit) */}
              <div className="p-0">
                <div className="bg-rose-50 dark:bg-rose-950/20 px-4 py-2 border-b border-rose-100 dark:border-rose-900/50">
                  <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">Supply Details (Dr)</h4>
                </div>
                <div className="p-4 space-y-4">
                  {ledgerData.supplies.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-slate-800/50 pb-3 last:border-0 last:pb-0">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 block">{item.details}</span>
                        <span className="text-xs text-slate-400">{formatDate(item.date)} | {item.qty} @ ₹{item.rate}</span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-white">₹{item.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {ledgerData.supplies.length === 0 && <p className="text-center text-xs text-slate-400 italic">No supply records found.</p>}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center mt-auto">
                  <span className="text-xs font-bold uppercase text-slate-500">Total Supply</span>
                  <span className="font-black text-rose-600 dark:text-rose-400">₹{ledgerData.totalSupplyAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Right Side: Payments (Credit) */}
              <div className="p-0">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 px-4 py-2 border-b border-emerald-100 dark:border-emerald-900/50">
                  <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Payments Received (Cr)</h4>
                </div>
                <div className="p-4 space-y-4">
                  {ledgerData.payments.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-slate-50 dark:border-slate-800/50 pb-3 last:border-0 last:pb-0">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 block">{item.particulars}</span>
                        <span className="text-xs text-slate-400">{formatDate(item.date)}</span>
                      </div>
                      <span className="font-bold text-slate-800 dark:text-white">₹{item.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  {ledgerData.payments.length === 0 && <p className="text-center text-xs text-slate-400 italic">No payment records found.</p>}
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center mt-auto">
                  <span className="text-xs font-bold uppercase text-slate-500">Total Payments</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">₹{ledgerData.totalPaymentAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Reconciliation Footer */}
            <div className="bg-slate-800 dark:bg-slate-950 text-white p-6 flex flex-wrap justify-between items-center gap-4">
              <div className="flex gap-8">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Opening Balance</p>
                  <p className="font-mono mt-0.5 text-slate-200">₹{ledgerData.openingBalance.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-rose-400">
                  <p className="text-[10px] uppercase font-bold tracking-wider">+ Supplies</p>
                  <p className="font-mono mt-0.5">₹{ledgerData.totalSupplyAmount.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-emerald-400">
                  <p className="text-[10px] uppercase font-bold tracking-wider">- Payments</p>
                  <p className="font-mono mt-0.5">₹{ledgerData.totalPaymentAmount.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold tracking-wider text-slate-300">Closing Balance Payable</p>
                <p className="text-2xl font-black text-white">₹{ledgerData.closingBalance.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>
        )}

        {reportType === 'outstanding_dues' && outstandingData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Outstanding Dues Ledger</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Real-time snapshot of market credit
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-400">Total Market Credit</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  ₹{outstandingData.total.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-bold">#</th>
                    <th className="p-4 font-bold">Shop / Retailer</th>
                    <th className="p-4 font-bold">Contact</th>
                    <th className="p-4 font-bold">Last Payment</th>
                    <th className="p-4 font-bold text-right">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {outstandingData.list.map((cust, idx) => (
                    <tr key={cust.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-400">{idx + 1}</td>
                      <td className="p-4">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{cust.shopName}</p>
                      </td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{cust.phone || '-'}</td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                        {cust.lastPaymentDate ? formatDate(cust.lastPaymentDate) : 'No Records'}
                      </td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold rounded-lg text-sm border border-rose-100 dark:border-rose-900/50">
                          ₹{cust.balance.toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {outstandingData.list.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                        No outstanding dues in the market!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'cash_flow' && cashFlowData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Daily Cash Flow & Collections</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Summary of incoming payments from {formatDate(fromDate)} to {formatDate(toDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-400">Total Collected</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{cashFlowData.summary.total.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cash Received</p>
                <p className="text-xl font-black text-slate-700 dark:text-slate-200 mt-1">₹{cashFlowData.summary.cash.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">UPI Collections</p>
                <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">₹{cashFlowData.summary.upi.toLocaleString('en-IN')}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Bank Transfer</p>
                <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">₹{cashFlowData.summary.bank.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-bold">Date</th>
                    <th className="p-4 font-bold">Shop / Retailer</th>
                    <th className="p-4 font-bold">Mode</th>
                    <th className="p-4 font-bold">Ref / Note</th>
                    <th className="p-4 font-bold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {cashFlowData.list.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-500">{formatDate(c.date)}</td>
                      <td className="p-4">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{c.shopName}</p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                          c.paymentMode?.toLowerCase().includes('cash') ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          c.paymentMode?.toLowerCase().includes('upi') ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                          'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                        }`}>
                          {c.paymentMode || 'Cash'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-500 italic max-w-[200px] truncate" title={c.refNo}>
                        {c.refNo}
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          ₹{c.amount.toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {cashFlowData.list.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                        No collections logged in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
