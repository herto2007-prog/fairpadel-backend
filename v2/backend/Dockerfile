FROM node:20-alpine

WORKDIR /app

# Install PostgreSQL client for direct DB access
RUN apk add --no-cache postgresql-client

# Copy package files first
COPY package*.json ./
COPY prisma ./prisma/

# DELETE any cached migrations directory
RUN rm -rf /app/prisma/migrations || true
RUN rm -rf ./prisma/migrations || true

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source (WITHOUT migrations folder)
COPY src ./src/
COPY tsconfig.json nest-cli.json ./
COPY scripts ./scripts/

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Reset DB migrations table and deploy
CMD PGPASSWORD=$PGPASSWORD psql -h $(echo $DATABASE_URL | sed 's/.*@//; s/:.*//') -U postgres -p $(echo $DATABASE_URL | sed 's/.*://; s/\/.*//') -d railway -c "DROP TABLE IF EXISTS _prisma_migrations;" 2>/dev/null || true && \
    npx prisma migrate deploy && \
    npx prisma db seed && \
    npm run start:prod
