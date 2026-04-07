#!/bin/bash

# Exit on any error
set -e

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
BRANCH=develop

echo "🚀 Starting deployment..."

# Navigate to project directory
cd $PROJECT_DIR
echo "📍 Current directory: $(pwd)"

# --------------------------
# Pull latest changes
# --------------------------
echo "📥 Pulling latest changes from $BRANCH..."
git reset --hard
git clean -fd
git pull origin $BRANCH

# --------------------------
# Install dependencies
# --------------------------
echo "📦 Installing dependencies (including build types)..."
# We run with production=false to ensure all devDependencies (TSC, types) are available for the build
yarn install --frozen-lockfile --production=false

# --------------------------
# Build project
# --------------------------
echo "🏗️ Building project..."
yarn build

# --------------------------
# Run migrations
# --------------------------
echo "🗄️ Running database migrations..."
yarn migration:run:prod

# --------------------------
# Reload app with PM2
# --------------------------
echo "🔄 Reloading application with PM2..."
pm2 reload ecosystem.config.js --env production --update-env
pm2 save

echo "✅ Deployment completed successfully!"
