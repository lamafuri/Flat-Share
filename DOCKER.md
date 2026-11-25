# Docker in FlatShare: Quick Guide

## The three ideas

| Term | What it is | Analogy |
|---|---|---|
| **Dockerfile** | Recipe for building an image | Recipe |
| **Image** | The built, read-only package (code + runtime + dependencies) | Cooked meal, frozen |
| **Container** | A running instance of an image | Meal served on a plate |

**Docker Compose** is a YAML file that describes *several* containers and how they connect, so one command starts the whole app.

---

## The Dockerfiles

### `backend/Dockerfile`
```dockerfile
FROM node:20-alpine            # start from a small Linux image with Node 20
WORKDIR /app                   # all following commands run in /app
ENV NODE_ENV=production
COPY package*.json ./          # copy only package files first…
RUN npm ci --omit=dev          # …so this slow install is cached until they change
COPY . .                       # then copy the source code
USER node                      # don't run as root
EXPOSE 5000                    # documents the port the app listens on
HEALTHCHECK CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "server.js"]      # command run when the container starts
```

### `frontend/Dockerfile` (multi-stage)
```dockerfile
# Stage 1: build: has Node, npm and all dev tools
FROM node:20-alpine AS build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # creates /app/dist (plain HTML/CSS/JS)

# Stage 2: serve: only NGINX + the built files
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html   # copy just the result from stage 1
```
**Why multi-stage?** The final image contains no Node or `node_modules`, only NGINX and static files, so it's about 21 MB
instead of more than 400 MB.

### `mongo/Dockerfile`
```dockerfile
FROM mongo:7.0                                   # official MongoDB image
COPY ensure-users.sh flatshare-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["flatshare-entrypoint.sh"]           # our small wrapper runs first…
CMD ["mongod", "--auth"]                         # …then MongoDB with login required
```
On every start, `ensure-users.sh` runs next to `mongod`:
- It waits until MongoDB accepts connections.
- It creates the `root` user (first start only).
- It creates the `flatshare` app user, or updates its password if it changed. That user can only read and write the
  app's database, so the backend never uses root.
- It writes `/tmp/users-ready`. The health check looks for this file, so the backend starts only after the users exist.

(We skip the image's built-in `/docker-entrypoint-initdb.d` setup because it hangs under Kubernetes.)

### `.dockerignore`
Like `.gitignore`, but for `COPY`. It keeps `node_modules`, `.env` and `dist` out of the image (smaller and no secrets).

---

## The Compose files

### `docker-compose.yml`: local development (builds images)
```yaml
services:
  mongo:
    build: ./mongo            # ← build an image from mongo/Dockerfile
    environment: { … }        # env vars inside the container
    volumes:
      - mongo-data:/data/db   # named volume: data survives container removal
    healthcheck: { … }        # "mongosh ping" decides when mongo is healthy

  backend:
    build: ./backend          # ← build from backend/Dockerfile
    depends_on:
      mongo:
        condition: service_healthy   # start only after mongo is healthy
    environment:
      MONGODB_URI: mongodb://…@mongo:27017/…   # "mongo" = service name = hostname

  frontend:
    build: ./frontend         # ← build from frontend/Dockerfile
    ports:
      - "8080:80"             # host:container, the only published port

volumes:
  mongo-data:
```

### `docker-compose.prod.yml`: server (pulls images)
Same three services, but with `image: furisunway/flatshare-backend:<tag>` instead of `build:`. The server **doesn't build**.
It downloads the images GitHub Actions already built and pushed to Docker Hub. The port is `80:80`, and
`restart: always` brings containers back after a crash or reboot.

`${VAR}` values come from a `.env` file next to the compose file. The pipeline writes that file from GitHub secrets.

---

## How Compose uses the Dockerfile

When you run `docker compose up --build`:

1. **Reads** `docker-compose.yml`.
2. For each service with `build: ./backend`, it runs the equivalent of `docker build ./backend`. That uses
   `backend/Dockerfile`, with `./backend` as the build context (the files `COPY` can see).
3. **Creates a network.** Every service joins it and can reach the others **by service name** (`mongo`, `backend`).
   That's why `nginx.conf` says `proxy_pass http://backend:5000`.
4. **Creates volumes** (`mongo-data`).
5. **Starts containers** in dependency order: `mongo`, then waits until it's healthy, then `backend`, then `frontend`.
   Each container runs the Dockerfile's `CMD` with the `environment:` from the YAML.

```
docker-compose.yml ──build──► Dockerfile ──► image ──run──► container
                  └─network, volumes, env, ports, start order─┘
```

Request flow:
`browser → :80 → frontend (NGINX) → /api → backend:5000 → mongo:27017`

---

## Commands you'll actually use

### Compose
| Command | What it does |
|---|---|
| `docker compose up -d --build` | Build images and start everything in the background |
| `docker compose up -d --wait` | Start and wait until all health checks pass |
| `docker compose ps` | List the stack's containers and their health |
| `docker compose logs -f backend` | Follow one service's logs |
| `docker compose exec backend sh` | Shell inside a running container |
| `docker compose restart backend` | Restart one service |
| `docker compose pull` | Download newer images (prod) |
| `docker compose down` | Stop and remove containers (**data kept**) |
| `docker compose down -v` | Also delete volumes (**database wiped**) |
| `docker compose config` | Print the final YAML with variables filled in. Good for checking |

On the server, add `-f docker-compose.prod.yml` and `sudo`:
`cd ~/flatshare-compose && sudo docker compose -f docker-compose.prod.yml ps`

### Plain Docker
| Command | What it does |
|---|---|
| `docker build -t name ./backend` | Build an image from a Dockerfile |
| `docker images` | List images |
| `docker ps` / `docker ps -a` | Running / all containers |
| `docker logs -f <container>` | Container logs |
| `docker exec -it <container> sh` | Shell inside a container |
| `docker stats` | Live CPU and memory per container |
| `docker inspect <container>` | Full details (env, IP, mounts, health) |
| `docker volume ls` | List volumes |
| `docker push user/image:tag` | Upload an image to Docker Hub (the pipeline does this) |
| `docker system prune` | Remove unused containers, images and networks |

---

## Switching between Kubernetes and Compose

Set the GitHub repository **variable** `DEPLOY_TARGET`:
- `k8s` (or unset): the **Deploy to k3s** job runs
- `compose`: the **Deploy with Docker Compose** job runs

Then push, or go to Actions → CI/CD → **Run workflow**.
- Switching to `compose` stops k3s to free port 80, installs Docker if needed and starts the stack.
- Switching back to `k8s` stops the Compose stack and starts k3s again.

Each one keeps its own database, so data doesn't carry over between them.
