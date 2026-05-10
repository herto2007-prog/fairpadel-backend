-- CreateTable
CREATE TABLE "tournament_organizadores" (
    "id" TEXT NOT NULL,
    "torneo_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_organizadores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tournament_organizadores_torneo_id_user_id_key" ON "tournament_organizadores"("torneo_id", "user_id");

-- AddForeignKey
ALTER TABLE "tournament_organizadores" ADD CONSTRAINT "tournament_organizadores_torneo_id_fkey" FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_organizadores" ADD CONSTRAINT "tournament_organizadores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
