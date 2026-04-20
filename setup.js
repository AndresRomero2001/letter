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
    pageDisabled: false,
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
  --papyrus-ink: #0d2038;
  --papyrus-ink-soft: rgba(13,32,56,0.72);
  --crystal-core: #0a1828;
  --crystal-dark: #1e3a5a;
  --crystal-mid: #587da5;
  --crystal-mid-light: #87adcb;
  --crystal-light: #b4d2e8;
  --crystal-highlight: #dae9f3;
}
*{margin:0;padding:0;box-sizing:border-box}
body{
  min-height:100vh;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  background:linear-gradient(135deg,var(--bg1),var(--bg2),var(--bg3));
  color:var(--text);
}
body.letter-mode{
  background:
    radial-gradient(ellipse at 15% 10%, rgba(60,110,170,0.35), transparent 60%),
    radial-gradient(ellipse at 85% 90%, rgba(90,70,180,0.28), transparent 60%),
    linear-gradient(160deg, #040912 0%, #081628 40%, #0c2442 72%, #040b18 100%);
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
.card.wide{max-width:680px;text-align:left;padding:28px 28px 20px}
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
  color:var(--accent);margin-bottom:16px;
}
.tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}
.tab{
  padding:8px 14px;border-radius:10px;border:none;background:rgba(255,255,255,.06);
  color:var(--muted);cursor:pointer;font-size:.85rem;font-weight:500;transition:.2s;
}
.tab:hover{background:rgba(255,255,255,.1);color:#fff}
.tab.active{background:rgba(139,92,246,.25);color:var(--accent)}

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
  padding:36px 32px;max-width:520px;width:100%;
  box-shadow:0 8px 32px rgba(0,0,0,.3);
}
.disclaimer-card .icon{font-size:44px;text-align:center;margin-bottom:12px}
.disclaimer-content{
  line-height:1.7;font-size:.98rem;color:rgba(255,255,255,.9);
  margin-bottom:28px;max-height:50vh;overflow-y:auto;padding-right:4px;
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
.farewell-card p{color:rgba(255,255,255,.8);line-height:1.7;margin-bottom:24px}

/* ─────────── PAPYRUS ─────────── */
.letter-wrap{
  width:100%;max-width:720px;margin:0 auto;padding:30px 16px 60px;
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
.progress-outer{
  width:100%;height:6px;background:rgba(180,218,245,.1);border-radius:3px;
  overflow:hidden;margin-bottom:14px;position:relative;
  border:1px solid rgba(180,218,245,.2);
}
.progress-inner{
  height:100%;width:0%;border-radius:3px;transition:width .3s ease;
  background:linear-gradient(90deg,#5d91b8,#b3d5ec,#dae9f3,#b3d5ec,#5d91b8);
  box-shadow:0 0 10px rgba(180,220,255,.55);
}
.progress-label-row{
  display:flex;justify-content:space-between;font-size:.78rem;
  color:rgba(180,218,245,.65);margin-bottom:10px;letter-spacing:1px;
}

.papyrus{
  position:relative;width:100%;padding:46px 0;
  filter:drop-shadow(0 22px 50px rgba(5,15,40,.55));
}
/* Rolled-scroll cylinder with concentric rings at each end */
.papyrus-roll{
  position:absolute;left:-6px;right:-6px;height:46px;z-index:3;
  pointer-events:none;
  background:
    linear-gradient(180deg,
      #0a1828 0%,
      #1e3a5a 7%,
      #4a7198 18%,
      #87adcb 32%,
      #c2dbef 48%,
      #a2c4dd 58%,
      #6d94bb 72%,
      #2e4d70 86%,
      #0a1828 100%);
  border-radius:4px;
  box-shadow:
    0 8px 22px rgba(5,15,40,.55),
    inset 0 2px 3px rgba(255,255,255,.4),
    inset 0 -2px 3px rgba(0,8,22,.55);
}
/* Subtle inner lines on the rod to suggest depth */
.papyrus-roll::after{
  content:"";position:absolute;top:0;bottom:0;left:42px;right:42px;pointer-events:none;
  background:
    linear-gradient(180deg,
      transparent 30%,
      rgba(255,255,255,.18) 38%,
      transparent 44%,
      rgba(0,10,25,.35) 58%,
      transparent 64%);
}
/* LEFT spiral end-cap (rolled paper cross-section) */
.papyrus-roll::before{
  content:"";position:absolute;top:-9px;bottom:-9px;left:-22px;width:64px;
  pointer-events:none;border-radius:50%;
  background:
    radial-gradient(circle at 50% 50%,
      #0a1828 0 6%,
      #1e3a5a 6% 8%,
      #587da5 8% 14%,
      #1e3a5a 14% 16%,
      #87adcb 16% 24%,
      #1e3a5a 24% 26%,
      #587da5 26% 34%,
      #1e3a5a 34% 36%,
      #b4d2e8 36% 46%,
      #1e3a5a 46% 48%,
      #87adcb 48% 60%,
      #1e3a5a 60% 62%,
      #dae9f3 62% 74%,
      #6d94bb 74% 86%,
      #1e3a5a 86% 94%,
      #0a1828 94% 100%);
  box-shadow:
    0 6px 16px rgba(5,15,40,.65),
    inset 0 2px 4px rgba(255,255,255,.4),
    inset 0 -2px 4px rgba(0,8,22,.55),
    inset 2px 0 3px rgba(255,255,255,.25),
    inset -2px 0 3px rgba(0,8,22,.4);
}
/* RIGHT spiral end-cap (an inner element since ::before/::after already used) */
.papyrus-roll-right{
  position:absolute;top:-9px;bottom:-9px;right:-22px;width:64px;
  pointer-events:none;border-radius:50%;z-index:4;
  background:
    radial-gradient(circle at 50% 50%,
      #0a1828 0 6%,
      #1e3a5a 6% 8%,
      #587da5 8% 14%,
      #1e3a5a 14% 16%,
      #87adcb 16% 24%,
      #1e3a5a 24% 26%,
      #587da5 26% 34%,
      #1e3a5a 34% 36%,
      #b4d2e8 36% 46%,
      #1e3a5a 46% 48%,
      #87adcb 48% 60%,
      #1e3a5a 60% 62%,
      #dae9f3 62% 74%,
      #6d94bb 74% 86%,
      #1e3a5a 86% 94%,
      #0a1828 94% 100%);
  box-shadow:
    0 6px 16px rgba(5,15,40,.65),
    inset 0 2px 4px rgba(255,255,255,.4),
    inset 0 -2px 4px rgba(0,8,22,.55),
    inset 2px 0 3px rgba(255,255,255,.25),
    inset -2px 0 3px rgba(0,8,22,.4);
}
/* Small bright highlight on each end-cap to suggest glossy glass */
.papyrus-roll::before,.papyrus-roll-right{
  background-blend-mode:normal;
}
.papyrus-roll.top{top:0}
.papyrus-roll.bottom{bottom:0}
.papyrus-body{
  position:relative;
  background:
    linear-gradient(180deg,
      rgba(195,228,255,0.16) 0%,
      rgba(150,200,245,0.24) 30%,
      rgba(170,215,250,0.22) 65%,
      rgba(195,228,255,0.16) 100%);
  backdrop-filter:blur(30px) saturate(180%);
  -webkit-backdrop-filter:blur(30px) saturate(180%);
  border-left:1px solid rgba(180,220,255,.3);
  border-right:1px solid rgba(180,220,255,.3);
  box-shadow:
    inset 0 0 120px rgba(80,140,210,.2),
    inset 60px 0 90px -55px rgba(170,215,250,.18),
    inset -60px 0 90px -55px rgba(170,215,250,.18),
    inset 0 30px 50px -25px rgba(220,235,250,.15),
    0 2px 0 0 rgba(30,60,100,.3);
  padding:78px 56px 88px;
  min-height:62vh;
  overflow:hidden;
}
.papyrus-body::before{
  content:"";position:absolute;inset:0;pointer-events:none;opacity:.22;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.18  0 0 0 0 0.34  0 0 0 0 0.54  0 0 0 0.22 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  mix-blend-mode:overlay;
}
.papyrus-body::after{
  content:"";position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(ellipse at 28% 18%, rgba(225,240,255,.22), transparent 45%),
    radial-gradient(ellipse at 75% 85%, rgba(170,210,245,.14), transparent 50%);
}
.letter-content{
  position:relative;z-index:1;
  font-family:'EB Garamond','Cormorant Garamond',Georgia,serif;
  font-size:1.18rem;line-height:1.95;color:var(--papyrus-ink);
  text-align:justify;hyphens:auto;
  letter-spacing:.2px;
}
.letter-content h1,.letter-content h2,.letter-content h3{
  font-family:'Cinzel',serif;color:#08172b;text-align:center;
  margin:.5em 0 .8em;letter-spacing:2px;
  text-shadow:0 1px 1px rgba(220,238,255,.35);
}
.letter-content h2{font-size:1.5rem}
.letter-content h3{font-size:1.15rem;letter-spacing:1px}
.letter-content p{margin-bottom:1.1em;text-indent:1.8em}
.letter-content p:first-of-type{text-indent:0}
.letter-content p:first-of-type::first-letter{
  font-family:'Cinzel',serif;font-size:3.2rem;float:left;line-height:.9;
  padding:4px 10px 0 0;color:#1a3860;
  text-shadow:0 1px 2px rgba(220,238,255,.4);
}
.letter-content a{color:#1d4a7b;text-decoration:underline}
.letter-content em,.letter-content i{color:#153660}
.letter-content strong,.letter-content b{color:#08172b}
.letter-content hr{
  border:none;height:1px;margin:24px auto;width:60%;
  background:linear-gradient(90deg,transparent,rgba(30,60,100,.5),transparent);
}
.letter-content img{max-width:100%;border-radius:6px;margin:12px 0;
  box-shadow:0 4px 14px rgba(10,30,60,.3);}
.letter-content blockquote{
  border-left:3px solid rgba(30,60,100,.45);padding-left:14px;
  margin:14px 0;font-style:italic;color:var(--papyrus-ink-soft);
}

.continue-banner{
  position:relative;z-index:2;margin-bottom:24px;
  background:rgba(40,90,150,.14);border:1px solid rgba(140,190,230,.35);
  border-radius:12px;padding:14px 18px;
  display:flex;align-items:center;justify-content:space-between;
  gap:12px;flex-wrap:wrap;
  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
}
.continue-banner .text{font-family:'EB Garamond',serif;color:#0f2c4a;font-size:.95rem}
.continue-banner button{
  background:linear-gradient(135deg,#3a6b99,#1a3a62);color:#e6f1fa;
  border:none;padding:8px 16px;border-radius:10px;cursor:pointer;
  font-size:.85rem;font-weight:600;font-family:'EB Garamond',serif;letter-spacing:.5px;
  box-shadow:0 2px 8px rgba(15,40,80,.3);
}
.continue-banner button:hover{box-shadow:0 4px 14px rgba(30,80,140,.5)}

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
.papyrus-preview-bg{
  background:
    radial-gradient(ellipse at 15% 10%, rgba(60,110,170,0.28), transparent 60%),
    radial-gradient(ellipse at 85% 90%, rgba(90,70,180,0.22), transparent 60%),
    linear-gradient(160deg, #071428 0%, #0d2544 60%, #061328 100%);
  border-radius:16px;
  padding:24px 14px 30px;
  margin:0 -6px;
}
#page-disabled-toggle:checked+.slider{background:var(--err)!important}

@media(max-width:520px){
  .card{padding:28px 20px}
  .card.wide{padding:20px 16px}
  h1{font-size:1.2rem}
  .papyrus-body{padding:58px 24px 66px}
  .letter-content{font-size:1.05rem;line-height:1.85;text-align:left}
  .letter-content p{text-indent:1.2em}
  .papyrus-roll{height:36px;left:-4px;right:-4px}
  .papyrus-roll::before,.papyrus-roll-right{width:50px;top:-7px;bottom:-7px}
  .papyrus-roll::before{left:-17px}
  .papyrus-roll-right{right:-17px}
  .papyrus{padding:36px 0}
}
</style>
</head>
<body>

<!-- LOGIN / GATE -->
<div id="gate" class="screen">
  <div class="card">
    <div class="lock">&#128274;</div>
    <h1>${PAGE_TITLE}</h1>
    <p class="sub">Introduce el código de acceso</p>
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
    <p>Respeto tu decisión. Puedes volver cuando quieras leerla, estará aquí esperando.</p>
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
    <div class="progress-label-row">
      <span>Progreso</span>
      <span id="progress-percent">0%</span>
    </div>
    <div class="progress-outer"><div class="progress-inner" id="progress-inner"></div></div>

    <div class="papyrus">
      <div class="papyrus-roll top"><div class="papyrus-roll-right"></div></div>
      <div class="papyrus-body">
        <div id="continue-banner" class="continue-banner hidden">
          <span class="text">La última vez llegaste al <strong id="continue-percent">0%</strong>. ¿Quieres seguir desde ahí?</span>
          <button onclick="resumeReading()">Continuar</button>
        </div>
        <div id="letter-content" class="letter-content"></div>
      </div>
      <div class="papyrus-roll bottom"><div class="papyrus-roll-right"></div></div>
    </div>
  </div>
</div>

<!-- ADMIN -->
<div id="admin-screen" class="screen hidden">
  <div class="card wide fade-in">
    <span class="admin-badge">&#128737; Administrador</span>
    <div class="tabs">
      <button class="tab active" data-tab="view-letter">Ver carta</button>
      <button class="tab" data-tab="view-disclaimer">Ver disclaimer</button>
      <button class="tab" data-tab="edit-letter">Editar carta</button>
      <button class="tab" data-tab="edit-disclaimer">Editar disclaimer</button>
      <button class="tab" data-tab="logs">Logs</button>
      <button class="tab" data-tab="settings">Configuración</button>
    </div>

    <!-- Panel: view letter (admin sees the papyrus) -->
    <div id="panel-view-letter" class="panel">
      <p style="font-size:.85rem;color:var(--muted);margin-bottom:12px">Así verá el usuario la carta. Mostrando progreso: <strong id="admin-progress-label">0%</strong> (m&aacute;ximo: <strong id="admin-max-progress">0%</strong>)</p>
      <div class="papyrus-preview-bg">
        <div class="letter-wrap" style="padding:0">
          <div class="progress-outer"><div class="progress-inner" id="admin-progress-inner"></div></div>
          <div class="papyrus" style="max-width:100%">
            <div class="papyrus-roll top"><div class="papyrus-roll-right"></div></div>
            <div class="papyrus-body">
              <div id="admin-letter-content" class="letter-content"></div>
            </div>
            <div class="papyrus-roll bottom"><div class="papyrus-roll-right"></div></div>
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
      </div>
      <input type="file" id="img-letter-editor" accept="image/*" onchange="insertImage(this,'letter-editor')">
      <div id="letter-editor" class="richtext" contenteditable="true" style="min-height:420px;max-height:65vh"></div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="saveLetter()">Guardar carta</button>
        <span id="letter-save-status" class="status"></span>
      </div>
    </div>

    <!-- Panel: edit disclaimer -->
    <div id="panel-edit-disclaimer" class="panel hidden">
      <div class="toolbar">
        <button onclick="execCmd('bold','disc-editor')" title="Negrita"><b>B</b></button>
        <button onclick="execCmd('italic','disc-editor')" title="Cursiva"><i>I</i></button>
        <button onclick="execCmd('underline','disc-editor')" title="Subrayado"><u>U</u></button>
        <button onclick="addHeading('disc-editor')" title="Título">H</button>
        <button onclick="addLink('disc-editor')" title="Enlace">&#128279;</button>
        <button onclick="addImage('disc-editor')" title="Imagen">&#128247;</button>
      </div>
      <input type="file" id="img-disc-editor" accept="image/*" onchange="insertImage(this,'disc-editor')">
      <div id="disc-editor" class="richtext" contenteditable="true"></div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="saveDisclaimer()">Guardar disclaimer</button>
        <span id="disc-save-status" class="status"></span>
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

    <div class="footer">
      <button class="link-btn" onclick="logout()">Cerrar sesión</button>
    </div>
  </div>
</div>

<script>
var GITHUB_API = "${GITHUB_API_FILE}";
var ADMIN_HASH = "${ADMIN_HASH}";
var ENC_ADMIN_TOKEN = "${encAdminToken}";
var ACCEPT_KEY = "letter_accepted_v1";

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

function routeAfterLogin(){
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

// ── Disclaimer ──────────────────────────────────────────────────────
function showDisclaimer(){
  document.getElementById("disclaimer-content").innerHTML = data.disclaimer || "";
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
  show("farewell-screen");
}

// ── Letter rendering & progress ─────────────────────────────────────
var progressSaveTimer = null;
var maxPercentSession = 0;
var lastSavedPercent = 0;

function openLetter(){
  document.getElementById("letter-content").innerHTML = data.letter || "";
  var p = (data.progress && data.progress.lastPercent) || 0;
  var maxP = (data.progress && data.progress.maxPercent) || 0;
  maxPercentSession = maxP;
  lastSavedPercent = maxP;
  // Continue banner: show if previous session reached >3% and <97%
  var banner = document.getElementById("continue-banner");
  if(p > 3 && p < 97){
    document.getElementById("continue-percent").textContent = Math.round(p)+"%";
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }
  updateProgressUI(maxP);
  show("letter-screen");
  window.scrollTo(0,0);
  attachScrollTracking();
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

function onScrollTick(){
  if(document.getElementById("letter-screen").classList.contains("hidden")) return;
  var p = currentScrollPercent();
  // Update UI using max of current session max and current
  if(p > maxPercentSession) maxPercentSession = p;
  updateProgressUI(maxPercentSession);
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
  if(!data.progress) data.progress = {maxPercent:0,lastPercent:0,lastUpdated:""};
  data.progress.maxPercent = newMax;
  data.progress.lastPercent = p;
  data.progress.lastUpdated = new Date().toISOString();
  lastSavedPercent = newMax;
  var reached100 = newMax >= 98 && !data.progress.finishedLogged;
  var tasks = [saveData(data)];
  if(reached100){
    data.progress.finishedLogged = true;
    tasks.push(appendLog("finished","Carta terminada"));
  } else if(delta >= 10){
    tasks.push(appendLog("progress", Math.round(newMax)+"% leído"));
  }
  return Promise.all(tasks).catch(function(e){console.warn("progress save failed",e);});
}

function resumeReading(){
  var p = (data.progress && data.progress.lastPercent) || 0;
  var doc = document.documentElement;
  var target = (doc.scrollHeight - doc.clientHeight) * (p/100);
  window.scrollTo({top:target, behavior:"smooth"});
  document.getElementById("continue-banner").classList.add("hidden");
}

var scrollTracking = false;
function attachScrollTracking(){
  if(scrollTracking) return;
  scrollTracking = true;
  window.addEventListener("scroll", throttle(onScrollTick, 250));
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState==="hidden") persistProgress(true);
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
  document.getElementById("letter-editor").innerHTML = data.letter || "";
  document.getElementById("disc-editor").innerHTML = data.disclaimer || "";
  document.getElementById("admin-letter-content").innerHTML = data.letter || "";
  document.getElementById("admin-disclaimer-content").innerHTML = data.disclaimer || "";
  var p = (data.progress && data.progress.lastPercent) || 0;
  var maxP = (data.progress && data.progress.maxPercent) || 0;
  document.getElementById("admin-progress-inner").style.width = maxP.toFixed(1)+"%";
  document.getElementById("admin-progress-label").textContent = Math.round(p)+"%";
  document.getElementById("admin-max-progress").textContent = Math.round(maxP)+"%";
  document.getElementById("user-code-input").value = data.userCode || "";
  document.getElementById("page-disabled-toggle").checked = !!data.pageDisabled;
  renderLogs();
}

// ── Editor helpers ──────────────────────────────────────────────────
var activeEditor = "letter-editor";
function focusEditor(id){ activeEditor=id; document.getElementById(id).focus(); }
function execCmd(cmd,id){ focusEditor(id); document.execCommand(cmd,false,null); }
function addHeading(id){ focusEditor(id); document.execCommand("formatBlock",false,"h2"); }
function addParagraph(id){ focusEditor(id); document.execCommand("formatBlock",false,"p"); }
function addHR(id){ focusEditor(id); document.execCommand("insertHorizontalRule",false,null); }
function addLink(id){ var u = prompt("URL del enlace:"); if(u){ focusEditor(id); document.execCommand("createLink",false,u); } }
function addImage(id){ activeEditor=id; document.getElementById("img-"+id).click(); }
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

// ── Save actions ────────────────────────────────────────────────────
function statusOk(el){ el.className="status ok"; el.textContent="Guardado"; setTimeout(function(){el.textContent="";},2500); }
function statusErr(el,msg){ el.className="status err"; el.textContent=msg||"Error"; setTimeout(function(){el.textContent="";},3500); }
function statusLoading(el){ el.className="status"; el.innerHTML='<span class="spinner"></span>Guardando...'; }

function saveLetter(){
  var st = document.getElementById("letter-save-status"); statusLoading(st);
  data.letter = document.getElementById("letter-editor").innerHTML;
  saveData(data).then(function(r){
    if(r.content){
      statusOk(st);
      document.getElementById("admin-letter-content").innerHTML = data.letter;
    } else statusErr(st, r.message||"Error");
  }).catch(function(){ statusErr(st,"Sin conexión"); });
}
function saveDisclaimer(){
  var st = document.getElementById("disc-save-status"); statusLoading(st);
  data.disclaimer = document.getElementById("disc-editor").innerHTML;
  saveData(data).then(function(r){
    if(r.content){
      statusOk(st);
      document.getElementById("admin-disclaimer-content").innerHTML = data.disclaimer;
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
  saveData(data).then(function(r){
    if(r.content){
      document.getElementById("admin-progress-inner").style.width="0%";
      document.getElementById("admin-progress-label").textContent="0%";
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
    var p = (data.progress && data.progress.lastPercent) || 0;
    var api = document.getElementById("admin-progress-inner");
    if(api) api.style.width = maxP.toFixed(1)+"%";
    var al = document.getElementById("admin-progress-label"); if(al) al.textContent = Math.round(p)+"%";
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
  if(name==="view-letter") document.getElementById("admin-letter-content").innerHTML = data.letter||"";
  if(name==="view-disclaimer") document.getElementById("admin-disclaimer-content").innerHTML = data.disclaimer||"";
});

// ── Logout / navigation ─────────────────────────────────────────────
function logout(){
  persistProgress(true);
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
