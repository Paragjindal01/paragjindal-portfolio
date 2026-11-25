FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY vite.config.mjs ./
COPY core/ core/
COPY web/ web/
RUN VITE_RELAYOPS_API=1 npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY core/ core/
COPY server/ server/
RUN mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production \
    RELAYOPS_HOST=0.0.0.0 \
    RELAYOPS_PORT=4174 \
    RELAYOPS_DB=/app/data/relayops.sqlite \
    RELAYOPS_DIST=/app/dist
USER node
EXPOSE 4174
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD node -e "fetch('http://127.0.0.1:4174/api/health').then(r=>{if(!r.ok)process.exitCode=1}).catch(()=>{process.exitCode=1})"
CMD ["node", "server/index.mjs"]
