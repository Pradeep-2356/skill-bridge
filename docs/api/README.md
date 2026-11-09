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

## Error codes

| Status    | Codes                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| 400       | `BAD_REQUEST`, `RESET_TOKEN_INVALID`, `CANNOT_DEACTIVATE_SELF`                     |
| 401       | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`                          |
| 403       | `FORBIDDEN`, `ACCOUNT_DEACTIVATED` (with `details.canReactivate`), `CSRF_REJECTED` |
| 404       | `NOT_FOUND`                                                                        |
| 409       | `EMAIL_TAKEN`, `SKILL_ALREADY_ADDED`, `LAST_ADMIN`                                 |
| 413 / 415 | `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`                                          |
| 422       | `VALIDATION_ERROR` with `fields`                                                   |
| 500       | `INTERNAL_ERROR` (generic message only)                                            |

## Trying it with curl

```bash
curl -c jar -H 'Content-Type: application/json' \
  -d '{"email":"priya@skillbridge.test","password":"Demo@1234"}' http://localhost:5000/api/v1/auth/login
curl -b jar "http://localhost:5000/api/v1/search/mentors?q=python"
```
