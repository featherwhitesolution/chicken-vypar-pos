import React, { useState, useEffect } from 'react';
import { Save, Tag, RefreshCw, Loader2 } from 'lucide-react';
import { db } from './firebase';
import { doc, writeBatch } from 'firebase/firestore';

export default function DailyRates({ products, setProducts }) {
  const [localRates, setLocalRates] = useState(() => {
    const rates = {};
    products.forEach(p => rates[p.id] = p.rate);
    return rates;
  });

  const handleRateChange = (id, newRate) => {
    setLocalRates(prev => ({ ...prev, [id]: Number(newRate) }));
  };

  const [isSaving, setIsSaving] = useState(false);

  // Sync local state if products change from outside (e.g., via realtime listener in App)
  useEffect(() => {
    setLocalRates(prev => {
      const newRates = { ...prev };
      products.forEach(p => {
        // If we haven't modified it locally yet, keep it synced with upstream
        if (newRates[p.id] === undefined) {
          newRates[p.id] = p.rate;
        }
      });
      return newRates;
    });
  }, [products]);

  const saveRates = async () => {
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      products.forEach(p => {
        const docRef = doc(db, 'retail_products', p.id.toString());
        const newRate = localRates[p.id] !== undefined ? localRates[p.id] : p.rate;
        batch.update(docRef, { rate: newRate });
      });

      await batch.commit();
      alert('Rates saved to cloud successfully!');
    } catch (err) {
      console.error('Failed to save rates:', err);
      alert('Failed to save rates. Check console.');
    } finally {
      setIsSaving(false);
    }
  };

  const categories = [...new Set(products.map(p => p.category))];

  return (
    <div className="glass-panel p-6 md:p-8 rounded-2xl h-full flex flex-col">
      <div className="flex justify-between items-center mb-8 border-b border-slate-200 dark:border-slate-700 pb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary-500" />
            Set Today's Rates
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Update the price per kg for all cuts. These prices will be active across the Billing POS immediately.
          </p>
        </div>
        <button 
          onClick={saveRates}
          disabled={isSaving}
          className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary-600/20 transition-all active:scale-95 disabled:opacity-70"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {isSaving ? 'Saving...' : 'Save Rates'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {categories.map(category => (
          <div key={category} className="mb-8">
            <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary-500"></div>
              {category}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.filter(p => p.category === category).map(product => (
                <div key={product.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2 truncate">
                    {product.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-400">₹</span>
                    <input 
                      type="number"
                      value={localRates[product.id] || ''}
                      onChange={(e) => handleRateChange(product.id, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                    <span className="text-sm text-slate-500">/ {product.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
