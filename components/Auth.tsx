import React, { useState } from 'react';
import { useLogistics } from '../services/logisticsContext';
import { UserRole } from '../types';
import { Button } from './Button';

export const Auth: React.FC = () => {
  const { login, signUp, user, setRole, logout } = useLogistics();
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setError(null);
    try {
      if (authMode === 'login') {
        await login(formData.username, formData.password);
      } else {
        await signUp(formData.username, formData.password, formData.name);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 mb-6 group hover:scale-110 transition-transform cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Island Sync</h2>
            <p className="mt-2 text-slate-400">Logistics tracking for Antigua & Barbuda</p>
          </div>
          
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-6">
              {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Enter your name"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Username</label>
                <input 
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                  placeholder="e.g. jdoe24"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Password</label>
                <input 
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-rose-400 text-sm bg-rose-950/30 p-3 rounded-lg border border-rose-900/50">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                fullWidth 
                variant="primary" 
                disabled={isAuthLoading}
                className="py-4 text-lg font-bold"
              >
                {isAuthLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                ) : (
                  authMode === 'login' ? 'Sign In' : 'Create Account'
                )}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
              <p className="text-sm text-slate-400 mb-2">
                {authMode === 'login' ? "New to Island Sync?" : "Already use Island Sync?"}
              </p>
              <button 
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setError(null);
                }}
                className="text-blue-400 hover:text-blue-300 font-semibold hover:underline transition-colors"
              >
                {authMode === 'login' ? "Create a free account" : "Log in to your account"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If we have a user but no role, they need to pick one
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
           <div className="mx-auto h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50 mb-6">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Welcome, {user.name}</h2>
          <p className="mt-2 text-slate-400">To get started, choose your role in the system</p>
        </div>
        
        <div className="grid gap-4 mt-8">
          <button 
            onClick={() => setRole(UserRole.MERCHANT)}
            className="group relative flex items-center p-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-blue-500 hover:bg-slate-800/80 transition-all duration-200 text-left"
          >
            <div className="h-12 w-12 bg-blue-900/30 rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-white">Merchant Dashboard</h3>
              <p className="text-sm text-slate-500">Fleet overview and tracking</p>
            </div>
          </button>

          <button 
            onClick={() => setRole(UserRole.DRIVER)}
            className="group relative flex items-center p-6 bg-slate-800 border border-slate-700 rounded-xl hover:border-emerald-500 hover:bg-slate-800/80 transition-all duration-200 text-left"
          >
            <div className="h-12 w-12 bg-emerald-900/30 rounded-full flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-white">Driver App</h3>
              <p className="text-sm text-slate-500">Logistics and cargo logging</p>
            </div>
          </button>

          <button 
            onClick={logout}
            className="mt-4 text-slate-500 hover:text-white text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
