#!/usr/bin/env bash
set -euo pipefail

echo "Starting Docker Compose in watch mode..."
docker compose up -d
docker compose watch
