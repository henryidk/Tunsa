# Deploy y Operaciones en Producción

## Infraestructura

| Servicio | Imagen | Puerto interno |
|---|---|---|
| `tunsa_postgres` | postgres:16-alpine | 5432 |
| `tunsa_redis` | redis:7-alpine | 6379 |
| `tunsa_backend` | build local (NestJS) | 4000 |
| `tunsa_frontend` | build local (nginx + React) | 80 |

El frontend actúa como reverse proxy: `/api/*` y `/socket.io/*` se redirigen al backend en la red interna de Docker.

---

## Variables de entorno

El archivo `.env` vive en la raíz del repositorio **solo en el VPS**, nunca se commitea al repo.  
Ver `.env.example` para la estructura completa.

Variables relevantes para operaciones:

| Variable | Para qué se usa |
|---|---|
| `DATABASE_URL` | Conexión de Prisma a Postgres |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Firma de tokens |
| `ADMIN_SEED_PASSWORD` | Contraseña del admin al correr el seed por primera vez |
| `R2_*` | Credenciales de Cloudflare R2 (almacenamiento de archivos) |

---

## Cómo hacer deploy de cambios

### Cambio de código (sin cambios de schema)

```bash
# En tu PC
git add .
git commit -m "descripcion"
git push

# En el VPS
git pull
docker compose up -d --build backend   # solo backend si cambiaron archivos de backend
docker compose up -d --build frontend  # solo frontend si cambiaron archivos de frontend
docker compose up -d --build           # ambos si cambiaron los dos
```

### Cambio de schema de base de datos (nueva migración)

```bash
# En tu PC — generar la migración
cd backend
npx prisma migrate dev --name "descripcion_del_cambio"
git add prisma/migrations/ prisma/schema.prisma
git commit -m "migration: descripcion_del_cambio"
git push

# En el VPS — el backend aplica migraciones automáticamente al arrancar
git pull
docker compose up -d --build backend
```

`prisma migrate deploy` corre en el entrypoint y aplica solo las migraciones pendientes.  
No re-aplica las que ya están en la tabla `_prisma_migrations`.

---

## Cómo funciona el build de Docker

El backend usa un build multi-stage:

**Stage 1 (builder):**
1. Instala todas las dependencias (`npm ci`)
2. Genera el cliente de Prisma (`npx prisma generate`)
3. Compila el backend (`nest build`) → `dist/src/main.js`
4. Compila el seed (`tsc -p tsconfig.seed.json`) → `dist/prisma/seed.js`

**Stage 2 (producción):**
1. Instala solo dependencias de producción (`npm ci --omit=dev`)
2. Copia `dist/` desde el builder
3. Copia el cliente de Prisma generado (`node_modules/.prisma`) desde el builder
4. Copia `prisma/` (schema + migraciones)

El cliente de Prisma se copia ya generado desde el builder — no depende de internet en tiempo de arranque.

---

## Entrypoint (arranque del contenedor)

`backend/entrypoint.sh` hace exactamente esto en orden:

1. `npx prisma generate` — regenera el cliente (respaldo de seguridad)
2. `npx prisma migrate deploy` — aplica migraciones pendientes, reintenta hasta que Postgres esté disponible
3. `node dist/main` — arranca el backend

El seed **no corre automáticamente** — es manual (ver sección Seed).

---

## Seed

El seed crea los datos iniciales del sistema: roles, usuario admin, tipos/categorías/equipos, lotes de granel.

### Comportamiento

- **Tiene un guard:** si el usuario `admin` ya existe en la base de datos, el seed sale inmediatamente sin hacer nada.
- **Es idempotente:** si lo corres cuando no hay datos, crea todo. Si ya hay datos, no hace nada.
- **No corre en cada arranque:** fue removido del entrypoint intencionalmente para evitar sobreescribir datos de producción.

### Correr el seed (primera vez o base de datos nueva)

```bash
docker compose exec backend node dist/prisma/seed.js
```

La contraseña del admin se lee de `ADMIN_SEED_PASSWORD` en el `.env`.  
Si la variable no está definida, el seed falla con error explícito.

### Si quieres agregar datos nuevos con el seed en el futuro

Como el guard bloquea el seed si ya existe el admin, tienes dos opciones:

**Opción A — Datos que deben existir siempre (recomendado):**  
Agrega la lógica directamente en el seed con un `upsert` propio. Luego borra el guard temporalmente, corre el seed, y restaura el guard.

**Opción B — Para una base de datos completamente nueva:**  
```bash
docker compose down -v          # borra volúmenes (ELIMINA TODOS LOS DATOS)
docker compose up -d
docker compose exec backend node dist/prisma/seed.js
```

---

## Migraciones: ¿qué son y cómo se crean?

Una migración es un archivo SQL que describe un cambio en la **estructura** de la base de datos (tablas, columnas, tipos). Viven en `backend/prisma/migrations/`.

Se usan cuando cambias `backend/prisma/schema.prisma`:

```bash
# Genera la migración y la aplica en local
npx prisma migrate dev --name "nombre_descriptivo"

# En producción se aplica automáticamente al arrancar el contenedor
npx prisma migrate deploy
```

**No toques los archivos `.sql` en `prisma/migrations/` a mano.** Prisma los genera y lleva el registro de cuáles ya se aplicaron en la tabla `_prisma_migrations`.

---

## Conexión SSH al VPS

```bash
ssh root@146.190.218.99
cd ~/Tunsa
```

## Referencia de comandos Docker Compose

### `docker compose up`
Levanta los contenedores definidos en `docker-compose.yml`. Si ya están corriendo, no hace nada.

### `docker compose up -d`
`-d` = detached. Corre los contenedores en segundo plano y devuelve la terminal.
Sin `-d`, los logs aparecen en pantalla y al cerrar la terminal los contenedores se detienen.

### `docker compose up -d --build`
`--build` reconstruye las imágenes antes de levantar.
**Úsalo siempre que hayas cambiado código.** Sin `--build`, Docker usa la imagen anterior en caché aunque hayas hecho `git pull`.

### `docker compose up -d --build backend`
Lo mismo pero solo para el servicio indicado. Más rápido cuando solo cambiaste archivos de un servicio.

### `docker compose down`
Detiene y elimina los contenedores. Los datos en volúmenes (base de datos) se conservan.

### `docker compose down -v`
`-v` elimina también los volúmenes, incluyendo los datos de Postgres.
**Destructivo — úsalo solo cuando quieras empezar desde cero.**

### `docker compose logs backend --tail=50`
Muestra las últimas 50 líneas de logs del servicio indicado. Sin `--tail` muestra todo desde el inicio.

### `docker compose logs -f backend`
`-f` = follow. Muestra logs en tiempo real (como un tail -f). Ctrl+C para salir.

### `docker compose ps`
Muestra el estado actual de todos los contenedores (running, exited, etc.).

### `docker compose restart backend`
Reinicia el contenedor sin reconstruir la imagen. Útil para recargar variables de entorno.

### `docker compose exec backend <comando>`
Ejecuta un comando dentro de un contenedor que ya está corriendo.
Es equivalente a abrir una terminal dentro del contenedor.

```bash
docker compose exec backend sh                          # shell interactiva
docker compose exec backend node dist/prisma/seed.js   # correr el seed
```

---

### Flujo típico de deploy

```bash
# En tu PC
git add .
git commit -m "descripcion"
git push

# En el VPS
git pull
docker compose up -d --build backend   # reconstruir y levantar
docker compose logs backend --tail=30  # verificar que arrancó bien
```

---

## Cloudflare

- DNS: registro A `tunsa-rentas.com` → `146.190.218.99` (proxied)
- SSL/TLS: modo **Flexible** (Cloudflare termina HTTPS, conecta al servidor por HTTP/80)
- El servidor nginx solo escucha en el puerto 80 — no hay certificado en el VPS

Si en el futuro quieres HTTPS directo en el servidor (modo Full/Full Strict en Cloudflare), necesitarás agregar un certificado TLS al nginx (por ejemplo con Let's Encrypt).
