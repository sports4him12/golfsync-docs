# League / Course sponsor sample sheets

Three one-page sample sell sheets for the Indoor Golf RVA–type audience
(simulator businesses that run **leagues** and want to show their
**sponsors** love), each modeled on a real sponsor shout-out they'd
otherwise build by hand in Mailchimp. Emphasis: **Leagues** and
**Courses**.

| File | Story | Modeled on | Demo CTA |
|---|---|---|---|
| `1-contest-winners-sponsor` | Closest-to-the-pin winners + sponsor recognition, automated | 35x70 CTP email | `golfsync.io/league/demo` |
| `2-season-league-sponsorship` | One sponsor recognized all season (standings, side games, recap) | Mulligan Headcovers season thank-you | `golfsync.io/league/demo` |
| `3-course-sponsor-reach` | Trackable scan-to-shop offer on the scorecard / bay | Bag Boy promo-code email | `golfsync.io/course-manager-demo` |

Each sheet has a **QR code + clickable demo link** so the reader has an
action to take (scan in person, click in email).

## Using them
- **Send as PDF:** the `.pdf` files are ready to attach/email.
- **Edit then re-export:** edit copy in `build.js` (or styles in
  `_shared.css`), then:
  ```
  node build.js                      # regenerates the .html files
  # open each .html → Print → Save as PDF (Letter), or headless Chrome:
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf=1-contest-winners-sponsor.pdf \
    "file://$PWD/1-contest-winners-sponsor.html"
  ```
- **QR codes** (`qr-*.svg`) are regenerated from the demo URLs with the
  `qrcode` npm package; inlined into the HTML by `build.js`.

## Notes
- On brand: primary orange `#C47028`, navy `#0F2A44`. Emerald is NOT
  used (reserved for under-par scoring in the product).
- Every feature claim maps to a shipped Golf Sync capability. The one
  forward-looking item (Course Manager saved offers / turn coupons) is
  explicitly marked **"rolling out"** on sheet 3 — keep that honest.
- These are HTML→PDF (print path), independent of the product's
  server-side openhtmltopdf renderer, so normal CSS (flex/grid) is fine
  here.
