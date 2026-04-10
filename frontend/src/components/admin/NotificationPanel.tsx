import { useNotificationsStore, selectUnreadCount } from '../../store/notifications.store';
import type { NotificationType } from '../../store/notifications.store';

const SECTION_BY_TYPE: Partial<Record<NotificationType, string>> = {
  solicitud_nueva: 'rentas-solicitudes',
};

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `Hace ${hrs} h`;
  return `Hace ${Math.floor(hrs / 24)} d`;
}

interface NotificationPanelProps {
  onNavTo:  (section: string) => void;
  onClose:  () => void;
}

export default function NotificationPanel({ onNavTo, onClose }: NotificationPanelProps) {
  const notifications = useNotificationsStore(s => s.notifications);
  const unreadCount   = useNotificationsStore(selectUnreadCount);
  const markRead      = useNotificationsStore(s => s.markRead);
  const markAllRead   = useNotificationsStore(s => s.markAllRead);

  const handleClick = (id: string, type: NotificationType) => {
    markRead(id);
    const section = SECTION_BY_TYPE[type];
    if (section) onNavTo(section);
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <span className="text-sm font-bold text-slate-800">Notificaciones</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Marcar todo leído
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="max-h-[360px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="text-sm">Sin notificaciones</span>
          </div>
        ) : (
          notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n.id, n.type)}
              className={`w-full text-left flex gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50 ${
                !n.read ? 'bg-indigo-50/60' : ''
              }`}
            >
              {/* Dot */}
              <div className="flex-shrink-0 mt-1.5">
                <div className={`w-2 h-2 rounded-full ${!n.read ? 'bg-indigo-500' : 'bg-transparent'}`} />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 leading-snug">{n.title}</div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">{n.body}</div>
                <div className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
