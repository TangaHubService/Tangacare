# Production Deployment Guide (PM2 + Nginx)

This guide documents the automated deployment process using GitHub Actions, PM2, and Nginx.

## Architecture
- **Process Manager**: PM2 (Cluster Mode)
- **Reverse Proxy**: Nginx
- **CI/CD**: GitHub Actions (SSH-based)

## VPS Setup
1. **Node.js**: Install Node.js 20.
2. **PM2**: `npm install -g pm2`
3. **Nginx**: `apt install nginx`

## Automated Deployment
Deployment is triggered automatically on push to the `main` branch.

### Required GitHub Secrets
- `DEPLOY_SSH_KEY`: Private SSH key for the server.
- `ENV_FILE`: Full content of the `.env` file.

## Manual Commands
- **Check Status**: `pm2 status`
- **View Logs**: `pm2 logs`
- **Restart App**: `pm2 restart ecosystem.config.js`
- **Run Migrations**: `yarn migration:run:prod`

## Table of Contents

- [Prerequisites](#prerequisites)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [Container Registry Setup](#container-registry-setup)
- [Deployment Options](#deployment-options)
- [Database Migrations](#database-migrations)
- [Monitoring and Health Checks](#monitoring-and-health-checks)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- Docker (v20.10+)
- Docker Compose (v2.0+)
- Git
- GitHub account with repository access

### Required Accounts
- Container registry account (GitHub Container Registry is used by default)
- Deployment platform account (AWS, Google Cloud, Azure, DigitalOcean, or VPS)

## GitHub Secrets Configuration

Configure the following secrets in your GitHub repository (`Settings > Secrets and variables > Actions`):

### Required Secrets

#### Database Configuration
```
DB_HOST=your-database-host
DB_PORT=5432
DB_USERNAME=your-db-username
DB_PASSWORD=your-db-password
DB_DATABASE=tangacare
```

#### JWT Secrets
```
JWT_SECRET=your-production-jwt-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-production-refresh-secret-key-min-32-chars
```

#### CORS Configuration
```
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com
```

#### Deployment Configuration (for SSH deployment)
```
DEPLOY_HOST=your-server-ip-or-domain
DEPLOY_USER=your-ssh-username
DEPLOY_SSH_KEY=your-private-ssh-key
DEPLOY_URL=https://api.yourdomain.com
```

#### Test Environment Configuration (Optional - for CI)
If you want to use a different test database or custom test configuration in CI:
```
TEST_DB_HOST=localhost
TEST_DB_PORT=5432
TEST_DB_USERNAME=postgres
TEST_DB_PASSWORD=postgres
TEST_DB_DATABASE=tangacare_test
```

> [!NOTE]
> If these test secrets are not configured, the CI workflow will use default values (localhost PostgreSQL). The `JWT_SECRET` and `JWT_REFRESH_SECRET` are shared between production and test environments.


### Optional Secrets (based on deployment platform)

#### AWS Deployment
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
```

#### Google Cloud Deployment
```
GCP_CREDENTIALS=your-service-account-json
```

#### Azure Deployment
```
AZURE_CREDENTIALS=your-azure-credentials-json
```

#### DigitalOcean Deployment
```
DIGITALOCEAN_ACCESS_TOKEN=your-do-token
```

## Container Registry Setup

### GitHub Container Registry (Default)

1. **Enable GitHub Container Registry** (already enabled by default for public repos)

2. **Authenticate locally** (for testing):
   ```bash
   echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
   ```

3. **Package visibility**: After first push, go to your package settings and make it public if needed

### Alternative Registries

#### Docker Hub
Update `.github/workflows/docker-build.yml`:
```yaml
env:
  REGISTRY: docker.io
  IMAGE_NAME: your-dockerhub-username/tangacare-backend
```

Add secrets:
```
DOCKERHUB_USERNAME=your-username
DOCKERHUB_TOKEN=your-access-token
```

#### AWS ECR
```yaml
env:
  REGISTRY: 123456789012.dkr.ecr.us-east-1.amazonaws.com
  IMAGE_NAME: tangacare-backend
```

## Deployment Options

### Option 1: SSH Deployment to VPS/VM (Default)

The default deployment workflow uses SSH to deploy to a VPS or VM.

#### Setup Steps

1. **Prepare your server**:
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Create Docker network
   docker network create tangacare-network
   
   # Set up PostgreSQL (if not using external DB)
   docker run -d \
     --name tangacare-postgres \
     --network tangacare-network \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=your-secure-password \
     -e POSTGRES_DB=tangacare \
     -v postgres_data:/var/lib/postgresql/data \
     postgres:15-alpine
   ```

2. **Configure GitHub Secrets** (as listed above)

3. **Deploy**:
   - Push to `main` branch, or
   - Create a release, or
   - Manually trigger workflow from Actions tab

### Option 2: AWS ECS Deployment

1. **Uncomment AWS section** in `.github/workflows/deploy.yml`

2. **Create ECS task definition** (`task-definition.json`):
   ```json
   {
     "family": "tangacare-backend",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
     "containerDefinitions": [
       {
         "name": "tangacare-backend",
         "image": "ghcr.io/your-org/tangacare-backend:latest",
         "portMappings": [
           {
             "containerPort": 3000,
             "protocol": "tcp"
           }
         ],
         "environment": [
           {"name": "NODE_ENV", "value": "production"},
           {"name": "PORT", "value": "3000"}
         ],
         "secrets": [
           {"name": "DB_PASSWORD", "valueFrom": "arn:aws:secretsmanager:..."}
         ]
       }
     ]
   }
   ```

3. **Configure AWS secrets** in GitHub

### Option 3: Google Cloud Run Deployment

1. **Uncomment Google Cloud section** in `.github/workflows/deploy.yml`

2. **Create service account** with Cloud Run Admin role

3. **Download JSON key** and add to GitHub secrets as `GCP_CREDENTIALS`

### Option 4: Azure Container Instances

1. **Uncomment Azure section** in `.github/workflows/deploy.yml`

2. **Create service principal**:
   ```bash
   az ad sp create-for-rbac --name "tangacare-backend" --sdk-auth
   ```

3. **Add output JSON** to GitHub secrets as `AZURE_CREDENTIALS`

### Option 5: DigitalOcean App Platform

1. **Uncomment DigitalOcean section** in `.github/workflows/deploy.yml`

2. **Create API token** in DigitalOcean dashboard

3. **Add token** to GitHub secrets as `DIGITALOCEAN_ACCESS_TOKEN`

## Database Migrations

### Automatic Migrations (Recommended)

Migrations run automatically during deployment via the deploy workflow.

### Manual Migrations

If you need to run migrations manually:

```bash
# Using Docker
docker run --rm \
  --network tangacare-network \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=your-password \
  -e DB_DATABASE=tangacare \
  ghcr.io/your-org/tangacare-backend:latest \
  yarn migration:run

# Or SSH into server
ssh user@your-server
docker exec tangacare-backend yarn migration:run
```

### Rollback Migrations

```bash
docker exec tangacare-backend yarn migration:revert
```

## Monitoring and Health Checks

### Health Check Endpoint

The application exposes a health check at `/health`:

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-20T12:00:00.000Z",
  "uptime": 3600
}
```

### Container Health

```bash
# Check container status
docker ps

# View container logs
docker logs tangacare-backend

# Follow logs in real-time
docker logs -f tangacare-backend

# Check last 100 lines
docker logs --tail 100 tangacare-backend
```

### Database Connection

```bash
# Test database connection
docker exec tangacare-backend node -e "require('./dist/config/database').initializeDatabase().then(() => console.log('DB OK')).catch(console.error)"
```

## Rollback Procedures

### Rollback to Previous Version

1. **Find previous image tag**:
   ```bash
   docker images ghcr.io/your-org/tangacare-backend
   ```

2. **Stop current container**:
   ```bash
   docker stop tangacare-backend
   docker rm tangacare-backend
   ```

3. **Start previous version**:
   ```bash
   docker run -d \
     --name tangacare-backend \
     --network tangacare-network \
     --restart unless-stopped \
     -p 3000:3000 \
     --env-file .env \
     ghcr.io/your-org/tangacare-backend:previous-tag
   ```

4. **Revert database migrations** (if needed):
   ```bash
   docker exec tangacare-backend yarn migration:revert
   ```

### Emergency Rollback

If you need to quickly rollback:

```bash
# Re-run the deploy workflow with a previous release tag
# Or manually trigger with the previous version
```

## Troubleshooting

### Container Won't Start

1. **Check logs**:
   ```bash
   docker logs tangacare-backend
   ```

2. **Verify environment variables**:
   ```bash
   docker exec tangacare-backend env | grep DB_
   ```

3. **Check database connectivity**:
   ```bash
   docker exec tangacare-backend nc -zv postgres 5432
   ```

### Database Connection Issues

1. **Verify database is running**:
   ```bash
   docker ps | grep postgres
   ```

2. **Check network**:
   ```bash
   docker network inspect tangacare-network
   ```

3. **Test connection manually**:
   ```bash
   docker exec -it tangacare-postgres psql -U postgres -d tangacare
   ```

### Image Pull Failures

1. **Verify authentication**:
   ```bash
   docker login ghcr.io
   ```

2. **Check image exists**:
   ```bash
   docker pull ghcr.io/your-org/tangacare-backend:latest
   ```

3. **Verify package visibility** in GitHub

### High Memory Usage

1. **Check container stats**:
   ```bash
   docker stats tangacare-backend
   ```

2. **Limit memory** in docker-compose or run command:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 512M
   ```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Or use different port
docker run -p 3001:3000 ...
```

## Best Practices

1. **Always test in staging** before production deployment
2. **Use environment-specific secrets** for staging and production
3. **Monitor logs** after deployment
4. **Keep database backups** before running migrations
5. **Use semantic versioning** for releases
6. **Document any manual steps** required for deployment
7. **Set up monitoring and alerting** (e.g., Sentry, DataDog)

## Support

For issues or questions:
- Check the [main README](README.md)
- Review GitHub Actions workflow logs
- Check container logs
- Contact the development team
