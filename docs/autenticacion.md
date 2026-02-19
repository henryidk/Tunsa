# Autenticación — Sistema de Login

## Tecnologías involucradas

| Capa | Tecnología |
|---|---|
| Frontend | React + Zustand + Axios |
| Backend | NestJS + Prisma + JWT + bcrypt |
| Base de datos | PostgreSQL |

---

## Flujo completo de login

```
Usuario escribe credenciales
        ↓
   Login.tsx (UI)
        ↓
 useAuthStore.login()       ← Zustand store
        ↓
 authService.login()        ← Axios POST /api/auth/login
        ↓
  AuthController.login()    ← NestJS (con rate limiting)
        ↓
  AuthService.login()
    ├── Busca usuario en BD
    ├── Verifica que esté activo
    ├── Verifica contraseña (bcrypt)
    ├── Genera accessToken (15min) y refreshToken (7 días)
    ├── Guarda refreshToken en BD
    └── Registra evento en AuditLog
        ↓
  Respuesta al frontend:
    ├── Body → { accessToken, user }
    └── Cookie HttpOnly → refreshToken
        ↓
  Store guarda en localStorage:
    ├── accessToken
    └── user (id, username, nombre, telefono, role)
        ↓
  Redirección según rol del usuario
```

---

## Tokens

El sistema usa **dos tokens** con responsabilidades distintas:

### Access Token (JWT)
- **Duración:** 15 minutos
- **Almacenamiento:** `localStorage`
- **Uso:** Se envía en el header `Authorization: Bearer <token>` en cada request
- **Payload:** `{ sub, username, role }`

### Refresh Token (JWT)
- **Duración:** 7 días
- **Almacenamiento:** Cookie `HttpOnly` (no accesible desde JavaScript)
- **Uso:** Solo para renovar el access token cuando expira
- **Seguridad:** Se guarda también en la base de datos para poder revocarlo

---

## Renovación automática de token

Cuando el access token expira, el frontend lo detecta automáticamente sin que el usuario lo note:

```
Request cualquiera → 401 Unauthorized
        ↓
Interceptor de Axios detecta el 401
        ↓
POST /api/auth/refresh (envía refreshToken por cookie)
        ↓
Backend verifica que el refreshToken:
  ├── Sea válido (firma JWT)
  └── No esté revocado en BD
        ↓
Retorna nuevo accessToken
        ↓
Se reintenta el request original con el nuevo token
```

Si hay múltiples requests fallando al mismo tiempo, se encolan y se resuelven todos con el mismo token nuevo (evita múltiples llamadas a `/refresh` en paralelo).

Si el refresh también falla (token expirado o revocado), se limpia el localStorage y se redirige al login.

---

## Logout

```
useAuthStore.logout()
        ↓
POST /api/auth/logout (envía refreshToken por cookie)
        ↓
Backend marca el refreshToken como revocado en BD
Backend elimina la cookie
        ↓
Frontend limpia localStorage (accessToken + user)
Frontend resetea el estado del store
```

---

## Validaciones del backend

El `LoginDto` valida el body antes de llegar al servicio:

| Campo | Reglas |
|---|---|
| `username` | Requerido, string, máx. 20 caracteres |
| `password` | Requerido, string, mín. 6 caracteres, máx. 20 caracteres |

Además, el endpoint `/api/auth/login` tiene **rate limiting** (`ThrottlerGuard`) para prevenir ataques de fuerza bruta.

---

## Auditoría

Cada intento de login queda registrado en la tabla `AuditLog` con:

| Evento | Cuándo ocurre |
|---|---|
| `LOGIN_FAILED` | Usuario no encontrado |
| `LOGIN_FAILED` | Usuario inactivo |
| `LOGIN_FAILED` | Contraseña incorrecta |
| `LOGIN_SUCCESS` | Login exitoso |

Cada registro incluye: `userId`, `username`, `ipAddress`, `userAgent`, `timestamp` y detalles del motivo en caso de fallo.

---

## Redirección por rol

Luego de un login exitoso, el frontend redirige según el rol del usuario:

| Rol | Ruta |
|---|---|
| `admin` | `/admin` |
| `secretaria` | `/secretaria` |
| `colaborador` | `/colaborador` |
| `encargado_maquinas` | `/encargado-maquinas` |

---

## Librerías utilizadas

### Backend

| Librería | Rol en la autenticación |
|---|---|
| `@nestjs/jwt` | Genera y verifica los JWT (access y refresh token) |
| `@nestjs/passport` + `passport-jwt` | Estrategia de autenticación JWT para proteger rutas |
| `@nestjs/throttler` | Rate limiting en el endpoint de login (previene fuerza bruta) |
| `@nestjs/config` | Acceso a variables de entorno (`JWT_SECRET`, `PORT`, etc.) |
| `bcrypt` | Hashea contraseñas al crear usuarios y las compara al hacer login |
| `class-validator` + `class-transformer` | Valida y transforma el body del request via DTOs (`LoginDto`) |
| `cookie-parser` | Permite leer la cookie `HttpOnly` que contiene el refresh token |
| `helmet` | Agrega headers de seguridad HTTP a todas las respuestas |
| `joi` | Valida que las variables de entorno estén definidas correctamente al iniciar el servidor |
| `@prisma/client` | ORM para consultar la base de datos (usuarios, tokens, audit logs) |

### Frontend

| Librería | Rol en la autenticación |
|---|---|
| `zustand` | Maneja el estado global de autenticación (`user`, `accessToken`, `isAuthenticated`) |
| `axios` | Realiza las llamadas HTTP e incluye interceptores para agregar el token y manejar el refresh automático |
| `react-router-dom` | Navega hacia la ruta correcta según el rol del usuario tras el login |
| `lucide-react` | Íconos del formulario (mostrar/ocultar contraseña, spinner de carga) |
| `tailwindcss` | Estilos del formulario de login |

### Pendiente de implementar

Estas librerías están instaladas pero aún no están integradas en el código:

| Librería | Uso previsto |
|---|---|
| `winston` + `nest-winston` | Logging estructurado del servidor (reemplazará los `console.log`) |
| `ioredis` | Cliente de Redis (previsto para caché o manejo de sesiones) |
| `socket.io` / `socket.io-client` | Comunicación en tiempo real (WebSockets) |
| `@tanstack/react-query` | Manejo de estado del servidor y caché de requests en el frontend |

---

## Archivos clave

| Archivo | Responsabilidad |
|---|---|
| `frontend/src/pages/Login.tsx` | UI del formulario |
| `frontend/src/store/auth.store.ts` | Estado global de autenticación (Zustand) |
| `frontend/src/services/auth.service.ts` | Llamadas HTTP + interceptores de Axios |
| `backend/src/auth/auth.controller.ts` | Endpoints: `/login`, `/refresh`, `/logout` |
| `backend/src/auth/auth.service.ts` | Lógica de negocio: validación, tokens, auditoría |
| `backend/src/auth/dto/login.dto.ts` | Validación del body de login |
| `backend/src/auth/strategies/jwt.strategy.ts` | Estrategia JWT para rutas protegidas |
| `backend/src/auth/guards/jwt-auth.guard.ts` | Guard para proteger rutas |
| `backend/src/auth/guards/roles.guard.ts` | Guard para control de acceso por rol |
