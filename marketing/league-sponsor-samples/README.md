# Indoor Golf RVA × Golf Sync — sponsor content samples

Golf Sync sponsors the **Indoor Golf RVA Summer League**. Indoor Golf RVA
already runs polished sponsor shout-outs in their Mailchimp newsletter
(35x70, Mulligan Headcovers, Bag Boy). These are **samples of that same
content with Golf Sync in the sponsor slot** — drop-in drafts they can
publish to feature us, written in their voice, talking to their golfers.

**Angle:** emphasize **Leagues** and **Courses** (what resonates with a
simulator/league operator + their audience). Pricing shown as starting
points — **tournament days from $100, Course Manager from $200/mo** —
and the **player app is free**. Each piece has a clickable demo link + QR.

## The six files — 3 moments × 2 formats

| Moment | Email block (their newsletter) | One-page sheet (leave-behind) | Demo CTA |
|---|---|---|---|
| **Contest winners** (their 35x70 shape) | `email-1-winners` | `sheet-1-winners` | league/demo |
| **Mid-season feature** (their Bag Boy "two RVA brands" shape) | `email-2-midseason` | `sheet-2-midseason` | course-manager-demo |
| **Season recap** (their Mulligan "best season yet" shape) | `email-3-season-recap` | `sheet-3-season-recap` | league/demo |

- **Email blocks** = 600px centered column (image/header → paragraph →
  button), matching their Mailchimp layout. Paste the copy into a
  Mailchimp block, or screenshot/embed.
- **Sheets** = polished one-page PDF (header → feature → checklist →
  pricing → demo CTA). Good as an attachment or printed leave-behind.

## Using / editing
- The `.pdf` files are ready to send. To edit, change copy in `build.js`
  (one place — `PRICE_LINE`, the three moments), then:
  ```
  node build.js          # regenerates all 6 .html files
  # then print each .html → Save as PDF, or headless Chrome:
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf=email-1-winners.pdf "file://$PWD/email-1-winners.html"
  ```
- QR codes (`qr-*.svg`) regenerate from the demo URLs via the `qrcode`
  npm package; inlined by `build.js`.

## Notes
- **Real Golf Sync logo** is inlined (`logo-white.svg` on navy headers,
  `logo-color.svg` on light footers) — copied from
  `golfsync-web/public/brand/`. Self-contained, no network dependency.
- **Course framing is value-add, not replacement.** Per the managed-course
  scope, the course product is a *digital player experience during the
  round* (live scorecard, deals/offers, on-property leaderboards) — NOT a
  membership / tee-time / course-ops replacement. Don't reintroduce
  "your whole course on Golf Sync" type copy.
- **Voice = Indoor Golf RVA**, not Golf Sync. First person ("our league,"
  "thanks to our sponsor"). These are theirs to publish.
- **Pricing:** "starting at $100/event" + "$200/mo" + "free for players."
  This is a deliberate "starting at" framing for warm sponsor content;
  the product landing pages use the firmer "$100/event" offer framing per
  the locked B2B pricing note — keep that distinction if repurposing.
- On brand: orange `#C47028`, navy `#0F2A44`, no emerald.
- Sample stats/winners are placeholders — swap in real ones before sending.
- ⚠️ Confirm the two demo pages (`golfsync.io/league/demo`,
  `golfsync.io/course-manager-demo`) are live + polished before sending —
  they're the call to action.
