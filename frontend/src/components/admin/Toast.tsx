// Toast.tsx — notificación flotante con animación

import type { ToastState } from '../../pages/admin/AdminDashboard'

interface ToastProps {
  toast: ToastState
}

const toastConfig = {
  success: {
    borderCls: 'border-l-green-500',
    iconCls: 'text-green-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  error: {
    borderCls: 'border-l-red-500',
    iconCls: 'text-red-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  info: {
    borderCls: 'border-l-blue-500',
    iconCls: 'text-blue-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  warning: {
    borderCls: 'border-l-amber-500',
    iconCls: 'text-amber-500',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
}

export default function Toast({ toast }: ToastProps) {
  if (!toast.visible) return null

  const { borderCls, iconCls, icon } = toastConfig[toast.type]

  return (
    <div
      className={`fixed top-6 right-6 z-[9999] flex items-center gap-3 bg-white border border-slate-200 rounded-xl shadow-lg px-5 py-4 min-w-[320px] max-w-[460px] border-l-4 ${borderCls}`}
      style={{ animation: 'toastSlideIn 250ms ease' }}
    >
      <style>{`@keyframes toastSlideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <span className={`flex-shrink-0 ${iconCls}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-slate-800">{toast.title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{toast.msg}</div>
      </div>
    </div>
  )
}
