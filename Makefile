# Convenience commands for Docker development

.PHONY: up down build restart logs api-logs app-logs shell-api shell-app db-migrate db-shell clean

# Start all services
up:
	docker compose up

# Start in background
up-d:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Rebuild containers
build:
	docker compose build

# Restart services
restart:
	docker compose restart

# View all logs
logs:
	docker compose logs -f

# View API logs
api-logs:
	docker compose logs -f api

# View app logs
app-logs:
	docker compose logs -f app

# Shell into API container
shell-api:
	docker compose exec api sh

# Shell into app container
shell-app:
	docker compose exec app sh

# Run database migrations
db-migrate:
	docker compose exec api npm run db:migrate

# Open database shell
db-shell:
	docker compose exec postgres psql -U anyohaus -d anyohaus

# Clean everything (⚠️ removes volumes)
clean:
	docker compose down -v
