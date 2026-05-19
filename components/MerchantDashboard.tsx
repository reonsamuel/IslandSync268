import React, { useState } from 'react';
import { useLogistics } from '../services/logisticsContext';
import { Map } from './Map';
import { DeliveryStatus, UserRole, Merchant, Driver } from '../types';

export const MerchantDashboard: React.FC = () => {
  const { 
    drivers, 
    merchants, 
    user, 
    logout, 
    setRole, 
    merchantUpdateDriver, 
    addMerchant, 
    updateMerchant, 
    deleteMerchant,
    setActiveChatId,
    setIsChatOpen,
    isChatOpen,
    conversations
  } = useLogistics();
  
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMerchantAdminOpen, setIsMerchantAdminOpen] = useState(false);
  const [isAddingMerchant, setIsAddingMerchant] = useState(false);
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null);
  
  // Form state
  const [mName, setMName] = useState('');
  const [mSector, setMSector] = useState('');
  const [mLat, setMLat] = useState<number | null>(null);
  const [mLng, setMLng] = useState<number | null>(null);
  const [gMapsLink, setGMapsLink] = useState('');
  const [justAutoFilled, setJustAutoFilled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setMName('');
    setMSector('');
    setMLat(null);
    setMLng(null);
    setGMapsLink('');
    setIsAddingMerchant(false);
    setEditingMerchantId(null);
    setJustAutoFilled(false);
    setFormError(null);
  };

  const parseGoogleMapsLink = (url: string) => {
    // Try to match @lat,lng
    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const atMatch = url.match(atRegex);
    if (atMatch) {
      return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
    }

    // Try to match q=lat,lng
    const qRegex = /q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const qMatch = url.match(qRegex);
    if (qMatch) {
      return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
    }

    // Try to match !3dlat!2dlng or !1dlng!3dlat (from embed links/iframes)
    const embedLatRegex = /!3d(-?\d+\.\d+)/;
    const embedLngRegex = /!(?:1|2)d(-?\d+\.\d+)/;
    const eLatMatch = url.match(embedLatRegex);
    const eLngMatch = url.match(embedLngRegex);
    if (eLatMatch && eLngMatch) {
      return { lat: parseFloat(eLatMatch[1]), lng: parseFloat(eLngMatch[2]) };
    }

    return null;
  };

  const handleLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGMapsLink(val);
    const coords = parseGoogleMapsLink(val);
    if (coords) {
      setMLat(coords.lat);
      setMLng(coords.lng);
      setJustAutoFilled(true);
      // Reset the "just filled" state after some time
      setTimeout(() => setJustAutoFilled(false), 3000);
    }
  };

  const handleEditMerchant = (m: Merchant) => {
    setEditingMerchantId(m.id);
    setMName(m.name);
    setMSector(m.sector);
    setMLat(m.latitude);
    setMLng(m.longitude);
    setGMapsLink('');
    setIsAddingMerchant(true);
  };

  const handleSaveMerchant = async () => {
    if (!mName) {
      setFormError('Please enter a merchant name.');
      return;
    }
    if (mLat === null || mLng === null || isNaN(mLat) || isNaN(mLng)) {
      setFormError('Please provide a Google Maps link to set the location.');
      return;
    }
    if (!mSector) {
      setFormError('Please specify the sector (e.g. Food, Retail).');
      return;
    }

    setFormError(null);
    const data = {
      name: mName,
      sector: mSector,
      latitude: mLat,
      longitude: mLng
    };

    if (editingMerchantId) {
      await updateMerchant(editingMerchantId, data);
    } else {
      await addMerchant(data);
    }
    resetForm();
  };

  const visibleDrivers = drivers?.filter(driver => {
    const hasActiveCargo = driver.cargo && driver.cargo.some(c => c.status !== 'DELIVERED');
    return driver.isOnline || hasActiveCargo || driver.id === selectedDriverId;
  }) || [];

  const selectedDriver = drivers?.find(d => d.id === selectedDriverId);
  const activeDrivers = drivers?.filter(d => d.isOnline).length || 0;
  const totalCargo = drivers?.reduce((acc, d) => acc + (d.cargo?.filter(c => c.status !== 'DELIVERED').reduce((sum, c) => sum + c.quantity, 0) || 0), 0) || 0;

  const getStatusIcon = (status: DeliveryStatus) => {
    switch (status) {
      case 'IN_TRANSIT':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        );
      case 'DELAYED':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'DELIVERED':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default: return null;
    }
  };

  const getStatusBadge = (status: DeliveryStatus) => {
    switch (status) {
      case 'IN_TRANSIT': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DELIVERED': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'DELAYED': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col z-20 shadow-xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 relative">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
              <h1 className="font-bold text-lg tracking-tight">Island Sync</h1>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Message Toggle */}
              <button 
                onClick={() => setIsChatOpen(!isChatOpen)}
                className={`p-1.5 rounded-lg transition-all border relative ${
                  isChatOpen ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="Open Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                </svg>
                {conversations.some(c => c.unreadMerchant) && !isChatOpen && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-950 animate-pulse" />
                )}
              </button>

              {/* Merchant Admin Toggle */}
              <button 
                onClick={() => setIsMerchantAdminOpen(!isMerchantAdminOpen)}
                className={`p-1.5 rounded-lg transition-all border ${
                  isMerchantAdminOpen ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
                title="Manage Merchants"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </button>

              {/* User Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className={`p-1.5 rounded-lg transition-all border ${
                    isUserMenuOpen ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 py-2">
                       <div className="px-4 py-2 border-b border-slate-800 mb-1">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Admin Account</p>
                        <p className="text-sm font-medium text-slate-200 truncate">{user?.name}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setRole(UserRole.NONE);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:bg-blue-600/10 hover:text-blue-400 transition-colors flex items-center gap-3"
                      >
                        Switch to Driver View
                      </button>
                      <button 
                        onClick={logout}
                        className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-rose-600/10 transition-colors flex items-center gap-3"
                      >
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <p className="px-6 py-2 text-xs text-slate-500">Merchant User: {user?.name}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-800">
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400 uppercase font-semibold">Active</div>
            <div className="text-2xl font-bold text-emerald-400">{activeDrivers}</div>
          </div>
          <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
            <div className="text-xs text-slate-400 uppercase font-semibold">Cargo Units</div>
            <div className="text-2xl font-bold text-blue-400">{totalCargo}</div>
          </div>
        </div>

        {/* Driver List */}
        <div className="flex-1 overflow-y-auto">
          <h2 className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fleet Status</h2>
          <div className="space-y-1 px-2">
            {visibleDrivers.map(driver => {
              const conversation = conversations.find(c => c.chatId === driver.id);
              const isUnread = conversation?.unreadMerchant;
              
              return (
                <button
                  key={driver.id}
                  onClick={() => setSelectedDriverId(driver.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${
                    selectedDriverId === driver.id ? 'bg-blue-600/10 border border-blue-500/20 shadow-lg shadow-blue-900/10' : 'hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-2.5 h-2.5 rounded-full ${driver.isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                    {isUnread && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <div className={`text-sm font-bold truncate ${isUnread ? 'text-blue-400' : (selectedDriverId === driver.id ? 'text-blue-400' : 'text-slate-200')}`}>
                         {driver.name}
                      </div>
                      <span className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border ${getStatusBadge(driver.status)}`}>
                        {driver.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1.5">
                       <div className="flex items-center gap-1.5">
                         {getStatusIcon(driver.status)}
                         <span className="text-[10px] font-mono text-slate-500">
                            {driver.latitude.toFixed(3)}, {driver.longitude.toFixed(3)}
                         </span>
                       </div>
                       <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-bold">{driver.cargo.filter(c => c.status !== 'DELIVERED').length} U</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <span>System Online</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative">
        <Map 
          drivers={visibleDrivers} 
          merchants={merchants}
          selectedDriverId={selectedDriverId} 
          onSelectDriver={setSelectedDriverId}
          draftLocation={(typeof mLat === 'number' && typeof mLng === 'number' && !isNaN(mLat) && !isNaN(mLng)) ? { lat: mLat, lng: mLng } : undefined}
        />
        
        {/* Merchant Admin Overlay Panel */}
        {isMerchantAdminOpen && (
          <div className={`absolute inset-y-0 left-0 w-96 bg-slate-900/95 backdrop-blur-xl border-r border-slate-700 shadow-2xl z-[4000] flex flex-col animate-in slide-in-from-left duration-300 transition-all`}>
             <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-indigo-600/5">
                <div>
                  <h2 className="font-bold text-lg text-indigo-400">Merchant Directory</h2>
                  <p className="text-xs text-slate-500">Manage supply chain points</p>
                </div>
                <button onClick={() => setIsMerchantAdminOpen(false)} className="text-slate-400 hover:text-white">
                   <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isAddingMerchant ? (
                  <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-4 shadow-inner">
                    <h3 className="font-bold text-sm text-slate-200">{editingMerchantId ? 'Edit Merchant' : 'Add New Merchant'}</h3>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 border-b border-indigo-900/50 pb-1 mb-2 block uppercase tracking-tighter">1. Identity</label>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Merchant Name</label>
                      <input 
                        value={mName}
                        onChange={(e) => {
                          setMName(e.target.value);
                          if (formError && e.target.value) setFormError(null);
                        }}
                        className={`w-full bg-slate-900 border ${formError && !mName ? 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'border-slate-700'} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-colors`}
                        placeholder="e.g. Island Provision"
                      />
                    </div>

                    <div className="space-y-1 pt-2">
                       <label className="text-[10px] font-bold text-indigo-400 border-b border-indigo-900/50 pb-1 mb-2 block uppercase tracking-tighter">2. Location (Google Maps Link)</label>
                      <div className="relative">
                        <input 
                          value={gMapsLink}
                          onChange={handleLinkChange}
                          className={`w-full bg-slate-900 border ${
                            formError && (mLat === null || isNaN(mLat || 0)) ? 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 
                            justAutoFilled ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-700'
                          } rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all pr-10`}
                          placeholder="Paste link to auto-fill"
                        />
                        <div className="absolute right-3 top-3 text-slate-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.826a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-500 italic mt-1 leading-tight">Paste a link from Google Maps (Search for place → Share → Copy Link)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pb-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Latitude</label>
                        <input 
                          readOnly
                          value={mLat?.toFixed(6) || ''}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                          placeholder="0.0000"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Longitude</label>
                        <input 
                          readOnly
                          value={mLng?.toFixed(6) || ''}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                          placeholder="0.0000"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 pt-2">
                       <label className="text-[10px] font-bold text-indigo-400 border-b border-indigo-900/50 pb-1 mb-2 block uppercase tracking-tighter">3. Sector</label>
                      <input 
                        value={mSector}
                        onChange={(e) => {
                          setMSector(e.target.value);
                          if (formError && e.target.value) setFormError(null);
                        }}
                        className={`w-full bg-slate-900 border ${formError && !mSector ? 'border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'border-slate-700'} rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none transition-colors`}
                        placeholder="e.g. Food & Beverage"
                      />
                    </div>
                    
                    {formError && (
                      <div className="bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                        <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span className="text-[10px] font-bold text-rose-400">{formError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-700">
                      <button 
                        onClick={resetForm}
                        className="py-2.5 rounded-lg text-[10px] font-bold uppercase text-slate-400 hover:text-slate-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveMerchant}
                        className={`py-2.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-lg ${
                          justAutoFilled 
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse scale-105' 
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                        }`}
                      >
                        {editingMerchantId ? 'Update' : 'Save Merchant'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAddingMerchant(true)}
                    className="w-full p-4 border-2 border-dashed border-slate-700 rounded-2xl text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-sm font-bold flex items-center justify-center gap-2 group"
                  >
                    <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                    New Merchant Location
                  </button>
                )}

                <div className="space-y-2">
                  <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] px-2 mb-3">Saved Points</h3>
                  {(!merchants || merchants.length === 0) ? (
                    <div className="text-center py-12 px-6">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-50">
                         <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                      </div>
                      <p className="text-sm text-slate-600">No points added yet</p>
                    </div>
                  ) : merchants.map(m => (
                    <div key={m.id} className="group overflow-hidden bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-slate-200">{m.name}</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{m.sector}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditMerchant(m)} className="p-2 text-slate-500 hover:text-indigo-400 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            </button>
                            <button onClick={() => deleteMerchant(m.id)} className="p-2 text-slate-500 hover:text-rose-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-3 text-[10px] font-mono text-slate-600 bg-slate-950/50 p-2 rounded-lg">
                          <span className="flex items-center gap-1"><span className="text-indigo-500/50 font-bold">LAT:</span>{typeof m.latitude === 'number' && !isNaN(m.latitude) ? m.latitude.toFixed(5) : 'ERR'}</span>
                          <span className="flex items-center gap-1"><span className="text-indigo-500/50 font-bold">LNG:</span>{typeof m.longitude === 'number' && !isNaN(m.longitude) ? m.longitude.toFixed(5) : 'ERR'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {/* Cargo Detail Overlay Panel */}
        {selectedDriver && (
          <div className="absolute top-4 right-4 w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 shadow-2xl rounded-2xl overflow-hidden z-[2000] animate-in slide-in-from-right-8 fade-in duration-300">
            <div className="bg-slate-800/50 p-5 border-b border-slate-700/50 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <img src={selectedDriver.avatar} alt="" className="w-10 h-10 rounded-full border-2 border-slate-600" />
                <div>
                  <h3 className="font-bold text-slate-100">{selectedDriver.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(selectedDriver.status)}`}>
                        {selectedDriver.status.replace('_', ' ')}
                    </span>
                    <button 
                      onClick={() => {
                        setActiveChatId(selectedDriver.id);
                        setIsChatOpen(true);
                      }}
                      className="ml-1 p-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded transition-colors"
                      title="Message Driver"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                        <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedDriverId(null)} className="text-slate-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="p-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fleet Actions</h4>
              <div className="grid grid-cols-2 gap-2 mb-6">
                <button 
                  onClick={() => merchantUpdateDriver(selectedDriver.id, { isOnline: false })}
                  className="py-2 px-3 rounded bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-[10px] font-bold uppercase transition-all border border-rose-600/30"
                >
                  Force Offline
                </button>
                <button 
                  onClick={() => merchantUpdateDriver(selectedDriver.id, { status: selectedDriver.status === 'DELAYED' ? 'IN_TRANSIT' : 'DELAYED' })}
                  className={`py-2 px-3 rounded text-[10px] font-bold uppercase transition-all border ${
                    selectedDriver.status === 'DELAYED' 
                      ? 'bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-600/30' 
                      : 'bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 border-amber-600/30'
                  }`}
                >
                  {selectedDriver.status === 'DELAYED' ? 'Clear Delay' : 'Mark Delayed'}
                </button>
              </div>

              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cargo Manifest</h4>
              <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                {selectedDriver.cargo.length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-4">Vehicle Empty</p>
                ) : (() => {
                  const items = selectedDriver.cargo;
                  const activeItems = items.filter(i => i.status !== 'DELIVERED');
                  const deliveredItems = items.filter(i => i.status === 'DELIVERED');
                  
                  // Group active items by merchant
                  const groupedActive: Record<string, typeof items> = {};
                  activeItems.forEach(i => {
                    if (!groupedActive[i.merchantId]) groupedActive[i.merchantId] = [];
                    groupedActive[i.merchantId].push(i);
                  });

                  // Maintain order of merchants as they appear in the original list
                  const sortedMerchantIds: string[] = [];
                  items.forEach(i => {
                    if (i.status !== 'DELIVERED' && !sortedMerchantIds.includes(i.merchantId)) {
                      sortedMerchantIds.push(i.merchantId);
                    }
                  });

                  return (
                    <>
                      {/* Priority Stops */}
                      {sortedMerchantIds.map((mId, idx) => {
                        const mItems = groupedActive[mId];
                        const merchant = merchants?.find(m => m.id === mId);
                        const isPriority = idx === 0;

                        return (
                          <div key={mId} className={`p-3 rounded-xl border transition-all ${
                            isPriority ? 'bg-blue-600/10 border-blue-500/30' : 'bg-slate-950 border-slate-800 opacity-60'
                          }`}>
                            <div className="flex justify-between items-center mb-2">
                              <div>
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isPriority ? 'text-blue-500' : 'text-slate-500'}`}>
                                  {isPriority ? 'Next Stop' : 'Upcoming'}
                                </span>
                                <div className={`text-xs font-bold ${isPriority ? 'text-blue-200' : 'text-slate-400'}`}>
                                  {merchant?.name || 'Unknown Merchant'}
                                </div>
                              </div>
                              <div className="text-[10px] bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                                {mItems.length}
                              </div>
                            </div>
                            <div className="space-y-1">
                              {mItems.map(item => (
                                <div key={item.id} className="flex justify-between items-center text-[11px] bg-slate-900/50 p-1.5 rounded">
                                  <span className="text-slate-300 truncate mr-2">{item.name}</span>
                                  <span className="text-blue-400 font-mono font-bold">x{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Delivered Items Section */}
                      {deliveredItems.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-slate-800">
                          <h5 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Delivered Goods</h5>
                          <div className="space-y-1">
                            {deliveredItems.map(item => (
                              <div key={item.id} className="flex justify-between items-center text-[10px] bg-emerald-500/5 border border-emerald-500/10 p-2 rounded opacity-60">
                                <span className="text-emerald-400/80 line-through truncate mr-2">{item.name}</span>
                                <span className="text-emerald-500/50 font-bold italic">Signed</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-600 font-mono flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>LAT: {selectedDriver.latitude.toFixed(4)}</span>
                  <span>LNG: {selectedDriver.longitude.toFixed(4)}</span>
                </div>
                {selectedDriver.signature && (
                  <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="block text-slate-500 mb-1">Signed by:</span>
                    <span className="font-handwriting text-lg text-emerald-400 font-bold italic">{selectedDriver.signature}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
