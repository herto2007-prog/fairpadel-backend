-- Registro mínimo (Fase registro, corte 1).
-- Permite crear cuentas sin documento ni género: estos datos se piden
-- "just-in-time" al inscribirse a un torneo. Cambio backward-compatible:
-- pasar de NOT NULL a NULL no afecta a las filas existentes.

ALTER TABLE "users" ALTER COLUMN "documento" DROP NOT NULL;
ALTER TABLE "users" ALTER COLUMN "genero" DROP NOT NULL;
