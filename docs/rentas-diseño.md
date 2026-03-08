# Diseño del módulo de rentas

_Fecha: 2026-03-05_

---

## Estado actual del sistema — Inventario de equipos

### Tabla `equipos` (única tabla de inventario)

Todos los ítems rentables viven aquí — máquinas individuales y puntales por igual.

```
id, numeracion, descripcion, categoria, serie
cantidad      → DEFAULT 1 para máquinas, >1 para materiales a granel
montoCompra   → valor total del lote (cantidad × precioUnitario)
tipo          → LIVIANA | PESADA | USO_PROPIO
rentaDia/Semana/Mes  → precio POR UNIDAD
isActive, motivoBaja, fechaBaja
```

### Discriminador clave

| `cantidad` | Qué es | Cómo se renta |
|---|---|---|
| `= 1` | Máquina individual (bailarina, retroexcavadora…) | Se renta completa — disponible o no |
| `> 1` | Material a granel (puntales telescópicos, metálicos…) | Se rentan X unidades del pool |

### Puntales actualmente en DB

| Numeración | Descripción | Cantidad | Precio total |
|---|---|---|---|
| PT01 | Puntales telescópicos | 100 | Q26,168.00 |
| PM01 | Puntales metálicos | 900 | Q153,000.00 |
| PM02 | Puntales metálicos | 200 | Q34,000.00 |
| PM03 | Puntales metálicos | 300 | Q51,000.00 |
| PM04 | Puntales metálicos | 2 | Q340.00 |

---

## Módulo de rentas — diseño futuro

### Tabla `rentas` (esqueleto sugerido)

```
rentas
├── id
├── equipoId          → FK a equipos
├── cantidadRentada   → siempre 1 para máquinas, variable para puntales
├── clienteId         → FK a clientes
├── fechaInicio
├── fechaFin          → nullable (renta abierta)
├── precioAcordado    → precio real cobrado (puede diferir del catálogo)
├── tipoPrecio        → 'DIA' | 'SEMANA' | 'MES'
├── estado            → 'ACTIVA' | 'DEVUELTA' | 'VENCIDA'
├── observaciones
├── createdAt
└── updatedAt
```

### Lógica de disponibilidad

**Para máquinas individuales (`equipo.cantidad = 1`):**
```
disponible = rentas.filter(r =>
  r.equipoId === equipo.id &&
  r.estado === 'ACTIVA'
).length === 0
```

**Para puntales (`equipo.cantidad > 1`):**
```
unidadesEnRenta = rentas
  .filter(r => r.equipoId === equipo.id && r.estado === 'ACTIVA')
  .reduce((sum, r) => sum + r.cantidadRentada, 0)

unidadesDisponibles = equipo.cantidad - unidadesEnRenta
```

### Cálculo de precio

```
total = precioAcordado × cantidadRentada × númeroDePeriodos

// Ejemplos:
// Bailarina  → Q150/día × 1 unidad × 3 días = Q450
// Puntales   → Q1.50/día × 50 unidades × 7 días = Q525
```

---

## Puntos a no olvidar al implementar rentas

1. **`cantidadRentada` en la renta** — para máquinas siempre será `1`, validar que no se pueda poner otro valor. Para puntales validar que `cantidadRentada ≤ unidadesDisponibles`.

2. **Puntales del mismo tipo en distintos registros** — PM01 (900 uds) y PM02 (200 uds) son lotes separados con `numeracion` diferente. Una renta de puntales metálicos referencia un lote específico. Si se necesita rentar de varios lotes en una sola operación, considerar agruparlos o manejarlo en la UI.

3. **`isActive` ya no basta para puntales** — para una máquina, `isActive = false` significa dada de baja. Para puntales significa lo mismo (baja del inventario), pero la disponibilidad en renta no se controla con ese campo sino con las rentas activas.

4. **Historial por unidades** — cuando un cliente devuelve 30 puntales de 50 rentados, ¿se registra devolución parcial? Definir la política antes de modelar.

5. **El campo `serie`** — irrelevante para puntales, relevante para máquinas. No rompe nada pero sirve de señal adicional: si `serie` es null y `cantidad > 1`, es material a granel.
