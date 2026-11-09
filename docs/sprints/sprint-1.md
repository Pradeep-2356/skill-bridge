# Sprint 1 – Foundation, identity and profiles

**Objective:** a professional, working foundation. Members can create secure accounts, build a teaching and learning profile with availability, see a personalised dashboard and find mentors by keyword. Administrators can manage accounts. Everything is backed by a real API and MongoDB.

**Scope:** `SprintBacklog 1` of the workbook, SB1/US1–US50 with tasks T1–T4 each (200 tasks). Full per-story and per-task evidence: [traceability-sprint-1.md](traceability-sprint-1.md).

**Outcome:** 50/50 stories _Implemented – Frontend and Backend_, 200/200 tasks completed, 238 automated tests passing (recorded 9 Nov 2026).

## Stories by area

| Area                     | Stories              | Task IDs         | What was built                                                                                                                          |
| ------------------------ | -------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Registration             | US1, 2, 8, 9, 14, 15 | SB1/US1/T1–T4 …  | Landing page, split-screen auth layout, register form with live password checklist, shared validation, duplicate-email handling, bcrypt |
| Login and tokens         | US3, 4, 10–13        | SB1/US3/T1–T4 …  | Login with reactivation, logout, HTTP-only JWT + rotating refresh cookies, silent refresh, protected routes on both sides               |
| Password recovery        | US5–7                | SB1/US5/T1–T4 …  | Forgot/reset with single-use hashed tokens and Mailpit emails; change password that signs out other devices                             |
| Profile                  | US16–19, 30, 31, 46  | SB1/US16/T1–T4 … | Edit profile, photo upload, bio, interests, my profile, preview-as-others, public profiles with a single public projection              |
| Skills                   | US20–26              | SB1/US20/T1–T4 … | 99-skill catalogue with aliases, autocomplete picker, custom (pending) skills, teach/learn lists with levels                            |
| Availability             | US27–29              | SB1/US27/T1–T4 … | Keyboard-accessible half-hour week grid, presets, weekly bars, IANA time-zone picker                                                    |
| Account lifecycle        | US32–34              | SB1/US32/T1–T4 … | Deactivate (self-reactivation on login), permanent delete with password + typed DELETE                                                  |
| Dashboard and navigation | US35–39              | SB1/US35/T1–T4 … | Greeting, profile-strength ring + checklist, stats, skills, upcoming sessions, recent activity, quick actions; sidebar/top bar/drawer   |
| Platform UX              | US40–45              | SB1/US40/T1–T4 … | Responsive design system, field-level + summary validation, consistent errors, loading states, HTTPS mode                               |
| Admin                    | US47–49              | SB1/US47/T1–T4 … | User list with search/filters/totals, user detail, deactivate/reactivate with reason                                                    |
| Search                   | US50                 | SB1/US50/T1–T4   | Keyword mentor search with matched-skill chips, pagination and empty states                                                             |

## Technical decisions (from Stage 2–3, applied)

| Decision                                                            | Why                                                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| npm workspaces + `packages/shared`                                  | Client and server enforce identical validation and messages (US8, US41)                                             |
| HTTP-only cookies, 15-min access JWT + 7-day rotating refresh token | Tokens are unreadable by scripts; short expiry (US12) without frequent logins (US10); real server-side logout (US4) |
| `tokenVersion` on users                                             | Password change/reset invalidates old access tokens immediately                                                     |
| One `toPublicProfile()` serializer                                  | Private data cannot leak by accident (US31, US46)                                                                   |
| Skill catalogue with normalised names and aliases                   | Clean data for Sprint 2 text search and filters; no migration needed                                                |
| Embedded skills and availability in `users`                         | One read builds a full profile                                                                                      |
| Adapters for mail and file storage                                  | SES and S3 can replace them next semester without touching services                                                 |
| CSS Modules + design tokens                                         | No extra dependency; consistent look (US44); easy to explain                                                        |

## Changes made during implementation

- **Playwright pinned to 1.63.0** (the proposal said 1.65) to match the browser build available here. It works the same on a Mac.
- **Feature API calls collected in one file** (`apps/client/src/features/api.js`) instead of one `api.js` per feature. The folder layout is otherwise as proposed.
- **The skill catalogue model allows one-letter names** such as "C". User-typed skills still need at least two characters.
- **Password confirmation is now a required field.** An empty confirmation used to pass, because two empty strings "match".

## Database changes

New collections: `users`, `categories`, `skills`, `refreshtokens`, `passwordresets`, `sessions`, with the indexes listed in [database/README.md](../database/README.md). Seed: 12 categories, 99 skills, 29 users (1 admin, 27 active members, 1 deactivated), 7 demo sessions.

## APIs

34 endpoints under `/api/v1` – see [api/README.md](../api/README.md) and the OpenAPI file (Swagger UI at `/api/docs`).

## Tests and results

238 automated tests passed in the recorded run: 36 shared, 44 server unit, 99 server integration, 52 client component and 7 end-to-end (Chromium). Coverage: server 86% of lines (97.7% for services and utilities), client 82%. Details: [testing/README.md](../testing/README.md).

## Demo walkthrough (about 10 minutes)

1. **Landing → Register.** Submit the empty form to show the error summary and field messages. Type a weak password to show the checklist turning green. Then create an account.
2. **Dashboard (new user).** Point out the 0% profile ring and the checklist links.
3. **Edit profile.** Add a headline, bio, photo and interests, then save. Show **Preview as others see it**: no email is visible.
4. **Skills.** Search the catalogue ("gui" → Guitar), pick a level and save. Add a custom skill to show the "awaiting admin review" badge.
5. **Availability.** Apply the "Weekday evenings" preset, then drag across the grid. Switch the time zone and save.
6. **Search.** Search "react": Priya and Ethan appear, but Vikram (deactivated) does not. Open Priya's profile.
7. **Log out, then log in as `priya@skillbridge.test`.** Show the populated dashboard: upcoming and past sessions marked Demo, skills, and the stat cards.
8. **Forgot password.** Request a link for `grace@skillbridge.test`, open Mailpit at localhost:8025, reset the password, and log in.
9. **Log in as `admin@skillbridge.test`.**
   - Open **Manage users** and filter by "Deactivated" to show Vikram.
   - Open Jacob and deactivate him (the form insists on a reason).
   - In a private window, show Jacob being blocked at login.
   - Reactivate Jacob.
10. **Phone width.** Narrow the browser window to show the slide-out menu.

## Limitations (known and intentional)

- Sessions are seeded demo data. Requesting, accepting and booking sessions arrive in Sprint 2 (matching) and Sprint 3 (booking).
- Search is basic keyword matching. A MongoDB text index, filters, relevance ranking and suggestions are Sprint 2 (SB2/US1–7, 32–41).
- Custom skills are saved as `pending`. The admin review screen is SB2/US47.
- Email is delivered only to the local Mailpit inbox (console fallback). Photos are stored on local disk.
- HTTPS uses a local certificate. A public certificate comes with deployment.
- No rate limiting on login yet (SB4/US41).
- Firefox and WebKit E2E runs still need to be run on a Mac (see testing).

## Next: Sprint 2 (waiting for approval)

Advanced search (text index, filters, sorting, pagination), mentor profiles with a request button, the request lifecycle and its state machine, the rule-based matching engine, notifications and admin category review, plus a full regression run of every Sprint 1 test.
