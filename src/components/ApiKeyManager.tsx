import React, { useState, useEffect } from 'react';
import { Key, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ApiKeyManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [authError, setAuthError] = useState(false);

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    checkApiKeyStatus();
  }, []);

  const checkApiKeyStatus = () => {
    const key = localStorage.getItem('bybit_api_key');
    const secret = localStorage.getItem('bybit_api_secret');
    const timestamp = localStorage.getItem('bybit_api_timestamp');

    if (key && secret && timestamp) {
      const savedTime = parseInt(timestamp, 10);
      const currentTime = Date.now();
      const elapsedDays = Math.floor((currentTime - savedTime) / (1000 * 60 * 60 * 24));
      const remaining = 30 - elapsedDays;
      
      setDaysLeft(remaining);

      if (remaining <= 0) {
        setIsOpen(true);
      }
    } else {
      setIsOpen(true);
    }
  };

  const handleSave = () => {
    if (!apiKey || !apiSecret) return;
    
    localStorage.setItem('bybit_api_key', apiKey);
    localStorage.setItem('bybit_api_secret', apiSecret);
    localStorage.setItem('bybit_api_timestamp', Date.now().toString());
    
    checkApiKeyStatus();
    setIsOpen(false);
    setIsAuthenticated(false);
  };

  const handleAdminLogin = () => {
    if (adminUser === 'jitesh' && adminPass === 'Ashna@3452') {
      setIsAuthenticated(true);
      setAuthError(false);
      setAdminUser('');
      setAdminPass('');
    } else {
      setAuthError(true);
    }
  };

  const closeDialog = () => {
    setIsOpen(false);
    setIsAuthenticated(false);
    setAdminUser('');
    setAdminPass('');
    setAuthError(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold text-xs transition-all border",
          daysLeft !== null && daysLeft > 0
            ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            : "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20"
        )}
      >
        <Key className="w-3.5 h-3.5" />
        {daysLeft !== null && daysLeft > 0 ? `API Key: ${daysLeft}d left` : "Add API Key"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-2xl max-w-md w-full mx-4">
            {!isAuthenticated ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-rose-500/20 rounded-full flex items-center justify-center">
                    <Key className="w-5 h-5 text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Admin Authentication</h3>
                    <p className="text-xs text-slate-400">Restricted access area.</p>
                  </div>
                </div>

                {authError && (
                  <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2 text-rose-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>Invalid admin credentials. Please try again.</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Admin Username</label>
                    <input
                      type="text"
                      value={adminUser}
                      onChange={(e) => setAdminUser(e.target.value)}
                      placeholder="Username"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Admin Password</label>
                    <input
                      type="password"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      placeholder="Password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  {daysLeft !== null && daysLeft > 0 && (
                    <button
                      onClick={closeDialog}
                      className="flex-1 py-2 rounded-lg font-bold text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleAdminLogin}
                    disabled={!adminUser || !adminPass}
                    className="flex-1 py-2 rounded-lg font-bold text-sm bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Authenticate
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                    <Key className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Bybit API Keys</h3>
                    <p className="text-xs text-slate-400">Keys expire every 30 days for security.</p>
                  </div>
                </div>

                {daysLeft !== null && daysLeft <= 0 && (
                  <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2 text-rose-400 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>Your previous API key has expired (30 day limit reached). Please provide a new key or re-paste the existing one to confirm it is still active.</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">API Key</label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste Bybit API Key..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">API Secret</label>
                    <input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="Paste Bybit API Secret..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  {daysLeft !== null && daysLeft > 0 && (
                    <button
                      onClick={closeDialog}
                      className="flex-1 py-2 rounded-lg font-bold text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={!apiKey || !apiSecret}
                    className="flex-1 py-2 rounded-lg font-bold text-sm bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save & Connect
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
