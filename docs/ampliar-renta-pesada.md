# Ampliar renta — Maquinaria pesada

## Contexto

La funcionalidad de **ampliar renta** ya existía para maquinaria liviana y equipo a granel.
Para pesada estaba bloqueada explícitamente en el frontend (`s.esPesada ? undefined : onAmpliar`).

La diferencia clave entre tipos de renta al ampliar:

| Tipo | Costo extra al ampliar | Actualiza `fechaFinEstimada` |
|---|---|---|
| Liviana / Granel | Sí — precio vigente × duración | Sí |
| Pesada | No (siempre 0) | Sí |

Para pesada el costo se acumula día a día vía horómetros, por lo que una extensión de renta solo
extiende la ventana de tiempo — no agrega monto al `totalEstimado`.

---

## Cambios implementados

### Backend

#### `solicitudes/dto/ampliar-renta.dto.ts`
Agregado `'pesada'` al validador `@IsIn`:
```typescript
@IsIn(['maquinaria', 'granel', 'pesada'])
kind: string;
```

#### `solicitudes/recargo.util.ts`
`ExtensionEntry.kind` ahora incluye `'pesada'`:
```typescript
kind: 'maquinaria' | 'granel' | 'pesada';
```

#### `solicitudes/solicitudes.service.ts` — método `ampliar`
El bloque de cálculo de costo se envuelve en `if (extDto.kind !== 'pesada')`.
Para pesada, `costoExtra = 0` y se omite la consulta de precios:

```typescript
let costoExtra = 0;

if (extDto.kind !== 'pesada') {
  const precios = await this.fetchPreciosItem(extDto.kind, extDto.itemRef, conMadera);
  if (!precios) throw new BadRequestException(...);
  costoExtra = calcularCostoAdaptativo(...);
}

costoTotalExtra += costoExtra; // 0 para pesada
```

La recalculación de `fechaFinEstimada` funciona igual para pesada porque los ítems del
snapshot (`ItemPesadaSnapshot`) ya tienen los campos `duracion` y `unidad`, que son los mismos
que usa `calcularFinItemConExtensiones`.

### Frontend

#### `types/solicitud-renta.types.ts`
`ExtensionEntry.kind` incluye `'pesada'` para consistencia con el backend.

#### `components/shared/AmpliacionRentaModal.tsx`
- `itemLabel()`: para `kind === 'pesada'` muestra `#numeracion descripcion` (igual que liviana).
- `itemKindLabel()`: devuelve `'Maquinaria pesada'` para pesada.
- `itemRef()`: para pesada usa `item.equipoId` (igual que maquinaria liviana).
- Nota de costo `"El costo se calculará con los precios actuales"` — oculta para pesada.
- Texto del aviso de confirmación ajustado: para pesada dice `"la fecha de finalización estimada se actualizará"` en lugar de `"el costo adicional se sumará"`.

#### `components/encargado/sections/RentasActivasSection.tsx`
Eliminado el guard que bloqueaba el botón Ampliar para pesada:
```tsx
// Antes:
onAmpliar={s.esPesada ? undefined : () => setModalAmpliar(s)}

// Después:
onAmpliar={() => setModalAmpliar(s)}
```

---

## Flujo resultante

1. Encargado abre una renta pesada activa → botón **Ampliar** visible.
2. Modal muestra los equipos pesados con sus numeraciones.
3. Encargado elige duración adicional (días / semanas / meses).
4. Sin texto de costo — el modal confirma solo la extensión de tiempo.
5. Backend guarda la extensión en el campo `extensiones` (JSON), `costoExtra: 0`.
6. `fechaFinEstimada` se recalcula sumando la extensión al fin actual del ítem.
7. `totalEstimado` no cambia (incremento de 0).

---

## Invariantes que se mantienen

- El JSON `items` de la solicitud queda **inmutable** — la extensión solo se escribe en `extensiones`.
- La recalculación de `fechaFinEstimada` usa `Math.min` de todos los ítems (el que vence primero manda), consistente con `confirmarEntrega`.
- Solicitudes pesadas nunca generan costo fijo en `totalEstimado` — ese campo permanece en 0 para pesadas; el costo real se consulta vía `costoAcumuladoPesada`.
