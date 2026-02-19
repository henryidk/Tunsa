// Toast.tsx — notificación flotante con animación

import type { ToastState } from '../../pages/admin/AdminDashboard'

interface ToastProps {
  toast: ToastState
}

export default function Toast({ toast }: ToastProps) {
  if (!toast.visible) return null

  return (
    <div
      className="fixed top-6 right-6 z-[9999] flex items-center gap-3 bg-white border border-slate-200 rounded-xl shadow-lg px-5 py-4 min-w-[320px] max-w-[460px] border-l-4 border-l-green-500"
      style={{ animation: 'toastSlideIn 250ms ease' }}
    >
      <style>{`@keyframes toastSlideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <span className="text-2xl flex-shrink-0">{toast.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-800">{toast.title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{toast.msg}</div>
      </div>
    </div>
  )
}
