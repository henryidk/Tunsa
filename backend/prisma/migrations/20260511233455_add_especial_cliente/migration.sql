-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "esEspecial" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "dpi" DROP NOT NULL;
