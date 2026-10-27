// POST /api/hit  — the 📊 Views counter (Aarav, Oct 26 2026: "daily kitne user ne web khola" in the admin panel).
// Privacy-safe: no IP, no device id, no cookie is stored anywhere — the browser only says
// "site opened" (+ whether it is this device's first open today / ever) or "home button <name> opened".
// The database function studybull_track_visit (files: studybull_views.sql) can ONLY add +1 to daily counters.
// 👥 Users (Oct 27 2026, Aarav 11:59 AM): the body may also carry u = a random id this browser made for itself
// (localStorage, never shown to the user). Then studybull_track_user (files: studybull_users.sql) records the
// device as user01, user02… with first/last visit, mobile/PC, browser, approximate city (Vercel's IP-city
// header — the IP itself is never stored) and events: site open, button opened, quiz/mock/typing/speed-math
// results ({p:'ev', k, t, d}). Only the admin email login can read it.
// Always answers 200 so a missing setup never shows a console error on the site.
import { SB_URL, SB_KEY, send } from './_sb.js';

const BOT = /bot|crawl|spider|slurp|lighthouse|headless|pagespeed|preview|facebookexternalhit|whatsapp|telegram|curl|wget|python|node-fetch|axios/i;

function deviceOf(ua) {
  const tablet = /iPad|Tablet|SM-T\d|Tab\b/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/i.test(ua);
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua) ? 'Mac' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const browser = /Instagram/i.test(ua) ? 'Instagram' : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'Facebook' : /SamsungBrowser/i.test(ua) ? 'Samsung'
    : /OPR\/|Opera/i.test(ua) ? 'Opera' : /Edg\//i.test(ua) ? 'Edge' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /UCBrowser/i.test(ua) ? 'UC'
    : /CriOS|Chrome\//i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : '';
  return { device: tablet ? 'Tablet' : mobile ? 'Mobile' : 'PC', os, browser };
}

function hdr(req, name) {
  const v = String(req.headers[name] || '');
  try { return decodeURIComponent(v).slice(0, 60); } catch { return v.slice(0, 60); }
}

const KINDS = { site: 'visit', tile: 'tile' };
const EV = ['notes', 'quiz_start', 'mock_start', 'quiz', 'mock', 'typing', 'calc'];

async function rpc(name, args) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: controller.signal,
    });
    return r.status === 404 ? 'pending' : r.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

function trackUser(req, ua, b, title) {
  const u = String(b.u || '');
  if (!/^[a-z0-9]{12,40}$/.test(u)) return Promise.resolve('none');
  const kind = b.p === 'ev' ? String(b.k || '') : KINDS[b.p] || 'visit';
  if (kind !== 'visit' && kind !== 'tile' && !EV.includes(kind)) return Promise.resolve('none');
  const data = {};
  if (b.d && typeof b.d === 'object') {
    for (const k of ['c', 'w', 'n', 'a', 'marks', 'max', 'secs', 'wpm', 'acc']) {
      const x = Number(b.d[k]);
      if (b.d[k] !== undefined && b.d[k] !== null && Number.isFinite(x)) data[k] = Math.round(x * 100) / 100;
    }
  }
  const d = deviceOf(ua);
  return rpc('studybull_track_user', {
    p_dev: u, p_kind: kind, p_title: title || null, p_data: Object.keys(data).length ? data : null,
    p_device: d.device, p_os: d.os || null, p_browser: d.browser || null,
    p_city: hdr(req, 'x-vercel-ip-city') || null, p_region: hdr(req, 'x-vercel-ip-country-region') || null,
    p_country: hdr(req, 'x-vercel-ip-country') || null,
    p_first: /^\d{4}-\d{2}-\d{2}$/.test(String(b.f || '')) ? String(b.f) : null,
  });
}

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
  // no readable body = nothing to count (a real beacon always carries one; Oct 27: an empty test POST counted a site open)
  if (!b || typeof b !== 'object') return send(res, 200, { ok: false, why: 'no body' }, 'no-store');
  const clean = (x) => String(x || '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (b.p === 'ev') {
    const users = await trackUser(req, ua, b, clean(b.t).slice(0, 100));
    return send(res, 200, { ok: users === 'ok', users }, 'no-store');
  }
  let page = '_site';
  let title = '';
  if (b.p === 'tile') {
    title = clean(b.t).slice(0, 50);
    if (!title) return send(res, 200, { ok: false, why: 'no tile' }, 'no-store');
    page = 'tile:' + title;
  }
  const [views, users] = await Promise.all([
    rpc('studybull_track_visit', { p_page: page, p_visitor: !!b.v, p_new: !!b.n }),
    trackUser(req, ua, b, title),
  ]);
  send(res, 200, { ok: views === 'ok', setup: views, users }, 'no-store');
}
