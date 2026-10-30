// 🔥 Streak strip on home + small nudge on result screens (30 Oct 2026). Screen itself: StudyStreak.tsx (lazy).
import React, { useEffect, useState } from 'react';
import { getStats, STREAK_EVENT, type StreakStats } from '../lib/streak';

export function useStreakStats(): StreakStats {
  const [s, setS] = useState<StreakStats>(() => getStats());
  useEffect(() => {
    const up = () => setS(getStats());
    window.addEventListener(STREAK_EVENT, up);
    window.addEventListener('storage', up);
    window.addEventListener('focus', up);
    document.addEventListener('visibilitychange', up);
    return () => {
      window.removeEventListener(STREAK_EVENT, up);
      window.removeEventListener('storage', up);
      window.removeEventListener('focus', up);
      document.removeEventListener('visibilitychange', up);
    };
  }, []);
  return s;
}

const Bar: React.FC<{ done: number; goal: number }> = ({ done, goal }) => (
  <div className="h-1.5 w-full rounded-full bg-orange-100 overflow-hidden">
    <div
      className={`h-full rounded-full transition-all duration-500 ${done >= goal ? 'bg-emerald-500' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`}
      style={{ width: `${Math.min(100, Math.round((done / Math.max(1, goal)) * 100))}%` }}
    />
  </div>
);

/** Slim card above the home grid (does not add a tile) */
export const StreakStrip: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const s = useStreakStats();
  const met = s.todayTests >= s.goal;
  const title = s.streak > 0 ? `${s.streak} दिन की स्ट्रीक` : 'पढ़ाई स्ट्रीक शुरू करें';
  const sub = met
    ? `आज का लक्ष्य पूरा ✅ (${s.todayTests}/${s.goal} टेस्ट)`
    : s.atRisk
      ? `आज ${s.goal - s.todayTests} टेस्ट और दें, स्ट्रीक बचाएँ`
      : `आज ${s.todayTests}/${s.goal} टेस्ट • रोज़ का लक्ष्य`;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-sb-streak="strip"
      className="sb-tap w-full flex items-center gap-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-3.5 py-2.5 text-left shadow-sm cursor-pointer"
    >
      <span className={`text-2xl leading-none shrink-0 ${s.streak > 0 && !s.atRisk ? '' : 'grayscale-[60%] opacity-80'}`}>🔥</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-baseline justify-between gap-2">
          <span className="font-black text-[15px] text-slate-900 truncate">{title}</span>
          <span className="shrink-0 text-[11px] font-bold text-orange-700">{s.todayTests}/{s.goal}</span>
        </span>
        <span className={`block text-[11.5px] font-semibold truncate mb-1 ${s.atRisk ? 'text-rose-600' : 'text-slate-600'}`}>{sub}</span>
        <Bar done={s.todayTests} goal={s.goal} />
      </span>
      <span className="shrink-0 text-slate-400 text-lg leading-none">›</span>
    </button>
  );
};

/** One line on quiz / mock / typing / speed-math result screens */
export const StreakNudge: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const s = useStreakStats();
  const met = s.todayTests >= s.goal;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-sb-streak="nudge"
      className="sb-tap w-full rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-left cursor-pointer"
    >
      <span className="flex items-center justify-between gap-2 mb-1">
        <span className="font-black text-[13.5px] text-slate-900 truncate">
          {met ? '🎉 आज का लक्ष्य पूरा!' : `🎯 आज ${s.todayTests}/${s.goal} टेस्ट पूरे`}
        </span>
        <span className="shrink-0 text-[12.5px] font-black text-orange-700">🔥 {s.streak} दिन</span>
      </span>
      <Bar done={s.todayTests} goal={s.goal} />
    </button>
  );
};
