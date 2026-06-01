import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { 
  Smartphone, Battery, Wifi, WifiOff, MapPin, History, User, 
  DollarSign, Activity, ChevronRight, ChevronLeft, Play, Zap, AlertTriangle, 
  Map, CheckCircle, RefreshCw, Loader2, Clock, BatteryCharging, Calendar
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function WholesaleStaffTracker() {
  const [staffList, setStaffList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Simulator states
  const [simSelectedCustomer, setSimSelectedCustomer] = useState('');
  const [simCollectionAmount, setSimCollectionAmount] = useState('');
  const [simBattery, setSimBattery] = useState(100);
  const [simCharging, setSimCharging] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Date selection & formatting states
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const todayStr = (() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  })();

  const isToday = selectedDate === todayStr;

  // Helper for computing distance between coordinates using Haversine formula
  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculateTotalDistance = (history) => {
    let total = 0;
    for (let i = 0; i < history.length - 1; i++) {
      const p1 = history[i];
      const p2 = history[i+1];
      if (p1.lat && p1.lng && p2.lat && p2.lng) {
        total += getDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
      }
    }
    return total.toFixed(2);
  };

  const calculateActiveDuration = (history) => {
    if (history.length < 2) return "0s";
    const start = new Date(history[0].timestamp);
    const end = new Date(history[history.length - 1].timestamp);
    const diffMs = end - start;
    if (diffMs <= 0) return "0s";
    
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const handlePrevDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() - 1);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + 1);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const formatStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (dateStr === formatStr(today)) {
      return "Today";
    }
    if (dateStr === formatStr(yesterday)) {
      return "Yesterday";
    }

    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Leaflet references
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const mapMarkersRef = useRef([]);
  const mapPolylineRef = useRef(null);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    const allPoints = [];
    const activeCustomers = customers.filter(c => c.location && c.location.lat && c.location.lng);
    activeCustomers.forEach(c => allPoints.push([c.location.lat, c.location.lng]));
    if (selectedStaff) {
      const history = selectedStaff.routeHistory || [];
      const dayHistory = history.filter(h => h.timestamp && h.timestamp.split('T')[0] === selectedDate);
      dayHistory.forEach(h => {
        if (h.lat && h.lng) allPoints.push([h.lat, h.lng]);
      });
      if (selectedDate === todayStr && selectedStaff.lastLocation && selectedStaff.lastLocation.lat) {
        allPoints.push([selectedStaff.lastLocation.lat, selectedStaff.lastLocation.lng]);
      }
    }
    if (allPoints.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] });
    } else {
      mapInstanceRef.current.setView([19.0413, 72.8431], 12);
    }
  };

  // Wholesaler ID resolution
  const [wholesalerId, setWholesalerId] = useState(() => {
    const saved = localStorage.getItem('shopInfo');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.customerUniqueId || 'CV-00001';
      } catch (e) {
        console.error(e);
      }
    }
    return 'CV-00001';
  });

  // Fetch assigned field staff
  useEffect(() => {
    setIsLoading(true);
    
    const fetchStaff = async () => {
      const { data, error } = await supabase
        .from('field_staff')
        .select('*')
        .eq('assigned_wholesaler_id', wholesalerId);
      if (!error && data) {
        const list = data.map(row => ({
          docId: row.id,
          staffId: row.staff_id,
          name: row.name,
          phone: row.phone,
          passcode: row.passcode,
          status: row.status,
          subscriptionPlan: row.subscription_plan,
          registeredAt: row.registered_at,
          subscriptionStartedAt: row.subscription_started_at,
          subscriptionExpiredAt: row.subscription_expired_at,
          assignedWholesalerId: row.assigned_wholesaler_id,
          assignedWholesalerName: row.assigned_wholesaler_name,
          lastLocation: {
            lat: row.last_location_lat,
            lng: row.last_location_lng,
            timestamp: row.last_location_time
          },
          lastActive: row.last_active,
          batteryPercentage: row.battery_percentage,
          batteryCharging: row.battery_charging,
          networkStatus: row.network_status,
          routeHistory: typeof row.route_history === 'string' ? JSON.parse(row.route_history) : (row.route_history || []),
          currentShopId: row.current_shop_id,
          currentShopName: row.current_shop_name,
          minutesSpentAtCurrentShop: row.minutes_spent_at_current_shop
        }));
        setStaffList(list);
        
        if (list.length > 0) {
          setSelectedStaff(prev => {
            if (!prev) return list[0];
            const updated = list.find(s => s.docId === prev.docId);
            return updated || list[0];
          });
        } else {
          setSelectedStaff(null);
        }
      }
      setIsLoading(false);
    };

    fetchStaff();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('field-staff-tracker-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'field_staff' }, () => {
        fetchStaff();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [wholesalerId]);

  // Fetch customers for map coordinates
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from('wholesale_customers')
        .select('*');
      if (!error && data) {
        const list = data.map(row => {
          let location = { lat: row.location_lat, lng: row.location_lng };
          if (!location.lat || !location.lng) {
            const hash = (row.unique_id || row.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const mockLat = 19.0413 + 0.02 * Math.sin(hash);
            const mockLng = 72.8431 + 0.03 * Math.cos(hash);
            location = { lat: mockLat, lng: mockLng };
          }
          return {
            id: row.id,
            shopName: row.shop_name,
            proprietorName: row.proprietor_name,
            uniqueId: row.unique_id,
            route: row.route,
            area: row.area,
            outstandingBalance: row.outstanding_balance,
            location
          };
        });
        setCustomers(list);
      }
    };

    fetchCustomers();

    const channel = supabase
      .channel('wholesale-customers-tracker-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wholesale_customers' }, () => {
        fetchCustomers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const mappedCustomers = customers.filter(c => c.location && c.location.lat && c.location.lng);

  // Filter route history based on selected date
  const filteredRouteHistory = selectedStaff?.routeHistory
    ? selectedStaff.routeHistory.filter(h => h.timestamp && h.timestamp.split('T')[0] === selectedDate)
    : [];

  // Leaflet rendering and map updating effect
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([19.0413, 72.8431], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        minZoom: 10,
      }).addTo(mapInstanceRef.current);

      L.control.attribution({ prefix: false }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    mapMarkersRef.current.forEach(m => m.remove());
    mapMarkersRef.current = [];

    // Clear polyline trail
    if (mapPolylineRef.current) {
      mapPolylineRef.current.remove();
      mapPolylineRef.current = null;
    }

    // Add customer markers
    mappedCustomers.forEach(cust => {
      const hasDues = (cust.outstandingBalance || 0) > 0;
      const isStaffCurrentShop = selectedStaff && selectedStaff.currentShopId === cust.id;

      const custIcon = L.divIcon({
        className: 'custom-customer-marker',
        html: `
          <div class="relative flex items-center justify-center">
            ${isStaffCurrentShop ? `
              <div class="absolute w-8 h-8 rounded-full bg-indigo-500/30 animate-ping font-sans"></div>
            ` : ''}
            <div class="w-6 h-6 rounded-full border-2 bg-white flex items-center justify-center shadow-md transition-all ${
              isStaffCurrentShop 
                ? 'border-indigo-600 text-indigo-600' 
                : hasDues 
                ? 'border-rose-500 text-rose-500' 
                : 'border-slate-400 text-slate-400'
            }">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                <path d="M3 6h18"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([cust.location.lat, cust.location.lng], { icon: custIcon })
        .addTo(map)
        .bindTooltip(`
          <div class="p-1 font-sans text-xs">
            <div class="font-bold text-slate-800">${cust.shopName}</div>
            <div class="text-[10px] text-slate-500 font-semibold mt-0.5">Dues: ₹${(cust.outstandingBalance || 0).toLocaleString('en-IN')}</div>
          </div>
        `, { direction: 'top', className: 'rounded-lg border border-slate-200 shadow-lg font-sans' });

      mapMarkersRef.current.push(marker);
    });

    // Add selected staff live marker and route history polyline
    let staffCoords = [];
    let staffPosition = null;
    let isLivePulse = false;

    if (selectedStaff) {
      staffCoords = filteredRouteHistory
        .filter(h => h.lat && h.lng)
        .map(h => [h.lat, h.lng]);

      if (staffCoords.length >= 2) {
        mapPolylineRef.current = L.polyline(staffCoords, {
          color: '#10b981',
          weight: 3,
          dashArray: '5, 8',
          opacity: 0.8
        }).addTo(map);
      }

      if (isToday) {
        if (selectedStaff.lastLocation && selectedStaff.lastLocation.lat && selectedStaff.lastLocation.lng) {
          staffPosition = [selectedStaff.lastLocation.lat, selectedStaff.lastLocation.lng];
          isLivePulse = true;
        }
      } else {
        const validCoords = filteredRouteHistory.filter(h => h.lat && h.lng);
        if (validCoords.length > 0) {
          const lastPoint = validCoords[validCoords.length - 1];
          staffPosition = [lastPoint.lat, lastPoint.lng];
          isLivePulse = false;
        }
      }

      if (staffPosition) {
        const netStatus = selectedStaff.networkStatus ?? 'online';
        const colorClass = isLivePulse 
          ? (netStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500')
          : 'bg-slate-500';

        const staffIcon = L.divIcon({
          className: 'custom-staff-marker',
          html: `
            <div class="relative flex items-center justify-center">
              ${isLivePulse ? `
                <div class="absolute w-8 h-8 rounded-full ${colorClass} opacity-25 animate-ping font-sans"></div>
              ` : ''}
              <div class="w-5 h-5 rounded-full ${colorClass} border-2 border-white shadow-lg flex items-center justify-center text-white">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9Z"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const staffMarker = L.marker(staffPosition, { icon: staffIcon })
          .addTo(map)
          .bindTooltip(`
            <div class="p-1.5 font-sans text-xs">
              <div class="font-extrabold text-slate-800">${selectedStaff.name}</div>
              <div class="text-[10px] text-slate-500 font-bold mt-0.5 uppercase">${isLivePulse ? `Live Tracker (${netStatus})` : 'Last Position'}</div>
            </div>
          `, { direction: 'top', className: 'rounded-lg border border-slate-200 shadow-lg font-sans' });

        mapMarkersRef.current.push(staffMarker);
      }
    }

    // Auto-fit bounds of all points
    const allPoints = [];
    mappedCustomers.forEach(c => allPoints.push([c.location.lat, c.location.lng]));
    staffCoords.forEach(c => allPoints.push(c));
    if (staffPosition) {
      allPoints.push(staffPosition);
    }

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    // Force map size refresh
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

  }, [customers, selectedStaff?.docId, selectedStaff?.lastLocation?.lat, selectedStaff?.lastLocation?.lng, filteredRouteHistory.length, selectedStaff?.networkStatus, selectedDate]);

  // Map instance cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // --- SIMULATION HANDLERS ---

  const handleSimulateCheckIn = async () => {
    if (!selectedStaff || !simSelectedCustomer) {
      alert("Please select a staff member and customer to visit.");
      return;
    }
    setIsSimulating(true);

    try {
      const customer = customers.find(c => c.id === simSelectedCustomer);
      if (!customer || !customer.location) {
        alert("Selected customer does not have pinned coordinates.");
        setIsSimulating(false);
        return;
      }

      const timestamp = new Date().toISOString();
      const currentHistory = selectedStaff.routeHistory || [];
      const updatedHistory = [
        ...currentHistory,
        {
          lat: customer.location.lat,
          lng: customer.location.lng,
          timestamp,
          battery: selectedStaff.batteryPercentage,
          network: selectedStaff.networkStatus,
          action: `Checked-in at ${customer.shopName}`
        }
      ];

      await supabase
        .from('field_staff')
        .update({
          last_location_lat: customer.location.lat,
          last_location_lng: customer.location.lng,
          last_location_time: timestamp,
          last_active: timestamp,
          current_shop_id: customer.id,
          current_shop_name: customer.shopName,
          minutes_spent_at_current_shop: Math.floor(Math.random() * 20) + 5, // Random demo check-in minutes
          route_history: updatedHistory
        })
        .eq('id', selectedStaff.docId);

      setSimSelectedCustomer('');
    } catch (err) {
      console.error(err);
      alert("Simulation failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateCollection = async () => {
    const amount = parseFloat(simCollectionAmount) || 0;
    if (!selectedStaff || !selectedStaff.currentShopId) {
      alert("Staff must be checked in at a shop to collect payments.");
      return;
    }
    if (amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    setIsSimulating(true);

    try {
      const timestamp = new Date().toISOString();
      const dateStr = timestamp.split('T')[0];

      // Add to payments collection
      await supabase.from('wholesale_payments').insert({
        customer_id: selectedStaff.currentShopId,
        customer_name: selectedStaff.currentShopName,
        amount,
        payment_method: 'Cash',
        notes: `Collected by field staff: ${selectedStaff.name}`,
        payment_date: dateStr,
        created_at: timestamp
      });

      // Subtract from customer outstandingBalance
      const customer = customers.find(c => c.id === selectedStaff.currentShopId);
      const currentOutstanding = customer ? Number(customer.outstandingBalance || 0) : 0;
      await supabase
        .from('wholesale_customers')
        .update({
          outstanding_balance: currentOutstanding - amount
        })
        .eq('id', selectedStaff.currentShopId);

      // Update staff timeline
      const currentHistory = selectedStaff.routeHistory || [];
      const updatedHistory = [
        ...currentHistory,
        {
          lat: selectedStaff.lastLocation.lat,
          lng: selectedStaff.lastLocation.lng,
          timestamp,
          battery: selectedStaff.batteryPercentage,
          network: selectedStaff.networkStatus,
          action: `Collected Cash ₹${amount.toLocaleString('en-IN')} at ${selectedStaff.currentShopName}`
        }
      ];

      await supabase
        .from('field_staff')
        .update({
          last_active: timestamp,
          route_history: updatedHistory
        })
        .eq('id', selectedStaff.docId);

      setSimCollectionAmount('');
    } catch (err) {
      console.error(err);
      alert("Simulating collection failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateBatteryChange = async (newVal) => {
    if (!selectedStaff) return;
    setSimBattery(newVal);

    try {
      const timestamp = new Date().toISOString();
      const currentHistory = selectedStaff.routeHistory || [];
      
      const newLog = {
        lat: selectedStaff.lastLocation.lat,
        lng: selectedStaff.lastLocation.lng,
        timestamp,
        battery: newVal,
        network: selectedStaff.networkStatus,
        action: `Battery status updated to ${newVal}%`
      };

      // Add alert action if battery falls critically low
      if (newVal <= 15) {
        newLog.action = `🚨 CRITICAL BATTERY ALERT: ${newVal}%`;
      }

      await supabase
        .from('field_staff')
        .update({
          battery_percentage: newVal,
          last_active: timestamp,
          route_history: [...currentHistory, newLog]
        })
        .eq('id', selectedStaff.docId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateChargingToggle = async () => {
    if (!selectedStaff) return;
    const nextCharging = !simCharging;
    setSimCharging(nextCharging);

    try {
      const timestamp = new Date().toISOString();
      const currentHistory = selectedStaff.routeHistory || [];

      await supabase
        .from('field_staff')
        .update({
          battery_charging: nextCharging,
          last_active: timestamp,
          route_history: [
            ...currentHistory,
            {
              lat: selectedStaff.lastLocation.lat,
              lng: selectedStaff.lastLocation.lng,
              timestamp,
              battery: selectedStaff.batteryPercentage,
              network: selectedStaff.networkStatus,
              action: nextCharging ? "⚡ Power Charger Connected" : "🔌 Power Charger Disconnected"
            }
          ]
        })
        .eq('id', selectedStaff.docId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateNetworkToggle = async () => {
    if (!selectedStaff) return;
    const nextNetwork = selectedStaff.networkStatus === 'online' ? 'offline' : 'online';

    try {
      const timestamp = new Date().toISOString();
      const currentHistory = selectedStaff.routeHistory || [];

      await supabase
        .from('field_staff')
        .update({
          network_status: nextNetwork,
          last_active: timestamp,
          route_history: [
            ...currentHistory,
            {
              lat: selectedStaff.lastLocation.lat,
              lng: selectedStaff.lastLocation.lng,
              timestamp,
              battery: selectedStaff.batteryPercentage,
              network: nextNetwork,
              action: nextNetwork === 'online' ? "📶 Network Connected" : "⚠️ Network Disconnected / Offline"
            }
          ]
        })
        .eq('id', selectedStaff.docId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSimulateEndShift = async () => {
    if (!selectedStaff) return;
    setIsSimulating(true);

    try {
      const timestamp = new Date().toISOString();
      const currentHistory = selectedStaff.routeHistory || [];

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
              lat: selectedStaff.lastLocation.lat,
              lng: selectedStaff.lastLocation.lng,
              timestamp,
              battery: selectedStaff.batteryPercentage,
              network: selectedStaff.networkStatus,
              action: "🏁 Shift Ended"
            }
          ]
        })
        .eq('id', selectedStaff.docId);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Render battery level dynamically in iOS outline style
  const renderBatteryIcon = (pct, charging) => {
    const isLow = pct <= 20;
    const isMed = pct > 20 && pct <= 50;
    const colorClass = isLow ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500';

    return (
      <div className="flex items-center gap-1">
        <div className="relative w-6 h-3.5 border border-slate-400 dark:border-slate-500 rounded-[3px] p-0.5 flex items-center shrink-0">
          <div 
            className={`h-full rounded-[1px] ${colorClass} ${isLow ? 'animate-pulse' : ''}`} 
            style={{ width: `${pct}%` }}
          ></div>
          <div className="absolute -right-[3px] top-[3px] w-[2px] h-[6px] bg-slate-400 dark:bg-slate-500 rounded-r-[1px]"></div>
          {charging && (
            <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white">⚡</span>
          )}
        </div>
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-350">{pct}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 text-left">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Field Staff Tracker & Dues</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Monitor your license collections staff's real-time battery status, network availability, live location, and weekly ledger collections.
        </p>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="p-8 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/40">
          <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-55 text-slate-350" />
          <h4 className="font-bold text-base text-slate-700 dark:text-slate-350">No Field Staff Licensed</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Your Super Admin must issue a Field Staff Add-on license and assign it to your store profile ({wholesalerId}) before tracking is enabled.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LEFT: iOS-Style Master List Panel */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Active Field Staff ({staffList.length})</h3>
            <div className="space-y-3">
              {staffList.map((staff) => {
                const isSelected = selectedStaff && selectedStaff.docId === staff.docId;
                const lastSeen = staff.lastActive ? new Date(staff.lastActive) : null;
                const batPct = staff.batteryPercentage ?? 100;
                
                return (
                  <button
                    key={staff.staffId}
                    onClick={() => setSelectedStaff(staff)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/40 shadow-md ring-1 ring-emerald-500/10'
                        : 'bg-white dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div>
                        <span className="text-[9px] font-mono text-slate-400 font-bold uppercase tracking-widest">{staff.staffId}</span>
                        <h4 className="font-extrabold text-slate-850 dark:text-white mt-0.5 leading-tight">{staff.name}</h4>
                        <span className="text-[10px] text-slate-450 block font-medium mt-1">{staff.phone}</span>
                      </div>
                      
                      {/* iOS Indicators block */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {renderBatteryIcon(batPct, staff.batteryCharging)}
                        <div className="flex items-center gap-1">
                          {staff.networkStatus === 'online' ? (
                            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <WifiOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                          )}
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            staff.networkStatus === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {staff.networkStatus === 'online' ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 w-full flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                      <div className="truncate pr-2">
                        📍 <span className="font-bold">{staff.currentShopName ? `At: ${staff.currentShopName}` : 'In Transit'}</span>
                      </div>
                      <span className="shrink-0 font-medium font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {lastSeen ? lastSeen.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT: iOS-Style Detail Panel (Maps & Timelines) */}
          <div className="lg:col-span-2 space-y-6">
            {selectedStaff && (
              <>
                {/* Live Status Header Widget */}
                <div className="glass-panel p-5 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-805 shadow-xl flex flex-col md:flex-row justify-between gap-4">
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg text-emerald-600">
                        <Smartphone className="w-4 h-4" />
                      </span>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{selectedStaff.staffId} License Detail</span>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">{selectedStaff.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Last Active Ping: <span className="font-bold text-slate-600 dark:text-slate-300">{new Date(selectedStaff.lastActive).toLocaleTimeString()} ({new Date(selectedStaff.lastActive).toLocaleDateString()})</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 self-start md:self-auto">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Battery</span>
                      <div className="mt-1">{renderBatteryIcon(selectedStaff.batteryPercentage ?? 100, selectedStaff.batteryCharging)}</div>
                    </div>
                    
                    <div className="border-l border-slate-200 dark:border-slate-700 pl-4 pr-2">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Network Strength</span>
                      <div className="flex items-center gap-1.5 mt-1 font-extrabold text-xs">
                        {selectedStaff.networkStatus === 'online' ? (
                          <>
                            <Wifi className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Online</span>
                          </>
                        ) : (
                          <>
                            <WifiOff className="w-4 h-4 text-rose-500 animate-pulse" />
                            <span className="text-rose-600 dark:text-rose-400">Offline</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Active Visit</span>
                      <span className="block mt-1 font-extrabold text-xs text-slate-700 dark:text-slate-200">
                        {selectedStaff.currentShopName ? `${selectedStaff.minutesSpentAtCurrentShop} mins` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date Navigator Bar */}
                <div className="glass-panel p-4 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-205 dark:border-slate-800 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrevDay}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-600 dark:text-slate-300"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="relative flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-700 min-w-36 justify-center">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        {formatDateDisplay(selectedDate)}
                      </span>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <button
                      onClick={handleNextDay}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer text-slate-600 dark:text-slate-300"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Summary Metrics Stats */}
                  <div className="flex items-center gap-6 text-xs font-semibold">
                    <div className="text-center sm:text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Distance</span>
                      <span className="text-slate-700 dark:text-slate-200 text-sm font-black">
                        {calculateTotalDistance(filteredRouteHistory)} km
                      </span>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-800"></div>
                    <div className="text-center sm:text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Active Time</span>
                      <span className="text-slate-700 dark:text-slate-200 text-sm font-black">
                        {calculateActiveDuration(filteredRouteHistory)}
                      </span>
                    </div>
                    <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-800"></div>
                    <div className="text-center sm:text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Shops Visited</span>
                      <span className="text-slate-700 dark:text-slate-200 text-sm font-black">
                        {filteredRouteHistory.filter(h => h.action && h.action.includes('Checked-in')).length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SVG Live GPS Map Widget */}
                <div className="glass-panel p-6 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-205 dark:border-slate-800 shadow-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-550 flex items-center gap-1.5">
                      <Map className="w-5 h-5 text-emerald-500" /> Real-time GPS Trail
                    </h3>
                    <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
                      Live coordinate trace
                    </span>
                   {/* Floating Zoom & Pan Controls */}
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <button
                      onClick={handleZoomIn}
                      className="w-8 h-8 rounded-lg bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center font-bold text-base cursor-pointer select-none active:scale-95 transition-all"
                      title="Zoom In"
                    >
                      +
                    </button>
                    <button
                      onClick={handleZoomOut}
                      className="w-8 h-8 rounded-lg bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center font-bold text-base cursor-pointer select-none active:scale-95 transition-all"
                      title="Zoom Out"
                    >
                      -
                    </button>
                    <button
                      onClick={handleResetView}
                      className="w-8 h-8 rounded-lg bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center font-bold text-[10px] cursor-pointer select-none active:scale-95 transition-all"
                      title="Reset Map View"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Leaflet Map Canvas */}
                  <div className="relative border border-slate-100 dark:border-slate-800 bg-[#f7fafc] dark:bg-slate-950 rounded-2xl overflow-hidden w-full h-[400px] sm:h-[480px] md:h-[550px] flex items-center justify-center z-0">
                    {mappedCustomers.length > 0 ? (
                      <div ref={mapContainerRef} className="w-full h-full" />
                    ) : (
                      <div className="text-slate-400 text-xs text-center py-12 flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-350" />
                        <span>Map coordinates initializing...</span>
                      </div>
                    )}
                  </div>
                  </div>
                </div>

                {/* Shift Activity Logs Timeline */}
                <div className="glass-panel p-6 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-205 dark:border-slate-800 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-550 flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-500" /> {isToday ? "Today's" : formatDateDisplay(selectedDate)} Tracker Timeline
                  </h3>

                  <div className="flow-root relative pl-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {filteredRouteHistory && filteredRouteHistory.length > 0 ? (
                      <ul className="-mb-8">
                        {filteredRouteHistory.slice().reverse().map((log, logIdx) => {
                          const logTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          const isAlert = log.action && (log.action.includes("🚨") || log.action.includes("⚠️") || log.network === 'offline');
                          const isCollection = log.action && log.action.includes("Collected");

                          return (
                            <li key={logIdx}>
                              <div className="relative pb-8 text-left">
                                {logIdx !== filteredRouteHistory.length - 1 ? (
                                  <span className="absolute top-4 left-4 -ml-0.5 h-full w-0.5 bg-slate-100 dark:bg-slate-800" aria-hidden="true" />
                                ) : null}
                                <div className="relative flex space-x-3">
                                  <div>
                                    <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-slate-900 ${
                                      isAlert 
                                        ? 'bg-rose-50 text-rose-500 dark:bg-rose-955/20' 
                                        : isCollection 
                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-955/20' 
                                        : 'bg-slate-50 text-slate-500 dark:bg-slate-800'
                                    }`}>
                                      {isCollection ? (
                                        <DollarSign className="w-4 h-4 font-black" />
                                      ) : isAlert ? (
                                        <AlertTriangle className="w-4 h-4" />
                                      ) : (
                                        <MapPin className="w-4 h-4" />
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                                    <div>
                                      <p className={`text-xs font-bold ${isAlert ? 'text-rose-600 dark:text-rose-450' : 'text-slate-805 dark:text-slate-205'}`}>
                                        {log.action || 'Location Ping'}
                                      </p>
                                      <span className="text-[10px] text-slate-400 block mt-0.5">
                                        Battery: {log.battery}% | Network: <span className="font-semibold">{log.network}</span>
                                      </span>
                                    </div>
                                    <div className="text-right text-[10px] whitespace-nowrap text-slate-450 font-mono font-bold pt-0.5">
                                      {logTime}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="text-center py-6 text-xs text-slate-400 italic font-medium">No activity registered yet for today's shift.</div>
                    )}
                  </div>
                </div>

                {/* DEVELOPER SIMULATION PANEL */}
                {isToday ? (
                  <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 shadow-inner space-y-5 text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Demo Tool</span>
                      <h4 className="font-extrabold text-sm text-slate-750 dark:text-white flex items-center gap-1.5">
                        ⚡ Field Staff App Mock Simulator
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
                      Simulate a mobile phone client transmitting telemetry data, visiting client retailers, updating battery levels, and collection deposits.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-200 dark:border-slate-800">
                      {/* Route & Visit simulations */}
                      <div className="space-y-4">
                        {/* Check in */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">1. Simulate Retailer Visit</label>
                          <div className="flex gap-2">
                            <select
                              value={simSelectedCustomer}
                              onChange={(e) => setSimSelectedCustomer(e.target.value)}
                              className="flex-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold outline-none cursor-pointer"
                            >
                              <option value="" disabled>-- Choose Shop to Visit --</option>
                              {customers
                                .filter(c => c.location && c.location.lat)
                                .map(c => (
                                  <option key={c.id} value={c.id}>{c.shopName}</option>
                                ))}
                            </select>
                            <button
                              onClick={handleSimulateCheckIn}
                              disabled={isSimulating || !simSelectedCustomer}
                              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-60 transition-colors shrink-0"
                            >
                              Check-in
                            </button>
                          </div>
                        </div>

                        {/* Cash collection */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">2. Log Cash Payment Collection</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              placeholder="Amount in ₹"
                              value={simCollectionAmount}
                              onChange={e => setSimCollectionAmount(e.target.value)}
                              disabled={!selectedStaff.currentShopId || isSimulating}
                              className="flex-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs font-bold outline-none placeholder-slate-400 disabled:opacity-50"
                            />
                            <button
                              onClick={handleSimulateCollection}
                              disabled={isSimulating || !simCollectionAmount || !selectedStaff.currentShopId}
                              className="py-2.5 px-4 bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer disabled:opacity-60 transition-colors shrink-0"
                            >
                              Collect Cash
                            </button>
                          </div>
                          {!selectedStaff.currentShopId && (
                            <span className="text-[10px] text-amber-500 font-semibold block">⚠️ Please perform a check-in visit first.</span>
                          )}
                        </div>
                      </div>

                      {/* Hardware metrics simulations */}
                      <div className="space-y-4">
                        {/* Battery slide */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px] font-black uppercase text-slate-550 dark:text-slate-400 tracking-wider">
                            <span>3. Set Battery: {simBattery}%</span>
                            <span className="flex items-center gap-1">
                              <input 
                                type="checkbox" 
                                id="chargingCheckbox" 
                                checked={simCharging} 
                                onChange={handleSimulateChargingToggle} 
                                className="cursor-pointer"
                              />
                              <label htmlFor="chargingCheckbox" className="cursor-pointer">Charging (⚡)</label>
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={simBattery}
                            onChange={e => handleSimulateBatteryChange(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                          />
                        </div>

                        {/* Network toggle & End Shift */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider block">4. Telemetry State Actions</label>
                          <div className="flex flex-wrap gap-2.5">
                            <button
                              onClick={handleSimulateNetworkToggle}
                              className={`py-2 px-3 border rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                selectedStaff.networkStatus === 'online'
                                  ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                              }`}
                            >
                              {selectedStaff.networkStatus === 'online' ? 'Disconnect Wifi (Offline)' : 'Connect Wifi (Online)'}
                            </button>
                            
                            <button
                              onClick={handleSimulateEndShift}
                              disabled={isSimulating}
                              className="py-2 px-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              End Staff Shift
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-3xl bg-amber-55/50 dark:bg-amber-955/10 border border-amber-500/20 text-amber-600 dark:text-amber-450 text-xs font-bold flex items-center gap-2.5">
                    <span className="p-1 bg-amber-100 dark:bg-amber-950/40 rounded-lg">⚠️</span>
                    <span>Mock simulation tools are disabled when viewing historical dates. Change back to today's date to simulate shift events.</span>
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
