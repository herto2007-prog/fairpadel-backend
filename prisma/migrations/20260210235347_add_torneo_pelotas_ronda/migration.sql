-- CreateTable
CREATE TABLE "torneo_pelotas_ronda" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "ronda" TEXT NOT NULL,
    "cantidad_pelotas" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneo_pelotas_ronda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "torneo_pelotas_ronda_tournament_id_ronda_key" ON "torneo_pelotas_ronda"("tournament_id", "ronda");

-- AddForeignKey
ALTER TABLE "torneo_pelotas_ronda" ADD CONSTRAINT "torneo_pelotas_ronda_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
