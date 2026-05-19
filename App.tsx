import React from 'react';
import { LogisticsProvider, useLogistics } from './services/logisticsContext';
import { Auth } from './components/Auth';
import { DriverApp } from './components/DriverApp';
import { MerchantDashboard } from './components/MerchantDashboard';
import { DispatchChat } from './components/DispatchChat';
import { UserRole } from './types';

const AppContent: React.FC = () => {
  const { user, isAuthLoading } = useLogistics();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user || user.role === UserRole.NONE) {
    return <Auth />;
  }

  return (
    <>
      {user.role === UserRole.DRIVER ? <DriverApp /> : <MerchantDashboard />}
      {user.role === UserRole.MERCHANT && <DispatchChat />}
    </>
  );
};

const App: React.FC = () => {
  return (
    <LogisticsProvider>
      <AppContent />
    </LogisticsProvider>
  );
};

export default App;
