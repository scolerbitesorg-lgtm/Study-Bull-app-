// 🔔 Job Alert (सरकारी नौकरी) — native screen, added by Tab for Aarav (Oct 2026).
// Data lives in src/data/jobs.json and is refreshed twice daily (8 AM / 7 PM IST).
import React, { useEffect, useMemo, useState } from 'react';
import JOBS_DATA from '../data/jobs.json';

type Job = {
  id: string;
  status: 'open' | 'upcoming' | 'closed';
  name_hi: string;
  name_en: string;
  posts?: string;
  qualification?: string;
  age?: string;
  fee?: string;
  start?: string | null;
  last?: string | null;
  last_note?: string | null;
  exam?: string;
  link?: string;
  link_display?: string;
  unconfirmed?: string[];
};

const DATA = JOBS_DATA as unknown as { updatedAt: string; jobs: Job[] };

const MONTHS = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

const parseISO = (s?: string | null): Date | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
const fmt = (s?: string | null) => {
  const dt = parseISO(s);
  return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}` : '';
};
const todayMidnight = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

// Effective status: a job whose last date has passed shows as closed; an upcoming job whose start date has come shows as open.
const effectiveStatus = (j: Job, today: Date): Job['status'] => {
  const last = parseISO(j.last);
  if (last && daysBetween(today, last) < 0) return 'closed';
  if (j.status === 'upcoming') {
    const start = parseISO(j.start);
    if (start && daysBetween(today, start) <= 0 && !(j.unconfirmed || []).includes('start')) return 'open';
  }
  return j.status;
};

const STATUS_UI: Record<Job['status'], { label: string; cls: string }> = {
  open: { label: '🟢 आवेदन चालू', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  upcoming: { label: '🟡 जल्द शुरू', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  closed: { label: '🔴 बंद', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
};

const Unverified = () => (
  <span className="ml-1 inline-block px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black align-middle">अपुष्ट</span>
);

const Row: React.FC<{ label: string; value?: string | null; flag?: boolean }> = ({ label, value, flag }) =>
  value ? (
    <div className="flex gap-2 text-[13px] leading-snug min-w-0">
      <span className="shrink-0 text-slate-500 font-semibold w-[84px]">{label}</span>
      <span className="text-slate-800 font-medium min-w-0 break-words">
        {value}
        {flag && <Unverified />}
      </span>
    </div>
  ) : null;

type Filter = 'all' | 'open' | 'upcoming';

export const JobAlert: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const today = todayMidnight();

  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      // ignore
    }
  }, []);

  const jobs = useMemo(() => {
    const rank: Record<Job['status'], number> = { open: 0, upcoming: 1, closed: 2 };
    return DATA.jobs
      .map((j) => ({ j, st: effectiveStatus(j, today) }))
      .filter(({ j, st }) => {
        if (st !== 'closed') return true;
        const last = parseISO(j.last);
        return !last || daysBetween(last, today) <= 7; // drop jobs closed more than 7 days ago
      })
      .sort((a, b) => {
        if (rank[a.st] !== rank[b.st]) return rank[a.st] - rank[b.st];
        const la = parseISO(a.j.last)?.getTime() ?? Infinity;
        const lb = parseISO(b.j.last)?.getTime() ?? Infinity;
        return la - lb;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today.getTime()]);

  const counts = {
    all: jobs.length,
    open: jobs.filter((x) => x.st === 'open').length,
    upcoming: jobs.filter((x) => x.st === 'upcoming').length,
  };
  const shown = jobs.filter((x) => filter === 'all' || x.st === filter);

  const chip = (key: Filter, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setFilter(key)}
      className={`flex-1 min-w-0 px-2 py-2.5 rounded-xl border text-[13px] font-bold transition active:scale-95 cursor-pointer truncate ${
        filter === key ? 'bg-orange-600 text-white border-orange-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {label} ({counts[key]})
    </button>
  );

  return (
    <div className="w-full max-w-full overflow-x-hidden space-y-3 pb-6" data-testid="job-alert">
      <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-3.5">
        <h2 className="font-extrabold text-orange-950 text-lg leading-tight">🔔 Job Alert — सरकारी नौकरी</h2>
        <p className="text-[12.5px] text-orange-900/90 font-semibold mt-1 leading-snug">
          अपडेट: {DATA.updatedAt} • रोज़ सुबह 8 बजे और शाम 7 बजे
        </p>
      </div>

      <div className="flex gap-2">
        {chip('all', 'सभी')}
        {chip('open', '🟢 चालू')}
        {chip('upcoming', '🟡 जल्द')}
      </div>

      {shown.length === 0 && (
        <div className="text-center text-sm text-slate-500 py-8">इस श्रेणी में अभी कोई भर्ती नहीं।</div>
      )}

      {shown.map(({ j, st }) => {
        const un = new Set(j.unconfirmed || []);
        const last = parseISO(j.last);
        const left = last ? daysBetween(today, last) : null;
        const start = parseISO(j.start);
        const toStart = start ? daysBetween(today, start) : null;
        const ui = STATUS_UI[st];
        const Card: React.ElementType = j.link ? 'a' : 'div';
        return (
          <Card
            key={j.id}
            {...(j.link ? { href: j.link, target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="block rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm active:scale-[0.99] transition min-w-0 no-underline"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-black ${ui.cls}`}>{ui.label}</span>
              {j.posts && (
                <span className="text-[12px] font-bold text-slate-600 truncate">
                  पद: {j.posts}
                  {un.has('posts') && <Unverified />}
                </span>
              )}
            </div>
            <h3 className="mt-2 font-extrabold text-slate-900 text-[15px] leading-snug break-words">{j.name_hi}</h3>
            <p className="text-[12px] text-slate-500 font-medium leading-snug break-words">{j.name_en}</p>

            <div
              className={`mt-2.5 rounded-xl px-3 py-2 border ${
                st === 'open' ? 'bg-rose-50 border-rose-200' : st === 'upcoming' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-[14px] font-extrabold text-slate-900 leading-snug break-words">
                📅 अंतिम तिथि: {last ? fmt(j.last) : j.last_note || 'नोटिफिकेशन आने पर'}
                {un.has('last') && <Unverified />}
              </div>
              {left !== null && st === 'open' && (
                <div className={`text-[13px] font-black mt-0.5 ${left <= 3 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  ⏳ {left === 0 ? 'आज आख़िरी दिन!' : `${left} दिन बचे`}
                </div>
              )}
              {st === 'upcoming' && toStart !== null && toStart > 0 && (
                <div className="text-[13px] font-black mt-0.5 text-amber-700">⏳ आवेदन {toStart} दिन में शुरू</div>
              )}
              {st === 'closed' && <div className="text-[13px] font-black mt-0.5 text-slate-500">आवेदन बंद हो चुका</div>}
            </div>

            <div className="mt-2.5 space-y-1">
              <Row label="🎓 योग्यता" value={j.qualification} flag={un.has('qualification')} />
              <Row label="🎂 आयु" value={j.age} flag={un.has('age')} />
              <Row label="💰 शुल्क" value={j.fee} flag={un.has('fee')} />
              <Row label="🟢 शुरू" value={start ? fmt(j.start) : null} flag={un.has('start')} />
              <Row label="📝 परीक्षा" value={j.exam} flag={un.has('exam')} />
            </div>

            {j.link && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-orange-600 text-white px-3 py-2.5">
                <span className="text-[13px] font-extrabold">🔗 आधिकारिक वेबसाइट खोलें</span>
                <span className="text-[11px] font-semibold opacity-90 truncate min-w-0">{j.link_display || ''}</span>
              </div>
            )}
          </Card>
        );
      })}

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] font-bold text-amber-900 leading-snug">
        ⚠️ आवेदन से पहले आधिकारिक नोटिफिकेशन ज़रूर देखें
      </div>
    </div>
  );
};

export default JobAlert;
