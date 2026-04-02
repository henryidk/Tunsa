# Cache de usuario JWT con Redis

## Problema que resuelve

`JwtStrategy.validate()` se ejecuta en cada request autenticado. Sin cache, cada
request hace una query a PostgreSQL para verificar que el usuario existe y está activo.
Con varios usuarios navegando, esto genera decenas de queries por segundo sin ningún
valor de negocio — solo para validar que el token es legítimo.

## Solución implementada

Cache en Redis con TTL de 5 minutos. El flujo por request:

```
Request con Bearer token
        │
        ▼
JwtStrategy.validate()
        │
        ├─ Cache hit  ──────────────────► Retorna usuario (sin DB)
        │
        └─ Cache miss
                │
                ▼
        usersService.findById()  ──► PostgreSQL
                │
                ▼
        Guarda en Redis (5 min TTL)
                │
                ▼
        Retorna usuario
```

Si Redis está caído: el sistema cae al flujo original (DB query) sin errores.

## Arquitectura (3 capas, Single Responsibility)

```
JwtStrategy
    └── UserCacheService   ← QUÉ cachear y cuándo invalidar
            └── RedisService    ← CÓMO hablar con Redis (get/set/del)
```

**RedisService** (`src/redis/redis.service.ts`)
- Wrapper de ioredis. Solo operaciones primitivas: `get`, `set`, `del`.
- No conoce usuarios ni auth.

**UserCacheService** (`src/redis/user-cache.service.ts`)
- Clave: `auth:user:{userId}`
- TTL: 5 minutos (menos que el access token de 15 min)
- Solo cachea `AuthenticatedUser`: `{ id, username, role, mustChangePassword }`
- Nunca cachea el hash de contraseña ni datos sensibles
- Todos los errores de Redis son capturados — nunca propaga excepciones

**RedisModule** (`src/redis/redis.module.ts`)
- Módulo `@Global()` — disponible en todo el proyecto sin importar por módulo

## Invalidación del cache

El cache se invalida explícitamente en cada operación que cambia el estado del usuario:

| Método en UsersService | Invalida cache | Razón |
|---|---|---|
| `setActive(false)` | Sí | Usuario bloqueado — efecto inmediato |
| `setActive(true)` | Sí | Estado cambió |
| `update()` | Sí | Username u otros datos pueden haber cambiado |
| `resetPassword()` | Sí | `mustChangePassword` pasa a `true` |
| `changePassword()` | Sí | `mustChangePassword` pasa a `false` |

## Seguridad

- TTL de 5 min < access token de 15 min: el cache nunca sirve datos más allá de la vida del token.
- Con invalidación explícita: un usuario desactivado queda bloqueado en el próximo request.
- Si Redis falla y no puede invalidar: ventana máxima de riesgo = 5 minutos (TTL residual).
- Nunca se cachea el hash de contraseña.

## Archivos creados/modificados

| Archivo | Acción |
|---|---|
| `src/redis/redis.service.ts` | Creado |
| `src/redis/user-cache.service.ts` | Creado |
| `src/redis/redis.module.ts` | Creado |
| `src/auth/strategies/jwt.strategy.ts` | Modificado — usa UserCacheService |
| `src/users/users.service.ts` | Modificado — invalida cache en cambios de estado |
| `src/app.module.ts` | Modificado — importa RedisModule, agrega REDIS_HOST/PORT a validación |
