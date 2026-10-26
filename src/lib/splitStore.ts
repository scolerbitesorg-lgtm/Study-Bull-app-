// Split data layout (Oct 26 2026): the site's content no longer loads as one multi-MB row.
//  - row id "index": nodes = the home tiles WITHOUT their content (title/icon/subtitle/order + _sb marker),
//    settings = app settings (no passcodes) + settings._split = { mainAt, v, tiles: { <tileId>: <version> } }
//  - row id "tile:<tileId>": nodes = [{ id, children[, passages] }] = that tile's whole content, settings = { _v }
//  - row id "main": the old single row, still written by the admin for compatibility (fallback only).
// Home renders from the small index; a tile's row is fetched only when it is opened (Quiz/Mock prefetched
// quietly after idle) and cached per tile in localStorage. The 15 s check reads only tiny version stamps.
import { getSupabaseCredentials, normalizeNode, isNodeActive, loadStudyBullApp } from './supabase';

type SplitMeta = { format?: number; mainAt?: string; v?: string; tiles?: Record<string, string> };
type IndexData = { nodes: any[]; settings: any; split: SplitMeta };
type TileEntry = { v: string; heavy: Record<string, any> };
type Listener = (nodes: any[], settings: any) => void;

const LS_INDEX = 'sb_split_index_v1';
const LS_TILE = 'sb_split_tile_v1:';
const LS_LEGACY = 'studybull_user_cache';
const LEGACY_SLACK_MS = 2000;

// Plain GET with the key in the query string: no custom headers = no CORS preflight (saves a round trip on 4G).
// The index URL must stay byte-identical to the <link rel="preload"> in index.html.
function restUrl(qs: string): string {
  const { url, anonKey } = getSupabaseCredentials();
  return `${url}/rest/v1/studybull_app_state?${qs}&apikey=${anonKey}`;
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
      if (t && t.heavy && typeof t.v === 'string') this.tiles.set(id, t);
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
        const key = `${t.v}|${JSON.stringify(light)}`;
        const m = this.memo.get(id);
        if (m && m.key === key) {
          out.push(m.node);
        } else {
          const node = normalizeNode({ ...light, ...t.heavy });
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
    const stampP = getRows('id=eq.main&select=updated_at', 15000);
    const rows = await getRows('id=eq.index&select=nodes,settings', 30000);
    const row = rows && rows[0];
    if (!validIndexRow(row)) {
      await this.switchToLegacy();
      return;
    }
    this.mode = 'split';
    this.applyIndexRow(row);
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

  // Quietly fetch Quiz + Mock Test (the most opened tiles) one after the other once the page is idle.
  private async prefetchBig() {
    try {
      const conn = (navigator as any).connection;
      if (conn && (conn.saveData || /(^|-)2g$/.test(String(conn.effectiveType || '')))) return;
    } catch {}
    if (this.mode !== 'split' || !this.index) return;
    const nodes = this.index.nodes || [];
    const pick = (re: RegExp) => nodes.find((n: any) => re.test(String(n?.title || '')));
    const targets = [pick(/quiz|क्विज़/i), pick(/mock|मॉक/i)].filter(Boolean).map((n: any) => String(n.id));
    for (const id of targets) {
      if (this.mode !== 'split') return;
      if (!this.tiles.has(id)) await this.ensureTile(id);
    }
  }

  // Load one tile's content. Resolves with the full (normalized) tile node, or null on failure.
  ensureTile(id: string, force = false): Promise<any | null> {
    const key = String(id);
    const find = () => this.buildNodes().find((n: any) => String(n.id) === key && !n._splitPending) || null;
    if (this.mode === 'legacy') return Promise.resolve(find());
    if (!force && this.tiles.has(key)) return Promise.resolve(find());
    let p = this.inflight.get(key);
    if (!p) {
      p = (async () => {
        const rows = await getRows(`id=eq.${encodeURIComponent('tile:' + key)}&select=nodes,settings`, 90000);
        const r = rows && rows[0];
        const n0 = r && Array.isArray(r.nodes) ? r.nodes[0] : null;
        if (!n0) return false;
        const { id: _ignored, ...heavy } = n0;
        const v = String(r.settings?._v || '');
        const entry = { v, heavy };
        this.tiles.set(key, entry);
        this.fresh.add(key);
        if (!lsSet(LS_TILE + key, entry)) {
          try {
            localStorage.removeItem(LS_TILE + key);
          } catch {}
        }
        if (this.mode === 'split') this.emit();
        return true;
      })().finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p.then((ok) => (ok ? find() : null));
  }

  async ensureAll(): Promise<void> {
    if (this.mode !== 'split' || !this.index) return;
    const ids = this.index.nodes.map((l: any) => String(l?.id)).filter((id: string) => !this.tiles.has(id));
    await Promise.all(ids.map((id: string) => this.ensureTile(id)));
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

  // Every 15 s while visible: ~200 bytes of version stamps; refetch only what changed.
  async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      const rows = await getRows('id=in.(index,main)&select=id,updated_at,sp:settings->_split', 10000);
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
      if (this.mode !== 'split' || !this.index || sp.v !== this.index.split?.v) {
        const ir = await getRows('id=eq.index&select=nodes,settings', 30000);
        const row = ir && ir[0];
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
