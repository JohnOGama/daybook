# Multi-stage image for the pnpm workspace. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t <image> .

# ---------- Stage 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...

COPY apps/api apps/api
RUN pnpm --filter api build \
 && pnpm --filter api deploy --legacy --prod /out \
 && cp -r apps/api/dist /out/dist

# ---------- Stage 2: runtime ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /out/package.json ./
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist

USER node
EXPOSE 4000

# Run node directly so it receives SIGTERM (diagrams are saved on shutdown).
CMD ["node", "dist/main.js"]
