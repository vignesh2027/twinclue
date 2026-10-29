# Twinclue server. Build: docker build -t twinclue .
# Run:  docker run --env-file .env -p 127.0.0.1:3000:3000 -v twinclue-data:/app/data twinclue
# Sandbox (no Twitch, one game per visitor): docker run -e SANDBOX=1 -e PUBLIC_URL=https://your-host -p 127.0.0.1:3000:3000 twinclue
# Inside the container the server listens on all interfaces (PUBLIC=1) so the port mapping works; the -p flag
# above keeps it on the host's loopback, and a Cloudflare Tunnel publishes it over HTTPS.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PUBLIC=1 PORT=3000
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY public ./public
COPY facts ./facts
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/server.js"]
