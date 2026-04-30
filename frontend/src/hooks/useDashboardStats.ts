import { useState, useEffect } from 'react';
import { solicitudesService, type DashboardStats } from '../services/solicitudes.service';

export function useDashboardStats() {
  const [stats,   setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    solicitudesService.getDashboardStats()
      .then(setStats)
      .catch(() => setStats({ pendientes: 0, activas: 0, vencidas: 0, solicitudesEsteMes: 0, pesadaRecaudadaMes: 0, livianaRecaudadaMes: 0 }))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}
