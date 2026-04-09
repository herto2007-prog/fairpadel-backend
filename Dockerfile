FROM node:20-alpine

# Configurar timezone de Paraguay (UTC-3)
ENV TZ=America/Asuncion
RUN apk add --no-cache tzdata

# Force rebuild on each deploy - imagen completamente diferente
ARG RAILWAY_DEPLOYMENT_ID=unknown
ARG CACHE_BUST=20260409
RUN echo "Building deployment: ${RAILWAY_DEPLOYMENT_ID} - ${CACHE_BUST}"

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client - FORZAR REGENERACIÓN COMPLETA
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}
RUN rm -rf node_modules/.prisma
RUN rm -rf node_modules/@prisma/client
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY railway.json ./

# Build NestJS
RUN npm run build

# Expose port
EXPOSE 3000

# Runtime: Railway inyecta la verdadera DATABASE_URL
# Fallback: si falla migrate, al menos iniciar la app
CMD ["sh", "-c", "npx prisma migrate deploy || true && exec node dist/main.js"]
