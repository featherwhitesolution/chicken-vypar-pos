import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, Printer, CreditCard, Banknote, ShoppingCart, UserCheck, CheckCircle2, Bluetooth, AlertTriangle, X, Info, Receipt, IndianRupee } from 'lucide-react';
import { shopDetails } from './data';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, query, onSnapshot, orderBy, limit } from 'firebase/firestore';

export default function BillingPOS({ products }) {
  const [cart, setCart] = useState([]);
  const savedShop = localStorage.getItem('shopInfo');
  const activeShop = savedShop ? JSON.parse(savedShop) : {
    customerUniqueId: 'CV-00001',
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

  // Printer config states
  const [printerMode, setPrinterMode] = useState(() => localStorage.getItem('printerMode') || 'system');
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showPrinterInfo, setShowPrinterInfo] = useState(false);
  const [showRecentBillsModal, setShowRecentBillsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recentSales, setRecentSales] = useState([]);
  const [activePrintSale, setActivePrintSale] = useState(null);
  const [bluetoothDevice, setBluetoothDevice] = useState(null);
  const [printCharacteristic, setPrintCharacteristic] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [printerStatus, setPrinterStatus] = useState('Disconnected');
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false);
  const [isBluetoothPrintJob, setIsBluetoothPrintJob] = useState(false);
  const encoder = new TextEncoder();

  // ESC/POS raw command sequences
  const init = new Uint8Array([0x1b, 0x40]);
  const center = new Uint8Array([0x1b, 0x61, 0x01]);
  const left = new Uint8Array([0x1b, 0x61, 0x00]);
  const right = new Uint8Array([0x1b, 0x61, 0x02]);
  const boldOn = new Uint8Array([0x1b, 0x45, 0x01]);
  const boldOff = new Uint8Array([0x1b, 0x45, 0x00]);
  const doubleSize = new Uint8Array([0x1d, 0x21, 0x11]);
  const normalSize = new Uint8Array([0x1d, 0x21, 0x00]);
  const feedLines = new Uint8Array([0x1b, 0x64, 0x04]);

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

  useEffect(() => {
    const qRecent = query(
      collection(db, 'sales'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(qRecent, (snapshot) => {
      const list = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setRecentSales(list);
    });
    return () => unsubscribe();
  }, []);

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
        unit: item.product.unit,
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

  // Direct BLE print helper functions
  const connectBluetoothPrinter = async () => {
    setIsConnecting(true);
    setPrinterStatus('Connecting...');
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard BLE Print Service
          '00001101-0000-1000-8000-00805f9b34fb', // SPP Service
          '0000e781-0000-1000-8000-00805f9b34fb'  // Common printing service
        ]
      });

      device.addEventListener('gattserverdisconnected', () => {
        setBluetoothDevice(null);
        setPrintCharacteristic(null);
        setPrinterStatus('Disconnected');
      });

      const server = await device.gatt.connect();

      let service;
      try {
        service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      } catch (err) {
        const services = await server.getPrimaryServices();
        if (services.length > 0) {
          service = services[0];
        } else {
          throw new Error('No Bluetooth services found on this printer.');
        }
      }

      const characteristics = await service.getCharacteristics();
      const writeChar = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);

      if (!writeChar) {
        throw new Error('No write characteristic found on this printer.');
      }

      setBluetoothDevice(device);
      setPrintCharacteristic(writeChar);
      setPrinterStatus(`Connected: ${device.name || 'Thermal Printer'}`);
      localStorage.setItem('printerMode', 'bluetooth');
      setPrinterMode('bluetooth');
    } catch (error) {
      console.error("Bluetooth printer connection failed:", error);
      setPrinterStatus('Disconnected');
      alert(`Connection failed: ${error.message || error}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectBluetoothPrinter = () => {
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
    }
    setBluetoothDevice(null);
    setPrintCharacteristic(null);
    setPrinterStatus('Disconnected');
  };

  const sendRawToPrinter = async (bytes) => {
    if (!printCharacteristic) return;
    const chunkSize = 20;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      try {
        if (printCharacteristic.properties.writeWithoutResponse) {
          await printCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await printCharacteristic.writeValue(chunk);
        }
        await new Promise(resolve => setTimeout(resolve, 15));
      } catch (err) {
        console.error("Failed to write chunk:", err);
      }
    }
  };

  const printTestPage = async () => {
    if (!printCharacteristic) return;
    const data = [
      ...init,
      ...center,
      ...boldOn,
      ...encoder.encode("MOMIN CHICKEN\n"),
      ...boldOff,
      ...encoder.encode("Bluetooth Direct Print\n"),
      ...encoder.encode("TEST SUCCESSFUL\n"),
      ...encoder.encode("--------------------------------\n"),
      ...left,
      ...encoder.encode("Date: " + new Date().toLocaleDateString() + "\n"),
      ...encoder.encode("Time: " + new Date().toLocaleTimeString() + "\n"),
      ...center,
      ...boldOn,
      ...encoder.encode("\nREADY TO PRINT BILLS!\n"),
      ...boldOff,
      ...encoder.encode("\n\n\n\n")
    ];
    await sendRawToPrinter(new Uint8Array(data));
  };

  const printReceiptBluetooth = async () => {
    if (!printCharacteristic) {
      alert("Bluetooth printer disconnected! Reconnecting...");
      return;
    }

    setIsBluetoothPrintJob(true);
    setIsPrintingReceipt(true);
    try {
      const data = [];
      data.push(...init);

      data.push(...center);
      data.push(...boldOn);
      data.push(...doubleSize);
      data.push(...encoder.encode(activeShop.shopName.toUpperCase() + "\n"));
      data.push(...normalSize);
      data.push(...boldOff);

      data.push(...encoder.encode(`Proprietor: ${activeShop.proprietorName}\n`));
      data.push(...encoder.encode(`${activeShop.address}\n`));
      data.push(...encoder.encode(`Phone: ${activeShop.phone}\n`));
      if (activeShop.gstin) {
        data.push(...encoder.encode(`GSTIN: ${activeShop.gstin}\n`));
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      data.push(...encoder.encode(`Date: ${dateStr}\n`));
      data.push(...encoder.encode("--------------------------------\n"));

      data.push(...left);
      data.push(...boldOn);
      data.push(...encoder.encode("Item             Qty      Amount\n"));
      data.push(...boldOff);
      data.push(...encoder.encode("--------------------------------\n"));

      cart.forEach(item => {
        const name = item.product.name;
        data.push(...encoder.encode(name + "\n"));

        const qtyDetail = `  ${item.quantity} ${item.product.unit} x ${item.product.rate}`;
        const amountStr = `₹${item.amount.toFixed(0)}`;

        const spacesCount = 32 - qtyDetail.length - amountStr.length;
        const spaces = spacesCount > 0 ? ' '.repeat(spacesCount) : ' ';
        data.push(...encoder.encode(qtyDetail + spaces + amountStr + "\n"));
      });

      data.push(...encoder.encode("--------------------------------\n"));

      data.push(...right);
      const subtotalStr = `Subtotal: ₹${subtotal.toFixed(0)}`;
      data.push(...encoder.encode(subtotalStr + "\n"));
      if (discount > 0) {
        const discStr = `Discount: -₹${discount.toFixed(0)}`;
        data.push(...encoder.encode(discStr + "\n"));
      }

      data.push(...boldOn);
      const totalStr = `TOTAL: ₹${total.toFixed(0)}`;
      data.push(...encoder.encode(totalStr + "\n"));
      data.push(...boldOff);

      if (paymentMethod) {
        data.push(...encoder.encode(`Payment Mode: ${paymentMethod.toUpperCase()}\n`));
      }
      data.push(...encoder.encode("--------------------------------\n"));

      data.push(...center);
      data.push(...boldOn);
      data.push(...encoder.encode("THANK YOU!\n"));
      data.push(...encoder.encode("VISIT AGAIN\n"));
      data.push(...boldOff);

      data.push(...feedLines);

      await sendRawToPrinter(new Uint8Array(data));
    } catch (err) {
      console.error("Failed to print via Bluetooth:", err);
      alert("Bluetooth printing failed. Falling back to system print.");
      window.print();
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  const handleReprint = (sale) => {
    if (printerMode === 'bluetooth' && printCharacteristic) {
      printPastReceiptBluetooth(sale);
    } else {
      setIsBluetoothPrintJob(false);
      setActivePrintSale(sale);
      setIsPrintingReceipt(true);
      setTimeout(() => {
        window.print();
        setActivePrintSale(null);
        setIsPrintingReceipt(false);
      }, 350);
    }
  };

  const printPastReceiptBluetooth = async (sale) => {
    if (!printCharacteristic) {
      alert("Bluetooth printer disconnected!");
      return;
    }

    setIsBluetoothPrintJob(true);
    setIsPrintingReceipt(true);
    try {
      const data = [];
      data.push(...init);

      data.push(...center);
      data.push(...boldOn);
      data.push(...doubleSize);
      data.push(...encoder.encode(activeShop.shopName.toUpperCase() + "\n"));
      data.push(...normalSize);
      data.push(...boldOff);

      data.push(...encoder.encode(`Proprietor: ${activeShop.proprietorName}\n`));
      data.push(...encoder.encode(`${activeShop.address}\n`));
      data.push(...encoder.encode(`Phone: ${activeShop.phone}\n`));
      if (activeShop.gstin) {
        data.push(...encoder.encode(`GSTIN: ${activeShop.gstin}\n`));
      }

      const saleDate = sale.timestamp ? sale.timestamp.toDate() : new Date();
      const dateStr = saleDate.toLocaleDateString() + " " + saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      data.push(...encoder.encode(`Date: ${dateStr} (REPRINT)\n`));
      data.push(...encoder.encode("--------------------------------\n"));

      data.push(...left);
      data.push(...boldOn);
      data.push(...encoder.encode("Item             Qty      Amount\n"));
      data.push(...boldOff);
      data.push(...encoder.encode("--------------------------------\n"));

      sale.items.forEach(item => {
        const name = item.productName;
        data.push(...encoder.encode(name + "\n"));

        const qtyDetail = `  ${item.quantity} ${item.unit || 'kg'} x ${item.rate}`;
        const amountStr = `₹${item.amount.toFixed(0)}`;

        const spacesCount = 32 - qtyDetail.length - amountStr.length;
        const spaces = spacesCount > 0 ? ' '.repeat(spacesCount) : ' ';
        data.push(...encoder.encode(qtyDetail + spaces + amountStr + "\n"));
      });

      data.push(...encoder.encode("--------------------------------\n"));

      data.push(...right);
      const subtotalStr = `Subtotal: ₹${sale.subtotal.toFixed(0)}`;
      data.push(...encoder.encode(subtotalStr + "\n"));
      if (sale.discount > 0) {
        const discStr = `Discount: -₹${sale.discount.toFixed(0)}`;
        data.push(...encoder.encode(discStr + "\n"));
      }

      data.push(...boldOn);
      const totalStr = `TOTAL: ₹${sale.total.toFixed(0)}`;
      data.push(...encoder.encode(totalStr + "\n"));
      data.push(...boldOff);

      if (sale.paymentMethod) {
        data.push(...encoder.encode(`Payment Mode: ${sale.paymentMethod.toUpperCase()}\n`));
      }
      data.push(...encoder.encode("--------------------------------\n"));

      data.push(...center);
      data.push(...boldOn);
      data.push(...encoder.encode("THANK YOU!\n"));
      data.push(...encoder.encode("VISIT AGAIN\n"));
      data.push(...boldOff);

      data.push(...feedLines);

      await sendRawToPrinter(new Uint8Array(data));
    } catch (err) {
      console.error("Failed to reprint via Bluetooth:", err);
      alert("Bluetooth printing failed.");
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  const handlePrint = () => {
    if (cart.length === 0) {
      alert("Cart is empty! Nothing to print.");
      return;
    }

    if (printerMode === 'bluetooth' && printCharacteristic) {
      printReceiptBluetooth();
    } else {
      // Optimized for mobile responsiveness:
      // Show loading spinner immediately so the UI doesn't feel laggy,
      // then trigger system print after a short delay so the DOM has time to update.
      setIsBluetoothPrintJob(false);
      setIsPrintingReceipt(true);
      setTimeout(() => {
        window.print();
        setIsPrintingReceipt(false);
      }, 350);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal - discount;

  const itemsPerPage = 10;
  const totalPages = Math.ceil(recentSales.length / itemsPerPage) || 1;
  const paginatedSales = recentSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const printItems = activePrintSale
    ? activePrintSale.items.map((item, idx) => ({
      id: idx,
      name: item.productName,
      rate: item.rate,
      unit: item.unit || 'kg',
      quantity: item.quantity,
      amount: item.amount
    }))
    : cart.map(item => ({
      id: item.id,
      name: item.product.name,
      rate: item.product.rate,
      unit: item.product.unit,
      quantity: item.quantity,
      amount: item.amount
    }));

  const printSubtotal = activePrintSale ? activePrintSale.subtotal : subtotal;
  const printDiscount = activePrintSale ? activePrintSale.discount : discount;
  const printTotal = activePrintSale ? activePrintSale.total : total;
  const printPaymentMethod = activePrintSale ? activePrintSale.paymentMethod : paymentMethod;
  const printDateStr = activePrintSale && activePrintSale.timestamp
    ? activePrintSale.timestamp.toDate().toLocaleDateString() + " " + activePrintSale.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
                className={`flex flex-col overflow-hidden rounded-2xl border-2 text-left transition-all ${selectedProduct?.id === product.id
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
                    step={selectedProduct.unit === 'kg' ? '0.01' : '1'}
                    autoFocus
                    value={inputWeight}
                    onChange={(e) => setInputWeight(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddToCart() }}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-4 px-4 text-2xl font-bold focus:ring-2 focus:ring-primary-500 transition-shadow"
                    placeholder={selectedProduct.unit === 'kg' ? '0.00' : '0'}
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
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setShowPrinterModal(true)}
                className="p-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/30 dark:hover:bg-sky-900/35 text-sky-600 dark:text-sky-400 flex items-center gap-1.5 transition-colors shadow-sm"
                title="Printer Settings"
              >
                <Printer className="w-4 h-4 text-sky-600 dark:text-sky-450" />
                <span className={`w-2 h-2 rounded-full ${printerMode === 'bluetooth' && printCharacteristic ? 'bg-emerald-500 animate-pulse' : printerMode === 'bluetooth' ? 'bg-amber-500' : 'bg-slate-350'}`}></span>
              </button>

              <button
                onClick={() => setShowPrinterInfo(!showPrinterInfo)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
                title="Status Indicator Guide"
              >
                <Info className="w-4 h-4" />
              </button>

              <button
                onClick={() => { setShowRecentBillsModal(true); setCurrentPage(1); }}
                className="p-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/35 text-indigo-600 dark:text-indigo-400 transition-colors shadow-sm"
                title="Recent Bills & Reprint"
              >
                <IndianRupee className="w-4 h-4" />
              </button>

              {showPrinterInfo && (
                <div className="absolute right-0 top-11 z-30 w-72 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2 text-xs">
                  <div className="flex justify-between items-center mb-2.5 font-extrabold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    <span>Printer Status Guide</span>
                    <button onClick={() => setShowPrinterInfo(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0 mt-0.5"></span>
                      <p className="text-slate-600 dark:text-slate-400 leading-tight">
                        <strong className="text-slate-800 dark:text-slate-200">Grey:</strong> System Print Mode (triggers the browser's default printing dialog).
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 mt-0.5 animate-pulse"></span>
                      <p className="text-slate-600 dark:text-slate-400 leading-tight">
                        <strong className="text-slate-800 dark:text-slate-200">Amber:</strong> Bluetooth Mode active, but the printer is currently disconnected.
                      </p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5 animate-pulse"></span>
                      <p className="text-slate-600 dark:text-slate-400 leading-tight">
                        <strong className="text-slate-800 dark:text-slate-200">Green:</strong> Bluetooth Printer is connected and fully ready for fast direct prints.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-400 py-1 px-3 rounded-full text-xs font-bold">
                {cart.length} items
              </span>
            </div>
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
          <p>Date: {printDateStr}</p>
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
            {printItems.map(item => (
              <tr key={item.id}>
                <td>
                  {item.name}
                  <div style={{ fontSize: '10px', color: '#555' }}>@ ₹{item.rate}/{item.unit}</div>
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
            <span>₹{printSubtotal.toFixed(2)}</span>
          </div>
          {printDiscount > 0 && (
            <div className="row">
              <span>Discount:</span>
              <span>-₹{printDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="row bold">
            <span>Total:</span>
            <span>₹{printTotal.toFixed(2)}</span>
          </div>
          {printPaymentMethod && (
            <div className="row" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed black' }}>
              <span>Payment Mode:</span>
              <span>{printPaymentMethod.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="receipt-footer">
          <p>Thank you!</p>
          <p>Visit Again</p>
        </div>
      </div>

      {/* Printing Status Spinner Overlay */}
      {isPrintingReceipt && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 max-w-xs w-full flex flex-col items-center text-center gap-4 shadow-2xl">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-primary-200 dark:border-slate-800 border-t-primary-600 animate-spin"></div>
              <Printer className="w-5 h-5 text-primary-600 absolute inset-0 m-auto animate-pulse" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-800 dark:text-white">Sending to Printer</h4>
              <p className="text-xs text-slate-400 mt-1">
                {isBluetoothPrintJob ? 'Sending ESC/POS command stream...' : 'Opening system print preview window...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thermal Printer Settings Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden shadow-2xl p-6 relative flex flex-col gap-6">

            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">Printer Configuration</h3>
                <p className="text-xs text-slate-500 mt-1">Configure hardware settings for ticket print speeds</p>
              </div>
              <button
                onClick={() => setShowPrinterModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-450 hover:text-slate-650"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Print Mode Selector */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Connection Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setPrinterMode('system');
                    localStorage.setItem('printerMode', 'system');
                  }}
                  className={`flex flex-col gap-2 p-4 rounded-2xl border-2 text-left transition-all ${printerMode === 'system'
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                      : 'border-slate-150 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                >
                  <Printer className={`w-5 h-5 ${printerMode === 'system' ? 'text-primary-600' : 'text-slate-450'}`} />
                  <div>
                    <span className="text-sm font-bold block leading-tight">System Print</span>
                    <span className="text-[10px] text-slate-450 mt-0.5 block">Standard browser print preview dialogue</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setPrinterMode('bluetooth');
                    localStorage.setItem('printerMode', 'bluetooth');
                  }}
                  className={`flex flex-col gap-2 p-4 rounded-2xl border-2 text-left transition-all ${printerMode === 'bluetooth'
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                      : 'border-slate-150 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                >
                  <Bluetooth className={`w-5 h-5 ${printerMode === 'bluetooth' ? 'text-primary-600' : 'text-slate-450'}`} />
                  <div>
                    <span className="text-sm font-bold block leading-tight">Direct BT Print</span>
                    <span className="text-[10px] text-slate-450 mt-0.5 block">Fast 1-click print directly to 58mm printer</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Bluetooth Specific Panel */}
            {printerMode === 'bluetooth' && (
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-800 p-4 rounded-2xl flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${printCharacteristic ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                      {printCharacteristic ? 'Printer Paired & Connected' : 'No Printer Connected'}
                    </span>
                  </div>
                  {printCharacteristic && (
                    <button
                      onClick={disconnectBluetoothPrinter}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {printCharacteristic ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Connected to <strong>{bluetoothDevice?.name || 'MTP-II / POS-58'}</strong>. Direct print mode is active and running.
                    </p>
                    <button
                      onClick={printTestPage}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Print Test Receipt
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Ensure your thermal printer is turned on, Bluetooth is enabled on this device, and the printer is paired.
                    </p>
                    <button
                      onClick={connectBluetoothPrinter}
                      disabled={isConnecting}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-500 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-primary-600/20"
                    >
                      {isConnecting ? 'Searching Devices...' : 'Scan & Pair Printer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Support Alert for Web Bluetooth */}
            {printerMode === 'bluetooth' && typeof navigator !== 'undefined' && !navigator.bluetooth && (
              <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-150 p-3.5 rounded-xl flex gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[10px] text-rose-700 dark:text-rose-400 leading-normal">
                  Web Bluetooth is unsupported on this browser. For Android/PC, please use Google Chrome. For iOS/iPhone, print via the Bluefy BLE browser from the App Store.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => setShowPrinterModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-xl text-xs font-bold transition-colors"
              >
                Close Settings
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Recent Bills Modal */}
      {showRecentBillsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden shadow-2xl p-6 relative flex flex-col gap-4">

            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary-500" />
                  Recent Bills
                </h3>
                <p className="text-xs text-slate-500 mt-1">Reprint any transactions of the day (10 per page)</p>
              </div>
              <button
                onClick={() => setShowRecentBillsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-655"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[300px]">
              {paginatedSales.length > 0 ? (
                paginatedSales.map((sale) => {
                  const saleDate = sale.timestamp ? sale.timestamp.toDate() : new Date();
                  const timeStr = saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={sale.id}
                      className="border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-855/30 p-3 rounded-2xl flex flex-col gap-2 hover:border-primary-300 dark:hover:border-primary-900 transition-colors text-left"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-850 dark:text-slate-200 text-sm">{timeStr}</span>
                          <span className="text-[10px] text-slate-450 ml-2 font-medium">by {sale.workerName || 'Staff'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${sale.paymentMethod === 'cash'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400'
                            }`}>
                            {sale.paymentMethod || 'cash'}
                          </span>
                          <span className="font-black text-slate-800 dark:text-slate-105 text-base">₹{sale.total?.toFixed(0)}</span>
                        </div>
                      </div>

                      {/* Item list detail */}
                      <div className="text-[10px] text-slate-500 leading-normal border-t border-slate-100 dark:border-slate-800/80 pt-1.5 flex justify-between items-center gap-4">
                        <span className="truncate flex-1 font-medium">
                          {sale.items?.map(i => `${i.productName} (${i.quantity} ${i.unit || 'kg'})`).join(', ') || 'N/A'}
                        </span>

                        <button
                          onClick={() => {
                            handleReprint(sale);
                          }}
                          className="flex items-center gap-1 py-1 px-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-[10px] font-bold transition-all shrink-0 shadow-sm"
                        >
                          <Printer className="w-3 h-3" />
                          Reprint
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No recent bills found.
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-350 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors"
                >
                  Previous
                </button>
                <span className="text-slate-500 dark:text-slate-400 font-semibold">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-350 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-colors"
                >
                  Next
                </button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowRecentBillsModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-350 rounded-xl text-xs font-bold transition-colors"
              >
                Close Window
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
