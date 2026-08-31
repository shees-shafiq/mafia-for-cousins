# syntax=docker/dockerfile:1

FROM node:18-alpine AS base

# Install dependencies only when needed
WORKDIR /app

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose port
EXPOSE 3001

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Run server
CMD ["node", "server.js"]
