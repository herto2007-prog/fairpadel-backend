-- CAPA 2: dueño del circuito (liga privada del organizador).
-- Aditiva y nullable: no afecta filas existentes (circuitos viejos quedan organizador_id = NULL).
ALTER TABLE "circuitos" ADD COLUMN "organizador_id" TEXT;

ALTER TABLE "circuitos" ADD CONSTRAINT "circuitos_organizador_id_fkey"
  FOREIGN KEY ("organizador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "circuitos_organizador_id_idx" ON "circuitos"("organizador_id");
