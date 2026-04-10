import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { authService } from '../services/auth.service';
import { usePendientesStore } from '../store/pendientes.store';
import { useRechazadasStore } from '../store/rechazadas.store';
import type { SolicitudRenta } from '../types/solicitud-renta.types';
import type { ToastType } from '../types/ui.types';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

interface UseEncargadoSocketOptions {
  playSound: () => void;
  showToast: (type: ToastType, title: string, msg: string) => void;
}

/**
 * Gestiona la conexión WebSocket del panel del encargado de máquinas.
 * Se monta en EncargadoDashboard (nivel de sesión).
 *
 * Escucha `solicitud:rechazada` y:
 *   - Elimina la solicitud del store de pendientes (PendientesSection se actualiza sola).
 *   - Muestra un toast de error al encargado.
 *   - Reproduce sonido de notificación.
 *
 * Acepta `playSound` y `showToast` como dependencias inyectadas (SRP).
 */
export function useEncargadoSocket({ playSound, showToast }: UseEncargadoSocketOptions): void {
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/solicitudes`, {
      auth: (cb: (d: object) => void) => cb({ token: localStorage.getItem('accessToken') }),
      transports: ['websocket'],
    });

    const handleSolicitudRechazada = (solicitud: SolicitudRenta) => {
      usePendientesStore.getState().removeSolicitud(solicitud.id);
      useRechazadasStore.getState().addRechazada(solicitud);
      showToast(
        'error',
        'Solicitud rechazada',
        `Tu solicitud para ${solicitud.cliente.nombre} fue rechazada.`,
      );
      playSound();
    };

    socket.on('solicitud:rechazada', handleSolicitudRechazada);

    // Igual que en useAdminSocket: reconectar si el servidor desconecta por token expirado.
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        authService.refreshToken()
          .then(({ accessToken }) => {
            localStorage.setItem('accessToken', accessToken);
            socket.connect();
          })
          .catch(() => {
            localStorage.removeItem('accessToken');
            window.location.href = '/login';
          });
      }
    });

    return () => { socket.disconnect(); };
  // playSound y showToast son estables — no causan re-ejecuciones.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
