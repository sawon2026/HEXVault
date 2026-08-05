# syntax=docker/dockerfile:1
# HEXVault API — multi-stage build.
# Uses node:sqlite (Node >= 22.5 built-in) so no native build toolchain is required.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
COPY packages ./packages

RUN npx tsc --noEmit && npx tsc

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S hexvault && adduser -S hexvault -G hexvault

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/packages ./packages
COPY --from=build /app/src ./src

RUN mkdir -p /data && chown -R hexvault:hexvault /data /app
USER hexvault

EXPOSE 3850
VOLUME ["/data"]

ENV HEXVAULT_DATA_DIR=/data
CMD ["node", "dist/api/server.js"]
