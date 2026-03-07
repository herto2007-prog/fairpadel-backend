FROM node:20-slim

WORKDIR /app

# Install OpenSSL and other dependencies for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client (usando placeholder para DATABASE_URL)
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

# Copy only backend source code (NOT frontend)
COPY src ./src/
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY railway.json ./

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application with migrations (DATABASE_URL estará disponible aquí)
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
