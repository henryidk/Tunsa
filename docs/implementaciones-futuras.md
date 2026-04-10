# Implementaciones futuras

Funcionalidades removidas temporalmente o pendientes de diseño. Cada sección describe qué implica implementarla correctamente y qué decisiones deben tomarse antes de empezar.

---

## Ingresos del mes

**Dónde estaba:** en dos lugares del panel admin/secretaria:

1. **`frontend/src/components/admin/sections/DashboardSection.tsx`** — 4ª tarjeta KPI (`StatCard` con `label="Ingresos del mes"`, valor `Q14,820`, tendencia `+12% vs mes anterior`). El grid era de 4 columnas (`xl:grid-cols-4`); al quitarla quedó en 3 (`sm:grid-cols-3`). Al reimplementar, volver a `sm:grid-cols-2 xl:grid-cols-4`.

2. **`frontend/src/components/admin/TopBar.tsx`** — mini KPI en la barra superior derecha (`"Ingresos mes"`, valor `Q 14,820`), dentro del bloque "Quick KPIs" junto a "Solicitudes hoy". Al reimplementar, agregar de vuelta separado por un divisor `w-px h-9 bg-slate-200`.

**Por qué se removió:** el valor era hardcodeado. Implementarlo correctamente requiere un modelo de datos, reglas de negocio y módulos que aún no existen.

---

### Qué implica implementarlo

#### 1. Decisión de negocio previa (bloqueante)

Antes de escribir una línea de código hay que responder:

**¿Qué es un "ingreso"?**

Hay al menos tres interpretaciones posibles, con modelos de datos distintos:

| Interpretación | Cuándo se registra | Complejidad |
|---|---|---|
| A — Renta cerrada y cobrada | Cuando se marca el pago como recibido | Alta — requiere módulo de pagos |
| B — Renta iniciada ese mes | Cuando la renta empieza (independiente del pago) | Media — se puede calcular de rentas existentes |
| C — Valor estimado de rentas activas | `totalEstimado` de solicitudes aprobadas en el mes | Baja — se puede hacer hoy, pero es una estimación |

**La interpretación C es la más rápida de implementar pero la menos precisa** — mezcla crédito con contado, no refleja pagos reales. Para un negocio real es insuficiente para toma de decisiones.

---

#### 2. Módulos del backend que se necesitan

##### `rentals/` — Rentas
Actualmente `SolicitudRenta` registra la intención de rentar. Falta el módulo que convierte una solicitud aprobada en una renta activa con:
- Fechas reales de inicio y fin
- Estado: `activa | cerrada | vencida`
- Referencia al cliente y a los equipos

##### `credits/` — Créditos
Si el cliente paga a crédito, se necesita rastrear:
- Monto total adeudado
- Abonos parciales con fechas
- Estado de la deuda: `al_dia | atrasado | liquidado`

Sin este módulo, no es posible distinguir si el ingreso del mes corresponde a pagos reales o a montos pendientes de cobro.

##### `cash-requests/` — Cobros / Solicitudes de pago
Registra cuándo y cuánto se cobró por cada renta:
- Método de pago: `efectivo | transferencia | cheque`
- Fecha de pago efectivo
- Quién registró el cobro (auditoría)

> Estos tres módulos están marcados como "pendientes, no trabajar aún" en `CLAUDE.md`. La tarjeta de ingresos depende de al menos uno de ellos.

---

#### 3. Modelo de datos mínimo (Prisma)

```prisma
model Renta {
  id          String   @id @default(cuid())
  solicitudId String   @unique
  solicitud   Solicitud @relation(fields: [solicitudId], references: [id])
  fechaInicio DateTime
  fechaFin    DateTime
  estado      EstadoRenta @default(ACTIVA)
  createdAt   DateTime @default(now())

  pagos       Pago[]
}

model Pago {
  id        String      @id @default(cuid())
  rentaId   String
  renta     Renta       @relation(fields: [rentaId], references: [id])
  monto     Decimal     @db.Decimal(10, 2)
  metodo    MetodoPago
  fechaPago DateTime
  creadoPor String      // username del colaborador que registró
  createdAt DateTime    @default(now())
}

enum EstadoRenta { ACTIVA CERRADA VENCIDA }
enum MetodoPago  { EFECTIVO TRANSFERENCIA CHEQUE }
```

---

#### 4. Endpoint del dashboard

Una vez que existan los pagos, el endpoint sería:

```
GET /dashboard/resumen?mes=2026-04
```

Que devolvería:
```json
{
  "ingresosDelMes": 14820.00,
  "ingresosMesAnterior": 13228.57,
  "variacionPorcentual": 12.04
}
```

La query en Prisma:
```typescript
const inicio = startOfMonth(new Date(mes));
const fin    = endOfMonth(new Date(mes));

const { _sum } = await prisma.pago.aggregate({
  where: { fechaPago: { gte: inicio, lte: fin } },
  _sum:  { monto: true },
});
```

---

#### 5. Consideraciones de precisión

- **Crédito vs. contado:** un cobro a crédito puede registrarse en cuotas a lo largo de varios meses. ¿El ingreso cuenta en el mes de la renta o en el mes de cada abono? Definir antes de implementar.
- **Rentas vencidas impagas:** ¿se muestran como ingreso pendiente o se excluyen del KPI?
- **Redondeo:** usar `Decimal` en Prisma (nunca `Float` para dinero) y formatear en el frontend con `toLocaleString('es-GT', { style: 'currency', currency: 'GTQ' })`.
- **Timezone:** las fechas de pago deben guardarse en UTC y convertirse a la zona horaria del negocio (Guatemala, UTC-6) al hacer los filtros por mes.

---

#### 6. Otros elementos del dashboard que dependen de esto

El botón **"Exportar reporte"** y el selector de mes **"Febrero 2026"** en el header del dashboard también son placeholders. Cuando se implemente ingresos, estos dos elementos cobran sentido:

- **Selector de mes:** filtrar todos los KPIs por el período seleccionado.
- **Exportar reporte:** generar un PDF o CSV con rentas del mes, pagos recibidos, pendientes de cobro. Requiere una librería de generación de documentos en el backend (e.g., `pdfmake`, `puppeteer`, o un template HTML a PDF).

---

### Orden de implementación sugerido

```
1. Módulo rentals/  — convierte solicitudes aprobadas en rentas con fechas
2. Módulo credits/  — gestión de deuda para rentas a crédito
3. Módulo cash-requests/  — registro de cobros y pagos
4. Endpoint GET /dashboard/resumen  — agrega los datos para el KPI
5. Tarjeta "Ingresos del mes" en el dashboard  — conectar con el endpoint
6. Selector de período y exportar reporte  — funcionalidad completa
```

Cada paso depende del anterior. No tiene sentido implementar el KPI del dashboard sin que existan los pagos registrados.
