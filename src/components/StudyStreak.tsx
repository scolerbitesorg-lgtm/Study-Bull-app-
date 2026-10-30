// 🔥 मेरी पढ़ाई — streak + daily goal screen (30 Oct 2026, Tab for Aarav). Data: src/lib/streak.ts (this device only).
import React from 'react';
import { addDays, dayKey, GOAL_CHOICES, setGoal, testsOf } from '../lib/streak';
import { useStreakStats } from './StreakStrip';

const WEEK = ['सो', 'मं', 'बु', 'गु', 'शु', 'श', 'र'];

export const StudyStreak: React.FC<{ onQuiz?: () => void; onMock?: () => void }> = ({ onQuiz, onMock }) => {
  const s = useStreakStats();
  const t = s.today;
  const met = s.todayTests >= s.goal;
  const accToday = t.a ? Math.round(((t.r || 0) / t.a) * 100) : null;
  const accAll = s.totalAttempted ? Math.round((s.totalCorrect / s.totalAttempted) * 100) : null;

  // 5-week calendar, Monday first, ending with this week
  const now = new Date();
  const todayK = dayKey(now);
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  const start = addDays(now, -dow - 28);
  const cells = Array.from({ length: 35 }, (_, i) => addDays(start, i));

  const chip = (icon: string, label: string, n?: number) => (
    <div className="flex-1 min-w-0 rounded-xl bg-slate-50 border border-slate-200 px-1 py-2 text-center">
      <div className="text-base leading-none">{icon}</div>
      <div className="text-lg font-black text-slate-900 leading-tight mt-1">{n || 0}</div>
      <div className="text-[10.5px] font-bold text-slate-500 truncate">{label}</div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-6" data-sb-streak="screen">
      {/* Streak hero */}
      <div className="rounded-3xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-400 text-white p-5 shadow-md">
        <div className="flex items-center gap-4">
          <div className="text-6xl leading-none drop-shadow-sm select-none">🔥</div>
          <div className="min-w-0">
            <div className="text-4xl font-black leading-none">{s.streak} <span className="text-xl font-extrabold">दिन</span></div>
            <div className="text-sm font-bold text-white/90 mt-1">लगातार पढ़ाई की स्ट्रीक</div>
            <div className="text-xs font-semibold text-white/80 mt-0.5">🏅 सबसे लंबी स्ट्रीक: {s.best} दिन</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-white/15 border border-white/25 px-3 py-2 text-[13px] font-bold leading-snug">
          {s.doneToday
            ? met
              ? '✅ आज की पढ़ाई हो गई! कल भी आना, स्ट्रीक बढ़ती रहेगी।'
              : `👍 आज की स्ट्रीक पक्की। लक्ष्य के लिए ${s.goal - s.todayTests} टेस्ट और दें।`
            : s.atRisk
              ? '⚠️ आज अभी तक कोई टेस्ट नहीं दिया। आज एक टेस्ट दें, वरना स्ट्रीक 0 हो जाएगी।'
              : '🚀 आज एक टेस्ट दें और अपनी स्ट्रीक शुरू करें।'}
        </div>
      </div>

      {/* Today's goal */}
      <div className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-slate-500">🎯 आज का लक्ष्य</div>
            <div className="text-2xl font-black text-slate-900 leading-tight">
              {s.todayTests}<span className="text-slate-400">/{s.goal}</span> <span className="text-sm font-bold text-slate-600">टेस्ट</span>
            </div>
          </div>
          {met && <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-300">पूरा ✅</span>}
        </div>
        <div className="h-2.5 w-full rounded-full bg-orange-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${met ? 'bg-emerald-500' : 'bg-gradient-to-r from-orange-500 to-amber-400'}`}
            style={{ width: `${Math.min(100, Math.round((s.todayTests / Math.max(1, s.goal)) * 100))}%` }}
          />
        </div>
        <div className="flex gap-2">
          {chip('📝', 'क्विज़', t.q)}
          {chip('⏱️', 'मॉक', t.m)}
          {chip('⌨️', 'टाइपिंग', t.t)}
          {chip('🧮', 'स्पीड मैथ', t.c)}
        </div>
        <div className="text-[12.5px] font-semibold text-slate-600">
          आज हल किए प्रश्न: <b className="text-slate-900">{t.a || 0}</b>
          {accToday !== null && <> • सही: <b className="text-emerald-700">{t.r || 0}</b> ({accToday}%)</>}
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500 mb-1.5">रोज़ कितने टेस्ट देने हैं?</div>
          <div className="flex gap-2">
            {GOAL_CHOICES.map((g) => (
              <button
                key={g}
                type="button"
                data-sb-streak-goal={g}
                onClick={() => setGoal(g)}
                className={`flex-1 py-2 rounded-xl text-sm font-black border cursor-pointer active:scale-95 transition ${
                  s.goal === g ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        {(onQuiz || onMock) && (
          <div className="flex gap-2 pt-1">
            {onQuiz && (
              <button type="button" onClick={onQuiz} className="flex-1 py-3 rounded-2xl bg-blue-600 text-white font-black text-sm shadow-sm active:scale-95 transition cursor-pointer">
                📝 क्विज़ दें
              </button>
            )}
            {onMock && (
              <button type="button" onClick={onMock} className="flex-1 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm shadow-sm active:scale-95 transition cursor-pointer">
                ⏱️ मॉक टेस्ट दें
              </button>
            )}
          </div>
        )}
      </div>

      {/* Last 5 weeks */}
      <div className="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
        <div className="text-sm font-black text-slate-900 mb-3">📅 पिछले 5 हफ़्ते</div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEK.map((w) => (
            <div key={w} className="text-[11px] font-bold text-slate-400">{w}</div>
          ))}
          {cells.map((d) => {
            const k = dayKey(d);
            const n = testsOf(s.days[k]);
            const future = k > todayK;
            const cls = future
              ? 'bg-transparent text-slate-300'
              : n >= s.goal
                ? 'bg-orange-500 text-white'
                : n > 0
                  ? 'bg-orange-200 text-orange-900'
                  : 'bg-slate-100 text-slate-400';
            return (
              <div
                key={k}
                title={n ? `${n} टेस्ट` : ''}
                className={`aspect-square rounded-lg flex items-center justify-center text-[12px] font-bold ${cls} ${k === todayK ? 'ring-2 ring-blue-600 ring-offset-1' : ''}`}
              >
                {d.getDate()}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[11px] font-semibold text-slate-500 flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> कोई टेस्ट नहीं</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200" /> पढ़ाई की</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500" /> लक्ष्य पूरा</span>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-2.5">
        {[
          ['📆', 'पढ़ाई के दिन', String(s.activeDays)],
          ['✅', 'कुल टेस्ट', String(s.totalTests)],
          ['❓', 'हल किए प्रश्न', String(s.totalAttempted)],
          ['🎯', 'औसत सटीकता', accAll === null ? '—' : `${accAll}%`],
        ].map(([i, l, v]) => (
          <div key={l} className="rounded-2xl bg-white border border-slate-200 p-3 shadow-sm">
            <div className="text-[11.5px] font-bold text-slate-500">{i} {l}</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">{v}</div>
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-slate-500 leading-relaxed px-1">
        ℹ️ क्विज़, मॉक टेस्ट, टाइपिंग टेस्ट या स्पीड मैथ पूरा करने पर दिन गिना जाता है। 🔒 यह रिकॉर्ड सिर्फ़ आपके फ़ोन में सेव है, कहीं भेजा नहीं जाता।
      </p>
    </div>
  );
};
