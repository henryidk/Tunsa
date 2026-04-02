# Optimizaciones pendientes para VPS (2 núcleos, 8GB RAM)

## Estado general
- [ ] 1. Backend en modo producción
- [ ] 2. Frontend estático con Nginx
- [x] 3. Compresión HTTP en backend ✓
- [ ] 4. Límites de recursos en Docker
- [x] 5. Cache de usuario JWT en Redis ✓
- [x] 6. Cron de limpieza de tokens/logs ✓
- [ ] 7. NODE_ENV=production en docker-compose
- [x] 8. Secrets en .env separado ✓

---

## Detalle por problema

### ✅ 3. Compresión HTTP — COMPLETADO
Middleware `compression` agregado en `backend/src/main.ts`.
Reduce respuestas JSON ~70-80% con gzip.

---

### ✅ 5. Cache de usuario JWT en Redis — COMPLETADO
`JwtStrategy.validate()` ahora busca primero en Redis antes de ir a DB.

Archivos creados:
- `backend/src/redis/redis.service.ts` — cliente ioredis con métodos get/set/del
- `backend/src/redis/user-cache.service.ts` — clave `auth:user:{userId}`, TTL 5 min
- `backend/src/redis/redis.module.ts` — módulo global exportado

Archivos modificados:
- `backend/src/auth/strategies/jwt.strategy.ts` — cache hit antes de consultar DB
- `backend/src/users/users.service.ts` — invalidación de cache en setActive, update, resetPassword, changePassword
- `backend/src/app.module.ts` — RedisModule importado, REDIS_HOST/REDIS_PORT en Joi schema

Seguridad: solo usuarios activos se cachean. Redis caído = fallback silencioso a DB.
Documentación completa: `docs/CACHE_JWT_REDIS.md`

---

### ✅ 6. Cron de limpieza de tokens y audit logs — COMPLETADO
Cron job diario a las 3am que elimina registros expirados/antiguos.

Archivos creados:
- `backend/src/cleanup/cleanup.service.ts` — elimina refresh_tokens expirados + audit_logs > 90 días
- `backend/src/cleanup/cleanup.module.ts` — usa `ScheduleModule.forRoot()`

Archivos modificados:
- `backend/src/app.module.ts` — CleanupModule importado

Sin impacto en funcionalidad: audit_log es write-only en el sistema, refresh_tokens expirados ya no son usables.
Documentación completa: `docs/CLEANUP_CRON.md`

---

### ✅ 8. Secrets en .env separado — COMPLETADO
Secrets purificados del historial completo de git con `git filter-branch`.

Cambios:
- `docker-compose.yml` usa `${VAR}` — lee desde `.env` automáticamente
- `.env` creado en raíz del proyecto (nunca se commitea)
- `.env.example` agregado al repo con estructura sin valores reales
- `.gitignore` actualizado: excluye `.env`, `.sql`, `.xlsx`
- Contraseñas cambiadas (las anteriores estaban expuestas en repo público)
- Historial de git reescrito: 0 ocurrencias de secrets en todos los commits

---

### ⬜ 1. Backend en modo producción — CRÍTICO
**Problema:** `entrypoint.sh` ejecuta `npm run start:dev` — usa ts-node con watch mode.
- Compila TypeScript en tiempo real en cada arranque
- Watcher de archivos consume CPU innecesariamente
- ~200-300MB más de RAM de lo necesario

**Fix:**
- Compilar TypeScript a JS con `npm run build` → genera carpeta `dist/`
- Cambiar entrypoint para ejecutar `node dist/main`
- Usar multi-stage Dockerfile: stage 1 compila, stage 2 solo corre el JS

---

### ⬜ 2. Frontend estático con Nginx — CRÍTICO
**Problema:** `Dockerfile` del frontend ejecuta `npm run dev` (servidor Vite de desarrollo).
- HMR, compilación incremental, source maps — innecesarios en producción
- Proceso Node corriendo constantemente consumiendo RAM

**Fix:**
- Multi-stage Dockerfile: stage 1 hace `npm run build` → genera `dist/`
- Stage 2: imagen Nginx sirve los archivos estáticos directamente
- Nginx consume ~10MB RAM vs ~200MB+ del servidor Vite

---

### ⬜ 4. Límites de recursos en Docker Compose — MEDIO
**Problema:** Los 4 contenedores (postgres, redis, backend, frontend) compiten por recursos sin límite. Si uno se dispara, puede tumbar todo el sistema.

**Fix:** Agregar `mem_limit` y `cpus` en `docker-compose.yml`:
- postgres: 2GB RAM, 1 CPU
- backend: 1GB RAM, 0.8 CPU
- redis: 256MB RAM, 0.2 CPU
- frontend/nginx: 128MB RAM, 0.2 CPU

---

### ⬜ 7. NODE_ENV=production — BAJO
**Problema:** `docker-compose.yml` tiene `NODE_ENV: development` en el backend.
Node.js en producción optimiza garbage collector y usa menos memoria.

**Fix:** Cambiar a `NODE_ENV: production` en docker-compose.yml (1 línea).

---
