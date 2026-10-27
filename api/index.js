// GET /api/index[?v=<index version>]  →  [{ id:"index", nodes, settings }, { id:"main", updated_at }]
// The small home/index row (no passcodes in it) + the old row's timestamp (no content).
// With v matching the row's version: the answer never changes → cached by the CDN for good.
// Without v (first load of every visitor; the <link rel=preload> in index.html): CDN-cached 5 s (+10 s
// stale-while-revalidate; was 20+60 before the Oct 27 instant-update change). Each revalidation reads only the ~600-byte version stamps from Supabase and takes
// the row itself from this route's own versioned (immutable, CDN-cached) URL — so Supabase sends the ~35 KB
// index row about once per admin save, not once every 20 s.
import { sbRows, send, fail, INDEX_SHORT as SHORT, IMMUTABLE } from './_sb.js';

async function readDirect() {
  const [idx, main] = await Promise.all([
    sbRows('id=eq.index&select=id,nodes,settings'),
    sbRows('id=eq.main&select=id,updated_at').catch(() => []),
  ]);
  return { idx, main };
}

const verOf = (row) => String((row && row.settings && row.settings._split && row.settings._split.v) || '');

async function viaVersionedUrl(req, v) {
  const host = req.headers && (req.headers['x-forwarded-host'] || req.headers.host);
  if (!host || !v) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(`https://${host}/api/index?v=${encodeURIComponent(v)}`, { signal: controller.signal });
    if (!r.ok) return null;
    const rows = await r.json();
    const idx = Array.isArray(rows) ? rows.find((x) => x && x.id === 'index') : null;
    return idx && verOf(idx) === v ? idx : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  const v = String((req.query && req.query.v) || '').trim();
  try {
    if (!v) {
      const stamps = await sbRows('id=in.(index,main)&select=id,updated_at,sp:settings->_split', 15000);
      const sp = (stamps.find((r) => r.id === 'index') || {}).sp;
      const main = stamps.filter((r) => r.id === 'main').map((r) => ({ id: 'main', updated_at: r.updated_at }));
      const cur = sp && sp.v ? String(sp.v) : '';
      const idx = cur ? await viaVersionedUrl(req, cur) : null;
      if (idx) return send(res, 200, [idx, ...main], SHORT, { 'X-SB-Version': cur, 'X-SB-Via': 'versioned-cdn' });
    }
    const { idx, main } = await readDirect();
    if (!idx.length) return send(res, 404, [], 'public, max-age=0, s-maxage=10');
    const have = verOf(idx[0]);
    const cc = v ? (have === v ? IMMUTABLE : 'public, max-age=0, s-maxage=15') : SHORT;
    send(res, 200, [idx[0], ...main], cc, { 'X-SB-Version': have, 'X-SB-Via': 'supabase' });
  } catch (e) {
    fail(res, e);
  }
}
