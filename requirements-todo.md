# Par Party — Requirements & To-Do

Living backlog of features, improvements, and fixes. Add items here and they'll be picked up and addressed in future sessions.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done

---

## Features

<!-- New user-facing functionality to build -->

- [ ] 

---

## Improvements

<!-- Enhancements to existing features, UX polish, performance -->

- [ ] 

---

## Security & Infrastructure

<!-- Auth, secrets, AWS, hardening, compliance -->

- [ ] 

---

## Bugs

<!-- Known defects to fix -->

- [ ] 

---

## Tech Debt

<!-- Refactors, test gaps, dependency updates, cleanup -->

- [ ] 

---

## Business / Product

<!-- Pricing, partnerships, analytics, marketing, legal -->

- [ ] 

---

## Completed

<!-- Move items here (with date) when done -->

| Date | Item |
|------|------|
| 2026-04-06 | JWT moved from localStorage to httpOnly cookie (XSS fix) |
| 2026-04-06 | ALB HTTPS via ACM — CDK conditional TLS listener on 443 |
| 2026-04-06 | CDK dev/prod environment split (Gmail SMTP dev, SES prod, Route53 prod-only) |
| 2026-04-06 | PublicUserResponse DTO — email no longer exposed in user search results |
| 2026-04-06 | Change-password IDOR fix — authenticated callers can only change their own password |
| 2026-04-06 | AI booking agent no longer leaks user emails in friend search results |
| 2026-04-06 | Rate limiting on auth endpoints (10 req/min per IP, sliding window) |
| 2026-04-06 | User search minimum 2-character validation |
