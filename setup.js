#!/usr/bin/env node
const crypto = require("crypto");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── CONFIG ──────────────────────────────────────────────────────────
const ADMIN_CODE = "Qwerty1234!";
const DEFAULT_USER_CODE = "carta2026";
const DEFAULT_DISCLAIMER =
  "<h2>Antes de continuar…</h2>" +
  "<p>Lo que vas a leer es una carta larga y personal. Léela cuando tengas tiempo y tranquilidad.</p>" +
  "<p>Si no es buen momento, puedes volver cuando quieras.</p>";
const DEFAULT_LETTER =
  "<h2>Para ti</h2>" +
  "<p>Aquí empieza la carta. El administrador puede editarla desde el panel.</p>";
const DEFAULT_FAREWELL =
  "<p>Respeto tu decisión. Puedes volver cuando quieras leerla, estará aquí esperando.</p>";
const PAGE_TITLE = "Una carta para ti";
const GITHUB_OWNER = "AndresRomero2001";
const GITHUB_REPO = "letter";
// ────────────────────────────────────────────────────────────────────

const ADMIN_HASH = crypto.createHash("sha256").update(ADMIN_CODE).digest("hex");
const GITHUB_API_FILE =
  "https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/data.json";
const DEPLOY_URL =
  "https://" + GITHUB_OWNER.toLowerCase() + ".github.io/" + GITHUB_REPO + "/";

// ── Get GitHub token ────────────────────────────────────────────────
let ghToken;
if (process.argv[2]) {
  ghToken = process.argv[2];
  console.log("GitHub token provided via argument");
} else if (process.env.GH_TOKEN) {
  ghToken = process.env.GH_TOKEN;
  console.log("GitHub token provided via GH_TOKEN env var");
} else {
  try {
    ghToken = execSync("gh auth token", { encoding: "utf8" }).trim();
    console.log("GitHub token obtained from gh CLI");
  } catch {
    console.error("ERROR: Provide token as argument or run 'gh auth login'.");
    process.exit(1);
  }
}

// ── Encrypt token with a password (PBKDF2 + AES-256-GCM) ───────────
function encryptToken(token, password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(token, "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    salt.toString("hex") + ":" +
    iv.toString("hex") + ":" +
    tag.toString("hex") + ":" +
    encrypted.toString("hex")
  );
}

const encAdminToken = encryptToken(ghToken, ADMIN_CODE);
const encUserToken = encryptToken(ghToken, DEFAULT_USER_CODE);

// ── Write data.json (only if it does not already exist) ────────────
const dataPath = path.join(__dirname, "data.json");
if (fs.existsSync(dataPath) && !process.argv.includes("--force-data")) {
  console.log("data.json already exists — leaving it untouched (pass --force-data to overwrite)");
} else {
  const dataJson = {
    userCode: DEFAULT_USER_CODE,
    encUserToken: encUserToken,
    disclaimer: DEFAULT_DISCLAIMER,
    letter: DEFAULT_LETTER,
    farewell: DEFAULT_FAREWELL,
    textAlign: "justify",
    pageDisabled: false,
    // PRIVATE-MODE: soft screen-capture deterrents on user view. Safe default
    // is false (no deterrents). Admin can toggle in settings.
    privateMode: false,
    // INVISIBLE-TEXT: render letter/disclaimer/farewell text transparent so
    // the reader only reveals it by selecting with the mouse. Safe default
    // is false. Admin toggles in settings.
    invisibleText: false,
    // GATE-TEXT: admin-editable copy for the login screen (the first screen
    // the user sees). Defaults match the previously-hardcoded strings so
    // behavior is unchanged until the admin customizes them.
    gateTitle: PAGE_TITLE,
    gateSub: "Introduce el código de acceso",
    progress: { maxPercent: 0, lastPercent: 0, lastUpdated: "" },
    logs: []
  };
  fs.writeFileSync(dataPath, JSON.stringify(dataJson, null, 2));
  console.log("data.json created");
}

// ── HTML template ───────────────────────────────────────────────────
function buildHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<title>${PAGE_TITLE}</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%93%9C%3C/text%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Cinzel:wght@500;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg1: #0f0c29; --bg2: #302b63; --bg3: #24243e;
  --card: rgba(255,255,255,0.07);
  --border: rgba(255,255,255,0.12);
  --accent: #8b5cf6; --accent-d: #6d28d9;
  --text: #fff; --muted: rgba(255,255,255,0.55);
  --err: #f87171; --ok: #34d399;
  --papyrus-ink: #112a45;
  --papyrus-ink-soft: rgba(17,42,69,0.72);
  --sky-shadow: #153a5c;
  --sky-dark: #2c5b80;
  --sky-deep: #4b8dba;
  --sky-mid: #7ab8dc;
  --sky-base: #a8d5ed;
  --sky-light: #cfe6f4;
  --sky-highlight: #eaf4fb;
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  /* overflow-x:clip prevents horizontal scroll WITHOUT turning body into
     a scroll container. overflow-x:hidden does turn body into a scroll
     container, which was breaking position:sticky for the progress bar. */
  min-height:100vh;overflow-x:clip;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  background:linear-gradient(135deg,var(--bg1),var(--bg2),var(--bg3));
  color:var(--text);
}
body.letter-mode{
  background:#0d0b1a;
  background-attachment: fixed;
}
.screen{
  width:100%;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;
}
.card{
  background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid var(--border);border-radius:24px;
  padding:40px 32px;max-width:420px;width:100%;text-align:center;
  box-shadow:0 8px 32px rgba(0,0,0,.3);
}
.card.wide{max-width:1300px;text-align:left;padding:28px 28px 20px}
.lock{font-size:48px;margin-bottom:12px}
h1{font-size:1.4rem;font-weight:600;margin-bottom:6px}
.sub{color:var(--muted);font-size:.88rem;margin-bottom:28px}
input[type=password],input[type=text]{
  width:100%;padding:14px 18px;border:2px solid rgba(255,255,255,.15);
  border-radius:14px;background:rgba(255,255,255,.06);color:#fff;
  font-size:1.05rem;letter-spacing:2px;text-align:center;outline:none;
  transition:border .3s,box-shadow .3s;margin-bottom:16px;
}
input:focus{border-color:rgba(139,92,246,.8);box-shadow:0 0 0 4px rgba(139,92,246,.15)}
.btn{
  width:100%;padding:14px;border:none;border-radius:14px;
  background:linear-gradient(135deg,var(--accent),var(--accent-d));
  color:#fff;font-size:1rem;font-weight:600;cursor:pointer;
  transition:transform .15s,box-shadow .3s;
}
.btn:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(139,92,246,.4)}
.btn:active{transform:translateY(0)}
.btn-sm{width:auto;padding:10px 20px;font-size:.9rem;border-radius:10px}
.btn-ghost{
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
}
.btn-ghost:hover{background:rgba(255,255,255,.14);box-shadow:0 4px 20px rgba(0,0,0,.25)}
.btn-danger{background:linear-gradient(135deg,#ef4444,#b91c1c)}
.btn-danger:hover{box-shadow:0 4px 20px rgba(239,68,68,.4)}
.error{color:var(--err);font-size:.85rem;margin-top:8px;min-height:20px}
.shake{animation:shake .4s ease}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.fade-in{animation:fadeIn .5s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.hidden{display:none!important}

.admin-badge{
  display:inline-block;background:rgba(139,92,246,.2);border:1px solid rgba(139,92,246,.4);
  border-radius:8px;padding:4px 12px;font-size:.8rem;font-weight:600;
  color:var(--accent);
}
/* Sticky top bar for admin — keeps the logout button always reachable */
.admin-topbar{
  position:sticky;top:0;z-index:40;
  display:flex;justify-content:space-between;align-items:center;gap:12px;
  margin:-28px -28px 18px;padding:14px 28px;
  background:rgba(14,10,28,0.9);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  border-bottom:1px solid rgba(139,92,246,.22);
  border-radius:24px 24px 0 0;
}
.admin-topbar .link-btn{font-size:.88rem}
.tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}
.tab{
  padding:8px 14px;border-radius:10px;border:none;background:rgba(255,255,255,.06);
  color:var(--muted);cursor:pointer;font-size:.85rem;font-weight:500;transition:.2s;
}
.tab:hover{background:rgba(255,255,255,.1);color:#fff}
.tab.active{background:rgba(139,92,246,.25);color:var(--accent)}

/* Segmented pill group (used for text-align picker) */
.segmented{
  display:inline-flex;background:rgba(255,255,255,.05);padding:4px;
  border:1px solid rgba(255,255,255,.12);border-radius:12px;gap:2px;
}
.segmented-btn{
  flex:1;padding:10px 18px;border:none;border-radius:8px;cursor:pointer;
  background:transparent;color:var(--muted);font-size:.9rem;font-weight:500;
  transition:.15s;white-space:nowrap;
}
.segmented-btn:hover{background:rgba(255,255,255,.06);color:#fff}
.segmented-btn.active{
  background:linear-gradient(135deg,var(--accent),var(--accent-d));
  color:#fff;box-shadow:0 2px 8px rgba(139,92,246,.35);
}

/* Rich text toolbar */
.toolbar{
  display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;
  padding:6px;background:rgba(255,255,255,.05);border-radius:10px;
}
.toolbar button{
  width:36px;height:36px;border:none;border-radius:8px;
  background:rgba(255,255,255,.08);color:#fff;cursor:pointer;
  font-size:.9rem;display:flex;align-items:center;justify-content:center;
  transition:.15s;
}
.toolbar button:hover{background:rgba(139,92,246,.3)}
.toolbar .size-btn{
  width:auto;padding:0 10px;gap:4px;font-weight:600;
}
.toolbar .toolbar-sep{
  width:1px;height:24px;background:rgba(255,255,255,.12);
  align-self:center;margin:0 4px;
}

.richtext{
  min-height:200px;max-height:500px;overflow-y:auto;
  padding:16px;border:2px solid rgba(255,255,255,.1);border-radius:12px;
  background:rgba(255,255,255,.04);outline:none;line-height:1.7;
  font-size:.95rem;color:#fff;
}
.richtext:focus{border-color:rgba(139,92,246,.5)}
.richtext h2{font-size:1.2rem;margin-bottom:8px}
.richtext p{margin-bottom:8px}
.richtext img{max-width:100%;border-radius:12px;margin:8px 0;cursor:pointer}
.richtext img.img-selected{outline:3px solid var(--accent);outline-offset:2px}
input[type=file]{display:none}

.img-resize-popup{
  position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;
  background:rgba(30,27,60,.97);border:1px solid rgba(139,92,246,.4);
  border-radius:16px;padding:20px 24px;box-shadow:0 12px 40px rgba(0,0,0,.5);
  min-width:260px;
}
.img-resize-popup h3{font-size:.95rem;margin-bottom:14px;color:#fff}
.img-resize-popup .fields{display:flex;gap:10px;margin-bottom:14px}
.img-resize-popup .fields label{font-size:.8rem;color:var(--muted)}
.img-resize-popup .fields input{
  width:90px;padding:8px 10px;border:2px solid rgba(255,255,255,.15);
  border-radius:10px;background:rgba(255,255,255,.06);color:#fff;
  font-size:.9rem;text-align:center;outline:none;letter-spacing:0;
}
.img-resize-popup .btns{display:flex;gap:8px;justify-content:flex-end}
.img-resize-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;background:rgba(0,0,0,.4)}

.field{margin-bottom:16px}
.field label{display:block;font-size:.85rem;color:var(--muted);margin-bottom:6px}
.field input{text-align:left;letter-spacing:1px;font-size:.95rem}

.status{font-size:.85rem;margin-top:10px;min-height:20px}
.status.ok{color:var(--ok)}
.status.err{color:var(--err)}

.footer{margin-top:20px;text-align:center;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)}
.link-btn{
  background:none;border:none;color:var(--muted);cursor:pointer;
  font-size:.85rem;text-decoration:underline;
}
.link-btn:hover{color:#fff}

.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);
  border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}

.toggle-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px}
.toggle-row label{font-size:.85rem;color:var(--muted)}
.toggle{position:relative;width:48px;height:26px;cursor:pointer;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.toggle .slider{
  position:absolute;top:0;left:0;right:0;bottom:0;
  background:rgba(255,255,255,.15);border-radius:13px;transition:.3s;
}
.toggle .slider:before{
  content:"";position:absolute;height:20px;width:20px;left:3px;bottom:3px;
  background:#fff;border-radius:50%;transition:.3s;
}
.toggle input:checked+.slider{background:var(--accent)}
.toggle input:checked+.slider:before{transform:translateX(22px)}

/* Disclaimer screen */
.disclaimer-card{
  background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid var(--border);border-radius:24px;
  padding:36px 36px;max-width:680px;width:100%;
  box-shadow:0 8px 32px rgba(0,0,0,.3);
}
.disclaimer-card .icon{font-size:44px;text-align:center;margin-bottom:12px}
.disclaimer-content{
  line-height:1.7;font-size:.98rem;color:rgba(255,255,255,.9);
  margin-bottom:28px;max-height:55vh;overflow-y:auto;padding-right:10px;
  /* Firefox */
  scrollbar-width:thin;
  scrollbar-color:rgba(139,92,246,.55) rgba(255,255,255,.05);
}
/* WebKit (Chrome/Edge/Safari) — slim purple scrollbar that matches the theme */
.disclaimer-content::-webkit-scrollbar{width:8px}
.disclaimer-content::-webkit-scrollbar-track{
  background:rgba(255,255,255,.04);border-radius:4px;margin:4px 0;
}
.disclaimer-content::-webkit-scrollbar-thumb{
  background:linear-gradient(180deg,rgba(139,92,246,.55),rgba(109,40,217,.75));
  border-radius:4px;border:1px solid rgba(255,255,255,.08);
}
.disclaimer-content::-webkit-scrollbar-thumb:hover{
  background:linear-gradient(180deg,rgba(167,139,250,.7),rgba(139,92,246,.9));
}
.disclaimer-content h2{font-size:1.25rem;margin-bottom:10px;color:#fff;text-align:center}
.disclaimer-content p{margin-bottom:10px}
.disclaimer-content img{max-width:100%;border-radius:12px;margin:8px 0}
.disclaimer-content a{color:#a78bfa}
.disclaimer-actions{display:flex;gap:12px;flex-wrap:wrap}
.disclaimer-actions .btn{flex:1;min-width:140px}

/* Farewell screen */
.farewell-card{text-align:center}
.farewell-card .icon{font-size:48px;margin-bottom:12px}
.farewell-card p{color:rgba(255,255,255,.8);line-height:1.7;margin-bottom:10px}
.farewell-content{
  color:rgba(255,255,255,.85);line-height:1.7;margin:0 0 24px;
  max-height:40vh;overflow-y:auto;padding-right:8px;
  scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.55) rgba(255,255,255,.05);
}
.farewell-content::-webkit-scrollbar{width:8px}
.farewell-content::-webkit-scrollbar-thumb{background:rgba(139,92,246,.5);border-radius:4px}
.farewell-content h2{font-size:1.1rem;margin-bottom:8px;color:#fff}
.farewell-content p{margin-bottom:8px;color:rgba(255,255,255,.85)}
.farewell-content a{color:#a78bfa}

/* ─────────── PAPYRUS ─────────── */
.letter-wrap{
  width:100%;max-width:1300px;margin:0 auto;padding:30px 16px 60px;
  display:flex;flex-direction:column;align-items:center;
}
.letter-header{
  width:100%;display:flex;justify-content:space-between;align-items:center;
  margin-bottom:20px;gap:12px;flex-wrap:wrap;
}
.letter-header .title{
  font-family:'Cinzel',serif;font-size:1.1rem;letter-spacing:3px;
  color:rgba(180,218,245,.88);text-transform:uppercase;
  text-shadow:0 0 20px rgba(120,180,230,.3);
}
.letter-header .actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
/* Sticky progress bar — stays glued to the top while the user scrolls */
.progress-sticky{
  position:sticky;top:0;z-index:30;
  background:rgba(14,10,28,0.88);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  margin:-22px -22px 14px;padding:12px 22px 10px;
  border-radius:16px 16px 0 0;
  border-bottom:1px solid rgba(139,92,246,.18);
}
/* Admin preview variant — stacks below the admin topbar (≈60px) so the
   two sticky elements don't overlap while the admin scrolls the preview. */
.admin-progress-sticky{ top:60px; z-index:20; border-radius:10px; }
.progress-outer{
  width:100%;height:10px;background:rgba(139,92,246,.16);border-radius:5px;
  overflow:hidden;position:relative;
  border:1px solid rgba(139,92,246,.35);
  box-shadow:inset 0 1px 2px rgba(0,0,0,.35);
}
.progress-inner{
  height:100%;width:0%;border-radius:5px;transition:width .3s ease;
  background:#8b5cf6;
  box-shadow:0 0 10px rgba(139,92,246,.6);
}
.progress-label-row{
  display:flex;justify-content:space-between;font-size:.78rem;
  color:rgba(210,196,255,.75);margin-bottom:8px;letter-spacing:1px;
}

/* Image-based papyrus: header PNG + tiled body PNG + footer PNG */
/* max-width controls the scroll width. letter-column inside is capped at
   760px, so widening the papyrus only widens the decorative pixel border
   on either side — the text column stays the same width. */
.papyrus{
  position:relative;width:100%;max-width:1500px;margin:0 auto;padding:0;
  filter:drop-shadow(0 22px 50px rgba(0,0,0,.55));
}
.papyrus-header-img,.papyrus-footer-img{
  display:block;width:100%;
  image-rendering:pixelated;
  image-rendering:crisp-edges;
  pointer-events:none;
  user-select:none;
}
/* Crop the empty "scroll interior" out of the header/footer PNGs so the
   title sits right below the roll and the last paragraph sits right above
   the closing roll — reduces the big empty gap the user complained about. */
.papyrus-header-img{
  height:clamp(140px, 22vw, 280px);
  object-fit:cover;object-position:center top;
  margin-bottom:-1px;
}
.papyrus-footer-img{
  height:clamp(120px, 18vw, 240px);
  object-fit:cover;object-position:center bottom;
  margin-top:-1px;
}
.papyrus-body{
  position:relative;
  /* body tile repeats vertically, stretched to container width */
  background-image:url('papyrus_body.png');
  background-repeat:repeat-y;
  background-size:100% auto;
  background-position:top center;
  image-rendering:pixelated;
  padding:12px 10% 20px;
  min-height:40vh;
  overflow:hidden;
}
/* Inner text column: narrower than the papyrus body so the text fits inside
   the "paper" region (the body is narrower than the header/footer rolls).
   A soft dark wash sits behind the text to boost contrast over the busy
   pixelated papyrus without hiding it. */
.letter-column{
  position:relative;z-index:3;
  max-width:760px;margin:0 auto;
  padding:18px 26px;
  background:rgba(12,8,22,.55);
  border-radius:6px;
  box-shadow:
    0 0 30px 10px rgba(12,8,22,.45),
    inset 0 0 0 1px rgba(246,224,160,.06);
}
.letter-content{
  font-family:'EB Garamond','Cormorant Garamond',Georgia,serif;
  font-size:1.2rem;line-height:1.95;color:#faf3df;
  text-align:justify;hyphens:auto;
  letter-spacing:.2px;
  text-shadow:
    0 1px 2px rgba(0,0,0,.95),
    0 0 6px rgba(0,0,0,.75);
}
/* Headings: use the body serif (EB Garamond) so user's case is preserved
   (Cinzel was forcing all-caps / small-caps). Gold color + text-shadow keeps
   the "title" feel. */
.letter-content h1,.letter-content h2,.letter-content h3{
  font-family:'EB Garamond','Cormorant Garamond',Georgia,serif;
  font-weight:600;color:#f6e0a0;text-align:center;
  margin:.35em 0 .6em;letter-spacing:.3px;line-height:1.25;
  text-shadow:0 2px 6px rgba(0,0,0,.85);
}
/* First/last children: tighten the gap between the papyrus edge and the text */
.letter-content>*:first-child{margin-top:0}
.letter-content>*:last-child{margin-bottom:0}
.letter-content h1{font-size:1.85rem}
.letter-content h2{font-size:1.55rem}
.letter-content h3{font-size:1.25rem}
.letter-content p{margin-bottom:.9em}
.letter-content a{color:#b9d5f0;text-decoration:underline}
.letter-content em,.letter-content i{color:#f6e9bf}
.letter-content strong,.letter-content b{color:#ffe7a8}
.letter-content hr{
  border:none;height:1px;margin:24px auto;width:60%;
  background:linear-gradient(90deg,transparent,rgba(246,224,160,.5),transparent);
}
.letter-content img{max-width:100%;border-radius:6px;margin:12px 0;
  box-shadow:0 4px 14px rgba(0,0,0,.55);}
.letter-content blockquote{
  border-left:3px solid rgba(246,224,160,.45);padding-left:14px;
  margin:14px 0;font-style:italic;color:rgba(242,232,204,.82);
}

/* Continue reading modal — centered overlay shown on openLetter when the
   user had a partial read. Replaces the old inline banner that used to live
   in the papyrus body. */
.modal-overlay{
  position:fixed;inset:0;z-index:200;
  display:flex;align-items:center;justify-content:center;
  background:rgba(5,3,15,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  padding:20px;animation:fadeIn .25s ease;
}
.modal-card{
  max-width:460px;width:100%;
  background:linear-gradient(180deg,rgba(35,25,60,.97),rgba(20,14,40,.97));
  border:1px solid rgba(139,92,246,.35);
  border-radius:22px;padding:32px 28px 28px;text-align:center;
  box-shadow:0 18px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.04) inset;
}
.modal-card .icon{font-size:44px;margin-bottom:12px}
.modal-card h2{font-size:1.3rem;margin-bottom:10px;color:#fff;font-weight:600}
.modal-card p{color:rgba(255,255,255,.85);line-height:1.6;margin-bottom:22px;font-size:.95rem}
.modal-card p strong{color:var(--accent)}
.modal-actions{display:flex;gap:10px;flex-wrap:wrap}
.modal-actions .btn{flex:1;min-width:140px}

.letter-footer-row{
  width:100%;display:flex;justify-content:space-between;align-items:center;
  margin-top:18px;gap:12px;flex-wrap:wrap;
}
.letter-footer-row .progress-text{
  font-family:'Cinzel',serif;font-size:.8rem;letter-spacing:2px;
  color:rgba(180,218,245,.7);
}

/* Logs table */
.logs-wrap{max-height:500px;overflow-y:auto;margin-top:12px;border-radius:10px;border:1px solid rgba(255,255,255,.08)}
.logs-wrap table{width:100%;border-collapse:collapse;font-size:.82rem}
.logs-wrap th,.logs-wrap td{padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06)}
.logs-wrap th{background:rgba(255,255,255,.05);color:var(--muted);font-weight:600;position:sticky;top:0;backdrop-filter:blur(8px)}
.logs-wrap tr:last-child td{border-bottom:none}
.log-chip{
  display:inline-block;padding:2px 8px;border-radius:6px;font-size:.72rem;font-weight:600;letter-spacing:.5px;
}
.log-chip.login{background:rgba(139,92,246,.2);color:#c4b5fd}
.log-chip.admin{background:rgba(52,211,153,.2);color:#6ee7b7}
.log-chip.read{background:rgba(34,197,94,.2);color:#86efac}
.log-chip.cancel{background:rgba(248,113,113,.2);color:#fca5a5}
.log-chip.progress{background:rgba(251,191,36,.2);color:#fcd34d}
.log-chip.finished{background:rgba(236,72,153,.25);color:#f9a8d4}
/* PRIVATE-MODE capture-attempt log chip */
.log-chip.capture{background:rgba(217,119,6,.25);color:#fcd34d}

/* ── PRIVATE-MODE deterrents ─────────────────────────────────────────
   Activated only when <body> has .private-mode (set by setupPrivateMode()
   in openLetter when data.privateMode is true AND the viewer is the user,
   not admin). To fully disable at runtime: admin toggles off in settings.
   To fully remove from code: delete this block, the .log-chip.capture
   rule above, the setupPrivateMode function, the admin HTML toggle row,
   the saveSettings field read, the renderAdmin checkbox set, the
   openLetter call, the "capture" logs-filter button, and the privateMode
   field in the data.json defaults. All tagged with PRIVATE-MODE. */
body.private-mode #letter-content,
body.private-mode .papyrus,
body.private-mode #disclaimer-content,
body.private-mode #farewell-content{
  -webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
}
body.private-mode.private-blurred .papyrus,
body.private-mode.private-blurred #disclaimer-content,
body.private-mode.private-blurred #farewell-content{
  filter:blur(22px);transition:filter .12s ease-out;
}
/* ── /PRIVATE-MODE ──────────────────────────────────────────────────── */

/* ── INVISIBLE-TEXT mode ─────────────────────────────────────────────
   Letter/disclaimer/farewell text rendered transparent; the reader
   discovers it by dragging-to-select — the selection highlight paints
   the characters visible via ::selection. Toggled by data.invisibleText.
   To revert: delete this block, the INVISIBLE-TEXT admin toggle row,
   the applyInvisibleText function, the routeAfterLogin / saveSettings /
   logout call sites, the renderAdmin checkbox set, the saveSettings
   field read, and the invisibleText field in data.json defaults.
   All tagged with INVISIBLE-TEXT. */
body.text-invisible #letter-content,
body.text-invisible #letter-content *,
body.text-invisible #disclaimer-content,
body.text-invisible #disclaimer-content *,
body.text-invisible #farewell-content,
body.text-invisible #farewell-content *{
  color:transparent!important;text-shadow:none!important;
  -webkit-text-fill-color:transparent!important;
}
/* Force user-select back on — PRIVATE-MODE disables it on the same
   elements and would make invisible text impossible to reveal. Copy/cut
   are still blocked by PRIVATE-MODE's JS event listeners, so content
   can be read but not extracted. */
body.text-invisible #letter-content,
body.text-invisible .papyrus,
body.text-invisible #disclaimer-content,
body.text-invisible #farewell-content{
  -webkit-user-select:text!important;user-select:text!important;
  -webkit-touch-callout:default!important;
}
body.text-invisible #letter-content ::selection,
body.text-invisible #disclaimer-content ::selection,
body.text-invisible #farewell-content ::selection{
  color:#fff!important;-webkit-text-fill-color:#fff!important;
  background:rgba(139,92,246,.55)!important;
}
body.text-invisible #letter-content ::-moz-selection,
body.text-invisible #disclaimer-content ::-moz-selection,
body.text-invisible #farewell-content ::-moz-selection{
  color:#fff!important;background:rgba(139,92,246,.55)!important;
}
/* ── /INVISIBLE-TEXT ────────────────────────────────────────────────── */
.logs-filter{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}
.logs-filter button{
  padding:6px 10px;border-radius:8px;border:none;background:rgba(255,255,255,.06);
  color:var(--muted);cursor:pointer;font-size:.78rem;
}
.logs-filter button.active{background:rgba(139,92,246,.25);color:var(--accent)}
.logs-filter button:hover{color:#fff}
.logs-empty{text-align:center;color:var(--muted);padding:30px 20px;font-size:.88rem}

.danger-section{
  margin-top:20px;padding:14px 16px;background:rgba(248,113,113,.08);
  border:1px solid rgba(248,113,113,.2);border-radius:14px;
}
/* Unified semi-black panel that wraps progress bar + papyrus.
   Used in BOTH user view (.letter-panel) and admin preview (.papyrus-preview-bg). */
.letter-panel,.papyrus-preview-bg{
  background:rgba(14,10,28,0.55);
  border:1px solid rgba(230,215,170,0.12);
  border-radius:16px;
  padding:22px 22px 32px;
  box-shadow:0 6px 28px rgba(0,0,0,.45);
}
#page-disabled-toggle:checked+.slider{background:var(--err)!important}

@media(max-width:520px){
  .card{padding:28px 20px}
  .card.wide{padding:20px 16px}
  h1{font-size:1.2rem}
  /* On mobile the papyrus uses the full viewport width — zero outer padding
     so the scroll touches the edges of the screen. */
  .screen{padding:0}
  .letter-wrap{padding:0;margin:0;max-width:100%}
  .letter-panel,.papyrus-preview-bg{
    padding:0;margin:0;border-radius:0;border:none;box-shadow:none;background:transparent;
  }
  .letter-header{padding:6px 10px;margin-bottom:6px}
  /* Sticky bar on mobile: no negative margins, full width, tighter */
  .progress-sticky{
    margin:0;padding:8px 10px 6px;border-radius:0;
    background:rgba(14,10,28,0.92);
  }
  .papyrus{max-width:100%;filter:none}
  .papyrus-body{padding:6px 4% 12px}
  .letter-column{max-width:100%;padding:12px 14px}
  .letter-content{font-size:1.02rem;line-height:1.8;text-align:left}
  /* Shorter cropped header/footer on small screens */
  .papyrus-header-img{height:clamp(90px, 28vw, 160px)}
  .papyrus-footer-img{height:clamp(80px, 22vw, 140px)}
}
</style>
</head>
<body>

<!-- LOGIN / GATE -->
<div id="gate" class="screen">
  <div class="card">
    <div class="lock">&#128274;</div>
    <!-- GATE-TEXT: ids let applyGateCustomization() overwrite these from data -->
    <h1 id="gate-title">${PAGE_TITLE}</h1>
    <p class="sub" id="gate-sub">Introduce el código de acceso</p>
    <input type="password" id="code" placeholder="Código" autocomplete="off" autofocus>
    <button class="btn" id="unlock-btn">Entrar</button>
    <p class="error" id="error"></p>
  </div>
</div>

<!-- DISABLED -->
<div id="disabled-screen" class="screen hidden">
  <div class="card fade-in">
    <div class="lock">&#128533;</div>
    <h1>Página no disponible</h1>
    <p class="sub" style="margin-bottom:12px">Esta página está pausada por ahora. Puede que vuelva pronto.</p>
    <button class="btn btn-ghost" style="max-width:200px;margin:0 auto" onclick="location.reload()">Reintentar</button>
  </div>
</div>

<!-- DISCLAIMER -->
<div id="disclaimer-screen" class="screen hidden">
  <div class="disclaimer-card fade-in">
    <div class="icon">&#128220;</div>
    <div id="disclaimer-content" class="disclaimer-content"></div>
    <div class="disclaimer-actions">
      <button class="btn btn-ghost" id="btn-cancel">Cancelar</button>
      <button class="btn" id="btn-read">Leer carta</button>
    </div>
  </div>
</div>

<!-- FAREWELL (after user cancels) -->
<div id="farewell-screen" class="screen hidden">
  <div class="card farewell-card fade-in">
    <div class="icon">&#128591;</div>
    <h1>Entendido</h1>
    <div id="farewell-content" class="farewell-content"></div>
    <button class="btn" style="max-width:220px;margin:0 auto" onclick="backToLogin()">Volver al inicio</button>
  </div>
</div>

<!-- LETTER (user view) -->
<div id="letter-screen" class="hidden">
  <div class="letter-wrap fade-in">
    <div class="letter-header">
      <span class="title">Una Carta</span>
      <div class="actions">
        <button class="link-btn" onclick="logout()">Cerrar sesión</button>
      </div>
    </div>
    <div class="letter-panel">
      <div class="progress-sticky">
        <div class="progress-label-row">
          <span>Progreso</span>
          <span id="progress-percent">0%</span>
        </div>
        <div class="progress-outer"><div class="progress-inner" id="progress-inner"></div></div>
      </div>

      <div class="papyrus">
        <img class="papyrus-header-img" src="papyrus_header.png" alt="">
        <div class="papyrus-body">
          <div class="letter-column">
            <div id="letter-content" class="letter-content"></div>
          </div>
        </div>
        <img class="papyrus-footer-img" src="papyrus_footer.png" alt="">
      </div>
    </div>
  </div>
</div>

<!-- ADMIN -->
<div id="admin-screen" class="screen hidden">
  <div class="card wide fade-in">
    <div class="admin-topbar">
      <span class="admin-badge">&#128737; Administrador</span>
      <button class="link-btn" onclick="logout()">Cerrar sesión</button>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="view-letter">Ver carta</button>
      <button class="tab" data-tab="view-disclaimer">Ver disclaimer</button>
      <button class="tab" data-tab="edit-letter">Editar carta</button>
      <button class="tab" data-tab="edit-disclaimer">Editar disclaimer</button>
      <button class="tab" data-tab="edit-farewell">Editar despedida</button>
      <!-- GATE-TEXT: login-screen customization tab -->
      <button class="tab" data-tab="edit-gate">Pantalla de acceso</button>
      <button class="tab" data-tab="logs">Logs</button>
      <button class="tab" data-tab="settings">Configuración</button>
    </div>

    <!-- Panel: view letter (admin sees the papyrus) -->
    <div id="panel-view-letter" class="panel">
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">Así verá el usuario la carta. Progreso máximo alcanzado: <strong id="admin-max-progress">0%</strong></p>
      <div class="papyrus-preview-bg">
        <div class="letter-wrap" style="padding:0">
          <!-- Sticky progress inside preview. top uses var set on the admin topbar
               so the sticky bar parks itself directly below it instead of colliding. -->
          <div class="progress-sticky admin-progress-sticky" style="width:100%">
            <div class="progress-label-row"><span>Progreso</span><span id="admin-progress-label">0%</span></div>
            <div class="progress-outer"><div class="progress-inner" id="admin-progress-inner"></div></div>
          </div>
          <div class="papyrus" style="max-width:100%">
            <img class="papyrus-header-img" src="papyrus_header.png" alt="">
            <div class="papyrus-body">
              <div class="letter-column">
                <div id="admin-letter-content" class="letter-content"></div>
              </div>
            </div>
            <img class="papyrus-footer-img" src="papyrus_footer.png" alt="">
          </div>
        </div>
      </div>
    </div>

    <!-- Panel: view disclaimer -->
    <div id="panel-view-disclaimer" class="panel hidden">
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">Así verá el usuario el disclaimer antes de decidir:</p>
      <div class="disclaimer-card" style="max-width:100%">
        <div class="icon" style="font-size:44px;text-align:center;margin-bottom:12px">&#128220;</div>
        <div id="admin-disclaimer-content" class="disclaimer-content"></div>
        <div class="disclaimer-actions">
          <button class="btn btn-ghost">Cancelar</button>
          <button class="btn">Leer carta</button>
        </div>
      </div>
    </div>

    <!-- Panel: edit letter -->
    <div id="panel-edit-letter" class="panel hidden">
      <div class="toolbar">
        <button onclick="execCmd('bold','letter-editor')" title="Negrita"><b>B</b></button>
        <button onclick="execCmd('italic','letter-editor')" title="Cursiva"><i>I</i></button>
        <button onclick="execCmd('underline','letter-editor')" title="Subrayado"><u>U</u></button>
        <button onclick="addHeading('letter-editor')" title="Título">H</button>
        <button onclick="addParagraph('letter-editor')" title="Párrafo">P</button>
        <button onclick="addHR('letter-editor')" title="Separador">&#8213;</button>
        <button onclick="addLink('letter-editor')" title="Enlace">&#128279;</button>
        <button onclick="addImage('letter-editor')" title="Imagen">&#128247;</button>
        <span class="toolbar-sep"></span>
        <button class="size-btn" onclick="bumpFontSize('letter-editor',-1)" title="Hacer más pequeño">A&minus;</button>
        <button class="size-btn" onclick="bumpFontSize('letter-editor',1)" title="Hacer más grande">A+</button>
        <button class="size-btn" onclick="bumpFontSize('letter-editor',0)" title="Tamaño normal" style="font-size:.78rem">Normal</button>
      </div>
      <input type="file" id="img-letter-editor" accept="image/*" onchange="insertImage(this,'letter-editor')">
      <div id="letter-editor" class="richtext" contenteditable="true" style="min-height:420px;max-height:65vh"></div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="saveLetter()">Guardar carta</button>
        <span id="letter-save-status" class="status"></span>
      </div>
    </div>

    <!-- Panel: edit disclaimer (constrained to the width the user will see) -->
    <div id="panel-edit-disclaimer" class="panel hidden">
      <div style="max-width:680px;margin:0 auto">
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:10px">El editor tiene el mismo ancho que verá el usuario.</p>
        <div class="toolbar">
          <button onclick="execCmd('bold','disc-editor')" title="Negrita"><b>B</b></button>
          <button onclick="execCmd('italic','disc-editor')" title="Cursiva"><i>I</i></button>
          <button onclick="execCmd('underline','disc-editor')" title="Subrayado"><u>U</u></button>
          <button onclick="addHeading('disc-editor')" title="Título">H</button>
          <button onclick="addLink('disc-editor')" title="Enlace">&#128279;</button>
          <button onclick="addImage('disc-editor')" title="Imagen">&#128247;</button>
          <span class="toolbar-sep"></span>
          <button class="size-btn" onclick="bumpFontSize('disc-editor',-1)" title="Hacer más pequeño">A&minus;</button>
          <button class="size-btn" onclick="bumpFontSize('disc-editor',1)" title="Hacer más grande">A+</button>
          <button class="size-btn" onclick="bumpFontSize('disc-editor',0)" title="Tamaño normal" style="font-size:.78rem">Normal</button>
        </div>
        <input type="file" id="img-disc-editor" accept="image/*" onchange="insertImage(this,'disc-editor')">
        <div id="disc-editor" class="richtext" contenteditable="true"></div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="saveDisclaimer()">Guardar disclaimer</button>
          <span id="disc-save-status" class="status"></span>
        </div>
      </div>
    </div>

    <!-- Panel: edit farewell (message shown after the user cancels) -->
    <div id="panel-edit-farewell" class="panel hidden">
      <div style="max-width:520px;margin:0 auto">
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:10px">Mensaje que verá el usuario si pulsa &ldquo;Cancelar&rdquo; en el disclaimer.</p>
        <div class="toolbar">
          <button onclick="execCmd('bold','farewell-editor')" title="Negrita"><b>B</b></button>
          <button onclick="execCmd('italic','farewell-editor')" title="Cursiva"><i>I</i></button>
          <button onclick="execCmd('underline','farewell-editor')" title="Subrayado"><u>U</u></button>
          <button onclick="addHeading('farewell-editor')" title="Título">H</button>
          <button onclick="addLink('farewell-editor')" title="Enlace">&#128279;</button>
          <span class="toolbar-sep"></span>
          <button class="size-btn" onclick="bumpFontSize('farewell-editor',-1)" title="Hacer más pequeño">A&minus;</button>
          <button class="size-btn" onclick="bumpFontSize('farewell-editor',1)" title="Hacer más grande">A+</button>
          <button class="size-btn" onclick="bumpFontSize('farewell-editor',0)" title="Tamaño normal" style="font-size:.78rem">Normal</button>
        </div>
        <div id="farewell-editor" class="richtext" contenteditable="true" style="min-height:160px;max-height:40vh"></div>
        <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="saveFarewell()">Guardar despedida</button>
          <span id="farewell-save-status" class="status"></span>
        </div>
      </div>
    </div>

    <!-- GATE-TEXT: edit login-screen copy -->
    <div id="panel-edit-gate" class="panel hidden">
      <div style="max-width:520px;margin:0 auto">
        <p style="font-size:.82rem;color:var(--muted);margin-bottom:14px">Texto de la pantalla de acceso (la primera pantalla que ve el usuario antes de introducir el código).</p>
        <div class="field">
          <label>Título</label>
          <input type="text" id="gate-title-input" placeholder="${PAGE_TITLE}" style="text-align:left;letter-spacing:0">
        </div>
        <div class="field">
          <label>Subtítulo</label>
          <input type="text" id="gate-sub-input" placeholder="Introduce el código de acceso" style="text-align:left;letter-spacing:0">
        </div>
        <div style="margin-top:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="saveGate()">Guardar pantalla</button>
          <span id="gate-save-status" class="status"></span>
        </div>
      </div>
    </div>

    <!-- Panel: logs -->
    <div id="panel-logs" class="panel hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:10px;flex-wrap:wrap">
        <div class="logs-filter">
          <button class="logs-filter-btn active" data-filter="all">Todos</button>
          <button class="logs-filter-btn" data-filter="login">Accesos</button>
          <button class="logs-filter-btn" data-filter="read">Leer</button>
          <button class="logs-filter-btn" data-filter="cancel">Cancelar</button>
          <button class="logs-filter-btn" data-filter="progress">Progreso</button>
          <!-- PRIVATE-MODE: capture-attempt filter (safe to delete) -->
          <button class="logs-filter-btn" data-filter="capture">Capturas</button>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="refreshLogs()">&#128260; Actualizar</button>
      </div>
      <div id="logs-wrap" class="logs-wrap"></div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-danger" onclick="clearLogs()">Limpiar logs</button>
        <span id="logs-status" class="status"></span>
      </div>
    </div>

    <!-- Panel: settings -->
    <div id="panel-settings" class="panel hidden">
      <div class="field">
        <label>Código de acceso para el usuario</label>
        <input type="text" id="user-code-input" placeholder="Código de usuario">
      </div>
      <div class="field">
        <label>Alineación del texto de la carta</label>
        <div class="segmented" id="text-align-seg">
          <button type="button" class="segmented-btn" data-value="justify">Justificado</button>
          <button type="button" class="segmented-btn" data-value="center">Centrado</button>
          <button type="button" class="segmented-btn" data-value="left">Izquierda</button>
        </div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:6px">Cambia cómo se ve el texto en la carta (vista de usuario y vista previa).</div>
      </div>
      <!-- PRIVATE-MODE admin toggle (delete this whole div to revert) -->
      <div class="toggle-row" style="padding:14px 16px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:14px;margin-top:14px">
        <div>
          <label style="color:#c4b5fd;font-weight:600">Modo privado de lectura</label>
          <div style="font-size:.78rem;color:var(--muted);margin-top:4px;line-height:1.5">Dificulta capturas de pantalla: desactiva clic-derecho, selección de texto y difumina la carta al cambiar de app. No bloquea capturas (imposible en web), pero registra los intentos en el log.</div>
        </div>
        <label class="toggle"><input type="checkbox" id="private-mode-toggle"><span class="slider"></span></label>
      </div>
      <!-- /PRIVATE-MODE -->
      <!-- INVISIBLE-TEXT admin toggle (delete this whole div to revert) -->
      <div class="toggle-row" style="padding:14px 16px;background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:14px;margin-top:14px">
        <div>
          <label style="color:#c4b5fd;font-weight:600">Texto invisible</label>
          <div style="font-size:.78rem;color:var(--muted);margin-top:4px;line-height:1.5">El texto aparece transparente; el usuario lo revela arrastrando el ratón para seleccionarlo (el resaltado de la selección hace visibles las letras). No afecta a los editores del panel de administración.</div>
        </div>
        <label class="toggle"><input type="checkbox" id="invisible-text-toggle"><span class="slider"></span></label>
      </div>
      <!-- /INVISIBLE-TEXT -->
      <div class="toggle-row danger-section">
        <div>
          <label style="color:var(--err);font-weight:600">Desactivar página</label>
          <div style="font-size:.78rem;color:var(--muted);margin-top:4px">El usuario verá un mensaje de no disponible.</div>
        </div>
        <label class="toggle"><input type="checkbox" id="page-disabled-toggle"><span class="slider"></span></label>
      </div>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:16px">
        <button class="btn btn-sm" onclick="saveSettings()">Guardar configuración</button>
        <span id="settings-status" class="status"></span>
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(255,255,255,.08)">
        <button class="btn btn-sm btn-ghost" onclick="resetProgress()">Reiniciar progreso del usuario</button>
        <span id="reset-progress-status" class="status"></span>
      </div>
    </div>

  </div>
</div>

<!-- CONTINUE MODAL (shown on openLetter if user has a partial read) -->
<div id="continue-modal" class="modal-overlay hidden">
  <div class="modal-card">
    <div class="icon">&#128214;</div>
    <h2>¿Continuar donde lo dejaste?</h2>
    <p>La última vez llegaste al <strong id="continue-percent">0%</strong> de la carta.</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="btn-continue-restart">Empezar de nuevo</button>
      <button class="btn" id="btn-continue-resume">Continuar</button>
    </div>
  </div>
</div>

<script>
var GITHUB_API = "${GITHUB_API_FILE}";
var ADMIN_HASH = "${ADMIN_HASH}";
var ENC_ADMIN_TOKEN = "${encAdminToken}";
var ACCEPT_KEY = "letter_accepted_v1";
var LAST_PERCENT_KEY = "letter_last_percent_v1";

var data = null;
var isAdmin = false;
var ghToken = null;
var fileSha = null;

// ── Crypto helpers (browser) ────────────────────────────────────────
function sha256(str){
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
    .then(function(buf){
      return Array.from(new Uint8Array(buf)).map(function(b){
        return b.toString(16).padStart(2,"0");
      }).join("");
    });
}
function hexToBytes(hex){
  var out = new Uint8Array(hex.length/2);
  for(var i=0;i<hex.length;i+=2) out[i/2] = parseInt(hex.substr(i,2),16);
  return out;
}
function bytesToHex(bytes){
  return Array.from(bytes).map(function(b){return b.toString(16).padStart(2,"0");}).join("");
}
function deriveKey(password, salt, usages){
  return crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"])
    .then(function(km){
      return crypto.subtle.deriveKey(
        {name:"PBKDF2", salt:salt, iterations:100000, hash:"SHA-256"},
        km, {name:"AES-GCM", length:256}, false, usages
      );
    });
}
function decryptToken(encStr, password){
  var parts = encStr.split(":");
  var salt = hexToBytes(parts[0]);
  var iv   = hexToBytes(parts[1]);
  var tag  = hexToBytes(parts[2]);
  var ct   = hexToBytes(parts[3]);
  return deriveKey(password, salt, ["decrypt"]).then(function(key){
    var combined = new Uint8Array(ct.length + tag.length);
    combined.set(ct); combined.set(tag, ct.length);
    return crypto.subtle.decrypt({name:"AES-GCM", iv:iv}, key, combined);
  }).then(function(plain){ return new TextDecoder().decode(plain); });
}
function encryptToken(token, password){
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv   = crypto.getRandomValues(new Uint8Array(12));
  return deriveKey(password, salt, ["encrypt"]).then(function(key){
    return crypto.subtle.encrypt({name:"AES-GCM", iv:iv}, key, new TextEncoder().encode(token));
  }).then(function(buf){
    var all = new Uint8Array(buf);
    var ct  = all.slice(0, all.length - 16);
    var tag = all.slice(all.length - 16);
    return bytesToHex(salt)+":"+bytesToHex(iv)+":"+bytesToHex(tag)+":"+bytesToHex(ct);
  });
}

// ── GitHub API ──────────────────────────────────────────────────────
function nocache(url){return url+(url.indexOf("?")===-1?"?":"&")+"_t="+Date.now();}
function fetchData(){
  return fetch(nocache(GITHUB_API), {
    headers:{"Accept":"application/vnd.github.v3+json"},
    cache:"no-store"
  }).then(function(r){return r.json();}).then(function(json){
    fileSha = json.sha;
    if(!json.content && json.git_url){
      return fetch(json.git_url, {headers:{"Accept":"application/vnd.github.v3+json"}})
        .then(function(r2){return r2.json();})
        .then(function(blob){
          var raw = atob(blob.content.replace(/\\n/g,""));
          return JSON.parse(decodeURIComponent(escape(raw)));
        });
    }
    var raw = atob(json.content);
    return JSON.parse(decodeURIComponent(escape(raw)));
  });
}
// ── GATE-TEXT ───────────────────────────────────────────────────────
// Paint the login screen with admin-customized title/subtitle pulled from
// data.gateTitle / data.gateSub. Called from:
//   - preloadGate() on page load (anonymous fetch, before the user logs in)
//   - saveGate()    after the admin clicks "Guardar pantalla"
// Anything missing falls back to whatever the template baked in, so the
// gate is never blank if the fetch fails.
function applyGateCustomization(d){
  if(!d) return;
  if(d.gateTitle){
    var t = document.getElementById("gate-title");
    if(t) t.textContent = d.gateTitle;
  }
  if(d.gateSub){
    var s = document.getElementById("gate-sub");
    if(s) s.textContent = d.gateSub;
  }
}
// ── /GATE-TEXT ──────────────────────────────────────────────────────

function saveData(obj, _retry){
  if(!ghToken) return Promise.reject(new Error("no-token"));
  var content = JSON.stringify(obj, null, 2);
  var encoded = btoa(unescape(encodeURIComponent(content)));
  return fetch(GITHUB_API, {
    method:"PUT",
    headers:{
      "Authorization":"token "+ghToken,
      "Accept":"application/vnd.github.v3+json",
      "Content-Type":"application/json"
    },
    body: JSON.stringify({message:"update data", content:encoded, sha:fileSha})
  }).then(function(r){return r.json();}).then(function(res){
    if(res.content && res.content.sha){ fileSha = res.content.sha; return res; }
    if(!_retry && res.message && res.message.indexOf("does not match")!==-1){
      return fetch(nocache(GITHUB_API), {
        headers:{"Authorization":"token "+ghToken,"Accept":"application/vnd.github.v3+json"},
        cache:"no-store"
      }).then(function(r2){return r2.json();}).then(function(json){
        fileSha = json.sha;
        return saveData(obj, true);
      });
    }
    return res;
  });
}

// ── Fingerprint / IP ────────────────────────────────────────────────
function getFingerprint(){
  var raw = [
    navigator.userAgent,
    screen.width+"x"+screen.height,
    screen.colorDepth,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency||"",
    navigator.platform||""
  ].join("|");
  var h = 5381;
  for(var i=0;i<raw.length;i++){ h = ((h<<5)+h)+raw.charCodeAt(i); h = h & 0xFFFFFFFF; }
  return (h>>>0).toString(16).padStart(8,"0");
}
var cachedIP = null;
function getIP(){
  if(cachedIP) return Promise.resolve(cachedIP);
  return fetch("https://api.ipify.org?format=json")
    .then(function(r){return r.json();})
    .then(function(j){ cachedIP = j.ip; return cachedIP; })
    .catch(function(){ cachedIP = "desconocida"; return cachedIP; });
}

// ── Logging ─────────────────────────────────────────────────────────
function madridTimestamp(){
  return new Date().toLocaleString("es-ES",{timeZone:"Europe/Madrid",hour12:false});
}
function appendLog(type, detail){
  if(!data) return Promise.resolve();
  if(!data.logs) data.logs = [];
  return getIP().then(function(ip){
    var entry = {
      ts: madridTimestamp(),
      tsISO: new Date().toISOString(),
      type: type,
      detail: detail||"",
      role: isAdmin ? "admin" : "user",
      ip: ip,
      fp: getFingerprint()
    };
    data.logs.push(entry);
    if(data.logs.length > 500) data.logs = data.logs.slice(-500);
    return saveData(data).catch(function(e){ console.warn("log save failed",e); });
  });
}

// ── Routing ─────────────────────────────────────────────────────────
function show(id){
  var ids = ["gate","disabled-screen","disclaimer-screen","farewell-screen","letter-screen","admin-screen"];
  ids.forEach(function(x){
    var el = document.getElementById(x);
    if(!el) return;
    if(x===id) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
  document.body.classList.toggle("letter-mode", id==="letter-screen");
}

// ── Unlock ──────────────────────────────────────────────────────────
function unlock(){
  var code = document.getElementById("code").value;
  if(!code) return;
  var errEl = document.getElementById("error");
  var btn = document.getElementById("unlock-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Verificando...';

  sha256(code).then(function(hash){
    if(hash === ADMIN_HASH){
      isAdmin = true;
      return decryptToken(ENC_ADMIN_TOKEN, code).then(function(token){
        ghToken = token;
        return fetchData();
      }).then(function(d){
        data = d;
        appendLog("login","admin");
        routeAfterLogin();
      });
    }
    // User path
    return fetchData().then(function(d){
      data = d;
      if(code !== data.userCode){
        errEl.textContent = "Código incorrecto";
        errEl.classList.add("shake");
        document.getElementById("code").value = "";
        setTimeout(function(){errEl.classList.remove("shake");},500);
        setTimeout(function(){errEl.textContent="";},2500);
        return;
      }
      // Decrypt user token so user can write logs/progress
      return decryptToken(data.encUserToken, code).then(function(token){
        ghToken = token;
        return appendLog("login","user");
      }).then(function(){
        routeAfterLogin();
      });
    });
  }).catch(function(e){
    console.error(e);
    var msg = "Error de conexión. Inténtalo de nuevo.";
    if(e && e.message && e.message.indexOf("decrypt")!==-1) msg = "Código incorrecto.";
    if(e && e.message && e.message.indexOf("NetworkError")!==-1) msg = "Sin conexión.";
    errEl.textContent = msg;
    setTimeout(function(){errEl.textContent="";},4000);
  }).finally(function(){
    btn.disabled = false;
    btn.textContent = "Entrar";
  });
}

// ── INVISIBLE-TEXT apply helper ─────────────────────────────────────
// Toggles body.text-invisible based on data.invisibleText so the CSS
// block above kicks in across disclaimer / letter / farewell screens.
// Called from routeAfterLogin (covers user and admin), saveSettings
// (live update when admin toggles), and logout (cleanup).
// To revert: delete this function and all call sites tagged INVISIBLE-TEXT.
function applyInvisibleText(){
  document.body.classList.toggle("text-invisible", !!(data && data.invisibleText));
}
// ── /INVISIBLE-TEXT ──────────────────────────────────────────────────

function routeAfterLogin(){
  // INVISIBLE-TEXT (delete next line to revert)
  applyInvisibleText();
  // GATE-TEXT: keep the login card in sync with freshly-fetched data so
  // the next logout shows the admin's latest customization without a
  // full page reload.
  applyGateCustomization(data);
  if(data.pageDisabled && !isAdmin){
    show("disabled-screen");
    return;
  }
  if(isAdmin){
    renderAdmin();
    show("admin-screen");
    return;
  }
  // User
  var accepted = localStorage.getItem(ACCEPT_KEY) === "true";
  if(accepted){
    openLetter();
  } else {
    showDisclaimer();
  }
}

/* Render helpers for content pasted from Google Docs ─────────────────
   Google Docs paste produces two bugs we need to fix at render time:
     1) Body paragraphs wrapped in <h2> — every <p> inside inherits the
        heading's bold weight. That's why A+/A- appeared to "make text
        bold": our new <span style="font-size:X"> was dropping the inner
        <span font-weight:400> override, exposing the h2 default bold.
     2) Every <p> carries an inline style="text-align:center" so the
        container's chosen alignment (justify / center / left from the
        admin settings) never wins.
   Call renderRichContent(el, html, align) wherever we dump user HTML. */
function unwrapBogusHeadings(container){
  if(!container) return;
  // Snapshot: we mutate as we iterate.
  var hs = Array.prototype.slice.call(container.querySelectorAll("h1,h2,h3"));
  hs.forEach(function(h){
    if(h.querySelector("p,div,ul,ol,blockquote")){
      var parent = h.parentNode;
      while(h.firstChild) parent.insertBefore(h.firstChild, h);
      parent.removeChild(h);
    }
  });
}
function stripInlineTextAlign(container){
  if(!container) return;
  container.querySelectorAll("[style*='text-align']").forEach(function(el){
    el.style.textAlign = "";
  });
}
function renderRichContent(el, html, align){
  if(!el) return;
  el.innerHTML = html || "";
  unwrapBogusHeadings(el);
  stripInlineTextAlign(el);
  el.style.textAlign = align || "justify";
}

// ── Disclaimer ──────────────────────────────────────────────────────
function showDisclaimer(){
  renderRichContent(
    document.getElementById("disclaimer-content"),
    data.disclaimer || "",
    data.textAlign || "justify"
  );
  show("disclaimer-screen");
  appendLog("disclaimer_shown","");
}
function onDisclaimerRead(){
  localStorage.setItem(ACCEPT_KEY,"true");
  appendLog("read","Aceptó leer la carta");
  openLetter();
}
function onDisclaimerCancel(){
  appendLog("cancel","Canceló la lectura");
  renderRichContent(
    document.getElementById("farewell-content"),
    (data && data.farewell) || "<p>Respeto tu decisión. Puedes volver cuando quieras leerla, estará aquí esperando.</p>",
    (data && data.textAlign) || "justify"
  );
  show("farewell-screen");
}

// ── Letter rendering & progress ─────────────────────────────────────
var progressSaveTimer = null;
var maxPercentSession = 0;
var lastSavedPercent = 0;
// Remembered between openLetter() and resumeReading() so the "Continuar"
// button scrolls to the exact percent we SHOWED in the modal, even if
// data.progress.lastPercent (from GitHub) is stale and the real value came
// from the localStorage backup.
var pendingResumePercent = 0;
// Bidirectional decile tracking: every time the user enters a new 10%
// bucket (going UP or DOWN) we arm a dwell timer. If they stay in that
// bucket for MILESTONE_DWELL_MS, we log it. This means re-reading a lower
// section — e.g. user reached 100%, came back and dwelt around 30% — also
// generates activity, which is exactly the signal we want (an admin can
// see whether someone actually re-read or just closed the tab).
//
// Two properties fall out of "bucket change = re-arm":
//  • Scanning (0→100 in ~3s) cancels timers at every decile, so none fire
//    except the destination if the user stops there.
//  • Fidgeting within a bucket (49% ↔ 51%) doesn't retrigger, because the
//    bucket value hasn't changed.
//
// After a successful log, dwellPendingMilestone stays pointed at the just-
// logged decile so the same decile doesn't re-log while the user is still
// in it. Only when they drift into a DIFFERENT decile do we rearm.
var MILESTONE_DWELL_MS = 20000; // 20 s
var dwellPendingMilestone = 0;  // 0 means "at the top / nothing pending"
var dwellPendingTimer = null;
var dwellPendingStartTime = 0;

// ── PRIVATE-MODE setup ──────────────────────────────────────────────
// To fully revert: delete this whole function, the call site in openLetter(),
// the CSS block tagged PRIVATE-MODE, the admin HTML toggle row tagged
// PRIVATE-MODE, the saveSettings line that reads #private-mode-toggle, the
// renderAdmin block that sets it, the "capture" logs-filter button, and the
// privateMode field in the data.json defaults.
//
// What it does (soft deterrents — NOT prevention):
//  • Disables selection/copy/right-click/long-press on letter content via CSS
//    (class is set on <body>).
//  • Blurs the whole papyrus when the tab loses focus or is hidden. This
//    frustrates screen-capture tools that steal focus (Snipping Tool, OBS
//    window capture, Android/iOS screenshot UI on some devices), and makes
//    phone-photographing require putting the tab back in focus first.
//  • Intercepts PrintScreen on Windows to clear the clipboard (best-effort;
//    needs focus + clipboard permission, not always granted).
//  • Logs every attempt so the admin can SEE when capture was tried.
//
// None of this prevents OS-level screen recording or photographing the screen.
// That's a hard limit of the web platform. The admin-facing logs are the
// point: you'll know when something happened.
var privateModeActive = false;
var privateModeCleanup = null;
function setupPrivateMode(){
  if(privateModeActive) return;
  if(isAdmin) return;
  if(!data || !data.privateMode) return;
  privateModeActive = true;
  document.body.classList.add("private-mode");
  // Throttle logs so a flapping focus (or held-down PrintScreen) doesn't spam
  // the logs array. One entry per event type per 3 seconds.
  var lastLogAt = {};
  function logCapture(detail){
    var key = detail.split(":")[0] || detail;
    var now = Date.now();
    if(lastLogAt[key] && now - lastLogAt[key] < 3000) return;
    lastLogAt[key] = now;
    appendLog("capture", detail);
  }
  var blurTimer = null;
  function blurOn(reason){
    // Defer slightly so the blur flashes BEFORE any capture tool can grab
    // a frame — most screenshot UIs wait 100-300ms between focus-steal and
    // capture.
    if(blurTimer) clearTimeout(blurTimer);
    document.body.classList.add("private-blurred");
    logCapture("focus-loss:"+reason);
  }
  function blurOff(){
    // Small delay so a fast refocus doesn't flash the content during what
    // might be a capture gesture finishing.
    if(blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(function(){
      document.body.classList.remove("private-blurred");
    }, 120);
  }
  function onVisibility(){
    if(document.visibilityState==="hidden") blurOn("visibilitychange");
    else blurOff();
  }
  function onBlur(){ blurOn("window-blur"); }
  function onFocus(){ blurOff(); }
  function onContext(e){ e.preventDefault(); logCapture("context-menu"); }
  function onCopy(e){ e.preventDefault(); logCapture("copy"); }
  function onCut(e){ e.preventDefault(); logCapture("cut"); }
  function onKeyUp(e){
    // Windows PrintScreen fires keyup (not keydown) because the OS intercepts
    // keydown. When the tab has focus we can at least clobber the clipboard.
    if(e.key === "PrintScreen" || e.keyCode === 44){
      logCapture("printscreen");
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(" ").catch(function(){});
      }
    }
  }
  function onKeyDown(e){
    // Ctrl+P (print), Ctrl+S (save page), Ctrl+Shift+S (some screenshot
    // extensions), Ctrl+C (copy — already blocked by copy event but we log
    // it here to be explicit). Best-effort, easy to bypass.
    if((e.ctrlKey||e.metaKey) && (e.key==="p"||e.key==="P")){
      e.preventDefault(); logCapture("print-shortcut");
    } else if((e.ctrlKey||e.metaKey) && (e.key==="s"||e.key==="S")){
      e.preventDefault(); logCapture("save-shortcut");
    }
  }
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("blur", onBlur);
  window.addEventListener("focus", onFocus);
  document.addEventListener("contextmenu", onContext);
  document.addEventListener("copy", onCopy);
  document.addEventListener("cut", onCut);
  document.addEventListener("keyup", onKeyUp);
  document.addEventListener("keydown", onKeyDown);
  // Optional one-time "session started with private mode" log so the timeline
  // has a bookend.
  logCapture("session-start");
  privateModeCleanup = function(){
    document.body.classList.remove("private-mode");
    document.body.classList.remove("private-blurred");
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("contextmenu", onContext);
    document.removeEventListener("copy", onCopy);
    document.removeEventListener("cut", onCut);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("keydown", onKeyDown);
    if(blurTimer) clearTimeout(blurTimer);
    privateModeActive = false;
    privateModeCleanup = null;
  };
}
// ── /PRIVATE-MODE setup ─────────────────────────────────────────────

function openLetter(){
  var lc = document.getElementById("letter-content");
  renderRichContent(lc, data.letter || "", data.textAlign || "justify");
  // Network value is authoritative, but localStorage is a reliable backup for
  // cases where the last scroll save didn't complete before the tab closed
  // (fetches fired in beforeunload are often cancelled by the browser).
  var serverLast = (data.progress && data.progress.lastPercent) || 0;
  var serverMax = (data.progress && data.progress.maxPercent) || 0;
  var p = serverLast;
  try {
    var lsP = parseFloat(localStorage.getItem(LAST_PERCENT_KEY));
    if(!isNaN(lsP) && lsP > p) p = lsP;
  } catch(e){}
  var maxP = serverMax;
  if(p > maxP) maxP = p;
  pendingResumePercent = p;
  maxPercentSession = maxP;
  lastSavedPercent = maxP;
  // Bidirectional tracking means the resume smooth-scroll naturally collapses
  // to a single log at the destination: each decile the scroll crosses en
  // route re-arms the timer, so only the final resting decile survives long
  // enough to fire.
  resetDwell();
  // Reconcile: if localStorage had a higher percent than what the server
  // knows (previous session's close-time save got cancelled by the browser),
  // push the merged value back so admin dashboards reflect reality. If the
  // gap crosses a 10% milestone we also write a progress log so the jump
  // isn't lost entirely — session-milestone logs from the previous session
  // may not have reached GitHub either.
  if(!isAdmin && maxP > serverMax + 1){
    if(!data.progress) data.progress = {maxPercent:0,lastPercent:0,lastUpdated:"",finishedLogged:false};
    data.progress.maxPercent = maxP;
    data.progress.lastPercent = p;
    data.progress.lastUpdated = new Date().toISOString();
    var reachedEnd = maxP >= 98 && !data.progress.finishedLogged;
    if(reachedEnd) data.progress.finishedLogged = true;
    saveData(data).catch(function(){});
    if(reachedEnd){
      appendLog("finished","Carta terminada");
    } else if((maxP - serverMax) >= 10){
      appendLog("progress", Math.round(maxP)+"% leído (recuperado)");
    }
  }
  // Start the bar at 0 — it will fill live as the user scrolls. The stored
  // maxP is still used for persistence / logging, it just isn't reflected
  // in the visible bar.
  updateProgressUI(0);
  show("letter-screen");
  window.scrollTo(0,0);
  attachScrollTracking();
  // PRIVATE-MODE (delete next line to revert)
  setupPrivateMode();
  // Continue modal: show if previous session reached >3% and <97%
  var modal = document.getElementById("continue-modal");
  if(p > 3 && p < 97){
    document.getElementById("continue-percent").textContent = Math.round(p)+"%";
    modal.classList.remove("hidden");
  } else {
    modal.classList.add("hidden");
  }
}
function dismissContinue(){
  document.getElementById("continue-modal").classList.add("hidden");
}
function restartReading(){
  // User chose "empezar de nuevo" — we need to (1) clear the local backup,
  // (2) reset data.progress.lastPercent on the server (otherwise the next
  // openLetter() reads it back and re-shows the Continue modal), and (3)
  // reset session trackers so any immediate close or scroll-to-0 doesn't
  // repersist the old resume point. We keep maxPercent as-is — it's a
  // historical fact that they reached that point once.
  var fromPercent = Math.round(pendingResumePercent || 0);
  try { localStorage.removeItem(LAST_PERCENT_KEY); } catch(e){}
  pendingResumePercent = 0;
  // Scrolling back to 0 will traverse every decile; resetDwell ensures the
  // very first tick after the smooth-scroll kicks in starts from a clean
  // slate rather than inheriting whatever was pending from the old position.
  resetDwell();
  if(data){
    if(!data.progress) data.progress = {maxPercent:0,lastPercent:0,lastUpdated:"",finishedLogged:false};
    data.progress.lastPercent = 0;
    data.progress.lastUpdated = new Date().toISOString();
    // lastSavedPercent stays at maxP so persistProgress doesn't spam saves
    // while the user scrolls back toward the top.
    saveData(data).catch(function(){});
  }
  if(!isAdmin) appendLog("progress", "Empezó de nuevo desde "+fromPercent+"%");
  dismissContinue();
  window.scrollTo({top:0, behavior:"smooth"});
}

function currentScrollPercent(){
  var doc = document.documentElement;
  var scrollTop = window.scrollY || doc.scrollTop || 0;
  var max = (doc.scrollHeight - doc.clientHeight);
  if(max <= 0) return 100;
  var p = (scrollTop / max) * 100;
  if(p < 0) p = 0; if(p > 100) p = 100;
  return p;
}
function updateProgressUI(p){
  var el = document.getElementById("progress-inner");
  if(el) el.style.width = p.toFixed(1)+"%";
  var lbl = document.getElementById("progress-percent");
  if(lbl) lbl.textContent = Math.round(p)+"%";
}

function resetDwell(){
  if(dwellPendingTimer){ clearTimeout(dwellPendingTimer); }
  dwellPendingTimer = null;
  dwellPendingMilestone = 0;
  dwellPendingStartTime = 0;
}
function fireDwellLog(){
  // Called when the dwell timer expires (or on tab-hide if enough time
  // elapsed). Logs the decile the user has been camping in — works for both
  // forward progress AND re-reading: if they reached 100%, closed the tab,
  // came back, scrolled to 30% and dwelt there, this fires "30% leído" so
  // the admin can tell apart "left at 100%" from "actually re-reading".
  var letterScreen = document.getElementById("letter-screen");
  if(!letterScreen || letterScreen.classList.contains("hidden")){ resetDwell(); return; }
  var curP = currentScrollPercent();
  var curDecile = Math.min(100, Math.floor(curP/10)*10);
  // If the user drifted out of the pending decile in the final moments
  // before the timer fired, don't credit it — the next onScrollTick will
  // rearm for wherever they actually are now.
  if(curDecile !== dwellPendingMilestone){ resetDwell(); return; }
  // Decile 0 (the top of the letter) isn't a milestone worth logging — it's
  // where every session starts.
  if(curDecile <= 0){ resetDwell(); return; }
  if(curDecile >= 100 && data && data.progress && !data.progress.finishedLogged){
    data.progress.finishedLogged = true;
    // Persist the finishedLogged flag so it doesn't re-fire on the next visit.
    saveData(data).catch(function(){});
    appendLog("finished","Carta terminada");
  } else {
    appendLog("progress", curDecile + "% leído");
  }
  // Keep dwellPendingMilestone pinned to the just-logged decile so fidgeting
  // within the same bucket (49% ↔ 51% is still decile 50) doesn't retrigger.
  // Only a genuine decile CHANGE in onScrollTick will rearm the timer.
  dwellPendingTimer = null;
  dwellPendingStartTime = 0;
}

function onScrollTick(){
  if(document.getElementById("letter-screen").classList.contains("hidden")) return;
  var p = currentScrollPercent();
  // Track max in memory (used when persisting to data.json) but display the
  // CURRENT scroll percent so the bar fills/empties as the user scrolls.
  if(p > maxPercentSession) maxPercentSession = p;
  updateProgressUI(p);
  // Synchronous local backup — guarantees the continue-modal has a value to
  // read on the next visit even if the network save never completes.
  try { localStorage.setItem(LAST_PERCENT_KEY, String(p)); } catch(e){}
  // Bidirectional dwell-gated logging: detect a decile CHANGE (up or down)
  // and restart the dwell timer. Scanning blows through deciles too fast for
  // any to survive; reading or re-reading sits in one decile long enough to
  // fire. The "fired" state is represented by dwellPendingTimer === null
  // while dwellPendingMilestone is still set — that keeps the same decile
  // from re-logging on tiny jitter after the log already went out.
  if(!isAdmin){
    var curDecile = Math.min(100, Math.floor(p/10)*10);
    if(curDecile <= 0){
      // Back at the top — clear any pending state so the next downward move
      // starts fresh.
      if(dwellPendingMilestone !== 0 || dwellPendingTimer) resetDwell();
    } else if(curDecile !== dwellPendingMilestone){
      // Entered a different decile (going UP or DOWN). Kill any in-flight
      // timer for the old decile and arm a new one for this one.
      if(dwellPendingTimer) clearTimeout(dwellPendingTimer);
      dwellPendingMilestone = curDecile;
      dwellPendingStartTime = Date.now();
      dwellPendingTimer = setTimeout(fireDwellLog, MILESTONE_DWELL_MS);
    }
    // else: same decile as we've been tracking — either the timer is still
    // counting down, or it already fired and we're waiting for the user to
    // leave this decile before logging anything new.
  }
  scheduleProgressSave();
}
function scheduleProgressSave(){
  if(progressSaveTimer) return;
  progressSaveTimer = setTimeout(function(){
    progressSaveTimer = null;
    persistProgress(false);
  }, 4000);
}

function persistProgress(force){
  if(!data || isAdmin) return Promise.resolve();
  var p = currentScrollPercent();
  var newMax = Math.max(maxPercentSession, p, (data.progress && data.progress.maxPercent) || 0);
  var delta = newMax - lastSavedPercent;
  if(!force && delta < 2) return Promise.resolve();
  if(!data.progress) data.progress = {maxPercent:0,lastPercent:0,lastUpdated:"",finishedLogged:false};
  data.progress.maxPercent = newMax;
  data.progress.lastPercent = p;
  data.progress.lastUpdated = new Date().toISOString();
  lastSavedPercent = newMax;
  // Progress and "finished" logging both live in fireDwellLog (gated by
  // dwell time) so a quick scroll-to-the-bottom scan doesn't count as a
  // read. persistProgress only saves the numbers here.
  return saveData(data).catch(function(e){console.warn("progress save failed",e);});
}

function resumeReading(){
  // Use the percent we captured when openLetter() decided to show the modal.
  // Falling back to data.progress.lastPercent alone would scroll to 0% when
  // the only record of the user's position is in the localStorage backup.
  var p = pendingResumePercent || (data.progress && data.progress.lastPercent) || 0;
  if(!isAdmin) appendLog("progress", "Continuó desde "+Math.round(p)+"%");
  dismissContinue();
  // Defer one frame so layout settles (modal is being hidden, scrollable
  // height can change slightly) before we compute the target.
  requestAnimationFrame(function(){
    var doc = document.documentElement;
    var target = (doc.scrollHeight - doc.clientHeight) * (p/100);
    window.scrollTo({top:target, behavior:"smooth"});
  });
}

var scrollTracking = false;
function attachScrollTracking(){
  if(scrollTracking) return;
  scrollTracking = true;
  window.addEventListener("scroll", throttle(onScrollTick, 250));
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState==="hidden"){
      // If a dwell timer is pending, decide its fate before tearing down:
      // fire it if enough time actually elapsed (user did dwell long enough,
      // we just haven't hit the setTimeout yet), otherwise cancel — we don't
      // want to credit a milestone the user hadn't earned just because they
      // closed the tab at the wrong moment.
      if(dwellPendingTimer){
        var elapsed = Date.now() - dwellPendingStartTime;
        clearTimeout(dwellPendingTimer);
        dwellPendingTimer = null;
        if(elapsed >= MILESTONE_DWELL_MS) fireDwellLog();
        else resetDwell();
      }
      persistProgress(true);
    }
  });
  window.addEventListener("beforeunload", function(){ persistProgress(true); });
  // Initial calc in case content fits in viewport
  setTimeout(onScrollTick, 300);
}
function throttle(fn, wait){
  var last=0, pending=null;
  return function(){
    var now = Date.now();
    if(now - last >= wait){ last = now; fn(); }
    else{
      if(pending) clearTimeout(pending);
      pending = setTimeout(function(){ last = Date.now(); fn(); }, wait);
    }
  };
}

// ── Admin rendering ─────────────────────────────────────────────────
function renderAdmin(){
  var align = data.textAlign || "justify";
  // Editors also go through renderRichContent so they're normalized too:
  // bogus Google-Docs <h2><p>...</p></h2> wrapping gets unwrapped (otherwise
  // A+/A- exposes h2's default bold), inline text-align is stripped from
  // every descendant, and the container's alignment is set to the current
  // setting (so paragraphs without their own alignment inherit justify
  // instead of falling back to left). When the admin saves, innerHTML
  // contains the normalized version, so data.json self-cleans over time.
  renderRichContent(document.getElementById("letter-editor"), data.letter || "", align);
  renderRichContent(document.getElementById("disc-editor"), data.disclaimer || "", align);
  renderRichContent(document.getElementById("farewell-editor"), data.farewell || "<p>Respeto tu decisión. Puedes volver cuando quieras leerla, estará aquí esperando.</p>", align);
  renderRichContent(document.getElementById("admin-letter-content"), data.letter || "", align);
  renderRichContent(document.getElementById("admin-disclaimer-content"), data.disclaimer || "", align);
  var maxP = (data.progress && data.progress.maxPercent) || 0;
  document.getElementById("admin-max-progress").textContent = Math.round(maxP)+"%";
  document.getElementById("admin-progress-inner").style.width = "0%";
  document.getElementById("admin-progress-label").textContent = "0%";
  document.getElementById("user-code-input").value = data.userCode || "";
  setSegmentedValue("text-align-seg", data.textAlign || "justify");
  document.getElementById("page-disabled-toggle").checked = !!data.pageDisabled;
  // PRIVATE-MODE (delete next block to revert)
  var pmt = document.getElementById("private-mode-toggle");
  if(pmt) pmt.checked = !!data.privateMode;
  // INVISIBLE-TEXT (delete next block to revert)
  var itt = document.getElementById("invisible-text-toggle");
  if(itt) itt.checked = !!data.invisibleText;
  // GATE-TEXT: populate gate-customization inputs
  var gt = document.getElementById("gate-title-input");
  if(gt) gt.value = data.gateTitle || "";
  var gs = document.getElementById("gate-sub-input");
  if(gs) gs.value = data.gateSub || "";
  renderLogs();
  attachAdminScrollTracking();
}

/* Live-track the admin's scroll through the admin preview and update the
   preview's progress bar. Gives the admin the same fill-as-you-scroll
   experience the user will have, instead of a static "max %" fill. */
var adminScrollAttached = false;
function updateAdminProgress(){
  var adminScreen = document.getElementById("admin-screen");
  var panel = document.getElementById("panel-view-letter");
  if(!adminScreen || adminScreen.classList.contains("hidden")) return;
  if(!panel || panel.classList.contains("hidden")) return;
  var el = document.getElementById("admin-letter-content");
  if(!el) return;
  var rect = el.getBoundingClientRect();
  var vh = window.innerHeight || document.documentElement.clientHeight;
  var elH = rect.height;
  var elTop = rect.top;
  // 0% when top of element is at viewport bottom (haven't started reading)
  // 100% when bottom of element reaches viewport top (done)
  var progress;
  if(elH <= 0 || elH <= vh){
    // Element shorter than viewport: fully visible once in view
    progress = elTop <= 0 ? 100 : (elTop < vh ? ((vh - elTop) / vh) * 100 : 0);
  } else {
    var range = elH - vh;
    progress = Math.max(0, Math.min(100, (-elTop) / range * 100));
  }
  var bar = document.getElementById("admin-progress-inner");
  var lbl = document.getElementById("admin-progress-label");
  if(bar) bar.style.width = progress.toFixed(1)+"%";
  if(lbl) lbl.textContent = Math.round(progress)+"%";
}
function attachAdminScrollTracking(){
  if(adminScrollAttached) return;
  adminScrollAttached = true;
  window.addEventListener("scroll", function(){ updateAdminProgress(); }, {passive:true});
  window.addEventListener("resize", function(){ updateAdminProgress(); });
  setTimeout(updateAdminProgress, 100);
}

// ── Editor helpers ──────────────────────────────────────────────────
var activeEditor = "letter-editor";
/* Selection memory: save the caret/selection every time it changes inside any
   .richtext editor. When a toolbar button is clicked the contenteditable can
   lose focus (and therefore the selection) before the onclick handler runs;
   we use savedRange to restore it. This is more reliable than just calling
   event.preventDefault on mousedown, which some browsers don't honour when
   the listener is attached at the document level. */
var savedRange = null;
var savedEditorId = null;
document.addEventListener("selectionchange", function(){
  var sel = window.getSelection();
  if(!sel || sel.rangeCount === 0) return;
  var r = sel.getRangeAt(0);
  var n = r.commonAncestorContainer;
  while(n && n !== document){
    if(n.nodeType === 1 && n.classList && n.classList.contains("richtext")){
      savedRange = r.cloneRange();
      savedEditorId = n.id;
      return;
    }
    n = n.parentNode;
  }
});
function restoreSelection(editorId){
  var editor = document.getElementById(editorId);
  if(!editor) return false;
  editor.focus();
  if(!savedRange || savedEditorId !== editorId) return false;
  if(!editor.contains(savedRange.commonAncestorContainer)) return false;
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
  return !savedRange.collapsed;
}
function focusEditor(id){ activeEditor=id; restoreSelection(id) || document.getElementById(id).focus(); }
function execCmd(cmd,id){ focusEditor(id); document.execCommand(cmd,false,null); }
function addHeading(id){ focusEditor(id); document.execCommand("formatBlock",false,"h2"); }
function addParagraph(id){ focusEditor(id); document.execCommand("formatBlock",false,"p"); }
function addHR(id){ focusEditor(id); document.execCommand("insertHorizontalRule",false,null); }
function addLink(id){ var u = prompt("URL del enlace:"); if(u){ focusEditor(id); document.execCommand("createLink",false,u); } }
function addImage(id){ activeEditor=id; document.getElementById("img-"+id).click(); }
/* Font sizes in rem, so they're ABSOLUTE (not relative to parent). Index 2
   (1rem) is "Normal". bumpFontSize(id, delta) reads the current size of the
   selection, picks the next preset up or down, and wraps the selection via
   document.execCommand('insertHTML') — going through execCommand means the
   change lands on the browser's native undo stack, so Ctrl+Z works. */
var FONT_SIZES = [0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.8];
var FONT_SIZE_NORMAL_IDX = 2;
function detectSizeIdx(node){
  while(node && node.nodeType !== 1) node = node.parentNode;
  if(!node) return FONT_SIZE_NORMAL_IDX;
  var fsPx = parseFloat(window.getComputedStyle(node).fontSize);
  var baseFs = parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  var fsRem = fsPx / baseFs;
  var closest = FONT_SIZE_NORMAL_IDX, minDiff = Infinity;
  for(var i=0;i<FONT_SIZES.length;i++){
    var d = Math.abs(FONT_SIZES[i]-fsRem);
    if(d < minDiff){ minDiff = d; closest = i; }
  }
  return closest;
}
function bumpFontSize(editorId, delta){
  var editor = document.getElementById(editorId);
  if(!editor) return;
  // Restore the selection the user made before they clicked the button. If
  // they never had one (or the saved range is collapsed), bail without doing
  // anything — silently resizing nothing is better than wrapping an empty span.
  if(!restoreSelection(editorId)) return;
  var sel = window.getSelection();
  if(!sel || sel.rangeCount===0) return;
  var range = sel.getRangeAt(0);
  if(!editor.contains(range.commonAncestorContainer)) return;
  if(range.collapsed) return;
  var idx;
  if(delta === 0){
    idx = FONT_SIZE_NORMAL_IDX;
  } else {
    var current = detectSizeIdx(range.startContainer);
    idx = Math.max(0, Math.min(FONT_SIZES.length-1, current + delta));
  }
  var target = FONT_SIZES[idx] + "rem";

  // Multi-block branch — triggered by Ctrl+A or any selection that spans more
  // than one top-level block. Wrapping the whole thing in a single <span> is
  // invalid HTML (span can't contain block elements) and browsers silently
  // drop the wrapper on execCommand("insertHTML"), so the font size never
  // changes. Instead we set style.fontSize directly on each block that
  // intersects the selection. Ctrl+Z won't undo this one (no execCommand)
  // but that's a reasonable tradeoff: the buttons now actually do something.
  var blockTags = {P:1,DIV:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,LI:1,BLOCKQUOTE:1,PRE:1};
  var topBlocks = [];
  for(var i=0;i<editor.children.length;i++){
    var child = editor.children[i];
    if(range.intersectsNode(child)) topBlocks.push(child);
  }
  if(topBlocks.length > 1 || (range.commonAncestorContainer === editor && topBlocks.length >= 1)){
    topBlocks.forEach(function(b){
      if(blockTags[b.tagName]){
        b.style.fontSize = target;
        // Also clear font-size on any inner spans so the block's size wins,
        // otherwise old inline sizes on descendants override the new value.
        var inner = b.querySelectorAll("[style*='font-size']");
        for(var j=0;j<inner.length;j++) inner[j].style.fontSize = "";
      } else {
        // Non-block top-level child (e.g. a stray text run) — wrap it.
        var span = document.createElement("span");
        span.style.fontSize = target;
        b.parentNode.insertBefore(span, b);
        span.appendChild(b);
      }
    });
    var r2 = document.createRange();
    r2.setStartBefore(topBlocks[0]);
    r2.setEndAfter(topBlocks[topBlocks.length-1]);
    var sel2 = window.getSelection();
    sel2.removeAllRanges();
    sel2.addRange(r2);
    savedRange = r2.cloneRange();
    savedEditorId = editorId;
    return;
  }

  // Single-block branch — wrap the selection in a span via execCommand so
  // Ctrl+Z works on the standard undo stack.
  // Tag the inserted wrapper so we can find it afterwards and re-select its
  // contents. Without this, execCommand('insertHTML') collapses the caret at
  // the end of the inserted text, so a second click on A-/A+ would see an
  // empty selection and do nothing.
  var markerId = "fontmark_" + Date.now() + "_" + Math.floor(Math.random()*1000);
  var frag = range.cloneContents();
  var tmp = document.createElement("div"); tmp.appendChild(frag);
  var html = '<span id="'+markerId+'" style="font-size:'+target+'">'+tmp.innerHTML+'</span>';
  // execCommand -> native undo/redo support (Ctrl+Z works)
  document.execCommand("insertHTML", false, html);
  var marker = document.getElementById(markerId);
  if(marker){
    var r3 = document.createRange();
    r3.selectNodeContents(marker);
    var sel3 = window.getSelection();
    sel3.removeAllRanges();
    sel3.addRange(r3);
    marker.removeAttribute("id");
    savedRange = r3.cloneRange();
    savedEditorId = editorId;
  }
}
function compressImage(file,maxW,quality,cb){
  var rd = new FileReader();
  rd.onload = function(e){
    var img = new Image();
    img.onload = function(){
      var w = img.width, h = img.height;
      if(w > maxW){ h = Math.round(h*maxW/w); w = maxW; }
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      cb(c.toDataURL("image/jpeg",quality));
    };
    img.src = e.target.result;
  };
  rd.readAsDataURL(file);
}
function insertImage(input,id){
  if(!input.files || !input.files[0]) return;
  compressImage(input.files[0], 900, 0.72, function(dataUrl){
    document.getElementById(id).focus();
    document.execCommand("insertImage", false, dataUrl);
  });
  input.value = "";
}

// Image resize popup
var selectedImg = null;
function closeImgPopup(){
  var ov = document.querySelector(".img-resize-overlay");
  var pp = document.querySelector(".img-resize-popup");
  if(ov) ov.remove(); if(pp) pp.remove();
  if(selectedImg){ selectedImg.classList.remove("img-selected"); selectedImg=null; }
}
function openImgResize(img){
  closeImgPopup();
  selectedImg = img;
  img.classList.add("img-selected");
  var natW = img.naturalWidth||img.width, natH = img.naturalHeight||img.height;
  var curW = img.width, curH = img.height;
  var ratio = natW/natH;
  var ov = document.createElement("div"); ov.className="img-resize-overlay"; ov.onclick=closeImgPopup;
  document.body.appendChild(ov);
  var pp = document.createElement("div"); pp.className="img-resize-popup";
  pp.innerHTML =
    '<h3>Tama&ntilde;o de imagen</h3>'+
    '<div class="fields">'+
      '<div><label>Ancho (px)</label><br><input type="number" id="img-w" value="'+curW+'" min="10"></div>'+
      '<div><label>Alto (px)</label><br><input type="number" id="img-h" value="'+curH+'" min="10"></div>'+
    '</div>'+
    '<div class="btns">'+
      '<button class="btn btn-sm btn-ghost" onclick="closeImgPopup()">Cancelar</button>'+
      '<button class="btn btn-sm" onclick="applyImgSize()">Aplicar</button>'+
    '</div>';
  document.body.appendChild(pp);
  var wIn = document.getElementById("img-w");
  var hIn = document.getElementById("img-h");
  wIn.oninput = function(){ hIn.value = Math.round(parseInt(wIn.value)/ratio)||""; };
  hIn.oninput = function(){ wIn.value = Math.round(parseInt(hIn.value)*ratio)||""; };
}
function applyImgSize(){
  if(!selectedImg) return;
  var w = parseInt(document.getElementById("img-w").value);
  var h = parseInt(document.getElementById("img-h").value);
  if(w>0) selectedImg.style.width = w+"px";
  if(h>0) selectedImg.style.height = h+"px";
  selectedImg.removeAttribute("width"); selectedImg.removeAttribute("height");
  closeImgPopup();
}
document.addEventListener("click", function(e){
  if(e.target.tagName==="IMG" && e.target.closest(".richtext")){
    e.preventDefault();
    openImgResize(e.target);
  }
});
/* Toolbar buttons: prevent mousedown from stealing focus from the
   contenteditable. Without this, clicking A+/A-/B/I/U collapses the
   user's selection before the onclick handler runs, so font-size and
   other commands that depend on a live selection silently do nothing. */
document.addEventListener("mousedown", function(e){
  var btn = e.target.closest(".toolbar button");
  if(btn) e.preventDefault();
});

// ── Save actions ────────────────────────────────────────────────────
function statusOk(el){ el.className="status ok"; el.textContent="Guardado"; setTimeout(function(){el.textContent="";},2500); }
function statusErr(el,msg){ el.className="status err"; el.textContent=msg||"Error"; setTimeout(function(){el.textContent="";},3500); }
function statusLoading(el){ el.className="status"; el.innerHTML='<span class="spinner"></span>Guardando...'; }

function saveLetter(){
  var st = document.getElementById("letter-save-status"); statusLoading(st);
  data.letter = document.getElementById("letter-editor").innerHTML;
  var align = data.textAlign || "justify";
  saveData(data).then(function(r){
    if(r.content){
      statusOk(st);
      renderRichContent(document.getElementById("admin-letter-content"), data.letter, align);
    } else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}
function saveDisclaimer(){
  var st = document.getElementById("disc-save-status"); statusLoading(st);
  data.disclaimer = document.getElementById("disc-editor").innerHTML;
  var align = data.textAlign || "justify";
  saveData(data).then(function(r){
    if(r.content){
      statusOk(st);
      renderRichContent(document.getElementById("admin-disclaimer-content"), data.disclaimer, align);
    } else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}
function saveFarewell(){
  var st = document.getElementById("farewell-save-status"); statusLoading(st);
  data.farewell = document.getElementById("farewell-editor").innerHTML;
  saveData(data).then(function(r){
    if(r.content) statusOk(st);
    else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}
// GATE-TEXT: admin save for login-screen title/subtitle.
function saveGate(){
  var st = document.getElementById("gate-save-status"); statusLoading(st);
  var t = document.getElementById("gate-title-input").value.trim();
  var s = document.getElementById("gate-sub-input").value.trim();
  if(!t){ statusErr(st,"El título no puede estar vacío"); return; }
  if(!s){ statusErr(st,"El subtítulo no puede estar vacío"); return; }
  data.gateTitle = t;
  data.gateSub = s;
  saveData(data).then(function(r){
    if(r.content){
      statusOk(st);
      applyGateCustomization(data);
    } else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}
function saveSettings(){
  var st = document.getElementById("settings-status");
  var newCode = document.getElementById("user-code-input").value.trim();
  if(!newCode){ statusErr(st,"El código no puede estar vacío"); return; }
  statusLoading(st);
  var oldCode = data.userCode;
  data.userCode = newCode;
  data.pageDisabled = document.getElementById("page-disabled-toggle").checked;
  // PRIVATE-MODE (delete next line to revert)
  data.privateMode = document.getElementById("private-mode-toggle").checked;
  // INVISIBLE-TEXT (delete next 2 lines to revert)
  data.invisibleText = document.getElementById("invisible-text-toggle").checked;
  applyInvisibleText();
  data.textAlign = getSegmentedValue("text-align-seg") || "justify";
  // Re-render every admin preview (and user view if it's live) with the new
  // alignment, stripping any inline text-align from pasted content so the
  // container's chosen alignment actually wins. Editors are included so
  // paragraphs without explicit alignment reflect the setting immediately.
  var adminLetter = document.getElementById("admin-letter-content");
  if(adminLetter) renderRichContent(adminLetter, data.letter || "", data.textAlign);
  var adminDisc = document.getElementById("admin-disclaimer-content");
  if(adminDisc) renderRichContent(adminDisc, data.disclaimer || "", data.textAlign);
  var letterEd = document.getElementById("letter-editor");
  if(letterEd) letterEd.style.textAlign = data.textAlign;
  var discEd = document.getElementById("disc-editor");
  if(discEd) discEd.style.textAlign = data.textAlign;
  var farewellEd = document.getElementById("farewell-editor");
  if(farewellEd) farewellEd.style.textAlign = data.textAlign;
  var userLetter = document.getElementById("letter-content");
  if(userLetter && userLetter.innerHTML) renderRichContent(userLetter, data.letter || "", data.textAlign);
  var userDisc = document.getElementById("disclaimer-content");
  if(userDisc && userDisc.innerHTML) renderRichContent(userDisc, data.disclaimer || "", data.textAlign);
  var userFarewell = document.getElementById("farewell-content");
  if(userFarewell && userFarewell.innerHTML) renderRichContent(userFarewell, data.farewell || "", data.textAlign);
  var chain;
  if(newCode !== oldCode){
    // Re-encrypt the user token with the new code
    chain = encryptToken(ghToken, newCode).then(function(enc){ data.encUserToken = enc; });
  } else {
    chain = Promise.resolve();
  }
  chain.then(function(){ return saveData(data); }).then(function(r){
    if(r.content) statusOk(st);
    else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}
function resetProgress(){
  if(!confirm("¿Reiniciar el progreso del usuario? (se perderá el porcentaje actual)")) return;
  var st = document.getElementById("reset-progress-status"); statusLoading(st);
  data.progress = {maxPercent:0,lastPercent:0,lastUpdated:"",finishedLogged:false};
  // Clear the user's local backup too — admins share the deploy URL so the
  // LS entry could otherwise stick around on the admin's own browser.
  try { localStorage.removeItem(LAST_PERCENT_KEY); } catch(e){}
  saveData(data).then(function(r){
    if(r.content){
      document.getElementById("admin-progress-inner").style.width="0%";
      var resetLabel = document.getElementById("admin-progress-label");
      if(resetLabel) resetLabel.textContent="0%";
      document.getElementById("admin-max-progress").textContent="0%";
      statusOk(st);
    } else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}

// ── Logs ────────────────────────────────────────────────────────────
var activeLogFilter = "all";
function refreshLogs(){
  var st = document.getElementById("logs-status"); statusLoading(st);
  fetchData().then(function(d){
    data.logs = d.logs || [];
    data.progress = d.progress || data.progress;
    renderLogs();
    // Also refresh progress indicators in view-letter tab
    var maxP = (data.progress && data.progress.maxPercent) || 0;
    var api = document.getElementById("admin-progress-inner");
    if(api) api.style.width = maxP.toFixed(1)+"%";
    var al = document.getElementById("admin-progress-label"); if(al) al.textContent = Math.round(maxP)+"%";
    var am = document.getElementById("admin-max-progress"); if(am) am.textContent = Math.round(maxP)+"%";
    statusOk(st);
  }).catch(function(){ statusErr(st,"Error al actualizar"); });
}
function renderLogs(){
  var logs = (data.logs || []).slice().reverse();
  if(activeLogFilter !== "all") logs = logs.filter(function(l){ return l.type === activeLogFilter; });
  var wrap = document.getElementById("logs-wrap");
  if(!logs.length){
    wrap.innerHTML = '<div class="logs-empty">Sin registros todav&iacute;a.</div>';
    return;
  }
  var rows = logs.map(function(l){
    var chipClass = l.type;
    if(l.type === "login") chipClass = (l.role==="admin") ? "admin" : "login";
    var chipLabel = {
      login: l.role==="admin" ? "ADMIN" : "ACCESO",
      read: "LEER",
      cancel: "CANCELAR",
      progress: "PROGRESO",
      finished: "TERMINADA",
      disclaimer_shown: "DISCLAIMER"
    }[l.type] || (l.type||"").toUpperCase();
    return '<tr>'+
      '<td style="white-space:nowrap;color:var(--muted)">'+escapeHtml(l.ts||"")+'</td>'+
      '<td><span class="log-chip '+chipClass+'">'+chipLabel+'</span></td>'+
      '<td>'+escapeHtml(l.detail||"")+'</td>'+
      '<td style="color:var(--muted);font-size:.76rem">'+escapeHtml(l.ip||"")+'</td>'+
      '<td style="color:var(--muted);font-size:.76rem;font-family:monospace">'+escapeHtml(l.fp||"")+'</td>'+
    '</tr>';
  }).join("");
  wrap.innerHTML =
    '<table>'+
      '<thead><tr><th>Fecha (Madrid)</th><th>Tipo</th><th>Detalle</th><th>IP</th><th>Fingerprint</th></tr></thead>'+
      '<tbody>'+rows+'</tbody>'+
    '</table>';
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];
  });
}
function clearLogs(){
  if(!confirm("¿Borrar todos los logs?")) return;
  var st = document.getElementById("logs-status"); statusLoading(st);
  data.logs = [];
  saveData(data).then(function(r){
    if(r.content){ renderLogs(); statusOk(st); }
    else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}

// ── Tabs ────────────────────────────────────────────────────────────
document.addEventListener("click", function(e){
  if(e.target.classList && e.target.classList.contains("logs-filter-btn")){
    document.querySelectorAll(".logs-filter-btn").forEach(function(b){b.classList.remove("active");});
    e.target.classList.add("active");
    activeLogFilter = e.target.getAttribute("data-filter");
    renderLogs();
    return;
  }
  if(!e.target.classList || !e.target.classList.contains("tab")) return;
  var name = e.target.getAttribute("data-tab");
  document.querySelectorAll(".tab").forEach(function(t){t.classList.remove("active");});
  e.target.classList.add("active");
  document.querySelectorAll(".panel").forEach(function(p){p.classList.add("hidden");});
  var panel = document.getElementById("panel-"+name);
  if(panel) panel.classList.remove("hidden");
  if(name==="logs") refreshLogs();
  var adminAlign = (data && data.textAlign) || "justify";
  if(name==="view-letter"){
    renderRichContent(document.getElementById("admin-letter-content"), data.letter||"", adminAlign);
  }
  if(name==="view-disclaimer"){
    renderRichContent(document.getElementById("admin-disclaimer-content"), data.disclaimer||"", adminAlign);
  }
});

/* Segmented pill helpers */
function getSegmentedValue(groupId){
  var g = document.getElementById(groupId);
  if(!g) return null;
  var active = g.querySelector(".segmented-btn.active");
  return active ? active.getAttribute("data-value") : null;
}
function setSegmentedValue(groupId, value){
  var g = document.getElementById(groupId);
  if(!g) return;
  var btns = g.querySelectorAll(".segmented-btn");
  for(var i=0;i<btns.length;i++){
    btns[i].classList.toggle("active", btns[i].getAttribute("data-value") === value);
  }
}
/* Clicking a segmented button selects it + live-previews the alignment in
   the admin "Ver carta" tab so the admin can compare center vs justify
   instantly (the value isn't persisted until "Guardar configuración"). */
document.addEventListener("click", function(e){
  var btn = e.target && e.target.closest && e.target.closest(".segmented-btn");
  if(!btn) return;
  var group = btn.parentElement;
  var siblings = group.querySelectorAll(".segmented-btn");
  for(var i=0;i<siblings.length;i++) siblings[i].classList.remove("active");
  btn.classList.add("active");
  if(group.id === "text-align-seg"){
    var newAlign = btn.getAttribute("data-value") || "justify";
    /* Live-preview across every surface so the admin can compare
       alignments instantly (not persisted until "Guardar configuración"). */
    var al = document.getElementById("admin-letter-content");
    if(al) renderRichContent(al, data.letter || "", newAlign);
    var ad = document.getElementById("admin-disclaimer-content");
    if(ad) renderRichContent(ad, data.disclaimer || "", newAlign);
    // Editors: only nudge the container's text-align (editing in progress —
    // don't reset innerHTML mid-edit and throw away the user's work).
    var le = document.getElementById("letter-editor");
    if(le) le.style.textAlign = newAlign;
    var de = document.getElementById("disc-editor");
    if(de) de.style.textAlign = newAlign;
    var fe = document.getElementById("farewell-editor");
    if(fe) fe.style.textAlign = newAlign;
    var lc = document.getElementById("letter-content");
    if(lc && lc.innerHTML) renderRichContent(lc, data.letter || "", newAlign);
    var dc = document.getElementById("disclaimer-content");
    if(dc && dc.innerHTML) renderRichContent(dc, data.disclaimer || "", newAlign);
    var fc = document.getElementById("farewell-content");
    if(fc && fc.innerHTML) renderRichContent(fc, data.farewell || "", newAlign);
  }
});

// ── Logout / navigation ─────────────────────────────────────────────
function logout(){
  persistProgress(true);
  // INVISIBLE-TEXT (delete next line to revert)
  document.body.classList.remove("text-invisible");
  data=null; isAdmin=false; ghToken=null; fileSha=null;
  document.getElementById("code").value="";
  document.querySelectorAll(".tab").forEach(function(t,i){t.classList.toggle("active", i===0);});
  document.querySelectorAll(".panel").forEach(function(p,i){
    if(i===0) p.classList.remove("hidden"); else p.classList.add("hidden");
  });
  show("gate");
  setTimeout(function(){ document.getElementById("code").focus(); }, 100);
}
function backToLogin(){ logout(); }

// ── Events ──────────────────────────────────────────────────────────
document.getElementById("code").addEventListener("keydown", function(e){
  if(e.key === "Enter") unlock();
});
document.getElementById("unlock-btn").addEventListener("click", unlock);
document.getElementById("btn-read").addEventListener("click", onDisclaimerRead);
document.getElementById("btn-cancel").addEventListener("click", onDisclaimerCancel);
document.getElementById("btn-continue-resume").addEventListener("click", resumeReading);
document.getElementById("btn-continue-restart").addEventListener("click", restartReading);

// GATE-TEXT: anonymous pre-login fetch. Pulls data.json with no auth so
// the very first thing the visitor sees has the admin's custom copy. If
// the fetch fails (offline, rate-limit, etc.) the template defaults stay
// and behavior is unchanged. Uses the same fetchData pipeline so the
// sha / content paths are handled identically.
fetchData().then(applyGateCustomization).catch(function(){});

</script>
</body>
</html>`;
}

// ── Main ────────────────────────────────────────────────────────────
function main() {
  const html = buildHTML();
  fs.writeFileSync(path.join(__dirname, "index.html"), html);
  console.log("index.html generated!");
  console.log('Admin code: "' + ADMIN_CODE + '"');
  console.log('Default user code: "' + DEFAULT_USER_CODE + '"');
  console.log("Deploy URL: " + DEPLOY_URL);
}

main();
