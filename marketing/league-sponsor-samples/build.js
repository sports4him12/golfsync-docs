/* Assembles the three self-contained sponsor sample sheets:
   inlines _shared.css + the demo QR SVGs so each .html is portable
   (open → Print → Save as PDF; or forward as-is). Run: node build.js */
const fs = require("fs");
const path = require("path");
const dir = __dirname;

const css = fs.readFileSync(path.join(dir, "_shared.css"), "utf8");
const qrLeague = fs.readFileSync(path.join(dir, "qr-league-demo.svg"), "utf8");
const qrCourse = fs.readFileSync(path.join(dir, "qr-course-manager-demo.svg"), "utf8");

// Scale the inline QR to a fixed box.
function qrBox(svg) {
  return svg.replace(
    "<svg ",
    '<svg width="84" height="84" style="display:block" '
  );
}

const wordmark = `<div class="gs-wordmark"><span class="gs-dot"></span>Golf Sync</div>`;

function cta(label, url, qrSvg, blurb) {
  return `
  <table style="width:100%;border-collapse:collapse;background:var(--navy);border-radius:16px;margin-bottom:4px;">
    <tr>
      <td style="padding:16px 22px;vertical-align:middle;">
        <div style="text-transform:uppercase;letter-spacing:1.8px;font-size:9.5px;font-weight:800;color:var(--orange);margin-bottom:6px;">See it live</div>
        <div style="font-size:17px;font-weight:800;color:#fff;line-height:1.22;margin-bottom:5px;">${label}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.8);line-height:1.42;margin-bottom:9px;max-width:330px;">${blurb}</div>
        <a href="${url}" style="font-size:12.5px;font-weight:800;color:#fff;background:var(--orange);text-decoration:none;padding:8px 15px;border-radius:9px;display:inline-block;">${url.replace("https://", "")}</a>
      </td>
      <td style="width:112px;padding:14px 20px 14px 0;text-align:center;vertical-align:middle;">
        <div style="background:#fff;border-radius:10px;padding:7px;display:inline-block;">${qrBox(qrSvg)}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.65);margin-top:5px;letter-spacing:0.5px;">SCAN TO TOUR</div>
      </td>
    </tr>
  </table>`;
}

function footer() {
  return `
  <div class="gs-footer">
    <div class="row">
      <div class="mark"><span class="gs-dot"></span>Golf Sync</div>
      <div class="cta">golfsync.io</div>
    </div>
    <div class="tag" style="margin-top:6px;">Run your league. Show your sponsors love. All in one place.</div>
  </div>`;
}

function page({ title, eyebrow, h1, sub, body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${title}</title>
<style>${css}</style></head>
<body>
  <div class="sheet">
    <div class="gs-header">
      ${wordmark}
      <div class="gs-eyebrow">${eyebrow}</div>
      <div class="gs-h1">${h1}</div>
      <div class="gs-sub">${sub}</div>
    </div>
    <div class="gs-body">
      ${body}
    </div>
    ${footer()}
  </div>
</body></html>`;
}

/* ─────────────────────────────────────────────────────────────
   SHEET 1 — Contest winners + sponsor recognition (the 35x70 / CTP story)
   ───────────────────────────────────────────────────────────── */
const sheet1 = page({
  title: "Golf Sync — Contest Winners & Sponsor Recognition",
  eyebrow: "For leagues with sponsors",
  h1: "Your closest-to-the-pin winners — and your sponsor — front and center.",
  sub: "You already thank your sponsors and shout out your winners. Golf Sync captures it as it happens and turns it into something you can send.",
  body: `
    <div class="section-label">The moment, automated</div>
    <p class="lede">
      Tag a contest with its sponsor once. The instant you log the winner,
      <strong>their logo rides next to the result</strong> — on the in-room TV
      leaderboard all day, on your league page, and in the post-event recap you
      send the sponsor. No screenshots, no Canva, no "I'll post it later."
    </p>

    <table class="compare"><tr>
      <td><div class="card hand">
        <h4>How it works today</h4>
        <p>Snap a phone photo of the winner's card, crop it, write the caption, find the sponsor logo, build the email. Every week.</p>
      </div></td>
      <td><div class="card gs">
        <h4>With Golf Sync</h4>
        <p>Log "Closest to the Pin — James D, 3'4&quot;" with 35x70 tagged as the sponsor. It's on the TV and the recap instantly, branded.</p>
      </div></td>
    </tr></table>

    <div class="sponsor-strip">
      <div class="cap">Closest to the Pin &nbsp;•&nbsp; Sponsored by</div>
      <div class="who">35x70 Golf Co.</div>
      <div class="meta">Winner: James D &nbsp;·&nbsp; 3' 4"&nbsp; — shown on the TV board &amp; the league page</div>
    </div>

    <div class="section-label">What's included</div>
    <table class="feat">
      <tr><td class="tick">✓</td><td class="name">Sponsor-tagged contests</td><td class="desc">Closest to the Pin, Longest Drive, Longest Putt, and more — each can carry a sponsor's name &amp; logo.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Plan ahead, fill winners later</td><td class="desc">Set your contest slate before the night; the sponsor's logo shows as "Winner TBD" until you tap in the result.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Live TV leaderboard</td><td class="desc">Cast standings + contests + sponsors to any screen in the bay. Winners and sponsor logos rotate on-screen automatically.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Auto recap to the sponsor</td><td class="desc">After the event, the sponsor gets a branded recap — winners, their logo, and how many golfers saw it.</td></tr>
    </table>

    ${cta(
      "Tour a live league with sponsored contests",
      "https://golfsync.io/league/demo",
      qrLeague,
      "See the leaderboard, the contest board, and how a sponsor's logo follows the winner — set up just like your winter league."
    )}
    <p class="note">Sample layout. Colors, names, and prizes are configurable per league.</p>
  `,
});

/* ─────────────────────────────────────────────────────────────
   SHEET 2 — Season-long league sponsorship (the Mulligan Headcovers story)
   ───────────────────────────────────────────────────────────── */
const sheet2 = page({
  title: "Golf Sync — Season-Long League Sponsorship",
  eyebrow: "For league operators",
  h1: "One sponsor, recognized all season — not just in one email.",
  sub: "Run the whole league on Golf Sync: standings, side games, and a sponsor whose brand shows up every week the league is live.",
  body: `
    <div class="section-label">Give a season sponsor season-long value</div>
    <p class="lede">
      A sponsor who backs the whole winter league deserves more than one thank-you
      post. With Golf Sync, <strong>their banner runs across the season</strong> —
      on every leaderboard, the standings page, and the wrap-up recap that proves
      how many golfers they reached.
    </p>

    <div class="sponsor-strip">
      <div class="cap">This season presented by</div>
      <div class="who">Mulligan Headcovers</div>
      <div class="meta">Shown on the league page, every leaderboard, and the season recap</div>
    </div>

    <div class="section-label">A full league, not a spreadsheet</div>
    <table class="feat">
      <tr><td class="tick">✓</td><td class="name">Order-of-Merit standings</td><td class="desc">Season-long points across every event, with drop-weeks and a finalized champion. Sponsor branding on the standings page.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Side games built in</td><td class="desc">Skins, Wolf, Nassau, Vegas, Bingo-Bango-Bongo, Match Play, Stableford — run real competition without a side spreadsheet.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Handicaps that keep it fair</td><td class="desc">A WHS-style Golf Sync Index per player (GHIN import supported) so all-skill-levels nights stay competitive.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Live leaderboards + league chat</td><td class="desc">Real-time scoring on the bay TV and in players' pockets, plus a league chat to rally the group.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Dues, collected</td><td class="desc">Players pay league dues in-app; you skip the Venmo chase. (Fees pass to the player — no cost to you.)</td></tr>
    </table>

    <div class="pullquote">
      "It was our best winter league yet — and the sponsor got their name in front of every golfer, every week."
      <div class="by">— the kind of recap Golf Sync writes for you, automatically</div>
    </div>

    ${cta(
      "Walk through a full league",
      "https://golfsync.io/league/demo",
      qrLeague,
      "Standings, side games, the live board, and season-long sponsor placement — exactly how you'd run yours."
    )}
    <p class="note">Sample layout. Standings scheme, side games, and sponsor are configurable per league.</p>
  `,
});

/* ─────────────────────────────────────────────────────────────
   SHEET 3 — Course / multi-location sponsor reach (the Bag Boy story)
   ───────────────────────────────────────────────────────────── */
const sheet3 = page({
  title: "Golf Sync — Course & Sponsor Reach",
  eyebrow: "For courses & multi-location operators",
  h1: "Put a local-brand offer in every golfer's hand — and prove it landed.",
  sub: "Golf Sync turns your bays and your scorecard into sponsor real estate, with a scan-to-shop code you can actually track.",
  body: `
    <div class="section-label">A promo code that earns its keep</div>
    <p class="lede">
      "Shop local, 15% off with code RVA15" is a great offer — if golfers see it
      and you can tell it worked. Golf Sync puts a sponsor's offer
      <strong>on the scorecard and on a scannable code at the bay</strong>, then
      shows you the scans, so the next sponsor conversation starts with a number.
    </p>

    <table class="compare"><tr>
      <td><div class="card hand">
        <h4>A code in an email</h4>
        <p>One send, no idea who saw it, no proof for the sponsor beyond "we mentioned you."</p>
      </div></td>
      <td><div class="card gs">
        <h4>A code golfers scan in the bay</h4>
        <p>The offer rides the scorecard + a QR at the screen. Every scan is counted — real proof you reached their buyers.</p>
      </div></td>
    </tr></table>

    <div class="sponsor-strip">
      <div class="cap">At the turn &nbsp;•&nbsp; Presented by</div>
      <div class="who">Bag Boy</div>
      <div class="meta">"15% off the Nitron push cart — code RVA15" &nbsp;·&nbsp; scan-to-shop on every bay</div>
    </div>

    <div class="section-label">For the course / operator</div>
    <table class="feat">
      <tr><td class="tick">✓</td><td class="name">Scorecard-first player experience</td><td class="desc">Your course on the player's phone during the round — the natural place to layer a sponsor offer or a turn coupon.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Per-hole signage + scan-to-shop QR</td><td class="desc">Branded hole signs and bay screens carry the sponsor's logo and a trackable code.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Saved offers &amp; turn coupons <span style="color:var(--muted);font-weight:600;">(rolling out)</span></td><td class="desc">Golfers save a deal to redeem later — recurring value for a local-brand sponsor.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Multi-location ready</td><td class="desc">Run the same sponsor across every location — Scott's Addition, Rocketts Landing, wherever you are next.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Tracked impressions &amp; scans</td><td class="desc">Hand the sponsor a number: how many golfers saw the brand and scanned the code.</td></tr>
    </table>

    ${cta(
      "Tour the Course Manager demo",
      "https://golfsync.io/course-manager-demo",
      qrCourse,
      "See the player scorecard, sponsor placements, and the scan-to-shop offer flow for a managed course."
    )}
    <p class="note">Sample layout. Items marked "rolling out" are in active development. Offers, codes, and locations are configurable.</p>
  `,
});

const files = [
  ["1-contest-winners-sponsor.html", sheet1],
  ["2-season-league-sponsorship.html", sheet2],
  ["3-course-sponsor-reach.html", sheet3],
];
for (const [name, html] of files) {
  fs.writeFileSync(path.join(dir, name), html);
  console.log("wrote " + name);
}
