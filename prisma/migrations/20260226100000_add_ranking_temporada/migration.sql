-- AlterTable: Add temporada column to rankings
ALTER TABLE "rankings" ADD COLUMN "temporada" VARCHAR(10) NOT NULL DEFAULT '2026';

-- Drop old unique constraint
ALTER TABLE "rankings" DROP CONSTRAINT IF EXISTS "rankings_jugador_id_tipo_ranking_alcance_key";

-- Create new unique constraint including temporada
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_jugador_id_tipo_ranking_alcance_temporada_key"
  UNIQUE ("jugador_id", "tipo_ranking", "alcance", "temporada");
