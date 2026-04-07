# Par Party — Executive MVP Review
**Prepared:** 2026-04-06  
**Perspective:** CFO · COO · CMO  
**Purpose:** Identify what to change, cut, or double down on before scaling

---

## What We're Looking At

Par Party is a **golf-centric social platform** combining tee-time booking, tournament discovery, round scoring, friend matchmaking, and payment tracking — all under a freemium subscription model ($9.99/month, $79.99/year). The tech stack is solid (Spring Boot, Next.js, AWS CDK), the architecture is clean, and infrastructure-as-code is in place. On paper, the foundation is production-ready.

The honest read: **the bones are good, but the meat isn't there yet.** There are critical gaps between what's built and what's needed to deliver an "aha moment," convert free users to paying customers, or give someone a reason to come back tomorrow.

---

## CFO View — Revenue, Unit Economics & Monetization

### The Core Problem: We Don't Know Our Numbers

There is **no analytics, no cohort tracking, no revenue reporting**. A CFO cannot make capital allocation decisions blind. Before spending another dollar on features, instrument the basics:

- Free-to-paid conversion rate
- Monthly churn by plan
- CAC by acquisition channel
- ARPU and LTV by cohort
- Average time to first paid action

Without these, every product decision is a guess.

### Subscription Model Has a Structural Flaw

The current payment flow creates one-time Stripe payment intents with manual expiry tracking. There is **no auto-renewal, no webhooks, no dunning**. When a membership expires, the user is silently downgraded. They must manually purchase again. In practice, this means a 100% annual "churn" event for every customer, regardless of satisfaction.

**Fix immediately:**
- Migrate to Stripe Subscriptions (not one-time intents)
- Implement Stripe webhooks: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
- Add dunning emails (payment failed → 3-day grace → downgrade)
- Add renewal reminders 7 days before expiry

This is not a feature — it is table stakes for any subscription business.

### Revenue is One-Dimensional

The entire monetization strategy is: user pays $9.99/month. That's it. There are no transaction fees, no upsells, no B2B revenue, no affiliate commissions, no in-app purchases.

**Revenue levers that should be on the roadmap:**

| Lever | Mechanism | Estimated Upside |
|---|---|---|
| **Tournament entry fee commission** | Take 5–10% when a group registers via Par Party | Additive to subscriptions |
| **GolfNow referral/affiliate** | Revenue share per tee time booked | Steady baseline |
| **Premium tier** | Advanced handicap analytics, tournament creation, priority booking | 2x ARPU ceiling |
| **Course partnerships** | Featured placement fee from courses wanting visibility | B2B recurring |
| **B2B white-label** | Sell the round/tournament management layer to golf clubs | High ACV, sticky |

The near-term win is the tournament commission. It requires zero new engineering — just a fee field and Stripe Connect integration on the existing tournament registration flow.

### The Free Tier is Too Generous in the Wrong Places

Free users can browse courses, view tournaments, and search users. These actions have zero retention value. Meanwhile, friends and messaging — the social features that create habit — are paywalled. This is backwards.

**Recommendation:** Let free users send friend requests and read messages. Gate the _volume_ or _advanced_ features (bulk invites, rich media, group chats, handicap tracking, leaderboards). The goal of a free tier is activation, not restriction.

### Pricing Sanity Check

$9.99/month is reasonable for a niche product. $79.99/year is a 33% discount. The problem: golf is seasonal. A user who golfs April–October has no reason to pay $9.99 in January. Consider:

- **Seasonal plan**: $29.99 for 6 months (April–September)
- **Per-event pricing**: $4.99 to unlock premium features for a single round or tournament
- **Family/group plan**: One subscription covers up to 4 golfers (increases household LTV and reduces churn by creating shared commitment)

---

## COO View — Operations, Scalability & What's Not Production-Ready

### Blocker #1: GolfNow Integration is Mocked

The tee time booking feature — arguably the core value proposition — is a fake. The `GolfNowClient` returns hardcoded mock data. Until this is real, Par Party cannot honestly claim to be a tee-time booking platform. Users who try to book a real round will be disappointed.

**Decision needed:** Either (a) negotiate a GolfNow API partnership, (b) pivot to a different provider (Supreme Golf, TeeOff), or (c) reposition as a "round management" platform and drop the tee-time promise until the integration is real. Do not ship this to real users as-is.

### Blocker #2: No Subscription Lifecycle (Already Noted)

Covered under CFO view. This is an ops failure as much as a finance failure — no automated membership management means customer support handles every renewal manually.

### Tournament Database Doesn't Scale

There are 12 seeded tournaments, all on the east coast. A user in Phoenix, Dallas, or Chicago finds nothing. The Google Custom Search fallback is optional, quota-limited, and dependent on an external API key. There is no pipeline to keep tournament data fresh.

**Options:**
- License tournament data from a golf industry source (USGA, PGA, Golf Genius)
- Build a user-submitted tournament board (crowdsourced, moderated by existing report workflow)
- Partner with local golf associations to list their events

The community reporting workflow is already built. Extend it: let users _submit_ tournaments, not just report bad ones.

### AI Conversation Memory Doesn't Survive Server Restart

The AI assistant uses an in-memory `HashMap` for conversation history keyed by `conversationId`. This means:
- Every server restart wipes all active conversations
- In a multi-instance deployment (prod runs 2 tasks), users hitting different instances get different memory
- There's no history persistence for returning users

Move conversation state to Redis or the database. This is a 1-week fix that becomes critical when you have real users.

### Observability is Partial

CloudWatch JSON logging and an error alarm are in place (good). What's missing:

- **Business metrics**: Signups per day, conversions, round creation rate — not just API errors
- **Database slow query logging**: No RDS Performance Insights configuration in CDK
- **Distributed tracing**: No correlation IDs or trace propagation between API, workflow engine, and AI calls
- **Uptime monitoring**: No Route53 health checks or synthetic monitoring for the health endpoint

### Rate Limiting is Only on Auth

The rate limiter (10 req/min) only covers `/api/auth/*`. The AI chat endpoint, tournament search, and user search are completely unprotected. A single user could spam the OpenAI integration and generate significant API costs. Add rate limiting on expensive endpoints: AI chat (5 req/min), search (30 req/min), tee time search (10 req/min).

### GDPR / Data Rights Gap

There is no user data export or self-deletion API. Admin hard-delete exists, but users cannot delete their own accounts. This is a legal requirement in the EU and increasingly expected in the US. It's also a trust signal: users who can delete their own data are more likely to sign up.

### Session Architecture Will Break Under Load

AI conversation history is in-process memory. User search uses no cache. Tournament data is queried fresh on every request. At low traffic, this is fine. At 10,000 concurrent users, you'll have cache stampedes and OpenAI rate limit errors. Add Redis before launching any marketing campaigns.

### Missing Operational Runbook Pieces

- No canary deployment strategy (ECS blue/green or weighted routing)
- No database backup restore test documented
- No incident response playbook
- No on-call rotation setup (SNS alarm goes to one email address)
- No database connection pool monitoring

---

## CMO View — Acquisition, Retention & Why Someone Would Actually Use This

### The "Aha Moment" is Missing

What's the moment a new user thinks "I need this every week"? Currently there isn't one. The flow is: register → browse courses → hit a paywall → leave. There is no sticky loop, no social proof, no reason to invite a friend.

**The product needs a viral moment:**
- A shareable round scorecard (image card users can post to Instagram/X)
- A leaderboard showing where you rank among your friends
- A public round lobby where users can join open rounds (matchmaking)

The friend score feed (paid feature) is a step in the right direction. Make it public. Let anyone see top scores for a course this week. That's the hook.

### The Freemium Funnel Is Broken

| Stage | Current State | Problem |
|---|---|---|
| **Awareness** | No marketing infrastructure | No referral program, no SEO content, no social sharing |
| **Acquisition** | Register → choose plan | Free tier is unclear; friction before first value |
| **Activation** | Browse courses | No "first win" — user accomplishes nothing on day one |
| **Retention** | Weekly round booking | No notifications, no reminders, no streak mechanics |
| **Revenue** | Paywall on friends | Paywall before social value is delivered |
| **Referral** | Email invites only | No shareable link, no group invite, no social proof |

**Fix the activation step first.** On signup, walk the user through: (1) find your home course, (2) invite one friend, (3) create your first round. This 3-step onboarding should exist before any other marketing spend.

### No Social Proof = No Organic Growth

There are no public profiles, no leaderboards, no course reviews, no "X people from your area use Par Party" signals. A new user lands and sees only their own empty dashboard. There is nothing to make them feel like they're joining a community.

**Quick wins:**
- Show "N rounds booked this week" on the landing/marketing page
- Add a course leaderboard (top 5 scores this season at [Course Name])
- Let users share a post-round card (score, course name, date) as a PNG

### The Value Proposition Isn't Clear to a First-Time Visitor

Looking at the homepage (marketing site is not in this repo, but the app's first screen is a login wall), there's no immediate answer to "what is Par Party and why do I need it?" A CMO needs a crisp one-liner and a landing page that shows the product working before requiring signup.

Suggested positioning: **"Book a round, bring your crew, track who wins."** Simple. Differentiated from GolfNow (no social), Arccos (no booking), group texts (no structure).

### Targeting Is Too Broad

"Golfers" is not a target market. There are 26 million golfers in the US. Which ones?

**Recommended primary target:** Recreational golfers, ages 30–55, who golf 10–25 rounds/year in groups of 3–4. They currently coordinate via group text, pay each other via Venmo, and forget who paid what. That pain is solved by Par Party today. Lead with it.

**Secondary target:** Competitive amateur golfers who track handicaps and play in local tournaments. This segment needs the leaderboard and GHIN integration. Don't build for them first — they're harder to monetize.

### Golf is Seasonal — The Marketing Calendar Matters

Golf participation in the US peaks April–June and September–October. The platform should:

- Run acquisition campaigns 6 weeks before the season opens (February/March, August)
- Offer seasonal pricing (see CFO section)
- Build tournament-specific campaigns around major amateur event calendars (club championships, member-guests)

Current state: there is no marketing calendar, no seasonal awareness in the product, and no email drip campaign tooling.

### Referral Program is the #1 Unlockable Growth Lever

Golf is inherently social. People book rounds in groups. Every time a creator invites 3 friends to a round, that's 3 potential acquisition events. Currently those invites go out by username search only — there's no shareable link, no "your friend invited you to golf at Pebble Beach this Saturday" landing page.

**Build this immediately:**
- Round invite generates a shareable URL
- Non-users who click land on a pre-filled signup page with the round details visible
- After signup they're auto-added to the round
- Referrer gets 1 month free if the invitee converts to paid

This is the single highest-ROI feature not yet built.

---

## Prioritized Change List

What we'd do differently or do first:

### Immediate (0–30 days) — Before Any Marketing Spend

| # | Action | Owner | Rationale |
|---|---|---|---|
| 1 | Migrate to Stripe Subscriptions with webhooks | Engineering | No subscriptions business without auto-renewal |
| 2 | Decide GolfNow integration or reposition | Product + CEO | Cannot market a fake feature |
| 3 | Add 3-step onboarding flow (course → friend → round) | Engineering | Activation is broken |
| 4 | Move friend requests to free tier | Product | Freemium activation before paywall |
| 5 | Instrument signup → paid conversion funnel | Engineering | Cannot optimize what we cannot measure |

### Near-Term (30–90 days) — MVP Hardening

| # | Action | Owner | Rationale |
|---|---|---|---|
| 6 | Shareable round invite links | Engineering | Highest-ROI growth lever |
| 7 | Course leaderboard (top scores per course) | Engineering | Retention hook + social proof |
| 8 | Shareable score card (PNG export) | Engineering | Organic social distribution |
| 9 | Move AI conversation state to Redis | Engineering | Multi-instance correctness |
| 10 | Expand tournament database to 100+ nationally | Product | Non-east-coast users see empty state |
| 11 | Rate limit AI and search endpoints | Engineering | Cost control before scale |
| 12 | GDPR: user self-deletion API | Engineering | Legal requirement; trust signal |

### Medium-Term (90–180 days) — Growth & Monetization Expansion

| # | Action | Owner | Rationale |
|---|---|---|---|
| 13 | Tournament entry fee commission (5–10%) | Product + Engineering | New revenue stream, zero new acquisition cost |
| 14 | Handicap calculation from round scores | Engineering | Core product depth |
| 15 | Web push notifications | Engineering | Retention: remind users when friends post scores |
| 16 | PWA with home screen install | Engineering | Mobile-first audience |
| 17 | Referral program (1 month free per paid conversion) | Engineering | Viral loop |
| 18 | Seasonal pricing ($29.99 for 6 months) | Product | Aligns price to golf season |
| 19 | B2B pilot: sell to 2–3 golf clubs | Sales | High ACV, long retention |
| 20 | Analytics dashboard (retention, churn, LTV) | Engineering | CFO can now make decisions |

---

## Summary Assessment

| Dimension | Rating | Notes |
|---|---|---|
| **Technical foundation** | ★★★★☆ | Clean stack, good security, solid tests |
| **Product-market fit** | ★★☆☆☆ | Core loop incomplete; no real booking, no retention hook |
| **Monetization** | ★★☆☆☆ | Structural subscription flaw; one revenue stream |
| **Growth engine** | ★☆☆☆☆ | No referral, no virality, no organic loop |
| **Operations readiness** | ★★★☆☆ | Good infra, but observability and runbooks are incomplete |
| **MVP scope fit** | ★★★☆☆ | Overbuilt in some areas (BPMN for simple flows), underbuilt in others (activation, retention) |

**Bottom line:** Par Party has the architecture to scale. It does not yet have the product to grow. The 5 immediate actions above — subscription webhooks, real tee time decision, onboarding, free-tier adjustment, and funnel instrumentation — are not optional. They are the difference between an MVP that tests a hypothesis and a product that burns runway on features nobody activates.

Once those are in place and conversion data exists, double down on the referral program and leaderboards. Those two features, built well, can drive 30–50% of new user acquisition organically.
