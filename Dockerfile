<<<<<<< HEAD
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application with migrations
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
=======
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Configurar nginx para Railway
RUN echo 'server { \
    listen $PORT; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

CMD sh -c 'sed -i "s/\$PORT/$PORT/g" /etc/nginx/conf.d/default.conf && nginx -g "daemon off;"'
>>>>>>> 6418b021884974f2d36f475bdaaf4d720054db59
