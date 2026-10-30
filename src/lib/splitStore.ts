// Split data layout (Oct 26 2026): the site's content no longer loads as one multi-MB row.
//  - row id "index": nodes = the home tiles WITHOUT their content (title/icon/subtitle/order + _sb marker),
//    settings = app settings (no passcodes) + settings._split = { mainAt, v, tiles: { <tileId>: <version> } }
//  - row id "tile:<tileId>": nodes = [{ id, children[, passages] }] = that tile's whole content, settings = { _v }
//    (Oct 29 2026: big tiles — Quiz/Notes/Mock — are stored as one row per top-level folder, "tile:<tileId>:<childId>",
//    + a manifest row "tile:<tileId>:_parts"; /api/tile reassembles them, so this file sees the same tile shape.)
//  - row id "main": the old single row, still written by the admin for compatibility (fallback only).
// CDN (Oct 26 2026, Supabase egress quota): every read goes through this site's own /api routes first
// (/api/index, /api/meta, /api/tile?id&v — see api/*.js), which Vercel's CDN caches, so Supabase is read
// about once per data version instead of once per visitor. Direct Supabase REST is only the fallback when
// a route errors (or in local dev, where /api does not exist).
// Home renders from the small index; a tile's row is fetched only when it is opened (Quiz/Mock prefetched
// quietly after idle) and cached per tile in localStorage. The 15 s check reads only tiny version stamps.
import { getSupabaseCredentials, normalizeNode, isNodeActive, loadStudyBullApp } from './supabase';

type SplitMeta = { format?: number; mainAt?: string; v?: string; tiles?: Record<string, string> };
type IndexData = { nodes: any[]; settings: any; split: SplitMeta };
// A tile is either FULL ({ v, heavy } = its whole content, small tiles + old caches) or PARTIAL (big tiles, Speed fix
// Oct 27 2026): { v, part: true, outline, loaded } — outline = the structure from /api/tile?part=outline (heavy fields
// left out, those nodes marked _stub with a hash _h), loaded = { nodeId: { h, f: heavy fields, pin } } = the quizzes /
// notes pages downloaded one by one (/api/tile?node=…) when tapped. A loaded node is used while its hash matches the
// outline's (or while the outline is the version it was loaded at = pin), so a new admin save only re-downloads
// what actually changed.
type Loaded = Record<string, { h: string; f: Record<string, any>; pin?: string }>;
type TileEntry = { v: string; heavy?: Record<string, any>; part?: boolean; outline?: any; loaded?: Loaded; rev?: number };

const HEAVY_KEYS = ['questions', 'mcqs', 'quiz', 'notesContent', 'htmlContent', 'html', 'code', 'rawHtml', 'content', 'text', 'notes', 'body', 'chapters', 'description', 'pdf'];
// tiles at least this big (index _sb.b, raw bytes) load as outline + nodes on demand; smaller ones load whole
const OUTLINE_MIN_BYTES = 150000;

function findById(list: any, id: string): any {
  if (!Array.isArray(list)) return null;
  for (const c of list) {
    if (!c || typeof c !== 'object') continue;
    if (String(c.id) === id) return c;
    const d = findById(c.children, id);
    if (d) return d;
  }
  return null;
}

function mergeLoaded(n: any, loaded: Loaded, v: string): any {
  if (!n || typeof n !== 'object') return n;
  let out = n;
  if (n._stub) {
    const L = loaded[String(n.id)];
    if (L && ((L.h && L.h === n._h) || (L.pin && L.pin === v))) {
      const { _stub, _k, _qn, _pq, _h, ...rest } = n;
      out = { ...rest, ...L.f };
    }
  }
  if (Array.isArray(n.children) && n.children.length) {
    out = { ...out, children: n.children.map((c: any) => mergeLoaded(c, loaded, v)) };
  }
  return out;
}

// keep only downloaded nodes that the new outline still has with the same content hash
function pruneLoaded(loaded: Loaded | undefined, outline: any): Loaded {
  const out: Loaded = {};
  if (!loaded) return out;
  const walk = (list: any) => {
    if (!Array.isArray(list)) return;
    for (const n of list) {
      if (!n || typeof n !== 'object') continue;
      const L = n._stub ? loaded[String(n.id)] : null;
      if (L && L.h && L.h === n._h) out[String(n.id)] = { h: L.h, f: L.f };
      walk(n.children);
    }
  };
  walk(outline?.children);
  return out;
}

function tileContent(t: TileEntry): Record<string, any> {
  if (!t.part) return t.heavy || {};
  return mergeLoaded(t.outline || {}, t.loaded || {}, t.v);
}
type Listener = (nodes: any[], settings: any) => void;

const LS_INDEX = 'sb_split_index_v1';
const LS_TILE = 'sb_split_tile_v1:';
const LS_LEGACY = 'studybull_user_cache';
const LEGACY_SLACK_MS = 2000;

// Direct Supabase (fallback only). Plain GET with the key in the query string: no custom headers = no CORS preflight.
function restUrl(qs: string): string {
  const { url, anonKey } = getSupabaseCredentials();
  return `${url}/rest/v1/studybull_app_state?${qs}&apikey=${anonKey}`;
}

// Same-origin CDN route (cached by Vercel). The /api/index URL must stay byte-identical to the
// <link rel="preload"> in index.html. Returns null on any error → caller falls back to direct Supabase.
// true once a route answered with something that is not JSON (local dev without /api): then the outline/node
// requests fall back to the whole tile; a plain network failure does NOT (no 2 MB download on a weak line).
let apiMissing = false;
async function apiRows(path: string, timeoutMs = 30000, noStore = false): Promise<any[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, noStore ? { signal: controller.signal, cache: 'no-store' } : { signal: controller.signal });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.indexOf('json') < 0) { apiMissing = true; return null; } // e.g. local dev: the SPA page instead of the route
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// CDN route first, direct Supabase only if the route failed.
async function rowsVia(path: string, qs: string, timeoutMs = 30000, noStore = false): Promise<any[] | null> {
  const viaCdn = await apiRows(path, timeoutMs, noStore);
  if (viaCdn) return viaCdn;
  return getRows(qs, timeoutMs);
}

async function getRows(qs: string, timeoutMs = 30000): Promise<any[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(restUrl(qs), { signal: controller.signal });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Direct Supabase read of one tile (only when the /api route failed). STORAGE SPLIT v2 (Oct 29 2026): a big tile may
// live as rows "tile:<id>:<childId>" (one per top-level folder) + manifest "tile:<id>:_parts" (settings.parts =
// [[childId, partVersion, bytes]…], settings._v = tile version); the classic row "tile:<id>" stays as a backup.
// The row whose _v equals the index version wins (manifest first), else the newer version — same rule as api/tile.js.
const vTime = (s: any) => {
  const t = Date.parse(String(s || '').split('~')[0]);
  return Number.isNaN(t) ? 0 : t;
};
const inList = (ids: string[]) => encodeURIComponent('in.(' + ids.map((x) => '"' + x.replace(/"/g, '') + '"').join(',') + ')');
async function directTile(key: string, want: string): Promise<any[] | null> {
  const st = await getRows(`id=${inList(['tile:' + key, 'tile:' + key + ':_parts'])}&select=id,settings`, 20000);
  const m = st && st.find((r: any) => r.id === 'tile:' + key + ':_parts');
  const o = st && st.find((r: any) => r.id === 'tile:' + key);
  const ms = m && m.settings && m.settings.fmt === 2 && Array.isArray(m.settings.parts) ? m.settings : null;
  const os = o ? o.settings || {} : null;
  const useParts = Boolean(ms && ((want && String(ms._v) === want) || !(os && want && String(os._v || '') === want) && (!os || vTime(ms._v) >= vTime(os._v))));
  if (!useParts) return getRows(`id=eq.${encodeURIComponent('tile:' + key)}&select=nodes,settings`, 90000);
  const ids = ms.parts.map((p: any) => 'tile:' + key + ':' + p[0]);
  const prs = await getRows(`id=${inList(ids)}&select=id,nodes,settings`, 90000);
  if (!prs) return null;
  const byId = new Map(prs.map((r: any) => [r.id, r]));
  const children: any[] = [];
  const subs = new Map<string, any>();
  for (let i = 0; i < ids.length; i++) {
    const r: any = byId.get(ids[i]);
    const n = r && Array.isArray(r.nodes) ? r.nodes[0] : null;
    if (!n) return null;
    if (ms.parts[i] && ms.parts[i][3] != null) subs.set(String(ms.parts[i][0]), n);
    else children.push(n);
  }
  // nested split (Oct 30 2026): entries [subId, v, bytes, parentId] are sub-folder rows; the parent row holds { id, _sbPart: 1 }
  for (let i = 0; subs.size && i < children.length; i++) {
    const c = children[i];
    if (!c || !Array.isArray(c.children) || !c.children.some((g: any) => g && g._sbPart)) continue;
    const kids: any[] = [];
    for (const g of c.children) {
      if (!g || !g._sbPart) { kids.push(g); continue; }
      const n = subs.get(String(g.id));
      if (!n) return null;
      kids.push(n);
    }
    children[i] = { ...c, children: kids };
  }
  return [{ nodes: [{ id: ms.tile != null ? ms.tile : key, ...(ms.top || {}), children }], settings: { _v: String(ms._v), tile: ms.tile } }];
}

function lsGet(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(key: string, value: any): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage full (in-app browsers often allow less) or blocked: drop that cached copy so an old version
    // is not shown next time, and keep running from memory.
    try {
      localStorage.removeItem(key);
    } catch {}
    return false;
  }
}

function isNewer(a?: string | null, b?: string | null, slack = LEGACY_SLACK_MS): boolean {
  if (!a) return false;
  const ta = Date.parse(a);
  const tb = b ? Date.parse(b) : 0;
  if (Number.isNaN(ta)) return false;
  return ta > (Number.isNaN(tb) ? 0 : tb) + slack;
}

// Versions look like "2026-10-27T06:20:24.584Z~hacnm" (save time + random tail).
function isOlderVersion(a: any, b: any): boolean {
  const ta = Date.parse(String(a || '').split('~')[0]);
  const tb = Date.parse(String(b || '').split('~')[0]);
  return !Number.isNaN(ta) && !Number.isNaN(tb) && ta < tb;
}

function validIndexRow(row: any): row is { nodes: any[]; settings: any } {
  return Boolean(row && Array.isArray(row.nodes) && row.nodes.length > 0 && row.settings && row.settings._split && row.settings._split.tiles);
}

class SplitStore {
  mode: 'none' | 'split' | 'legacy' = 'none';
  private index: IndexData | null = null;
  private tiles = new Map<string, TileEntry>();
  private fresh = new Set<string>();
  private inflight = new Map<string, Promise<boolean>>();
  private memo = new Map<string, { key: string; node: any }>();
  private legacyStamp: string | null = null;
  private legacyNodes: any[] = [];
  private legacySettings: any = {};
  private listener: Listener = () => {};
  private polling = false;
  private prefetchStarted = false;

  setListener(fn: Listener) {
    this.listener = fn;
  }

  // Instant first paint on a return visit: the cached index + whatever tiles were cached.
  initFromCache(): { nodes: any[]; settings: any } | null {
    const idx = lsGet(LS_INDEX);
    if (!idx || !Array.isArray(idx.nodes) || !idx.split) return null;
    this.index = idx;
    for (const l of idx.nodes) {
      const id = String(l?.id);
      const t = lsGet(LS_TILE + id);
      if (t && typeof t.v === 'string' && (t.part ? t.outline && Array.isArray(t.outline.children) : t.heavy)) this.tiles.set(id, t);
    }
    this.recomputeFresh();
    return { nodes: this.buildNodes(), settings: idx.settings || {} };
  }

  private recomputeFresh() {
    this.fresh.clear();
    const versions = this.index?.split?.tiles || {};
    this.tiles.forEach((t, id) => {
      if (versions[id] && t.v === versions[id]) this.fresh.add(id);
    });
  }

  buildNodes(): any[] {
    if (this.mode === 'legacy') return this.legacyNodes;
    if (!this.index) return [];
    const out: any[] = [];
    for (const l of this.index.nodes) {
      if (!l) continue;
      const { _sb, ...light } = l;
      if (!isNodeActive(light)) continue;
      const id = String(light.id);
      const t = this.tiles.get(id);
      if (t) {
        const key = `${t.v}|${t.rev || 0}|${JSON.stringify(light)}`;
        const m = this.memo.get(id);
        if (m && m.key === key) {
          out.push(m.node);
        } else {
          const node = normalizeNode({ ...light, ...tileContent(t) });
          this.memo.set(id, { key, node });
          out.push(node);
        }
      } else {
        out.push({ ...normalizeNode({ ...light, children: [] }), _splitPending: true, _childCount: _sb?.n ?? 0 });
      }
    }
    return out;
  }

  private emit() {
    if (this.mode === 'legacy') this.listener(this.legacyNodes, this.legacySettings);
    else if (this.index) this.listener(this.buildNodes(), this.index.settings || {});
  }

  private applyIndexRow(row: { nodes: any[]; settings: any }) {
    const { _split, ...settings } = row.settings || {};
    this.index = { nodes: row.nodes, settings, split: _split || {} };
    this.recomputeFresh();
    lsSet(LS_INDEX, this.index);
    try {
      localStorage.removeItem(LS_LEGACY); // the old whole-site copy (2+ M chars) is no longer needed
      localStorage.setItem('studybull_cached_settings', JSON.stringify(settings));
    } catch {}
  }

  async start(): Promise<void> {
    // One CDN call carries the index row AND the old row's timestamp (no content). Never the 'main' content.
    let stampP: Promise<any[] | null>;
    let row: any = null;
    const cdn = await apiRows('/api/index', 30000);
    if (cdn) {
      row = cdn.find((r: any) => r && r.id === 'index') || null;
      const m = cdn.find((r: any) => r && r.id === 'main');
      stampP = Promise.resolve(m ? [m] : []);
    } else {
      stampP = getRows('id=eq.main&select=updated_at', 15000);
      const rows = await getRows('id=eq.index&select=nodes,settings', 30000);
      row = rows && rows[0];
    }
    if (!validIndexRow(row)) {
      await this.switchToLegacy();
      return;
    }
    this.mode = 'split';
    // the CDN copy of /api/index can be a few seconds older than the copy this phone already cached → keep the newer
    if (!(this.index && isOlderVersion(row.settings._split.v, this.index.split?.v))) this.applyIndexRow(row);
    else this.recomputeFresh();
    this.emit();
    this.afterIndex();
    // Old admin wrote only the old row after the last split save? Then the old row is the truth.
    stampP.then((s) => {
      const mainAt = s && s[0] && s[0].updated_at;
      if (this.mode === 'split' && isNewer(mainAt, this.index?.split?.mainAt)) void this.switchToLegacy();
    });
  }

  private afterIndex() {
    // Refresh tiles that were cached but are outdated, and fetch tiny tiles (Typing, Speed Math) right away.
    const sizes: Record<string, number> = {};
    for (const l of this.index?.nodes || []) sizes[String(l?.id)] = Number(l?._sb?.b || 0);
    const ids = (this.index?.nodes || []).map((l: any) => String(l?.id));
    for (const id of ids) {
      if (this.tiles.has(id) && !this.fresh.has(id)) void this.ensureTile(id, true);
      else if (!this.tiles.has(id) && sizes[id] > 0 && sizes[id] < 30000) void this.ensureTile(id);
    }
    if (!this.prefetchStarted) {
      this.prefetchStarted = true;
      const run = () => void this.prefetchBig();
      const w = window as any;
      setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 4000 }) : run()), 2500);
    }
  }

  // Once the page is idle: the small outlines of the big tiles (Quiz, Mock Test, Notes… ~5 KB each), then the
  // small tiles that are still missing (Current Affairs), one after the other — so a tile tap needs no network.
  // (Before Oct 27 2026 this downloaded the WHOLE Quiz + Mock rows, ~0.9 MB, which also slowed the first tap.)
  private async prefetchBig() {
    if (this.mode !== 'split' || !this.index) return;
    const nodes = this.index.nodes || [];
    const ids = nodes.map((n: any) => String(n?.id)).filter((id: string) => id && id !== 'undefined');
    const big = ids.filter((id: string) => this.isBig(id));
    const small = ids.filter((id: string) => !this.isBig(id));
    let slow = false;
    try {
      const conn = (navigator as any).connection;
      slow = Boolean(conn && (conn.saveData || /(^|-)[23]g$/.test(String(conn.effectiveType || ''))));
    } catch {}
    for (const id of big.concat(slow ? [] : small)) {
      if (this.mode !== 'split') return;
      if (!this.tiles.has(id)) await this.ensureTile(id);
    }
  }

  private sizeOf(id: string): number {
    const l = (this.index?.nodes || []).find((n: any) => String(n?.id) === id);
    return Number(l?._sb?.b || 0);
  }

  private isBig(id: string): boolean {
    return this.sizeOf(id) >= OUTLINE_MIN_BYTES;
  }

  private store(key: string, entry: TileEntry) {
    this.tiles.set(key, entry);
    this.fresh.add(key);
    if (!lsSet(LS_TILE + key, entry)) {
      try {
        localStorage.removeItem(LS_TILE + key);
      } catch {}
    }
    if (this.mode === 'split') this.emit();
  }

  // Whole tile row (small tiles, and the old cross-tile views via ensureAll).
  private async fetchFull(key: string): Promise<boolean> {
    // Version in the URL → the CDN answer for it is immutable; a new admin save = a new URL.
    const want = String(this.index?.split?.tiles?.[key] || '');
    const rows = (await apiRows(`/api/tile?id=${encodeURIComponent(key)}&v=${encodeURIComponent(want)}`, 90000)) || (await directTile(key, want));
    const r = rows && rows[0];
    const n0 = r && Array.isArray(r.nodes) ? r.nodes[0] : null;
    if (!n0) return false;
    const { id: _ignored, ...heavy } = n0;
    const old = this.tiles.get(key);
    this.store(key, { v: String(r.settings?._v || ''), heavy, rev: (old?.rev || 0) + 1 });
    return true;
  }

  // Structure only (big tiles). Falls back to the whole row when the route is not there (local dev).
  private async fetchOutline(key: string): Promise<boolean> {
    const want = String(this.index?.split?.tiles?.[key] || '');
    const rows = await apiRows(`/api/tile?id=${encodeURIComponent(key)}&v=${encodeURIComponent(want)}&part=outline`, 30000);
    const r = rows && rows[0];
    const n0 = r && r.settings && r.settings._outline && Array.isArray(r.nodes) ? r.nodes[0] : null;
    if (!n0 || !Array.isArray(n0.children)) return apiMissing || (rows && !n0) ? this.fetchFull(key) : false;
    const { id: _ignored, ...outline } = n0;
    const old = this.tiles.get(key);
    this.store(key, {
      v: String(r.settings._v || ''),
      part: true,
      outline,
      loaded: old && old.part ? pruneLoaded(old.loaded, outline) : {},
      rev: (old?.rev || 0) + 1,
    });
    return true;
  }

  // Load one tile. Big tiles: just the outline (the screen can open at once); their quizzes/notes come with
  // ensureNode() when tapped. Resolves with the (normalized) tile node, or null on failure.
  ensureTile(id: string, force = false): Promise<any | null> {
    const key = String(id);
    const find = () => this.buildNodes().find((n: any) => String(n.id) === key && !n._splitPending) || null;
    if (this.mode === 'legacy') return Promise.resolve(find());
    if (!force && this.tiles.has(key)) return Promise.resolve(find());
    let p = this.inflight.get(key);
    if (!p) {
      p = (this.isBig(key) ? this.fetchOutline(key) : this.fetchFull(key)).catch(() => false).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p.then((ok) => (ok ? find() : null));
  }

  // Whole tile content (old cross-tile views: quiz/notes hubs, typing setup).
  ensureFull(id: string): Promise<boolean> {
    const key = String(id);
    const t = this.tiles.get(key);
    if (this.mode !== 'split' || (t && !t.part && this.fresh.has(key))) return Promise.resolve(true);
    const k = 'full:' + key;
    let p = this.inflight.get(k);
    if (!p) {
      p = this.fetchFull(key).catch(() => false).finally(() => this.inflight.delete(k));
      this.inflight.set(k, p);
    }
    return p;
  }

  async ensureAll(): Promise<void> {
    if (this.mode !== 'split' || !this.index) return;
    const ids = this.index.nodes.map((l: any) => String(l?.id)).filter((id: string) => {
      const t = this.tiles.get(id);
      return !t || t.part;
    });
    await Promise.all(ids.map((id: string) => this.ensureFull(id)));
  }

  // The tile (partial) whose outline holds this node as a not-yet-downloaded stub.
  private stubTileOf(nodeId: string): string | null {
    for (const [tid, t] of this.tiles) {
      if (!t.part) continue;
      const n = findById(t.outline?.children, nodeId);
      if (!n) continue;
      if (!n._stub) return null;
      const L = t.loaded?.[nodeId];
      if (L && ((L.h && L.h === n._h) || (L.pin && L.pin === t.v))) return null; // already here
      return tid;
    }
    return null;
  }

  // Download one quiz / notes page / mock (with anything under it) of a partial tile. Resolves true when it is
  // in the tree (or was never missing).
  ensureNode(nodeId: string): Promise<boolean> {
    const id = String(nodeId);
    const tid = this.stubTileOf(id);
    if (!tid) return Promise.resolve(true);
    const k = 'node:' + id;
    let p = this.inflight.get(k);
    if (!p) {
      p = (async () => {
        const t0 = this.tiles.get(tid);
        if (!t0) return false;
        const asked = t0.v;
        const rows = await apiRows(`/api/tile?id=${encodeURIComponent(tid)}&v=${encodeURIComponent(asked)}&node=${encodeURIComponent(id)}`, 45000);
        const r = rows && rows[0];
        const n = r && Array.isArray(r.nodes) ? r.nodes[0] : null;
        if (!n) {
          // route missing (local dev) → whole tile the old way; network failure → caller shows "tap again"
          return apiMissing ? this.fetchFull(tid) : false;
        }
        const cur = this.tiles.get(tid);
        if (!cur || !cur.part) return true;
        const hs: Record<string, string> = (r && r.hs) || {};
        const loaded: Loaded = { ...(cur.loaded || {}) };
        const walk = (x: any) => {
          if (!x || typeof x !== 'object') return;
          const f: Record<string, any> = {};
          let any = false;
          for (const key of HEAVY_KEYS) if (x[key] !== undefined) { f[key] = x[key]; any = true; }
          if (any && x.id != null) loaded[String(x.id)] = { h: hs[String(x.id)] || '', f, pin: cur.v };
          if (Array.isArray(x.children)) x.children.forEach(walk);
        };
        walk(n);
        this.store(tid, { ...cur, loaded, rev: (cur.rev || 0) + 1 });
        // the server already has a newer version than our outline → refresh the outline quietly
        const got = String(r.settings?._v || '');
        if (got && got !== asked) void this.ensureTile(tid, true);
        return true;
      })().catch(() => false).finally(() => this.inflight.delete(k));
      this.inflight.set(k, p);
    }
    return p;
  }

  // Is this node a not-yet-downloaded part of a big tile?
  isStub(node: any): boolean {
    return Boolean(node && node._stub && this.mode === 'split');
  }

  // The current (normalized) node with this id anywhere in the tree.
  findNode(id: string): any {
    return findById(this.buildNodes(), String(id));
  }

  private async switchToLegacy() {
    this.mode = 'legacy';
    const d = await loadStudyBullApp();
    if (Array.isArray(d.nodes) && (d.nodes.length > 0 || !d.error)) {
      this.legacyNodes = d.nodes;
      this.legacySettings = d.settings || {};
      this.legacyStamp = d.updatedAt || null;
      this.emit();
    }
  }

  // Instant updates (Oct 27 2026): every ~8 s while the site is in use, and at once on focus / tab visible /
  // back online: ~500 bytes of version stamps from /api/meta (CDN, 4 s); only what changed is fetched again,
  // in the background (old data stays on screen until the new copy has arrived — no spinner, no reload).
  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const rows = await rowsVia('/api/meta', 'id=in.(index,main)&select=id,updated_at,sp:settings->_split', 10000, true);
      if (!rows) return;
      const mainRow = rows.find((r: any) => r.id === 'main');
      const idxRow = rows.find((r: any) => r.id === 'index');
      const mainAt = mainRow?.updated_at || null;
      const sp: SplitMeta | null = idxRow?.sp || null;
      const legacyWins = !sp || !sp.tiles || isNewer(mainAt, sp.mainAt);
      if (legacyWins) {
        if (this.mode !== 'legacy' || (mainAt && mainAt !== this.legacyStamp)) await this.switchToLegacy();
        return;
      }
      // an edge that still holds an OLDER stamp (a few seconds after a save) must not roll the app back
      if (this.mode === 'split' && this.index && isOlderVersion(sp.v, this.index.split?.v)) return;
      if (this.mode !== 'split' || !this.index || sp.v !== this.index.split?.v) {
        const ir = await rowsVia(`/api/index?v=${encodeURIComponent(String(sp.v || ''))}`, 'id=eq.index&select=nodes,settings', 30000);
        const row = ir && (ir.find((r: any) => r && r.id === 'index') || ir[0]);
        if (!validIndexRow(row)) return;
        this.mode = 'split';
        this.applyIndexRow(row);
        const stale = Array.from(this.tiles.keys()).filter((id) => !this.fresh.has(id));
        this.emit();
        await Promise.all(stale.map((id) => this.ensureTile(id, true)));
        this.afterIndex();
      } else {
        // Index unchanged, but a cached tile may still be an OLD copy whose refetch failed earlier
        // (slow line / offline at boot): retry it on every check until it is confirmed fresh this session.
        // (mode 'split' means the index came from the network this session, so `fresh` is trustworthy;
        //  a tile fetched this session is always in `fresh`, so this never refetches in a loop)
        const retry = Array.from(this.tiles.keys()).filter((id) => !this.fresh.has(id) && !this.inflight.has(id));
        if (retry.length) await Promise.all(retry.map((id) => this.ensureTile(id, true)));
      }
    } finally {
      this.polling = false;
    }
  }
}

export const splitStore = new SplitStore();
