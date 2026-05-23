# Tournament Day — On-Call Support Guide

This is your playbook for being **the person on the other end of the phone** when a Tournament Chair calls during their event. You're the safety net that lets the founder promise "Ryan's on call morning-of" without actually being chained to his phone every weekend.

> **Who this is for:** A part-time support contractor (you) who's never used the product. By the end of section 1 you'll know what Tournament Day is and what the Chair is staring at on their screen. By the end of section 3 you'll know how to triage the 80% of real-time emergencies without escalating.
>
> **Who this is NOT for:** Customers. This is internal. There's a separate customer-facing FAQ at /demo/tournament-day.

---

## 0 · The promise we're keeping

On the landing page we tell Tournament Chairs: **"Ryan's on call morning-of. Weather hold at 7am? One text and we're on it."** That promise is the difference between us and the competition. When the phone rings on event day, the Chair is a stressed volunteer running a fundraiser in front of their board, donors, and 72+ golfers. The right answer in the first 30 seconds is worth more than a perfect answer 20 minutes later.

**Your job is calm + fast triage, not deep debugging.** If you can't fix it in 5 minutes, escalate to Ryan. Don't try to be heroic.

---

## 1 · What Tournament Day actually is (60-second mental model)

A foundation/charity runs a golf tournament once a year. Registration was handled elsewhere (OneCause, Eventbrite, the foundation's CRM). The day before, the foundation uploaded a CSV of the player roster into Golf Sync. On event morning, Golf Sync handles:

1. **The clubhouse TV** — runs a live leaderboard so everyone walking back in after 18 can see who's winning. Rotates between standings, sponsor logos, contest winners.
2. **The players' phones** — players open a join page, find their name, and score live on their phone. Their team's standing updates as they go.
3. **Sponsor recognition** — paid sponsors have logos that rotate on the TV AND show up on the "Hole 7 sponsored by Acme Bank" strip on the player's scorecard.
4. **Day-of announcements** — Chair can push a notification to every player's phone ("Weather hold for 30 min" / "Awards in the clubhouse in 15").
5. **Post-event recap email** — every paid sponsor gets a one-page PDF emailed to them the day after, showing where their logo appeared. Auto-fires; rarely a support concern.

Two surfaces the Chair manages from:
- **Web admin** at `golfsync.io/admin/hosted-tournaments/{slug}/manage` — the big control panel. Most Chair questions point here.
- **Mobile owner dashboard** in the Golf Sync mobile app — slimmer; for day-of "open/close scoring + announce" actions.

---

## 2 · How to start every support call

The Chair will sound panicked. Three questions in this order:

1. **"What's the URL of your tournament page?"** They might say "the slug is graelynn-2026" or paste a URL. You need the slug to open the admin page.
2. **"Are players on the course right now, or is it still setup time?"** Determines urgency. Live event = clock is ticking; pre-event = breathe.
3. **"What are you seeing on screen?"** Get them to describe the symptom, NOT diagnose it. "I see a blank leaderboard" beats "I think the system is broken."

Then open `golfsync.io/admin/hosted-tournaments/{slug}/manage` in your own browser. You need admin access — see section 6.

---

## 3 · Day-of triage — the 10 most common emergencies

Each entry: **symptom** → **first thing to check** → **fix** → **escalate to Ryan if**.

### 3.1 "The leaderboard on the TV is blank / shows 'Loading…'"

**Symptom:** TV is on, browser is on the cast URL, but no players are showing.

**First thing to check:** Open the same URL in your own browser — `golfsync.io/tournaments/{slug}/leaderboard/tv`. Do YOU see anything?

- **If you see scores and they don't:** It's a TV-side issue. Have them refresh the page on the clubhouse computer. If still blank, have them close and reopen the browser tab. If still blank, the clubhouse wifi probably dropped — have them check by browsing to any other website.
- **If you ALSO see a blank board:** Two sub-cases.
  - **No scores have been posted yet** — totally normal for the first 90 minutes. Players haven't finished any holes. Tell them "this fills in once the first hole is scored — give it a tee time."
  - **Scoring isn't open yet** — go to admin → check that tournament status is `SCORING_OPEN`. If it says `DRAFT`, click "Open scoring." This is the single most common support call.

**Escalate to Ryan if:** the admin page shows scoring is open AND players have posted scores AND the leaderboard is still blank. That's a real bug.

### 3.2 "A player can't find their name on the join page"

**Symptom:** Player at `golfsync.io/play/{code}` scrolls the roster, doesn't see themselves.

**First thing to check:** Search by name in the admin → Roster tab. Are they actually on the imported CSV?

- **Not on the roster:** CSV didn't include them. Two fixes:
  - **Fast:** Add them manually via "+ Add player" on the Roster tab.
  - **Investigate later:** Find out why they were missing from the import.
- **On the roster but misspelled:** Edit their name on the Roster tab. They can then find themselves.
- **On the roster with right name:** Have them refresh the join page. Sometimes the page caches the old roster.

**Escalate to Ryan if:** the player is clearly on the roster, page refreshes don't help, AND it's happening to multiple players (suggests a stale CDN cache).

### 3.3 "Scoring is open but a player gets 'tournament not started' when they try to post"

**Symptom:** Player tapped their name, opened their scorecard, hit a score → error.

**First thing to check:** Admin → tournament status. Does it actually say `SCORING_OPEN`?

- **DRAFT:** Open scoring. (Same as 3.1.)
- **SCORING_OPEN but error persists:** Have the player force-close their phone app and reopen. Their device probably has a stale state.

**Escalate to Ryan if:** status is `SCORING_OPEN`, the app has been restarted, and the error persists. That's a JWT or membership-resolution bug.

### 3.4 "The score is wrong — player shot 4 on hole 7, app shows 5"

**Symptom:** Chair or marshal is reviewing the scorecard, finds a wrong number.

**Fix path:** Owner override. Admin → Live Leaderboard tab → find the player → "Edit Score" button → pick the hole → enter the correct number → submit. The correction logs an audit trail visible to members ("corrected by [chair] · [time]").

**Tell them:** "This is a normal use of the override. The leaderboard will update within a refresh cycle (~15s)."

**Escalate to Ryan if:** the override flow itself is broken (e.g., save button does nothing). Otherwise this is a daily-driver feature, not a bug.

### 3.5 "Sponsor logo isn't showing on the TV"

**Symptom:** Chair expected to see Acme Bank's logo rotating in the sponsor spotlight; doesn't appear.

**First thing to check:** Admin → Sponsors tab → find the sponsor row. Two things:

- **Payment status:** Has to be `paid` (or `comped`) — pending sponsors don't surface publicly. Mark paid via "Mark paid."
- **Logo column:** If the row says "Upload logo," there's no logo on file. Upload one via the per-row action. Then refresh the TV browser tab.

**Tell them:** "Sponsors without an uploaded logo fall back to text on the TV. If they paid for logo placement, get the file from them now and upload it."

**Escalate to Ryan if:** the logo IS uploaded (visible thumbnail on the admin row), sponsor IS paid, but it still doesn't appear after a TV refresh.

### 3.6 "Push announcement didn't reach players"

**Symptom:** Chair sent a "weather hold" announcement, players say they didn't get it.

**Reality check:** Push notifications only work for players who (a) installed the mobile app AND (b) granted notification permission. **A player who joined via the web `/play/{code}` page on Safari will NOT get a push.** This is not a bug; it's a constraint.

**Tell them:** "Of your X players, only the ones using the mobile app with notifications on will get push. For the rest, you'll need to send by text or shout it from the clubhouse. We're working on SMS as a fallback."

**Escalate to Ryan if:** even players on the mobile app with notifications on aren't receiving anything. Could be a Firebase/APNS service issue.

### 3.7 "Player completed their card but it's not on the leaderboard"

**Symptom:** Player says they finalized, but their row doesn't appear in standings.

**First thing to check:** Admin → Live Leaderboard tab → search for the player. Do you see them with a "Finalized" status?

- **Yes, but no rank:** They might be unattested (no marker signed their card). Check the marker badge. If it says "Unattested" or "Pending [marker]," the card needs marker sign-off before it counts toward payouts. The leaderboard might still show them; payouts won't.
- **Not in the list at all:** They never started a card OR they're WD/DQ. Check their status in the Roster tab.

**Tell them:** What you found. "The card is in but unsigned" needs a follow-up with the marker; "no card started" needs the player to retry their phone.

**Escalate to Ryan if:** card is FINALIZED + attested but doesn't appear on the leaderboard. Rare; usually a flight-assignment mismatch.

### 3.8 "Two players are tied — who's actually first?"

**Symptom:** Chair sees a tie on the leaderboard, donor / member is asking why one ranks above the other.

**Look at the leaderboard row.** As of 2026-05-23, when there's a tie, the lower-ranked entry shows an inline note: **"Ranked here: Tied on 71 — back 9 broke it (34 vs 38)"**. The math is back-9 score → back-6 → back-3 → last hole, in that order.

**Tell them:** Read the note aloud to the donor. If the leaderboard says "couldn't break by countback" (UNRESOLVED), then the players legitimately tied with no countback resolution; the Chair will need to make a manual call (coin flip, scorecard playoff, whatever the foundation's rules say).

**Escalate to Ryan if:** the math looks wrong (e.g., the player with the better back 9 is ranked LOWER). Real bug.

### 3.9 "The TV browser keeps showing 'reconnecting' — is the event broken?"

**Symptom:** Top of the TV screen shows a "reconnecting" or stale-data banner.

**Reality check:** The TV cast polls every 15 seconds. A momentary network blip will show that banner for a few seconds. The page keeps the last good board visible, so the screen doesn't go blank.

**Tell them:** "If it clears within 30 seconds, ignore it — that's normal network flicker. If it persists more than a minute, the clubhouse wifi is having a real problem; check by trying to load any other website on the same machine."

**Escalate to Ryan if:** the wifi is fine (other sites load) and the banner stays for 5+ minutes.

### 3.10 "I need to add a contest winner (CTP / Long Drive / Hole-in-One) to the leaderboard"

**Symptom:** Marshal handed the Chair a paper note with the contest winner; Chair wants it on the TV.

**Fix path:** Admin → Contests tab → find the contest → enter winner name + measurement + optional sponsor tag → Record. The contest leaderboard rotates onto the TV alongside the score leaderboard.

**Tell them:** "Filled in. It'll appear on the TV within the next 15-second refresh cycle."

**Escalate to Ryan if:** the contest doesn't exist in the Contests tab (Chair forgot to set it up pre-event). They can still create it on the fly, but if the form is broken, that's an escalation.

---

## 4 · Things you should NEVER do without Ryan's OK

The Chair will sometimes ask for things that sound reasonable but have hidden risk. Decline politely and escalate:

- **"Can you DELETE this tournament?"** — No. Wait for Ryan. Deletes cascade.
- **"Can you change the score system mid-event?"** — No. Changes the math retroactively; will confuse everyone.
- **"Can you give me access to the database?"** — Absolutely not. Escalate.
- **"Can you refund our event fee?"** — Not your call. Ryan handles billing.
- **"Can you make this sponsor look paid even though they haven't paid?"** — Use "Comp" if you have to, but flag to Ryan after the call.
- **"Can you push a TestFlight build for me?"** — Mobile build cycles are days, not minutes. Decline.

---

## 5 · The "I have no idea what's wrong" protocol

If the Chair describes a symptom that doesn't match any of section 3:

1. **Capture the facts:** tournament slug, time, player name (if relevant), exact error message (have them screenshot if they can text it).
2. **Tell them:** "I'm looping in Ryan right now. Stand by — I'll text you back within 10 minutes."
3. **Page Ryan.** SMS preferred (he's not on Slack mid-event). Format:
   ```
   GS support: [SLUG] — Chair reports [SYMPTOM]. Time: [HH:MM ET].
   Players on course: [Y/N]. I've checked [WHAT YOU TRIED].
   ```
4. **Stay on the line / stay reachable** until Ryan picks it up. The Chair is in front of donors; they need to feel like someone is on it.

---

## 6 · Access + tools you need before your first shift

Get these set up with Ryan ahead of your first on-call day. None of them work as "I'll figure it out when the call comes in."

- **Admin account on golfsync.io** with TournamentOrganizer role (Ryan grants via the database; takes 2 min). Test by logging into a sample tournament's admin page.
- **Ryan's personal cell** in your phone, named so you can find it in a panic.
- **Sentry access** (read-only) — `sentry.io` org `golfsync`. For when the Chair says "the app keeps crashing." You can see real-time errors there.
- **The customer's contact info** for the events you're covering — given to you 24h ahead by Ryan. Includes Chair's cell, secondary contact, event start time, event duration, expected player count, and the slug.
- **A printed copy of section 3.** When the wifi at your house drops mid-call, you'll thank yourself.

---

## 7 · Pre-event support (lower volume, lower urgency)

Chair calls these in the week leading up to the event. Less stressful; lower stakes. The common ones:

- **"My CSV won't import"** — Admin → Roster Import → paste CSV → click "Preview (dry-run)" FIRST. The preview surfaces format errors inline. Most common cause: column headers don't match the expected names (case-sensitive: `name`, `email`, `team`, `handicap`, `phone`, optional `mulligans`, optional `flight`).
- **"How do I add a sponsor logo?"** — Admin → Sponsors tab → find the row → "Upload logo." 5MB max, PNG/JPG/WebP/GIF.
- **"How do I set up flights?"** — Two-flight (AM + PM shotgun) is built-in. CSV must have a `flight` column with values matching the tournament's flight labels (e.g. "AM" and "PM"). The dry-run preview will warn if any rows have unmatched flight labels.
- **"How do I add a contest?"** — Admin → Contests tab → "Add contest" → pick type (CTP/LD/HoleInOne/Other) → optional hole → optional sponsor tag.

For ANY pre-event question outside this list, the right answer is "I'll get you a written answer from Ryan today" rather than guessing.

---

## 8 · Post-event support (rare, low urgency)

After the event:

- **Sponsor didn't receive their recap email** — Admin → Sponsors → check `recapSentAt` stamp on the row. If null, the cron will pick it up the next morning. If non-null but sponsor didn't get it, check their spam folder, then use "Re-send recap" on the row.
- **"How do I see the final standings?"** — The leaderboard URL stays live indefinitely. They can also export CSV via the admin Sponsors tab "Export CSV" (registrations CSV is on Roster tab).
- **"How do I pay our invoice?"** — Stripe Invoicing handles this; the invoice was emailed separately. Escalate billing questions to Ryan.

---

## 9 · The cheat sheet (post this above your desk)

| Symptom | Open this | First check | Fix |
|---|---|---|---|
| Blank leaderboard | Admin manage page | Tournament status | Open scoring |
| Player not on join page | Roster tab | Is name in CSV? | Add manually |
| Wrong score | Live Leaderboard tab | — | Edit Score override |
| No sponsor logo | Sponsors tab | Payment status + logo column | Mark paid / Upload logo |
| Push didn't arrive | — | Is player on mobile app? | Web join = no push (expected) |
| Tie ranking unclear | Read the inline note | — | Read the back-9 note aloud |
| Contest winner needed | Contests tab | — | Record winner |
| TV "reconnecting" | — | Other websites load? | Wait 30s; flicker is normal |
| Don't know | — | — | Page Ryan |

---

## 10 · After every event you cover

Write Ryan a 5-line note within 24 hours:

```
Event: [slug, date]
Calls received: [count]
Symptoms (each call): [one line each]
Resolutions: [self / escalated]
Anything Ryan should fix in the product: [or "nothing"]
```

This is the loop that turns one-off support calls into product fixes. The "anything Ryan should fix" line is the most valuable; it's the only way the third caller about the same thing doesn't happen.

---

**Last updated:** 2026-05-23. As the product changes, this guide drifts. If you notice something in section 3 no longer matches what you see in the admin, tell Ryan — it gets updated in the same PR as the product change.
