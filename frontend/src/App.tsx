// App.tsx - Proyecto Tunsa

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated, selectUserRole, selectIsLoading } from './store/auth.store';
import type { RoleName } from './types/auth.types';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import EncargadoDashboard from './pages/encargado/EncargadoDashboard';
import CambiarPasswordModal from './components/admin/CambiarPasswordModal';

// Ruta Protegida
interface ProtectedRouteProps {
  allowedRoles?: RoleName[];
}

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const userRole = useAuthStore(selectUserRole);
  const isLoading = useAuthStore(selectIsLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to={`/${userRole.replace('_', '-')}`} replace />;
  }

  return <Outlet />;
}

// Ruta Pública
function PublicRoute() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const userRole = useAuthStore(selectUserRole);

  if (isAuthenticated && userRole) {
    const route = userRole === 'encargado_maquinas' ? 'encargado-maquinas' : userRole;
    return <Navigate to={`/${route}`} replace />;
  }

  return <Outlet />;
}

// Página simple para cada rol
function SimplePage({ title }: { title: string }) {
  const { logout, user, mustChangePassword } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md w-full">
        <h1 className="text-4xl font-bold text-slate-800 mb-4">{title}</h1>
        <p className="text-slate-600 mb-6">Bienvenido, <span className="font-semibold">{user?.nombre}</span></p>
        <button
          onClick={() => logout()}
          className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
      {mustChangePassword && <CambiarPasswordModal />}
    </div>
  );
}

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>

        {/* Admin */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        {/* Secretaria */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'secretaria']} />}>
          <Route path="/secretaria" element={<SimplePage title="Secretaria" />} />
        </Route>

        {/* Encargado Máquinas */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'encargado_maquinas']} />}>
          <Route path="/encargado-maquinas" element={<EncargadoDashboard />} />
        </Route>

        {/* Redirecciones */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
