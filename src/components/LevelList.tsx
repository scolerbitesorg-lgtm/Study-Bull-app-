import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * 3-level folder layout (Aarav, 26 Oct 2026, with his reference image):
 *   level 1 inside a home tile  → BUTTON  = cube cards, 2 per row        (subjects / exams / दैनिक-मासिक)
 *   level 2+                    → FOLDER  = big full-width cards          (parts: प्राचीन / मध्यकालीन / आधुनिक, mock tests)
 *   leaves (quiz, notes, page)  → SECTION = slim rows with a count pill   (topics → open the quiz / notes)
 * A level that mixes containers and leaves shows the containers first, then the leaves as slim rows.
 * Inside a Quiz/Notes subject a virtual "<विषय> PYQ" folder sits on top: all of that subject's MCQs,
 * shuffled (new order every day) and split into sets of 50. Built at runtime — nothing is stored.
 */

type Fn<T> = (n: any) => T;

export interface LevelListProps {
  items: any[];
  depth: number; // 0 = the home tile's own page
  langHindi: boolean;
  onOpen: (n: any) => void;
  titleOf: Fn<string>;
  iconOf: Fn<string>;
  subtitleOf: Fn<string>;
  isSection: Fn<boolean>;
  isFolder: Fn<boolean>;
}

const GENERIC_SUBS = ['स्टडी बुल इंटरएक्टिव फीचर', 'Study Bull Interactive Feature', 'पेज खोलें', 'Open Page'];

export const nodeKind = (n: any) => String(n?.kind || n?.type || '').toLowerCase();
export const hasKids = (n: any) => Array.isArray(n?.children) && n.children.length > 0;

/** number of questions under a node (memoised per object) */
const qCache = new WeakMap<object, number>();
export function countQuestions(n: any): number {
  if (!n || typeof n !== 'object') return 0;
  const c = qCache.get(n);
  if (c !== undefined) return c;
  let total = Array.isArray(n.questions) ? n.questions.length : 0;
  if (Array.isArray(n.children)) for (const k of n.children) total += countQuestions(k);
  qCache.set(n, total);
  return total;
}

function hasMock(n: any): boolean {
  if (!n) return false;
  if (nodeKind(n) === 'mock') return true;
  return Array.isArray(n.children) && n.children.some(hasMock);
}

const BAD_Q = ['document.', 'var ', 'STORE_KEY', 'moodmoji', 'BATCH=', 'elementById', 'onclick='];
function collectMcqs(n: any, out: any[]) {
  if (!n || nodeKind(n) === 'mock') return;
  if (Array.isArray(n.questions)) {
    for (const q of n.questions) {
      const t = String(q?.question || q?.qText || q?.title || '');
      if (t && Array.isArray(q?.options) && q.options.length >= 2 && !BAD_Q.some(b => t.includes(b))) out.push(q);
    }
  }
  if (Array.isArray(n.children)) for (const k of n.children) collectMcqs(k, out);
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Real past-year tag on a question. Either a field  "pyq": "SSC GD 2023"  on the question object, or
 * (what the admin's MCQ bulk paste can store) a "[PYQ: SSC GD 2023]" tag anywhere in the question text
 * (or its explanation). The tag is shown as a badge and removed from the visible text.
 */
const PYQ_RE = /\[\s*PYQ\s*[:：\-–]\s*([^\]]{2,80})\]/i;
export function pyqTagOf(q: any): string {
  if (!q) return '';
  if (typeof q.pyq === 'string' && q.pyq.trim()) return q.pyq.trim();
  for (const s of [q.question, q.qText, q.questionEn, q.explanation]) {
    const m = PYQ_RE.exec(String(s || ''));
    if (m) return m[1].trim();
  }
  return '';
}
export function stripPyq<T>(s: T): T {
  if (typeof s !== 'string') return s;
  return s.replace(PYQ_RE, '').replace(/^\s*[-–—:|]\s*/, '').replace(/\s{2,}/g, ' ').trim() as unknown as T;
}

const pyqCache = new Map<string, { src: any; node: any }>();
const SET_SIZE = 50;

/** short subject name: "इतिहास (History)" → "इतिहास" */
export function shortSubject(title: string): string {
  const t = String(title || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return t || String(title || '').trim();
}

/**
 * Virtual "<विषय> PYQ" folder for a subject. `source` is the node whose MCQs are mixed
 * (the subject itself in Quiz, or the matching Quiz subject when opened from Notes).
 */
export function buildPyqFolder(subject: any, source: any, langHindi: boolean): any | null {
  if (!subject || !source) return null;
  const day = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10); // IST day → new mix daily
  const key = `${subject.id}|${source.id}|${day}|${langHindi ? 1 : 0}`;
  const hit = pyqCache.get(key);
  if (hit && hit.src === source) return hit.node;
  const all: any[] = [];
  collectMcqs(source, all);
  if (all.length < 10) return null;
  // verified real PYQs (tagged) first, then the rest of the subject's MCQs mixed
  const tagged = all.filter(q => pyqTagOf(q));
  const plain = all.filter(q => !pyqTagOf(q));
  const mixed = [...seededShuffle(tagged, key + '|t'), ...seededShuffle(plain, key)];
  const nSets = Math.max(1, Math.round(mixed.length / SET_SIZE));
  const per = Math.ceil(mixed.length / nSets);
  const name = shortSubject(subject.title);
  const sets: any[] = [];
  for (let i = 0; i < nSets; i++) {
    const qs = mixed.slice(i * per, (i + 1) * per).map((q, j) => ({ ...q, id: j + 1 }));
    if (!qs.length) continue;
    const realHere = qs.filter(q => pyqTagOf(q)).length;
    sets.push({
      id: `pyq-set:${subject.id}:${i + 1}`,
      kind: 'mcq',
      icon: '🔀',
      title: langHindi ? `${name} मिक्स — सेट ${i + 1}` : `${name} Mix — Set ${i + 1}`,
      subtitle: realHere
        ? (langHindi ? `${qs.length} प्रश्न • ⭐ ${realHere} असली PYQ` : `${qs.length} Qs • ⭐ ${realHere} real PYQs`)
        : (langHindi ? `${qs.length} मिक्स प्रश्न • सभी टॉपिक से` : `${qs.length} mixed questions • all topics`),
      questions: qs,
      _virtual: true,
    });
  }
  const node = {
    id: `pyq:${subject.id}`,
    kind: 'button',
    icon: '📜',
    title: `${name} PYQ`,
    subtitle: tagged.length
      ? (langHindi
        ? `⭐ ${tagged.length} असली PYQ पहले, फिर पूरे ${name} के मिक्स MCQ • ${all.length} प्रश्न`
        : `⭐ ${tagged.length} real PYQs first, then all ${name} MCQs mixed • ${all.length} Qs`)
      : (langHindi
        ? `पूरे ${name} के मिक्स MCQ (PYQ स्टाइल) • ${all.length} प्रश्न • ${sets.length} सेट`
        : `All ${name} MCQs mixed (PYQ style) • ${all.length} Qs • ${sets.length} sets`),
    children: sets,
    _virtual: true,
    _pyq: true,
  };
  pyqCache.set(key, { src: source, node });
  return node;
}

/** a folder whose only (visible) child is a single quiz/mock → that quiz (tap opens it directly) */
export function soleQuizChild(n: any): any | null {
  if (!n || n._pyq || n._virtual || !Array.isArray(n.children)) return null;
  const kids = n.children.filter((k: any) => k && k.enabled !== false);
  if (kids.length !== 1) return null;
  const k = kids[0];
  if (hasKids(k) || !Array.isArray(k.questions) || k.questions.length === 0) return null;
  return k;
}

/**
 * A REAL PYQ folder/quiz added by the admin (e.g. "📜 इतिहास — महत्वपूर्ण PYQ" with Aarav's 73 tagged PYQs):
 * its title says PYQ, or most of its MCQs carry a [PYQ: …] tag. Not the virtual mix folder.
 */
const realPyqCache = new WeakMap<object, boolean>();
export function isRealPyqNode(n: any): boolean {
  if (!n || typeof n !== 'object' || n._pyq || n._virtual || n.enabled === false) return false;
  if (nodeKind(n) === 'mock') return false;
  const c = realPyqCache.get(n);
  if (c !== undefined) return c;
  let res = /\bPYQs?\b/i.test(`${n.title || ''} ${n.titleEn || ''}`);
  if (!res) {
    const qs: any[] = [];
    collectMcqs(n, qs);
    const tagged = qs.filter(q => pyqTagOf(q)).length;
    res = tagged >= 5 && tagged * 2 >= qs.length;
  }
  realPyqCache.set(n, res);
  return res;
}
/** a subject that already has a real PYQ child needs no virtual mix folder */
export function hasRealPyq(subject: any): boolean {
  return Array.isArray(subject?.children) && subject.children.some(isRealPyqNode);
}

/** should a subject page get a PYQ folder, and from which node */
export function pyqSourceFor(subject: any, tile: any, allTiles: any[]): any | null {
  if (!subject || !tile || subject._virtual) return null;
  if (hasRealPyq(subject)) return null;
  const tt = `${tile.title || ''} ${tile.titleEn || ''}`.toLowerCase();
  const isQuiz = /quiz|क्विज/.test(tt);
  const isNotes = /notes|नोट्स/.test(tt);
  if (!isQuiz && !isNotes) return null;
  if (hasMock(subject)) return null;
  if (isQuiz) return subject;
  // Notes subject → the Quiz subject with the same name (if the Quiz tile is downloaded)
  const quizTile = (allTiles || []).find(t => /quiz|क्विज/.test(`${t?.title || ''}`.toLowerCase()) && !t?._splitPending && Array.isArray(t?.children));
  if (!quizTile) return null;
  const want = shortSubject(subject.title).toLowerCase();
  const src = quizTile.children.find((c: any) => shortSubject(c?.title).toLowerCase() === want && hasKids(c)) || null;
  // the Quiz subject already has its real PYQs → no mix on the Notes side either
  return src && !hasRealPyq(src) ? src : null;
}

function cleanSub(s: string) {
  const t = String(s || '').trim();
  return GENERIC_SUBS.includes(t) ? '' : t;
}

function leafPill(n: any, langHindi: boolean): { top: string; bottom: string } {
  const k = nodeKind(n);
  const q = countQuestions(n);
  if (q > 0) return { top: String(q), bottom: langHindi ? 'प्रश्न' : 'Qs' };
  if (k === 'notes' || k === 'note' || k === 'pdf' || n?.notesContent) return { top: '📖', bottom: langHindi ? 'नोट्स' : 'Notes' };
  if (k === 'html' || n?.htmlContent) return { top: '📄', bottom: langHindi ? 'नोट्स' : 'Page' };
  return { top: '▶', bottom: langHindi ? 'खोलें' : 'Open' };
}

/** small badge for a tagged real PYQ question (quiz, mock and review screens) */
export function PyqBadge({ tag }: { tag?: string }) {
  if (!tag) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-1.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-extrabold">
      📜 PYQ • {tag}
    </span>
  );
}

export function LevelList(p: LevelListProps) {
  const { items, depth, langHindi, onOpen, titleOf, iconOf, subtitleOf, isSection, isFolder } = p;
  const containers: any[] = [];
  const leaves: any[] = [];
  const headings: any[] = [];
  for (const n of items) {
    if (!n || n.enabled === false) continue;
    if (isSection(n)) { headings.push(n); continue; }
    // a real PYQ quiz/folder inside a subject is always the first big highlighted card
    if (depth >= 1 && isRealPyqNode(n)) { containers.push(n); continue; }
    if (hasKids(n) || isFolder(n) || nodeKind(n) === 'mock') containers.push(n);
    else leaves.push(n);
  }
  if (depth >= 1) {
    const rank = (n: any) => (isRealPyqNode(n) ? 0 : n?._pyq ? 1 : 2);
    containers.sort((a, b) => rank(a) - rank(b)); // stable: the rest keep the admin's order
  }

  const cube = (n: any) => {
    const q = countQuestions(n);
    const kids = Array.isArray(n.children) ? n.children.length : 0;
    const sub = cleanSub(subtitleOf(n));
    return (
      <button
        key={n.id}
        onClick={() => onOpen(n)}
        className="sb-tap group relative flex flex-col items-start text-left bg-white rounded-[22px] p-4 min-h-[156px] border border-slate-100 shadow-[0_4px_18px_-6px_rgba(30,64,175,0.18)] hover:shadow-[0_8px_26px_-8px_rgba(30,64,175,0.30)] hover:border-blue-200 transition-all cursor-pointer overflow-hidden"
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100/80 border border-blue-100 flex items-center justify-center text-[28px] shadow-inner mb-3 group-hover:scale-105 transition-transform">
          {iconOf(n) || '📘'}
        </div>
        <h3 className="w-full font-extrabold text-slate-900 text-[15px] leading-snug line-clamp-2">{titleOf(n)}</h3>
        {sub && <p className="w-full text-[11.5px] text-slate-500 mt-1 leading-snug line-clamp-2">{sub}</p>}
        <div className="mt-auto pt-2.5 flex items-center gap-1.5 text-[10.5px] font-bold text-blue-700">
          <span className="px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100">
            {q > 0 ? `${q} ${langHindi ? 'प्रश्न' : 'Qs'}` : `${kids} ${langHindi ? 'आइटम' : 'items'}`}
          </span>
        </div>
      </button>
    );
  };

  const folder = (n: any) => {
    const isMix = Boolean(n._pyq);
    const isReal = !isMix && isRealPyqNode(n);
    const isPyq = isMix || isReal;
    const isMock = nodeKind(n) === 'mock';
    const q = countQuestions(n);
    const kids = Array.isArray(n.children) ? n.children.length : 0;
    const sub = cleanSub(subtitleOf(n));
    const meta = isMock
      ? (langHindi ? '▶ टेस्ट शुरू करें' : '▶ Start test')
      : isMix
        ? (langHindi ? `🔀 ${kids} सेट` : `🔀 ${kids} sets`)
        : isReal
          ? (q ? (langHindi ? `📜 ${q} असली PYQ` : `📜 ${q} real PYQs`) : '')
        : soleQuizChild(n)
          ? (q ? `${q} ${langHindi ? 'प्रश्न' : 'Qs'}` : '')
        : [kids && !/टॉपिक|topic|lesson|आइटम/i.test(sub) ? `${kids} ${langHindi ? 'आइटम' : 'items'}` : '', q ? `${q} ${langHindi ? 'प्रश्न' : 'Qs'}` : ''].filter(Boolean).join(' • ');
    return (
      <button
        key={n.id}
        onClick={() => onOpen(n)}
        className={`sb-tap group w-full flex items-center gap-3.5 text-left rounded-[22px] p-3.5 pr-3 border transition-all cursor-pointer overflow-hidden ${
          isPyq
            ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-white border-amber-200 shadow-[0_6px_22px_-8px_rgba(217,119,6,0.35)]'
            : 'bg-white border-slate-100 shadow-[0_4px_20px_-6px_rgba(30,64,175,0.18)] hover:border-blue-200'
        }`}
      >
        <div className={`w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-[30px] shadow-inner border ${
          isPyq ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-amber-200' : 'bg-gradient-to-br from-blue-50 to-indigo-100/80 border-blue-100'
        }`}>
          {iconOf(n) || (isReal ? '📜' : isMock ? '📝' : '📂')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className={`font-extrabold text-[16.5px] leading-snug truncate ${isPyq ? 'text-amber-950' : 'text-slate-900'}`}>{titleOf(n)}</h3>
            {isPyq && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9.5px] font-extrabold tracking-wide">{isMix ? (langHindi ? 'मिक्स' : 'MIX') : 'PYQ'}</span>}
          </div>
          {sub && <p className={`text-[12px] mt-0.5 leading-snug line-clamp-2 ${isPyq ? 'text-amber-900/80' : 'text-slate-500'}`}>{sub}</p>}
          {meta && <p className={`text-[11px] font-bold mt-1 ${isPyq ? 'text-amber-700' : 'text-blue-700'}`}>{meta}</p>}
        </div>
        <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${isPyq ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'} group-hover:translate-x-0.5 transition-transform`}>
          <ChevronRight className="w-4.5 h-4.5" />
        </div>
      </button>
    );
  };

  const row = (n: any, idx: number) => {
    const pill = leafPill(n, langHindi);
    const sub = cleanSub(subtitleOf(n));
    return (
      <button
        key={n.id}
        onClick={() => onOpen(n)}
        className="sb-tap group w-full flex items-center gap-3 text-left bg-white rounded-2xl px-3 py-2.5 border border-slate-100 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.12)] hover:border-blue-200 transition-all cursor-pointer"
      >
        <div className="w-[52px] shrink-0 rounded-xl bg-blue-50 border border-blue-100 py-1.5 flex flex-col items-center justify-center leading-none">
          <span className="text-[14px] font-extrabold text-blue-700">{pill.top}</span>
          <span className="text-[9.5px] font-bold text-blue-600/80 mt-0.5">{pill.bottom}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-slate-900 text-[14.5px] leading-snug truncate">
            {iconOf(n) && iconOf(n) !== '⚡' ? <span className="mr-1">{iconOf(n)}</span> : null}
            {titleOf(n)}
          </h4>
          {sub && <p className="text-[11.5px] text-slate-500 truncate mt-0.5">{sub}</p>}
        </div>
        <div className="w-7 h-7 shrink-0 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </button>
    );
  };

  const heading = (n: any) => (
    <div key={n.id} className="pt-2 pb-0.5 flex items-center gap-2">
      <span className="text-lg">{iconOf(n) || '📑'}</span>
      <h3 className="font-extrabold text-slate-800 text-[15px] truncate">{titleOf(n)}</h3>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {headings.map(heading)}
      {containers.length > 0 && (depth === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{containers.map(cube)}</div>
      ) : (
        <div className="flex flex-col gap-3">{containers.map(folder)}</div>
      ))}
      {leaves.length > 0 && (
        <>
          {containers.length > 0 && (
            <div className="pt-1 flex items-center gap-2 text-[11.5px] font-extrabold text-slate-500 uppercase tracking-wide">
              <span>{langHindi ? 'टॉपिक / सेक्शन' : 'Topics / Sections'}</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>
          )}
          <div className="flex flex-col gap-2">{leaves.map(row)}</div>
        </>
      )}
    </div>
  );
}
