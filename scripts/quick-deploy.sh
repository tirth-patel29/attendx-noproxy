#!/bin/bash
# Quick deploy script - run this on your server

set -e

echo "🚀 Deploying Watermelon UI to attendance-gateway..."

# Pull latest code
cd /home/hetp/attendance-gateway
git pull origin main

# Sync teacher
echo "📦 Syncing teacher..."
cp -r teacher/* /home/hetp/docker-stacks/attendance-teacher/teacher/

# Sync admin
echo "📦 Syncing admin..."
cp -r admin/* /home/hetp/docker-stacks/attendance-admin/admin/

# Rebuild teacher
echo "🔨 Rebuilding teacher container..."
cd /home/hetp/docker-stacks/attendance-teacher
docker compose up -d --build

# Rebuild admin
echo "🔨 Rebuilding admin container..."
cd /home/hetp/docker-stacks/attendance-admin
docker compose up -d --build

echo "✅ Deployment complete!"
echo ""
echo "Check the sites:"
echo "  Teacher: https://teacher.atmyhome.tech"
echo "  Admin:  https://admin.atmyhome.tech"
echo ""
echo "Hard refresh your browser (Ctrl+Shift+R) to see the new Watermelon UI!"