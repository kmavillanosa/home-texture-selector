# Docker Development Setup

Hot reload development environment for both frontend (Vite) and backend (NestJS).

## Quick Start

```bash
# Start all services (Postgres, API, App)
docker compose up

# Or run in background
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Rebuild containers (after Dockerfile changes)
docker compose build
```

## Services

- **Postgres** (port 5432): PostgreSQL database
- **API** (port 3000): NestJS backend with hot reload
- **App** (port 5173): Vite frontend with hot reload

## Hot Reload

Both services watch for file changes:

- **API**: Changes in `api/src/` trigger NestJS watch mode
- **App**: Changes in `app/src/` trigger Vite HMR

### How It Works

- Source code is mounted as volumes (bind mounts)
- `node_modules` use named volumes (faster, avoids host/container conflicts)
- Development commands run in watch mode:
  - API: `npm run start:dev` (NestJS watch)
  - App: `npm run dev` (Vite HMR)

## Access

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000
- **Postgres**: localhost:5432

## Volumes

### Named Volumes (persistent)
- `postgres_data`: Database data
- `api-uploads`: Uploaded images
- `api-cache`: Segmentation cache
- `api-node-modules`: API dependencies (cached)
- `app-node-modules`: App dependencies (cached)

### Bind Mounts (hot reload)
- `./api/src` → `/app/src`
- `./app/src` → `/app/src`
- Config files mounted read-only

## Environment Variables

Set in `api/.env`:
- `DATABASE_URL`: PostgreSQL connection string
- `STORAGE_*`: Cloudflare R2 (optional)

## Troubleshooting

### Containers not updating
```bash
# Rebuild after Dockerfile changes
docker compose build

# Restart services
docker compose restart
```

### Port conflicts
Change ports in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Host:Container
```

### Clear volumes
```bash
# Remove all volumes (⚠️ deletes data)
docker compose down -v
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f app
```

### Database migrations
```bash
# Run migrations inside API container
docker compose exec api npm run db:migrate

# Or connect directly
docker compose exec postgres psql -U anyohaus -d anyohaus
```

## Production Build

For production, use the regular Dockerfiles (not `.dev`):
```bash
docker compose -f docker-compose.prod.yml up
```
