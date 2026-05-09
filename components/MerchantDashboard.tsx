import React, { useState } from 'react';
import { useLogistics } from '../services/logisticsContext';
import { Map } from './Map';
import { DeliveryStatus, UserRole } from '../types';

export const MerchantDashboard: React.FC = () => {
  const { drivers, user, logout, setRole } = useLogistics();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const activeDrivers = drivers.filter(d => d.isOnline).length;
  const totalCargo = drivers.reduce((acc, d) => acc + (d.cargo?.filter(c => c.status !== 'DELIVERED').reduce((sum, c) => sum + c.quantity, 0) || 0), 0);

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

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'IN_TRANSIT': return 'text-blue-400';
      case 'DELIVERED': return 'text-emerald-400';
      case 'DELAYED': return 'text-amber-400';
      default: return 'text-slate-400';
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
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="font-bold text-lg tracking-tight">Island Sync</h1>
          </div>
          <p className="text-xs text-slate-500">Merchant: {user?.name}</p>
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
            {drivers.map(driver => (
              <button
                key={driver.id}
                onClick={() => setSelectedDriverId(driver.id)}
                className={`w-full text-left px-4 py-3 rounded-md flex items-center gap-3 transition-colors ${
                  selectedDriverId === driver.id ? 'bg-blue-600/10 border border-blue-600/30' : 'hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${driver.isOnline ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <div className={`text-sm font-medium truncate ${selectedDriverId === driver.id ? 'text-blue-400' : 'text-slate-300'}`}>
                      {driver.name}
                    </div>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${getStatusColor(driver.status)}`}>
                      {driver.status.replace('_', ' ')}
                    </span>
                  </div>
                      <div className="flex justify-between items-center mt-1">
                         <div className="flex items-center gap-1">
                           {getStatusIcon(driver.status)}
                           <span className="text-xs text-slate-500">
                              {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                           </span>
                         </div>
                         <span className="text-xs text-slate-500">{driver.cargo.filter(c => c.status !== 'DELIVERED').length} active</span>
                      </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button 
            onClick={() => setRole(UserRole.NONE)}
            className="w-full py-2 px-4 rounded bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-sm transition-colors border border-blue-600/30"
          >
            Switch to Driver View
          </button>
          <button 
            onClick={logout}
            className="w-full py-2 px-4 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 text-sm transition-colors border border-slate-800"
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative">
        <Map 
          drivers={drivers} 
          selectedDriverId={selectedDriverId} 
          onSelectDriver={setSelectedDriverId}
        />
        
        {/* Cargo Detail Overlay Panel */}
        {selectedDriver && (
          <div className="absolute top-4 right-4 w-80 bg-slate-900/95 backdrop-blur-sm border border-slate-700 shadow-2xl rounded-xl overflow-hidden z-30 animate-in slide-in-from-right fade-in duration-200">
            <div className="bg-slate-800 p-4 flex justify-between items-start">
              <div className="flex items-center gap-3">
                <img src={selectedDriver.avatar} alt="" className="w-10 h-10 rounded-full border-2 border-slate-600" />
                <div>
                  <h3 className="font-bold text-slate-100">{selectedDriver.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadge(selectedDriver.status)}`}>
                        {selectedDriver.status.replace('_', ' ')}
                    </span>
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
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cargo Manifest</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedDriver.cargo.length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-4">Vehicle Empty</p>
                ) : (
                  selectedDriver.cargo.map(item => (
                    <div key={item.id} className={`p-3 rounded border text-sm transition-all ${
                      item.status === 'DELIVERED' ? 'bg-emerald-500/5 border-emerald-500/20 opacity-80' : 'bg-slate-950 border-slate-800'
                    }`}>
                      <div className="flex justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${item.status === 'DELIVERED' ? 'text-emerald-400 line-through' : 'text-slate-300'}`}>
                            {item.name}
                          </span>
                          {item.status === 'DELIVERED' && (
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded uppercase font-bold">Done</span>
                          )}
                        </div>
                        <span className="text-blue-400 font-mono">x{item.quantity}</span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {item.destination}
                        </div>
                        {item.signature && (
                          <span className="text-[10px] text-emerald-500/70 italic font-medium">Signed: {item.signature}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
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
