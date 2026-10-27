// 📤 स्कोर कार्ड शेयर (Oct 27 2026, Tab's daily feature for Aarav).
// After a quiz / mock / typing test the student can turn the result into a picture card and send it on
// WhatsApp / Instagram (or save it). Everything happens on the phone: the card is drawn on a <canvas>,
// nothing is uploaded, nothing is stored. Loaded as its own chunk only when "शेयर करें" is tapped.
import React, { useEffect, useRef, useState } from 'react';

export type ShareStat = { label: string; value: string; color: string };
export type ShareData = {
  heading: string; // e.g. 'क्विज़ स्कोरकार्ड'
  title: string; // quiz / mock / passage name
  big: string; // e.g. '8/10', '112/160', '38'
  bigLabel: string; // e.g. 'स्कोर', 'अंक', 'WPM'
  pct: number; // 0..100 (ring)
  cheerPct?: number; // what the cheer line judges (default pct) — typing uses speed as well as accuracy
  pctLabel?: string; // shown beside the % above the big number (e.g. 'सटीकता')
  stats: ShareStat[]; // 3 boxes
};

const SITE = 'https://studybull.vercel.app/';
const FONT = '"Noto Sans Devanagari","Nirmala UI","Mangal","Kohinoor Devanagari",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const MONTHS = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];

function istDateText(): string {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function cheer(pct: number): { text: string; color: string } {
  if (pct >= 90) return { text: 'शानदार! टॉपर वाली तैयारी', color: '#047857' };
  if (pct >= 70) return { text: 'बहुत बढ़िया! ऐसे ही लगे रहो', color: '#047857' };
  if (pct >= 50) return { text: 'अच्छा प्रयास! थोड़ा और अभ्यास', color: '#b45309' };
  return { text: 'हार मत मानो! रोज़ अभ्यास करो', color: '#be123c' };
}

const ringColor = (pct: number) => (pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e');

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// font size that makes text fit maxW (never above size)
function fit(c: CanvasRenderingContext2D, text: string, weight: string, size: number, maxW: number): number {
  let s = size;
  for (; s > 18; s -= 2) {
    c.font = `${weight} ${s}px ${FONT}`;
    if (c.measureText(text).width <= maxW) break;
  }
  return s;
}

// split a long title into at most 2 lines (… on the 2nd)
function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= 2) return lines;
  let second = lines.slice(1).join(' ');
  while (second.length > 1 && c.measureText(second + '…').width > maxW) second = second.slice(0, -1);
  return [lines[0], second.trim() + '…'];
}

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const img = new Image();
    const t = setTimeout(() => res(null), 3000);
    img.onload = () => { clearTimeout(t); res(img); };
    img.onerror = () => { clearTimeout(t); res(null); };
    img.src = '/icon-192.png';
  });
}

export async function drawCard(d: ShareData): Promise<HTMLCanvasElement> {
  try { await (document as any).fonts?.ready; } catch { /* ignore */ }
  const W = 1080, H = 1350;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  c.textBaseline = 'alphabetic';

  // background
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f766e');
  bg.addColorStop(1, '#134e4a');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.06)';
  c.beginPath(); c.arc(W - 90, 110, 220, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(70, H - 120, 180, 0, Math.PI * 2); c.fill();

  // header: logo + name
  const logo = await loadLogo();
  if (logo) {
    c.save();
    roundRect(c, 70, 62, 128, 128, 30);
    c.clip();
    c.fillStyle = '#fff';
    c.fillRect(70, 62, 128, 128);
    c.drawImage(logo, 70, 62, 128, 128);
    c.restore();
  }
  const hx = logo ? 226 : 70;
  c.textAlign = 'left';
  c.fillStyle = '#ffffff';
  c.font = `800 66px ${FONT}`;
  c.fillText('Study Bull', hx, 128);
  c.fillStyle = '#99f6e4';
  c.font = `600 32px ${FONT}`;
  c.fillText('SSC GD • Agniveer • Police • Railway', hx, 176);

  // white card
  const cx = 60, cy = 240, cw = W - 120, ch = 900;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.25)';
  c.shadowBlur = 40;
  c.shadowOffsetY = 12;
  c.fillStyle = '#ffffff';
  roundRect(c, cx, cy, cw, ch, 48);
  c.fill();
  c.restore();

  c.textAlign = 'center';
  c.fillStyle = '#64748b';
  c.font = `700 38px ${FONT}`;
  c.fillText(d.heading, W / 2, cy + 82);

  c.fillStyle = '#0f172a';
  c.font = `800 50px ${FONT}`;
  const lines = wrap(c, d.title || 'Study Bull', cw - 120);
  lines.forEach((l, i) => c.fillText(l, W / 2, cy + 156 + i * 64));

  // ring
  const pct = Math.max(0, Math.min(100, d.pct || 0));
  const rx = W / 2, ry = cy + 445, rr = 172;
  c.lineCap = 'round';
  c.lineWidth = 34;
  c.strokeStyle = '#e2e8f0';
  c.beginPath(); c.arc(rx, ry, rr, 0, Math.PI * 2); c.stroke();
  if (pct > 0) {
    c.strokeStyle = ringColor(pct);
    c.beginPath(); c.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct) / 100); c.stroke();
  }
  c.fillStyle = '#0f172a';
  const bs = fit(c, d.big, '800', 104, rr * 2 - 80);
  c.font = `800 ${bs}px ${FONT}`;
  c.fillText(d.big, rx, ry + 30);
  c.fillStyle = '#64748b';
  c.font = `700 34px ${FONT}`;
  c.fillText(d.bigLabel, rx, ry + 84);
  c.fillStyle = ringColor(pct);
  c.font = `800 34px ${FONT}`;
  c.fillText(`${Math.round(pct)}%${d.pctLabel ? ' ' + d.pctLabel : ''}`, rx, ry - 82);

  // stats boxes
  const stats = d.stats.slice(0, 3);
  const gap = 24, bw = (cw - 80 - gap * (stats.length - 1)) / Math.max(1, stats.length), by = cy + 668, bh = 130;
  stats.forEach((s, i) => {
    const bx = cx + 40 + i * (bw + gap);
    c.fillStyle = '#f8fafc';
    roundRect(c, bx, by, bw, bh, 26);
    c.fill();
    c.strokeStyle = '#e2e8f0';
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = s.color;
    const vs = fit(c, s.value, '800', 54, bw - 30);
    c.font = `800 ${vs}px ${FONT}`;
    c.fillText(s.value, bx + bw / 2, by + 64);
    c.fillStyle = '#64748b';
    const ls = fit(c, s.label, '700', 28, bw - 24);
    c.font = `700 ${ls}px ${FONT}`;
    c.fillText(s.label, bx + bw / 2, by + 108);
  });

  const ch2 = cheer(d.cheerPct ?? pct);
  c.fillStyle = ch2.color;
  c.font = `800 38px ${FONT}`;
  c.fillText(ch2.text, W / 2, cy + ch - 40);

  // footer
  c.fillStyle = '#ffffff';
  c.font = `700 38px ${FONT}`;
  c.fillText('क्या तुम मुझसे ज़्यादा स्कोर कर सकते हो?', W / 2, 1186);
  c.fillStyle = '#fde68a';
  c.font = `800 48px ${FONT}`;
  c.fillText('studybull.vercel.app', W / 2, 1250);
  c.fillStyle = '#ccfbf1';
  c.font = `600 28px ${FONT}`;
  c.fillText(`फ्री मॉक टेस्ट • क्विज़ • नोट्स  |  ${istDateText()}`, W / 2, 1302);
  return cv;
}

export function shareText(d: ShareData): string {
  const what =
    d.bigLabel === 'WPM'
      ? `"${d.title}" में ${d.big} WPM की स्पीड (${Math.round(d.pct)}% सटीकता) से टाइप किया!`
      : `"${d.title}" में ${d.big} (${Math.round(d.pct)}%) स्कोर किया!`;
  return `मैंने Study Bull पर ${what} 💪\nक्या तुम मुझसे ज़्यादा ला सकते हो? फ्री क्विज़ व मॉक टेस्ट 👇\n${SITE}`;
}

export const ShareScore: React.FC<{ data: ShareData; onClose: () => void }> = ({ data, onClose }) => {
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);

  useEffect(() => {
    let alive = true;
    let made = '';
    drawCard(data)
      .then((cv) => new Promise<Blob | null>((r) => cv.toBlob((b) => r(b), 'image/png')))
      .then((b) => {
        if (!alive || !b) return;
        blobRef.current = b;
        made = URL.createObjectURL(b);
        setUrl(made);
      })
      .catch(() => alive && setMsg('कार्ड नहीं बन पाया, दोबारा कोशिश करें'));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [data]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const text = shareText(data);

  const doShare = async () => {
    setMsg('');
    const b = blobRef.current;
    const nav: any = navigator;
    try {
      setBusy(true);
      if (b && typeof File !== 'undefined') {
        const file = new File([b], 'StudyBull-score.png', { type: 'image/png' });
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text, title: 'Study Bull स्कोर' });
          return;
        }
      }
      if (nav.share) {
        await nav.share({ text, title: 'Study Bull स्कोर' });
        return;
      }
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    } catch (e: any) {
      if (e && e.name === 'AbortError') return; // user closed the share sheet
      window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    } finally {
      setBusy(false);
    }
  };

  const doSave = () => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'StudyBull-score.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setMsg('✅ फोटो डाउनलोड में सेव हो गई');
  };

  const doWa = () => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-900/70 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
      data-sb-share="modal"
      role="dialog"
      aria-modal="true"
      aria-label="स्कोर कार्ड शेयर करें"
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl p-4 shadow-2xl space-y-3 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-black text-slate-900 text-base">📤 अपना स्कोर कार्ड</p>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 font-black cursor-pointer" aria-label="बंद करें" data-sb-share="close">✕</button>
        </div>
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/5] flex items-center justify-center">
          {url ? (
            <img src={url} alt="स्कोर कार्ड" className="w-full h-full object-contain select-none" data-sb-share="img" />
          ) : (
            <span className="w-7 h-7 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <p className="text-[12px] text-slate-500 text-center leading-snug">दोस्तों को भेजो और चैलेंज करो! कार्ड सिर्फ़ आपके फ़ोन पर बनता है।</p>
        <button
          onClick={doShare}
          disabled={!url || busy}
          className="w-full py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-black disabled:opacity-50 active:scale-95 transition cursor-pointer"
          data-sb-share="share"
        >
          📲 शेयर करें (WhatsApp / Instagram)
        </button>
        <div className="flex gap-2">
          <button onClick={doSave} disabled={!url} className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-800 font-bold disabled:opacity-50 active:scale-95 transition cursor-pointer" data-sb-share="save">
            ⬇️ फोटो सेव करें
          </button>
          <button onClick={doWa} className="flex-1 py-2.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold active:scale-95 transition cursor-pointer" data-sb-share="wa">
            💬 सिर्फ़ मैसेज
          </button>
        </div>
        {msg && <p className="text-[12px] text-center font-bold text-slate-700">{msg}</p>}
      </div>
    </div>
  );
};
