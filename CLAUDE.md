# Proyecto Tunsa — Guía para Claude

Este archivo define las convenciones técnicas del proyecto y la arquitectura planificada.
Claude debe respetarlas en toda modificación o nueva funcionalidad.

---

## Stack definitivo

### Frontend
- React 19 + TypeScript + Vite
- React Router DOM (rutas)
- Tailwind CSS (estilos — único método permitido, sin CSS custom ni Bootstrap)
- Zustand (estado global)
- Socket.io-client (notificaciones tiempo real — pendiente de implementar)
- Axios (HTTP requests)

### Backend
- NestJS + TypeScript
- Prisma ORM (no usar SQL crudo)
- Socket.io — WebSocket Gateway para notificaciones en tiempo real (pendiente)
- Passport + JWT (autenticación)
- bcrypt con 12 rounds (hash de contraseñas)
- Winston (logging — instalado, pendiente de configurar)

### Base de datos
- PostgreSQL 16 (datos principales)
- Redis 7 (caché + sesiones + cola de notificaciones)

---

## Arquitectura general

```
FRONTEND (React + Vite + TS)
        |
  HTTP REST + WebSocket
        |
BACKEND (NestJS + TypeScript)
        |
     Prisma ORM
        |
PostgreSQL + Redis
```

---

## Redis — estado actual y usos planificados

### Implementado
- **Cache de usuario en JwtStrategy** — `UserCacheService` en `backend/src/redis/`
  - Clave: `auth:user:{userId}`, TTL: 5 minutos
  - Invalidación explícita en setActive, update, resetPassword, changePassword

### Pendientes
1. **JWT blacklist** — invalidar tokens al hacer logout (en lugar de solo marcar en DB)
2. **Cola de notificaciones en tiempo real** — eventos para Socket.io
3. **Cache de consultas frecuentes** — roles, permisos

Al implementar cualquiera de estos, usar `ioredis` (ya instalado). No instalar otro cliente Redis.

---

## Módulos del backend

### Implementados
- `auth/` — JWT + Passport + refresh tokens + audit log
- `users/` — gestión de usuarios
- `equipos/` — inventario de maquinaria
- `categorias/` — tipos y categorías de equipo
- `bitacoras/` — historial de cambios (cursor-based pagination)
- `clientes/` — registro de clientes

### Pendientes de implementar
- `rentals/`, `credits/`, `cash-requests/`, `notifications/` — no trabajar en estos aún.

---

## Páginas del frontend por rol

### Admin (implementado)
- Dashboard, Equipos, Categorías, Clientes, Usuarios, Bitácoras

### Otros roles (pendiente — no trabajar en estos aún)
- Secretaria, Colaborador, Encargado de máquinas

---

## Convenciones del backend

### Compresión HTTP
Todas las respuestas están comprimidas con gzip via middleware `compression`.

**Configurado en `backend/src/main.ts`:**
```typescript
import compression from 'compression';
app.use(compression());
```
- No desactivar ni omitir.
- Paquetes requeridos: `compression` + `@types/compression` (ya instalados).

### Seguridad
- `helmet()` activo globalmente — no eliminar.
- CORS restringido a `FRONTEND_URL`.

### Autenticación
- Access token: 15 minutos
- Refresh token: 7 días, en httpOnly cookie
- `JwtStrategy.validate()` usa cache Redis; solo consulta DB si hay cache miss.

### Validación
- `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.
- Todos los endpoints usan DTOs con `class-validator`.

### Base de datos
- Paginación cursor-based para tablas grandes (bitácoras).
- OFFSET/LIMIT para tablas acotadas (equipos, clientes, pageSize máximo 500).
- Bitácora: usar `createMany` cuando hay múltiples campos editados.
- No usar SQL crudo — solo Prisma.

---

## Convenciones del frontend

### Estilos
- Solo Tailwind CSS. Sin CSS custom, sin Bootstrap, sin ningún otro framework.
- Colores primarios: `indigo-600` (acciones principales), `slate` (neutrales), `red` (destructivo).
- Fuentes: Inter (sans), JetBrains Mono (mono) — cargadas via Google Fonts en `index.html`.

### Modales
- Deben estar dentro del elemento raíz JSX del componente, no como hermanos del return.
- Patrón de referencia para modales destructivos: `BajaEquipoModal.tsx` (botón rojo).

### Estado
- Zustand para estado global de autenticación (`useAuthStore`).
- Estado local con `useState` para UI de componentes.

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secreto access token (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secreto refresh token (min 32 chars) |
| `JWT_EXPIRATION` | Duración access token (default: 15m) |
| `JWT_REFRESH_EXPIRATION` | Duración refresh token (default: 7d) |
| `FRONTEND_URL` | URL del frontend para CORS |
| `REDIS_HOST` / `REDIS_PORT` | Conexión a Redis |
| `NODE_ENV` | `development` o `production` |
| `PORT` | Puerto del backend (default: 4000) |

---

## Reglas de seguridad

Estas reglas son obligatorias. No tienen excepción.

### Instalación de paquetes

Cada vez que se agrega un paquete al proyecto (`npm install <paquete>`), debe instalarse en dos lugares:

1. **En el host** (directorio `backend/` o `frontend/`):
   ```bash
   cd backend && npm install <paquete>
   ```
2. **Dentro del contenedor Docker** (para que el proceso en ejecución lo reconozca sin reconstruir):
   ```bash
   docker exec tunsa_backend npm install <paquete>
   docker restart tunsa_backend
   ```

Si no se hace en ambos lados, el contenedor arrancará con errores `Cannot find module` porque su `node_modules` no tiene el paquete nuevo.

---

### Secrets y credenciales

- **Nunca hardcodear** contraseñas, tokens, API keys, JWT secrets ni connection strings en ningún archivo del proyecto — ni en código, ni en `docker-compose.yml`, ni en scripts, ni en comentarios.
- **Toda credencial va en `.env`** (en la raíz del proyecto, nunca commiteada).
- **`.env` siempre en `.gitignore`** — verificar antes de cualquier `git add`.
- **`.env.example` es el único archivo de entorno que va al repositorio** — debe tener la estructura pero sin valores reales (usar placeholders como `CAMBIA_ESTO`).
- Antes de hacer `git add .` o `git add -A`, revisar qué archivos se están incluyendo. Nunca usar estos comandos sin verificar primero con `git status`.

### Archivos que nunca deben commitearse
- `.env`, `.env.*` (excepto `.env.example`)
- Backups de base de datos: `*.sql`, `*.dump`
- Archivos con datos reales: `*.xlsx`, `*.xls`, `*.csv` con información de clientes/usuarios
- Certificados y llaves privadas: `*.pem`, `*.key`, `*.p12`

### Código del backend

- **Nunca exponer contraseñas en respuestas HTTP** — el campo `password` nunca debe estar en ningún objeto que se devuelva al frontend. Usar siempre `select` de Prisma para excluirlo explícitamente.
- **Nunca loguear credenciales** — no hacer `console.log` ni `logger.log` de passwords, tokens o secrets, ni siquiera en desarrollo.
- **Validar siempre en el backend** — nunca confiar en validaciones del frontend. Toda entrada de usuario pasa por DTOs con `class-validator`.
- **Nunca usar SQL crudo** — solo Prisma. El SQL crudo sin parametrizar es vulnerable a inyección.

### Si se expone un secret accidentalmente

1. Cambiar la credencial expuesta **inmediatamente** (contraseña de DB, JWT secret, etc.)
2. Purgar el secret del historial de git con `git filter-branch` o `git filter-repo`
3. Hacer force push al repositorio remoto
4. Revocar todos los tokens activos si aplica

---

## Estándares de código

### Clean Code
- Nombres descriptivos: variables, funciones y clases deben expresar su intención sin necesidad de comentarios.
- Funciones pequeñas con una sola responsabilidad. Si una función hace más de una cosa, dividirla.
- Sin código muerto: no dejar variables sin usar, imports innecesarios ni funciones que nunca se llaman.
- Comentarios solo cuando la lógica no es autoevidente. No comentar lo obvio.
- No duplicar lógica — si algo se repite dos veces o más, extraerlo a una función o helper.

### Principios SOLID
- **S — Single Responsibility:** cada clase/servicio hace una sola cosa. Los servicios de NestJS no mezclan lógica de negocio con acceso a datos ni con formateo de respuestas.
- **O — Open/Closed:** extender funcionalidad sin modificar código existente que ya funciona. Usar herencia, interfaces o composición.
- **L — Liskov Substitution:** las implementaciones deben ser intercambiables con su abstracción sin romper el sistema.
- **I — Interface Segregation:** no forzar a una clase a implementar métodos que no necesita. DTOs y interfaces deben ser específicos.
- **D — Dependency Inversion:** depender de abstracciones, no de implementaciones concretas. NestJS ya facilita esto con inyección de dependencias.

---

## Referencia de arquitectura

El documento original de arquitectura está en: `docs/Stack .pdf`
