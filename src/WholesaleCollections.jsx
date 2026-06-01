import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

import { DollarSign, Search, Navigation, Phone, CheckCircle2, Loader2, X, ClipboardList, Send, MapPin } from 'lucide-react';

export default function WholesaleCollections() {
  const [customers, setCustomers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Log Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    customerId: '',
    customerName: '',
    amount: '',
    paymentMethod: 'UPI',
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('wholesale_customers')
        .select('*');
      if (!error && data) {
        const list = [];
        const distinctRoutes = new Set();
        data.forEach(row => {
          list.push({
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
            outstandingBalance: row.outstanding_balance || 0,
            outstandingCrates: row.outstanding_crates || 0
          });
          if (row.route) distinctRoutes.add(row.route);
        });
        setRoutes(Array.from(distinctRoutes).sort());
        setCustomers(list);
      }
    };
    fetchCustomers();

    const channel = supabase
      .channel('wholesale-customers-collections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_customers' }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenPaymentModal = (cust) => {
    setPaymentForm({
      customerId: cust.id,
      customerName: cust.shopName,
      amount: '',
      paymentMethod: 'UPI',
      notes: ''
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const payAmt = parseFloat(paymentForm.amount) || 0;
    if (payAmt <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    setIsSaving(true);
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();

      // 1. Add record to wholesale_payments
      const { error: paymentError } = await supabase
        .from('wholesale_payments')
        .insert({
          customer_id: paymentForm.customerId,
          customer_name: paymentForm.customerName,
          amount: payAmt,
          payment_method: paymentForm.paymentMethod,
          notes: paymentForm.notes.trim() || 'Weekly collection settlement',
          payment_date: dateStr,
          created_at: timestamp
        });
      if (paymentError) throw paymentError;

      // 2. Subtract from customer outstandingBalance
      const customer = customers.find(c => c.id === paymentForm.customerId);
      const updatedBalance = (customer ? customer.outstandingBalance : 0) - payAmt;

      const { error: customerError } = await supabase
        .from('wholesale_customers')
        .update({
          outstanding_balance: updatedBalance
        })
        .eq('id', paymentForm.customerId);
      if (customerError) throw customerError;

      setShowPaymentModal(false);
      alert("Payment collection logged successfully.");
    } catch (error) {
      console.error("Error logging payment:", error);
      alert("Failed to save payment.");
    } finally {
      setIsSaving(false);
    }
  };

  // Get WhatsApp Deep-Link URL
  const getWhatsAppLink = (cust) => {
    const balance = cust.outstandingBalance || 0;
    const cages = cust.outstandingCrates || 0;
    const phoneNo = cust.phone.replace(/\D/g, '');
    
    const message = `*MOMIN WHOLESALE CHICKEN - WEEKLY OUTSTANDING STATEMENT*\n\n` +
                    `Shop: *${cust.shopName}*\n` +
                    `Route: _${cust.route}_\n` +
                    `Outstanding credit balance: *₹${balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}*\n` +
                    `Outstanding empty cages: *${cages} crates*\n\n` +
                    `Please clear weekly ledger payments. Thank you!`;

    const encoded = encodeURIComponent(message);
    return `https://wa.me/91${phoneNo.slice(-10)}?text=${encoded}`;
  };

  // Filter customers based on selected route and search query
  const filteredCustomers = customers.filter(c => {
    const matchesRoute = selectedRoute ? c.route === selectedRoute : true;
    const matchesSearch = c.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.proprietorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.phone.includes(searchQuery);
    return matchesRoute && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 text-left">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Weekly Collections Sheet</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage B2B credit collections, route-wise outstanding balance sheets, and send instant WhatsApp ledger updates.</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-205 dark:border-slate-800">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by merchant name or phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold"
          />
        </div>
        
        <div className="w-full sm:w-56 shrink-0">
          <select
            value={selectedRoute}
            onChange={e => setSelectedRoute(e.target.value)}
            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
          >
            <option value="">-- All Routes / Areas --</option>
            {routes.map((rt, idx) => (
              <option key={idx} value={rt}>{rt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Collections grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map(cust => {
            const balance = cust.outstandingBalance || 0;
            const crates = cust.outstandingCrates || 0;
            return (
              <div key={cust.id} className="glass-panel p-5 rounded-2xl bg-white dark:bg-slate-900/50 relative overflow-hidden flex flex-col justify-between h-fit hover:shadow-lg transition-shadow">
                
                {/* Header info */}
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{cust.route}</span>
                    {cust.location && (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                        <MapPin className="w-2.5 h-2.5" /> GPS Pinned
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-extrabold text-slate-850 dark:text-white leading-tight pt-1">{cust.shopName}</h3>
                  <span className="block text-[11px] text-slate-450 font-semibold mt-0.5">{cust.proprietorName} | {cust.phone}</span>
                </div>

                {/* Ledger figures */}
                <div className="grid grid-cols-2 gap-2 my-4 border-t border-b border-slate-100 dark:border-slate-800 py-3">
                  <div className="text-left">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Outstanding Credit</span>
                    <span className={`text-lg font-black ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-550 dark:text-slate-400'}`}>
                      ₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="text-left border-l border-slate-100 dark:border-slate-800 pl-4">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Cages held</span>
                    <span className={`text-lg font-black ${crates > 10 ? 'text-red-500 animate-pulse' : crates > 0 ? 'text-amber-500' : 'text-slate-450'}`}>
                      {crates} cages
                    </span>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex gap-2">
                    {/* Log Payment */}
                    <button
                      onClick={() => handleOpenPaymentModal(cust)}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-emerald-500/10"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Collect cash
                    </button>
                    
                    {/* Navigation */}
                    {cust.location ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${cust.location.lat},${cust.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                        title="Open driving navigator directions"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-605" /> Navigate
                      </a>
                    ) : (
                      <button
                        disabled
                        className="py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-not-allowed"
                        title="No coordinates pinned"
                      >
                        <Navigation className="w-3.5 h-3.5 opacity-40" /> Navigate
                      </button>
                    )}
                  </div>

                  {/* Send Statement */}
                  <a
                    href={getWhatsAppLink(cust)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-extrabold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 border border-emerald-150/40"
                  >
                    <Send className="w-3.5 h-3.5 fill-emerald-600" /> Send WhatsApp Ledger
                  </a>
                </div>

              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 text-slate-400 italic">No wholesale merchants found under this criteria.</div>
        )}
      </div>

      {/* Log Payment Modal overlay */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl relative animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-955/20 text-slate-500 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-805 dark:text-white mb-4 flex items-center gap-1">
              <DollarSign className="w-5 h-5 text-emerald-500" /> Log Cash Collection
            </h3>
            
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 text-xs font-bold mb-4">
              Shop Name: <span className="text-emerald-700 dark:text-emerald-400">{paymentForm.customerName}</span>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4 font-sans">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase">Amount Collected (₹)</label>
                <input
                  type="number"
                  required
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-800 dark:text-white"
                  placeholder="₹ 0.00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase">Payment Channel</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                >
                  <option value="UPI">UPI / PhonePe / GPay</option>
                  <option value="Cash">Hard Cash</option>
                  <option value="Bank Transfer">NEFT / RTGS Transfer</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-450 uppercase">Collection Agent Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                  placeholder="e.g. Collected by Sham on Saturday"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md shadow-emerald-500/10 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm Payment Log
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
