# Arquitectura de notificaciones en tiempo real — análisis y decisiones

## El problema concreto

Cuando el encargado de máquinas crea una solicitud, el backend hace dos cosas:

```
POST /solicitudes
  └─ SolicitudesController.create()
       ├─ SolicitudesService.create()              ← guarda en DB
       └─ SolicitudesGateway.emitNuevaSolicitud()  ← notifica por WebSocket
```

El controller orquesta ambas operaciones. Funciona. Pero hay implicaciones.

---

## Por qué esto importa (el análisis SOLID)

### S — Single Responsibility

El controller tiene actualmente **dos razones para cambiar**:

1. Si cambia cómo se procesa una solicitud HTTP (validación, respuesta, errores).
2. Si cambia quién debe ser notificado cuando se crea una solicitud (agregar notificación push, email, SMS, etc.).

Esas son responsabilidades distintas. Una es infraestructura HTTP, la otra es lógica de efectos secundarios del dominio.

### D — Dependency Inversion

El controller depende de **dos implementaciones concretas**:

```typescript
constructor(
  private readonly solicitudesService:  SolicitudesService,  // dominio
  private readonly solicitudesGateway:  SolicitudesGateway,  // infraestructura WS
) {}
```

Esto significa que el controller conoce explícitamente los mecanismos de entrega (WebSocket). Si mañana agregas email, también tendrías que inyectar el servicio de email aquí.

---

## El riesgo real: el problema de la segunda ruta de creación

El acoplamiento actual no duele mientras exista **una sola forma de crear una solicitud**: el endpoint HTTP.

El momento en que esto se vuelve un problema es cuando aparece una segunda vía:

```
Escenario futuro A: El admin aprueba y genera una contra-solicitud
Escenario futuro B: Un job automático crea solicitudes recurrentes
Escenario futuro C: Un endpoint de importación masiva crea N solicitudes
```

En cada uno de esos casos, quien escriba ese nuevo código tiene que **recordar** llamar al gateway manualmente. No hay nada en el sistema que lo garantice. Si se olvida, las notificaciones simplemente no llegan — sin error, sin advertencia.

```typescript
// Futuro hipotético problemático:
async aprobarYContraSolicitar(id: string) {
  const original = await this.solicitudesService.findById(id);
  const nueva = await this.solicitudesService.create(...);
  // ← ¿Alguien recordó llamar emitNuevaSolicitud aquí?
}
```

Esto es lo que Martin Fowler llama un **"shotgun surgery"** invertido: no es que un cambio afecte muchos archivos, sino que una acción (crear solicitud) debería disparar siempre el mismo efecto, pero el efecto está acoplado a la *entrada* en lugar de al *evento*.

---

## Las tres alternativas reales

### Alternativa 1 — Mover la emisión al Service (acoplamiento desplazado)

```typescript
// SolicitudesService
constructor(
  private readonly prisma:   PrismaService,
  private readonly gateway:  SolicitudesGateway,
) {}

async create(dto, username) {
  const solicitud = await this.prisma.solicitud.create({ ... });
  this.gateway.emitNuevaSolicitud(solicitud);
  return solicitud;
}
```

**Ventaja:** el controller queda limpio, solo llama al service.  
**Problema:** el service de dominio ahora depende de infraestructura WebSocket. La capa de dominio no debería saber cómo se entregan las notificaciones. Además, si la gateway necesitara el service en el futuro, tendrías una dependencia circular.

**Veredicto:** Mueve el acoplamiento de lugar, no lo elimina.

---

### Alternativa 2 — Event Emitter (la solución SOLID correcta)

NestJS incluye `@nestjs/event-emitter` para esto.

```typescript
// SolicitudesService — solo lanza el evento
async create(dto, username) {
  const solicitud = await this.prisma.solicitud.create({ ... });
  this.eventEmitter.emit('solicitud.creada', solicitud);
  return solicitud;
}
```

```typescript
// SolicitudesListener — escucha y reacciona
@OnEvent('solicitud.creada')
handleSolicitudCreada(solicitud: SolicitudRenta) {
  this.gateway.emitNuevaSolicitud(solicitud);
}
```

**Ventajas:**
- El service no sabe nada de WebSockets. Solo dice "pasó algo".
- Para agregar email, push notification o un log, creas otro listener. El service no cambia.
- Open/Closed en práctica: extiendes comportamiento sin modificar lo que ya funciona.
- Cada ruta de creación (HTTP, jobs, importaciones) dispara el mismo evento y obtiene las mismas notificaciones automáticamente.

**Desventaja:**
- Más archivos, más boilerplate.
- El flujo ya no es lineal en el código — hay que buscar los listeners para entender qué pasa cuando se crea una solicitud.
- Para un equipo pequeño, puede ser over-engineering.

---

### Alternativa 3 — Mantener el enfoque actual con una convención explícita

No cambiar nada, pero documentar que **toda operación que crea o modifica una solicitud debe pasar por el controller**, que es el punto de coordinación.

```typescript
// SolicitudesController — punto único de coordinación
async create(...) {
  const solicitud = await this.solicitudesService.create(dto, user.username);
  this.solicitudesGateway.emitNuevaSolicitud(solicitud);  // siempre aquí
  return solicitud;
}
```

Si el día de mañana aparece una segunda vía de creación, ese código también pasa por el controller (o llama al controller interno).

**Ventaja:** simple, directo, fácil de entender.  
**Riesgo:** requiere disciplina del equipo. No hay nada en el compilador que lo garantice.

---

## Qué aplica para este proyecto

El proyecto tiene un scope definido: solicitudes creadas únicamente por el encargado de máquinas via el endpoint HTTP. **No hay segunda ruta de creación planificada.**

Dado eso, la Alternativa 3 (la actual) es razonable. El riesgo real es bajo mientras la arquitectura no crezca en esa dirección.

**La regla que hay que mantener:**
> Toda operación que crea una solicitud pasa por `SolicitudesController.create()`. Las notificaciones viven ahí. Si en el futuro hay una segunda entrada, también llama al mismo método del service y al mismo método del gateway desde el controller — o migra a Event Emitter.

**El trigger para migrar a Event Emitter sería:**  
Cuando haya más de una vía de creación, o cuando haya más de un tipo de notificación (email + WebSocket + push) que deba dispararse al crear una solicitud.

---

## Diagrama: estado actual vs. con Event Emitter

```
ACTUAL
──────
HTTP POST → Controller → Service (DB) ─┐
                       → Gateway (WS) ←┘  (controller coordina manualmente)


CON EVENT EMITTER
─────────────────
HTTP POST → Controller → Service (DB) → emit('solicitud.creada')
                                                │
                                     ┌──────────┴──────────┐
                               Listener WS           Listener Email
                             gateway.emit()         mailer.send()
                          (se agrega sin tocar el service ni el controller)
```

---

## Resolución en el frontend (implementado)

La preocupación de tener un único consumidor del evento `solicitud:nueva` en el cliente **quedó resuelta** con el sistema de notificaciones global.

### Antes

```
useSolicitudesSocket
  └─ socket.on('solicitud:nueva') → addSolicitud (un solo store)
```

La lógica de "qué hacer cuando llega una solicitud" estaba acoplada al hook de socket. Para agregar un segundo efecto (badge, sonido), había que modificar ese mismo hook.

### Ahora

```
useAdminSocket
  └─ socket.on('solicitud:nueva') → handleNuevaSolicitud()
                                         ├─ addSolicitud()         → useSolicitudesStore
                                         ├─ addNotification()      → useNotificationsStore
                                         └─ playSound()            (inyectado — DI)
```

**Cada store tiene una responsabilidad única:**

| Store | Responsabilidad |
|---|---|
| `useSolicitudesStore` | Datos de solicitudes + contador del sidebar |
| `useNotificationsStore` | Panel de notificaciones + badge del header |

**`playSound` es una dependencia inyectada** — `useAdminSocket` no sabe cómo generar audio; solo sabe cuándo dispararlo. Esto aplica el principio D (Dependency Inversion) en el frontend.

Para agregar un nuevo efecto al llegar una solicitud (ej. vibración, push notification nativa), se agrega una línea en `handleNuevaSolicitud` — el hook del socket no cambia en estructura, el store no cambia.

### Archivos del sistema de notificaciones

| Archivo | Rol |
|---|---|
| `frontend/src/store/notifications.store.ts` | Store Zustand — máx. 50 notificaciones FIFO, `markRead`, `markAllRead` |
| `frontend/src/hooks/useNotificationSound.ts` | Web Audio API — beep sintético, AudioContext lazy (política autoplay) |
| `frontend/src/hooks/useAdminSocket.ts` | Socket + coordinación de efectos — reemplaza `useSolicitudesSocket` |
| `frontend/src/components/admin/NotificationPanel.tsx` | Dropdown con lista de notificaciones, navegación al hacer clic |
| `frontend/src/components/admin/TopBar.tsx` | Bell con badge numérico, estado del panel, click-outside |

---

## Resumen ejecutivo

| Criterio | Actual (Alt. 3) | Alt. 1 (en service) | Alt. 2 (events) |
|---|---|---|---|
| Simplicidad | Alta | Media | Baja |
| Corrección SOLID | Aceptable | Peor | Óptima |
| Seguro si hay 1 sola entrada | Sí | Sí | Sí |
| Seguro si hay múltiples entradas | Solo con disciplina | Solo con disciplina | Sí, automático |
| Fácil de extender (más notifs.) | No | No | Sí |
| Recomendado ahora | Sí | No | No todavía |
| Recomendado si el sistema crece | Migrar a Alt. 2 | No | Sí |
