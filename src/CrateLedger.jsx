import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Archive, Plus, Minus, History, Search, Loader2, Save, AlertCircle, Sparkles } from 'lucide-react';

export default function CrateLedger() {
  const [customers, setCustomers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Direct adjustment form state
  const [selectedCustId, setSelectedCustId] = useState('');
  const [actionType, setActionType] = useState('return'); // 'return' or 'issue'
  const [cratesCount, setCratesCount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');

  // Fetch B2B customer crate states
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('wholesale_customers')
        .select('*');
      if (!error && data) {
        const list = data.map(row => ({
          id: row.id,
          shopName: row.shop_name,
          proprietorName: row.proprietor_name,
          uniqueId: row.unique_id,
          route: row.route,
          area: row.area,
          location: row.location_lat && row.location_lng ? { lat: row.location_lat, lng: row.location_lng } : null,
          outstandingBalance: row.outstanding_balance,
          outstandingCrates: row.outstanding_crates || 0,
          createdAt: row.created_at
        }));
        // Sort by outstanding crates descending
        list.sort((a, b) => (b.outstandingCrates || 0) - (a.outstandingCrates || 0));
        setCustomers(list);
      }
    };
    fetchCustomers();

    const channel = supabase
      .channel('wholesale-customers-crate-ledger')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_customers' }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch recent transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('crates_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data) {
        const list = data.map(row => ({
          id: row.id,
          customerId: row.customer_id,
          customerName: row.customer_name,
          date: row.created_at ? row.created_at.split('T')[0] : '',
          cratesIssued: row.action_type === 'issue' ? row.quantity : 0,
          cratesReturned: row.action_type === 'return' ? row.quantity : 0,
          netOutstanding: row.action_type === 'issue' ? row.quantity : -row.quantity,
          invoiceId: row.notes || '',
          timestamp: row.created_at
        }));
        setTransactions(list);
      }
    };
    fetchTransactions();

    const channel = supabase
      .channel('crates-ledger-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crates_ledger' }, () => {
        fetchTransactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustId) {
      alert("Please select a merchant.");
      return;
    }
    const count = parseInt(cratesCount) || 0;
    if (count <= 0) {
      alert("Please enter a valid count of cages.");
      return;
    }

    setIsSaving(true);
    try {
      const customer = customers.find(c => c.id === selectedCustId);
      const isReturn = actionType === 'return';
      
      const newOutstanding = (customer.outstandingCrates || 0) + (isReturn ? -count : count);

      // 1. Log transaction to crates_ledger
      const { error: ledgerError } = await supabase
        .from('crates_ledger')
        .insert({
          customer_id: customer.id,
          customer_name: customer.shopName,
          action_type: actionType,
          quantity: count,
          notes: notes.trim() || 'Manual adjustment',
          created_at: new Date().toISOString()
        });
      if (ledgerError) throw ledgerError;

      // 2. Update wholesale_customers
      const { error: customerError } = await supabase
        .from('wholesale_customers')
        .update({
          outstanding_crates: newOutstanding
        })
        .eq('id', customer.id);
      if (customerError) throw customerError;

      // Reset Form
      setCratesCount('');
      setNotes('');
      setSelectedCustId('');
      alert("Crates ledger updated successfully.");
    } catch (error) {
      console.error("Crates adjustment error:", error);
      alert("Failed to update crates ledger.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  // Filtered transactions list
  const filteredTransactions = transactions.filter(tx => 
    tx.customerName.toLowerCase().includes(filterSearch.toLowerCase()) ||
    (tx.invoiceId && tx.invoiceId.toLowerCase().includes(filterSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Crates Ledger Tracker</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track heavy-duty plastic cage circulation, manage driver returns, and audit unreturned assets.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form adjustment + Tally */}
        <div className="space-y-6">
          {/* Cages Adjustment Form */}
          <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
              <Archive className="w-5 h-5 text-emerald-500" /> Crate Return / Issue Log
            </h3>
            
            <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-450">Select Merchant</label>
                <select
                  required
                  value={selectedCustId}
                  onChange={e => setSelectedCustId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold text-slate-800 dark:text-white"
                >
                  <option value="">-- Choose Merchant --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.shopName} (Holds: {c.outstandingCrates || 0} crates)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-450">Transaction Type</label>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setActionType('return')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      actionType === 'return'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Empty Cages Returned
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('issue')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      actionType === 'issue'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" /> Extra Cages Issued
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-450">Number of Cages</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cratesCount}
                  onChange={e => setCratesCount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-800 dark:text-white"
                  placeholder="0 cages"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-450">Reference ID / Driver Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-750 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="e.g. Returned by driver Sham"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md cursor-pointer transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-1.5"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Log Crate Transaction
              </button>
            </form>
          </div>
          
          {/* Crate Statistics Panel */}
          <div className="glass-panel p-6 rounded-2xl bg-gradient-to-b from-[#064e3b] to-[#022c22] text-white border-transparent text-left relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <h4 className="text-[10px] font-black uppercase text-emerald-350 tracking-widest flex items-center gap-1 mb-4">
              <Sparkles className="w-4 h-4 text-emerald-350" /> Crate Fleet Logistics
            </h4>
            
            <div className="space-y-4">
              <div>
                <span className="text-xs text-emerald-200 block font-medium">Total Circulating Crates</span>
                <span className="text-3xl font-black text-white leading-none mt-1 block">
                  {customers.reduce((acc, curr) => acc + (curr.outstandingCrates || 0), 0)} pcs
                </span>
                <span className="text-[10px] text-emerald-300 mt-1 block font-medium">Currently held at customer poultry centers</span>
              </div>
              
              <div className="border-t border-white/10 pt-3 text-xs text-emerald-250 flex justify-between items-center">
                <span>Active Clients Holding Crates:</span>
                <span className="font-bold text-white">{customers.filter(c => (c.outstandingCrates || 0) > 0).length} merchants</span>
              </div>
            </div>
          </div>
        </div>

        {/* Directory & Outstanding Details list */}
        <div className="lg:col-span-2 space-y-6 text-left">
          
          {/* Outstanding details Table */}
          <div className="glass-panel rounded-2xl border border-slate-205 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/50 shadow-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Active Crate Holdings</h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-450 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Inventory status</span>
            </div>

            <div className="overflow-x-auto max-h-[300px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                    <th className="p-3">Merchant</th>
                    <th className="p-3">Route / Area</th>
                    <th className="p-3 text-center">Cages Outstanding</th>
                    <th className="p-3 text-center">Ageing Alerts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {customers.length > 0 ? (
                    customers.map(c => {
                      const cageCount = c.outstandingCrates || 0;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="p-3 font-bold text-slate-800 dark:text-white">{c.shopName}</td>
                          <td className="p-3 text-slate-500">{c.route}</td>
                          <td className="p-3 text-center font-black text-sm text-slate-800 dark:text-white">{cageCount}</td>
                          <td className="p-3 text-center">
                            {cageCount >= 12 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-700 dark:bg-red-955/20 dark:text-red-400 border border-red-200 dark:border-red-900/50 animate-pulse">
                                <AlertCircle className="w-3 h-3" /> Critical ({cageCount} holds)
                              </span>
                            ) : cageCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-700 dark:bg-amber-955/20 dark:text-amber-400">
                                Active holding
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-slate-400">No B2B customers registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Crate Transactions Audit History */}
          <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-500" /> Recent Crate Movements Log
              </h3>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by merchant/challan..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-205 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[350px] space-y-3 pr-2 custom-scrollbar">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map(tx => (
                  <div key={tx.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-850/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
                    <div className="text-left space-y-0.5">
                      <span className="block font-bold text-slate-800 dark:text-white">{tx.customerName}</span>
                      <span className="block text-[10px] text-slate-450">Challan Ref: <strong className="text-slate-700 dark:text-slate-350">{tx.invoiceId}</strong></span>
                      <span className="block text-[9px] text-slate-400">{formatDate(tx.date)}</span>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-100 dark:border-slate-800/50 pt-2 sm:pt-0">
                      <div className="text-right">
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">Issued / Returned</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-350">+{tx.cratesIssued || 0} / -{tx.cratesReturned || 0}</span>
                      </div>
                      
                      <div className={`px-3 py-1 rounded-xl font-black text-center min-w-[70px] ${
                        tx.netOutstanding > 0 
                          ? 'bg-red-50 text-red-650 dark:bg-red-955/20 dark:text-red-400' 
                          : tx.netOutstanding < 0 
                            ? 'bg-green-50 text-green-650 dark:bg-green-955/20 dark:text-green-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {tx.netOutstanding > 0 ? `+${tx.netOutstanding}` : tx.netOutstanding} Net
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-400 py-12 italic">No crate transactions found.</div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
