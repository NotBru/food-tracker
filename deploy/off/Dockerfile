# Our copy of Open Food Facts: product search and barcodes over plain HTTP on port 8080. Data in the /data volume.
# Build from the repo root: docker build -f deploy/off/Dockerfile .
FROM node:22-bookworm-slim
WORKDIR /srv
COPY off/server.mjs ./
# A new named volume copies this directory's owner, so the server can write to it without root.
RUN mkdir /data && chown node:node /data
USER node
ENV DATA_DIR=/data PORT=8080
VOLUME /data
EXPOSE 8080
# node:sqlite still prints an experimental warning on Node 22.
CMD ["node", "--disable-warning=ExperimentalWarning", "server.mjs"]
