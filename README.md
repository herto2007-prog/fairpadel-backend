# FairPadel Backend

Backend completo de FairPadel - Plataforma de gestión de torneos de pádel.

## 🚀 Stack Tecnológico

- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS + TypeScript
- **Base de datos:** PostgreSQL 15+
- **ORM:** Prisma
- **Autenticación:** JWT + Passport
- **API:** REST

## 📦 Instalación Local

```bash
# Instalar dependencias
npm install --legacy-peer-deps

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus valores

# Generar cliente Prisma
npx prisma generate

# Correr migraciones
npx prisma migrate deploy

# Seed inicial (admin + categorías)
npx prisma db seed

# Iniciar en desarrollo
npm run start:dev
```

## 🌐 Deploy en Railway

1. Crea cuenta en [Railway](https://railway.app)
2. Conecta este repositorio de GitHub
3. Agrega servicio PostgreSQL
4. Configura variables de entorno:
   - `DATABASE_URL` (se genera automáticamente)
   - `JWT_SECRET` (genera uno seguro)
   - `NODE_ENV=production`
5. Deploy automático

## 🔑 Variables de Entorno Requeridas

Ver archivo `.env.example` para todas las variables disponibles.

**Mínimas para funcionar:**
- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV`

## 📊 Módulos Implementados

✅ Autenticación (Login, Register, JWT)
✅ Usuarios (Perfiles, Roles)
✅ Torneos (CRUD completo)
✅ Categorías (16 pre-cargadas)
✅ Rankings
✅ Notificaciones
✅ Admin panel

## 🧪 Testing

```bash
# Tests unitarios
npm run test

# Tests e2e
npm run test:e2e

# Coverage
npm run test:cov
```

## 📝 Usuario Admin por Defecto

**Documento:** 9999999
**Password:** admin123
**Roles:** admin, organizador

⚠️ **CAMBIAR EN PRODUCCIÓN**

## 🛠️ Scripts Disponibles

```bash
npm run start          # Producción
npm run start:dev      # Desarrollo con hot-reload
npm run start:debug    # Debug mode
npm run build          # Build para producción
npm run lint           # Linter
npm run format         # Prettier
```

## 📚 Documentación API

API REST disponible en: `http://localhost:3000/api`

### Endpoints Principales:

**Auth:**
- `POST /api/auth/login`
- `POST /api/auth/register`

**Torneos:**
- `GET /api/tournaments`
- `GET /api/tournaments/categories`
- `POST /api/tournaments` (requiere auth)

**Rankings:**
- `GET /api/rankings`

Ver colección de Postman incluida para tests completos.

## 🗄️ Base de Datos

40+ tablas con relaciones completas:
- Users & Roles
- Tournaments & Categories
- Matches & Results
- Rankings & Points
- Social features
- Galleries & Photos
- Subscriptions

## 📄 Licencia

Propietario - FairPadel © 2026

## 👨‍💻 Autor

Héctor Velázquez
Ciudad del Este, Paraguay
