import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, Printer, CreditCard, Banknote, ShoppingCart, UserCheck, CheckCircle2 } from 'lucide-react';
import { shopDetails } from './data';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot } from 'firebase/firestore';

export default function BillingPOS({ products }) {
  const [cart, setCart] = useState([]);
  const savedShop = localStorage.getItem('shopInfo');
  const activeShop = savedShop ? JSON.parse(savedShop) : {
    customerUniqueId: 'MC-89324',
    shopName: shopDetails.name,
    proprietorName: 'Mohammad Farooq Momin',
    address: shopDetails.address,
    phone: shopDetails.phone,
    gstin: shopDetails.gstin || '27AAAAA1111A1Z1'
  };
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [inputWeight, setInputWeight] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isPaid, setIsPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  
  const [workers, setWorkers] = useState([
    { name: 'Imran Khan', shift: 'Morning Shift' },
    { name: 'Raju Shinde', shift: 'Evening Shift' }
  ]);
  const [activeWorker, setActiveWorker] = useState('Imran Khan');

  useEffect(() => {
    const qWorkers = query(collection(db, 'workers'));
    const unsubscribe = onSnapshot(qWorkers, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      if (list.length > 0) {
        setWorkers(list);
        // Automatically ensure activeWorker is one of the loaded workers
        const activeExists = list.some(w => w.name === activeWorker);
        if (!activeExists) {
          setActiveWorker(list[0].name);
        }
      } else {
        setWorkers([
          { name: 'Imran Khan', shift: 'Morning Shift' },
          { name: 'Raju Shinde', shift: 'Evening Shift' }
        ]);
        setActiveWorker('Imran Khan');
      }
    });
    return () => unsubscribe();
  }, [activeWorker]);

  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setInputWeight('');
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    
    const quantity = parseFloat(inputWeight);
    if (isNaN(quantity) || quantity <= 0) return;

    const existingItemIndex = cart.findIndex(item => item.product.id === selectedProduct.id);
    
    if (existingItemIndex >= 0) {
      const newCart = [...cart];
      newCart[existingItemIndex].quantity += quantity;
      newCart[existingItemIndex].amount = newCart[existingItemIndex].quantity * newCart[existingItemIndex].product.rate;
      setCart(newCart);
    } else {
      setCart([
        ...cart, 
        { 
          id: Date.now(), 
          product: selectedProduct, 
          quantity: quantity, 
          amount: quantity * selectedProduct.rate 
        }
      ]);
    }
    
    setSelectedProduct(null);
    setInputWeight('');
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const handleCheckout = async (mode) => {
    if (cart.length === 0) {
      alert("Cart is empty! Please add items before checking out.");
      return;
    }
    
    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        rate: item.product.rate,
        amount: item.amount
      }));

      const activeWorkerObj = workers.find(w => w.name === activeWorker);

      await addDoc(collection(db, 'sales'), {
        items,
        subtotal,
        discount,
        total,
        paymentMethod: mode,
        workerName: activeWorker,
        shift: activeWorkerObj ? activeWorkerObj.shift : 'Morning Shift',
        timestamp: serverTimestamp()
      });

      setIsPaid(true);
      setPaymentMethod(mode);
    } catch (error) {
      console.error("Error saving sale to Firebase: ", error);
      alert("Error saving sale. Check console.");
    }
  };

  const handleNewBill = () => {
    setCart([]);
    setDiscount(0);
    setIsPaid(false);
    setPaymentMethod(null);
  };

  const handlePrint = () => {
    if (cart.length === 0) {
      alert("Cart is empty! Nothing to print.");
      return;
    }
    // Triggers the browser's print dialog. The print styles in index.css will format it.
    window.print();
  };

  const subtotal = cart.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal - discount;

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-8rem)] print:hidden">
        {/* Left Area: Products & Input */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Search and Categories */}
        <div className="glass-panel p-4 rounded-2xl flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-primary-500 transition-shadow"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => handleProductSelect(product)}
              className={`flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all ${
                selectedProduct?.id === product.id 
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 shadow-md ring-2 ring-primary-500/20' 
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:-translate-y-1 hover:shadow-lg'
              }`}
            >
              <div className="w-full h-24 bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-contain p-2 absolute inset-0 z-10 transition-transform duration-300 group-hover:scale-110" 
                  onError={(e) => { e.target.style.display = 'none'; }} 
                />
                <div className="text-5xl drop-shadow-md absolute z-0">{product.emoji}</div>
              </div>
              <div className="p-3 w-full border-t border-slate-100 dark:border-slate-700/50">
                <div className="font-semibold text-sm sm:text-base mb-1 truncate leading-tight">{product.name}</div>
                <div className="text-primary-600 dark:text-primary-400 font-bold text-sm">
                  ₹{product.rate} <span className="text-xs text-slate-500 font-normal">/ {product.unit}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Input Area (conditionally shown or always active) */}
        {selectedProduct && (
          <div className="glass-panel p-6 rounded-2xl mt-auto animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Add {selectedProduct.name}</h3>
              <div className="text-lg font-semibold text-primary-600 dark:text-primary-400">₹{selectedProduct.rate} / {selectedProduct.unit}</div>
            </div>
            
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Enter {selectedProduct.unit === 'kg' ? 'Weight (kg)' : 'Quantity (pieces)'}
                </label>
                <input 
                  type="number" 
                  step="0.01"
                  autoFocus
                  value={inputWeight}
                  onChange={(e) => setInputWeight(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter') handleAddToCart() }}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-4 px-4 text-2xl font-bold focus:ring-2 focus:ring-primary-500 transition-shadow"
                  placeholder="0.00"
                />
              </div>
              <button 
                onClick={handleAddToCart}
                className="bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-4 px-8 font-bold text-lg shadow-lg shadow-primary-600/30 transition-all active:scale-95"
              >
                Add to Bill
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Area: Cart/Bill */}
      <div className="w-full lg:w-96 glass-panel rounded-2xl flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary-500" />
            Current Bill
          </h3>
          <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 py-1 px-3 rounded-full text-xs font-bold">
            {cart.length} items
          </span>
        </div>

        {/* Worker Selector */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/50 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs font-medium text-slate-500">Worker/Cashier:</span>
          <select 
            value={activeWorker} 
            onChange={(e) => setActiveWorker(e.target.value)}
            className="text-xs bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded p-1 outline-none font-semibold text-slate-700 dark:text-slate-200"
          >
            {workers.map(w => (
              <option key={w.name} value={w.name}>{w.name} ({w.shift})</option>
            ))}
          </select>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex gap-3 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50 group">
                <div className="flex-1">
                  <div className="font-semibold">{item.product.name}</div>
                  <div className="text-sm text-slate-500">
                    {item.quantity} {item.product.unit} × ₹{item.product.rate}
                  </div>
                </div>
                <div className="text-right flex flex-col justify-between items-end">
                  <div className="font-bold text-lg">₹{item.amount.toFixed(2)}</div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Checkout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Discount</span>
              <input 
                type="number" 
                value={discount || ''}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="w-20 bg-white dark:bg-slate-700 border-none rounded py-1 px-2 text-right focus:ring-1 focus:ring-primary-500"
                placeholder="0"
              />
            </div>
            <div className="flex justify-between font-bold text-xl pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
              <span>Total</span>
              <span className="text-primary-600 dark:text-primary-400">₹{total.toFixed(2)}</span>
            </div>
          </div>

          {isPaid ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-xl mb-4 text-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-700 dark:text-green-400">Payment Received</p>
              <p className="text-sm text-green-600 dark:text-green-500">via {paymentMethod?.toUpperCase()}</p>
            </div>
          ) : null}

          {!isPaid ? (
            <>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => handleCheckout('cash')}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 rounded-xl font-bold transition-colors"
                >
                  <Banknote className="w-5 h-5" />
                  Cash
                </button>
                <button 
                  onClick={() => handleCheckout('upi')}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 rounded-xl font-bold transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  UPI
                </button>
              </div>
              <button 
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white rounded-xl font-bold text-lg transition-colors shadow-lg"
              >
                <Printer className="w-5 h-5" />
                Print Bill
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <button 
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 py-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold text-lg transition-colors shadow-lg"
              >
                <Printer className="w-5 h-5" />
                Print Receipt
              </button>
              <button 
                onClick={handleNewBill}
                className="w-full flex items-center justify-center gap-2 py-4 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-xl font-bold text-lg transition-colors"
              >
                <Plus className="w-5 h-5" />
                Start New Bill
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Printable Receipt */}
      <div className="print-only receipt-wrapper">
        <div className="receipt-header">
          <h1>{activeShop.shopName}</h1>
          <p style={{ fontWeight: 'bold', fontSize: '11px', margin: '2px 0' }}>Proprietor: {activeShop.proprietorName}</p>
          <p>{activeShop.address}</p>
          <p>Ph: {activeShop.phone} | GST: {activeShop.gstin}</p>
          <p>Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>
        
        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="right">Qty</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {cart.map(item => (
              <tr key={item.id}>
                <td>
                  {item.product.name}
                  <div style={{fontSize: '10px', color: '#555'}}>@ ₹{item.product.rate}/{item.product.unit}</div>
                </td>
                <td className="right">{item.quantity}</td>
                <td className="right">₹{item.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="receipt-totals">
          <div className="row">
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="row">
              <span>Discount:</span>
              <span>-₹{discount.toFixed(2)}</span>
            </div>
          )}
          <div className="row bold">
            <span>Total:</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          {paymentMethod && (
            <div className="row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed black' }}>
              <span>Payment Mode:</span>
              <span>{paymentMethod.toUpperCase()}</span>
            </div>
          )}
        </div>
        
        <div className="receipt-footer">
          <p>Thank you!</p>
          <p>Visit Again</p>
        </div>
      </div>
    </>
  );
}
