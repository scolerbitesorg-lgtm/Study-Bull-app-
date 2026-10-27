// Shared helper for the CDN data routes (Oct 26 2026, Aarav: Supabase free-plan EGRESS quota exceeded).
// The site's data rows are read from Supabase ONCE per version by these functions; Vercel's CDN keeps the
// answer (Cache-Control s-maxage) and serves every other visitor without touching Supabase.
// Files starting with "_" are not routes on Vercel.
export const SB_URL = (process.env.SUPABASE_URL || 'https://epsplspwdjjjjezxscer.supabase.co').replace(/\/+$/, '');
// Public anon (publishable) key — the same one the browser app already ships with.
export const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_X8IsGDLwK9fUliHih60dlg_vqyOiePl';

export async function sbRows(qs, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SB_URL}/rest/v1/studybull_app_state?${qs}`, {
      headers: { apikey: SB_KEY, Accept: 'application/json', 'Accept-Encoding': 'gzip, br' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`supabase ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('supabase: not an array');
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

export function send(res, status, body, cacheControl, extra = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('Access-Control-Allow-Origin', '*');
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, String(v));
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

export function fail(res, err) {
  send(res, 502, { error: String((err && err.message) || err) }, 'no-store');
}

export const SHORT = 'public, max-age=0, s-maxage=20, stale-while-revalidate=60';
// Instant updates (Oct 27 2026, Aarav: admin changes must show in the app within seconds, no refresh):
// the version stamps (~500 bytes) are shared by every visitor through the CDN for only 4 s, so a new admin
// save is visible to the next poll after at most ~4 s. Worst case ≈ 1 Supabase read of 500 B per 4 s per region.
export const LIVE = 'public, max-age=0, must-revalidate, s-maxage=4';
// First load of the index row (no version in the URL): short CDN life, the app's first poll corrects it.
export const INDEX_SHORT = 'public, max-age=0, s-maxage=5, stale-while-revalidate=10';
export const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';
