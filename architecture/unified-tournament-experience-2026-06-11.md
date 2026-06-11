# Unified Tournament Experience — capability-driven console + player surfaces

**Status**: RFC — design only, no UI/service code touched yet
**Date**: 2026-06-11
**Model**: the format refactor (`tournament-format-refactor-2026-05-16.md`) — additive descriptor, multi-PR gated cutover, per-row fallback + observability before any delete
**Scope, Phase 1**: web console + web player surfaces. Mobile + backend-fork cleanup are scoped but sequenced later (§9, §10).
**Blast radius (2026-06-11)**: ONE active league today; next live event is Sunday. This materially de-risks the cutover — the migration can be more direct than a multi-tenant base would allow — but the gated discipline still applies to the day-of-touching surfaces because Sunday is live.

---

## 1 · Why

Three tournament "experiences" — **League Tournament**, **Hosted Tournament**, **Tournament Day (TD)** — present as three products. They are not. They are *one backend entity* (`LeagueTournament`, table `league_tournaments`) distinguished by a handful of columns. The drift is almost entirely in the **web UI**, where the same idea was built twice and the player surfaces forked four ways.

The cost is concrete and current:

- **Two near-duplicate management consoles.** The League console (`app/league/[id]/tournament/[tournamentId]/manage/page.tsx`, a clean ~384-line shell that delegates to `components/league/console/*` — 11 tabs that *wrap existing league components*) and the Hosted console (`app/admin/hosted-tournaments/[slug]/manage/page.tsx`, **~8,572 lines**, 21-tab monolith with custom inline tab bodies). Same idea — a tabbed organizer command-center over one `LeagueTournament` — built twice, zero shared shell. The League console's own header comment says it "mirror[s] the hosted/TD admin console… the console is a shell, not a rewrite," which is exactly the duplication we're paying for.
- **Forked player surfaces.** Leaderboards reimplemented across `components/TournamentLiveLeaderboard.tsx` (~606 LOC), `components/LiveLeaderboard.tsx` (~258), `components/league/TeamLeaderboardPanel.tsx`, `BestKLeaderboard.tsx`, `MatchPlayLiveLeaderboardPanel.tsx`. Sponsor strips in `AppSponsorBanner.tsx` + `tournament-day/TvSponsorTierDeck.tsx` + `tournament-day/SponsorSpotlight.tsx`. Scorecards in `ScorecardGrid.tsx` (~1,110 LOC) and friends.
- **Capability gating already exists — but ad-hoc and client-side.** The hosted console *already* filters tabs by `registrationSource === "external"` via per-tab `gatedExternal` / `externalOnly` / `adminOnly` booleans (page.tsx ~line 1215–1246). This is the right idea computed in the wrong place: it lives inline in an 8.5k-line file, is hosted-only, and duplicates branching the server already does (e.g. `TournamentReadinessService` branches on `registrationSource` to route CTAs to `roster-import` vs `registrations`).

**The thesis is already written** — `TOURNAMENT_DAY_DESIGN.md` §"Architectural thesis" states TD and hosted-full are *"the same product with different front doors. Same database, same day-of service layer, same scoring engine. The only differences are: (1) how a tournament gets created, (2) which admin tabs render (gated by a `registrationSource` flag)."* We extend that thesis to **all three** experiences and make the gating **server-derived and authoritative** instead of client-ad-hoc.

**The precedent is already in the codebase.** The format refactor solved the *exact* shape of this problem one layer down: "what kind of tournament is this?" was re-derived from 5 overlapping columns in ~47 places. The fix was `FormatResolver` → one server-computed `FormatDescriptor`, attached to every `LeagueTournamentResponse`, consumed by both clients, cut over surface-by-surface with a per-row legacy fallback and a `[FORMAT_RESOLVER_FALLBACK]` log line gating the final delete. **This RFC does the same thing for "what can this tournament *do*?"** — a `TournamentCapabilityDescriptor` that drives which console tabs and player features render.

---

## 2 · The structural axis that is real: CARDINALITY

Before designing, name the *one* difference that is legitimately structural — everything else is a capability flag.

- A **League** is a **container of N tournaments**. Members (`LeagueMember`), seasons (`LeagueSeason`), and standings persist *across* events. Foundation chain: `League → LeagueMember → LeagueSeason → LeagueTournament → Course`.
- A **Hosted/TD event** is **one-and-done**. There is no surviving roster, no standings carry-forward, no "next event." (Mechanically these *also* have a `League` row — TD/Hosted events are league tournaments under the hood — but it's a singleton container the user never navigates as a league.)

This cardinality difference belongs at the **container level**, not inside the per-event experience. Almost everything *inside* a single tournament — setup, pairings, leaderboard, scorecards, contests, TV, day-of readiness — is identical regardless of how many siblings the event has. The container is the wrapper; the per-event console and player surfaces are the **same shared inner experience**.

Capabilities that look like "type differences" but are really **column-driven feature toggles** (preserve, but as capabilities, not forks):

| Capability | Source column(s) | Today's "type" |
|---|---|---|
| Public microsite | `public_slug` non-null && `is_publicly_listed` | Hosted |
| Sponsor tiers / sponsors | sponsor rows exist OR `registration_source != external` | Hosted |
| Payments / billing | `dues_collection_mode = COLLECT_STRIPE` (or Stripe Connect healthy) | Hosted |
| Flights (AM/PM) | `sibling_tournament_id` / `flight_*` non-null | Hosted |
| Branding | any of `logo_url`/`brand_*_hex`/`hero_image_url`/`tagline` | Hosted |
| Founder approval gate | `live_approved = false` | TD |
| Roster import / claim | `registration_source = external` | TD |
| Standings / season | `season_id` non-null | League |

None of these justify a separate page. Each is a `boolean` the server can compute.

---

## 3 · Target architecture — the `TournamentCapabilityDescriptor`

### 3.1 The descriptor (server-derived, additive, attached to every response)

Mirror `FormatDescriptor` exactly. New DTO `dto/response/TournamentCapabilityDescriptor.java`, computed by a new pure-function `service/tournament/CapabilityResolver.java`, attached to `LeagueTournamentResponse` right next to `formatDescriptor`. One value, computed once, server-side, read by every console tab and player feature on both clients — instead of `registrationSource === "external"` checks sprayed across two console files.

```java
@Data @Builder
public class TournamentCapabilityDescriptor {

    // ── Container cardinality — the one structural axis ──────────────
    /** LEAGUE (N events, members/seasons/standings persist) vs
     *  STANDALONE (one-and-done hosted/TD event). Future: COURSE_VENUE. */
    private String containerType;          // LEAGUE | STANDALONE
    /** Non-null only when this event rolls up into a season standings table. */
    private Long seasonId;

    // ── Capability gates — each drives a console tab + player feature ─
    private boolean hasPublicMicrosite;    // public_slug != null && is_publicly_listed
    private boolean hasSponsorTiers;       // sponsor tier catalog applies
    private boolean hasSponsors;           // sponsor rows exist / can exist
    private boolean hasPayments;           // dues_collection_mode == COLLECT_STRIPE
    private boolean hasFlights;            // sibling_tournament_id / flight_* present
    private boolean hasBranding;           // any brand_* / logo / hero / tagline set or settable
    private boolean hasStore;              // ticket/store product surface enabled
    private boolean hasLeads;              // TD lead-intake surface (founder-side)
    private boolean hasAnnouncer;          // push announce available (claimed-player coverage)

    // ── Lifecycle / access gates ─────────────────────────────────────
    private boolean needsApproval;         // live_approved == false (TD founder gate)
    private boolean isMemberGated;         // league membership required to score
    private boolean isExternalRoster;      // registration_source == external (CSV/claim)
    private boolean isPubliclyListed;      // anonymous microsite access allowed

    // ── Derived convenience (so clients don't re-OR the booleans) ─────
    /** Default landing tab for THIS event's console (Day-of when live,
     *  Setup when draft). One answer instead of two consoles' init logic. */
    private String defaultConsoleTab;
    /** Stable ordered list of tab keys this event should render — the
     *  SERVER decides tab visibility, the client just renders the list.
     *  Replaces the inline gatedExternal/externalOnly/adminOnly filter. */
    private List<String> consoleTabs;
    /** Player-surface feature flags rolled up for the player page. */
    private List<String> playerFeatures;   // SPONSOR_STRIP, FLIGHT_SWITCHER, MICROSITE_HERO, …
}
```

### 3.2 How it derives from today's columns

`CapabilityResolver.resolve(LeagueTournament t)` is a pure function, stateless, no DB (same contract as `FormatResolver`). Derivations:

```
containerType      = isStandaloneContainer(t.league) ? STANDALONE : LEAGUE
                     // STANDALONE = the league is the synthetic singleton
                     // wrapper TD/Hosted create; LEAGUE = a real multi-event league.
                     // Concretely (until §7's container_type column lands):
                     // registration_source == external OR public_slug != null ⇒ STANDALONE.
seasonId           = t.season?.id
hasPublicMicrosite = t.publicSlug != null
isPubliclyListed   = Boolean.TRUE.equals(t.isPubliclyListed)
isExternalRoster   = "external".equals(t.registrationSource)
hasSponsorTiers    = !isExternalRoster                         // TD collects sponsors off-platform
hasSponsors        = !isExternalRoster || sponsorRowsExist(t)
hasPayments        = "COLLECT_STRIPE".equals(t.duesCollectionMode)
hasFlights         = t.siblingTournamentId != null || t.flightLabel != null
hasBranding        = anyNonNull(t.logoUrl, t.brandPrimaryHex, t.brandAccentHex,
                                t.heroImageUrl, t.tagline) || hasPublicMicrosite
needsApproval      = Boolean.FALSE.equals(t.liveApproved)
isMemberGated      = !isExternalRoster   // league/hosted require membership; TD claims roster
hasAnnouncer       = true                // push always available; coverage is a readiness warning
hasLeads           = isExternalRoster    // TD lead-intake is the external-funnel surface
hasStore           = storeProductsEnabled(t)
```

**Precedence note** mirroring `FormatResolver`'s "most-specific wins": where two columns could disagree (e.g. a hosted event with `registration_source=external` but sponsor rows present), the descriptor resolves the *capability* by what the data can support, not by a single SKU flag — the same lesson the 4-3-2 leak taught (`TEAM_MATCH_PLAY` + `BEST_K_BY_HOLE_RANGE` co-occur). `hasSponsors = !isExternalRoster || sponsorRowsExist(t)` is exactly this: don't hide a tab the data needs.

**The server owns tab visibility.** `consoleTabs` is the authoritative ordered list. This kills the inline client filter (hosted page.tsx ~line 1237–1246) and the parallel `needsSeason` filter in the league shell. A new capability = one line in `CapabilityResolver`, not edits in two console files.

---

## 4 · The unified console — ONE `TournamentConsole` shell

### 4.1 Route strategy: shared component behind distinct entry routes

We keep **two entry routes** (they carry different URL identity and access models) but both render **one** `<TournamentConsole>` component:

- `app/league/[id]/tournament/[tournamentId]/manage/page.tsx` — league entry, id-based, `useLeagueTournamentAccess` (OWNER/CAPTAIN + staff bypass).
- `app/admin/hosted-tournaments/[slug]/manage/page.tsx` — standalone entry, slug-based, admin/organizer-grant access.

Each route becomes a **thin adapter** (~40 lines): resolve access, resolve the tournament (by id vs by slug), then render `<TournamentConsole tournament={t} capabilities={t.capabilityDescriptor} access={access} containerHref={backHref} />`. Everything below the route — header, sticky tab strip, `#tab=` deep-link, the single page-root `ConfirmDialog` driven by a pending-confirm union (already the pattern in *both* consoles), `loadAll()` refresh — lives **once** in `components/console/TournamentConsole.tsx`.

Why not collapse to one route family: the slug↔id duality is real (microsite links, TV codes, printed signage all use slug; league deep-links use id), the access models differ, and forcing one route would break live URLs. Two front doors, one room — precisely the `TOURNAMENT_DAY_DESIGN` thesis applied to the console itself.

### 4.2 The unified tab set

There are **12 league tabs + 21 hosted tabs ≈ 23 distinct concepts** today. Unified, capability-gated:

| Tab | Always | Gated by | Replaces (extract from) |
|---|---|---|---|
| **Setup / Readiness** | ✓ | — | `ConsoleSetupTab` + hosted Setup + `LeagueTournamentReadinessCard` |
| **Day-of** | ✓ | — | `ConsoleDayOfTab` + hosted day-of strip |
| **Pairings & Teams** | ✓ | — | `ConsolePairingsTeamsTab` + hosted `TeamsTab`/Pairings |
| **Hole Pars / Course** | ✓ | — | hosted `HoleParsTab` + `ScanCourseSetupPanel`/`PerTeeHolePars` |
| **Leaderboard** | ✓ | — | `ConsoleLeaderboardTab` + hosted leaderboard |
| **Registration / Roster** | ✓ | label flips: `isExternalRoster ? "Roster import" : "Registration"` | `ConsoleRegistrationTab` + hosted `RegistrationsTab` + `roster-import` |
| **Side games / Contests** | ✓ | — | `ConsoleSideGamesTab` + hosted `contests`/`skins`/`MulligansTab` |
| **TV / Broadcast** | ✓ | — | `ConsoleTvTab` + hosted `TVSetupTab`/`tv-setup` |
| **Print Pack** | ✓ | — | hosted `PrintPackTab` |
| **Photos** | ✓ | — | `ConsolePhotosTab` |
| **Standings** | — | `containerType==LEAGUE && seasonId!=null` | `ConsoleStandingsTab` |
| **Branding** | — | `hasBranding` | hosted `branding` |
| **Sponsors** | — | `hasSponsors` | hosted `sponsors` + `tiers` + `LeagueSponsorRequestTab` |
| **Billing / Reconcile / Prices** | — | `hasPayments` | hosted `reconcile`/`prices`/`TournamentBillingPanel`/`ConsolePayoutsTab` |
| **Store** | — | `hasStore` | hosted `StoreTab` |
| **Budget** | — | `hasPayments` | hosted `BudgetTab` |
| **Leads** | — | `hasLeads` | hosted `AdminLeadsTab` |
| **Announcer** | — | `hasAnnouncer` (+ founder) | hosted `AnnouncerTab`/`announce` |
| **Audit** | — | staff/owner | hosted `ScoringAuditTab` |
| **Organizers** | — | `adminOnly` (access, not capability) | hosted `TournamentOrganizersPanel` |

`consoleTabs` from the descriptor produces this ordered, filtered list. The shell renders `<ConsoleTab key>` from a registry — no `tab === "x" && <…>` ladder (the hosted monolith's ~200-line render switch collapses to a map lookup).

### 4.3 Reconciling "wrap existing components" vs "custom tabs"

This is the central design tension, and the answer is: **the League console's approach wins as the pattern; the Hosted console's tab *bodies* are the content to migrate into it.**

The League console already proved the right shape: a thin shell + a `ConsoleTabProps` contract (`components/league/console/types.ts`) + tab components that are *"thin compositions of EXISTING league components with owner controls turned on."* That's the target. The Hosted console violated it by inlining ~8k lines of custom tab bodies and helper functions (`downloadCsv`, `downloadInvoicePdf`, `downloadSignagePdf`, `downloadQrSvg` all live *in the route file*).

Migration of bodies:
1. **Promote `ConsoleTabProps`** to `components/console/types.ts` and widen it: add `capabilities: TournamentCapabilityDescriptor`, keep `tournament`, `access`, `myUserId`, `onChanged`, `requestConfirm`. Every tab receives capabilities so it can self-gate sub-controls (e.g. the Registration tab renders CSV-import vs Stripe-funnel UI from `capabilities.isExternalRoster`).
2. **Extract hosted inline tab bodies into `components/console/tabs/*`** as siblings of the league `Console*Tab` set. Most hosted tabs already exist as `components/admin/*Tab.tsx` (`AnnouncerTab`, `StoreTab`, `BudgetTab`, `AdminLeadsTab`, `PrintPackTab`, `TVSetupTab`, `MulligansTab`, `ScoringAuditTab`, `TeamsTab`, `HoleParsTab`) — they're *already extracted*; they just need to accept the unified `ConsoleTabProps` and be registered in the shared tab registry.
3. **Hoist the route-level helpers** (`downloadCsv`, `csvCell`, the three PDF/QR download helpers) out of page.tsx into `lib/console/downloads.ts` so both entry routes and all tabs share them.

End state: one shell, one tab registry, one `ConsoleTabProps`. Tabs are thin compositions of existing panels — the league pattern — and the hosted custom bodies become registered tab components. Nobody re-implements the shell.

---

## 5 · Unified player surfaces — collapse the forks

The player page is the other half. Today the league player page (`app/league/[id]/tournament/[tournamentId]/page.tsx`, ~2,278 LOC) and the public microsite (`app/tournaments/[slug]/page.tsx`) + `/play/[code]` render forked leaderboards, sponsor strips, and scorecards. Unify into **one family each, parameterized by `FormatDescriptor` + `TournamentCapabilityDescriptor`**, with a thin platform-adapter seam (web first).

### 5.1 ONE leaderboard family

`components/player/Leaderboard/` with a single entry `<TournamentLeaderboard descriptor={formatDescriptor} …>` that switches on `formatDescriptor.authoritativeBoard` + `scoringMethod`:
- `authoritativeBoard==INDIVIDUAL` → individual rows (today's `LiveLeaderboard.tsx`/`TournamentLiveLeaderboard.tsx`).
- `authoritativeBoard==TEAM` + `scoringMethod==BEST_K_OF_N_PER_HOLE` → `BestKLeaderboard` view.
- `authoritativeBoard==TEAM` + `scoringMethod==MATCH_PLAY` → match-play bracket view.
- `authoritativeBoard==TEAM` + `STROKE_TOTAL` (scramble/best-ball) → `TeamLeaderboardPanel` view.

These become **view modules** under one component, selected by the *server-computed* descriptor — not by which page imported which file. The forks collapse into `Leaderboard/views/*` sharing one data-fetch hook, one row primitive, one empty/loading state. This is the *consumer side* of the format-refactor cutover already in flight — the descriptor is already on the response; we're finishing the job by deleting the parallel implementations.

### 5.2 ONE sponsor strip

`components/player/SponsorStrip.tsx`, rendered iff `capabilities.hasSponsors`, with a `variant` prop (`inline` | `tv` | `spotlight`) replacing `AppSponsorBanner.tsx`, `tournament-day/TvSponsorTierDeck.tsx`, `tournament-day/SponsorSpotlight.tsx`. One data source, three render densities.

### 5.3 ONE scorecard

`components/player/Scorecard/` keyed off `formatDescriptor.entryShape` (`ONE_TEAM_SCORE` vs `INDIVIDUAL_SCORES` — the mandatory 4th axis the resolver already computes). Collapses the scorecard files into one grid + display-options module that reads entry shape + `showNet` + cap mode from the response.

### 5.4 Platform-adapter shape (web first)

Each player component splits **logic (hooks) from presentation (platform component)**:
- `lib/player/useTournamentLeaderboard(tournamentId)` — fetch + descriptor-driven view selection. Platform-agnostic, shippable to mobile unchanged.
- `components/player/Leaderboard/web/*` — the web presentation; mobile gets `…/native/*` in the mobile phase (§9). The hook is the contract both consume.

This is the seam that lets the mobile phase reuse the unified logic without re-forking it — and it's why the descriptor *must* be server-side: both platforms read one computed answer.

---

## 6 · The container layer — League wraps the SAME inner experience

The League is a **wrapper**, not a different inner product. Concretely:

- The **league page** (`app/league/[id]/page.tsx`) is the container view: roster (`LeagueMember`), seasons (`LeagueSeason`), standings (`getSeasonStandings`), and a **list of tournaments**. Each tournament links into the *same* `<TournamentConsole>` (owner) and the *same* player surfaces (player) a standalone event uses.
- A **standalone** Hosted/TD event has a synthetic singleton container. Its "container view" is degenerate — there's exactly one event — so the admin list (`app/admin/page.tsx`) *is* the container, and "back" from the console exits to the admin list instead of to a league page. The console's existing back-button logic (league shell exits "up to the league") generalizes to `containerHref` passed by the route adapter.

The descriptor encodes this: `containerType==LEAGUE` lights the **Standings** tab and a season selector in the container; `containerType==STANDALONE` omits them. **The inner console and player surfaces don't change** — they render identically whether the wrapper is a 26-week league season or a one-day charity scramble. That is the whole point: *the difference is the wrapper, not the room.*

Cross-event concerns that legitimately live at the container level (and stay there): season standings / OOM points (`LeagueSeason.pointsScheme`); member handicap pipeline (`LeagueHandicapService`, persists across events); recurring series (`series_id`). Per-event concerns (§4/§5) never reference the container except to read `containerType`/`seasonId` from the descriptor.

---

## 7 · Feature Courses readiness

The capability/container model is the *enabler* for Feature Courses, and it slots in **without re-forking the per-event UI**.

A "Feature Course" product is **a venue running N tournaments across its courses** — i.e. *another container type*. The per-event experience (console + player surfaces) is unchanged; only the wrapper differs. In the descriptor this is a third `containerType`:

```
containerType ∈ { LEAGUE, STANDALONE, COURSE_VENUE }
```

`COURSE_VENUE` lights a venue-scoped container view (the venue's N events across its courses, cross-event leaderboards/standings *scoped to the venue*) and reuses the identical inner console and player surfaces. No new console, no new leaderboard — just a new wrapper, exactly as League is a wrapper today.

**The new entity.** Today `Course` is **global and one-directional** (a tournament opts in via `course_id` or the `LeagueTournamentCourse` join, with `snapshot_hole_pars` frozen), and `CourseManager` is a **venue-side role binding** (many managers per course) — *neither* is the Feature Courses seam. Feature Courses needs a **new container-scoped grouping**. The cleanest path, given the established "one table, discriminator column" pattern: **add `container_type` to `leagues`** (`LEAGUE | STANDALONE | COURSE_VENUE`) and let `CapabilityResolver.containerType` read it directly instead of inferring from `registration_source`/`public_slug`. That single column:
1. Makes `containerType` derivation explicit (removing the §3.2 inference heuristic).
2. Gives Feature Courses its container without a new aggregate.
3. Backfills trivially: `external`/`public_slug` rows → STANDALONE, everything else → LEAGUE.

This is the *same* additive-column-with-backfill move migration 151 used. Feature Courses then ships as: new `container_type=COURSE_VENUE` rows + a venue container view + the existing inner experience. Zero per-event UI fork.

---

## 8 · Migration sequencing — gated, equivalence-tested, never break a live event

Model: the format refactor's phased cutover (additive descriptor → attach-only → client cutover surface-by-surface → per-row fallback + `[FORMAT_RESOLVER_FALLBACK]` observability → delete only after a clean prod soak). **Equivalence gate**: before deleting any old fork, the new unified surface must render **byte-equivalent** (or visually-equivalent + behavior-equivalent) for a **League fixture, a Hosted fixture, and a TD fixture** side-by-side.

This is a **live product** (C2 Adopt is real; GRAELYNN ran a live scramble that bit us on day-of). **Current blast radius is light — one active league, next event Sunday** — so the equivalence harness can run against essentially the full live surface quickly. The discipline that still matters: do NOT cut the day-of-touching tabs over the day before Sunday, and keep the `?legacy=1` fallback live through the event.

### Phase 0 — Descriptor (additive, attach-only). *No UI change.*
- Add `TournamentCapabilityDescriptor` DTO + `CapabilityResolver` + attach to `LeagueTournamentResponse` next to `formatDescriptor`.
- Unit-test the resolver against League/Hosted/TD/4-3-2/flighted fixtures asserting exact capability booleans + `consoleTabs` lists.
- **Nothing consumes it.** Risk: zero. (Format-refactor Phase 2 move.)

### Phase 1 — Web console unification *(first-phase focus)*.
1. **Extract `<TournamentConsole>` shell** from the league console (already the clean ~384-line shell). Promote `ConsoleTabProps` → `components/console/types.ts`, add `capabilities`.
2. **Repoint the league route** at the shared shell. Equivalence-gate against the live league console (the simpler of the two — derisk the shell here first).
3. **Migrate hosted tab bodies** into the shared tab registry one tab at a time (most are already `components/admin/*Tab.tsx`). After each, render-equivalence-test the hosted console against the new shell for that tab. **Riskiest tabs last**: Sponsors, Billing/Reconcile, Roster-import (money + the live funnel).
4. **Repoint the hosted route** at the shared shell once all tabs migrated. The old ~8,572-line page.tsx becomes a ~40-line adapter.
5. **Server owns tabs**: replace both inline tab filters with `capabilities.consoleTabs`.

**De-risk the riskiest cutover (hosted Sponsors/Billing):** keep the old hosted console reachable at a `?legacy=1` query flag through Phase 1 so a live event organizer can fall back instantly if the new shell misbehaves mid-event. Delete `?legacy=1` only after one full hosted event runs day-of on the new shell with zero fallbacks.

### Phase 2 — Web player surfaces.
1. Build `useTournamentLeaderboard` hook + `<TournamentLeaderboard>` view-switcher (consumes `formatDescriptor` already on the response).
2. Equivalence-gate each view (individual / best-K / match / team) against its existing fork on a fixture, then delete the fork.
3. Same for `<SponsorStrip>` (gated by `hasSponsors`) and `<Scorecard>` (keyed by `entryShape`).
4. **Riskiest cutover**: the team/4-3-2 leaderboard — it already caused a live day-of bug. Cut it over last, behind a fixture that replays the GRAELYNN/4-3-2 scenario.

### Phase 3 — Container `container_type` column (enables §7).
- Add `container_type` to `leagues`, backfill, re-point `CapabilityResolver.containerType` to read it. Additive, reversible. Unblocks Feature Courses.

### Phase 4 — Mobile parity (RN/Expo).
- Mobile reads the **same descriptors** off the same response. Build native player presentation against the platform-agnostic hooks from Phase 2. Per the repo's cross-platform-parity mandate, every player surface unified on web gets a native counterpart here.

**Mobile API-compatibility contract (read before touching any mobile-facing endpoint).** The unification is **additive on the server**, so mobile is *not* force-broken by Phases 0–2 — but two rules are mandatory because mobile ships through EAS + store review and cannot "deploy and fix forward" the way web does:
1. **New is safe; rename/remove is not.** `TournamentCapabilityDescriptor` is a *new field* on the existing `LeagueTournamentResponse` (exactly like `FormatDescriptor`). Adding fields never breaks an existing client — mobile ignores the new field until it adopts it. **Do not rename or remove any endpoint or response field mobile currently calls** as part of Phases 0–2.
2. **Backward-compat until the dependent mobile build is live in BOTH stores.** Any endpoint mobile depends on must remain backward-compatible until the mobile build that drops the dependency has shipped to App Store **and** Play. Use the existing `X-Golfsync-Mobile-Build` header to version-gate server behavior where a contract genuinely must change (the server already returns shape-compatible responses for older builds via this header — e.g. the SitePoll array gate). Fork-deletes in Phase 1/2/5 and endpoint changes are **gated on mobile being a cut-over consumer**, not just web.
3. **Mobile changes that ARE needed (and they are real work):** to *benefit* from the unification, mobile must (a) read `capabilityDescriptor` to drive its tab/feature gating the same way web does, and (b) consume the unified player surfaces via the shared `lib/player/*` hooks. This is mobile *adopting* the model, not reacting to a breaking change — sequenced here in Phase 4 precisely so web proves the shape first and mobile follows a stable contract.

**Net answer to "does mobile need changes?":** Yes — but as *adoption* work in Phase 4 (reading the new descriptor + the unified hooks), not as forced reaction to broken endpoints. The additive-descriptor strategy + the `X-Golfsync-Mobile-Build` gate are exactly what keep mobile from breaking while web moves first.

### Phase 5 — Backend fork cleanup *(smallest, last)*.
- Reconcile the **two team entities** (`LeagueTournamentTeam` for Ryder/4-3-2, `TournamentTeam` for scramble/best-ball — routed today by `FormatResolver.rosterSource`). With `rosterSource` now authoritative, unify behind one team-roster abstraction (`TeamRosterResolver` already exists as the seam).
- Fold hosted-only services (sponsor/payment/branding/lead) behind capability checks rather than `registration_source` string compares.

**Ordering rationale**: descriptor first (unblocks everything, zero risk) → console (highest LOC win, the §1 pain) → player surfaces (finishes the format-refactor cutover already underway) → container column (unblocks Feature Courses) → mobile (parity) → backend (cleanup, lowest user-visible risk). Each phase ships independently; none requires the next.

---

## 9 · What stays forked on purpose

Legitimate differences, and where they live in the new model:

| Stays distinct | Why | Where it lives |
|---|---|---|
| **Two entry routes** (league id-route vs hosted slug-route) | Different URL identity (printed slugs/TV codes vs league deep-links) + different access models | Thin route adapters; both render one `<TournamentConsole>` |
| **Container views** (league page vs admin list vs future venue) | Cardinality is real (§2) | Container layer; selected by `containerType` |
| **Standings / seasons** | Only meaningful for N-event containers | League container only; `containerType==LEAGUE && seasonId` |
| **TD founder approval gate** | Real lifecycle gate (`live_approved`) | Capability `needsApproval`; gates "Open Scoring" in the shared Day-of tab |
| **Roster import vs registration funnel** | CSV-claim vs Stripe-funnel are genuinely different intake mechanics | One Registration tab, two sub-UIs selected by `isExternalRoster` |
| **Backend team entities** (until Phase 5) | Ryder match-play roster vs scramble registration-team roster have different shapes | Behind `rosterSource`; unified in Phase 5, not Phase 1 |
| **Microsite as a public route** | Anonymous-accessible marketing surface ≠ the authed player page | `app/tournaments/[slug]` stays a distinct route, but renders the unified player surfaces gated by `hasPublicMicrosite`/`isPubliclyListed` |

The rule: **fork the wrapper and the intake; never fork the inner per-event experience.**

---

## 10 · Verification strategy (per phase)

- **Phase 0 (descriptor)**: `CapabilityResolverTest` with League/Hosted/TD/4-3-2/flighted fixtures asserting every boolean + the exact `consoleTabs` ordered list. (Mirrors `FormatResolver`'s test pattern; CLAUDE.md mandates a unit test in the same commit as any new service.)
- **Phase 1 (console)**: **Render-equivalence harness** — a Cypress spec that loads the old console and the new shell for the *same* fixture and asserts identical tab sets, identical rendered controls per tab, identical confirm-dialog flows. Run for League, Hosted, TD fixtures. Cypress runs via Docker per CLAUDE.md. Gate each tab's delete on its spec passing. Keep `?legacy=1` until one live hosted event completes day-of on the new shell.
- **Phase 2 (player)**: Visual + behavioral equivalence per leaderboard view against its fork; a **replay fixture of the GRAELYNN 4-3-2 day-of scenario** for the team board before deleting `BestKLeaderboard`. Scorecard entry-shape coverage (`ONE_TEAM_SCORE` vs `INDIVIDUAL_SCORES`).
- **Phase 3 (container column)**: Migration test asserting backfill (`external`/`public_slug` → STANDALONE, else LEAGUE) + `CapabilityResolver` reads the column with the same output as the Phase-0 inference (no behavior change on cutover).
- **Phase 4 (mobile)**: Cross-platform-parity check — each web player surface has a native counterpart reading the same descriptor; snapshot tests on the shared hooks.
- **Phase 5 (backend)**: Team-roster unification regression suite across Ryder + scramble + best-ball + 4-3-2 leaderboards; `[FORMAT_RESOLVER_FALLBACK]`-style observability on the unified roster path before deleting either team entity.

**The universal gate**, every phase: *no old fork is deleted until the unified surface render-equals it for a League + Hosted + TD fixture, and (for live-event-touching surfaces) until one real event has run on the new path with a fallback escape hatch available.*

---

## 11 · What this enables

Adding a future event type (e.g. a member-guest invitational, or Feature Courses):
1. No new console. No new player surface. No new leaderboard.
2. Set its capabilities in **one** resolver (`CapabilityResolver`) + pick a `container_type`.
3. The shared `<TournamentConsole>` renders the right tabs; the shared player surfaces render the right features; the right container wraps it.

The point isn't "we can ship Feature Courses next month" — it's that **new tournament experiences become additive (capabilities + a container row), not surgical (fork a console + fork four leaderboards + fork the scorecard)**. Exactly the leverage the format refactor bought one layer down, now bought at the experience layer.

---

## Appendix — critical files

- `golfsync-api/src/main/java/com/golfsync/service/tournament/FormatResolver.java` — the proven pattern `CapabilityResolver` mirrors; lives beside it.
- `golfsync-api/src/main/java/com/golfsync/dto/response/LeagueTournamentResponse.java` — where `formatDescriptor` attaches; `capabilityDescriptor` attaches here.
- `golfsync-web/app/league/[id]/tournament/[tournamentId]/manage/page.tsx` — the clean ~384-line shell that becomes the basis of `<TournamentConsole>`.
- `golfsync-web/app/admin/hosted-tournaments/[slug]/manage/page.tsx` — the ~8,572-line monolith whose tab bodies migrate into the shared registry.
- `golfsync-web/components/league/console/types.ts` — the `ConsoleTabProps` contract promoted/widened to drive every unified tab.
- Player forks to collapse: `golfsync-web/components/TournamentLiveLeaderboard.tsx`, `LiveLeaderboard.tsx`, `components/league/{TeamLeaderboardPanel,BestKLeaderboard,MatchPlayLiveLeaderboardPanel}.tsx`, `AppSponsorBanner.tsx`, `ScorecardGrid.tsx`.
- Foundation (Feature Courses): `League.java`, `LeagueMember.java`, `LeagueSeason.java`, `LeagueTournamentCourse.java`, `Course.java`, `CourseManager.java`.
- Precedent: `tournament-format-refactor-2026-05-16.md`; `TOURNAMENT_DAY_DESIGN.md` ("same product, different front doors").

> **Note on scale:** the Hosted console is now ~8,572 lines / 21 tabs (it has grown), which strengthens the "extract the shell now" urgency. The capability-gating idea is **already present but ad-hoc** in that file (`gatedExternal`/`externalOnly`/`adminOnly`) and in `TournamentReadinessService` (`registrationSource` CTA routing) — this RFC's contribution is making it **server-authoritative** via the same `FormatDescriptor`-style descriptor the codebase already trusts.
