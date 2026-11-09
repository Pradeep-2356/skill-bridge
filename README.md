# SkillBridge

**Peer-to-peer micro-learning.** SkillBridge connects people who want to teach a skill with people who want to learn it, through focused 30-minute one-on-one sessions.

This repository is the final-year B.Tech project, built **frontend-first with a real backend**: a polished React app on top of a working Express + MongoDB API with real authentication, authorization and data storage. Everything runs locally for free; no AWS account, credit card or paid service is needed.

> **Status:** Sprint 1 complete: 50/50 stories and 200/200 workbook tasks implemented and tested. See [`docs/sprints/sprint-1.md`](docs/sprints/sprint-1.md) and the [traceability matrix](docs/sprints/traceability-sprint-1.md). Sprint 2 (discovery and matching) starts after review.

---

## Features (Sprint 1)

| Area            | What you can do                                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts        | Register, log in, log out, stay signed in (silent token refresh), forgot/reset password by email, change password                                    |
| Profile         | Name, headline, bio, profile photo, learning interests, time zone; view your profile and preview it as others see it                                 |
| Skills          | Add, edit and remove skills you **teach** (with proficiency) and want to **learn** (with preferred level) from a 99-skill catalogue, or add your own |
| Availability    | Paint your weekly availability on a half-hour grid (mouse or keyboard), with presets and a time-zone picker                                          |
| Dashboard       | Profile-strength ring and checklist, your skills, upcoming sessions, recent activity, quick actions                                                  |
| Search          | Find active mentors by skill keyword (case-insensitive, aliases such as "js" → JavaScript)                                                           |
| Account control | Deactivate (and later reactivate) or permanently delete your account with confirmation                                                               |
| Admin           | List, search and filter users; view details; deactivate/reactivate accounts with a recorded reason                                                   |
| Quality         | Accessible forms, loading/empty/error states, toasts, responsive layout, HTTPS mode, security headers                                                |

## Technology

| Layer    | Stack                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Client   | React 19, Vite 8, React Router 8, Axios, Lucide icons, CSS Modules + design tokens, Inter (self-hosted)                       |
| Server   | Node.js, Express 5, Mongoose 9, Zod 4 (validation shared with the client), jsonwebtoken, bcryptjs, Helmet, Multer, Nodemailer |
| Database | MongoDB Community 8 (local)                                                                                                   |
| Tests    | Vitest 5, React Testing Library, MSW, Supertest, mongodb-memory-server, Playwright                                            |

## Project layout

```text
apps/client        React app (pages, features, components/ui design system)
apps/server        Express API (routes → controllers → services → models)
packages/shared    Constants + Zod schemas used by BOTH client and server
e2e/               Playwright end-to-end journeys
scripts/           setup, seed, reset-db, create-admin
docs/              architecture, api (OpenAPI), database, testing, sprints
```

More detail: [architecture](docs/architecture/README.md) · [API](docs/api/README.md) · [database](docs/database/README.md) · [testing](docs/testing/README.md).

---

## Getting started on macOS

### 1. Prerequisites (one time)

| Tool                                            | Install                                                                                              | Check                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Node.js **22.22 or newer** (24 LTS recommended) | [nodejs.org](https://nodejs.org) installer or `nvm install 24`                                       | `node -v`                                  |
| Git                                             | `xcode-select --install`                                                                             | `git --version`                            |
| Homebrew                                        | [brew.sh](https://brew.sh)                                                                           | `brew -v`                                  |
| MongoDB Community                               | `brew tap mongodb/brew` → `brew install mongodb-community` → `brew services start mongodb-community` | `mongosh --eval "db.runCommand({ping:1})"` |
| Mailpit (password-reset emails)                 | `brew install mailpit` → `brew services start mailpit`                                               | open <http://localhost:8025>               |
| mkcert (optional, local HTTPS)                  | `brew install mkcert` → `mkcert -install`                                                            |                                            |

### 2. Install and run

```bash
npm install          # installs all three workspaces
npm run setup        # creates .env with a random JWT secret (never overwrites an existing one)
npm run db:seed      # categories, 99 skills, demo users, demo sessions (safe to repeat)
npm run dev          # client http://localhost:5173 · API http://localhost:5000 · docs http://localhost:5000/api/docs
```

Open <http://localhost:5173> and log in with a demo account.

### 3. Demo accounts

All demo accounts use the password **`Demo@1234`** and the reserved `skillbridge.test` domain, which can never receive real email.

| Role        | Email                          | Use it to show                                                                   |
| ----------- | ------------------------------ | -------------------------------------------------------------------------------- |
| Admin       | `admin@skillbridge.test`       | User management                                                                  |
| Mentor      | `priya@skillbridge.test`       | Teaches React (expert), JavaScript and UI design; has demo sessions              |
| Learner     | `arjun@skillbridge.test`       | Wants React and public speaking; teaches Python, so he and Priya can swap skills |
| 25 more     | `<firstname>@skillbridge.test` | Members in 6 time zones and 12 categories (e.g. `oliver@`, `sofia@`, `lucas@`)   |
| Deactivated | `vikram@skillbridge.test`      | Blocked by an admin, never appears in search                                     |

### 4. Run front end and back end separately

```bash
npm run dev:server   # API only (restarts on change)
npm run dev:client   # client only – shows a "can't reach the server" message if the API is down
```

The Vite dev server proxies `/api` and `/uploads` to the API, so the browser sees one origin and the HTTP-only cookies work without extra CORS setup.

---

## Scripts

| Command                                                  | What it does                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`                                            | Client and API together with live reload                                                        |
| `npm run dev:https`                                      | Both over HTTPS (needs certificates, see below) with Secure cookies and HSTS                    |
| `npm run build`                                          | Production build of the client into `apps/client/dist`                                          |
| `npm start`                                              | API in production mode, also serving the built client on port 5000 – best for a demo            |
| `npm test`                                               | Shared + server unit, server integration, and client component tests                            |
| `npm run test:unit` / `test:integration` / `test:client` | One layer at a time                                                                             |
| `npm run test:e2e`                                       | Playwright journeys in Chromium, Firefox and WebKit                                             |
| `npm run test:coverage`                                  | Server and client coverage reports (`apps/*/coverage/index.html`)                               |
| `npm run lint` / `npm run format`                        | ESLint / Prettier                                                                               |
| `npm run db:seed`                                        | Add any missing demo data (never deletes)                                                       |
| `npm run db:reset`                                       | Wipe the development database and uploaded photos, then reseed (asks first; `-- --yes` to skip) |
| `npm run create-admin`                                   | Create another administrator from terminal prompts                                              |

## Testing

```bash
npm test                         # 231 unit, integration and component tests
npx playwright install           # once, downloads browsers
npm run test:e2e                 # 7 end-to-end tests (needs MongoDB running)
```

- Integration tests use **mongodb-memory-server**: a throwaway MongoDB is started automatically (it downloads a ~100 MB binary the first time) and your development data is never touched.
- End-to-end tests use a separate `skillbridge_e2e` database that is wiped and reseeded on every run.

Latest results and coverage: [`docs/testing/README.md`](docs/testing/README.md).

## Environment variables

`npm run setup` creates `.env` from [`.env.example`](.env.example). The important ones:

| Variable                                      | Default                                     | Purpose                                                                                         |
| --------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                 | `mongodb://127.0.0.1:27017/skillbridge_dev` | Development database                                                                            |
| `JWT_ACCESS_SECRET`                           | random (setup)                              | Signs access tokens; the server refuses to start if it is missing or shorter than 32 characters |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL_DAYS` | `15m` / `7`                                 | Token lifetimes                                                                                 |
| `CLIENT_ORIGIN`                               | `http://localhost:5173`                     | The only origin CORS allows                                                                     |
| `MAIL_TRANSPORT`                              | `smtp`                                      | `smtp` (Mailpit), `console` or `memory`                                                         |
| `UPLOAD_DIR` / `MAX_AVATAR_MB`                | `apps/server/uploads` / `2`                 | Profile photo storage                                                                           |

## Local HTTPS (optional)

```bash
mkdir -p certs && mkcert -key-file certs/localhost-key.pem -cert-file certs/localhost.pem localhost 127.0.0.1
npm run dev:https    # https://localhost:5173
```

## Resetting the database

```bash
npm run db:reset     # type "reset" to confirm
```

## Troubleshooting

| Symptom                                                     | Fix                                                                         |
| ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Could not connect to MongoDB at mongodb://127.0.0.1:27017` | Start it: `brew services start mongodb-community`                           |
| `Invalid server configuration: JWT_ACCESS_SECRET…`          | Run `npm run setup`                                                         |
| Port 5000 or 5173 already in use                            | `lsof -i :5000` and stop that process, or change `PORT`                     |
| No reset email in Mailpit                                   | Mailpit isn't running; the link is printed in the API terminal instead      |
| Logged out immediately after logging in                     | Use `http://localhost:5173`, not `127.0.0.1` – mixing the two drops cookies |
| First integration test run is slow                          | mongodb-memory-server is downloading MongoDB once                           |
| Playwright says browsers are missing                        | `npx playwright install`                                                    |
| `npm install` fails with an engine error                    | Upgrade Node.js to 22.22 or newer                                           |

## What is real, simplified and deferred

Everything in Sprint 1 is real and stored in MongoDB. Two parts are simplified on purpose: emails go to a local inbox (Mailpit), and photos are stored on local disk behind an adapter. Sessions shown in Sprint 1 come from the seed script and carry a **Demo** badge; real sessions are created by matching in Sprint 2. AWS (S3, SES, SQS, Lambda), Redis, WebSockets and WebRTC are deferred to next semester. Details: [architecture → future cloud integration](docs/architecture/README.md#future-cloud-integration).
