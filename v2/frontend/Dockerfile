# Multi-stage build para Vite React

# Stage 1: Build
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Instalar OpenSSL (necesario para algunas dependencias)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copiar package.json primero (mejor caché)
COPY package*.json ./
RUN npm ci

# Copiar el resto
COPY . .

# Build de producción
RUN npm run build

# Stage 2: Servir con nginx
FROM nginx:1.25-alpine-slim

# Copiar build output
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración de nginx
RUN printf 'server {\n    listen ${PORT};\n    root /usr/share/nginx/html;\n    index index.html;\n    location / {\n        try_files $uri $uri/ /index.html;\n    }\n}' > /etc/nginx/templates/default.conf.template

# Puerto por defecto (Railway sobrescribe con $PORT)
ENV PORT=80

# Nginx usa envsubst para reemplazar ${PORT}
CMD ["nginx", "-g", "daemon off;"]
