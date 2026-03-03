#!/bin/sh
set -e

# Wait for MinIO to be ready
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null 2>&1; do
  echo "Waiting for MinIO to be ready..."
  sleep 2
done

echo "MinIO is ready. Creating buckets..."

# Create the book-covers bucket if it doesn't exist
mc mb --ignore-existing local/book-covers

# Set the bucket policy to allow public read (for cover images)
mc anonymous set download local/book-covers

echo "MinIO initialization complete."
