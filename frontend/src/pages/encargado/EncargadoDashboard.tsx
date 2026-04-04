// EncargadoDashboard.tsx — layout principal del encargado de máquinas

import { useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import EncargadoSidebar from '../../components/encargado/EncargadoSidebar';
import EncargadoTopBar from '../../components/encargado/EncargadoTopBar';
import DashboardSection from '../../components/encargado/sections/DashboardSection';
import NuevaSolicitudSection from '../../components/encargado/sections/NuevaSolicitudSection';
import PendientesSection from '../../components/encargado/sections/PendientesSection';
import RentasActivasSection from '../../components/encargado/sections/RentasActivasSection';
import VencidasSection from '../../components/encargado/sections/VencidasSection';
import HistorialSection from '../../components/encargado/sections/HistorialSection';
import EquiposSection from '../../components/encargado/sections/EquiposSection';
import CambiarPasswordModal from '../../components/admin/CambiarPasswordModal';

type Section =
  | 'dashboard'
  | 'nueva-solicitud'
  | 'pendientes'
  | 'rentas-activas'
  | 'vencidas'
  | 'historial'
  | 'equipos';

export default function EncargadoDashboard() {
  const { user, logout, mustChangePassword } = useAuthStore();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navTo = (section: string) => setActiveSection(section as Section);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':       return <DashboardSection onNavTo={navTo} />;
      case 'nueva-solicitud': return <NuevaSolicitudSection />;
      case 'pendientes':      return <PendientesSection />;
      case 'rentas-activas':  return <RentasActivasSection />;
      case 'vencidas':        return <VencidasSection />;
      case 'historial':       return <HistorialSection />;
      case 'equipos':         return <EquiposSection />;
      default:                return <DashboardSection onNavTo={navTo} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <EncargadoSidebar
        activeSection={activeSection}
        onNavTo={navTo}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        onLogout={logout}
        user={user}
      />

      <div
        className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <EncargadoTopBar activeSection={activeSection} />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-6">
            {renderSection()}
          </div>
        </main>
      </div>

      {mustChangePassword && <CambiarPasswordModal />}
    </div>
  );
}
