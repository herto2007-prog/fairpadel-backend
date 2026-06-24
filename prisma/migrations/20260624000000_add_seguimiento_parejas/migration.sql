-- CreateTable
CREATE TABLE "seguimiento_parejas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "inscripcion_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seguimiento_parejas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seguimiento_parejas_user_id_inscripcion_id_key" ON "seguimiento_parejas"("user_id", "inscripcion_id");

-- CreateIndex
CREATE INDEX "seguimiento_parejas_inscripcion_id_idx" ON "seguimiento_parejas"("inscripcion_id");
