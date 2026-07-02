// Página de Login - Proyecto Tunsa

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import logoTunsa from '../assets/logo-tunsa.png';

// Textura de grano sutil para el panel de marca (evita el look "flat vector" del fondo oscuro)
const GRAIN_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

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
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-2">
      {/* Panel de marca */}
      <div className="relative flex h-36 shrink-0 items-center justify-center overflow-hidden bg-ink-900 lg:h-auto lg:min-h-dvh lg:flex-col lg:justify-center lg:gap-8 lg:py-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: GRAIN_BG }}
        />
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rotate-[18deg] bg-brand-700/20 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] lg:-right-24 lg:-top-24 lg:h-96 lg:w-96" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 hidden h-72 w-72 -rotate-[15deg] bg-brand-800/20 [clip-path:polygon(50%_0%,0%_100%,100%_100%)] lg:block" />

        <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center lg:gap-6">
          <img src={logoTunsa} alt="TUNSA" className="h-9 w-auto brightness-0 invert lg:h-16" />
          <p className="hidden max-w-[15rem] text-sm leading-relaxed text-slate-300 lg:block">
            Sistema de gestión de rentas de maquinaria y equipo
          </p>
        </div>

        <p className="pointer-events-none absolute bottom-6 left-0 right-0 hidden text-center font-mono text-xs text-slate-400 lg:block">
          © {new Date().getFullYear()} Tunsa · v2.3.0
        </p>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-10 lg:px-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bienvenido</h1>
          <p className="mt-1 text-sm text-slate-500">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {(error || countdown > 0) && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                  <span className="text-xs font-bold text-red-600">!</span>
                </div>
                <p className="text-sm text-red-700">
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
                className="w-full rounded-xl border border-slate-400 bg-white px-4 py-3 text-slate-800 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-100"
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
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim() || countdown > 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 font-semibold text-white transition-all duration-200 hover:bg-brand-700 focus:ring-4 focus:ring-brand-500/30 active:scale-[0.98] disabled:pointer-events-none disabled:bg-slate-200 disabled:text-slate-400"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Sistema protegido • Acceso autorizado unicamente
          </p>
        </div>
      </div>
    </div>
  );
}
