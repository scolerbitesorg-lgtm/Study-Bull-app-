// GET /api/tile?id=<tileId>&v=<version>  →  [{ nodes, settings }] of row "tile:<id>" (same shape as Supabase REST).
// The version is in the URL, so the answer for a matching version never changes: cached by the CDN for a year.
import { sbRows, send, fail, IMMUTABLE } from './_sb.js';

export default async function handler(req, res) {
  const q = req.query || {};
  const id = String(q.id || '').trim();
  const v = String(q.v || '').trim();
  if (!id || id.length > 120 || !/^[\w\-:.]+$/.test(id)) return send(res, 400, { error: 'bad id' }, 'no-store');
  try {
    const rows = await sbRows(`id=eq.${encodeURIComponent('tile:' + id)}&select=nodes,settings`, 50000);
    if (!rows.length) return send(res, 404, [], 'public, max-age=0, s-maxage=10');
    const have = String((rows[0].settings && rows[0].settings._v) || '');
    // Only a version-matched answer is cached for good; anything else (no v asked, or the row moved on
    // since the index was read) gets a short cache so nobody is ever pinned to old content.
    const cc = v && have === v ? IMMUTABLE : 'public, max-age=0, s-maxage=15, stale-while-revalidate=30';
    send(res, 200, rows, cc, { 'X-SB-Version': have });
  } catch (e) {
    fail(res, e);
  }
}
