# ---- Stage 1: Build ----
FROM node:22-alpine AS build

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package.json files for all packages
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/engine/ packages/engine/
COPY packages/server/ packages/server/
COPY packages/client/ packages/client/

# Build client (vite build)
RUN cd packages/client && npx vite build

# Build server (tsc)
RUN cd packages/server && npx tsc

# ---- Stage 2: Run ----
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy engine source (imported at runtime via workspace:*)
COPY packages/engine/src/ packages/engine/src/

# Copy server build output
COPY --from=build /app/packages/server/dist/ packages/server/dist/

# Copy client build output
COPY --from=build /app/packages/client/dist/ packages/client/dist/

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
