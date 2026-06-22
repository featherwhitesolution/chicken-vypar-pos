import React, { useState, useEffect } from 'react';
import { Truck, Scale, AlertTriangle, Save, CheckCircle2, History, Loader2, RefreshCw, Layers } from 'lucide-react';
import { supabase } from './supabase';

export default function FarmInward() {
  const [inwards, setInwards] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState({
    farmName: '',
    vehicleNo: '',
    driverName: '',
    farmWeightLoaded: '',
    birdsLoaded: '',
    grossWeight: '',
    tareWeight: '',
    birdsReceived: '',
    deadBirdsWeight: '',
    rate: '',
    notes: ''
  });

  // Fetch recent farm inwards
  useEffect(() => {
    const fetchRecent = async () => {
      const { data, error } = await supabase
        .from('farm_inwards')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && data) {
        const mapped = data.map(row => ({
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
        }));
        setInwards(mapped);
      }
    };
    fetchRecent();

    const channel = supabase
      .channel('farm-inwards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'farm_inwards' }, () => {
        fetchRecent();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Dynamic calculations
  const farmWeight = parseFloat(formData.farmWeightLoaded) || 0;
  const loadedCount = parseInt(formData.birdsLoaded) || 0;
  const gross = parseFloat(formData.grossWeight) || 0;
  const tare = parseFloat(formData.tareWeight) || 0;
  const receivedCount = parseInt(formData.birdsReceived) || 0;
  const deadWeight = parseFloat(formData.deadBirdsWeight) || 0;
  const rateVal = parseFloat(formData.rate) || 0;

  // Calculators
  const netReceivedWeight = Math.max(0, gross - tare);
  const sellableWeight = Math.max(0, netReceivedWeight - deadWeight);
  const transitWeightLoss = Math.max(0, farmWeight - netReceivedWeight);
  const transitWeightLossPercent = farmWeight > 0 ? ((transitWeightLoss / farmWeight) * 100).toFixed(2) : '0.00';
  const transitMortality = Math.max(0, loadedCount - receivedCount);
  const totalBillValue = netReceivedWeight * rateVal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.farmName || !formData.vehicleNo || !formData.grossWeight || !formData.tareWeight || !formData.rate) {
      alert("Please fill in Farm Name, Vehicle No, Gross/Tare weight, and purchase Rate.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        farm_name: formData.farmName.trim(),
        vehicle_no: formData.vehicleNo.trim().toUpperCase(),
        driver_name: formData.driverName.trim(),
        farm_weight_loaded: farmWeight,
        birds_loaded: loadedCount,
        gross_weight: gross,
        tare_weight: tare,
        net_weight: netReceivedWeight,
        sellable_weight: sellableWeight,
        birds_received: receivedCount,
        dead_birds_weight: deadWeight,
        transit_weight_loss: transitWeightLoss,
        transit_weight_loss_percent: parseFloat(transitWeightLossPercent),
        transit_mortality: transitMortality,
        rate: rateVal,
        total_value: totalBillValue,
        notes: formData.notes.trim(),
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
      };

      const { error } = await supabase.from('farm_inwards').insert(payload);
      if (error) throw error;

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          farmName: '',
          vehicleNo: '',
          driverName: '',
          farmWeightLoaded: '',
          birdsLoaded: '',
          grossWeight: '',
          tareWeight: '',
          birdsReceived: '',
          deadBirdsWeight: '',
          rate: '',
          notes: ''
        });
      }, 2500);
    } catch (err) {
      console.error("Error saving farm inward:", err);
      alert("Failed to save farm procurement record.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Farm Stock Inward (Procurement)</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Record bulk chicken batches arriving from farms, track transit shrinkage, and calculate weighbridge net weights.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Farm Inward Entry Form */}
        <div className="lg:col-span-2 glass-panel p-6 md:p-8 rounded-2xl bg-white dark:bg-slate-900/50 relative overflow-hidden text-left h-fit">
          {showSuccess && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-15 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Inward Record Saved!</h3>
              <p className="text-sm text-slate-500 mt-2">Inventory and Farm Accounts updated.</p>
            </div>
          )}

          <h3 className="text-lg font-bold mb-6 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Truck className="w-6 h-6 text-emerald-500" />
            New Farm Batch Arrival
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Section 1: Logistics & Source */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Source Farm Name</label>
                <input
                  type="text"
                  required
                  value={formData.farmName}
                  onChange={e => setFormData({ ...formData, farmName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  placeholder="e.g. Baramati Farm #4"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Vehicle Number</label>
                <input
                  type="text"
                  required
                  value={formData.vehicleNo}
                  onChange={e => setFormData({ ...formData, vehicleNo: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono font-bold uppercase"
                  placeholder="e.g. MH-12-PQ-9087"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Driver Name</label>
                <input
                  type="text"
                  value={formData.driverName}
                  onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  placeholder="Driver's Name"
                />
              </div>
            </div>

            {/* Section 2: Farm Loading Manifest */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-500" />
                Farm Dispatch Manifest (From Farm Loading Slip)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Weight Loaded at Farm (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.farmWeightLoaded}
                    onChange={e => setFormData({ ...formData, farmWeightLoaded: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Birds Loaded count</label>
                  <input
                    type="number"
                    value={formData.birdsLoaded}
                    onChange={e => setFormData({ ...formData, birdsLoaded: e.target.value })}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Warehouse Weighbridge & Offloading */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Gross Wt (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.grossWeight}
                  onChange={e => setFormData({ ...formData, grossWeight: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-800 dark:text-white"
                  placeholder="Loaded"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Tare Wt (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.tareWeight}
                  onChange={e => setFormData({ ...formData, tareWeight: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-slate-800 dark:text-white"
                  placeholder="Empty"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Live Birds</label>
                <input
                  type="number"
                  value={formData.birdsReceived}
                  onChange={e => setFormData({ ...formData, birdsReceived: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                  placeholder="Count"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">DOA Wt (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.deadBirdsWeight}
                  onChange={e => setFormData({ ...formData, deadBirdsWeight: e.target.value })}
                  className="w-full p-2.5 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 text-sm font-semibold text-rose-600 dark:text-rose-400"
                  placeholder="Dead birds wt"
                />
              </div>
            </div>

            {/* Section 4: Purchase Rate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Purchase Rate (₹ per kg)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.rate}
                    onChange={e => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full pl-7 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-green-600 dark:text-green-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Notes / Comments</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  placeholder="E.g., Batch quality details..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-1.5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-base shadow-lg cursor-pointer transform active:scale-98 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Log Farm Stock Inward (Total Bill Value: ₹{totalBillValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
            </button>
          </form>
        </div>

        {/* Right Column: Live Tally & History */}
        <div className="space-y-6">

          {/* Live Inward Tally Card */}
          <div className="glass-panel p-6 rounded-2xl bg-gradient-to-b from-[#064e3b] to-[#022c22] text-white border-transparent text-left relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <h4 className="text-[10px] font-black uppercase text-emerald-350 tracking-widest flex items-center gap-1 mb-4">
              <Scale className="w-4 h-4 text-emerald-350" /> Weighbridge Live Calculations
            </h4>

            <div className="space-y-3 font-medium">
              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-emerald-200">Net Received Weight</span>
                <span className="font-bold text-white text-base">{netReceivedWeight.toFixed(2)} kg</span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-emerald-200">Transit Weight Loss</span>
                <span className="font-bold text-amber-300 flex items-center gap-1">
                  -{transitWeightLoss.toFixed(2)} kg ({transitWeightLossPercent}%)
                </span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-emerald-200">Sellable Weight</span>
                <span className="font-bold text-emerald-300 flex items-center gap-1">
                  {sellableWeight.toFixed(2)} kg
                </span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-emerald-200">Transit Mortality (DOA)</span>
                <span className={`font-bold flex items-center gap-1 ${transitMortality > 0 || deadWeight > 0 ? 'text-red-350 font-extrabold' : 'text-emerald-100'}`}>
                  {transitMortality > 0 ? `${transitMortality} Dead` : '0 Dead'} {deadWeight > 0 ? `| ${deadWeight.toFixed(2)} kg` : ''}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                <span className="text-emerald-200">Purchase Rate</span>
                <span className="font-bold text-white">₹{rateVal}/kg</span>
              </div>

              <div className="pt-2 flex justify-between items-end">
                <span className="text-xs text-emerald-300 font-bold uppercase tracking-wider">Estimated Bill Value</span>
                <span className="text-2xl font-black text-emerald-400 leading-none">
                  ₹{totalBillValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {transitWeightLossPercent > 4.0 && (
              <div className="mt-4 flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] text-amber-300 animate-pulse">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Transit weight loss is high ({transitWeightLossPercent}%). Audit transit time & route water feeding logs.</span>
              </div>
            )}
          </div>

          {/* History list */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col h-[380px] bg-white dark:bg-slate-900/50 text-left">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-2">
              <History className="w-5 h-5 text-emerald-500" />
              Recent Farm Imports
            </h3>

            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {inwards.length > 0 ? (
                inwards.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-850/10 flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-800 dark:text-white truncate max-w-[120px]">{item.farmName}</span>
                      <span className="text-slate-400">{formatDate(item.date)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 font-mono mt-1">
                      <span>Vehicle: {item.vehicleNo}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-350">{item.netWeight.toFixed(1)} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-450 mt-1 border-t border-slate-100 dark:border-slate-800/50 pt-1.5 text-[10px]">
                      <span>Shrinkage: {item.transitWeightLossPercent}%</span>
                      <span className="text-red-500 font-bold">{item.transitMortality} Dead</span>
                      <span className="text-emerald-600 font-bold">₹{item.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-400 py-12 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
                  <span>Waiting for data...</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
