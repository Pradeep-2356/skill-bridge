# API documentation

The full contract is in [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1). In development it is served as interactive Swagger UI at **<http://localhost:5000/api/docs>**.

All endpoints live under `/api/v1` and answer with one envelope:

```json
{ "success": true, "data": {}, "meta": { "page": 1, "limit": 12, "total": 48, "totalPages": 4 } }
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please fix the highlighted fields.",
    "fields": { "email": "Enter a valid email address" }
  }
}
```

## Sprint 1 endpoints (34)

| Method                | Path                                | Who            | Purpose                             | Stories                          |
| --------------------- | ----------------------------------- | -------------- | ----------------------------------- | -------------------------------- |
| GET                   | `/health`                           | Public         | API and database status             | —                                |
| POST                  | `/auth/register`                    | Guest          | Create account, sign in             | SB1/US1, 2, 8, 9, 14             |
| POST                  | `/auth/login`                       | Guest          | Sign in (optionally reactivate)     | SB1/US3, 32                      |
| POST                  | `/auth/refresh`                     | Refresh cookie | Rotate tokens                       | SB1/US10, 12                     |
| POST                  | `/auth/logout`                      | Anyone         | Revoke refresh token, clear cookies | SB1/US4                          |
| GET                   | `/auth/me`                          | User           | Current user                        | SB1/US10, 11, 13                 |
| POST                  | `/auth/forgot-password`             | Guest          | Email a reset link                  | SB1/US5                          |
| POST                  | `/auth/reset-password`              | Guest          | Set new password from link          | SB1/US6                          |
| PATCH                 | `/auth/password`                    | User           | Change password                     | SB1/US7                          |
| GET / PATCH / DELETE  | `/users/me`                         | User           | View, update, delete my account     | SB1/US16, 18, 19, 29, 30, 33, 34 |
| PUT / DELETE          | `/users/me/avatar`                  | User           | Upload / remove photo               | SB1/US17                         |
| GET                   | `/users/me/preview`                 | User           | My public profile                   | SB1/US31                         |
| POST                  | `/users/me/deactivate`              | User           | Deactivate my account               | SB1/US32                         |
| GET                   | `/users/:id`                        | User           | Another member's public profile     | SB1/US46                         |
| GET                   | `/categories`                       | User           | Active categories                   | SB1/US19                         |
| GET                   | `/skills`                           | User           | Catalogue lookup                    | SB1/US20–22                      |
| GET                   | `/users/me/skills`                  | User           | My teach + learn lists              | SB1/US36                         |
| POST / PATCH / DELETE | `/users/me/teach-skills[/:entryId]` | User           | Manage teaching skills              | SB1/US20, 21, 23–25              |
| POST / PATCH / DELETE | `/users/me/learn-skills[/:entryId]` | User           | Manage learning skills              | SB1/US22–24, 26                  |
| GET / PUT             | `/users/me/availability`            | User           | Weekly availability + time zone     | SB1/US27–29                      |
| GET                   | `/dashboard`                        | User           | Dashboard data in one call          | SB1/US35–38                      |
| GET                   | `/sessions`                         | User           | Upcoming / past sessions            | SB1/US37–39                      |
| GET                   | `/search/mentors`                   | User           | Keyword skill search                | SB1/US50                         |
| GET                   | `/admin/users`                      | Admin          | List and filter users               | SB1/US47                         |
| GET                   | `/admin/users/:id`                  | Admin          | User details                        | SB1/US49                         |
| PATCH                 | `/admin/users/:id/status`           | Admin          | Deactivate / reactivate             | SB1/US48                         |

## Sprint 2 endpoints (23 new, 1 extended)

All of these require a signed-in user. Ownership and roles are checked in the services, not only in the UI.

| Method | Path                           | Who                                     | Purpose                                                                                                              | Stories                 |
| ------ | ------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| GET    | `/search/mentors` (extended)   | User                                    | Mentor discovery: `q`, `category`, `proficiency`, `days`, `from`, `to`, `tzCompatible`, `sort`, `page`, `limit ≤ 50` | SB2/US1, 3–7, 32–41     |
| GET    | `/skills/suggest?q=`           | User                                    | Up to 8 approved skills with mentor counts                                                                           | SB2/US2, 41             |
| GET    | `/skills/:id/related`          | User                                    | Approved skills in the same category                                                                                 | SB2/US2                 |
| GET    | `/mentors/:id`                 | User                                    | Public profile + availability in both zones, shared time, exchange hints, open requests                              | SB2/US8–11, 30          |
| PATCH  | `/users/me/accepting-requests` | User                                    | Pause or resume new requests `{ acceptingRequests }`                                                                 | SB2/US43                |
| POST   | `/match-requests`              | User                                    | `{ mode: 'direct', mentorId, skillId, message? }` or `{ mode: 'auto', skillId }` → **202** queued                    | SB2/US12, 23, 24        |
| GET    | `/match-requests`              | User                                    | `box=incoming\|outgoing\|all`, `status=open\|pending\|accepted\|closed\|all`, `page`; `meta.counts` per tab          | SB2/US13, 26–28         |
| GET    | `/match-requests/:id`          | Learner, mentor (once delivered), admin | Detail with score, reasons, notes, proposed/booked time, history, allowed actions                                    | SB2/US25, 27, 30, 31    |
| PATCH  | `/match-requests/:id/accept`   | That mentor                             | pending → accepted; books a session → `{ request, session }`                                                         | SB2/US14, 31            |
| PATCH  | `/match-requests/:id/decline`  | That mentor                             | pending → declined, optional `{ reason }`                                                                            | SB2/US15                |
| PATCH  | `/match-requests/:id/cancel`   | That learner                            | queued/pending → cancelled                                                                                           | SB2/US16                |
| POST   | `/match-requests/:id/retry`    | That learner                            | failed/expired → queued → **202**                                                                                    | SB2/US45                |
| GET    | `/matches/suggestions`         | User                                    | Ranked mentors with score breakdown, reasons and notes, or `{ matches: [], reason }`                                 | SB2/US17–22, 42, 43, 46 |
| GET    | `/notifications`               | User                                    | History, `unread=true`, `page`; `meta.unreadCount`                                                                   | SB2/US29                |
| GET    | `/notifications/unread-count`  | User                                    | Badge count (polled every 30 s)                                                                                      | SB2/US29                |
| PATCH  | `/notifications/:id/read`      | Owner                                   | Mark one as read (404 for anyone else)                                                                               | SB2/US29                |
| POST   | `/notifications/read-all`      | User                                    | Mark all as read → `{ updated }`                                                                                     | SB2/US29                |
| GET    | `/admin/categories`            | Admin                                   | Categories with skill, pending and mentor counts                                                                     | SB2/US47                |
| POST   | `/admin/categories`            | Admin                                   | Create `{ name, description?, icon? }` → 201                                                                         | SB2/US47                |
| PATCH  | `/admin/categories/:id`        | Admin                                   | Rename, hide (`isActive`), reorder                                                                                   | SB2/US47                |
| DELETE | `/admin/categories/:id`        | Admin                                   | Only when no skills use it (else 409 `CATEGORY_IN_USE`) → 204                                                        | SB2/US47                |
| GET    | `/admin/skills?status=pending` | Admin                                   | Custom skills awaiting review with usage counts                                                                      | SB2/US47                |
| PATCH  | `/admin/skills/:id`            | Admin                                   | Approve, rename, re-categorise, set aliases                                                                          | SB2/US42, 47            |

**Request states (SB2/US25).** `queued → pending` and `queued → failed` (worker), `queued/pending → cancelled` (learner), `pending → accepted/declined` (mentor), `pending → expired` (7 days), `failed/expired → queued` (learner retry). Anything else returns **409 `INVALID_TRANSITION`**.

## Error codes

| Status    | Codes                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400       | `BAD_REQUEST`, `RESET_TOKEN_INVALID`, `CANNOT_DEACTIVATE_SELF`                                                                                            |
| 401       | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`                                                                                                 |
| 403       | `FORBIDDEN`, `ACCOUNT_DEACTIVATED` (with `details.canReactivate`), `CSRF_REJECTED`, `MENTOR_UNAVAILABLE`                                                  |
| 404       | `NOT_FOUND`                                                                                                                                               |
| 409       | `EMAIL_TAKEN`, `SKILL_ALREADY_ADDED`, `LAST_ADMIN`, `DUPLICATE_REQUEST` (with `details.requestId`), `INVALID_TRANSITION`, `CATEGORY_IN_USE`, `NAME_TAKEN` |
| 413 / 415 | `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`                                                                                                                 |
| 422       | `VALIDATION_ERROR` with `fields`, `SELF_REQUEST`, `SKILL_NOT_TAUGHT`, `MENTOR_NO_AVAILABILITY`                                                            |
| 500       | `INTERNAL_ERROR` (generic message only)                                                                                                                   |

## Trying it with curl

```bash
curl -c jar -H 'Content-Type: application/json' \
  -d '{"email":"priya@skillbridge.test","password":"Demo@1234"}' http://localhost:5000/api/v1/auth/login
curl -b jar "http://localhost:5000/api/v1/search/mentors?q=python"

# Sprint 2 (cookie-authenticated POST/PATCH need the Origin header – CSRF protection)
curl -b jar "http://localhost:5000/api/v1/search/mentors?q=react,%20vue&proficiency=advanced&days=0,1,2&from=18:00&to=21:00&tzCompatible=true&sort=relevance"
curl -b jar "http://localhost:5000/api/v1/skills/suggest?q=pyt"
curl -b jar "http://localhost:5000/api/v1/matches/suggestions"
curl -b jar -H 'Origin: http://localhost:5173' -H 'Content-Type: application/json' \
  -d '{"mode":"auto","skillId":"<skill id>"}' http://localhost:5000/api/v1/match-requests
curl -b jar "http://localhost:5000/api/v1/match-requests?box=outgoing&status=open"
curl -b jar "http://localhost:5000/api/v1/notifications/unread-count"
```
