// 🔥 पढ़ाई स्ट्रीक + रोज़ का लक्ष्य (Study streak & daily goal) — added by Tab for Aarav, 30 Oct 2026.
// Everything stays on this device (localStorage). Nothing is sent anywhere.
// A day counts when at least one test is finished: quiz, mock test, typing test or speed-math round.

export type StreakKind = 'q' | 'm' | 't' | 'c';
export type StreakDay = { q?: number; m?: number; t?: number; c?: number; a?: number; r?: number };
type Store = { v: 1; goal: number; days: Record<string, StreakDay> };

const KEY = 'sb_streak_v1';
export const GOAL_CHOICES = [1, 2, 3, 5, 10];
export const STREAK_EVENT = 'sb-streak';

const pad = (n: number) => (n < 10 ? '0' : '') + n;
export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === 'object' && s.days && typeof s.days === 'object') {
        const goal = GOAL_CHOICES.includes(Number(s.goal)) ? Number(s.goal) : 3;
        return { v: 1, goal, days: s.days };
      }
    }
  } catch { /* ignore */ }
  return { v: 1, goal: 3, days: {} };
}

function save(s: Store) {
  try {
    // keep about one year of days
    const keys = Object.keys(s.days).sort();
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((k) => delete s.days[k]);
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* storage full / private mode: ignore */ }
  try { window.dispatchEvent(new Event(STREAK_EVENT)); } catch { /* ignore */ }
}

export const testsOf = (d?: StreakDay) => (d ? (d.q || 0) + (d.m || 0) + (d.t || 0) + (d.c || 0) : 0);

/** a finished test: kind + questions attempted / correct (0 for typing) */
export function recordTest(kind: StreakKind, attempted = 0, correct = 0) {
  const s = load();
  const k = dayKey();
  const d = { ...(s.days[k] || {}) };
  d[kind] = (d[kind] || 0) + 1;
  if (attempted > 0) {
    d.a = (d.a || 0) + attempted;
    d.r = (d.r || 0) + Math.max(0, Math.min(correct, attempted));
  }
  s.days[k] = d;
  save(s);
}

export function setGoal(goal: number) {
  if (!GOAL_CHOICES.includes(goal)) return;
  const s = load();
  s.goal = goal;
  save(s);
}

export type StreakStats = {
  goal: number;
  today: StreakDay;
  todayTests: number;
  streak: number; // consecutive days up to today (or up to yesterday if today not done yet)
  doneToday: boolean;
  atRisk: boolean; // streak alive from yesterday but nothing done today yet
  best: number;
  activeDays: number;
  totalTests: number;
  totalAttempted: number;
  totalCorrect: number;
  days: Record<string, StreakDay>;
};

export function getStats(): StreakStats {
  const s = load();
  const now = new Date();
  const today = s.days[dayKey(now)] || {};
  const doneToday = testsOf(today) > 0;
  let streak = 0;
  let cur = doneToday ? now : addDays(now, -1);
  while (testsOf(s.days[dayKey(cur)]) > 0) {
    streak++;
    cur = addDays(cur, -1);
  }
  const active = Object.keys(s.days).filter((k) => testsOf(s.days[k]) > 0).sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const k of active) {
    if (prev) {
      const [y, m, d] = prev.split('-').map(Number);
      run = dayKey(addDays(new Date(y, m - 1, d), 1)) === k ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = k;
  }
  let totalTests = 0, totalAttempted = 0, totalCorrect = 0;
  for (const k of active) {
    totalTests += testsOf(s.days[k]);
    totalAttempted += s.days[k].a || 0;
    totalCorrect += s.days[k].r || 0;
  }
  return {
    goal: s.goal,
    today,
    todayTests: testsOf(today),
    streak,
    doneToday,
    atRisk: !doneToday && streak > 0,
    best: Math.max(best, streak),
    activeDays: active.length,
    totalTests,
    totalAttempted,
    totalCorrect,
    days: s.days,
  };
}
