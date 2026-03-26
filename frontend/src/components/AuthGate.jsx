import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

const AUTH_KEY = 'fomo_auth_token';
const AUTH_EXPIRY_KEY = 'fomo_auth_expiry';
// Session valid for 7 days
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Simple hash function for password verification
const hashPassword = (password) => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

export function AuthGate({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    const token = localStorage.getItem(AUTH_KEY);
    const expiry = localStorage.getItem(AUTH_EXPIRY_KEY);
    
    if (token && expiry) {
      const expiryTime = parseInt(expiry, 10);
      if (Date.now() < expiryTime) {
        setIsAuthenticated(true);
      } else {
        // Session expired
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(AUTH_EXPIRY_KEY);
      }
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Verify password against backend
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success) {
        // Store auth token
        const token = hashPassword(password + Date.now().toString());
        const expiry = Date.now() + SESSION_DURATION;
        localStorage.setItem(AUTH_KEY, token);
        localStorage.setItem(AUTH_EXPIRY_KEY, expiry.toString());
        setIsAuthenticated(true);
      } else {
        setError('Неверный пароль');
      }
    } catch (err) {
      setError('Ошибка подключения');
    }

    setIsLoading(false);
  };

  // Show loading while checking auth
  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500"></div>
      </div>
    );
  }

  // Show login modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl"></div>
        </div>

        {/* Login Card */}
        <div className="relative w-full max-w-md">
          <div className="bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-700/50 shadow-2xl p-8">
            {/* Logo/Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 mb-4">
                <Lock size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">FOMO Intelligence</h1>
              <p className="text-slate-400 text-sm">Введите пароль для доступа</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    placeholder="Введите пароль"
                    autoFocus
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !password}
                className="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-blue-500 text-white font-semibold rounded-xl hover:from-violet-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Проверка...
                  </span>
                ) : (
                  'Войти'
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-slate-500 text-xs mt-6">
              Crypto Intelligence Terminal v2.0
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated, render children
  return children;
}

export default AuthGate;
