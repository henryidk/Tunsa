# Limpieza automática de DB (Cron Job)

## Problema que resuelve

Las tablas `refresh_tokens` y `audit_logs` crecen indefinidamente:

- `refresh_tokens`: cada login crea un registro. Sin limpieza, acumula tokens
  expirados de meses anteriores que nunca volverán a usarse.
- `audit_logs`: cada login/logout/fallo registra una fila. En un sistema con
  uso diario, esto son miles de filas por mes para siempre.

Aunque los índices mantienen las queries rápidas, el volumen desperdicia espacio
en disco y aumenta el tiempo de backups.

## Solución implementada

Cron job diario a las 3:00 AM que limpia ambas tablas con `deleteMany`.

```
Cada día a las 3:00 AM
        │
        ├─ cleanExpiredRefreshTokens()
        │   └─ DELETE FROM refresh_tokens WHERE expiresAt < NOW()
        │
        └─ cleanOldAuditLogs()
            └─ DELETE FROM audit_logs WHERE createdAt < NOW() - 90 días
```

Cada tarea está aislada en try/catch — si una falla, la otra igual se ejecuta
y el error queda registrado en los logs sin afectar al sistema.

## Reglas de retención

| Tabla | Criterio de eliminación | Retención |
|---|---|---|
| `refresh_tokens` | `expiresAt < NOW()` | Hasta expiración natural (7 días) |
| `audit_logs` | `createdAt < NOW() - 90 días` | 90 días |

**refresh_tokens:** se eliminan tanto los revocados como los no revocados que
hayan expirado. Un token expirado no puede usarse bajo ninguna circunstancia,
por lo que no tiene valor conservarlo.

**audit_logs:** 90 días cubre más de un trimestre de trazabilidad. Para un
sistema interno, este período es suficiente para auditorías y revisiones.

## Por qué módulo separado (no dentro de auth)

El módulo `auth` maneja flujos de autenticación — agregar tareas programadas
ahí violaría Single Responsibility. `CleanupModule` es el lugar correcto para
cualquier tarea de mantenimiento de DB, independientemente del módulo de origen
de los datos.

## Índices que aprovecha

Las queries de limpieza usan los índices ya existentes en el schema:

- `refresh_tokens`: `@@index([revoked, expiresAt])` — filtro por `expiresAt`
- `audit_logs`: `@@index([action, createdAt])` — filtro por `createdAt`

## Archivos creados/modificados

| Archivo | Acción |
|---|---|
| `src/cleanup/cleanup.service.ts` | Creado — lógica del cron |
| `src/cleanup/cleanup.module.ts` | Creado — registra ScheduleModule |
| `src/app.module.ts` | Modificado — importa CleanupModule |

## Análisis de seguridad — ningún bug introducido

### `refresh_tokens` — todas las operaciones del sistema

| Dónde | Operación | Conflicto con cleanup |
|---|---|---|
| `login()` | `create` con `expiresAt = ahora + 7 días` | No — el token nuevo tiene expiración futura, cleanup solo toca `expiresAt < NOW()` |
| `refreshTokens()` | `findFirst` donde `revoked: false` | No — JWT verifica la firma antes de llegar a la DB; si el token expiró, es rechazado antes de la query |
| `logout()` | `updateMany` donde `token = X` | No — si cleanup ya borró el token, `updateMany` afecta 0 filas sin lanzar error; logout responde exitosamente igual |
| `setActive(false)` | `updateMany` donde `userId` y `revoked: false` | No — solo revoca activos; los ya borrados por cleanup estaban expirados |
| `resetPassword()` | `updateMany` donde `userId` y `revoked: false` | Mismo caso anterior |
| `changePassword()` | `updateMany` donde `userId` y `revoked: false` | Mismo caso anterior |

### `audit_logs` — todas las operaciones del sistema

`auditLog` **solo tiene operaciones `create`** en todo el proyecto. Nunca se lee,
nunca se consulta, nunca se filtra en ningún endpoint ni servicio. Es una tabla de
escritura pura. El historial visible para el usuario va a `bitacoras`, no a `audit_logs`.
Borrar registros viejos tiene cero impacto funcional.

### Race conditions

| Escenario | Resultado |
|---|---|
| Cron borra token expirado mientras logout intenta revocarlo | `updateMany` afecta 0 filas, no lanza error, retorna exitoso |
| Cron borra token expirado mientras refresh intenta usarlo | JWT verifica expiración antes de la DB query — rechaza el token antes de llegar a la DB |

No existe race condition posible que cause un error o comportamiento incorrecto.

---

## Cambiar el período de retención

En `cleanup.service.ts`, modificar la constante:

```typescript
const AUDIT_LOG_RETENTION_DAYS = 90; // cambiar según necesidad
```
