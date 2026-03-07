FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy prisma schema (solo schema, no generate todavía)
COPY prisma ./prisma/

# Copy source code
COPY src ./src/
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY railway.json ./

# Build NestJS (sin prisma generate)
RUN npm run build

# Expose port
EXPOSE 3000

# Runtime: generate Prisma client + migrate + start
# DATABASE_URL está disponible aquí porque Railway la inyecta en runtime
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npm run start:prod"]
