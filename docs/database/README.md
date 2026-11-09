# Database

MongoDB Community, accessed through Mongoose 9. Database names: `skillbridge_dev` (development), `skillbridge_e2e` (Playwright), and a random throwaway database per integration-test file. All dates are stored in UTC. Weekly availability is stored as local clock times plus the user's IANA time zone.

```mermaid
erDiagram
  USERS ||--o{ REFRESHTOKENS : "has"
  USERS ||--o{ PASSWORDRESETS : "has"
  USERS }o--o{ CATEGORIES : "learningInterests"
  USERS }o--o{ SKILLS : "teachSkills / learnSkills"
  SKILLS }o--|| CATEGORIES : "belongs to"
  SESSIONS }o--|| SKILLS : "about"
  SESSIONS }o--o| USERS : "learner"
  SESSIONS }o--o| USERS : "mentor"
```

## `users`

| Field                                   | Type                                                                       | Rules                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `email`                                 | String                                                                     | required, unique, lower-case, trimmed, ≤ 254                                                                |
| `passwordHash`                          | String                                                                     | bcrypt; `select: false` – never returned                                                                    |
| `role`                                  | `user` \| `admin`                                                          | default `user`; admins only via `npm run create-admin` / seed                                               |
| `status`                                | `active` \| `deactivated`                                                  | default `active`                                                                                            |
| `deactivation`                          | `{ by: self\|admin, reason, byUser, at }` \| null                          | reason ≤ 300                                                                                                |
| `name`                                  | String                                                                     | required, 2–80                                                                                              |
| `headline`                              | String                                                                     | ≤ 120                                                                                                       |
| `bio`                                   | String                                                                     | ≤ 1000                                                                                                      |
| `avatar`                                | `{ key, url, updatedAt }` \| null                                          | set by the storage adapter                                                                                  |
| `timezone`                              | String                                                                     | IANA zone, validated with `Intl`                                                                            |
| `learningInterests`                     | [ObjectId → categories]                                                    | ≤ 10, unique                                                                                                |
| `teachSkills`                           | [{ `skill`, `proficiency`, `yearsExperience`, `description`, timestamps }] | ≤ 20, one entry per skill; proficiency beginner/intermediate/advanced/expert; years 0–50; description ≤ 300 |
| `learnSkills`                           | [{ `skill`, `preferredLevel`, `goal`, timestamps }]                        | ≤ 20, one per skill; level beginner/intermediate/advanced; goal ≤ 300                                       |
| `availability`                          | [{ `day` 0–6, `start`, `end` }]                                            | ≤ 21; `HH:mm` on 30-minute steps; `end` may be `24:00`; no overlaps (checked by the shared schema)          |
| `tokenVersion`                          | Number                                                                     | bumped on password change/reset                                                                             |
| `lastLoginAt`, `createdAt`, `updatedAt` | Date                                                                       |                                                                                                             |

**Indexes:** `{ email: 1 }` unique · `{ 'teachSkills.skill': 1, status: 1 }` (mentor search) · `{ status: 1, createdAt: -1 }` (admin list).

## `categories`

`name` (unique, 2–50) · `slug` (unique) · `description` (≤ 200) · `icon` (Lucide icon name) · `isActive` · `order`. 12 seeded.

## `skills`

| Field            | Rules                                                                               |
| ---------------- | ----------------------------------------------------------------------------------- |
| `name`           | 1–60 (catalogue may have "C"; users must type ≥ 2)                                  |
| `normalizedName` | unique; NFKC, lower-case, trimmed, single spaces – set automatically                |
| `aliases`        | normalised alternative names, e.g. `js`, `reactjs`                                  |
| `category`       | ObjectId → categories, required                                                     |
| `description`    | ≤ 300                                                                               |
| `status`         | `approved` (catalogue) or `pending` (typed by a user, for admin review in Sprint 2) |
| `createdBy`      | ObjectId → users, null for catalogue entries and after the creator is deleted       |

**Indexes:** `{ normalizedName: 1 }` unique · `{ aliases: 1 }` · `{ category: 1, status: 1 }`. 99 seeded.

## `refreshtokens`

`user` · `tokenHash` (SHA-256, unique) · `family` (one per login) · `expiresAt` · `revokedAt` · `replacedByHash` · `userAgent`. **TTL index** on `expiresAt` deletes expired rows automatically.

## `passwordresets`

`user` · `tokenHash` (unique) · `expiresAt` (30 minutes) · `usedAt`. A new request deletes older rows; TTL index on `expiresAt`.

## `sessions`

`learner`, `mentor` (ObjectId → users, null after account deletion; must differ) · `skill` · `startsAt` (UTC) · `durationMinutes` (30) · `status` scheduled/completed/cancelled · `source` demo/match · `matchRequest` (Sprint 2). **Indexes:** `{ learner: 1, startsAt: 1 }`, `{ mentor: 1, startsAt: 1 }`. Seven demo rows are seeded.

## Data lifecycle

- **Deactivate** keeps all data; the account is hidden and cannot log in.
- **Delete** removes the user, their refresh/reset tokens and photo file; sessions keep the other participant and show "a former member"; custom skills stay in the catalogue with `createdBy: null`.
- **Seeding** is idempotent: `npm run db:seed` only inserts what is missing.
