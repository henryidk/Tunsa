import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { solicitudesService } from '../services/solicitudes.service';
import { useSolicitudesStore } from '../store/solicitudes.store';
import { useNotificationsStore } from '../store/notifications.store';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

interface UseAdminSocketOptions {
  playSound: () => void;
}

/**
 * Gestiona la conexión WebSocket del panel de administración.
 * Se monta en AdminDashboard (nivel de sesión) y escribe en dos stores:
 *   - useSolicitudesStore  — datos de solicitudes y contador del sidebar
 *   - useNotificationsStore — panel de notificaciones + badge del header
 *
 * Acepta `playSound` como dependencia inyectada para mantener SRP:
 * este hook no sabe cómo generar audio; solo sabe cuándo dispararlo.
 */
export function useAdminSocket({ playSound }: UseAdminSocketOptions): void {
  useEffect(() => {
    const { setSolicitudes, addSolicitud, setLoading, setError } =
      useSolicitudesStore.getState();
    const { addNotification } = useNotificationsStore.getState();

    const socket = io(`${SOCKET_URL}/solicitudes`, {
      auth: (cb: (d: object) => void) => cb({ token: localStorage.getItem('accessToken') }),
      transports: ['websocket'],
    });

    const handleNuevaSolicitud = (solicitud: SolicitudRenta) => {
      addSolicitud(solicitud);
      addNotification({
        type:     'solicitud_nueva',
        title:    'Nueva solicitud de renta',
        body:     `${solicitud.creadaPor} · ${solicitud.cliente.nombre}`,
        entityId: solicitud.id,
      });
      playSound();
    };

    socket.on('solicitud:nueva', handleNuevaSolicitud);

    solicitudesService.getAll()
      .then(setSolicitudes)
      .catch(() => setError('No se pudieron cargar las solicitudes.'))
      .finally(() => setLoading(false));

    return () => { socket.disconnect(); };
  // playSound es un useCallback estable — no causa re-ejecuciones innecesarias.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
