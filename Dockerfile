# ---- Stage 1: Build client ----
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

RUN pnpm install --frozen-lockfile

COPY packages/engine/ packages/engine/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/

# Only build client (vite). Server runs as .ts via tsx.
RUN cd packages/client && npx vite build

# ---- Stage 2: Run ----
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

RUN pnpm install --frozen-lockfile --prod

# Copy engine source (.ts, loaded via tsx at runtime)
COPY packages/engine/src/ packages/engine/src/

# Copy server source (.ts, run via tsx)
COPY packages/server/src/ packages/server/src/
COPY packages/server/tsconfig.json packages/server/

# Copy client build output
COPY --from=build /app/packages/client/dist/ packages/client/dist/

EXPOSE 3000

CMD ["npx", "tsx", "packages/server/src/index.ts"]
