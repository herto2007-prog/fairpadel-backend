-- Migración de corrección: Agregar NO_APLICA al enum y columna lenguaje faltante

-- 1. Agregar valor 'NO_APLICA' al enum WhatsappConsentStatus
-- PostgreSQL no permite agregar valores a enums directamente, usamos ALTER TYPE
DO $$
BEGIN
    -- Verificar si el valor NO_APLICA ya existe en el enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'NO_APLICA' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'WhatsappConsentStatus')
    ) THEN
        -- Agregar el valor al enum
        ALTER TYPE "WhatsappConsentStatus" ADD VALUE 'NO_APLICA';
    END IF;
END $$;

-- 2. Agregar columna lenguaje a whatsapp_templates si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'whatsapp_templates' 
        AND column_name = 'lenguaje'
    ) THEN
        ALTER TABLE "whatsapp_templates" ADD COLUMN lenguaje VARCHAR(10) DEFAULT 'es';
    END IF;
END $$;

-- 3. Actualizar registros existentes que tengan NULL en lenguaje
UPDATE "whatsapp_templates" SET lenguaje = 'es' WHERE lenguaje IS NULL;

-- 4. Actualizar registros existentes que tengan un estado no válido
-- Establecer a 'NO_APLICA' los que no tengan estado válido
UPDATE "users" 
SET whatsapp_consent_status = 'NO_APLICA'::"WhatsappConsentStatus"
WHERE whatsapp_consent_status IS NULL 
   OR whatsapp_consent_status::text NOT IN (
       SELECT enumlabel FROM pg_enum 
       WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'WhatsappConsentStatus')
   );
