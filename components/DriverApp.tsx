import React, { useState, useEffect } from 'react';
import { useLogistics } from '../services/logisticsContext';
import { Button } from './Button';
import { Map } from './Map';
import { DispatchChat } from './DispatchChat';
import { CargoItem, DeliveryStatus, UserRole } from '../types';

export const DriverApp: React.FC = () => {
  const { user, drivers, merchants, toggleStatus, updateLocation, updateCargo, updateDeliveryStatus, logout, setRole, deliverItem } = useLogistics();
  const currentDriver = drivers?.find(d => d.id === user?.id);
  const isOnline = currentDriver?.isOnline || false;
  
  const [cargoName, setCargoName] = useState('');
  const [cargoQty, setCargoQty] = useState('');
  const [cargoDest, setCargoDest] = useState('');
  const [merchantId, setMerchantId] = useState('');
  
  // Confirmation State
  const [pendingItem, setPendingItem] = useState<CargoItem | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');

  const [showMap, setShowMap] = useState(true);

  // Derived State
  const activeCargo = currentDriver?.cargo?.filter(c => c.status !== 'DELIVERED') || [];
  const taskCount = activeCargo.length;

  // Grouped and Sorted Cargo Logic
  const groupedCargo = React.useMemo(() => {
    const groups: Record<string, CargoItem[]> = {};
    activeCargo.forEach(item => {
      if (!groups[item.merchantId]) groups[item.merchantId] = [];
      groups[item.merchantId].push(item);
    });
    return groups;
  }, [activeCargo]);

  const sortedMerchantIds = React.useMemo(() => {
    // Keep consistent order based on the first item of each merchant added to manifest
    const ids: string[] = [];
    currentDriver?.cargo?.forEach(item => {
      if (item.status !== 'DELIVERED' && !ids.includes(item.merchantId)) {
        ids.push(item.merchantId);
      }
    });
    return ids;
  }, [currentDriver?.cargo]);

  // Geolocation Loop
  useEffect(() => {
    let watchId: number;

    if (isOnline) {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            updateLocation(position.coords.latitude, position.coords.longitude);
          },
          (error) => console.error("Geo error:", error),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOnline, updateLocation]);

  const handleAddCargo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cargoName || !cargoQty || !merchantId) return;
    
    const qty = parseInt(cargoQty);
    if (qty <= 0) {
      alert("Quantity must be greater than 0");
      return;
    }

    const newItem: CargoItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: cargoName,
      quantity: qty,
      destination: cargoDest || 'Unspecified',
      merchantId
    };

    updateCargo([...(currentDriver?.cargo || []), newItem]);
    setCargoName('');
    setCargoQty('');
    setCargoDest('');
    setMerchantId('');
  };

  const removeCargo = (id: string) => {
    updateCargo((currentDriver?.cargo || []).filter(c => c.id !== id));
  };

  const handleToggleStatus = (newStatus: boolean) => {
    if (!newStatus && taskCount > 0) {
      alert("You cannot end your shift while you have remaining tasks. Please deliver all cargo first.");
      return;
    }
    
    toggleStatus(newStatus);
    if (newStatus) {
      updateDeliveryStatus('IN_TRANSIT');
    }
  };

  const handleDeliverItem = async (proof?: string, signature?: string) => {
    if (!pendingItem) return;
    try {
      // Mark as delivered in database
      await deliverItem(pendingItem.id, proof, signature);
      // Reset state
      setPendingItem(null);
      setPhotoPreview(null);
      setSignatureName('');
    } catch (error) {
      console.error("Failed to deliver item:", error);
      alert("Failed to confirm delivery. Please try again.");
    }
  };

  const statusConfig: Record<DeliveryStatus, { activeClass: string, inactiveClass: string, icon: React.ReactNode, label: string }> = {
    'IN_TRANSIT': {
      activeClass: 'bg-blue-600 border-blue-400 text-white shadow-blue-900/50',
      inactiveClass: 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-blue-900/20 hover:border-blue-500/50',
      label: 'In Transit',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      )
    },
    'DELIVERED': {
      activeClass: 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/50',
      inactiveClass: 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-emerald-900/20 hover:border-emerald-500/50',
      label: 'Delivered',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    'DELAYED': {
      activeClass: 'bg-yellow-500 border-yellow-400 text-black shadow-yellow-900/50',
      inactiveClass: 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-yellow-900/20 hover:border-yellow-500/50',
      label: 'Delayed',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white max-w-md mx-auto w-full shadow-2xl relative">
      {/* Header */}
      <header className="p-6 bg-slate-800 border-b border-slate-700 flex justify-between items-center sticky top-0 z-10 shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Island Sync Driver</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-400 font-mono">ID: {user?.id.slice(0, 8)}...</span>
            <button 
              onClick={() => setRole(UserRole.NONE)} 
              className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-colors uppercase font-bold"
            >
              Switch Role
            </button>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-slate-400 hover:text-white font-medium bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors">Sign Out</button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Status Toggle */}
        <section className="text-center space-y-4 relative">
          <div className={`inline-flex p-1 rounded-full ${isOnline ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
            <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isOnline ? 'text-emerald-500' : 'text-slate-500'}`}>
              {isOnline ? 'Broadcasting Live' : 'Offline'}
            </div>
          </div>
          
          <button 
            onClick={() => handleToggleStatus(!isOnline)}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center mx-auto transition-all duration-300 shadow-2xl ${
              isOnline 
                ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30 scale-100' 
                : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30 hover:scale-105'
            }`}
          >
            <span className="text-2xl font-bold">{isOnline ? 'STOP' : 'START'}</span>
            <span className="text-xs opacity-80 mt-1">{isOnline ? 'End Shift' : 'Start Trip'}</span>
          </button>

          {/* Messaging Button - Lower Right of STOP button */}
          <DispatchChat 
            positioning="absolute bottom-[-10px] right-[calc(50%-165px)] scale-90" 
            buttonSize="w-12 h-12"
            fullScreen={true}
          />

          {/* Task Counter */}
          {isOnline && (
            <div className="absolute top-0 right-0 bg-slate-800 border border-slate-700 p-2 rounded-xl shadow-lg flex flex-col items-center animate-in fade-in zoom-in duration-300">
              <div className="text-blue-400 mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                </svg>
              </div>
              <div className="text-2xl font-bold text-white leading-none">{taskCount}</div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Tasks Left</div>
            </div>
          )}
        </section>

        {/* Delivery Status Selector */}
        {isOnline && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Current Status</h2>
            <div className="grid grid-cols-3 gap-2">
              {(['IN_TRANSIT', 'DELIVERED', 'DELAYED'] as DeliveryStatus[]).map((status) => {
                const isActive = currentDriver?.status === status;
                const config = statusConfig[status];
                
                return (
                  <button
                    key={status}
                    onClick={() => {
                      updateDeliveryStatus(status);
                    }}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center shadow-lg ${
                      isActive 
                        ? config.activeClass
                        : config.inactiveClass
                    }`}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Live Map Tracking */}
        {isOnline && (
          <section className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Map</h2>
              <button 
                onClick={() => setShowMap(!showMap)}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase"
              >
                {showMap ? 'Hide Map' : 'Show Map'}
              </button>
            </div>
            
            {showMap && (
              <div className="h-64 w-full rounded-xl overflow-hidden border border-slate-700 shadow-lg relative bg-slate-800 animate-in fade-in slide-in-from-top-2 duration-300">
                 <Map 
                   drivers={drivers} 
                   merchants={merchants}
                   selectedDriverId={user?.id || null} 
                   onSelectDriver={() => {}} 
                   showOnlyActiveDestination={true}
                 />
                 <div className="absolute bottom-2 right-2 bg-slate-900/80 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-400 border border-slate-700 pointer-events-none">
                   Live Tracking
                 </div>
              </div>
            )}
          </section>
        )}

        {/* Cargo Manifest */}
        <section className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-lg font-semibold text-slate-300">
            {isOnline ? 'Active Manifest' : 'Build Manifest'}
          </h2>
          
          {!isOnline && (
            <form onSubmit={handleAddCargo} className="grid grid-cols-12 gap-2 animate-in slide-in-from-top-2 duration-300">
              <input 
                className="col-span-12 bg-slate-800 border border-slate-700 rounded p-3 text-sm focus:border-blue-500 outline-none placeholder-slate-500" 
                placeholder="Item Name" 
                value={cargoName} 
                onChange={e => setCargoName(e.target.value)} 
              />
              <input 
                className="col-span-4 bg-slate-800 border border-slate-700 rounded p-3 text-sm focus:border-blue-500 outline-none placeholder-slate-500" 
                type="number" 
                placeholder="Qty" 
                value={cargoQty} 
                onChange={e => setCargoQty(e.target.value)} 
              />
              <input 
                className="col-span-8 bg-slate-800 border border-slate-700 rounded p-3 text-sm focus:border-blue-500 outline-none placeholder-slate-500" 
                placeholder="desc." 
                value={cargoDest} 
                onChange={e => setCargoDest(e.target.value)} 
              />
              <select
                className="col-span-12 bg-slate-800 border border-slate-700 rounded p-4 text-sm focus:border-blue-500 outline-none text-slate-100 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%2364748b%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_1rem_center] bg-no-repeat pr-12 shadow-inner transition-all hover:border-slate-600"
                value={merchantId}
                onChange={e => setMerchantId(e.target.value)}
                required
              >
                <option value="" disabled className="bg-slate-900">Select Merchant</option>
                {merchants.map(m => (
                  <option key={m.id} value={m.id} className="bg-slate-900 py-2">{m.name}</option>
                ))}
              </select>
              <Button type="submit" fullWidth className="col-span-12 py-2 text-sm" variant="secondary">
                + Log Cargo
              </Button>
            </form>
          )}

          <div className="space-y-6 mt-4">
            {sortedMerchantIds.length === 0 && (
              <p className="text-center text-slate-600 text-sm py-4">No active cargo logged.</p>
            )}
            
            {sortedMerchantIds.map((mId, index) => {
              const merchantItems = groupedCargo[mId];
              const merchant = merchants.find(m => m.id === mId);
              const isPriority = index === 0;

              return (
                <div key={mId} className={`space-y-3 p-4 rounded-2xl border transition-all ${
                  isPriority 
                    ? 'bg-blue-600/5 border-blue-500/30 ring-1 ring-blue-500/10' 
                    : 'bg-slate-800/40 border-slate-700/50 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isPriority ? 'bg-blue-600 shadow-lg shadow-blue-900/40' : 'bg-slate-700'}`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${merchant?.latitude},${merchant?.longitude}`}
                          target="_blank"
                          className="hover:opacity-80 transition-opacity"
                        >
                          <h3 className={`font-bold text-sm truncate ${isPriority ? 'text-blue-400' : 'text-slate-400'}`}>
                            {merchant?.name || 'Unknown Merchant'}
                          </h3>
                        </a>
                        {isPriority && (
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-blue-500">Current Destination</span>
                            <a 
                              href={`https://www.google.com/maps/dir/?api=1&destination=${merchant?.latitude},${merchant?.longitude}`}
                              target="_blank"
                              className="text-[9px] font-bold text-blue-400 hover:text-blue-300 underline flex items-center gap-0.5"
                            >
                              <span>Directions</span>
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-900 text-slate-500 px-2 py-0.5 rounded-full font-bold">
                      {merchantItems.length} ITEMS
                    </span>
                  </div>

                  <div className="space-y-2">
                    {merchantItems.map(item => (
                      <div key={item.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between group">
                        <div className="min-w-0 flex-1 mr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-200 truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">x{item.quantity}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{item.destination}</div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCargo(item.id);
                            }}
                            className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                            title="Remove from Manifest"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingItem(item);
                              setPhotoPreview(null);
                              setSignatureName('');
                            }}
                            className={`${
                              isPriority 
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                            } p-2 rounded-lg transition-all flex items-center justify-center`}
                            disabled={!isPriority}
                            title={isPriority ? "Complete Delivery" : "Waiting for current stop"}
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Debug Info */}
        <div className="text-[10px] text-slate-600 font-mono text-center pt-8 pb-4">
          LAT: {currentDriver?.latitude.toFixed(6)} | LNG: {currentDriver?.longitude.toFixed(6)}
        </div>
      </div>

      {/* Confirmation Modal (For Item Delivery) */}
      {pendingItem && (
        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-sm space-y-6 text-center overflow-y-auto max-h-full py-4">
            <div className="mx-auto h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-white">
              Confirm Item Delivery
            </h2>
            <p className="text-slate-400 text-sm">
              Verifying delivery for: {pendingItem.name}
            </p>

            {/* Photo Capture Area */}
            <div className="relative group">
              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl aspect-video bg-black">
                  <img src={photoPreview} alt="Proof of Delivery" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setPhotoPreview(null)}
                    className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-rose-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="block w-full aspect-video rounded-xl border-2 border-dashed border-slate-600 hover:border-emerald-500 hover:bg-slate-800/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group">
                  <div className="p-3 bg-slate-800 rounded-full group-hover:bg-emerald-500/20 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400 group-hover:text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-400">Tap to Capture Photo</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setPhotoPreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* Signature Area */}
            <div className="text-left space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase">Merchant Signature (Name)</label>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Enter merchant name to sign"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <p className="text-[10px] text-slate-500">By entering the name above, the merchant acknowledges receipt of goods.</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button 
                onClick={() => {
                  setPendingItem(null);
                  setPhotoPreview(null);
                  setSignatureName('');
                }}
                className="py-3 px-4 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={!signatureName}
                onClick={async () => {
                  if (pendingItem) {
                    await handleDeliverItem(photoPreview || undefined, signatureName);
                  }
                  setPendingItem(null);
                  setPhotoPreview(null);
                  setSignatureName('');
                }}
                className={`py-3 px-4 rounded-xl font-bold shadow-lg transition-colors ${
                  signatureName 
                    ? 'bg-emerald-600 text-white shadow-emerald-900/50 hover:bg-emerald-500' 
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                Confirm Delivery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
