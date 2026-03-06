FROM node:20-alpine

# Install OpenSSL and other dependencies
RUN apk add --no-cache openssl libssl3

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma/schema.prisma ./prisma/
COPY prisma/seed.ts ./prisma/

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY src ./src/
COPY tsconfig.json nest-cli.json ./

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Run db push (not migrate deploy) and seed
CMD npx prisma db push --accept-data-loss && npx prisma db seed && npm run start:prod
