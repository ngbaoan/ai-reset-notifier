/**
 * index.js — AI Reset Notifier
 * - Fetches accounts JSON
 * - Sends Telegram notifications for upcoming/just-reset accounts
 * - Generates docs/index.html for GitHub Pages
 *
 * No npm install needed — uses Node.js built-in fetch (v18+)
 * and fs/path from stdlib.
 */

const fs   = require('fs');
const path = require('path');

const JSON_URL  = process.env.JSON_URL;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID   = process.env.CHAT_ID;
const STATE_FILE = 'notified_state.json';
const DOCS_DIR   = 'docs';

if (!JSON_URL) { console.error('JSON_URL not set'); process.exit(1); }

// ── Vietnam timezone helper ──────────────────────────────────────
// UTC+7, no DST
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function nowVN() {
  return new Date(Date.now() + VN_OFFSET_MS);
}

function toVN(date) {
  return new Date(date.getTime() + VN_OFFSET_MS);
}

function fmtTime(dateUTC) {
  const d = toVN(new Date(dateUTC));
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

function fmtGenerated() {
  const d = nowVN();
  return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')} ${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}

// ── Telegram ─────────────────────────────────────────────────────
async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) { console.log('  [Telegram] skipped (no credentials)'); return; }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) console.error('  [Telegram] error:', await res.text());
  else console.log('  [Telegram] sent:', text.slice(0, 60) + '…');
}

// ── State (tracks which notifications were already sent) ─────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return {}; }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── AI badge config ──────────────────────────────────────────────
const AI_META = {
  Claude:  { logo: '◆', color: '#cc785c' },
  ChatGPT: { logo: '◎', color: '#10a37f' },
  Grok:    { logo: '✕', color: '#1d9bf0' },
  Gemini:  { logo: '✦', color: '#4285f4' },
  Other:   { logo: '⚙', color: '#888'    },
};

function aiEmoji(ai) {
  const m = { Claude:'◆', ChatGPT:'◎', Grok:'✕', Gemini:'✦', Other:'⚙' };
  return m[ai] || '⚙';
}

// ── HTML generator ───────────────────────────────────────────────
function generateHTML(accounts) {
  const now = nowVN();
  const nowMs = now.getTime() + Date.now() - (Date.now()); // = Date.now() + VN_OFFSET_MS... reuse
  const nowUTC = Date.now();

  // Sort: available first, then blocked by soonest reset
  const sorted = [...accounts].sort((a, b) => {
    const ra = a.resetAt ? new Date(a.resetAt).getTime() : 0;
    const rb = b.resetAt ? new Date(b.resetAt).getTime() : 0;
    const da = ra - nowUTC;
    const db = rb - nowUTC;
    // available (past) → top, blocked → below sorted by time
    if (da <= 0 && db <= 0) return da - db;
    if (da <= 0) return -1;
    if (db <= 0) return 1;
    return da - db;
  });

  const rows = sorted.map(acc => {
    const { ai = 'Other', email = '?', note = '', resetAt, type } = acc;
    const meta = AI_META[ai] || AI_META.Other;
    const emailDisp = email.length > 20 ? email.slice(0, 19) + '…' : email;
    const noteDisp  = (note || '').length > 30 ? note.slice(0, 29) + '…' : (note || '');

    let statusHtml, rowCls;

    if (!resetAt || type === 'note') {
      statusHtml = `<span class="badge avail">🟢</span>`;
      rowCls = 'row-avail';
    } else {
      const resetMs = new Date(resetAt).getTime();
      const diffSec = Math.floor((resetMs - nowUTC) / 1000);
      if (diffSec <= 0) {
        statusHtml = `<span class="badge avail">🟢</span>`;
        rowCls = 'row-avail';
      } else if (diffSec <= 30 * 60) {
        statusHtml = `<span class="badge waiting countdown" data-ts="${resetMs}">⏳--:--:--</span>`;
        rowCls = 'row-waiting';
      } else {
        statusHtml = `<span class="badge blocked" data-ts="${resetMs}">🔴 ${fmtTime(resetAt)}</span>`;
        rowCls = 'row-blocked';
      }
    }

    return `
    <tr class="${rowCls}">
      <td><span class="ai-badge" style="color:${meta.color}">${meta.logo} ${ai}</span></td>
      <td class="col-email">${emailDisp}</td>
      <td class="col-status">${statusHtml}</td>
      <td class="col-note">${noteDisp}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="refresh" content="300"/>
<title>🤖 AI Reset Monitor</title>
<style>
:root{--bg:#0f1117;--surface:#1a1d27;--surface2:#22263a;--border:#2e3348;--text:#e8eaf0;--muted:#7a7f99;--green:#4cef96;--red:#ff5c5c;--yellow:#ffbf47;--font:'Segoe UI',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;min-height:100vh;padding:24px 16px}
.header{text-align:center;margin-bottom:28px}
.header h1{font-size:26px;font-weight:700;margin-bottom:6px}
.header .sub{font-size:12px;color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;max-width:680px;margin:0 auto;overflow:hidden}
table{width:100%;border-collapse:collapse}
thead th{background:var(--surface2);color:var(--muted);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding:10px 14px;text-align:left;border-bottom:1px solid var(--border)}
tbody tr{border-bottom:1px solid var(--border);transition:background .12s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:var(--surface2)}
td{padding:9px 14px;vertical-align:middle}
.ai-badge{font-weight:700;font-size:13px}
.col-email{font-size:13px}
.col-status{text-align:center}
.col-note{color:var(--muted);font-size:12px;font-style:italic}
.badge{display:inline-block;font-size:13px;padding:3px 10px;border-radius:99px;font-weight:600;white-space:nowrap}
.badge.avail{background:rgba(76,239,150,.15);color:var(--green)}
.badge.waiting{background:rgba(255,191,71,.15);color:var(--yellow);font-family:monospace}
.badge.blocked{background:rgba(255,92,92,.12);color:var(--red)}
.row-waiting{background:rgba(255,191,71,.04)}
.row-blocked{background:rgba(255,92,92,.04)}
.footer{text-align:center;margin-top:16px;font-size:11px;color:var(--muted)}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-right:5px;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
</style>
</head>
<body>
<div class="header">
  <h1>🤖 AI Reset Monitor</h1>
  <div class="sub"><span class="dot"></span>Cập nhật mỗi 5 phút · Giờ Việt Nam (UTC+7)</div>
</div>
<div class="card">
  <table>
    <thead>
      <tr><th>AI</th><th>Account</th><th style="text-align:center">Status</th><th>Note</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<div class="footer">
  Lần cuối cập nhật: ${fmtGenerated()} (ICT) &nbsp;·&nbsp;
  🟢 Available &nbsp;·&nbsp; ⏳ Chờ reset &nbsp;·&nbsp; 🔴 Bị khoá
</div>
<script>
function tick(){
  document.querySelectorAll('.countdown').forEach(el=>{
    const diff=Math.floor((+el.dataset.ts-Date.now())/1000);
    if(diff<=0){el.textContent='🟢';el.className='badge avail';el.closest('tr').className='row-avail';}
    else{const h=String(Math.floor(diff/3600)).padStart(2,'0'),m=String(Math.floor(diff%3600/60)).padStart(2,'0'),s=String(diff%60).padStart(2,'0');el.textContent=\`⏳\${h}:\${m}:\${s}\`;}
  });
}
tick();setInterval(tick,1000);
</script>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching', JSON_URL);
  const res = await fetch(JSON_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const accounts = data.accounts || [];
  console.log(`  ${accounts.length} accounts`);

  const state   = loadState();
  const nowUTC  = Date.now();
  let changed   = false;

  for (const acc of accounts) {
    const { id, ai = 'Other', email = '?', note = '', resetAt, type } = acc;
    if (!resetAt || type === 'note') continue;

    const resetMs = new Date(resetAt).getTime();
    const diffMin = (resetMs - nowUTC) / 60000;
    const logo    = aiEmoji(ai);

    const keySoon  = `${id}_soon`;
    const keyAvail = `${id}_avail`;
    const keyReset = `${id}_reset`;

    // If resetAt changed → clear old flags
    if (state[keyReset] !== resetAt) {
      state[keySoon]  = false;
      state[keyAvail] = false;
      state[keyReset] = resetAt;
      changed = true;
    }

    // T-5 to T+0 → "sắp reset"
    if (diffMin <= 5 && diffMin > -1 && !state[keySoon]) {
      await sendTelegram(
        `${logo} <b>${ai}</b> — Sắp reset! ⏳\n` +
        `👤 <b>${email}</b>\n` +
        `⏰ Reset lúc: <b>${fmtTime(resetAt)}</b>\n` +
        `⏳ Còn ~<b>${Math.max(0, Math.ceil(diffMin))} phút</b>\n` +
        (note ? `📝 ${note}` : '')
      );
      state[keySoon] = true;
      changed = true;
    }

    // T+0 to T+10 → "đã available"
    if (diffMin <= 0 && diffMin > -10 && !state[keyAvail]) {
      await sendTelegram(
        `${logo} <b>${ai}</b> — Đã available! ✅\n` +
        `👤 <b>${email}</b>\n` +
        `🎉 Token reset lúc <b>${fmtTime(resetAt)}</b>\n` +
        (note ? `📝 ${note}` : '')
      );
      state[keyAvail] = true;
      changed = true;
    }
  }

  if (changed) saveState(state);

  // Generate GitHub Pages
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const html = generateHTML(accounts);
  fs.writeFileSync(path.join(DOCS_DIR, 'index.html'), html, 'utf8');
  console.log(`Generated ${DOCS_DIR}/index.html`);
  console.log('Done ✓');
}

main().catch(err => { console.error(err); process.exit(1); });
