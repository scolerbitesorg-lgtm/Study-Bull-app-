import React, { useEffect, useMemo, useState } from 'react';
import {
  loadMistakes, onMistakesChange, removeMistake, toggleBookmark, clearMistakes,
  type MistakeEntry, type MistakeQ,
} from '../lib/mistakes';

// 📕 गलती बुक screen (Oct 26 2026). All data is this device's localStorage (see lib/mistakes.ts).
type Filter = 'all' | 'wrong' | 'bm';
const PRACTICE_MAX = 25;

function ago(t: number): string {
  const d = Math.floor((Date.now() - t) / 86400000);
  if (d <= 0) return 'आज';
  if (d === 1) return 'कल';
  return `${d} दिन पहले`;
}

export const MistakeBook: React.FC<{ onPractice: (qs: MistakeQ[]) => void }> = ({ onPractice }) => {
  const [list, setList] = useState<MistakeEntry[]>(() => loadMistakes());
  const [filter, setFilter] = useState<Filter>('all');
  const [src, setSrc] = useState<string>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => onMistakesChange(() => setList(loadMistakes())), []);

  const live = list.filter((e) => e.wrong || e.bm);
  const counts = {
    all: live.length,
    wrong: live.filter((e) => e.wrong).length,
    bm: live.filter((e) => e.bm).length,
  };
  const today = live.filter((e) => Date.now() - e.t < 86400000).length;
  const srcOptions = useMemo(() => {
    const m = new Map<string, number>();
    live.forEach((e) => m.set(e.src || 'अन्य', (m.get(e.src || 'अन्य') || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const shown = live.filter(
    (e) => (filter === 'all' || (filter === 'wrong' ? e.wrong : e.bm)) && (src === 'all' || (e.src || 'अन्य') === src),
  );

  const start = () => {
    // most-missed first, then newest; max PRACTICE_MAX per round
    const pick = [...shown].sort((a, b) => (b.n - a.n) || (b.t - a.t)).slice(0, PRACTICE_MAX).map((e) => e.q);
    if (pick.length) onPractice(pick);
  };

  const chip = (key: Filter, label: string) => (
    <button
      key={key}
      type="button"
      data-filter={key}
      onClick={() => setFilter(key)}
      className={`flex-1 min-w-0 px-2 py-2.5 rounded-xl border text-[13px] font-bold transition active:scale-95 cursor-pointer truncate ${
        filter === key ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {label} ({counts[key]})
    </button>
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-3 pb-6" data-testid="mistake-book">
      <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-amber-50 p-3.5">
        <h2 className="font-extrabold text-rose-950 text-lg leading-tight">📕 गलती बुक — रिवीजन</h2>
        <p className="text-[12.5px] text-rose-900/90 font-semibold mt-1 leading-snug">
          क्विज़ और मॉक में जो प्रश्न गलत हुए, वो यहाँ अपने-आप जुड़ते हैं। अभ्यास में सही करो, तो लिस्ट से हट जाएँगे।
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-slate-200 bg-white py-2">
          <div className="text-xl font-black text-rose-600" data-testid="mb-wrong">{counts.wrong}</div>
          <div className="text-[11px] font-bold text-slate-500">सुधारने बाकी</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white py-2">
          <div className="text-xl font-black text-blue-600">{counts.bm}</div>
          <div className="text-[11px] font-bold text-slate-500">🔖 सेव किए</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white py-2">
          <div className="text-xl font-black text-amber-600">{today}</div>
          <div className="text-[11px] font-bold text-slate-500">आज जुड़े</div>
        </div>
      </div>

      {live.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-5 text-center" data-testid="mb-empty">
          <div className="text-3xl">🎯</div>
          <h3 className="mt-2 font-extrabold text-slate-800 text-[15px]">अभी कोई गलती नहीं!</h3>
          <p className="mt-1 text-[13px] text-slate-600 font-medium leading-snug">
            कोई भी क्विज़ या मॉक टेस्ट दो — जो प्रश्न गलत होंगे वो यहाँ सेव हो जाएँगे। किसी प्रश्न को बाद में दोहराना हो तो क्विज़ में 🔖 दबाओ।
          </p>
          <p className="mt-2 text-[11.5px] text-slate-500 font-semibold">💾 सब कुछ आपके इसी फ़ोन में सेव रहता है।</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {chip('all', 'सभी')}
            {chip('wrong', '❌ गलत')}
            {chip('bm', '🔖 सेव')}
          </div>

          {srcOptions.length > 1 && (
            <div className="flex items-center gap-2 min-w-0">
              <label htmlFor="mb-src" className="shrink-0 text-[13px] font-bold text-slate-600">📂 टॉपिक</label>
              <select
                id="mb-src"
                data-testid="mb-src"
                value={src}
                onChange={(e) => setSrc(e.target.value)}
                className="flex-1 min-w-0 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-800"
              >
                <option value="all">सभी टॉपिक</option>
                {srcOptions.map(([s, n]) => (
                  <option key={s} value={s}>{s} ({n})</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={start}
            disabled={!shown.length}
            data-testid="mb-practice"
            className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-extrabold text-[15px] shadow-md active:scale-[0.98] transition cursor-pointer"
          >
            ▶️ दोबारा अभ्यास करें ({Math.min(shown.length, PRACTICE_MAX)} प्रश्न)
          </button>

          {shown.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-6">इस फ़िल्टर में कोई प्रश्न नहीं।</div>
          )}

          {shown.map((e, i) => {
            const q = e.q;
            const isOpen = open === e.k;
            return (
              <div key={e.k} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm min-w-0" data-testid="mb-card">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-bold text-slate-500 truncate min-w-0">📂 {e.src || 'अन्य'}</span>
                  <span className="shrink-0 flex items-center gap-1 text-[11px] font-black">
                    {e.wrong && e.n > 0 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">{e.n}× गलत</span>
                    )}
                    {e.bm && <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">🔖</span>}
                    <span className="text-slate-400 font-bold">{ago(e.t)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : e.k)}
                  className="mt-1.5 w-full text-left cursor-pointer"
                >
                  <p className="font-bold text-slate-900 text-[14.5px] leading-snug break-words">
                    {i + 1}. {q.question}
                  </p>
                </button>
                <div className="mt-2 space-y-1">
                  {q.options.map((o, idx) => {
                    const ok = idx === q.correct;
                    const bad = e.wrong && idx === e.pick && !ok;
                    if (!isOpen && !ok && !bad) return null;
                    return (
                      <div
                        key={idx}
                        className={`rounded-lg px-2.5 py-1.5 text-[13px] font-semibold break-words border ${
                          ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : bad ? 'bg-rose-50 border-rose-200 text-rose-900 line-through decoration-rose-400' : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`}
                      >
                        {ok ? '✅ ' : bad ? '❌ ' : ''}{String.fromCharCode(65 + idx)}. {o}
                      </div>
                    );
                  })}
                </div>
                {isOpen && q.explanation && (
                  <p className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-2 text-[13px] text-blue-950 leading-snug break-words">
                    💡 {q.explanation}
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : e.k)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-[12.5px] font-bold active:scale-95 cursor-pointer"
                  >
                    {isOpen ? '▲ कम दिखाएँ' : '▼ सभी विकल्प + व्याख्या'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleBookmark(q, e.src)}
                    className={`px-3 py-2 rounded-xl text-[12.5px] font-bold border active:scale-95 cursor-pointer ${e.bm ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-700 border-blue-200'}`}
                    aria-label="सेव करें"
                  >
                    🔖
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMistake(e.k)}
                    className="px-3 py-2 rounded-xl bg-white text-slate-500 border border-slate-200 text-[12.5px] font-bold active:scale-95 cursor-pointer"
                    aria-label="हटाएँ"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}

          <div className="pt-2 text-center">
            {confirmClear ? (
              <div className="inline-flex items-center gap-2 text-[13px] font-bold">
                <span className="text-slate-600">पूरी लिस्ट साफ़ करें?</span>
                <button type="button" onClick={() => { clearMistakes('all'); setConfirmClear(false); }} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white cursor-pointer">हाँ</button>
                <button type="button" onClick={() => setConfirmClear(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 cursor-pointer">नहीं</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className="text-[12.5px] font-bold text-slate-400 underline cursor-pointer">
                पूरी लिस्ट साफ़ करें
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MistakeBook;
