#!/bin/bash
# Quick deploy script - run this on your server

set -e

echo "🚀 Deploying Watermelon UI to attendance-gateway..."

# Pull latest code
cd /home/hetp/attendance-gateway
git pull origin main

# Sync portal
echo "📦 Syncing portal..."
cp -r portal/* /home/hetp/docker-stacks/attendance-portal/portal/

# Sync admin
echo "📦 Syncing admin..."
cp -r admin/* /home/hetp/docker-stacks/attendance-admin/admin/

# Rebuild portal
echo "🔨 Rebuilding portal container..."
cd /home/hetp/docker-stacks/attendance-portal
docker compose up -d --build

# Rebuild admin
echo "🔨 Rebuilding admin container..."
cd /home/hetp/docker-stacks/attendance-admin
docker compose up -d --build

echo "✅ Deployment complete!"
echo ""
echo "Check the sites:"
echo "  Portal: https://portal.atmyhome.tech"
echo "  Admin:  https://admin.atmyhome.tech"
echo ""
echo "Hard refresh your browser (Ctrl+Shift+R) to see the new Watermelon UI!"