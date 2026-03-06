-- Reset migration history for V2 clean start
-- Run this in Railway Console if needed

-- Option 1: Delete all migration history and start fresh (DESTRUCTIVE - loses data)
-- DELETE FROM _prisma_migrations;

-- Option 2: Mark all existing migrations as applied (RECOMMENDED for V2 rebuild)
-- This tells Prisma "these migrations are already applied, skip them"
UPDATE _prisma_migrations 
SET finished_at = NOW(), 
    applied_steps_count = 1 
WHERE finished_at IS NULL;
