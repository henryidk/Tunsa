# Stack y Arquitectura — Proyecto Tunsa

Documento de referencia técnica. Refleja el estado actual del proyecto, no el plan inicial.

---

## Stack

### Frontend
```
React 19 + TypeScript + Vite
├── React Router DOM        — rutas y navegación
├── Tailwind CSS            — estilos (único método permitido)
├── Zustand                 — estado global (auth + notificaciones)
├── Axios                   — HTTP requests con interceptores
├── Socket.io-client        — notificaciones en tiempo real
└── lucide-react            — íconos (solo en Login.tsx)
```

### Backend
```
NestJS + TypeScript
├── Prisma ORM              — acceso a base de datos
├── Passport + JWT          — autenticación
├── Socket.io               — WebSocket Gateway
├── bcrypt (12 rounds)      — hash de contraseñas
├── @nestjs/throttler       — rate limiting en login
├── compression             — gzip en todas las respuestas
├── helmet                  — headers de seguridad
├── ioredis                 — cliente Redis
└── @aws-sdk/client-s3      — cliente para Cloudflare R2
```

### Base de datos
```
PostgreSQL 16               — datos principales
Redis 7                     — caché de sesiones de usuario
Cloudflare R2               — almacenamiento de archivos PDF
```

---

## Arquitectura general

```
FRONTEND (React 19 + Vite + TypeScript)
          │
    HTTP REST + WebSocket (Socket.io)
          │
BACKEND (NestJS + TypeScript)
          │
       Prisma ORM
          │
    PostgreSQL 16 + Redis 7
          │
    Cloudflare R2 (archivos PDF)
```

---

## Módulos del backend

```
backend/src/
├── auth/                   — login, JWT, refresh tokens, audit log
│   ├── guards/             — JwtAuthGuard, RolesGuard, LoginThrottlerGuard, MustChangePasswordGuard
│   ├── strategies/         — jwt.strategy.ts (con cache Redis)
│   ├── decorators/         — @CurrentUser(), @Roles(), @SkipMustChangePassword()
│   └── dto/                — login.dto.ts
│
├── users/                  — CRUD de usuarios del sistema
├── equipos/                — inventario de maquinaria (liviana y pesada)
├── categorias/             — tipos y categorías de equipo
├── extras/                 — complementos de maquinaria pesada (martillo, pluma, etc.)
├── granel/                 — inventario a granel (puntales, andamios) y sus precios
├── clientes/               — registro de clientes con documento PDF
├── bitacoras/              — historial de cambios con paginación cursor-based
│
├── solicitudes/            — todo el ciclo de vida de una renta
│   ├── solicitudes.service.ts          — crear, aprobar, entregar, devolver, retroactiva
│   ├── solicitudes-query.service.ts    — consultas paginadas (activas, vencidas, historial)
│   ├── solicitudes.serializer.ts       — serialización de respuestas al frontend
│   ├── solicitudes.gateway.ts          — WebSocket (emite eventos al frontend)
│   ├── renta-vencimiento.scheduler.ts  — cron que marca rentas vencidas
│   ├── horometro.service.ts            — registro diario de horómetros
│   ├── horometro-calc.service.ts       — cálculo de costos por horómetro
│   ├── recargo.util.ts                 — duración, recargos, costos por tipo
│   └── dto/                            — 10+ DTOs para cada operación
│
├── r2/                     — presigned URLs para Cloudflare R2
├── redis/                  — RedisService (get/set/del) + UserCacheService
├── cleanup/                — cron diario: limpia refresh_tokens expirados y audit_logs > 90 días
│
├── prisma/                 — PrismaService + PrismaModule
└── common/
    ├── filters/            — AllExceptionsFilter
    └── utils/date.util.ts  — fechaHoyGT(), fechaGT(), inicioHoyGT()
```

---

## Tablas de base de datos (PostgreSQL)

```
Autenticación
├── usuarios              — usuarios del sistema (admin, secretaria, encargado_maquinas)
├── roles                 — roles del sistema
├── refresh_tokens        — tokens de refresco (revocables)
└── audit_logs            — registro de logins (limpieza automática a 90 días)

Equipos
├── tipos_equipo          — LIVIANA | PESADA | USO_PROPIO
├── categorias            — hija de tipos_equipo
├── equipos               — inventario de maquinaria con precios
├── tipos_extra           — catálogo de complementos (martillo hidráulico, etc.)
└── extras_equipo         — precio de un extra para un equipo específico

Inventario a granel
├── lotes_granel          — compras de puntales/andamios por lote
└── config_granel         — tarifas por tipo (PUNTAL, ANDAMIO_SIMPLE, ANDAMIO_RUEDAS)

Clientes
└── clientes              — ID CLI-0001, nombre, DPI, teléfono, documento PDF en R2

Rentas
├── solicitudes           — ciclo completo: PENDIENTE→APROBADA→ACTIVA→DEVUELTA
├── folio_secuencias      — contador mensual para folios (202606-0001)
├── resumen_items         — registro de cierre por ítem al confirmar entrega
├── detalles_horometro    — extensión de resumen_items para maquinaria pesada
└── lecturas_horometro    — registro diario de horómetro por (solicitud, equipo, fecha)

Auditoría y reportes
├── bitacoras             — historial de cambios en equipos, usuarios, etc.
└── recaudacion_mensual   — totales cobrados por encargado, mes y tipo (pesada/liviana)
```

---

## Estructura del frontend

```
frontend/src/
├── App.tsx                         — rutas principales (Login, Admin, Encargado)
│
├── pages/
│   ├── Login.tsx
│   ├── admin/AdminDashboard.tsx    — panel de administrador (sección única con sidebar)
│   └── encargado/EncargadoDashboard.tsx
│
├── components/
│   ├── admin/
│   │   ├── sections/               — una sección por vista del sidebar admin
│   │   │   ├── DashboardSection.tsx
│   │   │   ├── NuevaRentaLivianaSection.tsx
│   │   │   ├── RentaRetroactivaSection.tsx
│   │   │   ├── SolicitudesSection.tsx
│   │   │   ├── RentasActivasSection.tsx
│   │   │   ├── VencidasSection.tsx
│   │   │   ├── HorometrosSection.tsx
│   │   │   ├── HistorialSection.tsx
│   │   │   ├── EquiposSection.tsx
│   │   │   ├── CategoriasSection.tsx
│   │   │   ├── ClientesSection.tsx
│   │   │   ├── UsuariosSection.tsx
│   │   │   └── BitacorasSection.tsx
│   │   ├── Sidebar.tsx, TopBar.tsx, Toast.tsx, NotificationPanel.tsx
│   │   └── [modales: Agregar/Editar/Baja equipos, usuarios, clientes, etc.]
│   │
│   ├── encargado/
│   │   ├── sections/               — una sección por vista del sidebar encargado
│   │   │   ├── DashboardSection.tsx
│   │   │   ├── NuevaSolicitudSection.tsx      — renta liviana + granel
│   │   │   ├── NuevaSolicitudPesadaSection.tsx
│   │   │   ├── MisSolicitudesSection.tsx
│   │   │   ├── PorEntregarSection.tsx
│   │   │   ├── RentasActivasSection.tsx
│   │   │   ├── VencidasSection.tsx
│   │   │   ├── HorometrosSection.tsx
│   │   │   └── HistorialSection.tsx
│   │   ├── EncargadoSidebar.tsx, EncargadoTopBar.tsx
│   │   ├── GranelPickerSection.tsx, MaquinariaPickerForm.tsx
│   │   ├── DevolucionModal.tsx, DevolucionPesadaModal.tsx
│   │   └── SubirComprobanteModal.tsx
│   │
│   └── shared/                     — componentes usados por ambos paneles
│       ├── RentaActivaCard.tsx, RentaVencidaCard.tsx
│       ├── RentaHistorialCard.tsx, RentaVencidaPesadaCard.tsx
│       ├── DisponibilidadFlotaSection.tsx
│       ├── AmpliacionRentaModal.tsx
│       ├── SolicitudCartTable.tsx
│       └── ClienteNombre.tsx, EspecialBadge.tsx
│
├── hooks/
│   ├── useAuthStore.ts             — estado global de autenticación (Zustand)
│   ├── useAdminSocket.ts           — socket admin: solicitudes nuevas, notificaciones
│   ├── useEncargadoSocket.ts       — socket encargado
│   ├── useSolicitudCart.ts         — carrito de ítems al crear una solicitud
│   ├── useSolicitudData.ts         — datos de equipos/granel para pickers
│   └── usePrecioOverride.ts        — edición de precios (solo admin)
│
├── services/
│   ├── auth.service.ts             — login, refresh, logout + interceptores Axios
│   ├── solicitudes.service.ts
│   ├── clientes.service.ts
│   ├── equipos.service.ts
│   ├── granel.service.ts
│   ├── usuarios.service.ts
│   ├── bitacoras.service.ts
│   └── categorias.service.ts
│
├── store/
│   ├── auth.store.ts               — usuario, accessToken, isAuthenticated
│   └── notifications.store.ts      — panel de notificaciones (máx. 50, FIFO)
│
├── types/
│   ├── auth.types.ts
│   ├── solicitud.types.ts          — ItemSolicitud, formatQ, calcSubtotal, etc.
│   └── solicitud-renta.types.ts    — SolicitudRenta, DevolucionEntry, etc.
│
└── utils/
    ├── generarComprobante.ts       — PDF de comprobante de renta (jsPDF)
    ├── generarLiquidacion.ts       — PDF de liquidación por devolución
    ├── devolucion.helpers.ts       — resolverLabelItem, etc.
    └── horometro.utils.ts          — localDateOf(), formatters de horómetro
```

---

## Roles del sistema

| Rol | Panel | Estado |
|---|---|---|
| `admin` | `/admin` | Implementado completo |
| `encargado_maquinas` | `/encargado` | Implementado completo |
| `secretaria` | `/secretaria` | Rol existe, panel pendiente |

No existe rol `colaborador` ni `permissions` granulares. El control de acceso es únicamente por rol (`RolesGuard`).

---

## Seguridad implementada

| Capa | Implementación |
|---|---|
| Autenticación | JWT access token (15 min) + refresh token httpOnly (7 días) |
| Autorización | `RolesGuard` — control por rol en cada endpoint |
| Contraseñas | bcrypt 12 rounds |
| Rate limiting | `LoginThrottlerGuard` solo en `POST /auth/login` |
| Headers HTTP | `helmet()` global |
| CORS | Restringido a `FRONTEND_URL` |
| Compresión | `compression` (gzip) en todas las respuestas |
| Secrets | Variables de entorno en `.env`, nunca en código |
| Cache invalidation | Redis se invalida explícitamente al cambiar estado del usuario |
| Limpieza automática | Cron 3 AM: borra refresh_tokens expirados + audit_logs > 90 días |

---

## Redis — uso actual

| Uso | Estado | Detalle |
|---|---|---|
| Cache de usuario en JwtStrategy | Implementado | Clave `auth:user:{userId}`, TTL 5 min |
| JWT blacklist | Pendiente | No implementado — logout solo revoca en DB |
| Cola de notificaciones | Pendiente | Socket.io emite directamente sin cola |
| Cache de consultas frecuentes | Pendiente | — |

---

## Cloudflare R2 — convención de claves

```
clientes/{clienteId}/documento.pdf              — documento de identidad del cliente
clientes/{clienteId}/comprobantes/{folio}.pdf   — comprobante de renta firmado
clientes/{clienteId}/liquidaciones/{folio}-{n}.pdf — liquidación por devolución parcial
```

---

## Extensiones recomendadas (VS Code)

- ESLint
- Prettier
- Prisma
- TypeScript and JavaScript Language Features
- Tailwind CSS IntelSense
- Thunder Client (alternativa a Postman)
