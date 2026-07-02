-- RANKINGS DEL ORGANIZADOR (autoservicio, modelo correcto aprobado 2026-07-02):
-- el ranking ES el circuito, y ahora puede tener dueño. Aditiva y nullable:
-- organizador_id = NULL -> circuito curado por FairPadel (ambos modelos conviven).
-- (La misma columna existió y se dropeó en junio con el modelo equivocado.)
ALTER TABLE "circuitos" ADD COLUMN "organizador_id" TEXT;

ALTER TABLE "circuitos" ADD CONSTRAINT "circuitos_organizador_id_fkey"
  FOREIGN KEY ("organizador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "circuitos_organizador_id_idx" ON "circuitos"("organizador_id");
