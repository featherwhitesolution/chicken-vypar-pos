import React, { useState, useEffect } from 'react';
import { FileText, Download, Printer, User, Filter, AlertCircle, IndianRupee, Package, Box, Truck, BarChart2 } from 'lucide-react';
import { supabase } from './supabase';
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
  const [farmInwards, setFarmInwards] = useState([]);
  const [truckDispatches, setTruckDispatches] = useState([]);
  const [mortalityLogs, setMortalityLogs] = useState([]);
  const [cratesLedger, setCratesLedger] = useState([]);

  // Fetch Data
  useEffect(() => {
    const fetchAllData = async () => {
      // 1. Customers
      const { data: custData } = await supabase.from('wholesale_customers').select('*');
      if (custData) {
        setCustomers(custData.map(row => ({
          id: row.id,
          shopName: row.shop_name,
          proprietorName: row.proprietor_name,
          phone: row.phone,
          state: row.state,
          city: row.city,
          area: row.area,
          route: row.route,
          rateOffset: Number(row.rate_offset),
          location: row.location_lat && row.location_lng ? { lat: row.location_lat, lng: row.location_lng } : null,
          createdAt: row.created_at,
          uniqueId: row.unique_id,
          outstandingBalance: Number(row.outstanding_balance) || 0,
          outstandingCrates: Number(row.outstanding_crates) || 0
        })));
      }

      // 2. Invoices
      const { data: invData } = await supabase.from('wholesale_invoices').select('*').order('created_at', { ascending: false });
      if (invData) {
        setInvoices(invData.map(row => ({
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name,
          totalValue: Number(row.amount),
          invoiceDate: row.created_at ? row.created_at.split('T')[0] : '',
          timestamp: row.created_at,
          invoiceId: row.invoice_id,
          items: typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || [])
        })));
      }

      // 3. Collections (Payments)
      const { data: collData } = await supabase.from('wholesale_payments').select('*').order('created_at', { ascending: false });
      if (collData) {
        setCollections(collData.map(row => ({
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name,
          amount: Number(row.amount),
          paymentMethod: row.payment_method,
          date: row.payment_date,
          notes: row.notes,
          timestamp: row.created_at
        })));
      }

      // 4. Farm Inwards
      const { data: farmData } = await supabase.from('farm_inwards').select('*').order('date', { ascending: false });
      if (farmData) {
        setFarmInwards(farmData.map(row => ({
          id: row.id,
          farmName: row.farm_name,
          vehicleNo: row.vehicle_no,
          driverName: row.driver_name,
          farmWeightLoaded: Number(row.farm_weight_loaded),
          birdsLoaded: Number(row.birds_loaded),
          grossWeight: Number(row.gross_weight),
          tareWeight: Number(row.tare_weight),
          netWeight: Number(row.net_weight),
          sellableWeight: Number(row.sellable_weight),
          birdsReceived: Number(row.birds_received),
          deadBirdsWeight: Number(row.dead_birds_weight),
          transitWeightLoss: Number(row.transit_weight_loss),
          transitWeightLossPercent: Number(row.transit_weight_loss_percent),
          transitMortality: Number(row.transit_mortality),
          rate: Number(row.rate),
          totalValue: Number(row.total_value),
          notes: row.notes,
          date: row.date,
          timestamp: row.timestamp
        })));
      }

      // 5. Truck Dispatches
      const { data: truckData } = await supabase.from('truck_dispatches').select('*').order('dispatch_date', { ascending: false });
      if (truckData) {
        setTruckDispatches(truckData.map(row => ({
          id: row.id,
          truckNumber: row.truck_number,
          driverName: row.driver_name,
          driverPhone: row.driver_phone,
          dispatchDate: row.dispatch_date,
          totalBirds: row.total_birds,
          totalWeightKg: Number(row.total_weight_kg),
          soldWeightKg: Number(row.sold_weight_kg),
          deadBirdsWeightKg: Number(row.dead_birds_weight_kg),
          deadBirdsCount: row.dead_birds_count,
          remainingWeightKg: Number(row.remaining_weight_kg),
          ratePerKg: Number(row.rate_per_kg),
          status: row.status,
          notes: row.notes,
          isCarryOver: row.is_carry_over,
          dieselExpense: Number(row.diesel_expense),
          driverBhatta: Number(row.driver_bhatta),
          tollExpense: Number(row.toll_expense),
          otherExpenses: Number(row.other_expenses),
          carryOverDate: row.carry_over_date,
          resolvedAt: row.resolved_at,
          updatedAt: row.updated_at,
          createdAt: row.created_at
        })));
      }

      // 6. Mortality
      const { data: mortData } = await supabase.from('wholesale_mortality').select('*').order('date', { ascending: false });
      if (mortData) {
        setMortalityLogs(mortData.map(row => ({
          id: row.id,
          date: row.date,
          weightKg: Number(row.weight_kg),
          count: Number(row.count),
          notes: row.notes,
          source: row.source,
          createdAt: row.created_at
        })));
      }

      // 7. Crates Ledger
      const { data: cratesData } = await supabase.from('crates_ledger').select('*').order('created_at', { ascending: false });
      if (cratesData) {
        setCratesLedger(cratesData.map(row => ({
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name,
          date: row.created_at ? row.created_at.split('T')[0] : '',
          cratesIssued: row.action_type === 'issue' ? row.quantity : 0,
          cratesReturned: row.action_type === 'return' ? row.quantity : 0,
          netOutstanding: row.action_type === 'issue' ? row.quantity : -row.quantity,
          invoiceId: row.notes || '',
          timestamp: row.created_at
        })));
      }
    };

    fetchAllData();

    // Subscribe to changes on any of these tables to refresh
    const channel = supabase
      .channel('wholesale-reports-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_customers' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_invoices' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_payments' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_inwards' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'truck_dispatches' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_mortality' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crates_ledger' }, fetchAllData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  // -------------------------------------------------------------
  // DATA PROCESSING: REVENUE BY CATEGORY
  // -------------------------------------------------------------
  const generateRevenueCategory = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);
    
    const filteredInvoices = invoices.filter(inv => {
      const d = new Date(inv.timestamp || inv.date);
      return d >= from && d <= to;
    });

    let liveChickenRevenue = 0;
    let liveChickenKg = 0;
    let eggsRevenue = 0;
    let eggsQty = 0;

    filteredInvoices.forEach(inv => {
      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach(item => {
          if (item.productId === 1 || item.name?.toLowerCase().includes('chicken')) { // Live Chicken
            liveChickenRevenue += (parseFloat(item.amount) || 0);
            liveChickenKg += (parseFloat(item.quantity) || 0);
          } else if (item.productId === 16 || item.name?.toLowerCase().includes('egg')) { // Eggs
            eggsRevenue += (parseFloat(item.amount) || 0);
            eggsQty += (parseFloat(item.quantity) || 0);
          }
        });
      }
    });

    const totalRevenue = liveChickenRevenue + eggsRevenue;

    return {
      liveChicken: { 
        revenue: liveChickenRevenue, 
        qty: liveChickenKg, 
        percentage: totalRevenue > 0 ? ((liveChickenRevenue/totalRevenue)*100).toFixed(1) : 0 
      },
      eggs: { 
        revenue: eggsRevenue, 
        qty: eggsQty, 
        percentage: totalRevenue > 0 ? ((eggsRevenue/totalRevenue)*100).toFixed(1) : 0 
      },
      totalRevenue
    };
  };

  const revenueCategoryData = reportType === 'revenue_category' ? generateRevenueCategory() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: PROCUREMENT VS DISPATCH (YIELD)
  // -------------------------------------------------------------
  const generateYieldReport = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    const fInwards = farmInwards.filter(f => isDateInRange(new Date(f.timestamp || f.date), from, to));
    const invs = invoices.filter(i => isDateInRange(new Date(i.timestamp || i.date), from, to));
    const mort = mortalityLogs.filter(m => isDateInRange(new Date(m.timestamp || m.date), from, to));

    const totalProcuredKg = fInwards.reduce((acc, curr) => acc + (parseFloat(curr.netWeight) || 0), 0);
    const totalSoldKg = invs.reduce((acc, curr) => {
      let kg = 0;
      if (curr.items) {
        curr.items.forEach(item => {
          if (item.productId === 1 || item.name?.toLowerCase().includes('chicken')) {
            kg += (parseFloat(item.quantity) || 0);
          }
        });
      }
      return acc + kg;
    }, 0);
    
    // Total mortality across all sources (inwards + truck partials + shop floor)
    // Wait, the inwards mortality is already in netWeight (it deducts deadBirdsWeight?), 
    // actually we should just sum the explicit mortality logs + farm inward dead weight.
    let totalMortalityKg = mort.reduce((acc, curr) => acc + (parseFloat(curr.weightKg) || 0), 0);
    totalMortalityKg += fInwards.reduce((acc, curr) => acc + (parseFloat(curr.deadBirdsWeight) || 0), 0);
    
    // Truck mortality from partial sales is not explicitly in a central collection unless we add it to wholesale_mortality.
    // For now, calculate yield from known inputs:
    const shrinkageKg = Math.max(0, totalProcuredKg - totalSoldKg - totalMortalityKg);
    const yieldPercentage = totalProcuredKg > 0 ? ((totalSoldKg / totalProcuredKg) * 100).toFixed(1) : 0;

    return {
      procuredKg: totalProcuredKg,
      soldKg: totalSoldKg,
      mortalityKg: totalMortalityKg,
      shrinkageKg: shrinkageKg,
      yieldPercentage: yieldPercentage
    };
  };

  const yieldData = reportType === 'yield' ? generateYieldReport() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: CARRY-OVER ANALYSIS
  // -------------------------------------------------------------
  const generateCarryOverReport = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    const carryOvers = truckDispatches.filter(d => 
      (d.status === 'carryover' || d.isCarryOver) && 
      isDateInRange(new Date(d.createdAt || d.dispatchDate), from, to)
    );

    let totalCarryOverKg = 0;
    const list = carryOvers.map(co => {
      const kg = parseFloat(co.remainingWeightKg) || 0;
      totalCarryOverKg += kg;
      return {
        id: co.id,
        date: co.dispatchDate,
        truckNumber: co.truckNumber,
        driverName: co.driverName,
        carryOverKg: kg,
        lockedRate: co.ratePerKg || 0,
        originalDate: co.carryOverDate || 'N/A'
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return { list, totalCarryOverKg };
  };

  const carryOverData = reportType === 'carry_over' ? generateCarryOverReport() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: DAILY MORTALITY REPORT
  // -------------------------------------------------------------
  const generateMortalityReport = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    const fInwards = farmInwards.filter(f => isDateInRange(new Date(f.timestamp || f.date), from, to) && parseFloat(f.deadBirdsWeight) > 0);
    const shopFloor = mortalityLogs.filter(m => isDateInRange(new Date(m.timestamp || m.date), from, to));
    
    // Truck dispatches with mortality
    const truckMort = truckDispatches.filter(d => 
      isDateInRange(new Date(d.updatedAt || d.dispatchDate), from, to) && parseFloat(d.deadBirdsWeightKg) > 0
    );

    let list = [];
    let totalMortalityKg = 0;
    let totalMortalityCount = 0;

    fInwards.forEach(f => {
      const w = parseFloat(f.deadBirdsWeight) || 0;
      const c = parseInt(f.transitMortality) || 0; // Or whatever farm inward uses
      totalMortalityKg += w;
      totalMortalityCount += c;
      list.push({ date: f.date, source: 'Farm Inward (DOA)', details: `Vehicle: ${f.vehicleNo}`, weightKg: w, count: c });
    });

    shopFloor.forEach(m => {
      const w = parseFloat(m.weightKg) || 0;
      const c = parseInt(m.count) || 0;
      totalMortalityKg += w;
      totalMortalityCount += c;
      list.push({ date: m.date, source: 'Shop Floor', details: m.notes || '-', weightKg: w, count: c });
    });

    truckMort.forEach(t => {
      const w = parseFloat(t.deadBirdsWeightKg) || 0;
      const c = parseInt(t.deadBirdsCount) || 0;
      totalMortalityKg += w;
      totalMortalityCount += c;
      list.push({ date: t.dispatchDate, source: 'Truck Route', details: `Truck: ${t.truckNumber}`, weightKg: w, count: c });
    });

    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { list, totalMortalityKg, totalMortalityCount };
  };

  const mortalityData = reportType === 'mortality' ? generateMortalityReport() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: OUTSTANDING CRATES BY MERCHANT
  // -------------------------------------------------------------
  const generateOutstandingCratesReport = () => {
    const list = customers
      .filter(c => (c.outstandingCrates || 0) > 0)
      .map(c => ({
        id: c.id,
        shopName: c.shopName,
        phone: c.phone || '-',
        route: c.route || '-',
        outstandingCrates: c.outstandingCrates
      }))
      .sort((a, b) => b.outstandingCrates - a.outstandingCrates);
    
    const totalOutstanding = list.reduce((sum, item) => sum + item.outstandingCrates, 0);
    return { list, totalOutstanding };
  };

  const outstandingCratesData = reportType === 'outstanding_crates' ? generateOutstandingCratesReport() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: CRATE AGING REPORT (FIFO ESTIMATION)
  // -------------------------------------------------------------
  const generateCrateAgingReport = () => {
    const list = [];
    customers.filter(c => (c.outstandingCrates || 0) > 0).forEach(customer => {
      let remaining = customer.outstandingCrates;
      const custTxs = cratesLedger
        .filter(tx => tx.customerId === customer.id && (tx.cratesIssued || 0) > 0)
        .sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date)); // Newest first

      let olderThan7 = 0;
      let olderThan15 = 0;
      let olderThan30 = 0;
      const today = new Date();

      // Go backwards in time assigning remaining crates to issues
      for (const tx of custTxs) {
        if (remaining <= 0) break;
        const issued = tx.cratesIssued || 0;
        const ageInDays = Math.floor((today - new Date(tx.timestamp || tx.date)) / (1000 * 60 * 60 * 24));
        const assigned = Math.min(remaining, issued);
        
        if (ageInDays > 30) olderThan30 += assigned;
        else if (ageInDays > 15) olderThan15 += assigned;
        else if (ageInDays > 7) olderThan7 += assigned;
        
        remaining -= assigned;
      }
      
      // If there are still remaining crates but no txs found, dump them into oldest bucket
      if (remaining > 0) {
         olderThan30 += remaining;
      }

      list.push({
        id: customer.id,
        shopName: customer.shopName,
        total: customer.outstandingCrates,
        olderThan7,
        olderThan15,
        olderThan30
      });
    });

    return { 
      list: list.sort((a, b) => b.total - a.total),
      totals: {
        total: list.reduce((acc, c) => acc + c.total, 0),
        olderThan7: list.reduce((acc, c) => acc + c.olderThan7, 0),
        olderThan15: list.reduce((acc, c) => acc + c.olderThan15, 0),
        olderThan30: list.reduce((acc, c) => acc + c.olderThan30, 0)
      }
    };
  };

  const crateAgingData = reportType === 'crate_aging' ? generateCrateAgingReport() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: TRUCK DAILY SETTLEMENT
  // -------------------------------------------------------------
  const generateTruckSettlementReport = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);

    const dispatches = truckDispatches.filter(d => isDateInRange(new Date(d.dispatchDate), from, to));
    
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    const list = dispatches.map(d => {
      const expenses = (parseFloat(d.dieselExpense) || 0) + (parseFloat(d.driverBhatta) || 0) + (parseFloat(d.tollExpense) || 0) + (parseFloat(d.otherExpenses) || 0);
      const cash = parseFloat(d.cashCollected) || 0;
      
      totalExpenses += expenses;
      totalRevenue += cash; // Using cash collected as proxy for settlement cash

      return {
        id: d.id,
        date: d.dispatchDate,
        truckNumber: d.truckNumber,
        driverName: d.driverName,
        status: d.status,
        expenses,
        cash,
        mortalityKg: parseFloat(d.deadBirdsWeightKg) || 0,
        carryOverKg: parseFloat(d.remainingWeightKg) || 0
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    return { list, totalRevenue, totalExpenses };
  };

  const truckSettlementData = reportType === 'truck_settlement' ? generateTruckSettlementReport() : null;

  // -------------------------------------------------------------
  // DATA PROCESSING: TOP MERCHANTS / DEFAULTERS
  // -------------------------------------------------------------
  const generateTopMerchantsReport = () => {
    const from = new Date(fromDate); from.setHours(0, 0, 0, 0);
    const to = new Date(toDate); to.setHours(23, 59, 59, 999);
    
    // Top by Volume/Revenue in period
    const merchantStats = {};
    invoices.filter(i => isDateInRange(new Date(i.timestamp || i.date), from, to)).forEach(inv => {
      if (!merchantStats[inv.customerId]) {
        merchantStats[inv.customerId] = { revenue: 0, volume: 0 };
      }
      merchantStats[inv.customerId].revenue += (parseFloat(inv.totalValue) || 0);
      if (inv.items) {
        inv.items.forEach(item => {
          merchantStats[inv.customerId].volume += (parseFloat(item.quantity) || 0);
        });
      }
    });

    const topMerchants = Object.keys(merchantStats).map(id => {
      const c = customers.find(x => x.id === id);
      return {
        id,
        shopName: c ? c.shopName : 'Unknown',
        revenue: merchantStats[id].revenue,
        volume: merchantStats[id].volume
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 10); // Top 10

    // Defaulters (highest outstanding + oldest payment)
    const defaulters = customers
      .filter(c => (c.outstandingBalance || 0) > 0)
      .map(c => {
        const cPayments = collections.filter(col => col.customerId === c.id).sort((a, b) => {
          return new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date);
        });
        const lastPaymentDate = cPayments.length > 0 ? (cPayments[0].timestamp || cPayments[0].date) : null;
        let daysSincePayment = -1;
        if (lastPaymentDate) {
          daysSincePayment = Math.floor((new Date() - new Date(lastPaymentDate)) / (1000 * 60 * 60 * 24));
        } else {
          // If they never paid, assume max risk (using an arbitrary large number or just sorting them high)
          daysSincePayment = 999;
        }

        return {
          id: c.id,
          shopName: c.shopName,
          balance: c.outstandingBalance,
          lastPaymentDate,
          daysSincePayment
        };
      })
      // Sort by combination of days since payment and balance size
      .sort((a, b) => {
        if (b.daysSincePayment !== a.daysSincePayment) {
          return b.daysSincePayment - a.daysSincePayment;
        }
        return b.balance - a.balance;
      }).slice(0, 10);

    return { topMerchants, defaulters };
  };

  const topMerchantsData = reportType === 'top_merchants' ? generateTopMerchantsReport() : null;

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

    if (reportType === 'outstanding_crates') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40);
      doc.text(`Outstanding Crates by Merchant`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Date: ${formatDate(new Date().toISOString())}`, 14, 36);
      doc.text(`Total Outstanding: ${outstandingCratesData.totalOutstanding} crates`, 14, 42);

      const tableCol = ["#", "Merchant Name", "Contact", "Route", "Outstanding Crates"];
      const tableRows = outstandingCratesData.list.map((m, idx) => [
        idx + 1, m.shopName, m.phone, m.route, m.outstandingCrates
      ]);

      autoTable(doc, { head: [tableCol], body: tableRows, startY: 48, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [245, 158, 11] } });
      doc.save(`Outstanding_Crates_${new Date().toISOString().split('T')[0]}.pdf`);
      return;
    }

    if (reportType === 'crate_aging') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40);
      doc.text(`Crate Aging Report`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Date: ${formatDate(new Date().toISOString())}`, 14, 36);

      const tableCol = ["Merchant Name", "Total Held", "7-15 Days", "16-30 Days", ">30 Days"];
      const tableRows = crateAgingData.list.map(m => [
        m.shopName, m.total, m.olderThan7 || '-', m.olderThan15 || '-', m.olderThan30 || '-'
      ]);
      tableRows.push(['TOTAL', crateAgingData.totals.total, crateAgingData.totals.olderThan7, crateAgingData.totals.olderThan15, crateAgingData.totals.olderThan30]);

      autoTable(doc, { head: [tableCol], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [245, 158, 11] } });
      doc.save(`Crate_Aging_${new Date().toISOString().split('T')[0]}.pdf`);
      return;
    }

    if (reportType === 'truck_settlement') {
      const doc = new jsPDF('landscape');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40);
      doc.text(`Truck Daily Settlement`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 36);

      const tableCol = ["Date", "Truck / Driver", "Expenses (Rs)", "Mortality Kg", "Carry-Over Kg", "Cash Collected (Rs)"];
      const tableRows = truckSettlementData.list.map(t => [
        formatDate(t.date), `${t.truckNumber} / ${t.driverName}`, t.expenses.toLocaleString('en-IN'), t.mortalityKg || '-', t.carryOverKg || '-', t.cash.toLocaleString('en-IN')
      ]);

      autoTable(doc, { head: [tableCol], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [59, 130, 246] } });
      doc.save(`Truck_Settlement_${formatDate(fromDate)}.pdf`);
      return;
    }

    if (reportType === 'top_merchants') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40);
      doc.text(`Top Merchants / Defaulters`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 36);

      doc.text("Top 10 Merchants (By Revenue)", 14, 46);
      const topCol = ["Rank", "Merchant", "Volume (Kg)", "Revenue (Rs)"];
      const topRows = topMerchantsData.topMerchants.map((m, idx) => [
        idx + 1, m.shopName, m.volume.toLocaleString('en-IN'), m.revenue.toLocaleString('en-IN')
      ]);
      autoTable(doc, { head: [topCol], body: topRows, startY: 50, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [16, 185, 129] } });

      const finalY = doc.lastAutoTable.finalY + 10;
      doc.text("Critical Defaulters", 14, finalY);
      const defCol = ["Rank", "Merchant", "Last Payment", "Outstanding (Rs)"];
      const defRows = topMerchantsData.defaulters.map((m, idx) => [
        idx + 1, m.shopName, m.lastPaymentDate ? formatDate(m.lastPaymentDate) : 'Never', m.balance.toLocaleString('en-IN')
      ]);
      autoTable(doc, { head: [defCol], body: defRows, startY: finalY + 4, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [244, 63, 94] } });

      doc.save(`Merchants_Report_${formatDate(fromDate)}.pdf`);
      return;
    }

    if (reportType === 'retailer_ledger') {
      if (selectedCustomer === 'ALL') {
        alert("Please select a specific retailer to generate a ledger statement.");
        return;
      }

    const doc = new jsPDF('landscape');
    const customer = customers.find(c => c.id === selectedCustomer);
    const customerName = customer ? customer.shopName : 'Unknown';
    const proprietor = customer ? customer.proprietorName || 'N/A' : 'N/A';
    const uniqueId = customer ? customer.uniqueId || 'Legacy' : 'N/A';
    const joinedDate = customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-GB') : 'Unknown';
    
    // Header
    doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
    doc.setFontSize(9); doc.setTextColor(80); doc.text(`Proprietor: ${activeShop.proprietorName}`, 14, 25);
    doc.setFontSize(10); doc.setTextColor(100); doc.text(`${activeShop.address} | Phone: ${activeShop.phone}`, 14, 30);
    doc.text(`GSTIN: ${activeShop.gstin}`, 14, 35);
    
    doc.setFontSize(14); doc.setTextColor(40);
    doc.text(`Retailer Statement of Account`, 14, 45);
    doc.setFontSize(10); doc.setTextColor(100);
    doc.text(`Retailer: ${customerName} | Owner: ${proprietor}`, 14, 51);
    doc.text(`Customer ID: ${uniqueId} | Boarding Date: ${joinedDate} | Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 56);

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
      startY: 61, 
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
      startY: 61, 
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
      return;
    }

    if (reportType === 'revenue_category') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40);
      doc.text(`Revenue by Category`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 36);

      const tableCol = ["Category", "Quantity Sold", "Revenue (Rs)", "% Share"];
      const tableRows = [
        ["Live Chicken", `${revenueCategoryData.liveChicken.qty.toLocaleString('en-IN', {maximumFractionDigits: 1})} kg`, `Rs. ${revenueCategoryData.liveChicken.revenue.toLocaleString('en-IN')}`, `${revenueCategoryData.liveChicken.percentage}%`],
        ["Eggs", `${revenueCategoryData.eggs.qty.toLocaleString('en-IN', {maximumFractionDigits: 1})} pcs`, `Rs. ${revenueCategoryData.eggs.revenue.toLocaleString('en-IN')}`, `${revenueCategoryData.eggs.percentage}%`],
        ["TOTAL", "-", `Rs. ${revenueCategoryData.totalRevenue.toLocaleString('en-IN')}`, "100%"]
      ];

      autoTable(doc, { head: [tableCol], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [16, 185, 129] } });
      doc.save(`Revenue_Category_${formatDate(fromDate)}.pdf`);
      return;
    }

    if (reportType === 'yield') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40); doc.text(`Procurement vs Dispatch (Yield)`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 36);

      const tableCol = ["Metric", "Weight (Kg)"];
      const tableRows = [
        ["Total Procured (Inward)", yieldData.procuredKg.toLocaleString('en-IN', {maximumFractionDigits: 1})],
        ["Total Sold (Outward)", yieldData.soldKg.toLocaleString('en-IN', {maximumFractionDigits: 1})],
        ["Recorded Mortality", yieldData.mortalityKg.toLocaleString('en-IN', {maximumFractionDigits: 1})],
        ["Unaccounted Shrinkage", yieldData.shrinkageKg.toLocaleString('en-IN', {maximumFractionDigits: 1})]
      ];

      autoTable(doc, { head: [tableCol], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 10 }, headStyles: { fillColor: [59, 130, 246] } });
      
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFontSize(12); doc.setTextColor(20); doc.setFont("helvetica", "bold");
      doc.text(`Estimated Yield: ${yieldData.yieldPercentage}%`, 14, finalY);
      
      doc.save(`Yield_Report_${formatDate(fromDate)}.pdf`);
      return;
    }

    if (reportType === 'carry_over') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40); doc.text(`Carry-Over Analysis`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 36);

      const tableCol = ["Date", "Truck Number", "Driver", "Original Date", "Carry-Over Kg"];
      const tableRows = carryOverData.list.map(c => [
        formatDate(c.date), c.truckNumber, c.driverName, c.originalDate !== 'N/A' ? formatDate(c.originalDate) : 'N/A', c.carryOverKg.toLocaleString('en-IN', {maximumFractionDigits: 1})
      ]);
      tableRows.push(['TOTAL', '', '', '', carryOverData.totalCarryOverKg.toLocaleString('en-IN', {maximumFractionDigits: 1})]);

      autoTable(doc, { head: [tableCol], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [245, 158, 11] } });
      doc.save(`Carry_Over_${formatDate(fromDate)}.pdf`);
      return;
    }

    if (reportType === 'mortality') {
      const doc = new jsPDF('portrait');
      doc.setFontSize(18); doc.text(activeShop.shopName, 14, 20);
      doc.setFontSize(14); doc.setTextColor(40); doc.text(`Daily Mortality Report`, 14, 30);
      doc.setFontSize(10); doc.setTextColor(100); doc.text(`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`, 14, 36);

      const tableCol = ["Date", "Source", "Details", "Count", "Weight (Kg)"];
      const tableRows = mortalityData.list.map(m => [
        formatDate(m.date), m.source, m.details, m.count, m.weightKg.toLocaleString('en-IN', {maximumFractionDigits: 1})
      ]);
      tableRows.push(['TOTAL', '', '', mortalityData.totalMortalityCount, mortalityData.totalMortalityKg.toLocaleString('en-IN', {maximumFractionDigits: 1})]);

      autoTable(doc, { head: [tableCol], body: tableRows, startY: 42, theme: 'grid', styles: { fontSize: 9 }, headStyles: { fillColor: [239, 68, 68] } });
      doc.save(`Mortality_Report_${formatDate(fromDate)}.pdf`);
      return;
    }
    
    alert("PDF Export is not currently implemented for this specific report.");
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

    if (reportType === 'outstanding_crates') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Outstanding Crates');
      worksheet.getRow(1).values = ['#', 'Merchant Name', 'Contact', 'Route', 'Outstanding Crates'];
      worksheet.getRow(1).font = { bold: true };
      outstandingCratesData.list.forEach((m, idx) => {
        worksheet.addRow([idx + 1, m.shopName, m.phone, m.route, m.outstandingCrates]);
      });
      worksheet.columns = [{ width: 5 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 20 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Outstanding_Crates_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'crate_aging') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Crate Aging');
      worksheet.getRow(1).values = ['Merchant Name', 'Total Held', '7-15 Days', '16-30 Days', '>30 Days'];
      worksheet.getRow(1).font = { bold: true };
      crateAgingData.list.forEach((m) => {
        worksheet.addRow([m.shopName, m.total, m.olderThan7 || 0, m.olderThan15 || 0, m.olderThan30 || 0]);
      });
      worksheet.addRow(['TOTAL', crateAgingData.totals.total, crateAgingData.totals.olderThan7, crateAgingData.totals.olderThan15, crateAgingData.totals.olderThan30]).font = { bold: true };
      worksheet.columns = [{ width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Crate_Aging_${new Date().toISOString().split('T')[0]}.xlsx`);
      return;
    }

    if (reportType === 'truck_settlement') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Truck Settlement');
      worksheet.getRow(1).values = ['Date', 'Truck Number', 'Driver Name', 'Expenses (Rs)', 'Mortality Kg', 'Carry-Over Kg', 'Cash Collected (Rs)'];
      worksheet.getRow(1).font = { bold: true };
      truckSettlementData.list.forEach((t) => {
        worksheet.addRow([formatDate(t.date), t.truckNumber, t.driverName, t.expenses, t.mortalityKg || 0, t.carryOverKg || 0, t.cash]);
      });
      worksheet.columns = [{ width: 15 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 20 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Truck_Settlement_${formatDate(fromDate)}.xlsx`);
      return;
    }

    if (reportType === 'top_merchants') {
      const workbook = new ExcelJS.Workbook();
      
      const wsTop = workbook.addWorksheet('Top Merchants');
      wsTop.getRow(1).values = ['Rank', 'Merchant Name', 'Volume (Kg)', 'Revenue (Rs)'];
      wsTop.getRow(1).font = { bold: true };
      topMerchantsData.topMerchants.forEach((m, idx) => wsTop.addRow([idx + 1, m.shopName, m.volume, m.revenue]));
      wsTop.columns = [{ width: 5 }, { width: 30 }, { width: 15 }, { width: 20 }];

      const wsDef = workbook.addWorksheet('Critical Defaulters');
      wsDef.getRow(1).values = ['Rank', 'Merchant Name', 'Last Payment', 'Outstanding (Rs)'];
      wsDef.getRow(1).font = { bold: true };
      topMerchantsData.defaulters.forEach((m, idx) => wsDef.addRow([idx + 1, m.shopName, m.lastPaymentDate ? formatDate(m.lastPaymentDate) : 'Never', m.balance]));
      wsDef.columns = [{ width: 5 }, { width: 30 }, { width: 15 }, { width: 20 }];

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Merchants_Report_${formatDate(fromDate)}.xlsx`);
      return;
    }

    if (reportType === 'retailer_ledger') {
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
      return;
    }

    if (reportType === 'revenue_category') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Revenue by Category');
      worksheet.getRow(1).values = ['Category', 'Quantity Sold', 'Revenue (Rs)', '% Share'];
      worksheet.getRow(1).font = { bold: true };
      worksheet.addRow(['Live Chicken', revenueCategoryData.liveChicken.qty, revenueCategoryData.liveChicken.revenue, revenueCategoryData.liveChicken.percentage]);
      worksheet.addRow(['Eggs', revenueCategoryData.eggs.qty, revenueCategoryData.eggs.revenue, revenueCategoryData.eggs.percentage]);
      worksheet.addRow(['TOTAL', '-', revenueCategoryData.totalRevenue, '100']);
      worksheet.columns = [{ width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Revenue_Category_${formatDate(fromDate)}.xlsx`);
      return;
    }

    if (reportType === 'yield') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Yield Report');
      worksheet.getRow(1).values = ['Metric', 'Weight (Kg)'];
      worksheet.getRow(1).font = { bold: true };
      worksheet.addRow(['Total Procured (Inward)', yieldData.procuredKg]);
      worksheet.addRow(['Total Sold (Outward)', yieldData.soldKg]);
      worksheet.addRow(['Recorded Mortality', yieldData.mortalityKg]);
      worksheet.addRow(['Unaccounted Shrinkage', yieldData.shrinkageKg]);
      worksheet.addRow(['Estimated Yield %', yieldData.yieldPercentage]);
      worksheet.columns = [{ width: 25 }, { width: 15 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Yield_Report_${formatDate(fromDate)}.xlsx`);
      return;
    }

    if (reportType === 'carry_over') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Carry Over');
      worksheet.getRow(1).values = ['Date', 'Truck Number', 'Driver', 'Original Date', 'Carry-Over Kg'];
      worksheet.getRow(1).font = { bold: true };
      carryOverData.list.forEach(c => worksheet.addRow([formatDate(c.date), c.truckNumber, c.driverName, c.originalDate !== 'N/A' ? formatDate(c.originalDate) : 'N/A', c.carryOverKg]));
      worksheet.addRow(['TOTAL', '', '', '', carryOverData.totalCarryOverKg]).font = { bold: true };
      worksheet.columns = [{ width: 15 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Carry_Over_${formatDate(fromDate)}.xlsx`);
      return;
    }

    if (reportType === 'mortality') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Mortality Report');
      worksheet.getRow(1).values = ['Date', 'Source', 'Details', 'Count', 'Weight (Kg)'];
      worksheet.getRow(1).font = { bold: true };
      mortalityData.list.forEach(m => worksheet.addRow([formatDate(m.date), m.source, m.details, m.count, m.weightKg]));
      worksheet.addRow(['TOTAL', '', '', mortalityData.totalMortalityCount, mortalityData.totalMortalityKg]).font = { bold: true };
      worksheet.columns = [{ width: 15 }, { width: 20 }, { width: 25 }, { width: 10 }, { width: 15 }];
      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Mortality_Report_${formatDate(fromDate)}.xlsx`);
      return;
    }
    
    alert("Excel Export is not currently implemented for this specific report.");
  };

  const categories = [
    { id: 'financials', label: 'Financials & Credit', icon: <IndianRupee className="w-4 h-4" /> },
    { id: 'stock', label: 'Stock & Mortality', icon: <Package className="w-4 h-4" /> },
    { id: 'crates', label: 'Crate Circulation', icon: <Box className="w-4 h-4" /> },
    { id: 'logistics', label: 'Logistics', icon: <Truck className="w-4 h-4" /> }
  ];

  const reportOptions = {
    financials: [
      { id: 'retailer_ledger', label: 'Retailer Ledger (T-Account)' },
      { id: 'outstanding_dues', label: 'Outstanding Dues Ledger' },
      { id: 'cash_flow', label: 'Daily Cash Flow & Collections' },
      { id: 'revenue_category', label: 'Revenue by Category' }
    ],
    stock: [
      { id: 'yield', label: 'Procurement vs Dispatch (Yield)' },
      { id: 'carry_over', label: 'Carry-Over Analysis' },
      { id: 'mortality', label: 'Daily Mortality Report' }
    ],
    crates: [
      { id: 'outstanding_crates', label: 'Outstanding Crates by Merchant' },
      { id: 'crate_aging', label: 'Crate Aging Report' }
    ],
    logistics: [
      { id: 'truck_settlement', label: 'Truck Daily Settlement' },
      { id: 'top_merchants', label: 'Top Merchants / Defaulters' }
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
                    ? 'bg-emerald-500 text-white shadow-md' 
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
              <button onClick={exportPDF} disabled={reportType === 'retailer_ledger' && selectedCustomer === 'ALL'} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50">
                <FileText className="w-4 h-4" /> PDF
              </button>
              <button onClick={exportExcel} disabled={reportType === 'retailer_ledger' && selectedCustomer === 'ALL'} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50">
                <Download className="w-4 h-4" /> Excel
              </button>
              <button onClick={() => window.print()} disabled={reportType === 'retailer_ledger' && selectedCustomer === 'ALL'} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-50">
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
                {(() => {
                  const customer = customers.find(c => c.id === selectedCustomer);
                  return (
                    <>
                      <p className="text-sm text-slate-700 dark:text-slate-200 font-bold mt-2">
                        {customer?.shopName} {customer?.proprietorName ? `(Owner: ${customer.proprietorName})` : ''}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        ID: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{customer?.uniqueId || 'Legacy'}</span> | Boarded: {customer?.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-GB') : 'Unknown'} | Period: {formatDate(fromDate)} to {formatDate(toDate)}
                      </p>
                    </>
                  );
                })()}
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

        {reportType === 'revenue_category' && revenueCategoryData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Revenue by Category</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Sales breakdown from {formatDate(fromDate)} to {formatDate(toDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-400">Total Revenue</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{revenueCategoryData.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Live Chicken Card */}
                <div className="p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                        <Package className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Live Chicken</h4>
                    </div>
                    <div className="flex justify-between items-end mt-6">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Net Weight Sold</p>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{revenueCategoryData.liveChicken.qty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Revenue</p>
                        <p className="text-3xl font-black text-rose-600 dark:text-rose-400">₹{revenueCategoryData.liveChicken.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-rose-200/50 dark:border-rose-800/30">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-slate-600 dark:text-slate-400">Share of Total Revenue</span>
                      <span className="text-rose-600 dark:text-rose-400">{revenueCategoryData.liveChicken.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-2">
                      <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${revenueCategoryData.liveChicken.percentage}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Eggs Card */}
                <div className="p-6 rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Box className="w-5 h-5" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Eggs</h4>
                    </div>
                    <div className="flex justify-between items-end mt-6">
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Quantity Sold</p>
                        <p className="text-xl font-bold text-slate-700 dark:text-slate-300">{revenueCategoryData.eggs.qty.toLocaleString('en-IN', { maximumFractionDigits: 0 })} pcs</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Revenue</p>
                        <p className="text-3xl font-black text-amber-600 dark:text-amber-400">₹{revenueCategoryData.eggs.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-amber-200/50 dark:border-amber-800/30">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-slate-600 dark:text-slate-400">Share of Total Revenue</span>
                      <span className="text-amber-600 dark:text-amber-400">{revenueCategoryData.eggs.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 mt-2">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${revenueCategoryData.eggs.percentage}%` }}></div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {reportType === 'yield' && yieldData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Procurement vs Dispatch (Yield)</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Overall stock efficiency from {formatDate(fromDate)} to {formatDate(toDate)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="p-6 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Procured (In)</p>
                <p className="text-2xl font-black text-slate-700 dark:text-slate-200 mt-1">{yieldData.procuredKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg</p>
              </div>
              <div className="p-6 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sold (Out)</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{yieldData.soldKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg</p>
              </div>
              <div className="p-6 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mortality Loss</p>
                <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">{yieldData.mortalityKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg</p>
              </div>
              <div className="p-6 text-center">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unaccounted Shrinkage</p>
                <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">{yieldData.shrinkageKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg</p>
              </div>
            </div>
            
            <div className="p-8 flex justify-center items-center">
               <div className="text-center p-8 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-sm uppercase font-bold text-emerald-600 dark:text-emerald-500 mb-2 tracking-wider">Calculated Yield</p>
                  <p className="text-5xl font-black text-emerald-700 dark:text-emerald-400">{yieldData.yieldPercentage}%</p>
                  <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-2 font-medium">Sold vs Procured Efficiency</p>
               </div>
            </div>
          </div>
        )}

        {reportType === 'carry_over' && carryOverData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Carry-Over Analysis</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Unsold stock carrying over to the next day
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-400">Total Carry-Over</p>
                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {carryOverData.totalCarryOverKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
                </p>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-bold">Date</th>
                    <th className="p-4 font-bold">Truck No</th>
                    <th className="p-4 font-bold">Driver</th>
                    <th className="p-4 font-bold">Original Date</th>
                    <th className="p-4 font-bold text-right">Locked Rate</th>
                    <th className="p-4 font-bold text-right">Carry-Over Wt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {carryOverData.list.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-500">{formatDate(c.date)}</td>
                      <td className="p-4">
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-200">{c.truckNumber}</span>
                      </td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{c.driverName}</td>
                      <td className="p-4 text-sm text-slate-500">{formatDate(c.originalDate)}</td>
                      <td className="p-4 text-right font-medium text-emerald-600 dark:text-emerald-500">₹{c.lockedRate}/kg</td>
                      <td className="p-4 text-right font-black text-blue-600 dark:text-blue-400">
                        {c.carryOverKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
                      </td>
                    </tr>
                  ))}
                  {carryOverData.list.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 font-medium">
                        No carry-over stock recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'mortality' && mortalityData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Daily Mortality Report</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Dead birds tracked across Farm, Truck, and Shop Floor
                </p>
              </div>
              <div className="text-right flex gap-6">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Count</p>
                  <p className="text-xl font-black text-red-500">{mortalityData.totalMortalityCount} birds</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Weight</p>
                  <p className="text-2xl font-black text-red-600 dark:text-red-400">
                    {mortalityData.totalMortalityKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
                  </p>
                </div>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-bold">Date</th>
                    <th className="p-4 font-bold">Source</th>
                    <th className="p-4 font-bold">Details</th>
                    <th className="p-4 font-bold text-right">Dead Count</th>
                    <th className="p-4 font-bold text-right">Dead Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {mortalityData.list.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-500">{formatDate(m.date)}</td>
                      <td className="p-4">
                        <span className="inline-flex px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs font-bold">
                          {m.source}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{m.details}</td>
                      <td className="p-4 text-right font-bold text-slate-700 dark:text-slate-300">
                        {m.count}
                      </td>
                      <td className="p-4 text-right font-black text-red-600 dark:text-red-400">
                        {m.weightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
                      </td>
                    </tr>
                  ))}
                  {mortalityData.list.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                        Great news! No mortality recorded in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {reportType === 'outstanding_crates' && outstandingCratesData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Outstanding Crates by Merchant</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Active crate balances currently held by merchants
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase font-bold text-slate-400">Total Outstanding</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  {outstandingCratesData.totalOutstanding} crates
                </p>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-bold">#</th>
                    <th className="p-4 font-bold">Merchant Name</th>
                    <th className="p-4 font-bold">Contact</th>
                    <th className="p-4 font-bold">Route</th>
                    <th className="p-4 font-bold text-right">Outstanding Crates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {outstandingCratesData.list.map((m, idx) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-500">{idx + 1}</td>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{m.shopName}</td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{m.phone}</td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{m.route}</td>
                      <td className="p-4 text-right">
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-black rounded-lg border border-amber-100 dark:border-amber-900/50">
                          {m.outstandingCrates}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {outstandingCratesData.list.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                        No outstanding crates currently logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'crate_aging' && crateAgingData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Crate Aging Report</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Estimated duration merchants have held onto crates (FIFO)
                </p>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-bold">Merchant Name</th>
                    <th className="p-4 font-bold text-center">Total Held</th>
                    <th className="p-4 font-bold text-center text-amber-600 dark:text-amber-500">7-15 Days Old</th>
                    <th className="p-4 font-bold text-center text-orange-600 dark:text-orange-500">16-30 Days Old</th>
                    <th className="p-4 font-bold text-center text-rose-600 dark:text-rose-500">&gt;30 Days Old</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {crateAgingData.list.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{m.shopName}</td>
                      <td className="p-4 text-center font-black text-slate-700 dark:text-slate-300">{m.total}</td>
                      <td className="p-4 text-center font-bold text-amber-600 dark:text-amber-500">{m.olderThan7 > 0 ? m.olderThan7 : '-'}</td>
                      <td className="p-4 text-center font-bold text-orange-600 dark:text-orange-500">{m.olderThan15 > 0 ? m.olderThan15 : '-'}</td>
                      <td className="p-4 text-center font-bold text-rose-600 dark:text-rose-500">{m.olderThan30 > 0 ? m.olderThan30 : '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 font-black">
                    <td className="p-4 text-slate-800 dark:text-slate-200">TOTAL</td>
                    <td className="p-4 text-center text-slate-800 dark:text-slate-200">{crateAgingData.totals.total}</td>
                    <td className="p-4 text-center text-amber-600 dark:text-amber-500">{crateAgingData.totals.olderThan7}</td>
                    <td className="p-4 text-center text-orange-600 dark:text-orange-500">{crateAgingData.totals.olderThan15}</td>
                    <td className="p-4 text-center text-rose-600 dark:text-rose-500">{crateAgingData.totals.olderThan30}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'truck_settlement' && truckSettlementData && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left animate-in fade-in">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Truck Daily Settlement</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Cash collections, expenses, and left-overs for the selected period
                </p>
              </div>
              <div className="text-right flex gap-6">
                 <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Expenses</p>
                  <p className="text-xl font-black text-rose-500">₹{truckSettlementData.totalExpenses.toLocaleString('en-IN')}</p>
                 </div>
                 <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Total Cash Collected</p>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    ₹{truckSettlementData.totalRevenue.toLocaleString('en-IN')}
                  </p>
                 </div>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-slate-800/20 border-b border-slate-200 dark:border-slate-700/50 text-xs uppercase tracking-wider text-slate-500">
                    <th className="p-4 font-bold">Date</th>
                    <th className="p-4 font-bold">Truck / Driver</th>
                    <th className="p-4 font-bold text-right text-rose-600 dark:text-rose-400">Expenses</th>
                    <th className="p-4 font-bold text-right text-red-500">Mortality Kg</th>
                    <th className="p-4 font-bold text-right text-blue-500">Carry-Over Kg</th>
                    <th className="p-4 font-bold text-right text-emerald-600 dark:text-emerald-400">Cash Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {truckSettlementData.list.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-500">{formatDate(t.date)}</td>
                      <td className="p-4">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{t.truckNumber}</span>
                        <span className="text-xs text-slate-500">{t.driverName}</span>
                      </td>
                      <td className="p-4 text-right font-bold text-rose-600 dark:text-rose-400">₹{t.expenses.toLocaleString('en-IN')}</td>
                      <td className="p-4 text-right font-medium text-red-500">{t.mortalityKg > 0 ? t.mortalityKg : '-'}</td>
                      <td className="p-4 text-right font-medium text-blue-500">{t.carryOverKg > 0 ? t.carryOverKg : '-'}</td>
                      <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400">₹{t.cash.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {truckSettlementData.list.length === 0 && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500 font-medium">
                        No truck dispatches/settlements logged.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportType === 'top_merchants' && topMerchantsData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            {/* Top Merchants */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-left">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Top 10 Merchants</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Ranked by Revenue in Period
                </p>
              </div>
              <div className="p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500">
                      <th className="p-4 font-bold">Merchant</th>
                      <th className="p-4 font-bold text-right">Volume</th>
                      <th className="p-4 font-bold text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topMerchantsData.topMerchants.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{m.shopName}</span>
                        </td>
                        <td className="p-4 text-right text-slate-600 dark:text-slate-400 font-medium">
                          {m.volume.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
                        </td>
                        <td className="p-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                          ₹{m.revenue.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {topMerchantsData.topMerchants.length === 0 && (
                       <tr><td colSpan="3" className="p-8 text-center text-slate-500 font-medium">No sales found in this period.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Defaulters */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/30 shadow-sm overflow-hidden text-left">
              <div className="p-6 border-b border-rose-100 dark:border-rose-900/30 bg-rose-50/30 dark:bg-rose-950/20">
                <h3 className="text-lg font-black text-rose-800 dark:text-rose-400">Critical Defaulters</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  Ranked by Last Payment Date & Balance
                </p>
              </div>
              <div className="p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs uppercase text-slate-500">
                      <th className="p-4 font-bold">Merchant</th>
                      <th className="p-4 font-bold text-center">Last Payment</th>
                      <th className="p-4 font-bold text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topMerchantsData.defaulters.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/50 text-xs font-bold text-rose-600 dark:text-rose-400">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{m.shopName}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${m.daysSincePayment > 30 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                            {m.lastPaymentDate ? formatDate(m.lastPaymentDate) : 'Never Paid'}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-rose-600 dark:text-rose-400">
                          ₹{m.balance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {topMerchantsData.defaulters.length === 0 && (
                       <tr><td colSpan="3" className="p-8 text-center text-slate-500 font-medium">No outstanding balances found!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
