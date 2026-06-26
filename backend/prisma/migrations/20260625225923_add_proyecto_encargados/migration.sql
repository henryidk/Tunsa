-- AlterTable
ALTER TABLE "proyectos" ADD COLUMN     "creadoPorId" TEXT;

-- CreateTable
CREATE TABLE "proyecto_encargados" (
    "proyectoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proyecto_encargados_pkey" PRIMARY KEY ("proyectoId","usuarioId")
);

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_encargados" ADD CONSTRAINT "proyecto_encargados_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto_encargados" ADD CONSTRAINT "proyecto_encargados_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
