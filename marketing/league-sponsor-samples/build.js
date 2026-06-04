/* Sample sponsor content for INDOOR GOLF RVA to publish, featuring
   GOLF SYNC as their summer-league sponsor — same shape as the real
   shout-outs they ran for 35x70 / Mulligan Headcovers / Bag Boy.

   Two formats per moment:
     - email block  (drop into their Mailchimp newsletter)
     - one-page sheet (polished leave-behind / PDF)
   Three moments: contest winners, mid-season feature, season recap.

   Voice = Indoor Golf RVA talking to THEIR golfers about their sponsor.
   Angle = LEAGUES — running a league on Golf Sync is FREE, free for
   players, with a deep format menu (Stroke/Stableford/Match Play/Skins/
   Wolf/Vegas/Nassau/BBB + team scrambles). Tournament days from $100 are
   the only paid mention; the Course Manager angle was removed 2026-06-03.
   Run: node build.js */
const fs = require("fs");
const path = require("path");
const dir = __dirname;

const css = fs.readFileSync(path.join(dir, "_shared.css"), "utf8");
const qrLeague = fs.readFileSync(path.join(dir, "qr-league-demo.svg"), "utf8");
// qr-course-manager-demo.svg intentionally no longer used — all CTAs now
// point to the league demo (Course Manager angle removed 2026-06-03).
const qr = (svg, px) => svg.replace("<svg ", `<svg width="${px}" height="${px}" style="display:block" `);

// Real Golf Sync wordmark SVGs (white for navy headers, color for light
// footers). Strip the XML prolog so they inline cleanly; size by height
// and let width auto-scale the 720:230.66 (~3.123:1) artwork.
const stripXml = (s) => s.replace(/<\?xml[^>]*\?>\s*/, "").trim();
const logoWhiteRaw = stripXml(fs.readFileSync(path.join(dir, "logo-white.svg"), "utf8"));
const logoColorRaw = stripXml(fs.readFileSync(path.join(dir, "logo-color.svg"), "utf8"));
const AR = 720 / 230.66;
function logo(variant, height) {
  const raw = variant === "white" ? logoWhiteRaw : logoColorRaw;
  const w = Math.round(height * AR);
  return raw.replace(
    /<svg /,
    `<svg width="${w}" height="${height}" style="display:block" `
  );
}

const PRICE_LINE =
  '<b>Running a league on Golf Sync is free</b>, and it\'s <b>free for every player</b> — ' +
  'live leaderboards, season standings, and a deep menu of formats and side games at no cost. ' +
  'Hosting a one-day tournament? Those start at just <b>$100/event</b>.';

// The format menu — the league differentiator. Real, shipped formats
// (see golfsync.io/formats). Used across the league-focused pieces.
const FORMATS_INLINE =
  'Stroke Play, Stableford, Modified Stableford, Chicago, Match Play, ' +
  'Skins, Wolf, Vegas, Nassau, Bingo-Bango-Bongo, plus team formats like ' +
  'Scramble, Best Ball and Alternate Shot';

/* ───────────────────────── EMAIL BLOCKS ───────────────────────── */
function emailBlock({ title, pills, h2, body, btnLabel, url, qrSvg, usage }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title}</title><style>${css}</style></head><body>
  <div class="usage-banner">${usage}</div>
  <div class="email-wrap">
    <div class="email-feature">
      <div style="display:flex;justify-content:center;">${logo("white", 40)}</div>
      <div class="tagline" style="margin-top:16px;">Proud sponsor of the Indoor Golf RVA Summer League</div>
      <div class="pills">${pills.map(p => `<span class="pill">${p}</span>`).join("")}</div>
    </div>
    <div class="email-body">
      <h2>${h2}</h2>
      ${body}
      <div class="price">${PRICE_LINE}</div>
      <a class="email-btn" href="${url}">${btnLabel}</a>
      <div class="email-qr">
        <div class="box">${qr(qrSvg, 104)}</div>
        <div class="cap">Scan to explore</div>
      </div>
    </div>
    <div class="email-foot">
      <div style="display:flex;justify-content:center;margin-bottom:8px;">${logo("color", 26)}</div>
      <div class="mark" style="font-size:12px;color:var(--muted);">golfsync.io</div>
      <div class="tag">Free leagues &amp; live scoring — one app. Free for players.</div>
    </div>
  </div>
</body></html>`;
}

/* ───────────────────────── ONE-PAGE SHEETS ────────────────────── */
function sheet({ title, eyebrow, h1, sub, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title}</title><style>${css}</style></head><body>
  <div class="sheet">
    <div class="gs-header">
      ${logo("white", 30)}
      <div class="gs-eyebrow">${eyebrow}</div>
      <div class="gs-h1">${h1}</div>
      <div class="gs-sub">${sub}</div>
    </div>
    <div class="gs-body">${body}</div>
    <div class="gs-footer">
      <div class="row"><div style="display:flex;align-items:center;">${logo("color", 22)}</div><div class="cta">golfsync.io</div></div>
      <div class="tag" style="margin-top:6px;">Proud sponsor of the Indoor Golf RVA Summer League · Free leagues &amp; live scoring, one app.</div>
    </div>
  </div>
</body></html>`;
}

function sheetCta(label, url, qrSvg, blurb) {
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
        <div style="background:#fff;border-radius:10px;padding:7px;display:inline-block;">${qr(qrSvg, 84)}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.65);margin-top:5px;letter-spacing:0.5px;">SCAN TO EXPLORE</div>
      </td>
    </tr>
  </table>`;
}

const priceCardSheet = `
  <div class="sponsor-strip" style="text-align:left;">
    <div class="cap">About our sponsor</div>
    <div style="font-size:13px;line-height:1.55;color:var(--navy);margin-top:4px;">
      <strong>Golf Sync</strong> is the app powering our league — and
      <b style="color:var(--orange)">running a league on it is free</b>,
      <b style="color:var(--orange)">free for every player</b> too. Live leaderboards,
      season standings, and a deep format menu at no cost. Hosting a one-day tournament
      runs <b style="color:var(--orange)">just $100</b>.
    </div>
  </div>`;

/* =================================================================
   MOMENT 1 — CONTEST WINNERS  (their 35x70 shout-out shape)
   ================================================================= */
const m1_email = emailBlock({
  title: "IGRVA × Golf Sync — Contest Winners",
  usage: "DRAFT for Indoor Golf RVA's newsletter — featuring Golf Sync as league sponsor. Swap in your real winners; edit freely.",
  pills: ["Leagues", "Free to play", "10+ formats"],
  h2: "Congrats to our closest-to-the-pin winners — James D &amp; Luke P!",
  body: `
    <p>Huge thanks to <strong>Golf Sync</strong> for sponsoring our Summer League.
    Every shot you hit this season is scored in the Golf Sync app, and our
    closest-to-the-pin results went up on the bay leaderboard the second they
    happened — winners and all.</p>
    <p>Golf Sync is a Richmond golf-tech company building the app that runs
    leagues like ours — and <strong>running a league on it is free</strong>, with a
    deep menu of formats and side games built in (${FORMATS_INLINE}). If you've got
    a weekend group, it's the easiest way to run your own season — and for every
    player, it's <strong>free</strong>.</p>`,
  btnLabel: "Explore Golf Sync for your league",
  url: "https://golfsync.io/league/demo",
  qrSvg: qrLeague,
});

const m1_sheet = sheet({
  title: "IGRVA × Golf Sync — Contest Winners (sheet)",
  eyebrow: "Indoor Golf RVA Summer League · Sponsor feature",
  h1: "Closest to the pin: James D &amp; Luke P — scored live on Golf Sync.",
  sub: "A sample of how Indoor Golf RVA features its league sponsor, Golf Sync, in a winners shout-out.",
  body: `
    <div class="section-label">This week in the league</div>
    <p class="lede">
      Our closest-to-the-pin contest was scored in the <strong>Golf Sync</strong>
      app and shown on the bay leaderboard the moment it happened. Thanks to our
      sponsor Golf Sync — the Richmond-built app that runs our whole Summer League.
    </p>
    <div class="sponsor-strip">
      <div class="cap">Closest to the Pin &nbsp;•&nbsp; Scored &amp; shown on</div>
      <div class="who">Golf Sync</div>
      <div class="meta">Winners: James D &amp; Luke P — live on the bay TV and every player's phone</div>
    </div>
    <div class="section-label">Why we run on Golf Sync</div>
    <table class="feat">
      <tr><td class="tick">✓</td><td class="name">Live leaderboards &amp; contests</td><td class="desc">Standings and closest-to-the-pin update on the bay TV and in players' pockets in real time.</td></tr>
      <tr><td class="tick">✓</td><td class="name">A format for every group</td><td class="desc">Stroke, Stableford, Modified Stableford, Chicago, Match Play, Skins, Wolf, Vegas, Nassau, Bingo-Bango-Bongo — plus team scrambles. No side spreadsheet.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Free to run, free to play</td><td class="desc">Running a league costs nothing and every player scores at no cost. (Optional one-day tournaments start at $100.)</td></tr>
    </table>
    ${priceCardSheet}
    ${sheetCta(
      "Run your own free league",
      "https://golfsync.io/league/demo",
      qrLeague,
      "Tour a live league on Golf Sync — leaderboards, season standings, and a deep menu of formats and side games. Free to run, free to play."
    )}
    <p class="note">Sample content for Indoor Golf RVA. Swap in real winners/photos before sending.</p>
  `,
});

/* =================================================================
   MOMENT 2 — MID-SEASON FEATURE  (their Bag Boy "shop local" shape)
   ================================================================= */
const m2_email = emailBlock({
  title: "IGRVA × Golf Sync — Mid-Season",
  usage: "DRAFT for Indoor Golf RVA's newsletter — mid-season sponsor feature. Edit freely.",
  pills: ["Built in RVA", "Free leagues", "10+ formats"],
  h2: "What do Indoor Golf RVA and Golf Sync have in common?",
  body: `
    <p><strong>We're both proud Richmond golf brands.</strong></p>
    <p>Golf Sync powers our Summer League — the live leaderboards on the bay
    screens, the side games, the standings you're chasing. They're a local
    golf-tech company, and we love supporting RVA businesses like us.</p>
    <p>Got a weekend group, a work crew, or a buddies' game? <strong>Running your
    own league on Golf Sync is free</strong> — and so is playing. Pick from a deep
    menu of formats and side games (${FORMATS_INLINE}) and let the app handle the
    scoring. (Hosting a one-day charity or member tournament? Those start at just
    <strong>$100/event</strong>.)</p>`,
  btnLabel: "Start your free league",
  url: "https://golfsync.io/league/demo",
  qrSvg: qrLeague,
});

const m2_sheet = sheet({
  title: "IGRVA × Golf Sync — Mid-Season (sheet)",
  eyebrow: "Indoor Golf RVA Summer League · Sponsor feature",
  h1: "Two proud Richmond golf brands — Indoor Golf RVA &amp; Golf Sync.",
  sub: "A sample mid-season sponsor feature: who Golf Sync is, and why running your own league on it is free.",
  body: `
    <div class="section-label">Meet our league sponsor</div>
    <p class="lede">
      The live leaderboards on our bay screens, the side games, the season
      standings — that's all <strong>Golf Sync</strong>, a Richmond-built golf-tech
      company and our Summer League sponsor. The best part for you:
      <strong>running your own league on it is completely free</strong>.
    </p>
    <table class="compare"><tr>
      <td><div class="card gs">
        <h4>Leagues — free</h4>
        <p>Run your own season at no cost: live leaderboards on the TV, season-long standings, side games, sponsor recognition. <b>Free to run, free to play.</b></p>
      </div></td>
      <td><div class="card gs">
        <h4>Tournament days — from $100</h4>
        <p>Hosting a one-off charity scramble or member event? Same live scoring + leaderboard-on-the-TV, <b>starting at $100/event</b>. Bring your own roster.</p>
      </div></td>
    </tr></table>
    <div class="section-label">A format for every group</div>
    <p class="lede" style="margin-bottom:10px;">
      Pick how your group plays — Golf Sync handles the math and the side pots:
    </p>
    <table class="feat">
      <tr><td class="tick">✓</td><td class="name">Individual</td><td class="desc">Stroke Play, Stableford, Modified Stableford, Chicago, Match Play.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Side games</td><td class="desc">Skins, Wolf, Vegas, Nassau, Bingo-Bango-Bongo — pots tracked automatically, no spreadsheet.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Team</td><td class="desc">Scramble, Best Ball, Alternate Shot for the nights you go 2- or 4-person.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Fair across skill levels</td><td class="desc">A WHS-style Golf Sync Index (GHIN import supported) keeps mixed groups competitive.</td></tr>
    </table>
    ${sheetCta(
      "Start your own free league",
      "https://golfsync.io/league/demo",
      qrLeague,
      "Tour a live league on Golf Sync — leaderboards, season standings, and a deep menu of formats and side games. Free to run, free to play."
    )}
    <p class="note">Sample content for Indoor Golf RVA. Pricing shown is Golf Sync's published starting points.</p>
  `,
});

/* =================================================================
   MOMENT 3 — SEASON RECAP  (their Mulligan "best season yet" shape)
   ================================================================= */
const m3_email = emailBlock({
  title: "IGRVA × Golf Sync — Season Recap",
  usage: "DRAFT for Indoor Golf RVA's newsletter — end-of-season thank-you to the league sponsor. Edit freely.",
  pills: ["Free leagues", "Season standings", "10+ formats"],
  h2: "That's a wrap — our best Summer League yet. Thank you, Golf Sync!",
  body: `
    <p>What a season. Thanks to <strong>Golf Sync</strong> for sponsoring it and
    keeping every leaderboard, side game, and standings race running all summer
    on the app you played in.</p>
    <p>Caught the side-game bug? Start your own group next season —
    <strong>running a league on Golf Sync is free</strong>, it's <strong>free to
    play</strong>, and the format menu is deep (${FORMATS_INLINE}). Hosting a
    one-day event runs just <strong>$100</strong>. Support local — they're an RVA
    company, just like us.</p>`,
  btnLabel: "Start a league or tournament",
  url: "https://golfsync.io/league/demo",
  qrSvg: qrLeague,
});

const m3_sheet = sheet({
  title: "IGRVA × Golf Sync — Season Recap (sheet)",
  eyebrow: "Indoor Golf RVA Summer League · Season recap",
  h1: "Our best Summer League yet — powered &amp; sponsored by Golf Sync.",
  sub: "A sample end-of-season thank-you featuring the league sponsor, with the numbers to show for it.",
  body: `
    <div class="section-label">The season, by the numbers</div>
    <table class="metrics"><tr>
      <td><div class="num">14</div><div class="lbl">League nights</div></td>
      <td><div class="num">60+</div><div class="lbl">Golfers</div></td>
      <td><div class="num">7</div><div class="lbl">Side games</div></td>
      <td><div class="num">$0</div><div class="lbl">Cost to play</div></td>
    </tr></table>
    <p class="lede">
      Every night ran on <strong>Golf Sync</strong> — live leaderboards on the bay
      screens, season-long standings, and side games all summer. Thank you to our
      sponsor for making it our best season yet.
    </p>
    <div class="pullquote">
      "Best winter/summer league we've run — and the scoring just worked, every night."
      <div class="by">— the kind of recap a Golf Sync season writes for itself</div>
    </div>
    <div class="section-label">Run your own next season — free</div>
    <table class="feat">
      <tr><td class="tick">✓</td><td class="name">Free leagues &amp; season standings</td><td class="desc">Order-of-Merit points across the season, side games, live boards. Free to run, free to play.</td></tr>
      <tr><td class="tick">✓</td><td class="name">A format for every group</td><td class="desc">Stroke, Stableford, Modified Stableford, Chicago, Match Play, Skins, Wolf, Vegas, Nassau, Bingo-Bango-Bongo — plus team scrambles.</td></tr>
      <tr><td class="tick">✓</td><td class="name">Tournament days — from $100</td><td class="desc">Hosting a one-day event? Leaderboard on the TV, sponsor recognition, post-event recap. Bring your own roster.</td></tr>
    </table>
    ${sheetCta(
      "Plan your next season on Golf Sync",
      "https://golfsync.io/league/demo",
      qrLeague,
      "Tour a full league — standings, side games, and a deep format menu on the live board. Free to run, free to play."
    )}
    <p class="note">Sample content for Indoor Golf RVA. Replace the sample stats with your real season numbers.</p>
  `,
});

const files = [
  ["email-1-winners.html", m1_email],
  ["email-2-midseason.html", m2_email],
  ["email-3-season-recap.html", m3_email],
  ["sheet-1-winners.html", m1_sheet],
  ["sheet-2-midseason.html", m2_sheet],
  ["sheet-3-season-recap.html", m3_sheet],
];
for (const [name, html] of files) {
  fs.writeFileSync(path.join(dir, name), html);
  console.log("wrote " + name);
}
