// Página de Login - Proyecto Tunsa

import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import logoTunsa from '../assets/logo-tunsa.png';

export default function Login() {
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const hasRedirected = useRef(false);
  
  const { login, isLoading, error, clearError, isAuthenticated, user } = useAuthStore();
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCountdown(0);
  }, []);

  useEffect(() => {
    if (!error) {
      stopCountdown();
      return;
    }
    const match = error.match(/en (\d+) segundos/);
    if (match) {
      const seconds = parseInt(match[1], 10);
      setCountdown(seconds);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            clearError();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [error, clearError, stopCountdown]);

  useEffect(() => {
    if (isAuthenticated && user && !hasRedirected.current) {
      hasRedirected.current = true;
      const routes: Record<string, string> = {
        admin: '/admin',
        secretaria: '/secretaria',
        colaborador: '/colaborador',
        encargado_maquinas: '/encargado-maquinas',
      };
      navigate(routes[user.role.nombre] || '/admin', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (error) clearError();
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (error) clearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || isLoading) return;
    
    try {
      await login({ username: username.trim(), password });
    } catch {
      // Error manejado en store
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 flex items-center justify-center p-4">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-200/40 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-200/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Card principal */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden border border-slate-200/60">
          {/* Header con logo */}
          <div className="px-8 pt-10 pb-8 text-center bg-gradient-to-b from-white to-slate-50/50">
            <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-lg shadow-slate-300/50 border border-slate-100 mb-6">
              <img src={logoTunsa} alt="TUNSA Logo" className="h-12" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Bienvenido</h1>
            <p className="text-slate-500 text-sm mt-1">Ingresa tus credenciales para continuar</p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
            {(error || countdown > 0) && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-red-600 text-xs font-bold">!</span>
                </div>
                <p className="text-red-700 text-sm">
                  {countdown > 0
                    ? `Demasiados intentos fallidos. Intenta nuevamente en ${countdown} segundos.`
                    : error}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="username" className="block text-sm font-medium text-slate-700">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                placeholder="Ingresa tu usuario"
                disabled={isLoading}
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl 
                         focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                         disabled:bg-slate-100 disabled:cursor-not-allowed
                         transition-all duration-200 outline-none
                         placeholder:text-slate-400 text-slate-800"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl 
                           focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
                           disabled:bg-slate-100 disabled:cursor-not-allowed
                           transition-all duration-200 outline-none
                           placeholder:text-slate-400 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
                           text-slate-400 hover:text-slate-600 hover:bg-slate-100
                           disabled:cursor-not-allowed transition-all duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim() || countdown > 0}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 
                       text-white font-semibold rounded-xl
                       hover:from-blue-700 hover:to-blue-800 hover:shadow-lg hover:shadow-blue-500/25
                       focus:ring-4 focus:ring-blue-500/30
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
                       transition-all duration-200
                       flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-slate-400 text-xs">
            Sistema protegido • Acceso autorizado unicamente
          </p>
          <p className="text-slate-300 text-xs mt-2">v1.0.0</p>
        </div>
      </div>
    </div>
  );
}
