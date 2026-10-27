// GET /api/tile?id=<tileId>&v=<version>                →  [{ nodes, settings }] of row "tile:<id>" (whole tile, same shape as Supabase REST)
// GET /api/tile?id=<tileId>&v=<version>&part=outline   →  same shape, but only the tile's STRUCTURE: every folder/quiz/notes
//      node with its title/icon/subtitle/kind, and the heavy fields (questions, notesContent, htmlContent…) left out.
//      A node whose heavy fields were left out carries _stub:1, _k:[left-out keys], _qn (question count), _pq (PYQ-tagged
//      count) and _h (short hash of its heavy fields — the app keeps a downloaded node while its hash is unchanged).
//      (Quiz: 2.4 MB raw / ~500 KB br  →  outline ~40 KB raw / ~5 KB br)
// GET /api/tile?id=<tileId>&v=<version>&node=<node id>  →  [{ nodes:[that node with its whole subtree], settings:{_v}, hs:{id:_h} }]
// (Speed fix, Oct 27 2026: a fresh phone downloaded the whole 2.4 MB Quiz row on the first tap = 10–20 s on mobile data.
//  Read-side only: the admin keeps saving whole tile rows exactly as before; outline/node are derived here.)
// The version is in the URL, so the answer for a matching version never changes: cached by the CDN for a year.
// outline/node read the whole tile from this route's own versioned (immutable, CDN-cached) URL, so Supabase still
// sends each tile version about once, however many outline/node URLs are asked for.
import { createHash } from 'node:crypto';
import { sbRows, send, fail, IMMUTABLE } from './_sb.js';

const SHORT_TILE = 'public, max-age=0, s-maxage=15, stale-while-revalidate=30';
const ALWAYS = new Set(['questions', 'mcqs', 'quiz']);
const BIG = new Set(['notesContent', 'htmlContent', 'html', 'code', 'rawHtml', 'content', 'text', 'notes', 'body', 'chapters', 'description', 'pdf']);
const BAD_Q = ['document.', 'var ', 'STORE_KEY', 'moodmoji', 'BATCH=', 'elementById', 'onclick='];
const PYQ_RE = /\[\s*PYQ\s*[:：\-–]\s*([^\]]{2,80})\]/i;

// warm-instance memory: a few parsed tiles by id|version
const mem = new Map();
function remember(key, row) {
  mem.set(key, row);
  while (mem.size > 6) mem.delete(mem.keys().next().value);
}

const verOf = (row) => String((row && row.settings && row.settings._v) || '');

async function viaVersionedUrl(req, id, v) {
  const host = req.headers && (req.headers['x-forwarded-host'] || req.headers.host);
  if (!host || !v) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(`https://${host}/api/tile?id=${encodeURIComponent(id)}&v=${encodeURIComponent(v)}`, { signal: controller.signal });
    if (!r.ok) return null;
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return row && verOf(row) === v ? row : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function wholeRow(req, id, v) {
  const key = `${id}|${v}`;
  if (v && mem.has(key)) return mem.get(key);
  let row = await viaVersionedUrl(req, id, v);
  if (!row) {
    const rows = await sbRows(`id=eq.${encodeURIComponent('tile:' + id)}&select=nodes,settings`, 50000);
    row = rows[0] || null;
  }
  if (row && v && verOf(row) === v) remember(key, row);
  return row;
}

function qStats(qs) {
  let n = 0, p = 0;
  for (const q of qs) {
    const t = String((q && (q.question || q.qText || q.title)) || '');
    if (!t || BAD_Q.some((b) => t.includes(b))) continue;
    n++;
    if ((typeof q.pyq === 'string' && q.pyq.trim()) || [q.question, q.qText, q.questionEn, q.explanation].some((s) => PYQ_RE.test(String(s || '')))) p++;
  }
  return [n, p];
}

const HEAVY_ALL = [...ALWAYS, ...BIG];
// short hash of a node's heavy fields (same function for the outline and node answers)
function heavyHash(n) {
  const h = createHash('sha1');
  let any = false;
  for (const key of HEAVY_ALL) {
    if (n[key] === undefined) continue;
    any = true;
    h.update(key + '\u0000' + JSON.stringify(n[key]) + '\u0000');
  }
  return any ? h.digest('base64').slice(0, 10) : '';
}

// returns [outlineNode, hadStub]
function outlineNode(n) {
  if (!n || typeof n !== 'object') return [n, false];
  const o = {};
  const k = [];
  let qn = 0, pq = 0;
  for (const [key, val] of Object.entries(n)) {
    if (key === 'children') continue;
    if (ALWAYS.has(key) && Array.isArray(val)) {
      if (val.length) {
        k.push(key);
        const [a, b] = qStats(val);
        qn += a; pq += b;
      }
      continue;
    }
    if (BIG.has(key) && val != null && JSON.stringify(val).length > 200) { k.push(key); continue; }
    o[key] = val;
  }
  let stub = false;
  if (k.length) {
    stub = true;
    Object.assign(o, { _stub: 1, _k: k, _h: heavyHash(n) });
    if (qn) o._qn = qn;
    if (pq) o._pq = pq;
  }
  if (Array.isArray(n.children)) {
    o.children = n.children.map((c) => {
      const [oc, s] = outlineNode(c);
      if (s) stub = true;
      return oc;
    });
  }
  return [o, stub];
}

function outlineOf(top) {
  const out = {};
  for (const [key, val] of Object.entries(top || {})) if (key !== 'children') out[key] = val;
  out.children = (Array.isArray(top && top.children) ? top.children : []).map((c) => outlineNode(c)[0]);
  return out;
}

function findNode(list, id) {
  if (!Array.isArray(list)) return null;
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    if (String(c.id) === id) return c;
    const d = findNode(c.children, id);
    if (d) return d;
  }
  return null;
}

function hashesOf(n, out = {}) {
  if (!n || typeof n !== 'object') return out;
  const h = heavyHash(n);
  if (h && n.id != null) out[String(n.id)] = h;
  if (Array.isArray(n.children)) for (const c of n.children) hashesOf(c, out);
  return out;
}

export default async function handler(req, res) {
  const q = req.query || {};
  const id = String(q.id || '').trim();
  const v = String(q.v || '').trim();
  const part = String(q.part || '').trim();
  const node = String(q.node || '').trim();
  if (!id || id.length > 120 || !/^[\w\-:.]+$/.test(id)) return send(res, 400, { error: 'bad id' }, 'no-store');
  if (node && (node.length > 160 || !/^[\w\-:.]+$/.test(node))) return send(res, 400, { error: 'bad node' }, 'no-store');
  try {
    if (part === 'outline' || node) {
      const row = await wholeRow(req, id, v);
      if (!row) return send(res, 404, [], 'public, max-age=0, s-maxage=10');
      const have = verOf(row);
      const cc = v && have === v ? IMMUTABLE : SHORT_TILE;
      const top = Array.isArray(row.nodes) ? row.nodes[0] : null;
      if (!top) return send(res, 404, [], 'public, max-age=0, s-maxage=10');
      if (node) {
        const hit = findNode(top.children, node);
        if (!hit) return send(res, 404, [], SHORT_TILE, { 'X-SB-Version': have });
        return send(res, 200, [{ nodes: [hit], settings: { _v: have, _node: node }, hs: hashesOf(hit) }], cc, { 'X-SB-Version': have });
      }
      return send(res, 200, [{ nodes: [outlineOf(top)], settings: { _v: have, _outline: 1 } }], cc, { 'X-SB-Version': have });
    }
    const rows = await sbRows(`id=eq.${encodeURIComponent('tile:' + id)}&select=nodes,settings`, 50000);
    if (!rows.length) return send(res, 404, [], 'public, max-age=0, s-maxage=10');
    const have = verOf(rows[0]);
    // Only a version-matched answer is cached for good; anything else (no v asked, or the row moved on
    // since the index was read) gets a short cache so nobody is ever pinned to old content.
    const cc = v && have === v ? IMMUTABLE : SHORT_TILE;
    send(res, 200, rows, cc, { 'X-SB-Version': have });
  } catch (e) {
    fail(res, e);
  }
}
