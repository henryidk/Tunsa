import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { solicitudesService } from '../services/solicitudes.service';
import type { SolicitudRenta } from '../types/solicitud-renta.types';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

export function useSolicitudes() {
  const [solicitudes, setSolicitudes] = useState<SolicitudRenta[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    // Carga inicial via REST
    solicitudesService.getAll()
      .then(data => setSolicitudes(data))
      .catch(() => setError('No se pudieron cargar las solicitudes.'))
      .finally(() => setIsLoading(false));

    // Conexión WebSocket con JWT
    const token = localStorage.getItem('accessToken');
    const socket = io(`${SOCKET_URL}/solicitudes`, {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('solicitud:nueva', (nueva: SolicitudRenta) => {
      setSolicitudes(prev => [nueva, ...prev]);
    });

    return () => { socket.disconnect(); };
  }, []);

  return { solicitudes, isLoading, error };
}
