#!/bin/bash
# One-time setup of the EC2 instance (Ubuntu 22.04/24.04).
# Installs k3s, a lightweight single-node Kubernetes, and lets the login user
# run kubectl without sudo.
#
# Usage on the instance:  bash setup-ec2.sh
set -euo pipefail

echo "==> Updating packages"
sudo apt-get update -y
sudo apt-get install -y curl

echo "==> Adding 2 GB swap (helps small instances)"
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> Installing k3s (Traefik disabled: NGINX is our reverse proxy)"
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --write-kubeconfig-mode 644" sh -

echo "==> Configuring kubectl for $USER"
mkdir -p "$HOME/.kube"
sudo cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
sudo chown "$USER":"$USER" "$HOME/.kube/config"
chmod 600 "$HOME/.kube/config"
grep -q 'KUBECONFIG' "$HOME/.bashrc" || echo 'export KUBECONFIG=$HOME/.kube/config' >> "$HOME/.bashrc"

echo "==> Waiting for the node to be Ready"
export KUBECONFIG="$HOME/.kube/config"
kubectl wait --for=condition=Ready node --all --timeout=180s
kubectl get nodes -o wide

echo "==> Done. k3s is running. Push to main to deploy via GitHub Actions."
