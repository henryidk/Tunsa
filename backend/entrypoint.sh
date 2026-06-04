#!/bin/sh

echo "Generando cliente de Prisma..."
npx prisma generate

echo "Esperando base de datos..."
until npx prisma migrate deploy 2>/dev/null; do
  echo "Base de datos no disponible, reintentando en 3s..."
  sleep 3
done

echo "Migraciones aplicadas. Ejecutando seed..."
node dist/prisma/seed.js || echo "Seed omitido o ya ejecutado"

echo "Iniciando backend..."
node dist/src/main
