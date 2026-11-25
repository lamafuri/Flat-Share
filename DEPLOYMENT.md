# Deploying FlatShare on AWS (Docker + NGINX + Kubernetes + GitHub Actions)

New to Kubernetes? Read [KUBERNETES.md](KUBERNETES.md) first: concepts and every `kubectl` command explained.
Docker basics, the Dockerfiles and the Compose files are explained in [DOCKER.md](DOCKER.md).

> **Deploy target:** Kubernetes (k3s) is the default. To deploy with Docker Compose instead, add the repository
> variable `DEPLOY_TARGET` = `compose` (see the end of DOCKER.md). Everything else (secrets, variables, EC2) stays the same.

## Architecture

```
                 GitHub (push to main)
                        │
                GitHub Actions CI/CD
   ┌────────────┬───────┴──────┬──────────────────┐
   │ 1. CI      │ 2. Build &   │ 3. Deploy        │
   │ npm ci,    │ push 3 images│ SSH → kubectl    │
   │ build,     │ to Docker Hub│ apply, rollout   │
   │ validate   │              │ status, smoke    │
   └────────────┴──────────────┴────────┬─────────┘
                                        │
   AWS EC2 (Ubuntu, t3.medium) running k3s (single-node Kubernetes)
   ┌────────────────────── namespace: flatshare ──────────────────────┐
   │                                                                  │
 :80 ─► Service frontend (LoadBalancer)                              │
   │        │                                                         │
   │   Deployment frontend ×2  (NGINX)                                │
   │     • serves React build (web server)                            │
   │     • /api/* ─► Service backend (reverse proxy)                  │
   │                    │                                             │
   │             Deployment backend ×2  (Node/Express :5000)          │
   │                    │                                             │
   │             Service mongo (headless) ─► StatefulSet mongo ×1     │
   │                                         + PersistentVolume 2Gi   │
   │  ConfigMap flatshare-config   Secret flatshare-secrets           │
   └──────────────────────────────────────────────────────────────────┘
```

| Piece | File |
|---|---|
| Backend image | `backend/Dockerfile` |
| Frontend image (multi-stage: Vite build → NGINX) | `frontend/Dockerfile`, `frontend/nginx.conf` |
| MongoDB image (official + user-setup script) | `mongo/Dockerfile`, `mongo/ensure-users.sh`, `mongo/flatshare-entrypoint.sh` |
| Local stack | `docker-compose.yml`, `.env.docker.example` |
| Kubernetes | `k8s/*.yaml` |
| Server bootstrap | `scripts/setup-ec2.sh` |
| Pipeline | `.github/workflows/ci-cd.yml` |

---

## Group A: Test locally with Docker (optional, recommended)

1. `cp .env.docker.example .env.docker` and fill in the passwords (letters and numbers only).
2. `docker compose --env-file .env.docker up --build -d`
3. Open http://localhost:8080. With `NODE_ENV=development` and no Brevo key, OTP codes appear in
   `docker compose logs backend`.
4. `docker compose down` (add `-v` to wipe the database).

## Group B: Docker Hub

1. Sign in at https://hub.docker.com (or create an account).
2. Account settings → Personal access tokens → Generate, with **Read & Write** access. Copy the token.
3. You don't need to create repositories: the first push creates `flatshare-backend`, `flatshare-frontend`
   and `flatshare-mongo` as **public** repositories. Keep them public, because the cluster pulls them without credentials.

## Group C: AWS sandbox: launch the EC2 instance

1. Start the lab (AWS Academy: **Start Lab**, wait for the green dot, then click **AWS**).
2. EC2 → **Launch instance**:
   - Name: `flatshare-k3s`
   - AMI: **Ubuntu Server 24.04 LTS** (x86_64)
   - Instance type: **t3.medium** (2 vCPU / 4 GB). t3.small also works, more slowly.
   - Key pair: **Create new key pair** → `flatshare-key`, RSA, `.pem` → download it. You can also use the lab's `vockey`
     and download its PEM from *AWS Details*.
   - Network settings → Create security group `flatshare-sg` with inbound rules:
     - SSH, TCP 22, source `0.0.0.0/0` (GitHub runners use changing IPs)
     - HTTP, TCP 80, source `0.0.0.0/0`
   - Storage: **20 GiB gp3**
   - Launch.
3. **Elastic IP** (keeps the same IP when the lab restarts): EC2 → Elastic IPs → Allocate → Actions →
   Associate → pick the instance. Use this IP everywhere below as `<EC2_IP>`.

## Group D: Install Kubernetes (k3s) on the instance

From your machine:

```bash
chmod 400 ~/Downloads/flatshare-key.pem
scp -i ~/Downloads/flatshare-key.pem scripts/setup-ec2.sh ubuntu@<EC2_IP>:~
ssh -i ~/Downloads/flatshare-key.pem ubuntu@<EC2_IP>
bash setup-ec2.sh          # on the instance
kubectl get nodes          # STATUS should be Ready
```

The script installs k3s with Traefik disabled, because NGINX is our reverse proxy. It also adds swap and sets up `kubectl` for the `ubuntu` user.

## Group E: GitHub secrets and variables

Repo → **Settings → Secrets and variables → Actions**.

Generate strong values locally with `openssl rand -hex 32`.

**Secrets** tab → *New repository secret*:

| Name | Value |
|---|---|
| `DOCKERHUB_TOKEN` | Docker Hub access token from Group B |
| `EC2_SSH_KEY` | Full contents of the `.pem` file, including the `-----BEGIN…` and `-----END…` lines |
| `MONGO_ROOT_PASSWORD` | `openssl rand -hex 24` |
| `MONGO_APP_PASSWORD` | `openssl rand -hex 24` (hex only, because it goes inside the Mongo URL) |
| `JWT_SECRET` | `openssl rand -hex 48` |
| `BREVO_API_KEY` | Your Brevo API key (leave empty if you don't have one, see the note below) |

**Variables** tab → *New repository variable*:

| Name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | your Docker Hub username |
| `EC2_HOST` | `<EC2_IP>` |
| `EC2_USER` | `ubuntu` |
| `APP_URL` | `http://<EC2_IP>` |
| `EMAIL_FROM` | your Brevo-verified sender email |
| `EMAIL_FROM_NAME` | `FlatShare App` |
| `NODE_ENV` | `production` (or `development`, see the note below) |

> **No Brevo key?** Set `NODE_ENV` to `development`. OTP codes are then written to the backend logs
> (`kubectl -n flatshare logs deploy/backend | grep code`) instead of being emailed.
>
> **Important:** `MONGO_ROOT_PASSWORD` is fixed once the database exists. To change it, reset the database
> (Group H). `MONGO_APP_PASSWORD` can be changed at any time: it's updated on the next deploy.

## Group F: Deploy

1. Commit and push to `main`:
   ```bash
   git add .
   git commit -m "Add Docker, NGINX, Kubernetes and CI/CD deployment"
   git push origin main
   ```
2. GitHub → **Actions** tab → watch **CI/CD**:
   - `Backend CI`, `Frontend CI`, `Validate configs` run in parallel
   - `Build & push` runs ×3 (matrix), building backend, frontend and mongo images tagged with the commit SHA and `latest`
   - `Deploy to k3s on EC2`: copies manifests over SSH, `kubectl apply`, waits for rollouts, then runs a smoke test against `/api/health`
3. Open `http://<EC2_IP>`. Every later push to `main` redeploys automatically with a zero-downtime rolling update.
   Pull requests run only the CI jobs.
4. You can also re-run it by hand from Actions → CI/CD → **Run workflow**.

## Group G: Commands to show in the viva (on the EC2 instance)

```bash
kubectl get all -n flatshare                         # every object
kubectl get pods -n flatshare -o wide                # 2 frontend, 2 backend, 1 mongo
kubectl get pvc -n flatshare                         # Mongo's persistent volume
kubectl get configmap,secret -n flatshare
kubectl describe deploy backend -n flatshare         # probes, image tag, strategy

# Self-healing: delete a pod and watch Kubernetes recreate it
kubectl delete pod -n flatshare -l app=backend --wait=false
kubectl get pods -n flatshare -w

# Scaling
kubectl scale deploy backend -n flatshare --replicas=3
kubectl get pods -n flatshare

# Logs
kubectl logs -n flatshare deploy/backend
kubectl logs -n flatshare deploy/frontend            # NGINX access log

# Rollout history / rollback
kubectl rollout history deploy/backend -n flatshare
kubectl rollout undo deploy/backend -n flatshare

# Data persists across a Mongo pod restart
kubectl delete pod mongo-0 -n flatshare
```

Points to explain:
- **Why NGINX?** One public entry point (port 80). It serves the static React build as a web server and forwards
  `/api` to the internal backend Service as a reverse proxy. The browser sees one origin, so there are no CORS or cookie problems.
  The backend and MongoDB are never exposed publicly.
- **Secrets vs variables:** passwords and keys are GitHub *secrets* (encrypted, masked in logs). At deploy time they become a
  Kubernetes Secret. Non-sensitive settings are GitHub *variables* and become a ConfigMap.
- **Images tagged with the commit SHA:** every deploy is traceable to a commit and can be rolled back.
- **Probes:** readiness keeps traffic away from pods that aren't ready, and liveness restarts pods that hang.
- **StatefulSet + PVC** for MongoDB: stable identity and storage that survives restarts.

## Group H: Troubleshooting

| Symptom | Fix |
|---|---|
| Deploy step: `Permission denied (publickey)` | `EC2_SSH_KEY` must be the whole `.pem` content. `EC2_USER` must be `ubuntu`. |
| Deploy step: `ssh: connect … timed out` | Security group must allow port 22 from `0.0.0.0/0`. The instance must be running (lab started). |
| Pods `ImagePullBackOff` | Docker Hub repos must be public, and `DOCKERHUB_USERNAME` must be correct. |
| Backend `CrashLoopBackOff`, logs show `Authentication failed` | Mongo passwords changed after the first deploy, or its first start was interrupted. Reset the database (below). |
| `mongo-0` stuck on an old image while unhealthy | A StatefulSet won't replace a pod that isn't Ready. The pipeline now deletes it automatically. By hand: `kubectl -n flatshare delete pod mongo-0`. |
| Site not loading on port 80 | `kubectl get svc -n flatshare frontend` should show `EXTERNAL-IP`. Check the security group allows port 80. |
| Lab session ended | Start the lab and the instance. k3s and all pods start again by themselves. Without an Elastic IP, update `EC2_HOST`/`APP_URL` and re-run the workflow. |

**Reset database** (deletes all data). The easiest way is GitHub → Actions → CI/CD → **Run workflow**, tick
**reset_database**, and run it. Or by hand on the server:
```bash
kubectl delete statefulset mongo -n flatshare
kubectl delete pvc mongo-data-mongo-0 -n flatshare
# then re-run the workflow (Actions → CI/CD → Run workflow)
```
