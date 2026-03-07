FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
# Nota: Railway no inyecta variables durante build, usamos placeholder temporal
# La verdadera DATABASE_URL se usa en runtime
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Copy source code
COPY src ./src/
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY railway.json ./

# Build NestJS (ahora tiene los tipos de Prisma)
RUN npm run build

# Expose port
EXPOSE 3000

# Runtime: Railway inyecta la verdadera DATABASE_URL aquí
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
