-- AlterEnum
ALTER TYPE "CategoriaEstado" ADD VALUE 'FIXTURE_BORRADOR';

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "posicion_en_siguiente" INTEGER;
