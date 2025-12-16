FROM node:18-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install minimal runtime deps and fetch yt-dlp static binary
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      curl \
      ca-certificates; \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp; \
    chmod a+rx /usr/local/bin/yt-dlp; \
    yt-dlp --version; \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY backend/ ./

# Create temp directory for downloads
RUN mkdir -p /tmp && chmod 777 /tmp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Expose port (Fly.io uses PORT env variable)
EXPOSE 8080

# Set environment
ENV NODE_ENV=production

# Start application
CMD ["node", "server.js"]