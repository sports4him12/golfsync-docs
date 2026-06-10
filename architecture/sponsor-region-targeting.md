# Region-Specific + National Sponsorships via IP Geolocation

**Status:** Design — geo-source verified against prod (2026-06-10) · **Scope:** app-level sponsors (`app_sponsorships`) primary; per-tournament secondary.

> **Verification update (2026-06-10):** the original draft assumed free CloudFront viewer-geo
> headers. **That assumption was tested against prod and FAILED** — see §4. Real API traffic
> (mobile + web) hits the apex `golfsync.io` → ALB **directly**, bypassing the CloudFront
> distribution (which only fronts the `cdn.` subdomain). So `CloudFront-Viewer-*` headers never
> reach the API. The recommended geo-source is now **MaxMind GeoLite2 in-process**, keyed off the
> client IP the API already extracts from `X-Forwarded-For`. This is lower-risk (no prod traffic
> re-routing) and gives better granularity (city+state, not just state).

---

## 1. Executive summary

1. **No device GPS / location permission needed.** The precise case (player mid-round) is already
   pinned to a region by `tournament.course_id → courses.city/state`
   (`LeagueTournament.java:85-86`, `Course.java:29-37`). The imprecise case (home screen, between
   rounds) is covered by IP geolocation at state/metro accuracy with zero prompt.
2. **Signals we already store:** course city+state on every event with a `course_id`; user
   `home_zip` + a `zip_codes` lat/lng/state lookup table (`User.java:71-72`, `migration 050`); and
   the real client IP, already extracted at `RateLimitFilter.java:340` from `X-Forwarded-For`.
3. **The model:** add a normalized `region_scope` string
   (`NATIONAL | STATE:<XX> | METRO:<cbsa|slug> | COURSE:<id>`) to `app_sponsorships`, resolve the
   viewer's region per request via a precedence chain, and filter/order eligible creatives
   most-specific-first with a **guaranteed NATIONAL fallback** so a slot never renders empty.
4. **Geo-source (REVISED, verified):** **MaxMind GeoLite2 `.mmdb`, resolved in-process** off the
   `X-Forwarded-For` client IP. Free DB, no infra/traffic-routing change, gives state + city/metro.
   The CloudFront-header path was ruled out by verification (§4). No paid API — consistent with the
   ~$400/mo posture.
5. **Honest accuracy:** state ≈90%+; city/metro ~55-80%, worse on mobile-carrier + VPN IPs. Sell and
   target at **state granularity first**; metro is best-effort refinement, never a hard gate.

---

## 2. Current state

### 2.1 Two independent sponsor systems

**App-level / platform-sold ad network** (the primary target of this feature):
- Three app-wide placements: `SPLASH_SIGNIN`, `LEAGUE_TOURNAMENT_LEADERBOARD`, `DASHBOARD_BANNER`
  (`AppPlacement.java:16-37`).
- Tables: `app_sponsorships` (placement, company_name, image_url, headline, link_url, link_text
  [mig 250], active, display_order, starts_at/ends_at — `246-app-sponsorships.sql`),
  `app_placement_config` (placement, rotation_mode — `248-…sql`), `app_sponsorship_impressions`
  (dedup on `(app_sponsorship_id, surface, session_id, bucket_start)` — `247-…sql`).
- Resolution: `AppSponsorshipService.resolveListForPlacement(placement)` returns **all** active+live
  creatives for a placement, filtered only by `active` + `[startsAt, endsAt]`
  (`AppSponsorshipService.java:96-105`). Public read `GET /api/app-sponsorships?placement=X`, 60s
  cache, anonymous (`AppSponsorshipController.java:45-58`).
- Admin CRUD `/api/admin/app-sponsorships`, `hasRole('ADMIN')`. Web admin
  `app/admin/app-sponsorships/page.tsx`. Clients: `AppSponsorBanner.tsx` (mobile + web).

> This is the "seen everywhere" surface where a Cleveland brewery vs. a national brand compete for
> the same slot — the system region targeting primarily extends.

**Per-tournament / per-event sponsors:**
- `TournamentSponsor` + `TournamentSponsorTier` hang off `league_tournaments.id`
  (`139-tournament-sponsors.sql`). **Already implicitly geo-bound:** every tournament → `course_id`
  → `courses.city/state`. The thesis "the course's region IS the player's region during a round" is
  **architecturally true today** — but not used for targeting (`resolveEventSponsor` branches only
  on per-sponsor/tier flags + payment, never geography).

### 2.2 Location data inventory (honest)

| Signal | Where | Granularity | Notes |
|---|---|---|---|
| Course city/state | `courses.city`, `courses.state` (2-letter) | State + city | `state` **nullable** on legacy rows (`Course.java:29-37`) |
| Tournament → course | `league_tournaments.course_id` FK | inherits course | **NULL for free-text tournaments** |
| User home | `users.home_zip` VARCHAR(10) | ZIP → lat/lng/state via `zip_codes` | **No state column on users**; only zip |
| ZIP → coords/state | `zip_codes` table | precise | Powers friend-suggestion haversine (`UserRepository.java:76-112`) |
| Client IP | `X-Forwarded-For` leftmost | IP | Extracted at `RateLimitFilter.java:340` (ALB appends client IP) |

**Missing today:** no lat/lng on `courses` (text-only — state is the reliable key); no region/metro
taxonomy; no state column on `users`; no per-request IP→region derivation; no geo field on
`app_sponsorships` or impressions.

---

## 3. Region signal — precedence (all zero-permission)

1. **Active course/tournament region — most precise, free.** If the request has tournament/course
   context, use `course.state` (+ `course.city` for metro). Ground truth — the player is at that
   course. Falls through when `course_id` or `course.state` is NULL.
2. **IP geolocation — state/metro.** For app-wide surfaces with no tournament context, resolve the
   `X-Forwarded-For` client IP → region via MaxMind (§4). State high (~90%+), city/metro ~55-80%.
   **Never persist the raw IP** — store only the derived region code.
3. **Profile / home default.** If IP is unavailable/non-US, use `home_zip → zip_codes.state`.
4. **NATIONAL fallback — always succeeds.** Guarantees a non-empty slot.

**GPS is explicitly ruled out:** the precise case is already solved by the course (signal 1), the
imprecise case only needs state/metro (IP delivers that), and GPS adds a permission prompt +
privacy/App-Review cost for zero incremental value at the granularity we sell.

---

## 4. IP geolocation source — recommendation (REVISED after prod verification)

### What we verified (2026-06-10)

- **CloudFront does NOT front the API.** The CDK CloudFront `Distribution` serves `cdn.${domain}`
  only (`golfsync-cdk-stack.ts:874`), and `cdn.golfsync.io` does not currently DNS-resolve.
- **All real API traffic hits the apex `golfsync.io` → ALB directly.** Mobile config
  `GolfSyncApiBaseUrl: "https://golfsync.io"` (`app.json:33`); web calls its own origin. Prod
  response headers show **no** `Via`/`X-Cache`/`X-Amz-Cf-Id`; `golfsync.io` resolves to AWS ELB IPs
  (`compute-1.amazonaws.com`).
- **Therefore `CloudFront-Viewer-Country` / `-Country-Region` headers never reach the API.** The
  original "free header" plan would have silently failed (resolver always sees no header → NATIONAL
  for everyone).
- **The real client IP IS available** at `RateLimitFilter.java:340` via the leftmost
  `X-Forwarded-For` entry (AWS ALB appends the client IP — documented, non-optional). The code
  comment even names the case: *"Fallback for non-CloudFront paths (dev, direct ALB)."*

### Options now

| Option | Cost | Granularity | Infra change | Risk |
|---|---|---|---|---|
| CloudFront-Viewer headers | $0 | country + state | **Re-route apex through CloudFront** (cert, cache, redirect logic at CDK:1763-1774) | **High — touches all prod traffic** |
| **MaxMind GeoLite2 (in-API)** | **$0** (free DB) | **state + city/metro** | **None** — pure API code | **Low** |
| Paid API (ipinfo/…) | per-lookup $ | city high | external call + recurring cost | medium |

### Recommendation: **MaxMind GeoLite2, resolved in-process. Primary, not fallback.**

- **No prod traffic re-routing.** Stays inside the API, keyed off the same client IP the rate-limiter
  already trusts (`X-Forwarded-For`, `RateLimitFilter.java:340`). Lowest-risk path by far.
- **Free + better granularity** than headers would have given (city/metro, not just state).
- **The cost the original draft tried to avoid** (bundling the `.mmdb` + a refresh job) is real but
  small, and far cheaper than re-architecting prod traffic through CloudFront. The `Dockerfile` has
  no asset-bundling today, so pull the `.mmdb` from S3 at startup (not baked into the image) and
  refresh weekly via a `@SchedulerLock`-guarded job (ShedLock already integrated, `pom.xml:76-77`,
  `ShedLockConfig.java`).
- All geo logic sits behind a `RegionResolver` interface so the source can swap later without
  touching callers.

**Open infra question (not a blocker):** if we later *want* the free CloudFront headers, that's a
separate decision to put the apex behind CloudFront — out of scope here and higher-risk.

---

## 5. Data model

### 5.1 `region_scope` grammar (one normalized string column)

```
NATIONAL                 -- seen everywhere (premium tier)
STATE:<XX>               -- 2-letter ISO subdivision, e.g. STATE:OH
METRO:<cbsa|slug>        -- e.g. METRO:17460 (Cleveland CBSA) or METRO:cleveland-oh
COURSE:<id>              -- pinned to one course (most specific)
```

VARCHAR-not-ENUM, mirroring the existing `placement` convention (app code is source of truth, new
values need no migration). A `RegionScope` value object parses/validates (mirrors
`RotationMode.fromValue`).

### 5.2 `app_sponsorships` — add geo scope (the main change)

```sql
--liquibase formatted sql
--changeset golfsync:<next>-app-sponsorship-region-scope
-- Regional vs national targeting for app-level sponsor creatives.
-- Default NATIONAL so every existing row keeps rendering everywhere (no-op on deploy).
ALTER TABLE app_sponsorships
  ADD COLUMN region_scope VARCHAR(64) NOT NULL DEFAULT 'NATIONAL';

CREATE INDEX idx_app_sponsorships_placement_region
  ON app_sponsorships (placement, active, region_scope);
```

Conventions per team memory: no `updated_at` touched, single changeset, **register in
`db.changelog-master.yaml`**, VARCHAR not DB ENUM, `NOT NULL DEFAULT 'NATIONAL'` → deploy is a no-op
for existing inventory (everything stays national, nothing disappears). Verify the next free
migration number against the master YAML at build time.

### 5.3 Impression geo dimension (privacy-safe)

```sql
--changeset golfsync:<next+1>-app-sponsorship-impression-region
ALTER TABLE app_sponsorship_impressions
  ADD COLUMN viewer_region VARCHAR(64) NULL;  -- STATE:OH | METRO:.. | COURSE:.. | NATIONAL | NULL
```

Dedup key unchanged; `viewer_region` is informational. **Raw IP is never stored** (§9).

### 5.4 Per-tournament sponsors — NO schema change

Already course-scoped by construction (`tournament_id → course_id → courses.state`). A tournament
sponsor only shows inside its own event at its own course's region — no cross-region delivery
question. They contribute the course-region *signal* (#1) read-only. A separate, deferred
league-tournament **regional sponsor request/marketplace** (admin-gated, 10% rev-share — see
`project_league_sponsor_model` memory) is out of scope here.

---

## 6. Resolution algorithm

```
resolveAppSponsors(placement, viewerRegion):
    candidates   = repo.findActiveLiveByPlacement(placement)   # existing isLive filter
    rotationMode = getRotationMode(placement)                  # unchanged, defaults SINGLE

    def tier(scope, viewerRegion):       # lower = more specific = higher priority
        if scope == NATIONAL:                                  return 3   # always eligible
        if viewerRegion == null:                              return INELIGIBLE
        if scope == COURSE:id and viewerRegion is COURSE:id:  return 0
        if scope == METRO:m   and viewerRegion in metro m:    return 1
        if scope == STATE:xx  and viewerRegion.state == xx:   return 2
        return INELIGIBLE

    eligible = [c for c in candidates if tier(c.region_scope, viewerRegion) != INELIGIBLE]
    if eligible is empty: return []                            # nothing booked -> render nothing

    eligible.sort(key = (tier, displayOrder, id))             # most-specific first, stable
    return rotationMode == SINGLE ? [eligible[0]] : eligible   # rotation contract unchanged
```

**Viewer-region resolution (the input)** — a new `RegionResolver`, server-side:

```
viewerRegion(request, tournamentContext):
    if tournamentContext?.course?.state present:
        return COURSE:<courseId>            # carries state+city for metro/state matching
    ip  = leftmost X-Forwarded-For           # RateLimitFilter.java:340 pattern
    geo = maxmind.lookup(ip)                  # state (+ city/metro)
    if geo?.country == US and geo?.state:    return STATE:<geo.state>
    if authedUser?.homeZip:                  return STATE:<zip_codes.state for homeZip>
    return null                               # -> only NATIONAL renders
```

Resolve **server-side** (clients can't see the IP/headers anyway). A `COURSE:` viewer carries the
resolved state+city so a `STATE:OH` creative still matches a player at an Ohio course.

**Cache correctness (real item, not a detail):** the current 60s public cache
(`AppSponsorshipController.java:55`) must become **region-aware** or CloudFront/Next caching serves
one region's ads to everyone. Simplest: `Cache-Control: private, max-age=30` on the geo-resolved
response; keep the public cache only on the legacy no-region path.

---

## 7. Marketplace cold-start

- **NATIONAL fallback fills every slot.** Default `region_scope='NATIONAL'` + always-eligible NATIONAL
  rows → a brand-new Cleveland user with zero Ohio inventory still sees national creatives. Never
  empty (as long as ≥1 national creative is booked per placement — the premium product we keep sold).
- **Course-own sponsors backfill in-round surfaces** regardless of regional ad inventory.
- **Two-tier pricing falls out of the grammar:** NATIONAL = premium "seen by everyone" (highest rate,
  guarantees fill); STATE/METRO = cheaper "only Ohio players" (a regional brewery can afford it).
  Regional sorts **above** national for in-region viewers — that priority is the value they pay for.
- **Sell-through:** start every market NATIONAL-only (works today); as regional advertisers sign,
  their `STATE:`/`METRO:` creatives auto-prioritize for in-region viewers. No migration, no per-market
  config.

---

## 8. Phased build plan

### Phase 1 — State targeting on app sponsors (cheapest high-value slice)
Delivers the full "Cleveland brewery only in Ohio" promise at state granularity.

**API**
- Migration `<next>-app-sponsorship-region-scope.sql` (§5.2) — register in master YAML.
- `RegionScope` value object + `RegionResolver` service: parse grammar; resolve viewer region from
  MaxMind(`X-Forwarded-For` IP) + `homeZip→zip_codes.state` fallback; **never persist raw IP**.
- MaxMind GeoLite2: add the Java reader dep (`geoip2`), pull `.mmdb` from S3 at startup, weekly
  `@SchedulerLock` refresh job (ShedLock present). *(This is the one piece the CloudFront-header plan
  would have avoided — now required, but low-risk and self-contained.)*
- `AppSponsorshipService.resolveListForPlacement` → region filter + most-specific-first order (§6),
  rotation contract intact.
- `AppSponsorshipController.forPlacement` → resolve `viewerRegion` server-side; make response cache
  region-aware (§6).
- `AdminAppSponsorshipController` create/update → accept + validate `regionScope` (default NATIONAL).
- **Tests:** `RegionScope` parse/validate; service matrix (OH viewer + OH/national/MI creatives →
  correct eligible set + order); controller test (missing IP → NATIONAL-only); cache-header test.
  **Run the full slice suite after the controller signature change** (slice tests stub by method
  shape — team memory).
- **Observability:** counter `app_sponsor.region_resolved{source=course|ip|profile|none}`; gauge
  per-region eligible-count; log when MaxMind returns no region.

**Web**
- `app/admin/app-sponsorships/page.tsx` — region selector per creative (National / State); region
  badge in inventory list; update DTOs in `lib/api.ts`.

**Clients**
- `AppSponsorBanner` (mobile + web) need **no change** — region resolves server-side, they still call
  `GET /api/app-sponsorships?placement=X`. **No EAS build needed** (per "no EAS builds unless asked").

> Phase 1 = one API deploy + one web deploy, no mobile release, no prod-traffic re-routing.

### Phase 2 — Course-region precedence (signal #1) + per-region impression reporting
- `RegionResolver` consumes active tournament/course context so an Ohio-course player matches
  `STATE:OH` even on a VPN/out-of-state IP. Thread `course.state/city` on tournament-context surfaces.
- Migration `<next+1>` impression `viewer_region` (§5.3); admin per-region impression breakdown.

### Phase 3 — METRO targeting (only if demand proven)
- MaxMind already gives city/CBSA; map active-course `city` → CBSA for `METRO:` matching, optionally
  IP→city on home screens. Defer until sell-through shows real metro-level advertiser demand.

### Phase 4 (separate track, deferred) — League-tournament regional sponsor request flow
- The admin-gated, 10%-rev-share regional sponsor marketplace (`project_league_sponsor_model`).
  Marketplace/intake feature, not targeting-engine. Out of scope here; noted so it's not conflated.

---

## 9. Risks & open questions

**Verified-closed (were open in the original draft):**
- ~~CloudFront geo headers reach origin?~~ **NO — verified failed (§4).** Pivoted to MaxMind.
- ~~Client IP available on the direct-ALB path?~~ **YES — `X-Forwarded-For` leftmost,
  `RateLimitFilter.java:340`; ALB appends client IP.**

**Still to confirm before building:**
1. **`courses.state` null coverage** — nullable on legacy rows; measure null rate; signal #1 must
   fall through to IP when null.
2. **`zip_codes` ZIP coverage** for the home-state fallback.
3. **MaxMind GeoLite2 license + S3 hosting** — sign up for the free GeoLite2 license key; decide the
   S3 bucket + refresh cadence.

**Accuracy / data quality:**
- VPN / corporate / mobile-carrier IPs mislocate (carrier IPs geolocate to a regional hub). State
  ~90%+, city ~55-80%. **Mitigation:** sell/target at **state**; course-region (signal 1) overrides
  IP during rounds (eliminates VPN error there); never hard-gate on metro.

**Privacy / legal:**
- An IP is **PII-adjacent** (GDPR personal data; relevant only if EU traffic — WAF is US-only today).
  **Baked-in mitigations:** resolve IP → coarse region at request time, **never persist the raw IP**
  (`viewer_region` stores `STATE:OH`, not the IP). No consent prompt (no device permission, no
  precise location). Add one privacy-policy line: "we infer your general region from your network
  address to show relevant local sponsors."

**Rollback:**
- Phase 1 reverts by **config, not redeploy**: `region_scope` defaults NATIONAL → leaving everything
  national reproduces today's behavior. Full back-out: feature-flag the region filter in
  `resolveListForPlacement` (env flag) → unfiltered active+live list. Migration is additive (new
  column + index), safe to leave. Impression `viewer_region` is nullable/informational.

---

## Appendix — files for an engineer starting Phase 1

- `golfsync-api/.../service/AppSponsorshipService.java` (resolution, ~96-105)
- `golfsync-api/.../controller/AppSponsorshipController.java` (public endpoint + cache, ~45-58)
- `golfsync-api/.../controller/AdminAppSponsorshipController.java` (admin CRUD)
- `golfsync-api/.../security/RateLimitFilter.java:329-348` (client-IP extraction pattern to reuse)
- `golfsync-api/src/main/resources/db/changelog/changes/` (+ register in `db.changelog-master.yaml`)
- `golfsync-web/app/admin/app-sponsorships/page.tsx` + `golfsync-web/lib/api.ts` (DTOs)
- **MaxMind:** add `com.maxmind.geoip2:geoip2` to `golfsync-api/pom.xml`; GeoLite2-City.mmdb pulled
  from S3 at startup + weekly ShedLock refresh.
- **NOT** `golfsync-cdk` — the design deliberately avoids any prod traffic-routing change.
