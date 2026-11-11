# Build once on the build machine's platform; the output is plain JavaScript.
FROM --platform=$BUILDPLATFORM node:24-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10.30.3
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    CONFIG_DIR=/config \
    HOST=0.0.0.0 \
    PORT=3000
COPY --from=build /app/package.json /app/server.mjs ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/healthz > /dev/null || exit 1
CMD ["node", "server.mjs"]
