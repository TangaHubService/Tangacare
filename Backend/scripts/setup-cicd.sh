#!/bin/bash

# TangaCare CI/CD Quick Setup Script
# This script helps you configure GitHub secrets for automated deployment

set -e

echo "🚀 TangaCare CI/CD Setup Script"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Please install it from: https://cli.github.com/"
    echo "Or run: brew install gh"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to GitHub CLI${NC}"
    echo "Running: gh auth login"
    gh auth login
fi

echo -e "${GREEN}✅ GitHub CLI is ready${NC}"
echo ""

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
echo "📦 Repository: $REPO"
echo ""

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_optional=$3
    
    echo -e "${YELLOW}🔐 $secret_name${NC}"
    echo "   $secret_description"
    
    if [ "$is_optional" == "optional" ]; then
        read -p "   Enter value (press Enter to skip): " secret_value
        if [ -z "$secret_value" ]; then
            echo -e "   ${YELLOW}⏭️  Skipped${NC}"
            echo ""
            return
        fi
    else
        read -p "   Enter value: " secret_value
        while [ -z "$secret_value" ]; do
            echo -e "   ${RED}This secret is required${NC}"
            read -p "   Enter value: " secret_value
        done
    fi
    
    echo "$secret_value" | gh secret set "$secret_name" --repo="$REPO"
    echo -e "   ${GREEN}✅ Set successfully${NC}"
    echo ""
}

# Function to set secret from file
set_secret_from_file() {
    local secret_name=$1
    local secret_description=$2
    local file_path=$3
    
    echo -e "${YELLOW}🔐 $secret_name${NC}"
    echo "   $secret_description"
    
    if [ -f "$file_path" ]; then
        read -p "   Use file $file_path? (y/n): " use_file
        if [ "$use_file" == "y" ]; then
            gh secret set "$secret_name" --repo="$REPO" < "$file_path"
            echo -e "   ${GREEN}✅ Set from file${NC}"
            echo ""
            return
        fi
    fi
    
    read -p "   Enter file path: " custom_path
    if [ -f "$custom_path" ]; then
        gh secret set "$secret_name" --repo="$REPO" < "$custom_path"
        echo -e "   ${GREEN}✅ Set from file${NC}"
    else
        echo -e "   ${RED}❌ File not found${NC}"
    fi
    echo ""
}

echo "Let's configure your GitHub secrets for CI/CD deployment"
echo ""

# VPS Access
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "VPS ACCESS CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

set_secret "VPS_HOST" "Your VPS IP address or domain (e.g., 123.45.67.89)"
set_secret "VPS_USER" "SSH username (e.g., ubuntu, root)"
set_secret_from_file "VPS_SSH_KEY" "Private SSH key for deployment" "$HOME/.ssh/github_deploy"
set_secret "VPS_PORT" "SSH port (default: 22)" "optional"

# Application URLs
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "APPLICATION URLS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

set_secret "STAGING_URL" "Staging environment URL (e.g., http://staging.yourdomain.com)" "optional"
set_secret "PRODUCTION_URL" "Production environment URL (e.g., https://api.yourdomain.com)"

# Database Configuration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DATABASE CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

set_secret "DB_HOST" "Database host (e.g., postgres, localhost)"
set_secret "DB_PORT" "Database port (default: 5432)" "optional"
set_secret "DB_USERNAME" "Database username"
set_secret "DB_PASSWORD" "Database password"
set_secret "DB_DATABASE" "Database name"

# JWT Secrets
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "JWT SECRETS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo -e "${YELLOW}💡 Tip: Generate strong secrets with: openssl rand -base64 32${NC}"
echo ""

set_secret "JWT_SECRET" "JWT secret key (use a long random string)"
set_secret "JWT_REFRESH_SECRET" "JWT refresh secret key (use a different long random string)"

# CORS
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CORS CONFIGURATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

set_secret "CORS_ORIGIN" "Allowed frontend origin (e.g., https://app.yourdomain.com)"

# Optional: Notifications
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OPTIONAL: NOTIFICATIONS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Do you want to configure Slack notifications? (y/n): " configure_slack
if [ "$configure_slack" == "y" ]; then
    set_secret "SLACK_WEBHOOK" "Slack webhook URL"
fi

read -p "Do you want to configure Discord notifications? (y/n): " configure_discord
if [ "$configure_discord" == "y" ]; then
    set_secret "DISCORD_WEBHOOK" "Discord webhook URL"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Verify secrets: gh secret list --repo=$REPO"
echo "2. Push to develop branch to trigger staging deployment"
echo "3. Push to main branch to trigger production deployment"
echo "4. Monitor deployments: https://github.com/$REPO/actions"
echo ""
echo -e "${GREEN}🚀 Your CI/CD pipeline is ready!${NC}"
