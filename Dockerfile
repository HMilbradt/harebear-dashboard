# Build once on the build machine's platform: the output is plain JavaScript.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10.30.3
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime: the bundled server and CLI, plus esbuild (native, per platform) to compile local plugins.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    CONFIG_DIR=/config \
    PLUGINS_DIR=/plugins \
    HOST=0.0.0.0 \
    PORT=3000
RUN npm install --no-save --no-package-lock --omit=dev esbuild@0.28.2 \
 && npm cache clean --force \
 && printf '#!/bin/sh\nexec node /app/dist/cli.mjs "$@"\n' > /usr/local/bin/harebear-dashboard \
 && chmod +x /usr/local/bin/harebear-dashboard
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist/serve.mjs ./server.mjs
COPY --from=build /app/examples ./examples
COPY --from=build /app/package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1
CMD ["node", "server.mjs"]
