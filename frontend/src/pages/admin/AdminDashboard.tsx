// AdminDashboard.tsx — layout principal y estado global

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useAdminSocket } from '../../hooks/useAdminSocket'
import { useNotificationSound } from '../../hooks/useNotificationSound'
import { useSolicitudesStore, selectPendingCount, selectTodayCount } from '../../store/solicitudes.store'
import { useNotificationsStore, selectUnreadCount } from '../../store/notifications.store'
import { useHorometrosPendientes } from '../../hooks/useHorometrosPendientes'
import { useAdminVencidasStore } from '../../store/vencidas.store'
import { solicitudesService } from '../../services/solicitudes.service'
import Sidebar from '../../components/admin/Sidebar'
import TopBar from '../../components/admin/TopBar'
import Toast from '../../components/admin/Toast'
import RentaModal from '../../components/admin/RentaModal'
import DashboardSection from '../../components/admin/sections/DashboardSection'
import SolicitudesSection from '../../components/admin/sections/SolicitudesSection'
import RentasActivasSection from '../../components/admin/sections/RentasActivasSection'
import HistorialSection from '../../components/admin/sections/HistorialSection'
import VencidasSection from '../../components/admin/sections/VencidasSection'
import EquiposSection from '../../components/admin/sections/EquiposSection'
import ClientesSection from '../../components/admin/sections/ClientesSection'
import UsuariosSection from '../../components/admin/sections/UsuariosSection'
import BitacorasSection from '../../components/admin/sections/BitacorasSection'
import CategoriasSection from '../../components/admin/sections/CategoriasSection'
import HorometrosSection from '../../components/admin/sections/HorometrosSection'
import DisponibilidadFlotaSection from '../../components/shared/DisponibilidadFlotaSection'
import NuevaRentaLivianaSection from '../../components/admin/sections/NuevaRentaLivianaSection'
import RentaRetroactivaSection from '../../components/admin/sections/RentaRetroactivaSection'
import CambiarPasswordModal from '../../components/admin/CambiarPasswordModal'

export type Section =
  | 'dashboard'
  | 'nueva-renta-liviana'
  | 'renta-retroactiva'
  | 'rentas-solicitudes'
  | 'rentas-activas'
  | 'rentas-historial'
  | 'rentas-vencidas'
  | 'horometros'
  | 'flota'
  | 'equipos'
  | 'categorias'
  | 'clientes'
  | 'usuarios'
  | 'bitacoras'

import type { ToastType } from '../../types/ui.types'
export type { ToastType }

export interface ToastState {
  visible: boolean
  type: ToastType
  title: string
  msg: string
}

export default function AdminDashboard() {
  const { user, logout, mustChangePassword } = useAuthStore()
  const [activeSection,    setActiveSection]    = useState<Section>('dashboard')
  const [navSolicitudId,   setNavSolicitudId]   = useState<string | undefined>(undefined)
  const [navFolio,         setNavFolio]         = useState<string | undefined>(undefined)

  const { playSound }  = useNotificationSound()
  // Mantiene el socket activo durante toda la sesión y alimenta ambos stores
  useAdminSocket({ playSound })
  const pendienteCount = useSolicitudesStore(selectPendingCount)
  const todayCount     = useSolicitudesStore(selectTodayCount)
  const unreadCount    = useNotificationsStore(selectUnreadCount)

  const horometrosPendientes = useHorometrosPendientes()
  const vencidasCount        = useAdminVencidasStore(s => s.solicitudes.length)

  // Carga vencidas al montar el dashboard para que el badge sea visible sin visitar la sección.
  useEffect(() => {
    solicitudesService.getVencidas()
      .then(data => useAdminVencidasStore.getState().setSolicitudes(data))
      .catch(() => {});
  }, []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const togglingRef = useRef(false)
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'success', title: '', msg: '' })

  const handleToggle = useCallback(() => {
    if (togglingRef.current) return;
    togglingRef.current = true;
    setSidebarCollapsed(c => !c);
    setTimeout(() => { togglingRef.current = false; }, 220);
  }, []);
  const [modalOpen, setModalOpen] = useState(false)
  const [modalRentaId, setModalRentaId] = useState('')

  const showToast = (type: ToastType, title: string, msg: string) => {
    setToast({ visible: true, type, title, msg })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 5000)
  }

  const openModal = (rentaId: string) => {
    setModalRentaId(rentaId)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const navTo = (section: string, state?: { solicitudId?: string; folio?: string }) => {
    setActiveSection(section as Section)
    setNavSolicitudId(state?.solicitudId)
    setNavFolio(state?.folio)
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        activeSection={activeSection}
        onNavTo={navTo}
        collapsed={sidebarCollapsed}
        onToggle={handleToggle}
        onLogout={logout}
        user={user}
        badges={{ 'rentas-solicitudes': pendienteCount, 'horometros': horometrosPendientes, 'rentas-vencidas': vencidasCount }}
      />

      <div
        className={`flex flex-col flex-1 min-w-0 transition-[margin-left] duration-200 ease-out ${
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <TopBar activeSection={activeSection} onNavTo={navTo} unreadCount={unreadCount} todayCount={todayCount} />

        <main className="flex-1 p-6">
          {activeSection === 'dashboard' && (
            <DashboardSection onNavTo={navTo} onShowToast={showToast} onOpenModal={openModal} />
          )}
          {activeSection === 'nueva-renta-liviana' && (
            <NuevaRentaLivianaSection onNavTo={navTo} onShowToast={showToast} />
          )}
          {activeSection === 'renta-retroactiva' && (
            <RentaRetroactivaSection onNavTo={navTo} onShowToast={showToast} vencidasSection="rentas-vencidas" />
          )}
          {activeSection === 'rentas-solicitudes' && (
            <SolicitudesSection />
          )}
          {activeSection === 'rentas-activas' && (
            <RentasActivasSection onNavTo={navTo} initialFolio={navFolio} />
          )}
          {activeSection === 'rentas-historial' && (
            <HistorialSection />
          )}
          {activeSection === 'rentas-vencidas' && (
            <VencidasSection initialFolio={navFolio} onNavTo={navTo} />
          )}
          {activeSection === 'flota' && (
            <DisponibilidadFlotaSection onNavTo={navTo} sectionActivas="rentas-activas" sectionVencidas="rentas-vencidas" />
          )}
          {activeSection === 'horometros' && (
            <HorometrosSection initialSolicitudId={navSolicitudId} onNavTo={navTo} />
          )}
          {activeSection === 'equipos' && (
            <EquiposSection onShowToast={showToast} />
          )}
          {activeSection === 'categorias' && (
            <CategoriasSection onShowToast={showToast} />
          )}
          {activeSection === 'clientes' && (
            <ClientesSection onShowToast={showToast} />
          )}
          {activeSection === 'usuarios' && (
            <UsuariosSection onShowToast={showToast} user={user} />
          )}
          {activeSection === 'bitacoras' && (
            <BitacorasSection />
          )}
        </main>
      </div>

      {mustChangePassword && <CambiarPasswordModal />}

      <Toast toast={toast} />
      <RentaModal
        open={modalOpen}
        rentaId={modalRentaId}
        onClose={closeModal}
        onShowToast={showToast}
      />
    </div>
  )
}
