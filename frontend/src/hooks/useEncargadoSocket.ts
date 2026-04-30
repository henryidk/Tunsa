import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { authService } from '../services/auth.service';
import { usePendientesStore } from '../store/pendientes.store';
import { useRechazadasStore } from '../store/rechazadas.store';
import { useReservadosStore } from '../store/reservados.store';
import { useAprobadasStore } from '../store/aprobadas.store';
import { useActivasStore } from '../store/activas.store';
import { useVencidasStore } from '../store/vencidas.store';
import type { SolicitudRenta, ItemSnapshot } from '../types/solicitud-renta.types';
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

      // Liberar los equipos de tipo maquinaria para que vuelvan a aparecer como disponibles
      const equipoIds = (solicitud.items as ItemSnapshot[])
        .filter(i => i.kind === 'maquinaria' && 'equipoId' in i)
        .map(i => (i as Extract<ItemSnapshot, { kind: 'maquinaria' }>).equipoId);
      if (equipoIds.length > 0) {
        useReservadosStore.getState().removeEquipos(equipoIds);
      }

      showToast(
        'error',
        'Solicitud rechazada',
        `Tu solicitud para ${solicitud.cliente.nombre} fue rechazada.`,
      );
      playSound();
    };

    const handleSolicitudAprobada = (solicitud: SolicitudRenta) => {
      usePendientesStore.getState().removeSolicitud(solicitud.id);
      useAprobadasStore.getState().addAprobada(solicitud);
      showToast(
        'success',
        'Solicitud aprobada',
        `Tu solicitud para ${solicitud.cliente.nombre} fue aprobada — pendiente de entrega.`,
      );
      playSound();
    };

    const handleRentaVencida = (solicitud: SolicitudRenta) => {
      useActivasStore.getState().removeRenta(solicitud.id);
      useVencidasStore.getState().addVencida(solicitud);
      showToast(
        'warning',
        'Renta vencida',
        `La renta de ${solicitud.cliente.nombre} ha vencido — pendiente de devolución.`,
      );
      playSound();
    };

    const handleRentaActiva = (solicitud: SolicitudRenta) => {
      useActivasStore.getState().addRenta(solicitud);
    };

    socket.on('solicitud:aprobada',  handleSolicitudAprobada);
    socket.on('solicitud:rechazada', handleSolicitudRechazada);
    socket.on('renta:vencida',       handleRentaVencida);
    socket.on('renta:activa',        handleRentaActiva);

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
