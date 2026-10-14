FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# create data dir and non-root user
RUN mkdir -p /data && addgroup -S app && adduser -S app -G app && chown -R app:app /data /app
USER app

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=2s --start-period=5s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node","dist/server.js"]
