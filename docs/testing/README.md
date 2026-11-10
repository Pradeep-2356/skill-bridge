# Testing

Four layers, all automated. A story counts as done only when its listed tests pass in a recorded run; the numbers below come from the actual run output.

| Layer               | Tools                                                                       | Location                             | Command                    |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------ | -------------------------- |
| Shared rules (unit) | Vitest                                                                      | `packages/shared/tests`              | `npm run test:unit`        |
| Server unit         | Vitest (models mocked where needed)                                         | `apps/server/tests/unit`             | `npm run test:unit`        |
| Server integration  | Vitest + Supertest + mongodb-memory-server (real Express app, real MongoDB) | `apps/server/tests/integration`      | `npm run test:integration` |
| Client component    | Vitest + React Testing Library + user-event + MSW (mock API) + jsdom        | `apps/client/src/**/*.test.{js,jsx}` | `npm run test:client`      |
| End-to-end          | Playwright (real client + API + `skillbridge_e2e` database)                 | `e2e/`                               | `npm run test:e2e`         |

## Results – recorded run, 10 November 2026 (end of Sprint 2)

| Suite                 | Files  | Tests   | Result        |
| --------------------- | ------ | ------- | ------------- |
| Shared rules          | 2      | 56      | ✅ all passed |
| Server unit           | 4      | 61      | ✅ all passed |
| Server integration    | 8      | 168     | ✅ all passed |
| Client component      | 10     | 93      | ✅ all passed |
| End-to-end (Chromium) | 2      | 11      | ✅ all passed |
| **Total**             | **26** | **389** | **✅**        |

The end-to-end run includes the 7 Sprint 1 tests (rerun as a regression check) and 4 new Sprint 2 tests.

Environment: Node.js 22.23, MongoDB 8.3.7, Chromium (Playwright 1.63). ESLint: 0 problems. Prettier: all files formatted. Production build: succeeds.

**Not yet run:**

- The Firefox and WebKit Playwright projects. They are configured, but those browsers are not available in the build environment, and Firefox failed to launch on the team Mac ("Could not find profile folder"). Run them on a Mac with `npx playwright install && npm run test:e2e`.
- Real SMTP delivery through Mailpit (tests use the in-memory mail transport).

### Earlier run – 9 November 2026 (end of Sprint 1)

238 tests (36 shared, 44 server unit, 99 integration, 52 client, 7 E2E), all passed.

### Coverage (10 November run)

| Area                    | Lines | Statements | Branches | Functions | Target       |
| ----------------------- | ----- | ---------- | -------- | --------- | ------------ |
| Server overall          | 90.1% | 87.5%      | 77.9%    | 91.8%     | 80% lines ✅ |
| Server services + utils | 96.7% | —          | —        | —         | 90% ✅       |
| Client overall          | 85.8% | 84.0%      | 76.4%    | 81.1%     | 70% ✅       |

The seed script and request logger show 0% in unit coverage. The seed is exercised by every Playwright run instead, and the logger is switched off in tests.

## What is tested

### Sprint 1

**Shared rules:** password rules and strength; registration, login, reset and change-password schemas (all errors reported at once); profile limits; skill references (catalogue vs custom + category); proficiency and learning levels; availability steps, overlaps and time zones; search query limits; delete confirmation; admin deactivation reason; regex escaping; skill-name normalisation.

**Server unit:** JWT sign/verify, 15-minute expiry with fake timers, forged/edited/`alg:none` tokens; opaque token hashing; bcrypt hashing and salting; `authenticate` (no cookie, garbage, deactivated, old token version, deleted user); `authorize`; `validate`; `originCheck`; error-handler mapping and hiding of internal messages; config refusing weak secrets; file-signature detection; serializers never leaking private fields; profile-completion maths.

**Server integration (real MongoDB):**

- **Registration:** HttpOnly/SameSite cookies, duplicate emails in any letter case, field errors, role injection ignored.
- **Login:** same 401 message for unknown email and wrong password.
- **Protected routes:** all 27 return 401 without a cookie.
- **Refresh tokens:** rotation and reuse detection.
- **Logout:** really revokes the refresh token.
- **Password reset:** single-use link, expiry, every session revoked.
- **Change password:** signs out other devices.
- **Profile:** updates and privacy.
- **Photo upload:** files over 2 MB (413), fake PNGs and GIFs (415), replacement and removal.
- **Skills:** catalogue search and aliases, add/edit/remove, duplicates (409), the 20-skill limit, custom pending skills with normalised reuse, ownership.
- **Availability:** sorting, overlaps, steps, zones.
- **Dashboard and sessions:** aggregation, pagination, "former member".
- **Search:** case-insensitive, literal regex characters, excludes self and deactivated users, empty results.
- **Account:** deactivate/reactivate, delete with DELETE, last-admin rule.
- **Admin:** 403 for members, filters and totals, details, deactivation that signs the user out, self-protection.

**Client component:**

- **Register form:** every field error, focused error summary, live password checklist, server 409 shown on the email field, success redirect.
- **Login:** error message, disabled button while sending, `?next` redirect, reactivation dialog.
- **Password recovery:** forgot and reset flows, including an expired link.
- **Route guards and API client:** guest redirects, admin guard, single shared refresh, session-expired handling.
- **Dashboard:** loading, empty and error-with-retry states.
- **Sessions, search and navigation:** session tabs, search results, count and URL, top-bar search.
- **Skills:** picker, custom skill, all errors at once, delete confirmation, duplicate error.
- **Availability:** grid keyboard toggling, dragging, presets, save.
- **Profile:** privacy, edit, avatar size check and upload.
- **Settings:** password change, server field error, DELETE confirmation, deactivate error.
- **Admin:** filters, deactivate with reason, self-protection.

**End-to-end (Sprint 1):**

1. Sprint 1 journey: Register (with validation) → Dashboard → Edit profile → Add teaching + learning skill → Availability preset → Search "react" (deactivated mentor hidden) → open profile (email hidden) → Logout → protected page redirects → Login again.
2. Wrong password message.
3. Still signed in after the access cookie disappears (silent refresh).
4. Password reset through the (test-only) email outbox, including the reused link failing.
5. Member blocked from the admin area.
6. Admin deactivates a member, who then cannot log in, then reactivates them.
7. Phone-width layout with no horizontal scroll and a working slide-out menu.

### Sprint 2 additions

**Shared rules:**

- Time-zone maths: week-minute intervals, DST-safe conversion, overlap and next slot.
- Search term cleaning: 5-term limit, regex characters, skill match score.
- Request state machine: all 9 allowed transitions plus forbidden ones.
- The new query and body schemas: filters, sorts, request create/decline, categories, theme preference.

**Server unit:**

- Matching score parts and caps.
- Reasons vs notes.
- Every `explainNoMatch` code.
- Ranking order and tie-breaks.
- Relevance score and sorting.
- Local queue behaviour: visibility timeout, receive count, dead letter after 3 receives.

**Server integration:**

- **Skill discovery:** suggestions, aliases, partial words, text index, related skills, categories with counts.
- **Mentor search:**
  - every filter (category, proficiency, days, time window, time-zone compatible)
  - every sort
  - pagination limits
  - excludes paused, deactivated and self
  - operator injection rejected
- **Mentor profile:** shared availability, skill-exchange card, paused mentor.
- **Learning requests:**
  - create (direct and automatic), validation, self-request, skill not taught, paused mentor, mentor without availability, duplicate active request (unique index)
  - accept creates a session
  - decline with reason, cancel, retry after failure
  - invalid transitions return 409
  - only the right person can act
  - expiry job
- **Matching worker:**
  - picks the best mentor and records reasons
  - failure reasons when nobody fits
  - retries and dead letter
- **Notifications:** created for each event, list, unread count, mark one and mark all read, other users cannot read them.
- **Admin catalogue:**
  - categories CRUD with the in-use guard and unique names
  - pending skill review (approve / rename / reject)
  - 403 for members
- **Protected routes:** 22 Sprint 2 routes return 401 without a cookie.

**Client component:**

- **Discover:** mentors listed before any search, suggestions while typing (keyboard), filters in the URL with chips and clear-all, sort and paging, empty result with related skills, paused mentors marked, error with retry.
- **Mentor profile and requests:** exchange hints, availability in both zones, send a request, open the existing request instead of a duplicate, paused mentors, received/sent folders with counts, accept, decline with a reason, cancel and retry, request detail with score, history and access message.
- **Suggested mentors:** score breakdown with reasons and notes, the "no matches" explanation, automatic match.
- **Notifications:** bell count, recent items, mark one or all as read, unread filter and empty state.
- **Admin catalogue:** approve a pending skill, edit a category, hidden from members.
- **Settings:** mentoring on/off switch.
- **Theme:**
  - first visit follows the system setting
  - toggle saves to `localStorage`, and the saved choice survives a remount
  - the system choice follows live OS changes
  - works on the login page and inside dialogs
  - blocked storage is handled
  - every light colour token has a dark value, and key text passes WCAG AA (4.5:1) in the dark theme

**End-to-end (Sprint 2):**

8. Journey 1 – learner: log in → Discover → type "react" (suggestions) → filters → mentor profile → send request → request status page.
9. Journey 2 – mentor: received requests → review → accept one (session created) and decline one with a reason → statuses update for both people.
10. Journey 3 – matchmaking: a new learner adds a learning skill and availability → suggested mentors with reasons → profile → request → state.
11. Dark theme: toggle, navigate, refresh (no flash, still dark), a dialog and a form in dark mode.

## Rules followed

- Each integration test file gets its own database, and collections are emptied before every test.
- Time-dependent tests use fake timers or direct expiry changes, never real waiting.
- Factories (`createUser`, `createSkill`, `signedInUser`) create exactly the data a test needs.
- No snapshot-only tests; every test asserts behaviour.
- Bugs found while testing got a test that would catch them again. Four examples:
  - The refresh request sent a JSON `null` body, which Express rejected.
  - Zod skipped cross-field checks once a field had already failed.
  - Arrow-key focus in the availability grid moved one frame late.
  - Logging out landed on `/login?next=…` instead of a clean login page.
