// 📕 गलती बुक (Mistake Book) — Oct 26 2026 daily feature.
// Every quiz/mock question the student gets WRONG is saved on THIS device (localStorage only —
// nothing is sent to Supabase; the DB is read-only for visitors). A question answered right in the
// गलती बुक practice leaves the list; 🔖 saved questions stay until un-saved. Kept tiny: it is in
// the main chunk because the quiz screen calls it; the screen itself is the lazy MistakeBook chunk.

export const MISTAKE_QUIZ_ID = '__mistake_book__';
const KEY = 'studybull_mistakes_v1';
const MAX = 400; // newest kept; ~1 KB each → well under localStorage limits

export type MistakeQ = {
  question: string;
  questionEn?: string;
  options: string[];
  optionsEn?: string[];
  correct: number;
  explanation?: string;
  explanationEn?: string;
  category?: string;
  pyq?: string;
};

export type MistakeEntry = {
  k: string;      // stable key from question + options + answer
  q: MistakeQ;
  src: string;    // quiz / mock title it came from
  t: number;      // last wrong / saved time (ms)
  n: number;      // times answered wrong
  pick?: number;  // last wrong option picked
  wrong: boolean; // still to be fixed
  bm: boolean;    // 🔖 saved for revision by the student
};

const listeners = new Set<() => void>();
export const onMistakesChange = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + s.length.toString(36);
}
export function mistakeKey(q: MistakeQ): string {
  return hash(String(q.question || '') + '|' + (q.options || []).join('|') + '|' + q.correct);
}

export function loadMistakes(): MistakeEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((e) => e && e.k && e.q && Array.isArray(e.q.options)) : [];
  } catch {
    return [];
  }
}
function save(list: MistakeEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage full/blocked */ }
  listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
}
function slim(q: any): MistakeQ {
  return {
    question: String(q.question || ''), questionEn: q.questionEn, options: (q.options || []).map(String),
    optionsEn: q.optionsEn, correct: Number(q.correct) || 0, explanation: q.explanation,
    explanationEn: q.explanationEn, category: q.category, pyq: q.pyq,
  };
}

export function mistakeCount(): number {
  return loadMistakes().filter((e) => e.wrong || e.bm).length;
}
export function isBookmarked(q: any): boolean {
  if (!q) return false;
  const k = mistakeKey(q);
  return loadMistakes().some((e) => e.k === k && e.bm);
}

/** A wrong answer: add (or bump to the top). */
export function addMistake(q: any, src: string, pick?: number | null) {
  if (!q || !Array.isArray(q.options)) return;
  const sq = slim(q);
  const k = mistakeKey(sq);
  const list = loadMistakes();
  const i = list.findIndex((e) => e.k === k);
  const prev = i >= 0 ? list.splice(i, 1)[0] : null;
  list.unshift({
    k, q: sq, src: prev && src === MISTAKE_QUIZ_ID ? prev.src : String(src || ''), t: Date.now(),
    n: (prev?.n || 0) + 1, pick: typeof pick === 'number' ? pick : prev?.pick, wrong: true, bm: !!prev?.bm,
  });
  save(list);
}

/** Answered right in गलती बुक practice → no longer a mistake (kept only if 🔖 saved). */
export function resolveMistake(q: any) {
  if (!q) return;
  const k = mistakeKey(slim(q));
  const list = loadMistakes();
  const i = list.findIndex((e) => e.k === k);
  if (i < 0) return;
  if (list[i].bm) list[i] = { ...list[i], wrong: false };
  else list.splice(i, 1);
  save(list);
}

/** 🔖 save / un-save a question for revision. Returns the new state. */
export function toggleBookmark(q: any, src: string): boolean {
  if (!q || !Array.isArray(q.options)) return false;
  const sq = slim(q);
  const k = mistakeKey(sq);
  const list = loadMistakes();
  const i = list.findIndex((e) => e.k === k);
  if (i >= 0) {
    const e = list[i];
    if (e.bm) {
      if (e.wrong) list[i] = { ...e, bm: false };
      else list.splice(i, 1);
      save(list);
      return false;
    }
    list[i] = { ...e, bm: true };
    save(list);
    return true;
  }
  list.unshift({ k, q: sq, src: String(src || ''), t: Date.now(), n: 0, wrong: false, bm: true });
  save(list);
  return true;
}

export function removeMistake(k: string) {
  save(loadMistakes().filter((e) => e.k !== k));
}
export function clearMistakes(which: 'all' | 'wrong' | 'bm') {
  if (which === 'all') { save([]); return; }
  const list = loadMistakes()
    .map((e) => (which === 'wrong' ? { ...e, wrong: false } : { ...e, bm: false }))
    .filter((e) => e.wrong || e.bm);
  save(list);
}

/** Wrong answers of a finished mock (unanswered ones are not mistakes). Same answers object → once. */
let lastMockAnswers: unknown = null;
export function recordMockMistakes(qs: any[], answers: (number | null)[], src: string) {
  if (!Array.isArray(qs) || !Array.isArray(answers) || answers === lastMockAnswers) return;
  lastMockAnswers = answers;
  qs.forEach((q, i) => {
    const a = answers[i];
    if (a !== null && a !== undefined && a !== q.correct) addMistake(q, src, a);
  });
}
