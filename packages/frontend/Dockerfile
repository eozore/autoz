FROM node:20-alpine AS builder

ARG VITE_API_URL=http://localhost:3000

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/frontend/package.json packages/frontend/

RUN npm ci --workspace=packages/frontend

COPY packages/frontend/ packages/frontend/

WORKDIR /app/packages/frontend
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Serve with nginx ---
FROM nginx:alpine

COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html

COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
