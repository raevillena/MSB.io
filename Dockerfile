# Production image for File Service API. Node 20 LTS.
FROM node:20-alpine AS base

# Install only production deps in a separate stage for smaller image
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Listen on PORT (set by K8s or env)
EXPOSE 3000

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

CMD ["node", "src/server.js"]
