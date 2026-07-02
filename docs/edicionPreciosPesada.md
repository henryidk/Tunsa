# Edición de tarifas en renta pesada — plan de trabajo

## 0. Corrección de la premisa (importante, leer primero)

Antes de tocar código se investigó a fondo el estado actual. La premisa inicial ("admin/secretaria pueden editar precios en pesada, encargado no, y no existe nada de esto en pesada") **no es del todo exacta**. El estado real es más específico:

| Flujo de creación | Componente | Rol | Endpoint | ¿Tiene edición de tarifa pesada? |
|---|---|---|---|---|
| Directa (auto-aprobada) | `NuevaRentaPesadaSection.tsx` | admin/secretaria | `POST /solicitudes/directa` | **Sí** |
| Retroactiva | `RentaRetroactivaSection.tsx` | admin **y** encargado (`selfManaged`) | `POST /solicitudes/retroactiva` | **Sí** (encargado ya la tiene aquí) |
| Solicitud pendiente | `NuevaSolicitudPesadaSection.tsx` | **solo encargado_maquinas** | `POST /solicitudes` | **No — este es el hueco real** |

Es decir: el encargado **ya puede** fijar una tarifa distinta a la de catálogo en pesada, pero solo cuando registra una renta retroactiva. La única pantalla donde no puede hacerlo es la de "Nueva Solicitud" (el flujo pendiente-de-aprobación), que es exactamente la misma pantalla donde en renta liviana sí existe la edición de tarifa vía `usePrecioOverride`.

Además, se encontró un problema independiente y más profundo: **incluso donde el override de pesada ya existe hoy, nunca se muestra en ningún lado** (ni acordeón, ni PDF), por varios motivos que se detallan abajo. Esto afecta tanto a liviana como a pesada, aunque en liviana está parcialmente resuelto.

### Alcance de este plan (confirmado con el usuario)
1. Agregar edición de tarifa a `NuevaSolicitudPesadaSection.tsx` (el único hueco real de input — confirmado: en el resto de pantallas de renta pesada, tanto en panel admin como en panel encargado, ya existe esta función).
2. La edición incluye **tarifa base Y extras/complementos** (paridad completa con `NuevaRentaPesadaSection.tsx` y `RentaRetroactivaSection.tsx`, que ya permiten editar ambos).
3. Corregir el cálculo de `tieneOverride` en backend (bug transversal a ambos tipos de equipo), incluyendo overrides de extras en el cómputo.
4. Mostrar las tarifas modificadas de pesada (base + extras) en el acordeón de `SolicitudesSection.tsx`, igual que ya ocurre en liviana.
5. Mostrar la nota de tarifas modificadas de pesada (base + extras) en el PDF de comprobante (`generarComprobante.ts`), igual que ya ocurre en liviana.

### Fuera de alcance (a menos que se pida explícitamente)
- `generarLiquidacion.ts` (PDF de liquidación/devolución): hoy no tiene nota de tarifas modificadas para **ningún** tipo de equipo. Añadirla sería una feature nueva para ambos tipos, no una paridad pesada-vs-liviana. Se deja para un plan aparte.
- Mostrar overrides de solicitudes con estado distinto a `PENDIENTE` en algún acordeón: `SolicitudesSection.tsx` solo lista `estado === 'PENDIENTE'`; las directas/retroactivas (`APROBADA`/`ACTIVA`) no tienen una vista de acordeón hoy, ni para liviana ni para pesada. No se crea una vista nueva para esto en este plan.

---

## 1. Por qué pasa esto (causa raíz)

Liviana y pesada nunca compartieron código de tarifas porque su forma de cobro es distinta:

- **Liviana/granel**: tarifa de 3 bandas (`tarifaFijada: {dia, semana, mes}`) comparada contra el catálogo (`rentaDia/rentaSemana/rentaMes`), con descomposición adaptativa de la duración. Hook: `usePrecioOverride`.
- **Pesada**: tarifa plana por hora (`tarifaBaseFijada: number`) comparada contra `equipo.rentaHora`, más un override aparte por cada "extra"/complemento (`extrasSeleccionados[].rentaHora` vs `ExtraEquipo.rentaHora`, sin equivalente en liviana). Se liquida después por horómetro, no por día/semana/mes. Hook: `useTarifaPesadaEdit`.

Esta separación es correcta y **no se debe unificar** forzosamente (violaría SRP: mezclar dos modelos de cobro distintos en una sola abstracción los haría más frágiles, no más simples). El plan por tanto **replica el patrón ya usado en `NuevaRentaPesadaSection.tsx` y `RentaRetroactivaSection.tsx`**, en vez de inventar uno nuevo, y corrige los puntos donde la paridad se rompió por omisión (no por diseño).

---

## 2. Principios que guían las fases (SOLID aplicado a este caso concreto)

- **DRY / SRP en el backend**: hoy `tieneOverride` se calcula distinto (o no se calcula) en cada uno de los 3 sitios donde se hace `solicitud.create(...)`. Se extrae a **una sola función pura** (`calcularTieneOverride(items)`), con un único punto de verdad para "qué cuenta como tarifa modificada", que ya sabe mirar tanto `tarifaFijada` (liviana) como `tarifaBaseFijada`/extras (pesada). Los tres call-sites solo la invocan.
- **OCP (abierto a extensión, cerrado a modificación) en el frontend de edición**: `useTarifaPesadaEdit` y los componentes `PesadaTarifaEditor*` ya existen y funcionan en dos flujos. No se reescriben ni se les cambia la firma — se **reutilizan tal cual** en `NuevaSolicitudPesadaSection.tsx`, igual que ya se reutilizan en `RentaRetroactivaSection.tsx`. Si en el futuro se agrega un cuarto flujo pesada, debería poder enchufar el mismo hook sin tocarlo.
- **Simetría de tipos entre frontend y backend**: el tipo frontend `ItemSnapshot` (variante pesada) ya tiene `tarifaBaseFijada?: number | null`. El tipo backend `ItemPesadaSnapshot` no lo tiene. Se alinean para que el dato sobreviva completo desde que se crea hasta que se muestra.
- **No tocar lo que ya funciona**: liviana no se modifica salvo en el helper compartido de `tieneOverride` (que hoy tiene el mismo bug para liviana en `crearDirecta`/`crearRetroactiva`). El resto de fases son aditivas para pesada.

---

## Fase 0 — Backend: corregir `tieneOverride` y alinear tipos

**Por qué va primero**: sin esto, aunque se agregue la edición de tarifa en pesada, la bandera `tieneOverride` seguiría sin marcarse correctamente en 2 de los 3 flujos, y el acordeón/PDF de fases posteriores no tendrían nada confiable que leer.

1. En `backend/src/solicitudes/solicitudes.service.ts`, extraer una función compartida (puede vivir en el mismo archivo como método privado, o en un util si se prefiere aislarla para test unitario):
   ```ts
   function calcularTieneOverride(items: ItemSolicitudDto[]): boolean {
     return items.some(i =>
       (i.tarifaFijada != null && (i.tarifaFijada.dia != null || i.tarifaFijada.semana != null || i.tarifaFijada.mes != null)) ||
       i.tarifaBaseFijada != null ||
       (i.extrasSeleccionados?.some(e => e.rentaHora != null) ?? false)
     );
   }
   ```
   (Se confirmó que los extras entran en el alcance, así que el helper ya los contempla desde el inicio.)
2. Reemplazar el cálculo inline de `create()` (líneas ~164-167) por una llamada a esta función.
3. Agregar la llamada (hoy ausente) en `crearDirecta()` y `crearRetroactiva()`, pasando el `tieneOverride` calculado al `tx.solicitud.create({ data: {...} })` de cada uno.
4. En `backend/src/solicitudes/solicitudes.types.ts`, agregar `tarifaBaseFijada?: number | null;` a `ItemPesadaSnapshot`, para que el valor de override quede guardado por separado de `tarifaEfectiva` (que es el valor ya resuelto/aplicado). Verificar también que el snapshot de cada extra dentro de `ItemPesadaSnapshot` conserve su `rentaHora` pactada por separado del valor de catálogo (revisar el shape real de `extrasSeleccionados` en este archivo antes de tocarlo). Revisar el punto donde se construye este snapshot (en `create()`/`crearDirecta()`/`crearRetroactiva()`, bloque `esPesada`) para que efectivamente copie `item.tarifaBaseFijada` y los overrides de extras al snapshot.
5. **Verificación**: crear una solicitud pesada con tarifa base modificada y con al menos un extra con precio modificado, por cada uno de los 3 endpoints (Postman/Insomnia o test manual), y confirmar en BD que `tieneOverride = true` y que el `items` JSON guarda tanto `tarifaBaseFijada` como los overrides de extras.

---

## Fase 1 — Frontend: edición de tarifa en `NuevaSolicitudPesadaSection.tsx`

Replicar el patrón exacto de `NuevaRentaPesadaSection.tsx` (admin) en este componente (encargado):

1. Importar `useTarifaPesadaEdit`, `PesadaTarifaEditorPanel`, `PencilIcon` (o los nombres reales usados en `NuevaRentaPesadaSection.tsx`).
2. Extender la interfaz `PesadaItem` (líneas ~22-28) para incluir `tarifaBaseEfectiva` (hoy ausente), igual que su par en el flujo admin.
3. Cambiar `calcTarifa(equipo)` (líneas ~44-46), que hoy retorna `equipo.rentaHora ?? 0` fijo, para que el valor efectivo pueda venir del override cuando exista.
4. En `EquipoAgregado` (líneas ~289-339) y `PesadaResumen` (líneas ~341-475), añadir el botón de lápiz y el panel de edición, tal como aparecen en `NuevaRentaPesadaSection.tsx` — incluyendo la edición de extras/complementos, no solo la tarifa base (paridad completa confirmada).
5. En `submitSolicitud()` (líneas ~116-175), incluir `tarifaBaseFijada` y los overrides de extras en el payload cuando el usuario haya modificado alguno (mismo patrón que `NuevaRentaPesadaSection.tsx` línea ~155/167: `tarifaBaseFijada: it.tarifaBaseEfectiva`, más el envío de `extrasSeleccionados` con sus `rentaHora` pactadas).
6. **Verificación**: como encargado, crear una solicitud pesada, modificar la tarifa base de un equipo y el precio de al menos un extra, enviarla, y confirmar (con la Fase 0 ya aplicada) que la solicitud queda con `tieneOverride: true` en BD y ambos overrides guardados.

No se toca `SolicitudCartTable.tsx` (esa tabla es explícitamente de 3 bandas y no aplica a pesada — pesada usa sus propios componentes `PesadaTarifaEditor*`, no esa tabla).

---

## Fase 2 — Acordeón de tarifas modificadas en `SolicitudesSection.tsx`

Hoy, dentro de `SolicitudCard`, los ítems se separan en tres arreglos (`maquinaria`, `granel`, `pesada`). Los dos primeros ya deciden por ítem si mostrar `<ItemAccordionCard>` (expandible, cuando `item.tarifaFijada` existe) o `<ItemRow>` (plano). Pesada hoy **siempre** usa `<ItemRow>` sin ninguna verificación.

1. Crear el equivalente pesada de las utilidades que hoy son liviana-only:
   - Un análogo a `calcCatalogSubtotalSnap` que, para un ítem pesada, calcule el costo "de catálogo" usando `equipo.rentaHora` y `ExtraEquipo.rentaHora` (extras incluidos, confirmado en el alcance).
   - Un análogo a `buildBandas` que compare tarifa aplicada (`tarifaBaseFijada`/`tarifaEfectiva`, más cada extra modificado) contra la de catálogo y arme la estructura que consume la tarjeta expandible.
   - Estas utilidades deben ser funciones nuevas y separadas (p. ej. `buildResumenPesada`), no una modificación de las existentes — mantiene el mismo principio de "un modelo de cobro, un set de utilidades" ya usado por el proyecto entre liviana y pesada.
2. Reemplazar la línea `{pesada.map((item, i) => <ItemRow key={...} item={item} />)}` por una condición análoga a la de maquinaria/granel: si `item.tarifaBaseFijada != null` o algún extra tiene precio modificado, renderizar una tarjeta expandible con el detalle de "tarifa pactada vs. tarifa de catálogo" (base y extras); si no, `<ItemRow>` como hasta ahora.
3. El badge "Tarifas modificadas" y el recuadro "Vs. tarifa normal" (que hoy dependen de `solicitud.tieneOverride`) empezarán a aparecer también para solicitudes pesada automáticamente, una vez la Fase 0 esté corregida — no requieren cambio adicional en sí mismos.
4. **Verificación**: con una solicitud pesada con tarifa modificada (creada en la Fase 1), abrir "Solicitudes de Renta" como admin y confirmar que aparece el badge y el acordeón se expande mostrando el detalle, igual que ya ocurre en liviana.

---

## Fase 3 — Nota de tarifas modificadas en el PDF (`generarComprobante.ts`)

Hoy el bloque de nota (líneas ~391-437) tiene una doble exclusión de pesada:
```js
if (!solicitud.esPesada && solicitud.tieneOverride) {   // ← excluye pesada aquí
  for (const item of solicitud.items) {
    if (item.kind === 'pesada' || !item.tarifaFijada || !item.tarifas) continue;  // ← y otra vez aquí
    ...
  }
}
```

1. Quitar el guard `!solicitud.esPesada` del `if` externo.
2. Dentro del `for`, añadir una rama para `item.kind === 'pesada'` que construya la línea de nota usando `item.tarifaBaseFijada` vs. la tarifa de catálogo (`item.tarifaEfectiva` ya resuelto, o volviendo a calcular contra `rentaHora` si el snapshot no trae el valor de catálogo — a confirmar con lo que realmente persiste la Fase 0), más una línea adicional por cada extra con precio modificado, en vez de `item.tarifaFijada`/`item.tarifas` (que son campos exclusivos de liviana).
3. La tabla de ítems (`buildFilasPesada`, líneas ~195-208) queda igual — esta fase solo toca el bloque de nota, no la tabla principal.
4. **Verificación**: generar el comprobante PDF de una solicitud pesada con tarifa modificada y confirmar que aparece la nota, con el mismo formato visual que la nota de liviana.

---

## Fase 4 — Verificación final

1. `npx tsc --noEmit` en frontend y `npm run build` (o el chequeo equivalente) en backend — 0 errores.
2. Recorrido manual end-to-end como `encargado_maquinas`: crear solicitud pesada con tarifa modificada → verificar en "Solicitudes de Renta" (como admin) que se ve el acordeón → aprobar → generar comprobante → verificar la nota en el PDF.
3. Recorrido de regresión rápido en liviana (mismo camino) para confirmar que el helper compartido de `tieneOverride` no rompió nada existente.

---

## Decisiones confirmadas con el usuario

1. **Extras/complementos**: sí entran en el alcance. La paridad de `NuevaSolicitudPesadaSection.tsx` con los otros dos flujos pesada debe ser completa — tarifa base y precio de cada extra editables por igual. Esto ya quedó reflejado en las Fases 0-3 de arriba.
2. **Alcance confirmado**: el único lugar que necesita edición de tarifa *nueva* es `NuevaSolicitudPesadaSection.tsx` (panel encargado, flujo de solicitud pendiente). Confirmado que ya existe en: panel admin → Nueva Renta (liviana), Nueva Renta Pesada y Renta Retroactiva; panel encargado → Nueva Renta liviana y Renta Retroactiva. Estos cinco flujos no requieren cambios de input, solo se benefician de las Fases 0, 2 y 3 (corrección de bug y visualización).
