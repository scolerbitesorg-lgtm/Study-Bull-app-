import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Volume2, VolumeX, ArrowLeft, 
  CheckCircle2, XCircle, Clock, 
  RotateCcw, Sparkles, Calculator, Flame, Sun, Moon, Copy, ChevronRight, Award, Zap,
  Check, BookOpen, ChevronDown, ChevronUp, ExternalLink,
  Code, Eye, Maximize2, Minimize2, RefreshCw, Play,
  Plus, Edit3, Trash2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  loadStudyBullApp, 
  recordUserAttempt
} from './lib/supabase.ts';
import { splitStore } from './lib/splitStore';
import { SandboxedHtmlView } from './components/SandboxedHtmlView';

// Code-defined screens load as separate chunks only when opened (smaller first download)
const EligibilityList = React.lazy(() => import('./components/EligibilityChecker').then((m) => ({ default: m.EligibilityList })));
const EligibilityExam = React.lazy(() => import('./components/EligibilityChecker').then((m) => ({ default: m.EligibilityExam })));
const JobAlert = React.lazy(() => import('./components/JobAlert').then((m) => ({ default: m.JobAlert })));

// Return visit: home + already-opened tiles straight from the per-tile cache (split data layout)
const SPLIT_BOOT: { nodes: any[]; settings: any } | null = (() => {
  try {
    return typeof window !== 'undefined' ? splitStore.initFromCache() : null;
  } catch {
    return null;
  }
})();

function ScreenLoader() {
  return (
    <div className="flex items-center justify-center py-16 text-sm font-semibold text-slate-500 gap-2">
      <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      लोड हो रहा है…
    </div>
  );
}
import { playSound, initSound, type SoundType } from './lib/sound';

// Error Boundary to prevent any blank or white screen crashes
interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackView: () => void;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class SafeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App Error caught by SafeErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200">
            <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-2xl mx-auto flex items-center justify-center text-3xl mb-4">
              🐂
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Study Bull App</h2>
            <p className="text-sm text-slate-600 mb-6">
              पेज लोड करने में कोई समस्या हुई। कृपया होम स्क्रीन पर लौटें।
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                this.props.fallbackView();
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow transition"
            >
              होम स्क्रीन पर जाएं
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Sound system: one shared, gesture-unlocked Web Audio context (see src/lib/sound.ts).
// Old version created a NEW AudioContext on every sound (never closed) — browsers cap these,
// so sounds stopped after a while, timer sounds stayed silent, and some were cut mid-way.
const playGentleSound = (type: SoundType, muted: boolean) => {
  playSound(type, muted);
};
initSound();

// One entry of the in-app navigation stack (mirrors browser history entries)
type NavSnapshot = { view: ViewState; node: any; folders: any[]; chapter: any };

type ViewState = 
  | 'home' 
  | 'quiz_categories' 
  | 'quiz_play' 
  | 'quiz_result' 
  | 'mock_play' 
  | 'mock_result' 
  | 'notes_lib' 
  | 'notes_reader' 
  | 'calc_setup' 
  | 'calc_practice' 
  | 'calc_result' 
  | 'typing_setup' 
  | 'typing_practice' 
  | 'typing_result'
  | 'custom_node'
  | 'eligibility'
  | 'eligibility_exam'
  | 'job_alert';

export interface QuizQuestion {
  id: number;
  question: string;
  questionEn: string;
  options: string[];
  optionsEn: string[];
  correct: number;
  explanation: string;
  explanationEn: string;
  shortcut?: string;
  category?: string;
}

interface Chapter {
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn?: string;
  content: string;
}

// Admin panel saves the answer as `correctIndex`; older/imported data may use `correct` or `answerIndex`.
function resolveCorrectIndex(q: any): number {
  for (const v of [q?.correctIndex, q?.correct, q?.answerIndex]) {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n === 'number' && Number.isInteger(n) && n >= 0) return n;
  }
  return 0;
}

// Mock duration as set in the admin panel (durationMinutes, default 60 min), in seconds.
function resolveMockDurationSec(node: any): number {
  const m = Number(node?.durationMinutes);
  return Number.isFinite(m) && m > 0 ? Math.round(m * 60) : 3600;
}

// Marks per question as set in the admin panel (positiveMarks / negativeMarks); fallback +1 / 0.
function resolveMockMarks(node: any): { pos: number; neg: number } {
  const p = Number(node?.positiveMarks);
  const n = Number(node?.negativeMarks);
  return {
    pos: Number.isFinite(p) && p > 0 ? p : 1,
    neg: Number.isFinite(n) ? Math.abs(n) : 0
  };
}

function fmtMarks(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function findFirstMockNode(nodes: any[]): any | null {
  if (!Array.isArray(nodes)) return null;
  for (const item of nodes) {
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    const target = String(item?.view || item?.target_view || '').toLowerCase();
    if (kind === 'mock' || target.includes('mock')) return item;
    const found = findFirstMockNode(item?.children);
    if (found) return found;
  }
  return null;
}

// Dynamic Extractor Helpers - Extract Notes, Quiz Subjects, and Mock Questions purely from Admin Nodes
function getNotesChaptersFromAdmin(nodes: any[]): Chapter[] {
  const chapters: Chapter[] = [];
  
  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const kind = String(item.kind || item.type || '').toLowerCase();
      const target = String(item.view || item.target_view || '').toLowerCase();
      const contentStr = typeof item.notesContent === 'string' ? item.notesContent : (typeof item.content === 'string' ? item.content : '');
      const isHtml = contentStr.includes('<html') || contentStr.includes('<!DOCTYPE') || contentStr.includes('<script');
      
      const hasChapters = Array.isArray(item.chapters) && item.chapters.length > 0;
      const isNotesType = kind === 'notes' || kind === 'pdf' || kind === 'note' || target.includes('note') || target.includes('pdf');
      
      if (hasChapters) {
        for (const ch of item.chapters) {
          chapters.push({
            id: String(ch.id || `chap-${Math.random()}`),
            title: String(ch.title || 'Untitled Note'),
            titleEn: String(ch.titleEn || ch.title || 'Untitled Note'),
            subtitle: String(ch.subtitle || 'Admin Notes'),
            subtitleEn: String(ch.subtitleEn || ch.subtitle || 'Admin Notes'),
            content: String(ch.content || '')
          });
        }
      } else if ((isNotesType || (contentStr && !isHtml)) && contentStr.trim().length > 0) {
        chapters.push({
          id: String(item.id || `chap-${Math.random()}`),
          title: String(item.title || item.name || 'Untitled Note'),
          titleEn: String(item.titleEn || item.title || item.name || 'Untitled Note'),
          subtitle: String(item.subtitle || item.sub || 'Admin Notes'),
          subtitleEn: String(item.subtitleEn || item.subtitle || item.sub || 'Admin Notes'),
          content: contentStr
        });
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return chapters;
}

function getQuizSubjectsFromAdmin(nodes: any[]): any[] {
  const subjects: any[] = [];
  
  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const questions = (Array.isArray(item.questions) && item.questions.length > 0 ? item.questions : null) ||
        (Array.isArray(item.mcqs) && item.mcqs.length > 0 ? item.mcqs : null) ||
        (Array.isArray(item.quiz) && item.quiz.length > 0 ? item.quiz : null);
      
      if (questions && questions.length > 0) {
        const validQs = questions.filter((q: any) => {
          const t = String(q.question || q.qText || q.title || '');
          return t && !t.includes('document.') && !t.includes('var ') && !t.includes('STORE_KEY') && !t.includes('moodmoji') && !t.includes('BATCH=') && !t.includes('elementById');
        });

        if (validQs.length > 0) {
          const normalizedQs: QuizQuestion[] = validQs.map((q: any, i: number) => ({
            id: q.id || i + 1,
            question: q.question || q.qText || q.title || 'Question',
            questionEn: q.questionEn || q.question_en || q.question || 'Question',
            options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
            correct: resolveCorrectIndex(q),
            category: q.section || q.subject || q.category || undefined,
            explanation: q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।',
            explanationEn: q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.'
          }));

          subjects.push({
            id: item.id,
            title: item.title || item.name || 'Quiz',
            titleEn: item.titleEn || item.title_en || item.title || item.name || 'Quiz',
            subtitle: item.subtitle || item.sub || 'Practice MCQs',
            subtitleEn: item.subtitleEn || item.subtitle_en || 'Practice MCQs',
            icon: item.icon || '📝',
            questions: normalizedQs
          });
        }
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return subjects;
}

function getMockQuestionsFromAdmin(nodes: any[]): QuizQuestion[] {
  let mockQs: QuizQuestion[] = [];
  
  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const kind = String(item.kind || item.type || '').toLowerCase();
      const target = String(item.view || item.target_view || '').toLowerCase();
      const questions = (Array.isArray(item.questions) && item.questions.length > 0 ? item.questions : null) ||
        (Array.isArray(item.mcqs) && item.mcqs.length > 0 ? item.mcqs : null);
      
      if ((kind === 'mock' || target.includes('mock')) && questions) {
        const validQs = questions.filter((q: any) => {
          const t = String(q.question || q.qText || q.title || '');
          return t && !t.includes('document.') && !t.includes('var ') && !t.includes('STORE_KEY') && !t.includes('moodmoji') && !t.includes('BATCH=') && !t.includes('elementById');
        });

        if (validQs.length > 0) {
          const normalizedQs: QuizQuestion[] = validQs.map((q: any, i: number) => ({
            id: q.id || i + 1,
            question: q.question || q.qText || q.title || 'Question',
            questionEn: q.questionEn || q.question_en || q.question || 'Question',
            options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
            optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
            correct: resolveCorrectIndex(q),
            category: q.section || q.subject || q.category || undefined,
            explanation: q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।',
            explanationEn: q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.'
          }));
          mockQs = mockQs.concat(normalizedQs);
        }
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(nodes);
  return mockQs;
}

// Helper to calculate greatest common divisor
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// Comprehensive Math Subjects List for Speed Calculation
export const ALL_MATH_TOPICS: string[] = [
  'मिश्रित (सभी विषय)',
  'जोड़ (Addition)',
  'घटाव (Subtraction)',
  'गुणा (Multiplication)',
  'भाग (Division)',
  'जोड़ व घटाव (Add & Subtract)',
  'गुणा व भाग (Multiply & Divide)',
  'सरलीकरण (BODMAS)',
  'प्रतिशत (Percentage)',
  'वर्ग व वर्गमूल (Squares & Roots)',
  'घन व घनमूल (Cubes & Roots)',
  'भिन्न व दशमलव (Fractions & Decimals)',
  'औसत (Average)',
  'अनुपात व समानुपात (Ratio & Proportion)',
  'साधारण ब्याज (Simple Interest)',
  'लाभ व हानि (Profit & Loss)',
  'समय व कार्य (Time & Work)',
  'समय, चाल व दूरी (Time & Distance)'
];

// 100% Mathematically Proven Unlimited Question Generator Across All Topics
// Generates unique, non-repeating questions with genuine formulas, zero errors, and authentic Vedic/mental math shortcuts
function generateUnlimitedMathQuestion(
  topic: string,
  indexSeed: number,
  difficulty: 'सरल' | 'मध्यम' | 'कठिन' | 'प्रो' = 'मध्यम',
  seenSignatures?: Set<string>
): QuizQuestion {
  const baseTopics = ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित'));

  let attempts = 0;
  let finalQ: QuizQuestion | null = null;

  while (attempts < 60) {
    attempts++;
    let chosenTopic = topic;
    if (topic.includes('मिश्रित')) {
      chosenTopic = baseTopics[Math.floor(Math.random() * baseTopics.length)];
    }

    let qText = '';
    let qTextEn = '';
    let ansStr = '';
    let explanation = '';
    let explanationEn = '';
    let shortcut = '';
    let distractors: string[] = [];

    // 1. जोड़ (Addition)
    if (chosenTopic.includes('जोड़ (Addition)')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // Multi-term addition
        const count = difficulty === 'सरल' ? 2 : difficulty === 'मध्यम' ? 3 : 4;
        const nums = Array.from({ length: count }, () => Math.floor(Math.random() * (difficulty === 'प्रो' ? 4500 : 850)) + 45);
        const ans = nums.reduce((a, b) => a + b, 0);
        qText = `योग ज्ञात कीजिए: ${nums.join(' + ')} = ?`;
        qTextEn = `Calculate the sum: ${nums.join(' + ')} = ?`;
        ansStr = `${ans}`;
        explanation = `सभी पदों का योग:\n${nums.join(' + ')} = ${ans}।`;
        explanationEn = `Sum of all terms: ${nums.join(' + ')} = ${ans}.`;
        shortcut = `इकाई और दहाई अंकों को समूह बनाकर तेजी से जोड़ें = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      } else if (typeVar === 1) {
        // Missing term addition: A + X + B = C
        const a = Math.floor(Math.random() * 450) + 50;
        const b = Math.floor(Math.random() * 350) + 50;
        const x = Math.floor(Math.random() * 500) + 100;
        const c = a + b + x;
        qText = `समीकरण में अज्ञात संख्या 'X' का मान क्या होगा: ${a} + X + ${b} = ${c}?`;
        qTextEn = `Find the missing number 'X' in: ${a} + X + ${b} = ${c}?`;
        ansStr = `${x}`;
        explanation = `X = ${c} - (${a} + ${b}) = ${c} - ${a + b} = ${x}।`;
        explanationEn = `X = ${c} - (${a} + ${b}) = ${x}.`;
        shortcut = `कुल योग में से ज्ञात संख्याओं का योग घटाएं: ${c} - ${a + b} = ${x}`;
        distractors = [`${x + 10}`, `${Math.max(1, x - 10)}`, `${x + 25}`, `${Math.max(1, x - 25)}`];
      } else if (typeVar === 2) {
        // Sum of first N natural numbers
        const n = Math.floor(Math.random() * 40) + 10;
        const ans = (n * (n + 1)) / 2;
        qText = `प्रथम ${n} प्राकृत संख्याओं का योग (1 + 2 + 3 + ... + ${n}) कितना होगा?`;
        qTextEn = `What is the sum of first ${n} natural numbers (1 + 2 + 3 + ... + ${n})?`;
        ansStr = `${ans}`;
        explanation = `प्राकृत संख्याओं का योग सूत्र: S = [N × (N + 1)] ÷ 2\nS = [${n} × ${n + 1}] ÷ 2 = ${n * (n + 1)} ÷ 2 = ${ans}।`;
        explanationEn = `Sum formula = [N * (N + 1)] / 2 = [${n} * ${n + 1}] / 2 = ${ans}.`;
        shortcut = `शॉर्टकट सूत्र: S = [${n} × ${n + 1}] ÷ 2 = ${ans}`;
        distractors = [`${ans + n}`, `${ans - n}`, `${ans + 10}`, `${Math.max(1, ans - 10)}`];
      } else if (typeVar === 3) {
        // Sum of first N odd or even numbers
        const isEven = Math.random() > 0.5;
        const n = Math.floor(Math.random() * 25) + 10;
        if (isEven) {
          const ans = n * (n + 1);
          qText = `प्रथम ${n} सम (Even) संख्याओं का योग (2 + 4 + 6 + ... + ${2 * n}) क्या होगा?`;
          qTextEn = `What is the sum of first ${n} even numbers (2 + 4 + 6 + ... + ${2 * n})?`;
          ansStr = `${ans}`;
          explanation = `प्रथम N सम संख्याओं का योग सूत्र: N × (N + 1)\nयोग = ${n} × ${n + 1} = ${ans}।`;
          explanationEn = `Sum of first N even numbers = N * (N + 1) = ${n} * ${n + 1} = ${ans}.`;
          shortcut = `सूत्र: ${n} × ${n + 1} = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${ans - 20}`];
        } else {
          const ans = n * n;
          qText = `प्रथम ${n} विषम (Odd) संख्याओं का योग (1 + 3 + 5 + ... + ${2 * n - 1}) क्या होगा?`;
          qTextEn = `What is the sum of first ${n} odd numbers (1 + 3 + 5 + ... + ${2 * n - 1})?`;
          ansStr = `${ans}`;
          explanation = `प्रथम N विषम संख्याओं का योग सूत्र: N²\nयोग = (${n})² = ${ans}।`;
          explanationEn = `Sum of first N odd numbers = N² = (${n})² = ${ans}.`;
          shortcut = `सूत्र: (${n})² = ${ans}`;
          distractors = [`${ans + n}`, `${ans - n}`, `${ans + 15}`, `${Math.max(1, ans - 15)}`];
        }
      } else if (typeVar === 4) {
        // Unit digit of sum
        const a = Math.floor(Math.random() * 800) + 123;
        const b = Math.floor(Math.random() * 800) + 145;
        const c = Math.floor(Math.random() * 800) + 167;
        const d = Math.floor(Math.random() * 800) + 189;
        const unitAns = (a % 10 + b % 10 + c % 10 + d % 10) % 10;
        qText = `व्यंजक (${a} + ${b} + ${c} + ${d}) का इकाई अंक (Unit Digit) क्या होगा?`;
        qTextEn = `What is the unit digit of (${a} + ${b} + ${c} + ${d})?`;
        ansStr = `${unitAns}`;
        explanation = `केवल इकाई अंकों को जोड़ें:\n${a % 10} + ${b % 10} + ${c % 10} + ${d % 10} = ${a % 10 + b % 10 + c % 10 + d % 10}।\nइकाई का अंक = ${unitAns}।`;
        explanationEn = `Add only the unit digits: ${a % 10} + ${b % 10} + ${c % 10} + ${d % 10} = ${unitAns}.`;
        shortcut = `इकाई अंक की ट्रिक: अंतिम अंकों का योग mod 10 = ${unitAns}`;
        distractors = [`${(unitAns + 1) % 10}`, `${(unitAns + 2) % 10}`, `${(unitAns + 3) % 10}`, `${(unitAns + 5) % 10}`];
      } else {
        // Decimal addition
        const a = (Math.floor(Math.random() * 850) + 100) / 10;
        const b = (Math.floor(Math.random() * 650) + 50) / 10;
        const c = (Math.floor(Math.random() * 450) + 20) / 10;
        const ans = Math.round((a + b + c) * 10) / 10;
        qText = `दशमलव जोड़: ${a} + ${b} + ${c} = ?`;
        qTextEn = `Decimal sum: ${a} + ${b} + ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `दशमलव बिंदुओं को सीध में रखकर जोड़ें:\n${a} + ${b} + ${c} = ${ans}।`;
        explanationEn = `Align decimal points and add: ${a} + ${b} + ${c} = ${ans}.`;
        shortcut = `दशमलव बिंदु सीधे जोड़ें = ${ans}`;
        distractors = [`${Math.round((ans + 1.2) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 1.2) * 10) / 10}`, `${Math.round((ans + 2.5) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 2.5) * 10) / 10}`];
      }
    }
    // 2. घटाव (Subtraction)
    else if (chosenTopic.includes('घटाव (Subtraction)')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Base method subtract (1000, 10000, 100000)
        const base = [1000, 10000, 100000][Math.floor(Math.random() * 3)];
        const b = Math.floor(Math.random() * (base * 0.8)) + Math.floor(base * 0.1);
        const ans = base - b;
        qText = `आधार विधि से घटाव हल करें: ${base} - ${b} = ?`;
        qTextEn = `Base subtraction: ${base} - ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `${base} में से ${b} घटाया:\n${base} - ${b} = ${ans}।`;
        explanationEn = `Subtract from base ${base}: ${base} - ${b} = ${ans}.`;
        shortcut = `वैदिक सूत्र (निखिलं नवतश्चरमं दशतः): सभी अंकों को 9 से तथा अंतिम अंक को 10 से घटाएं = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 100}`, `${Math.max(1, ans - 100)}`];
      } else if (typeVar === 1) {
        // Missing term subtraction: A - X = B or X - A = B
        const isUnknownFirst = Math.random() > 0.5;
        if (isUnknownFirst) {
          const a = Math.floor(Math.random() * 400) + 150;
          const b = Math.floor(Math.random() * 600) + 200;
          const x = a + b;
          qText = `समीकरण में 'X' का मान बताइए: X - ${a} = ${b}`;
          qTextEn = `Solve for 'X' in equation: X - ${a} = ${b}`;
          ansStr = `${x}`;
          explanation = `X = ${b} + ${a} = ${x}।`;
          explanationEn = `X = ${b} + ${a} = ${x}.`;
          shortcut = `पक्षांतरण नियम: X = ${b} + ${a} = ${x}`;
          distractors = [`${x + 20}`, `${x - 20}`, `${x + 50}`, `${Math.max(1, x - 50)}`];
        } else {
          const a = Math.floor(Math.random() * 1200) + 500;
          const b = Math.floor(Math.random() * 400) + 100;
          const x = a - b;
          qText = `समीकरण में 'X' का मान बताइए: ${a} - X = ${b}`;
          qTextEn = `Solve for 'X' in equation: ${a} - X = ${b}`;
          ansStr = `${x}`;
          explanation = `X = ${a} - ${b} = ${x}।`;
          explanationEn = `X = ${a} - ${b} = ${x}.`;
          shortcut = `X = ${a} - ${b} = ${x}`;
          distractors = [`${x + 20}`, `${x - 20}`, `${x + 40}`, `${Math.max(1, x - 40)}`];
        }
      } else if (typeVar === 2) {
        // Difference of squares formula: A² - B² = (A-B)(A+B)
        const a = Math.floor(Math.random() * 60) + 40;
        const b = a - (Math.floor(Math.random() * 10) + 1); // small gap
        const ans = a * a - b * b;
        qText = `बीजगणितीय सूत्र (A² - B²) का प्रयोग कर मान निकालें: (${a})² - (${b})² = ?`;
        qTextEn = `Evaluate using (A² - B²) formula: (${a})² - (${b})² = ?`;
        ansStr = `${ans}`;
        explanation = `सूत्र: A² - B² = (A - B) × (A + B)\n= (${a} - ${b}) × (${a} + ${b}) = ${a - b} × ${a + b} = ${ans}।`;
        explanationEn = `Formula A² - B² = (A - B) * (A + B) = (${a - b}) * (${a + b}) = ${ans}.`;
        shortcut = `(${a} - ${b}) × (${a} + ${b}) = ${a - b} × ${a + b} = ${ans}`;
        distractors = [`${ans + 20}`, `${ans - 20}`, `${ans + 100}`, `${Math.max(1, ans - 100)}`];
      } else if (typeVar === 3) {
        // Decimal subtraction
        const a = (Math.floor(Math.random() * 15000) + 2000) / 10;
        const b = (Math.floor(Math.random() * (a * 10 - 500)) + 100) / 10;
        const ans = Math.round((a - b) * 10) / 10;
        qText = `दशमलव घटाव: ${a} - ${b} = ?`;
        qTextEn = `Decimal subtraction: ${a} - ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `दशमलव बिंदु सीध में रखकर घटाएं:\n${a} - ${b} = ${ans}।`;
        explanationEn = `Align decimal points and subtract: ${a} - ${b} = ${ans}.`;
        shortcut = `${a} - ${b} = ${ans}`;
        distractors = [`${Math.round((ans + 1.5) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 1.5) * 10) / 10}`, `${Math.round((ans + 3) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 3) * 10) / 10}`];
      } else {
        // Reversed 2-digit number difference: AB - BA
        const d1 = Math.floor(Math.random() * 7) + 3;
        const d2 = d1 - (Math.floor(Math.random() * 2) + 1);
        const num1 = d1 * 10 + d2;
        const num2 = d2 * 10 + d1;
        const ans = num1 - num2;
        qText = `वैदिक ट्रिक से हल करें: ${num1} - ${num2} = ?`;
        qTextEn = `Solve using Vedic trick: ${num1} - ${num2} = ?`;
        ansStr = `${ans}`;
        explanation = `दो अंकों की संख्या और उसके अंकों को पलटने पर अंतर की शॉर्टकट ट्रिक:\nअंतर = 9 × (अंकों का अंतर) = 9 × (${d1} - ${d2}) = 9 × ${d1 - d2} = ${ans}।`;
        explanationEn = `Difference = 9 * (Difference of digits) = 9 * (${d1} - ${d2}) = ${ans}.`;
        shortcut = `वैदिक जादू: 9 × (${d1} - ${d2}) = ${ans}`;
        distractors = [`${ans + 9}`, `${Math.max(1, ans - 9)}`, `${ans + 18}`, `${Math.max(1, ans - 18)}`];
      }
    }
    // 3. गुणा (Multiplication)
    else if (chosenTopic.includes('गुणा (Multiplication)')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // Vedic Trick multipliers (11, 25, 99, 101, 125, 15)
        const tricks = [11, 25, 99, 101, 15, 125];
        const m = tricks[Math.floor(Math.random() * tricks.length)];
        let num = Math.floor(Math.random() * 80) + 12;
        if (m === 25 || m === 125) {
          num = (Math.floor(Math.random() * 20) + 3) * 4; // divisible by 4 for exact trick
        }
        const ans = num * m;
        qText = `वैदिक गुणा ट्रिक से उत्तर निकालें: ${num} × ${m} = ?`;
        qTextEn = `Solve using speed multiplication: ${num} × ${m} = ?`;
        ansStr = `${ans}`;
        explanation = m === 11
          ? `${num} × 11 ट्रिक: इकाई और दहाई अंक के बीच उनका योग रखें = ${ans}।`
          : m === 25
          ? `${num} × 25 ट्रिक: (${num} ÷ 4) × 100 = ${num / 4} × 100 = ${ans}।`
          : m === 99
          ? `${num} × 99 ट्रिक: ${num} × (100 - 1) = ${num * 100} - ${num} = ${ans}।`
          : m === 101
          ? `${num} × 101 ट्रिक: दो अंकों की संख्या को दोहराएं = ${ans}।`
          : `${num} × ${m} = ${ans}।`;
        explanationEn = `${num} * ${m} = ${ans}.`;
        shortcut = `स्पीड मैथ वैदिक शॉर्टकट = ${ans}`;
        distractors = [`${ans + m}`, `${ans - m}`, `${ans + m * 2}`, `${Math.max(1, ans - m * 2)}`];
      } else if (typeVar === 1) {
        // Base 100 multiplication (e.g. 98 x 97 or 103 x 106)
        const isAbove = Math.random() > 0.5;
        if (isAbove) {
          const d1 = Math.floor(Math.random() * 8) + 2; // 102 to 109
          const d2 = Math.floor(Math.random() * 8) + 2;
          const a = 100 + d1;
          const b = 100 + d2;
          const ans = a * b;
          qText = `100 के आधार (Base 100) वैदिक सूत्र से हल करें: ${a} × ${b} = ?`;
          qTextEn = `Solve using Base 100 Vedic formula: ${a} × ${b} = ?`;
          ansStr = `${ans}`;
          explanation = `Base 100 ट्रिक (+${d1}, +${d2}):\nबाएं भाग: 100 + ${d1} + ${d2} = ${100 + d1 + d2}\nदाएं भाग: ${d1} × ${d2} = ${d1 * d2 < 10 ? '0' + (d1 * d2) : d1 * d2}\nकुल मान = ${ans}।`;
          explanationEn = `Base 100 trick: (${100 + d1 + d2})|(${d1 * d2}) = ${ans}.`;
          shortcut = `वैदिक आधार सूत्र: (${100 + d1 + d2})|(${d1 * d2}) = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 100}`, `${ans - 100}`];
        } else {
          const d1 = Math.floor(Math.random() * 8) + 2; // 92 to 98
          const d2 = Math.floor(Math.random() * 8) + 2;
          const a = 100 - d1;
          const b = 100 - d2;
          const ans = a * b;
          qText = `100 के आधार (Base 100) वैदिक सूत्र से हल करें: ${a} × ${b} = ?`;
          qTextEn = `Solve using Base 100 Vedic formula: ${a} × ${b} = ?`;
          ansStr = `${ans}`;
          explanation = `Base 100 ट्रिक (-${d1}, -${d2}):\nबाएं भाग: 100 - ${d1} - ${d2} = ${100 - d1 - d2}\nदाएं भाग: (-${d1}) × (-${d2}) = ${d1 * d2 < 10 ? '0' + (d1 * d2) : d1 * d2}\nकुल मान = ${ans}।`;
          explanationEn = `Base 100 trick: (${100 - d1 - d2})|(${d1 * d2}) = ${ans}.`;
          shortcut = `वैदिक आधार सूत्र: (${100 - d1 - d2})|(${d1 * d2}) = ${ans}`;
          distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 100}`, `${ans - 100}`];
        }
      } else if (typeVar === 2) {
        // Ending in 5 multiplication (e.g. 35 x 35 or 85 x 85)
        const tens = Math.floor(Math.random() * 11) + 2; // 25 to 125
        const num = tens * 10 + 5;
        const ans = num * num;
        qText = `5 पर समाप्त होने वाली संख्या का वर्ग: (${num})² = ${num} × ${num} = ?`;
        qTextEn = `Square of number ending in 5: (${num})² = ?`;
        ansStr = `${ans}`;
        explanation = `इकाई अंक 5 वाले वर्ग की ट्रिक (एकाधिकेन पूर्वेण):\nप्रथम भाग = दहाई × (दहाई + 1) = ${tens} × ${tens + 1} = ${tens * (tens + 1)}\nअंतिम भाग = 25\nकुल मान = ${ans}।`;
        explanationEn = `Square of ending 5 trick: ${tens} * (${tens} + 1) = ${tens * (tens + 1)} concatenated with 25 = ${ans}.`;
        shortcut = `${tens} × ${tens + 1} = ${tens * (tens + 1)} फिर 25 चिपकाएं = ${ans}`;
        distractors = [`${ans + 100}`, `${ans - 100}`, `${ans + 200}`, `${Math.max(1, ans - 200)}`];
      } else if (typeVar === 3) {
        // Unit digit of multiplication product
        const a = Math.floor(Math.random() * 80) + 12;
        const b = Math.floor(Math.random() * 80) + 13;
        const c = Math.floor(Math.random() * 80) + 14;
        const d = Math.floor(Math.random() * 80) + 17;
        const unitAns = (a % 10 * b % 10 * c % 10 * d % 10) % 10;
        qText = `गुणनफल (${a} × ${b} × ${c} × ${d}) का इकाई का अंक (Unit Digit) क्या होगा?`;
        qTextEn = `Find the unit digit of product (${a} × ${b} × ${c} × ${d})?`;
        ansStr = `${unitAns}`;
        explanation = `केवल इकाई अंकों की गुणा करें:\n${a % 10} × ${b % 10} × ${c % 10} × ${d % 10} mod 10 = ${unitAns}।`;
        explanationEn = `Multiply only unit digits: ${a % 10} * ${b % 10} * ${c % 10} * ${d % 10} mod 10 = ${unitAns}.`;
        shortcut = `इकाई अंकों का गुणनफल mod 10 = ${unitAns}`;
        distractors = [`${(unitAns + 1) % 10}`, `${(unitAns + 2) % 10}`, `${(unitAns + 4) % 10}`, `${(unitAns + 5) % 10}`];
      } else if (typeVar === 4) {
        // Missing multiplier: A x X = B
        const a = Math.floor(Math.random() * 45) + 12;
        const x = Math.floor(Math.random() * 60) + 15;
        const b = a * x;
        qText = `समीकरण में अज्ञात संख्या 'X' ज्ञात कीजिए: ${a} × X = ${b}`;
        qTextEn = `Solve for missing multiplier 'X': ${a} × X = ${b}`;
        ansStr = `${x}`;
        explanation = `X = ${b} ÷ ${a} = ${x}।`;
        explanationEn = `X = ${b} / ${a} = ${x}.`;
        shortcut = `X = ${b} ÷ ${a} = ${x}`;
        distractors = [`${x + 2}`, `${Math.max(1, x - 2)}`, `${x + 5}`, `${Math.max(1, x - 5)}`];
      } else {
        // Decimal multiplication
        const a = (Math.floor(Math.random() * 80) + 12) / 100; // e.g. 0.25
        const b = (Math.floor(Math.random() * 40) + 10) / 10;  // e.g. 1.2
        const ans = Math.round(a * b * 1000) / 1000;
        qText = `दशमलव गुणनफल ज्ञात कीजिए: ${a} × ${b} = ?`;
        qTextEn = `Calculate decimal product: ${a} × ${b} = ?`;
        ansStr = `${ans}`;
        explanation = `दशमलव स्थान गिनकर गुणा करें:\n${a} × ${b} = ${ans}।`;
        explanationEn = `Count total decimal places and multiply: ${a} * ${b} = ${ans}.`;
        shortcut = `दशमलव स्थान का योग = ${ans}`;
        distractors = [`${Math.round((ans + 0.05) * 1000) / 1000}`, `${Math.round(Math.max(0.001, ans - 0.05) * 1000) / 1000}`, `${Math.round((ans + 0.1) * 1000) / 1000}`, `${Math.round(Math.max(0.001, ans - 0.1) * 1000) / 1000}`];
      }
    }
    // 4. भाग (Division)
    else if (chosenTopic.includes('भाग (Division)')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Standard clean integer division
        const divisors = difficulty === 'सरल' ? [4, 5, 6, 8, 9, 12, 15] : [16, 18, 24, 25, 36, 45, 48, 72];
        const div = divisors[Math.floor(Math.random() * divisors.length)];
        const quotient = Math.floor(Math.random() * 80) + 15;
        const dividend = div * quotient;
        qText = `भाग दीजिए: ${dividend} ÷ ${div} = ?`;
        qTextEn = `Divide: ${dividend} ÷ ${div} = ?`;
        ansStr = `${quotient}`;
        explanation = `भागफल = ${dividend} ÷ ${div} = ${quotient}।`;
        explanationEn = `Quotient = ${dividend} / ${div} = ${quotient}.`;
        shortcut = `उभयनिष्ठ गुणनखंड काटकर हल करें = ${quotient}`;
        distractors = [`${quotient + 2}`, `${Math.max(1, quotient - 2)}`, `${quotient + 5}`, `${Math.max(1, quotient - 5)}`];
      } else if (typeVar === 1) {
        // Divisibility rule test
        const testDiv = [9, 11, 4, 8, 3][Math.floor(Math.random() * 5)];
        if (testDiv === 9) {
          const base3 = Math.floor(Math.random() * 700) + 100; // e.g. 451
          const dSum = String(base3).split('').reduce((s, d) => s + Number(d), 0);
          const reqDigit = (9 - (dSum % 9)) % 9;
          const numStr = `${base3}${reqDigit}`;
          qText = `यदि संख्या ${base3}X, 9 से पूर्णतः विभाजित (Divisible) होती है, तो स्थान 'X' पर कौनसा अंक आएगा?`;
          qTextEn = `If number ${base3}X is completely divisible by 9, what is the value of digit 'X'?`;
          ansStr = `${reqDigit}`;
          explanation = `9 की विभाज्यता का नियम: सभी अंकों का योग 9 से विभाजित होना चाहिए।\nअंकों का योग = ${dSum} + X\nX = ${reqDigit} रखने पर योग 9 का गुणज बनता है।`;
          explanationEn = `Divisibility rule of 9: Sum of digits must be divisible by 9. X = ${reqDigit}.`;
          shortcut = `अंकों का योग 9 का गुणज बनाएं: X = ${reqDigit}`;
          distractors = [`${(reqDigit + 1) % 9}`, `${(reqDigit + 2) % 9}`, `${(reqDigit + 4) % 9}`, `${(reqDigit + 5) % 9}`];
        } else {
          const divBase = 11;
          const k = Math.floor(Math.random() * 50) + 15;
          const targetNum = k * 11;
          qText = `क्या संख्या ${targetNum}, 11 से पूर्णतः विभाजित है? विभाजित करने पर भागफल क्या होगा: ${targetNum} ÷ 11 = ?`;
          qTextEn = `What is the quotient when ${targetNum} is divided by 11: ${targetNum} ÷ 11 = ?`;
          ansStr = `${k}`;
          explanation = `${targetNum} ÷ 11 = ${k}।`;
          explanationEn = `${targetNum} / 11 = ${k}.`;
          shortcut = `11 का विभाज्यता नियम = ${k}`;
          distractors = [`${k + 2}`, `${Math.max(1, k - 2)}`, `${k + 5}`, `${Math.max(1, k - 5)}`];
        }
      } else if (typeVar === 2) {
        // Missing divisor: A ÷ X = B
        const x = Math.floor(Math.random() * 35) + 12;
        const b = Math.floor(Math.random() * 45) + 15;
        const a = x * b;
        qText = `समीकरण में भाजक 'X' का मान ज्ञात कीजिए: ${a} ÷ X = ${b}`;
        qTextEn = `Find divisor 'X' in equation: ${a} ÷ X = ${b}`;
        ansStr = `${x}`;
        explanation = `X = ${a} ÷ ${b} = ${x}।`;
        explanationEn = `X = ${a} / ${b} = ${x}.`;
        shortcut = `X = ${a} ÷ ${b} = ${x}`;
        distractors = [`${x + 2}`, `${Math.max(1, x - 2)}`, `${x + 4}`, `${Math.max(1, x - 4)}`];
      } else if (typeVar === 3) {
        // Remainder Theorem basic
        const div = Math.floor(Math.random() * 15) + 7;
        const q = Math.floor(Math.random() * 40) + 10;
        const rem = Math.floor(Math.random() * (div - 2)) + 1;
        const num = div * q + rem;
        qText = `शेषफल ज्ञात कीजिए: जब ${num} को ${div} से भाग दिया जाता है, तो शेषफल (Remainder) क्या बचेगा?`;
        qTextEn = `Find the remainder when ${num} is divided by ${div}?`;
        ansStr = `${rem}`;
        explanation = `भाज्य = (भाजक × भागफल) + शेषफल\n${num} = (${div} × ${q}) + ${rem}।\nशेषफल = ${rem}।`;
        explanationEn = `Dividend = (Divisor * Quotient) + Remainder. Remainder = ${rem}.`;
        shortcut = `${num} mod ${div} = ${rem}`;
        distractors = [`${(rem + 1) % div}`, `${(rem + 2) % div}`, `${(rem + 3) % div}`, `${(rem + 4) % div}`];
      } else {
        // Decimal division
        const div = [0.2, 0.4, 0.5, 0.05, 0.08, 0.12][Math.floor(Math.random() * 6)];
        const ans = Math.floor(Math.random() * 80) + 15;
        const dividend = Math.round(div * ans * 1000) / 1000;
        qText = `दशमलव भाग: ${dividend} ÷ ${div} = ?`;
        qTextEn = `Decimal division: ${dividend} ÷ ${div} = ?`;
        ansStr = `${ans}`;
        explanation = `अंश और हर दोनों को 100 या 1000 से गुणा करके दशमलव हटाएं:\n${dividend} ÷ ${div} = ${ans}।`;
        explanationEn = `Remove decimals and divide: ${dividend} / ${div} = ${ans}.`;
        shortcut = `दशमलव हटाकर सीधी विभाजन प्रक्रिया = ${ans}`;
        distractors = [`${ans + 5}`, `${Math.max(1, ans - 5)}`, `${ans * 10}`, `${Math.max(1, Math.round(ans / 10))}`];
      }
    }
    // 5. जोड़ व घटाव (Add & Subtract)
    else if (chosenTopic.includes('जोड़ व घटाव')) {
      const typeVar = Math.floor(Math.random() * 4);
      if (typeVar === 0) {
        // Multi-term Add & Subtract: A + B - C + D - E
        const a = Math.floor(Math.random() * 300) + 100;
        const b = Math.floor(Math.random() * 250) + 50;
        const c = Math.floor(Math.random() * 200) + 40;
        const d = Math.floor(Math.random() * 150) + 30;
        const ans = a + b - c + d;
        qText = `सरल कीजिए: ${a} + ${b} - ${c} + ${d} = ?`;
        qTextEn = `Simplify: ${a} + ${b} - ${c} + ${d} = ?`;
        ansStr = `${ans}`;
        explanation = `पहले सभी धनात्मक संख्याओं को जोड़ें -> (${a} + ${b} + ${d}) = ${a + b + d}।\nफिर ऋणात्मक संख्या घटाएं -> ${a + b + d} - ${c} = ${ans}।`;
        explanationEn = `Add positive numbers first (${a + b + d}), then subtract ${c} = ${ans}.`;
        shortcut = `धनात्मक योग - ऋणात्मक = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      } else if (typeVar === 1) {
        // Missing variable equation: A + X - B = C
        const a = Math.floor(Math.random() * 400) + 100;
        const b = Math.floor(Math.random() * 250) + 50;
        const c = Math.floor(Math.random() * 500) + 200;
        const x = c + b - a;
        qText = `समीकरण में 'X' का मान क्या होगा: ${a} + X - ${b} = ${c}`;
        qTextEn = `Solve for 'X' in equation: ${a} + X - ${b} = ${c}`;
        ansStr = `${x}`;
        explanation = `X = ${c} + ${b} - ${a} = ${c + b} - ${a} = ${x}।`;
        explanationEn = `X = ${c} + ${b} - ${a} = ${x}.`;
        shortcut = `X = ${c} + ${b} - ${a} = ${x}`;
        distractors = [`${x + 15}`, `${x - 15}`, `${x + 30}`, `${Math.max(1, x - 30)}`];
      } else if (typeVar === 2) {
        // Decimal multi-term
        const a = (Math.floor(Math.random() * 800) + 100) / 10;
        const b = (Math.floor(Math.random() * 500) + 50) / 10;
        const c = (Math.floor(Math.random() * 400) + 30) / 10;
        const ans = Math.round((a + b - c) * 10) / 10;
        qText = `दशमलव व्यंजक सरल करें: ${a} + ${b} - ${c} = ?`;
        qTextEn = `Simplify decimal expression: ${a} + ${b} - ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `चरण 1: ${a} + ${b} = ${Math.round((a + b) * 10) / 10}\nचरण 2: ${Math.round((a + b) * 10) / 10} - ${c} = ${ans}।`;
        explanationEn = `Step 1: ${a} + ${b} = ${a + b}. Step 2: Subtract ${c} = ${ans}.`;
        shortcut = `दशमलव योग व अंतर = ${ans}`;
        distractors = [`${Math.round((ans + 1.2) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 1.2) * 10) / 10}`, `${Math.round((ans + 2.5) * 10) / 10}`, `${Math.round(Math.max(0.1, ans - 2.5) * 10) / 10}`];
      } else {
        // Integer + Fraction mix
        const a = Math.floor(Math.random() * 10) + 3; // e.g. 5
        const num = Math.floor(Math.random() * 3) + 1; // 1 to 3
        const den = Math.floor(Math.random() * 4) + 4; // 4 to 7
        const ansNum = a * den - num;
        ansStr = `${ansNum}/${den}`;
        qText = `पूर्णांक व भिन्न का अंतर निकालें: ${a} - (${num}/${den}) = ?`;
        qTextEn = `Subtract fraction from integer: ${a} - (${num}/${den}) = ?`;
        explanation = `${a} - (${num}/${den}) = [(${a} × ${den}) - ${num}] ÷ ${den} = (${a * den} - ${num}) ÷ ${den} = ${ansNum}/${den}।`;
        explanationEn = `${a} - (${num}/${den}) = (${a * den} - ${num}) / ${den} = ${ansNum}/${den}.`;
        shortcut = `(${a * den} - ${num}) ÷ ${den} = ${ansNum}/${den}`;
        distractors = [`${ansNum + 1}/${den}`, `${Math.max(1, ansNum - 1)}/${den}`, `${ansNum + 2}/${den}`, `${Math.max(1, ansNum - 2)}/${den}`];
      }
    }
    // 6. गुणा व भाग (Multiply & Divide)
    else if (chosenTopic.includes('गुणा व भाग')) {
      const typeVar = Math.floor(Math.random() * 4);
      if (typeVar === 0) {
        // Combined product and division: (A x B) / C
        const c = [4, 6, 8, 12, 15, 18, 24][Math.floor(Math.random() * 7)];
        const k = Math.floor(Math.random() * 6) + 2;
        const a = c * k;
        const b = Math.floor(Math.random() * 20) + 5;
        const ans = k * b;
        qText = `मान ज्ञात कीजिए: (${a} × ${b}) ÷ ${c} = ?`;
        qTextEn = `Evaluate: (${a} × ${b}) ÷ ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `काटने की विधि: (${a} ÷ ${c}) × ${b} = ${k} × ${b} = ${ans}।`;
        explanationEn = `Cancel common factor: (${a} / ${c}) * ${b} = ${k} * ${b} = ${ans}.`;
        shortcut = `गुणा से पहले काटें: ${k} × ${b} = ${ans}`;
        distractors = [`${ans + b}`, `${Math.max(1, ans - b)}`, `${ans + 5}`, `${Math.max(1, ans - 5)}`];
      } else if (typeVar === 1) {
        // Continued fraction product division: (A x B) / (C x D)
        const c = Math.floor(Math.random() * 6) + 2;
        const d = Math.floor(Math.random() * 5) + 3;
        const k1 = Math.floor(Math.random() * 4) + 2;
        const k2 = Math.floor(Math.random() * 4) + 2;
        const a = c * k1;
        const b = d * k2;
        const ans = k1 * k2;
        qText = `अंश व हर काटकर मान निकालें: (${a} × ${b}) ÷ (${c} × ${d}) = ?`;
        qTextEn = `Evaluate by canceling common terms: (${a} × ${b}) ÷ (${c} × ${d}) = ?`;
        ansStr = `${ans}`;
        explanation = `(${a} ÷ ${c}) × (${b} ÷ ${d}) = ${k1} × ${k2} = ${ans}।`;
        explanationEn = `(${a} / ${c}) * (${b} / ${d}) = ${k1} * ${k2} = ${ans}.`;
        shortcut = `तिर्यक कटाई: ${k1} × ${k2} = ${ans}`;
        distractors = [`${ans + 2}`, `${Math.max(1, ans - 2)}`, `${ans + 4}`, `${Math.max(1, ans - 4)}`];
      } else if (typeVar === 2) {
        // Decimal product division
        const c = 0.05;
        const a = (Math.floor(Math.random() * 15) + 2) * 0.1; // e.g. 0.4
        const b = (Math.floor(Math.random() * 10) + 2) * 0.25; // e.g. 1.0
        const ans = Math.round((a * b) / c);
        qText = `दशमलव गुणा व भाग: (${a} × ${b}) ÷ ${c} = ?`;
        qTextEn = `Decimal multiply and divide: (${a} × ${b}) ÷ ${c} = ?`;
        ansStr = `${ans}`;
        explanation = `अंश = ${a} × ${b} = ${Math.round(a * b * 100) / 100}\nभाग = ${Math.round(a * b * 100) / 100} ÷ ${c} = ${ans}।`;
        explanationEn = `Numerator = ${a * b}. Division by ${c} = ${ans}.`;
        shortcut = `दशमलव संतुलन = ${ans}`;
        distractors = [`${ans + 10}`, `${Math.max(1, ans - 10)}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      } else {
        // Algebraic identity division: (A² - B²) / (A - B) = A + B
        const a = Math.floor(Math.random() * 70) + 30;
        const b = Math.floor(Math.random() * (a - 10)) + 5;
        const num = a * a - b * b;
        const den = a - b;
        const ans = a + b;
        qText = `बीजगणितीय सूत्र से मान निकालें: (${num}) ÷ (${den}) = ?`;
        qTextEn = `Evaluate using algebraic formula: (${num}) ÷ (${den}) = ?`;
        ansStr = `${ans}`;
        explanation = `नोट करें कि ${num} = (${a})² - (${b})² तथा ${den} = (${a} - ${b})।\nसूत्र: (A² - B²) ÷ (A - B) = (A + B) = ${a} + ${b} = ${ans}।`;
        explanationEn = `Formula: (A² - B²) / (A - B) = A + B = ${a} + ${b} = ${ans}.`;
        shortcut = `शॉर्टकट सूत्र: A + B = ${a} + ${b} = ${ans}`;
        distractors = [`${ans + 10}`, `${ans - 10}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      }
    }
    // 7. सरलीकरण (BODMAS / Simplification)
    else if (chosenTopic.includes('सरलीकरण')) {
      const typeVar = Math.floor(Math.random() * 7);
      if (typeVar === 0) {
        // SMP_01: BODMAS / VBODMAS Rule
        ansStr = `15`;
        qText = `सरल कीजिए: 18 - [6 - {4 - (8 - 6 + 3)}]`;
        qTextEn = `Solve: 18 - [6 - {4 - (8 - 6 + 3)}]`;
        explanation = `सबसे पहले छोटे कोष्ठक को हल करें: (8 - 6 + 3) = 5। फिर मजहला कोष्ठक: {4 - 5} = -1। बड़ा कोष्ठक: [6 - (-1)] = 7। अतः 18 - 7 = 15।`;
        explanationEn = `Step by step inner to outer brackets: inner = 5, middle = -1, outer = 7. Result = 18 - 7 = 15.`;
        shortcut = `कोष्ठक नियम (BODMAS): 18 - 7 = 15`;
        distractors = [`12`, `18`, `10`, `14`];
      } else if (typeVar === 1) {
        // SMP_02: Algebraic Identity Based
        ansStr = `1`;
        qText = `मान ज्ञात कीजिए: (0.73 × 0.73 × 0.73 + 0.27 × 0.27 × 0.27) ÷ (0.73 × 0.73 - 0.73 × 0.27 + 0.27 × 0.27)`;
        qTextEn = `Evaluate: (0.73 * 0.73 * 0.73 + 0.27 * 0.27 * 0.27) / (0.73 * 0.73 - 0.73 * 0.27 + 0.27 * 0.27)`;
        explanation = `सर्वसमिका: (a³ + b³) ÷ (a² - ab + b²) = (a + b) = 0.73 + 0.27 = 1.00।`;
        explanationEn = `Identity formula: (a³ + b³) / (a² - ab + b²) = a + b = 0.73 + 0.27 = 1.`;
        shortcut = `a + b = 0.73 + 0.27 = 1`;
        distractors = [`0.5`, `1.5`, `2`, `0`];
      } else if (typeVar === 2) {
        // SMP_03: Continued Fractions (Ladder Fractions)
        ansStr = `8/5`;
        qText = `सरल कीजिए: 1 + 1 / (1 + 1 / (1 + 1 / 2))`;
        qTextEn = `Simplify: 1 + 1 / (1 + 1 / (1 + 1 / 2))`;
        explanation = `नीचे से हल करें: 1 + 1/2 = 3/2 -> 1 + 2/3 = 5/3 -> 1 + 3/5 = 8/5।`;
        explanationEn = `Solving bottom-up: 3/2 -> 5/3 -> 8/5.`;
        shortcut = `नीचे से ऊपर हल करने पर = 8/5`;
        distractors = [`5/8`, `3/5`, `13/8`, `7/5`];
      } else if (typeVar === 3) {
        // SMP_04: Surds & Indices Rationalization
        ansStr = `sqrt(3) - sqrt(2)`;
        qText = `हर का परिमेयकरण (Rationalization) करें: 1 / (√3 + √2)`;
        qTextEn = `Simplify by rationalization: 1 / (sqrt(3) + sqrt(2))`;
        explanation = `अंश व हर को (√3 - √2) से गुणा करने पर: (√3 - √2) ÷ (3 - 2) = √3 - √2।`;
        explanationEn = `Multiply numerator and denominator by (sqrt(3) - sqrt(2)) = sqrt(3) - sqrt(2).`;
        shortcut = `संयुग्मी (Conjugate) से गुणा = √3 - √2`;
        distractors = [`sqrt(3) + sqrt(2)`, `2 - sqrt(3)`, `sqrt(5)`, `1`];
      } else if (typeVar === 4) {
        // SMP_05: Telescoping Series
        ansStr = `99/100`;
        qText = `योग ज्ञात कीजिए: 1/(1×2) + 1/(2×3) + 1/(3×4) + ... + 1/(99×100)`;
        qTextEn = `Find the sum: 1/(1*2) + 1/(2*3) + 1/(3*4) + ... + 1/(99*100)`;
        explanation = `टेलीस्कोपिंग श्रेणी सूत्र: [1/प्रथम - 1/अंतिम] = [1/1 - 1/100] = 99/100।`;
        explanationEn = `Telescoping sum formula = 1 - (1/100) = 99/100.`;
        shortcut = `1 - (1 ÷ 100) = 99/100`;
        distractors = [`1/100`, `1`, `98/99`, `50/100`];
      } else if (typeVar === 5) {
        // SMP_06: Recurring Decimals (Bar Questions)
        ansStr = `4/11`;
        qText = `आवर्ती दशमलव 0.363636... (0.36 पर बार) को भिन्न (Fraction) रूप में बदलिए।`;
        qTextEn = `Convert 0.36 bar into fractional form.`;
        explanation = `0.36 बार = 36 ÷ 99 = 4/11 (9 से काटने पर)।`;
        explanationEn = `0.36 bar = 36 / 99 = 4/11.`;
        shortcut = `36 ÷ 99 = 4/11`;
        distractors = [`36/100`, `36/90`, `4/9`, `3/11`];
      } else {
        // SMP_07: Infinite Nested Roots Series
        ansStr = `4`;
        qText = `मान ज्ञात कीजिए: √(12 + √(12 + √(12 + ... अनंत तक)))`;
        qTextEn = `Find the value of sqrt(12 + sqrt(12 + sqrt(12 + ... inf)))`;
        explanation = `12 के ऐसे दो लगातार गुणनखंड करें जिनका अंतर 1 हो: 3 × 4 = 12। चूँकि बीच में प्लस (+) है, बड़ा गुणनखंड 4 उत्तर होगा।`;
        explanationEn = `Consecutive factors of 12 are 3 and 4. Since it's plus, answer is 4.`;
        shortcut = `12 के गुणनखंड 3 और 4 -> उत्तर = 4`;
        distractors = [`3`, `6`, `12`, `2`];
      }
    }
    // 8. भिन्न व दशमलव (Fractions & Decimals)
    else if (chosenTopic.includes('भिन्न व दशमलव')) {
      const typeVar = Math.floor(Math.random() * 5);
      if (typeVar === 0) {
        // Sum of fractions
        const denoms = [2, 3, 4, 5, 6, 8, 10, 12];
        const d1 = denoms[Math.floor(Math.random() * denoms.length)];
        let d2 = denoms[Math.floor(Math.random() * denoms.length)];
        while (d2 === d1) {
          d2 = denoms[Math.floor(Math.random() * denoms.length)];
        }
        const n1 = Math.floor(Math.random() * (d1 - 1)) + 1;
        const n2 = Math.floor(Math.random() * (d2 - 1)) + 1;

        const commonLcm = (d1 * d2) / gcd(d1, d2);
        const numSum = n1 * (commonLcm / d1) + n2 * (commonLcm / d2);
        const finalGcd = gcd(numSum, commonLcm);
        const simpNum = numSum / finalGcd;
        const simpDen = commonLcm / finalGcd;

        ansStr = simpDen === 1 ? `${simpNum}` : `${simpNum}/${simpDen}`;
        qText = `भिन्नों का योग ज्ञात कीजिए: (${n1}/${d1}) + (${n2}/${d2}) = ?`;
        qTextEn = `Sum of fractions: (${n1}/${d1}) + (${n2}/${d2}) = ?`;
        explanation = `ल.स.प. (LCM) ऑफ (${d1}, ${d2}) = ${commonLcm}।\nयोग = [(${n1} × ${commonLcm / d1}) + (${n2} × ${commonLcm / d2})] ÷ ${commonLcm} = ${numSum}/${commonLcm} = ${ansStr}।`;
        explanationEn = `LCM = ${commonLcm}. Sum = ${ansStr}.`;
        shortcut = `तिर्यक गुणा (Cross multiply): (${n1}×${d2} + ${n2}×${d1}) ÷ (${d1}×${d2}) = ${ansStr}`;
        distractors = [`${simpNum + 1}/${simpDen}`, `${Math.max(1, simpNum - 1)}/${simpDen}`, `${simpNum + 2}/${simpDen}`, `${simpNum}/${simpDen + 1}`];
      } else if (typeVar === 1) {
        // Division of fractions: (n1/d1) ÷ (n2/d2)
        const n1 = Math.floor(Math.random() * 5) + 2;
        const d1 = Math.floor(Math.random() * 5) + 3;
        const n2 = Math.floor(Math.random() * 5) + 2;
        const d2 = Math.floor(Math.random() * 5) + 3;

        const prodNum = n1 * d2;
        const prodDen = d1 * n2;
        const g = gcd(prodNum, prodDen);
        const simpNum = prodNum / g;
        const simpDen = prodDen / g;

        ansStr = simpDen === 1 ? `${simpNum}` : `${simpNum}/${simpDen}`;
        qText = `भिन्नों का भागफल हल करें: (${n1}/${d1}) ÷ (${n2}/${d2}) = ?`;
        qTextEn = `Division of fractions: (${n1}/${d1}) ÷ (${n2}/${d2}) = ?`;
        explanation = `द्वितीय भिन्न को पलटकर गुणा करें:\n(${n1}/${d1}) × (${d2}/${n2}) = ${n1 * d2}/${d1 * n2} = ${ansStr}।`;
        explanationEn = `Invert second fraction and multiply: (${n1} * ${d2}) / (${d1} * ${n2}) = ${ansStr}.`;
        shortcut = `उल्टा करके गुणा करें = ${ansStr}`;
        distractors = [`${simpNum + 1}/${simpDen}`, `${Math.max(1, simpNum - 1)}/${simpDen}`, `${simpNum}/${simpDen + 1}`, `${simpNum + 2}/${simpDen}`];
      } else if (typeVar === 2) {
        // Recurring decimal to fraction
        const recs = [
          { dec: '0.666...', num: 2, den: 3 },
          { dec: '0.333...', num: 1, den: 3 },
          { dec: '0.2727...', num: 3, den: 11 },
          { dec: '0.3636...', num: 4, den: 11 },
          { dec: '0.1818...', num: 2, den: 11 },
          { dec: '0.142857...', num: 1, den: 7 },
          { dec: '0.444...', num: 4, den: 9 }
        ];
        const chosen = recs[Math.floor(Math.random() * recs.length)];
        ansStr = `${chosen.num}/${chosen.den}`;
        qText = `आवर्ती दशमलव (Recurring Decimal) को साधारण भिन्न में बदलें: ${chosen.dec} = ?`;
        qTextEn = `Convert recurring decimal to fraction: ${chosen.dec} = ?`;
        explanation = `आवर्ती दशमलव सूत्र:\n0.X̅ = X/9, 0.XY̅ = XY/99।\nअतः ${chosen.dec} = ${chosen.num}/${chosen.den}।`;
        explanationEn = `Recurring decimal rule: ${chosen.dec} = ${chosen.num}/${chosen.den}.`;
        shortcut = `वैदिक भिन्न रूपांतरण = ${ansStr}`;
        distractors = [`${chosen.num + 1}/${chosen.den}`, `${chosen.num}/${chosen.den + 1}`, `${chosen.num + 2}/${chosen.den}`, `${Math.max(1, chosen.num - 1)}/${chosen.den}`];
      } else if (typeVar === 3) {
        // Mixed fraction arithmetic: A(b/c) + X(y/z)
        const a = Math.floor(Math.random() * 4) + 1;
        const b = Math.floor(Math.random() * 4) + 2;
        const c = 1; // 1/2
        const d = 2;
        const x = Math.floor(Math.random() * 4) + 1;
        const y = 1; // 1/4
        const z = 4;
        const totalInt = a + x;
        const fracSumNum = 2 + 1; // 1/2 + 1/4 = 3/4
        ansStr = `${totalInt} (3/4)`;
        qText = `मिश्रित भिन्न का योग: ${a}½ + ${x}¼ = ?`;
        qTextEn = `Sum of mixed fractions: ${a}½ + ${x}¼ = ?`;
        explanation = `पूर्णांकों का योग = ${a} + ${x} = ${totalInt}।\nभिन्नों का योग = (1/2) + (1/4) = 3/4।\nकुल योग = ${totalInt} (3/4) = ${(totalInt * 4 + 3)}/4।`;
        explanationEn = `Integer sum = ${totalInt}. Fraction sum = 3/4. Total = ${ansStr}.`;
        shortcut = `पूर्णांक व भिन्न अलग-अलग जोड़ें = ${ansStr}`;
        distractors = [`${totalInt} (1/4)`, `${totalInt + 1} (1/4)`, `${totalInt} (1/2)`, `${totalInt + 1} (1/2)`];
      } else {
        // Decimal place value conversion
        const decimals = [
          { dec: '0.125', num: 1, den: 8 },
          { dec: '0.375', num: 3, den: 8 },
          { dec: '0.625', num: 5, den: 8 },
          { dec: '0.875', num: 7, den: 8 },
          { dec: '0.04', num: 1, den: 25 },
          { dec: '0.16', num: 4, den: 25 }
        ];
        const chosen = decimals[Math.floor(Math.random() * decimals.length)];
        ansStr = `${chosen.num}/${chosen.den}`;
        qText = `दशमलव संख्या ${chosen.dec} का सरलतम भिन्न रूप (Simplest Fraction) क्या होगा?`;
        qTextEn = `Simplest fraction form of decimal ${chosen.dec}?`;
        explanation = `${chosen.dec} = ${chosen.num}/${chosen.den}।`;
        explanationEn = `Decimal ${chosen.dec} = ${chosen.num}/${chosen.den}.`;
        shortcut = `स्थान मान काटकर सरल करें = ${ansStr}`;
        distractors = [`${chosen.num + 1}/${chosen.den}`, `${chosen.num}/${chosen.den + 2}`, `${chosen.num + 2}/${chosen.den}`, `${Math.max(1, chosen.num - 1)}/${chosen.den}`];
      }
    }
    // 9. प्रतिशत (Percentage)
    else if (chosenTopic.includes('प्रतिशत') || chosenTopic.toLowerCase().includes('percent')) {
      const typeVar = Math.floor(Math.random() * 13);
      if (typeVar === 0) {
        // 1. Basic Value & Conversion
        const percentages = [10, 15, 20, 25, 30, 40, 50, 60, 75];
        const p = percentages[Math.floor(Math.random() * percentages.length)];
        const mult = Math.floor(Math.random() * 20) + 5;
        const base = mult * 50; // e.g. 450
        const ans = (p * base) / 100;
        qText = `मान ज्ञात कीजिए: ₹${base} का ${p}% कितना होगा?`;
        qTextEn = `Find ${p}% of ₹${base}.`;
        ansStr = `₹${ans}`;
        explanation = `प्रतिशत की बुनियादी गणना:\nमान = (मूल मान × प्रतिशत) ÷ 100 = (${base} × ${p}) ÷ 100 = ₹${ans}।`;
        explanationEn = `Value = (${base} * ${p}) / 100 = ₹${ans}.`;
        shortcut = `10% = ₹${base / 10} -> ${p}% = ₹${ans}`;
        distractors = [`₹${ans + 20}`, `₹${Math.max(10, ans - 20)}`, `₹${ans + 40}`, `₹${Math.max(10, ans - 40)}`];
      } else if (typeVar === 1) {
        // 2. A is X% More / Less than B
        const isMore = Math.random() > 0.5;
        if (isMore) {
          const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)]; // e.g. 25
          const ans = Math.round((p / (100 + p)) * 100 * 100) / 100; // e.g. 20%
          const ansDisplay = Number.isInteger(ans) ? `${ans}%` : `${ans.toFixed(2)}%`;
          qText = `यदि A का वेतन B के वेतन से ${p}% अधिक है, तो B का वेतन A के वेतन से कितना प्रतिशत कम होगा?`;
          qTextEn = `If A's salary is ${p}% more than B's, by what percent is B's salary less than A's?`;
          ansStr = ansDisplay;
          explanation = `प्रतिशत कमी का सूत्र: [X ÷ (100 + X)] × 100%\n= [${p} ÷ (100 + ${p})] × 100% = [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}।`;
          explanationEn = `Percent less = [X / (100 + X)] * 100% = ${ansDisplay}.`;
          shortcut = `सूत्र: [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}`;
          distractors = [`${p}%`, `${Math.round(ans + 5)}%`, `${Math.max(1, Math.round(ans - 5))}%`, `${p + 5}%`];
        } else {
          const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)]; // e.g. 20
          const ans = Math.round((p / (100 - p)) * 100 * 100) / 100; // e.g. 25%
          const ansDisplay = Number.isInteger(ans) ? `${ans}%` : `${ans.toFixed(2)}%`;
          qText = `यदि A का वेतन B के वेतन से ${p}% कम है, तो B का वेतन A के वेतन से कितना प्रतिशत अधिक होगा?`;
          qTextEn = `If A's salary is ${p}% less than B's, by what percent is B's salary more than A's?`;
          ansStr = ansDisplay;
          explanation = `प्रतिशत वृद्धि का सूत्र: [X ÷ (100 - X)] × 100%\n= [${p} ÷ (100 - ${p})] × 100% = [${p} ÷ ${100 - p}] × 100% = ${ansDisplay}।`;
          explanationEn = `Percent more = [X / (100 - X)] * 100% = ${ansDisplay}.`;
          shortcut = `सूत्र: [${p} ÷ ${100 - p}] × 100% = ${ansDisplay}`;
          distractors = [`${p}%`, `${Math.round(ans + 5)}%`, `${Math.max(1, Math.round(ans - 5))}%`, `${p + 10}%`];
        }
      } else if (typeVar === 2) {
        // 3. Consumption & Expenditure Balance
        const p = [10, 20, 25, 50][Math.floor(Math.random() * 4)]; // e.g. 20
        const ans = Math.round((p / (100 + p)) * 100 * 100) / 100; // e.g. 16.66% or 16.67%
        const ansDisplay = Number.isInteger(ans) ? `${ans}%` : `${ans.toFixed(2)}%`;
        qText = `चीनी के मूल्य में ${p}% की वृद्धि हो जाती है। खपत में कितने प्रतिशत की कमी की जाए ताकि कुल खर्च अपरिवर्तित (Constant) रहे?`;
        qTextEn = `The price of sugar rises by ${p}%. By what percent should consumption be reduced so expenditure remains constant?`;
        ansStr = ansDisplay;
        explanation = `खपत में प्रतिशत कमी = [मूल्य वृद्धि % ÷ (100 + मूल्य वृद्धि %)] × 100%\n= [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}।`;
        explanationEn = `Consumption reduction % = [P / (100 + P)] * 100% = ${ansDisplay}.`;
        shortcut = `सूत्र: [${p} ÷ ${100 + p}] × 100% = ${ansDisplay}`;
        distractors = [`${p}%`, `${Math.round(ans + 3)}%`, `${Math.max(1, Math.round(ans - 3))}%`, `${p + 5}%`];
      } else if (typeVar === 3) {
        // 4. Price Change with Extra Quantity
        const p = 20; // 20% drop
        const money = 100; // ₹100
        const extraKg = 2; // 2 kg extra
        const reducedPrice = (money * (p / 100)) / extraKg; // ₹10/kg
        qText = `सेब के मूल्य में ${p}% की कमी होने से एक व्यक्ति ₹${money} में ${extraKg} किग्रा अधिक सेब खरीद पाता है। सेब का घटा हुआ मूल्य (Reduced Price) प्रति किग्रा क्या है?`;
        qTextEn = `A ${p}% drop in apple prices allows a person to buy ${extraKg} kg more for ₹${money}. Find the reduced price per kg.`;
        ansStr = `₹${reducedPrice}/किग्रा`;
        explanation = `बचत राशि = ₹${money} का ${p}% = ₹${(money * p) / 100}।\nघटा हुआ मूल्य (Reduced Price) = बचा हुआ रुपया ÷ अतिरिक्त मात्रा = ₹${(money * p) / 100} ÷ ${extraKg} = ₹${reducedPrice}/किग्रा।`;
        explanationEn = `Savings = ₹${(money * p) / 100}. Reduced price = ₹${(money * p) / 100} / ${extraKg} = ₹${reducedPrice}/kg.`;
        shortcut = `शॉर्टकट सूत्र: (M × P%) ÷ K = (100 × 20%) ÷ 2 = ₹${reducedPrice}/किग्रा`;
        distractors = [`₹${reducedPrice + 2.5}/किग्रा`, `₹${Math.max(1, reducedPrice - 2)}/किग्रा`, `₹${reducedPrice + 5}/किग्रा`, `₹${reducedPrice * 2}/किग्रा`];
      } else if (typeVar === 4) {
        // 5. Successive Percentage Change
        const a = 20; // +20%
        const b = -10; // -10%
        const netChange = a + b + (a * b) / 100; // +8%
        const signStr = netChange >= 0 ? `+${netChange}%` : `${netChange}%`;
        qText = `एक संख्या में पहले ${a}% की वृद्धि की जाती है और फिर ${Math.abs(b)}% की कमी की जाती है। संख्या में शुद्ध प्रतिशत परिवर्तन (Net Change) कितना होगा?`;
        qTextEn = `A number is first increased by ${a}% and then decreased by ${Math.abs(b)}%. Find the net percentage change.`;
        ansStr = `${signStr}`;
        explanation = `सक्सेसिव फॉर्मूला: A + B + (A × B) ÷ 100\n= ${a} + (${b}) + (${a} × ${b}) ÷ 100 = 10 - 2 = +8% (8% की वृद्धि)।`;
        explanationEn = `Net change = A + B + (A * B) / 100 = 20 - 10 - 2 = +8%.`;
        shortcut = `सूत्र: ${a} - ${Math.abs(b)} - ${(a * Math.abs(b)) / 100} = +8%`;
        distractors = [`+10%`, `-8%`, `+12%`, `0%`];
      } else if (typeVar === 5) {
        // 6. 2D / 3D Geometry Dimensions
        const l = 10; // +10%
        const b = 20; // +20%
        const areaChange = l + b + (l * b) / 100; // +32%
        qText = `यदि एक आयत (Rectangle) की लंबाई में ${l}% की वृद्धि तथा चौड़ाई में ${b}% की वृद्धि कर दी जाए, तो इसके क्षेत्रफल (Area) में कितने प्रतिशत का परिवर्तन होगा?`;
        qTextEn = `If the length of a rectangle increases by ${l}% and breadth increases by ${b}%, find the percent change in area.`;
        ansStr = `+${areaChange}%`;
        explanation = `क्षेत्रफल में प्रभावी परिवर्तन = L + B + (L × B) ÷ 100\n= ${l} + ${b} + (${l} × ${b}) ÷ 100 = 30 + 2 = +32% (32% की वृद्धि)।`;
        explanationEn = `Area change % = L + B + (L * B) / 100 = 10 + 20 + 2 = +32%.`;
        shortcut = `${l} + ${b} + ${(l * b) / 100} = +32%`;
        distractors = [`+30%`, `+28%`, `+35%`, `+25%`];
      } else if (typeVar === 6) {
        // 7. Exam Marks (Pass / Fail)
        const p1 = 30; // 30%
        const m1 = 15; // fails by 15
        const p2 = 40; // 40%
        const m2 = 35; // passes by 35
        const maxMarks = Math.round(((m1 + m2) / (p2 - p1)) * 100); // 500
        qText = `एक परीक्षा में छात्र A को ${p1}% अंक मिले और वह ${m1} अंकों से अनुत्तीर्ण (Fail) हो गया। छात्र B को ${p2}% अंक मिले जो उत्तीर्ण अंकों से ${m2} अधिक थे। परीक्षा के अधिकतम अंक (Maximum Marks) क्या हैं?`;
        qTextEn = `A student gets ${p1}% marks and fails by ${m1} marks. Another gets ${p2}% marks and gets ${m2} marks more than pass marks. Find maximum marks.`;
        ansStr = `${maxMarks}`;
        explanation = `प्रतिशत का अंतर = ${p2}% - ${p1}% = ${p2 - p1}%\nअंकों का अंतर = ${m1} + ${m2} = ${m1 + m2} अंक।\n100% (अधिकतम अंक) = [(${m1 + m2}) ÷ (${p2 - p1})] × 100 = (${m1 + m2} ÷ ${p2 - p1}) × 100 = ${maxMarks} अंक।`;
        explanationEn = `Diff in % = ${p2 - p1}%. Diff in marks = ${m1 + m2}. Max marks = (${m1 + m2} / ${p2 - p1}) * 100 = ${maxMarks}.`;
        shortcut = `[(${m1} + ${m2}) ÷ (${p2} - ${p1})] × 100 = ${maxMarks}`;
        distractors = [`${maxMarks + 100}`, `${Math.max(100, maxMarks - 100)}`, `${maxMarks + 50}`, `${Math.max(100, maxMarks - 50)}`];
      } else if (typeVar === 7) {
        // 8. Election & Vote Share
        const w = 60; // 60%
        const marginVotes = 1200;
        const totalVotes = Math.round((marginVotes / (2 * w - 100)) * 100); // 6000
        qText = `दो उम्मीदवारों वाले एक चुनाव में, जीतने वाले उम्मीदवार को ${w}% वैध मत मिले और वह ${marginVotes} मतों के बहुमत से जीत गया। चुनाव में डाले गए कुल मतों (Total Votes) की संख्या क्या थी?`;
        qTextEn = `In a two-candidate election, the winner got ${w}% of votes and won by ${marginVotes} votes. Find total votes.`;
        ansStr = `${totalVotes}`;
        explanation = `विजेता = ${w}%, हारने वाला = ${100 - w}%\nजीत का अंतर % = ${w}% - ${100 - w}% = ${2 * w - 100}%\n${2 * w - 100}% = ${marginVotes} वोट -> 100% = (${marginVotes} ÷ ${2 * w - 100}) × 100 = ${totalVotes} वोट।`;
        explanationEn = `Margin % = ${w - (100 - w)}% = ${2 * w - 100}%. Total votes = (${marginVotes} / ${2 * w - 100}) * 100 = ${totalVotes}.`;
        shortcut = `[${marginVotes} ÷ (${w} - ${100 - w})] × 100 = ${totalVotes}`;
        distractors = [`${totalVotes + 1000}`, `${Math.max(500, totalVotes - 1000)}`, `${totalVotes + 2000}`, `${Math.max(500, totalVotes - 2000)}`];
      } else if (typeVar === 8) {
        // 9. Income & Expenditure (Direct vs Remaining)
        const rentP = 20; // 20% on rent
        const foodPOfRem = 50; // 50% of remainder on food
        const savings = 2400; // ₹2,400
        // Remainder after rent = 80%. Food = 50% of 80% = 40%. Remaining = 40%.
        const totalIncome = Math.round(savings / (((100 - rentP) * (100 - foodPOfRem)) / 10000)); // ₹6,000
        qText = `एक व्यक्ति अपनी आय का ${rentP}% मकान के किराए पर खर्च करता है और शेष (Remainder) का ${foodPOfRem}% भोजन पर खर्च करता है। यदि वह ₹${savings} की बचत करता है, तो उसकी कुल आय (Total Income) कितनी है?`;
        qTextEn = `A person spends ${rentP}% on rent and ${foodPOfRem}% of the remainder on food. If he saves ₹${savings}, find his total income.`;
        ansStr = `₹${totalIncome}`;
        explanation = `किराए के बाद शेष = 100% - ${rentP}% = 80%\nभोजन के बाद अंतिम बचत % = 80% का (100% - ${foodPOfRem}%) = 80% का 50% = 40%\n40% = ₹${savings} -> 100% आय = (₹${savings} ÷ 40) × 100 = ₹${totalIncome}।`;
        explanationEn = `Remaining savings % = 80% * 50% = 40%. Total Income = (${savings} / 40) * 100 = ₹${totalIncome}.`;
        shortcut = `₹${savings} ÷ (0.8 × 0.5) = ₹${totalIncome}`;
        distractors = [`₹${totalIncome + 1000}`, `₹${Math.max(1000, totalIncome - 1000)}`, `₹${totalIncome + 2000}`, `₹${Math.max(1000, totalIncome - 2000)}`];
      } else if (typeVar === 9) {
        // 10. Population / Depreciation
        const p0 = 10000;
        const rate = 10;
        const years = 2;
        const pNew = Math.round(p0 * Math.pow(1 + rate / 100, years)); // 12,100
        qText = `एक कस्बे की वर्तमान जनसंख्या ${p0} है। यदि इसमें ${rate}% वार्षिक दर से वृद्धि होती है, तो ${years} वर्ष पश्चात कस्बे की जनसंख्या क्या होगी?`;
        qTextEn = `A town's population is ${p0} and grows at ${rate}% per year. What will it be after ${years} years?`;
        ansStr = `${pNew}`;
        explanation = `जनसंख्या सूत्र = P × (1 + R/100)ⁿ\n= ${p0} × (1.1)² = ${p0} × 1.21 = ${pNew}।`;
        explanationEn = `New Population = ${p0} * (1.1)² = ${pNew}.`;
        shortcut = `${p0} × 1.1 × 1.1 = ${pNew}`;
        distractors = [`${pNew + 500}`, `${Math.max(1000, pNew - 500)}`, `${p0 + p0 * 0.2}`, `${pNew + 1000}`];
      } else if (typeVar === 10) {
        // 11. Venn Diagram (Both Pass / Fail)
        const fHindi = 40; // 40% failed in Hindi
        const fEnglish = 30; // 30% failed in English
        const fBoth = 15; // 15% failed in both
        const passBoth = 100 - (fHindi + fEnglish - fBoth); // 45%
        qText = `एक परीक्षा में ${fHindi}% छात्र हिंदी में अनुत्तीर्ण (Fail) हुए, ${fEnglish}% छात्र अंग्रेजी में अनुत्तीर्ण हुए और ${fBoth}% छात्र दोनों विषयों में अनुत्तीर्ण हुए। दोनों विषयों में उत्तीर्ण (Pass) होने वाले छात्रों का प्रतिशत क्या है?`;
        qTextEn = `In an exam, ${fHindi}% failed in Hindi, ${fEnglish}% failed in English, and ${fBoth}% failed in both. Find the percentage of students who passed both.`;
        ansStr = `${passBoth}%`;
        explanation = `कम से कम एक विषय में अनुत्तीर्ण (Fail) छात्र = (${fHindi} + ${fEnglish} - ${fBoth})% = ${fHindi + fEnglish - fBoth}%\nदोनों विषयों में उत्तीर्ण छात्र = 100% - ${fHindi + fEnglish - fBoth}% = ${passBoth}%।`;
        explanationEn = `Total failed = ${fHindi} + ${fEnglish} - ${fBoth} = ${fHindi + fEnglish - fBoth}%. Passed both = 100 - ${fHindi + fEnglish - fBoth} = ${passBoth}%.`;
        shortcut = `100 - (${fHindi} + ${fEnglish} - ${fBoth}) = ${passBoth}%`;
        distractors = [`${passBoth + 10}%`, `${Math.max(1, passBoth - 10)}%`, `${passBoth + 5}%`, `${Math.max(1, passBoth - 5)}%`];
      } else if (typeVar === 11) {
        // 12. Constant Quantity (Fresh vs Dry Fruit)
        const freshWaterP = 80; // 80% water -> 20% pulp
        const dryWaterP = 20; // 20% water -> 80% pulp
        const freshKg = 100; // 100 kg fresh fruit
        const freshPulpKg = freshKg * ((100 - freshWaterP) / 100); // 20 kg
        const dryKg = Math.round(freshPulpKg / ((100 - dryWaterP) / 100)); // 25 kg
        qText = `ताजे फलों में ${freshWaterP}% पानी है और सूखे फलों में ${dryWaterP}% पानी है। ${freshKg} किग्रा ताजे फलों से कितना सूखा फल (Dry Fruit) प्राप्त किया जा सकता है?`;
        qTextEn = `Fresh fruit contains ${freshWaterP}% water and dry fruit contains ${dryWaterP}% water. How much dry fruit can be made from ${freshKg} kg fresh fruit?`;
        ansStr = `${dryKg} किग्रा`;
        explanation = `गुदा (Pulp) की मात्रा सदैव स्थिर रहती है:\nताजे फल में गुदा = ${freshKg} का (100 - ${freshWaterP})% = 20 किग्रा।\nसूखे फल में गुदा = ${100 - dryWaterP}%\n80% गुदा = 20 किग्रा -> सूखे फल का कुल वजन = (20 ÷ 80) × 100 = ${dryKg} किग्रा।`;
        explanationEn = `Pulp weight is constant = 20 kg. Dry fruit weight = 20 / 0.80 = ${dryKg} kg.`;
        shortcut = `(${freshKg} × 20%) ÷ 80% = ${dryKg} किग्रा`;
        distractors = [`${dryKg + 5} किग्रा`, `${Math.max(1, dryKg - 5)} किग्रा`, `${dryKg + 10} किग्रा`, `${Math.max(1, dryKg - 10)} किग्रा`];
      } else {
        // 13. Calculation Error
        const num1 = 3, den1 = 5; // wrong: 3/5
        const num2 = 5, den2 = 3; // correct: 5/3
        // Correct value = 25, Wrong value = 9, Error = 16, % Error = 16/25 * 100 = 64%
        const errP = 64;
        qText = `एक छात्र ने किसी संख्या को ${num2}/${den2} से गुणा करने के बजाय गलती से ${num1}/${den1} से गुणा कर दिया। गणना में हुई त्रुटि का प्रतिशत (Percentage Error) ज्ञात कीजिए?`;
        qTextEn = `A student multiplied a number by ${num1}/${den1} instead of ${num2}/${den2}. Find the percentage error.`;
        ansStr = `${errP}%`;
        explanation = `मान लीजिए संख्या = 3 और 5 का ल.स.प. = 15\nसही मान = 15 × (${num2}/${den2}) = 25\nगलत मान = 15 × (${num1}/${den1}) = 9\nत्रुटि = 25 - 9 = 16\nप्रतिशत त्रुटि = (16 ÷ 25) × 100 = 64%।`;
        explanationEn = `Correct = 25, Wrong = 9, Error = 16. % Error = (16 / 25) * 100 = 64%.`;
        shortcut = `[(25 - 9) ÷ 25] × 100 = 64%`;
        distractors = [`50%`, `45%`, `36%`, `60%`];
      }
    }
    // 10. वर्ग व वर्गमूल (Squares & Roots)
    else if (chosenTopic.includes('वर्ग व वर्गमूल') || chosenTopic.includes('वर्ग')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // Square Root of Perfect Squares
        const num = Math.floor(Math.random() * 75) + 25; // 25 to 99
        const sq = num * num;
        qText = `√${sq} का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact square root of √${sq}?`;
        ansStr = `${num}`;
        explanation = `क्योंकि (${num})² = ${sq}, अतः √${sq} = ${num}।`;
        explanationEn = `Since (${num})² = ${sq}, √${sq} = ${num}.`;
        shortcut = `इकाई अंक विधि: अंतिम अंकों से त्वरित पहचान -> √${sq} = ${num}`;
        distractors = [`${num + 2}`, `${num - 2}`, `${num + 4}`, `${Math.max(1, num - 4)}`];
      } else if (typeVar === 1) {
        // Direct Square
        const num = Math.floor(Math.random() * 60) + 15;
        const sq = num * num;
        qText = `(${num})² का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact value of (${num})²?`;
        ansStr = `${sq}`;
        explanation = `(${num})² = ${num} × ${num} = ${sq}।`;
        explanationEn = `(${num})² = ${num} * ${num} = ${sq}.`;
        shortcut = `द्वंद्व योग (Duplex) या आधार विधि से वर्ग = ${sq}`;
        distractors = [`${sq + 20}`, `${sq - 20}`, `${(num + 1) * (num + 1)}`, `${(num - 1) * (num - 1)}`];
      } else if (typeVar === 2) {
        // Square Root Equation: √X + A = B
        const ansX = Math.floor(Math.random() * 30) + 10;
        const sqX = ansX * ansX;
        const a = Math.floor(Math.random() * 30) + 10;
        const b = ansX + a;
        qText = `समीकरण में 'X' का मान ज्ञात कीजिए: √X + ${a} = ${b}`;
        qTextEn = `Solve for 'X' in equation: √X + ${a} = ${b}`;
        ansStr = `${sqX}`;
        explanation = `1. √X = ${b} - ${a} = ${ansX}\n2. दोनों तरफ वर्ग करने पर: X = (${ansX})² = ${sqX}।`;
        explanationEn = `√X = ${b} - ${a} = ${ansX}. Squaring both sides: X = (${ansX})² = ${sqX}.`;
        shortcut = `X = (${b} - ${a})² = (${ansX})² = ${sqX}`;
        distractors = [`${sqX + 25}`, `${Math.max(1, sqX - 25)}`, `${(ansX + 1) * (ansX + 1)}`, `${Math.max(1, (ansX - 1) * (ansX - 1))}`];
      } else if (typeVar === 3) {
        // Pythagorean Triplets: A² + B² = C²
        const triplets = [
          [3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17],
          [9, 12, 15], [12, 16, 20], [7, 24, 25], [20, 21, 29]
        ];
        const trip = triplets[Math.floor(Math.random() * triplets.length)];
        const k = Math.floor(Math.random() * 3) + 1;
        const a = trip[0] * k;
        const b = trip[1] * k;
        const c = trip[2] * k;
        qText = `पाइथागोरस प्रमेय: √( (${a})² + (${b})² ) का मान क्या होगा?`;
        qTextEn = `Pythagoras identity: √( (${a})² + (${b})² ) = ?`;
        ansStr = `${c}`;
        explanation = `(${a})² + (${b})² = ${a * a} + ${b * b} = ${c * c}।\n√(${c * c}) = ${c}।`;
        explanationEn = `√(${a * a} + ${b * b}) = √${c * c} = ${c}.`;
        shortcut = `पाइथागोरस त्रिक (Pythagorean Triplet) = ${c}`;
        distractors = [`${c + 2}`, `${Math.max(1, c - 2)}`, `${c + 5}`, `${Math.max(1, c - 5)}`];
      } else if (typeVar === 4) {
        // Algebraic Identity Square: (a + b)² - (a - b)² = 4ab
        const a = Math.floor(Math.random() * 80) + 20;
        const b = Math.floor(Math.random() * 50) + 10;
        const ans = 4 * a * b;
        qText = `बीजगणितीय सूत्र [(A + B)² - (A - B)²] का प्रयोग कर हल करें: (${a} + ${b})² - (${a} - ${b})² = ?`;
        qTextEn = `Evaluate using [(A + B)² - (A - B)² = 4AB]: (${a} + ${b})² - (${a} - ${b})² = ?`;
        ansStr = `${ans}`;
        explanation = `सूत्र: (A + B)² - (A - B)² = 4 × A × B\n= 4 × ${a} × ${b} = ${ans}।`;
        explanationEn = `Formula: (A + B)² - (A - B)² = 4 * A * B = 4 * ${a} * ${b} = ${ans}.`;
        shortcut = `4 × ${a} × ${b} = ${ans}`;
        distractors = [`${2 * a * b}`, `${ans + 100}`, `${Math.max(1, ans - 100)}`, `${ans + 200}`];
      } else {
        // Non-perfect square root approximation
        const nearBase = Math.floor(Math.random() * 12) + 6; // 6 to 17
        const approxNum = nearBase * nearBase + 2; // e.g. 51
        ansStr = `लगभग ${nearBase}`;
        qText = `√${approxNum} का निकटतम मान (Approximate Value) क्या होगा?`;
        qTextEn = `What is the approximate value of √${approxNum}?`;
        explanation = `क्योंकि (${nearBase})² = ${nearBase * nearBase}, अतः √${approxNum} का मान लगभग ${nearBase} के बराबर होगा।`;
        explanationEn = `Since (${nearBase})² = ${nearBase * nearBase}, √${approxNum} ≈ ${nearBase}.`;
        shortcut = `निकटतम पूर्ण वर्ग विधि से उत्तर = लगभग ${nearBase}`;
        distractors = [`लगभग ${nearBase + 2}`, `लगभग ${Math.max(1, nearBase - 2)}`, `लगभग ${nearBase + 3}`, `लगभग ${Math.max(1, nearBase - 3)}`];
      }
    }
    // 11. घन व घनमूल (Cubes & Roots)
    else if (chosenTopic.includes('घन व घनमूल') || chosenTopic.includes('घन')) {
      const typeVar = Math.floor(Math.random() * 4);
      if (typeVar === 0) {
        // Perfect Cube Root
        const num = Math.floor(Math.random() * 35) + 5; // 5 to 40
        const cube = num * num * num;
        qText = `∛${cube} (घनमूल) का मान क्या होगा?`;
        qTextEn = `What is the cube root ∛${cube}?`;
        ansStr = `${num}`;
        explanation = `क्योंकि (${num})³ = ${num} × ${num} × ${num} = ${cube}, अतः ∛${cube} = ${num}।`;
        explanationEn = `Since (${num})³ = ${cube}, ∛${cube} = ${num}.`;
        shortcut = `इकाई अंक मिलान वैदिक तकनीक = ${num}`;
        distractors = [`${num + 1}`, `${Math.max(1, num - 1)}`, `${num + 2}`, `${Math.max(1, num - 2)}`];
      } else if (typeVar === 1) {
        // Direct Cube
        const num = Math.floor(Math.random() * 20) + 5;
        const cube = num * num * num;
        qText = `(${num})³ का सटीक मान क्या होगा?`;
        qTextEn = `What is the exact value of (${num})³?`;
        ansStr = `${cube}`;
        explanation = `(${num})³ = ${num} × ${num} × ${num} = ${cube}।`;
        explanationEn = `(${num})³ = ${num} * ${num} * ${num} = ${cube}.`;
        shortcut = `${num} का घन = ${cube}`;
        distractors = [`${cube + 50}`, `${Math.max(1, cube - 50)}`, `${(num + 1) * (num + 1) * (num + 1)}`, `${Math.max(1, (num - 1) * (num - 1) * (num - 1))}`];
      } else if (typeVar === 2) {
        // Cube Root Equation: ∛X x A = B
        const xVal = Math.floor(Math.random() * 15) + 4;
        const cubeX = xVal * xVal * xVal;
        const a = Math.floor(Math.random() * 8) + 2;
        const b = xVal * a;
        qText = `समीकरण में 'X' का मान ज्ञात कीजिए: ∛X × ${a} = ${b}`;
        qTextEn = `Solve for 'X' in equation: ∛X × ${a} = ${b}`;
        ansStr = `${cubeX}`;
        explanation = `1. ∛X = ${b} ÷ ${a} = ${xVal}\n2. दोनों तरफ घन करने पर: X = (${xVal})³ = ${cubeX}।`;
        explanationEn = `∛X = ${b} / ${a} = ${xVal}. Cubing both sides: X = (${xVal})³ = ${cubeX}.`;
        shortcut = `X = (${b} ÷ ${a})³ = (${xVal})³ = ${cubeX}`;
        distractors = [`${cubeX + 50}`, `${Math.max(1, cubeX - 50)}`, `${(xVal + 1) * (xVal + 1) * (xVal + 1)}`, `${Math.max(1, (xVal - 1) * (xVal - 1) * (xVal - 1))}`];
      } else {
        // Difference of Cubes: A³ - B³
        const a = Math.floor(Math.random() * 10) + 5;
        const b = a - 1;
        const ans = a * a * a - b * b * b;
        qText = `घन अंतर ज्ञात कीजिए: (${a})³ - (${b})³ = ?`;
        qTextEn = `Difference of cubes: (${a})³ - (${b})³ = ?`;
        ansStr = `${ans}`;
        explanation = `(${a})³ = ${a * a * a}, (${b})³ = ${b * b * b}।\nअंतर = ${a * a * a} - ${b * b * b} = ${ans}।`;
        explanationEn = `(${a})³ - (${b})³ = ${a * a * a} - ${b * b * b} = ${ans}.`;
        shortcut = `क्रमागत घनों का अंतर: 1 + 3×${a}×${b} = ${ans}`;
        distractors = [`${ans + 10}`, `${Math.max(1, ans - 10)}`, `${ans + 20}`, `${Math.max(1, ans - 20)}`];
      }
    }
    // 12. औसत (Average)
    else if (chosenTopic.includes('औसत')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // AVG_01: Consecutive Numbers & Arithmetic Series
        const n = 25;
        const ans = 13;
        qText = `प्रथम ${n} लगातार प्राकृतिक संख्याओं का औसत क्या होगा?`;
        qTextEn = `Find the average of the first ${n} consecutive natural numbers.`;
        ansStr = `${ans}`;
        explanation = `प्रथम N प्राकृतिक संख्याओं का औसत = (N + 1) ÷ 2 = (25 + 1) ÷ 2 = 13।`;
        explanationEn = `Average of first N natural numbers = (N + 1) / 2 = 13.`;
        shortcut = `(25 + 1) ÷ 2 = 13`;
        distractors = [`${ans + 2}`, `${Math.max(1, ans - 2)}`, `${ans + 4}`, `${Math.max(1, ans - 4)}`];
      } else if (typeVar === 1) {
        // AVG_02: Entry or Exit of Member (Teacher's Age)
        const count = 24;
        const oldAvg = 15;
        const inc = 1;
        const teacherAge = count * inc + (oldAvg + inc); // 24*1 + 16 = 40
        qText = `${count} विद्यार्थियों की औसत आयु ${oldAvg} वर्ष है। यदि शिक्षक की आयु शामिल कर ली जाए, तो औसत 1 वर्ष बढ़ जाता है। शिक्षक की आयु ज्ञात कीजिए।`;
        qTextEn = `The average age of ${count} students is ${oldAvg} years. If the teacher's age is included, average increases by ${inc} year. Find teacher's age.`;
        ansStr = `${teacherAge} years`;
        explanation = `शिक्षक की आयु = नया औसत + विद्यार्थी संख्या × वृद्धि = 16 + (24 × 1) = 40 वर्ष।`;
        explanationEn = `Teacher age = New average + count * increase = 16 + 24 = 40 years.`;
        shortcut = `16 + 24 = 40 years`;
        distractors = [`${teacherAge + 5} years`, `${Math.max(10, teacherAge - 5)} years`, `${teacherAge + 10} years`, `${Math.max(10, teacherAge - 10)} years`];
      } else if (typeVar === 2) {
        // AVG_03: Replacement of Member
        const n = 8;
        const incAvg = 2.5;
        const oldWeight = 65;
        const newWeight = oldWeight + n * incAvg; // 65 + 8*2.5 = 85
        qText = `${n} व्यक्तियों का औसत वजन ${incAvg} किग्रा बढ़ जाता है जब ${oldWeight} किग्रा वाले एक व्यक्ति के स्थान पर नया व्यक्ति आता है। नए व्यक्ति का वजन ज्ञात कीजिए।`;
        qTextEn = `The average weight of ${n} persons increases by ${incAvg} kg when a person weighing ${oldWeight} kg is replaced by a new person. Find weight of new person.`;
        ansStr = `${newWeight} kg`;
        explanation = `नए व्यक्ति का वजन = पुराना वजन + (व्यक्ति संख्या × औसत वृद्धि) = 65 + (8 × 2.5) = 85 किग्रा।`;
        explanationEn = `New weight = Old weight + (n * increase) = 65 + 20 = 85 kg.`;
        shortcut = `65 + 20 = 85 kg`;
        distractors = [`${newWeight + 5} kg`, `${Math.max(10, newWeight - 5)} kg`, `${newWeight + 10} kg`, `${Math.max(10, newWeight - 10)} kg`];
      } else if (typeVar === 3) {
        // AVG_04: Wrong Entry / Error Correction
        const n = 50;
        const oldAvg = 68;
        const wrongVal = 84;
        const correctVal = 48;
        const diff = correctVal - wrongVal; // -36
        const correctAvg = Math.round((oldAvg + diff / n) * 100) / 100; // 67.28
        qText = `${n} विद्यार्थियों के औसत अंक ${oldAvg} निकाले गए। बाद में पता चला कि अंक ${wrongVal} को गलती से पढ़ लिया गया था, जबकि सही अंक ${correctVal} था। सही औसत ज्ञात कीजिए।`;
        qTextEn = `Average marks of ${n} students were ${oldAvg}. Later found that ${wrongVal} was misread instead of ${correctVal}. Find correct average.`;
        ansStr = `${correctAvg}`;
        explanation = `कुल योग में अंतर = ${correctVal} - ${wrongVal} = ${diff}\nऔसत में अंतर = ${diff} ÷ ${n} = ${diff / n}\nसही औसत = ${oldAvg} + (${diff / n}) = ${correctAvg}।`;
        explanationEn = `Correct avg = ${oldAvg} + (${correctVal} - ${wrongVal}) / ${n} = ${correctAvg}.`;
        shortcut = `${oldAvg} + (${diff} ÷ ${n}) = ${correctAvg}`;
        distractors = [`${correctAvg + 1}`, `${Math.max(1, correctAvg - 1)}`, `${correctAvg + 2}`, `${Math.max(1, correctAvg - 2)}`];
      } else if (typeVar === 4) {
        // AVG_05: Batting and Bowling Average
        const innings = 15;
        const oldAvg = 40;
        const score = 80;
        // new avg = (15*40 + 80) / 16 = 680 / 16 = 42.5
        const newAvg = (innings * oldAvg + score) / (innings + 1);
        qText = `एक बल्लेबाज का ${innings} पारियों में औसत ${oldAvg} रन है। 16वीं पारी में वह ${score} रन बनाता है। उसका नया बल्लेबाजी औसत क्या होगा?`;
        qTextEn = `A batsman has average of ${oldAvg} runs in ${innings} innings. He scores ${score} in 16th inning. New average?`;
        ansStr = `${newAvg}`;
        explanation = `कुल रन = ${innings} × ${oldAvg} + ${score} = ${innings * oldAvg + score}\nनया औसत = ${innings * oldAvg + score} ÷ 16 = ${newAvg}।`;
        explanationEn = `Total runs = ${innings * oldAvg + score}. New average = ${newAvg}.`;
        shortcut = `(${innings * oldAvg} + ${score}) ÷ 16 = ${newAvg}`;
        distractors = [`${newAvg + 3}`, `${Math.max(1, newAvg - 3)}`, `${newAvg + 5}`, `${Math.max(1, newAvg - 5)}`];
      } else {
        // AVG_06: Weighted Average (Two Mixed Groups)
        const n1 = 30;
        const a1 = 70;
        const n2 = 20;
        const a2 = 80;
        const combined = (n1 * a1 + n2 * a2) / (n1 + n2); // 74
        qText = `30 छात्रों की कक्षा A का औसत स्कोर ${a1} है, और 20 छात्रों की कक्षा B का औसत स्कोर ${a2} है। संयुक्त औसत स्कोर ज्ञात कीजिए।`;
        qTextEn = `Class A of ${n1} students has average ${a1}, Class B of ${n2} students has average ${a2}. Find combined average.`;
        ansStr = `${combined}`;
        explanation = `संयुक्त औसत = [(${n1} × ${a1}) + (${n2} × ${a2})] ÷ (${n1} + ${n2}) = [${n1 * a1} + ${n2 * a2}] ÷ 50 = ${combined}।`;
        explanationEn = `Combined average = [30*70 + 20*80] / 50 = ${combined}.`;
        shortcut = `[${n1 * a1} + ${n2 * a2}] ÷ 50 = ${combined}`;
        distractors = [`${combined + 4}`, `${Math.max(1, combined - 4)}`, `${combined + 8}`, `${Math.max(1, combined - 8)}`];
      }
    }
    // 13. अनुपात व समानुपात (Ratio & Proportion)
    else if (chosenTopic.includes('अनुपात व समानुपात')) {
      const typeVar = Math.floor(Math.random() * 7);
      if (typeVar === 0) {
        // RP_01: Merging Ratios (A:B and B:C to A:B:C)
        ansStr = `8:12:15`;
        qText = `यदि A : B = 2 : 3 तथा B : C = 4 : 5 है, तो अनुपात A : B : C ज्ञात कीजिए।`;
        qTextEn = `If A:B = 2:3 and B:C = 4:5, find ratio A:B:C.`;
        explanation = `B के मान को समान करने के लिए पहले अनुपात को 4 से तथा दूसरे को 3 से गुणा करें: A:B:C = 8:12:15।`;
        explanationEn = `Equate B: A:B:C = (2*4):(3*4):(3*5) = 8:12:15.`;
        shortcut = `(2×4) : (3×4) : (3×5) = 8:12:15`;
        distractors = [`2:3:5`, `8:10:15`, `6:12:15`, `8:12:20`];
      } else if (typeVar === 1) {
        // RP_02: Proportion Rules (Mean, Third & Fourth Proportion)
        const a = 9, b = 16;
        const meanProp = Math.round(Math.sqrt(a * b)); // 12
        ansStr = `${meanProp}`;
        qText = `${a} और ${b} का मध्यानुपाती (Mean Proportional) ज्ञात कीजिए।`;
        qTextEn = `Find the mean proportional between ${a} and ${b}.`;
        explanation = `मध्यानुपाती = √(a × b) = √(${a} × ${b}) = √144 = 12।`;
        explanationEn = `Mean proportional = √(9 * 16) = 12.`;
        shortcut = `√(9 × 16) = 12`;
        distractors = [`${meanProp + 3}`, `${Math.max(1, meanProp - 3)}`, `${meanProp + 6}`, `${Math.max(1, meanProp - 6)}`];
      } else if (typeVar === 2) {
        // RP_03: Distribution of Amount Among Shares
        const total = 1800;
        const r1 = 2, r2 = 3, r3 = 4;
        const sumR = r1 + r2 + r3;
        const bShare = (r2 * total) / sumR; // 600
        ansStr = `₹${bShare}`;
        qText = `₹${total} को A, B और C में 2 : 3 : 4 के अनुपात में बांटा गया। B का हिस्सा ज्ञात कीजिए।`;
        qTextEn = `Divide ₹${total} among A, B, and C in ratio 2:3:4. What is B's share?`;
        explanation = `B का हिस्सा = [3 ÷ (2 + 3 + 4)] × 1800 = [3 ÷ 9] × 1800 = ₹600।`;
        explanationEn = `B's share = (3 / 9) * 1800 = ₹600.`;
        shortcut = `(3 ÷ 9) × 1800 = ₹600`;
        distractors = [`₹${bShare + 100}`, `₹${Math.max(50, bShare - 100)}`, `₹${bShare + 200}`, `₹${Math.max(50, bShare - 200)}`];
      } else if (typeVar === 3) {
        // RP_04: Coins and Value Combinations
        const totalVal = 125;
        // ratios 3:4:5 for ₹1, 50p, 25p -> values 3*1 + 4*0.5 + 5*0.25 = 3 + 2 + 1.25 = 6.25
        // total units = 125 / 6.25 = 20
        // 50p coins = 4 * 20 = 80
        const coins50 = 80;
        ansStr = `${coins50}`;
        qText = `एक थैले में ₹1, 50 पैसे और 25 पैसे के सिक्के 3 : 4 : 5 के अनुपात में हैं, कुल मूल्य ₹${totalVal} है। 50 पैसे के सिक्कों की संख्या ज्ञात कीजिए।`;
        qTextEn = `A bag contains ₹1, 50p, and 25p coins in ratio 3:4:5, totalling ₹${totalVal}. Find number of 50p coins.`;
        explanation = `कुल मूल्य अनुपात = 3(1) + 4(0.5) + 5(0.25) = 6.25 यूनिट = ₹125 -> 1 यूनिट = 20। 50 पैसे के सिक्के = 4 × 20 = 80।`;
        explanationEn = `Value units = 6.25 = ₹125 -> 1 unit = 20. 50p coins = 4 * 20 = 80.`;
        shortcut = `125 ÷ 6.25 = 20 units -> 4 × 20 = 80`;
        distractors = [`${coins50 + 20}`, `${Math.max(10, coins50 - 20)}`, `${coins50 + 40}`, `${Math.max(10, coins50 - 40)}`];
      } else if (typeVar === 4) {
        // RP_05: Age Based Ratio Problems
        const ageA = 15;
        qText = `A और B की आयु का अनुपात 3 : 4 है। 5 वर्ष बाद यह अनुपात 4 : 5 हो जाता है। A की वर्तमान आयु ज्ञात कीजिए।`;
        qTextEn = `Ratio of ages of A and B is 3:4. After 5 years, ratio becomes 4:5. Find A's present age.`;
        ansStr = `${ageA} years`;
        explanation = `मान लीजिए आयु 3x और 4x है: (3x + 5)/(4x + 5) = 4/5 -> 15x + 25 = 16x + 20 -> x = 5। A की आयु = 3 × 5 = 15 वर्ष।`;
        explanationEn = `Solving (3x+5)/(4x+5) = 4/5 gives x = 5. A's age = 15 years.`;
        shortcut = `यूनिट अंतर विधि से x = 5 -> A = 15 years`;
        distractors = [`${ageA + 5} years`, `${Math.max(5, ageA - 5)} years`, `${ageA + 10} years`, `${Math.max(5, ageA - 10)} years`];
      } else if (typeVar === 5) {
        // RP_06: Income, Expenditure & Savings Ratio
        const incA = 4000;
        qText = `A और B की आय का अनुपात 5 : 4 है और उनके व्यय का अनुपात 3 : 2 है। यदि प्रत्येक ₹1600 बचाता है, तो A की आय ज्ञात कीजिए।`;
        qTextEn = `Income ratio of A and B is 5:4, expenditure ratio 3:2. Each saves ₹1600. Find A's income.`;
        ansStr = `₹${incA}`;
        explanation = `आय अनुपात अंतर = 5 - 3 = 2 यूनिट = बचत ₹1600 -> 1 यूनिट = ₹800। A की आय = 5 × 800 = ₹4000।`;
        explanationEn = `Income unit diff = 5 - 3 = 2 = ₹1600 -> 1 unit = ₹800. A's income = 5 * 800 = ₹4000.`;
        shortcut = `2 units = ₹1600 -> A's income = 5 × 800 = ₹4000`;
        distractors = [`₹${incA + 800}`, `₹${Math.max(1000, incA - 800)}`, `₹${incA + 1600}`, `₹${Math.max(1000, incA - 1600)}`];
      } else {
        // RP_07: Mixture Ratio & Replacement
        const ansLitres = 5;
        qText = `40 लीटर के मिश्रण में दूध और पानी का अनुपात 3 : 1 है। अनुपात 2 : 1 करने के लिए कितना पानी मिलाना चाहिए?`;
        qTextEn = `A 40-liter mixture contains milk and water in ratio 3:1. How much water must be added to make ratio 2:1?`;
        ansStr = `${ansLitres} liters`;
        explanation = `दूध = 30 लीटर, पानी = 10 लीटर। 30 ÷ (10 + x) = 2 ÷ 1 -> 30 = 20 + 2x -> 2x = 10 -> x = 5 लीटर।`;
        explanationEn = `Milk = 30L, Water = 10L. 30 / (10 + x) = 2/1 -> x = 5 liters.`;
        shortcut = `30 ÷ (10 + x) = 2/1 -> x = 5 liters`;
        distractors = [`${ansLitres + 3} liters`, `${Math.max(1, ansLitres - 3)} liters`, `${ansLitres + 6} liters`, `${Math.max(1, ansLitres - 6)} liters`];
      }
    }
    // 14. साधारण व चक्रवृद्धि ब्याज (Simple & Compound Interest)
    else if (chosenTopic.includes('साधारण ब्याज') || chosenTopic.includes('ब्याज')) {
      const typeVar = Math.floor(Math.random() * 6);
      if (typeVar === 0) {
        // SICI_01: Direct SI Evaluation
        const p = 5000, r = 8, t = 3;
        const si = (p * r * t) / 100; // 1200
        ansStr = `₹${si}`;
        qText = `₹${p} की राशि पर 8% वार्षिक दर से 3 वर्ष का साधारण ब्याज ज्ञात कीजिए।`;
        qTextEn = `Find simple interest on ₹${p} at ${r}% per annum for ${t} years.`;
        explanation = `SI = (P × R × T) ÷ 100 = (5000 × 8 × 3) ÷ 100 = ₹1200।`;
        explanationEn = `SI = (5000 * 8 * 3) / 100 = ₹1200.`;
        shortcut = `(5000 × 8 × 3) ÷ 100 = ₹1200`;
        distractors = [`₹${si + 200}`, `₹${Math.max(100, si - 200)}`, `₹${si + 400}`, `₹${Math.max(100, si - 400)}`];
      } else if (typeVar === 2) {
        // SICI_03: Direct CI Evaluation
        const p = 8000, r = 10, t = 2;
        const ci = Math.round(p * Math.pow(1 + r / 100, t) - p); // 1680
        ansStr = `₹${ci}`;
        qText = `₹${8000} पर 10% वार्षिक चक्रवृद्धि ब्याज की दर से 2 वर्ष का चक्रवृद्धि ब्याज (CI) ज्ञात कीजिए।`;
        qTextEn = `Find compound interest on ₹8000 at 10% per annum compounded annually for 2 years.`;
        explanation = `CI = P[(1 + r/100)ᵗ - 1] = 8000 × [(1.1)² - 1] = 8000 × 0.21 = ₹1680।`;
        explanationEn = `CI = 8000 * (1.21 - 1) = ₹1680.`;
        shortcut = `8000 × 0.21 = ₹1680`;
        distractors = [`₹${ci + 200}`, `₹${Math.max(100, ci - 200)}`, `₹${ci + 350}`, `₹${Math.max(100, ci - 350)}`];
      } else if (typeVar === 4) {
        // SICI_05: Difference Between CI and SI (2 Years)
        const p = 10000, r = 10, t = 2;
        const diff = Math.round((p * r * r) / 10000); // 100
        ansStr = `₹${diff}`;
        qText = `₹${p} पर 10% वार्षिक दर से 2 वर्ष के चक्रवृद्धि ब्याज और साधारण ब्याज का अंतर ज्ञात कीजिए।`;
        qTextEn = `Difference between CI and SI on ₹${p} at ${r}% per annum for ${t} years?`;
        explanation = `अंतर (2 वर्ष) = P × (R ÷ 100)² = 10000 × (10 ÷ 100)² = ₹100।`;
        explanationEn = `Diff = P * (R/100)² = 10000 * (0.1)² = ₹100.`;
        shortcut = `10000 × 0.01 = ₹100`;
        distractors = [`₹${diff + 50}`, `₹${Math.max(10, diff - 50)}`, `₹${diff + 150}`, `₹${Math.max(10, diff - 150)}`];
      } else if (typeVar === 1) {
        // SICI_02: Sum Becoming N Times under SI
        const t1 = 5, n1 = 2, n2 = 4;
        const t2 = t1 * ((n2 - 1) / (n1 - 1)); // 15
        ansStr = `${t2} years`;
        qText = `एक धनराशि साधारण ब्याज पर 5 वर्ष में दोगुनी हो जाती है। कितने वर्षों में यह 4 गुना हो जाएगी?`;
        qTextEn = `A sum of money doubles in 5 years at SI. In how many years will it become 4 times?`;
        ansStr = `15 years`;
        explanation = `समय सूत्र: T2 = T1 × [(n2 - 1) ÷ (n1 - 1)] = 5 × [(4 - 1) ÷ (2 - 1)] = 15 वर्ष।`;
        explanationEn = `T2 = 5 * (3 / 1) = 15 years.`;
        shortcut = `5 × (3 ÷ 1) = 15 years`;
        distractors = [`20 years`, `10 years`, `25 years`, `12 years`];
      } else if (typeVar === 3) {
        // SICI_04: Sum Becoming N Times under CI
        const t1 = 4, n1 = 3, n2 = 27;
        const t2 = t1 * 3; // 12
        ansStr = `12 years`;
        qText = `चक्रवृद्धि ब्याज पर एक राशि 4 वर्ष में 3 गुनी हो जाती है। कितने वर्षों में यह 27 गुनी हो जाएगी?`;
        qTextEn = `A sum becomes 3 times in 4 years at CI. In how many years will it become 27 times?`;
        explanation = `27 = 3³, अतः समय = 4 × 3 = 12 वर्ष।`;
        explanationEn = `27 = 3³, so time = 4 * 3 = 12 years.`;
        shortcut = `4 × 3 = 12 years`;
        distractors = [`16 years`, `10 years`, `15 years`, `20 years`];
      } else {
        // SICI_06: Installment Problems
        ansStr = `₹1210`;
        qText = `₹2100 की राशि को 10% वार्षिक चक्रवृद्धि ब्याज पर 2 समान वार्षिक किस्तों में चुकाना है। प्रत्येक किस्त की राशि ज्ञात कीजिए।`;
        qTextEn = `A sum of ₹2100 is paid back in 2 equal annual installments at 10% CI. Find each installment.`;
        explanation = `किस्त फॉर्मूला से प्रत्येक किस्त ₹1210 होगी।`;
        explanationEn = `Each installment = ₹1210.`;
        shortcut = `किस्त = ₹1210`;
        distractors = [`₹1100`, `₹1330`, `₹1250`, `₹1150`];
      }
    }
    // 15. लाभ व हानि (Profit & Loss)
    else if (chosenTopic.includes('लाभ व हानि')) {
      const typeVar = Math.floor(Math.random() * 7);
      if (typeVar === 0) {
        // PL_01: Basic CP, SP & Profit/Loss %
        const cp = 400, sp = 480;
        const profitP = 20;
        ansStr = `20%`;
        qText = `एक वस्तु ₹400 में खरीदी गई और ₹480 में बेची गई। लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `An article is bought for ₹400 and sold for ₹480. Find profit percentage.`;
        explanation = `लाभ = 480 - 400 = ₹80। प्रतिशत लाभ = (80 ÷ 400) × 100 = 20%।`;
        explanationEn = `Profit % = (80 / 400) * 100 = 20%.`;
        shortcut = `(80 ÷ 400) × 100 = 20%`;
        distractors = [`15%`, `25%`, `10%`, `30%`];
      } else if (typeVar === 1) {
        // PL_02: CP of X items equals SP of Y items
        const x = 15, y = 12;
        const profitP = 25;
        ansStr = `25%`;
        qText = `यदि 15 पेन का क्रय मूल्य 12 पेन के विक्रय मूल्य के बराबर है, तो लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `If cost price of 15 pens equals selling price of 12 pens, find profit percent.`;
        explanation = `लाभ % = [(X - Y) ÷ Y] × 100 = [(15 - 12) ÷ 12] × 100 = 25%।`;
        explanationEn = `Profit % = [(15 - 12) / 12] * 100 = 25%.`;
        shortcut = `[(15 - 12) ÷ 12] × 100 = 25%`;
        distractors = [`20%`, `15%`, `30%`, `35%`];
      } else if (typeVar === 2) {
        // PL_03: Same SP with Equal % Gain and Loss
        const p = 10;
        const lossP = 1;
        ansStr = `1% loss`;
        qText = `दो वस्तुओं में से प्रत्येक को ₹990 में बेचा जाता है, एक पर 10% लाभ तथा दूसरी पर 10% हानि होती है। कुल लाभ या हानि प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `Two articles sold for ₹990 each, one at 10% gain and other at 10% loss. Overall gain/loss %?`;
        explanation = `समान विक्रय मूल्य और समान प्रतिशत लाभ-हानि पर सदैव हानि होती है: हानि% = (10)² ÷ 100 = 1% हानि।`;
        explanationEn = `Always loss = (10)² / 100 = 1% loss.`;
        shortcut = `(10)² ÷ 100 = 1% loss`;
        distractors = [`1% profit`, `0%`, `2% loss`, `2% profit`];
      } else if (typeVar === 3) {
        // PL_04: Dishonest Shopkeeper / False Weight
        const gainP = 11.11;
        ansStr = `11.11%`;
        qText = `एक बेईमान दुकानदार क्रय मूल्य पर बेचने का दावा करता है लेकिन 1 किग्रा के स्थान पर 900 ग्राम वजन तोलता है। उसका लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `A dishonest dealer claims to sell at CP but uses 900g instead of 1kg. Find gain percentage.`;
        explanation = `लाभ% = [त्रुटि ÷ (True - त्रुटि)] × 100 = [100 ÷ 900] × 100 = 11.11%।`;
        explanationEn = `Gain % = [100 / (1000 - 100)] * 100 = 11.11%.`;
        shortcut = `[100 ÷ 900] × 100 = 11.11%`;
        distractors = [`10%`, `12.5%`, `9.09%`, `15%`];
      } else if (typeVar === 4) {
        // PL_05: Marked Price & Successive Discount
        const mp = 500;
        const sp = 360;
        ansStr = `₹360`;
        qText = `₹500 अंकित मूल्य की वस्तु पर 20% और 10% की क्रमिक छूट (Successive Discounts) दी जाती है। अंतिम विक्रय मूल्य ज्ञात कीजिए।`;
        qTextEn = `An article marked at ₹500 is sold at successive discounts of 20% and 10%. Find final SP.`;
        explanation = `विक्रय मूल्य = 500 × (80 ÷ 100) × (90 ÷ 100) = 500 × 0.8 × 0.9 = ₹360।`;
        explanationEn = `SP = 500 * 0.8 * 0.9 = ₹360.`;
        shortcut = `500 × 0.8 × 0.9 = ₹360`;
        distractors = [`₹350`, `₹380`, `₹400`, `₹340`];
      } else if (typeVar === 5) {
        // PL_06: Relation Between MP, CP, Profit% and Discount%
        const profitP = 19;
        ansStr = `19%`;
        qText = `एक व्यापारी वस्तुओं पर क्रय मूल्य से 40% अधिक अंकित करता है और 15% की छूट देता है। उसका लाभ प्रतिशत ज्ञात कीजिए।`;
        qTextEn = `A trader marks goods 40% above CP and allows 15% discount. Find profit percent.`;
        explanation = `लाभ % = [A - B - (A×B)/100] = [40 - 15 - (40×15)/100] = 25 - 6 = 19%।`;
        explanationEn = `Effective profit = 40 - 15 - 6 = 19%.`;
        shortcut = `40 - 15 - 6 = 19%`;
        distractors = [`25%`, `15%`, `20%`, `22%`];
      } else {
        // PL_07: Free Items Scheme (Buy X Get Y Free)
        const discP = 20;
        ansStr = `20%`;
        qText = `एक दुकान '4 खरीदें 1 मुफ्त पाएं' ('Buy 4 Get 1 Free') की योजना देती है। प्रभावी छूट प्रतिशत क्या है?`;
        qTextEn = `A store offers 'Buy 4 Get 1 Free'. What is effective discount percentage?`;
        explanation = `छूट % = [मुफ्त वस्तुएँ ÷ कुल वस्तुएँ] × 100 = [1 ÷ 5] × 100 = 20%।`;
        explanationEn = `Discount % = (1 / 5) * 100 = 20%.`;
        shortcut = `(1 ÷ 5) × 100 = 20%`;
        distractors = [`25%`, `15%`, `10%`, `30%`];
      }
    }
    // 16. समय व कार्य (Time & Work)
    else if (chosenTopic.includes('समय व कार्य')) {
      const typeVar = Math.floor(Math.random() * 8);
      if (typeVar === 0) {
        // TW_01: Basic Individual & Combined Work
        const a = 10, b = 15;
        const ans = 6;
        ansStr = `6 days`;
        qText = `A किसी कार्य को 10 दिन में और B 15 दिन में कर सकता है। दोनों मिलकर इसे कितने दिन में पूरा करेंगे?`;
        qTextEn = `A can finish in 10 days and B in 15 days. Days together?`;
        explanation = `समय = (A × B) ÷ (A + B) = (10 × 15) ÷ 25 = 6 दिन।`;
        explanationEn = `Time = (10 * 15) / 25 = 6 days.`;
        shortcut = `(10 × 15) ÷ 25 = 6 days`;
        distractors = [`5 days`, `8 days`, `7.5 days`, `9 days`];
      } else if (typeVar === 1) {
        // TW_02: Leaving or Joining Mid-Work
        ansStr = `17.5 days`;
        qText = `A और B किसी कार्य को 20 और 30 दिन में कर सकते हैं। दोनों साथ काम शुरू करते हैं, लेकिन A 5 दिन बाद छोड़ देता है। B शेष कार्य कितने दिन में पूरा करेगा?`;
        qTextEn = `A and B do work in 20 and 30 days. Both start, A leaves after 5 days. Days for B to finish?`;
        explanation = `5 दिन में किया काम = 5 × (1/20 + 1/30) = 5 × (5/60) = 25/60 = 5/12। शेष काम = 7/12। B का समय = (7/12) × 30 = 17.5 दिन।`;
        explanationEn = `Remaining work 7/12 done by B in 17.5 days.`;
        shortcut = `शेष कार्य ÷ B की क्षमता = 17.5 days`;
        distractors = [`15 days`, `20 days`, `18.5 days`, `16 days`];
      } else if (typeVar === 2) {
        // TW_03: Alternate Days Working
        ansStr = `14.33 days`;
        qText = `A और B क्रमशः 12 और 18 दिन में कार्य करते हैं। यदि वे बारी-बारी से (Alternate Days) A से शुरुआत करते हुए काम करें, तो कार्य कितने दिन में समाप्त होगा?`;
        qTextEn = `A and B complete work in 12 and 18 days. Working alternate days starting with A, total days?`;
        explanation = `2 दिन का कार्य = 1/12 + 1/18 = 5/36। ऐसे 6 चक्रों में 30/36 काम 12 दिन में होगा। शेष काम A करेगा। कुल 14.33 दिन।`;
        explanationEn = `Total days = 14.33 days.`;
        shortcut = `बारी-बारी से गणना = 14.33 days`;
        distractors = [`12 days`, `15 days`, `13.5 days`, `16 days`];
      } else if (typeVar === 3) {
        // TW_04: Efficiency / Ratio Based
        ansStr = `21 days`;
        qText = `A की कार्यक्षमता B से दोगुनी है। यदि दोनों मिलकर 14 दिन में कार्य समाप्त करें, तो A अकेला इसे कितने दिन में करेगा?`;
        qTextEn = `A is twice as efficient as B. Together they finish in 14 days. Days for A alone?`;
        explanation = `क्षमता अनुपात A:B = 2:1, समय अनुपात = 1:2। संयुक्त 3 यूनिट = 14 दिन -> A अकेला = 3 × 14 ÷ 2 = 21 दिन।`;
        explanationEn = `A alone takes 21 days.`;
        shortcut = `3 × 14 ÷ 2 = 21 days`;
        distractors = [`28 days`, `18 days`, `24 days`, `20 days`];
      } else if (typeVar === 4) {
        // TW_05: MDH Formula
        ansStr = `10 days`;
        qText = `12 पुरुष प्रतिदिन 8 घंटे काम करके 10 दिन में काम पूरा करते हैं। 16 पुरुष प्रतिदिन 6 घंटे काम करके कितने दिन में पूरा करेंगे?`;
        qTextEn = `12 men working 8 hours/day finish in 10 days. 16 men working 6 hours/day finish in?`;
        explanation = `M1 D1 H1 = M2 D2 H2 -> 12 × 10 × 8 = 16 × D2 × 6 -> D2 = 960 ÷ 96 = 10 दिन।`;
        explanationEn = `D2 = (12 * 8 * 10) / (16 * 6) = 10 days.`;
        shortcut = `(12 × 8 × 10) ÷ (16 × 6) = 10 days`;
        distractors = [`12 days`, `8 days`, `15 days`, `9 days`];
      } else if (typeVar === 5) {
        // TW_06: Men, Women and Children Equivalence
        ansStr = `20 days`;
        qText = `4 पुरुष या 6 महिलाएं किसी कार्य को 20 दिन में करते हैं। 2 पुरुष और 3 महिलाएं मिलकर इसे कितने दिन में पूरा करेंगे?`;
        qTextEn = `4 men or 6 women finish in 20 days. Days for 2 men and 3 women?`;
        explanation = `2 पुरुष = 3 महिलाएं। 2 पुरुष + 3 महिलाएं = 6 महिलाएं। 6 महिलाएं 20 दिन में करेंगी।`;
        explanationEn = `Total equivalence is 6 women, taking 20 days.`;
        shortcut = `समकक्षता नियम = 20 days`;
        distractors = [`15 days`, `25 days`, `18 days`, `22 days`];
      } else if (typeVar === 6) {
        // TW_07: Wages Distribution
        ansStr = `₹685.71`;
        qText = `A और B किसी काम का ठेका ₹1200 में लेते हैं। A इसे 6 दिन में और B 8 दिन में कर सकता है। A का हिस्सा ज्ञात कीजिए।`;
        qTextEn = `A and B undertake work for ₹1200. A in 6 days, B in 8 days. Find A's share.`;
        explanation = `क्षमता अनुपात A:B = (1/6):(1/8) = 4:3। A का हिस्सा = [4 ÷ 7] × 1200 = ₹685.71।`;
        explanationEn = `A's share = (4 / 7) * 1200 = ₹685.71.`;
        shortcut = `(4 ÷ 7) × 1200 = ₹685.71`;
        distractors = [`₹600`, `₹750`, `₹514.28`, `₹700`];
      } else {
        // TW_08: Pipes and Cistern
        ansStr = `36 hours`;
        qText = `नल A टंकी 12 घंटे में भरता है और नल B 18 घंटे में खाली करता है। दोनों एक साथ खोले जाएं, तो टंकी कितने घंटे में भरेगी?`;
        qTextEn = `Pipe A fills in 12 hrs, Pipe B empties in 18 hrs. Time to fill if both open?`;
        explanation = `समय = (12 × 18) ÷ (18 - 12) = 216 ÷ 6 = 36 घंटे।`;
        explanationEn = `Net time = (12 * 18) / 6 = 36 hours.`;
        shortcut = `(12 × 18) ÷ 6 = 36 hours`;
        distractors = [`24 hours`, `48 hours`, `30 hours`, `40 hours`];
      }
    }
    // 17. समय, चाल व दूरी (Time & Distance)
    else if (chosenTopic.includes('समय, चाल व दूरी')) {
      const typeVar = Math.floor(Math.random() * 8);
      if (typeVar === 0) {
        // TSD_01: Basic Speed, Time & Unit Conversion
        ansStr = `500 m`;
        qText = `एक कार 72 किमी/घंटा की चाल से चल रही है। वह 25 सेकंड में कितनी दूरी (मीटर में) तय करेगी?`;
        qTextEn = `A car travels at 72 km/h. How many meters does it cover in 25 seconds?`;
        explanation = `चाल m/s में = 72 × (5/18) = 20 m/s। दूरी = 20 × 25 = 500 मीटर।`;
        explanationEn = `Speed = 20 m/s. Distance = 20 * 25 = 500 m.`;
        shortcut = `20 m/s × 25s = 500 m`;
        distractors = [`450 m`, `550 m`, `600 m`, `400 m`];
      } else if (typeVar === 1) {
        // TSD_02: Average Speed
        ansStr = `48 km/h`;
        qText = `एक व्यक्ति A से B तक 40 किमी/घंटा से जाता है और 60 किमी/घंटा से लौटता है। पूरी यात्रा की औसत चाल ज्ञात कीजिए।`;
        qTextEn = `Person travels A to B at 40 km/h and returns at 60 km/h. Average speed?`;
        explanation = `औसत चाल = (2 × 40 × 60) ÷ (40 + 60) = 4800 ÷ 100 = 48 किमी/घंटा।`;
        explanationEn = `Average speed = (2 * 40 * 60) / 100 = 48 km/h.`;
        shortcut = `(2 × 40 × 60) ÷ 100 = 48 km/h`;
        distractors = [`50 km/h`, `45 km/h`, `52 km/h`, `46 km/h`];
      } else if (typeVar === 2) {
        // TSD_03: Late vs Early Arrival
        ansStr = `5 km`;
        qText = `4 किमी/घंटा चलने पर छात्र 10 मिनट लेट होता है, 5 किमी/घंटा चलने पर 5 मिनट पहले पहुंचता है। स्कूल की दूरी ज्ञात कीजिए।`;
        qTextEn = `Walking at 4 km/h, student is 10 min late. At 5 km/h, 5 min early. Distance to school?`;
        explanation = `दूरी = [(S1 × S2) ÷ (S2 - S1)] × समय अंतर = [(4 × 5) ÷ 1] × (15 ÷ 60) = 20 × 0.25 = 5 किमी।`;
        explanationEn = `Distance = [(4*5)/1] * (15/60) = 5 km.`;
        shortcut = `[20 ÷ 1] × 0.25 = 5 km`;
        distractors = [`4 km`, `6 km`, `7 km`, `4.5 km`];
      } else if (typeVar === 3) {
        // TSD_04: Relative Speed
        ansStr = `3 hours`;
        qText = `300 किमी की दूरी पर दो ट्रेनें 40 किमी/घंटा और 60 किमी/घंटा की चाल से एक-दूसरे की ओर चलती हैं। कितने घंटे बाद मिलेंगी?`;
        qTextEn = `Two trains 300 km apart start moving towards each other at 40 km/h and 60 km/h. Meeting time?`;
        explanation = `सापेक्ष चाल = 40 + 60 = 100 किमी/घंटा। समय = 300 ÷ 100 = 3 घंटे।`;
        explanationEn = `Relative speed = 100 km/h. Time = 300 / 100 = 3 hours.`;
        shortcut = `300 ÷ 100 = 3 hours`;
        distractors = [`4 hours`, `2.5 hours`, `3.5 hours`, `5 hours`];
      } else if (typeVar === 4) {
        // TSD_05: Police and Thief Chase
        ansStr = `1.2 km`;
        qText = `एक चोर को पुलिसकर्मी ने 200 मीटर की दूरी से देखा। चोर 10 किमी/घंटा और पुलिस 12 किमी/घंटा से दौड़ती है। पुलिस कितने किमी की दूरी पर चोर को पकड़ेगी?`;
        qTextEn = `Thief spotted at 200m. Thief runs at 10 km/h, police at 12 km/h. Catch distance?`;
        explanation = `सापेक्ष चाल = 2 किमी/घंटा। समय = 0.2 किमी ÷ 2 = 0.1 घंटा। पुलिस द्वारा तय दूरी = 12 × 0.1 = 1.2 किमी।`;
        explanationEn = `Time = 0.2 / 2 = 0.1h. Distance = 12 * 0.1 = 1.2 km.`;
        shortcut = `12 × 0.1 = 1.2 km`;
        distractors = [`1.0 km`, `1.5 km`, `0.8 km`, `2.0 km`];
      } else if (typeVar === 5) {
        // TSD_06: Train Crossing Object
        ansStr = `20 seconds`;
        qText = `180 मीटर लंबी ट्रेन 54 किमी/घंटा की चाल से 120 मीटर लंबे प्लेटफॉर्म को पार करने में कितना समय लेगी?`;
        qTextEn = `180m train at 54 km/h crosses 120m platform. Time taken?`;
        explanation = `कुल दूरी = 180 + 120 = 300 मीटर। चाल = 54 × (5/18) = 15 m/s। समय = 300 ÷ 15 = 20 सेकंड।`;
        explanationEn = `Total distance = 300m. Speed = 15 m/s. Time = 300 / 15 = 20 seconds.`;
        shortcut = `300 ÷ 15 = 20 seconds`;
        distractors = [`15 seconds`, `25 seconds`, `18 seconds`, `22 seconds`];
      } else if (typeVar === 6) {
        // TSD_07: Boats and Streams
        ansStr = `3 hours`;
        qText = `शांत जल में नाव की चाल 15 किमी/घंटा और धारा की चाल 3 किमी/घंटा है। 36 किमी धारा के प्रतिकूल (Upstream) जाने में कितना समय लगेगा?`;
        qTextEn = `Boat speed 15 km/h, stream 3 km/h. Time to travel 36 km upstream?`;
        explanation = `प्रतिकूल चाल (Upstream) = 15 - 3 = 12 किमी/घंटा। समय = 36 ÷ 12 = 3 घंटे।`;
        explanationEn = `Upstream speed = 12 km/h. Time = 36 / 12 = 3 hours.`;
        shortcut = `36 ÷ 12 = 3 hours`;
        distractors = [`4 hours`, `2 hours`, `5 hours`, `6 hours`];
      } else {
        // TSD_08: Circular Tracks & Races
        ansStr = `11.11 m/s`;
        qText = `1000 मीटर की दौड़ में A, B को 100 मीटर या 10 सेकंड से हराता है। A की चाल ज्ञात कीजिए।`;
        qTextEn = `In 1000m race, A beats B by 100m or 10s. Find A's speed.`;
        explanation = `B द्वारा 100 मीटर तय करने में लिया समय = 10 सेकंड -> B की चाल = 10 m/s। A ने 1000m तय किया 90 सेकंड में -> A की चाल = 1000 ÷ 90 = 11.11 m/s।`;
        explanationEn = `B's speed = 10m/s. A's time = 90s. A's speed = 1000/90 = 11.11 m/s.`;
        shortcut = `1000 ÷ 90 = 11.11 m/s`;
        distractors = [`10 m/s`, `12.5 m/s`, `9.5 m/s`, `13 m/s`];
      }
    }
    // 18. सरलीकरण / Default Fallback
    else {
      const a = (Math.floor(Math.random() * 10) + 2) * 6;
      const b = [2, 3, 6][Math.floor(Math.random() * 3)];
      const c = Math.floor(Math.random() * 5) + 3;
      const d = Math.floor(Math.random() * 15) + 5;
      const res = (a / b) * c + d;

      qText = `मान ज्ञात कीजिए: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
      qTextEn = `Evaluate: (${a} ÷ ${b}) × ${c} + ${d} = ?`;
      ansStr = `${res}`;
      explanation = `BODMAS नियम का पालन करें:\n1. भाग: ${a} ÷ ${b} = ${a / b}\n2. गुणा: ${a / b} × ${c} = ${(a / b) * c}\n3. जोड़: ${(a / b) * c} + ${d} = ${res}।`;
      explanationEn = `Follow BODMAS: Division first (${a} / ${b} = ${a / b}), Multiplication (${(a / b) * c}), then Addition = ${res}.`;
      shortcut = `चरण: ÷ फिर × फिर + = ${res}`;
      distractors = [`${res + 5}`, `${Math.max(1, res - 5)}`, `${res + 10}`, `${Math.max(2, res - 10)}`];
    }

    // Build unique options list
    const optionSet = new Set<string>();
    optionSet.add(ansStr);

    for (const dist of distractors) {
      if (dist && dist !== ansStr && !optionSet.has(dist)) {
        optionSet.add(dist);
      }
      if (optionSet.size >= 4) break;
    }

    let fallbackStep = 1;
    while (optionSet.size < 4) {
      const fallbackVal = ansStr.startsWith('₹')
        ? `₹${parseInt(ansStr.replace('₹', ''), 10) + fallbackStep * 15}`
        : ansStr.includes('दिन')
          ? `${parseInt(ansStr, 10) + fallbackStep * 3} दिन`
          : ansStr.includes('घंटे')
            ? `${parseInt(ansStr, 10) + fallbackStep * 2} घंटे`
            : ansStr.includes('/')
              ? `${parseInt(ansStr.split('/')[0], 10) + fallbackStep}/${ansStr.split('/')[1]}`
              : `${parseInt(ansStr, 10) + fallbackStep * 7}`;

      if (!optionSet.has(fallbackVal)) {
        optionSet.add(fallbackVal);
      }
      fallbackStep++;
    }

    const shuffledOptions = Array.from(optionSet).sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(ansStr);

    const questionCandidate: QuizQuestion = {
      id: indexSeed,
      question: qText,
      questionEn: qTextEn,
      options: shuffledOptions,
      optionsEn: shuffledOptions.map((str: string) => {
        if (typeof str !== 'string') return str;
        return str
          .replace(/\bदिन\b/g, 'days')
          .replace(/\bघंटे\b/g, 'hours')
          .replace(/\bवर्ष\b/g, 'years')
          .replace(/\bकिमी\/घंटा\b/g, 'km/h')
          .replace(/\bकिमी\b/g, 'km')
          .replace(/\bमीटर\b/g, 'm')
          .replace(/\bअंक\b/g, 'points');
      }),
      correct: correctIndex >= 0 ? correctIndex : 0,
      explanation,
      explanationEn,
      shortcut,
      category: chosenTopic
    };

    const signature = `${chosenTopic}:::${qText}`;

    // Anti-repetition check: If we have seen this question before, keep trying to get a unique one
    if (!seenSignatures || !seenSignatures.has(signature) || attempts >= 55) {
      if (seenSignatures) {
        seenSignatures.add(signature);
      }
      finalQ = questionCandidate;
      break;
    }
  }

  return finalQ!;
}

const HINDI_TO_ENGLISH_MAP: Record<string, string> = {
  'नया Button Page': 'New Button Page',
  'नया Button': 'New Button',
  'नया फोल्डर': 'New Folder',
  'मुख्य पृष्ठ': 'Home Page',
  'मुख्य': 'Main',
  'वापस': 'Back',
  'कैलकुलेशन': 'Calculations',
  'स्पीड मैथ': 'Speed Math',
  'टाइपिंग': 'Typing',
  'टाइपिंग लैब': 'Typing Lab',
  'नोट्स': 'Notes',
  'नोट्स (PDF)': 'Notes (PDF)',
  'क्विज': 'Quiz',
  'क्विज अभ्यास': 'Quiz Practice',
  'मॉक टेस्ट': 'Mock Test',
  'अभ्यास': 'Practice',
  'भारतीय राजव्यवस्था': 'Indian Polity & Constitution',
  'भारतीय इतिहास': 'Indian History',
  'भूगोल एवं पर्यावरण': 'Geography & Environment',
  'सामान्य विज्ञान': 'General Science',
  'सामान्य ज्ञान': 'General Knowledge',
  'गणित': 'Mathematics',
  'रीजनिंग': 'Reasoning',
  'अंग्रेजी': 'English',
  'हिंदी': 'Hindi',
  'सामग्री मौजूद': 'items available',
  'फोल्डर खोलें': 'Open Folder',
  'सामग्री': 'Content',
  'विषय': 'Topic',
  'अध्याय': 'Chapter',
  'प्रश्नों की संख्या': 'Question Count',
  'कठिनाई स्तर': 'Difficulty Level',
  'विषय चुनें': 'Select Topic',
  'असीमित': 'Unlimited',
  'सरल': 'Easy',
  'मध्यम': 'Medium',
  'कठिन': 'Hard',
  'प्रो': 'Pro',
  'मिश्रित (सभी विषय)': 'Mixed (All Topics)',
  'जोड़ (Addition)': 'Addition',
  'घटाव (Subtraction)': 'Subtraction',
  'गुणा (Multiplication)': 'Multiplication',
  'भाग (Division)': 'Division',
  'जोड़ व घटाव (Add & Subtract)': 'Add & Subtract',
  'गुणा व भाग (Multiply & Divide)': 'Multiply & Divide',
  'सरलीकरण (BODMAS)': 'Simplification (BODMAS)',
  'प्रतिशत (Percentage)': 'Percentage',
  'वर्ग व वर्गमूल (Squares & Roots)': 'Squares & Square Roots',
  'घन व घनमूल (Cubes & Roots)': 'Cubes & Cube Roots',
  'भिन्न व दशमलव (Fractions & Decimals)': 'Fractions & Decimals',
  'औसत (Average)': 'Average',
  'अनुपात व समानुपात (Ratio & Proportion)': 'Ratio & Proportion',
  'साधारण ब्याज (Simple Interest)': 'Simple Interest',
  'लाभ व हानि (Profit & Loss)': 'Profit & Loss',
  'समय व कार्य (Time & Work)': 'Time & Work',
  'समय, चाल व दूरी (Time & Distance)': 'Time & Distance',
  'फीचर टूल': 'Feature Tool',
  'स्टडी बुल इंटरएक्टिव फीचर': 'Study Bull Interactive Feature',
  'स्पीड मैथ प्रैक्टिस एवं कैलकुलेशन बूस्टर': 'Speed Math Practice & Calculation Booster',
  'प्रोफेशनल रिज्यूम एवं सीवी बिल्डर': 'Professional Resume & CV Builder',
  'लाइव टाइपिंग स्पीड एवं एक्यूरेसी टेस्ट': 'Live Typing Speed & Accuracy Test'
};

function translateTextToEnglish(input: string): string {
  if (!input) return '';
  const str = String(input).trim();
  if (HINDI_TO_ENGLISH_MAP[str]) {
    return HINDI_TO_ENGLISH_MAP[str];
  }

  let translated = str;
  Object.keys(HINDI_TO_ENGLISH_MAP).forEach((key) => {
    if (translated.includes(key)) {
      translated = translated.replaceAll(key, HINDI_TO_ENGLISH_MAP[key]);
    }
  });

  translated = translated
    .replace(/(\d+)\s*सामग्री मौजूद/g, '$1 items available')
    .replace(/नया\s*Button/gi, 'New Button')
    .replace(/नया\s*फोल्डर/gi, 'New Folder')
    .replace(/फोल्डर खोलें/gi, 'Open Folder');

  return translated;
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [langHindi, setLangHindi] = useState<boolean>(() => {
    return localStorage.getItem('study_bull_lang') !== 'en';
  });
  const [soundMuted, setSoundMuted] = useState<boolean>(() => {
    return localStorage.getItem('study_bull_muted') === 'true';
  });

  // Sync language setting across app and notify any active custom iframe pages
  useEffect(() => {
    localStorage.setItem('study_bull_lang', langHindi ? 'hi' : 'en');
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      try {
        iframe.contentWindow?.postMessage({
          type: 'LANG_CHANGE',
          langHindi: langHindi,
          lang: langHindi ? 'hi' : 'en'
        }, '*');
      } catch {}
    });
  }, [langHindi]);

  // Notes Reader
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [readerDarkMode, setReaderDarkMode] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');

  // Quiz State
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [userQuizAnswers, setUserQuizAnswers] = useState<(number | null)[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  // Mock Test State
  const [mockQuestions, setMockQuestions] = useState<QuizQuestion[]>([]);
  const [mockIndex, setMockIndex] = useState(0);
  const [userMockAnswers, setUserMockAnswers] = useState<(number | null)[]>([]);
  const [mockTimer, setMockTimer] = useState(3600);
  const [mockDurationSec, setMockDurationSec] = useState(3600);
  const [mockMarks, setMockMarks] = useState<{ pos: number; neg: number }>({ pos: 1, neg: 0 });
  const [mockTimerActive, setMockTimerActive] = useState(false);

  // Calculation Setup State
  const [calcCount, setCalcCount] = useState<number | 'Infinite'>(10);
  const [calcDifficulty, setCalcDifficulty] = useState<'सरल' | 'मध्यम' | 'कठिन' | 'प्रो'>('मध्यम');
  const [calcTopic, setCalcTopic] = useState<string>('मिश्रित (सभी विषय)');
  const [isCustomTopicMode, setIsCustomTopicMode] = useState<boolean>(false);
  const [selectedCustomTopics, setSelectedCustomTopics] = useState<string[]>([]);

  // Calculation Practice State
  const [calcQuestions, setCalcQuestions] = useState<QuizQuestion[]>([]);
  const [calcIndex, setCalcIndex] = useState(0);
  const [calcSelected, setCalcSelected] = useState<number | null>(null);
  const [calcAnswered, setCalcAnswered] = useState(false);
  const [calcScore, setCalcScore] = useState(0);
  const [calcTimer, setCalcTimer] = useState(0);
  const [calcTimerActive, setCalcTimerActive] = useState(false);
  const [calcCorrectCount, setCalcCorrectCount] = useState(0);
  const [calcWrongCount, setCalcWrongCount] = useState(0);
  const [calcUserAnswers, setCalcUserAnswers] = useState<{ selected: number | null; correct: boolean }[]>([]);
  // Persistent tracking of seen questions to eliminate repetitions 100%
  const seenMathSignaturesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem('study_seen_math_questions_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: string) => seenMathSignaturesRef.current.add(item));
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Typing Test State
  const [typingDuration, setTypingDuration] = useState<number | 'Infinite'>(2);
  const [activeTypingPassage, setActiveTypingPassage] = useState<string>('');
  const [activeTypingTitle, setActiveTypingTitle] = useState<string>('');
  const passageText = activeTypingPassage || '';
  const [typedInput, setTypedInput] = useState('');
  // latest typed text for the timer (keeps the 1 s countdown from restarting on every keystroke)
  const typedInputRef = useRef('');
  typedInputRef.current = typedInput;
  const [typingStarted, setTypingStarted] = useState(false);
  const [typingTimeLeft, setTypingTimeLeft] = useState(120);
  const typingScrollRef = useRef<HTMLDivElement>(null);

  // Submit typing test (called on timeout or user finish)
  const submitTypingTest = () => {
    setTypingStarted(false);
    playGentleSound('celebrate', soundMuted);
    const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
    const totalAllowedSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
    const timeSpentSec = Math.max(1, totalAllowedSec - typingTimeLeft);
    const finalWpm = Math.round((words / timeSpentSec) * 60);
    recordUserAttempt('typing', {
      wpm: finalWpm,
      timeTaken: timeSpentSec,
      characters: typedInput.length
    });
    navigateTo('typing_result');
  };

  // Review accordions state for Results
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [activeCustomNode, setActiveCustomNode] = useState<any>(null);
  const [folderStack, setFolderStack] = useState<any[]>([]);
  const [htmlReloadKey, setHtmlReloadKey] = useState<number>(0);
  const [htmlIsFullscreen, setHtmlIsFullscreen] = useState<boolean>(false);

  // Helper functions to resolve feature title, icon, and subtitle cleanly from Admin nodes and code
  const resolveNodeTitle = (btn: any, hindiMode: boolean = true) => {
    if (!btn) return '';
    let currentTitle = '';
    if (hindiMode) {
      currentTitle = String(btn.title || btn.name || '').trim();
    } else {
      currentTitle = String(btn.titleEn || btn.title_en || '').trim();
      if (!currentTitle) {
        const rawHi = String(btn.title || btn.name || '').trim();
        currentTitle = translateTextToEnglish(rawHi);
      }
    }
    const rawHtml = String(btn.htmlContent || btn.html || btn.code || btn.rawHtml || btn.content || '');
    if (rawHtml) {
      const titleMatch = rawHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        const extracted = titleMatch[1].trim();
        if (!currentTitle || currentTitle === 'नया Custom Web Page' || currentTitle.toLowerCase().includes('custom web page') || currentTitle.toLowerCase().includes('untitled')) {
          return hindiMode ? extracted : translateTextToEnglish(extracted);
        }
      }
    }
    return currentTitle || (hindiMode ? 'फीचर टूल' : 'Feature Tool');
  };

  const resolveNodeIcon = (btn: any) => {
    if (btn?.icon && btn.icon !== '📌' && btn.icon !== '🔗') return btn.icon;
    const title = String(btn?.title || '').toLowerCase();
    const rawHtml = String(btn?.htmlContent || btn?.html || btn?.code || btn?.rawHtml || '').toLowerCase();
    if (title.includes('math') || title.includes('कैलकुलेशन') || rawHtml.includes('कैलकुलेशन') || rawHtml.includes('math') || rawHtml.includes('speed math')) return '⚡';
    if (title.includes('resume') || rawHtml.includes('resume') || rawHtml.includes('cv')) return '📄';
    if (title.includes('typing') || title.includes('टाइपिंग')) return '⌨️';
    if (title.includes('quiz') || title.includes('test')) return '📝';
    if (title.includes('notes') || title.includes('नोट्स') || title.includes('pdf')) return '📚';
    return btn?.icon || '⚡';
  };

  const resolveNodeSubtitle = (btn: any, hindiMode: boolean = true) => {
    let currentSub = '';
    if (hindiMode) {
      currentSub = String(btn.sub || btn.subtitle || '').trim();
    } else {
      currentSub = String(btn.subEn || btn.subtitle_en || '').trim();
      if (!currentSub) {
        const rawHi = String(btn.sub || btn.subtitle || '').trim();
        if (rawHi && !rawHi.includes('Separate Page') && !rawHi.includes('Custom Web Tool') && !rawHi.includes('Interactive Script')) {
          currentSub = translateTextToEnglish(rawHi);
        }
      }
    }
    const title = String(btn?.title || '').toLowerCase();
    const rawHtml = String(btn?.htmlContent || btn?.html || btn?.code || btn?.rawHtml || '').toLowerCase();
    if (currentSub && !currentSub.includes('Separate Page') && !currentSub.includes('Custom Web Tool') && !currentSub.includes('Interactive Script')) {
      return currentSub;
    }
    if (title.includes('स्पीड मैथ') || title.includes('कैलकुलेशन') || rawHtml.includes('कैलकुलेशन') || rawHtml.includes('speed math')) {
      return hindiMode ? 'स्पीड मैथ प्रैक्टिस एवं कैलकुलेशन बूस्टर' : 'Speed Math Practice & Calculation Tool';
    }
    if (title.includes('resume') || rawHtml.includes('resume')) {
      return hindiMode ? 'प्रोफेशनल रिज्यूम एवं सीवी बिल्डर' : 'Professional Resume & CV Builder';
    }
    if (title.includes('typing') || title.includes('टाइपिंग')) {
      return hindiMode ? 'लाइव टाइपिंग स्पीड एवं एक्यूरेसी टेस्ट' : 'Live Typing Speed & Accuracy Test';
    }
    return currentSub || (hindiMode ? 'स्टडी बुल इंटरएक्टिव फीचर' : 'Study Bull Interactive Feature');
  };

  // Node Type Helpers according to Admin schema and Image layout
  const isSectionNode = (item: any) => {
    if (!item) return false;
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    return kind === 'section' || kind === 'divider' || kind === 'heading' || kind === 'header';
  };

  const [loadingTileId, setLoadingTileId] = useState<string | null>(null);
  const [tileLoadError, setTileLoadError] = useState<string | null>(null);
  const pendingTileTapRef = useRef<string | null>(null);
  const nodeInteractionRef = useRef<((btn: any) => void) | null>(null);

  const isFolderNode = (item: any) => {
    if (!item) return false;
    const kind = String(item?.kind || item?.type || '').toLowerCase();
    return kind === 'folder' || kind === 'category' || kind === 'group' || kind === 'directory';
  };

  // Reusable universal handler for clicking ANY Admin node (MCQs, Notes, Folders, Pages)
  const handleNodeInteraction = (btn: any) => {
    if (!btn) return;

    // Tile whose content isn't downloaded yet: small loader inside the tile, then open it
    if (btn._splitPending) {
      const id = String(btn.id);
      pendingTileTapRef.current = id;
      setTileLoadError(null);
      setLoadingTileId(id);
      splitStore.ensureTile(id).then((full) => {
        if (pendingTileTapRef.current !== id) return;
        pendingTileTapRef.current = null;
        setLoadingTileId(null);
        if (full && !full._splitPending) {
          if (liveNavRef.current.view === 'home') nodeInteractionRef.current?.(full);
        } else {
          setTileLoadError(id);
        }
      });
      return;
    }

    if (btn.url) {
      window.open(btn.url, '_blank');
      return;
    }

    // Parents of the page being opened (for breadcrumbs): the open folder and its own parents
    const nextFolderStack = (currentView === 'custom_node' && activeCustomNode) ? [...folderStack, activeCustomNode] : [];

    // IF THIS BUTTON HAS SUB-BUTTONS OR IS MARKED AS A FOLDER, OPEN AS A FOLDER VIEW SO ALL INSIDE BUTTONS ARE ACCESSIBLE
    if (isFolderNode(btn) || (Array.isArray(btn.children) && btn.children.length > 0)) {
      setFolderStack(nextFolderStack);
      setActiveCustomNode(btn);
      setHtmlReloadKey(0);
      setHtmlIsFullscreen(false);
      navigateTo('custom_node');
      return;
    }

    const target = String(btn.view || btn.target_view || btn.type || btn.kind || btn.id || '').toLowerCase();
    const kind = String(btn.kind || btn.type || '').toLowerCase();

    // 0. CUSTOM HTML / INTERACTIVE WEB APPS (MoodMoji, widgets, tools, API fetch tools)
    const isHtmlNode = Boolean(
      kind === 'html' ||
      target.includes('html') ||
      target.includes('custom_node') ||
      btn.htmlContent ||
      btn.html ||
      btn.code ||
      btn.rawHtml ||
      (typeof btn.content === 'string' && (
        btn.content.includes('<') ||
        btn.content.includes('<!DOCTYPE') ||
        btn.content.includes('<script') ||
        btn.content.includes('<style') ||
        btn.content.includes('<div') ||
        btn.content.includes('function') ||
        btn.content.includes('fetch(') ||
        btn.content.includes('axios') ||
        btn.content.includes('document.') ||
        btn.content.includes('window.') ||
        btn.content.includes('localStorage') ||
        btn.content.includes('addEventListener')
      ))
    );

    if (isHtmlNode) {
      setFolderStack(nextFolderStack);
      setActiveCustomNode(btn);
      setHtmlReloadKey(0);
      setHtmlIsFullscreen(false);
      navigateTo('custom_node');
      return;
    }

    // 1. ADMIN MCQs & QUIZZES (or custom questions attached to admin button)
    const rawQuestions = 
      (Array.isArray(btn.questions) && btn.questions.length > 0 ? btn.questions : null) ||
      (Array.isArray(btn.mcqs) && btn.mcqs.length > 0 ? btn.mcqs : null) ||
      (Array.isArray(btn.items) && btn.items.length > 0 && btn.items[0]?.question ? btn.items : null) ||
      (Array.isArray(btn.quiz) && btn.quiz.length > 0 ? btn.quiz : null) ||
      (typeof btn.content === 'string' && btn.content.trim().startsWith('[') ? (() => {
        try {
          const parsed = JSON.parse(btn.content);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch { return null; }
      })() : null);

    const validQuestions = rawQuestions?.filter((q: any) => {
      const t = String(q.question || q.qText || q.title || '');
      return t && !t.includes('document.') && !t.includes('var ') && !t.includes('STORE_KEY') && !t.includes('moodmoji') && !t.includes('BATCH=') && !t.includes('elementById') && !t.includes('onclick=');
    });

    if (validQuestions && validQuestions.length > 0) {
      const normalizedQs = validQuestions.map((q: any, i: number) => ({
        id: q.id || i + 1,
        question: q.question || q.qText || q.title || 'Question',
        questionEn: q.questionEn || q.question_en || q.question || 'Question',
        options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        optionsEn: Array.isArray(q.optionsEn) ? q.optionsEn : (Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D']),
        correct: resolveCorrectIndex(q),
        category: q.section || q.subject || q.category || undefined,
        explanation: q.explanation || q.exp || 'सही उत्तर चुनने हेतु बधाई।',
        explanationEn: q.explanationEn || q.explanation_en || q.explanation || 'Great job selecting the correct answer.'
      }));

      const title = resolveNodeTitle(btn, langHindi);
      setSelectedSubject({
        id: btn.id,
        title: title,
        titleEn: btn.titleEn || btn.title_en || title,
        subtitle: resolveNodeSubtitle(btn, langHindi),
        subtitleEn: btn.subtitleEn || btn.subtitle_en || resolveNodeSubtitle(btn, false),
        icon: resolveNodeIcon(btn),
        questions: normalizedQs
      });
      setQuizQuestions(normalizedQs);
      setQuizIndex(0);
      setUserQuizAnswers(new Array(normalizedQs.length).fill(null));
      setQuizScore(0);
      setIsAnswerRevealed(false);

      if (kind === 'mock' || target.includes('mock')) {
        const durSec = resolveMockDurationSec(btn);
        setMockQuestions(normalizedQs);
        setMockIndex(0);
        setUserMockAnswers(new Array(normalizedQs.length).fill(null));
        setMockDurationSec(durSec);
        setMockMarks(resolveMockMarks(btn));
        setMockTimer(durSec);
        setMockTimerActive(true);
        navigateTo('mock_play');
      } else {
        navigateTo('quiz_play');
      }
      return;
    }

    // 2. ADMIN NOTES & PDF (custom text/chapters attached to node)
    const notesText = btn.notesContent || btn.content || btn.text || btn.notes || btn.pdfUrl || btn.pdf || btn.body || btn.description;
    const hasNotesContent = typeof notesText === 'string' && notesText.trim().length > 0 && !notesText.includes('<html') && !notesText.includes('<!DOCTYPE');
    const hasChapters = Array.isArray(btn.chapters) && btn.chapters.length > 0;

    if (kind === 'notes' || kind === 'pdf' || kind === 'note' || target.includes('note') || target.includes('pdf') || hasNotesContent || hasChapters) {
      if (hasNotesContent || notesText) {
        const title = resolveNodeTitle(btn, langHindi);
        setSelectedChapter({
          id: btn.id,
          title: title,
          titleEn: btn.titleEn || btn.title_en || title,
          subtitle: resolveNodeSubtitle(btn, langHindi),
          subtitleEn: resolveNodeSubtitle(btn, false),
          content: notesText || (langHindi ? 'एडमिन पैनल से इस नोट्स की विषय सामग्री जोड़ी जा रही है...' : 'Notes content is being added from Admin Panel...')
        });
        navigateTo('notes_reader');
        return;
      }
      if (hasChapters) {
        setSelectedChapter(btn.chapters[0]);
        navigateTo('notes_lib');
        return;
      }
      navigateTo('notes_lib');
      return;
    }

    // 3. SPEED MATH / CALCULATION
    const isCalc = target.includes('calc') || 
      kind === 'calc' || 
      String(btn.title || '').toLowerCase().includes('calc') || 
      String(btn.title || '').includes('कैलकुलेशन') || 
      String(btn.title || '').toLowerCase().includes('speed math');

    if (isCalc) {
      navigateTo('calc_setup');
      return;
    }

    // 4. TYPING LAB
    const isTyping = target.includes('typing') || 
      kind === 'typing' || 
      String(btn.title || '').toLowerCase().includes('typing') || 
      String(btn.title || '').includes('टाइपिंग');

    if (isTyping) {
      navigateTo('typing_setup');
      return;
    }

    // 5. MOCK TEST SAMPLE FALLBACK
    if (target.includes('mock')) {
      const mockQs = getMockQuestionsFromAdmin(adminNodes);
      if (mockQs.length > 0) {
        const firstMock = findFirstMockNode(adminNodes);
        const durSec = resolveMockDurationSec(firstMock);
        setMockMarks(resolveMockMarks(firstMock));
        setMockQuestions(mockQs);
        setMockIndex(0);
        setUserMockAnswers(new Array(mockQs.length).fill(null));
        setMockDurationSec(durSec);
        setMockTimer(durSec);
        setMockTimerActive(true);
        navigateTo('mock_play');
      } else {
        navigateTo('mock_play');
      }
      return;
    }

    // 6. QUIZ SAMPLE FALLBACK
    if (target.includes('quiz')) {
      const quizSubjs = getQuizSubjectsFromAdmin(adminNodes);
      if (quizSubjs.length > 0) {
        setSelectedSubject(quizSubjs[0]);
        setQuizQuestions(quizSubjs[0].questions);
        setQuizIndex(0);
        setUserQuizAnswers(new Array(quizSubjs[0].questions.length).fill(null));
        setQuizScore(0);
        setIsAnswerRevealed(false);
        navigateTo('quiz_play');
      } else {
        navigateTo('quiz_categories');
      }
      return;
    }

    // 7. CUSTOM HTML CODE PAGE / OTHER
    setFolderStack(nextFolderStack);
    setActiveCustomNode(btn);
    setHtmlReloadKey(0);
    setHtmlIsFullscreen(false);
    navigateTo('custom_node');
  };
  nodeInteractionRef.current = handleNodeInteraction;

  // Supabase State & Instant Cache-First (eliminates all old default flickers)
  const [adminNodes, setAdminNodes] = useState<any[]>(() => {
    if (SPLIT_BOOT && SPLIT_BOOT.nodes.length > 0) return SPLIT_BOOT.nodes;
    try {
      const cached = localStorage.getItem('studybull_user_cache') || localStorage.getItem('studybull_cached_nodes');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });

  const [adminSettings, setAdminSettings] = useState<any>(() => {
    if (SPLIT_BOOT && SPLIT_BOOT.settings && Object.keys(SPLIT_BOOT.settings).length > 0) return SPLIT_BOOT.settings;
    try {
      const cached = localStorage.getItem('studybull_cached_settings');
      if (cached) return JSON.parse(cached);
    } catch {}
    return {};
  });

  const [eligibilityExamId, setEligibilityExamId] = useState<string | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(() => {
    if (SPLIT_BOOT && SPLIT_BOOT.nodes.length > 0) return true;
    try {
      const cached = localStorage.getItem('studybull_user_cache') || localStorage.getItem('studybull_cached_nodes');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) && parsed.length > 0;
      }
      return false;
    } catch {
      return false;
    }
  });

  const applyLiveAdminData = (nodes: any[], settings: any) => {
    if (Array.isArray(nodes)) {
      // Caching is done by splitStore (per tile) / loadStudyBullApp (old single row)
      setAdminNodes(nodes);
    }
    if (settings && Object.keys(settings).length > 0) {
      setAdminSettings(settings);
      try {
        localStorage.setItem('studybull_cached_settings', JSON.stringify(settings));
      } catch {}
    }
    setIsDbLoaded(true);
    try {
      localStorage.setItem('studybull_db_loaded', 'true');
    } catch {}
  };

  useEffect(() => {
    let isMounted = true;

    // 1. Small index row first (home grid), tiles on demand — see src/lib/splitStore.ts.
    //    Falls back to the old single row automatically when the index row is missing.
    splitStore.setListener((nodes, settings) => {
      if (!isMounted) return;
      if (Array.isArray(nodes) && nodes.length > 0) applyLiveAdminData(nodes, settings || {});
    });
    splitStore.start().catch((err) => {
      console.warn('Initial load error from Supabase:', err);
    }).finally(() => {
      if (isMounted) setIsDbLoaded(true);
    });

    // 2. Every 15 s while the tab is visible (and when it comes back): tiny version stamps only;
    //    only the tiles the admin changed are downloaded again.
    const syncIfChanged = () => {
      if (!isMounted) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      splitStore.poll().catch(() => {});
    };
    const timer = setInterval(syncIfChanged, 15000);
    const onVisible = () => { if (document.visibilityState === 'visible') syncIfChanged(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      isMounted = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Views that read across all tiles (old quiz/notes hubs, typing setup) need every tile's content
  useEffect(() => {
    if (['quiz_categories', 'notes_lib', 'typing_setup'].includes(currentView) && adminNodes.some((n: any) => n && n._splitPending)) {
      void splitStore.ensureAll();
    }
  }, [currentView, adminNodes]);

  // Sync Language and Mute with LocalStorage
  useEffect(() => {
    localStorage.setItem('study_bull_lang', langHindi ? 'hi' : 'en');
  }, [langHindi]);

  useEffect(() => {
    localStorage.setItem('study_bull_muted', soundMuted ? 'true' : 'false');
  }, [soundMuted]);

  // Synchronize document.title with live Admin App Name
  useEffect(() => {
    const title = adminSettings?.appName?.trim() || 'Study Bull';
    // SEO: keep the full keyword title (same as index.html) so Google's rendered title stays descriptive.
    const brand = title.replace(/\s+/g, '').toLowerCase() === 'studybull' ? 'StudyBull' : `${title} | StudyBull`;
    document.title = `${brand} — SSC GD, Agniveer, Police, Railway Free Mock Test, Notes, PYQ & Current Affairs (Hindi)`;
  }, [adminSettings?.appName]);

  // ---- Navigation stack synced with browser history ----
  // Every page the user opens is one entry here AND one browser-history entry, so the in-app
  // "वापस" button and the phone/browser back gesture both go exactly ONE level up
  // (content -> topic/subject list -> button page -> home). At home, back leaves the site normally.
  const navStackRef = useRef<NavSnapshot[]>([]);
  const navIndexRef = useRef(0);
  const liveNavRef = useRef<NavSnapshot>({ view: 'home', node: null, folders: [], chapter: null });
  liveNavRef.current = { view: currentView, node: activeCustomNode, folders: folderStack, chapter: selectedChapter };

  const PLAY_VIEWS: ViewState[] = ['quiz_play', 'mock_play', 'calc_practice', 'typing_practice'];
  const RESULT_VIEWS: ViewState[] = ['quiz_result', 'mock_result', 'calc_result', 'typing_result'];
  const HUB_VIEWS: ViewState[] = ['home', 'quiz_categories', 'notes_lib', 'calc_setup', 'typing_setup'];

  const stopActivityTimers = (from: ViewState, to: ViewState) => {
    if (from === to) return;
    if (from === 'mock_play' || from === 'mock_result') setMockTimerActive(false);
    if (from === 'calc_practice' || from === 'calc_result') setCalcTimerActive(false);
    if (from === 'typing_practice' || from === 'typing_result') setTypingStarted(false);
  };

  const restoreNav = (snap: NavSnapshot) => {
    stopActivityTimers(liveNavRef.current.view, snap.view);
    liveNavRef.current = { ...snap };
    setFolderStack(Array.isArray(snap.folders) ? snap.folders : []);
    setActiveCustomNode(snap.view === 'home' ? null : snap.node);
    if (snap.chapter !== undefined) setSelectedChapter(snap.chapter);
    setHtmlIsFullscreen(false);
    setCurrentView(snap.view);
  };

  // Move to stack entry i through browser history (popstate below does the restore)
  const goToNavIndex = (i: number) => {
    const before = navIndexRef.current;
    if (i === before || i < 0 || i >= navStackRef.current.length) return;
    try {
      window.history.go(i - before);
    } catch {
      // ignore, fallback below
    }
    // Safety net: if the browser did not move (popstate never came), restore in-app anyway
    window.setTimeout(() => {
      if (navIndexRef.current === before) {
        const stack = navStackRef.current;
        stack[before] = { ...liveNavRef.current };
        navIndexRef.current = i;
        restoreNav(stack[i]);
      }
    }, 700);
  };

  useEffect(() => {
    navStackRef.current = [{ ...liveNavRef.current }];
    navIndexRef.current = 0;
    try {
      window.history.replaceState({ ...(window.history.state || {}), sbNav: 0 }, '');
    } catch {
      // ignore
    }

    const handlePopState = (e: PopStateEvent) => {
      const stack = navStackRef.current;
      if (!stack.length) return;
      const raw = e.state && typeof e.state.sbNav === 'number' ? e.state.sbNav : 0;
      const target = Math.max(0, Math.min(raw, stack.length - 1));
      const cur = navIndexRef.current;
      if (target === cur) return;
      if (cur < stack.length) stack[cur] = { ...liveNavRef.current };
      navIndexRef.current = target;
      restoreNav(stack[target]);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigate view with history state
  const navigateTo = (view: ViewState) => {
    const stack = navStackRef.current;
    if (!stack.length) {
      stack.push({ ...liveNavRef.current });
      navIndexRef.current = 0;
    }
    if (view === 'home') {
      goHomeNav();
      return;
    }
    const cur = navIndexRef.current;
    const from = liveNavRef.current.view;

    // A result screen (or "try again" from a result) replaces the current page instead of adding one
    if (RESULT_VIEWS.includes(view) || (RESULT_VIEWS.includes(from) && PLAY_VIEWS.includes(view))) {
      setCurrentView(view);
      return;
    }

    // Going to a list/setup page that is already below us (home, notes list, setup) = go back to it
    if (HUB_VIEWS.includes(view) && view !== from) {
      for (let i = cur - 1; i >= 0; i--) {
        if (stack[i].view === view) {
          goToNavIndex(i);
          return;
        }
      }
    }

    stack[cur] = { ...liveNavRef.current };
    stack.length = cur + 1;
    stack.push({ ...liveNavRef.current, view });
    navIndexRef.current = cur + 1;
    try {
      window.history.pushState({ sbNav: cur + 1 }, '');
    } catch {
      // ignore
    }
    setCurrentView(view);
  };

  // Breadcrumb helpers: jump back to home / to an open parent folder (one history move)
  const goHomeNav = () => {
    if (navIndexRef.current > 0) {
      goToNavIndex(0);
      return;
    }
    setActiveCustomNode(null);
    setFolderStack([]);
    setCurrentView('home');
  };

  const goToFolderNav = (parent: any, idx: number) => {
    const stack = navStackRef.current;
    for (let i = navIndexRef.current - 1; i >= 0; i--) {
      const n = stack[i].node;
      if (stack[i].view === 'custom_node' && n && (n === parent || (n.id != null && n.id === parent?.id))) {
        goToNavIndex(i);
        return;
      }
    }
    setFolderStack(s => s.slice(0, idx));
    setActiveCustomNode(parent);
  };

  // Mock Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mockTimerActive && mockTimer > 0) {
      interval = setInterval(() => {
        setMockTimer(prev => {
          if (prev <= 1) {
            setMockTimerActive(false);
            playGentleSound('timeup', soundMuted);
            setCurrentView('mock_result');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mockTimerActive, mockTimer, soundMuted]);

  // Soft countdown tick in the last 10 seconds of a mock test
  useEffect(() => {
    if (mockTimerActive && mockTimer > 0 && mockTimer <= 10) {
      playGentleSound('tick', soundMuted);
    }
  }, [mockTimerActive, mockTimer, soundMuted]);

  // Calc Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (calcTimerActive) {
      interval = setInterval(() => setCalcTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [calcTimerActive]);

  // Typing Timer & Auto-Submit when time is over
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (typingStarted && typingDuration !== 'Infinite') {
      if (typingTimeLeft > 0) {
        interval = setInterval(() => {
          setTypingTimeLeft(prev => {
            if (prev <= 1) {
              setTypingStarted(false);
              playGentleSound('celebrate', soundMuted);
              const words = typedInputRef.current.trim().split(/\s+/).filter(Boolean).length;
              const durationSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
              const finalWpm = Math.round((words / (durationSec / 60))) || 0;
              recordUserAttempt('typing', {
                wpm: finalWpm,
                timeTaken: durationSec,
                characters: typedInputRef.current.length
              });
              setCurrentView('typing_result');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
    return () => clearInterval(interval);
  }, [typingStarted, typingTimeLeft, typingDuration, soundMuted]);

  // Smooth, stable auto-scroll strictly contained within the text box
  // NEVER scrolls the window or causes screen jumping when mobile keyboard is open
  useEffect(() => {
    const container = typingScrollRef.current;
    if (!container) return;
    const activeEl = container.querySelector('.active-char') as HTMLElement | null;
    if (activeEl) {
      const offsetWithinContainer = activeEl.offsetTop - container.offsetTop;
      const targetScrollTop = offsetWithinContainer - (container.clientHeight / 2) + 16;
      if (Math.abs(container.scrollTop - targetScrollTop) > 20) {
        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      }
    }
  }, [typedInput]);

  // Rock-Solid Safe Back Button Handler
  // Never unmounts unexpectedly and always maps to a stable parent view
  const handleBack = () => {
    // One level up through the shared navigation stack / browser history
    if (navIndexRef.current > 0) {
      goToNavIndex(navIndexRef.current - 1);
      return;
    }
    // Fallback (page reached without a history entry): old parent mapping
    switch (currentView) {
      case 'custom_node':
        if (folderStack.length > 0) {
          const prevFolder = folderStack[folderStack.length - 1];
          setFolderStack(s => s.slice(0, -1));
          setActiveCustomNode(prevFolder);
        } else {
          setFolderStack([]);
          setActiveCustomNode(null);
          setCurrentView('home');
        }
        break;
      case 'quiz_play':
      case 'quiz_result':
      case 'mock_play':
      case 'mock_result':
        setMockTimerActive(false);
        if (activeCustomNode) {
          setCurrentView('custom_node');
        } else {
          setActiveCustomNode(null);
          setCurrentView('home');
        }
        break;
      case 'quiz_categories':
      case 'notes_lib':
      case 'calc_setup':
      case 'typing_setup':
        if (activeCustomNode) {
          setCurrentView('custom_node');
        } else {
          setActiveCustomNode(null);
          setCurrentView('home');
        }
        break;
      case 'notes_reader':
        setCurrentView('notes_lib');
        break;
      case 'calc_practice':
      case 'calc_result':
        setCalcTimerActive(false);
        setCurrentView('calc_setup');
        break;
      case 'typing_practice':
      case 'typing_result':
        setTypingStarted(false);
        setCurrentView('typing_setup');
        break;
      default:
        setCurrentView('home');
    }
  };

  // Generate Calculation Questions
  const generateCalculationSet = () => {
    const totalQ = calcCount === 'Infinite' ? 20 : Number(calcCount);
    const generated: QuizQuestion[] = [];
    const baseTopics = ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित'));

    for (let i = 0; i < totalQ; i++) {
      let targetTopic = calcTopic;
      if (isCustomTopicMode && selectedCustomTopics.length > 0) {
        targetTopic = selectedCustomTopics[Math.floor(Math.random() * selectedCustomTopics.length)];
      } else if (calcTopic.includes('मिश्रित')) {
        targetTopic = baseTopics[Math.floor(Math.random() * baseTopics.length)];
      }

      const q = generateUnlimitedMathQuestion(
        targetTopic,
        i + 1,
        calcDifficulty,
        seenMathSignaturesRef.current
      );
      generated.push(q);
    }

    // Save recent signatures to persistent storage (limit to last 2000)
    try {
      const arr = Array.from(seenMathSignaturesRef.current).slice(-2000);
      localStorage.setItem('study_seen_math_questions_v2', JSON.stringify(arr));
    } catch {
      // Ignore
    }

    setCalcQuestions(generated);
    setCalcIndex(0);
    setCalcSelected(null);
    setCalcAnswered(false);
    setCalcScore(0);
    setCalcCorrectCount(0);
    setCalcWrongCount(0);
    setCalcUserAnswers([]);
    setCalcTimer(0);
    setCalcTimerActive(true);
    navigateTo('calc_practice');
  };

  // Top Title Helper
  const getHeaderTitle = () => {
    const defaultAppName = adminSettings?.appName?.trim() || 'Study Bull';
    switch (currentView) {
      case 'home':
        return defaultAppName;
      case 'quiz_categories':
      case 'quiz_play':
      case 'quiz_result':
        return langHindi ? 'क्विज अभ्यास' : 'Quiz Practice';
      case 'mock_play':
      case 'mock_result':
        return langHindi ? 'मॉक टेस्ट' : 'Mock Tests';
      case 'notes_lib':
      case 'notes_reader':
        return langHindi ? 'नोट्स (PDF)' : 'Notes (PDF)';
      case 'calc_setup':
      case 'calc_practice':
      case 'calc_result':
        return langHindi ? 'कैलकुलेशन' : 'Calculations';
      case 'typing_setup':
      case 'typing_practice':
      case 'typing_result':
        return langHindi ? 'टाइपिंग लैब' : 'Typing Lab';
      case 'eligibility':
      case 'eligibility_exam':
        return langHindi ? 'पात्रता जाँच' : 'Eligibility Checker';
      case 'job_alert':
        return langHindi ? 'जॉब अलर्ट' : 'Job Alert';
      default:
        return defaultAppName;
    }
  };

  // 1. DEDICATED FULL-SCREEN NEW FEATURE PAGE (Matching user requirement & Image 2)
  // When an admin HTML feature/code button is tapped, render pure full-screen page with ONLY top back bar
  if (currentView === 'custom_node' && activeCustomNode) {
    const isHtmlTool = Boolean(
      activeCustomNode.kind === 'html' ||
      activeCustomNode.htmlContent ||
      activeCustomNode.html ||
      activeCustomNode.code ||
      activeCustomNode.rawHtml ||
      (typeof activeCustomNode.content === 'string' && (
        activeCustomNode.content.includes('<') ||
        activeCustomNode.content.includes('function') ||
        activeCustomNode.content.includes('fetch(') ||
        activeCustomNode.content.includes('document.') ||
        activeCustomNode.content.includes('window.') ||
        activeCustomNode.content.includes('localStorage')
      ))
    );

    const extractedCode = String(
      activeCustomNode.htmlContent ||
      activeCustomNode.html ||
      activeCustomNode.code ||
      activeCustomNode.rawHtml ||
      (typeof activeCustomNode.content === 'string' ? activeCustomNode.content : '')
    ).trim();

    // If pure JS without HTML tags, automatically wrap in script tag
    const rawHtml = (extractedCode && !extractedCode.includes('<') && (extractedCode.includes('function') || extractedCode.includes('fetch') || extractedCode.includes('console.')))
      ? `<script>\n${extractedCode}\n</script>`
      : extractedCode;

    const featureTitle = resolveNodeTitle(activeCustomNode, langHindi);
    const featureIcon = resolveNodeIcon(activeCustomNode);
    const featureSubtitle = resolveNodeSubtitle(activeCustomNode, langHindi);

    return (
      <SafeErrorBoundary fallbackView={() => { setActiveCustomNode(null); setCurrentView('home'); }}>
        <div className="fixed inset-0 z-50 flex flex-col w-full h-dvh bg-slate-50 select-none overflow-hidden">
          {/* Top Bar - Clean header matching main home page header */}
          <div 
            className="h-14 px-4 flex items-center justify-between text-white shadow-sm shrink-0 z-20"
            style={{
              background: `linear-gradient(to right, ${adminSettings?.primaryColor || '#1546b5'}, ${adminSettings?.secondaryColor || '#3d2db3'})`
            }}
          >
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={handleBack}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{langHindi ? 'वापस' : 'Back'}</span>
              </button>

              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-xl shrink-0">{featureIcon}</span>
                <div className="min-w-0">
                  <h1 className="text-sm sm:text-base font-bold text-white truncate">
                    {featureTitle}
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/20 active:scale-95 cursor-pointer"
                title={soundMuted ? 'ध्वनि चालू करें' : 'ध्वनि बंद करें'}
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Interactive Open Tab & Location Banner */}
          <div className="bg-slate-900 text-white text-xs px-4 py-2 flex items-center space-x-2 overflow-x-auto whitespace-nowrap border-b border-slate-800 shrink-0 shadow-inner">
            <button
              onClick={goHomeNav}
              className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 font-medium cursor-pointer border border-slate-700/80"
            >
              <span>🏠</span>
              <span>{langHindi ? 'मुख्य पृष्ठ' : 'Home'}</span>
            </button>

            {folderStack.map((parent, idx) => (
              <React.Fragment key={parent.id || idx}>
                <span className="text-slate-500 font-extrabold text-sm">›</span>
                <button
                  onClick={() => goToFolderNav(parent, idx)}
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 font-medium cursor-pointer border border-slate-700/80"
                >
                  <span>📌</span>
                  <span>{resolveNodeTitle(parent, langHindi)}</span>
                </button>
              </React.Fragment>
            ))}

            <span className="text-slate-500 font-extrabold text-sm">›</span>
            <div className="px-3 py-1 rounded-md bg-blue-600/30 text-blue-300 font-bold flex items-center gap-1.5 border border-blue-500/40 shadow-xs">
              <span>{featureIcon || '📌'}</span>
              <span>{featureTitle}</span>
              <span className="ml-1 px-1.5 py-0.2 bg-blue-500/20 text-[10px] text-blue-200 uppercase rounded tracking-wide border border-blue-400/30 font-extrabold">Open Tab</span>
            </div>
          </div>

          {/* Pure 100% Full Viewport Output without frames, margins or bottom bars */}
          <div
            className="flex-1 min-h-0 w-full bg-white overflow-hidden relative"
            style={isHtmlTool ? { paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}
          >
            {isHtmlTool ? (
              <SandboxedHtmlView
                key={`fs-feature-${activeCustomNode.id}-${htmlReloadKey}`}
                htmlContent={rawHtml}
                title={featureTitle}
                minHeight="100%"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              /* If folder or container, show child buttons cleanly in full screen with back button */
              <div className="max-w-4xl mx-auto p-6 overflow-y-auto overscroll-contain h-full" style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
                <div className="mb-6 flex items-center gap-3">
                  <span className="text-3xl">{featureIcon}</span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{featureTitle}</h2>
                    {featureSubtitle && <p className="text-xs text-slate-500 mt-0.5">{featureSubtitle}</p>}
                  </div>
                </div>

                {Array.isArray(activeCustomNode.children) && activeCustomNode.children.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {activeCustomNode.children.map((child: any) => {
                      const childTitle = resolveNodeTitle(child, langHindi);
                      const childIcon = resolveNodeIcon(child);
                      const childSubtitle = resolveNodeSubtitle(child, langHindi);
                      const childTarget = String(child.view || child.target_view || child.type || child.id || '').toLowerCase();
                      const childHasHtml = Boolean(
                        child.htmlContent || child.html || child.code || child.rawHtml ||
                        (typeof child.content === 'string' && (child.content.includes('<html') || child.content.includes('<!DOCTYPE') || child.content.includes('<script')))
                      );

                      const isChildSection = isSectionNode(child);
                      const isChildFolder = isFolderNode(child);

                      const handleChildClick = () => {
                        handleNodeInteraction(child);
                      };

                      if (isChildSection) {
                        return (
                          <button
                            key={child.id}
                            onClick={handleChildClick}
                            className="col-span-2 sm:col-span-2 md:col-span-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-white border border-blue-200/80 hover:border-blue-300 rounded-2xl p-4 flex items-center justify-between shadow-sm my-1 text-left w-full cursor-pointer transition active:scale-98"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                                {childIcon || '📑'}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight truncate">
                                  {childTitle}
                                </h3>
                                {childSubtitle && (
                                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                    {childSubtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                                Section
                              </span>
                              <ChevronRight className="w-4 h-4 text-blue-500" />
                            </div>
                          </button>
                        );
                      }

                      const childCount = Array.isArray(child.children) ? child.children.length : 0;

                      if (isChildFolder) {
                        return (
                          <button
                            key={child.id}
                            onClick={handleChildClick}
                            className="col-span-2 sm:col-span-2 md:col-span-3 group relative bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/80 rounded-2xl p-4 shadow-sm border-2 border-amber-300/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between text-left overflow-hidden my-1 w-full active:scale-98"
                          >
                            <div className="flex items-center space-x-3.5 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-amber-200/90 group-hover:bg-amber-300 text-amber-900 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 group-hover:scale-105 transform duration-150">
                                {childIcon || '📂'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-extrabold text-amber-950 group-hover:text-amber-900 transition-colors text-base sm:text-lg tracking-tight truncate">
                                    {childTitle}
                                  </h3>
                                  <span className="px-2 py-0.5 bg-amber-200/90 text-amber-900 text-[10px] font-extrabold rounded-md uppercase tracking-wider shrink-0 border border-amber-300/80 shadow-2xs">
                                    📁 {langHindi ? 'फोल्डर' : 'Folder'}
                                  </span>
                                </div>
                                <p className="text-xs text-amber-800/90 font-medium truncate mt-0.5">
                                  {childSubtitle || (childCount > 0 ? (langHindi ? `${childCount} सामग्री मौजूद` : `${childCount} items inside`) : (langHindi ? 'फोल्डर खोलें' : 'Open Folder'))}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="px-2.5 py-1 bg-amber-200/80 text-amber-900 font-bold text-xs rounded-lg border border-amber-300/70 shadow-2xs hidden sm:inline-block">
                                {childCount} {langHindi ? 'आइटम' : 'items'}
                              </span>
                              <ChevronRight className="w-5 h-5 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={child.id}
                          onClick={handleChildClick}
                          className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                        >
                          <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                          </div>

                          <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                            {childIcon || '⚡'}
                          </div>

                          <div className="w-full">
                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                              {childTitle}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                              {childSubtitle || (langHindi ? 'पेज खोलें' : 'Open Page')}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <p className="text-sm text-slate-500">
                      {langHindi ? 'इस फोल्डर में कोई सामग्री नहीं है' : 'No items found in this folder'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SafeErrorBoundary>
    );
  }

  // 2. MAINTENANCE MODE SCREEN (Controlled in Real-Time by Admin Panel)
  if (adminSettings?.maintenanceMode) {
    return (
      <SafeErrorBoundary fallbackView={() => {}}>
        <div 
          className="min-h-screen flex flex-col items-center justify-center p-6 text-center selection:bg-amber-500 selection:text-white"
          style={{ backgroundColor: adminSettings?.appBgColor || '#f8fafc' }}
        >
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-4xl mb-5 shadow-sm">
              🛠️
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
              {adminSettings?.maintenanceTitle || 'ऐप मेंटेनेंस कार्य चल रहा है'}
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              {adminSettings?.maintenanceMessage || 'प्रिय छात्रों, हम ऐप को और बेहतर बनाने के लिए मेंटेनेंस कर रहे हैं। ऐप जल्द वापस चालू हो जाएगा।'}
            </p>

            {adminSettings?.maintenanceEta && (
              <div className="w-full py-2.5 px-4 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-800 text-xs font-semibold mb-4">
                ⏱️ {adminSettings.maintenanceEta}
              </div>
            )}

            {adminSettings?.maintenanceContact && (
              <p className="text-xs text-slate-500 mb-6 font-medium">
                {adminSettings.maintenanceContact}
              </p>
            )}

            <button
              onClick={() => {
                loadStudyBullApp().then(appData => {
                  if (appData?.settings) {
                    setAdminSettings(appData.settings);
                  }
                });
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-sm shadow-md active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              {langHindi ? 'पुनः जांचें (Refresh)' : 'Check Again'}
            </button>
          </div>
        </div>
      </SafeErrorBoundary>
    );
  }

  return (
    <SafeErrorBoundary fallbackView={() => setCurrentView('home')}>
      <div 
        className={`min-h-screen font-sans selection:bg-blue-600 selection:text-white antialiased ${adminSettings?.darkMode ? 'dark bg-slate-950 text-white' : 'text-slate-900'}`}
        style={{
          backgroundColor: adminSettings?.darkMode ? '#0b1120' : (adminSettings?.appBgColor || '#f1f5ff'),
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
        }}
      >
        {/* Top Header - Controlled live by Admin App */}
        <header 
          className="sticky top-0 z-40 text-white shadow-md transition-all"
          style={{
            background: `linear-gradient(to right, ${adminSettings?.primaryColor || '#1546b5'}, ${adminSettings?.secondaryColor || '#3d2db3'})`
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {currentView !== 'home' ? (
                <button 
                  onClick={handleBack}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{langHindi ? 'वापस' : 'Back'}</span>
                </button>
              ) : (
                adminSettings?.logoImageUrl ? (
                  <img 
                    src={adminSettings.logoImageUrl} 
                    alt="Logo" 
                    className="w-9 h-9 rounded-2xl object-cover shadow-inner select-none"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-2xl bg-amber-400 flex items-center justify-center text-xl shadow-inner select-none">
                    {adminSettings?.logoEmoji || '🤓'}
                  </div>
                )
              )}
              <div>
                <h1 className="text-base font-bold tracking-wide flex items-center gap-2">
                  {getHeaderTitle()}
                </h1>
                {currentView === 'home' && adminSettings?.appSubtitle && (
                  <p className="text-[10px] text-white/80 line-clamp-1 leading-tight">
                    {adminSettings.appSubtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition border border-white/20 active:scale-95 cursor-pointer"
                title={soundMuted ? 'ध्वनि चालू करें' : 'ध्वनि बंद करें'}
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Real-time Announcement Bar from Admin Panel */}
          {currentView === 'home' && adminSettings?.announcementEnabled !== false && adminSettings?.announcementText && (
            <div className="bg-amber-400 text-slate-950 text-xs font-semibold px-4 py-2 flex items-center space-x-2 border-t border-amber-300 shadow-inner">
              <span className="shrink-0 text-sm">📢</span>
              <span className="truncate">{adminSettings.announcementText}</span>
            </div>
          )}
        </header>

        {/* Main View Area */}
        <main className="max-w-4xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {/* 1. HOME SCREEN: ONLY CLEAN PURE BUTTON CARDS (NO EXPLORE/START AT BOTTOM) */}
            {currentView === 'home' && (
              <>
                {/* Admin Welcome Heading if configured */}
                {adminSettings?.welcomeHeading && (
                  <div className="mb-4">
                    <h2 className="text-lg sm:text-xl font-black text-slate-800">
                      {adminSettings.welcomeHeading}
                    </h2>
                    {adminSettings?.appSubtitle && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {adminSettings.appSubtitle}
                      </p>
                    )}
                  </div>
                )}
                <motion.div
                  key="home-grid"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Loading skeleton while fetching live buttons from database */}
                    {!isDbLoaded && adminNodes.length === 0 && (
                      <div className="col-span-2 sm:col-span-2 md:col-span-3 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs animate-pulse flex flex-col justify-between h-36">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100" />
                            <div className="space-y-2 w-full">
                              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty State when no buttons are added yet from Admin Panel */}
                    {isDbLoaded && adminNodes.length === 0 && (
                      <div className="col-span-2 sm:col-span-2 md:col-span-3 border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📲
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई बटन अभी नहीं है' : 'No Buttons Added Yet'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'अपने Admin Panel से Calculation, Typing Test, Quiz या Notes जोड़ें। वे तुरंत यहाँ दिखाई देंगे।'
                            : 'Add Calculation, Typing Test, Quiz or Notes from your Admin Panel. They will appear here live.'}
                        </p>
                        <button
                          onClick={() => {
                            setIsDbLoaded(false);
                            splitStore.start().catch(() => {}).finally(() => setIsDbLoaded(true));
                          }}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          {langHindi ? 'रिफ्रेश करें' : 'Refresh Now'}
                        </button>
                      </div>
                    )}

                    {/* All Buttons, Folders, and Sections Added via Admin Panel */}
                    {adminNodes.map((btn: any) => {
                      const target = String(btn.view || btn.target_view || btn.type || btn.id || '').toLowerCase();
                      const isCalc = target.includes('calc') || 
                        btn.kind === 'calc' || 
                        String(btn.title || '').toLowerCase().includes('calc') || 
                        String(btn.title || '').includes('कैलकुलेशन') || 
                        String(btn.title || '').toLowerCase().includes('speed math');
                      const isTyping = target.includes('typing') || 
                        btn.kind === 'typing' || 
                        String(btn.title || '').toLowerCase().includes('typing') || 
                        String(btn.title || '').includes('टाइपिंग');
                      const hasCustomHtml = Boolean(
                        btn.htmlContent || btn.html || btn.code || btn.rawHtml ||
                        (typeof btn.content === 'string' && (btn.content.includes('<html') || btn.content.includes('<!DOCTYPE') || btn.content.includes('<script')))
                      );
                      const displayTitle = resolveNodeTitle(btn, langHindi);
                      const displayIcon = resolveNodeIcon(btn);
                      const displaySubtitle = resolveNodeSubtitle(btn, langHindi);

                      const isSection = isSectionNode(btn);
                      const isFolder = isFolderNode(btn);

                      const handleNodeClick = () => {
                        handleNodeInteraction(btn);
                      };

                        // 1. SECTION (Image: Full-width horizontal title banner with tag badge)
                        if (isSection) {
                          return (
                            <button
                              key={btn.id}
                              onClick={handleNodeClick}
                              className="col-span-2 sm:col-span-2 md:col-span-3 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-white border border-blue-200/80 hover:border-blue-300 rounded-2xl p-4 flex items-center justify-between shadow-sm my-1 text-left w-full cursor-pointer transition active:scale-98"
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm">
                                  {displayIcon || '📑'}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight truncate">
                                    {displayTitle}
                                  </h3>
                                  {displaySubtitle && (
                                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                      {displaySubtitle}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-lg uppercase tracking-wider">
                                  Section
                                </span>
                                <ChevronRight className="w-4 h-4 text-blue-500" />
                              </div>
                            </button>
                          );
                        }

                        // 2. UNIFORM BLOCK GRID CARD (Used for both Folders and regular buttons)
                        const childCount = btn._splitPending ? Number(btn._childCount || 0) : (Array.isArray(btn.children) ? btn.children.length : 0);

                        if (isFolder) {
                          return (
                            <button
                              key={btn.id}
                              onClick={handleNodeClick}
                              className="col-span-2 sm:col-span-2 md:col-span-3 group relative bg-gradient-to-r from-amber-50 via-amber-50/90 to-amber-100/80 rounded-2xl p-4 shadow-sm border-2 border-amber-300/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between text-left overflow-hidden my-1 w-full active:scale-98"
                            >
                              {(loadingTileId === String(btn.id) || tileLoadError === String(btn.id)) && (
                              <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center rounded-2xl">
                                {loadingTileId === String(btn.id) ? (
                                  <span className="flex items-center gap-2 text-xs font-bold text-blue-700">
                                    <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    {langHindi ? 'लोड हो रहा है…' : 'Loading…'}
                                  </span>
                                ) : (
                                  <span className="px-2 text-center text-xs font-bold text-red-600">
                                    {langHindi ? 'नेटवर्क धीमा है — फिर से टैप करें' : 'Slow network — tap again'}
                                  </span>
                                )}
                              </div>
                            )}
                              <div className="flex items-center space-x-3.5 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-amber-200/90 group-hover:bg-amber-300 text-amber-900 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 group-hover:scale-105 transform duration-150">
                                  {displayIcon || '📂'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-extrabold text-amber-950 group-hover:text-amber-900 transition-colors text-base sm:text-lg tracking-tight truncate">
                                      {displayTitle}
                                    </h3>
                                    <span className="px-2 py-0.5 bg-amber-200/90 text-amber-900 text-[10px] font-extrabold rounded-md uppercase tracking-wider shrink-0 border border-amber-300/80 shadow-2xs">
                                      📁 {langHindi ? 'फोल्डर' : 'Folder'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-amber-800/90 font-medium truncate mt-0.5">
                                    {displaySubtitle || (childCount > 0 ? (langHindi ? `${childCount} सामग्री मौजूद` : `${childCount} items inside`) : (langHindi ? 'फोल्डर खोलें' : 'Open Folder'))}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="px-2.5 py-1 bg-amber-200/80 text-amber-900 font-bold text-xs rounded-lg border border-amber-300/70 shadow-2xs hidden sm:inline-block">
                                  {childCount} {langHindi ? 'आइटम' : 'items'}
                                </span>
                                <ChevronRight className="w-5 h-5 text-amber-700 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </button>
                          );
                        }

                        return (
                          <button
                            key={btn.id}
                            onClick={handleNodeClick}
                            className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                          >
                            <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                            </div>
                            {(loadingTileId === String(btn.id) || tileLoadError === String(btn.id)) && (
                              <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center rounded-2xl">
                                {loadingTileId === String(btn.id) ? (
                                  <span className="flex items-center gap-2 text-xs font-bold text-blue-700">
                                    <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    {langHindi ? 'लोड हो रहा है…' : 'Loading…'}
                                  </span>
                                ) : (
                                  <span className="px-2 text-center text-xs font-bold text-red-600">
                                    {langHindi ? 'नेटवर्क धीमा है — फिर से टैप करें' : 'Slow network — tap again'}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                              {displayIcon || '⚡'}
                            </div>

                            <div className="w-full">
                              <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                                {displayTitle}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                                {displaySubtitle || (langHindi ? 'बटन खोलें' : 'Open Button')}
                              </p>
                            </div>
                          </button>
                        );
                      })}

                    {/* Code-defined block tiles (not from admin data), same card as the admin button tiles: Eligibility Checker, then Job Alert */}
                    {(isDbLoaded || adminNodes.length > 0) && (
                      <button
                        key="eligibility-checker-tile"
                        onClick={() => navigateTo('eligibility')}
                        className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                      >
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-extrabold rounded-md leading-none">NEW</span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                        </div>

                        <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                          ✅
                        </div>

                        <div className="w-full">
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                            {langHindi ? 'पात्रता जाँच' : 'Eligibility Checker'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                            {langHindi ? 'कौन-सी परीक्षा दे सकते हैं?' : 'Which exams can you apply for?'}
                          </p>
                        </div>
                      </button>
                    )}
                    {(isDbLoaded || adminNodes.length > 0) && (
                      <button
                        key="job-alert-tile"
                        onClick={() => navigateTo('job_alert')}
                        className="group relative bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-400 transition-all cursor-pointer flex flex-col items-start justify-between text-left overflow-hidden h-36 active:scale-98"
                      >
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm animate-pulse"></span>
                        </div>

                        <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center text-2xl shadow-inner flex-shrink-0 mb-2">
                          🔔
                        </div>

                        <div className="w-full">
                          <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base leading-snug line-clamp-1">
                            {langHindi ? 'Job Alert' : 'Job Alert'}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5 font-medium line-clamp-1">
                            {langHindi ? 'सरकारी नौकरी • अंतिम तिथि' : 'Govt jobs • last dates'}
                          </p>
                        </div>
                      </button>
                    )}
                    </div>
                  </motion.div>
              </>
            )}

            {/* 2. QUIZ SUBJECT CATEGORIES */}
            {currentView === 'eligibility' && (
              <React.Suspense fallback={<ScreenLoader />}>
              <EligibilityList
                onOpenExam={(id) => {
                  setEligibilityExamId(id);
                  navigateTo('eligibility_exam');
                }}
              />
              </React.Suspense>
            )}

            {currentView === 'eligibility_exam' && <React.Suspense fallback={<ScreenLoader />}><EligibilityExam examId={eligibilityExamId} /></React.Suspense>}

            {currentView === 'job_alert' && <React.Suspense fallback={<ScreenLoader />}><JobAlert /></React.Suspense>}

            {currentView === 'quiz_categories' && (
              <motion.div
                key="quiz-categories"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {langHindi ? 'विषयवार प्रैक्टिस क्विज' : 'Subject-Wise Practice Quizzes'}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    {langHindi ? 'विषय चुनें और 4-विकल्प MCQs हल करें' : 'Select a subject to practice 4-option MCQs'}
                  </p>
                </div>

                {(() => {
                  const quizSubjects = getQuizSubjectsFromAdmin(adminNodes);
                  if (quizSubjects.length === 0) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📝
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई क्विज अभी उपलब्ध नहीं है' : 'No Quizzes Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से नए MCQs या विषयवार क्विज जोड़ें। वे तुरंत यहाँ दिखाई देंगे।'
                            : 'Add new MCQs or Subject Quizzes from your Admin Panel. They will appear here live.'}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {quizSubjects.map((subj) => (
                        <button
                          key={subj.id}
                          onClick={() => {
                            setSelectedSubject(subj);
                            setQuizQuestions(subj.questions);
                            setQuizIndex(0);
                            setUserQuizAnswers(new Array(subj.questions.length).fill(null));
                            setQuizScore(0);
                            setIsAnswerRevealed(false);
                            navigateTo('quiz_play');
                          }}
                          className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-blue-300 cursor-pointer flex items-center space-x-4 text-left transition active:scale-98"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                            {subj.icon || '📝'}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">{langHindi ? subj.title : subj.titleEn}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">{langHindi ? subj.subtitle : subj.subtitleEn}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* 3. QUIZ PLAY (MCQ REAL EXPERIENCE WITH INSTANT GREEN/RED FEEDBACK) */}
            {currentView === 'quiz_play' && (
              <motion.div
                key="quiz-play"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto space-y-6"
              >
                {(() => {
                  const currentQ = quizQuestions ? (quizQuestions[quizIndex] || quizQuestions[0]) : null;
                  if (!currentQ) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📝
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई प्रश्न उपलब्ध नहीं है' : 'No Questions Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से इस क्विज के लिए प्रश्न जोड़ें।' 
                            : 'Add questions for this quiz from Admin Panel.'}
                        </p>
                        <button
                          onClick={() => navigateTo('quiz_categories')}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          {langHindi ? 'श्रेणियां देखें' : 'View Categories'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="flex items-center justify-between pb-4 border-b border-slate-100 text-xs font-bold text-slate-500">
                        <span>{langHindi ? `प्रश्न ${quizIndex + 1} / ${quizQuestions.length}` : `Question ${quizIndex + 1} / ${quizQuestions.length}`}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setLangHindi(!langHindi)}
                            className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition border border-blue-200 active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                            title="Language Toggle / भाषा बदलें"
                          >
                            <span>🌐</span>
                            <span>{langHindi ? 'EN' : 'हिंदी'}</span>
                          </button>
                          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-bold">
                            {langHindi ? `स्कोर: ${quizScore}` : `Score: ${quizScore}`}
                          </span>
                        </div>
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                        {langHindi ? currentQ.question : currentQ.questionEn}
                      </h2>

                      <div className="space-y-3">
                        {currentQ.options.map((opt, idx) => {
                          const isCorrect = idx === currentQ.correct;
                          const isSelected = userQuizAnswers[quizIndex] === idx;
                          let btnStyle = "border-slate-200 bg-white hover:bg-slate-50 text-slate-800";
                          let icon = null;

                          if (isAnswerRevealed) {
                            if (isCorrect) {
                              btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-sm";
                              icon = <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
                            } else if (isSelected) {
                              btnStyle = "border-rose-500 bg-rose-50 text-rose-950 font-bold shadow-sm";
                              icon = <XCircle className="w-5 h-5 text-rose-600" />;
                            }
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!isAnswerRevealed) {
                                  // (tap sound dropped here: the correct/wrong sound plays at the same moment)
                                  const updated = [...userQuizAnswers];
                                  updated[quizIndex] = idx;
                                  setUserQuizAnswers(updated);
                                  setIsAnswerRevealed(true);

                                  if (idx === currentQ.correct) {
                                    playGentleSound('correct', soundMuted);
                                    setQuizScore(prev => prev + 1);
                                  } else {
                                    playGentleSound('wrong', soundMuted);
                                  }
                                }
                              }}
                              disabled={isAnswerRevealed}
                              className={"w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between font-medium active:scale-98 cursor-pointer " + btnStyle}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span>{langHindi ? opt : currentQ.optionsEn?.[idx] || opt}</span>
                              </div>
                              {icon}
                            </button>
                          );
                        })}
                      </div>

                      {isAnswerRevealed && (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-950">
                          <p className="font-bold mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-blue-600" /> {langHindi ? 'व्याख्या (Explanation):' : 'Explanation:'}
                          </p>
                          <p>{langHindi ? (currentQ.explanation || currentQ.explanationEn) : (currentQ.explanationEn || currentQ.explanation)}</p>
                        </div>
                      )}

                      {isAnswerRevealed && (
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => {
                              if (quizIndex + 1 < quizQuestions.length) {
                                setQuizIndex(prev => prev + 1);
                                setIsAnswerRevealed(false);
                              } else {
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('quiz', {
                                  subject: selectedSubject.title,
                                  score: quizScore,
                                  total: quizQuestions.length
                                });
                                navigateTo('quiz_result');
                              }
                            }}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-md transition flex items-center gap-2 active:scale-95 cursor-pointer"
                          >
                            <span>{quizIndex + 1 < quizQuestions.length ? (langHindi ? 'अगला प्रश्न' : 'Next Question') : (langHindi ? 'रिजल्ट देखें' : 'View Results')}</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 4. QUIZ RESULT SCORECARD & COMPREHENSIVE ANSWER REVIEW */}
            {currentView === 'quiz_result' && (
              <motion.div
                key="quiz-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  🏆
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'क्विज परिणाम (Scorecard)' : 'Quiz Results (Scorecard)'}</h2>
                  <p className="text-xs text-slate-500">{langHindi ? selectedSubject.title : (selectedSubject.titleEn || selectedSubject.title)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल सही (Correct)' : 'Total Correct'}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{quizScore}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल गलत (Incorrect)' : 'Total Incorrect'}</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{quizQuestions.length - quizScore}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'सटीकता (Accuracy)' : 'Accuracy'}</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{Math.round((quizScore / (quizQuestions.length || 1)) * 100)}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल प्रश्न (Total)' : 'Total Questions'}</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">{quizQuestions.length}</p>
                  </div>
                </div>

                {/* Question Review Section */}
                <div className="text-left border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setReviewExpanded(!reviewExpanded)}
                    className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <span>{reviewExpanded ? (langHindi ? 'विस्तृत समीक्षा छुपाएं' : 'Hide Detailed Review') : (langHindi ? 'सभी प्रश्नों की विस्तृत समीक्षा देखें' : 'View Detailed Answer Review')}</span>
                    {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {reviewExpanded && (
                    <div className="mt-4 space-y-4">
                      {quizQuestions.map((q, idx) => {
                        const userAns = userQuizAnswers[idx];
                        const isCorrect = userAns === q.correct;
                        return (
                          <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200')}>
                            <p className="font-bold text-slate-900 mb-1">
                              Q{idx + 1}. {langHindi ? q.question : (q.questionEn || q.question)}
                            </p>
                            <p className="text-slate-700 mb-1">
                              {langHindi ? 'आपका उत्तर:' : 'Your Answer:'} <span className={isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                                {userAns !== null && userAns !== undefined ? (langHindi ? q.options[userAns] : (q.optionsEn?.[userAns] || q.options[userAns])) : (langHindi ? 'अनुत्तरित' : 'Unanswered')}
                              </span>
                            </p>
                            {!isCorrect && (
                              <p className="text-emerald-800 font-bold mb-1">
                                {langHindi ? 'सही उत्तर:' : 'Correct Answer:'} {langHindi ? q.options[q.correct] : (q.optionsEn?.[q.correct] || q.options[q.correct])}
                              </p>
                            )}
                            <p className="text-slate-600 mt-1 italic">
                              💡 {langHindi ? q.explanation : (q.explanationEn || q.explanation)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setQuizIndex(0);
                      setUserQuizAnswers(new Array(quizQuestions.length).fill(null));
                      setQuizScore(0);
                      setIsAnswerRevealed(false);
                      navigateTo('quiz_play');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'पुनः अभ्यास' : 'Practice Again'}
                  </button>
                  <button
                    onClick={() => navigateTo('quiz_categories')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'विषय बदलें' : 'Change Subject'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* 5. MOCK TEST PLAY */}
            {currentView === 'mock_play' && (
              <motion.div
                key="mock-play"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8 max-w-2xl mx-auto space-y-6"
              >
                {(() => {
                  const currentMockQ = mockQuestions[mockIndex] || mockQuestions[0];
                  if (!currentMockQ) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📋
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई मॉक टेस्ट प्रश्न उपलब्ध नहीं है' : 'No Mock Test Questions Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से नया मॉक टेस्ट या MCQs जोड़ें।' 
                            : 'Add a new mock test or MCQs from Admin Panel.'}
                        </p>
                        <button
                          onClick={() => navigateTo('home')}
                          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          {langHindi ? 'होम पर वापस जाएं' : 'Back to Home'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <>
                      <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-sm flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-mono text-emerald-400 font-bold text-lg">
                          <Clock className="w-5 h-5" />
                          <span>{String(Math.floor(mockTimer / 60)).padStart(2, '0')}:{String(mockTimer % 60).padStart(2, '0')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setLangHindi(!langHindi)}
                            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition border border-white/20 active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                          >
                            <span>🌐</span>
                            <span>{langHindi ? 'EN' : 'हिंदी'}</span>
                          </button>
                          <div className="text-xs font-bold text-slate-300">
                            {langHindi ? `प्रश्न ${mockIndex + 1} / ${mockQuestions.length}` : `Question ${mockIndex + 1} / ${mockQuestions.length}`}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setMockTimerActive(false);
                            playGentleSound('celebrate', soundMuted);
                            navigateTo('mock_result');
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
                        >
                          {langHindi ? 'सबमिट करें (Submit)' : 'Submit Test'}
                        </button>
                      </div>

                      {/* Question Navigation Palette */}
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {mockQuestions.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setMockIndex(i)}
                            className={"w-9 h-9 rounded-xl font-bold text-xs transition cursor-pointer " + (mockIndex === i ? 'bg-blue-600 text-white ring-2 ring-blue-300' : userMockAnswers[i] !== null ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700')}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                        {langHindi ? currentMockQ.question : currentMockQ.questionEn}
                      </h2>

                      <div className="space-y-3">
                        {currentMockQ.options.map((opt, idx) => {
                          const isSelected = userMockAnswers[mockIndex] === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                playGentleSound('tap', soundMuted);
                                const updated = [...userMockAnswers];
                                updated[mockIndex] = idx;
                                setUserMockAnswers(updated);
                              }}
                              className={"w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3 font-medium active:scale-98 cursor-pointer " + (isSelected ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800')}
                            >
                              <span className={"w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold " + (isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex justify-between pt-4 border-t border-slate-100">
                        <button
                          onClick={() => setMockIndex(prev => Math.max(0, prev - 1))}
                          disabled={mockIndex === 0}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm disabled:opacity-50 active:scale-95 cursor-pointer"
                        >
                          {langHindi ? 'पिछला (Previous)' : 'Previous'}
                        </button>
                        <button
                          onClick={() => {
                            if (mockIndex + 1 < mockQuestions.length) {
                              setMockIndex(prev => prev + 1);
                            } else {
                              setMockTimerActive(false);
                              playGentleSound('celebrate', soundMuted);
                              recordUserAttempt('mock', {
                                answers: userMockAnswers,
                                timeTaken: mockDurationSec - mockTimer
                              });
                              navigateTo('mock_result');
                            }
                          }}
                          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm active:scale-95 cursor-pointer"
                        >
                          {mockIndex + 1 < mockQuestions.length ? (langHindi ? 'अगला (Next)' : 'Next') : (langHindi ? 'सबमिट टेस्ट' : 'Submit Test')}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 6. MOCK TEST RESULT REPORT */}
            {currentView === 'mock_result' && (
              <motion.div
                key="mock-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-blue-100 text-blue-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  📊
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'मॉक टेस्ट स्कोरकार्ड (Analysis)' : 'Mock Test Scorecard (Analysis)'}</h2>
                  <p className="text-xs text-slate-500">{langHindi ? 'रिएल एग्जाम सिमुलेशन रिपोर्ट' : 'Real Exam Simulation Report'}</p>
                </div>

                {(() => {
                  let correct = 0;
                  let wrong = 0;
                  let unattempted = 0;
                  const secMap: Record<string, { total: number; correct: number; wrong: number }> = {};
                  mockQuestions.forEach((q, idx) => {
                    const ans = userMockAnswers[idx];
                    const sec = String(q.category || '');
                    if (!secMap[sec]) secMap[sec] = { total: 0, correct: 0, wrong: 0 };
                    secMap[sec].total++;
                    if (ans === null || ans === undefined) unattempted++;
                    else if (ans === q.correct) { correct++; secMap[sec].correct++; }
                    else { wrong++; secMap[sec].wrong++; }
                  });
                  const marksScore = correct * mockMarks.pos - wrong * mockMarks.neg;
                  const marksTotal = mockQuestions.length * mockMarks.pos;
                  const secNames = Object.keys(secMap);
                  const showSections = secNames.length > 1;

                  return (
                    <>
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200" data-testid="mock-marks">
                        <p className="text-xs text-blue-700 font-bold">{langHindi ? 'कुल अंक (Marks)' : 'Total Marks'}</p>
                        <p className="text-3xl font-bold text-blue-900 mt-1">{langHindi ? 'अंक: ' : 'Marks: '}{fmtMarks(marksScore)} / {fmtMarks(marksTotal)}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {langHindi ? `सही +${fmtMarks(mockMarks.pos)}, गलत −${fmtMarks(mockMarks.neg)}, छोड़े 0` : `Correct +${fmtMarks(mockMarks.pos)}, Wrong −${fmtMarks(mockMarks.neg)}, Skipped 0`}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                          <p className="text-xs text-emerald-700 font-bold">{langHindi ? 'सही (Correct)' : 'Correct'}</p>
                          <p className="text-2xl font-bold text-emerald-800 mt-1">{correct}</p>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
                          <p className="text-xs text-rose-700 font-bold">{langHindi ? 'गलत (Wrong)' : 'Wrong'}</p>
                          <p className="text-2xl font-bold text-rose-800 mt-1">{wrong}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                          <p className="text-xs text-slate-600 font-bold">{langHindi ? 'छोड़े गए (Skipped)' : 'Skipped'}</p>
                          <p className="text-2xl font-bold text-slate-800 mt-1">{unattempted}</p>
                        </div>
                      </div>

                      {showSections && (
                        <div className="text-left border border-slate-200 rounded-2xl overflow-hidden text-xs">
                          <div className="grid grid-cols-4 gap-1 bg-slate-50 px-3 py-2 font-bold text-slate-600">
                            <span>{langHindi ? 'सेक्शन' : 'Section'}</span><span className="text-center">{langHindi ? 'सही' : 'Correct'}</span><span className="text-center">{langHindi ? 'गलत' : 'Wrong'}</span><span className="text-right">{langHindi ? 'अंक' : 'Marks'}</span>
                          </div>
                          {secNames.map(name => {
                            const r = secMap[name];
                            return (
                              <div key={name || '-'} className="grid grid-cols-4 gap-1 px-3 py-2 border-t border-slate-100 text-slate-800">
                                <span className="truncate">{name || (langHindi ? 'अन्य' : 'Other')}</span>
                                <span className="text-center text-emerald-700">{r.correct}</span>
                                <span className="text-center text-rose-700">{r.wrong}</span>
                                <span className="text-right font-bold">{fmtMarks(r.correct * mockMarks.pos - r.wrong * mockMarks.neg)} / {fmtMarks(r.total * mockMarks.pos)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Mock Detailed Review */}
                      <div className="text-left border-t border-slate-100 pt-4">
                        <button
                          onClick={() => setReviewExpanded(!reviewExpanded)}
                          className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                        >
                          <span>{reviewExpanded ? (langHindi ? 'प्रश्नों की समीक्षा छुपाएं' : 'Hide Answer Review') : (langHindi ? 'प्रश्नों के सही उत्तर व व्याख्या देखें' : 'View Correct Answers & Explanations')}</span>
                          {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>

                        {reviewExpanded && (
                          <div className="mt-4 space-y-4">
                            {mockQuestions.map((q, idx) => {
                              const userAns = userMockAnswers[idx];
                              const isCorrect = userAns === q.correct;
                              return (
                                <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200')}>
                                  <p className="font-bold text-slate-900 mb-1">
                                    Q{idx + 1}. {langHindi ? q.question : (q.questionEn || q.question)}
                                  </p>
                                  <p className="text-slate-700 mb-1">
                                    {langHindi ? 'आपका उत्तर:' : 'Your Answer:'} <span className={isCorrect ? 'text-emerald-700 font-bold' : userAns === null ? 'text-slate-500' : 'text-rose-700 font-bold'}>
                                      {userAns !== null && userAns !== undefined ? (langHindi ? q.options[userAns] : (q.optionsEn?.[userAns] || q.options[userAns])) : (langHindi ? 'छोड़ा गया' : 'Skipped')}
                                    </span>
                                  </p>
                                  <p className="text-emerald-800 font-bold mb-1">
                                    {langHindi ? 'सही उत्तर:' : 'Correct Answer:'} {langHindi ? q.options[q.correct] : (q.optionsEn?.[q.correct] || q.options[q.correct])}
                                  </p>
                                  <p className="text-slate-600 mt-1 italic">
                                    💡 {langHindi ? q.explanation : (q.explanationEn || q.explanation)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setUserMockAnswers(new Array(mockQuestions.length).fill(null));
                      setMockIndex(0);
                      setMockTimer(mockDurationSec);
                      setMockTimerActive(true);
                      navigateTo('mock_play');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'पुनः टेस्ट दें' : 'Retake Test'}
                  </button>
                  <button
                    onClick={() => navigateTo('home')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'होम स्क्रीन पर लौटें' : 'Return to Home'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* 7. NOTES LIBRARY */}
            {currentView === 'notes_lib' && (
              <motion.div
                key="notes-lib"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{langHindi ? 'विषयवार PDF नोट्स लाइब्रेरी' : 'Subject-Wise PDF Notes Library'}</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{langHindi ? 'विषय चुनें और इन-ऐप PDF नोट्स पढ़ें' : 'Select subject to read in-app PDF notes'}</p>
                </div>

                {(() => {
                  const notesChapters = getNotesChaptersFromAdmin(adminNodes);
                  if (notesChapters.length === 0) {
                    return (
                      <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-6">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl mb-3">
                          📚
                        </div>
                        <h3 className="text-base font-bold text-slate-800">
                          {langHindi ? 'कोई नोट्स अभी उपलब्ध नहीं हैं' : 'No Notes Available'}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm">
                          {langHindi 
                            ? 'Admin Panel से नए नोट्स या PDF जोड़ें। वे तुरंत यहाँ दिखाई देंगे।'
                            : 'Add new Notes or PDF from your Admin Panel. They will appear here live.'}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3 max-w-2xl mx-auto">
                      {notesChapters.map((chap) => (
                        <button
                          key={chap.id}
                          onClick={() => {
                            setSelectedChapter(chap);
                            navigateTo('notes_reader');
                          }}
                          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-blue-300 cursor-pointer flex items-center justify-between text-left transition active:scale-98"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg flex-shrink-0">
                              📄
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm sm:text-base">{langHindi ? chap.title : (chap.titleEn || chap.title)}</h3>
                              <p className="text-xs text-slate-500 mt-0.5">{langHindi ? chap.subtitle : (chap.subtitleEn || chap.subtitle)}</p>
                            </div>
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* 8. NOTES FULL SCREEN READER (PDF VIEWER STYLE) */}
            {currentView === 'notes_reader' && (
              <motion.div
                key="notes-reader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="max-w-4xl mx-auto space-y-4 pb-12"
              >
                {(() => {
                  const allChapters = getNotesChaptersFromAdmin(adminNodes);
                  const chap = selectedChapter || allChapters[0];
                  if (!chap) {
                    return (
                      <div className="text-center py-16 bg-white rounded-xl border border-slate-300 shadow-sm p-8">
                        <p className="text-sm font-medium text-slate-600 mb-4">
                          {langHindi ? 'कोई नोट्स सामग्री उपलब्ध नहीं है' : 'No notes content available'}
                        </p>
                        <button
                          onClick={() => navigateTo('home')}
                          className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium shadow-sm cursor-pointer hover:bg-slate-800"
                        >
                          {langHindi ? 'मुख्य पृष्ठ पर लौटें' : 'Return to Home'}
                        </button>
                      </div>
                    );
                  }

                  const currentIndex = allChapters.findIndex(c => c.id === chap.id);
                  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
                  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

                  const fontSizeClass = readerFontSize === 'sm' ? 'text-sm' : readerFontSize === 'lg' ? 'text-lg' : readerFontSize === 'xl' ? 'text-xl' : 'text-base';
                  const wordCount = chap.content.split(/\s+/).length;
                  const readTime = Math.ceil(wordCount / 130);

                  return (
                    <>
                      {/* PDF Viewer Top Bar */}
                      <div className="bg-slate-800 text-slate-200 px-4 py-3 rounded-t-xl flex items-center justify-between flex-wrap gap-3 shadow-md">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={handleBack}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                          >
                            <span>←</span>
                            <span>{langHindi ? 'वापस' : 'Back'}</span>
                          </button>
                          <div className="flex items-center space-x-2 border-l border-slate-700 pl-3">
                            <span className="text-red-400 font-bold text-sm">PDF</span>
                            <span className="text-xs font-medium text-slate-300 truncate max-w-[200px] sm:max-w-xs">
                              {langHindi ? chap.title : (chap.titleEn || chap.title)}.pdf
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {/* Page Indicator */}
                          <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded">
                            {currentIndex + 1} / {allChapters.length}
                          </span>

                          {/* Font Size Adjuster */}
                          <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-700">
                            <button
                              onClick={() => setReaderFontSize('sm')}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition ${readerFontSize === 'sm' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                              title="Small Font"
                            >
                              A-
                            </button>
                            <button
                              onClick={() => setReaderFontSize('base')}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition ${readerFontSize === 'base' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                              title="Normal Font"
                            >
                              A
                            </button>
                            <button
                              onClick={() => setReaderFontSize('lg')}
                              className={`px-2 py-0.5 rounded text-xs font-bold transition ${readerFontSize === 'lg' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                              title="Large Font"
                            >
                              A+
                            </button>
                          </div>

                          {/* Dark / Light Mode */}
                          <button
                            onClick={() => setReaderDarkMode(!readerDarkMode)}
                            className="p-1.5 rounded bg-slate-900 hover:bg-slate-700 transition cursor-pointer text-slate-300"
                            title="Toggle Theme"
                          >
                            {readerDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                          </button>

                          {/* Copy Content */}
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(chap.content);
                              setCopiedNotification(true);
                              setTimeout(() => setCopiedNotification(false), 2000);
                            }}
                            className="p-1.5 rounded bg-slate-900 hover:bg-slate-700 transition relative cursor-pointer text-slate-300"
                            title="Copy Notes"
                          >
                            <Copy className="w-4 h-4" />
                            {copiedNotification && (
                              <span className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 bg-slate-950 text-white text-[10px] px-2 py-0.5 rounded shadow">
                                Copied!
                              </span>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* PDF Document Page View */}
                      <div className={`p-8 sm:p-16 rounded-b-xl border border-t-0 shadow-2xl transition-colors font-sans ${readerDarkMode ? 'bg-[#12141c] border-slate-800 text-white' : 'bg-white border-slate-300 text-black'}`}>
                        {/* Document Header */}
                        <div className={`border-b pb-6 mb-8 text-center sm:text-left ${readerDarkMode ? 'border-slate-800' : 'border-slate-300'}`}>
                          <div className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 font-bold mb-1">
                            {langHindi ? 'अध्याय नोट्स • अध्ययन सामग्री' : 'Chapter Notes • Study Material'}
                          </div>
                          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${readerDarkMode ? 'text-white' : 'text-black'}`}>
                            {langHindi ? chap.title : (chap.titleEn || chap.title)}
                          </h1>
                          {chap.subtitle && (
                            <p className={`text-sm font-semibold mt-1 ${readerDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                              {chap.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Document Content */}
                        {(() => {
                          const isHtmlContent = Boolean(
                            chap.content && (
                              chap.content.includes('<html') ||
                              chap.content.includes('<!DOCTYPE') ||
                              chap.content.includes('<script') ||
                              chap.content.includes('<style') ||
                              chap.content.includes('<div') ||
                              chap.content.includes('<body')
                            )
                          );

                          if (isHtmlContent) {
                            return (
                              <div className="w-full my-4 rounded-xl overflow-hidden shadow-xs border border-slate-200 dark:border-slate-800 bg-white">
                                <SandboxedHtmlView
                                  htmlContent={chap.content}
                                  title={langHindi ? chap.title : (chap.titleEn || chap.title)}
                                  minHeight={480}
                                />
                              </div>
                            );
                          }

                          return (
                            <div className={`space-y-4 leading-relaxed ${fontSizeClass}`}>
                              {chap.content.split('\n').map((paragraph, idx) => {
                                const trimmed = paragraph.trim();
                                if (!trimmed) return <div key={idx} className="h-3" />;
                                if (trimmed.startsWith('#') || trimmed.endsWith(':') || trimmed.startsWith('•') || trimmed.startsWith('-')) {
                                  return (
                                    <h3 key={idx} className={`font-black text-lg sm:text-xl mt-6 mb-2 border-b pb-1.5 ${readerDarkMode ? 'text-white border-slate-800' : 'text-black border-slate-300'}`}>
                                      {trimmed.replace(/^[#\-•]\s*/, '')}
                                    </h3>
                                  );
                                }
                                return (
                                  <p key={idx} className={`leading-relaxed font-semibold ${readerDarkMode ? 'text-slate-100' : 'text-black'}`}>
                                    {trimmed}
                                  </p>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Page Footer */}
                        <div className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                          <span>Page {currentIndex + 1} of {allChapters.length}</span>
                          <span>StudyNotes Pro</span>
                        </div>
                      </div>

                      {/* Bottom Navigation Bar */}
                      <div className="flex items-center justify-between pt-2 px-1 flex-wrap gap-3">
                        {prevChapter ? (
                          <button
                            onClick={() => setSelectedChapter(prevChapter)}
                            className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-2 cursor-pointer shadow-xs"
                          >
                            <span>←</span>
                            <span className="truncate max-w-[150px]">{prevChapter.title}</span>
                          </button>
                        ) : <div />}

                        {nextChapter ? (
                          <button
                            onClick={() => setSelectedChapter(nextChapter)}
                            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs ml-auto"
                          >
                            <span className="truncate max-w-[150px]">{nextChapter.title}</span>
                            <span>→</span>
                          </button>
                        ) : null}
                      </div>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 9. CALCULATION SETUP SCREEN (ALL SUBJECTS: PERCENTAGE, PROFIT & LOSS, TIME & WORK, ETC.) */}
            {currentView === 'calc_setup' && (
              <motion.div
                key="calc-setup"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="space-y-6 max-w-2xl mx-auto"
              >
                {/* Question Count */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{langHindi ? 'प्रश्नों की संख्या (Question Count)' : 'Question Count'}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[10, 25, 50, 100, 'Infinite'].map((cnt) => (
                      <button
                        key={String(cnt)}
                        onClick={() => setCalcCount(cnt as number | 'Infinite')}
                        className={"py-3 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (calcCount === cnt ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {cnt === 'Infinite' ? (langHindi ? 'असीमित' : 'Unlimited') : `${cnt} Q`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-500" /> {langHindi ? 'कठिनाई स्तर (Difficulty)' : 'Difficulty Level'}
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {(['सरल', 'मध्यम', 'कठिन', 'प्रो'] as const).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setCalcDifficulty(diff)}
                        className={"py-3 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (calcDifficulty === diff ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {langHindi ? diff : (diff === 'सरल' ? 'Easy' : diff === 'मध्यम' ? 'Medium' : diff === 'कठिन' ? 'Hard' : 'Pro')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mathematics Subjects */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-blue-600" /> {langHindi ? 'विषय चुनें (Math Topics)' : 'Select Math Topic'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setIsCustomTopicMode(!isCustomTopicMode);
                          if (!isCustomTopicMode && selectedCustomTopics.length === 0) {
                            const base = ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित'));
                            setSelectedCustomTopics(base.slice(0, 3));
                          }
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer active:scale-95 ${isCustomTopicMode ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`}
                      >
                        <span>🎛️</span>
                        <span>{langHindi ? (isCustomTopicMode ? 'सिंगल मोड' : 'कस्टम मिक्स (Multi)') : (isCustomTopicMode ? 'Single Mode' : 'Custom Mix (Multi)')}</span>
                      </button>
                      <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                        {isCustomTopicMode ? (langHindi ? `${selectedCustomTopics.length} चुने गए` : `${selectedCustomTopics.length} selected`) : (langHindi ? `${ALL_MATH_TOPICS.length} विषय` : `${ALL_MATH_TOPICS.length} topics`)}
                      </span>
                    </div>
                  </div>

                  {isCustomTopicMode && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 text-xs text-indigo-800 font-medium">
                      💡 {langHindi ? 'अपनी पसंद के जितने चाहें उतने चैप्टर्स पर क्लिक करें। प्रश्न सिर्फ इन्हीं चुने गए चैप्टर्स से मिक्स होकर आएंगे।' : 'Click multiple chapters of your choice. Questions will be randomly mixed from your selected chapters.'}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {ALL_MATH_TOPICS.filter(t => !t.includes('मिश्रित')).map((top) => {
                      const isSelected = isCustomTopicMode ? selectedCustomTopics.includes(top) : calcTopic === top;
                      return (
                        <button
                          key={top}
                          onClick={() => {
                            if (isCustomTopicMode) {
                              if (selectedCustomTopics.includes(top)) {
                                if (selectedCustomTopics.length > 1) {
                                  setSelectedCustomTopics(selectedCustomTopics.filter(t => t !== top));
                                }
                              } else {
                                setSelectedCustomTopics([...selectedCustomTopics, top]);
                              }
                            } else {
                              setCalcTopic(top);
                            }
                          }}
                          className={"p-3 rounded-xl text-left font-bold text-xs sm:text-sm border transition flex items-center justify-between gap-2.5 active:scale-98 cursor-pointer " + (isSelected ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100')}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className={"w-2.5 h-2.5 rounded-full shrink-0 " + (isSelected ? 'bg-blue-600 ring-4 ring-blue-100' : 'bg-slate-300')}></span>
                            <span className="truncate">{top}</span>
                          </div>
                          {isCustomTopicMode && (
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs border ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-300'}`}>
                              {isSelected ? '✓' : ''}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Button */}
                <button
                  onClick={generateCalculationSet}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-base shadow-md flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <span>🚀 {langHindi ? `अभ्यास शुरू करें (${calcCount === 'Infinite' ? 'असीमित प्रश्न' : `${calcCount} प्रश्न`})` : `Start Practice (${calcCount === 'Infinite' ? 'Unlimited' : `${calcCount} Questions`})`}</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {/* 10. CALCULATION PRACTICE (INSTANT FEEDBACK, ZERO REPETITIONS, 100% ACCURATE MATH) */}
            {currentView === 'calc_practice' && calcQuestions && calcQuestions.length > 0 && (
              <motion.div
                key="calc-practice"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="max-w-2xl mx-auto space-y-4"
              >
                {(() => {
                  const currentCalcQ = calcQuestions[calcIndex] || calcQuestions[0];
                  return (
                    <>
                      <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between text-xs font-bold text-slate-700 shadow-sm flex-wrap gap-2">
                        <span className="truncate max-w-[180px] sm:max-w-[220px]">{langHindi ? `टॉपिक: ${currentCalcQ.category || calcTopic}` : `Topic: ${currentCalcQ.category || calcTopic}`}</span>
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <button
                            onClick={() => setLangHindi(!langHindi)}
                            className="px-2 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition border border-blue-200 active:scale-95 cursor-pointer text-xs flex items-center gap-1"
                            title="Language Toggle / भाषा बदलें"
                          >
                            <span>🌐</span>
                            <span>{langHindi ? 'EN' : 'हिंदी'}</span>
                          </button>
                          <span className="text-amber-600 flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5" /> {calcScore}
                          </span>
                          <span className="flex items-center gap-1 text-blue-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{String(Math.floor(calcTimer / 60)).padStart(2, '0')}:{String(calcTimer % 60).padStart(2, '0')}</span>
                          </span>
                          <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                            Q {calcIndex + 1} {calcCount === 'Infinite' ? (langHindi ? '(∞ असीमित)' : '(∞ Unlimited)') : `/ ${calcQuestions.length}`}
                          </span>
                          {calcCount === 'Infinite' && (
                            <button
                              onClick={() => {
                                setCalcTimerActive(false);
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('calc', {
                                  topic: calcTopic,
                                  difficulty: calcDifficulty,
                                  correct: calcCorrectCount,
                                  wrong: calcWrongCount,
                                  timeTaken: calcTimer
                                });
                                navigateTo('calc_result');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold transition text-[11px] cursor-pointer"
                            >
                              {langHindi ? 'समाप्त करें' : 'Finish'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 text-center shadow-sm relative overflow-hidden">
                        <span className="absolute top-3 left-4 text-[10px] uppercase font-bold tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                          {langHindi ? `स्पीड कैलकुलेशन • ${calcDifficulty}` : `Speed Math • ${calcDifficulty}`}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 my-6 leading-relaxed">
                          {langHindi ? currentCalcQ.question : currentCalcQ.questionEn}
                        </h2>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {currentCalcQ.options.map((opt, idx) => {
                          let btnStyle = "border-slate-200 bg-white hover:bg-slate-50 text-slate-800";
                          let icon = null;

                          if (calcAnswered) {
                            if (idx === currentCalcQ.correct) {
                              btnStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-sm";
                              icon = <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
                            } else if (idx === calcSelected) {
                              btnStyle = "border-rose-500 bg-rose-50 text-rose-900 font-bold shadow-sm";
                              icon = <XCircle className="w-5 h-5 text-rose-600" />;
                            }
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (!calcAnswered) {
                                  // (tap sound dropped here: the correct/wrong sound plays at the same moment)
                                  setCalcSelected(idx);
                                  setCalcAnswered(true);
                                  const isCorrect = idx === currentCalcQ.correct;

                                  setCalcUserAnswers(prev => [...prev, { selected: idx, correct: isCorrect }]);

                                  if (isCorrect) {
                                    playGentleSound('correct', soundMuted);
                                    setCalcScore(prev => prev + 1);
                                    setCalcCorrectCount(prev => prev + 1);
                                  } else {
                                    playGentleSound('wrong', soundMuted);
                                    setCalcWrongCount(prev => prev + 1);
                                  }
                                }
                              }}
                              disabled={calcAnswered}
                              className={"p-4 sm:p-5 rounded-2xl border-2 transition-all flex items-center justify-between font-bold text-base sm:text-lg active:scale-98 cursor-pointer " + btnStyle}
                            >
                              <span>{opt}</span>
                              {icon}
                            </button>
                          );
                        })}
                      </div>

                      {calcAnswered && (
                        <div className={"rounded-2xl p-4 border text-sm " + (calcSelected === currentCalcQ.correct ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900')}>
                          <p className="font-bold mb-1">
                            {calcSelected === currentCalcQ.correct ? (langHindi ? '✅ सही उत्तर!' : '✅ Correct Answer!') : (langHindi ? `❌ गलत उत्तर! सही उत्तर था: ${currentCalcQ.options[currentCalcQ.correct]}` : `❌ Incorrect! Correct answer was: ${currentCalcQ.options[currentCalcQ.correct]}`)}
                          </p>
                          <p className="text-xs text-slate-700 mt-1 font-medium whitespace-pre-line">
                            📖 {langHindi ? currentCalcQ.explanation : (currentCalcQ.explanationEn || currentCalcQ.explanation)}
                          </p>
                          {currentCalcQ.shortcut && (
                            <p className="text-xs text-blue-700 mt-1.5 font-semibold">
                              ⚡ {currentCalcQ.shortcut}
                            </p>
                          )}
                        </div>
                      )}

                      {calcAnswered && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              if (calcIndex + 1 < calcQuestions.length) {
                                setCalcIndex(prev => prev + 1);
                                setCalcSelected(null);
                                setCalcAnswered(false);
                              } else if (calcCount === 'Infinite') {
                                const nextQ = generateUnlimitedMathQuestion(
                                  calcTopic,
                                  calcQuestions.length + 1,
                                  calcDifficulty,
                                  seenMathSignaturesRef.current
                                );
                                setCalcQuestions(prev => [...prev, nextQ]);
                                setCalcIndex(prev => prev + 1);
                                setCalcSelected(null);
                                setCalcAnswered(false);

                                try {
                                  const arr = Array.from(seenMathSignaturesRef.current).slice(-2000);
                                  localStorage.setItem('study_seen_math_questions_v2', JSON.stringify(arr));
                                } catch {}
                              } else {
                                setCalcTimerActive(false);
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('calc', {
                                  topic: calcTopic,
                                  difficulty: calcDifficulty,
                                  correct: calcCorrectCount,
                                  wrong: calcWrongCount,
                                  timeTaken: calcTimer
                                });
                                navigateTo('calc_result');
                              }
                            }}
                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-md transition flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                          >
                            <span>{calcCount === 'Infinite' || calcIndex + 1 < calcQuestions.length ? (langHindi ? 'अगला प्रश्न' : 'Next Question') : (langHindi ? 'रिजल्ट देखें' : 'View Results')}</span>
                            <ChevronRight className="w-5 h-5" />
                          </button>

                          {calcCount === 'Infinite' && (
                            <button
                              onClick={() => {
                                setCalcTimerActive(false);
                                playGentleSound('celebrate', soundMuted);
                                recordUserAttempt('calc', {
                                  topic: calcTopic,
                                  difficulty: calcDifficulty,
                                  correct: calcCorrectCount,
                                  wrong: calcWrongCount,
                                  timeTaken: calcTimer
                                });
                                navigateTo('calc_result');
                              }}
                              className="px-5 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-98 cursor-pointer text-sm"
                            >
                              {langHindi ? 'समाप्त करें' : 'Finish'}
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* 11. CALCULATION RESULT */}
            {currentView === 'calc_result' && (
              <motion.div
                key="calc-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-amber-100 text-amber-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  🏆
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'कैलकुलेशन रिपोर्ट कार्ड (Analysis)' : 'Calculation Report Card (Analysis)'}</h2>
                  <p className="text-xs text-slate-500">{calcTopic} • {calcDifficulty}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल सही (Correct)' : 'Total Correct'}</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{calcCorrectCount}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल गलत (Incorrect)' : 'Total Incorrect'}</p>
                    <p className="text-2xl font-bold text-rose-600 mt-1">{calcWrongCount}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल समय (Time Taken)' : 'Time Taken'}</p>
                    <p className="text-xl font-bold text-blue-600 mt-1">{calcTimer}s</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500 font-bold">{langHindi ? 'सटीकता (Accuracy)' : 'Accuracy'}</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">{Math.round((calcCorrectCount / (calcQuestions.length || 1)) * 100)}%</p>
                  </div>
                </div>

                {/* Calculation Questions Review */}
                <div className="text-left border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setReviewExpanded(!reviewExpanded)}
                    className="w-full flex items-center justify-between text-xs font-bold text-blue-700 bg-blue-50 px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <span>{reviewExpanded ? (langHindi ? 'सवालों की व्याख्या छुपाएं' : 'Hide Explanations') : (langHindi ? 'सभी सवालों के हल और शॉर्टकट ट्रिक्स देखें' : 'View All Solutions & Shortcut Tricks')}</span>
                    {reviewExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {reviewExpanded && (
                    <div className="mt-4 space-y-4">
                      {calcQuestions.map((q, idx) => {
                        const userAns = calcUserAnswers[idx];
                        const isCorrect = userAns ? userAns.correct : false;
                        return (
                          <div key={idx} className={"p-4 rounded-2xl border text-xs " + (isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200')}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-slate-900">Q{idx + 1}. {langHindi ? q.question : (q.questionEn || q.question)}</span>
                              <span className={"font-bold px-2 py-0.5 rounded " + (isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                {isCorrect ? (langHindi ? 'सही' : 'Correct') : (langHindi ? 'गलत' : 'Wrong')}
                              </span>
                            </div>
                            <p className="text-emerald-800 font-bold mb-1">
                              {langHindi ? 'सही उत्तर:' : 'Correct Answer:'} {langHindi ? q.options[q.correct] : (q.optionsEn?.[q.correct] || q.options[q.correct])}
                            </p>
                            <p className="text-slate-700 whitespace-pre-line mt-1">
                              {langHindi ? q.explanation : (q.explanationEn || q.explanation)}
                            </p>
                            {q.shortcut && (
                              <p className="text-blue-700 font-semibold mt-1">
                                ⚡ {q.shortcut}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={generateCalculationSet}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'नया सेट हल करें' : 'Solve New Set'}
                  </button>
                  <button
                    onClick={() => navigateTo('calc_setup')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'सेटअप बदलें' : 'Change Setup'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* 12. TYPING SKILLS SETUP */}
            {currentView === 'typing_setup' && (
              <motion.div
                key="typing-setup"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className="space-y-6 max-w-2xl mx-auto"
              >
                <div className="text-center">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{langHindi ? '⌨️ टाइपिंग स्पीड एवं एक्यूरेसी लैब' : '⌨️ Typing Speed & Accuracy Lab'}</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">{langHindi ? 'SSC CGL, CHSL, Delhi Police HC स्पीड एवं एक्यूरेसी टेस्ट' : 'SSC CGL, CHSL, Delhi Police HC Typing Test'}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">{langHindi ? 'समय अवधि चुनें (Duration):' : 'Select Time Duration:'}</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 5, 10, 'Infinite'].map((dur) => (
                      <button
                        key={String(dur)}
                        onClick={() => setTypingDuration(dur as number | 'Infinite')}
                        className={"py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition active:scale-95 cursor-pointer " + (typingDuration === dur ? 'bg-blue-600 border-blue-500 text-white shadow-sm' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200')}
                      >
                        {dur === 'Infinite' ? (langHindi ? '∞ नि:शुल्क' : '∞ Free') : `${dur} ${langHindi ? 'मि' : 'm'}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {langHindi ? 'उपलब्ध टाइपिंग टेस्ट्स:' : 'Available Typing Tests:'}
                  </h3>

                  {(() => {
                    const typingNode = adminNodes.find((n: any) => 
                      String(n.id || n.view || n.type || '').toLowerCase().includes('typing') ||
                      String(n.title || '').toLowerCase().includes('typing') ||
                      String(n.title || '').includes('टाइपिंग')
                    );
                    const adminTypingTests = (typingNode && Array.isArray(typingNode.passages) && typingNode.passages.length > 0)
                      ? typingNode.passages
                      : (typingNode && Array.isArray(typingNode.children) && typingNode.children.length > 0)
                        ? typingNode.children
                        : (typingNode && (typingNode.typingPassage || typingNode.passage))
                          ? [{ id: 'single-passage', title: typingNode.title || 'Typing Test', passage: typingNode.typingPassage || typingNode.passage }]
                          : [];

                    if (adminTypingTests.length === 0) {
                      return (
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-400 select-none bg-slate-50/60 my-2">
                          <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-xl mb-2">
                            ⌨️
                          </div>
                          <h4 className="text-sm font-bold text-slate-800">
                            {langHindi ? 'कोई टाइपिंग टेस्ट उपलब्ध नहीं है' : 'No Typing Tests Available'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-1 max-w-sm">
                            {langHindi 
                              ? 'Admin Panel से नया टाइपिंग टेस्ट पैसेज जोड़ें। वह तुरंत यहाँ लाइव दिखाई देगा।' 
                              : 'Add a new typing test passage from your Admin Panel. It will appear here live.'}
                          </p>
                        </div>
                      );
                    }

                    return adminTypingTests.map((testItem: any, idx: number) => {
                      const id = testItem.id || `typing-${idx}`;
                      const title = testItem.title || testItem.name || `टाइपिंग टेस्ट सेट #${idx + 1}`;
                      const sub = testItem.subtitle || testItem.sub || 'SSC & State Exams Typing';
                      const text = testItem.passage || testItem.text || testItem.typingPassage || testItem.content || testItem.html || '';

                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setActiveTypingPassage(text);
                            setActiveTypingTitle(title);
                            setTypedInput('');
                            setTypingStarted(false);
                            setTypingTimeLeft(typeof typingDuration === 'number' ? typingDuration * 60 : 120);
                            navigateTo('typing_practice');
                          }}
                          className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer flex items-center justify-between text-left transition active:scale-98 group"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center text-lg flex-shrink-0 transition-colors">
                              ⌨️
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-slate-900 group-hover:text-blue-600 text-sm truncate transition-colors">
                                {title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{sub}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                {langHindi ? `${text.trim().split(/\s+/).filter(Boolean).length} शब्द • ${text.length} अक्षर` : `${text.trim().split(/\s+/).filter(Boolean).length} words • ${text.length} chars`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 shrink-0 ml-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </motion.div>
            )}

            {/* 13. TYPING PRACTICE SCREEN */}
            {currentView === 'typing_practice' && (
              <motion.div
                key="typing-practice"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 p-3.5 sm:p-6 max-w-2xl mx-auto space-y-3 sm:space-y-5"
              >
                <div className="bg-slate-900 text-white rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex items-center justify-between shadow-sm">
                  <div className={"flex items-center gap-1.5 sm:gap-2 font-mono font-bold text-sm sm:text-lg " + (typingTimeLeft <= 10 && typingDuration !== 'Infinite' ? 'text-rose-400 animate-pulse' : 'text-emerald-400')}>
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>
                      {typingDuration === 'Infinite'
                        ? '∞ Free'
                        : `${String(Math.floor(typingTimeLeft / 60)).padStart(2, '0')}:${String(typingTimeLeft % 60).padStart(2, '0')}`}
                    </span>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase">WPM</p>
                    <p className="text-base sm:text-xl font-bold text-blue-400">
                      {(() => {
                        const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
                        const totalAllowedSec = typeof typingDuration === 'number' ? typingDuration * 60 : 120;
                        const elapsedSec = Math.max(1, totalAllowedSec - typingTimeLeft);
                        return Math.round((words / elapsedSec) * 60) || 0;
                      })()}
                    </p>
                  </div>
                  <div className="text-center font-mono">
                    <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase">ACC</p>
                    <p className="text-base sm:text-xl font-bold text-amber-400">
                      {(() => {
                        if (!typedInput) return '100%';
                        let correct = 0;
                        for (let i = 0; i < typedInput.length; i++) {
                          if (typedInput[i] === passageText[i]) correct++;
                        }
                        return `${Math.round((correct / typedInput.length) * 100)}%`;
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={submitTypingTest}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition shadow-sm active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'समाप्त' : 'Finish'}
                  </button>
                </div>

                {/* Passage Box with Real-time Scrolling and Color-coded Characters */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                    <span className="text-[11px] sm:text-xs">{langHindi ? 'मूल पैराग्राफ (टाइप करने हेतु टेक्स्ट):' : 'Original Passage (Text to Type):'}</span>
                    <span className="text-[10px] sm:text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                      {langHindi ? `${typedInput.length} / ${passageText.length} अक्षर` : `${typedInput.length} / ${passageText.length} chars`}
                    </span>
                  </div>
                  <div 
                    ref={typingScrollRef}
                    className="bg-slate-50 p-3 sm:p-5 rounded-2xl text-slate-800 font-mono text-sm sm:text-lg leading-relaxed border-2 border-slate-200 h-32 sm:h-52 overflow-y-auto overscroll-contain select-none shadow-inner"
                  >
                    {passageText.split('').map((char, index) => {
                      let charClass = "text-slate-700";
                      if (index < typedInput.length) {
                        if (typedInput[index] === char) {
                          charClass = "text-emerald-700 bg-emerald-100 font-bold";
                        } else {
                          charClass = "text-rose-700 bg-rose-200 font-bold underline";
                        }
                      } else if (index === typedInput.length) {
                        charClass = "active-char bg-blue-600 text-white font-bold underline px-0.5 rounded-xs ring-2 ring-blue-300 animate-pulse";
                      }
                      return (
                        <span key={index} className={charClass}>
                          {char}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Input Area (Compact & Mobile Keyboard Friendly) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                    <span className="text-[11px] sm:text-xs">{langHindi ? 'टाइपिंग इनपुट (यहीं टाइप करें):' : 'Typing Input (Type Here):'}</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-400">
                      {typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? (langHindi ? '⚠️ समय समाप्त (बंद)' : '⚠️ Time Over (Closed)') : (langHindi ? 'कीबोर्ड फ्रेंडली बॉक्स' : 'Keyboard friendly box')}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    disabled={typingTimeLeft <= 0 && typingDuration !== 'Infinite'}
                    value={typedInput}
                    onFocus={(e) => {
                      setTimeout(() => {
                        e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      }, 250);
                    }}
                    onChange={(e) => {
                      if (!typingStarted) setTypingStarted(true);
                      setTypedInput(e.target.value);
                      if (e.target.value.length >= passageText.length) {
                        submitTypingTest();
                      }
                    }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? (langHindi ? "समय समाप्त हो चुका है।" : "Time is over.") : (langHindi ? "कीबोर्ड से यहाँ टाइप करना शुरू करें..." : "Start typing here with keyboard...")}
                    className={"w-full h-18 sm:h-22 p-2.5 sm:p-3 rounded-2xl border-2 font-mono text-base sm:text-base leading-snug resize-none shadow-sm overscroll-contain transition-colors " + (typingTimeLeft <= 0 && typingDuration !== 'Infinite' ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' : 'border-blue-500 focus:ring-4 focus:ring-blue-100 focus:outline-none bg-white text-slate-900')}
                  />
                </div>
              </motion.div>
            )}

            {/* 14. TYPING RESULT REPORT */}
            {currentView === 'typing_result' && (
              <motion.div
                key="typing-result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-xl mx-auto text-center shadow-lg space-y-6"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-inner select-none">
                  🎉
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{langHindi ? 'टाइपिंग टेस्ट स्कोरकार्ड' : 'Typing Test Scorecard'}</h2>
                  <p className="text-xs text-slate-600 font-semibold">{activeTypingTitle}</p>
                </div>

                {(() => {
                  let correctChars = 0;
                  for (let i = 0; i < typedInput.length; i++) {
                    if (typedInput[i] === passageText[i]) correctChars++;
                  }
                  const words = typedInput.trim().split(/\s+/).filter(Boolean).length;
                  const accuracy = typedInput.length > 0 ? Math.round((correctChars / typedInput.length) * 100) : 0;
                  const timeTakenSec = 120 - typingTimeLeft || 1;
                  const wpm = Math.round((words / timeTakenSec) * 60);

                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'स्पीड (Speed)' : 'Speed'}</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{wpm} WPM</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'सटीकता (Accuracy)' : 'Accuracy'}</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{accuracy}%</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'टाइप किए गए शब्द' : 'Typed Words'}</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{words}</p>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <p className="text-xs text-slate-500 font-bold">{langHindi ? 'कुल वर्ण (Chars)' : 'Total Chars'}</p>
                        <p className="text-xl font-bold text-purple-600 mt-1">{typedInput.length}</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setTypedInput('');
                      setTypingStarted(false);
                      setTypingTimeLeft(120);
                      navigateTo('typing_practice');
                    }}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> {langHindi ? 'पुनः टेस्ट दें' : 'Retake Test'}
                  </button>
                  <button
                    onClick={() => navigateTo('typing_setup')}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition active:scale-95 cursor-pointer"
                  >
                    {langHindi ? 'सेटअप बदलें' : 'Change Setup'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </SafeErrorBoundary>
  );
}
