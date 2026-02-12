-- CreateTable
CREATE TABLE "torneo_ayudantes" (
    "id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "user_id" TEXT,
    "documento" TEXT NOT NULL,
    "nombre" TEXT,
    "rol" TEXT NOT NULL DEFAULT 'ayudante',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneo_ayudantes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "torneo_ayudantes_tournament_id_documento_key" ON "torneo_ayudantes"("tournament_id", "documento");

-- AddForeignKey
ALTER TABLE "torneo_ayudantes" ADD CONSTRAINT "torneo_ayudantes_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "torneo_ayudantes" ADD CONSTRAINT "torneo_ayudantes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
