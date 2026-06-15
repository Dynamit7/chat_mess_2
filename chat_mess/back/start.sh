#!/bin/bash

# Start Redis and MinIO if not already running
if ! docker ps --format '{{.Names}}' | grep -q '^redis$'; then
  echo "Starting Redis..."
  docker start redis 2>/dev/null || docker run -d --name redis -p 6379:6379 redis:alpine redis-server --requirepass "nexus_dev_password_2026"
fi

if ! docker ps --format '{{.Names}}' | grep -q '^minio$'; then
  echo "Starting MinIO..."
  docker start minio 2>/dev/null || docker run -d --name minio -p 9000:9000 -p 9001:9001 \
    -e MINIO_ROOT_USER=nexus_admin \
    -e MINIO_ROOT_PASSWORD=nexus_dev_password_2026 \
    -v minio_data:/data \
    quay.io/minio/minio server /data --console-address ":9001"
fi

echo "Waiting for services..."
sleep 2

echo "Starting backend..."
node app.js
