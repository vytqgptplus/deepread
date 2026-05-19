# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm globally
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p logs

# Set environment variables defaults
ENV NODE_ENV=production
ENV PORT=9430

EXPOSE 9430

# Start the application
CMD ["node", "dist/main"]
