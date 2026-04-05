#!/usr/bin/env bash
set -euo pipefail

HOST="${YZ_DEPLOY_HOST:-root@139.224.225.188}"
FRONTEND_DIR="${YZ_FRONTEND_DIR:-/usr/share/nginx/html/yz-vehicle-platform}"
BACKEND_DIR="${YZ_BACKEND_DIR:-/opt/yz-vehicle-platform}"
SERVICE_NAME="${YZ_SERVICE_NAME:-yz-fleet}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying frontend files to ${HOST}:${FRONTEND_DIR}"
scp "${ROOT_DIR}/index.html" "${ROOT_DIR}/main.js" "${ROOT_DIR}/style.css" "${HOST}:${FRONTEND_DIR}/"

echo "Deploying backend file to ${HOST}:${BACKEND_DIR}"
scp "${ROOT_DIR}/backend/app.py" "${HOST}:${BACKEND_DIR}/app.py"

echo "Restarting service ${SERVICE_NAME}"
ssh "${HOST}" "systemctl restart ${SERVICE_NAME}"

echo "Checking service status"
ssh "${HOST}" "systemctl is-active ${SERVICE_NAME}"

echo "Checking frontend"
curl -I -s "http://139.224.225.188/yz-vehicle-platform/" | head -n 1

echo "Deployment finished"
