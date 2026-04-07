# Tangacare Monorepo

This repository contains two Tangacare applications:

- `Backend`: Express + TypeScript backend API
- `Frontend`: React + TypeScript + Vite frontend

## Repository Structure

```text
Tangacare/
├── Backend/   # Backend API (Node.js, Express, TypeORM, PostgreSQL)
├── Frontend/  # Frontend web app (React, Vite, TypeScript)
└── README.md
```

## Prerequisites

- Node.js >= 18 (Backend)
- Node.js >= 20.19 (Frontend)
- Yarn >= 1.22
- PostgreSQL >= 13 (for backend)
- Docker and Docker Compose (optional, for local DB/services)

## Quick Start

### 1) Backend Setup (`Backend`)

```bash
cd Backend
yarn install
cp .env.example .env
```

Update `.env` with your database and JWT settings, then run:

```bash
# Optional: start PostgreSQL with Docker
docker-compose up -d

# Run migrations
yarn migration:run

# Start backend
yarn dev
```

Backend runs on `http://localhost:3000`.

Useful backend URLs:

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`
- Health check: `http://localhost:3000/health`

### 2) Frontend Setup (`Frontend`)

Open a new terminal:

```bash
cd Frontend
yarn install
yarn dev
```

Vite will print the local frontend URL (commonly `http://localhost:5173`).

## Scripts

### Backend (`Backend`)

- `yarn dev` - Start development server
- `yarn build` - Build backend
- `yarn start` - Start production build
- `yarn migration:run` - Run DB migrations
- `yarn migration:revert` - Revert last migration
- `yarn test` - Run tests

### Frontend (`Frontend`)

- `yarn dev` - Start Vite dev server
- `yarn build` - Build frontend for production
- `yarn preview` - Preview production build
- `yarn lint` - Run ESLint
- `yarn test` - Run tests

## Development Notes

- Start backend first so frontend API calls can succeed.
- Keep backend environment variables in `Backend/.env`.
- Frontend API base URL should target your backend server.

## Existing Module READMEs

For deeper details:

- Backend: `Backend/README.md`
- Frontend: `Frontend/README.md`

## Frontend Deployment (Dokploy/Nixpacks)

If deployment fails with:

`@vitejs/plugin-react ... Expected "^20.19.0 || >=22.12.0". Got "18.x"`

set frontend runtime to Node 20+:

- App root: `Frontend`
- Node version: `20` (or newer)
- Re-deploy after updating settings
