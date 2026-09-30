# talkshift

Work shift management application.

This is an npm workspaces monorepo with an Express API, a React web app, and a shared package for code used by both.

## Tech stack

| Area     | Tools                                                                  |
| -------- | ---------------------------------------------------------------------- |
| API      | Node.js, Express 5, TypeScript, Prisma (PostgreSQL), helmet, cors      |
| Web      | React 19, Vite, Tailwind CSS 4, React Router, TanStack Query, React Hook Form |
| Shared   | Zod schemas                                                            |
| Database | PostgreSQL 17 (via Docker Compose)                                     |
| Testing  | Vitest, Supertest                                                      |

## Project structure

```
talkshift/
├── apps/
│   ├── api/              # Express REST API (port 3000)
│   │   ├── prisma/       # Prisma schema (and migrations)
│   │   └── src/          # API source; entry point is src/index.ts
│   └── web/              # React + Vite frontend (port 5173)
│       └── src/
├── packages/
│   └── shared/           # Zod validation schemas shared by api and web
├── docker-compose.yml    # Local PostgreSQL
└── package.json          # Workspace root and dev scripts
```

## Prerequisites

- Node.js 24 or later
- npm
- Docker (for the local PostgreSQL database)

## Getting started

1. **Install dependencies** from the repo root:

   ```bash
   npm install
   ```

2. **Start the database:**

   ```bash
   npm run db:up
   ```

   This starts PostgreSQL on `localhost:5432` with user, password, and database all set to `talkshift`.

3. **Configure the API environment.** Copy the example file and fill it in:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

   ```env
   DATABASE_URL="postgresql://talkshift:talkshift@localhost:5432/talkshift"
   PORT=3000
   ```

4. **Set up the database schema** and generate the Prisma client:

   ```bash
   cd apps/api
   npx prisma migrate dev
   npx prisma generate
   cd ../..
   ```

5. **Run the app:**

   ```bash
   npm run dev
   ```

   This starts both apps together:

   - Web: http://localhost:5173
   - API: http://localhost:3000

6. **Check that the API is up:**

   ```bash
   curl http://localhost:3000/api/health
   # {"ok":true}
   ```

The Vite dev server proxies `/api` requests to the API, so the frontend can call `/api/...` directly.

## Scripts

Run these from the repo root:

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start the API and web app together          |
| `npm run db:up`   | Start the PostgreSQL container              |
| `npm run db:down` | Stop the PostgreSQL container               |

Per-workspace scripts can be run with `-w`, for example `npm run test -w apps/api`.

**API (`apps/api`)**

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Start the API with auto-reload (tsx) |
| `npm run build` | Compile TypeScript to `dist/`        |
| `npm run start` | Run the compiled build               |
| `npm run test`  | Run tests with Vitest                |

**Web (`apps/web`)**

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start the Vite dev server           |
| `npm run build`   | Type-check and build for production |
| `npm run lint`    | Run ESLint                          |
| `npm run preview` | Preview the production build        |

## API endpoints

| Method | Path          | Description  |
| ------ | ------------- | ------------ |
| GET    | `/api/health` | Health check |

## Data model

The Prisma schema is in [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma).

- **Staff**: name, email, role, employment type, target days per week, and active status.
  - Roles: `STAFF`, `STORE_MANAGER`, `ASSISTANT_STORE_MANAGER`
  - Employment types: `FULL_TIME`, `PART_TIME`
- **LoginToken**: single-use, expiring tokens for passwordless login (stored as hashes).
- **Session**: expiring login sessions (stored as hashes).

## Environment variables

**API (`apps/api/.env`)**

| Variable       | Description                          | Default |
| -------------- | ------------------------------------ | ------- |
| `DATABASE_URL` | PostgreSQL connection string         | none    |
| `PORT`         | Port the API listens on              | `3000`  |
