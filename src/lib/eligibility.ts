// Eligibility logic for the पात्रता जाँच screen. Pure functions — unit-checked in eligibility.test.ts.
import type { Category, ExamRule, Gender, Qual } from '../data/eligibility';

export interface YMD { y: number; m: number; d: number }

const parse = (s: string): YMD => {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
};
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
const cmp = (a: YMD, b: YMD) => (a.y - b.y) || (a.m - b.m) || (a.d - b.d);
const fmt = (a: YMD) => `${String(a.d).padStart(2, '0')}.${String(a.m).padStart(2, '0')}.${a.y}`;

export const formatDate = (s: string) => fmt(parse(s));

/** Completed years, months, days between `from` (birth) and `to` (cut-off). from ≤ to. */
export function diffYMD(fromS: string, toS: string): YMD {
  const a = parse(fromS);
  const b = parse(toS);
  let y = b.y - a.y;
  let m = b.m - a.m;
  let d = b.d - a.d;
  if (d < 0) {
    m -= 1;
    const pm = b.m === 1 ? 12 : b.m - 1;
    const py = b.m === 1 ? b.y - 1 : b.y;
    d += daysInMonth(py, pm);
  }
  if (m < 0) {
    y -= 1;
    m += 12;
  }
  return { y, m, d };
}

/** Age on a date (completed years, months, days). */
export const ageOn = (dob: string, on: string): YMD => diffYMD(dob, on);

export const ymdText = (a: YMD) => {
  const parts: string[] = [];
  if (a.y) parts.push(`${a.y} साल`);
  if (a.m) parts.push(`${a.m} महीने`);
  if (a.d || !parts.length) parts.push(`${a.d} दिन`);
  return parts.join(' ');
};

/** Shift a YYYY-MM-DD date back by n whole years (29 Feb → 28 Feb when needed). */
export function minusYears(s: string, n: number): string {
  const a = parse(s);
  const y = a.y - n;
  const d = Math.min(a.d, daysInMonth(y, a.m));
  return `${y}-${String(a.m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const QUAL_RANK: Record<Qual, number> = { '10': 1, iti: 1, '12': 2, grad: 3 };
const NEED_TEXT: Record<'10' | '12' | 'grad', string> = { '10': '10वीं पास चाहिए', '12': '12वीं पास चाहिए', grad: 'ग्रेजुएशन चाहिए' };

export interface Profile {
  dob: string;          // YYYY-MM-DD
  qual: Qual;
  gender: Gender;
  category: Category;
  esm: boolean;
  height?: number;      // cm
}

export type Status = 'yes' | 'no' | 'maybe';

export interface CheckResult {
  status: Status;
  reasons: string[];    // why not (❌) or what to watch (⚠️)
  notes: string[];      // positive / informational lines
  ageText: string;      // age on the cut-off date (or today)
  ageOnLabel: string;   // "01.01.2026 को" / "आज"
  window: { from: string; to: string; relaxYears: number };
  bandsOk?: string[];   // post groups whose age limit you meet (CGL, MTS)
}

const relaxFor = (e: ExamRule, p: Profile) => {
  const map = p.gender === 'F' && e.relaxF ? e.relaxF : e.relax;
  return map[p.category] ?? 0;
};

/** Check one birth-date window: returns '' when inside, else the reason. */
function windowReason(dob: string, from: string, to: string): { ok: boolean; reason: string } {
  if (cmp(parse(dob), parse(to)) > 0) {
    const short = diffYMD(to, dob);
    return { ok: false, reason: `उम्र ${ymdText(short)} कम (जन्म ${formatDate(to)} या उससे पहले होना चाहिए)` };
  }
  if (cmp(parse(dob), parse(from)) < 0) {
    const over = diffYMD(dob, from);
    return { ok: false, reason: `उम्र ${ymdText(over)} ज़्यादा (जन्म ${formatDate(from)} या उसके बाद होना चाहिए)` };
  }
  return { ok: true, reason: '' };
}

export function checkExam(e: ExamRule, p: Profile, today: string): CheckResult {
  const reasons: string[] = [];
  const notes: string[] = [];
  let status = 'yes' as Status;
  const bad = (r: string) => { status = 'no'; reasons.push(r); };
  const warn = (r: string) => { if (status === 'yes') status = 'maybe'; reasons.push(r); };

  // Gender
  if (!e.genders.includes(p.gender)) {
    bad(p.gender === 'F' ? 'यह भर्ती सिर्फ़ पुरुषों के लिए है' : 'यह भर्ती सिर्फ़ महिलाओं के लिए है');
    if (e.genderNote) notes.push(e.genderNote);
  }

  // Age
  const relaxYears = relaxFor(e, p);
  const baseFrom = p.gender === 'F' && e.dobFromF ? e.dobFromF : e.dobFrom;
  const from = minusYears(baseFrom, relaxYears);
  const to = e.dobTo;
  const ageOnDate = e.cutoff ?? today;
  const age = ageOn(p.dob, ageOnDate);
  const ageText = cmp(parse(p.dob), parse(ageOnDate)) > 0 ? '—' : ymdText(age);
  const ageOnLabel = e.cutoff ? `${formatDate(e.cutoff)} को` : 'आज';

  let bandsOk: string[] | undefined;
  if (e.bands && e.bands.length) {
    bandsOk = [];
    let firstReason = '';
    for (const b of e.bands) {
      const r = windowReason(p.dob, minusYears(b.dobFrom, relaxYears), b.dobTo);
      if (r.ok) bandsOk.push(`${b.label} (${b.ageText})`);
      else if (!firstReason) firstReason = r.reason;
    }
    if (!bandsOk.length) {
      // report against the widest window
      const r = windowReason(p.dob, from, to);
      ageFail(r.reason || firstReason);
    } else if (bandsOk.length < e.bands.length) {
      notes.push(`आयु के हिसाब से पात्र पद: ${bandsOk.join(', ')}`);
    }
  } else {
    const r = windowReason(p.dob, from, to);
    if (!r.ok) ageFail(r.reason);
  }
  function ageFail(reason: string) {
    const isOver = reason.includes('ज़्यादा');
    if (isOver && p.esm && e.esm) {
      warn(`${reason} — पूर्व सैनिक छूट (${e.esm}) से पात्र हो सकते हैं, अपनी सेवा अवधि से जाँचें`);
    } else {
      bad(reason);
    }
  }
  if (relaxYears > 0 && status !== 'no') notes.push(`${p.category} छूट: +${relaxYears} साल लगाई गई`);

  // Qualification
  const have = QUAL_RANK[p.qual];
  const need = QUAL_RANK[e.minQual];
  if (have < need) {
    if (e.minQual === '12' && p.qual === 'iti' && e.diplomaAs12) {
      warn('शर्त: 3 साल का इंजीनियरिंग डिप्लोमा (50%) हो तो पात्र — सिर्फ़ ITI से नहीं');
    } else {
      bad(NEED_TEXT[e.minQual] + (e.appearingOk ? ' (आख़िरी साल/परीक्षा दे रहे हों तो आवेदन कर सकते हैं)' : ''));
    }
  }

  // Physical (only a warning — it is measured at the PST, not at the form)
  if (p.height && e.physical && status !== 'no') {
    const st = p.category === 'ST';
    const min = p.gender === 'F'
      ? (st && e.physical.femaleHST) || e.physical.femaleH
      : (st && e.physical.maleHST) || e.physical.maleH;
    if (min && p.height < min) warn(`लंबाई ${min} सेमी चाहिए, आपकी ${p.height} सेमी (छूट वाले क्षेत्र/वर्ग में कम हो सकती है)`);
  }

  return { status, reasons, notes, ageText, ageOnLabel, window: { from, to, relaxYears }, bandsOk };
}
