# Build stage - usar Debian en lugar de Alpine
FROM node:20-slim AS builder

WORKDIR /app

# Instalar dependencias necesarias
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copiar package files
COPY package*.json ./
RUN npm install

# Copiar source
COPY . .

# Build
RUN npm run build

# Production stage
FROM nginx:alpine

# Copiar build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Crear config de nginx con template
RUN echo 'server { listen PORT_PLACEHOLDER; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf.template

# Script de inicio que reemplaza el puerto
RUN echo '#!/bin/sh' > /start.sh && \
    echo 'sed "s/PORT_PLACEHOLDER/${PORT}/g" /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf' >> /start.sh && \
    echo 'nginx -g "daemon off;"' >> /start.sh && \
    chmod +x /start.sh

CMD ["/start.sh"]
