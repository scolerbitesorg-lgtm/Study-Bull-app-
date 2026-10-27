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

function post(body: object) {
  try {
    if (typeof navigator === 'undefined' || (navigator as any).webdriver) return;
    const s = JSON.stringify(body);
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
