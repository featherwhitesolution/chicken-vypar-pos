import React, { useState, useMemo } from 'react';
import { Search, Save, CheckCircle2, Factory, Loader2, Calendar, FileText, Banknote, Building2, CreditCard } from 'lucide-react';
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

const paymentModes = [
  { id: 'Cash', icon: '💵' },
  { id: 'UPI', icon: '📱' },
  { id: 'Cheque', icon: '🏦' },
  { id: 'Bank Transfer', icon: '💳' }
];

const indianBanks = [
  "State Bank of India (SBI)", "HDFC Bank", "ICICI Bank", "Punjab National Bank (PNB)", 
  "Bank of Baroda", "Axis Bank", "Canara Bank", "Union Bank of India", 
  "Bank of India", "Indian Bank", "Central Bank of India", "Indian Overseas Bank", 
  "UCO Bank", "Bank of Maharashtra", "Punjab & Sind Bank", "Kotak Mahindra Bank", 
  "IndusInd Bank", "Yes Bank", "IDFC FIRST Bank", "Federal Bank", 
  "South Indian Bank", "Bandhan Bank", "RBL Bank", "Karnataka Bank", "Other"
];

export default function SupplierPayments() {
  const [suppliers] = useState(initialSuppliers);
  const [searchQuery, setSearchQuery] = useState('');
  
  const today = new Date().toISOString().split('T')[0];
  
  const [formData, setFormData] = useState({
    supplierId: '',
    date: today,
    amount: '',
    paymentMode: 'Cash',
    purchaseType: 'Chicken',
    referenceNo: '',
    bankName: '',
    notes: ''
  });
  
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [suppliers, searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.supplierId || !formData.amount) {
      alert("Please fill supplier and amount");
      return;
    }
    
    const needsBankDetails = formData.paymentMode === 'Cheque' || formData.paymentMode === 'Bank Transfer';
    if (needsBankDetails && !formData.referenceNo) {
      alert(`Please enter ${formData.paymentMode === 'Cheque' ? 'Cheque Number' : 'Transaction Ref No'}`);
      return;
    }
    
    setIsSaving(true);
    
    try {
      const supplierName = suppliers.find(s => s.id === formData.supplierId)?.name || 'Unknown';
      
      const paymentData = {
        supplierId: formData.supplierId,
        supplierName: supplierName,
        paymentDate: formData.date,
        amount: parseFloat(formData.amount),
        paymentMode: formData.paymentMode,
        purchaseType: formData.purchaseType,
        referenceNo: needsBankDetails ? formData.referenceNo : null,
        bankName: needsBankDetails ? formData.bankName : null,
        notes: formData.notes,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, "supplier_payments"), paymentData);
      
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          supplierId: '',
          date: today,
          amount: '',
          paymentMode: 'Cash',
          purchaseType: 'Chicken',
          referenceNo: '',
          bankName: '',
          notes: ''
        });
        setSearchQuery('');
      }, 3000);
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Failed to save data.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Supplier Payment (Outward)</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Record payments made to suppliers to clear outstanding balances.</p>
      </div>

      <div className="glass-panel rounded-2xl p-6 md:p-8 relative overflow-hidden">
        {showSuccess && (
          <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center animate-in fade-in duration-300">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Payment Recorded Successfully!</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">The supplier ledger has been updated.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Supplier Section */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Factory className="w-4 h-4" />
              Select Supplier
            </label>
            
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
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          : 'border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700 bg-white dark:bg-slate-800'
                      }`}
                    >
                      <span className="font-medium text-sm truncate">{supplier.name}</span>
                      {formData.supplierId === supplier.id && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                    </button>
                  ))
                ) : (
                  <div className="col-span-full text-center py-4 text-sm text-slate-500 dark:text-slate-400">
                    No suppliers found.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            {/* Payment Date */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Calendar className="w-4 h-4" />
                Payment Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-lg font-medium"
                required
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Banknote className="w-4 h-4" />
                Payment Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-xl font-bold text-green-600 dark:text-green-400"
                  required
                />
              </div>
            </div>

            {/* Payment Category */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Banknote className="w-4 h-4" />
                Payment Category / Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, purchaseType: 'Chicken' })}
                  className={`px-4 py-3.5 rounded-xl border text-center font-black transition-all flex items-center justify-center gap-2 ${
                    formData.purchaseType === 'Chicken'
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500 text-green-700 dark:text-green-400 scale-[1.02]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-300 text-slate-650 dark:text-slate-300'
                  }`}
                >
                  <span className="text-lg">🐔</span>
                  <span>Chicken Payment</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, purchaseType: 'Eggs' })}
                  className={`px-4 py-3.5 rounded-xl border text-center font-black transition-all flex items-center justify-center gap-2 ${
                    formData.purchaseType === 'Eggs'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 ring-2 ring-amber-500 text-amber-700 dark:text-amber-400 scale-[1.02]'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:border-slate-300 text-slate-650 dark:text-slate-300'
                  }`}
                >
                  <span className="text-lg">🥚</span>
                  <span>Eggs Payment</span>
                </button>
              </div>
            </div>

            {/* Payment Mode */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <CreditCard className="w-4 h-4" />
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
                    <span className="text-sm md:text-base">{mode.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Conditional Bank Details */}
            {(formData.paymentMode === 'Cheque' || formData.paymentMode === 'Bank Transfer') && (
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <Building2 className="w-4 h-4" />
                    Bank Name
                  </label>
                  <select
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  >
                    <option value="">Select Bank (Optional)</option>
                    {indianBanks.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    <FileText className="w-4 h-4" />
                    {formData.paymentMode === 'Cheque' ? 'Cheque Number' : 'Transaction Ref No.'}
                  </label>
                  <input
                    type="text"
                    placeholder={formData.paymentMode === 'Cheque' ? "e.g. 123456" : "e.g. UTR123456789"}
                    value={formData.referenceNo}
                    onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                    required
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2 col-span-1 md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <FileText className="w-4 h-4" />
                Additional Notes (Optional)
              </label>
              <textarea
                placeholder="Any references, bill numbers, or comments..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none h-24"
              />
            </div>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {isSaving ? 'Recording Payment...' : 'Record Payment Outward'}
          </button>
        </form>
      </div>
    </div>
  );
}
