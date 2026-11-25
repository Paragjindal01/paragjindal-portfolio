FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY relayops-ai/package*.json ./relayops-ai/
COPY compute-flow/package*.json ./compute-flow/
RUN npm ci --no-audit --no-fund \
    && npm --prefix relayops-ai ci --no-audit --no-fund \
    && npm --prefix compute-flow ci --no-audit --no-fund
COPY . .
ARG VITE_WEB3FORMS_ACCESS_KEY
RUN npm run build:release
USER node
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173", "--strictPort", "--configLoader", "native"]
