# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production

# Install Shaka Packager
RUN apk add --no-cache curl && \
    curl -L https://github.com/shaka-project/shaka-packager/releases/download/v3.2.0/packager-linux-x64 -o /usr/bin/packager && \
    chmod +x /usr/bin/packager && \
    apk del curl

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files
COPY --from=builder /app/dist ./dist

# Copy proto files
COPY --from=builder /app/../../../proto /proto

# Create content directory
RUN mkdir -p /data/content /data/input

# Set environment
ENV NODE_ENV=production
ENV SHAKA_PACKAGER_PATH=/usr/bin/packager

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run
CMD ["node", "dist/index.js"]

# Development stage
FROM node:20-alpine AS development

# Install Shaka Packager
RUN apk add --no-cache curl && \
    curl -L https://github.com/shaka-project/shaka-packager/releases/download/v3.2.0/packager-linux-x64 -o /usr/bin/packager && \
    chmod +x /usr/bin/packager && \
    apk del curl

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies
RUN pnpm install

# Copy source
COPY . .

# Create content directory
RUN mkdir -p /data/content /data/input

# Expose port
EXPOSE 3001

# Run in dev mode
CMD ["pnpm", "run", "dev"]
