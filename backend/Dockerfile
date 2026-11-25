# FlatShare API (Node.js + Express)
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies first so this layer is cached
# until package*.json changes.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Run as the unprivileged "node" user that ships with the image.
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
