# Multi-stage Dockerfile: build + runtime

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
# create data dir and non-root user
RUN mkdir -p /data && addgroup -S app && adduser -S app -G app && chown -R app:app /data /app
USER app

EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=2s --start-period=5s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node","dist/server.js"]
