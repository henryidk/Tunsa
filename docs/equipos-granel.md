# Equipos a granel

## Qué son

Los equipos a granel son artículos de inventario que no se rastrean individualmente por número de serie, sino por cantidad total disponible. Se compran y registran en **lotes** y se rentan en bloques de unidades.

Actualmente el sistema maneja tres tipos:

| Tipo (enum) | Nombre visible |
|---|---|
| `PUNTAL` | Puntales |
| `ANDAMIO_SIMPLE` | Andamios simples |
| `ANDAMIO_RUEDAS` | Andamios con ruedas |

---

## Cómo están modelados

Los tipos son un **enum fijo en la base de datos** (`TipoGranel`), no registros dinámicos. Son categorías del negocio que solo cambian si la empresa incorpora un tipo de material completamente nuevo.

Cada tipo tiene:
- **Lotes** — cada compra registrada con descripción, cantidad, precio unitario, fecha y ubicación
- **Config** — tarifas de renta (por día, por semana, por mes) compartidas para todas las unidades de ese tipo
- **Stock total** — suma de las cantidades de todos los lotes activos

---

## Cómo se renta

En el formulario de nueva solicitud del encargado, la pestaña "A granel" muestra los tres tipos. El encargado selecciona:
- Cantidad de unidades
- Fecha de inicio
- Duración y unidad (días / semanas / meses)

El subtotal se calcula como: `tarifa × cantidad × duración`.

---

## Cómo agregar un nuevo tipo de granel

Si el negocio incorpora un nuevo material (ej. tablones), el proceso es:

1. **Backend** — agregar el valor al enum `TipoGranel` en `schema.prisma` y ejecutar la migración
2. **Frontend — servicio** — agregar el valor al tipo `TipoGranel` en `frontend/src/services/granel.service.ts`
3. **Frontend — panel admin** — agregar una entrada a `GRANEL_SECTION_TABS` en `frontend/src/components/admin/sections/EquiposSection.tsx`. El tab y su contenido aparecen automáticamente.
4. **Frontend — formulario encargado** — agregar una entrada a `GRANEL_TIPOS` en `frontend/src/components/encargado/GranelPickerSection.tsx` para que aparezca en la selección de equipos al crear una solicitud.
