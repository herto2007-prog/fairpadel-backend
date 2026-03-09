FROM node:20-slim

# Force rebuild on each deploy
ARG RAILWAY_DEPLOYMENT_ID=unknown
RUN echo "Building deployment: ${RAILWAY_DEPLOYMENT_ID}"

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
# Usamos ARG que se puede pasar en buildtime, con valor por defecto
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
ENV DATABASE_URL=${DATABASE_URL}
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
# Usamos shell form para que Railway pueda inyectar variables
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
