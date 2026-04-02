# Add logo_url to Sede

Adds logoUrl field to Sede model for storing sede logo/foto URLs.

## SQL Applied
```sql
ALTER TABLE "sedes" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
```
