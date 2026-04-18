# Precios Adaptativos en Solicitudes de Renta

## Problema que resuelve

Antes de esta implementación, si un encargado escribía "7 días" el sistema
calculaba `7 × tarifa_dia`. Esto era incorrecto: 7 días debería cobrarse
a tarifa semanal (más económica para el cliente).

## Algoritmo: greedy con meses calendario reales

La duración ingresada se descompone en tres componentes:
**meses calendario + semanas completas + días sueltos**.

### Por qué "meses calendario" y no 30 días fijos

El mes no tiene duración fija. Un mes es la distancia entre la misma fecha
en meses consecutivos:

- Inicio 16/04 → 16/05 = **30 días**
- Inicio 16/01 → 16/02 = **31 días**
- Inicio 16/02 → 16/03 = **28 días** (año no bisiesto)

Usar 30 días fijos habría generado desviaciones de hasta ±3 días por mes,
acumulables en rentas largas.

### Proceso del algoritmo

```
totalDias = duracion × (unidad=semanas ? 7 : 1)   // meses se devuelve directamente

cursor = fechaInicio
diasRestantes = totalDias

mientras diasRestantes > 0:
  siguiente = cursor + 1 mes (calendario)
  diasMes   = siguiente - cursor  (días reales)
  si diasRestantes >= diasMes:
    meses++
    diasRestantes -= diasMes
    cursor = siguiente
  sino:
    break

semanas = floor(diasRestantes / 7)
dias    = diasRestantes % 7
```

### Tabla de ejemplos (inicio 16/04/2026)

| Entrada     | Total días | Desglose              | Cobro                          |
|-------------|------------|-----------------------|--------------------------------|
| 7 días      | 7          | 0m + 1sem + 0d        | 1 × tarifa_sem                 |
| 8 días      | 8          | 0m + 1sem + 1d        | 1×sem + 1×dia                  |
| 14 días     | 14         | 0m + 2sem + 0d        | 2 × tarifa_sem                 |
| 5 semanas   | 35         | 1m + 0sem + 5d        | 1×mes + 5×dia                  |
| 6 semanas   | 42         | 1m + 1sem + 2d        | 1×mes + 1×sem + 2×dia          |
| 4 semanas   | 28         | 0m + 4sem + 0d        | 4 × tarifa_sem (abril=30d)     |
| 3 meses     | —          | 3m + 0sem + 0d        | 3 × tarifa_mes (sin adaptar)   |

> **Nota:** 4 semanas (28 días) desde el 16/04 NO convierte a mes, porque
> ese mes tiene 30 días. Desde el 16/02 (mes de 28 días) sí convertiría.
> Este comportamiento es correcto — respeta el calendario real.

## Archivos modificados

### `frontend/src/types/solicitud.types.ts`

**Nuevas exportaciones:**

- `Desglose` — interfaz `{ meses, semanas, dias }`.
- `descomponerDuracion(fechaInicio, duracion, unidad)` — función principal.
- `formatDesglose(d)` — formatea a texto legible ("1 mes + 5 días").
- `esAdaptado(unidad, decomp)` — true si el desglose cambia la unidad base.

**Modificado:**

- `calcSubtotal(item)` — ahora usa `descomponerDuracion` internamente.
  El total se calcula como:
  ```
  subtotal = tarifa_mes × meses + tarifa_semana × semanas + tarifa_dia × dias
  ```
  Para granel, se multiplica además por `item.cantidad`.

`getRentaRate` se mantiene sin cambios para compatibilidad con displays
que necesitan mostrar la tarifa de una unidad específica.

### `frontend/src/components/encargado/MaquinariaPickerForm.tsx`

- **Preview en tiempo real:** cuando el encargado escribe una duración que
  se adapta, aparece un aviso amarillo: *"Se factura como: 1 mes + 5 días"*.
- **Validación actualizada:** en lugar de verificar solo la tarifa de la
  unidad seleccionada, verifica que existan tarifas para cada componente
  del desglose. Ejemplo: 7 días → necesita `rentaSemana` configurada.

### `frontend/src/components/encargado/GranelPickerSection.tsx`

Mismos cambios que `MaquinariaPickerForm`, aplicados a granel.
Incluye lógica para `conMadera` (andamios simples con/sin madera).

### `frontend/src/components/encargado/sections/NuevaSolicitudSection.tsx`

**CartRow (tabla del carrito):**
- Columna "Tarifa" renombrada a "Facturación".
- Cuando hay adaptación: muestra el desglose en ámbar ("1 mes + 5 días").
- Sin adaptación: muestra la tarifa de la unidad seleccionada (comportamiento anterior).

**Panel de resumen lateral:**
- Muestra `→ 1 mes + 5 días` debajo de la duración de cada ítem adaptado.

**Snapshot del ítem:**
- El campo `tarifa` ahora siempre almacena la **tarifa diaria** (`rentaDia`),
  no la tarifa de la unidad seleccionada. Esto corrige el cálculo de recargo
  por atraso (ver sección siguiente).

## Corrección del recargo por atraso

### Problema previo

El campo `tarifa` en el snapshot guardaba la tarifa de la unidad elegida.
Si la renta era semanal, `tarifa = Q1600/semana`. El cálculo de recargo era:

```
recargo = días_de_atraso × tarifa
         = 2 días × Q1600/semana = Q3200  ← INCORRECTO
```

### Comportamiento corregido

Con `tarifa = Q400/día` (siempre diaria):

```
recargo = días_de_atraso × tarifa
         = 2 días × Q400/día = Q800  ← CORRECTO
```

### Impacto en rentas existentes

Las rentas creadas **antes** de este cambio todavía tienen el valor
incorrecto en el campo `tarifa` de sus snapshots. Estas rentas calcularán
el recargo con la tarifa que tenían al momento de la solicitud.

**Alcance:** solo afecta rentas en estado `ACTIVA` creadas antes del deploy
de este cambio. Las rentas nuevas se calculan correctamente.

Si se necesita corregir rentas antiguas, se puede ejecutar un script que
recorra las solicitudes `ACTIVA` y actualice el campo `tarifa` en cada
ítem del JSON. Esta tarea queda pendiente.

## Implicaciones y casos a considerar

### Tarifas faltantes

Si el equipo no tiene configurada la tarifa para algún componente del
desglose (ej: no tiene `rentaSemana` y la duración se adapta a semanas),
la validación del formulario muestra un error antes de agregar el ítem.

El cálculo `subtotalDescompuesto` usa `?? 0` como fallback, por lo que
nunca lanza excepciones — pero puede subestimar el costo si hay nulos.
La validación en el picker previene que esto ocurra en nuevas solicitudes.

### Snapshots históricos

El subtotal de solicitudes antiguas fue calculado con la lógica anterior
(tarifa × duracion). No se recalculan retroactivamente; el `subtotal`
guardado en DB se usa tal como está para mostrar historial.

La lógica adaptativa aplica únicamente al **momento de crear** una
nueva solicitud en el formulario.

### Unidad 'meses' no se adapta

Si el encargado selecciona "meses" directamente, no se aplica
ninguna adaptación. El resultado es `duracion × tarifa_mes`.
Esto es intencional: el encargado eligió explícitamente esa unidad.

### Guatemala y husos horarios

`fechaInicio` se almacena como fecha ISO de solo día (`YYYY-MM-DD`).
La función `descomponerDuracion` construye la fecha con `T00:00:00`
(hora local) para evitar desfases UTC. Los meses calendario se calculan
en tiempo local, que es correcto para la operación del negocio.

## Trabajo pendiente

- **Lógica de recargo adaptativa:** actualmente el recargo por atraso
  siempre se calcula a tarifa diaria. Si el cliente se retrasa 7 días,
  se cobra 7 × tarifa_dia. Aún no se ha definido si esto debería también
  aplicar precios adaptativos (7 días de atraso = 1 semana × tarifa_sem).
  Decisión pendiente con el negocio.

- **Ampliar Renta:** botón que extiende la duración de una renta activa.
  Requiere recalcular `fechaFinEstimada` y posiblemente el `subtotal`.
  Pendiente de implementar.
