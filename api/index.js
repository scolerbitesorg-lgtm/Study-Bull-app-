// GET /api/index[?v=<index version>]  →  [{ id:"index", nodes, settings }, { id:"main", updated_at }]
// The small home/index row (no passcodes in it) + the old row's timestamp (no content).
// Without v: CDN-cached 20 s (+60 s stale-while-revalidate) → Supabase sees at most a few reads a minute
// however many people visit. With v matching the row's version: cached for good.
import { sbRows, send, fail, SHORT, IMMUTABLE } from './_sb.js';

export default async function handler(req, res) {
  const v = String((req.query && req.query.v) || '').trim();
  try {
    const [idx, main] = await Promise.all([
      sbRows('id=eq.index&select=id,nodes,settings'),
      sbRows('id=eq.main&select=id,updated_at').catch(() => []),
    ]);
    if (!idx.length) return send(res, 404, [], 'public, max-age=0, s-maxage=10');
    const have = String((idx[0].settings && idx[0].settings._split && idx[0].settings._split.v) || '');
    const cc = v && have === v ? IMMUTABLE : SHORT;
    send(res, 200, [idx[0], ...main], cc, { 'X-SB-Version': have });
  } catch (e) {
    fail(res, e);
  }
}
