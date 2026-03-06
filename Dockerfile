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

# Check what was built
RUN ls -la
RUN ls -la dist/ || echo "No dist folder"
RUN ls -la dist/src/ || echo "No dist/src folder"

# Expose port
EXPOSE 3000

# Find the correct path and run
CMD if [ -f "dist/main.js" ]; then \
      node dist/main.js; \
    elif [ -f "dist/src/main.js" ]; then \
      node dist/src/main.js; \
    else \
      echo "Error: main.js not found"; \
      ls -la dist/; \
      exit 1; \
    fi
