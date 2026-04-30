# Manejo de fechas y zonas horarias

Guatemala está en UTC-6 fijo (sin horario de verano). El servidor corre en UTC. Si no se maneja la conversión explícitamente, una fecha como `2026-04-30` puede mostrarse como `29/04/2026` después de las 6 PM Guatemala.

---

## Estado actual — implementado y funcionando

### Base de datos

Los campos de solo-fecha usan el tipo `DATE` de PostgreSQL (`@db.Date` en Prisma). No almacenan hora ni zona horaria — solo año, mes y día.

```prisma
model Equipo {
  fechaCompra  DateTime  @db.Date
  fechaBaja    DateTime? @db.Date
}

model LoteGranel {
  fechaCompra  DateTime? @db.Date
}

model LecturaHorometro {
  fecha  DateTime @db.Date   // ya era correcto desde el inicio
}
```

Los campos de timestamp completo (`fechaInicioRenta`, `fechaDecision`, `fechaEntrega`, `fechaDevolucion`, etc.) permanecen como `TIMESTAMPTZ` — son instantes exactos en el tiempo y están correctos así.

### Backend — utilitario de fechas Guatemala

**Archivo:** `src/common/utils/date.util.ts`

```ts
// fechaHoyGT() → "2026-04-30" en hora Guatemala, correcto a cualquier hora del día
// inicioHoyGT() → medianoche Guatemala como Date UTC, para queries de "hoy"
// fechaGT(d)   → convierte cualquier Date UTC a "YYYY-MM-DD" Guatemala
```

**Regla:** cualquier vez que el backend genere una fecha de "hoy" para guardar en un campo `@db.Date`, usar `fechaHoyGT()`. Nunca `new Date()` para ese propósito.

```ts
// ✅ Correcto — funciona a cualquier hora del día
fechaBaja: fechaHoyGT()

// ❌ Incorrecto — después de las 6 PM Guatemala guarda el día siguiente
fechaBaja: new Date()
```

**Para queries que filtran por "hoy"** (como bitácoras del día):
```ts
// ✅ Correcto
const hoyStart = inicioHoyGT();

// ❌ Incorrecto — usa medianoche UTC, no medianoche Guatemala
const hoyStart = new Date();
hoyStart.setHours(0, 0, 0, 0);
```

### Backend — serialización de fechas

Los serializadores de cada service convierten los campos `@db.Date` a cadenas `"YYYY-MM-DD"` antes de enviarlos al frontend:

```ts
private serialize(equipo: any) {
  return {
    ...equipo,
    fechaCompra: equipo.fechaCompra instanceof Date
      ? equipo.fechaCompra.toISOString().substring(0, 10)
      : equipo.fechaCompra,
    fechaBaja: equipo.fechaBaja instanceof Date
      ? equipo.fechaBaja.toISOString().substring(0, 10)
      : equipo.fechaBaja,
  };
}
```

El frontend recibe `"2026-04-30"` — nunca un timestamp con zona horaria.

### Frontend — mostrar fechas

**Una sola función para todo:** `formatFecha` en `src/utils/format.ts`.

```ts
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = iso.length === 10
    ? new Date(iso + 'T12:00:00')  // solo-fecha → mediodía local, sin riesgo de rollover
    : new Date(iso);                // timestamp completo → hora local
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
```

No duplicar esta función en componentes individuales. Siempre importar desde `utils/format.ts`.

**Para extraer la fecha local de un timestamp completo** (como `fechaInicioRenta`):

```ts
import { localDateOf } from '../../../utils/horometro.utils';

const fechaLocal = localDateOf(new Date(solicitud.fechaInicioRenta));
// → "2026-04-30" en hora Guatemala
```

---

## Consideraciones para nuevas funcionalidades

### Lo que está cubierto hoy

- Todos los campos `@db.Date` actuales funcionan correctamente a cualquier hora del día.
- Las utilidades `fechaHoyGT()` e `inicioHoyGT()` garantizan la fecha Guatemala correcta donde ya se usan.
- El frontend muestra fechas correctamente con `formatFecha` y `localDateOf`.

### Lo que no está garantizado automáticamente

**1. Código futuro.** Si se agrega un campo de solo-fecha nuevo y no se usa `@db.Date` + `fechaHoyGT()`, el bug regresa. La protección es una convención, no un mecanismo automático.

**2. Módulos no revisados.** Solo se analizaron los servicios principales activos. Cuando se implementen módulos nuevos (rentals, créditos, etc.), hay que aplicar las mismas reglas desde el inicio.

**3. Datos históricos.** Registros creados antes de esta corrección que pudieron haberse guardado con fecha incorrecta permanecen con ese valor en la DB. No se tocaron.

**4. `fechaFinEstimada`.** Es `TIMESTAMPTZ` calculada en UTC. Funciona bien para las queries de vencidas. Si en el futuro se muestra en más lugares, usar `formatFecha` correctamente.

### Checklist para cualquier campo de fecha nuevo

- [ ] ¿Es solo-fecha (sin hora)? → declarar `@db.Date` en `schema.prisma`
- [ ] ¿El service tiene un `serialize()` que lo convierte a `"YYYY-MM-DD"`?
- [ ] ¿El backend genera la fecha del sistema (hoy)? → usar `fechaHoyGT()`, nunca `new Date()`
- [ ] ¿Hay un query que filtra por "hoy"? → usar `inicioHoyGT()`, nunca `setHours(0,0,0,0)`
- [ ] ¿El frontend lo muestra? → usar `formatFecha` de `utils/format.ts`
- [ ] ¿Se extrae fecha de un timestamp completo? → usar `localDateOf(new Date(iso))`
