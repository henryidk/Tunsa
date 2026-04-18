# Maquinaria pesada en rentas — pendientes de implementar

La maquinaria pesada tiene un modelo de renta distinto al resto: se cobra
por **horas**, no por día/semana/mes. Esto implica cambios en múltiples
capas del sistema que aún no están implementadas.

---

## Estado actual

- El campo `rentaHora` existe en DB y el backend lo gestiona correctamente.
- El modal `PreciosEquipoModal` muestra solo "Precio por hora" para equipos PESADA.
- La tabla de inventario muestra `Q475.00/hr` cuando el precio está configurado.
- **No es posible aún agregar maquinaria pesada a una solicitud de renta.**

---

## Lo que falta implementar

### 1. `UnidadDuracion` — agregar `'horas'`

Actualmente: `'dias' | 'semanas' | 'meses'`
Debe ser: `'dias' | 'semanas' | 'meses' | 'horas'`

Afecta dos archivos:
- `frontend/src/types/solicitud.types.ts`
- `frontend/src/types/solicitud-renta.types.ts`

### 2. `calcSubtotal` para pesada

La lógica adaptativa (dias → semanas → meses) NO aplica a pesada.
El cálculo es simple: `rentaHora × duracion`.

```ts
// En calcSubtotal (solicitud.types.ts):
if (item.kind === 'maquinaria' && item.equipo.tipo.nombre === 'PESADA') {
  return (item.equipo.rentaHora ?? 0) * item.duracion;
}
```

### 3. `PesadaPickerForm` — nuevo componente

Similar a `MaquinariaPickerForm` pero:
- Solo muestra equipos PESADA activos.
- No tiene selector de unidad (siempre `'horas'`).
- Valida que el equipo tenga `rentaHora` configurado.
- No muestra desglose adaptativo (no aplica).

### 4. `useSolicitudData` — cargar equipos PESADA

Actualmente solo carga `equiposLiviana`.
Debe cargar también `equiposPesada` para el picker.

### 5. `NuevaSolicitudSection` — tab de maquinaria pesada

Agregar un tercer sub-tab "Maquinaria pesada" junto a "Maquinaria liviana"
y "A granel", que muestre el `PesadaPickerForm`.

En `submitSolicitud`, para ítems pesada:
```ts
tarifa: item.equipo.rentaHora ?? null,  // en lugar de rentaDia
```

### 6. `calcularFin` — manejar `'horas'`

En `RentasActivasSection` y `VencidasSection`:
```ts
if (unidad === 'horas') return new Date(inicio.getTime() + duracion * 3_600_000);
```

### 7. Recargo para pesada — por hora, no por día

En `VencidasSection`, `calcularRecargoItem` usa `DAY_MS` como granularidad.
Para pesada debe usar `HOUR_MS = 3_600_000`:

```ts
const granularidad = item.unidad === 'horas' ? HOUR_MS : DAY_MS;
return Math.ceil(excesoMs / granularidad) * tarifa;
```

### 8. `formatTiempoRestante` en rentas activas

Para rentas pesada (horas), el tiempo restante debe mostrarse como
horas y minutos desde el inicio, no en días.

### 9. Ampliación de rentas pesada

Cuando se implemente "ampliar renta" para pesada:
- La extensión se ingresa en horas.
- El costo = `rentaHora actual × horasExtra` (sin lógica adaptativa).
- La `fechaFinEstimada` se recalcula sumando `horasExtra × 3_600_000`.

---

## Orden de implementación recomendado

1. Agregar `'horas'` a `UnidadDuracion` en los dos archivos de tipos.
2. Actualizar `calcSubtotal`, `unidadLabel`, `rateSuffix`.
3. Actualizar `calcularFin` y recargo en secciones activas/vencidas.
4. Crear `PesadaPickerForm`.
5. Actualizar `useSolicitudData` y `NuevaSolicitudSection`.
6. Probar el flujo completo de solicitud con pesada.
7. Ajustar "ampliar renta" para soportar extensiones en horas.

---

## Nota sobre el snapshot de ítems pesada

Cuando se guarde un ítem pesada en el JSON de `items`, la `tarifa`
almacenada será `rentaHora` (no `rentaDia`). El recargo y la extensión
deben respetar esa distinción al leer el snapshot.
