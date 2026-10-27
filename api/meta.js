// GET /api/meta  →  [{ id, updated_at, sp }] — tiny version stamps (sp.v = index version, sp.tiles = per-tile
// versions) the app checks every ~8 s while in use and at once on focus / tab visible / back online.
// CDN-cached 4 s (LIVE): many visitors polling = at most one ~500 B Supabase read per 4 s per region.
import { sbRows, send, fail, LIVE } from './_sb.js';

export default async function handler(req, res) {
  try {
    const rows = await sbRows('id=in.(index,main)&select=id,updated_at,sp:settings->_split', 15000);
    send(res, 200, rows, LIVE);
  } catch (e) {
    fail(res, e);
  }
}
