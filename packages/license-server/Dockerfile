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

# Set environment
ENV NODE_ENV=production

# Expose ports
EXPOSE 3000 50051

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run
CMD ["node", "dist/index.js"]

# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies
RUN pnpm install

# Copy source
COPY . .

# Expose ports
EXPOSE 3000 50051

# Run in dev mode
CMD ["pnpm", "run", "dev"]
