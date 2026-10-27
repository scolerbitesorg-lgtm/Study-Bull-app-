// 📊 Views counter (Oct 26 2026). Counts only — no IP, no id, nothing personal leaves the device.
// One tiny POST to /api/hit when the site opens, and when a home button is opened.
const KEY = 'studybull_views_v1';

function istDay(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

// d = day of the per-button (tile) memory, s = last day the SITE open was counted, f = first-ever day.
// (s was added Oct 27 2026: a home button tapped in the first 2.5 s set d before the site open ran,
//  so that open went out as "not a new visitor today" — new devices were counted as new but not as visitors.)
function readState(): { d?: string; s?: string; f?: string; t?: Record<string, number> } {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

function writeState(s: object) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: still counted, just not de-duplicated */
  }
}

// 👥 Users (Oct 27 2026): a random id this browser makes for itself — never shown to the user, no name/phone/IP.
// The database turns it into user01, user02… for the admin's Users table.
const UID_KEY = 'sb_uid_v1';
const OK_ID = /^[a-z0-9]{12,40}$/;
function uid(): string {
  try {
    let u = localStorage.getItem(UID_KEY) || '';
    if (!OK_ID.test(u)) {
      // also kept in a first-party cookie, so the same id survives if only one of the two is cleared
      const m = /(?:^|;\s*)sb_uid=([a-z0-9]+)/.exec(document.cookie || '');
      u = m && OK_ID.test(m[1]) ? m[1] : '';
    }
    if (!OK_ID.test(u)) {
      const a = new Uint8Array(12);
      (window.crypto || (window as any).msCrypto).getRandomValues(a);
      u = Array.from(a, (x) => (x % 36).toString(36)).join('') + Date.now().toString(36);
    }
    localStorage.setItem(UID_KEY, u);
    document.cookie = `sb_uid=${u}; max-age=63072000; path=/; SameSite=Lax; Secure`;
    return u;
  } catch {
    return '';
  }
}

// Aarav's own / test devices: open the site once with ?notrack (or ?notrack=0 to undo) → this device is never counted.
function noTrack(): boolean {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('notrack')) {
      if (q.get('notrack') === '0') localStorage.removeItem('sb_notrack');
      else localStorage.setItem('sb_notrack', '1');
    }
    return localStorage.getItem('sb_notrack') === '1';
  } catch {
    return false;
  }
}

// first-visit date this device had in its 📊 Views memory BEFORE this page load (read at import, before trackOpen
// writes it) → a visitor from before 👥 Users keeps their real first visit ("पुराना visitor"); undefined = brand-new device
const OLD_F: string | undefined = (() => {
  try {
    const f = JSON.parse(localStorage.getItem(KEY) || '{}').f;
    return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : undefined;
  } catch {
    return undefined;
  }
})();

function post(body: object) {
  try {
    if (typeof navigator === 'undefined' || (navigator as any).webdriver || noTrack()) return;
    const u = uid();
    const s = JSON.stringify(u ? (OLD_F ? { ...body, u, f: OLD_F } : { ...body, u }) : body);
    if (navigator.sendBeacon && navigator.sendBeacon('/api/hit', s)) return;
    fetch('/api/hit', { method: 'POST', body: s, keepalive: true }).catch(() => {});
  } catch {
    /* never break the site */
  }
}

let openSent = false;
export function trackOpen() {
  if (openSent) return;
  openSent = true;
  const st = readState();
  const d = istDay();
  const first = !st.f;
  const siteDay = st.s ?? (st.f ? st.d : undefined); // older copies had no s; d was the site day then
  const newToday = siteDay !== d;
  st.s = d;
  if (st.d !== d) {
    st.d = d;
    st.t = {};
  }
  if (!st.f) st.f = d;
  writeState(st);
  post({ p: 'site', v: newToday ? 1 : 0, n: first ? 1 : 0 });
}

const lastTile: Record<string, number> = {};
export function trackTile(title: unknown) {
  const t = String(title || '').trim().slice(0, 50);
  if (!t) return;
  const now = Date.now();
  if (lastTile[t] && now - lastTile[t] < 30000) return; // same button again within 30 s = one open
  lastTile[t] = now;
  const st = readState();
  const d = istDay();
  if (st.d !== d) {
    st.d = d;
    st.t = {};
  }
  const tiles = (st.t ||= {});
  const firstToday = !tiles[t];
  tiles[t] = 1;
  writeState(st);
  post({ p: 'tile', t, v: firstToday ? 1 : 0 });
}

// A finished quiz / mock / typing test / speed-math round (for the admin's 👥 Users history).
// d: c = correct, w = wrong, n = questions, a = attempted, marks/max, secs = time taken, wpm, acc = accuracy %.
export function trackResult(kind: 'notes' | 'quiz_start' | 'mock_start' | 'quiz' | 'mock' | 'typing' | 'calc', title: unknown, d: Record<string, number> = {}) {
  const t = String(title || '').trim().slice(0, 100);
  post({ p: 'ev', k: kind, t, d });
}
