// EquiposSection.tsx — vista de equipos para el encargado (solo lectura)
// Reutiliza el componente del admin con canEdit={false} para evitar duplicación de lógica.
// El backend ya rechaza con 403 cualquier operación de escritura de este rol,
// pero el frontend tampoco expone los controles de escritura.

import AdminEquiposSection from '../../admin/sections/EquiposSection';

export default function EquiposSection() {
  return <AdminEquiposSection canEdit={false} />;
}
