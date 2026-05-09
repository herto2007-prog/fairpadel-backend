-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "ultima_accion_en" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inscripciones" ADD COLUMN     "grupo_id" TEXT;

-- AlterTable
ALTER TABLE "americano_rondas" ADD COLUMN     "grupo_id" TEXT;

-- AlterTable
ALTER TABLE "americano_partidos" ADD COLUMN     "formato_partido" TEXT,
ADD COLUMN     "sistema_puntos" TEXT;

-- AlterTable
ALTER TABLE "americano_puntajes" ADD COLUMN     "grupo_id" TEXT;

-- CreateTable
CREATE TABLE "americano_grupos" (
    "id" TEXT NOT NULL,
    "torneo_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'DEFAULT',
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "americano_grupos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "americano_grupos_torneo_id_idx" ON "americano_grupos"("torneo_id");

-- CreateIndex
CREATE INDEX "americano_grupos_tipo_idx" ON "americano_grupos"("tipo");

-- CreateIndex
CREATE INDEX "inscripciones_grupo_id_idx" ON "inscripciones"("grupo_id");

-- CreateIndex
CREATE INDEX "americano_rondas_grupo_id_idx" ON "americano_rondas"("grupo_id");

-- CreateIndex
CREATE INDEX "americano_puntajes_grupo_id_idx" ON "americano_puntajes"("grupo_id");

-- AddForeignKey
ALTER TABLE "inscripciones" ADD CONSTRAINT "inscripciones_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "americano_grupos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "americano_grupos" ADD CONSTRAINT "americano_grupos_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "americano_rondas" ADD CONSTRAINT "americano_rondas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "americano_grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "americano_puntajes" ADD CONSTRAINT "americano_puntajes_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "americano_grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
