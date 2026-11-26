# Viva Q&A: Docker, Docker Compose, GitHub Actions, NGINX

Short answers based on the actual files in this repo.

---

## 1. Docker

**What is the difference between an image and a container?**
An image is a read-only package built from a Dockerfile (code, runtime, dependencies). A container is a running
instance of an image. One image can run as many containers.

**What does each of your Dockerfiles do?**
- `backend/Dockerfile`: Node 20 Alpine, installs production dependencies, copies the code, runs `node server.js` as the `node` user.
- `frontend/Dockerfile`: two stages. Stage 1 builds the React app with Vite. Stage 2 copies only the built `dist/` into an NGINX image.
- `mongo/Dockerfile`: the official `mongo:7.0` image plus our scripts that create the database users. It runs as the `mongodb` user.

**Why do you copy `package*.json` before the rest of the code?**
For **layer caching**. Docker caches each step. `npm ci` only re-runs when the package files change, not on every code
change, so rebuilds are much faster.

**What is a multi-stage build and why use it?**
Several `FROM` stages in one Dockerfile, where later stages copy only what they need from earlier ones. Our frontend
image contains NGINX and static files only, with no Node or `node_modules`, so it's about 21 MB instead of 400+ MB. It's
also more secure, because there are no build tools in production.

**Why Alpine images?**
They're very small (a few MB of base OS), so pulls are faster, disk use is lower, and there's less to attack.

**What is `.dockerignore` for?**
Like `.gitignore`, but for the build context. It keeps `node_modules`, `dist` and `.env` out of the image. Images stay
small, and secrets never end up inside them.

**`npm ci` vs `npm install`?**
`npm ci` installs exactly what `package-lock.json` says and fails if the lock file doesn't match, so every build is
reproducible. `--omit=dev` skips dev dependencies like nodemon in the backend image.

**`EXPOSE` vs publishing a port?**
`EXPOSE 5000` only documents which port the app uses. The port is actually opened by `ports:` in Compose
(or `-p` in `docker run`). In our setup only NGINX's port 80 is published.

**`CMD` vs `ENTRYPOINT`?**
`ENTRYPOINT` is the program that always runs. `CMD` gives its default arguments, which can be overridden. In the mongo
image, `ENTRYPOINT ["flatshare-entrypoint.sh"]` runs our wrapper, and `CMD ["mongod", "--auth"]` is what it starts.

**What does `HEALTHCHECK` do?**
Docker runs the command periodically and marks the container `healthy` or `unhealthy`. The backend checks
`/api/health`, and the frontend checks NGINX's `/healthz`. Compose uses this to start services in the right order.

**Why `USER node` / `USER 999:999`?**
So the app doesn't run as root. If someone exploited the app, they'd have no root rights in the container.

**How does your MongoDB image create its users?**
`flatshare-entrypoint.sh` starts `ensure-users.sh` in the background, then starts `mongod --auth`. The script waits for
MongoDB, creates the `root` user (first start only), and creates or updates the `flatshare` app user. That user can only
read and write the `flatshare` database. Then it writes `/tmp/users-ready`, which the health check looks for.

**What problem did you hit with the MongoDB image?**
- The official image starts as root and switches to the `mongodb` user with a tool called `gosu`. On the server that step
  hung forever, so MongoDB never started and printed no logs.
- I found it by listing the processes inside the container: PID 1 was still `gosu`.
- The fix was `USER 999:999` in the Dockerfile. Starting as `mongodb` directly makes the entrypoint skip `gosu`.
- Earlier, the official first-start setup (`/docker-entrypoint-initdb.d`) also hung, so I replaced it with my own `ensure-users.sh`.

**How are secrets kept out of images?**
`.env` files are in `.dockerignore`, and no secret is written in a Dockerfile. Secrets are passed in only when the
container starts, as environment variables.

---

## 2. Docker Compose

**What is Docker Compose?**
A tool that defines several containers in one YAML file, along with their networks, volumes, environment variables, ports
and start order. One command (`docker compose up`) starts the whole app.

**How does Compose use your Dockerfiles?**
For each service with `build: ./backend`, Compose runs a `docker build` of that folder using its Dockerfile. It then
creates a network and volumes and starts the containers in dependency order. The production file uses
`image:` instead, so it pulls ready-made images and builds nothing.

**Why two Compose files?**
- `docker-compose.yml`: local development. It **builds** images from source and serves on port 8080.
- `docker-compose.prod.yml`: the server. It **pulls** the images CI pushed to Docker Hub (tagged with the commit SHA),
  serves on port 80, and uses `restart: always`.

**How do the containers find each other?**
Compose creates a private network, and each service is reachable by its **service name** as a hostname. NGINX proxies
to `backend:5000`, and the backend connects to `mongodb://…@mongo:27017`.

**What does `depends_on` with `condition: service_healthy` do?**
The backend waits until MongoDB's health check passes, and the frontend starts after the backend. Plain `depends_on`
only waits for the container to *start*, not to be *ready*.

**How does the data survive?**
The named volume `mongo-data` is mounted at `/data/db`. Removing or recreating the container keeps the volume.
Only `docker compose down -v` deletes it.

**Why is only the frontend given a port?**
NGINX is the single public entry point. MongoDB and the backend are only on the internal network, so they can't be
reached from the internet.

**Where do the environment variables come from?**
`${VAR}` placeholders in the YAML are filled from a `.env` file next to it. On the server, the pipeline writes that
`.env` from GitHub secrets (with owner-only permissions). Locally you copy `.env.docker.example`.

**What does `${MONGO_ROOT_PASSWORD:?…}` mean?**
Compose stops with an error if the variable isn't set, instead of silently starting with an empty password.

**What does `up -d --wait` do?**
`-d` runs the containers in the background. `--wait` blocks until every container is healthy, so the pipeline knows the
deploy really worked.

**What does `restart: always` do?**
Docker restarts the container if it crashes, and starts it again after the server reboots.

**Useful commands?**
`up -d --build`, `ps`, `logs -f backend`, `exec backend sh`, `restart backend`, `pull`, `down`, `down -v`, `config`.

---

## 3. GitHub Actions CI/CD pipeline

**When does the pipeline run?**
- **Push to `main`:** CI, then build and push images, then deploy.
- **Pull request to `main`:** CI only, nothing is deployed.
- **Manual (`workflow_dispatch`):** from the Actions tab. It has an optional `reset_database` checkbox.

A commit message containing `[skip ci]` skips the run.

**What are the stages?**
1. **CI** (3 jobs in parallel):
   - Backend: `npm ci`, a syntax check of every `.js` file, and `npm audit`.
   - Frontend: `npm ci` and a production build.
   - Validate configs: `docker compose config` on both Compose files, plus manifest validation.
2. **Build & push:** a matrix job that builds the backend, frontend and mongo images in parallel and pushes them to Docker Hub.
3. **Deploy:** SSH into the server, pull the new images, start them, and wait for the health checks.
4. **Smoke test:** `curl http://<server>/api/health` must succeed, or the run fails.

**What is a matrix job?**
One job definition run several times with different values. Our build job runs once for each of the 3 images, in parallel.

**What does `needs:` do?**
It sets the order. `build-push` only runs if all CI jobs pass, and deploy only runs if the images were pushed. A failed
test never reaches production.

**How are images tagged, and why?**
Each image gets two tags: the **git commit SHA** (`IMAGE_TAG: ${{ github.sha }}`) and `latest`. The SHA tag makes every
deploy traceable to an exact commit, and you can roll back by deploying an older tag.

**How is the build made faster?**
`cache-from/cache-to: type=gha` stores Docker layers in GitHub's cache, so unchanged layers aren't rebuilt.
`setup-node` with `cache: npm` caches npm downloads.

**Secrets vs variables?**
- **Secrets** (`DOCKERHUB_TOKEN`, `EC2_SSH_KEY`, `JWT_SECRET`, Mongo passwords, `BREVO_API_KEY`) are encrypted, and GitHub
  masks them as `***` in logs.
- **Variables** (`DOCKERHUB_USERNAME`, `EC2_HOST`, `APP_URL`, `NODE_ENV`, `DEPLOY_TARGET`, …) are plain settings that aren't sensitive.

**How do secrets reach the app without being exposed?**
- Secrets go into steps through `env:` and are never written directly into the script. The SSH key is written to a file
  with `chmod 600` and deleted at the end (`if: always()`).
- For Compose, the `.env` file is created with `umask 077`, copied over, and deleted from the runner.
- No secret is ever committed to git or built into an image.

**How does the pipeline log in to Docker Hub?**
`docker/login-action` with the `DOCKERHUB_USERNAME` variable and an **access token** (the `DOCKERHUB_TOKEN` secret), not
the account password. The token can be revoked on its own.

**How does it deploy to the server?**
With plain `ssh`/`scp` using the private key from secrets. It copies the files, then runs the deploy commands remotely
in a here-doc script with `set -euo pipefail`, so any failing command fails the job.

**How do you choose Docker Compose vs Kubernetes?**
The repository variable `DEPLOY_TARGET`. If it's `compose`, the `deploy-compose` job runs. Otherwise the Kubernetes job
runs. Each job's `if:` condition checks the variable.

**What does `concurrency` do?**
Only one deploy runs at a time. A new push waits for the running deploy instead of both changing the server at once.

**What is `environment: production`?**
A GitHub Environment. It shows the deployment and its URL on the repo page, and can have protection rules such as
required approval.

**What happens when a deploy fails?**
- The job goes red, and the smoke test never marks a broken deploy as successful.
- A `trap … ERR` prints diagnostics (container status and logs) into collapsible groups in the Actions log, so you can see the cause without SSHing in.

**What does the `reset_database` checkbox do?**
On a manual run it wipes the database before deploying. For Compose that's `docker compose down -v`. It's only for a
broken database, because it deletes all data.

---

## 4. NGINX (`frontend/nginx.conf`)

**What does NGINX do in this project?**
Two jobs in one container:
1. **Web server:** serves the built React files from `/usr/share/nginx/html`.
2. **Reverse proxy:** forwards every `/api/...` request to the backend at `backend:5000`.

**What is a reverse proxy?**
A server that receives client requests and forwards them to internal servers, then returns the response. The client
only ever talks to NGINX, so the backend stays hidden.

**Why use NGINX instead of exposing the backend directly?**
- **One origin:** the site and the API are both on port 80, so there are no CORS or cross-site cookie problems.
- **Security:** the backend and the database aren't reachable from the internet.
- **Performance:** NGINX serves static files very efficiently, with compression and caching.
- The Vite dev server isn't meant for production.

**Walk through the config.**
```nginx
upstream flatshare_api { server backend:5000; }     # the backend, by its Compose/K8s service name

location /api/ {
    proxy_pass http://flatshare_api;                 # forward to the backend
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;              # real client IP
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
location = /sw.js { add_header Cache-Control "no-cache, no-store, must-revalidate"; }
location / { try_files $uri $uri/ /index.html; }   # SPA fallback
```

**What does `try_files $uri $uri/ /index.html` do?**
If no real file matches the URL (for example `/groups/123`), NGINX serves `index.html`, and React Router shows the right
page. Without it, refreshing on a deep link would give a 404.

**Why do the proxy headers matter?**
Without them the backend would see every request as coming from NGINX. `X-Forwarded-For` passes the real client IP,
and Express reads it because `server.js` sets `app.set('trust proxy', 1)`. The login rate limiter depends on that IP.

**Why cache `/assets/` for a year but never cache `sw.js`?**
Vite gives built files a content hash in the name (`index-a1b2c3.js`). A new build means a new file name, so caching them
forever is safe. The service worker always has the same name. If browsers cached it, users would be stuck on an old
version of the app.

**What are the other settings?**
- `gzip on`: compresses text responses (JS, CSS, JSON), so they're smaller and load faster.
- `server_tokens off`: hides the NGINX version number.
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`: basic browser security headers (no MIME sniffing, no
  embedding in other sites' frames, limited referrer leaks).
- `client_max_body_size 5m`: limits the size of request bodies.
- `location = /healthz`: returns `ok` without touching the backend. Used by the container health check.

**What is `upstream`?**
A named group of backend servers. Here it has one entry, `backend:5000`. In Compose that name resolves to the backend
container. If there were several backend servers, NGINX would load-balance between them.

**How does `frontend/Dockerfile` use this config?**
`COPY nginx.conf /etc/nginx/conf.d/default.conf` replaces NGINX's default site. Then
`CMD ["nginx", "-g", "daemon off;"]` keeps NGINX in the foreground, which a container needs: if the main process
exits, the container stops.
