# Sprint 2 – Discovery, learning requests and matchmaking

**Objective:**

- Learners can find a suitable mentor by skill, filters and relevance, then study the mentor's profile and send a learning request.
- Mentors can review those requests and accept or decline them.
- The platform suggests mentors with a transparent, explained score.
- Everything runs locally on real data, with no AWS and no paid services.

**Scope:** `SprintBacklog 2` of the workbook: SB2/US1–US50 with tasks T1–T4 each (200 tasks). The workbook is not modified, and all IDs are the originals. Full per-story and per-task evidence: [traceability-sprint-2.md](traceability-sprint-2.md).

**Outcome (recorded 10 Nov 2026):**

- **Stories:** 42 _Implemented – Frontend and Backend_ and 8 _Demonstrated – Simplified Logic_. None are deferred or blocked.
- **Tasks (200):** 175 completed; 22 completed with the AWS part deferred; 3 completed in simplified form with AWS deferred.
- **Tests:** 389 automated tests passing (378 unit, integration and component, plus 11 end-to-end in Chromium).

Sprint 3 (live sessions, booking changes, chat, video) has **not** been started.

## Stories by module

| Module                        | Stories                   | What was built                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Skill and mentor discovery | US1–7, 32–42              | Discover page:<br>- skill suggestions while typing<br>- partial and multi-term search<br>- MongoDB text index on skills<br>- filters: category, level, days, time window, time-zone fit<br>- relevance, name, newest and availability sorts<br>- paging (max 50 per page)<br>- result count, clear filters, input sanitising, useful empty states with related skills                 |
| B. Mentor profiles            | US8–11, 30                | Mentor profile with:<br>- teach and learn skills<br>- availability shown in the viewer's time zone<br>- shared free time and time-zone gap<br>- skill-swap card<br>- any open requests between the two people                                                                                                                                                                         |
| C. Learning requests          | US12–16, 23–28, 31, 43–45 | Request modal and Requests hub:<br>- received and sent folders with tab counts<br>- request detail with timeline<br>- 9-transition state machine shared by client and server<br>- accept books a session at the first shared slot<br>- decline with a reason, cancel, retry<br>- 7-day expiry job<br>- one active request per pair (unique index)<br>- mentors can pause new requests |
| D. Matchmaking                | US17–22, 46               | Suggested mentors page:<br>- fixed points formula (skill 35, level 20, shared time 25, time zone 10, skill swap 10)<br>- reasons and gaps for every match<br>- a plain reason and next step when nobody fits<br>- "Match me automatically"                                                                                                                                            |
| E. Queue and worker           | US48–50                   | `queuemessages` collection that copies SQS behaviour (visibility timeout, receive count, dead letter after 3), with an in-process worker in place of Lambda                                                                                                                                                                                                                           |
| F. Notifications              | US29                      | Stored notifications for every request event; bell with unread count; notifications page; mark one or all read; polled every 30 s                                                                                                                                                                                                                                                     |
| G. Admin catalogue            | US47 (and US42)           | Categories: create, rename, hide, reorder, delete only when unused. Member-added skills: approve, rename, re-categorise or reject                                                                                                                                                                                                                                                     |
| Theme (extra requirement)     | —                         | Dark and light theme, described below                                                                                                                                                                                                                                                                                                                                                 |

### Dark and light theme

- **How it works:**
  - React context.
  - The `data-theme` attribute on `<html>`.
  - CSS variable tokens.
- **Saving the choice:** stored in `localStorage` (`sb-theme`: system, light or dark). The first visit follows the system setting.
- **No flash on load:** a small `theme-init.js` runs in `<head>` before the app. It is a separate file because the Content Security Policy blocks inline scripts.
- **Where to switch:**
  - the sun/moon toggle in every layout
  - System / Light / Dark in Settings
- **Contrast:** checked by a test (WCAG AA 4.5:1 for key text).

## Real, simplified and deferred

| Feature                     | Status in Sprint 2                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search, filters, profiles   | **Real.** MongoDB queries and a text index on live data                                                                                                                                                   |
| Learning requests, sessions | **Real.** Stored state machine, history, sessions booked on accept, ownership checked on the server                                                                                                       |
| Matching score              | **Simplified (US19–22).** A fixed, explained points formula. It is not machine learning, and the page says so                                                                                             |
| Queue and worker            | **Simplified (US48–50).** A MongoDB collection plus an in-process worker that copy SQS and Lambda behaviour. Amazon SQS and AWS Lambda are deferred: an adapter interface is ready so they can replace it |
| Notifications               | **Simplified (US29).** Stored for real, but the client checks every 30 seconds instead of receiving a push. WebSockets are deferred                                                                       |
| Email for requests          | **Deferred.** Notifications are in-app only                                                                                                                                                               |

## Decisions and deviations from the Stage 3 plan

- **Time-zone maths uses the built-in `Intl` API instead of Luxon.**
  - It adds no dependency and handles daylight saving.
  - All of it lives in `packages/shared/src/time.js`, with unit tests.
- **An empty search now lists mentors** instead of returning 422. Discovery starts with a browsable list (US3, US39).
- **`/search` redirects to `/discover`.** Old links and the top-bar search keep working.
- **"Mark all read" is `POST /notifications/read-all`** instead of the `/notifications/seen` named in the plan. The name says what it does.
- **Matches return `notes` (gaps) as well as `reasons` (strengths)**, so a 55-point match explains what it is missing.
- **Accepting books the first shared 30-minute slot at least 24 h ahead.** This is the "matched session time" (US31). Rescheduling is Sprint 3.
- **Only one active request per learner, mentor and skill.** This is enforced by a partial unique index, so it holds even with two clicks at the same time.

## Database changes

All changes are additive. Sprint 1 data keeps working without a migration.

- **New collections:**
  - `matchrequests`
  - `notifications`
  - `queuemessages`
- **Changes to existing collections:**
  - New text index `skill_text` on skills (name 10, aliases 5, description 1).
  - New field `acceptingRequests` on users (default `true`).
- **Seed now also creates:**
  - Demo requests through the real services: two pending requests to Priya, one accepted request with a booked session, and one declined request with a reason.
  - A paused mentor (Mia).
  - A pending custom skill (Svelte Kit) for the admin review screen.

Details: [database/README.md](../database/README.md).

## APIs

23 new endpoints and 1 extended (`/search/mentors`). See [api/README.md](../api/README.md) and the OpenAPI file (version 2.0.0-sprint2, Swagger UI at `/api/docs`).

## Tests and results

389 automated tests passed in the recorded run on 10 Nov 2026:

| Layer          | Tests |
| -------------- | ----- |
| Shared         | 56    |
| Server unit    | 61    |
| Integration    | 168   |
| Client         | 93    |
| E2E (Chromium) | 11    |

- The 7 Sprint 1 end-to-end tests were rerun and still pass.
- Coverage: server 90.1% of lines (96.7% for services and utilities), client 85.8%.
- Firefox and WebKit were **not** run.

Details: [testing/README.md](../testing/README.md).

## Local testing guide (macOS)

```bash
brew services start mongodb-community   # MongoDB must be running
npm install
npm run db:seed                         # adds the Sprint 2 demo data; safe to repeat
npm run dev                             # http://localhost:5173 · API docs http://localhost:5000/api/docs

npm test                                # 378 unit + integration + component tests
npm run test:e2e -- --project=chromium  # 11 end-to-end tests (Sprint 1 + Sprint 2)
npm run lint && npm run build
```

Demo accounts all use the password `Demo@1234`.

| Account                  | Use it for                                                                     |
| ------------------------ | ------------------------------------------------------------------------------ |
| `arjun@skillbridge.test` | Learner: discovery, suggestions, requests (has accepted and declined examples) |
| `priya@skillbridge.test` | Mentor: two pending requests to accept or decline                              |
| `meera@skillbridge.test` | Learner whose request Priya can accept                                         |
| `mia@skillbridge.test`   | Paused mentor: shown with a notice, cannot be requested                        |
| `admin@skillbridge.test` | Skill catalogue: categories and the pending "Svelte Kit" skill                 |

To demonstrate Retry:

1. Set `MATCH_FAILURE_RATE=1` in `.env`, restart the API, and use "Match me automatically".
2. After three attempts (about a minute, because of the 30-second visibility timeout) the request shows **Failed**.
3. Set the value back to `0`, restart, and press **Retry**.

To show the "no match" reason, register a new account with no learning skills and open **Suggested**.

## Demo walkthrough (about 12 minutes)

1. **Log in as Arjun → Discover.**
   - Type "rea" to show suggestions, then pick React.
   - Add the filters Advanced, weekday evenings and "Compatible time zones" to show the count and chips change.
   - Press **Clear filters**.
   - Search "zzz" to show the empty state and its next steps. When a known skill has no mentors, related skills in the same category are offered.
2. **Open Priya's profile.**
   - Her availability is shown in Arjun's time zone, with shared time highlighted.
   - The skill-swap card shows she wants Python, which Arjun teaches.
3. **Send a request.**
   - Write a message and send it.
   - The request detail shows the status timeline.
   - Sending again opens the existing request instead of creating a duplicate.
4. **Suggested mentors.**
   - Show the ranking, the score bars, the reasons and the gaps.
   - Press **Match me automatically**.
5. **Log in as Priya.**
   - The bell shows unread notifications.
   - Under **Requests → Received**, accept Meera's request: a session is booked at the first shared slot.
   - Decline Isla's request with a reason.
6. **Log in as Meera.** The notification and the accepted request show the session time in her time zone.
7. **Log in as Admin → Skill catalogue.**
   - Approve "Svelte Kit".
   - Try to delete a category that is in use: it is blocked with a clear message.
8. **Theme.** Switch to dark, move between pages, open a dialog and refresh: the theme stays dark with no flash.

## Limitations (known and intentional)

- **Matching uses fixed weights.** There is no learning from feedback and no ratings yet; ratings come in a later sprint.
- **Notifications are not real-time.** The client checks every 30 seconds, and there is no email or push.
- **The worker runs inside the API process.** If the API is down, queued requests wait until it restarts; nothing is lost, because messages are stored in MongoDB.
- **Search is limited for large data.** Up to 500 candidates are ranked in memory per search. That is fine for a class-sized dataset, but would need a search service at scale.
- **Session times are fixed.** A session is booked at one proposed time on accept; changing or rescheduling it is Sprint 3.
- **Browser coverage is partial.** End-to-end tests ran in Chromium only. Firefox did not launch on the team Mac ("Could not find profile folder").
