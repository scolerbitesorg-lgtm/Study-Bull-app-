import React, { useState } from 'react';

// Real-CBT style instructions screen shown before every mock (Aarav 26 Oct 2026:
// "mock test suru hone se phle rules btane chahiye, according to real rules of exam").
// Every value comes from the mock's own admin data; a value that isn't there is left out.

export interface MockSection { name: string; count: number | null }
export interface MockInfo {
  exam: string;
  title: string;
  questions: number;
  durationMin: number | null;
  pos: number | null;
  neg: number | null;
  sections: MockSection[];
}

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return String(r);
};

// Sections: from the questions' own section field when present, else from the mock's
// subtitle pattern text, e.g. "… पूर्ण पैटर्न (GK 15, विज्ञान 15, गणित 15, तर्क 5)" or
// "(तर्क, GK, गणित, हिंदी — 20-20)".
export function mockSectionsOf(node: any, qs: { category?: string }[]): MockSection[] {
  const order: string[] = [];
  const cnt: Record<string, number> = {};
  for (const q of qs || []) {
    const c = String(q?.category || '').trim();
    if (!c) continue;
    if (!(c in cnt)) { cnt[c] = 0; order.push(c); }
    cnt[c]++;
  }
  if (order.length > 1) return order.map(n => ({ name: n, count: cnt[n] }));

  const sub = String(node?.subtitle || node?.subtitleHi || '');
  const groups = sub.match(/\(([^()]*)\)/g);
  if (!groups || !groups.length) return [];
  let inner = groups[groups.length - 1].slice(1, -1).trim();
  let each: number | null = null;
  const dash = inner.match(/^(.*?)\s+[—–-]\s*(\d+)(?:\s*-\s*\d+)*\s*$/);
  if (dash && dash[1].includes(',')) { inner = dash[1]; each = Number(dash[2]); }
  const parts = inner.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return [];
  const out: MockSection[] = [];
  for (const p of parts) {
    const m = p.match(/^(.*\S)\s+(\d+)$/);
    if (m) out.push({ name: m[1], count: Number(m[2]) });
    else out.push({ name: p, count: each });
  }
  // a parenthetical that isn't a section list (long sentences, no names) → ignore
  if (out.some(s => s.name.length > 40)) return [];
  return out;
}

export function buildMockInfo(node: any, exam: string, title: string, qs: { category?: string }[]): MockInfo {
  const d = num(node?.durationMinutes);
  const p = num(node?.positiveMarks);
  const n = num(node?.negativeMarks);
  return {
    exam,
    title,
    questions: (qs || []).length,
    durationMin: d !== null && d > 0 ? d : null,
    pos: p !== null && p > 0 ? p : null,
    neg: n !== null ? Math.abs(n) : null,
    sections: mockSectionsOf(node, qs)
  };
}

export function MockRules({ info, langHindi, onStart, onBack, headerBg }: {
  info: MockInfo;
  langHindi: boolean;
  onStart: () => void;
  onBack: () => void;
  headerBg: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const H = langHindi;
  const rows: { k: string; v: string }[] = [];
  rows.push({ k: H ? 'कुल प्रश्न' : 'Total questions', v: String(info.questions) });
  if (info.durationMin !== null) rows.push({ k: H ? 'कुल समय' : 'Total time', v: H ? `${fmt(info.durationMin)} मिनट` : `${fmt(info.durationMin)} min` });
  if (info.pos !== null) {
    rows.push({ k: H ? 'सही उत्तर पर' : 'Per correct answer', v: `+${fmt(info.pos)} ${H ? 'अंक' : 'marks'}` });
    rows.push({ k: H ? 'कुल अंक' : 'Total marks', v: fmt(info.questions * info.pos) });
  }
  if (info.neg !== null) rows.push({
    k: H ? 'गलत उत्तर पर' : 'Per wrong answer',
    v: info.neg > 0 ? `−${fmt(info.neg)} ${H ? 'अंक' : 'marks'}` : (H ? 'कोई नेगेटिव मार्किंग नहीं' : 'No negative marking')
  });

  const rules: string[] = H ? [
    'टाइमर ऊपर चलता रहेगा; समय खत्म होते ही टेस्ट अपने आप सबमिट हो जाएगा।',
    'ऊपर के नंबर (पैलेट) से किसी भी प्रश्न पर जा सकते हैं — प्रश्न छोड़कर बाद में लौट सकते हैं। हरा नंबर = उत्तर दिया।',
    'सबमिट से पहले उत्तर बदलना हो तो दूसरा विकल्प चुन लें।',
    'छोड़े गए (बिना उत्तर) प्रश्न पर कोई अंक नहीं कटता' + (info.neg && info.neg > 0 ? `, पर हर गलत उत्तर पर −${fmt(info.neg)} अंक कटेंगे — अंदाज़े से बचें।` : '।'),
    '"सबमिट करें" दबाने के बाद उत्तर नहीं बदल सकते।',
    'बीच में "वापस" जाने पर यह टेस्ट बंद हो जाएगा और दोबारा शुरू से होगा।'
  ] : [
    'The timer runs at the top; the test submits itself when time is up.',
    'Use the number palette to jump to any question — skip and come back later. Green = answered.',
    'To change an answer before submitting, just pick another option.',
    'Skipped questions lose no marks' + (info.neg && info.neg > 0 ? `; each wrong answer costs −${fmt(info.neg)} — avoid blind guesses.` : '.'),
    'After "Submit" answers cannot be changed.',
    'Going back mid-test closes it; it restarts from the beginning.'
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col w-full h-dvh bg-slate-50 text-slate-900 select-none overflow-hidden" data-testid="mock-rules">
      <div className="h-14 px-4 flex items-center gap-3 text-white shadow-sm shrink-0" style={{ background: headerBg }}>
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer shrink-0"
        >
          ← {H ? 'वापस' : 'Back'}
        </button>
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{H ? 'परीक्षा निर्देश' : 'Instructions'}</div>
          <div className="text-[11px] text-white/80 truncate">{info.exam}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wide">{info.exam}</div>
            <h2 className="text-lg font-extrabold text-slate-900 leading-snug break-words">{info.title}</h2>
            <div className="mt-3 divide-y divide-slate-100 text-sm" data-testid="mock-rules-facts">
              {rows.map(r => (
                <div key={r.k} className="flex items-center justify-between py-2 gap-3">
                  <span className="text-slate-600">{r.k}</span>
                  <span className={'font-bold text-right ' + (r.v.startsWith('−') ? 'text-rose-700' : 'text-slate-900')}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {info.sections.length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" data-testid="mock-rules-sections">
              <div className="px-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-600 flex justify-between">
                <span>{H ? 'सेक्शन' : 'Section'}</span>
                {info.sections.some(s => s.count !== null) && <span>{H ? 'प्रश्न' : 'Questions'}</span>}
              </div>
              {info.sections.map((s, i) => (
                <div key={i} className="px-4 py-2.5 border-t border-slate-100 flex justify-between gap-3 text-sm">
                  <span className="text-slate-800 break-words min-w-0">{i + 1}. {s.name}</span>
                  {s.count !== null && <span className="font-bold text-slate-900 shrink-0">{s.count}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="text-sm font-bold text-slate-900 mb-2">{H ? '📋 सामान्य निर्देश' : '📋 General instructions'}</div>
            <ol className="space-y-2 text-[13px] leading-relaxed text-slate-700 list-decimal pl-5">
              {rules.map((r, i) => <li key={i}>{r}</li>)}
            </ol>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-xl mx-auto space-y-3">
          <label className="flex items-center gap-3 text-sm font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="w-5 h-5 accent-blue-600 cursor-pointer shrink-0"
              data-testid="mock-rules-agree"
            />
            <span>{H ? 'मैंने निर्देश पढ़ लिए हैं' : 'I have read the instructions'}</span>
          </label>
          <button
            onClick={() => { if (agreed) onStart(); }}
            disabled={!agreed}
            data-testid="mock-rules-start"
            className={'w-full py-3.5 rounded-2xl font-bold text-base shadow-sm transition ' + (agreed ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}
          >
            {H ? 'टेस्ट शुरू करें ▶' : 'Start Test ▶'}
          </button>
        </div>
      </div>
    </div>
  );
}
