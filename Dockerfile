FROM node:20-alpine

# Install OpenSSL and set timezone to Paraguay
RUN apk add --no-cache openssl libssl3 tzdata
ENV TZ=America/Asuncion
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

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
RUN ls -la dist/
RUN ls -la dist/src/ || echo "No dist/src folder"

# Expose port
EXPOSE 3000

# Run with Paraguay timezone
ENV TZ=America/Asuncion
ENV NODE_ENV=production

# Find the correct path and run
CMD if [ -f "dist/main.js" ]; then \
      echo "🌍 Timezone: $TZ"; \
      echo "🕐 Server time: $(date)"; \
      node dist/main.js; \
    elif [ -f "dist/src/main.js" ]; then \
      echo "🌍 Timezone: $TZ"; \
      echo "🕐 Server time: $(date)"; \
      node dist/src/main.js; \
    else \
      echo "Error: main.js not found"; \
      ls -la dist/; \
      exit 1; \
    fi
