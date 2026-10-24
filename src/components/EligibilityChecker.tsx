// ✅ पात्रता जाँच (Eligibility Checker) — native screen, added by Tab for Aarav (Oct 2026).
import React, { useEffect, useMemo, useState } from 'react';
import { EXAMS, QUAL_LABEL, CATEGORY_LABEL, type Category, type ExamRule, type Gender, type Qual } from '../data/eligibility';
import { checkExam, formatDate, type CheckResult, type Profile } from '../lib/eligibility';

const STORE_KEY = 'sb_eligibility_profile_v1';

type Draft = { dob: string; qual: Qual | ''; gender: Gender; category: Category; esm: boolean; height: string };
const EMPTY: Draft = { dob: '', qual: '', gender: 'M', category: 'GEN', esm: false, height: '' };

const todayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

function useProfile() {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return { ...EMPTY, ...JSON.parse(raw) };
    } catch {
      // ignore
    }
    return EMPTY;
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(draft));
    } catch {
      // ignore
    }
  }, [draft]);
  const profile: Profile | null = draft.dob && draft.qual
    ? { dob: draft.dob, qual: draft.qual, gender: draft.gender, category: draft.category, esm: draft.esm, height: Number(draft.height) || undefined }
    : null;
  return { draft, setDraft, profile };
}

const STATUS_UI: Record<CheckResult['status'], { label: string; cls: string; icon: string }> = {
  yes: { label: 'पात्र', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '✅' },
  maybe: { label: 'शर्त के साथ', cls: 'bg-amber-100 text-amber-800 border-amber-300', icon: '⚠️' },
  no: { label: 'नहीं', cls: 'bg-rose-100 text-rose-800 border-rose-300', icon: '❌' },
};

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }> = ({ active, onClick, children, small }) => (
  <button
    type="button"
    onClick={onClick}
    className={`${small ? 'px-1 py-2 text-[12px]' : 'px-2 py-2.5 text-[13px]'} rounded-xl border font-bold transition active:scale-95 cursor-pointer min-w-0 truncate ${
      active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200'
    }`}
  >
    {children}
  </button>
);

const Unverified = () => (
  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black align-middle">अपुष्ट</span>
);

function ProfileForm({ draft, setDraft, compact }: { draft: Draft; setDraft: (d: Draft) => void; compact?: boolean }) {
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const label = 'block text-[12px] font-black text-slate-600 mb-1';
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label className={label}>📅 जन्म तिथि</label>
          <input
            type="date"
            value={draft.dob}
            max={todayStr()}
            min="1960-01-01"
            onChange={e => set({ dob: e.target.value })}
            className="w-full min-w-0 h-11 px-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-[14px] font-bold"
          />
        </div>
        <div className="min-w-0">
          <label className={label}>📏 लंबाई (सेमी) <span className="font-semibold text-slate-400">वैकल्पिक</span></label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="जैसे 170"
            value={draft.height}
            onChange={e => set({ height: e.target.value })}
            className="w-full min-w-0 h-11 px-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-[14px] font-bold"
          />
        </div>
      </div>
      <div>
        <label className={label}>🎓 सबसे ऊँची योग्यता</label>
        <div className="grid grid-cols-4 gap-1.5">
          {(['10', 'iti', '12', 'grad'] as Qual[]).map(q => (
            <Chip key={q} small active={draft.qual === q} onClick={() => set({ qual: q })}>
              {q === '10' ? '10वीं' : q === 'iti' ? 'ITI/डिप्लोमा' : q === '12' ? '12वीं' : 'ग्रेजुएट'}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1.9fr] gap-3">
        <div>
          <label className={label}>🧑 लिंग</label>
          <div className="grid grid-cols-2 gap-1.5">
            <Chip small active={draft.gender === 'M'} onClick={() => set({ gender: 'M' })}>पुरुष</Chip>
            <Chip small active={draft.gender === 'F'} onClick={() => set({ gender: 'F' })}>महिला</Chip>
          </div>
        </div>
        <div className="min-w-0">
          <label className={label}>🏷️ वर्ग</label>
          <div className="grid grid-cols-5 gap-1">
            {(['GEN', 'OBC', 'EWS', 'SC', 'ST'] as Category[]).map(c => (
              <Chip key={c} small active={draft.category === c} onClick={() => set({ category: c })}>{c === 'GEN' ? 'Gen' : c}</Chip>
            ))}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700 cursor-pointer select-none">
        <input type="checkbox" checked={draft.esm} onChange={e => set({ esm: e.target.checked })} className="w-4 h-4 accent-indigo-600" />
        पूर्व सैनिक (Ex-serviceman)
      </label>
    </div>
  );
}

function ResultRow({ exam, r, onOpen }: { exam: ExamRule; r: CheckResult; onOpen: () => void }) {
  const s = STATUS_UI[r.status];
  return (
    <button type="button" onClick={onOpen} className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-3 active:scale-[0.99] transition cursor-pointer">
      <div className="flex items-start gap-2.5">
        <div className="text-2xl leading-none mt-0.5 shrink-0">{exam.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[14px] font-black text-slate-900 leading-snug break-words">{exam.nameHi}</div>
              <div className="text-[11px] text-slate-500 leading-snug break-words">{exam.nameEn}</div>
            </div>
            <span className={`shrink-0 px-2 py-1 rounded-lg border text-[11px] font-black whitespace-nowrap ${s.cls}`}>{s.icon} {s.label}</span>
          </div>
          {r.reasons.length > 0 && (
            <div className={`mt-1.5 text-[12px] font-bold leading-snug break-words ${r.status === 'no' ? 'text-rose-700' : 'text-amber-700'}`}>
              {r.reasons.join(' • ')}
            </div>
          )}
          {r.status !== 'no' && r.bandsOk && r.bandsOk.length > 0 && r.bandsOk.length < (exam.bands?.length || 0) && (
            <div className="mt-1 text-[11.5px] text-emerald-700 font-bold leading-snug break-words">पात्र पद: {r.bandsOk.join(', ')}</div>
          )}
          {r.status !== 'no' && exam.keyCondition && (
            <div className="mt-1 text-[11.5px] text-indigo-700 font-bold leading-snug break-words">📌 शर्त: {exam.keyCondition}</div>
          )}
          <div className="mt-1 text-[11.5px] text-slate-500 leading-snug">
            आयु ({r.ageOnLabel}): <span className="font-bold text-slate-700">{r.ageText}</span> · सीमा {exam.ageText}
          </div>
        </div>
      </div>
    </button>
  );
}

const GROUP_ORDER: ExamRule['group'][] = ['SSC', 'डिफेंस', 'रेलवे', 'राज्य पुलिस', 'UPSC'];

export function EligibilityList({ onOpenExam }: { onOpenExam: (id: string) => void }) {
  const { draft, setDraft, profile } = useProfile();
  const [mode, setMode] = useState<'all' | 'pick'>('all');
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('all');
  const today = todayStr();

  const results = useMemo(() => (profile ? EXAMS.map(e => ({ e, r: checkExam(e, profile, today) })) : []), [profile?.dob, profile?.qual, profile?.gender, profile?.category, profile?.esm, profile?.height, today]);
  const counts = { yes: results.filter(x => x.r.status === 'yes').length, maybe: results.filter(x => x.r.status === 'maybe').length, no: results.filter(x => x.r.status === 'no').length };
  const order = { yes: 0, maybe: 1, no: 2 } as const;
  const shown = results
    .filter(x => filter === 'all' || (filter === 'yes' ? x.r.status !== 'no' : x.r.status === 'no'))
    .sort((a, b) => order[a.r.status] - order[b.r.status]);

  return (
    <div className="space-y-3 pb-6">
      <div className="rounded-2xl p-4 text-white shadow-md bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="text-lg font-black">✅ पात्रता जाँच</div>
        <div className="text-[12px] text-white/90 leading-snug">जन्म तिथि और योग्यता डालें — देखें किन परीक्षाओं के लिए आवेदन कर सकते हैं (Eligibility Checker)</div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-2xl">
        <button type="button" onClick={() => setMode('all')} className={`py-2.5 rounded-xl text-[13px] font-black cursor-pointer ${mode === 'all' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>📋 सभी परीक्षाएँ जाँचें</button>
        <button type="button" onClick={() => setMode('pick')} className={`py-2.5 rounded-xl text-[13px] font-black cursor-pointer ${mode === 'pick' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'}`}>👆 परीक्षा चुनें</button>
      </div>

      {mode === 'all' ? (
        <>
          <ProfileForm draft={draft} setDraft={setDraft} />
          {!profile ? (
            <div className="text-center text-[13px] font-bold text-slate-500 py-4">👆 जन्म तिथि और योग्यता चुनें — नतीजे यहीं दिखेंगे</div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <button type="button" onClick={() => setFilter('all')} className={`py-2 rounded-xl border text-[12px] font-black cursor-pointer ${filter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200'}`}>सभी {results.length}</button>
                <button type="button" onClick={() => setFilter('yes')} className={`py-2 rounded-xl border text-[12px] font-black cursor-pointer ${filter === 'yes' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200'}`}>✅ पात्र {counts.yes + counts.maybe}</button>
                <button type="button" onClick={() => setFilter('no')} className={`py-2 rounded-xl border text-[12px] font-black cursor-pointer ${filter === 'no' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200'}`}>❌ नहीं {counts.no}</button>
              </div>
              <div className="space-y-2">
                {shown.map(({ e, r }) => <ResultRow key={e.id} exam={e} r={r} onOpen={() => onOpenExam(e.id)} />)}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug px-1">किसी भी परीक्षा पर टैप करें — पूरी पात्रता, छूट और स्रोत दिखेगा। आवेदन से पहले आधिकारिक नोटिफिकेशन ज़रूर देखें।</p>
            </>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {GROUP_ORDER.map(g => (
            <div key={g}>
              <div className="text-[12px] font-black text-slate-500 mb-1.5 px-1">{g}</div>
              <div className="space-y-2">
                {EXAMS.filter(e => e.group === g).map(e => (
                  <button key={e.id} type="button" onClick={() => onOpenExam(e.id)} className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex items-center gap-3 active:scale-[0.99] transition cursor-pointer">
                    <div className="text-2xl shrink-0">{e.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-black text-slate-900 leading-snug break-words">{e.nameHi}</div>
                      <div className="text-[11px] text-slate-500 leading-snug break-words">{e.nameEn}</div>
                      <div className="text-[11.5px] text-indigo-700 font-bold mt-0.5">आयु {e.ageText} · {QUAL_LABEL[e.minQual]}</div>
                    </div>
                    <div className="text-slate-400 text-lg shrink-0">›</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const Section: React.FC<{ title: string; unverified?: boolean; children: React.ReactNode }> = ({ title, unverified, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5">
    <div className="text-[13px] font-black text-indigo-700 mb-1.5">{title}{unverified && <Unverified />}</div>
    <div className="text-[13px] text-slate-800 leading-relaxed space-y-1 break-words">{children}</div>
  </div>
);

export function EligibilityExam({ examId }: { examId: string | null }) {
  const { draft, setDraft, profile } = useProfile();
  const exam = EXAMS.find(e => e.id === examId) || EXAMS[0];
  const r = profile ? checkExam(exam, profile, todayStr()) : null;
  const uv = (k: string) => Boolean(exam.unverified?.includes(k));
  const s = r ? STATUS_UI[r.status] : null;

  return (
    <div className="space-y-3 pb-6">
      <div className="rounded-2xl p-4 text-white shadow-md bg-gradient-to-r from-indigo-600 to-blue-600">
        <div className="flex items-start gap-3">
          <div className="text-3xl leading-none shrink-0">{exam.icon}</div>
          <div className="min-w-0">
            <div className="text-[17px] font-black leading-snug break-words">{exam.nameHi}</div>
            <div className="text-[12px] text-white/85 leading-snug break-words">{exam.nameEn}</div>
          </div>
        </div>
      </div>

      {r && s ? (
        <div className={`rounded-2xl border-2 p-3.5 ${s.cls}`}>
          <div className="text-[16px] font-black">{s.icon} {r.status === 'yes' ? 'आप पात्र हैं' : r.status === 'maybe' ? 'शर्तों के साथ पात्र' : 'आप पात्र नहीं हैं'}</div>
          {r.reasons.map((x, i) => <div key={i} className="text-[13px] font-bold leading-snug mt-1 break-words">• {x}</div>)}
          {r.status !== 'no' && exam.keyCondition && <div className="text-[13px] font-bold leading-snug mt-1 break-words">📌 शर्त: {exam.keyCondition}</div>}
          {r.notes.map((x, i) => <div key={'n' + i} className="text-[12.5px] font-semibold leading-snug mt-1 break-words opacity-90">• {x}</div>)}
          <div className="text-[12.5px] font-semibold mt-1.5">आपकी आयु ({r.ageOnLabel}): <b>{r.ageText}</b></div>
          <div className="text-[12px] font-semibold opacity-80">आपके लिए जन्म तिथि सीमा: {formatDate(r.window.from)} – {formatDate(r.window.to)}</div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-3 text-[13px] font-bold text-indigo-800">👇 अपनी जन्म तिथि और योग्यता डालें — इस परीक्षा का नतीजा तुरंत दिखेगा</div>
      )}

      <ProfileForm draft={draft} setDraft={setDraft} compact />

      <Section title="🎂 आयु सीमा" unverified={uv('dob')}>
        <div><b>{exam.ageText}</b>{exam.cutoff ? <> — <b>{formatDate(exam.cutoff)}</b> को (cut-off तारीख)</> : ' — जन्म तिथि सीमा के अनुसार'}</div>
        <div>जन्म तिथि (UR{exam.dobFromF ? ' पुरुष' : ''}): {formatDate(exam.dobFrom)} से {formatDate(exam.dobTo)} के बीच</div>
        {exam.dobFromF && <div>जन्म तिथि (UR महिला): {formatDate(exam.dobFromF)} से {formatDate(exam.dobTo)} के बीच</div>}
        {exam.bands && exam.bands.map(b => <div key={b.label}>• {b.label}: जन्म {formatDate(b.dobFrom)} – {formatDate(b.dobTo)}</div>)}
      </Section>

      <Section title="🏷️ आयु में छूट" unverified={uv('relax')}>
        {exam.relaxText.map(x => <div key={x}>• {x}</div>)}
        {exam.esm && <div>• {exam.esm}</div>}
      </Section>

      <Section title="🎓 योग्यता" unverified={uv('qual')}>
        {exam.qualText.map(x => <div key={x}>• {x}</div>)}
        {exam.itiOk && <div>• ITI वाले भी पात्र</div>}
      </Section>

      {(exam.conditions?.length || exam.genderNote || exam.genders.length === 1) && (
        <Section title="📌 अन्य शर्तें">
          {exam.genders.length === 1 && <div>• सिर्फ़ {exam.genders[0] === 'M' ? 'पुरुष' : 'महिला'} उम्मीदवार</div>}
          {exam.genderNote && <div>• {exam.genderNote}</div>}
          {exam.conditions?.map(x => <div key={x}>• {x}</div>)}
        </Section>
      )}

      {exam.physical && (
        <Section title="🏃 शारीरिक मानक" unverified={uv('physical')}>
          {exam.physical.lines.map(x => <div key={x}>• {x}</div>)}
        </Section>
      )}

      <div className="rounded-2xl bg-slate-100 border border-slate-200 p-3 text-[12px] text-slate-600 leading-snug break-words">
        📄 स्रोत: {exam.source} — आवेदन से पहले आधिकारिक नोटिफिकेशन ज़रूर देखें।
        {!exam.official && <div className="mt-1 text-[11px] text-slate-500">(आधिकारिक PDF यहाँ नहीं खुला; विश्वसनीय शिक्षा वेबसाइट से लिया गया)</div>}
      </div>
    </div>
  );
}
