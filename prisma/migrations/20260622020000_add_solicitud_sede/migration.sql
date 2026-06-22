-- CreateTable
CREATE TABLE "solicitudes_sede" (
    "id" TEXT NOT NULL,
    "nombre_contacto" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "nombre_sede" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "mensaje" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'NUEVO',
    "nota_admin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_sede_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_sede_estado_idx" ON "solicitudes_sede"("estado");
