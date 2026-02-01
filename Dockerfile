FROM node:20-bookworm

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y python3 python3-pip \
	&& rm -rf /var/lib/apt/lists/*

COPY api/package*.json ./
RUN npm ci

COPY api/ ./
RUN pip3 install -r python/requirements.txt
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
