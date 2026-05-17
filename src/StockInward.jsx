import React, { useState, useMemo } from 'react';
import { Search, Plus, Save, Truck, User, IndianRupee, Tag, CheckCircle2, Factory, Scale, Loader2, Hash, Wallet, Calendar, Building2, FileText } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const initialSuppliers = [
  { id: 1, name: 'Suguna Foods (Pune)' },
  { id: 2, name: "Venky's (Pune)" },
  { id: 3, name: 'Baramati Agro' },
  { id: 4, name: 'Premium Chick Feeds (Jalgaon)' },
  { id: 5, name: 'Godrej Agrovet' },
  { id: 6, name: 'Sneha Farms' }
];

const chickenTypes = [
  { id: 'BR', name: 'Broiler (BR)', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'P', name: 'Poultry (P)', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'D', name: 'Desi (D)', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' }
];

const paymentModes = [
  { id: 'Credit', icon: '📝' },
  { id: 'Cash', icon: '💵' },
  { id: 'UPI', icon: '📱' },
  { id: 'Cheque', icon: '🏦' }
];

const indianBanks = [
  "State Bank of India (SBI)", "HDFC Bank", "ICICI Bank", "Punjab National Bank (PNB)", 
  "Bank of Baroda", "Axis Bank", "Canara Bank", "Union Bank of India", 
  "Bank of India", "Indian Bank", "Central Bank of India", "Indian Overseas Bank", 
  "UCO Bank", "Bank of Maharashtra", "Punjab & Sind Bank", "Kotak Mahindra Bank", 
  "IndusInd Bank", "Yes Bank", "IDFC FIRST Bank", "Federal Bank", 
  "South Indian Bank", "Bandhan Bank", "RBL Bank", "Karnataka Bank", "Other"
];

export default function StockInward() {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  
  const [formData, setFormData] = useState({
    supplierId: '',
    vehicleNo: '',
    rate: '',
    weight: '',
    numberOfBirds: '',
    chickenType: 'BR',
    paymentMode: 'Credit',
    chequeDate: '',
    chequeNumber: '',
    bankName: ''
  });
  
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [suppliers, searchQuery]);

  const handleAddSupplier = () => {
    if (newSupplierName.trim()) {
      const newSupplier = {
        id: Date.now(),
        name: newSupplierName.trim()
      };
      setSuppliers([...suppliers, newSupplier]);
      setFormData({ ...formData, supplierId: newSupplier.id });
      setNewSupplierName('');
      setIsAddingSupplier(false);
      setSearchQuery('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierId || !formData.vehicleNo || !formData.rate || !formData.weight || !formData.numberOfBirds) {
      alert("Please fill all required fields");
      return;
    }
    
    if (formData.paymentMode === 'Cheque' && (!formData.chequeDate || !formData.chequeNumber || !formData.bankName)) {
      alert("Please fill all cheque details");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Find the supplier name for better readable data in DB
      const supplierName = suppliers.find(s => s.id === formData.supplierId)?.name || 'Unknown';
      
      const stockData = {
        supplierId: formData.supplierId,
        supplierName: supplierName,
        vehicleNo: formData.vehicleNo,
        rate: parseFloat(formData.rate),
        weight: parseFloat(formData.weight),
        numberOfBirds: parseInt(formData.numberOfBirds, 10),
        chickenType: formData.chickenType,
        paymentMode: formData.paymentMode,
        chequeDate: formData.paymentMode === 'Cheque' ? formData.chequeDate : null,
        chequeNumber: formData.paymentMode === 'Cheque' ? formData.chequeNumber : null,
        bankName: formData.paymentMode === 'Cheque' ? formData.bankName : null,
        totalValue: parseFloat(formData.weight) * parseFloat(formData.rate),
        timestamp: serverTimestamp()
      };

      // Save to Firebase Firestore
      await addDoc(collection(db, "stock_inwards"), stockData);
      
      console.log("Stock Inward Saved to Firebase:", stockData);
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          supplierId: '',
          vehicleNo: '',
          rate: '',
          weight: '',
          numberOfBirds: '',
          chickenType: 'BR',
          paymentMode: 'Credit',
          chequeDate: '',
          chequeNumber: '',
          bankName: ''
        });
        setSearchQuery('');
      }, 3000);
    } catch (error) {
      console.error("Error saving stock inward:", error);
      alert("Failed to save data. Please make sure Firebase is configured correctly.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Stock Inward</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Record new chicken arrivals from suppliers.</p>
      </div>

      <div className="glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden">
        {showSuccess && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Stock Recorded Successfully!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">The inventory has been updated.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Section */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Factory className="w-4 h-4" />
              Supplier / Farm
            </label>
            
            {!isAddingSupplier ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map(supplier => (
                      <button
                        key={supplier.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, supplierId: supplier.id })}
                        className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                          formData.supplierId === supplier.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                            : 'border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <span className="font-medium text-sm truncate">{supplier.name}</span>
                        {formData.supplierId === supplier.id && <CheckCircle2 className="w-4 h-4 text-primary-500 shrink-0" />}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                      No suppliers found.
                    </div>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsAddingSupplier(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 mt-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-primary-600 dark:text-primary-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Supplier
                </button>
              </div>
            ) : (
              <div className="flex gap-2 animate-in slide-in-from-top-2">
                <input
                  type="text"
                  placeholder="Enter supplier name..."
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddSupplier}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingSupplier(false);
                    setNewSupplierName('');
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            {/* Vehicle Number */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Truck className="w-4 h-4" />
                Vehicle Number
              </label>
              <input
                type="text"
                placeholder="e.g. MH-12-AB-1234"
                value={formData.vehicleNo}
                onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value.toUpperCase() })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg uppercase font-mono tracking-wider"
                required
              />
            </div>

            {/* Type of Chicken */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Tag className="w-4 h-4" />
                Chicken Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {chickenTypes.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, chickenType: type.id })}
                    className={`px-2 py-3 rounded-xl border text-center transition-all ${
                      formData.chickenType === type.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{type.id}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block truncate">{type.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Chicken */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Hash className="w-4 h-4" />
                Number of Chicken
              </label>
              <input
                type="number"
                min="1"
                placeholder="0"
                value={formData.numberOfBirds}
                onChange={(e) => setFormData({ ...formData, numberOfBirds: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg font-semibold"
                required
              />
            </div>

            {/* Total Weight */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Scale className="w-4 h-4" />
                Total Weight (kg)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg pr-12 font-semibold"
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">kg</span>
              </div>
            </div>

            {/* Rate of Purchase */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <IndianRupee className="w-4 h-4" />
                Rate of Purchase (per kg)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-lg font-semibold"
                  required
                />
              </div>
            </div>

            {/* Payment Mode */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Wallet className="w-4 h-4" />
                Mode of Payment
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {paymentModes.map(mode => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, paymentMode: mode.id })}
                    className={`px-4 py-3 rounded-xl border text-center font-bold transition-all ${
                      formData.paymentMode === mode.id
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-1 ring-green-500 text-green-700 dark:text-green-400'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="mr-2">{mode.icon}</span>
                    {mode.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional Cheque Details */}
            {formData.paymentMode === 'Cheque' && (
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <Building2 className="w-4 h-4" />
                    Bank Name
                  </label>
                  <select
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  >
                    <option value="">Select Bank</option>
                    {indianBanks.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <FileText className="w-4 h-4" />
                    Cheque Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 123456"
                    value={formData.chequeNumber}
                    onChange={(e) => setFormData({ ...formData, chequeNumber: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <Calendar className="w-4 h-4" />
                    Cheque Date
                  </label>
                  <input
                    type="date"
                    value={formData.chequeDate}
                    onChange={(e) => setFormData({ ...formData, chequeDate: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* Summary / Total */}
          {formData.weight && formData.rate && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center justify-between border border-slate-200 dark:border-slate-700">
              <span className="text-slate-600 dark:text-slate-300 font-medium">Estimated Total Value:</span>
              <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                ₹ {(parseFloat(formData.weight) * parseFloat(formData.rate)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSaving ? 'Saving Entry...' : 'Save Stock Entry'}
          </button>
        </form>
      </div>
    </div>
  );
}
