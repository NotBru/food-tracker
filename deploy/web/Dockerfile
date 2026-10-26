# The web app, built and served as static files over plain HTTP on port 80.
# Build from the repo root: docker build -f deploy/web/Dockerfile .

# Build the web app into static files
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

# Caddy with the rate_limit directive (caddy-ratelimit), for the /off-search relay
FROM caddy:2-builder AS caddy
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

# Serve them with Caddy
FROM caddy:2
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY deploy/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
