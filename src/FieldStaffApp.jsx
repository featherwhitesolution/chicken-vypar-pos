import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import {
  Play,
  Square,
  MapPin,
  Battery,
  Wifi,
  WifiOff,
  LogOut,
  Search,
  CheckCircle,
  IndianRupee,
  ClipboardList,
  Clock,
  ChevronRight,
  AlertTriangle,
  Check,
  Loader2,
  Phone,
  User,
  Map,
  X
} from 'lucide-react';

export default function FieldStaffApp({ user, onLogout }) {
  const [staffData, setStaffData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState('routes'); // 'routes' or 'timeline'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  
  // Shift state
  const [isShiftActive, setIsShiftActive] = useState(() => {
    return localStorage.getItem(`shift_active_${user.docId}`) === 'true';
  });

  // Check-in timer states
  const [checkedInShop, setCheckedInShop] = useState(null);
  const [checkedInTime, setCheckedInTime] = useState(0); // in seconds

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectNotes, setCollectNotes] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Map preview state (simple mock display since it's mobile and maps are heavy)
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);

  // Real connectivity state — navigator.onLine is unreliable on mobile
  // We do an actual fetch ping instead
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const checkRealConnectivity = async () => {
    // First fast check: if browser says offline, trust it immediately
    if (!navigator.onLine) {
      setIsOnline(false);
      return;
    }
    // Otherwise, do a real network request to confirm actual internet access
    try {
      await fetch(`https://www.googleapis.com/generate_204?_=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000) // 5s timeout
      });
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  };

  const trackingIntervalRef = useRef(null);
  const connectivityIntervalRef = useRef(null);

  // 1. Fetch real-time staff document for sync (routeHistory, status)
  useEffect(() => {
    const fetchStaff = async () => {
      const { data, error } = await supabase
        .from('field_staff')
        .select('*')
        .eq('id', user.docId)
        .single();
      if (!error && data) {
        setStaffData({
          docId: data.id,
          staffId: data.staff_id,
          name: data.name,
          phone: data.phone,
          passcode: data.passcode,
          status: data.status,
          subscriptionPlan: data.subscription_plan,
          registeredAt: data.registered_at,
          subscriptionStartedAt: data.subscription_started_at,
          subscriptionExpiredAt: data.subscription_expired_at,
          assignedWholesalerId: data.assigned_wholesaler_id,
          assignedWholesalerName: data.assigned_wholesaler_name,
          lastLocation: {
            lat: Number(data.last_location_lat || 19.0413),
            lng: Number(data.last_location_lng || 72.8431),
            timestamp: data.last_location_time
          },
          lastActive: data.last_active,
          batteryPercentage: data.battery_percentage,
          batteryCharging: data.battery_charging,
          networkStatus: data.network_status,
          routeHistory: typeof data.route_history === 'string' ? JSON.parse(data.route_history) : (data.route_history || []),
          currentShopId: data.current_shop_id,
          currentShopName: data.current_shop_name,
          minutesSpentAtCurrentShop: data.minutes_spent_at_current_shop
        });
      }
    };

    fetchStaff();

    const channel = supabase
      .channel(`field-staff-${user.docId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'field_staff', filter: `id=eq.${user.docId}` }, fetchStaff)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.docId]);

  // 1b. Real connectivity monitor — checks every 15s and on network events
  useEffect(() => {
    checkRealConnectivity(); // initial check
    connectivityIntervalRef.current = setInterval(checkRealConnectivity, 15000);

    const handleOnline = () => checkRealConnectivity(); // verify before marking online
    const handleOffline = () => setIsOnline(false);     // trust offline immediately
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(connectivityIntervalRef.current);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Fetch real-time wholesaler customers
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('wholesale_customers')
        .select('*')
        .order('shop_name', { ascending: true });
      if (!error && data) {
        setCustomers(data.map(row => ({
          id: row.id,
          uniqueId: row.unique_id,
          shopName: row.shop_name,
          proprietorName: row.proprietor_name,
          phone: row.phone,
          outstandingBalance: row.outstanding_balance,
          route: row.route,
          area: row.area,
          address: row.address,
          location: row.location_lat && row.location_lng ? { lat: Number(row.location_lat), lng: Number(row.location_lng) } : null
        })));
      }
      setIsLoadingCustomers(false);
    };

    fetchCustomers();

    const channel = supabase
      .channel('field-staff-customers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_customers' }, fetchCustomers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Keep track of check-in session and resume if page is reloaded
  useEffect(() => {
    if (staffData && customers.length > 0) {
      if (staffData.currentShopId) {
        const activeShop = customers.find(c => c.id === staffData.currentShopId);
        if (activeShop) {
          setCheckedInShop(activeShop);
          // Calculate elapsed time from the last Checked-in routeHistory log
          const history = staffData.routeHistory || [];
          const checkInLog = [...history]
            .reverse()
            .find(h => h.action && h.action.includes('Checked-in at') && h.action.includes(activeShop.shopName));
          
          if (checkInLog && checkInLog.timestamp) {
            const checkInDate = new Date(checkInLog.timestamp);
            const elapsed = Math.max(0, Math.floor((new Date() - checkInDate) / 1000));
            setCheckedInTime(elapsed);
          }
        }
      } else {
        setCheckedInShop(null);
        setCheckedInTime(0);
      }
    }
  }, [staffData, customers]);

  // 4. Live UI Check-in Timer
  useEffect(() => {
    let timer;
    if (checkedInShop && isShiftActive) {
      timer = setInterval(() => {
        setCheckedInTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [checkedInShop, isShiftActive]);

  // 5. Update Firestore minutes spent at current shop every 60s
  useEffect(() => {
    if (checkedInShop && isShiftActive && checkedInTime > 0 && checkedInTime % 60 === 0) {
      const minutes = Math.floor(checkedInTime / 60);
      supabase
        .from('field_staff')
        .update({
          minutes_spent_at_current_shop: minutes,
          last_active: new Date().toISOString()
        })
        .eq('id', user.docId)
        .then(({ error }) => {
          if (error) console.error("Error updating minutes:", error);
        });
    }
  }, [checkedInTime, checkedInShop, isShiftActive]);

  // 6. Primary Geolocation and Battery Streaming Telemetry Loop
  const performTelemetryUpdate = async (customAction = null) => {
    if (!isShiftActive && !customAction) return;

    let lat = staffData?.lastLocation?.lat || 19.0413;
    let lng = staffData?.lastLocation?.lng || 72.8431;
    let locationSource = 'Fallback';

    // 6a. Try getting real-time GPS coordinates
    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        locationSource = 'GPS';
        setGpsAccuracy(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null);
      }
    } catch (err) {
      console.warn("GPS telemetry failed: ", err.message);
      setGpsAccuracy(null);
      // Failover to active check-in shop location
      if (checkedInShop && checkedInShop.location) {
        lat = checkedInShop.location.lat;
        lng = checkedInShop.location.lng;
        locationSource = 'Shop Location';
      } else {
        // Fallback to center with minor jitter to indicate activity on the tracking panel
        lat = 19.0413 + (Math.random() - 0.5) * 0.002;
        lng = 72.8431 + (Math.random() - 0.5) * 0.002;
        locationSource = 'Mock Telemetry';
      }
    }

    // 6b. Try getting device battery stats
    // Note: Battery Status API is not supported on iOS Safari (removed for privacy)
    let batteryPercentage = null; // null = unavailable, not a fake value
    let batteryCharging = false;
    try {
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        const level = Math.round(battery.level * 100);
        // Sanity check: getBattery sometimes returns 100 even on iOS when unsupported
        if (level > 0 && level <= 100) {
          batteryPercentage = level;
          batteryCharging = battery.charging;
        }
      }
    } catch (err) {
      console.warn("Battery API not supported:", err);
    }

    // 6c. Get Network status
    const networkStatus = isOnline ? 'online' : 'offline';
    const timestamp = new Date().toISOString();

    // 6d. Update Firestore Staff telemetry
    try {
      const { data: staff, error: fetchErr } = await supabase
        .from('field_staff')
        .select('route_history')
        .eq('id', user.docId)
        .single();
      
      if (!fetchErr && staff) {
        let currentHistory = typeof staff.route_history === 'string' ? JSON.parse(staff.route_history) : (staff.route_history || []);
        
        const telemetryLog = {
          lat,
          lng,
          timestamp,
          battery: batteryPercentage,
          network: networkStatus,
          action: customAction || `Location updated via ${locationSource}`
        };

        if (batteryPercentage !== null && batteryPercentage <= 15) {
          telemetryLog.action = `🚨 CRITICAL BATTERY ALERT: ${batteryPercentage}% - Location via ${locationSource}`;
        }

        await supabase
          .from('field_staff')
          .update({
            last_location_lat: lat,
            last_location_lng: lng,
            last_location_time: timestamp,
            last_active: timestamp,
            battery_percentage: batteryPercentage,
            battery_charging: batteryCharging,
            network_status: networkStatus,
            route_history: [...currentHistory, telemetryLog]
          })
          .eq('id', user.docId);
      }
    } catch (err) {
      console.error("Supabase telemetry save failed:", err);
    }
  };

  // 7. Telemetry Loop hook
  useEffect(() => {
    if (isShiftActive) {
      // Periodic telemetry updates every 30 seconds
      trackingIntervalRef.current = setInterval(() => {
        performTelemetryUpdate();
      }, 30000);
    } else {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
    }
    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, [isShiftActive, checkedInShop, staffData?.batteryPercentage]);

  // 8. Start Shift Toggle
  const handleStartShift = async () => {
    setGpsLoading(true);
    let initialLat = 19.0413;
    let initialLng = 72.8431;
    let batteryPercentage = null; // null = unavailable
    let batteryCharging = false;

    // Trigger explicit GPS permissions dialog on start shift
    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });
        initialLat = pos.coords.latitude;
        initialLng = pos.coords.longitude;
        setGpsAccuracy(pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null);
      }
    } catch (err) {
      alert("GPS request failed or timed out. Please ensure Location services/permissions are enabled on your device.");
    } finally {
      setGpsLoading(false);
    }

    try {
      if (navigator.getBattery) {
        const battery = await navigator.getBattery();
        const level = Math.round(battery.level * 100);
        if (level > 0 && level <= 100) {
          batteryPercentage = level;
          batteryCharging = battery.charging;
        }
      }
    } catch (e) {
      console.warn('Battery API unavailable:', e);
    }

    const timestamp = new Date().toISOString();
    const networkStatus = isOnline ? 'online' : 'offline';

    try {
      const { data: staff } = await supabase
        .from('field_staff')
        .select('route_history')
        .eq('id', user.docId)
        .single();
      const currentHistory = staff ? (typeof staff.route_history === 'string' ? JSON.parse(staff.route_history) : (staff.route_history || [])) : [];

      await supabase
        .from('field_staff')
        .update({
          last_location_lat: initialLat,
          last_location_lng: initialLng,
          last_location_time: timestamp,
          last_active: timestamp,
          battery_percentage: batteryPercentage,
          battery_charging: batteryCharging,
          network_status: networkStatus,
          route_history: [
            ...currentHistory,
            {
              lat: initialLat,
              lng: initialLng,
              timestamp,
              battery: batteryPercentage,
              network: networkStatus,
              action: "🏁 Shift Started"
            }
          ]
        })
        .eq('id', user.docId);

      setIsShiftActive(true);
      localStorage.setItem(`shift_active_${user.docId}`, 'true');
    } catch (err) {
      console.error(err);
      alert("Failed to start shift in database. Try again.");
    }
  };

  // 9. End Shift Toggle
  const handleEndShift = async () => {
    if (checkedInShop) {
      const confirmCheckOut = window.confirm(`You are currently checked in at ${checkedInShop.shopName}. Checkout and end shift?`);
      if (!confirmCheckOut) return;
      await handleCheckOut(checkedInShop);
    }

    let lat = staffData?.lastLocation?.lat || 19.0413;
    let lng = staffData?.lastLocation?.lng || 72.8431;
    let batteryPercentage = staffData?.batteryPercentage || 100;
    let batteryCharging = staffData?.batteryCharging || false;

    const timestamp = new Date().toISOString();
    const networkStatus = isOnline ? 'online' : 'offline';

    try {
      const { data: staff } = await supabase
        .from('field_staff')
        .select('route_history')
        .eq('id', user.docId)
        .single();
      const currentHistory = staff ? (typeof staff.route_history === 'string' ? JSON.parse(staff.route_history) : (staff.route_history || [])) : [];

      await supabase
        .from('field_staff')
        .update({
          last_active: timestamp,
          current_shop_id: '',
          current_shop_name: '',
          minutes_spent_at_current_shop: 0,
          route_history: [
            ...currentHistory,
            {
              lat,
              lng,
              timestamp,
              battery: batteryPercentage,
              network: networkStatus,
              action: "🏁 Shift Ended"
            }
          ]
        })
        .eq('id', user.docId);

      setIsShiftActive(false);
      localStorage.removeItem(`shift_active_${user.docId}`);
      setCheckedInShop(null);
      setCheckedInTime(0);
    } catch (err) {
      console.error(err);
      alert("Failed to end shift in database.");
    }
  };

  // 10. Check in at Customer shop
  const handleCheckIn = async (shop) => {
    if (!isShiftActive) {
      alert("Please start your shift before checking in to a customer shop.");
      return;
    }

    let lat = shop.location?.lat || 19.0413;
    let lng = shop.location?.lng || 72.8431;

    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch (e) {
      console.warn("Check-in GPS failed, using customer location coordinates.");
    }

    const timestamp = new Date().toISOString();
    const batteryPercentage = staffData?.batteryPercentage || 100;
    const networkStatus = isOnline ? 'online' : 'offline';

    try {
      const { data: staff } = await supabase
        .from('field_staff')
        .select('route_history')
        .eq('id', user.docId)
        .single();
      const currentHistory = staff ? (typeof staff.route_history === 'string' ? JSON.parse(staff.route_history) : (staff.route_history || [])) : [];

      await supabase
        .from('field_staff')
        .update({
          current_shop_id: shop.id,
          current_shop_name: shop.shopName,
          minutes_spent_at_current_shop: 0,
          last_location_lat: lat,
          last_location_lng: lng,
          last_location_time: timestamp,
          last_active: timestamp,
          route_history: [
            ...currentHistory,
            {
              lat,
              lng,
              timestamp,
              battery: batteryPercentage,
              network: networkStatus,
              action: `Checked-in at ${shop.shopName}`
            }
          ]
        })
        .eq('id', user.docId);

      setCheckedInShop(shop);
      setCheckedInTime(0);
      setActiveTab('routes');
    } catch (err) {
      console.error(err);
      alert("Failed to check in.");
    }
  };

  // 11. Check out of Customer shop
  const handleCheckOut = async (shop) => {
    let lat = shop.location?.lat || 19.0413;
    let lng = shop.location?.lng || 72.8431;

    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
    } catch (e) {
      console.warn("Check-out GPS failed.");
    }

    const timestamp = new Date().toISOString();
    const batteryPercentage = staffData?.batteryPercentage || 100;
    const networkStatus = isOnline ? 'online' : 'offline';

    try {
      const { data: staff } = await supabase
        .from('field_staff')
        .select('route_history')
        .eq('id', user.docId)
        .single();
      const currentHistory = staff ? (typeof staff.route_history === 'string' ? JSON.parse(staff.route_history) : (staff.route_history || [])) : [];

      await supabase
        .from('field_staff')
        .update({
          current_shop_id: '',
          current_shop_name: '',
          minutes_spent_at_current_shop: 0,
          last_location_lat: lat,
          last_location_lng: lng,
          last_location_time: timestamp,
          last_active: timestamp,
          route_history: [
            ...currentHistory,
            {
              lat,
              lng,
              timestamp,
              battery: batteryPercentage,
              network: networkStatus,
              action: `Checked-out from ${shop.shopName}`
            }
          ]
        })
        .eq('id', user.docId);

      setCheckedInShop(null);
      setCheckedInTime(0);
    } catch (err) {
      console.error(err);
      alert("Failed to check out.");
    }
  };

  // 12. Submit cash collections
  const handleCollectCashSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(collectAmount) || 0;
    
    if (!checkedInShop) {
      alert("You must be checked in at a shop to collect payments.");
      return;
    }
    if (amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    
    setIsSavingPayment(true);
    const timestamp = new Date().toISOString();
    const dateStr = timestamp.split('T')[0];

    try {
      // 12a. Log transaction payment receipt in wholesale_payments
      const { error: paymentError } = await supabase
        .from('wholesale_payments')
        .insert({
          customer_id: checkedInShop.id,
          customer_name: checkedInShop.shopName,
          amount,
          payment_method: 'Cash',
          notes: collectNotes.trim() || `Collected by field staff: ${user.name}`,
          payment_date: dateStr,
          created_at: timestamp
        });

      if (paymentError) throw paymentError;

      // 12b. Subtract outstanding dues on customer profile
      const currentBalance = checkedInShop.outstandingBalance || 0;
      const updatedBalance = currentBalance - amount;

      const { error: customerError } = await supabase
        .from('wholesale_customers')
        .update({
          outstanding_balance: updatedBalance
        })
        .eq('id', checkedInShop.id);

      if (customerError) throw customerError;

      // 12c. Log action entry inside staff's routeHistory
      const { data: staff } = await supabase
        .from('field_staff')
        .select('route_history')
        .eq('id', user.docId)
        .single();
      const currentHistory = staff ? (typeof staff.route_history === 'string' ? JSON.parse(staff.route_history) : (staff.route_history || [])) : [];

      let lat = staffData?.lastLocation?.lat || checkedInShop.location?.lat || 19.0413;
      let lng = staffData?.lastLocation?.lng || checkedInShop.location?.lng || 72.8431;

      await supabase
        .from('field_staff')
        .update({
          last_active: timestamp,
          route_history: [
            ...currentHistory,
            {
              lat,
              lng,
              timestamp,
              battery: staffData?.batteryPercentage || 100,
              network: isOnline ? 'online' : 'offline',
              action: `Collected Cash ₹${amount.toLocaleString('en-IN')} at ${checkedInShop.shopName}`
            }
          ]
        })
        .eq('id', user.docId);

      setShowPaymentModal(false);
      setCollectAmount('');
      setCollectNotes('');
      alert(`Success: Logged Cash Collection of ₹${amount.toLocaleString('en-IN')} from ${checkedInShop.shopName}.`);
    } catch (err) {
      console.error(err);
      alert("Payment log failed: " + err.message);
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Helper formatting functions
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const getBatteryColor = (pct) => {
    if (pct === null || pct === undefined) return 'text-gray-400';
    if (pct <= 20) return 'text-[#ff3b30]';
    if (pct <= 50) return 'text-[#ff9500]';
    return 'text-[#34c759]';
  };

  // Route extraction from customers list
  const routesList = Array.from(
    new Set(customers.map(c => c.route || c.area).filter(Boolean))
  ).sort();

  // Filtered customers based on search and route
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.shopName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.proprietorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.uniqueId?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRoute = selectedRoute ? (c.route === selectedRoute || c.area === selectedRoute) : true;
    return matchesSearch && matchesRoute;
  });

  // Today's route logs timeline
  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = staffData?.routeHistory 
    ? staffData.routeHistory
        .filter(h => h.timestamp && h.timestamp.split('T')[0] === todayStr)
        .reverse()
    : [];

  return (
    <div className="min-h-screen bg-[#f2f2f7] text-gray-900 font-sans pb-24 text-left">
      
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/80 px-4 py-3 flex items-center justify-between shadow-[0_1px_0px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-[#007aff]/10 border border-[#007aff]/20 flex items-center justify-center text-[#007aff] font-extrabold text-lg shadow-sm">
            {user.name.charAt(0)}
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-gray-900 leading-none">{user.name}</h1>
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-1 block">
              {user.assignedWholesalerName || 'Momin Poultry'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Geolocation status indicator */}
          <div className="flex items-center gap-1.5 bg-[#f2f2f7] px-3 py-1 rounded-full border border-gray-200 shadow-inner">
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-[#34c759]" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-[#ff3b30] animate-pulse" />
            )}
            <span className={`text-[10px] font-bold uppercase tracking-wide ${isOnline ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <button 
            onClick={onLogout} 
            className="p-2 bg-[#f2f2f7] hover:bg-[#e5e5ea] text-gray-600 rounded-full border border-gray-200 transition-colors cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="p-4 space-y-5">
        
        {/* 2. Shift Tracker Control Center Panel */}
        <section className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm transition-all duration-300 relative overflow-hidden">
          {/* Subtle decoration to indicate activity */}
          {isShiftActive && (
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-[#34c759]/5 rounded-full blur-3xl pointer-events-none"></div>
          )}

          <div className="flex justify-between items-start relative z-10">
            <div>
              <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest font-semibold">Agent ID: {user.staffId}</span>
              <h2 className="text-lg font-bold text-gray-900 mt-1">Shift Control Panel</h2>
              <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                {isShiftActive 
                  ? 'Your location & battery telemetry are streaming securely to Wholesale Head Office.' 
                  : 'Start shift to enable tracking & start logging client route visits.'}
              </p>
            </div>

            {/* Battery state overlay */}
            {staffData && (
              <div className="flex items-center gap-1.5 bg-[#f2f2f7] px-2.5 py-1 rounded-full border border-gray-200 text-xs font-semibold text-gray-700">
                <Battery className={`w-3.5 h-3.5 ${getBatteryColor(staffData.batteryPercentage ?? null)}`} />
                <span>{staffData.batteryPercentage != null ? `${staffData.batteryPercentage}%` : 'N/A'}</span>
                {staffData.batteryCharging && staffData.batteryPercentage != null && <span className="text-[#ff9500] text-[10px]">⚡</span>}
              </div>
            )}
          </div>

          {/* Location details summary block */}
          {isShiftActive && staffData?.lastLocation && (
            <div className="mt-4 p-3 bg-[#f2f2f7] rounded-xl border border-gray-200 flex items-center justify-between text-xs font-semibold font-mono text-gray-650">
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#007aff] shrink-0 animate-bounce" />
                <span className="truncate">GPS: {staffData.lastLocation.lat.toFixed(5)}, {staffData.lastLocation.lng.toFixed(5)}</span>
              </div>
              {gpsAccuracy && (
                <span className="text-[10px] text-gray-500 font-bold shrink-0 bg-white px-2 py-0.5 rounded-md border border-gray-200 shadow-sm">
                  Acc: ±{gpsAccuracy}m
                </span>
              )}
            </div>
          )}

          <div className="mt-5 relative z-10">
            {isShiftActive ? (
              <button 
                onClick={handleEndShift}
                className="w-full py-3 px-4 bg-[#ff3b30] hover:bg-[#e03126] text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                End Field Shift
              </button>
            ) : (
              <button 
                onClick={handleStartShift}
                disabled={gpsLoading}
                className="w-full py-3 px-4 bg-[#34c759] hover:bg-[#30b651] text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all transform active:scale-98 disabled:opacity-60 cursor-pointer"
              >
                {gpsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Locking GPS Coordinates...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Start Field Shift
                  </>
                )}
              </button>
            )}
          </div>

          {/* Developer Mock Geolocation Panel */}
          {isShiftActive && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-[#ff9500] tracking-wider flex items-center gap-1">
                  🛠️ Developer Geolocation Mocking
                </span>
                <span className="text-[9px] text-gray-400 font-medium">Select client to jump GPS coordinates</span>
              </div>
              <div className="flex gap-2">
                <select 
                  onChange={async (e) => {
                    const shopId = e.target.value;
                    if (!shopId) return;
                    const shop = customers.find(c => c.id === shopId);
                    if (shop && shop.location) {
                      const timestamp = new Date().toISOString();
                      
                      const { data: staff } = await supabase
                        .from('field_staff')
                        .select('route_history')
                        .eq('id', user.docId)
                        .single();
                      const currentHistory = staff ? (typeof staff.route_history === 'string' ? JSON.parse(staff.route_history) : (staff.route_history || [])) : [];
                      
                      const mockAction = `Simulated GPS Jump to ${shop.shopName}`;
                      const batteryPercentage = staffData?.batteryPercentage || 98;
                      const networkStatus = isOnline ? 'online' : 'offline';

                      await supabase
                        .from('field_staff')
                        .update({
                          last_location_lat: shop.location.lat,
                          last_location_lng: shop.location.lng,
                          last_location_time: timestamp,
                          last_active: timestamp,
                          route_history: [
                            ...currentHistory,
                            {
                              lat: shop.location.lat,
                              lng: shop.location.lng,
                              timestamp,
                              battery: batteryPercentage,
                              network: networkStatus,
                              action: mockAction
                            }
                          ]
                        })
                        .eq('id', user.docId);

                      alert(`Mock Location Set: Teleported coordinates to ${shop.shopName} (${shop.location.lat.toFixed(5)}, ${shop.location.lng.toFixed(5)}).`);
                    }
                  }}
                  className="w-full bg-[#f2f2f7] border border-gray-200 text-xs text-gray-800 p-2.5 rounded-xl font-semibold outline-none focus:border-[#007aff] focus:bg-white transition-all"
                >
                  <option value="">Choose Shop coordinate target...</option>
                  {customers.filter(c => c.location && c.location.lat).map(c => (
                    <option key={c.id} value={c.id}>{c.shopName} ({c.route || c.area})</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* 3. Navigation Tabs (iOS Segmented Control style) */}
        <div className="flex bg-[#e3e3e9] p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('routes')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'routes' 
                ? 'bg-white text-gray-900 shadow-sm font-bold' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            Customer Shops
          </button>
          <button 
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'timeline' 
                ? 'bg-white text-gray-900 shadow-sm font-bold' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Today's Log
          </button>
        </div>

        {/* 4. Active Check-in Sticky Panel */}
        {isShiftActive && checkedInShop && (
          <div className="bg-white border-2 border-[#5856d6]/20 shadow-md rounded-2xl p-5 flex flex-col justify-between gap-4 animate-in slide-in-from-top duration-300">
            <div className="flex items-start justify-between">
              <div className="text-left">
                <span className="text-[10px] bg-[#5856d6]/10 text-[#5856d6] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                  Active Visit Logged
                </span>
                <h3 className="font-bold text-base text-gray-900 mt-1.5">{checkedInShop.shopName}</h3>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">{checkedInShop.proprietorName}</p>
              </div>

              {/* Timer badge */}
              <div className="flex items-center gap-1.5 bg-[#f2f2f7] px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-gray-700 font-mono">
                <Clock className="w-3.5 h-3.5 text-[#5856d6] animate-spin" />
                <span>{formatTime(checkedInTime)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="py-3 px-4 bg-[#5856d6] hover:bg-[#4745b4] text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transform active:scale-97"
              >
                <IndianRupee className="w-3.5 h-3.5" />
                Collect Cash
              </button>
              <button 
                onClick={() => handleCheckOut(checkedInShop)}
                className="py-3 px-4 bg-[#f2f2f7] border border-gray-200 hover:bg-[#e5e5ea] text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Square className="w-3.5 h-3.5 text-gray-500" />
                Check Out
              </button>
            </div>
          </div>
        )}

        {/* Tab 1 Content: Routes/Customers list */}
        {activeTab === 'routes' && (
          <section className="space-y-4">
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shop, proprietor or ID..."
                  className="w-full bg-white border border-gray-200 pl-10 pr-4 py-3 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#007aff] focus:ring-1 focus:ring-[#007aff]/30 transition-all font-semibold shadow-sm"
                />
              </div>

              {/* Route Filter Dropdown */}
              <select
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                className="bg-white border border-gray-200 px-4 py-3 rounded-xl text-xs text-gray-800 focus:outline-none focus:border-[#007aff] transition-all font-semibold min-w-[130px] shrink-0 shadow-sm"
              >
                <option value="">All Routes</option>
                {routesList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Customers list display */}
            <div className="space-y-3.5">
              {isLoadingCustomers ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-500">
                  <Loader2 className="w-8 h-8 text-[#007aff] animate-spin mb-2" />
                  <span className="text-xs font-semibold">Loading client accounts...</span>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-gray-500 border border-dashed border-gray-350 rounded-2xl bg-white/50 shadow-sm">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                  <p className="text-xs font-semibold">No customers found.</p>
                </div>
              ) : (
                filteredCustomers.map(cust => {
                  const isCheckedInHere = checkedInShop && checkedInShop.id === cust.id;
                  const balance = cust.outstandingBalance || 0;
                  
                  return (
                    <div 
                      key={cust.id}
                      className={`p-4 rounded-2xl border transition-all duration-300 ${
                        isCheckedInHere 
                          ? 'bg-white border-2 border-[#5856d6]/30 shadow-md' 
                          : 'bg-white border border-gray-200/80 hover:border-gray-300 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-gray-400 font-semibold">{cust.uniqueId}</span>
                            <span className="text-[9px] bg-gray-100 text-gray-600 font-bold uppercase px-1.5 py-0.5 rounded-md">
                              {cust.route || cust.area || 'Default'}
                            </span>
                          </div>
                          <h3 className="font-bold text-sm mt-1.5 text-gray-900">{cust.shopName}</h3>
                          <span className="text-xs text-gray-500 font-medium block mt-1">Proprietor: {cust.proprietorName}</span>
                          <span className="text-xs text-gray-500 font-mono block mt-0.5">Phone: {cust.phone}</span>
                        </div>

                        {/* Dues Display */}
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Outstanding</span>
                          <span className={`text-sm font-bold block mt-1 ${balance > 0 ? 'text-[#ff3b30] animate-pulse' : 'text-[#34c759]'}`}>
                            ₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>

                      {cust.address && (
                        <p className="mt-3 text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-2.5">
                          📍 Address: {cust.address}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="mt-4 flex items-center justify-end gap-2.5">
                        {cust.location && cust.location.lat && (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${cust.location.lat},${cust.location.lng}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea] border border-gray-200 text-gray-600 rounded-xl transition-all"
                            title="Get Directions on Google Maps"
                          >
                            <MapPin className="w-3.5 h-3.5 text-[#007aff]" />
                          </a>
                        )}
                        <a 
                          href={`tel:${cust.phone}`}
                          className="p-2.5 bg-[#f2f2f7] hover:bg-[#e5e5ea] border border-gray-200 text-gray-650 rounded-xl transition-all"
                          title="Call Proprietor"
                        >
                          <Phone className="w-3.5 h-3.5 text-gray-600" />
                        </a>

                        {isCheckedInHere ? (
                          <div className="flex items-center gap-1.5 bg-[#5856d6]/10 text-[#5856d6] border border-[#5856d6]/20 px-3.5 py-2 rounded-xl text-[11px] font-bold">
                            <Check className="w-3.5 h-3.5 text-[#5856d6]" />
                            Checked In
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(cust)}
                            disabled={!isShiftActive}
                            className="px-4 py-2 bg-[#007aff] hover:bg-[#0062cc] disabled:bg-gray-100 text-white disabled:text-gray-400 border border-[#007aff]/15 disabled:border-none rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <MapPin className={`w-3.5 h-3.5 ${isShiftActive ? 'text-white' : 'text-gray-400'}`} />
                            Check In
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* Tab 2 Content: Today's Timeline / Route logs */}
        {activeTab === 'timeline' && (
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wider">Today's Shift Log ({todayLogs.length})</h3>
            
            <div className="relative border-l border-gray-200 ml-3.5 pl-5 space-y-6 text-left pt-2 pb-4">
              {todayLogs.length === 0 ? (
                <div className="text-left text-gray-400 text-xs font-medium py-8 -ml-3">
                  No activity logged yet today. Active pings and visits will populate here.
                </div>
              ) : (
                todayLogs.map((log, index) => {
                  const logTime = log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
                  const isCheckIn = log.action && log.action.includes('Checked-in at');
                  const isPayment = log.action && log.action.includes('Collected Cash');
                  const isAlert = log.action && log.action.includes('🚨');
                  const isShift = log.action && log.action.includes('Shift');

                  let dotColor = 'bg-gray-300 ring-white shadow-sm';
                  let iconElement = <MapPin className="w-3 h-3 text-white" />;

                  if (isCheckIn) {
                    dotColor = 'bg-[#5856d6] ring-white shadow-sm';
                    iconElement = <MapPin className="w-3 h-3 text-white" />;
                  } else if (isPayment) {
                    dotColor = 'bg-[#34c759] ring-white shadow-sm';
                    iconElement = <IndianRupee className="w-3 h-3 text-white" />;
                  } else if (isAlert) {
                    dotColor = 'bg-[#ff9500] ring-white shadow-sm animate-pulse';
                    iconElement = <AlertTriangle className="w-3 h-3 text-white" />;
                  } else if (isShift) {
                    dotColor = 'bg-[#007aff] ring-white shadow-sm';
                    iconElement = <Clock className="w-3 h-3 text-white" />;
                  }

                  return (
                    <div key={index} className="relative group">
                      {/* Timeline Node Dot */}
                      <span className={`absolute -left-[31px] top-1.5 flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${dotColor}`}>
                        {iconElement}
                      </span>

                      {/* Content block */}
                      <div className="p-3.5 bg-white border border-gray-200/80 rounded-2xl shadow-sm hover:border-gray-300 transition-colors">
                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold font-mono mb-1.5">
                          <span>{logTime}</span>
                          <span className="flex items-center gap-1">
                            🔋 {log.battery != null ? `${log.battery}%` : 'N/A'} | {log.network === 'online' ? '📶 Online' : '⚠️ Offline'}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 leading-relaxed">{log.action}</p>
                        {log.lat && log.lng && (
                          <div className="mt-2 text-[9px] font-mono text-gray-400 font-medium">
                            Coord: {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

      </main>

      {/* 5. Payments Sliding Modal Sheet */}
      {showPaymentModal && checkedInShop && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-t-3xl rounded-b-none md:rounded-3xl p-6 space-y-5 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto shadow-2xl text-gray-900">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-150">
              <div className="text-left">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block font-mono">Dues settlement</span>
                <h4 className="font-bold text-base text-gray-900 mt-1">Cash Collection receipt</h4>
              </div>
              <button 
                onClick={() => { setShowPaymentModal(false); setCollectAmount(''); setCollectNotes(''); }}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-805 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shop Summary panel */}
            <div className="p-4 bg-[#f2f2f7] rounded-xl border border-gray-200 flex items-center justify-between text-left">
              <div>
                <span className="text-[9px] font-mono text-gray-400 block font-semibold">{checkedInShop.uniqueId}</span>
                <span className="font-bold text-sm text-gray-900 mt-0.5 block">{checkedInShop.shopName}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Current Dues</span>
                <span className="font-extrabold text-sm text-[#ff3b30] block mt-0.5">
                  ₹{(checkedInShop.outstandingBalance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Collection Form */}
            <form onSubmit={handleCollectCashSubmit} className="space-y-4 text-left">
              
              {/* Amount input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Amount Collected (₹)</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <IndianRupee className="h-5 w-5 text-gray-405 group-focus-within:text-[#007aff] transition-colors" />
                  </div>
                  <input 
                    type="number" 
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    required
                    min="1"
                    step="any"
                    placeholder="Enter cash amount"
                    className="block w-full pl-11 pr-4 py-3.5 border border-gray-200 rounded-xl bg-[#f2f2f7] text-gray-900 font-extrabold text-lg focus:bg-white focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] outline-none transition-all"
                  />
                </div>
              </div>

              {/* Notes input */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-gray-400 tracking-wider">Payment Comments / Notes</label>
                <textarea 
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  placeholder={`e.g. Collected by field staff: ${user.name}`}
                  rows="2"
                  className="block w-full p-3 border border-gray-200 rounded-xl bg-[#f2f2f7] text-gray-900 text-xs font-semibold focus:bg-white focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] outline-none transition-all"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isSavingPayment}
                className="w-full mt-4 py-3.5 bg-[#007aff] hover:bg-[#0062cc] disabled:opacity-60 text-white font-bold text-sm rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all transform active:scale-97 cursor-pointer"
              >
                {isSavingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recording settlement...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Cash Settlement
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
