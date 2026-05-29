import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection, addDoc, onSnapshot, doc, updateDoc,
  query, orderBy, limit
} from 'firebase/firestore';
import {
  Truck, Plus, Save, Loader2, CheckCircle2, AlertTriangle,
  Package, ArrowRight, Calendar, Phone, User, Hash, Scale,
  IndianRupee, ChevronDown, ChevronUp, Clock, RotateCcw
} from 'lucide-react';

const STATUS_CONFIG = {
  active:    { label: 'Active — Out on Route',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',   dot: 'bg-amber-500'  },
  partial:   { label: 'Partial Sale',             color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400', dot: 'bg-orange-500' },
  sold:      { label: 'Fully Sold — Returned',    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', dot: 'bg-emerald-500' },
  carryover: { label: 'Carried Over (Next Day)',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',       dot: 'bg-blue-500'   },
};

export default function TruckDispatch() {
  const [dispatches, setDispatches] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [showPartialModal, setShowPartialModal] = useState(null); // dispatch object
  const [partialSoldKg, setPartialSoldKg] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    truckNumber: '',
    driverName: '',
    driverPhone: '',
    dispatchDate: todayStr,
    totalBirds: '',
    totalWeightKg: '',
    ratePerKg: '',
    notes: '',
  });

  // Fetch dispatches
  useEffect(() => {
    const q = query(collection(db, 'truck_dispatches'), orderBy('dispatchDate', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setDispatches(list);
    });
    return unsub;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.truckNumber || !form.driverName || !form.totalWeightKg || !form.ratePerKg) {
      alert('Please fill Truck No, Driver Name, Total Weight and Rate.');
      return;
    }
    setIsSaving(true);
    try {
      const totalWeight = parseFloat(form.totalWeightKg) || 0;
      await addDoc(collection(db, 'truck_dispatches'), {
        truckNumber: form.truckNumber.trim().toUpperCase(),
        driverName: form.driverName.trim(),
        driverPhone: form.driverPhone.trim(),
        dispatchDate: form.dispatchDate,
        totalBirds: parseInt(form.totalBirds) || 0,
        totalWeightKg: totalWeight,
        soldWeightKg: 0,
        remainingWeightKg: totalWeight,
        ratePerKg: parseFloat(form.ratePerKg) || 0,
        status: 'active',
        notes: form.notes.trim(),
        isCarryOver: false,
        createdAt: new Date().toISOString(),
      });
      setForm({
        truckNumber: '', driverName: '', driverPhone: '',
        dispatchDate: todayStr, totalBirds: '', totalWeightKg: '',
        ratePerKg: '', notes: '',
      });
    } catch (err) {
      console.error('Error logging dispatch:', err);
      alert('Failed to log truck dispatch.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkFullySold = async (dispatch) => {
    if (!window.confirm(`Mark truck ${dispatch.truckNumber} as Fully Sold and returned?`)) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'truck_dispatches', dispatch.id), {
        status: 'sold',
        soldWeightKg: dispatch.totalWeightKg,
        remainingWeightKg: 0,
        resolvedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePartialSale = async () => {
    const soldKg = parseFloat(partialSoldKg) || 0;
    if (soldKg <= 0 || soldKg > showPartialModal.totalWeightKg) {
      alert('Enter a valid sold weight.');
      return;
    }
    const remaining = parseFloat((showPartialModal.totalWeightKg - soldKg).toFixed(2));
    setIsUpdating(true);
    try {
      // Update current dispatch as partial
      await updateDoc(doc(db, 'truck_dispatches', showPartialModal.id), {
        status: 'partial',
        soldWeightKg: soldKg,
        remainingWeightKg: remaining,
        updatedAt: new Date().toISOString(),
      });

      // Create carry-over dispatch for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      await addDoc(collection(db, 'truck_dispatches'), {
        truckNumber: showPartialModal.truckNumber,
        driverName: showPartialModal.driverName,
        driverPhone: showPartialModal.driverPhone,
        dispatchDate: tomorrowStr,
        totalBirds: 0,
        totalWeightKg: remaining,
        soldWeightKg: 0,
        remainingWeightKg: remaining,
        ratePerKg: showPartialModal.ratePerKg, // locked yesterday's rate
        status: 'carryover',
        isCarryOver: true,
        carryOverFromId: showPartialModal.id,
        carryOverDate: showPartialModal.dispatchDate,
        notes: `Carry-over from ${showPartialModal.truckNumber} on ${showPartialModal.dispatchDate}`,
        createdAt: new Date().toISOString(),
      });

      setShowPartialModal(null);
      setPartialSoldKg('');
    } catch (err) {
      console.error(err);
      alert('Failed to record partial sale.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Summary stats
  const activeDispatches = dispatches.filter(d => d.status === 'active' || d.status === 'carryover');
  const totalOnRoad = activeDispatches.reduce((a, d) => a + (d.remainingWeightKg || 0), 0);
  const todaySold = dispatches
    .filter(d => d.dispatchDate === todayStr)
    .reduce((a, d) => a + (d.soldWeightKg || 0), 0);
  const carryOvers = dispatches.filter(d => d.status === 'carryover' && d.dispatchDate === todayStr);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Truck Dispatch Manager</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track truck departures, partial sales, and automatic carry-over of unsold stock.
          </p>
        </div>
      </div>

      {/* Carry-Over Alert */}
      {carryOvers.length > 0 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-2xl flex items-start gap-3 text-left animate-in slide-in-from-top-2">
          <RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-blue-700 dark:text-blue-300 text-sm">
              {carryOvers.length} Carry-Over Truck{carryOvers.length > 1 ? 's' : ''} Today
            </p>
            {carryOvers.map(co => (
              <p key={co.id} className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                🚛 {co.truckNumber} — {co.remainingWeightKg} kg unsold stock from {formatDate(co.carryOverDate)}
                {' '}at ₹{co.ratePerKg}/kg (yesterday's locked rate)
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Active Trucks', value: activeDispatches.length, unit: 'trucks', color: 'text-amber-600' },
          { label: 'Stock on Road', value: `${totalOnRoad.toFixed(0)} kg`, unit: '', color: 'text-orange-600' },
          { label: "Today's Sold", value: `${todaySold.toFixed(0)} kg`, unit: '', color: 'text-emerald-600' },
          { label: 'Carry-Overs', value: carryOvers.length, unit: 'trucks', color: 'text-blue-600' },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-4 rounded-2xl bg-white dark:bg-slate-900/50 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
            <p className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
            {stat.unit && <p className="text-[10px] text-slate-400 mt-0.5">{stat.unit}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Dispatch Form */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 h-fit text-left">
          <h3 className="text-base font-bold mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            Log New Truck Dispatch
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Truck Number *</label>
                <input
                  type="text" required
                  value={form.truckNumber}
                  onChange={e => setForm({ ...form, truckNumber: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold font-mono uppercase"
                  placeholder="e.g. MH-04-AB-1234"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Driver Name *</label>
                <input
                  type="text" required
                  value={form.driverName}
                  onChange={e => setForm({ ...form, driverName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  placeholder="Driver's Name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Driver Phone</label>
                <input
                  type="text"
                  value={form.driverPhone}
                  onChange={e => setForm({ ...form, driverPhone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
                  placeholder="98xxxxxx"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Dispatch Date</label>
                <input
                  type="date"
                  value={form.dispatchDate}
                  onChange={e => setForm({ ...form, dispatchDate: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Birds</label>
                <input
                  type="number"
                  value={form.totalBirds}
                  onChange={e => setForm({ ...form, totalBirds: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  placeholder="0 birds"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Weight (kg) *</label>
                <input
                  type="number" step="0.1" required
                  value={form.totalWeightKg}
                  onChange={e => setForm({ ...form, totalWeightKg: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  placeholder="0.0 kg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Rate Locked (₹/kg) *</label>
                <input
                  type="number" step="0.5" required
                  value={form.ratePerKg}
                  onChange={e => setForm({ ...form, ratePerKg: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-600 dark:text-emerald-400"
                  placeholder="₹ rate"
                />
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="Any loading notes..."
                />
              </div>
            </div>

            {form.totalWeightKg && form.ratePerKg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400">
                Estimated Truck Value: ₹{(parseFloat(form.totalWeightKg) * parseFloat(form.ratePerKg)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            )}

            <button
              type="submit" disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md cursor-pointer transform active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Log Truck Dispatch
            </button>
          </form>
        </div>

        {/* Dispatch Ledger */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/50 shadow-md">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Truck Dispatch Ledger</h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                {dispatches.length} records
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[560px] overflow-y-auto">
              {dispatches.length > 0 ? dispatches.map(d => {
                const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.active;
                const isExpanded = expandedId === d.id;
                const estimatedValue = ((d.totalWeightKg || 0) * (d.ratePerKg || 0));
                const soldValue = ((d.soldWeightKg || 0) * (d.ratePerKg || 0));

                return (
                  <div key={d.id} className="text-left">
                    {/* Row Header */}
                    <div
                      className="p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : d.id)}
                    >
                      {/* Status dot + truck no */}
                      <div className="shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`}></div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-800 dark:text-white font-mono text-sm">{d.truckNumber}</span>
                          {d.isCarryOver && (
                            <span className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Carry-Over</span>
                          )}
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{d.driverName}</span>
                          {d.driverPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{d.driverPhone}</span>}
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(d.dispatchDate)}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="block font-black text-slate-800 dark:text-white text-sm">
                          {d.remainingWeightKg?.toFixed(1)} kg left
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          of {d.totalWeightKg} kg loaded
                        </span>
                      </div>

                      <div className="shrink-0 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-slate-50/50 dark:bg-slate-800/10 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-1">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                          {[
                            { label: 'Total Loaded', value: `${d.totalWeightKg} kg` },
                            { label: 'Total Birds', value: `${d.totalBirds || 0} birds` },
                            { label: 'Locked Rate', value: `₹${d.ratePerKg}/kg` },
                            { label: 'Est. Truck Value', value: `₹${estimatedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                            { label: 'Sold Weight', value: `${d.soldWeightKg || 0} kg` },
                            { label: 'Remaining', value: `${d.remainingWeightKg?.toFixed(1)} kg` },
                            { label: 'Sold Value', value: `₹${soldValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                            { label: 'Status', value: cfg.label },
                          ].map((item, i) => (
                            <div key={i} className="p-2 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-100 dark:border-slate-800">
                              <span className="block text-[9px] uppercase tracking-wider text-slate-400 font-bold">{item.label}</span>
                              <span className="block font-bold text-slate-700 dark:text-slate-200 mt-0.5">{item.value}</span>
                            </div>
                          ))}
                        </div>

                        {d.notes && (
                          <p className="mt-3 text-xs text-slate-500 italic border-t border-slate-100 dark:border-slate-800 pt-2">
                            Notes: {d.notes}
                          </p>
                        )}

                        {/* Action Buttons */}
                        {(d.status === 'active' || d.status === 'carryover') && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => { setShowPartialModal(d); setPartialSoldKg(''); }}
                              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Package className="w-3.5 h-3.5" /> Partial Sale + Carry Over
                            </button>
                            <button
                              onClick={() => handleMarkFullySold(d)}
                              disabled={isUpdating}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Fully Sold
                            </button>
                          </div>
                        )}

                        {d.status === 'sold' && (
                          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircle2 className="w-4 h-4" /> Truck returned. All stock sold.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }) : (
                <div className="p-12 text-center text-slate-400 text-sm italic">
                  No truck dispatches logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Partial Sale Modal */}
      {showPartialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 text-left">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">Record Partial Sale</h3>
            <p className="text-xs text-slate-500 mb-4">
              Truck <span className="font-black font-mono text-slate-700 dark:text-slate-200">{showPartialModal.truckNumber}</span> — Total loaded: <strong>{showPartialModal.totalWeightKg} kg</strong>
            </p>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Sold Today (kg) *</label>
                <input
                  type="number" step="0.1"
                  value={partialSoldKg}
                  onChange={e => setPartialSoldKg(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 text-lg font-black"
                  placeholder="0.0"
                  autoFocus
                />
              </div>

              {partialSoldKg && parseFloat(partialSoldKg) > 0 && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900">
                    <span className="block text-emerald-600 font-bold text-[10px] uppercase">Sold</span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{parseFloat(partialSoldKg).toFixed(1)} kg</span>
                    <span className="block text-[10px] text-emerald-600 mt-0.5">
                      ≈ ₹{(parseFloat(partialSoldKg) * showPartialModal.ratePerKg).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900">
                    <span className="block text-blue-600 font-bold text-[10px] uppercase">Carry-Over (Tomorrow)</span>
                    <span className="text-lg font-black text-blue-700 dark:text-blue-400">
                      {Math.max(0, showPartialModal.totalWeightKg - parseFloat(partialSoldKg)).toFixed(1)} kg
                    </span>
                    <span className="block text-[10px] text-blue-600 mt-0.5">Locked @ ₹{showPartialModal.ratePerKg}/kg</span>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                ℹ️ Remaining stock will automatically be created as a carry-over dispatch for tomorrow at the same locked rate (₹{showPartialModal.ratePerKg}/kg).
              </p>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowPartialModal(null); setPartialSoldKg(''); }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePartialSale}
                disabled={isUpdating || !partialSoldKg || parseFloat(partialSoldKg) <= 0}
                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Confirm & Carry Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
