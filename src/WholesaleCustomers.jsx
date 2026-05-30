import React, { useState, useEffect, useRef } from 'react';
import { Search, Save, CheckCircle2, UserPlus, MapPin, Compass, Phone, Loader2, Navigation, Trash2, Map, List, ChevronDown, X } from 'lucide-react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, runTransaction } from 'firebase/firestore';

// Each area: { name, type }
// Types: 'Residential', 'Commercial', 'Market', 'Industrial', 'Mixed'
const LOCATION_DATA = {
  'Maharashtra': {
    'Mumbai': [
      // South Mumbai
      { name: 'Colaba', type: 'Commercial' },
      { name: 'Churchgate', type: 'Commercial' },
      { name: 'Fort', type: 'Commercial' },
      { name: 'Nariman Point', type: 'Commercial' },
      { name: 'Cuffe Parade', type: 'Residential' },
      { name: 'Marine Lines', type: 'Mixed' },
      { name: 'Grant Road', type: 'Market' },
      { name: 'Byculla', type: 'Market' },
      { name: 'Mazagaon', type: 'Industrial' },
      { name: 'Reay Road', type: 'Industrial' },
      { name: 'Chinchpokli', type: 'Mixed' },
      { name: 'Parel', type: 'Industrial' },
      { name: 'Lower Parel', type: 'Commercial' },
      { name: 'Sewri', type: 'Industrial' },
      { name: 'Matunga', type: 'Residential' },
      { name: 'Mahim', type: 'Mixed' },
      { name: 'Dadar East', type: 'Market' },
      { name: 'Dadar West', type: 'Residential' },
      { name: 'Worli', type: 'Mixed' },
      { name: 'Prabhadevi', type: 'Residential' },
      { name: 'Elphinstone Road', type: 'Commercial' },
      { name: 'Currey Road', type: 'Mixed' },
      // Central Mumbai
      { name: 'Dharavi', type: 'Market' },
      { name: 'Sion', type: 'Mixed' },
      { name: 'Wadala', type: 'Industrial' },
      { name: 'King Circle', type: 'Commercial' },
      { name: 'Cotton Green', type: 'Industrial' },
      // Western Line
      { name: 'Bandra West', type: 'Residential' },
      { name: 'Bandra East', type: 'Commercial' },
      { name: 'Santacruz West', type: 'Residential' },
      { name: 'Santacruz East', type: 'Residential' },
      { name: 'Vile Parle West', type: 'Residential' },
      { name: 'Vile Parle East', type: 'Residential' },
      { name: 'Andheri West', type: 'Mixed' },
      { name: 'Andheri East', type: 'Commercial' },
      { name: 'Jogeshwari West', type: 'Residential' },
      { name: 'Jogeshwari East', type: 'Mixed' },
      { name: 'Goregaon West', type: 'Residential' },
      { name: 'Goregaon East', type: 'Commercial' },
      { name: 'Malad West', type: 'Residential' },
      { name: 'Malad East', type: 'Mixed' },
      { name: 'Kandivali West', type: 'Residential' },
      { name: 'Kandivali East', type: 'Mixed' },
      { name: 'Borivali West', type: 'Residential' },
      { name: 'Borivali East', type: 'Mixed' },
      { name: 'Dahisar', type: 'Residential' },
      { name: 'Juhu', type: 'Residential' },
      { name: 'Versova', type: 'Residential' },
      { name: 'Oshiwara', type: 'Commercial' },
      { name: 'JVLR (JP Road)', type: 'Commercial' },
      { name: 'Link Road (Andheri)', type: 'Commercial' },
      { name: 'Seven Bungalows', type: 'Residential' },
      { name: 'Lokhandwala', type: 'Commercial' },
      { name: 'Powai', type: 'Mixed' },
      { name: 'Hiranandani Estate', type: 'Residential' },
      // Harbour Line
      { name: 'Kurla West', type: 'Market' },
      { name: 'Kurla East', type: 'Market' },
      { name: 'Vidyavihar', type: 'Residential' },
      { name: 'Ghatkopar West', type: 'Market' },
      { name: 'Ghatkopar East', type: 'Residential' },
      { name: 'Vikhroli West', type: 'Mixed' },
      { name: 'Vikhroli East', type: 'Industrial' },
      { name: 'Kanjurmarg', type: 'Mixed' },
      { name: 'Bhandup West', type: 'Residential' },
      { name: 'Bhandup East', type: 'Industrial' },
      { name: 'Nahur', type: 'Residential' },
      { name: 'Mulund West', type: 'Residential' },
      { name: 'Mulund East', type: 'Residential' },
      // Harbour (East) Line
      { name: 'Chembur', type: 'Residential' },
      { name: 'Govandi', type: 'Residential' },
      { name: 'Mankhurd', type: 'Mixed' },
      { name: 'Trombay', type: 'Industrial' },
      { name: 'Deonar', type: 'Industrial' },
      { name: 'Chunabhatti', type: 'Market' },
      { name: 'GTB Nagar', type: 'Residential' },
      { name: 'Tilak Nagar', type: 'Residential' },
      { name: 'Chembur East', type: 'Commercial' },
      // Navi Mumbai (commonly served)
      { name: 'Vashi', type: 'Commercial' },
      { name: 'Nerul', type: 'Residential' },
      { name: 'Turbhe', type: 'Industrial' },
      { name: 'Kopar Khairane', type: 'Residential' },
      { name: 'Airoli', type: 'Mixed' },
      { name: 'Ghansoli', type: 'Residential' },
      { name: 'Rabale', type: 'Industrial' },
      { name: 'Belapur', type: 'Commercial' },
      { name: 'Kharghar', type: 'Residential' },
      { name: 'Panvel', type: 'Market' },
    ],
    'Pune': [
      { name: 'Kothrud', type: 'Residential' },
      { name: 'Hadapsar', type: 'Commercial' },
      { name: 'Deccan Gymkhana', type: 'Commercial' },
      { name: 'Shivajinagar', type: 'Commercial' },
      { name: 'Baner', type: 'Mixed' },
      { name: 'Aundh', type: 'Residential' },
      { name: 'Wakad', type: 'Residential' },
      { name: 'Pimple Saudagar', type: 'Residential' },
      { name: 'Viman Nagar', type: 'Residential' },
      { name: 'Kalyani Nagar', type: 'Residential' },
      { name: 'PCMC', type: 'Industrial' },
      { name: 'Chinchwad', type: 'Industrial' },
    ],
    'Nagpur': [
      { name: 'Lakshmi Nagar', type: 'Residential' },
      { name: 'Dhantoli', type: 'Commercial' },
      { name: 'Sitabuldi', type: 'Market' },
      { name: 'Itwari', type: 'Market' },
      { name: 'Sadar', type: 'Commercial' },
    ],
    'Thane': [
      { name: 'Thane West', type: 'Residential' },
      { name: 'Kalyan', type: 'Market' },
      { name: 'Dombivli', type: 'Residential' },
      { name: 'Bhiwandi', type: 'Industrial' },
      { name: 'Ambernath', type: 'Industrial' },
    ],
    'Nashik': [
      { name: 'Gangapur Road', type: 'Residential' },
      { name: 'Deolali', type: 'Mixed' },
      { name: 'Satpur', type: 'Industrial' },
      { name: 'Malegaon', type: 'Market' },
    ],
  },
  'Gujarat': {
    'Surat': [
      { name: 'Varachha', type: 'Market' },
      { name: 'Rander', type: 'Residential' },
      { name: 'Adajan', type: 'Residential' },
      { name: 'Katargam', type: 'Industrial' },
      { name: 'Udhna', type: 'Industrial' },
      { name: 'Piplod', type: 'Residential' },
    ],
    'Ahmedabad': [
      { name: 'Navrangpura', type: 'Commercial' },
      { name: 'Satellite', type: 'Residential' },
      { name: 'Maninagar', type: 'Market' },
      { name: 'Gota', type: 'Residential' },
      { name: 'Bopal', type: 'Residential' },
      { name: 'Chandkheda', type: 'Residential' },
    ],
    'Vadodara': [
      { name: 'Alkapuri', type: 'Commercial' },
      { name: 'Makarpura', type: 'Industrial' },
      { name: 'Manjalpur', type: 'Residential' },
    ],
    'Rajkot': [
      { name: 'Kalawad Road', type: 'Residential' },
      { name: 'Raiya Road', type: 'Residential' },
      { name: 'Gondal Road', type: 'Commercial' },
    ],
  },
  'Karnataka': {
    'Bengaluru': [
      { name: 'Majestic', type: 'Commercial' },
      { name: 'Indiranagar', type: 'Residential' },
      { name: 'Whitefield', type: 'Commercial' },
      { name: 'Jayanagar', type: 'Residential' },
      { name: 'Koramangala', type: 'Mixed' },
      { name: 'Electronic City', type: 'Commercial' },
      { name: 'Marathahalli', type: 'Mixed' },
      { name: 'HSR Layout', type: 'Residential' },
      { name: 'BTM Layout', type: 'Residential' },
      { name: 'Yeshwanthpur', type: 'Industrial' },
    ],
    'Mangaluru': [
      { name: 'Hampankatta', type: 'Commercial' },
      { name: 'Kulshekar', type: 'Residential' },
      { name: 'Bajal', type: 'Market' },
    ],
    'Mysore': [
      { name: 'Vijayanagar', type: 'Residential' },
      { name: 'Gokulam', type: 'Residential' },
      { name: 'Kuvempunagar', type: 'Commercial' },
    ],
    'Hubli': [
      { name: 'Navanagar', type: 'Residential' },
      { name: 'Gokul Road', type: 'Commercial' },
    ],
  },
};

const TYPE_COLORS = {
  'Commercial': 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  'Residential': 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  'Market': 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  'Industrial': 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  'Mixed': 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
};

// Searchable Area Dropdown component
function AreaDropdown({ areas, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);
  const searchRef = useRef(null);

  const selectedArea = areas.find(a => a.name === value);

  const filtered = areas.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.type.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(''); }}
        className="w-full flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold text-left transition-colors hover:border-emerald-400"
      >
        <span className="flex items-center gap-2 truncate">
          {selectedArea ? (
            <>
              <span className="truncate">{selectedArea.name}</span>
              <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${TYPE_COLORS[selectedArea.type]}`}>
                {selectedArea.type}
              </span>
            </>
          ) : (
            <span className="text-slate-400">Select area...</span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Search bar inside dropdown */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search area or type..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-medium"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>
          </div>

          {/* Count */}
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 border-b border-slate-50 dark:border-slate-800">
            {filtered.length} area{filtered.length !== 1 ? 's' : ''} found
          </div>

          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length > 0 ? filtered.map(area => (
              <button
                key={area.name}
                type="button"
                onClick={() => { onChange(area.name); setOpen(false); setSearch(''); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors ${area.name === value ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
              >
                <span className={`text-xs font-semibold ${area.name === value ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {area.name}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${TYPE_COLORS[area.type]}`}>
                  {area.type}
                </span>
              </button>
            )) : (
              <div className="p-4 text-center text-xs text-slate-400">No matching areas found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WholesaleCustomers() {
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'area'

  const getFirstArea = (state, city) => {
    const areas = LOCATION_DATA[state]?.[city] || [];
    return areas[0]?.name || '';
  };

  const [formData, setFormData] = useState({
    shopName: '',
    proprietorName: '',
    phone: '',
    state: 'Maharashtra',
    city: 'Mumbai',
    area: getFirstArea('Maharashtra', 'Mumbai'),
    rateOffset: '0',
    location: null
  });

  // Fetch customers
  useEffect(() => {
    const q = query(collection(db, 'wholesale_customers'), orderBy('shopName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setCustomers(data);
    });
    return unsubscribe;
  }, []);

  const handleStateChange = (stateVal) => {
    const cities = Object.keys(LOCATION_DATA[stateVal] || {});
    const firstCity = cities[0] || '';
    const firstArea = getFirstArea(stateVal, firstCity);
    setFormData(prev => ({ ...prev, state: stateVal, city: firstCity, area: firstArea }));
  };

  const handleCityChange = (cityVal) => {
    const firstArea = getFirstArea(formData.state, cityVal);
    setFormData(prev => ({ ...prev, city: cityVal, area: firstArea }));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) { alert("Geolocation is not supported by your browser"); return; }
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          location: { lat: position.coords.latitude, lng: position.coords.longitude }
        }));
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Failed to get location. Please enable GPS permissions.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.shopName || !formData.phone || !formData.area) {
      alert("Please fill in Shop Name, Phone, and Area");
      return;
    }
    setIsSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        // Reference to the global counter
        const counterRef = doc(db, 'counters', 'wholesale_customer_id');
        const counterDoc = await transaction.get(counterRef);
        
        let nextVal = 1000; // Starting value if no counter exists
        if (counterDoc.exists() && counterDoc.data().currentValue) {
          nextVal = counterDoc.data().currentValue + 1;
        }
        
        // Update the counter
        transaction.set(counterRef, { currentValue: nextVal }, { merge: true });

        // Prepare the new customer document
        const newCustomerRef = doc(collection(db, 'wholesale_customers'));
        const payload = {
          shopName: formData.shopName.trim(),
          proprietorName: formData.proprietorName.trim(),
          phone: formData.phone.trim(),
          state: formData.state,
          city: formData.city,
          area: formData.area,
          route: formData.area,
          rateOffset: parseFloat(formData.rateOffset) || 0,
          location: formData.location,
          createdAt: new Date().toISOString(),
          uniqueId: `CV-${nextVal}`
        };
        
        // Save the customer
        transaction.set(newCustomerRef, payload);
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setFormData({
          shopName: '', proprietorName: '', phone: '',
          state: 'Maharashtra', city: 'Mumbai',
          area: getFirstArea('Maharashtra', 'Mumbai'),
          rateOffset: '0', location: null
        });
      }, 2000);
    } catch (error) {
      console.error("Error adding customer:", error);
      alert("Failed to save customer details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this customer?")) {
      try {
        await deleteDoc(doc(db, 'wholesale_customers', id));
      } catch (err) {
        console.error("Error deleting customer:", err);
      }
    }
  };

  // Group by Area (use area field, fallback to route for old records)
  const groupedByArea = customers.reduce((acc, curr) => {
    const area = curr.area || curr.route || 'Unassigned';
    if (!acc[area]) acc[area] = [];
    acc[area].push(curr);
    return acc;
  }, {});

  const filteredCustomers = customers.filter(c =>
    c.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.proprietorName && c.proprietorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.area || c.route || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.city && c.city.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const currentAreas = LOCATION_DATA[formData.state]?.[formData.city] || [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-left">
          <h2 className="text-2xl font-bold tracking-tight">Wholesale Customers Directory</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage B2B merchant profiles, set specific pricing offsets, and pin coordinates.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Register New Client */}
        <div className="glass-panel p-6 rounded-2xl bg-white dark:bg-slate-900/50 relative overflow-hidden h-fit">
          {showSuccess && (
            <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm z-15 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2" />
              <h3 className="font-bold text-slate-800 dark:text-white">Customer Profile Saved!</h3>
              <p className="text-xs text-slate-500 mt-1">Added to directory.</p>
            </div>
          )}

          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-left">
            <UserPlus className="w-5 h-5 text-emerald-500" />
            Add Wholesale Merchant
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Shop / Firm Name</label>
              <input
                type="text" required
                value={formData.shopName}
                onChange={e => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                placeholder="e.g. Al-Hamd Caterers"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Proprietor Name</label>
              <input
                type="text"
                value={formData.proprietorName}
                onChange={e => setFormData({ ...formData, proprietorName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold"
                placeholder="Owner's Name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Phone</label>
              <input
                type="text" required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-semibold font-mono"
                placeholder="98xxxxxx"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">State</label>
                <select
                  value={formData.state}
                  onChange={e => handleStateChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                >
                  {Object.keys(LOCATION_DATA).map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">City</label>
                <select
                  value={formData.city}
                  onChange={e => handleCityChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold"
                >
                  {Object.keys(LOCATION_DATA[formData.state] || {}).map(ct => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Area</span>
                  <span className="text-[10px] normal-case font-medium text-slate-400">{currentAreas.length} areas available</span>
                </label>
                <AreaDropdown
                  areas={currentAreas}
                  value={formData.area}
                  onChange={(val) => setFormData({ ...formData, area: val })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Rate Offset (₹ per kg/pc)</label>
              <input
                type="number" step="0.1"
                value={formData.rateOffset}
                onChange={e => setFormData({ ...formData, rateOffset: e.target.value })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold text-emerald-600 dark:text-emerald-400"
                placeholder="e.g. -2 for ₹2 discount"
              />
              <span className="text-[10px] text-slate-400 block font-medium mt-1">Set negative for discount, positive for premium.</span>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">GPS Coordinates Pinning</label>
              <button
                type="button" onClick={handleGetLocation} disabled={isGettingLocation}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-colors disabled:opacity-50"
              >
                {isGettingLocation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <Compass className="w-3.5 h-3.5 text-emerald-600" />
                )}
                {formData.location ? "Repin GPS Location" : "Pin Current GPS Location"}
              </button>

              {formData.location && (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Lat: {formData.location.lat.toFixed(5)}, Lng: {formData.location.lng.toFixed(5)}</span>
                </div>
              )}
            </div>

            <button
              type="submit" disabled={isSaving}
              className="w-full flex items-center justify-center gap-1.5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md cursor-pointer transform active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Merchant Profile
            </button>
          </form>
        </div>

        {/* Right Column: Directory List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-left">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by shop, proprietor or area..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-semibold"
              />
            </div>

            <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl shrink-0 gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <List className="w-3.5 h-3.5" /> List view
              </button>
              <button
                onClick={() => setViewMode('area')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'area'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Map className="w-3.5 h-3.5" /> Area view
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/50 shadow-md">

            {viewMode === 'list' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold text-xs">
                      <th className="p-4 uppercase tracking-wider">Merchant Profile</th>
                      <th className="p-4 uppercase tracking-wider">Contact & Area</th>
                      <th className="p-4 uppercase tracking-wider text-right">Pricing Offset</th>
                      <th className="p-4 uppercase tracking-wider text-center">GPS</th>
                      <th className="p-4 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map(customer => (
                        <tr key={customer.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                          <td className="p-4 text-left">
                            <span className="block font-bold text-slate-800 dark:text-white text-base leading-tight">{customer.shopName}</span>
                            <span className="block text-xs text-slate-400 mt-1">Proprietor: {customer.proprietorName || 'N/A'}</span>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{customer.uniqueId || 'Legacy ID'}</span>
                              <span className="text-[10px] text-slate-400">Joined: {new Date(customer.createdAt).toLocaleDateString('en-GB')}</span>
                            </div>
                          </td>
                          <td className="p-4 text-left">
                            <span className="block font-medium text-xs flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {customer.phone}
                            </span>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <span className="text-[9px] text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-full uppercase tracking-wide">{customer.city || 'Mumbai'}</span>
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full uppercase tracking-wide">{customer.area || customer.route}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-black">
                            <span className={customer.rateOffset < 0 ? 'text-green-600' : customer.rateOffset > 0 ? 'text-red-500' : 'text-slate-500'}>
                              {customer.rateOffset === 0 ? 'Base Rate' : `₹${customer.rateOffset > 0 ? '+' : ''}${customer.rateOffset}/kg`}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {customer.location ? (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${customer.location.lat},${customer.location.lng}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl text-xs font-black transition-colors"
                              >
                                <Navigation className="w-3.5 h-3.5 fill-emerald-600" /> Navigate
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 italic font-medium">No GPS</span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-400">No merchants registered under directory.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {Object.keys(groupedByArea).length > 0 ? (
                  Object.keys(groupedByArea).map(areaName => (
                    <div key={areaName} className="space-y-2 text-left">
                      <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        📍 {areaName} ({groupedByArea[areaName].length} customers)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {groupedByArea[areaName].map(cust => (
                          <div key={cust.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-850/10 flex justify-between items-center group">
                            <div className="text-left">
                              <span className="block font-bold text-slate-800 dark:text-white leading-tight">{cust.shopName}</span>
                              <span className="block text-[11px] text-slate-400 mt-1">{cust.city || 'Mumbai'} | {cust.phone}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {cust.location && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${cust.location.lat},${cust.location.lng}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-all"
                                  title="Navigate via Google Maps"
                                >
                                  <Navigation className="w-4 h-4 fill-emerald-600" />
                                </a>
                              )}
                              <button
                                onClick={() => handleDelete(cust.id)}
                                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-8">No merchants registered under directory.</div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
