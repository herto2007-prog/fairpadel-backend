# SQL de Respaldo - Módulo Americano

> **Usar solo si `prisma migrate deploy` falla en Railway.**
> Conectarse a la BD de Railway desde pgAdmin y ejecutar estos scripts en orden.

---

## 1. Verificar si la migración ya fue aplicada

```sql
SELECT * FROM "_prisma_migrations" 
WHERE "migration_name" = '20260427000000_add_americano_models';
```

Si devuelve fila → la migración ya está aplicada. No ejecutar nada más.

---

## 2. Crear columnas en tournaments

```sql
-- Agregar columna formato (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tournaments' AND column_name='formato') THEN
        ALTER TABLE "tournaments" ADD COLUMN "formato" VARCHAR(255) NOT NULL DEFAULT 'eliminacion';
    END IF;
END $$;

-- Agregar columna config_americano (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='tournaments' AND column_name='config_americano') THEN
        ALTER TABLE "tournaments" ADD COLUMN "config_americano" JSONB;
    END IF;
END $$;

-- Índice para formato
CREATE INDEX IF NOT EXISTS "idx_tournaments_formato" ON "tournaments"("formato");
```

---

## 3. Crear tabla americanos_rondas

```sql
CREATE TABLE IF NOT EXISTS "americano_rondas" (
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

CREATE INDEX IF NOT EXISTS "idx_americano_rondas_torneo_id" ON "americano_rondas"("torneo_id");
CREATE INDEX IF NOT EXISTS "idx_americano_rondas_estado" ON "americano_rondas"("estado");

ALTER TABLE "americano_rondas" 
  DROP CONSTRAINT IF EXISTS "americano_rondas_torneo_fkey";
  
ALTER TABLE "americano_rondas" 
  ADD CONSTRAINT "americano_rondas_torneo_fkey" 
  FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 4. Crear tabla americanos_parejas_ronda

```sql
CREATE TABLE IF NOT EXISTS "americano_parejas_ronda" (
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

CREATE INDEX IF NOT EXISTS "idx_americano_parejas_ronda_ronda_id" ON "americano_parejas_ronda"("ronda_id");
CREATE INDEX IF NOT EXISTS "idx_americano_parejas_ronda_jugador1_id" ON "americano_parejas_ronda"("jugador1_id");
CREATE INDEX IF NOT EXISTS "idx_americano_parejas_ronda_jugador2_id" ON "americano_parejas_ronda"("jugador2_id");

ALTER TABLE "americano_parejas_ronda" 
  DROP CONSTRAINT IF EXISTS "americano_parejas_ronda_ronda_fkey";
ALTER TABLE "americano_parejas_ronda" 
  ADD CONSTRAINT "americano_parejas_ronda_ronda_fkey" 
  FOREIGN KEY ("ronda_id") REFERENCES "americano_rondas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "americano_parejas_ronda" 
  DROP CONSTRAINT IF EXISTS "americano_parejas_ronda_jugador1_fkey";
ALTER TABLE "americano_parejas_ronda" 
  ADD CONSTRAINT "americano_parejas_ronda_jugador1_fkey" 
  FOREIGN KEY ("jugador1_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "americano_parejas_ronda" 
  DROP CONSTRAINT IF EXISTS "americano_parejas_ronda_jugador2_fkey";
ALTER TABLE "americano_parejas_ronda" 
  ADD CONSTRAINT "americano_parejas_ronda_jugador2_fkey" 
  FOREIGN KEY ("jugador2_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 5. Crear tabla americanos_puntajes

```sql
CREATE TABLE IF NOT EXISTS "americano_puntajes" (
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

CREATE INDEX IF NOT EXISTS "idx_americano_puntajes_torneo_id" ON "americano_puntajes"("torneo_id");
CREATE INDEX IF NOT EXISTS "idx_americano_puntajes_ronda_id" ON "americano_puntajes"("ronda_id");
CREATE INDEX IF NOT EXISTS "idx_americano_puntajes_jugador_id" ON "americano_puntajes"("jugador_id");
CREATE INDEX IF NOT EXISTS "idx_americano_puntajes_posicion" ON "americano_puntajes"("posicion");

ALTER TABLE "americano_puntajes" 
  DROP CONSTRAINT IF EXISTS "americano_puntajes_torneo_fkey";
ALTER TABLE "americano_puntajes" 
  ADD CONSTRAINT "americano_puntajes_torneo_fkey" 
  FOREIGN KEY ("torneo_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "americano_puntajes" 
  DROP CONSTRAINT IF EXISTS "americano_puntajes_ronda_fkey";
ALTER TABLE "americano_puntajes" 
  ADD CONSTRAINT "americano_puntajes_ronda_fkey" 
  FOREIGN KEY ("ronda_id") REFERENCES "americano_rondas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "americano_puntajes" 
  DROP CONSTRAINT IF EXISTS "americano_puntajes_jugador_fkey";
ALTER TABLE "americano_puntajes" 
  ADD CONSTRAINT "americano_puntajes_jugador_fkey" 
  FOREIGN KEY ("jugador_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## 6. Marcar migración como aplicada (IMPORTANTE)

> Si ejecutaste los scripts manualmente, Prisma no sabe que la migración ya está aplicada.
> Insertar este registro para que `prisma migrate deploy` no intente re-ejecutarla.

```sql
INSERT INTO "_prisma_migrations" 
  ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES 
  (gen_random_uuid(), 'manual', NOW(), '20260427000000_add_americano_models', NOW(), 1)
ON CONFLICT ("migration_name") DO NOTHING;
```

---

## 7. Verificación rápida

```sql
-- Verificar que las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('americano_rondas', 'americano_parejas_ronda', 'americano_puntajes', 'tournaments');

-- Verificar columnas nuevas en tournaments
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tournaments' 
  AND column_name IN ('formato', 'config_americano');
```

---

## Notas

- Los scripts usan `IF NOT EXISTS` y `DROP CONSTRAINT IF EXISTS` para ser idempotentes (pueden ejecutarse varias veces sin error).
- Si alguna tabla ya existe parcialmente, ejecutar los scripts de todas formas; solo crearán lo que falta.
