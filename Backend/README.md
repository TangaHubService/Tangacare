# Tangacare Backend API

A comprehensive TypeScript backend for a telemedicine platform built with Express.js, TypeORM, and PostgreSQL.

## 🚀 Features

- **Complete REST API** with 8 resource modules
- **TypeORM** for database management with PostgreSQL
- **JWT Authentication** with access and refresh tokens
- **Role-based Authorization** (Patient, Doctor, Admin)
- **Swagger Documentation** - Interactive API docs at `/api-docs`
- **Request Validation** using class-validator
- **Error Handling** with custom error classes
- **Logging** with Winston
- **Security** with Helmet, CORS, and rate limiting
- **Docker Support** for easy local development

## 📋 Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.22.0
- PostgreSQL >= 13 (or use Docker)
- Docker & Docker Compose (optional)

## 🛠️ Installation

### 1. Clone the repository

```bash
cd tangacare-backend
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and configure your database credentials and JWT secrets:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=tangacare
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
```

### 4. Start PostgreSQL (using Docker)

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on `localhost:5432`
- pgAdmin on `localhost:5050` (admin@tangacare.com / admin)

### 5. Run database migrations

```bash
yarn migration:run
```

### 6. Start the development server

```bash
yarn dev
```

The server will start on `http://localhost:3000`

## 📚 API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI JSON**: http://localhost:3000/api-docs.json
- **Health Check**: http://localhost:3000/health

## 🧾 Paypack Subscription Testing (Manual)

### 1. Configure environment variables
Ensure these are set in your backend `.env`:
- `PAYPACK_CLIENT_ID`
- `PAYPACK_CLIENT_SECRET`
- `PAYPACK_WEBHOOK_SIGN_KEY`
- `PAYPACK_WEBHOOK_MODE` (`development` for sandbox testing)

### 2. Start the server
```bash
yarn dev
```

### 3. Start a trial subscription
Using an authenticated `OWNER` user, call:
- `POST /api/subscriptions/start`

Body example:
```json
{
  "plan_code": "starter",
  "phone_number": "+250788000000",
  "payment_method_preference": "mtn_momo"
}
```

Expected: `Subscription trial started` and `status: "trialing"`.

### 4. Trigger billing attempts (scheduler)
The scheduler runs every 15 minutes. For testing:
- set `subscriptions.next_billing_at` to a past timestamp
- ensure there is no `subscription_payments` row for that subscription with `status: "pending"`

Expected: `subscription_payments` row created with:
- `gateway: "paypack"`
- `gateway_ref` populated

### 5. Verify Paypack webhook signature + idempotency
Paypack sends `transaction:processed` webhooks to:
- `POST /api/subscriptions/paypack/webhook`

Verify:
- webhook includes `X-Paypack-Signature`
- resending the same event does not duplicate updates (dedupe by `event_id`)

Expected DB transitions:
- `successful` -> subscription becomes `active`, org `subscription_status` becomes `active`
- `failed` -> subscription becomes `past_due` (or `expired` after max attempts), org `subscription_status` becomes `suspended`

To generate shareable artifacts (OpenAPI + Postman) without running the server:

```bash
yarn docs:generate
```

## 🗂️ Project Structure

```
tangacare-backend/
├── src/
│   ├── config/          # Database and Swagger configuration
│   ├── entities/        # TypeORM entities (7 tables)
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── routes/          # API routes
│   ├── middleware/      # Auth, validation, error handling
│   ├── dto/             # Data Transfer Objects
│   ├── utils/           # Helper functions
│   └── app.ts           # Application entry point
├── docker-compose.yml   # Docker configuration
├── package.json
├── tsconfig.json
└── .env.example
```

## 🔐 Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Register a new user

```bash
POST /api/auth/register
Content-Type: application/json

{
  "phone_number": "+250788123456",
  "email": "user@example.com",
  "password": "SecurePass123",
  "first_name": "John",
  "last_name": "Doe"
}
```

### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "+250788123456",
  "password": "SecurePass123"
}
```

## 📦 Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn migration:generate` - Generate new migration
- `yarn migration:run` - Run pending migrations
- `yarn migration:revert` - Revert last migration
- `yarn format` - Format code with Prettier


## 🗄️ Database Schema

The application includes 7 main entities:

1. **Users** - Patient and user accounts
2. **Doctors** - Doctor profiles with specializations
3. **Appointments** - Consultation scheduling
4. **Prescriptions** - Medical prescriptions
5. **Payments** - Payment transactions
6. **HealthRecords** - Patient medical history
7. **HealthTips** - Health education content

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/verify-otp` - Verify OTP
- `GET /api/auth/me` - Get current user profile

### Doctors
- `GET /api/doctors` - List all doctors (with filters)
- `GET /api/doctors/:id` - Get doctor details
- `POST /api/doctors` - Create doctor profile (admin)
- `PUT /api/doctors/:id` - Update doctor profile
- `GET /api/doctors/specializations` - List specializations

### Appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments` - List appointments
- `GET /api/appointments/:id` - Get appointment details
- `PUT /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment
- `GET /api/appointments/availability` - Check availability

### Prescriptions
- `POST /api/prescriptions` - Create prescription
- `GET /api/prescriptions` - List prescriptions
- `GET /api/prescriptions/:id` - Get prescription details
- `GET /api/prescriptions/:id/download` - Download PDF

### Payments
- `POST /api/payments/initiate` - Initiate payment
- `POST /api/payments/webhook` - Payment webhook
- `GET /api/payments/:id` - Get payment details
- `GET /api/payments` - List payments

### Health Records
- `POST /api/health-records` - Add health record
- `GET /api/health-records` - List health records
- `GET /api/health-records/:id` - Get record details
- `PUT /api/health-records/:id` - Update record
- `DELETE /api/health-records/:id` - Delete record

### Health Tips
- `GET /api/health-tips` - List published tips
- `GET /api/health-tips/:id` - Get tip details
- `POST /api/health-tips` - Create tip (admin)
- `PUT /api/health-tips/:id` - Update tip
- `DELETE /api/health-tips/:id` - Delete tip

## 🧪 Testing with Postman

A Postman collection is available in the repository. Import it to test all endpoints:

1. Import `Tangacare.postman_collection.json`
2. Set environment variables:
   - `base_url`: http://localhost:3000
   - `access_token`: (obtained after login)

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Prevent abuse
- **JWT** - Secure authentication
- **Password Hashing** - bcrypt with salt rounds
- **Input Validation** - class-validator
- **SQL Injection Protection** - TypeORM parameterized queries

## 🚢 Deployment

### Production Build

```bash
yarn build
yarn start
```

### Environment Variables for Production

Ensure you set these in production:

```env
NODE_ENV=production
DB_SYNCHRONIZE=false
JWT_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<strong-refresh-secret>
```

## 🐳 Docker

### Quick Start with Docker Compose

The easiest way to run the entire application stack:

```bash
# Start all services (PostgreSQL, pgAdmin, and the app)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop all services
docker-compose down
```

This will start:
- **Backend API** on `http://localhost:3000`
- **PostgreSQL** on `localhost:5432`
- **pgAdmin** on `http://localhost:5050`

### Development with Docker

```bash
# Build and start in development mode (with hot-reload)
docker-compose up --build

# Run migrations inside container
docker-compose exec app yarn migration:run

# Access container shell
docker-compose exec app sh

# View application logs
docker-compose logs -f app
```

### Production Docker Build

```bash
# Build production image
docker build -t tangacare-backend:latest .

# Run production container
docker run -d \
  --name tangacare-backend \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e DB_PASSWORD=your-db-password \
  -e JWT_SECRET=your-jwt-secret \
  tangacare-backend:latest
```

### Environment Variables in Docker

All environment variables can be configured via:
1. `.env` file (automatically loaded by docker-compose)
2. Environment variables in `docker-compose.yml`
3. `-e` flags when using `docker run`

See [.env.example](.env.example) for all available variables.

## 🔄 CI/CD with GitHub Actions

This project includes automated CI/CD workflows:

### Continuous Integration (CI)

Automatically runs on every push and pull request:

- ✅ Type checking with TypeScript
- ✅ Unit and integration tests
- ✅ Code coverage reporting
- ✅ Build verification

### Docker Image Build

Automatically builds and pushes Docker images to GitHub Container Registry:
- 🐳 Multi-platform builds (AMD64, ARM64)
- 🏷️ Semantic versioning with Git tags
- 🔒 Vulnerability scanning with Trivy
- 📦 Published to `ghcr.io`

### Deployment

Automated deployment workflow with support for:
- AWS ECS
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform
- SSH deployment to VPS/VM

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### GitHub Secrets Required

Configure these in your repository settings for CI/CD:

**Required for Production:**
```
DB_HOST, DB_PASSWORD, DB_USERNAME, DB_DATABASE
JWT_SECRET, JWT_REFRESH_SECRET
CORS_ORIGIN
DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY (for SSH deployment)
```

**Optional for CI Testing:**
```
TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USERNAME, TEST_DB_PASSWORD, TEST_DB_DATABASE
```
(If not set, CI uses default localhost PostgreSQL values)

## 📝 License

MIT

## 👥 Support

For support, email support@tangacare.com or open an issue in the repository.

---

Built with ❤️ by the Tangacare Team
