# ResumenItem, DetalleHorometro y costoAcumuladoPesada

Fecha: 2026-04-25

---

## Qué se implementó

Tres cambios estructurales para hacer el historial de rentas y los costos de maquinaria pesada directamente consultables sin reconstruir desde lecturas dispersas.

---

## 1. `costoAcumuladoPesada` en `Solicitud`

Campo denormalizado que acumula la suma de `costoTotal` de todas las `LecturaHorometro` de una solicitud pesada. Se mantiene sincronizado atómicamente con cada operación que cambia el costo de una lectura.

**Cuándo se actualiza:**
- `registrarFin5pm` — al registrar la lectura de las 5 PM se incrementa por el delta (costo nuevo − costo anterior provisional).
- `registrarInicio` (día siguiente) — al detectar horas nocturnas del día anterior se incrementa por el delta (nuevo total − provisional sin nocturnas).
- `registrarDevolucionPesada` — al aplicar las horas nocturnas finales del horómetro de devolución se incrementa por el delta correspondiente.

**Garantía ACID:** cada incremento ocurre dentro de la misma `$transaction` que actualiza la lectura, por lo que nunca quedan inconsistentes.

**Uso en frontend:** `RentasActivasSection` muestra este valor en la tarjeta "Acumulado pesadas".

---

## 2. `ResumenItem` — registro de cierre por ítem

Tabla que captura los datos de cada ítem al inicio y al cierre de la renta. Cubre los tres tipos: `maquinaria`, `granel` y `pesada`.

```
resumen_items
  id              — clave primaria
  solicitudId     — FK a solicitudes
  clienteId       — desnormalizado para reportes rápidos
  equipoId        — null para granel
  itemRef         — equipoId (maquinaria/pesada) o tipo enum (granel)
  tipoItem        — 'maquinaria' | 'granel' | 'pesada'
  fechaEntrega    — momento en que se confirmó la entrega (ACTIVA)
  fechaDevolucion — momento en que se registró la devolución
  tarifaEfectiva  — snapshot del precio aplicado (Q/día o Q/hora)
  diasCobrados    — para livianas/granel
  costoFinal      — costo total cobrado por este ítem en esta renta
```

**Unique constraint:** `(solicitudId, itemRef)` — un solo registro de cierre por ítem por renta.

**Cuándo se crea:** en `confirmarEntrega`, dentro de la misma TX que cambia el estado a `ACTIVA`.

**Cuándo se completa:** en `registrarDevolucion` (livianas/granel) o `registrarDevolucionPesada`, dentro de la TX de devolución.

---

## 3. `DetalleHorometro` — extensión exclusiva para pesadas

Tabla 1:1 con `ResumenItem` que guarda los campos específicos de horómetro. Solo existe para ítems de tipo `pesada`.

```
detalles_horometro
  resumenItemId       — PK y FK a resumen_items
  horometroEntrega    — lectura al iniciar la renta (capturada en iniciarEntrega)
  horometroDevolucion — lectura final al devolver
  horasDiurnasTotal   — Σ horasDiurnasFacturadas de todas las lecturas
  ajusteMinimoTotal   — Σ ajusteMinimo aplicado (horas "regaladas" por mínimo de 5h/día)
  horasNocturnas      — total horas después de las 5 PM (incluyendo día de devolución)
```

**Cuándo se crea:** junto al `ResumenItem`, en `confirmarEntrega`. `horometroEntrega` se toma del campo `horometroInicial` guardado en el snapshot del ítem (registrado en `iniciarEntrega`).

**Cuándo se completa:** en `registrarDevolucionPesada`, con los totales calculados sumando todas las lecturas.

---

## Ciclo de vida completo (pesada)

```
iniciarEntrega()
  → guarda horometroInicial en items JSON

confirmarEntrega()        [TX]
  → solicitud: APROBADA → ACTIVA
  → ResumenItem.create(fechaEntrega, tarifaEfectiva)
  → DetalleHorometro.create(horometroEntrega)

registrarFin5pm()         [TX]
  → LecturaHorometro.update(costoTotal provisional)
  → Solicitud.costoAcumuladoPesada += delta

registrarInicio() día N+1 [TX si hay nocturnas]
  → LecturaHorometro.update(costoTotal con nocturnas)
  → Solicitud.costoAcumuladoPesada += delta

registrarDevolucionPesada() [TX]
  → LecturaHorometro.update(nocturnas de devolución si aplica)
  → Solicitud.costoAcumuladoPesada += delta nocturnas
  → ResumenItem.update(fechaDevolucion, costoFinal, diasCobrados)
  → DetalleHorometro.update(horometroDevolucion, totales de horas)
  → Solicitud.update(devolucionesParciales, estado)
```

---

## Ciclo de vida completo (livianas / granel)

```
confirmarEntrega()        [TX]
  → solicitud: APROBADA → ACTIVA
  → ResumenItem.create(fechaEntrega, tarifaEfectiva) por cada ítem

registrarDevolucion()     [TX]
  → Solicitud.update(devolucionesParciales, estado)
  → ResumenItem.updateMany(fechaDevolucion, diasCobrados, costoFinal) por ítem devuelto
```

---

## Queries de reporte habilitadas

```sql
-- Total gastado por un cliente (todos los tipos de renta)
SELECT SUM(costoFinal) FROM resumen_items WHERE "clienteId" = 'CLI-0001';

-- Revenue generado por un equipo específico
SELECT SUM(costoFinal) FROM resumen_items WHERE "equipoId" = '<id>';

-- Desglose de horas para una renta pesada
SELECT ri.*, dh.*
FROM resumen_items ri
JOIN detalles_horometro dh ON dh."resumenItemId" = ri.id
WHERE ri."solicitudId" = '<id>';

-- Revenue mensual por tipo
SELECT "tipoItem", SUM("costoFinal")
FROM resumen_items
WHERE "fechaDevolucion" >= '2026-04-01'
GROUP BY "tipoItem";
```

---

## Cambios en frontend

**`RentasActivasSection.tsx`:**
- Corregido `equiposEnCampo`: ya no cuenta ítems ya devueltos (antes usaba `s.items.length` sin filtrar).
- Tarjeta "Ingresos proyectados" ahora solo suma livianas/granel (`totalEstimado`).
- Nueva tarjeta "Acumulado pesadas" muestra `costoAcumuladoPesada` acumulado en tiempo real.
- Grid cambiado de 3 a 4 columnas (`grid-cols-2 lg:grid-cols-4`).

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/prisma/schema.prisma` | Nuevos modelos `ResumenItem`, `DetalleHorometro`; campo `costoAcumuladoPesada` en `Solicitud` |
| `backend/prisma/migrations/20260425000001_*/migration.sql` | Migración aplicada |
| `backend/src/solicitudes/horometro.service.ts` | Transacciones atómicas en `registrarFin5pm`, `registrarInicio`, `registrarDevolucionPesada` |
| `backend/src/solicitudes/solicitudes.service.ts` | `confirmarEntrega` y `registrarDevolucion` crean/completan `ResumenItem` en TX |
| `backend/src/solicitudes/solicitudes.serializer.ts` | Expone `costoAcumuladoPesada` |
| `frontend/src/types/solicitud-renta.types.ts` | Campo `costoAcumuladoPesada: number` |
| `frontend/src/components/encargado/sections/RentasActivasSection.tsx` | Fix bug + 4 tarjetas |
