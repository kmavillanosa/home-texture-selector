#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
	echo "Applying Prisma migrations..."
	npx prisma migrate deploy
fi

npm run start:dev
