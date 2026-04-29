-- ═══════════════════════════════════════════════════════════
-- SEED DE CATEGORÍAS MIXTAS Y SUMAS
-- Ejecutar en pgAdmin conectado a Railway
-- ═══════════════════════════════════════════════════════════

-- ============================================
-- 1. CATEGORÍAS MIXTAS
-- ============================================
INSERT INTO public.categories (id, nombre, tipo, orden, "tipoCategoria", reglas, created_at)
VALUES 
  (
    gen_random_uuid(),
    'Mixta D8ª+C8ª',
    'MASCULINO',
    100,
    'MIXTO',
    jsonb_build_object(
      'damaCategoriaId', (SELECT id FROM public.categories WHERE nombre = '8ª Categoría Femenina'),
      'caballeroCategoriaId', (SELECT id FROM public.categories WHERE nombre = '8ª Categoría')
    ),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Mixta D7ª+C7ª',
    'MASCULINO',
    100,
    'MIXTO',
    jsonb_build_object(
      'damaCategoriaId', (SELECT id FROM public.categories WHERE nombre = '7ª Categoría Femenina'),
      'caballeroCategoriaId', (SELECT id FROM public.categories WHERE nombre = '7ª Categoría')
    ),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Mixta D6ª+C7ª',
    'MASCULINO',
    100,
    'MIXTO',
    jsonb_build_object(
      'damaCategoriaId', (SELECT id FROM public.categories WHERE nombre = '6ª Categoría Femenina'),
      'caballeroCategoriaId', (SELECT id FROM public.categories WHERE nombre = '7ª Categoría')
    ),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Mixta D5ª+C6ª',
    'MASCULINO',
    100,
    'MIXTO',
    jsonb_build_object(
      'damaCategoriaId', (SELECT id FROM public.categories WHERE nombre = '5ª Categoría Femenina'),
      'caballeroCategoriaId', (SELECT id FROM public.categories WHERE nombre = '6ª Categoría')
    ),
    NOW()
  ),
  (
    gen_random_uuid(),
    'Mixta D4ª+C5ª',
    'MASCULINO',
    100,
    'MIXTO',
    jsonb_build_object(
      'damaCategoriaId', (SELECT id FROM public.categories WHERE nombre = '4ª Categoría Femenina'),
      'caballeroCategoriaId', (SELECT id FROM public.categories WHERE nombre = '5ª Categoría')
    ),
    NOW()
  )
ON CONFLICT (nombre) DO UPDATE SET
  "tipoCategoria" = EXCLUDED."tipoCategoria",
  reglas = EXCLUDED.reglas,
  orden = EXCLUDED.orden;

-- ============================================
-- 2. CATEGORÍAS SUMAS - CABALLEROS
-- ============================================
INSERT INTO public.categories (id, nombre, tipo, orden, "tipoCategoria", reglas, created_at)
VALUES 
  (gen_random_uuid(), 'Suma 5 Caballeros', 'MASCULINO', 205, 'SUMAS', '{"sumaObjetivo": 5}', NOW()),
  (gen_random_uuid(), 'Suma 7 Caballeros', 'MASCULINO', 207, 'SUMAS', '{"sumaObjetivo": 7}', NOW()),
  (gen_random_uuid(), 'Suma 9 Caballeros', 'MASCULINO', 209, 'SUMAS', '{"sumaObjetivo": 9}', NOW()),
  (gen_random_uuid(), 'Suma 11 Caballeros', 'MASCULINO', 211, 'SUMAS', '{"sumaObjetivo": 11}', NOW()),
  (gen_random_uuid(), 'Suma 13 Caballeros', 'MASCULINO', 213, 'SUMAS', '{"sumaObjetivo": 13}', NOW())
ON CONFLICT (nombre) DO UPDATE SET
  "tipoCategoria" = EXCLUDED."tipoCategoria",
  reglas = EXCLUDED.reglas,
  orden = EXCLUDED.orden;

-- ============================================
-- 3. CATEGORÍAS SUMAS - DAMAS
-- ============================================
INSERT INTO public.categories (id, nombre, tipo, orden, "tipoCategoria", reglas, created_at)
VALUES 
  (gen_random_uuid(), 'Suma 5 Damas', 'FEMENINO', 205, 'SUMAS', '{"sumaObjetivo": 5}', NOW()),
  (gen_random_uuid(), 'Suma 7 Damas', 'FEMENINO', 207, 'SUMAS', '{"sumaObjetivo": 7}', NOW()),
  (gen_random_uuid(), 'Suma 9 Damas', 'FEMENINO', 209, 'SUMAS', '{"sumaObjetivo": 9}', NOW()),
  (gen_random_uuid(), 'Suma 11 Damas', 'FEMENINO', 211, 'SUMAS', '{"sumaObjetivo": 11}', NOW()),
  (gen_random_uuid(), 'Suma 13 Damas', 'FEMENINO', 213, 'SUMAS', '{"sumaObjetivo": 13}', NOW())
ON CONFLICT (nombre) DO UPDATE SET
  "tipoCategoria" = EXCLUDED."tipoCategoria",
  reglas = EXCLUDED.reglas,
  orden = EXCLUDED.orden;

-- ============================================
-- VERIFICACIÓN
-- ============================================
SELECT nombre, tipo, orden, "tipoCategoria", reglas 
FROM public.categories 
WHERE "tipoCategoria" IN ('MIXTO', 'SUMAS')
ORDER BY "tipoCategoria" ASC, orden ASC, tipo ASC;
