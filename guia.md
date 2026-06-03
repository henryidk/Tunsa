# Proyecto Tunsa — 

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

### Almacenamiento de archivos
- Cloudflare R2 — PDFs de comprobantes y liquidaciones
- Claves de objetos: `clientes/CLI-XXXX/comprobantes/FOLIO.pdf`, `clientes/CLI-XXXX/liquidaciones/FOLIO-N.pdf`

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
- `equipos/` — inventario de maquinaria (liviana, pesada, extras)
- `categorias/` — tipos y categorías de equipo
- `bitacoras/` — historial de cambios (cursor-based pagination)
- `clientes/` — registro de clientes (con documento PDF en R2)
- `solicitudes/` — todo el ciclo de rentas:
  - `solicitudes.service.ts` — lógica principal (crear, aprobar, entregar, devolver, retroactiva)
  - `solicitudes-query.service.ts` — consultas paginadas (activas, vencidas, historial)
  - `horometro.service.ts` — registro diario de horómetros para maquinaria pesada
  - `horometro-calc.service.ts` — cálculos de costos por horómetro
  - `solicitudes.serializer.ts` — serialización de respuestas al frontend
  - `renta-vencimiento.scheduler.ts` — cron que marca rentas como vencidas
  - `solicitudes.gateway.ts` — WebSocket gateway (base implementada)
  - `recargo.util.ts` — utilidades de fechas, duración y recargos

### Pendientes de implementar
- `credits/`, `cash-requests/`, `notifications/` — no trabajar en estos aún.

---

## Páginas del frontend por rol

### Admin (`frontend/src/pages/admin/AdminDashboard.tsx`)
- Dashboard
- Nueva Renta (liviana + granel, con edición de precios)
- Renta Retroactiva (fecha manual, va directo a ACTIVA sin etapa de entrega)
- Solicitudes (aprobación/rechazo de solicitudes del encargado)
- Rentas Activas
- Rentas Vencidas
- Horómetros
- Historial
- Disponibilidad (flota)
- Equipos, Categorías, Clientes, Usuarios, Bitácoras

### Encargado de máquinas (`frontend/src/pages/encargado/`)
- Nueva Solicitud Liviana
- Nueva Solicitud Pesada
- Mis Solicitudes (pendientes de aprobación)
- Por Entregar (aprobadas pendientes de entrega)
- Rentas Activas (las suyas)
- Horómetros
- Historial

### Pendiente
- Panel de Secretaria — no trabajar en esto aún.

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
- `AuthenticatedUser` (interfaz en `auth/interfaces/jwt-payload.interface.ts`):
  ```typescript
  interface AuthenticatedUser {
    id:                 string;
    username:           string;
    nombre:             string;  // nombre completo, no el username
    role:               string;
    mustChangePassword: boolean;
  }
  ```
  Usar `user.nombre` para registrar quién realizó una acción (devoluciones, horómetros, etc.). Nunca `user.username` con ese propósito.

### Validación
- `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`.
- Todos los endpoints usan DTOs con `class-validator`.

### Base de datos
- Paginación cursor-based para tablas grandes (bitácoras, historial de rentas).
- OFFSET/LIMIT para tablas acotadas (equipos, clientes, pageSize máximo 500).
- Bitácora: usar `createMany` cuando hay múltiples campos editados.
- No usar SQL crudo — solo Prisma.

### Módulo de solicitudes — patrones específicos

**Campos JSONB:** `items`, `devolucionesParciales` y `extensiones` en el modelo `Solicitud` son JSONB. Nunca modificar estos campos con SQL directo — siempre leer, mutar en memoria y actualizar con Prisma.

**Serializer:** todas las respuestas de solicitudes pasan por `SolicitudesSerializer.serialize()` antes de enviarse al frontend. No devolver el objeto de Prisma crudo.

**`crearRegistrosSeguimiento()`:** debe llamarse al confirmar entrega Y al crear rentas retroactivas. Crea los registros en `resumen_items` necesarios para el cierre de renta. No omitir.

**Rentas retroactivas:** endpoint `POST /solicitudes/retroactiva` (solo admin). Crea la solicitud directamente en estado `ACTIVA` con la fecha de inicio provista por el usuario, sin pasar por etapas de aprobación ni entrega.

**Rentas indefinidas:** cuando `esIndefinida = true` (solo clientes especiales), `fechaFinEstimada` queda en `null`. El costo se calcula con `descomponerCalendario()` al momento de la devolución.

---

## Convenciones del frontend

### Estilos
- Solo Tailwind CSS. Sin CSS custom, sin Bootstrap, sin ningún otro framework.
- Colores primarios: `indigo-600` (acciones principales), `slate` (neutrales), `red` (destructivo).
- Fuentes: Inter (sans), JetBrains Mono (mono) — cargadas via Google Fonts en `index.html`.

### Tipografía — escala mínima
- **Piso mínimo para texto funcional: `text-xs` (12px).** No usar `text-[10px]` ni `text-[11px]` en texto que el usuario deba leer.
- `text-[10px]` solo permitido en elementos puramente decorativos (ej: abreviatura de mes en widget de calendario).
- Escala de referencia:
  - `text-2xl font-bold` — título de página (h1)
  - `text-sm` — cuerpo de tabla, descripciones
  - `text-xs` — celdas secundarias, labels de sección, badges funcionales

### Modales
- Deben estar dentro del elemento raíz JSX del componente, no como hermanos del return.
- Patrón de referencia para modales destructivos: `BajaEquipoModal.tsx` (botón rojo).

### Estado
- Zustand para estado global de autenticación (`useAuthStore`).
- Estado local con `useState` para UI de componentes.

### Precios y overrides
- **Admin** puede editar precios de ítems individuales en el carrito — usar el hook `usePrecioOverride`.
- **Encargado** no puede editar precios — no pasar `onSetOverride` a `SolicitudCartTable`.

### Fechas y zonas horarias
Ver `docs/fechas-timezone.md` para el detalle completo. Reglas clave:
- Guatemala = UTC-6 fijo (sin horario de verano).
- Usar `fechaHoyGT()` para generar "hoy" en el backend. Nunca `new Date()` en campos `@db.Date`.
- Usar `fechaGT(d)` para convertir un timestamp UTC a fecha guatemalteca.
- `formatFecha` en `src/utils/format.ts` para mostrar fechas en el frontend.
- Inputs `datetime-local` → `new Date(val).toISOString()` es seguro porque el browser interpreta la cadena como hora local.

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
| `R2_ACCOUNT_ID` | Cloudflare R2 — ID de cuenta |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 — Access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 — Secret key |
| `R2_BUCKET` | Cloudflare R2 — nombre del bucket (default: `tunsa-archivos`) |
| `VITE_API_URL` | URL del backend (solo frontend, prefijo VITE_) |

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

El documento original de arquitectura está en: `docs/Stack .md`

Documentación adicional en `docs/`:
- `fechas-timezone.md` — manejo de fechas y zona horaria Guatemala (UTC-6)
