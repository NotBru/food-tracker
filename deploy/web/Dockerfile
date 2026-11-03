# The web app, built and served as static files over plain HTTP on port 80.
# Build from the repo root: docker build -f deploy/web/Dockerfile .

# Build the web app into static files
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# Serve them with Caddy
FROM caddy:2
COPY deploy/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
