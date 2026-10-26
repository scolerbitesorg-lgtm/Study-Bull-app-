// GET /api/meta  →  [{ id, updated_at, sp }] — tiny version stamps the app checks every 15 s.
// CDN-cached 20 s (+60 s stale-while-revalidate): many visitors polling = a few Supabase reads a minute.
import { sbRows, send, fail, SHORT } from './_sb.js';

export default async function handler(req, res) {
  try {
    const rows = await sbRows('id=in.(index,main)&select=id,updated_at,sp:settings->_split', 15000);
    send(res, 200, rows, SHORT);
  } catch (e) {
    fail(res, e);
  }
}
