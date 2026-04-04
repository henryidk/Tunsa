# Historial embebido en sección Clientes

## Idea

En lugar de ir a la sección global de Bitácoras para ver cambios de un cliente,
el historial vive dentro de la sección Clientes — botón por fila que abre un panel
con el historial específico de ese cliente.

## Plan de implementación

### Backend — 1 cambio

Agregar filtro `entidadId` al endpoint `GET /bitacoras` (service + controller).
Permite pedir todas las entradas de un cliente específico (`CLI-0042`).

### Frontend — 2 cambios

1. **Botón de historial por fila** en la tabla de clientes (ícono reloj, junto al lápiz de editar).
2. **`HistorialClienteModal`** — panel lateral derecho con:
   - Header: nombre y código del cliente
   - Lista cronológica de entradas de bitácora para ese `entidadId`
   - Columnas: fecha/hora, campo, valor anterior → nuevo, realizado por
   - Sin columnas "Módulo" ni "Entidad" (ya se sabe de quién es)
   - Paginación cursor-based (igual que la bitácora global)

### Lo que NO cambia
- Tabla `bitacoras` en BD
- Sección global de Bitácoras
- Service de bitácoras (solo se agrega un filtro)
