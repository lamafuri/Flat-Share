# ---- Stage 1: build the React app with Vite ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Empty by default: the app then calls /api on its own origin and NGINX
# proxies it to the backend. Set it only to point at an API on another host.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- Stage 2: serve the static build with NGINX ----
FROM nginx:1.27-alpine

# NGINX is both the web server (static files) and the reverse proxy (/api).
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
