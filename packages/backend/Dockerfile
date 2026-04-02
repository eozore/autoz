FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspaces
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/

# Install all deps
RUN npm ci --workspace=packages/backend

# Copy backend source
COPY packages/backend/ packages/backend/

# Generate Prisma client
WORKDIR /app/packages/backend
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# --- Production stage ---
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/backend/package.json packages/backend/
RUN npm ci --workspace=packages/backend --omit=dev

COPY --from=builder /app/packages/backend/dist packages/backend/dist
COPY --from=builder /app/packages/backend/src/generated packages/backend/src/generated
COPY --from=builder /app/packages/backend/prisma packages/backend/prisma

WORKDIR /app/packages/backend

# Create uploads directory
RUN mkdir -p uploads

# Run as non-root user (node user is included in Alpine image)
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
