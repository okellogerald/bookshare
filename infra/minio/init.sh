#!/bin/sh
set -e

# Wait for MinIO to be ready
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null 2>&1; do
  echo "Waiting for MinIO to be ready..."
  sleep 2
done

echo "MinIO is ready. Creating buckets..."

BUCKET="${MINIO_BUCKET:-bookshare-media-dev}"

# Create the configured bucket if it doesn't exist
mc mb --ignore-existing "local/${BUCKET}"

# Set the bucket policy to allow public read (for images)
mc anonymous set download "local/${BUCKET}"

echo "MinIO initialization complete."
