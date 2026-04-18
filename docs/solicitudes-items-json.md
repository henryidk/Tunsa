# Solicitudes — campo `items` como JSON

## Por qué se usó JSON

El campo `items` en la tabla `solicitudes` es una columna `JSONB` en PostgreSQL.
La decisión fue intencional: los ítems de una solicitud son un **snapshot histórico** —
una foto del estado en el momento de crear la renta. Si mañana el equipo cambia de
precio, se da de baja, o se elimina, la renta histórica debe seguir mostrando los
datos originales sin verse afectada.

## Estructura actual del JSON

```json
[
  {
    "kind": "maquinaria",
    "equipoId": "cmabc123",
    "numeracion": "15",
    "descripcion": "Cortadora de piso Stihl TS420",
    "fechaInicio": "2026-04-10",
    "duracion": 7,
    "unidad": "dias",
    "tarifa": 400,
    "subtotal": 2800
  },
  {
    "kind": "granel",
    "tipo": "PUNTAL",
    "tipoLabel": "Puntales",
    "cantidad": 50,
    "conMadera": false,
    "fechaInicio": "2026-04-10",
    "duracion": 7,
    "unidad": "dias",
    "tarifa": 15,
    "subtotal": 5250
  }
]
```

El tipo está definido en `frontend/src/types/solicitud-renta.types.ts` como `ItemSnapshot`.

## Cuándo este enfoque funciona bien

- Los ítems son pocos por solicitud (en la práctica: 1–10).
- No se necesita filtrar ni buscar dentro del JSON con frecuencia.
- El dato es esencialmente inmutable una vez creada la solicitud.
- La integridad referencial no es crítica dentro del snapshot (si el equipo
  se elimina, el historial debe sobrevivir igual).

## Limitaciones conocidas

- **No hay integridad referencial**: PostgreSQL no puede garantizar que
  `equipoId` dentro del JSON apunte a un equipo existente.
- **Consultas complejas son costosas**: reportes como "¿cuántas veces se
  rentó el equipo #15?" requieren parsear JSON en lugar de un JOIN simple.
- **Mutaciones son incómodas**: operaciones como "ampliar renta" implican
  leer el JSON, modificarlo en memoria y reescribirlo completo.

## Consideración para "ampliar renta"

Mutar el JSON original de `items` para reflejar una ampliación rompe la
idea de snapshot inmutable y dificulta la auditoría.

**Enfoque recomendado**: agregar un campo separado `extensiones Json?` en
la tabla `solicitudes` que acumule los ajustes sin tocar el JSON original:

```
totalReal = totalEstimado + SUM(extensiones[].costoExtra)
fechaFinReal = MAX(fechaFinEstimada recalculada con extensiones)
```

Así el historial original queda intacto y cada ampliación es auditable
por separado con fecha, duración extra y quién la autorizó.

## Alternativa relacional (para evaluar a futuro)

Si el volumen de reportes por ítem crece, considerar migrar a una tabla
`solicitud_items`:

```
solicitud_items
  ├── id
  ├── solicitudId   FK → solicitudes
  ├── kind          'maquinaria' | 'granel'
  ├── equipoId      FK → equipos (nullable)
  ├── tipo          para granel
  ├── cantidad      para granel
  ├── conMadera     para granel
  ├── fechaInicio
  ├── duracion
  ├── unidad
  ├── tarifa
  └── subtotal
```

Ventajas: JOINs simples, integridad referencial, UPDATE directo para ampliar renta.
Costo: migración de datos existentes + cambios en backend y frontend.

**Recomendación**: no migrar hasta que los reportes por ítem sean una necesidad
real. El JSON es suficiente para el volumen y los casos de uso actuales.
