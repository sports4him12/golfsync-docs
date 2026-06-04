# Indoor Golf RVA × Golf Sync — sponsor content samples

Golf Sync sponsors the **Indoor Golf RVA Summer League**. Indoor Golf RVA
already runs polished sponsor shout-outs in their Mailchimp newsletter
(35x70, Mulligan Headcovers, Bag Boy). These are **samples of that same
content with Golf Sync in the sponsor slot** — drop-in drafts they can
publish to feature us, written in their voice, talking to their golfers.

**Angle (revised 2026-06-03):** emphasize **Leagues** — **running a league
on Golf Sync is free**, it's **free for every player**, and the
**format menu is deep** (Stroke / Stableford / Modified Stableford /
Chicago / Match Play / Skins / Wolf / Vegas / Nassau / Bingo-Bango-Bongo
+ team scrambles). The only paid mention is **tournament days from
$100/event**. The Course Manager / $200-mo angle was REMOVED — all CTAs
now point to `league/demo`. Each piece has a clickable demo link + QR.

## The six files — 3 moments × 2 formats

| Moment | Email block (their newsletter) | One-page sheet (leave-behind) | Demo CTA |
|---|---|---|---|
| **Contest winners** (their 35x70 shape) | `email-1-winners` | `sheet-1-winners` | league/demo |
| **Mid-season feature** (their Bag Boy "two RVA brands" shape) | `email-2-midseason` | `sheet-2-midseason` | league/demo |
| **Season recap** (their Mulligan "best season yet" shape) | `email-3-season-recap` | `sheet-3-season-recap` | league/demo |

- **Email blocks** = 600px centered column (image/header → paragraph →
  button), matching their Mailchimp layout. Paste the copy into a
  Mailchimp block, or screenshot/embed.
- **Sheets** = polished one-page PDF (header → feature → format menu →
  demo CTA). Good as an attachment or printed leave-behind.

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
- **League-first framing.** The pitch is "run your own free league" — the
  free price + the format depth are the hooks. `qr-course-manager-demo.svg`
  is no longer referenced by `build.js` (kept on disk in case the course
  angle is wanted again later).
- **Voice = Indoor Golf RVA**, not Golf Sync. First person ("our league,"
  "thanks to our sponsor"). These are theirs to publish.
- **Pricing:** leagues are FREE (free to run, free to play); the only paid
  mention is "tournament days from $100/event." No $200/mo course line.
- On brand: orange `#C47028`, navy `#0F2A44`, no emerald.
- Sample stats/winners are placeholders — swap in real ones before sending.
- ⚠️ Confirm `golfsync.io/league/demo` is live + polished before sending —
  it's the call to action behind every QR + button.
