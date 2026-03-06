# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install serve
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Railway assigns PORT dynamically, we'll use it via environment variable
ENV PORT=3000

# Expose port (Railway will override this)
EXPOSE 3000

# Start the application using shell to access PORT env var
CMD ["sh", "-c", "serve -s dist -l tcp://0.0.0.0:${PORT}"]
