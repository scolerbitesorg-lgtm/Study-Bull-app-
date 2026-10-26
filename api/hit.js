// POST /api/hit  — the 📊 Views counter (Aarav, Oct 26 2026: "daily kitne user ne web khola" in the admin panel).
// Privacy-safe: no IP, no device id, no cookie is stored anywhere — the browser only says
// "site opened" (+ whether it is this device's first open today / ever) or "home button <name> opened".
// The database function studybull_track_visit (files: studybull_views.sql) can ONLY add +1 to daily counters.
// Always answers 200 so a missing setup never shows a console error on the site.
import { SB_URL, SB_KEY, send } from './_sb.js';

const BOT = /bot|crawl|spider|slurp|lighthouse|headless|pagespeed|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|node-fetch|axios/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 200, { ok: false, why: 'post only' }, 'no-store');
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT.test(ua)) return send(res, 200, { ok: false, why: 'bot' }, 'no-store');
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { b = null; }
  } else if (b && typeof b === 'object' && Buffer.isBuffer(b)) {
    try { b = JSON.parse(b.toString('utf8')); } catch { b = null; }
  }
  if (!b || typeof b !== 'object') b = {};
  let page = '_site';
  if (b.p === 'tile') {
    const t = String(b.t || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 50);
    if (!t) return send(res, 200, { ok: false, why: 'no tile' }, 'no-store');
    page = 'tile:' + t;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/studybull_track_visit`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_page: page, p_visitor: !!b.v, p_new: !!b.n }),
      signal: controller.signal,
    });
    send(res, 200, { ok: r.ok, setup: r.status === 404 ? 'pending' : r.ok ? 'ok' : 'error' }, 'no-store');
  } catch {
    send(res, 200, { ok: false, setup: 'error' }, 'no-store');
  } finally {
    clearTimeout(timer);
  }
}
