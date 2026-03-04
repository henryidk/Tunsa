/*
  Warnings:

  - You are about to drop the column `serieEquipo` on the `equipos` table. All the data in the column will be lost.
  - You are about to drop the column `serieMotor` on the `equipos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "equipos" DROP COLUMN "serieEquipo",
DROP COLUMN "serieMotor",
ADD COLUMN     "serie" TEXT;
