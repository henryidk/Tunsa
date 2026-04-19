// AdminDashboard.tsx — layout principal y estado global

import { useState } from 'react'
import { useAuthStore } from '../../store/auth.store'
import { useAdminSocket } from '../../hooks/useAdminSocket'
import { useNotificationSound } from '../../hooks/useNotificationSound'
import { useSolicitudesStore, selectPendingCount, selectTodayCount } from '../../store/solicitudes.store'
import { useNotificationsStore, selectUnreadCount } from '../../store/notifications.store'
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
import CambiarPasswordModal from '../../components/admin/CambiarPasswordModal'

export type Section =
  | 'dashboard'
  | 'rentas-solicitudes'
  | 'rentas-activas'
  | 'rentas-historial'
  | 'rentas-vencidas'
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
  const [activeSection, setActiveSection] = useState<Section>('dashboard')

  const { playSound }  = useNotificationSound()
  // Mantiene el socket activo durante toda la sesión y alimenta ambos stores
  useAdminSocket({ playSound })
  const pendienteCount = useSolicitudesStore(selectPendingCount)
  const todayCount     = useSolicitudesStore(selectTodayCount)
  const unreadCount    = useNotificationsStore(selectUnreadCount)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [toast, setToast] = useState<ToastState>({ visible: false, type: 'success', title: '', msg: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [modalRentaId, setModalRentaId] = useState('')

  const showToast = (type: ToastType, title: string, msg: string) => {
    setToast({ visible: true, type, title, msg })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500)
  }

  const openModal = (rentaId: string) => {
    setModalRentaId(rentaId)
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const navTo = (section: string) => setActiveSection(section as Section)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        activeSection={activeSection}
        onNavTo={navTo}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        onLogout={logout}
        user={user}
        badges={{ 'rentas-solicitudes': pendienteCount }}
      />

      <div
        className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        <TopBar activeSection={activeSection} onNavTo={navTo} unreadCount={unreadCount} todayCount={todayCount} />

        <main className="flex-1 p-6">
          {activeSection === 'dashboard' && (
            <DashboardSection onNavTo={navTo} onShowToast={showToast} onOpenModal={openModal} />
          )}
          {activeSection === 'rentas-solicitudes' && (
            <SolicitudesSection />
          )}
          {activeSection === 'rentas-activas' && (
            <RentasActivasSection />
          )}
          {activeSection === 'rentas-historial' && (
            <HistorialSection onShowToast={showToast} onOpenModal={openModal} />
          )}
          {activeSection === 'rentas-vencidas' && (
            <VencidasSection onShowToast={showToast} onOpenModal={openModal} />
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
