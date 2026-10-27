# The backup server: encrypted blobs per public key, over plain HTTP on port 8080. Data in the /data volume.
# Build from the repo root: docker build -f deploy/backup/Dockerfile .
FROM node:22-bookworm-slim
WORKDIR /srv
COPY backup/server.mjs ./
# A new named volume copies this directory's owner, so the server can write to it without root.
RUN mkdir /data && chown node:node /data
USER node
ENV DATA_DIR=/data PORT=8080
VOLUME /data
EXPOSE 8080
CMD ["node", "server.mjs"]
