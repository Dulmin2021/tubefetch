FROM node:18-bookworm-slim

# Install yt-dlp and ffmpeg (Debian-based)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    pip3 install --no-cache-dir yt-dlp

WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./

# Create temp directory
RUN mkdir -p /app/temp && chown -R node:node /app

# Switch to non-root user
USER node

EXPOSE 3001

HEALTHCHECK CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
