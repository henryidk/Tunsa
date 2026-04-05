// ClientesSection.tsx — sección de clientes para el encargado de máquinas
// Reutiliza directamente la sección del admin (misma funcionalidad completa).

import AdminClientesSection from '../../admin/sections/ClientesSection';
import type { ToastType } from '../../../types/ui.types';

interface Props {
  onShowToast: (type: ToastType, title: string, msg: string) => void;
}

export default function ClientesSection({ onShowToast }: Props) {
  return <AdminClientesSection onShowToast={onShowToast} canEdit={false} />;
}
