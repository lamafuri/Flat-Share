# Kubernetes for Docker Users: FlatShare Edition

This guide explains Kubernetes using what you already know from Docker and Docker Compose. Every example uses the
real FlatShare setup in `k8s/`.

> Every command below runs **on the EC2 instance** after `ssh -i key.pem ubuntu@<EC2_IP>`.
> All FlatShare objects live in the `flatshare` **namespace**, so most commands include `-n flatshare`.

---

## 1. The mental model

### Docker Compose vs Kubernetes

Docker Compose says: *"start these containers on this machine."*
Kubernetes says: *"this is the state I want (2 backends, 1 database, port 80 open). Keep it that way."*

Kubernetes runs a constant **control loop**. It compares the **desired state** (your YAML) with the **actual state** (what's
running) and fixes any difference. If a container crashes, it restarts it. If you delete a pod, it creates a new one.
If you change the image tag, it rolls out the new version. Docker Compose doesn't watch your containers like this.

### Concept mapping

| Docker / Compose | Kubernetes | In FlatShare |
|---|---|---|
| A container | **Pod** (one or more containers that share network/storage; usually one) | each running backend/frontend/mongo |
| `services:` entry + `deploy.replicas` | **Deployment** (manages identical, replaceable pods) | `backend`, `frontend` in `k8s/20-*.yaml`, `k8s/30-*.yaml` |
| A database service with a volume | **StatefulSet** (pods with a stable name + their own disk) | `mongo` in `k8s/10-mongo.yaml` |
| Service name DNS (`backend:5000`) | **Service** (stable name + IP that load-balances to pods) | `backend`, `mongo`, `frontend` Services |
| `ports: "8080:80"` | **Service type LoadBalancer / NodePort** | `frontend` Service, port 80 |
| `environment:` | **ConfigMap** (plain settings) | `flatshare-config` |
| `.env` with passwords | **Secret** | `flatshare-secrets` |
| `volumes:` (named volume) | **PersistentVolumeClaim (PVC)** → **PersistentVolume (PV)** | `mongo-data-mongo-0` |
| Compose project name | **Namespace** (a folder that groups and isolates objects) | `flatshare` |
| `healthcheck:` | **readinessProbe / livenessProbe** | `/api/health`, `/healthz`, `mongosh ping` |
| `deploy.resources.limits` | **resources.requests / limits** | in every container spec |
| `docker compose up -d` | `kubectl apply -f k8s/` | done by GitHub Actions |
| The Docker daemon | The **kubelet** + container runtime (containerd) on each node | k3s runs these |
| One machine | **Node** (a machine in the cluster) | your single EC2 instance |
| — | **Cluster** (control plane + nodes) | k3s on EC2 = a 1-node cluster |

### What is k3s?
A small, fully conformant Kubernetes distribution packed into one binary. "Real" Kubernetes (EKS, kubeadm) needs
several machines and more memory. k3s gives you the same API and the same `kubectl` commands on one small VM. Everything
in this guide works the same on any Kubernetes cluster.

---

## 2. How FlatShare runs on Kubernetes

```
Internet ──► EC2:80 ──► Service "frontend" (LoadBalancer)
                              │  load-balances across
                    ┌─────────┴─────────┐
                 Pod frontend-xxx    Pod frontend-yyy      (Deployment, 2 replicas, NGINX)
                    │  /api/* proxied to "backend:5000"
                              ▼
                     Service "backend" (ClusterIP, internal only)
                    ┌─────────┴─────────┐
                 Pod backend-aaa     Pod backend-bbb       (Deployment, 2 replicas, Node.js)
                              │  mongodb://...@mongo:27017
                              ▼
                     Service "mongo" (headless)
                              │
                         Pod mongo-0 ──► PVC mongo-data-mongo-0 (2Gi disk)   (StatefulSet, 1 replica)
```

### The objects, file by file

**`00-namespace.yaml`: Namespace**
Puts all FlatShare objects in one group. `kubectl delete namespace flatshare` removes everything at once.

**`01-configmap.yaml`: ConfigMap**
Key/value settings (`NODE_ENV`, `CLIENT_URL`, …). The backend loads all of them as environment variables via
`envFrom: configMapRef`. This is like the `environment:` block in Compose.

**Secret `flatshare-secrets`** (created by the pipeline, not stored in git)
Same idea as a ConfigMap, but for passwords. Containers read single keys via `secretKeyRef`.
Note: Secrets are only **base64-encoded**, not encrypted. Their protection comes from access control: only people with cluster access can read them.

**`10-mongo.yaml`: headless Service + StatefulSet**
- Why a **StatefulSet** and not a Deployment? A database needs a **stable identity** (`mongo-0`, always the same name)
  and **its own disk** that follows it. Deployment pods get random names (`backend-7d9f…`) and are treated as
  interchangeable.
- `volumeClaimTemplates` creates a PVC named `mongo-data-mongo-0`. k3s's built-in *local-path* storage provisioner
  creates a matching PV (a folder on the EC2 disk). If you delete the pod, the new `mongo-0` gets the **same disk** back,
  so the data survives.
- `clusterIP: None` makes the Service **headless**: DNS returns the pod's IP directly, with no load balancing. That's
  normal for databases.

**`20-backend.yaml`: Deployment + ClusterIP Service**
- `replicas: 2`: Kubernetes keeps exactly 2 backend pods running.
- `strategy: RollingUpdate, maxUnavailable: 0, maxSurge: 1`: on a new release, start 1 new pod, wait until it's
  *ready*, then remove 1 old pod, and repeat. Old pods keep serving until the new ones are ready, so there is **zero downtime**.
- `MONGODB_URI` uses `$(MONGO_APP_USER)`. Kubernetes fills this in from env vars defined earlier in the same list.
- **ClusterIP** Service: a stable internal IP and DNS name `backend`. It isn't reachable from the internet. Only NGINX talks to it.

**`30-frontend.yaml`: Deployment + LoadBalancer Service**
- The NGINX pods (2 replicas).
- **LoadBalancer** Service: on AWS EKS this would create an AWS load balancer. On k3s, the built-in *ServiceLB*
  opens port 80 directly on the EC2 instance instead. This is the only public entry point.

### Probes (health checks)
| Probe | Question it answers | What Kubernetes does on failure |
|---|---|---|
| **readinessProbe** | "Can this pod receive traffic *now*?" | Takes the pod out of the Service's endpoints (no traffic), but doesn't restart it |
| **livenessProbe** | "Is this pod still alive or stuck?" | Kills and restarts the container |

The rolling update waits for **readiness**. That's how it knows a new pod is ready before removing an old one.

### Resources
- `requests`: what the scheduler **reserves** for the pod. It decides which node has room.
- `limits`: the **maximum**. Too much memory gets the container killed (`OOMKilled`). Too much CPU gets it slowed down (throttled).

### Labels and selectors (how objects find each other)
Pods get labels (`app: backend`). A Service has `selector: app: backend`, which means "send traffic to every pod
with this label". A Deployment uses the same mechanism to know which pods it owns. Nothing is linked by name. Everything is linked by labels.

### Deployment → ReplicaSet → Pod
A Deployment doesn't create pods directly. It creates a **ReplicaSet** for each version, and the ReplicaSet creates
the pods. On an update, the Deployment scales the new ReplicaSet up and the old one down. Old ReplicaSets are kept
(at 0 replicas), which is what makes `kubectl rollout undo` possible. That's why pod names look like
`backend-5c7f9d8b6d-x2k4p`: the Deployment name, then the ReplicaSet hash, then a random suffix.

---

## 3. Anatomy of a kubectl command

```
kubectl  <verb>   <resource-type>  [name]        [flags]
kubectl  get      pods                           -n flatshare
kubectl  describe deployment       backend       -n flatshare
kubectl  logs     deploy/backend                 -n flatshare -f
```

- **Verbs:** `get`, `describe`, `logs`, `exec`, `apply`, `delete`, `scale`, `rollout`, `top`, `port-forward`, …
- **Resource types** have short names: `po` (pods), `deploy`, `sts` (statefulsets), `svc`, `cm` (configmaps),
  `secret`, `pvc`, `pv`, `ns` (namespaces), `rs` (replicasets), `ep` (endpoints), `no` (nodes).
- `type/name` form also works: `deploy/backend`, `pod/mongo-0`, `svc/frontend`.

**Useful flags**

| Flag | Meaning |
|---|---|
| `-n flatshare` | Use this namespace (default is `default`) |
| `-A` | All namespaces |
| `-o wide` | Extra columns (pod IP, node) |
| `-o yaml` | Full object as YAML: what Kubernetes actually stores, including status |
| `-l app=backend` | Filter by label |
| `-w` | Watch: keep printing changes live |
| `--dry-run=client -o yaml` | Generate YAML without creating anything |

**Save typing:** set `flatshare` as the default namespace for your session:
```bash
kubectl config set-context --current --namespace=flatshare
```
After this you can drop `-n flatshare`. The commands below keep it so they work either way.

---

## 4. Commands with explanations

### 4.1 Cluster and nodes

```bash
kubectl cluster-info
```
Shows the API server address. It confirms `kubectl` can talk to the cluster.

```bash
kubectl get nodes -o wide
```
Lists the machines in the cluster. You'll see one node (your EC2 instance) with `STATUS Ready`. `-o wide` adds the internal
IP, OS and container runtime (`containerd`, not Docker: Kubernetes doesn't need the Docker daemon to run
images built with Docker).

```bash
kubectl describe node
```
Details about the node: capacity (CPU/memory), how much is already **allocated** by pod requests, and conditions such as
`MemoryPressure` or `DiskPressure`. Look here when pods are stuck in `Pending`.

```bash
kubectl get namespaces
```
Lists namespaces. Besides `flatshare` you'll see `kube-system`, where k3s's own components run (DNS, metrics-server,
storage provisioner, ServiceLB).

### 4.2 Seeing what's running

```bash
kubectl get all -n flatshare
```
Overview of pods, services, deployments, replicasets and statefulsets in one table. **Start here.**
ConfigMaps, Secrets and PVCs are *not* part of `all`, despite the name.

```bash
kubectl get pods -n flatshare -o wide
```
Example:
```
NAME                        READY   STATUS    RESTARTS   AGE   IP           NODE
backend-5c7f9d8b6d-x2k4p    1/1     Running   0          5m    10.42.0.12   ip-172-31-5-10
backend-5c7f9d8b6d-q8m2z    1/1     Running   0          5m    10.42.0.13   ip-172-31-5-10
frontend-7b8c6d5f4-abcde    1/1     Running   0          5m    10.42.0.14   ip-172-31-5-10
frontend-7b8c6d5f4-fghij    1/1     Running   0          5m    10.42.0.15   ip-172-31-5-10
mongo-0                     1/1     Running   0          20m   10.42.0.9    ip-172-31-5-10
```
- `READY 1/1`: ready containers / total containers in the pod. `0/1` means the readiness probe hasn't passed yet.
- `RESTARTS`: a number that keeps going up means the container keeps crashing. Check the logs.
- Pod IPs (`10.42.x.x`) are internal and **change** when pods are recreated. That's why we use Services.

```bash
kubectl get pods -n flatshare -w
```
Live view of pod changes. Very useful while a deploy, scale or self-healing demo is happening. Press Ctrl+C to stop.

```bash
kubectl get deploy,sts -n flatshare
```
```
NAME                       READY   UP-TO-DATE   AVAILABLE
deployment.apps/backend    2/2     2            2
deployment.apps/frontend   2/2     2            2
NAME                     READY
statefulset.apps/mongo   1/1
```
`READY 2/2` = ready pods / desired pods. `UP-TO-DATE` = pods already on the latest version.

```bash
kubectl get svc -n flatshare
```
```
NAME       TYPE           CLUSTER-IP     EXTERNAL-IP    PORT(S)
backend    ClusterIP      10.43.12.34    <none>         5000/TCP
frontend   LoadBalancer   10.43.56.78    172.31.5.10    80:31234/TCP
mongo      ClusterIP      None           <none>         27017/TCP
```
- `backend` has no external IP, so it's internal only.
- `frontend` has an external IP, so it's reachable on port 80. `31234` is an automatically assigned NodePort.
- `mongo` shows `CLUSTER-IP None` because it's headless.

```bash
kubectl get endpoints -n flatshare
```
Shows **which pod IPs each Service currently sends traffic to**. If a Service "doesn't work", check here first.
Empty endpoints mean no pod matches the selector, or no pod is *ready*.

```bash
kubectl get rs -n flatshare
```
ReplicaSets. After a few deploys you'll see old ones with `DESIRED 0`. Those are your rollback history.

### 4.3 Inspecting and debugging

```bash
kubectl describe pod <pod-name> -n flatshare
```
**The most important debugging command.** It shows the image, env sources, probes, resource limits, volume mounts,
and at the bottom the **Events**: scheduling, image pulling, probe failures, restarts, OOM kills. If a pod is stuck,
the reason is almost always in the Events.

```bash
kubectl describe deploy backend -n flatshare
```
Shows the rollout strategy, current image tag (the git commit SHA), replica counts and rollout events.

```bash
kubectl get events -n flatshare --sort-by=.lastTimestamp
```
All recent events in the namespace, oldest first. Good for "what just happened?" after a failed deploy.

```bash
kubectl get pod <pod-name> -n flatshare -o yaml
```
The full stored object: your spec plus the live **status** (container state, last termination reason, exit code).

#### Pod statuses and what they mean

| Status | Meaning | Usual cause / fix |
|---|---|---|
| `Pending` | Not yet placed on a node | Not enough CPU/memory (`describe node`), or the PVC isn't bound |
| `ContainerCreating` | Pulling the image / mounting volumes | Wait. If it's slow, check Events |
| `Running` | Container started | Check `READY` too: running ≠ ready |
| `ImagePullBackOff` / `ErrImagePull` | Can't download the image | Wrong image name/tag, or a private Docker Hub repo |
| `CrashLoopBackOff` | Container keeps exiting. Kubernetes retries with increasing delays | `kubectl logs --previous` shows why (e.g. wrong Mongo password) |
| `OOMKilled` (in describe) | Went over its memory limit | Raise `limits.memory` |
| `CreateContainerConfigError` | Referenced ConfigMap/Secret key is missing | Check that `flatshare-secrets` exists and has all keys |
| `Terminating` | Being shut down | Normal during rollouts |

### 4.4 Logs

```bash
kubectl logs deploy/backend -n flatshare
```
Logs from **one** pod of the deployment (Kubernetes picks one). Same as `docker logs`.

```bash
kubectl logs -l app=backend -n flatshare --prefix --tail=50
```
The last 50 lines from **all** backend pods. `--prefix` shows which pod each line came from.

```bash
kubectl logs -f deploy/frontend -n flatshare
```
`-f` follows the log live, like `docker logs -f`. The frontend log is the NGINX access log, so you can watch requests arrive.

```bash
kubectl logs <pod-name> -n flatshare --previous
```
Logs of the **previous, crashed** container. Essential for `CrashLoopBackOff`, because the current container may have
just started and has nothing useful yet.

```bash
kubectl logs mongo-0 -n flatshare --since=10m
```
Only the last 10 minutes.

### 4.5 Getting inside containers

```bash
kubectl exec -it deploy/backend -n flatshare -- sh
```
Opens a shell in a backend pod, like `docker exec -it <container> sh`. Everything after `--` is the command to run.
The images are Alpine-based, so use `sh`, not `bash`.

```bash
kubectl exec deploy/backend -n flatshare -- env | grep -E 'NODE_ENV|CLIENT_URL'
```
Runs one command without an interactive shell. Here it checks which environment variables the pod really received.

```bash
kubectl exec -it mongo-0 -n flatshare -- mongosh -u root -p --authenticationDatabase admin
```
Opens the Mongo shell inside the database pod. It asks for the root password (`MONGO_ROOT_PASSWORD`). Then try:
`use flatshare`, `show collections`, `db.users.countDocuments()`.

```bash
kubectl exec deploy/frontend -n flatshare -- wget -qO- http://backend:5000/api/health
```
Tests **service-to-service** networking from inside the cluster: the NGINX pod reaching the backend through its Service name.

### 4.6 Reaching services from your laptop (port-forward)

```bash
kubectl port-forward svc/backend 5000:5000 -n flatshare
```
Opens a temporary tunnel from `localhost:5000` on the machine running kubectl to the internal backend Service.
Because kubectl runs on EC2, this is useful for internal-only things. For example, from your laptop:
```bash
ssh -i key.pem -L 27017:localhost:27017 ubuntu@<EC2_IP> \
  "kubectl port-forward svc/mongo 27017:27017 -n flatshare"
```
Then connect **MongoDB Compass** to `mongodb://root:<pass>@localhost:27017/?authSource=admin`. The database is never
exposed to the internet.

### 4.7 Creating and changing things (declarative)

```bash
kubectl apply -f k8s/
```
"Make the cluster match these files." It creates objects that don't exist and updates ones that changed. Running it again
with no changes does nothing. This is what the pipeline runs. Like `docker compose up -d`.
(The pipeline applies *rendered* copies with real values filled in. The raw files in git still contain
`${DOCKERHUB_USERNAME}` placeholders.)

```bash
kubectl diff -f rendered/
```
Shows what `apply` *would* change, without changing anything.

```bash
kubectl delete -f k8s/30-frontend.yaml
```
Deletes the objects defined in a file.

```bash
kubectl edit deploy backend -n flatshare
```
Opens the live object in an editor. When you save, it's applied. Good for experiments. The next pipeline run
overwrites it with what's in git, which is the point: **git is the source of truth**.

### 4.8 Scaling

```bash
kubectl scale deploy backend -n flatshare --replicas=3
kubectl get pods -n flatshare -l app=backend
```
Adds a third backend pod. The `backend` Service starts sending it traffic once it's ready. Scale back with
`--replicas=2`. The next deploy also resets it to 2, because the YAML says 2.

Like `docker compose up --scale backend=3`, except Kubernetes keeps that count when pods die.

### 4.9 Rollouts, updates and rollbacks

```bash
kubectl rollout status deploy/backend -n flatshare
```
Waits until the current rollout finishes, or fails. The pipeline uses this to fail the job if new pods never become ready.

```bash
kubectl rollout history deploy/backend -n flatshare
```
Numbered revisions of the deployment, one per image change.

```bash
kubectl rollout undo deploy/backend -n flatshare
kubectl rollout undo deploy/backend -n flatshare --to-revision=2
```
**Rollback:** switches back to the previous (or a specific) ReplicaSet, again with a rolling update and zero downtime.

```bash
kubectl rollout restart deploy/backend -n flatshare
```
Restarts all pods gradually (rolling). Use it after changing a ConfigMap or Secret, because pods only read env vars at startup.

```bash
kubectl set image deploy/backend backend=<user>/flatshare-backend:<sha> -n flatshare
```
Changes the image by hand (normally the pipeline does this through `apply`).

### 4.10 ConfigMaps and Secrets

```bash
kubectl get configmap flatshare-config -n flatshare -o yaml
```
Shows the plain settings.

```bash
kubectl get secret flatshare-secrets -n flatshare
kubectl describe secret flatshare-secrets -n flatshare
```
`describe` lists the **keys and their sizes only**, never the values. That makes it safe to show in a viva.

```bash
kubectl get secret flatshare-secrets -n flatshare -o jsonpath='{.data.JWT_SECRET}' | base64 -d
```
Decodes one value. This shows that Secrets are base64-encoded, **not encrypted**. Don't run it on a projector with real values.

After changing either one:
```bash
kubectl rollout restart deploy/backend -n flatshare
```

### 4.11 Storage

```bash
kubectl get pvc -n flatshare
kubectl get pv
```
```
NAME                 STATUS   VOLUME          CAPACITY   ACCESS MODES   STORAGECLASS
mongo-data-mongo-0   Bound    pvc-1a2b3c...   2Gi        RWO            local-path
```
- **PVC** (claim) = "I need 2Gi". **PV** (volume) = the actual disk that satisfies it. `Bound` means they're connected.
- `RWO` (ReadWriteOnce) = one node can mount it at a time.
- `local-path` = k3s stores it in a folder on the EC2 disk (`/var/lib/rancher/k3s/storage/`).

PVCs are **not** deleted when you delete the StatefulSet or pod. That protects your data. Delete the PVC
on purpose only when you really want to wipe the database.

### 4.12 Monitoring resource usage

```bash
kubectl top nodes
kubectl top pods -n flatshare
```
Live CPU (`m` = millicores, 1000m = 1 CPU) and memory usage. This works because k3s includes **metrics-server**.
Compare it with the `requests`/`limits` in the YAML. Like `docker stats`.

### 4.13 Cleanup

```bash
kubectl delete pod <pod-name> -n flatshare
```
Deletes a pod. If a Deployment/StatefulSet owns it, a replacement is created right away (self-healing).

```bash
kubectl delete namespace flatshare
```
Removes **everything** FlatShare-related, including the PVC and therefore the data. The next pipeline run recreates it all
(with an empty database).

---

## 5. Docker command → kubectl command

| What you want | Docker / Compose | Kubernetes |
|---|---|---|
| Start everything | `docker compose up -d` | `kubectl apply -f k8s/` |
| List running containers | `docker ps` | `kubectl get pods` |
| See everything | `docker compose ps` | `kubectl get all -n flatshare` |
| Logs | `docker logs -f <c>` | `kubectl logs -f deploy/backend` |
| Shell into container | `docker exec -it <c> sh` | `kubectl exec -it deploy/backend -- sh` |
| Inspect | `docker inspect <c>` | `kubectl describe pod <p>` / `-o yaml` |
| Resource usage | `docker stats` | `kubectl top pods` |
| Scale | `docker compose up --scale backend=3` | `kubectl scale deploy backend --replicas=3` |
| Restart | `docker compose restart backend` | `kubectl rollout restart deploy/backend` |
| Publish a port | `ports: "80:80"` | Service `type: LoadBalancer` / `NodePort` |
| Temporary local access | — | `kubectl port-forward svc/backend 5000:5000` |
| Stop and remove | `docker compose down` | `kubectl delete -f k8s/` |
| Remove with volumes | `docker compose down -v` | `kubectl delete namespace flatshare` |

---

## 6. Hands-on demos for the viva

### Self-healing
```bash
kubectl get pods -n flatshare -w            # terminal 1
kubectl delete pod -n flatshare -l app=backend --wait=false   # terminal 2
```
Both backend pods go to `Terminating`, and new ones appear and become `Running` within seconds. The site keeps working
because the frontend still proxies to whichever backend pods are ready.

### Scaling
```bash
kubectl scale deploy backend -n flatshare --replicas=4
kubectl get endpoints backend -n flatshare   # now 4 IPs behind one Service
kubectl scale deploy backend -n flatshare --replicas=2
```

### Data persistence
```bash
# register a user in the app first, then:
kubectl delete pod mongo-0 -n flatshare
kubectl get pods -n flatshare -w             # mongo-0 comes back with the same name
# log in again: the user still exists, because the PVC kept the data
```

### Zero-downtime deploy and rollback
1. Change some text in the frontend, commit, push.
2. On the server: `kubectl get pods -n flatshare -w`. New frontend pods start, become ready, then old ones terminate.
3. `kubectl rollout history deploy/frontend -n flatshare`
4. `kubectl rollout undo deploy/frontend -n flatshare`: the old version is back in seconds.

### Internal networking
```bash
kubectl exec deploy/frontend -n flatshare -- wget -qO- http://backend:5000/api/health
curl -m 5 http://<EC2_IP>:5000/api/health    # from your laptop: fails, the backend isn't exposed
```

---

## 7. Debugging checklist

When something doesn't work, go top to bottom:

1. `kubectl get pods -n flatshare`: is anything not `Running` or not `READY`?
2. `kubectl describe pod <pod> -n flatshare` → read **Events** at the bottom.
3. `kubectl logs <pod> -n flatshare` (add `--previous` if it's restarting).
4. `kubectl get endpoints -n flatshare`: does each Service have pod IPs?
5. `kubectl exec deploy/frontend -n flatshare -- wget -qO- http://backend:5000/api/health`: does internal networking work?
6. `kubectl get svc frontend -n flatshare`: does it have an EXTERNAL-IP? Is port 80 open in the AWS security group?
7. `kubectl top pods -n flatshare` / `kubectl describe node`: out of memory?

---

## 8. Likely viva questions

**What is the difference between a Pod, a Deployment and a Service?**
A Pod is a running container (the smallest unit). A Deployment keeps a set number of identical pods running and
handles updates. A Service gives those changing pods one stable name/IP and load-balances between them.

**Why a StatefulSet for MongoDB?**
Databases need a stable identity and storage that stays attached to the same pod. Deployment pods are
interchangeable and get random names. A StatefulSet gives `mongo-0` a fixed name and its own PVC.

**What happens when you push to main?**
GitHub Actions runs CI, builds 3 images tagged with the commit SHA, pushes them to Docker Hub, then SSHes into EC2 and runs
`kubectl apply` with the new tags. The Deployments see a changed image and do a rolling update: new pods start, pass
their readiness probe, then old pods are removed. If new pods never become ready, `rollout status` fails the job.

**How are secrets handled?**
They are stored as encrypted GitHub Actions secrets. During deploy, the workflow turns them into a Kubernetes Secret.
Pods read them as environment variables. They are never in git or in the images.

**Readiness vs liveness probe?**
Readiness controls traffic: a pod that isn't ready gets no requests. Liveness controls restarts: a pod that fails is killed and recreated.

**ClusterIP vs NodePort vs LoadBalancer?**
ClusterIP: internal only (backend, mongo). NodePort: opens a high port (30000–32767) on every node.
LoadBalancer: an external entry point. On AWS EKS it creates an ELB. On k3s, ServiceLB binds the port on the node (frontend, port 80).

**Why k3s instead of EKS?**
EKS needs IAM roles, several nodes and costs more, and the sandbox restricts all of that. k3s is a certified Kubernetes
distribution that runs on one VM with the same API and manifests. The same YAML would work on EKS.

**Why NGINX if Kubernetes already has Services?**
Services route traffic *inside* the cluster at the network level. NGINX works at the HTTP level: it serves the
static React files, applies caching and gzip, and routes `/api` to the backend, so the whole app is one origin on port 80.
