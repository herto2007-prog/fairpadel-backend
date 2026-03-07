# AGENTS.md — FairPadel

This file contains essential information for AI coding agents working on the FairPadel project. FairPadel is a full-stack paddle tennis tournament management platform for the Paraguayan market.

---

## Project Overview

**FairPadel** is a comprehensive platform for managing paddle tennis tournaments, including player registrations, match scheduling, rankings, payments, social features, photo galleries, court rentals, and instructor management.

**Monorepo Structure:** Two independent packages (`backend/` and `frontend/`) with no shared workspace configuration.

**Language:** Code and documentation are primarily in Spanish (domain terms) mixed with English (technical implementation).

---

## Technology Stack

### Backend (`backend/`)
- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 10.x with TypeScript 5.1
- **ORM:** Prisma 5.8
- **Database:** PostgreSQL 15+
- **Authentication:** JWT + Passport (Bearer token, 24h expiry)
- **Validation:** class-validator + class-transformer
- **Security:** Helmet for HTTP headers, @nestjs/throttler for rate limiting
- **Image Uploads:** Cloudinary
- **Email:** Resend
- **SMS:** Tigo Business (Beekun) — Paraguay-specific
- **Payments:** Bancard (Paraguay)
- **Scheduling:** @nestjs/schedule for cron jobs

### Frontend (`frontend/`)
- **Framework:** React 19.2 + TypeScript 5.9
- **Build Tool:** Vite 7.2.4
- **Styling:** TailwindCSS 3.4 with custom dark theme
- **State Management:** Zustand 5.0 (with persist middleware)
- **Forms:** React Hook Form 7.71
- **Routing:** React Router v7
- **Data Fetching:** TanStack React Query 5.90
- **HTTP Client:** Axios 1.13 with auth interceptors
- **UI Primitives:** Radix UI
- **Icons:** Lucide React
- **Notifications:** React Hot Toast
- **Charts:** Recharts

---

## Build and Development Commands

### Backend
```bash
cd backend
npm install --legacy-peer-deps    # Required flag for dependency resolution
npm run start:dev                  # Development server with watch mode (port 3000)
npm run build                      # Build to dist/ directory
npm run start:prod                 # Production: node dist/src/main.js
npm run lint                       # ESLint with autofix
npm test                           # Jest unit tests
npm run test:e2e                   # End-to-end tests
npm run test:cov                   # Coverage report

# Prisma commands
npx prisma generate                # Generate Prisma client after schema changes
npx prisma migrate dev             # Create/apply migrations (development)
npx prisma migrate deploy          # Apply migrations (production)
npx prisma studio                  # Visual database explorer

# Database seeding
npm run seed                       # Seed database with initial data
```

### Frontend
```bash
cd frontend
npm install
npm run dev                        # Vite dev server (port 5173, HMR enabled)
npm run build                      # TypeScript check + Vite production build
npm run preview                    # Preview production build locally
npm run lint                       # ESLint
```

---

## Project Structure

### Backend Structure (NestJS)
```
backend/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module with all imports
│   ├── app.controller.ts          # Health check endpoint
│   ├── prisma/                    # Prisma service module
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── auth/                      # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── dto/                   # Data transfer objects
│   │   ├── guards/                # JWT and Roles guards
│   │   ├── strategies/            # Passport JWT strategy
│   │   └── decorators/            # @Roles(), @GetUser() decorators
│   ├── users/                     # User management
│   ├── tournaments/               # Tournament CRUD
│   ├── inscripciones/             # Tournament registrations
│   ├── parejas/                   # Doubles pairs/teams
│   ├── matches/                   # Match scheduling and results
│   ├── rankings/                  # Player rankings
│   ├── pagos/                     # Payments (Bancard integration)
│   ├── fotos/                     # Photo gallery (Cloudinary)
│   ├── social/                    # Follows, messages, play requests
│   ├── notificaciones/            # System notifications
│   ├── suscripciones/             # Premium subscriptions
│   ├── sedes/                     # Venues and courts
│   ├── circuitos/                 # Circuits/leagues
│   ├── categorias/                # Category management
│   ├── admin/                     # Admin dashboard
│   ├── instructores/              # Instructor management
│   ├── alquileres/                # Court rentals
│   ├── feed/                      # Social feed/posts
│   ├── logros/                    # Achievements system
│   ├── alertas/                   # Custom alerts
│   └── publicidad/                # Advertising banners
├── prisma/
│   ├── schema.prisma              # Database schema (~1000 lines)
│   ├── seed.ts                    # Database seed script
│   └── migrations/                # Prisma migrations
├── test/                          # E2E tests
├── nest-cli.json                  # NestJS CLI configuration
├── tsconfig.json                  # TypeScript configuration
└── railway.json                   # Railway deployment config
```

### Frontend Structure
```
frontend/
├── src/
│   ├── main.tsx                   # Application entry point
│   ├── App.tsx                    # Router definition
│   ├── index.css                  # Global styles with Tailwind
│   ├── features/                  # Domain-based feature modules
│   │   ├── auth/                  # Login, register, password reset
│   │   ├── tournaments/           # Tournament listing and details
│   │   ├── inscripciones/         # Registration management
│   │   ├── matches/               # Fixtures and results
│   │   ├── rankings/              # Rankings display
│   │   ├── profile/               # User profiles
│   │   ├── admin/                 # Admin pages
│   │   ├── circuitos/             # Circuits/leagues
│   │   ├── suscripciones/         # Premium subscriptions
│   │   ├── social/                # Social features
│   │   ├── instructores/          # Instructor features
│   │   ├── alquileres/            # Court rentals
│   │   ├── feed/                  # News feed
│   │   └── home/                  # Homepage
│   ├── components/
│   │   ├── layout/                # Layout, Header, Footer, Sidebar
│   │   ├── ui/                    # Reusable UI components (Button, Card, Input, Modal, etc.)
│   │   ├── ErrorBoundary.tsx      # Error boundary component
│   │   └── ProtectedRoute.tsx     # Route protection wrapper
│   ├── store/                     # Zustand stores
│   │   ├── authStore.ts           # Auth state (persisted)
│   │   ├── tournamentStore.ts
│   │   └── uiStore.ts
│   ├── services/                  # API service layer
│   │   ├── api.ts                 # Axios instance with interceptors
│   │   ├── authService.ts
│   │   ├── tournamentsService.ts
│   │   └── ... (one per backend module)
│   ├── types/                     # TypeScript interfaces and enums
│   │   └── index.ts
│   ├── hooks/                     # Custom React hooks
│   ├── lib/                       # Utility functions
│   ├── config/                    # Configuration files
│   └── assets/                    # Static assets
├── index.html                     # HTML entry point
├── vite.config.ts                 # Vite configuration
├── tailwind.config.js             # Tailwind with custom theme
└── tsconfig.json                  # TypeScript configuration
```

---

## Key Architectural Patterns

### Backend Module Pattern (NestJS)
Each feature follows the standard NestJS pattern:
- `<feature>.module.ts` — Module definition
- `<feature>.controller.ts` — HTTP route handlers
- `<feature>.service.ts` — Business logic
- `dto/` — Data Transfer Objects with class-validator decorators
- `guards/` — Authentication/authorization guards
- `decorators/` — Custom parameter decorators

### API Conventions
- **Global prefix:** `/api` (set in main.ts)
- **CORS:** Allows `FRONTEND_URL` with credentials
- **Authentication:** `Authorization: Bearer <JWT>` header
- **Validation:** Global `ValidationPipe` with whitelist, transform, forbidNonWhitelisted
- **Guards:** `JwtAuthGuard` + `RolesGuard` with `@Roles()` decorator
- **Rate Limiting:** Global 60 requests/minute per IP via ThrottlerModule
- **Roles:** `jugador`, `organizador`, `admin`, `instructor`, `encargado`

### Frontend Data Flow
```
Component → Service (e.g., authService.login)
  → Axios (api.post) → Interceptor (adds token)
    → Backend API → Response
  → Zustand store update → Re-render
```

### Path Aliases
- **Frontend:** `@/` maps to `./src/` (configured in vite.config.ts and tsconfig.json)
- **Backend:** Standard NestJS module resolution

---

## Database Schema (Prisma)

**Schema file:** `backend/prisma/schema.prisma` (~1000 lines)

### Key Models
| Domain | Models |
|--------|--------|
| Auth/Users | `User`, `Role`, `UserRole`, `SolicitudOrganizador`, `EmailVerification`, `PasswordReset` |
| Tournaments | `Tournament`, `Category`, `TournamentCategory`, `TournamentModalidad`, `TournamentSponsor`, `TournamentPremio`, `Circuito` |
| Venues | `Sede`, `SedeCancha`, `TorneoSede`, `TorneoCancha`, `TorneoCanchaHorario` |
| Inscriptions | `Pareja`, `Inscripcion`, `Pago`, `ComprobantePago`, `Cupon` |
| Matches | `Match`, `Ranking`, `HistorialPuntos`, `ConfiguracionPuntos` |
| Social | `Seguimiento`, `MensajePrivado`, `SolicitudJugar`, `Logro`, `UsuarioLogro`, `Bloqueo`, `Reporte` |
| Photos | `Foto`, `FotoJugador`, `Like`, `Comentario`, `Album`, `AlbumFoto` |
| Subscriptions | `PlanPremium`, `Suscripcion` |
| Categories | `ReglaAscenso`, `HistorialCategoria` |
| Instructors | `Instructor`, `SolicitudInstructor`, `ReservaInstructor`, `PagoInstructor` |
| Court Rentals | `ReservaCancha`, `AlquilerConfig` |
| Notifications | `Notificacion` |

### Schema Conventions
- All IDs are UUID (`@default(uuid())`)
- All models have `createdAt` and `updatedAt` timestamps
- Cascade deletes on foreign keys
- Status fields use Prisma enums (not strings)
- Compound unique constraints for relationship tables
- Table names use `@map()` with snake_case

---

## Environment Variables

### Backend (`backend/.env`)
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fairpadel

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h

# Frontend URL
FRONTEND_URL=http://localhost:5173

# App
PORT=3000
NODE_ENV=development

# External Services
RESEND_API_KEY=...
FROM_EMAIL=onboarding@resend.dev
TIGO_BEEKUN_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
BANCARD_PUBLIC_KEY=...
BANCARD_PRIVATE_KEY=...
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3000/api
```

---

## Testing Strategy

### Backend Testing
- **Unit Tests:** Jest with ts-jest
  - Configured in `package.json`
  - Test files: `*.spec.ts`
  - Coverage reports available via `npm run test:cov`
- **E2E Tests:** Jest with separate config in `test/jest-e2e.json`
  - Test files: `*.e2e-spec.ts`
  - Run with `npm run test:e2e`

### Frontend Testing
- ESLint for code quality
- TypeScript strict mode enabled
- No test framework currently configured (opportunity for improvement)

---

## Code Style Guidelines

### General Conventions
- **Language:** Spanish for domain terms (torneos, parejas, inscripciones, sedes, pagos), English for technical code
- **IDs:** All entity IDs are UUIDs
- **TypeScript:** Strict mode enabled in both packages
- **Formatting:** Prettier + ESLint enforced

### Backend Conventions
- One NestJS module per domain feature
- DTOs in `dto/` subfolder with class-validator decorators
- Services handle business logic, controllers handle HTTP
- PrismaService injected via constructor dependency injection
- Custom decorators: `@Roles()`, `@GetUser()`
- Error handling: NestJS built-in exceptions (BadRequest, NotFound, Forbidden, Conflict)
- **Important:** `--legacy-peer-deps` required for npm install due to dependency conflicts
- **Never commit `dist/`** — it's in `.gitignore`. Railway rebuilds from source

### Frontend Conventions
- Feature-based directory structure under `src/features/`
- Shared UI components in `src/components/ui/`
- One Zustand store per domain (authStore persisted to localStorage)
- One service file per backend module in `src/services/`
- Centralized types in `src/types/index.ts`
- Tailwind utility classes with custom dark theme via `dark.*` colors
- Component variants via `class-variance-authority` (CVA)
- Protected routes via `<ProtectedRoute>` wrapper component with role support

---

## Deployment

### Platform: Railway
- **Backend:** Deployed to Railway with PostgreSQL database
- **Frontend:** Static hosting on Railway or similar

### Backend Deployment (`railway.json`)
```json
{
  "build": {
    "buildCommand": "npm install --legacy-peer-deps && npx prisma generate && npm run build"
  },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && npm run seed && node dist/src/main.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Heroku Alternative (`Procfile`)
```
web: npx prisma migrate deploy && npm run start:prod
```

---

## Security Considerations

### Implemented Security Measures
1. **Helmet** — HTTP security headers (CSP, HSTS, X-Frame-Options, etc.)
2. **Rate Limiting** — 60 requests/minute per IP globally, stricter limits on auth endpoints
3. **CORS** — Configured to allow only specific frontend origin
4. **JWT** — Bearer tokens with 24h expiry
5. **Password Hashing** — bcrypt with salt rounds
6. **Input Validation** — Global ValidationPipe with whitelist
7. **Prisma** — Protection against SQL injection

### CSP Configuration
Allows:
- Images from Cloudinary (`https://res.cloudinary.com`)
- Bancard payment iframe (`https://vpos.infonet.com.py`)
- Frontend URL for API connections

---

## Common Tasks

### Adding a New Backend Module
1. Create folder in `backend/src/<module>/`
2. Create `<module>.module.ts`, `<module>.controller.ts`, `<module>.service.ts`
3. Add DTOs in `dto/` folder
4. Import module in `app.module.ts`
5. Run `npm run lint` to verify

### Adding a New Frontend Feature
1. Create folder in `frontend/src/features/<feature>/`
2. Create `pages/` and `components/` subfolders as needed
3. Add route in `App.tsx`
4. Create service in `services/` if it calls backend
5. Add types to `types/index.ts` if needed

### Database Schema Changes
1. Modify `backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev --name <descriptive-name>`
3. Run `npx prisma generate`
4. Update affected DTOs and services
5. Run `npm run seed` if needed

---

## Troubleshooting

### Backend
- **Port conflicts:** Default is 3000, change via `PORT` env var
- **Database connection:** Verify `DATABASE_URL` format
- **Prisma client issues:** Run `npx prisma generate`
- **Module not found:** Check imports and module exports

### Frontend
- **HMR not working:** Check Vite config proxy settings
- **API errors:** Verify `VITE_API_URL` environment variable
- **Type errors:** Run `tsc --noEmit` to check for TypeScript errors

---

## External Integrations

### Bancard (Payments)
- Paraguay payment processor
- iframe integration for card payments
- Sandbox available for testing

### Cloudinary (Images)
- Photo uploads for galleries and profiles
- Automatic image optimization

### Resend (Email)
- Transactional emails (verification, password reset)
- Templates configured in email service

### Tigo Business / Beekun (SMS)
- SMS notifications for Paraguay
- Requires API key configuration
