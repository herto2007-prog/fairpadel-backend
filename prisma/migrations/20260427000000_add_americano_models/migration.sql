-- Migration: Add Americano tournament format support
-- Created: 2026-04-27

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Add formato and config_americano to tournaments
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "tournaments" 
  ADD COLUMN "formato" VARCHAR(255) NOT NULL DEFAULT 'eliminacion';

ALTER TABLE "tournaments" 
  ADD COLUMN "config_americano" JSONB;

-- Index for quick filtering by format
CREATE INDEX "idx_tournaments_formato" ON "tournaments"("formato");


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Create americanos tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- Rondas del formato americano
CREATE TABLE "americano_rondas" (
  "id" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "torneo_id" TEXT NOT NULL,
  "fecha_inicio" TEXT,
  "fecha_fin" TEXT,
  "estado" VARCHAR(255) NOT NULL DEFAULT 'PENDIENTE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "americano_rondas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "americano_rondas_torneo_numero_unique" UNIQUE ("torneo_id", "numero")
);

CREATE INDEX "idx_americano_rondas_torneo_id" ON "americano_rondas"("torneo_id");
CREATE INDEX "idx_americano_rondas_estado" ON "americano_rondas"("estado");

ALTER TABLE "americano_rondas" 
  ADD CONSTRAINT "americano_rondas_torneo_fkey" 
  FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Parejas formadas en cada ronda del americano
CREATE TABLE "americano_parejas_ronda" (
  "id" TEXT NOT NULL,
  "ronda_id" TEXT NOT NULL,
  "jugador1_id" TEXT NOT NULL,
  "jugador2_id" TEXT NOT NULL,
  "nombre" TEXT,
  "color" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "americano_parejas_ronda_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_americano_parejas_ronda_ronda_id" ON "americano_parejas_ronda"("ronda_id");
CREATE INDEX "idx_americano_parejas_ronda_jugador1_id" ON "americano_parejas_ronda"("jugador1_id");
CREATE INDEX "idx_americano_parejas_ronda_jugador2_id" ON "americano_parejas_ronda"("jugador2_id");

ALTER TABLE "americano_parejas_ronda" 
  ADD CONSTRAINT "americano_parejas_ronda_ronda_fkey" 
  FOREIGN KEY ("ronda_id") REFERENCES "americano_rondas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "americano_parejas_ronda" 
  ADD CONSTRAINT "americano_parejas_ronda_jugador1_fkey" 
  FOREIGN KEY ("jugador1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "americano_parejas_ronda" 
  ADD CONSTRAINT "americano_parejas_ronda_jugador2_fkey" 
  FOREIGN KEY ("jugador2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Puntajes acumulados por jugador en cada ronda/torneo americano
CREATE TABLE "americano_puntajes" (
  "id" TEXT NOT NULL,
  "torneo_id" TEXT NOT NULL,
  "ronda_id" TEXT,
  "jugador_id" TEXT NOT NULL,
  "puntos" INTEGER NOT NULL DEFAULT 0,
  "partidos_jugados" INTEGER NOT NULL DEFAULT 0,
  "partidos_ganados" INTEGER NOT NULL DEFAULT 0,
  "partidos_perdidos" INTEGER NOT NULL DEFAULT 0,
  "sets_ganados" INTEGER NOT NULL DEFAULT 0,
  "sets_perdidos" INTEGER NOT NULL DEFAULT 0,
  "games_ganados" INTEGER NOT NULL DEFAULT 0,
  "games_perdidos" INTEGER NOT NULL DEFAULT 0,
  "diferencia_games" INTEGER NOT NULL DEFAULT 0,
  "posicion" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "americano_puntajes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "americano_puntajes_ronda_jugador_unique" UNIQUE ("ronda_id", "jugador_id")
);

CREATE INDEX "idx_americano_puntajes_torneo_id" ON "americano_puntajes"("torneo_id");
CREATE INDEX "idx_americano_puntajes_ronda_id" ON "americano_puntajes"("ronda_id");
CREATE INDEX "idx_americano_puntajes_jugador_id" ON "americano_puntajes"("jugador_id");
CREATE INDEX "idx_americano_puntajes_posicion" ON "americano_puntajes"("posicion");

ALTER TABLE "americano_puntajes" 
  ADD CONSTRAINT "americano_puntajes_torneo_fkey" 
  FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "americano_puntajes" 
  ADD CONSTRAINT "americano_puntajes_ronda_fkey" 
  FOREIGN KEY ("ronda_id") REFERENCES "americano_rondas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "americano_puntajes" 
  ADD CONSTRAINT "americano_puntajes_jugador_fkey" 
  FOREIGN KEY ("jugador_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
