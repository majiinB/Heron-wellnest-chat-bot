# Heron Wellnest Activities API

A lightweight activities microservice for the Heron Wellnest platform. This service provides endpoints for journals, gratitude jar entries, mood check-ins, flipfeel questionnaires, and user badges/rewards.

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

## ✨ Features

- CRUD for journal entries and gratitude jar entries
- Mood check-in recording and retrieval
- Flipfeel questionnaire flow (questions, choices, responses)
- Badge management and user badge awarding
- Role-protected endpoints (student) using JWT-based middleware
- Type-safe codebase with TypeScript and TypeORM

## 🛠 Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: TypeORM
- **Auth**: JWT-based middleware (service uses `heronAuth.middleware`)
- **Testing**: Jest
- **Linting**: ESLint
- **Containerization**: Docker
- **Cloud Platform**: Google Cloud Run
- **CI/CD**: GitHub Actions

## 🏗 Architecture

The service follows a simple layered architecture:

- Controllers — HTTP handlers and response shaping
- Services — business logic and orchestration
- Repositories — TypeORM data access
- Models — TypeORM entities

Example flow: a request to award a badge -> controller validates and authorizes -> service checks conditions -> repository writes UserBadge -> controller returns ApiResponse.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker (optional)
- PostgreSQL database

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd activities-api
```

2. Install dependencies

```bash
npm install
```

3. Create `.env` in the project root (see Environment Variables below)

4. Run database migrations (if you use migrations)

```bash
npm run migration:run
```

5. Start the development server

```bash
npm run dev
```

The API will be available at `http://localhost:8080` by default.

### Docker (optional)

Build and run locally:

```bash
docker build -t hw-activities-api .
docker run -p 8080:8080 --env-file .env hw-activities-api
```

## 📡 API Endpoints

### Health

- `GET /health` — basic health check

### Journals

- `GET /journals` — list journal entries
- `POST /journals` — create a journal entry

### Gratitude Jar

- `GET /gratitude` — list gratitude entries
- `POST /gratitude` — create a gratitude entry

### Mood Check-ins

- `GET /mood-checks` — list mood check-ins
- `POST /mood-checks` — record a mood check-in

### Flipfeel

- `GET /flipfeel/questions` — list flipfeel questions
- `POST /flipfeel/responses` — submit a response

### Badges

- `GET /badges` — list user badges (awarded)
- `GET /badges/all-obtainable` — list all badges and whether the user has obtained them

Example response shape for `/badges/all-obtainable`:

```json
{
	"success": true,
	"code": "ALL_OBTAINABLE_BADGES_RETRIEVED",
	"message": "All obtainable badges retrieved successfully",
	"data": {
		"badges": [
			{
				"badge": {
					"badge_id": "uuid",
					"name": "New Beginnings",
					"description": "You’ve written your first journal.",
					"icon_url": null,
					"awarded_at": "1970-01-01T00:00:00.000Z"
				},
				"is_obtained": false
			}
		],
		"total": 1
	}
}
```

## 🔧 Environment Variables

Required variables (check `src/config/env.config.ts` for exact names and validation):

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Application environment | `development` |
| `PORT` | Server port | `8080` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | `password` |
| `DB_NAME` | Database name | `activities` |
| `JWT_SECRET` | JWT signing secret used by `heronAuth` middleware | `your-jwt-secret` |
| `JWT_ISSUER` | Service that issues the jwt tokens | `issuer-service-api` |
| `JWT_AUDIENCE` | Audience of the jwt token | `service-user` |
| `JWT_ALGORITHM` | Algorithm used to encrypt the token | `algorithm` |
| `CONTENT_ENCRYPTION_KEY` | Encryption key used to encrypt and decrypt user journal entries | `encryption-key` |
| `CONTENT_ENCRYPTION_ALGORITHM` | Encryption algorithm | `algorithm` |

Store production secrets in your platform's secret manager.

## 🧪 Testing

Run tests (Jest):

```bash
npm test
```

Run linter (ESLint):

```bash
npm run lint
npm run lint:fix
```

## 📦 Deployment

### GitHub Actions CI/CD

The repo can be configured with GitHub Actions to build, test, and deploy to Google Cloud Run. Typical flow:

- `staging` branch — run tests and deploy to staging
- `main` branch — run tests and deploy to production

### Manual deploy to Cloud Run

1. Build and push container image

```bash
docker build -t <region>-docker.pkg.dev/<project-id>/<repo>/<service>:latest .
docker push <region>-docker.pkg.dev/<project-id>/<repo>/<service>:latest
```

2. Deploy

```bash
gcloud run deploy activities-api \
	--image <region>-docker.pkg.dev/<project-id>/<repo>/<service>:latest \
	--region <region> \
	--platform managed \
	--allow-unauthenticated
```

## 📁 Project Structure

```
activities-api/
├── src/
│   ├── config/
│   │   ├── cors.config.ts
│   │   ├── datasource.config.ts
│   │   ├── env.config.ts
|   |   └── pubsub.config.ts
│   ├── controllers/
|   |   ├── flipfeel.controller.ts
│   │   ├── gratitudeJar.controller.ts
│   │   ├── journal.controller.ts
│   │   ├── moodCheckIn.controller.ts
│   │   └── userBadge.controller.ts
|   ├── interface/
|   |   └── authRequest.interface.ts 
│   ├── models/
|   |   ├── badge.model.ts
|   |   ├── flipFeel.model.ts
|   |   ├── flipFeelChoices.model.ts
|   |   ├── flipFeelQuestions.model.ts
|   |   ├── flipFeelResponse.modelt.ts|
|   |   ├── gratitudeEntry.model.ts
│   │   ├── journalEntry.model.ts
│   │   ├── moodCheckIn.model.ts
│   │   └── userBadge.model.ts
│   ├── repository/
|   |   ├── flipFeel.repository.ts
|   |   ├── flipFeelChoices.repository.ts
|   |   ├── flipFeelQuestions.repository.ts
|   |   ├── flipFeelResponse.repository.ts|
|   |   ├── gratitudeEntry.repository.ts
│   │   ├── journalEntry.repository.ts
│   │   ├── moodCheckIn.repository.ts
│   │   └── userBadge.repository.ts
│   ├── routes/
|   |   ├── flipfeel.route.ts
|   |   ├── gratitudeJar.routes.ts
│   │   ├── journal.routes.ts
|   |   ├── moodCheckIn.route.ts
│   │   └── userBadge.route.ts
│   ├── services/
|   |   ├── flipfeel.service.ts
|   |   ├── gratitudeJar.service.ts
│   │   ├── journal.service.ts
|   |   ├── moodCheckIn.service.ts
│   │   └── userBadge.service.ts
│   ├── middlewares/
|   |   ├── erro.middleware.ts
│   │   ├── heronAuth.middleware.ts
|   |   └── logger.middleware.ts
│   ├── utils/
|   |   ├── asyncHandler.util.ts
|   |   ├── authorization.util.ts
|   |   ├── crypto.util.ts
|   |   ├── gratitudeJar.utils.ts
|   |   ├── journal.util.ts
|   |   ├── jwt.util.ts
|   |   ├── logger.util.ts
|   |   ├── mood.util.ts
|   |   └── pubsub.util.ts
│   └── app.ts
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## 👨‍💻 Development

### Code Style

The project uses ESLint for linting. Run:

```bash
# Run linter
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 📄 License

This project is proprietary software developed for the Heron Wellnest platform.

## 👥 Authors

- **Arthur M. Artugue** - Lead Developer

## 🤝 Contributing

This is a private project. Please contact the project maintainers for contribution guidelines.

## 📞 Support

For issues and questions, please contact the development team.

---

**Last Updated**: 2025-11-08
