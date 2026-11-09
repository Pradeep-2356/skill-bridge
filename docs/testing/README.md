# Testing

Four layers, all automated. A story counts as done only when its listed tests pass in a recorded run; the numbers below come from the actual run output.

| Layer               | Tools                                                                       | Location                             | Command                    |
| ------------------- | --------------------------------------------------------------------------- | ------------------------------------ | -------------------------- |
| Shared rules (unit) | Vitest                                                                      | `packages/shared/tests`              | `npm run test:unit`        |
| Server unit         | Vitest (models mocked where needed)                                         | `apps/server/tests/unit`             | `npm run test:unit`        |
| Server integration  | Vitest + Supertest + mongodb-memory-server (real Express app, real MongoDB) | `apps/server/tests/integration`      | `npm run test:integration` |
| Client component    | Vitest + React Testing Library + user-event + MSW (mock API) + jsdom        | `apps/client/src/**/*.test.{js,jsx}` | `npm run test:client`      |
| End-to-end          | Playwright (real client + API + `skillbridge_e2e` database)                 | `e2e/`                               | `npm run test:e2e`         |

## Results – recorded run, 9 November 2026

| Suite                 | Files  | Tests   | Result        |
| --------------------- | ------ | ------- | ------------- |
| Shared rules          | 1      | 36      | ✅ all passed |
| Server unit           | 3      | 44      | ✅ all passed |
| Server integration    | 5      | 99      | ✅ all passed |
| Client component      | 7      | 52      | ✅ all passed |
| End-to-end (Chromium) | 2      | 7       | ✅ all passed |
| **Total**             | **18** | **238** | **✅**        |

Environment: Node.js 22.23, MongoDB 8.3.7, Chromium (Playwright 1.63). ESLint: 0 problems. Prettier: all files formatted. Production build: succeeds.

**Not yet run:** the Firefox and WebKit Playwright projects (they cover the main journey for SB1/US40). They are configured, but those browsers could not be downloaded in the build environment. Run them on a Mac with `npx playwright install && npm run test:e2e`.

### Coverage (same run)

| Area                    | Lines | Statements | Branches | Functions | Target       |
| ----------------------- | ----- | ---------- | -------- | --------- | ------------ |
| Server overall          | 86.0% | 83.2%      | 73.2%    | 86.0%     | 80% lines ✅ |
| Server services + utils | 97.7% | —          | —        | —         | 90% ✅       |
| Client overall          | 82.4% | 80.4%      | 72.0%    | 77.7%     | 70% ✅       |

The seed script and request logger show 0% in unit coverage. The seed is exercised by every Playwright run instead, and the logger is switched off in tests.

## What is tested

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

**End-to-end:**

1. Sprint 1 journey: Register (with validation) → Dashboard → Edit profile → Add teaching + learning skill → Availability preset → Search "react" (deactivated mentor hidden) → open profile (email hidden) → Logout → protected page redirects → Login again.
2. Wrong password message.
3. Still signed in after the access cookie disappears (silent refresh).
4. Password reset through the (test-only) email outbox, including the reused link failing.
5. Member blocked from the admin area.
6. Admin deactivates a member, who then cannot log in, then reactivates them.
7. Phone-width layout with no horizontal scroll and a working slide-out menu.

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
