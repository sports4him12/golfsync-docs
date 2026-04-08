# GolfSync — Requirements & To-Do

Living backlog of features, improvements, and fixes. Add items here and they'll be picked up and addressed in future sessions.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done

---

## Features

<!-- New user-facing functionality to build -->

- [ ] **GolfNow cancellation handling** — Implement round cancellation according to GolfNow API requirements. Research GolfNow's cancellation policies (window, fees, confirmation flow) and mirror that logic in the `cancelRound` flow. Update the BPMN process and UI accordingly so users understand what happens when a booked tee time is cancelled.

---

## Improvements

<!-- Enhancements to existing features, UX polish, performance -->

- [ ] 

---

## Security & Infrastructure

<!-- Auth, secrets, AWS, hardening, compliance -->

- [ ] **MFA for sensitive operations** — Add multi-factor authentication challenges before high-risk actions: Stripe billing management (plan changes, payment method updates, subscription cancellation), account deletion, and admin-panel access. Evaluate TOTP (Google Authenticator / Authy via a library such as FINOS `legend-engine` auth patterns or a standard TOTP library) vs. email OTP as the second factor. Backend needs an `mfa_secret` column, a verify-code endpoint, and a step-up token pattern so the MFA check doesn't break the existing session flow. Frontend needs a modal challenge that fires before the sensitive action proceeds.

- [ ] **CDK contact/support information audit** — Review all hard-coded support and contact addresses across the CDK stack and application. Currently `supportEmail: 'support@golfsync.com'` is set in `golfsync-cdk/bin/parparty-cdk.ts` for both dev and prod; the account page references `support@golfsync.io` (different domain). Decide on the canonical support address and make it consistent across CDK config, `application.properties` (`golfsync.mail.support`), all email templates, and the `/account` page. Consider driving it from a Secrets Manager value rather than hard-coding.

- [ ] **CDK TODOs — Route53 hosted zone and ACM certificate** — `parparty-cdk.ts` has two outstanding `// TODO` comments in the prod stack: (1) `hostedZoneId` must be set (find via `aws route53 list-hosted-zones`) and (2) `certificateArn` must be provided (request via ACM in us-east-1). Both are required before the prod ALB HTTPS listener will work. Document the values in `AWS_DeploymentGuide.md` once confirmed.

- [ ] **CDK alarm email environment variables** — `PARPARTY_DEV_ALARM_EMAIL` and `PARPARTY_PROD_ALARM_EMAIL` are referenced in `parparty-cdk.ts` but not listed in `.env.dev` or `.env.prod.example`. Add them with instructions so operators know to set them before deploying.

---

## Bugs

<!-- Known defects to fix -->

- [ ] 

---

## Tech Debt

<!-- Refactors, test gaps, dependency updates, cleanup -->

- [ ] **Migrate from Camunda 7 to FluxNova** — Camunda 7 reaches end of life; FluxNova (`org.finos.fluxnova.bpm.springboot`) is the target BPM runtime for long-term support. Replace the `org.camunda.bpm.springboot` starters, update BPMN process definitions as needed, and verify the `golf-round-booking-process` and `tournament-report-process` workflows behave identically. Note: FluxNova starters are not on Maven Central — confirm artifact repository before starting.

---

## Business / Product

<!-- Pricing, partnerships, analytics, marketing, legal -->

- [ ] 

---

## Completed

<!-- Move items here (with date) when done -->

| Date | Item |
|------|------|
| 2026-04-08 | Availability poll sharing — all accepted friends pre-selected by default when creating a poll; Select All / Deselect All toggle added; fixed friend username resolution bug |
| 2026-04-08 | Nullable entry fee and format "Unavailable" sentinel — entry_fee column nullable (migration 033); TournamentResponse.entryFee boxed Double; refresh() sets null fee and "Unavailable" format when neither page scrape nor Serper yields a realistic value |
| 2026-04-08 | Tournament location radius filter — removed Serper-discovered results (had hardcoded 0.0 mi distance) from listing endpoint; only curated tournaments with real coordinates returned |
| 2026-04-08 | Tournament date corrections — Red Shoe/RMHC corrected to 2026-10-19 (scraped from registration page); Dominion Energy corrected to 2026-10-05; date column made nullable (migration 032); "Unavailable" sentinel when date cannot be confirmed |
| 2026-04-08 | Tournament page scraping — scrapePage() fetches tournament's own registration URL to extract date, format, and entry fee before falling back to Serper snippets |
| 2026-04-08 | Tournament refresh 75-mile default radius — frontend defaults to 75 miles; curated tournament seed data city/state values restored |
| 2026-04-08 | Signup → paid conversion funnel (CFO item #5) — subscription_cancelled events fired on webhook; ARPU, LTV, churn rate, Revenue & Retention panel on admin analytics |
| 2026-04-07 | Analytics dashboard — AnalyticsService aggregates funnel counts; GET /api/admin/analytics; Analytics tab on /admin with KPI cards, funnel table, 30-day daily signups |
| 2026-04-07 | GDPR self-deletion — DELETE /api/users/me cancels Stripe subscription then cascade-deletes; sendAccountDeletionConfirmation email; /account page with typed confirmation guard |
| 2026-04-07 | Shareable round invite links — migration 029 makes invitee_email nullable; generic 7-day token; GET /api/invite/rounds/{id}/link (booker-only); "Copy Invite Link" button |
| 2026-04-07 | AI chat error handling — AiController catches exceptions and returns 503 with user-friendly message; conversationId in all responses |
| 2026-04-07 | Redis-backed AI conversation memory — RedisChatMemoryStore with 24h TTL; fallback to InMemoryChatMemoryStore when AI_REDIS_ENABLED=false; ElastiCache added to CDK |
| 2026-04-07 | Extended rate limiting — AI chat (5/min per user), user search (30/min per IP), tee-time search (10/min per IP) |
| 2026-04-07 | Stripe Checkout Session (subscription mode) — hosted Stripe Checkout with recurring Price IDs; POST /api/payments/membership/create-checkout-session |
| 2026-04-07 | Friend leaderboard — GET /api/rounds/leaderboard ranked by rounds played this calendar year; /leaderboard page with rank medals |
| 2026-04-07 | Round invite for non-members — invite by email from round detail; UUID token (migration 027, 7-day expiry); /invite/[token] landing page |
| 2026-04-07 | Referral program — unique 8-char code (migration 026); 30-day membership credit on conversion; referral widget on dashboard |
| 2026-04-07 | Trial drip email sequence — 5-step sequence (day 0, 3, 7, 21, 27); bitmask per user (migration 028); @Scheduled daily at 9 AM |
| 2026-04-07 | Conversion funnel instrumentation — user_events table (migration 025); UserEventService with idempotent first-occurrence semantics |
| 2026-04-07 | CTO infrastructure changes — Camunda embedded in-process; EC2 t3.small for dev ECS; VPC endpoints replacing NAT Gateway; CloudFront for static assets; Liquibase as pre-deploy ECS task |
| 2026-04-07 | Free tier replaced with 30-day free trial — all features unlocked on signup; trial countdown on dashboard; Stripe subscription webhooks with HMAC verification |
| 2026-04-07 | CTO AWS assessment added to executive-mvp-review.md |
| 2026-04-07 | How To Guide restructured into role-based hub with sub-pages: Booker, Participant, Tournaments, Account |
| 2026-04-07 | Safe tournament registration URL resolver — GET /api/tournaments/register-url with adult-content safety filter |
| 2026-04-07 | Add player post-creation — booker can invite additional players to an existing round |
| 2026-04-07 | Nudge pending invitees — booker sends in-app reminder to unresponded players |
| 2026-04-07 | Availability Polls — date/time option polls; friends vote I'm In/Can't Make It; dashboard widget; migration 020 |
| 2026-04-07 | Booker/Payment settlement — per-player dues and PAID/WAIVED status for rounds and tournament registrations |
| 2026-04-07 | Round scores — players post gross stroke scores; friend score feed on dashboard (paid) |
| 2026-04-07 | Free tier by default — friends/messaging/rounds gated behind paid membership; upgrade banner |
| 2026-04-07 | Tournament self-registration — users mark themselves registered and add friends |
| 2026-04-07 | Live tournament discovery via Google Custom Search API with 2-hour cache |
| 2026-04-07 | Tournament type interest preferences with localStorage persistence and preferred-first sorting |
| 2026-04-06 | Admin-promoted courses and tournaments with haversine location filtering |
| 2026-04-06 | User search minimum 2-character validation |
| 2026-04-06 | Rate limiting on auth endpoints (10 req/min per IP, sliding window) |
| 2026-04-06 | AI booking agent no longer leaks user emails in friend search results |
| 2026-04-06 | Change-password IDOR fix |
| 2026-04-06 | PublicUserResponse DTO — email no longer exposed in user search results |
| 2026-04-06 | CDK dev/prod environment split (Gmail SMTP dev, SES prod, Route53 prod-only) |
| 2026-04-06 | ALB HTTPS via ACM — CDK conditional TLS listener on 443 |
| 2026-04-06 | JWT moved from localStorage to httpOnly cookie (XSS fix) |
