# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Serve stage ----
# Internal only — expose, no ports:. Reached exclusively through the
# outer nginx service (see docker-compose.yml's frontend service and
# docker/nginx/nginx.conf's `location /` block in ihg-backend).
FROM nginx:1.27-alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html
# Replaces the default nginx.conf's server block with one that adds a
# try_files SPA fallback (see ihg-frontend/nginx.conf) — without this,
# a hard refresh or direct navigation to a client-side route like
# /admin/bookings would 404 instead of loading index.html.
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]