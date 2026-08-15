# Course Scorecard Backfill — Runbook

How to populate course scorecard data (per-hole par, stroke index, per-tee
slope/rating/yardages) without hand-typing it from a BlueGolf screenshot.

**Status:** built, tested, **not deployed**. Branch `course-coverage-phase0`.

---

## Why the defaults are so cautious

Bad scorecard data throws no exception and shows no symptom. A wrong slope
corrupts every handicap computed from that tee. A wrong stroke index
mis-allocates strokes in Stableford and net play. The error surfaces — if ever —
when a golfer disputes a card weeks later.

So: the kill-switch is OFF, dry-run is ON, and publishing unattended requires
clearing a deliberately narrow gate. Everything else queues for review.

---

## Configuration

| Property | Default | Meaning |
|---|---|---|
| `golfsync.course.scorecard-backfill.enabled` | `false` | Master kill switch. Nothing runs until true. |
| `golfsync.course.scorecard-backfill.dry-run` | `true` | Stages candidates, writes **no** course data. |
| `golfsync.course.scorecard-backfill-throttle-ms` | `800` | Pause between courses. |
| `golfsync.course.scorecard-source-file` | *(unset)* | Path to the JSON-lines data file. Unset = adapter idle. |

---

## The data file

One JSON object per line, so a 40k-course file streams rather than loading whole.

```json
{"name":"Belmont Golf Course","city":"Richmond","state":"VA","holeCount":18,
 "pars":[4,4,3,5,4,4,3,5,4,4,4,3,5,4,4,3,5,4],
 "strokeIndex":[7,3,15,1,9,5,17,11,13,8,4,16,2,10,6,18,12,14],
 "totalPar":72,
 "tees":[{"name":"Blue","slope":131,"rating":71.4,
          "slopeWomen":140,"ratingWomen":76.1,
          "yardages":[400,380,165,520,410,395,180,505,415,
                      405,390,170,510,400,385,175,515,420]}]}
```

Field notes that matter:

- **`totalPar`** is a checksum, not decoration. It's compared against the summed
  per-hole row, and it's the only check that catches a single digit misread.
- **`strokeIndex`** must be a complete 1..N permutation or omitted entirely.
  A partial index is refused — scoring would silently allocate strokes on the
  holes that happen to have one and skip the rest.
- **`holeCount`** comes from the source, never from `courses.holes`. That column
  is hardcoded `18` on all 13,073 OSM-seeded rows and is an assumption, not data.
- **`slopeWomen` / `ratingWomen`** are optional but worth supplying — a tee has
  two USGA ratings and they differ materially.

When a licensed export (e.g. golfapi.io's bulk CSV) arrives, converting it to
this shape is a small script, not a new adapter.

---

## Running it

All endpoints are ADMIN-only.

```bash
# 1. DRY RUN first — stages candidates, writes nothing.
curl -X POST "$HOST/api/admin/course-backfill/run?limit=50&state=VA" \
     -H "Authorization: Bearer $ADMIN_JWT"
# → 202 {"status":"started"}

# 2. Read what it decided.
curl "$HOST/api/admin/course-backfill/status" -H "Authorization: Bearer $ADMIN_JWT"

# 3. Inspect the queue — including WHY anything was held back.
curl "$HOST/api/admin/course-backfill/queue?limit=50" -H "Authorization: Bearer $ADMIN_JWT"

# 4. All proposals for one course, to compare sources side by side.
curl "$HOST/api/admin/course-backfill/course/2516" -H "Authorization: Bearer $ADMIN_JWT"
```

A run returns **202 immediately** — a batch outlives any request timeout. Read
`/status` for the outcome.

---

## The confidence gate

Auto-publish requires **all** of:

1. Every hard validator passes — par 3–6, pars sum to the stated total, stroke
   index a complete unique permutation, slope 55–155, rating in a sane band and
   near par (bounds scale for 9-hole courses).
2. A stroke index is present. Without it the card is knowingly incomplete.
3. Either two independent sources agree, or one source matched the course
   near-exactly on name + city + state.

Anything else → **review queue**. A hard-validator failure → **rejected**, never
written.

**With only one source configured, nothing auto-publishes.** That's the intended
first-run behaviour: everything queues, you review, you decide.

---

## What is never touched

A course carrying `ADMIN` or `COMMUNITY_VERIFIED` tee data is invisible to the
backfill. Enforced twice — the candidate query can't see it, and the write path
refuses again on its own. Overwriting a curated slope produces no error, just
wrong handicaps, so it doesn't rest on one query staying correct.

Published rows are stamped `IMPORTED_VERIFIED`; queue-accepted rows
`IMPORTED_UNVERIFIED`. That stamp is what makes a bad batch identifiable and
reversible:

```sql
-- Undo one run's automated writes without touching curated or user data
DELETE FROM course_tees
 WHERE slope_rating_source = 'IMPORTED_VERIFIED'
   AND slope_rating_submitted_at > '<run start>';
```

**Verify that rollback works before the first non-dry run, not after.**

---

## Suggested first session

1. Deploy with `enabled=false`. Confirm nothing changes.
2. Point `scorecard-source-file` at a small file — 20–50 courses in one state.
3. `enabled=true`, **dry-run still true**. Run it. Read `/status` and `/queue`.
4. Check the rejects: are they genuinely bad data, or is a validator too strict?
5. Only then set `dry-run=false` and re-run the same small batch.
6. Hand-check every published course before widening. Expect one surprise.
7. Widen a state at a time, watching the rejection reasons for a source that
   changed shape.

---

## Statuses

| Status | Meaning | Retried? |
|---|---|---|
| *(null)* / `PENDING` | Never attempted | Yes |
| `REJECTED` | Looked, nothing usable | **Yes** — the web gains pages over time |
| `QUEUED` | Awaiting review | No, until reviewed |
| `PUBLISHED` | Written live | No |
| `SKIPPED_CURATED` | Human data present | No |
| `EXHAUSTED` | Hit the attempt cap | No |

Backoff is `{7, 21, 63, 63}` days. `REJECTED` staying retryable is deliberate:
the catalog format backfill once stamped a terminal status too eagerly and locked
out 664 rows that still had no data.

---

## Known limits

- **One source means no auto-publish.** By design, but it means the first run's
  value is a populated review queue, not populated courses.
- **No review UI yet.** The queue is API-only; accept/reject endpoints are not
  built. Reviewing today means reading JSON.
- **Vendor matching is untested at scale.** `CourseIdentityMatcher` is well unit-
  tested, but a real 40k-row export will surface name collisions the tests don't
  anticipate. Watch the first vendor run's `identityMatchScore` distribution.
- **Women's ratings are captured but not yet used** by handicap math. Wiring
  player gender through to tee selection is a separate change.
